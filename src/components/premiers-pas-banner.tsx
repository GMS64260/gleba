"use client"

/**
 * Bandeau "Premiers pas" — tâches contextuelles par module.
 *
 * Comportements :
 *  - Compte démo (demo@gleba.fr) : bandeau **toujours visible**, jamais
 *    auto-masqué (le visiteur public voit la totalité des capacités du module).
 *  - Utilisateur normal : auto-masqué quand 100 % done, ou via bouton X.
 *
 * Chaque module liste 5 à 6 tâches métier représentatives.
 * Cliquer sur une tâche redirige vers le formulaire / écran concerné.
 */

import * as React from "react"
import Link from "next/link"
import { Sparkles, X, CheckCircle2, Circle, ChevronRight, PartyPopper } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useIsDemoAccount } from "@/hooks/use-is-demo"

type ModuleKey = "home" | "maraichage" | "verger" | "elevage" | "comptabilite"

interface Step {
  key: string
  label: string
  done: boolean
  href: string
  hint?: string
}

interface ModuleConfig {
  fetches: Array<{ key: string; url: string }>
  buildSteps: (results: Record<string, any>) => Step[]
}

// Helper : détecte si une réponse API a des données
const hasData = (r: any): boolean => {
  const arr = r?.data ?? r
  return Array.isArray(arr) ? arr.length > 0 : !!arr
}

