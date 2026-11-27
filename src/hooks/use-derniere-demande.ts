import * as React from "react"

/**
 * Garde contre les réponses périmées.
 *
 * Un écran qui recharge ses données à chaque changement de filtre, d'année ou
 * de fiche lance plusieurs demandes ; rien ne garantit qu'elles reviennent
 * dans l'ordre. Sans garde, la réponse lente d'un filtre précédent remplace
 * celle du filtre affiché (équipe debug, D66), ou les valeurs d'un animal
 * alimentent le formulaire d'un autre (D80).
 *
 *   const nouvelleDemande = useDerniereDemande()
 *   const charger = async () => {
 *     const estActuelle = nouvelleDemande()
 *     const res = await fetch(url)
 *     if (!estActuelle()) return   // une demande plus récente est partie
 *     setDonnees(await res.json())
 *   }
 *
 * Après démontage du composant, plus aucune demande n'est « actuelle ».
 */
export function useDerniereDemande(): () => () => boolean {
  // Compteur monotone, et drapeau de montage à part : remis à zéro au montage,
  // le compteur donnait le même numéro à la demande partie avant un remontage
  // (mode strict de React, en développement) et à celle d'après.
  const numero = React.useRef(0)
  const monte = React.useRef(true)
  React.useEffect(() => {
    monte.current = true
    return () => { monte.current = false }
  }, [])
  return React.useCallback(() => {
    if (!monte.current) return () => false
    const n = ++numero.current
    return () => monte.current && n === numero.current
  }, [])
}
