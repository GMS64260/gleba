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
