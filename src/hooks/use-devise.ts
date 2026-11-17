"use client"

import { useEffect, useState } from "react"
import { deviseDuTerritoire, type Devise } from "@/lib/territoires"

/** Exploitation active (tenant ≠ acteur), ou boutique publique visitée sans dépendre de la session. */
export function useDevise(boutiqueSlug?: string): Devise | null {
  const source = boutiqueSlug === undefined ? "/api/exploitation" : `/api/boutique/public/${encodeURIComponent(boutiqueSlug)}`
  const [chargee, setChargee] = useState<{ source: string; devise: Devise } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setChargee(null)
    fetch(source, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Impossible de charger la devise de l'exploitation")
        return response.json()
      })
      .then((payload) => {
        if (controller.signal.aborted) return
        const data = boutiqueSlug === undefined ? payload.data : payload
        const devise = data?.devise === "XPF" || data?.devise === "EUR"
          ? data.devise
          : boutiqueSlug === undefined ? deviseDuTerritoire(data?.territoire) : null
        if (devise !== null) setChargee({ source, devise })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setChargee(null)
          console.error("Chargement de la devise de l'exploitation :", error)
        }
      })
    return () => controller.abort()
  }, [source, boutiqueSlug])

  return chargee?.source === source ? chargee.devise : null
}
