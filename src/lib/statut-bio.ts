/**
 * Statut Bio — calcul automatique de la progression C1 → C2 → C3 → AB.
 *
 * Réglementation (Règlement (UE) 2018/848) :
 *   - C1 : année 1 de conversion (premier jour de l'inscription en bio)
 *   - C2 : année 2 (dès le 1er anniversaire de la date de début, au jour près)
 *   - C3 : année 3 (dès le 2e anniversaire) — récoltes vendues "AB en conversion"
 *   - AB : à partir du début de l'année 4 (dès le 3e anniversaire de la date de début)
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
  if (Number.isNaN(debut.getTime())) return nominal

  // Comparaison en journées civiles locales (conteneur en Europe/Paris), jamais
  // en mois entamés : compter les changements de mois faisait passer AB une
  // conversion du 30/11 dès le 1er du mois de son 3e anniversaire (MAR-02,
  // 2026-11-12). Le statut change le jour anniversaire lui-même.
  const jourRef = jourCivil(refDate)
  if (jourRef < jourCivil(debut)) return nominal
  if (jourRef < anniversaire(debut, 1)) return "C1"
  if (jourRef < anniversaire(debut, 2)) return "C2"
  if (jourRef < anniversaire(debut, 3)) return "C3"
  return "AB"
}

/** Journée civile locale comparable (AAAAMMJJ). */
function jourCivil(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
}

/**
 * Jour anniversaire `annees` ans après `debut`. Un début au 29 février n'a pas
 * d'anniversaire les années non bissextiles : le dépassement de `Date` le reporte
 * au 1er mars, jamais au 28 février, pour ne pas avancer le changement de statut.
 */
function anniversaire(debut: Date, annees: number): number {
  return jourCivil(new Date(debut.getFullYear() + annees, debut.getMonth(), debut.getDate()))
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

export type MentionABFacture =
  | { mode: "absente" }                       // aucun statut renseigné
  | { mode: "ab" }                            // toutes les lignes en AB
  | { mode: "conversion"; niveau: "C1" | "C2" | "C3" } // toutes en conversion homogène
  | { mode: "mixte"; nbAb: number; nbConv: number; nbConv2: number; nbConv3: number; nbAutre: number; total: number }

/**
 * Calcule la mention à afficher sur une facture / un bordereau à partir des
 * statuts Bio des lignes.
 *
 * Règles d'affichage suggérées :
 *   - "ab"          → "Issu de l'agriculture biologique" (mention complète)
 *   - "conversion"  → "En conversion biologique — année C2 (par exemple)"
 *   - "mixte"       → Détail par ligne, pas de mention globale
 *   - "absente"     → Rien
 */
export function mentionABFacture(statuts: Array<StatutBio | string | null | undefined>): MentionABFacture {
  const valides = statuts.filter((s): s is StatutBio => !!s && STATUTS_BIO.includes(s as StatutBio))
  if (valides.length === 0) return { mode: "absente" }

  const counts: Record<StatutBio, number> = { Conventionnel: 0, C1: 0, C2: 0, C3: 0, AB: 0 }
  for (const s of valides) counts[s] += 1

  // Tout AB ?
  if (counts.AB === valides.length) return { mode: "ab" }
  // Tout en conversion homogène ?
  for (const niveau of ["C1", "C2", "C3"] as const) {
    if (counts[niveau] === valides.length) return { mode: "conversion", niveau }
  }
  // Mixte (au moins 2 catégories différentes ou présence de Conventionnel)
  return {
    mode: "mixte",
    nbAb: counts.AB,
    nbConv: counts.C1,
    nbConv2: counts.C2,
    nbConv3: counts.C3,
    nbAutre: counts.Conventionnel,
    total: valides.length,
  }
}

export function labelMentionAB(mention: MentionABFacture): string | null {
  switch (mention.mode) {
    case "ab":
      return "Produit issu de l'agriculture biologique"
    case "conversion":
      return `Produit en conversion vers l'agriculture biologique — année ${mention.niveau}`
    case "mixte":
      return "Lot mixte : voir statut Bio par ligne ci-dessus"
    case "absente":
      return null
  }
}
