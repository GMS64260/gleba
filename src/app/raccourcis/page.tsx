/**
 * Page d'aide raccourcis clavier (PROMPT 20c §6).
 * Accessible via la touche ? depuis n'importe quelle page, ou via lien direct.
 */

import Link from "next/link"
import { ArrowLeft, Keyboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = {
  title: "Raccourcis clavier — Gleba",
}

interface Shortcut {
  keys: string[]
  label: string
}

const NAVIGATION: Shortcut[] = [
  { keys: ["⌘", "K"], label: "Ouvrir la recherche globale" },
  { keys: ["g", "m"], label: "Aller au Maraîchage" },
  { keys: ["g", "v"], label: "Aller au Verger" },
  { keys: ["g", "e"], label: "Aller à l'Élevage" },
  { keys: ["g", "c"], label: "Aller à la Comptabilité" },
  { keys: ["?"], label: "Cette page" },
]

const ACTIONS: Shortcut[] = [
  { keys: ["n"], label: "Nouveau (contextuel à la page courante)" },
  { keys: ["Esc"], label: "Fermer un dialogue / la palette" },
  { keys: ["Entrée"], label: "Valider une cellule éditable" },
  { keys: ["Esc"], label: "Annuler une cellule éditable" },
  { keys: ["Espace"], label: "Cocher la tâche focalisée" },
]

const TIPS: Shortcut[] = [
  { keys: ["⌘", "K"], label: "Cherche dans : cultures, variétés, arbres, animaux, lots, clients, factures, parcelles, soins, récoltes, produits boutique" },
]

function KbdRow({ keys, label }: Shortcut) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-700">{label}</span>
      <span className="flex items-center gap-1">
        {keys.map((k, i) => (
          <span key={i} className="inline-flex items-center">
            {i > 0 && <span className="mx-1 text-xs text-slate-400">puis</span>}
            <kbd className="bg-slate-100 border border-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded font-mono">
              {k}
            </kbd>
          </span>
        ))}
      </span>
    </div>
  )
}

export default function RaccourcisPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Accueil
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Keyboard className="h-6 w-6 text-slate-600" />
            <h1 className="text-xl font-bold">Raccourcis clavier</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Navigation</CardTitle>
            <CardDescription>
              Utilisez la séquence{" "}
              <kbd className="bg-slate-100 px-1 rounded text-xs">g</kbd> puis{" "}
              <kbd className="bg-slate-100 px-1 rounded text-xs">m / v / e / c</kbd> pour basculer entre modules
              (1.2&nbsp;s entre les deux touches).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {NAVIGATION.map((s, i) => (
              <KbdRow key={i} {...s} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions courantes</CardTitle>
            <CardDescription>
              Sur les cellules éditables, le focus clavier active la saisie inline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ACTIONS.map((s, i) => (
              <KbdRow key={i} {...s} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recherche globale</CardTitle>
            <CardDescription>
              <kbd className="bg-slate-100 px-1 rounded text-xs">⌘ K</kbd> ouvre une palette de
              recherche. Tapez 2 caractères pour interroger l'ensemble du domaine.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {TIPS.map((s, i) => (
              <KbdRow key={i} {...s} />
            ))}
          </CardContent>
        </Card>

        <p className="text-xs text-slate-500 text-center">
          Les raccourcis ne sont pas actifs quand un champ de saisie est focalisé,
          sauf <kbd className="bg-slate-100 px-1 rounded">⌘ K</kbd> qui reste disponible.
        </p>
      </main>
    </div>
  )
}
