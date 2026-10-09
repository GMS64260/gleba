/**
 * Côté navigateur : enregistrement de la préférence `accueil` (v1 / v2) via
 * le magasin clé/valeur existant. Le compte démo reçoit le 403 explicite déjà
 * en place ; l'appelant décide s'il navigue quand même.
 */

import { messageErreurReponse } from "@/lib/api-erreur"

import { CLE_PREFERENCE_ACCUEIL, type VersionAccueil } from "./preference"

export async function enregistrerVersionAccueil(version: VersionAccueil): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/user/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [CLE_PREFERENCE_ACCUEIL]: version }),
    })
    if (!res.ok) return { ok: false, error: await messageErreurReponse(res) }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur réseau" }
  }
}
