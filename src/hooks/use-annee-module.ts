"use client"

/**
 * Année d'un module (sélecteur d'année d'en-tête) : URL d'abord, préférence du
 * module ensuite, année courante enfin.
 *
 * Extrait de `useAnneePlanification` (QA cmswwu5cc, hub Planification) pour
 * servir aussi le verger. Signalement QA du 2026-10-19 : le sélecteur d'année
 * du verger vivait dans un état local persisté en `localStorage`, et seul
 * l'onglet Calendrier le recevait ; l'onglet Opérations listait toutes les
 * années. L'URL (`?annee=`) devient la source de l'écran, comme au maraîchage.
 *
 * Règle :
 *   1. un deep-link explicite (`?annee=`) fait toujours foi ;
 *   2. sinon on restaure l'année choisie dans le module (clé `localStorage`
 *      propre au module) ;
 *   3. sinon l'année courante.
 *
 * La lecture de `localStorage` se fait dans un effet, jamais pendant le rendu
 * (React #418 du 2026-08-11). Tant que la restauration n'a pas eu lieu, `pret`
 * reste faux pour que les écrans ne chargent pas les données d'une autre
 * année, sauf si l'URL tranche déjà.
 */

import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"

import { resolveDashboardYear } from "@/lib/dashboard-year"

export interface AnneeModule {
  annee: number
  /** Change l'année : URL (deep-link + rechargement) et préférence du module. */
  definirAnnee: (annee: number) => void
  /** Années sélectionnables, de la plus récente à la plus ancienne. */
  annees: number[]
  /** Faux tant que l'année mémorisée n'a pas été restaurée. */
  pret: boolean
}

export function useAnneeModule({
  cleStockage,
  annees,
}: {
  /** Clé `localStorage` de la préférence du module. */
  cleStockage: string
  /** Années admises (une valeur hors plage, dans l'URL ou mémorisée, est ignorée). */
  annees: number[]
}): AnneeModule {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const anneeUrl = searchParams.get("annee")

  const [anneeMemorisee, setAnneeMemorisee] = React.useState<string | null>(null)
  const [restauree, setRestauree] = React.useState(false)
  React.useEffect(() => {
    try {
      setAnneeMemorisee(localStorage.getItem(cleStockage))
    } catch {
      // localStorage indisponible (navigation privée, quota) : on garde le défaut
    } finally {
      setRestauree(true)
    }
  }, [cleStockage])

  const annee = resolveDashboardYear({
    queryValue: anneeUrl,
    storedValue: anneeMemorisee,
    fallbackYear: new Date().getFullYear(),
    allowedYears: annees,
  })

  const query = searchParams.toString()
  const definirAnnee = React.useCallback(
    (valeur: number) => {
      try {
        localStorage.setItem(cleStockage, String(valeur))
      } catch {
        // ignore
      }
      setAnneeMemorisee(String(valeur))
      const params = new URLSearchParams(query)
      params.set("annee", String(valeur))
      // Un filtre d'année n'encombre pas l'historique (replace), mais il doit
      // rester dans le deep-link et survivre à un rechargement.
      //
      // QA 2026-09-28 : `router.replace(même chemin, autre query)` était
      // IGNORÉ en silence dès que la page avait été préchargée sous ce chemin
      // (prouvé sur Next 16.2.10). L'API History, que Next synchronise avec
      // `useSearchParams`, met l'URL à jour immédiatement et n'entre jamais
      // dans la file du routeur.
      window.history.replaceState(null, "", `${pathname}?${params.toString()}`)
    },
    [cleStockage, pathname, query]
  )

  return { annee, definirAnnee, annees, pret: restauree || Boolean(anneeUrl) }
}
