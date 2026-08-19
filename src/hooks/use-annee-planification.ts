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
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import {
  DASHBOARD_YEAR_STORAGE_KEY,
  anneesMaraichage,
  resolveDashboardYear,
} from "@/lib/dashboard-year"

export interface AnneePlanification {
  annee: number
  /** Change l'année : URL (deep-link + rechargement) et préférence du module. */
  definirAnnee: (annee: number) => void
  /** Années sélectionnables, de la plus récente à la plus ancienne. */
  annees: number[]
  /** Faux tant que la saison mémorisée n'a pas été restaurée. */
  pret: boolean
}

export function useAnneePlanification(): AnneePlanification {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const anneeUrl = searchParams.get("annee")

  const [anneeMemorisee, setAnneeMemorisee] = React.useState<string | null>(null)
  const [restauree, setRestauree] = React.useState(false)
  React.useEffect(() => {
    try {
      setAnneeMemorisee(localStorage.getItem(DASHBOARD_YEAR_STORAGE_KEY))
    } catch {
      // localStorage indisponible (navigation privée, quota) — on garde le défaut
    } finally {
      setRestauree(true)
    }
  }, [])

  const annees = React.useMemo(() => anneesMaraichage(), [])
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
        localStorage.setItem(DASHBOARD_YEAR_STORAGE_KEY, String(valeur))
      } catch {
        // ignore
      }
      const params = new URLSearchParams(query)
      params.set("annee", String(valeur))
      // `replace` : un filtre d'année n'encombre pas l'historique, mais il doit
      // rester dans le deep-link et survivre à un rechargement.
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, query, router]
  )

  return { annee, definirAnnee, annees, pret: restauree || Boolean(anneeUrl) }
}
