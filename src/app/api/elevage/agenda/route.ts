/**
 * API Agenda élevage — échéances à venir, agrégées depuis les données déjà en
 * base (GAP P0 « agenda quotidien unifié », review caprin 2026-07-22).
 *
 * GET /api/elevage/agenda?jours=21
 * Regroupe ce qu'un éleveur doit anticiper mais qui était dispersé dans plusieurs
 * onglets : mises-bas attendues, tarissements, diagnostics de gestation à faire,
 * fins de délai d'attente lait/viande (contrainte sanitaire), soins planifiés /
 * en retard, aliments à réapprovisionner. Aucun modèle nouveau.
 *
 * Tout est scopé userId (multi-tenant).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { chargerAttentesConsolidees } from '@/lib/elevage/attentes-query'
import { remiseVente } from '@/lib/elevage/attentes'

type Gravite = 'info' | 'attention' | 'urgent'
type Echeance = {
  id: string
  kind:
    | 'mise_bas'
    | 'tarissement'
    | 'diagnostic_gestation'
    | 'attente_lait'
    | 'attente_viande'
    | 'soin_planifie'
    | 'soin_retard'
    | 'stock_aliment'
    | 'medicament_peremption'
    | 'prophylaxie'
    | 'tache_terrain'
    | 'administratif'
  date: string | null
  joursRestants: number | null
  titre: string
  detail?: string
  gravite: Gravite
  // QA caprin cms1v3fso — permet à la Tournée d'agir directement sur
  // l'échéance (valider une injection, marquer un soin fait).
  action?: { soinId?: number; injectionId?: string }
}

const DELAI_DIAGNOSTIC_J = 35 // une saillie « En attente » au-delà → diagnostic à faire

const jours = (from: Date, to: Date) =>
  Math.round((floorDay(to).getTime() - floorDay(from).getTime()) / 86_400_000)
const floorDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
// QA caprin cms1vbkl4 — afficher nom ET boucle (« Cannelle · FR0041… ») :
// en bâtiment on reconnaît l'animal par son nom, on vérifie par la boucle.
const nomAnimal = (a: { nom: string | null; identifiant: string | null; id: number } | null | undefined) => {
  if (!a) return '—'
  if (a.nom && a.identifiant) return `${a.nom} · ${a.identifiant}`
  return a.nom || a.identifiant || `#${a.id}`
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const horizonJours = Math.min(90, Math.max(1, parseInt(searchParams.get('jours') || '21', 10) || 21))
    // Scoping par filière d'atelier (modes d'élevage) : ne cible que les
    // échéances liées à un animal/lot de la filière. Les échéances non
    // animales (stock aliments, médicaments, échéances admin) restent globales.
    const filiere = searchParams.get('filiere')
    const femFiliere = filiere ? { femelle: { especeAnimale: { filiere } } } : {}
    const soinFiliere = filiere
      ? { OR: [{ animal: { especeAnimale: { filiere } } }, { lot: { especeAnimale: { filiere } } }] }
      : {}
    const now = new Date()
    const horizon = new Date(now.getTime() + horizonJours * 86_400_000)

    const [gestantes, enAttente, attentesConsolidees, soinsPlanifies, stocksBas, medicaments, prophylaxies, tachesTerrain, echeancesAdmin] = await Promise.all([
      // Saillies gestantes : mise-bas + tarissement à venir
      prisma.saillie.findMany({
        where: { userId, statut: 'Gestante', ...femFiliere },
        select: {
          id: true,
          dateMiseBasAttendue: true,
          dateTarissementPrevue: true,
          femelle: { select: { id: true, nom: true, identifiant: true } },
        },
      }),
      // Saillies en attente d'un diagnostic de gestation
      prisma.saillie.findMany({
        where: { userId, statut: 'En attente', ...femFiliere },
        select: {
          id: true,
          date: true,
          femelle: { select: { id: true, nom: true, identifiant: true } },
        },
      }),
      // Délais d'attente CONSOLIDÉS par (cible + traitement), ancrés sur la
      // dernière injection — une seule échéance par traitement (QA #2/#9).
      // Attentes lait/viande = notion de rente uniquement → exclues pour une
      // filière compagnie/équin/NAC (sinon un délai « lait » de chèvre fuit
      // dans le calendrier d'un atelier chiens).
      (filiere && filiere !== 'rente')
        ? Promise.resolve([] as Awaited<ReturnType<typeof chargerAttentesConsolidees>>)
        : chargerAttentesConsolidees(userId, floorDay(now)),
      // Soins planifiés (non faits) à échéance ou en retard
      prisma.soinAnimal.findMany({
        where: { userId, fait: false, datePrevue: { not: null, lte: horizon }, ...soinFiliere },
        select: {
          id: true,
          type: true,
          datePrevue: true,
          animal: { select: { id: true, nom: true, identifiant: true } },
          lot: { select: { id: true, nom: true } },
        },
      }),
      // Aliments dont le stock est ≤ seuil mini (réappro)
      prisma.userStockAliment.findMany({
        where: { userId, stockMin: { not: null } },
        select: { alimentId: true, stock: true, stockMin: true, aliment: { select: { nom: true } } },
      }),
      prisma.stockMedicamentElevage.findMany({
        where: { userId, quantite: { gt: 0 }, datePeremption: { not: null, lte: horizon } },
        select: { id: true, produitId: true, numeroLot: true, datePeremption: true },
      }),
      prisma.prophylaxieElevage.findMany({
        where: { userId, statut: 'a_faire', datePrevue: { lte: horizon } },
        select: { id: true, type: true, datePrevue: true, organisme: true },
      }),
      prisma.tacheTerrainElevage.findMany({
        where: { userId, actif: true, prochaineEcheance: { lte: horizon } },
        select: { id: true, titre: true, prochaineEcheance: true, priorite: true, categorie: true },
      }),
      prisma.echeanceAdministrativeElevage.findMany({
        where: { userId, statut: 'a_faire', dateEcheance: { lte: horizon } },
        select: { id: true, libelle: true, categorie: true, dateEcheance: true },
      }),
    ])
    const injectionsPlanifiees = await prisma.$queryRaw<Array<{
      id: string
      soinId: number
      numero: number
      datePrevue: Date
      produit: string | null
      type: string
      animalId: number | null
      animalNom: string | null
      animalIdentifiant: string | null
      lotId: number | null
      lotNom: string | null
    }>>`
      SELECT i.id, i.soin_id AS "soinId", i.numero, i.date_prevue AS "datePrevue",
             s.produit, s.type, s.animal_id AS "animalId", a.nom AS "animalNom",
             a.identifiant AS "animalIdentifiant", s.lot_id AS "lotId", l.nom AS "lotNom"
      FROM injections_soins i
      JOIN soins_animaux s ON s.id = i.soin_id
      LEFT JOIN animaux a ON a.id = s.animal_id
      LEFT JOIN lots_animaux l ON l.id = s.lot_id
      WHERE i.user_id = ${userId}
        AND i.statut = 'a_faire'
        AND i.date_prevue <= ${horizon}
        AND (
          ${filiere}::text IS NULL
          OR a.espece_animale_id IN (SELECT espece_animale FROM especes_animales WHERE filiere = ${filiere})
          OR l.espece_animale_id IN (SELECT espece_animale FROM especes_animales WHERE filiere = ${filiere})
        )
      ORDER BY i.date_prevue
    `

    const echeances: Echeance[] = []

    for (const s of gestantes) {
      if (s.dateMiseBasAttendue) {
        const jr = jours(now, s.dateMiseBasAttendue)
        // Une saillie restée « Gestante » ne doit pas polluer l'agenda à vie.
        // Au-delà de 30 jours de retard, elle relève d'une correction de donnée,
        // pas des prochaines échéances quotidiennes.
        if (jr <= horizonJours && jr >= -30) {
          echeances.push({
            id: `mb-${s.id}`,
            kind: 'mise_bas',
            date: s.dateMiseBasAttendue.toISOString(),
            joursRestants: jr,
            titre: `Mise-bas — ${nomAnimal(s.femelle)}`,
            detail: jr < 0 ? 'échéance dépassée' : `dans ${jr} j`,
            gravite: jr <= 3 ? 'urgent' : 'attention',
          })
        }
      }
      if (s.dateTarissementPrevue) {
        const jr = jours(now, s.dateTarissementPrevue)
        if (jr <= horizonJours && jr >= -3) {
          echeances.push({
            id: `tar-${s.id}`,
            kind: 'tarissement',
            date: s.dateTarissementPrevue.toISOString(),
            joursRestants: jr,
            titre: `Tarissement — ${nomAnimal(s.femelle)}`,
            detail: jr < 0 ? 'à programmer (dépassé)' : `dans ${jr} j`,
            gravite: jr <= 7 ? 'attention' : 'info',
          })
        }
      }
    }

    for (const s of enAttente) {
      const jr = jours(s.date, now) // âge de la saillie en jours
      if (jr >= DELAI_DIAGNOSTIC_J) {
        echeances.push({
          id: `diag-${s.id}`,
          kind: 'diagnostic_gestation',
          date: s.date.toISOString(),
          joursRestants: null,
          titre: `Diagnostic de gestation — ${nomAnimal(s.femelle)}`,
          detail: `sailli il y a ${jr} j, statut encore « En attente »`,
          gravite: 'attention',
        })
      }
    }

    // Ticket QA caprin cmrz0q7ty (2026-07-24) — l'agenda affichait « jusqu'au
    // {finAttente} » (dernier jour d'écart) alors que le dashboard et le registre
    // Soins affichent « remise en vente le {finAttente + 1} » (1er jour autorisé).
    // Les deux étaient corrects mais avec des points de référence opposés, d'où
    // un décalage d'un jour perçu. On aligne l'agenda sur la convention canonique
    // partagée : la date de remise en vente (`remiseVente`, déjà utilisée par
    // /api/elevage/attentes).
    for (const a of attentesConsolidees) {
      // QA caprin cms1vbkl4 — le label consolidé est la boucle ; on préfixe le
      // nom quand il existe pour une reconnaissance immédiate.
      const cible = a.cible.nom && a.cible.nom !== a.cible.label
        ? `${a.cible.nom} · ${a.cible.label}`
        : a.cible.label
      if (a.finAttenteLait && a.finAttenteLait >= now) {
        const rv = remiseVente(a.finAttenteLait)!
        echeances.push({
          id: `att-lait-${a.key}`,
          kind: 'attente_lait',
          date: rv.toISOString(),
          joursRestants: jours(now, rv),
          titre: `Lait non commercialisable — ${cible}`,
          detail: `remise en vente le ${rv.toLocaleDateString('fr-FR')}`,
          gravite: 'urgent',
        })
      }
      if (a.finAttenteViande && a.finAttenteViande >= now) {
        const rv = remiseVente(a.finAttenteViande)!
        echeances.push({
          id: `att-viande-${a.key}`,
          kind: 'attente_viande',
          date: rv.toISOString(),
          joursRestants: jours(now, rv),
          titre: `Viande non commercialisable — ${cible}`,
          detail: `remise en vente le ${rv.toLocaleDateString('fr-FR')}`,
          gravite: 'attention',
        })
      }
    }

    for (const s of soinsPlanifies) {
      if (!s.datePrevue) continue
      const cible = s.animal ? nomAnimal(s.animal) : s.lot ? (s.lot.nom || `Lot #${s.lot.id}`) : '—'
      const jr = jours(now, s.datePrevue)
      const retard = jr < 0
      echeances.push({
        id: `soin-${s.id}`,
        kind: retard ? 'soin_retard' : 'soin_planifie',
        date: s.datePrevue.toISOString(),
        joursRestants: jr,
        titre: `${s.type} — ${cible}`,
        detail: retard ? `en retard de ${-jr} j` : `dans ${jr} j`,
        gravite: retard ? 'urgent' : 'info',
        action: { soinId: s.id },
      })
    }
    for (const injection of injectionsPlanifiees) {
      const cible = injection.animalId
        ? (injection.animalNom && injection.animalIdentifiant
            ? `${injection.animalNom} · ${injection.animalIdentifiant}`
            : injection.animalIdentifiant || injection.animalNom || `#${injection.animalId}`)
        : injection.lotNom || (injection.lotId ? `Lot #${injection.lotId}` : 'Troupeau')
      const jr = jours(now, injection.datePrevue)
      echeances.push({
        id: `injection-${injection.id}`,
        kind: jr < 0 ? 'soin_retard' : 'soin_planifie',
        date: injection.datePrevue.toISOString(),
        joursRestants: jr,
        titre: `Injection ${injection.numero} — ${cible}`,
        detail: injection.produit || injection.type,
        gravite: jr < 0 ? 'urgent' : jr <= 1 ? 'attention' : 'info',
        action: { soinId: injection.soinId, injectionId: injection.id },
      })
    }

    for (const st of stocksBas) {
      if (st.stockMin == null) continue
      if (Number(st.stock) <= Number(st.stockMin)) {
        echeances.push({
          id: `stock-${st.alimentId}`,
          kind: 'stock_aliment',
          date: null,
          joursRestants: null,
          titre: `Réapprovisionner — ${st.aliment?.nom || st.alimentId}`,
          detail: `stock ${Math.round(Number(st.stock) * 10) / 10} ≤ seuil ${st.stockMin}`,
          gravite: 'attention',
        })
      }
    }

    for (const med of medicaments) {
      if (!med.datePeremption) continue
      const jr = jours(now, med.datePeremption)
      echeances.push({
        id: `med-${med.id}`, kind: 'medicament_peremption',
        date: med.datePeremption.toISOString(), joursRestants: jr,
        titre: `Médicament à contrôler — lot ${med.numeroLot}`,
        detail: `${med.produitId}${jr < 0 ? ' · périmé' : ` · péremption dans ${jr} j`}`,
        gravite: jr <= 0 ? 'urgent' : 'attention',
      })
    }
    for (const p of prophylaxies) {
      const jr = jours(now, p.datePrevue)
      echeances.push({
        id: `pro-${p.id}`, kind: 'prophylaxie', date: p.datePrevue.toISOString(), joursRestants: jr,
        titre: `Prophylaxie — ${p.type}`,
        detail: `${p.organisme || 'organisme à préciser'}${jr < 0 ? ` · retard ${-jr} j` : ` · dans ${jr} j`}`,
        gravite: jr < 0 ? 'urgent' : 'attention',
      })
    }
    for (const t of tachesTerrain) {
      const jr = jours(now, t.prochaineEcheance)
      echeances.push({
        id: `terrain-${t.id}`, kind: 'tache_terrain', date: t.prochaineEcheance.toISOString(), joursRestants: jr,
        titre: `Tournée — ${t.titre}`, detail: t.categorie,
        gravite: t.priorite === 'urgente' || jr < 0 ? 'urgent' : t.priorite === 'haute' ? 'attention' : 'info',
      })
    }
    for (const admin of echeancesAdmin) {
      const jr = jours(now, admin.dateEcheance)
      echeances.push({
        id: `admin-${admin.id}`, kind: 'administratif', date: admin.dateEcheance.toISOString(), joursRestants: jr,
        titre: `${admin.categorie} — ${admin.libelle}`,
        detail: jr < 0 ? `en retard de ${-jr} j` : `dans ${jr} j`,
        gravite: jr < 0 ? 'urgent' : jr <= 7 ? 'attention' : 'info',
      })
    }

    // QA caprin cms1v9o67 — tri STRICTEMENT chronologique : retards en tête
    // (joursRestants négatifs), puis échéances futures par date croissante.
    // Avant, la gravité primait sur la date : une remise en vente lait du
    // 20 août (« urgent ») passait devant une injection du 28 juillet
    // (« info ») — risque de rater une injection d'antibiotique. La gravité
    // ne sert plus que de départage à date égale.
    const rangGravite: Record<Gravite, number> = { urgent: 0, attention: 1, info: 2 }
    echeances.sort((a, b) => {
      const ja = a.joursRestants ?? Number.POSITIVE_INFINITY
      const jb = b.joursRestants ?? Number.POSITIVE_INFINITY
      if (ja !== jb) return ja - jb
      if (rangGravite[a.gravite] !== rangGravite[b.gravite]) return rangGravite[a.gravite] - rangGravite[b.gravite]
      return (a.date ?? '').localeCompare(b.date ?? '')
    })

    const counts = {
      total: echeances.length,
      urgent: echeances.filter((e) => e.gravite === 'urgent').length,
      misesBas: echeances.filter((e) => e.kind === 'mise_bas').length,
      tarissements: echeances.filter((e) => e.kind === 'tarissement').length,
      attentes: echeances.filter((e) => e.kind === 'attente_lait' || e.kind === 'attente_viande').length,
      soins: echeances.filter((e) => e.kind === 'soin_planifie' || e.kind === 'soin_retard').length,
      diagnostics: echeances.filter((e) => e.kind === 'diagnostic_gestation').length,
      stock: echeances.filter((e) => e.kind === 'stock_aliment').length,
      sanitaireReglementaire: echeances.filter((e) => e.kind === 'medicament_peremption' || e.kind === 'prophylaxie').length,
      tachesTerrain: echeances.filter((e) => e.kind === 'tache_terrain').length,
      administratif: echeances.filter((e) => e.kind === 'administratif').length,
    }

    return NextResponse.json({ echeances, counts, horizonJours })
  } catch (err) {
    console.error('GET /api/elevage/agenda error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
