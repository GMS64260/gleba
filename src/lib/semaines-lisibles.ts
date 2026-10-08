/**
 * Semaines ISO lisibles.
 *
 * Demande du 2026-10-07 (compte verger) : la période de récolte d'une variété
 * se saisissait en « semaine 27 + durée 6 », une notation que l'utilisateur
 * n'a pas reconnue. Ici, une semaine se lit « début juillet », une période
 * « de début juillet à mi-août ». Le stockage reste en semaines ISO
 * (début + durée), comme les ITP ; seule la lecture change.
 *
 * Le mois d'une semaine est celui de son JEUDI (jour pivot de la semaine ISO,
 * la semaine 1 étant celle qui contient le 4 janvier) : la semaine 1 se lit
 * « début janvier » même quand son lundi tombe fin décembre. L'année de
 * référence est l'année civile courante ; le jeudi d'une semaine ISO ne bouge
 * que de quelques jours d'une année à l'autre.
 */

import { semaineVersDate } from "@/lib/cultures/dates-itp"

export const SEMAINES_PAR_AN = 52

export interface PeriodeSemaines {
  /** Semaine ISO de début (1-52). */
  debut: number
  /** Durée en semaines (≥ 1) ; la fin peut passer par janvier. */
  duree: number
}

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]

/** Ramène un numéro de semaine dans 1-52 (S53 → S01, S0 → S52). */
export function normaliserSemaine(semaine: number): number {
  const base = Math.round(semaine) - 1
  return ((base % SEMAINES_PAR_AN) + SEMAINES_PAR_AN) % SEMAINES_PAR_AN + 1
}

/** « S07 », « S27 ». */
export function numeroSemaine(semaine: number): string {
  return `S${String(normaliserSemaine(semaine)).padStart(2, "0")}`
}

/** « début juillet », « mi-juillet », « fin juillet ». */
export function libelleSemaine(semaine: number, annee = new Date().getFullYear()): string {
  const jeudi = semaineVersDate(annee, normaliserSemaine(semaine))
  jeudi.setDate(jeudi.getDate() + 3)
  const mois = MOIS[jeudi.getMonth()]
  const jour = jeudi.getDate()
  if (jour <= 10) return `début ${mois}`
  if (jour <= 20) return `mi-${mois}`
  return `fin ${mois}`
}

/** Dernière semaine d'une période (début + durée), en repassant par janvier si besoin. */
export function semaineFin(debut: number, duree: number): number {
  return normaliserSemaine(debut + Math.max(1, Math.round(duree)) - 1)
}

/** Durée en semaines entre deux semaines ISO, bornes comprises (S48 → S05 = 10). */
export function dureeEntreSemaines(debut: number, fin: number): number {
  return ((normaliserSemaine(fin) - normaliserSemaine(debut) + SEMAINES_PAR_AN) % SEMAINES_PAR_AN) + 1
}

/** Période depuis les colonnes `s_*` / `d_*` du référentiel, ou null si le début manque. */
export function periodeDepuisSemaines(
  debut: number | null | undefined,
  duree: number | null | undefined,
): PeriodeSemaines | null {
  if (!debut) return null
  return { debut: normaliserSemaine(debut), duree: Math.max(1, duree ?? 1) }
}

/** « début juillet → mi-août », ou « début juillet » pour une semaine seule. */
export function libellePeriodeSemainesCourt(
  debut: number | null | undefined,
  duree: number | null | undefined,
  annee = new Date().getFullYear(),
): string | null {
  const periode = periodeDepuisSemaines(debut, duree)
  if (!periode) return null
  if (periode.duree <= 1) return libelleSemaine(periode.debut, annee)
  return `${libelleSemaine(periode.debut, annee)} → ${libelleSemaine(semaineFin(periode.debut, periode.duree), annee)}`
}

/**
 * « de début juillet à mi-août (S27 → S33) », ou « début juillet (S27) » pour
 * une semaine seule. Null si le début manque.
 */
export function libellePeriodeSemaines(
  debut: number | null | undefined,
  duree: number | null | undefined,
  annee = new Date().getFullYear(),
): string | null {
  const periode = periodeDepuisSemaines(debut, duree)
  if (!periode) return null
  if (periode.duree <= 1) {
    return `${libelleSemaine(periode.debut, annee)} (${numeroSemaine(periode.debut)})`
  }
  const fin = semaineFin(periode.debut, periode.duree)
  return `de ${libelleSemaine(periode.debut, annee)} à ${libelleSemaine(fin, annee)} (${numeroSemaine(periode.debut)} → ${numeroSemaine(fin)})`
}

/** Semaines ISO couvertes par une période. */
export function semainesDePeriode(periode: PeriodeSemaines): Set<number> {
  const semaines = new Set<number>()
  for (let i = 0; i < Math.min(periode.duree, SEMAINES_PAR_AN); i++) {
    semaines.add(normaliserSemaine(periode.debut + i))
  }
  return semaines
}

/** Deux périodes ont au moins une semaine commune (passage par janvier compris). */
export function periodesSeChevauchent(a: PeriodeSemaines, b: PeriodeSemaines): boolean {
  const semainesA = semainesDePeriode(a)
  for (const semaine of semainesDePeriode(b)) if (semainesA.has(semaine)) return true
  return false
}

/** Options d'un sélecteur de semaine : « S27 · début juillet ». */
export const OPTIONS_SEMAINES: ReadonlyArray<{ value: number; label: string }> = Array.from(
  { length: SEMAINES_PAR_AN },
  (_, i) => ({ value: i + 1, label: `${numeroSemaine(i + 1)} · ${libelleSemaine(i + 1)}` }),
)
