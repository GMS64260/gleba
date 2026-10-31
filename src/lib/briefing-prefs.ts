/**
 * Préférence « ouvrir le briefing du jour automatiquement », lue et écrite
 * par la page Paramètres. Public : la page ne peut pas importer
 * `@/lib/chat/daily-opening`, absent du dépôt public (zone privée), sans
 * casser le typage d'un clone. Le module privé définit la même clé : il doit
 * réexporter celles-ci à sa prochaine mise à jour.
 */
export const CLE_PREF_BRIEFING_AUTO = "briefingQuotidienAuto"

/** Valeur par défaut en l'absence de préférence enregistrée : éteint. */
export const BRIEFING_AUTO_PAR_DEFAUT = false

/** Lit la préférence dans l'objet rendu par `GET /api/user/preferences`. */
export function briefingAutoActive(prefs: Record<string, unknown> | null | undefined): boolean {
  const valeur = prefs?.[CLE_PREF_BRIEFING_AUTO]
  if (typeof valeur === "boolean") return valeur
  if (valeur === "true") return true
  if (valeur === "false") return false
  return BRIEFING_AUTO_PAR_DEFAUT
}
