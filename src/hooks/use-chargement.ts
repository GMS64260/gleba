"use client"

/**
 * Chargement de données d'un écran piloté par un filtre : la dernière demande
 * gagne, d'office.
 *
 * Un écran qui relit ses données quand un filtre change (exercice, année,
 * animal, parcelle, recherche, page) lance plusieurs demandes sans garantie
 * d'ordre. Écrite à la main sur chaque écran, la garde manquait sur 73
 * lectures (inventaire du 2026-11-27) et se contournait elle-même : le
 * rechargement lancé après une action gardait le filtre de sa fermeture. Ici :
 *
 * - `cle` résume TOUS les filtres de la lecture (`factures:2026`). `null` :
 *   rien n'est lu (année mémorisée pas encore restaurée, fiche non choisie).
 *   Elle ne contient jamais un objet (`session`) : au mieux un identifiant.
 * - Une réponse ne vaut que pour la demande qui l'a produite. Un changement de
 *   clé annule la lecture en cours et invalide sa réponse, que le lecteur
 *   honore le signal d'annulation ou non.
 * - `recharger()` relit avec la clé et le lecteur COURANTS, jamais ceux du
 *   rendu où il a été capturé. Il rend une promesse : `await recharger()`.
 *
 * Deux couches. `useLecture` n'a aucun état (un `useRef`, un `useEffect`) :
 * l'écran range lui-même la réponse, sans changer le nombre ni l'ordre de ses
 * `useState` (des tests les simulent par position). `useChargement` ajoute un
 * seul `useState` et expose `donnees`, `erreur`, `enChargement`.
 *
 * Pour la réponse à un GESTE (scan, bouton « Vérifier », suggestions), qui ne
 * décrit pas l'écran, `useDerniereDemande` reste l'outil.
 */
import * as React from "react"

export type Lecteur<T> = (signal: AbortSignal) => Promise<T>

export type Reponse<T> =
  /** `rafraichissement` : même clé que la dernière réponse reçue (rechargement après une action). */
  | { cle: string; etat: "chargement"; rafraichissement: boolean }
  | { cle: string; etat: "pret"; donnees: T }
  | { cle: string; etat: "erreur"; erreur: unknown }

/** État d'une lecture, hors de React pour être testé seul. */
export type Boite<T> = {
  cle: string | null
  /** Numéro de la dernière demande : monotone, jamais remis à zéro. */
  numero: number
  controleur: AbortController | null
  /** Clé de la dernière réponse appliquée avec succès. */
  cleRecue: string | null
  lecteur: Lecteur<T>
  appliquer: (reponse: Reponse<T>) => void
}

export function creerBoite<T>(lecteur: Lecteur<T>, appliquer: (reponse: Reponse<T>) => void): Boite<T> {
  return { cle: null, numero: 0, controleur: null, cleRecue: null, lecteur, appliquer }
}

/** Lance la lecture de la clé courante de la boîte ; toute lecture antérieure est invalidée. */
export function lancerLecture<T>(boite: Boite<T>): Promise<void> {
  boite.controleur?.abort()
  const numero = ++boite.numero
  const cle = boite.cle
  if (cle === null) {
    boite.controleur = null
    return Promise.resolve()
  }
  const controleur = (boite.controleur = new AbortController())
  boite.appliquer({ cle, etat: "chargement", rafraichissement: boite.cleRecue === cle })
  let lecture: Promise<T>
  try {
    lecture = boite.lecteur(controleur.signal)
  } catch (erreur) {
    lecture = Promise.reject(erreur)
  }
  return lecture.then(
    (donnees) => {
      if (numero !== boite.numero) return
      boite.cleRecue = cle
      boite.appliquer({ cle, etat: "pret", donnees })
    },
    (erreur) => {
      if (numero === boite.numero && !controleur.signal.aborted) boite.appliquer({ cle, etat: "erreur", erreur })
    },
  )
}

/** Abandonne la lecture en cours : sa réponse ne sera pas appliquée. */
export function abandonnerLecture<T>(boite: Boite<T>): void {
  boite.numero++
  boite.controleur?.abort()
  boite.controleur = null
}

/**
 * Couche sans état. `appliquer` reçoit « chargement », puis « pret » ou
 * « erreur », toujours pour la demande courante. Sur un « chargement » qui
 * n'est pas un rafraîchissement, l'écran vide ce qu'il affichait : les lignes
 * d'un autre filtre ne restent ni visibles ni actionnables.
 */
