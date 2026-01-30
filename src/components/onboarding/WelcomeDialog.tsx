"use client"

import * as React from "react"
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
import { Loader2, Database, Sparkles, Leaf } from "lucide-react"

interface WelcomeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

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
        description: `${data.stats.cultures} cultures, ${data.stats.planches} planches et ${data.stats.especes} espèces importées.`,
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
    // Marquer comme vu dans localStorage
    localStorage.setItem("gleba-onboarding-complete", "true")
    onComplete()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-6 w-6 text-green-600" />
            Bienvenue sur Gleba !
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Votre assistant pour la gestion de votre potager.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Pour commencer, vous pouvez :
          </p>

          <div className="grid gap-4">
            {/* Option 1: Import test data */}
            <div className="border rounded-lg p-4 hover:border-green-500 hover:bg-green-50/50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <Database className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">Importer les données de démonstration</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Un jardin complet avec 2 années de données (2023-2024) :
                    planches, cultures, récoltes, rotations et arbres fruitiers.
                    Idéal pour découvrir toutes les fonctionnalités.
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
                    Créez vos propres planches, espèces et cultures depuis zéro.
                    Vous pourrez toujours importer le référentiel d'espèces plus tard.
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
        </div>

        <DialogFooter className="text-xs text-muted-foreground">
          Vous pourrez toujours accéder à ces options dans les paramètres.
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
