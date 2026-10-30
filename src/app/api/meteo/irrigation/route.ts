/**
 * API Route Météo - Recommandations d'irrigation intelligentes
 * GET /api/meteo/irrigation → recommandations pour toutes les cultures actives
 * GET /api/meteo/irrigation?parcelleId=X → filtré par parcelle
 * GET /api/meteo/irrigation?refresh=1 → force le recalcul (ignore le cache)
 *
 * Cache en mémoire de 2 minutes (src/lib/irrigation-cache.ts), sauf quand une
 * zone n'a pas de météo : le prochain affichage retente.
 *
 * Une culture sans météo (zone muette, parcelle à géolocaliser) reste dans la
 * liste avec le repli des tâches (`urgenceFallback` : jamais critique, motif
 * qui dit pourquoi) et `sansMeteo` renseigné ; la réponse porte
 * `zonesIndisponibles`, `culturesSansMeteo` et `indisponible` (aucune zone
 * calculée). Avant la revue du 2026-10-28, ces cultures disparaissaient et une
 * panne se lisait « Aucune culture active nécessitant une analyse ».
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { chargerMeteoBilan, debutArrosagesBilan, jourLocalIso } from '@/lib/irrigation/meteo-bilan'
import { chargerArrosagesSaisis, dernierArrosage } from '@/lib/irrigation/arrosages-saisis'
import { dernierArrosageDuLieu } from '@/lib/irrigation/bilan-culture'
import { genererRecommandationIrrigation, type RecommandationIrrigation } from '@/lib/meteo-agro'
import { irrigationCache, irrigationCacheKey } from '@/lib/irrigation-cache'
import { cultureIrrigationDemarreeWhere } from '@/lib/irrigation-eligibility'
import { urgenceFallback, whereCulturesEnPlace } from '@/lib/irrigation-conseil'
import { grouperRecommandationsParPlanche } from '@/lib/irrigation-planche'
import { etatCulture } from '@/lib/cultures/etat'
import { surfaceCultureM2 } from '@/lib/culture-surface'
import { typeSousAbri } from '@/lib/irrigation/abri'
import { joursEntre, sourceSol } from '@/lib/irrigation/bilan-sol'
import type { CauseSansMeteo } from '@/lib/irrigation/meteo-indisponible'
import type { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)
    const parcelleId = searchParams.get('parcelleId')
    const forceRefresh = searchParams.get('refresh') === '1'

    const cacheKey = irrigationCacheKey(userId, parcelleId)

    // Vérifier le cache (sauf si refresh forcé) AVANT tout appel externe.
    if (!forceRefresh) {
      const cached = irrigationCache.get(cacheKey) as {
        data: unknown; cachedAt: Date; ageSeconds: number
      } | null
      if (cached) {
        const payload = cached.data as Record<string, unknown>
        return NextResponse.json({
          ...payload,
          cached: true,
          cachedAt: cached.cachedAt.toISOString(),
          cacheAgeMinutes: Math.floor(cached.ageSeconds / 60),
        })
      }
    }

    // ── Calcul complet ──────────────────────────────────────────

    // Récupérer les cultures actives (non terminées) avec leurs planches et parcelles
    // Mêmes cultures que les lignes « à arroser » (revue du 2026-10-10) : une
    // culture finie non clôturée ne doit pas sortir « critique » ici.
    const whereClause: Prisma.CultureWhereInput = {
      userId,
      terminee: null,
      AND: [cultureIrrigationDemarreeWhere, whereCulturesEnPlace(new Date().getFullYear())],
      planche: parcelleId
        ? { is: { parcelleGeoId: parcelleId } }
        : { isNot: null },
    }

    const cultures = await prisma.culture.findMany({
      where: whereClause,
      include: {
        espece: {
          select: { id: true, nom: true, besoinEau: true, vivace: true },
        },
        variete: { select: { nom: true, isPlaceholder: true } },
        planche: {
          select: {
            id: true,
            nom: true,
            type: true,
            irrigation: true,
            surface: true,
            largeur: true,
            longueur: true,
            retentionEau: true,
            typeSol: true,
            parcelleGeo: {
              select: {
                id: true,
                centroidLat: true,
                centroidLng: true,
                typeSol: true,
              },
            },
          },
        },
      },
    })

    if (cultures.length === 0) {
      const result = {
        recommandations: [], total: 0, totalCultures: 0, urgentes: 0,
        zonesIndisponibles: 0, culturesSansMeteo: 0, indisponible: false,
        message: 'Aucune culture active trouvée',
      }
      irrigationCache.set(cacheKey, result)
      return NextResponse.json({ ...result, cached: false, cachedAt: new Date().toISOString(), cacheAgeMinutes: 0 })
    }

    // Fallback coords : première parcelle géo de l'utilisateur
    let fallbackLat: number | null = null
    let fallbackLng: number | null = null
    const premiereParcelle = await prisma.parcelleGeo.findFirst({
      where: { userId, centroidLat: { not: null }, centroidLng: { not: null } },
      select: { centroidLat: true, centroidLng: true, typeSol: true },
    })
    if (premiereParcelle?.centroidLat && premiereParcelle?.centroidLng) {
      fallbackLat = premiereParcelle.centroidLat
      fallbackLng = premiereParcelle.centroidLng
    }
    // Même repli que le conseil des tâches : météo ET sol de la première parcelle.
    const solParcelleRepli = premiereParcelle?.typeSol ?? null

    // Regrouper les cultures par coordonnées de parcelle (évite les appels API redondants)
    const parCoords = new Map<string, {
      lat: number
      lng: number
      cultures: typeof cultures
    }>()
    // Sans coordonnées (ni parcelle géolocalisée, ni repli) : pas de météo,
    // mais la culture existe et l'écran invite à géolocaliser.
    const sansCoordonnees: typeof cultures = []

    for (const culture of cultures) {
      const lat = culture.planche?.parcelleGeo?.centroidLat ?? fallbackLat
      const lng = culture.planche?.parcelleGeo?.centroidLng ?? fallbackLng
      if (!lat || !lng) {
        sansCoordonnees.push(culture)
        continue
      }

      const key = `${Math.round(lat * 100)}_${Math.round(lng * 100)}`
      if (!parCoords.has(key)) {
        parCoords.set(key, { lat, lng, cultures: [] })
      }
      parCoords.get(key)!.cultures.push(culture)
    }

    // Arrosages saisis sur l'historique du bilan, « Noter » et interventions
    // « arrosage » (même chargeur que le conseil des tâches).
    const arrosages = await chargerArrosagesSaisis(userId, cultures, debutArrosagesBilan())

    // Même série que le conseil des tâches (30 jours d'archive, aujourd'hui,
    // 7 jours prévus), chargée en parallèle pour toutes les zones. La pluie du
    // jour d'une station de l'exploitation n'est plus appliquée à ce seul
    // écran : les deux écrans décident sur les mêmes données (aucune station
    // active le 2026-10-10).
    const zones = Array.from(parCoords.values())
    const meteos = await Promise.all(zones.map((z) => chargerMeteoBilan(z.lat, z.lng).catch(() => null)))

    // Ce que l'écran montre d'une culture, avec ou sans bilan.
    const contexte = (culture: (typeof cultures)[number], derniereIrrigation: Date | null) => {
      // null : type de planche non renseigné, le conseil le dit (ticket QA cmv3ja7nr).
      const sousAbri = typeSousAbri(culture.planche?.type)
      return {
        plancheId: culture.planche!.id,
        // Variété de repli « Non spécifiée » : le drapeau du référentiel fait foi.
        varietyName: culture.variete?.isPlaceholder ? null : culture.variete?.nom ?? null,
        // QA cmv2eg99z — même état que la liste des cultures : une culture
        // récoltée s'affichait « Semée » (cascade recopiée sans `recolteFaite`).
        etatCulture: etatCulture(culture),
        derniereIrrigation: derniereIrrigation?.toISOString() ?? null,
        irrigationSysteme: culture.planche?.irrigation ?? null,
        sousAbri,
        surfaceM2: surfaceCultureM2({ planche: culture.planche }),
        // Ce qui manque à la planche pour un conseil sûr, affiché avec un
        // lien vers sa fiche (tickets QA cmv3ja7nr et cmv3jaru7).
        plancheACompleter: [
          ...(sousAbri === null ? ['type'] : []),
          ...(sourceSol({ typeSol: culture.planche!.typeSol, retentionEau: culture.planche!.retentionEau }) !== 'planche' ? ['sol'] : []),
        ],
      }
    }

    type RecommandationCulture = RecommandationIrrigation & ReturnType<typeof contexte> & { sansMeteo: CauseSansMeteo | null }

    // Sans météo, le repli des tâches (`urgenceFallback`) : jamais une tâche,
    // et le motif dit pourquoi (parcelle à géolocaliser, météo muette). Jours
    // sans eau comptés au jour du serveur, comme le conseil des tâches.
    const sansMeteo = (culture: (typeof cultures)[number], cause: CauseSansMeteo): RecommandationCulture => {
      const dernier = dernierArrosage(culture.derniereIrrigation, arrosages.get(culture.id) ?? [])
      const joursSansEau = dernier ? Math.max(0, joursEntre(jourLocalIso(dernier), jourLocalIso(new Date()))) : null
      const { urgence, raison } = urgenceFallback(joursSansEau, culture.espece.besoinEau ?? 3, culture.planche!.retentionEau, cause)
      return {
        cultureId: culture.id,
        cultureName: culture.espece.nom || culture.especeId,
        plancheName: culture.planche!.nom,
        urgence,
        bilanHydrique7j: 0,
        pluiePrevue48h: 0,
        conseilQuantite: 0,
        conseilMessage: raison,
        prochainePluie: null,
        joursSansPluie: 0,
        joursDepuisIrrigation: joursSansEau,
        ...contexte(culture, dernier),
        sansMeteo: cause,
      }
    }

    const recommandationsCultures: RecommandationCulture[] = sansCoordonnees.map((c) => sansMeteo(c, 'sans-coordonnees'))
    let zonesIndisponibles = 0

    for (const [i, group] of zones.entries()) {
      const meteo = meteos[i]
      if (!meteo) {
        zonesIndisponibles++
        for (const culture of group.cultures) recommandationsCultures.push(sansMeteo(culture, 'meteo-indisponible'))
        continue
      }

      for (const culture of group.cultures) {
        // null : type de planche non renseigné, le conseil le dit (ticket QA cmv3ja7nr).
        const sousAbri = typeSousAbri(culture.planche?.type)
        const surface = surfaceCultureM2({ planche: culture.planche })
        const reco = genererRecommandationIrrigation(
          meteo,
          {
            id: culture.id,
            espece: culture.espece.nom || culture.especeId,
            besoinEau: culture.espece.besoinEau ?? 3,
            vivace: culture.espece.vivace ?? false,
            dateSemis: culture.dateSemis,
            datePlantation: culture.datePlantation,
            semisFait: culture.semisFait,
            plantationFaite: culture.plantationFaite,
            dateRecolte: culture.dateRecolte,
            finRecolte: culture.finRecolte,
            derniereIrrigation: culture.derniereIrrigation,
            arrosages: arrosages.get(culture.id) ?? [],
          },
          {
            nom: culture.planche!.nom,
            // Surface de la planche (sinon largeur × longueur) ; inconnue : pas de litres.
            surface,
            retentionEau: culture.planche!.retentionEau,
            typeSol: culture.planche!.typeSol,
            typeSolParcelle: culture.planche!.parcelleGeo ? culture.planche!.parcelleGeo.typeSol : solParcelleRepli,
            irrigation: culture.planche!.irrigation,
          },
          sousAbri,
        )

        recommandationsCultures.push({
          ...reco,
          // Jour du lieu, comme le bilan et « Arrosée aujourd'hui » (QA cmv3jatw8).
          ...contexte(culture, dernierArrosageDuLieu(meteo, culture.derniereIrrigation, arrosages.get(culture.id) ?? [])?.date ?? null),
          sansMeteo: null,
        })
      }
    }

    // Une action d'arrosage concerne la planche entière. Sur une planche
    // multiculture, une seule alerte est affichée et le besoin le plus
    // exigeant pilote la recommandation.
    const recommandations = grouperRecommandationsParPlanche(recommandationsCultures)

    // Trier par urgence
    const ordreUrgence = { critique: 0, haute: 1, moyenne: 2, faible: 3, aucune: 4 }
    recommandations.sort((a, b) =>
      ordreUrgence[a.urgence] - ordreUrgence[b.urgence]
    )

    const result = {
      recommandations,
      total: recommandations.length,
      totalCultures: recommandationsCultures.length,
      urgentes: recommandations.filter(r => r.urgence === 'critique' || r.urgence === 'haute').length,
      // Absence de calcul ≠ absence de besoin : zones sans météo, cultures au
      // repli, et panne totale (aucune zone calculée).
      zonesIndisponibles,
      culturesSansMeteo: recommandationsCultures.filter((r) => r.sansMeteo !== null).length,
      indisponible: zonesIndisponibles > 0 && zonesIndisponibles === zones.length,
    }

    // Stocker en cache, sauf panne météo : elle ne se fige pas deux minutes.
    if (zonesIndisponibles === 0) irrigationCache.set(cacheKey, result)

    return NextResponse.json({
      ...result,
      cached: false,
      cachedAt: new Date().toISOString(),
      cacheAgeMinutes: 0,
    })
  } catch (err) {
    console.error('GET /api/meteo/irrigation error:', err)
    return NextResponse.json(
      { error: "Erreur lors du calcul des recommandations d'irrigation" },
      { status: 500 }
    )
  }
}
