/**
 * Report d'une étape de culture à une nouvelle date.
 *
 * Friction 2026-08-23 : face à « Planter — 4 cultures, échéance 17/08, 4 jours
 * de retard », un maraîcher a SUPPRIMÉ les quatre cultures en pépinière puis
 * recréé les mêmes variétés à dates fraîches dans le quart d'heure — aucune
 * action de report n'existait là où le retard s'affiche, et l'historique des
 * cultures est parti avec. Ce module donne au retard une issue non
 * destructrice : la même échéance, déplacée.
 *
 * Règles :
 * - seule une étape NON faite se reporte ; une étape faite est de l'histoire ;
 * - le reste du cycle SUIT : les étapes ultérieures non faites sont décalées du
 *   même nombre de jours civils, pour ne pas casser la durée du cycle (même
 *   philosophie que le préremplissage ITP, qui décale « l'ENSEMBLE du cycle
 *   uniformément ») ; les étapes déjà faites ne bougent jamais ;
 * - la chronologie semis ≤ plantation ≤ récolte reste garantie, sinon refus ;
 * - une date déplacée explicitement redéfinit le plan : la mémoire de plan de
 *   l'étape (cf. execution.ts) est libérée, comme au PUT du formulaire.
 *
 * Le décalage se fait en JOURS CIVILS via setDate (audit fuseaux #76 : un
 * offset en millisecondes qui traverse un changement d'heure dérive d'une
 * heure, donc d'un jour près de minuit).
 */

import {
  CHAMP_DATE_ETAPE,
  CHAMP_PLAN_ETAPE,
  ETAPES,
  jourCivilLocal,
  type ChampEtape,
} from './execution'

export type EtapeReportable = 'semis' | 'plantation' | 'recolte'

export const CHAMP_PAR_ETAPE: Record<EtapeReportable, ChampEtape> = {
  semis: 'semisFait',
  plantation: 'plantationFaite',
  recolte: 'recolteFaite',
}

const ETAPE_PAR_CHAMP: Record<ChampEtape, EtapeReportable> = {
  semisFait: 'semis',
  plantationFaite: 'plantation',
  recolteFaite: 'recolte',
}

export const LIBELLE_ETAPE: Record<EtapeReportable, string> = {
  semis: 'le semis',
  plantation: 'la plantation',
  recolte: 'la récolte',
}

export type CultureAReporter = {
  semisFait: boolean
  plantationFaite: boolean
  recolteFaite: boolean
  terminee: string | null
  dateSemis: Date | null
  datePlantation: Date | null
  dateRecolte: Date | null
  dateSemisPlan: Date | null
  datePlantationPlan: Date | null
  dateRecoltePlan: Date | null
  /** Fin de la fenêtre de récolte, quand la culture en porte une. */
  finRecolte?: Date | null
}

export type DecalageEtape = { etape: EtapeReportable; de: Date | null; a: Date }

export type ResultatReport =
  | { ok: true; ecritures: Record<string, Date | null>; decalages: DecalageEtape[] }
  | { ok: false; erreur: string }

function plusJoursCivils(date: Date, jours: number): Date {
  const r = new Date(date)
  r.setDate(r.getDate() + jours)
  return r
}

const UN_JOUR_MS = 86_400_000

export function ecrituresReport(
  culture: CultureAReporter,
  etape: EtapeReportable,
  nouvelleDate: Date,
): ResultatReport {
  if (culture.terminee != null) {
    return { ok: false, erreur: 'Cette culture est terminée : rien à reporter.' }
  }

  const champEtape = CHAMP_PAR_ETAPE[etape]
  if (culture[champEtape]) {
    return {
      ok: false,
      erreur: `Impossible de reporter ${LIBELLE_ETAPE[etape]} : cette étape est déjà faite.`,
    }
  }

  const champDate = CHAMP_DATE_ETAPE[champEtape]
  const ancienne = culture[champDate]
  const deltaJours = ancienne
    ? Math.round((jourCivilLocal(nouvelleDate) - jourCivilLocal(ancienne)) / UN_JOUR_MS)
    : 0

  const ecritures: Record<string, Date | null> = {
    [champDate]: nouvelleDate,
    // Date redéfinie par l'utilisateur : la mémoire de plan n'a plus d'objet.
    [CHAMP_PLAN_ETAPE[champEtape]]: null,
  }
  const decalages: DecalageEtape[] = [{ etape, de: ancienne, a: nouvelleDate }]

  // Les étapes ultérieures non faites suivent, du même nombre de jours.
  const index = ETAPES.indexOf(champEtape)
  if (deltaJours !== 0) {
    for (const suivante of ETAPES.slice(index + 1)) {
      if (culture[suivante]) continue
      const champSuivant = CHAMP_DATE_ETAPE[suivante]
      const dateSuivante = culture[champSuivant]
      if (!dateSuivante) continue
      const decalee = plusJoursCivils(dateSuivante, deltaJours)
      ecritures[champSuivant] = decalee
      ecritures[CHAMP_PLAN_ETAPE[suivante]] = null
      decalages.push({ etape: ETAPE_PAR_CHAMP[suivante], de: dateSuivante, a: decalee })
    }
  }

  // La fenêtre de récolte SUIT son début. Reporter une récolte du 12/08 au 20/08
  // sans déplacer sa fin raccourcirait la période d'autant, et une aubergine
  // reportée de trois semaines finirait avant d'avoir commencé.
  if (
    deltaJours !== 0 &&
    culture.finRecolte &&
    (champDate === 'dateRecolte' || ecritures.dateRecolte !== undefined)
  ) {
    ecritures.finRecolte = plusJoursCivils(culture.finRecolte, deltaJours)
  }

  // Chronologie sur les dates résultantes — les étapes FAITES, jamais
  // déplacées, bornent le report (on ne plante pas avant un semis fait).
  const effective = (champ: ChampEtape): Date | null => {
    const c = CHAMP_DATE_ETAPE[champ]
    return (ecritures[c] as Date | null | undefined) !== undefined
      ? (ecritures[c] as Date | null)
      : culture[c]
  }
  const semis = effective('semisFait')
  const plantation = effective('plantationFaite')
  const recolte = effective('recolteFaite')
  if (semis && plantation && semis.getTime() > plantation.getTime()) {
    return { ok: false, erreur: 'Ce report placerait la plantation avant le semis.' }
  }
  const debutCycle = plantation ?? semis
  if (debutCycle && recolte && debutCycle.getTime() > recolte.getTime()) {
    return {
      ok: false,
      erreur: 'Ce report placerait la récolte avant le début du cycle.',
    }
  }

  return { ok: true, ecritures, decalages }
}
