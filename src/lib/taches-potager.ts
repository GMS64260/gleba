/**
 * Tâches du potager (semis, plantations, récoltes) sur une période, avec les
 * tâches en retard et leurs stats, plus les planches à arroser aujourd'hui.
 *
 * Source unique de vérité partagée par `GET /api/taches` (page /taches,
 * dashboard maraîchage) et l'outil assistant `get_taches` — QA cmsno8277 /
 * cmsnop215 : l'assistant recomptait les retards depuis ses propres requêtes
 * (référence = début de période demandée, instants bruts, pas d'exclusion
 * d'étape, irrigations non groupées, pas de météo) et répondait « 2 tâches en
 * retard » là où l'écran en affichait 9. Règle générale du projet : tout
 * chiffre déjà affiché à l'utilisateur doit être LU par l'assistant via la
 * fonction de l'écran, jamais recalculé depuis des données brutes.
 */

import prisma from '@/lib/prisma'
import { chargerTourneeDuJour, type TourneeDuJour } from '@/lib/irrigation/a-arroser'
import { uniteQuantiteRecolte } from '@/lib/recolte/projection'
import { chargerSurchargesRendement, rendementEffectif } from '@/lib/recolte/rendement-effectif'
import { alerteSaisonCulture, fenetreImplantation } from '@/lib/cultures/saison-culture'
import { appliquerDecalageItp, decalageItpPourLecteur } from '@/lib/calendrier-climat'
import { zoneEffectiveUser } from '@/lib/terroir'
import { estVisibleReferentiel } from '@/lib/referentiel-communaute'

const CULTURE_SELECT = {
  id: true,
  especeId: true,
  varieteId: true,
  plancheId: true,
  dateSemis: true,
  datePlantation: true,
  dateRecolte: true,
  semisFait: true,
  plantationFaite: true,
  recolteFaite: true,
  // `rendement`/`uniteRendement` : une tâche de récolte doit dire dans QUELLE
  // unité on saisit la quantité (kg, tiges, pièces, bottes). Sans ça, la boîte
  // de saisie rapide du calendrier étiquetait « kg » la récolte d'un dahlia.
  espece: { select: { couleur: true, nom: true, rendement: true, uniteRendement: true } },
  variete: { select: { nom: true } },
  planche: { select: { nom: true } },
} as const

// Semis et plantations seulement : fenêtre d'implantation de l'ITP
// (2026-10-25), pour qu'une implantation hors saison le dise sur sa ligne de
// tâche (`alerteSaisonCulture`, règle de la route). `actif` et la visibilité
// filtrent comme `whereItpUtilisable` : un ITP retiré ou devenu privé ne parle
// plus.
const CULTURE_SELECT_IMPLANTATION = {
  ...CULTURE_SELECT,
  itp: {
    select: {
      userId: true,
      partageCommunaute: true,
      actif: true,
      zoneClimat: true,
      semaineSemis: true,
      semainePlantation: true,
      semaineImplantationDebut: true,
      semaineImplantationFin: true,
      implantation: true,
    },
  },
} as const

// QA cmsjiwn48 — retard exprimé en JOURS CIVILS dans le fuseau métier (local) :
// les dates de culture sont stockées avec une heure, donc un floor brut sur les
// instants retranchait un jour (plantation du 31/07 → 7 j au lieu de 8 j au
// 08/08). On compare les journées CIVILES LOCALES — même logique que le widget
// lunaire — pour que le décompte colle à ce que l'éleveur voit à l'écran, y
// compris juste après minuit (là où l'UTC serait encore la veille).
function joursRetard(dateTask: Date, refDate: Date): number {
  const jour = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.max(0, Math.round((jour(refDate) - jour(dateTask)) / 86_400_000))
}

export interface TachesPotagerOptions {
  start: Date
  end: Date
  annee: number
}

