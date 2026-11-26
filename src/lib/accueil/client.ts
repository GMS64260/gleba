/**
 * Côté navigateur : les gestes de l'accueil (cocher une ligne, noter une
 * récolte, terminer une culture) et leur inverse exact.
 */

import { messageErreurReponse } from "@/lib/api-erreur"

import type { MutationLigne } from "./mutations"
import type { SaisieRecolte } from "./types"

async function patch(url: string, corps: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    })
    if (!res.ok) return { ok: false, error: await messageErreurReponse(res) }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur réseau" }
  }
}

/** Marque la ligne faite. */
export function executerMutation(m: MutationLigne) {
  return patch(m.url, m.corps)
}

/** Rejoue l'inverse exact (bouton « Annuler » du toast). */
export function annulerMutation(m: MutationLigne) {
  return patch(m.url, m.inverse)
}

/**
 * Note une récolte depuis l'accueil : création dans le registre (l'unité est
 * figée côté serveur) puis culture marquée récoltée, comme la page Tâches.
 * Le succès est vérifié avant de marquer « fait » (pas de faux succès).
 */
export async function noterRecolte(
  saisie: SaisieRecolte,
  quantite: number,
): Promise<{ ok: true; recolteId: number | null } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/recoltes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cultureId: saisie.cultureId, especeId: saisie.especeId, date: new Date().toISOString(), quantite }),
    })
    if (!res.ok) return { ok: false, error: await messageErreurReponse(res) }
    const json = await res.json().catch(() => null)
    const recolteId: number | null = json?.data?.id ?? json?.id ?? null
    const marque = await patch(`/api/cultures/${saisie.cultureId}`, { recolteFaite: true })
    if (!marque.ok) return { ok: false, error: `Récolte enregistrée, mais la culture n'a pas pu être marquée récoltée : ${marque.error ?? ""}` }
    return { ok: true, recolteId }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur réseau" }
  }
}

/** Inverse exact : la récolte créée est supprimée, la culture redevient à récolter. */
export async function annulerRecolte(saisie: SaisieRecolte, recolteId: number | null): Promise<{ ok: boolean; error?: string }> {
  try {
    if (recolteId !== null) {
      const res = await fetch(`/api/recoltes/${recolteId}`, { method: "DELETE" })
      if (!res.ok) return { ok: false, error: await messageErreurReponse(res) }
    }
    return patch(`/api/cultures/${saisie.cultureId}`, { recolteFaite: false })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur réseau" }
  }
}

/**
 * Rien à récolter (perte, abandon) : la culture est terminée (`terminee = 'x'`,
 * la convention du registre) et quitte la liste du jour ; l'inverse la
 * remet à récolter. Une sortie de stock, elle, ne dit rien de la culture.
 */
export function terminerCulture(cultureId: number) {
  return patch(`/api/cultures/${cultureId}`, { terminee: "x" })
}

export function rouvrirCulture(cultureId: number) {
  return patch(`/api/cultures/${cultureId}`, { terminee: null })
}
