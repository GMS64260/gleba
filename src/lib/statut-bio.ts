/**
 * Statut Bio — calcul automatique de la progression C1 → C2 → C3 → AB.
 *
 * Réglementation (Règlement (UE) 2018/848) :
 *   - C1 : année 1 de conversion (premier jour de l'inscription en bio)
 *   - C2 : année 2 (= 12 mois après la date de début)
 *   - C3 : année 3 (= 24 mois après) — récoltes vendues "AB en conversion"
 *   - AB : à partir du début de l'année 4 (= 36 mois après la date de début)
 *           pour les cultures annuelles. Pour les cultures pérennes (verger,
 *           petits fruits) le délai est aussi de 36 mois — on garde la même
 *           règle ici (la précision par culture sortira d'un PROMPT futur).
 */

export type StatutBio = "Conventionnel" | "C1" | "C2" | "C3" | "AB"

export const STATUTS_BIO: ReadonlyArray<StatutBio> = [
  "Conventionnel",
  "C1",
  "C2",
  "C3",
  "AB",
]

export const STATUT_BIO_LABELS: Record<StatutBio, string> = {
  Conventionnel: "Conventionnel",
  C1: "Conversion année 1 (C1)",
  C2: "Conversion année 2 (C2)",
  C3: "Conversion année 3 (C3)",
  AB: "Agriculture Biologique (AB)",
}

/**
 * Statut effectif aujourd'hui à partir du statut nominal et de la date de
 * début de conversion. Si statut courant = AB ou Conventionnel, on retourne
 * tel quel (pas de progression). Si C1/C2/C3 et une date, on recalcule.
 */
export function statutBioCourant(
  statutNominal: StatutBio | string | null | undefined,
  dateDebutConversion: Date | string | null | undefined,
  refDate: Date = new Date()
): StatutBio {
  const nominal = (statutNominal ?? "Conventionnel") as StatutBio
  if (nominal === "Conventionnel" || nominal === "AB") return nominal

  if (!dateDebutConversion) return nominal
  const debut = typeof dateDebutConversion === "string" ? new Date(dateDebutConversion) : dateDebutConversion
  if (Number.isNaN(debut.getTime()) || debut > refDate) return nominal

  // Mois écoulés depuis le début de la conversion
  const monthsElapsed =
    (refDate.getFullYear() - debut.getFullYear()) * 12 +
    (refDate.getMonth() - debut.getMonth())
  if (monthsElapsed < 12) return "C1"
  if (monthsElapsed < 24) return "C2"
  if (monthsElapsed < 36) return "C3"
  return "AB"
}

/**
 * Date à laquelle la zone passe au statut suivant (jalon). NULL si on est déjà
 * en AB ou en Conventionnel.
 */
export function prochaineMontee(
  statutNominal: StatutBio | string | null | undefined,
  dateDebutConversion: Date | string | null | undefined,
  refDate: Date = new Date()
): { prochain: StatutBio; date: Date } | null {
  const courant = statutBioCourant(statutNominal, dateDebutConversion, refDate)
  if (courant === "Conventionnel" || courant === "AB") return null
  if (!dateDebutConversion) return null
  const debut = typeof dateDebutConversion === "string" ? new Date(dateDebutConversion) : dateDebutConversion

  const addMonths = (d: Date, m: number) => {
    const r = new Date(d)
    r.setMonth(r.getMonth() + m)
    return r
  }

  if (courant === "C1") return { prochain: "C2", date: addMonths(debut, 12) }
  if (courant === "C2") return { prochain: "C3", date: addMonths(debut, 24) }
  return { prochain: "AB", date: addMonths(debut, 36) }
}

/**
 * Helper pour snapshoter le statut Bio au moment d'une récolte.
 * Reçoit le statutNominal + dateDebutConversion de la planche/zone source,
 * retourne la valeur à persister dans `Recolte.statutBioSnapshot`.
 */
export function snapshotStatutBio(
  statutNominal: StatutBio | string | null | undefined,
  dateDebutConversion: Date | string | null | undefined,
  dateRecolte: Date = new Date()
): StatutBio {
  return statutBioCourant(statutNominal, dateDebutConversion, dateRecolte)
}
