"use client"

/**
 * « Quantité / plants » d'une culture : automatique tant que l'utilisateur ne
 * l'a pas saisie lui-même (ticket cmvnpkkhp, revue du 2026-10-25).
 *
 * La fiche d'édition, « Nouvelle culture » et le dialogue du plan
 * recalculaient la quantité à chaque changement de rangs, de longueur ou
 * d'espacement, et écrasaient une valeur saisie à la main alors que
 * l'infobulle promettait l'inverse. Règle, identique à celle du serveur
 * (`quantiteCultureApresModification`) :
 * - modifier le champ pose l'indicateur ; le vider le lève ;
 * - indicateur posé : plus de recalcul automatique, le libellé ne dit plus
 *   « (auto) » ;
 * - indicateur levé : la quantité suit les paramètres.
 *
 * Un `ref` double l'état : les effets de recalcul le lisent sans dépendre de
 * lui, pour que vider le champ ne le remplisse pas aussitôt.
 */
import * as React from "react"

export function useQuantiteManuelle() {
  const ref = React.useRef(false)
  const [manuelle, setManuelle] = React.useState(false)

  const definir = React.useCallback((valeur: boolean) => {
    ref.current = valeur
    setManuelle(valeur)
  }, [])

  /** À appeler à chaque saisie dans le champ quantité. */
  const saisir = React.useCallback(
    (quantite: number | null | undefined) => definir(quantite != null),
    [definir]
  )

  const estManuelle = React.useCallback(() => ref.current, [])

  return { manuelle, estManuelle, saisir, definir }
}

export function libelleQuantitePlants(manuelle: boolean): string {
  return manuelle ? "Quantité / plants (saisie à la main)" : "Quantité / plants (auto)"
}

export const AIDE_QUANTITE_PLANTS =
  "Formule : nbRangs × ⌊longueur (cm) ÷ espacement⌋. Si vous modifiez ce champ, la valeur n'est plus recalculée ; videz-le pour revenir au calcul automatique."
