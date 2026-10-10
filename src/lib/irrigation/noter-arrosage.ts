/**
 * Noter l'arrosage d'une planche depuis un écran (calendrier potager, page
 * Tâches) : même route que le conseiller d'irrigation et la page Irriguer,
 * donc même trace (`enregistrerArrosageCultures` : dernier arrosage, ligne
 * d'intervention). Module client, sans dépendance serveur.
 */

/** Ce qu'il faut pour annuler exactement un arrosage noté. */
export interface AnnulationArrosage {
  dateEffective: string
  avant: Record<number, string | null>
}

type Resultat<T> = ({ ok: true } & T) | { ok: false; erreur: string }

function signalerMiseAJour(source: string) {
  // Les autres vues d'arrosage (conseiller, accueil) se rechargent.
  window.dispatchEvent(new CustomEvent("gleba:irrigation-updated", { detail: { source } }))
}

async function patch(corps: Record<string, unknown>, erreurParDefaut: string) {
  const res = await fetch("/api/cultures/irriguer", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  })
  const reponse = await res.json().catch(() => null)
  if (!res.ok) throw new Error(reponse?.error || erreurParDefaut)
  return reponse
}

export async function noterArrosage(
  cultureIds: number[],
  notes?: string | null,
): Promise<Resultat<{ annulation: AnnulationArrosage }>> {
  try {
    const r = await patch(
      { cultureIds, marquerArrosage: true, notes: notes?.trim() || null },
      "Impossible de noter l'arrosage",
    )
    signalerMiseAJour("noter-arrosage")
    return { ok: true, annulation: { dateEffective: r.dateEffective, avant: r.derniereIrrigationAvant ?? {} } }
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Impossible de noter l'arrosage" }
  }
}

/** Inverse exact de `noterArrosage` (bouton « Annuler » du toast). */
export async function annulerArrosage(annulation: AnnulationArrosage): Promise<Resultat<object>> {
  try {
    await patch({ annulerArrosage: true, ...annulation }, "Impossible d'annuler l'arrosage")
    signalerMiseAJour("annuler-arrosage")
    return { ok: true }
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Impossible d'annuler l'arrosage" }
  }
}