const CONFIGS: Record<ModuleKey, ModuleConfig> = {
  home: {
    fetches: [
      { key: "expl", url: "/api/exploitation" },
      { key: "cult", url: "/api/cultures?limit=1" },
      { key: "cli", url: "/api/comptabilite/clients?limit=1" },
    ],
    buildSteps: (r) => [
      {
        key: "exploit",
        label: "Renseigner l'identité de l'exploitation",
        done: !!r.expl?.data,
        href: "/parametres/exploitation",
        hint: "SIRET, régime fiscal, mentions légales",
      },
      {
        key: "culture",
        label: "Créer votre première culture",
        done: hasData(r.cult),
        href: "/maraichage/cultures/new",
      },
      {
        key: "client",
        label: "Ajouter un client",
        done: hasData(r.cli),
        href: "/comptabilite/clients",
      },
    ],
  },

  maraichage: {
    fetches: [
      { key: "expl", url: "/api/exploitation" },
      { key: "plan", url: "/api/planches?limit=1" },
      { key: "rotation", url: "/api/rotations?limit=1" },
      { key: "cult", url: "/api/cultures?limit=1" },
      { key: "recolte", url: "/api/recoltes?limit=1" },
      { key: "stock", url: "/api/user/stocks/varietes?limit=1" },
    ],
    buildSteps: (r) => [
      {
        key: "exploit",
        label: "Renseigner l'identité de l'exploitation",
        done: !!r.expl?.data,
        href: "/parametres/exploitation",
        hint: "Nécessaire pour des factures conformes (art. 242 nonies A)",
      },
      {
        key: "planche",
        label: "Tracer votre première planche de culture",
        done: hasData(r.plan),
        href: "/maraichage/planches/new",
        hint: "Dimensions, type de sol, exposition",
      },
      {
        key: "rotation",
        label: "Définir une rotation de cultures",
        done: hasData(r.rotation),
        href: "/maraichage/rotations/new",
        hint: "Évite l'épuisement des sols et les maladies",
      },
      {
        key: "stock",
        label: "Saisir votre stock de semences / plants",
        done: hasData(r.stock),
        href: "/maraichage/stocks",
        hint: "Pour les alertes de réapprovisionnement",
      },
      {
        key: "culture",
        label: "Planter votre première culture",
        done: hasData(r.cult),
        href: "/maraichage/cultures/new",
        hint: "L'ITP pré-remplit semis/plantation/récolte automatiquement",
      },
      {
        key: "recolte",
        label: "Enregistrer une récolte",
        done: hasData(r.recolte),
        href: "/maraichage/recoltes/saisie",
        hint: "Rendement par planche / par variété",
      },
    ],
  },

  verger: {
    fetches: [
      { key: "expl", url: "/api/exploitation" },
      { key: "arb", url: "/api/arbres?limit=1" },
      { key: "camp", url: "/api/arbres/campagnes?limit=1" },
      { key: "obs", url: "/api/arbres/observations?limit=1" },
      { key: "op", url: "/api/arbres/operations?limit=1" },
      { key: "rec", url: "/api/arbres/recoltes?limit=1" },
    ],
    buildSteps: (r) => [
      {
        key: "exploit",
        label: "Renseigner l'identité de l'exploitation",
        done: !!r.expl?.data,
        href: "/parametres/exploitation",
      },
      {
        key: "arbre",
        label: "Ajouter votre premier arbre",
        done: hasData(r.arb),
        href: "/verger?tab=arbres",
        hint: "Espèce, variété, porte-greffe, GPS",
      },
      {
        key: "campagne",
        label: "Planifier une campagne de plantation",
        done: hasData(r.camp),
        href: "/verger?action=plantation",
        hint: "Cohorte avec suivi de reprise N+1 / N+2 / N+3",
      },
      {
        key: "obs",
        label: "Saisir une observation santé (BBCH, photo)",
        done: hasData(r.obs),
        href: "/verger?tab=sante",
        hint: "Suivi maladies, ravageurs, stade phénologique",
      },
      {
        key: "operation",
        label: "Enregistrer une opération (taille, traitement)",
        done: hasData(r.op),
        href: "/verger?tab=operations",
      },
      {
        key: "recolte_arbre",
        label: "Première récolte fruits / baies",
        done: hasData(r.rec),
        href: "/verger?tab=productions",
        hint: "Quantité, qualité, destination",
      },
    ],
  },

  elevage: {
    fetches: [
      { key: "expl", url: "/api/exploitation" },
      { key: "anim", url: "/api/elevage/animaux?limit=1" },
      { key: "lot", url: "/api/elevage/lots?limit=1" },
      { key: "soin", url: "/api/elevage/soins?limit=1" },
      { key: "prod_oeufs", url: "/api/elevage/production-oeufs?limit=1" },
      { key: "saillie", url: "/api/elevage/saillies?limit=1" },
    ],
    buildSteps: (r) => [
      {
        key: "exploit",
        label: "Renseigner l'identité de l'exploitation",
        done: !!r.expl?.data,
        href: "/parametres/exploitation",
      },
      {
        key: "animal",
        label: "Enregistrer votre premier animal",
        done: hasData(r.anim),
        href: "/elevage/animaux",
        hint: "Identifiant BDNI / IPG / SIRE validé automatiquement",
      },
      {
        key: "lot",
        label: "Créer un lot (volaille, troupeau…)",
        done: hasData(r.lot),
        href: "/elevage?tab=animaux",
        hint: "Pour grouper des animaux d'une même bande",
      },
      {
        key: "soin",
        label: "Saisir un soin (vaccination, vermifuge…)",
        done: hasData(r.soin),
        href: "/elevage?tab=alimentation",
        hint: "Temps d'attente lait / viande calculés automatiquement",
      },
      {
        key: "production",
        label: "Saisir une production (œufs, lait, viande)",
        done: hasData(r.prod_oeufs),
        href: "/elevage?tab=production",
        hint: "Suivi journalier ou hebdomadaire",
      },
      {
        key: "saillie",
        label: "Enregistrer une saillie / mise en lutte",
        done: hasData(r.saillie),
        href: "/elevage?tab=reproduction",
        hint: "Date de mise-bas attendue auto-calculée",
      },
    ],
  },

  comptabilite: {
    fetches: [
      { key: "expl", url: "/api/exploitation" },
      { key: "cli", url: "/api/comptabilite/clients?limit=1" },
      { key: "four", url: "/api/comptabilite/fournisseurs?limit=1" },
      {
        key: "fact",
        url: "/api/comptabilite/factures?year=" + new Date().getFullYear() + "&limit=1",
      },
      { key: "vente", url: "/api/comptabilite/ventes-manuelles?limit=1" },
      { key: "dep", url: "/api/comptabilite/depenses-manuelles?limit=1" },
    ],
    buildSteps: (r) => [
      {
        key: "exploit",
        label: "Renseigner l'identité légale (SIRET, régime TVA)",
        done: !!r.expl?.data,
        href: "/parametres/exploitation",
        hint: "Obligatoire pour les factures conformes",
      },
      {
        key: "client",
        label: "Ajouter votre premier client",
        done: hasData(r.cli),
        href: "/comptabilite/clients",
      },
      {
        key: "fournisseur",
        label: "Ajouter un fournisseur",
        done: hasData(r.four),
        href: "/comptabilite/fournisseurs",
        hint: "Pour la TVA déductible sur achats",
      },
      {
        // QA Camille 2026-05-15 — Bug #3 : la checklist se cochait dès
        // qu'une vente existait, même si aucun client n'était saisi.
        // Conséquence : "0 clients · 0 revenus" tout en affichant
        // l'étape barrée. On exige donc *vente + au moins un client*
        // (les ventes orphelines de la démo restent visibles, mais
        // l'étape ne se coche que quand l'utilisateur a réellement
        // structuré sa première vente avec un client).
        key: "vente",
        label: "Saisir une vente (marché, AMAP, particulier)",
        done: hasData(r.vente) && hasData(r.cli),
        href: "/comptabilite/ventes-manuelles",
      },
      {
        key: "depense",
        label: "Enregistrer une dépense (carburant, semences…)",
        done: hasData(r.dep),
        href: "/comptabilite/depenses-manuelles",
        hint: "Avec pièce justificative et TVA",
      },
      {
        key: "facture",
        label: "Émettre une première facture",
        done: hasData(r.fact),
        href: "/comptabilite/factures",
        hint: "Numérotation continue garantie",
      },
    ],
  },
}

