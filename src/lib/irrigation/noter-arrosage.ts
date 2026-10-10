/**
 * Noter l'arrosage d'une planche depuis un écran (calendrier potager, page
 * Tâches) : même route que le conseiller d'irrigation et la page Irriguer,
 * donc même trace (`enregistrerArrosageCultures` : dernier arrosage, ligne
 * d'intervention). Module client, sans dépendance serveur.
 */
export async function noterArrosage(
  cultureIds: number[],
  notes?: string | null,
): Promise<{ ok: true } | { ok: false; erreur: string }> {
  try {
    const res = await fetch("/api/cultures/irriguer", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cultureIds, marquerArrosage: true, notes: notes?.trim() || null }),
    })
    if (!res.ok) {
      const corps = await res.json().catch(() => null)
      return { ok: false, erreur: corps?.error || "Impossible de noter l'arrosage" }
    }
    // Les autres vues d'arrosage (conseiller, accueil) se rechargent.
    window.dispatchEvent(new CustomEvent("gleba:irrigation-updated", { detail: { source: "noter-arrosage" } }))
    return { ok: true }
  } catch {
    return { ok: false, erreur: "Impossible de noter l'arrosage" }
  }
}
