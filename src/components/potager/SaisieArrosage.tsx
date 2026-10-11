"use client"

/**
 * Noter l'arrosage d'une planche « à arroser aujourd'hui » depuis la page
 * Tâches et l'onglet Calendrier, avec la quantité versée (ticket QA
 * cmv3japsf, étendu à ces deux écrans le 2026-10-11) : même préremplissage
 * et mêmes mots que le conseiller d'irrigation (`quantite-versee.ts`).
 * Contenu d'une boîte de dialogue ; l'écran garde la main sur l'envoi.
 */
import * as React from "react"
import { Droplets, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { ArrosageDuJour } from "@/lib/irrigation/a-arroser"
import { aideQuantite, lireLitres, litresConseilles } from "@/lib/irrigation/quantite-versee"

export function SaisieArrosage({
  arrosage,
  libelle,
  enCours,
  onNoter,
  onRetour,
}: {
  arrosage: ArrosageDuJour
  libelle: string
  enCours: boolean
  /** `litres` null : « Quantité inconnue », l'arrosage compte comme complet. */
  onNoter: (litres: number | null, notes: string | null) => void
  onRetour: () => void
}) {
  const conseil = litresConseilles(arrosage.litresParM2, arrosage.surfaceM2)
  const [litres, setLitres] = React.useState(conseil !== null ? String(conseil) : "")
  const [notes, setNotes] = React.useState("")
  const quantite = lireLitres(litres)
  const observation = notes.trim() || null

  return (
    <>
      <DialogHeader>
        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-100">
          <Droplets className="h-5 w-5 text-cyan-600" />
        </div>
        <DialogTitle>Noter l’arrosage</DialogTitle>
        <DialogDescription>{libelle}</DialogDescription>
      </DialogHeader>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (quantite > 0 && !enCours) onNoter(quantite, observation)
        }}
      >
        <div className="space-y-3 rounded-xl border border-cyan-200 bg-cyan-50/60 p-4">
          <div className="space-y-2">
            <Label htmlFor="arrosage-litres">
              {arrosage.plancheNom ? `Quantité versée sur ${arrosage.plancheNom}` : "Quantité versée"}
            </Label>
            <div className="relative">
              <Input
                id="arrosage-litres"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                value={litres}
                onChange={(e) => setLitres(e.target.value)}
                className="h-11 bg-white pr-10 text-base"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-muted-foreground">
                L
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {aideQuantite(arrosage.litresParM2, arrosage.surfaceM2)}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="arrosage-notes">Observation facultative</Label>
            <Textarea
              id="arrosage-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Sol sec, pluie récente…"
              className="min-h-20 resize-none bg-white"
            />
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onRetour} disabled={enCours}>
            Retour
          </Button>
          <Button type="button" variant="outline" onClick={() => onNoter(null, observation)} disabled={enCours}>
            Quantité inconnue
          </Button>
          <Button type="submit" disabled={enCours || !(quantite > 0)}>
            {enCours && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </form>
    </>
  )
}
