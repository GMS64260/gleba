"use client"

/**
 * Côté écran de la version de fiche (`src/lib/api/version-fiche.ts`).
 *
 *   const version = useVersionFiche()
 *   version.retenir(fiche)                       // au chargement, et après chaque enregistrement réussi
 *   const res = await fetch(url, { method: "PUT", body: JSON.stringify(version.joindre(corps)) })
 *   const conflit = await lireConflitVersion(res)
 *   if (conflit) { … garder la saisie, proposer « Recharger » ou « Enregistrer quand même » … }
 *   // « Enregistrer quand même » : version.adopter(conflit.versionActuelle), puis renvoyer.
 */
import * as React from "react"

/** Même valeur que `CODE_MODIFIE_AILLEURS` côté serveur (module qui importe `next/server`). */
export const CODE_FICHE_MODIFIEE = "MODIFIE_AILLEURS"

export type VersionRetenue = number | "aucune" | null

/** Version portée par une fiche reçue du serveur ; `null` si elle n'en a pas (ancien serveur). */
export function versionDe(fiche: unknown): VersionRetenue {
  if (fiche === null || fiche === undefined) return "aucune"
  const version = (fiche as { version?: unknown }).version
  return typeof version === "number" && Number.isInteger(version) && version >= 0 ? version : null
}

/** Corps à envoyer : `versionLue` y est joint si une version est retenue, et `version` en est retiré. */
export function joindreVersion<T extends object>(corps: T, retenue: VersionRetenue): Omit<T, "version"> & { versionLue?: number | "aucune" } {
  const { version: _jamaisRenvoyee, ...reste } = corps as T & { version?: unknown }
  void _jamaisRenvoyee
  return retenue === null ? reste : { ...reste, versionLue: retenue }
}

export type ConflitVersion = { message: string; versionActuelle: number | null }

/**
 * Rend le conflit si la réponse est le refus « modifiée ailleurs », sinon
 * `null`. La réponse est clonée : les autres 409 (confirmation métier) gardent
 * leur corps intact pour l'appelant.
 */
export async function lireConflitVersion(reponse: Response): Promise<ConflitVersion | null> {
  if (reponse.status !== 409) return null
  const corps = await reponse.clone().json().catch(() => null)
  if (corps?.code !== CODE_FICHE_MODIFIEE) return null
  return {
    message: typeof corps.error === "string" ? corps.error : "Cette fiche a été modifiée depuis son ouverture. Rien n'a été enregistré.",
    versionActuelle: typeof corps.versionActuelle === "number" ? corps.versionActuelle : null,
  }
}

function creerVersionFiche() {
  let version: VersionRetenue = null
  return {
    /** Au chargement de la fiche et après chaque enregistrement réussi. */
    retenir: (fiche: unknown) => { version = versionDe(fiche) },
    /** Aucune fiche chargée (formulaire de création) : plus de version envoyée. */
    oublier: () => { version = null },
    joindre: <T extends object>(corps: T) => joindreVersion(corps, version),
    /** « Enregistrer quand même » : l'écran adopte la version actuelle avant de renvoyer. */
    adopter: (versionActuelle: number | null) => { version = versionActuelle },
    lue: () => version,
  }
}

export function useVersionFiche() {
  const ref = React.useRef<ReturnType<typeof creerVersionFiche> | null>(null)
  if (ref.current === null) ref.current = creerVersionFiche()
  return ref.current
}
