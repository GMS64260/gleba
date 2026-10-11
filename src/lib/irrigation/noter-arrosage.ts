/**
 * Noter l'arrosage d'une planche depuis un écran (calendrier potager, page
 * Tâches) : même route que le conseiller d'irrigation et la page Irriguer,
 * donc même trace (`enregistrerArrosageCultures` : dernier arrosage, ligne
 * d'intervention). Module client, sans dépendance serveur.
 */

/**
 * Ce qu'il faut pour annuler exactement un arrosage noté : sans quantité, la
 * trace et les dates d'avant ; avec, l'intervention créée.
 */
export type AnnulationArrosage =
  | { dateEffective: string; avant: Record<number, string | null> }
  | { interventionId: number }

type Resultat<T> = ({ ok: true } & T) | { ok: false; erreur: string }

function signalerMiseAJour(source: string) {
  // Les autres vues d'arrosage (conseiller, accueil) se rechargent.
  window.dispatchEvent(new CustomEvent("gleba:irrigation-updated", { detail: { source } }))
}

async function patch(corps: Record<string, unknown>, erreurParDefaut: string) {
  // Coupure réseau : « Failed to fetch » du navigateur, en anglais, devient
  // un message lisible.
  const res = await fetch("/api/cultures/irriguer", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  }).catch(() => {
    throw new Error(`${erreurParDefaut} : pas de connexion au serveur.`)
  })
  const reponse = await res.json().catch(() => null)
  if (!res.ok) throw new Error(reponse?.error || erreurParDefaut)
  return reponse
}

/**
 * `litres` : quantité versée sur la planche, si connue (ticket QA cmv3japsf) ;
 * sans elle, l'arrosage compte comme un plein.
 */
export async function noterArrosage(
  cultureIds: number[],
  notes?: string | null,
  litres?: number | null,
  source = "noter-arrosage",
): Promise<Resultat<{ annulation: AnnulationArrosage }>> {
  try {
    const r = await patch(
      { cultureIds, marquerArrosage: true, notes: notes?.trim() || null, ...(litres ? { litres } : {}) },
      "Impossible de noter l'arrosage",
    )
    signalerMiseAJour(source)
    if (litres) return { ok: true, annulation: { interventionId: r.interventionId } }
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