export async function getTachesPotager(
  userId: string,
  { start, end, annee }: TachesPotagerOptions
) {
  const currentYear = new Date().getFullYear()

  // Les retards historiques restent utiles dans la saison courante (audit
  // #49), mais ils ne doivent pas contaminer une saison passée ou future
  // explicitement sélectionnée. Exemple : le calendrier 2027 ne doit pas
  // afficher les tâches 2026 encore ouvertes.
  const retardAnneeFilter = annee === currentYear ? {} : { annee }

  // QA 2026-09-28 — la saison 2027 affichait « 10 dont 10 en retard » un
  // 28/09/2026 : « en retard » signifiait « avant le lundi de la semaine
  // AFFICHÉE », donc tout le printemps d'une saison future. Une tâche n'est en
  // retard que si sa date est déjà passée AUJOURD'HUI (jour civil local) et
  // antérieure à la semaine affichée.
  const aujourdhui = new Date()
  aujourdhui.setHours(0, 0, 0, 0)
  const borneRetard = start < aujourdhui ? start : aujourdhui

  // ── Tâches de la semaine + tâches en retard (non faites, date passée) ──

  // Audit Marc 2026-05-14 — Bug 06 : une culture "En récolte" affichait
  // "Semis à faire 10 sem. en retard" parce que la query ne regardait que
  // semisFait. Désormais on exclut les cultures dont l'état a déjà
  // dépassé le semis (plantationFaite / recolteFaite / terminee).

  // Semis : cette semaine OU en retard
  const [semisSemaine, semisRetard] = await Promise.all([
    prisma.culture.findMany({
      where: { userId, annee, dateSemis: { gte: start, lte: end } },
      select: CULTURE_SELECT_IMPLANTATION,
      orderBy: { dateSemis: 'asc' },
    }),
    prisma.culture.findMany({
      where: {
        userId,
        ...retardAnneeFilter,
        semisFait: false,
        plantationFaite: false,
        recolteFaite: false,
        terminee: null,
        dateSemis: { lt: borneRetard, not: null },
      },
      select: CULTURE_SELECT_IMPLANTATION,
      orderBy: { dateSemis: 'asc' },
    }),
  ])

  // Plantations : cette semaine OU en retard
  const [plantationsSemaine, plantationsRetard] = await Promise.all([
    prisma.culture.findMany({
      where: { userId, annee, datePlantation: { gte: start, lte: end } },
      select: CULTURE_SELECT_IMPLANTATION,
      orderBy: { datePlantation: 'asc' },
    }),
    prisma.culture.findMany({
      where: {
        userId,
        ...retardAnneeFilter,
        plantationFaite: false,
        recolteFaite: false,
        terminee: null,
        datePlantation: { lt: borneRetard, not: null },
      },
      select: CULTURE_SELECT_IMPLANTATION,
      orderBy: { datePlantation: 'asc' },
    }),
  ])

  // Récoltes : cette semaine OU en retard
  const [recoltesSemaine, recoltesRetard] = await Promise.all([
    prisma.culture.findMany({
      where: { userId, annee, dateRecolte: { gte: start, lte: end } },
      select: CULTURE_SELECT,
      orderBy: { dateRecolte: 'asc' },
    }),
    prisma.culture.findMany({
      where: {
        userId,
        ...retardAnneeFilter,
        recolteFaite: false,
        terminee: null,
        dateRecolte: { lt: borneRetard, not: null },
      },
      select: CULTURE_SELECT,
      orderBy: { dateRecolte: 'asc' },
    }),
  ])

  // Rendements déclarés par la ferme : ils fixent l'unité de saisie des
  // récoltes, y compris sur une espèce du catalogue (non modifiable par un
  // membre). Chargés une fois pour toutes les tâches de récolte.
  const surchargesRendement = await chargerSurchargesRendement(userId, [
    ...new Set([...recoltesSemaine, ...recoltesRetard].map((c) => c.especeId)),
  ])

  // ── Arrosage : le besoin du jour, jamais un plan d'avance ──
  // Refonte du 2026-10-10 (`src/lib/irrigation/a-arroser.ts`) : une planche est
  // à arroser quand le bilan hydrique d'une de ses cultures l'exige
  // AUJOURD'HUI. Une semaine qui ne contient pas aujourd'hui n'en a pas : ni
  // passage futur prévu d'office, ni retard à rattraper.
  // QA cmvge3o5z : la tournée nomme aussi les cultures en urgence non cochées
  // « à irriguer » qu'elle écarte, comme la page Irriguer (même helper).
  const finAujourdhui = new Date(aujourdhui.getTime() + 86_400_000 - 1)
  const tournee: TourneeDuJour =
    start <= finAujourdhui && end >= aujourdhui
      ? await chargerTourneeDuJour(userId, annee)
      : { lignes: [], nbCultures: 0, horsTournee: [] }
  const irrigation = tournee.lignes

  // ── Saison de l'ITP : la zone n'est lue que si une tâche d'implantation en a besoin ──
  const implantations = [...semisSemaine, ...semisRetard, ...plantationsSemaine, ...plantationsRetard]
  let zone: Awaited<ReturnType<typeof zoneEffectiveUser>> = null
  if (implantations.some((c) => fenetreImplantation(c.itp))) {
    zone = await zoneEffectiveUser(prisma, userId).catch(() => null)
  }
  // Message d'alerte de la culture si l'étape de la tâche est celle qui implante.
  function horsSaison(c: typeof semisSemaine[number], champ: 'dateSemis' | 'datePlantation'): string | null {
    if (!c.itp || !c.itp.actif || !estVisibleReferentiel(c.itp, userId)) return null
    const itp = appliquerDecalageItp(c.itp, decalageItpPourLecteur(c.itp, zone, userId))
    const alerte = alerteSaisonCulture({ itp, dateSemis: c.dateSemis, datePlantation: c.datePlantation })
    return alerte?.champ === champ ? alerte.message : null
  }

  // ── Formatter ──

  function formatSemis(c: typeof semisSemaine[number], retard: number) {
    return {
      id: c.id,
      type: 'semis' as const,
      especeId: c.especeId,
      especeNom: c.espece?.nom ?? c.especeId,
      varieteId: c.varieteId,
      varieteNom: c.variete?.nom ?? c.varieteId,
      plancheId: c.planche?.nom || null,
      // Identifiant technique de la planche (cuid) : `plancheId` ci-dessus porte
      // le NOM pour compatibilité ; tout nouveau consommateur route sur celui-ci.
      plancheRefId: c.plancheId ?? null,
      date: c.dateSemis?.toISOString() || '',
      fait: c.semisFait,
      couleur: c.espece?.couleur || null,
      retardJours: retard,
      horsSaison: horsSaison(c, 'dateSemis'),
    }
  }

  function formatPlantation(c: typeof plantationsSemaine[number], retard: number) {
    return {
      id: c.id,
      type: 'plantation' as const,
      especeId: c.especeId,
      especeNom: c.espece?.nom ?? c.especeId,
      varieteId: c.varieteId,
      varieteNom: c.variete?.nom ?? c.varieteId,
      plancheId: c.planche?.nom || null,
      plancheRefId: c.plancheId ?? null,
      date: c.datePlantation?.toISOString() || '',
      fait: c.plantationFaite,
      couleur: c.espece?.couleur || null,
      retardJours: retard,
      horsSaison: horsSaison(c, 'datePlantation'),
    }
  }

  function formatRecolte(c: typeof recoltesSemaine[number], retard: number) {
    return {
      id: c.id,
      type: 'recolte' as const,
      especeId: c.especeId,
      especeNom: c.espece?.nom ?? c.especeId,
      varieteId: c.varieteId,
      varieteNom: c.variete?.nom ?? c.varieteId,
      plancheId: c.planche?.nom || null,
      plancheRefId: c.plancheId ?? null,
      date: c.dateRecolte?.toISOString() || '',
      fait: c.recolteFaite,
      couleur: c.espece?.couleur || null,
      // Unité de saisie de la quantité, surcharge de la ferme comprise.
      unite: uniteQuantiteRecolte(
        rendementEffectif(c.espece, surchargesRendement.get(c.especeId)).uniteRendement,
      ),
      retardJours: retard,
    }
  }

  // QA cmsjiwn48 — le retard était mesuré depuis `start` (le lundi de la
  // semaine affichée) et non depuis aujourd'hui : une plantation prévue le
  // 31/07 affichait « 2 j » au 08/08 au lieu de 8 j. Le nombre de jours de
  // retard doit se compter par rapport au jour courant, quelle que soit la
  // semaine visualisée.
  const refRetard = new Date()
  refRetard.setHours(0, 0, 0, 0)

  // Tâches en retard en premier, puis tâches de la semaine
  const semis = [
    ...semisRetard.map(c => formatSemis(c, joursRetard(c.dateSemis!, refRetard))),
    ...semisSemaine.map(c => formatSemis(c, 0)),
  ]

  const plantations = [
    ...plantationsRetard.map(c => formatPlantation(c, joursRetard(c.datePlantation!, refRetard))),
    ...plantationsSemaine.map(c => formatPlantation(c, 0)),
  ]

  const recoltes = [
    ...recoltesRetard.map(c => formatRecolte(c, joursRetard(c.dateRecolte!, refRetard))),
    ...recoltesSemaine.map(c => formatRecolte(c, 0)),
  ]

  // Un arrosage n'est jamais en retard : le besoin se recalcule chaque jour.
  const enRetardTotal = semisRetard.length + plantationsRetard.length + recoltesRetard.length

  return {
    semis,
    plantations,
    recoltes,
    irrigation,
    irrigationHorsTournee: tournee.horsTournee,
    stats: {
      semisPrevus: semis.length,
      semisFaits: semis.filter(s => s.fait).length,
      plantationsPrevues: plantations.length,
      plantationsFaites: plantations.filter(p => p.fait).length,
      recoltesPrevues: recoltes.length,
      recoltesFaites: recoltes.filter(r => r.fait).length,
      aIrriguer: irrigation.length,
      enRetard: enRetardTotal,
    },
  }
}

export type TachesPotager = Awaited<ReturnType<typeof getTachesPotager>>