export function PremiersPasBanner({ module = "home" }: { module?: ModuleKey }) {
  const [hidden, setHidden] = React.useState(false)
  const [steps, setSteps] = React.useState<Step[] | null>(null)
  const isDemo = useIsDemoAccount()
  const hideKey = `gleba.premiers-pas.${module}.hidden`

  React.useEffect(() => {
    // Compte démo : on ignore le flag de masquage (toujours visible)
    if (!isDemo && localStorage.getItem(hideKey) === "true") {
      setHidden(true)
      return
    }
    const config = CONFIGS[module]
    ;(async () => {
      try {
        const results = await Promise.all(
          config.fetches.map((f) =>
            fetch(f.url)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          )
        )
        const map: Record<string, any> = {}
        config.fetches.forEach((f, i) => (map[f.key] = results[i]))
        const arr = config.buildSteps(map)
        // Auto-masquage uniquement pour les non-démo
        if (!isDemo && arr.every((a) => a.done)) {
          localStorage.setItem(hideKey, "true")
          setHidden(true)
        } else {
          setSteps(arr)
        }
      } catch {
        setSteps(null)
      }
    })()
  }, [module, hideKey, isDemo])

  if (hidden || !steps) return null
  const remaining = steps.filter((s) => !s.done).length
  const allDone = remaining === 0

  return (
    <Card
      data-tour="premiers-pas"
      className={
        allDone
          ? "bg-gradient-to-r from-emerald-50 to-green-50 border-green-200"
          : "bg-gradient-to-r from-blue-50 to-emerald-50 border-blue-200"
      }
    >
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {allDone ? (
              <PartyPopper className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <Sparkles className="h-5 w-5 text-blue-600 flex-shrink-0" />
            )}
            <div>
              <h3 className="font-semibold text-slate-900">
                {allDone
                  ? "Premiers pas — bravo, tout est en place ✨"
                  : `Premiers pas — ${remaining} action${remaining > 1 ? "s" : ""} pour démarrer`}
              </h3>
              <p className="text-sm text-slate-600 mt-0.5">
                {allDone
                  ? "Vous maîtrisez les bases du module. Explorez les fonctionnalités avancées via le tour guidé."
                  : "Cliquez sur une ligne pour accéder directement au formulaire correspondant."}
              </p>
            </div>
          </div>
          {!isDemo && (
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
          )}
        </div>
        <ul className="mt-3 space-y-1">
          {steps.map((s) => (
            <li key={s.key}>
              <Link
                href={s.href}
                className={`flex items-start gap-2 text-sm py-1.5 px-2 rounded transition-colors ${
                  s.done ? "text-slate-500 line-through" : "text-slate-800 hover:bg-white/60"
                }`}
              >
                {s.done ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <Circle className="h-4 w-4 text-slate-300 flex-shrink-0 mt-0.5" />
                )}
                <span className="flex-1">
                  <span>{s.label}</span>
                  {s.hint && !s.done && (
                    <span className="block text-[11px] text-slate-500 mt-0.5">{s.hint}</span>
                  )}
                </span>
                {!s.done && <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
