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
import { valeurChampDate } from "@/lib/cultures/champ-date"

type AlerteAdjacence = {
  type: "favorable" | "defavorable"
  especes: [string, string]
  message: string
  plancheNom: string
  memePlanche?: boolean
}

type SuggestionCompagnon = {
  especeId: string
  especeNom?: string
  message: string
}

type Result = {
  alertes: AlerteAdjacence[]
  suggestions: SuggestionCompagnon[]
  ilot: string | null
  planchesVoisines: { id: string; nom: string }[]
}

export function AdjacenceAdvisor({
  especeId,
  plancheId,
  debut,
  fin,
}: {
  especeId: string
  plancheId: string
  /** Occupation prévue de la culture : avec les deux dates, la planche elle-même est analysée. */
  debut?: Date | string | null
  fin?: Date | string | null
}) {
  const [data, setData] = React.useState<Result | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [erreur, setErreur] = React.useState(false)

  // Jours civils : valeurs stables d'un rendu à l'autre, et lisibles par la route.
  const jourDebut = valeurChampDate(debut)
  const jourFin = valeurChampDate(fin)

  React.useEffect(() => {
    if (!especeId || !plancheId) return
    let cancelled = false
    setLoading(true)
    setErreur(false)
    fetch(
      `/api/cultures/check-adjacence?especeId=${encodeURIComponent(especeId)}&plancheId=${encodeURIComponent(plancheId)}` +
        (jourDebut && jourFin ? `&debut=${jourDebut}&fin=${jourFin}` : "")
    )
      .then((r) => {
        if (!r.ok) throw new Error("check-adjacence")
        return r.json()
      })
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch(() => {
        if (cancelled) return
        // Un échec n'est pas « rien à signaler » : on le dit, sans bloquer la saisie.
        setData(null)
        setErreur(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [especeId, plancheId, jourDebut, jourFin])

  if (loading) {
    return (
      <div className="rounded-md border bg-slate-50 p-3 text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Analyse des cultures voisines…
      </div>
    )
  }

  if (erreur) {
    return (
      <div role="status" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        Le voisinage n’a pas pu être analysé : les associations avec les cultures voisines ne sont pas vérifiées.
      </div>
    )
  }
  if (!data) return null
  // Une alerte sur la planche elle-même se montre même sans planche voisine.
  if (data.planchesVoisines.length === 0 && data.alertes.length === 0) {
    return (
      <div className="rounded-md border bg-slate-50 p-3 text-xs text-muted-foreground">
        {data.ilot
          ? <>Aucune autre planche n’est référencée dans l’îlot « {data.ilot} ».</>
          : <>Cette planche n’a pas d’îlot défini&nbsp;: le voisinage ne peut pas être analysé.</>}
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
                Incompatibilité avec une culture voisine ou de la même planche
              </p>
              <ul className="mt-1 space-y-1 text-xs text-red-800">
                {incompatibilites.map((a, i) => (
                  <li key={i}>
                    Sur <span className="font-medium">{a.plancheNom}</span>
                    {a.memePlanche ? " (même planche)" : ""} : {a.message}
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
                Bonne association avec une culture voisine ou de la même planche
              </p>
              <ul className="mt-1 space-y-1 text-xs text-emerald-800">
                {favorables.map((a, i) => (
                  <li key={i}>
                    Sur <span className="font-medium">{a.plancheNom}</span>
                    {a.memePlanche ? " (même planche)" : ""} : {a.message}
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
                    {/* Le message commence déjà par le nom de l'espèce. */}
                    💡 {s.message}
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
