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
  const numero = React.useRef(0)
  // Remis à zéro au montage : en développement, React monte, démonte puis
  // remonte chaque effet, et le compteur resterait « démonté » pour toujours.
  React.useEffect(() => {
    numero.current = 0
    return () => { numero.current = -1 }
  }, [])
  return React.useCallback(() => {
    if (numero.current < 0) return () => false
    const n = ++numero.current
    return () => n === numero.current
  }, [])
}
