/**
 * Agrégat unifié des récoltes annuelles — source de vérité pour
 * /maraichage/planification/recoltes-prevues, le module Récoltes et le
 * Dashboard.
 *
 * Audit Marc BUG-03 (2026-05-14) : « Récoltes prévues » affichait 0 kg sur
 * la Planification alors que le module Récoltes et le Dashboard affichaient
 * 90 kg. Cause : la Planif n'utilisait que la PROJECTION (culture × rendement)
 * et ignorait les Recolte réelles déjà saisies. Désormais on combine :
 *
 *   - réalisé   = SUM(Recolte.quantite WHERE date dans l'année)
 *   - projeté   = SUM(culture × rendement) pour les cultures encore en
 *                 cours (recolteFaite=false, non terminée)
 *   - attendu   = réalisé + projeté
 *
 * Les 3 écrans utilisent la même fonction → cohérence garantie.
 *
 * 2026-08-20 — une quantité de récolte n'est plus un nombre de kilos. Le
 * rendement peut s'exprimer en tiges, pièces ou bottes, et une récolte porte
 * l'unité qu'elle avait à la saisie. Chaque total existe donc en deux formes :
 * `*Kg`, la PART EN KILOS, seule comparable à un tonnage ou valorisable au
 * kilo ; et `*ParUnite`, la ventilation complète, seule affichable. Les champs
 * en kilos gardent leur nom et leur sens : c'est la ventilation qui est
 * nouvelle, pas une redéfinition. Le rendement utilisé est celui de la FERME
 * quand elle en a déclaré un (`rendement-effectif`), pas celui du catalogue.
 */

import prisma from '@/lib/prisma'
import { surfaceCultureM2 } from '@/lib/culture-surface'
import { projectionRecolte, uniteQuantiteRecolte, type UniteQuantite } from '@/lib/recolte/projection'
import {
  ajouterQuantite,
  arrondirQuantites,
  fusionnerQuantites,
  partKg,
  type QuantiteParUnite,
} from '@/lib/recolte/quantites'
import { chargerSurchargesRendement, rendementEffectif } from '@/lib/recolte/rendement-effectif'

export interface RecoltesParEspece {
  especeId: string
  especeCouleur: string | null
  realiseesKg: number
  projectionKg: number
  realiseesParUnite: QuantiteParUnite
  projectionParUnite: QuantiteParUnite
}

export interface RecoltesAnneeAggregat {
  year: number
  realiseesKg: number          // récoltes déjà saisies dans l'année (part en kilos)
  projectionKg: number         // estimation pour cultures non encore récoltées
  totalAttenduKg: number       // realisees + projection
  realiseesParUnite: QuantiteParUnite
  projectionParUnite: QuantiteParUnite
  totalAttenduParUnite: QuantiteParUnite
  parMois: {
    mois: number               // 1..12
    realiseesKg: number
    projectionKg: number
    realiseesParUnite: QuantiteParUnite
    projectionParUnite: QuantiteParUnite
  }[]
  parEspece: RecoltesParEspece[]
}

