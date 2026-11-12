"use client"

/**
 * Année courante du hub Planification maraîchère — source unique des 9 écrans.
 *
 * QA cmswwu5cc — chaque sous-écran gérait son année à sa façon : deux lisaient
 * l'URL, sept la gardaient dans un état local (un rechargement ou un lien
 * partagé revenait à l'année courante), et tous recalculaient leur propre plage.
 * Résultat : le passage « Cultures prévues 2028 → Créer les cultures » pouvait
 * retomber sur 2026 et annoncer « 0 culture à créer » alors que l'écran voisin
 * en listait treize.
 *
 * Règle retenue :
 *   1. un deep-link explicite (`?annee=`) fait toujours foi ;
 *   2. sinon on restaure la saison choisie dans le module (même clé que le
 *      dashboard maraîchage, `gleba_dashboard_year`) ;
 *   3. sinon l'année courante.
 *
 * La lecture de `localStorage` se fait dans un effet, jamais pendant le rendu
 * (React #418 du 2026-08-11 : `useModules` lisait le stockage au rendu). Tant
 * que la restauration n'a pas eu lieu, `pret` reste faux pour que les écrans ne
 * chargent pas les données d'une autre saison — sauf si l'URL tranche déjà.
 */

import * as React from "react"

import { DASHBOARD_YEAR_STORAGE_KEY, anneesMaraichage } from "@/lib/dashboard-year"
import { useAnneeModule, type AnneeModule } from "@/hooks/use-annee-module"
import { useToast } from "@/hooks/use-toast"

/**
 * Mécanisme générique (URL, préférence, année courante) : `useAnneeModule`,
 * partagé avec le verger depuis le 2026-10-19. Ici, la préférence est celle du
 * dashboard maraîchage et la plage celle du module.
 */
export type AnneePlanification = AnneeModule

export function useAnneePlanification(): AnneePlanification {
  const annees = React.useMemo(() => anneesMaraichage(), [])
  return useAnneeModule({ cleStockage: DASHBOARD_YEAR_STORAGE_KEY, annees })
}

/** Ce qu'un écran a reçu, et pour quelle demande (saison, regroupement, tour). */
export type ReponsePlanification<T> = { cle: string; resultat: T | null; erreur: boolean }

/**
 * État affichable pour la demande COURANTE.
 *
 * Revue du 2026-11-11 — les écrans gardaient les données de la demande
 * précédente : après un échec, ou tant que la nouvelle saison chargeait, le
 * tableau de 2026 restait sous le sélecteur « 2027 » (« Créer » actif sur les
 * lignes d'une autre année), et un échec sur une liste vide affirmait « Aucune
 * culture prévue ». Une réponse ne vaut que pour la demande qui l'a produite ;
 * toute autre est ignorée, qu'elle soit ancienne ou arrivée en retard.
 */
export function etatPourDemande<T>(
  recu: ReponsePlanification<T> | null,
  cle: string | null,
): { resultat: T | null; erreur: boolean; chargement: boolean } {
  const aJour = recu !== null && cle !== null && recu.cle === cle
  return {
    resultat: aJour ? recu.resultat : null,
    erreur: aJour && recu.erreur,
    chargement: !aJour,
  }
}

/**
 * Charge le JSON d'un écran de planification. `url` nul : rien n'est demandé
 * (saison mémorisée pas encore restaurée) et l'écran reste en chargement.
 * Un changement d'URL annule la requête en cours ; `recharger` la rejoue.
 * `messageErreur` nul : pas de toast, l'écran dit lui-même l'échec.
 */
export function useChargementPlanification<T>(url: string | null, messageErreur: string | null) {
  const { toast } = useToast()
  const [tour, setTour] = React.useState(0)
  const [recu, setRecu] = React.useState<ReponsePlanification<T> | null>(null)
  const cle = url === null ? null : `${tour}:${url}`

  React.useEffect(() => {
    if (url === null || cle === null) return
    const controle = new AbortController()
    void (async () => {
      try {
        const reponse = await fetch(url, { signal: controle.signal })
        if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`)
        const resultat = (await reponse.json()) as T
        if (!controle.signal.aborted) setRecu({ cle, resultat, erreur: false })
      } catch {
        if (controle.signal.aborted) return
        setRecu({ cle, resultat: null, erreur: true })
        if (messageErreur) toast({ variant: "destructive", title: "Erreur", description: messageErreur })
      }
    })()
    return () => controle.abort()
  }, [url, cle, messageErreur, toast])

  const recharger = React.useCallback(() => setTour((t) => t + 1), [])
  return { ...etatPourDemande(recu, cle), recharger }
}
