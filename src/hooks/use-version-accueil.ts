"use client"

/**
 * Version d'accueil de la PERSONNE connectée, côté navigateur, sur le motif
 * de `use-modules.ts` : cache local 5 min appliqué au montage (jamais au
 * rendu, React #418), lecture réseau ensuite, bus d'événements pour que le
 * shell (rail, en-tête) bascule sans rechargement quand « Essayer » ou
 * « Revenir » enregistre la préférence.
 *
 * La version lue est la version EFFECTIVE décidée par le serveur
 * (`GET /api/accueil/version`) : la même que celle qui redirige /dashboard,
 * `ACCUEIL_DEMO` compris pour le compte démo. Lire la préférence brute par
 * `/api/user/preferences` laissait le rail disparaître sur les modules pour
 * la démo forcée en v2 (2026-10-10).
 */

import * as React from "react"

import { VERSION_ACCUEIL_DEFAUT, sanitizeVersionAccueil, type VersionAccueil } from "@/lib/accueil/preference"

const CACHE_KEY = "gleba_accueil_version"
const CACHE_TTL_MS = 5 * 60 * 1000
const EVENEMENT = "gleba:accueil-version-changed"

interface Cache {
  ts: number
  version: VersionAccueil
}

function lireCache(): VersionAccueil | null {
  if (typeof window === "undefined") return null
  try {
    const brut = window.localStorage.getItem(CACHE_KEY)
    if (!brut) return null
    const parse = JSON.parse(brut) as Cache
    if (Date.now() - parse.ts > CACHE_TTL_MS) return null
    return sanitizeVersionAccueil(parse.version)
  } catch {
    return null
  }
}

function ecrireCache(version: VersionAccueil) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), version } satisfies Cache))
  } catch {
    // stockage indisponible
  }
}

/** À appeler après un enregistrement réussi : le shell suit immédiatement. */
export function definirVersionAccueilLocale(version: VersionAccueil) {
  ecrireCache(version)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<VersionAccueil>(EVENEMENT, { detail: version }))
  }
}

export function useVersionAccueil(): { version: VersionAccueil; chargement: boolean } {
  const [version, setVersion] = React.useState<VersionAccueil>(VERSION_ACCUEIL_DEFAUT)
  const [chargement, setChargement] = React.useState(true)

  React.useEffect(() => {
    const cache = lireCache()
    if (cache) {
      setVersion(cache)
      setChargement(false)
    }
    let annule = false
    fetch("/api/accueil/version", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((reponse: { version?: unknown } | null) => {
        if (annule || !reponse) return
        const v = sanitizeVersionAccueil(reponse.version)
        setVersion(v)
        ecrireCache(v)
      })
      .catch(() => {
        // non connecté ou réseau : v1
      })
      .finally(() => {
        if (!annule) setChargement(false)
      })
    const onChange = (e: Event) => setVersion(sanitizeVersionAccueil((e as CustomEvent<VersionAccueil>).detail))
    window.addEventListener(EVENEMENT, onChange)
    return () => {
      annule = true
      window.removeEventListener(EVENEMENT, onChange)
    }
  }, [])

  return { version, chargement }
}
