"use client"

/**
 * Création d'une espèce perso, avec type et famille botanique.
 *
 * Friction constatée le 2026-07-30 : la création depuis le sélecteur envoyait
 * `type: "legume"` en dur et aucune famille. Le premier compte à emprunter ce
 * chemin s'est retrouvé avec sa verveine, ses deux menthes, sa fraise et sa
 * consoude classées en légumes, et treize cultures sans famille botanique —
 * donc sans donnée d'entrée pour les contrôles de rotation et d'association.
 *
 * Le type est pré-sélectionné depuis le contexte appelant (onglet actif du
 * sélecteur), et la famille reste facultative mais explicitement demandée.
 */

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ESPECE_TYPES, ESPECE_TYPE_LABELS } from "@/lib/validations/espece"

export type NouvelleEspecePerso = {
  nom: string
  type: (typeof ESPECE_TYPES)[number]
  familleId: string | null
  vivace: boolean
}

type Famille = { id: string; nomFr?: string | null }

/** Valeur du Select pour « je ne sais pas » (SelectItem interdit la chaîne vide). */
const SANS_FAMILLE = "__aucune__"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Nom pré-rempli, issu de la recherche qui n'a rien donné. */
  nomInitial: string
  /** Type pré-sélectionné d'après le contexte (onglet actif, module appelant). */
  typeInitial?: (typeof ESPECE_TYPES)[number]
  /** Types proposés. Par défaut, tous. */
  typesProposes?: readonly (typeof ESPECE_TYPES)[number][]
  onConfirm: (espece: NouvelleEspecePerso) => Promise<void> | void
}

export function NouvelleEspecePersoDialog({
  open,
  onOpenChange,
  nomInitial,
  typeInitial = "legume",
  typesProposes = ESPECE_TYPES,
  onConfirm,
}: Props) {
  const [nom, setNom] = React.useState(nomInitial)
  const [type, setType] = React.useState<(typeof ESPECE_TYPES)[number]>(typeInitial)
  const [familleId, setFamilleId] = React.useState<string>(SANS_FAMILLE)
  const [familles, setFamilles] = React.useState<Famille[]>([])
  const [saving, setSaving] = React.useState(false)

  // Réinitialiser à chaque ouverture : le dialogue est monté une seule fois.
  React.useEffect(() => {
    if (!open) return
    setNom(nomInitial)
    setType(typeInitial)
    setFamilleId(SANS_FAMILLE)
  }, [open, nomInitial, typeInitial])

  React.useEffect(() => {
    if (!open || familles.length > 0) return
    fetch("/api/familles")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setFamilles(Array.isArray(d) ? d : []))
      .catch(() => setFamilles([]))
  }, [open, familles.length])

  const handleConfirm = async () => {
    const nomPropre = nom.trim()
    if (!nomPropre) return
    setSaving(true)
    try {
      await onConfirm({
        nom: nomPropre,
        type,
        familleId: familleId === SANS_FAMILLE ? null : familleId,
        // Les pérennes ne repassent pas dans le plan de rotation annuel.
        vivace: type === "arbre_fruitier" || type === "petit_fruit",
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle espèce perso</DialogTitle>
          <DialogDescription>
            Elle rejoint votre catalogue personnel, sans toucher au référentiel Gleba.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="espece-perso-nom" className="text-sm">Nom *</Label>
            <Input
              id="espece-perso-nom"
              className="mt-1"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex. Fenugrec"
            />
          </div>

          <div>
            <Label className="text-sm">Type *</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typesProposes.map((t) => (
                  <SelectItem key={t} value={t}>{ESPECE_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm">Famille botanique</Label>
            <Select value={familleId} onValueChange={setFamilleId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Je ne sais pas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SANS_FAMILLE}>Je ne sais pas</SelectItem>
                {familles.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nomFr ? `${f.nomFr} — ${f.id}` : f.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Sans famille, les contrôles de rotation et d&apos;association ignoreront cette espèce.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={saving || !nom.trim()}>
            {saving ? "Création…" : "Créer l'espèce"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
