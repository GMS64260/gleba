"use client"

/**
 * Hook persistance layout jardin (PROMPT 25 LOT B §5).
 *
 * Bufferise les déplacements d'objets/planches/arbres et déclenche un
 * seul PUT debouncé à la fin du drag, plutôt qu'un PATCH par mouvement.
 *
 * Usage :
 *   const { schedule, flush } = useGardenLayout()
 *   schedule('planche', plancheId, { posX, posY, rotation2D })
 *   // appelé automatiquement après 600 ms d'inactivité, ou via flush()
 */

import * as React from "react"

type EntityKind = "planche" | "objet" | "arbre"

interface BufferedChange {
  kind: EntityKind
  id: string | number
  payload: Record<string, number>
}

const DEBOUNCE_MS = 600

export function useGardenLayout() {
  const bufferRef = React.useRef<Map<string, BufferedChange>>(new Map())
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = React.useCallback(async () => {
    const buffer = bufferRef.current
    if (buffer.size === 0) return
    const changes = Array.from(buffer.values())
    buffer.clear()
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    // Group by kind pour minimiser les appels API
    const byKind = changes.reduce<Record<EntityKind, BufferedChange[]>>(
      (acc, c) => {
        acc[c.kind].push(c)
        return acc
      },
      { planche: [], objet: [], arbre: [] }
    )

    await Promise.all(
      Object.entries(byKind).map(([kind, list]) => {
        if (list.length === 0) return Promise.resolve()
        const endpoint =
          kind === "planche"
            ? "/api/planches/bulk-position"
            : kind === "objet"
            ? "/api/objets/bulk-position"
            : "/api/arbres/bulk-position"
        return fetch(endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates: list.map((c) => ({ id: c.id, ...c.payload })) }),
        }).catch((e) => {
          console.error("[garden-layout] flush error:", e)
        })
      })
    )
  }, [])

  const schedule = React.useCallback(
    (kind: EntityKind, id: string | number, payload: Record<string, number>) => {
      const key = `${kind}:${id}`
      const existing = bufferRef.current.get(key)
      bufferRef.current.set(key, {
        kind,
        id,
        payload: { ...(existing?.payload || {}), ...payload },
      })
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        flush()
      }, DEBOUNCE_MS)
    },
    [flush]
  )

  // Flush au démontage pour ne pas perdre les modifs en attente
  React.useEffect(() => {
    return () => {
      flush()
    }
  }, [flush])

  return { schedule, flush }
}
