"use client"

/**
 * Hook React pour gérer les modules actifs de l'utilisateur.
 * Met en cache au niveau du navigateur pour éviter de fetch sur chaque page.
 *
 * BUG #1 (QA Camille 2026-05-15) — Le toggle ne déclenchait visuellement
 * rien :
 * - Au premier mount sans cache, `loading=true` désactivait le Switch ; un
 *   clic rapide était simplement ignoré.
 * - `save()` n'avait aucun `.catch()` : si le PUT échouait, l'exception
 *   remontait silencieusement sans toast ni rollback.
 *
 * Refactor :
 * - `save()` fait un optimistic update + rollback explicite si le PUT
 *   échoue, avec callback de notification.
 * - Le `loading` ne désactive plus le Switch (on a toujours une valeur par
 *   défaut, donc le user peut cliquer dès le premier paint).
 * - `setModules` utilise toujours une nouvelle référence pour forcer le
 *   re-render même si la liste est identique en contenu.
 */

import { messageErreurReponse } from "@/lib/api-erreur"
import * as React from "react"
import { useAccesService } from "./use-acces-service"
import {
  DEFAULT_MODULES_ACTIFS,
  isModuleId,
  sanitizeModulesActifs,
  type ModuleId,
} from "@/lib/modules"
import { moduleOuvert } from "@/lib/exploitation/modules-chemins"

const CACHE_KEY = "gleba_modules_actifs"
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
// DEV2 #5 — Bus d'événements interne pour propager les changements
// de modules entre tous les composants useModules de la page (ModulesNav,
// page Paramètres, etc.) sans avoir à refresh navigateur.
const MODULES_CHANGED_EVENT = "gleba:modules-changed"

interface Cached {
  ts: number
  modules: ModuleId[]
  /** Modules ouverts par l'adhésion du membre ; `null`/absent = aucune restriction. */
  restriction?: ModuleId[] | null
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

function writeCache(modules: ModuleId[], restriction: ModuleId[] | null) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), modules, restriction } satisfies Cached))
  } catch {
    // localStorage may fail (private mode, quota, etc.)
  }
}

export interface UseModulesResult {
  modules: ModuleId[]
  loading: boolean
  refresh: () => Promise<void>
  save: (next: ModuleId[]) => Promise<{ ok: boolean; error?: string }>
  isActif: (id: ModuleId) => boolean
}

export function useModules(): UseModulesResult {
  const { acces } = useAccesService()
  // Pas de lecture localStorage au rendu : le serveur et le 1er rendu client
  // doivent produire le même HTML (React #418). Le cache est appliqué dans
  // l'effect de mount, avant le refresh réseau.
  const [modules, setModules] = React.useState<ModuleId[]>(DEFAULT_MODULES_ACTIFS)
  const [loading, setLoading] = React.useState(true)
  // Restriction de l'adhésion (membre limité à certains modules) : le menu ne
  // propose pas un module fermé. L'autorisation reste portée par les routes.
  const [restriction, setRestriction] = React.useState<ModuleId[] | null>(null)
  const restrictionRef = React.useRef<ModuleId[] | null>(null)
  const appliquerRestriction = React.useCallback((valeur: unknown) => {
    const r = Array.isArray(valeur) ? valeur.filter(isModuleId) : null
    restrictionRef.current = r
    setRestriction(r)
    return r
  }, [])

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      // Bug feedback testeur 2026-05-25 (cmplk8yoz) — on force `no-store`
      // pour éviter qu'un cache navigateur/CDN renvoie l'ancien état du
      // toggle après un PUT.
      const res = await fetch("/api/user/preferences", { cache: "no-store" })
      if (res.ok) {
        const prefs = await res.json()
        const m = sanitizeModulesActifs(prefs.modulesActifs)
        const r = appliquerRestriction(prefs.restrictionModules)
        setModules(m)
        writeCache(m, r)
      }
    } catch {
      // Silent: keep default
    } finally {
      setLoading(false)
    }
  }, [appliquerRestriction])

  React.useEffect(() => {
    // Le cache local s'applique au mount seulement (jamais au rendu initial,
    // cf. React #418 ci-dessus) : l'utilisateur voit la valeur connue sans
    // attendre le réseau.
    const cached = readCache()
    if (cached) {
      appliquerRestriction(cached.restriction ?? null)
      setModules([...cached.modules])
      setLoading(false)
    }
    // Bug feedback testeur 2026-05-25 (cmplk8yoz) — on refresh
    // systématiquement au mount, même quand on a un cache local : ça
    // garantit que le toggle reflète la valeur serveur en cas de modif
    // depuis un autre onglet/appareil.
    refresh()
  }, [appliquerRestriction, refresh])

  // DEV2 #5 — Écoute les changements émis par `save()` d'un autre useModules
  // ou d'un autre onglet (storage event natif).
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<{ modules: ModuleId[] }>).detail
      if (detail?.modules) setModules([...detail.modules])
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key !== CACHE_KEY || !e.newValue) return
      try {
        const parsed = JSON.parse(e.newValue) as Cached
        if (Array.isArray(parsed.modules)) setModules([...parsed.modules])
        if (parsed.restriction !== undefined) appliquerRestriction(parsed.restriction)
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
  }, [appliquerRestriction])

  const save = React.useCallback(async (next: ModuleId[]): Promise<{ ok: boolean; error?: string }> => {
    const sanitized = sanitizeModulesActifs(next)
    // BUG #1 : optimistic update — état React + localStorage MAJ
    // immédiatement, puis appel API. Force une nouvelle référence avec
    // [...sanitized] pour garantir le re-render (sinon React peut bailler
    // out si la référence est identique à l'ancienne).
    const previous = modules
    setModules([...sanitized])
    writeCache(sanitized, restrictionRef.current)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(MODULES_CHANGED_EVENT, { detail: { modules: sanitized } }))
    }
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modulesActifs: sanitized }),
      })
      if (!res.ok) {
        // Rollback : on remet l'ancienne valeur côté state + cache + broadcast.
        setModules([...previous])
        writeCache(previous, restrictionRef.current)
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(MODULES_CHANGED_EVENT, { detail: { modules: previous } }))
        }
        return { ok: false, error: await messageErreurReponse(res) }
      }
      return { ok: true }
    } catch (err) {
      setModules([...previous])
      writeCache(previous, restrictionRef.current)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(MODULES_CHANGED_EVENT, { detail: { modules: previous } }))
      }
      return { ok: false, error: err instanceof Error ? err.message : "Erreur réseau" }
    }
  }, [modules])

  const affichables = React.useMemo(() => modules.filter(m => acces && (m === "comptabilite" ? acces.facturation : acces.ateliers.includes(m)) && moduleOuvert(restriction, m)), [modules, acces, restriction])
  const isActif = React.useCallback((id: ModuleId) => affichables.includes(id), [affichables])

  return { modules: affichables, loading, refresh, save, isActif }
}
