"use client"

/**
 * Annuler un soin ADMINISTRÉ (effacer, remettre « à faire », rouvrir ou annuler
 * une injection réalisée) — constat C9 de la revue réglementaire du 2026-11-12.
 *
 * Le dialogue sépare les deux cas que le serveur applique
 * (`src/lib/elevage/annulation-soin.ts`) :
 *  - erreur de saisie : l'acte n'a jamais eu lieu, l'annulation est possible
 *    avec un motif ; l'original reste au journal des annulations ;
 *  - administration réelle : rien n'est annulé, le soin se corrige par
 *    « Modifier » (date, dose, produit).
 */

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface DemandeAnnulationSoin {
  nature: "erreur_saisie"
  motif: string
}

export interface RequeteAnnulationSoin {
  titre: string
  /** Ce que l'annulation fera (doses rendues, délais levés…). */
  consequence: string
  libelleConfirmer: string
  resolve: (demande: DemandeAnnulationSoin | null) => void
}

const MOTIF_MIN = 3

export function DialogueAnnulationSoin({ requete, onFermer }: {
  requete: RequeteAnnulationSoin | null
  onFermer: () => void
}) {
  const [nature, setNature] = React.useState<"erreur_saisie" | "administre" | null>(null)
  const [motif, setMotif] = React.useState("")
  const idBase = React.useId()

  React.useEffect(() => {
    setNature(null)
    setMotif("")
  }, [requete])

  if (!requete) return null

  const fermer = (demande: DemandeAnnulationSoin | null) => {
    requete.resolve(demande)
    onFermer()
  }
  const motifValide = motif.trim().length >= MOTIF_MIN
  const peutConfirmer = nature === "erreur_saisie" && motifValide

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) fermer(null) }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{requete.titre}</DialogTitle>
          <DialogDescription>
            Ce soin est enregistré comme administré. Le registre d’élevage doit garder chaque médicament
            réellement utilisé pendant cinq ans.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (peutConfirmer) fermer({ nature: "erreur_saisie", motif: motif.trim() })
          }}
        >
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Ce soin a-t-il réellement été administré ?</legend>
            <label className="flex items-start gap-2 rounded-md border p-3 text-sm has-[:checked]:border-primary">
              <input
                type="radio"
                name={`${idBase}-nature`}
                className="mt-0.5"
                checked={nature === "erreur_saisie"}
                onChange={() => setNature("erreur_saisie")}
              />
              <span>
                <span className="font-medium">Non, c’est une erreur de saisie</span>
                <span className="block text-muted-foreground">{requete.consequence}</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-md border p-3 text-sm has-[:checked]:border-primary">
              <input
                type="radio"
                name={`${idBase}-nature`}
                className="mt-0.5"
                checked={nature === "administre"}
                onChange={() => setNature("administre")}
              />
              <span>
                <span className="font-medium">Oui, le médicament a été donné</span>
                <span className="block text-muted-foreground">Le soin reste au registre.</span>
              </span>
            </label>
          </fieldset>

          {nature === "administre" && (
            <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              Un soin administré ne s’annule pas : ses doses ne reviennent pas en pharmacie et ses délais
              d’attente restent actifs. Si une information est fausse (date, dose, produit, animal), fermez
              cette fenêtre et utilisez « Modifier ».
            </p>
          )}

          {nature === "erreur_saisie" && (
            <div className="space-y-1">
              <label htmlFor={`${idBase}-motif`} className="text-sm font-medium">
                Motif de l’erreur <span className="text-muted-foreground">(obligatoire)</span>
              </label>
              <Textarea
                id={`${idBase}-motif`}
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Ex. : saisi sur le mauvais animal, soin en double…"
                aria-describedby={`${idBase}-motif-aide`}
              />
              <p id={`${idBase}-motif-aide`} className="text-xs text-muted-foreground">
                Le soin d’origine, la date, votre compte et ce motif sont conservés au journal des annulations,
                repris dans le registre d’élevage complet.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => fermer(null)}>
              Garder le soin
            </Button>
            <Button type="submit" variant="destructive" disabled={!peutConfirmer}>
              {requete.libelleConfirmer}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
