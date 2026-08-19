"use client"

/**
 * « Une saisie est en cours » — vrai tant qu'un champ de formulaire a le focus.
 *
 * Ticket cmsx6epia (QA 2026-08-17, viewport 375 px) : sur l'écran de saisie
 * comptable, les deux bulles flottantes (Feedback en bas à gauche, Assistant IA
 * en bas à droite) se superposaient aux extrémités du champ « N° pièce
 * justificative » et en masquaient une partie. Sur un écran de 375 px, ces deux
 * pastilles de 48 px couvrent la bande basse de l'écran : n'importe quel champ
 * pleine largeur qui s'y trouve est amputé, et le dégagement `pb-24` du bas de
 * page ne protège que le DERNIER élément.
 *
 * Plutôt que de déplacer les bulles sous un autre champ, on les efface le temps
 * de la frappe, et seulement sur petit écran : dès que le champ perd le focus
 * elles reviennent. Le contenu de la page n'est jamais décalé.
 */

import * as React from "react"

const CHAMPS_DE_SAISIE = ["INPUT", "TEXTAREA", "SELECT"]

/** Types d'input qui ne sont pas de la frappe (cases, boutons radio…). */
const TYPES_NON_SAISIE = new Set(["checkbox", "radio", "button", "submit", "reset", "range", "file"])

function estChampDeSaisie(cible: EventTarget | null): boolean {
  if (!(cible instanceof HTMLElement)) return false
  if (cible.isContentEditable) return true
  if (!CHAMPS_DE_SAISIE.includes(cible.tagName)) return false
  if (cible instanceof HTMLInputElement && TYPES_NON_SAISIE.has(cible.type)) return false
  return true
}

export function useSaisieEnCours(): boolean {
  const [enCours, setEnCours] = React.useState(false)

  React.useEffect(() => {
    const onFocusIn = (evenement: FocusEvent) => {
      if (estChampDeSaisie(evenement.target)) setEnCours(true)
    }
    const onFocusOut = () => setEnCours(false)
    document.addEventListener("focusin", onFocusIn)
    document.addEventListener("focusout", onFocusOut)
    return () => {
      document.removeEventListener("focusin", onFocusIn)
      document.removeEventListener("focusout", onFocusOut)
    }
  }, [])

  return enCours
}
