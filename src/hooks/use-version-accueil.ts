"use client"

/**
 * Version d'accueil de la PERSONNE connectée, côté navigateur, sur le motif
 * de `use-modules.ts` : cache local 5 min appliqué au montage (jamais au
 * rendu, React #418), lecture réseau ensuite, bus d'événements pour que le
 * shell (rail, en-tête) bascule sans rechargement quand « Essayer » ou
 * « Revenir » enregistre la préférence.
 *
 * Le compte démo garde v1 ici (ses préférences sont figées) ; côté serveur,
 * `ACCUEIL_DEMO` ne pilote que la redirection de /dashboard.
 */

import * as React from "react"

import { CLE_PREFERENCE_ACCUEIL, VERSION_ACCUEIL_DEFAUT, sanitizeVersionAccueil, type VersionAccueil } from "@/lib/accueil/preference"

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
    fetch("/api/user/preferences", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((prefs) => {
        if (annule || !prefs) return
        const v = sanitizeVersionAccueil(prefs[CLE_PREFERENCE_ACCUEIL])
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
