"use client"

import * as React from "react"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { SaisieRecolte } from "@/lib/accueil/types"

import { CLASSES_BOUTON, CLASSES_BOUTON_PRINCIPAL } from "./boutons"

/**
 * Saisie courte d'une récolte depuis la liste du jour : la quantité dans
 * l'unité de la culture, rien d'autre (date = aujourd'hui, planche connue).
 * Virgule décimale acceptée. Le détail (variété, lot, prix) reste dans le
 * registre des récoltes.
 */
export interface DialogueRecolteProps {
  saisie: SaisieRecolte | null
  enCours: boolean
  onFermer: () => void
  onConfirmer: (quantite: number) => void
  /** Rien à récolter : la culture est terminée sans récolte (perte, abandon). */
  onTerminer: () => void
}

export function DialogueRecolte({ saisie, enCours, onFermer, onConfirmer, onTerminer }: DialogueRecolteProps) {
  const [texte, setTexte] = React.useState("")
  const [erreur, setErreur] = React.useState<string | null>(null)
  const champ = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (saisie) {
      setTexte("")
      setErreur(null)
      window.setTimeout(() => champ.current?.focus(), 50)
    }
  }, [saisie])

  const valider = (e: React.FormEvent) => {
    e.preventDefault()
    const quantite = parseFloat(texte.replace(",", ".").trim())
    if (!Number.isFinite(quantite) || quantite <= 0) {
      setErreur("Indiquez une quantité supérieure à zéro.")
      return
    }
    onConfirmer(quantite)
  }

  return (
    <Dialog open={saisie !== null} onOpenChange={(ouvert) => !ouvert && !enCours && onFermer()}>
      <DialogContent className="max-w-sm border-lin bg-craie font-ui text-encre">
        {saisie && (
          <form onSubmit={valider} noValidate>
            <DialogHeader className="text-left">
              <DialogTitle className="font-display text-xl font-medium">
                Récolter {saisie.especeNom}
                {saisie.plancheNom ? ` · ${saisie.plancheNom}` : ""}
              </DialogTitle>
              <DialogDescription className="text-ardoise">
                La récolte est datée d&rsquo;aujourd&rsquo;hui et la culture passe en « récoltée ». Vous pourrez annuler juste après.
              </DialogDescription>
            </DialogHeader>
            <label htmlFor="accueil-recolte-quantite" className="mt-4 block text-sm font-medium">
              Quantité récoltée
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                id="accueil-recolte-quantite"
                ref={champ}
                name="quantite"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={texte}
                onChange={(e) => {
                  setTexte(e.target.value)
                  setErreur(null)
                }}
                aria-invalid={erreur ? true : undefined}
                aria-describedby={erreur ? "accueil-recolte-erreur" : undefined}
                className="min-h-11 w-32 rounded-lg border border-lin bg-craie px-3 text-lg tabular-nums text-encre focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sauge"
                placeholder="0"
              />
              <span className="text-sm text-ardoise">{saisie.unite}</span>
            </div>
            {erreur && (
              <p id="accueil-recolte-erreur" className="mt-1.5 text-sm text-garance">
                {erreur}
              </p>
            )}
            <DialogFooter className="mt-5 gap-2 sm:gap-2">
              <button type="button" onClick={onFermer} disabled={enCours} className={CLASSES_BOUTON}>
                Annuler
              </button>
              <button type="submit" disabled={enCours} className={CLASSES_BOUTON_PRINCIPAL}>
                {enCours ? "Enregistrement…" : "Noter la récolte"}
              </button>
            </DialogFooter>
            {/* Une perte ou un abandon ne passe pas par une quantité : la culture
                se termine, elle quitte la liste, et la sortie de stock éventuelle
                reste un mouvement de stock à part. */}
            <p className="mt-4 border-t border-lin pt-3 text-sm text-ardoise">
              Rien à récolter (perte, abandon) ?{" "}
              <button type="button" onClick={onTerminer} disabled={enCours} className="font-semibold text-sauge underline-offset-2 hover:underline disabled:opacity-50">
                Terminer la culture sans récolte
              </button>
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