export async function getRecoltesAnneeAggregat(
  userId: string,
  year: number
): Promise<RecoltesAnneeAggregat> {
  const startOfYear = new Date(year, 0, 1, 0, 0, 0, 0)
  const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999)

  // 1. Récoltes réelles déjà saisies dans l'année.
  const recoltes = await prisma.recolte.findMany({
    where: {
      userId,
      date: { gte: startOfYear, lte: endOfYear },
    },
    select: {
      quantite: true,
      // Unité figée à la saisie : c'est elle qui fait foi, pas l'unité actuelle
      // de l'espèce (qui a pu changer depuis).
      unite: true,
      date: true,
      especeId: true,
      espece: { select: { couleur: true } },
    },
  })

  // 2. Cultures de l'année encore en cours (pas récoltées + non terminées).
  // Projection = surface × rendement de l'espèce.
  const cultures = await prisma.culture.findMany({
    where: {
      userId,
      annee: year,
      terminee: null,
      recolteFaite: false,
    },
    select: {
      // Note DEV2 : Culture.dateRecolte (pas .semaineRecolte qui
      // n'existe pas sur le modèle Culture — seulement sur ITP/Variete).
      dateRecolte: true,
      longueur: true,
      plancheId: true,
      especeId: true,
      planche: { select: { surface: true, largeur: true, longueur: true } },
      // `uniteRendement` est indispensable : `rendement` seul ne dit pas s'il
      // s'agit de kg/m², de kg/arbre, de t/ha ou de tiges/m² (cf.
      // recolte/projection).
      espece: { select: { id: true, couleur: true, rendement: true, uniteRendement: true } },
    },
  })

  // Rendements propres à la ferme : ils priment sur le catalogue.
  const surcharges = await chargerSurchargesRendement(
    userId,
    [...new Set(cultures.map((c) => c.especeId).filter(Boolean))],
  )

  // Init buckets
  const moisBuckets: Array<{
    realisees: QuantiteParUnite
    projection: QuantiteParUnite
  }> = Array.from({ length: 12 }, () => ({ realisees: {}, projection: {} }))
  const parEspeceMap = new Map<
    string,
    { especeId: string; especeCouleur: string | null; realisees: QuantiteParUnite; projection: QuantiteParUnite }
  >()

  const bucketEspece = (especeId: string, couleur: string | null) => {
    const existant = parEspeceMap.get(especeId)
    if (existant) return existant
    const cree = { especeId, especeCouleur: couleur, realisees: {}, projection: {} }
    parEspeceMap.set(especeId, cree)
    return cree
  }

  // Réalisé
  for (const r of recoltes) {
    const unite = (r.unite ?? 'kg') as UniteQuantite
    const mois = r.date.getMonth() // 0..11
    ajouterQuantite(moisBuckets[mois].realisees, unite, r.quantite)
    if (r.especeId) {
      ajouterQuantite(bucketEspece(r.especeId, r.espece?.couleur ?? null).realisees, unite, r.quantite)
    }
  }

  // Projection
  for (const c of cultures) {
    if (!c.especeId) continue
    const effectif = rendementEffectif(c.espece, surcharges.get(c.especeId))
    if (!effectif.rendement) continue
    const surface = surfaceCultureM2(c)
    if (surface <= 0) continue
    const { quantite, unite } = projectionRecolte(surface, effectif.rendement, effectif.uniteRendement)
    // Note DEV2 : dérive le mois (0..11) depuis Culture.dateRecolte si
    // saisie (la projection se mappe au mois prévu de récolte).
    const mois = c.dateRecolte ? c.dateRecolte.getMonth() : null
    if (mois !== null) ajouterQuantite(moisBuckets[mois].projection, unite, quantite)
    ajouterQuantite(bucketEspece(c.especeId, c.espece?.couleur ?? null).projection, unite, quantite)
  }

  const realiseesParUnite = arrondirQuantites(
    fusionnerQuantites(...moisBuckets.map((m) => m.realisees)),
  )
  const projectionParUnite = arrondirQuantites(
    fusionnerQuantites(...moisBuckets.map((m) => m.projection)),
  )
  const totalAttenduParUnite = arrondirQuantites(
    fusionnerQuantites(realiseesParUnite, projectionParUnite),
  )

  return {
    year,
    realiseesKg: partKg(realiseesParUnite),
    projectionKg: partKg(projectionParUnite),
    totalAttenduKg: partKg(totalAttenduParUnite),
    realiseesParUnite,
    projectionParUnite,
    totalAttenduParUnite,
    parMois: moisBuckets.map((b, i) => {
      const realisees = arrondirQuantites(b.realisees)
      const projection = arrondirQuantites(b.projection)
      return {
        mois: i + 1,
        realiseesKg: partKg(realisees),
        projectionKg: partKg(projection),
        realiseesParUnite: realisees,
        projectionParUnite: projection,
      }
    }),
    parEspece: Array.from(parEspeceMap.values())
      .map((e) => {
        const realisees = arrondirQuantites(e.realisees)
        const projection = arrondirQuantites(e.projection)
        return {
          especeId: e.especeId,
          especeCouleur: e.especeCouleur,
          realiseesKg: partKg(realisees),
          projectionKg: partKg(projection),
          realiseesParUnite: realisees,
          projectionParUnite: projection,
        }
      })
      // Tri sur le VOLUME toutes unités confondues : additionner des tiges à des
      // kilos serait faux pour un affichage, mais c'est ici un simple critère
      // d'ordre — et il vaut mieux qu'un tri en kilos, qui reléguait en queue de
      // liste toute la production non pondérale.
      .sort((a, b) => volumeTotal(b) - volumeTotal(a)),
  }
}

/** Somme brute toutes unités confondues — critère de TRI, jamais d'affichage. */
function volumeTotal(e: RecoltesParEspece): number {
  const total = fusionnerQuantites(e.realiseesParUnite, e.projectionParUnite)
  return Object.values(total).reduce((somme, valeur) => somme + (valeur ?? 0), 0)
}

/** Unité de quantité d'une espèce chez cet utilisateur (surcharge comprise). */
export async function uniteEspecePourUtilisateur(
  userId: string,
  especeId: string,
): Promise<UniteQuantite> {
  const [espece, surcharges] = await Promise.all([
    prisma.espece.findUnique({
      where: { id: especeId },
      select: { rendement: true, uniteRendement: true },
    }),
    chargerSurchargesRendement(userId, [especeId]),
  ])
  return uniteQuantiteRecolte(rendementEffectif(espece, surcharges.get(especeId)).uniteRendement)
}
