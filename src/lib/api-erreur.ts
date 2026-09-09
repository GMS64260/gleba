/**
 * Message lisible depuis une réponse d'API en échec.
 *
 * Les routes de Gleba répondent `{ error: "…" }`. Sans lecture de ce champ, un
 * refus explicite arrivait dans les toasts sous la forme
 * `HTTP 403: {"error":"…"}` : le message utile noyé dans du JSON. Constaté en
 * posant le gel des préférences du compte démo (2026-09-09), où le refus est
 * précisément ce que l'utilisateur doit lire.
 *
 * Replis successifs : champ `error`, puis corps brut (une page d'erreur de
 * proxy reste plus parlante que le statut seul), puis statut nu.
 */
export async function messageErreurReponse(res: Response): Promise<string> {
  const brut = await res.text().catch(() => "")
  if (!brut) return `HTTP ${res.status}`
  try {
    const json = JSON.parse(brut) as { error?: unknown }
    if (typeof json.error === "string" && json.error.trim()) return json.error
  } catch {
    // Pas du JSON : on garde le corps brut ci-dessous.
  }
  return `HTTP ${res.status}: ${brut}`
}
