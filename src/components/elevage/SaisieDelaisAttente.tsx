"use client"

/**
 * Validation d'un soin depuis un bouton « Fait » : si le serveur refuse faute
 * de délais d'attente, ils sont demandés sur place puis la validation est
 * rejouée. Commun au tableau de bord, au calendrier, à la tournée et à
 * l'onglet Soins.
 */

import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { DelaiAttente } from "@/lib/elevage/delais-saisie-libre"
import {
  DELAI_ATTENTE_MAX_J, corpsDelaisSaisis, delaisManquantsDuRefus, libelleDelaiAttente,
} from "@/lib/elevage/delais-saisie-ecran"

type Demande = {
  manquants: DelaiAttente[]
  libelle?: string
  repondre: (delais: Record<string, number> | null) => void
}

export function useSaisieDelaisAttente() {
  const [demande, setDemande] = React.useState<Demande | null>(null)
  const [saisie, setSaisie] = React.useState<Partial<Record<DelaiAttente, string>>>({})
  // Une question à la fois : une validation groupée peut en poser plusieurs.
  const [file] = React.useState<{ current: Promise<unknown> }>(() => ({ current: Promise.resolve() }))

  const demander = React.useCallback((manquants: DelaiAttente[], libelle?: string) => {
    const question = file.current.then(
      () => new Promise<Record<string, number> | null>((repondre) => {
        setSaisie({})
        setDemande({ manquants, libelle, repondre })
      }),
    )
    file.current = question
    return question
  }, [file])

  /**
   * PATCH d'une validation de soin ou d'injection. Sur le refus « délais
   * d'attente requis », demande les délais et rejoue ; rend la dernière
   * réponse (le refus d'origine si la saisie est abandonnée).
   */
  const validerSoin = React.useCallback(
    async (url: string, corps: Record<string, unknown>, libelle?: string): Promise<Response> => {
      const envoyer = (delais: Record<string, number> = {}) =>
        fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...corps, ...delais }),
        })
      const reponse = await envoyer()
      if (reponse.status !== 422) return reponse
      const manquants = delaisManquantsDuRefus(reponse.status, await reponse.clone().json().catch(() => null))
      if (!manquants) return reponse
      const delais = await demander(manquants, libelle)
      return delais ? envoyer(delais) : reponse
    },
    [demander],
  )

  const fermer = (delais: Record<string, number> | null) => {
    demande?.repondre(delais)
    setDemande(null)
  }
  const corps = demande ? corpsDelaisSaisis(demande.manquants, saisie) : null

  const dialogue = (
    <Dialog open={demande !== null} onOpenChange={(ouvert) => !ouvert && fermer(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Délais d’attente du soin</DialogTitle>
          <DialogDescription>
            {demande?.libelle ? `${demande.libelle} : ` : ""}
            indiquez les délais prescrits par le vétérinaire, 0 s’il n’y en a pas. Le soin sera ensuite marqué fait.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (corps) fermer(corps)
          }}
        >
          {demande?.manquants.map((delai) => (
            <div key={delai}>
              <Label htmlFor={`delai-attente-${delai}`}>{libelleDelaiAttente(delai)}</Label>
              <Input
                id={`delai-attente-${delai}`}
                type="number"
                inputMode="numeric"
                min="0"
                max={DELAI_ATTENTE_MAX_J}
                step="1"
                required
                value={saisie[delai] ?? ""}
                onChange={(e) => setSaisie((prev) => ({ ...prev, [delai]: e.target.value }))}
              />
            </div>
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => fermer(null)}>
              Annuler
            </Button>
            <Button type="submit" disabled={!corps}>
              Enregistrer et marquer fait
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  return { validerSoin, dialogue }
}
