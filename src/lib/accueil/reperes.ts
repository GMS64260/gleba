/**
 * Accueil v2 — repères dérivés des KPI existants. Fonctions PURES.
 */

import type { KPIMaraichage } from "@/lib/kpi/types"

export interface RecolteDominante {
  valeur: number
  unite: string
  /** Même unité, l'an passé à date égale (0 = première année de récoltes). */
  valeurN1: number
  /** Écart avec l'an passé à date égale, dans la même unité. */
  ecartN1: number
}

/**
 * Plus grosse récolte de l'année par unité : une ferme de fleurs coupées lit
 * ses tiges, pas « 0 kg ». Sans récolte cette année, zéro dans l'unité de
 * l'an passé.
 */
export function recolteDominante(
  kpi: Pick<KPIMaraichage, "recoltesParUniteYtd" | "recoltesParUniteN1Ytd">,
): RecolteDominante {
  const ytd = (kpi.recoltesParUniteYtd ?? {}) as Record<string, number | undefined>
  const n1Par = (kpi.recoltesParUniteN1Ytd ?? {}) as Record<string, number | undefined>
  const entrees = Object.entries(ytd).filter((e): e is [string, number] => typeof e[1] === "number" && e[1] > 0)
  if (entrees.length === 0) {
    const n1 = Object.entries(n1Par).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]
    return { valeur: 0, unite: n1?.[0] ?? "kg", valeurN1: n1?.[1] ?? 0, ecartN1: 0 - (n1?.[1] ?? 0) }
  }
  const [unite, valeur] = entrees.sort((a, b) => b[1] - a[1])[0]
  const n1 = n1Par[unite] ?? 0
  return { valeur: Math.round(valeur * 10) / 10, unite, valeurN1: Math.round(n1 * 10) / 10, ecartN1: Math.round((valeur - n1) * 10) / 10 }
}
