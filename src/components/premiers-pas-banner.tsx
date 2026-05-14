"use client"

/**
 * Bandeau "Premiers pas" affiché sur le dashboard pendant 30 jours après
 * la création du compte (PROMPT 22 §5).
 *
 * Liste des tâches recommandées :
 *  - Renseigner l'identité de l'exploitation (si manquante)
 *  - Créer une première culture (si module maraichage)
 *  - Créer un client (si module comptabilite)
 *  - Configurer une boutique (optionnel)
 *
 * Se masque automatiquement quand toutes les tâches sont accomplies
 * ou si l'utilisateur clique "Masquer".
 */

import * as React from "react"
import Link from "next/link"
import { Sparkles, X, CheckCircle2, Circle, ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface Step {
  key: string
  label: string
  done: boolean
  href: string
}

export function PremiersPasBanner() {
  const [hidden, setHidden] = React.useState(false)
  const [steps, setSteps] = React.useState<Step[] | null>(null)

  React.useEffect(() => {
    if (localStorage.getItem("gleba.premiers-pas.hidden") === "true") {
      setHidden(true)
      return
    }
    ;(async () => {
      try {
        const [expl, cultures, clients] = await Promise.all([
          fetch("/api/exploitation").then((r) => (r.ok ? r.json() : { data: null })),
          fetch("/api/cultures?limit=1").then((r) => (r.ok ? r.json() : { data: [] })),
          fetch("/api/comptabilite/clients?limit=1").then((r) => (r.ok ? r.json() : { data: [] })),
        ])
        const arr: Step[] = [
          { key: "exploit", label: "Renseigner l'identité de l'exploitation", done: !!expl?.data, href: "/parametres/exploitation" },
          { key: "culture", label: "Créer votre première culture", done: ((cultures?.data ?? cultures) || []).length > 0, href: "/maraichage/cultures/new" },
          { key: "client", label: "Ajouter un client", done: ((clients?.data ?? clients) || []).length > 0, href: "/comptabilite/clients" },
        ]
        // Si toutes les tâches sont done, on masque
        if (arr.every((a) => a.done)) {
          localStorage.setItem("gleba.premiers-pas.hidden", "true")
          setHidden(true)
        } else {
          setSteps(arr)
        }
      } catch {
        setSteps(null)
      }
    })()
  }, [])

  if (hidden || !steps) return null
  const remaining = steps.filter((s) => !s.done).length

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-emerald-50 border-blue-200">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-slate-900">Premiers pas — {remaining} tâche{remaining > 1 ? "s" : ""} à compléter</h3>
              <p className="text-sm text-slate-600 mt-0.5">Quelques actions rapides pour démarrer.</p>
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.setItem("gleba.premiers-pas.hidden", "true")
              setHidden(true)
            }}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Masquer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="mt-3 space-y-1">
          {steps.map((s) => (
            <li key={s.key}>
              <Link
                href={s.href}
                className={`flex items-center gap-2 text-sm py-1 px-2 rounded transition-colors ${
                  s.done ? "text-slate-500 line-through" : "text-slate-800 hover:bg-white/50"
                }`}
              >
                {s.done ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Circle className="h-4 w-4 text-slate-300" />
                )}
                <span className="flex-1">{s.label}</span>
                {!s.done && <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