export function useLecture<T>(
  cle: string | null,
  lecteur: Lecteur<T>,
  appliquer: (reponse: Reponse<T>) => void,
): { recharger: () => Promise<void> } {
  const ref = React.useRef<{ boite: Boite<T>; recharger: () => Promise<void> } | null>(null)
  if (ref.current === null) {
    const boite = creerBoite(lecteur, appliquer)
    ref.current = { boite, recharger: () => lancerLecture(boite) }
  }
  const { boite, recharger } = ref.current
  // Dernières fermetures : un rechargement lit le lecteur du rendu courant.
  boite.lecteur = lecteur
  boite.appliquer = appliquer
  React.useEffect(() => {
    boite.cle = cle
    void lancerLecture(boite)
    return () => abandonnerLecture(boite)
  }, [cle]) // eslint-disable-line react-hooks/exhaustive-deps
  return { recharger }
}

/** Ce que l'écran affiche pour la clé courante, à partir de la dernière réponse rangée. */
export function etatChargement<T>(
  reponse: Reponse<T> | null,
  cle: string | null,
): { donnees: T | null; erreur: unknown; enChargement: boolean } {
  const courante = reponse !== null && cle !== null && reponse.cle === cle ? reponse : null
  return {
    donnees: courante?.etat === "pret" ? courante.donnees : null,
    erreur: courante?.etat === "erreur" ? courante.erreur : null,
    // Clé nulle : rien n'est demandé, l'écran reste en attente.
    enChargement: courante === null || courante.etat === "chargement",
  }
}

/**
 * Réponse à ranger : un rechargement de la MÊME clé garde les données
 * affichées (l'écran ne clignote pas après chaque action) ; un changement de
 * clé les masque.
 */
export function rangerReponse<T>(precedente: Reponse<T> | null, recue: Reponse<T>): Reponse<T> {
  if (recue.etat === "chargement" && precedente?.etat === "pret" && precedente.cle === recue.cle) return precedente
  return recue
}

/**
 * Couche avec état (un seul `useState`).
 *
 * `donnees` vaut `null` tant que la clé courante n'a pas répondu : aucune
 * ligne d'un autre filtre ne reste affichée ni actionnable.
 */
export function useChargement<T>(cle: string | null, lecteur: Lecteur<T>) {
  const [reponse, setReponse] = React.useState<Reponse<T> | null>(null)
  const { recharger } = useLecture<T>(cle, lecteur, (recue) => setReponse((precedente) => rangerReponse(precedente, recue)))
  return { ...etatChargement(reponse, cle), recharger }
}

/** Lecteur JSON courant : une réponse en échec lève, avec le message du serveur s'il en donne un. */
export async function lireJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const reponse = await fetch(url, signal ? { signal } : undefined)
  if (!reponse.ok) {
    const corps = await reponse.json().catch(() => null)
    throw new Error(typeof corps?.error === "string" ? corps.error : `Lecture impossible (${reponse.status})`)
  }
  return (await reponse.json()) as T
}

/**
 * Pour un chargeur écrit à la main (`fetchData`) qu'on ne réécrit pas en
 * `useLecture` : deux garanties en une ligne.
 *
 * - La fonction rendue est STABLE et appelle toujours le chargeur du rendu
 *   courant : un rechargement lancé après une action relit avec les filtres
 *   affichés, jamais avec ceux de la fermeture qui l'a capturé.
 * - Le chargeur reçoit `estActuelle` : faux dès qu'une demande plus récente
 *   est partie ou que l'écran est démonté. Il ne range rien si elle est fausse.
 *
 *   const charger = React.useCallback(async (estActuelle: () => boolean) => {
 *     const res = await fetch(url)
 *     if (!estActuelle()) return
 *     setDonnees(await res.json())
 *   }, [filtre])
 *   const fetchData = useDernierChargeur(charger)
 *   React.useEffect(() => { void fetchData() }, [fetchData, charger])   // `charger` change avec les filtres
 *
 * ATTENTION : la fonction rendue étant stable, un `useEffect(..., [fetchData])`
 * seul ne se relance plus quand un filtre change. L'effet doit citer le
 * chargeur interne (`charger`) dans ses dépendances, comme ci-dessus.
 */
export type EtatChargeur<R> = {
  chargeur: (estActuelle: () => boolean) => Promise<R>
  /** Numéro de la dernière demande : monotone. */
  numero: number
  monte: boolean
}

/** Cœur de `useDernierChargeur`, hors de React pour être testé seul. */
export function appelerDernierChargeur<R>(etat: EtatChargeur<R>): Promise<R> {
  const n = ++etat.numero
  return etat.chargeur(() => etat.monte && n === etat.numero)
}

export function useDernierChargeur<R = void>(chargeur: (estActuelle: () => boolean) => Promise<R>): () => Promise<R> {
  const ref = React.useRef<EtatChargeur<R> | null>(null)
  if (ref.current === null) ref.current = { chargeur, numero: 0, monte: true }
  const etat = ref.current
  // Dernière fermeture : un rechargement lit le chargeur du rendu courant.
  etat.chargeur = chargeur
  React.useEffect(() => {
    etat.monte = true
    return () => { etat.monte = false }
  }, [etat])
  return React.useCallback(() => appelerDernierChargeur(etat), [etat])
}
