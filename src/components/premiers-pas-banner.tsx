"use client"

/**
 * Bandeau "Premiers pas" affichant les tâches contextuelles selon le module.
 *
 * - `module="home"` (défaut) : tâches générales (exploitation, culture, client)
 * - `module="maraichage"` : exploit + culture + planche
 * - `module="verger"` : exploit + arbre + plantation
 * - `module="elevage"` : exploit + animal + soin
 * - `module="comptabilite"` : exploit + client + facture
 *
 * Auto-masque si toutes les tâches sont accomplies ou bouton "Masquer".
 * POSTREVIEW Sprint 6 — clé localStorage différente par module ; early return
 * AVANT les fetchs pour éviter 3 requêtes inutiles quand masqué.
 */

import * as React from "react"
import Link from "next/link"
import { Sparkles, X, CheckCircle2, Circle, ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

type ModuleKey = "home" | "maraichage" | "verger" | "elevage" | "comptabilite"

interface Step {
  key: string
  label: string
  done: boolean
  href: string
}

interface ModuleConfig {
  /** Endpoints à interroger pour vérifier l'état */
  fetches: Array<{ key: string; url: string }>
  /** Steps construits depuis les fetchs (par index dans `fetches`) */
  buildSteps: (results: Record<string, any>) => Step[]
}

// Mêmes 3 tâches pour la home (compat existant). Les modules ont leurs
// tâches spécifiques pour onboarder l'utilisateur sur le module concerné.
const CONFIGS: Record<ModuleKey, ModuleConfig> = {
  home: {
    fetches: [
      { key: "expl", url: "/api/exploitation" },
      { key: "cult", url: "/api/cultures?limit=1" },
      { key: "cli", url: "/api/comptabilite/clients?limit=1" },
    ],
    buildSteps: (r) => [
      { key: "exploit", label: "Renseigner l'identité de l'exploitation", done: !!r.expl?.data, href: "/parametres/exploitation" },
      { key: "culture", label: "Créer votre première culture", done: ((r.cult?.data ?? r.cult) || []).length > 0, href: "/maraichage/cultures/new" },
      { key: "client", label: "Ajouter un client", done: ((r.cli?.data ?? r.cli) || []).length > 0, href: "/comptabilite/clients" },
    ],
  },
  maraichage: {
    fetches: [
      { key: "expl", url: "/api/exploitation" },
      { key: "cult", url: "/api/cultures?limit=1" },
      { key: "plan", url: "/api/planches?limit=1" },
    ],
    buildSteps: (r) => [
      { key: "exploit", label: "Renseigner l'identité de l'exploitation", done: !!r.expl?.data, href: "/parametres/exploitation" },
      { key: "planche", label: "Créer votre première planche", done: ((r.plan?.data ?? r.plan) || []).length > 0, href: "/maraichage/planches/new" },
      { key: "culture", label: "Planter votre première culture", done: ((r.cult?.data ?? r.cult) || []).length > 0, href: "/maraichage/cultures/new" },
    ],
  },
  verger: {
    fetches: [
      { key: "expl", url: "/api/exploitation" },
      { key: "arb", url: "/api/arbres?limit=1" },
      { key: "camp", url: "/api/arbres/campagnes?limit=1" },
    ],
    buildSteps: (r) => [
      { key: "exploit", label: "Renseigner l'identité de l'exploitation", done: !!r.expl?.data, href: "/parametres/exploitation" },
      { key: "arbre", label: "Ajouter votre premier arbre", done: ((r.arb?.data ?? r.arb) || []).length > 0, href: "/verger" },
      { key: "campagne", label: "Planifier une campagne de plantation", done: ((r.camp?.data ?? r.camp) || []).length > 0, href: "/verger" },
    ],
  },
  elevage: {
    fetches: [
      { key: "expl", url: "/api/exploitation" },
      { key: "anim", url: "/api/elevage/animaux?limit=1" },
      { key: "soin", url: "/api/elevage/soins?limit=1" },
    ],
    buildSteps: (r) => [
      { key: "exploit", label: "Renseigner l'identité de l'exploitation", done: !!r.expl?.data, href: "/parametres/exploitation" },
      { key: "animal", label: "Enregistrer votre premier animal", done: ((r.anim?.data ?? r.anim) || []).length > 0, href: "/elevage/animaux" },
      { key: "soin", label: "Saisir un soin (vaccination, vermifuge…)", done: ((r.soin?.data ?? r.soin) || []).length > 0, href: "/elevage" },
    ],
  },
  comptabilite: {
    fetches: [
      { key: "expl", url: "/api/exploitation" },
      { key: "cli", url: "/api/comptabilite/clients?limit=1" },
      { key: "fact", url: "/api/comptabilite/factures?year=" + new Date().getFullYear() + "&limit=1" },
    ],
    buildSteps: (r) => [
      { key: "exploit", label: "Renseigner l'identité de l'exploitation (SIRET, régime TVA)", done: !!r.expl?.data, href: "/parametres/exploitation" },
      { key: "client", label: "Ajouter votre premier client", done: ((r.cli?.data ?? r.cli) || []).length > 0, href: "/comptabilite/clients" },
      { key: "facture", label: "Émettre une première facture", done: ((r.fact?.data ?? r.fact) || []).length > 0, href: "/comptabilite/factures" },
    ],
  },
}

export function PremiersPasBanner({ module = "home" }: { module?: ModuleKey }) {
  const [hidden, setHidden] = React.useState(false)
  const [steps, setSteps] = React.useState<Step[] | null>(null)
  const hideKey = `gleba.premiers-pas.${module}.hidden`

  React.useEffect(() => {
    // POSTREVIEW Sprint 6 — early return AVANT les fetchs si déjà masqué
    if (localStorage.getItem(hideKey) === "true") {
      setHidden(true)
      return
    }
    const config = CONFIGS[module]
    ;(async () => {
      try {
        const results = await Promise.all(
          config.fetches.map((f) =>
            fetch(f.url).then((r) => (r.ok ? r.json() : null)).catch(() => null)
          )
        )
        const map: Record<string, any> = {}
        config.fetches.forEach((f, i) => (map[f.key] = results[i]))
        const arr = config.buildSteps(map)
        if (arr.every((a) => a.done)) {
          localStorage.setItem(hideKey, "true")
          setHidden(true)
        } else {
          setSteps(arr)
        }
      } catch {
        setSteps(null)
      }
    })()
  }, [module, hideKey])

  if (hidden || !steps) return null
  const remaining = steps.filter((s) => !s.done).length

  return (
    <Card data-tour="premiers-pas" className="bg-gradient-to-r from-blue-50 to-emerald-50 border-blue-200">
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
              localStorage.setItem(hideKey, "true")
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
