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
  // `undefined` : rien n'a été chargé, aucune version n'est envoyée. Seul un
  // `null` explicite dit « le serveur n'a pas de fiche » (création par upsert).
  if (fiche === undefined) return null
  if (fiche === null) return "aucune"
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

/**
 * Envoie une fiche avec sa version, et gère le refus « modifiée ailleurs » :
 * la saisie n'est pas perdue, on demande s'il faut l'imposer, et si oui on
 * renvoie avec la version actuelle. Rend la réponse à traiter comme
 * d'habitude, ou `null` si la personne a renoncé (rien n'a été enregistré).
 *
 *   const res = await envoyerFiche(version, corps, (c) => fetch(url, { method: "PUT", body: JSON.stringify(c) }), confirmDialog)
 *   if (!res) { setErreur(MESSAGE_FICHE_NON_ENREGISTREE); return }
 */
export async function envoyerFiche<T extends object>(
  version: { joindre: (corps: T) => object; adopter: (versionActuelle: number | null) => void },
  corps: T,
  envoyer: (corps: object) => Promise<Response>,
  confirmer: (message: string) => Promise<boolean>,
): Promise<Response | null> {
  // Deux essais au plus : un second refus (encore modifiée entre-temps) se traite comme le premier.
  for (let essai = 0; essai < 3; essai++) {
    const reponse = await envoyer(version.joindre(corps))
    const conflit = await lireConflitVersion(reponse)
    if (!conflit) return reponse
    const imposer = await confirmer(`${conflit.message} Enregistrer quand même vos valeurs à la place de celles enregistrées entre-temps ? Sinon, annulez puis rechargez la page pour voir la fiche à jour.`)
    if (!imposer) return null
    version.adopter(conflit.versionActuelle)
  }
  return null
}

export const MESSAGE_FICHE_NON_ENREGISTREE = "Fiche modifiée ailleurs : rien n'a été enregistré. Rechargez la page pour voir la fiche à jour."

/**
 * Formulaire dans un dialogue, ouvert sur une ligne de liste. Pas de question
 * superposée au dialogue (sur téléphone, l'annuler fermait aussi le dialogue
 * et sa saisie) : sur un refus, la ligne ouverte adopte la version actuelle et
 * un second « Enregistrer » impose la saisie en connaissance de cause.
 *
 *   body: JSON.stringify(avecVersionLigne(corps, ligneOuverte))
 *   const conflit = await conflitDansDialogue(res, ligneOuverte)
 *   if (conflit) { setLigneOuverte(conflit.ligne); toast({ variant: "destructive", title: TITRE_FICHE_MODIFIEE, description: conflit.message }); return }
 */
export function avecVersionLigne<T extends object>(corps: T, ligne: { version?: unknown } | null | undefined): T & { versionLue?: number } {
  return typeof ligne?.version === "number" ? { ...corps, versionLue: ligne.version } : corps
}

export async function conflitDansDialogue<L extends object>(reponse: Response, ligne: L | null | undefined): Promise<{ ligne: L; message: string } | null> {
  const conflit = await lireConflitVersion(reponse)
  if (!conflit || !ligne) return null
  return {
    ligne: conflit.versionActuelle === null ? ligne : { ...ligne, version: conflit.versionActuelle },
    message: `${conflit.message} Enregistrez de nouveau pour imposer votre saisie, ou fermez pour voir la fiche à jour.`,
  }
}

export const TITRE_FICHE_MODIFIEE = "Modifiée ailleurs"

/** Message d'un refus dans un dialogue : la saisie reste ouverte, un second envoi l'impose. */
export function messageConflitDialogue(conflit: ConflitVersion): string {
  return `${conflit.message} Enregistrez de nouveau pour imposer votre saisie, ou fermez pour voir la fiche à jour.`
}

/**
 * Refus « modifiée ailleurs » d'un formulaire en dialogue tenu par `useVersionFiche` :
 * la version actuelle est adoptée et le message à afficher est rendu ; `null` s'il n'y a pas de conflit.
 */
export async function refusDansDialogue(reponse: Response, version: { adopter: (versionActuelle: number | null) => void }): Promise<string | null> {
  const conflit = await lireConflitVersion(reponse)
  if (!conflit) return null
  version.adopter(conflit.versionActuelle)
  return messageConflitDialogue(conflit)
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
