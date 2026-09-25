"use client"

/**
 * Composer un lot en une fois : cocher les animaux présents qui en font partie.
 *
 * Signalement 2026-09-25 : rattacher 11 chèvres à un lot demandait d'ouvrir 11
 * fiches. La liste propose les animaux actifs de la même espèce ; cocher un
 * animal d'un autre lot l'y déplace, décocher un membre le retire du lot.
 */

import * as React from "react"
import { Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { especeBaseId } from "@/lib/elevage/espece-base"

interface AnimalChoix {
  id: number
  nom: string | null
  identifiant: string | null
  sexe: string | null
  especeAnimale: { id: string }
  lot: { id: number; nom: string | null } | null
}

export interface LotAComposer {
  id: number
  nom: string | null
  especeAnimaleId: string
}

const libelle = (a: AnimalChoix) => a.nom || a.identifiant || `Animal #${a.id}`

export function ComposerLotDialog({
  lot,
  open,
  onOpenChange,
  onComposed,
}: {
  lot: LotAComposer | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onComposed: () => void
}) {
  const { toast } = useToast()
  const [animaux, setAnimaux] = React.useState<AnimalChoix[]>([])
  const [coches, setCoches] = React.useState<Set<number>>(new Set())
  const [recherche, setRecherche] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open || !lot) return
    let annule = false
    setIsLoading(true)
    setRecherche("")
    fetch("/api/elevage/animaux?statut=actif")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("chargement"))))
      .then((payload: { data: AnimalChoix[] }) => {
        if (annule) return
        const base = especeBaseId(lot.especeAnimaleId)
        const eligibles = payload.data
          .filter((a) => especeBaseId(a.especeAnimale.id) === base)
          .sort((a, b) => libelle(a).localeCompare(libelle(b), "fr"))
        setAnimaux(eligibles)
        setCoches(new Set(eligibles.filter((a) => a.lot?.id === lot.id).map((a) => a.id)))
      })
      .catch(() => {
        if (!annule) toast({ variant: "destructive", title: "Impossible de charger les animaux" })
      })
      .finally(() => {
        if (!annule) setIsLoading(false)
      })
    return () => {
      annule = true
    }
  }, [open, lot, toast])

  const membresInitiaux = React.useMemo(
    () => new Set(animaux.filter((a) => a.lot?.id === lot?.id).map((a) => a.id)),
    [animaux, lot],
  )
  const ajouter = animaux.filter((a) => coches.has(a.id) && !membresInitiaux.has(a.id)).map((a) => a.id)
  const retirer = animaux.filter((a) => !coches.has(a.id) && membresInitiaux.has(a.id)).map((a) => a.id)

  const filtre = recherche.trim().toLowerCase()
  const visibles = filtre
    ? animaux.filter((a) => `${a.nom ?? ""} ${a.identifiant ?? ""}`.toLowerCase().includes(filtre))
    : animaux

  const basculer = (id: number, coche: boolean) => {
    setCoches((courant) => {
      const suivant = new Set(courant)
      if (coche) suivant.add(id)
      else suivant.delete(id)
      return suivant
    })
  }
  const cocherVisibles = (coche: boolean) => {
    setCoches((courant) => {
      const suivant = new Set(courant)
      for (const a of visibles) {
        if (coche) suivant.add(a.id)
        else suivant.delete(a.id)
      }
      return suivant
    })
  }

  const enregistrer = async () => {
    if (!lot || isSaving || ajouter.length + retirer.length === 0) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/elevage/lots/${lot.id}/animaux`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ajouter, retirer }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Lot inchangé",
          description: payload?.error || "Impossible d’enregistrer la composition du lot",
        })
        return
      }
      const { ajoutes = 0, retires = 0 } = payload?.data ?? {}
      toast({
        title: "Lot mis à jour",
        description: [
          ajoutes ? `${ajoutes} animal(aux) ajouté(s)` : null,
          retires ? `${retires} retiré(s)` : null,
        ].filter(Boolean).join(", "),
      })
      onOpenChange(false)
      onComposed()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Animaux du lot {lot?.nom || (lot ? `#${lot.id}` : "")}</DialogTitle>
          <DialogDescription>
            Cochez les animaux présents qui font partie du lot. Un animal d’un autre lot y est déplacé ;
            décocher un membre le retire du lot.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom ou identifiant"
            className="pl-8"
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{coches.size} coché(s) sur {animaux.length}</span>
          <span className="flex gap-2">
            <button type="button" className="underline" onClick={() => cocherVisibles(true)}>Tout cocher</button>
            <button type="button" className="underline" onClick={() => cocherVisibles(false)}>Tout décocher</button>
          </span>
        </div>

        <div className="min-h-32 flex-1 overflow-y-auto rounded-md border">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Chargement…
            </div>
          ) : visibles.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {animaux.length === 0 ? "Aucun animal présent de cette espèce." : "Aucun animal ne correspond."}
            </p>
          ) : (
            <ul className="divide-y">
              {visibles.map((a) => (
                <li key={a.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                    <Checkbox checked={coches.has(a.id)} onCheckedChange={(v) => basculer(a.id, v === true)} />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{libelle(a)}</span>
                      {a.nom && a.identifiant && (
                        <span className="ml-2 text-xs text-muted-foreground">{a.identifiant}</span>
                      )}
                    </span>
                    {a.lot && a.lot.id !== lot?.id && (
                      <span className="text-xs text-amber-700">dans « {a.lot.nom || `lot #${a.lot.id}`} »</span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2 sm:items-center">
          <span className="mr-auto text-sm text-muted-foreground">
            {ajouter.length + retirer.length === 0
              ? "Aucun changement"
              : [
                  ajouter.length ? `+${ajouter.length} à ajouter` : null,
                  retirer.length ? `−${retirer.length} à retirer` : null,
                ].filter(Boolean).join(" · ")}
          </span>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="button" onClick={() => void enregistrer()} disabled={isSaving || ajouter.length + retirer.length === 0}>
            {isSaving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
