"use client"

import * as React from "react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
  Loader2,
  Database,
  Sparkles,
  Leaf,
  BookOpen,
  Sprout,
  MapPin,
  Package,
} from "lucide-react"

interface WelcomeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

/**
 * Mini-glossaire affiché dans le dialogue de bienvenue.
 * Sélection volontairement courte (4-5 termes) pour ne pas noyer le nouvel utilisateur.
 */
const QUICK_GLOSSARY: Array<{ term: string; def: string }> = [
  {
    term: "Planche",
    def: "Bande de culture rectangulaire (~80 cm × 10 m) qui est l'unité de base du potager.",
  },
  {
    term: "ITP",
    def: "Itinéraire Technique de Production — séquence type semis → plantation → récolte d'une espèce.",
  },
  {
    term: "Rotation",
    def: "Plan pluriannuel qui évite de cultiver la même famille deux années de suite au même endroit.",
  },
  {
    term: "Famille botanique",
    def: "Regroupement d'espèces (ex: Solanacées = tomates, aubergines, poivrons).",
  },
  {
    term: "Campagne de plantation",
    def: "Plantation en lot de plusieurs arbres ou plants sur une zone (verger, haie).",
  },
]

export function WelcomeDialog({ open, onOpenChange, onComplete }: WelcomeDialogProps) {
  const [loading, setLoading] = React.useState(false)
  const { toast } = useToast()

  const handleImportTestData = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/import-test-data", {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'import")
      }

      toast({
        title: "Import réussi !",
        description: `${data.stats.cultures} cultures, ${data.stats.planches} planches et ${data.stats.especes} especes importées.`,
      })

      onComplete()
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de l'import",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleStartEmpty = () => {
    localStorage.setItem("gleba-onboarding-complete", "true")
    onComplete()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-6 w-6 text-green-600" />
            Bienvenue sur Gleba !
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Votre assistant pour la gestion de votre exploitation maraîchère et arboricole.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Comment commencer en 3 etapes */}
          <section className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
            <h3 className="font-semibold text-emerald-900 flex items-center gap-2 mb-3">
              <Sprout className="h-4 w-4" />
              Comment commencer en 3 étapes
            </h3>
            <ol className="space-y-2 text-sm text-emerald-900/90">
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">
                  1
                </span>
                <span>
                  <strong>Créez une planche</strong> dans l&apos;onglet{" "}
                  <em>Terrain</em> — c&apos;est une bande de culture rectangulaire
                  (~80 cm × 10 m).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">
                  2
                </span>
                <span>
                  <strong>Ajoutez une culture</strong> dans l&apos;onglet{" "}
                  <em>Cultures</em> en choisissant une espece et la planche cible.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">
                  3
                </span>
                <span>
                  <strong>Suivez vos récoltes</strong> chaque semaine depuis l&apos;onglet{" "}
                  <em>Calendrier</em> en cochant les tâches au fur et à mesure.
                </span>
              </li>
            </ol>
          </section>

          {/* Glossaire rapide */}
          <section>
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-slate-600" />
              Glossaire rapide
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Quelques termes que vous croiserez souvent dans l&apos;application :
            </p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {QUICK_GLOSSARY.map((g) => (
                <div
                  key={g.term}
                  className="rounded-md border border-slate-200 bg-white p-2.5"
                >
                  <dt className="font-medium text-slate-900">{g.term}</dt>
                  <dd className="text-xs text-slate-600 mt-0.5 leading-relaxed">{g.def}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 text-right">
              <Link
                href="/parametres#glossaire"
                className="text-xs text-emerald-700 hover:text-emerald-900 hover:underline inline-flex items-center gap-1"
                onClick={() => onOpenChange(false)}
              >
                <BookOpen className="h-3 w-3" />
                Voir le glossaire complet
              </Link>
            </div>
          </section>

          {/* Choix : démo vs vierge */}
          <section className="space-y-3">
            <p className="text-sm font-medium text-slate-700">
              Pour démarrer, vous pouvez :
            </p>

            <div className="grid gap-3">
              {/* Option 1: Import test data */}
              <div className="border rounded-lg p-4 hover:border-green-500 hover:bg-green-50/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <Database className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">Importer les données de démonstration</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Un jardin complet avec 2 annees de données (2023-2024) :
                      planches, cultures, recoltes, rotations et arbres fruitiers.
                      Idéal pour découvrir toutes les fonctionnalités sans rien casser.
                    </p>
                    <Button
                      onClick={handleImportTestData}
                      disabled={loading}
                      className="mt-3 bg-green-600 hover:bg-green-700"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Import en cours...
                        </>
                      ) : (
                        <>
                          <Database className="mr-2 h-4 w-4" />
                          Importer les données de test
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Option 2: Start empty */}
              <div className="border rounded-lg p-4 hover:border-amber-500 hover:bg-amber-50/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <Leaf className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">Commencer avec un jardin vierge</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Créez vos propres planches, especes et cultures depuis zéro.
                      Vous pourrez toujours importer le referentiel d&apos;especes plus tard.
                    </p>
                    <Button
                      onClick={handleStartEmpty}
                      variant="outline"
                      className="mt-3"
                      disabled={loading}
                    >
                      <Leaf className="mr-2 h-4 w-4" />
                      Commencer vierge
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Repères visuels rapides */}
          <section className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
            <div className="rounded-md bg-slate-50 p-2">
              <MapPin className="h-4 w-4 mx-auto mb-1 text-slate-500" />
              Onglet <strong className="text-slate-700">Terrain</strong>
              <br />
              pour vos planches
            </div>
            <div className="rounded-md bg-slate-50 p-2">
              <Sprout className="h-4 w-4 mx-auto mb-1 text-slate-500" />
              Onglet <strong className="text-slate-700">Cultures</strong>
              <br />
              pour vos semis
            </div>
            <div className="rounded-md bg-slate-50 p-2">
              <Package className="h-4 w-4 mx-auto mb-1 text-slate-500" />
              Onglet <strong className="text-slate-700">Calendrier</strong>
              <br />
              pour les récoltes
            </div>
          </section>
        </div>

        <DialogFooter className="text-xs text-muted-foreground">
          Vous pourrez toujours retrouver ces options et le glossaire dans les paramètres.
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
