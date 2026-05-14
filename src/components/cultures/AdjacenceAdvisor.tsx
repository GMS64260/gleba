"use client"

/**
 * PROMPT DEV 2 Bug #10 — Encart "Compatibilités voisinage" non bloquant.
 *
 * Affiché dans le formulaire de création de culture dès qu'une espèce ET une
 * planche sont sélectionnées. Appelle GET /api/cultures/check-adjacence et
 * affiche les alertes (rouge) et suggestions (vert).
 */

import * as React from "react"
import { AlertTriangle, Sparkles, Loader2 } from "lucide-react"

type AlerteAdjacence = {
  type: "favorable" | "defavorable"
  especes: [string, string]
  message: string
  plancheNom: string
}

type SuggestionCompagnon = {
  especeId: string
  message: string
}

type Result = {
  alertes: AlerteAdjacence[]
  suggestions: SuggestionCompagnon[]
  planchesVoisines: { id: string; nom: string }[]
}

export function AdjacenceAdvisor({
  especeId,
  plancheId,
}: {
  especeId: string
  plancheId: string
}) {
  const [data, setData] = React.useState<Result | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!especeId || !plancheId) return
    let cancelled = false
    setLoading(true)
    fetch(
      `/api/cultures/check-adjacence?especeId=${encodeURIComponent(especeId)}&plancheId=${encodeURIComponent(plancheId)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [especeId, plancheId])

  if (loading) {
    return (
      <div className="rounded-md border bg-slate-50 p-3 text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Analyse des cultures voisines…
      </div>
    )
  }

  if (!data) return null
  if (data.planchesVoisines.length === 0) {
    return (
      <div className="rounded-md border bg-slate-50 p-3 text-xs text-muted-foreground">
        Aucune planche voisine référencée (cette planche n'a pas d'îlot défini).
      </div>
    )
  }
  if (data.alertes.length === 0 && data.suggestions.length === 0) {
    return null // pas de signal → ne pas polluer l'UI
  }

  const incompatibilites = data.alertes.filter((a) => a.type === "defavorable")
  const favorables = data.alertes.filter((a) => a.type === "favorable")

  return (
    <div className="space-y-2">
      {incompatibilites.length > 0 && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-red-900">
                Incompatibilité avec une culture voisine
              </p>
              <ul className="mt-1 space-y-1 text-xs text-red-800">
                {incompatibilites.map((a, i) => (
                  <li key={i}>
                    Sur <span className="font-medium">{a.plancheNom}</span> : {a.message}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-red-700">
                Vous pouvez créer cette culture quand même, mais le rendement pourrait être affecté.
              </p>
            </div>
          </div>
        </div>
      )}
      {favorables.length > 0 && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-emerald-900">
                Bonne association avec une culture voisine
              </p>
              <ul className="mt-1 space-y-1 text-xs text-emerald-800">
                {favorables.map((a, i) => (
                  <li key={i}>
                    Sur <span className="font-medium">{a.plancheNom}</span> : {a.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      {data.suggestions.length > 0 && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-blue-900">Compagnons à ajouter à proximité</p>
              <ul className="mt-1 space-y-1 text-xs text-blue-800">
                {data.suggestions.slice(0, 3).map((s, i) => (
                  <li key={i}>
                    💡 <span className="font-medium">{s.especeId}</span> — {s.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
