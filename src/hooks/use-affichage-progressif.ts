"use client"

import * as React from "react"

export const PAS_AFFICHAGE_LISTE = 50

/**
 * Affichage progressif d'une longue liste déjà chargée : les 50 premières
 * lignes, puis 50 de plus à la demande. Le compteur revient au début quand la
 * liste change de nature (`cle` : filtres, onglet, année), pas quand une ligne
 * est modifiée.
 */
export function useAffichageProgressif<T>(lignes: readonly T[], cle: string, pas = PAS_AFFICHAGE_LISTE) {
  const [etat, setEtat] = React.useState({ cle, affichees: pas })
  const affichees = etat.cle === cle ? etat.affichees : pas
  return {
    visibles: lignes.length > affichees ? lignes.slice(0, affichees) : lignes,
    total: lignes.length,
    reste: Math.max(0, lignes.length - affichees),
    afficherPlus: () => setEtat({ cle, affichees: affichees + pas }),
    afficherTout: () => setEtat({ cle, affichees: lignes.length }),
  }
}
