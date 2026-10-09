"use client"

/**
 * Disposition de l'accueil v2 par compte, sur le motif de `use-modules.ts` :
 * cache local 5 min appliqué au montage (jamais au rendu, React #418),
 * rafraîchissement réseau, enregistrement optimiste avec retour arrière et
 * message d'erreur lisible (le compte démo reçoit son 403 explicite).
 */

import * as React from "react"

import { messageErreurReponse } from "@/lib/api-erreur"
import {
  CLE_PREFERENCE_DISPOSITION,
  dispositionDefaut,
  sanitizeAccueilDisposition,
  type AccueilDisposition,
} from "@/lib/accueil/disposition"

const CACHE_KEY = "gleba_accueil_disposition"
const CACHE_TTL_MS = 5 * 60 * 1000

interface Cache {
  ts: number
  disposition: AccueilDisposition
}

function lireCache(): AccueilDisposition | null {
  if (typeof window === "undefined") return null
  try {
    const brut = window.localStorage.getItem(CACHE_KEY)
    if (!brut) return null
    const parse = JSON.parse(brut) as Cache
    if (Date.now() - parse.ts > CACHE_TTL_MS) return null
    return sanitizeAccueilDisposition(parse.disposition)
  } catch {
    return null
  }
}

function ecrireCache(disposition: AccueilDisposition) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), disposition } satisfies Cache))
  } catch {
    // stockage indisponible
  }
}

export interface UseAccueilDispositionResult {
  disposition: AccueilDisposition
  chargement: boolean
  enregistrer: (suivante: AccueilDisposition) => Promise<{ ok: boolean; error?: string }>
}

export function useAccueilDisposition(): UseAccueilDispositionResult {
  const [disposition, setDisposition] = React.useState<AccueilDisposition>(dispositionDefaut)
  const [chargement, setChargement] = React.useState(true)

  React.useEffect(() => {
    const cache = lireCache()
    if (cache) {
      setDisposition(cache)
      setChargement(false)
    }
    let annule = false
    fetch("/api/user/preferences", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((prefs) => {
        if (annule || !prefs) return
        const d = sanitizeAccueilDisposition(prefs[CLE_PREFERENCE_DISPOSITION])
        setDisposition(d)
        ecrireCache(d)
      })
      .catch(() => {
        // on garde le défaut ou le cache
      })
      .finally(() => {
        if (!annule) setChargement(false)
      })
    return () => {
      annule = true
    }
  }, [])

  const enregistrer = React.useCallback(
    async (suivante: AccueilDisposition) => {
      const propre = sanitizeAccueilDisposition(suivante)
      const precedente = disposition
      setDisposition(propre)
      ecrireCache(propre)
      try {
        const res = await fetch("/api/user/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [CLE_PREFERENCE_DISPOSITION]: propre }),
        })
        if (!res.ok) {
          setDisposition(precedente)
          ecrireCache(precedente)
          return { ok: false, error: await messageErreurReponse(res) }
        }
        return { ok: true }
      } catch (e) {
        setDisposition(precedente)
        ecrireCache(precedente)
        return { ok: false, error: e instanceof Error ? e.message : "Erreur réseau" }
      }
    },
    [disposition],
  )

  return { disposition, chargement, enregistrer }
}
