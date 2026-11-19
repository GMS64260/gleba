import { Button } from "@/components/ui/button"
import { PAS_AFFICHAGE_LISTE } from "@/hooks/use-affichage-progressif"

/** Pied d'une liste affichée par tranches ; rien quand tout est visible. */
export function AfficherPlus({ total, reste, afficherPlus, afficherTout, nom = "lignes" }: {
  total: number
  reste: number
  afficherPlus: () => void
  afficherTout: () => void
  /** Nom pluriel des lignes : « revenus », « interventions »… */
  nom?: string
}) {
  if (reste <= 0) return null
  const suivantes = Math.min(reste, PAS_AFFICHAGE_LISTE)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm">
      <p className="text-muted-foreground" aria-live="polite">
        {total - reste} {nom} sur {total}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11 sm:min-h-9" onClick={afficherPlus}>
          Afficher {suivantes} de plus
        </Button>
        {reste > suivantes && (
          <Button type="button" variant="ghost" className="min-h-11 sm:min-h-9" onClick={afficherTout}>
            Tout afficher
          </Button>
        )}
      </div>
    </div>
  )
}
