"use client"

/**
 * Hook React pour gérer les modules actifs de l'utilisateur.
 * Met en cache au niveau du navigateur pour éviter de fetch sur chaque page.
 */

import * as React from "react"
import {
  DEFAULT_MODULES_ACTIFS,
  sanitizeModulesActifs,
  type ModuleId,
} from "@/lib/modules"

const CACHE_KEY = "gleba_modules_actifs"
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
// DEV2 #5 — Bus d'événements interne pour propager les changements
// de modules entre tous les composants useModules de la page (ModulesNav,
// page Paramètres, etc.) sans avoir à refresh navigateur.
const MODULES_CHANGED_EVENT = "gleba:modules-changed"

interface Cached {
  ts: number
  modules: ModuleId[]
}

function readCache(): Cached | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Cached
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(modules: ModuleId[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), modules } satisfies Cached))
  } catch {
    // localStorage may fail (private mode, quota, etc.)
  }
}

export function useModules() {
  const cached = readCache()
  const [modules, setModules] = React.useState<ModuleId[]>(cached?.modules ?? DEFAULT_MODULES_ACTIFS)
  const [loading, setLoading] = React.useState(!cached)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/user/preferences")
      if (res.ok) {
        const prefs = await res.json()
        const m = sanitizeModulesActifs(prefs.modulesActifs)
        setModules(m)
        writeCache(m)
      }
    } catch {
      // Silent: keep default
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (!cached) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // DEV2 #5 — Écoute les changements émis par `save()` d'un autre useModules
  // ou d'un autre onglet (storage event natif).
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<{ modules: ModuleId[] }>).detail
      if (detail?.modules) setModules(detail.modules)
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key !== CACHE_KEY || !e.newValue) return
      try {
        const parsed = JSON.parse(e.newValue) as Cached
        if (Array.isArray(parsed.modules)) setModules(parsed.modules)
      } catch {
        // ignore
      }
    }
    window.addEventListener(MODULES_CHANGED_EVENT, onCustom)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener(MODULES_CHANGED_EVENT, onCustom)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  const save = React.useCallback(async (next: ModuleId[]) => {
    const sanitized = sanitizeModulesActifs(next)
    setModules(sanitized)
    writeCache(sanitized)
    // DEV2 #5 — broadcast au reste de la page pour que tous les
    // composants useModules (ModulesNav notamment) se ré-rendent.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(MODULES_CHANGED_EVENT, { detail: { modules: sanitized } }))
    }
    await fetch("/api/user/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modulesActifs: sanitized }),
    })
  }, [])

  const isActif = React.useCallback((id: ModuleId) => modules.includes(id), [modules])

  return { modules, loading, refresh, save, isActif }
}
