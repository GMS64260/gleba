/**
 * Dates « jour seul » des formulaires de culture, côté navigateur.
 *
 * Trois formes cohabitent dans un champ de formulaire : l'ISO renvoyé par
 * l'API (minuit UTC d'un jour saisi, ou instant d'une étape faite), la chaîne
 * « AAAA-MM-JJ » tapée dans le champ, et l'objet `Date` calculé à l'écran
 * depuis l'itinéraire (minuit LOCAL du navigateur).
 *
 * Revue du 2026-11-11 — les champs affichaient `format(new Date(valeur))`, soit
 * le jour LOCAL d'un minuit UTC : à l'ouest d'UTC (Antilles, Guyane,
 * Polynésie), le 12 avril stocké s'affichait le 11, et le jour tapé reculait
 * d'un jour sous les doigts. À l'inverse, une date calculée à l'écran partait
 * en instant (minuit local) et le serveur en lisait le jour à Paris : à l'est
 * (La Réunion, Mayotte, Nouvelle-Calédonie), elle était enregistrée la veille.
 * La règle de lecture est celle du dépôt : `jourCivilStocke`.
 */
import { jourCivilStocke } from '@/lib/jour-civil'

type ValeurDate = Date | string | null | undefined

/** Valeur d'un `<input type="date">` : le jour civil de la date, ou vide. */
export function valeurChampDate(valeur: ValeurDate): string {
  return jourCivilStocke(valeur) ?? ''
}

/** Jour civil « JJ/MM » d'une date stockée, pour les colonnes de liste ; `null` sans date. */
export function jourMoisCourt(valeur: ValeurDate): string | null {
  const jour = jourCivilStocke(valeur)
  return jour ? `${jour.slice(8, 10)}/${jour.slice(5, 7)}` : null
}

/** Jour civil « JJ/MM/AAAA » d'une date stockée ; `null` sans date. */
export function jourMoisAnnee(valeur: ValeurDate): string | null {
  const jour = jourCivilStocke(valeur)
  return jour ? `${jour.slice(8, 10)}/${jour.slice(5, 7)}/${jour.slice(0, 4)}` : null
}

/**
 * Midi LOCAL du jour civil d'une date stockée : la date à passer à un
 * formateur local (`format` de date-fns, noms de mois compris) ou à comparer à
 * « aujourd'hui » sans reculer d'un jour à l'ouest d'UTC. `null` sans date.
 */
export function midiLocalDuJour(valeur: ValeurDate): Date | null {
  const jour = jourCivilStocke(valeur)
  if (!jour) return null
  const [annee, mois, quantieme] = jour.split('-').map(Number)
  return new Date(annee, mois - 1, quantieme, 12)
}

export const CHAMPS_DATE_CULTURE = ['dateSemis', 'datePlantation', 'dateRecolte', 'finRecolte'] as const
type ChampDateCulture = (typeof CHAMPS_DATE_CULTURE)[number]

/**
 * Corps à envoyer : les dates calculées à l'écran (objets `Date`) partent en
 * jour seul « AAAA-MM-JJ », que le serveur lit sans fuseau. Les chaînes sont
 * laissées telles quelles : une date non touchée repart comme elle a été
 * chargée, et le serveur garde alors l'instant stocké.
 */
export function datesCalculeesEnJoursSeuls<T extends Partial<Record<ChampDateCulture, ValeurDate>>>(
  donnees: T
): T {
  const corps = { ...donnees }
  for (const champ of CHAMPS_DATE_CULTURE) {
    const valeur = corps[champ]
    if (!(valeur instanceof Date)) continue
    const jour = jourCivilStocke(valeur)
    // Date illisible : laissée au serveur, qui la refuse.
    if (jour) (corps as Record<ChampDateCulture, ValeurDate>)[champ] = jour
  }
  return corps
}

type JalonCycle = 'dateSemis' | 'datePlantation' | 'dateRecolte'

const ETAPE_FAITE: Record<JalonCycle, 'semisFait' | 'plantationFaite' | 'recolteFaite'> = {
  dateSemis: 'semisFait',
  datePlantation: 'plantationFaite',
  dateRecolte: 'recolteFaite',
}

/**
 * Dates à poser dans la fiche quand on change l'itinéraire d'une culture.
 *
 * - Une étape déjà faite garde sa date : c'est celle de l'exécution, pas une
 *   prévision que le nouvel itinéraire pourrait réécrire.
 * - Une étape à venir prend la date du nouvel itinéraire, absente comprise : un
 *   semis hérité d'un itinéraire en pépinière n'appartient pas au calendrier
 *   d'un itinéraire en plant (même règle qu'à la création).
 * - Un itinéraire sans aucune date ne dit rien du calendrier : rien ne bouge.
 */
export function datesApresChangementItp(
  cycle: Partial<Record<JalonCycle, Date | null>>,
  etapes: Partial<Record<'semisFait' | 'plantationFaite' | 'recolteFaite', boolean | null>>
): Partial<Record<JalonCycle, Date | null>> {
  const jalons = Object.keys(ETAPE_FAITE) as JalonCycle[]
  if (!jalons.some((jalon) => cycle[jalon])) return {}
  const dates: Partial<Record<JalonCycle, Date | null>> = {}
  for (const jalon of jalons) {
    if (etapes[ETAPE_FAITE[jalon]]) continue
    dates[jalon] = cycle[jalon] ?? null
  }
  return dates
}
