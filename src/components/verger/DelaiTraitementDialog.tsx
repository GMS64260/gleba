"use client"

/**
 * Saisie ou correction du délai avant récolte d'un traitement d'arbre, depuis
 * la ligne du traitement et là où il est coché « fait ». Sans cet écran, le
 * délai ne se saisissait qu'à la création : un traitement généré par le
 * calendrier bloquait la vente sans qu'on puisse le renseigner.
 */

import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SelectNatif } from "@/components/ui/select-natif"
import { useToast } from "@/hooks/use-toast"
import { LIBELLES_NATURE_PRODUIT, NATURES_PRODUIT_DECLAREES } from "@/lib/phyto/delai-avant-recolte"
import { corpsDelaiTraitement, type OperationDelai } from "@/lib/verger/delai-traitement"

interface Props {
  /** Traitement à compléter ; `null` ferme la fenêtre. */
  operation: OperationDelai | null
  onClose: () => void
  onSaved?: (maj: { id: number; dar: number | null; natureProduit: string | null }) => void
}

export function DelaiTraitementDialog({ operation, onClose, onSaved }: Props) {
  const { toast } = useToast()
  const [dar, setDar] = React.useState("")
  const [natureProduit, setNatureProduit] = React.useState("")
  const [envoi, setEnvoi] = React.useState(false)
  const [erreur, setErreur] = React.useState<string | null>(null)

  React.useEffect(() => {
    setDar(operation?.dar != null ? String(operation.dar) : "")
    setNatureProduit(operation?.natureProduit ?? "")
    setErreur(null)
  }, [operation])

  const enregistrer = async () => {
    if (!operation) return
    setEnvoi(true)
    setErreur(null)
    try {
      const corps = corpsDelaiTraitement({ dar, natureProduit })
      const res = await fetch(`/api/arbres/operations/${operation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        setErreur(detail?.error || "Enregistrement refusé")
        return
      }
      onSaved?.({ id: operation.id, ...corps })
      toast({ title: "Délai enregistré" })
      onClose()
    } catch {
      setErreur("Enregistrement impossible, réessayez.")
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <Dialog open={operation !== null} onOpenChange={(ouvert) => !ouvert && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Délai avant récolte</DialogTitle>
          <DialogDescription>
            {operation?.produit ? `${operation.produit} : ` : ""}
            lisez le délai sur l’étiquette. Sans délai, les fruits récoltés dans les 3 jours ne peuvent pas être mis en vente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="delai-traitement-nature">Nature du produit</Label>
            <SelectNatif id="delai-traitement-nature" value={natureProduit} onChange={(e) => setNatureProduit(e.target.value)}>
              <option value="">Non précisée</option>
              {NATURES_PRODUIT_DECLAREES.map((nature) => (
                <option key={nature} value={nature}>
                  {LIBELLES_NATURE_PRODUIT[nature]}
                </option>
              ))}
            </SelectNatif>
          </div>
          <div>
            <Label htmlFor="delai-traitement-dar">Délai (jours)</Label>
            <Input
              id="delai-traitement-dar"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={dar}
              onChange={(e) => setDar(e.target.value)}
              placeholder="0 s’il n’y en a pas"
            />
          </div>
        </div>
        {erreur && <p role="alert" className="text-sm text-destructive">{erreur}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={envoi}>
            Plus tard
          </Button>
          <Button type="button" onClick={enregistrer} disabled={envoi}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
