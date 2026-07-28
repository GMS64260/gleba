"use client"

/**
 * Hook React pour les modes d'élevage optionnels de l'utilisateur.
 * Miroir allégé de use-modules.ts : lit/écrit la préférence "modesElevage"
 * via /api/user/preferences, avec cache navigateur + optimistic update et
 * rollback en cas d'échec.
 *
 * Différence clé avec les modules : la liste VIDE est un état valide (aucun
 * mode optionnel = seule la filière `rente` est active).
 *
 * cf. docs/elevage-modes-phase0-spec.md
 */

import * as React from "react"
import {
  DEFAULT_MODES_ELEVAGE,
  sanitizeModesElevage,
  filieresActives,
  type ElevageModeId,
} from "@/lib/elevage-modes"
import type { Filiere } from "@/lib/elevage/filiere"

const CACHE_KEY = "gleba_modes_elevage"
const CACHE_TTL_MS = 5 * 60 * 1000

interface Cached {
  ts: number
  modes: ElevageModeId[]
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

function writeCache(modes: ElevageModeId[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), modes } satisfies Cached))
  } catch {
    // localStorage indisponible (mode privé, quota…)
  }
}

export interface UseElevageModesResult {
  modes: ElevageModeId[]
  /** Filières disponibles : toujours `rente` + celles des modes actifs. */
  filieres: Filiere[]
  loading: boolean
  refresh: () => Promise<void>
  save: (next: ElevageModeId[]) => Promise<{ ok: boolean; error?: string }>
  isActif: (id: ElevageModeId) => boolean
}

export function useElevageModes(): UseElevageModesResult {
  const cached = readCache()
  const [modes, setModes] = React.useState<ElevageModeId[]>(cached?.modes ?? DEFAULT_MODES_ELEVAGE)
  const [loading, setLoading] = React.useState(!cached)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/user/preferences", { cache: "no-store" })
      if (res.ok) {
        const prefs = await res.json()
        const m = sanitizeModesElevage(prefs.modesElevage)
        setModes(m)
        writeCache(m)
      }
    } catch {
      // Silencieux : on garde la valeur courante.
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = React.useCallback(
    async (next: ElevageModeId[]): Promise<{ ok: boolean; error?: string }> => {
      const sanitized = sanitizeModesElevage(next)
      const previous = modes
      // Optimistic update (nouvelle référence pour forcer le re-render).
      setModes([...sanitized])
      writeCache(sanitized)
      try {
        const res = await fetch("/api/user/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modesElevage: sanitized }),
        })
        if (!res.ok) {
          setModes([...previous])
          writeCache(previous)
          const txt = await res.text().catch(() => "")
          return { ok: false, error: `HTTP ${res.status}${txt ? `: ${txt}` : ""}` }
        }
        return { ok: true }
      } catch (err) {
        setModes([...previous])
        writeCache(previous)
        return { ok: false, error: err instanceof Error ? err.message : "Erreur réseau" }
      }
    },
    [modes]
  )

  const isActif = React.useCallback((id: ElevageModeId) => modes.includes(id), [modes])

  const filieres = React.useMemo(() => filieresActives(modes), [modes])

  return { modes, filieres, loading, refresh, save, isActif }
}
