"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { ParcelleFormMap } from "@/components/parcelles/ParcelleFormMap"
import { COUCHES_ACTIVITE, createParcelleSchema } from "@/lib/validations/parcelle"
import { COUCHE_LABELS, type ParcelleWithRelations } from "@/components/parcelles/parcelle-constants"

interface ParcelleFormDialogProps {
  open: boolean
  parcelle: ParcelleWithRelations | null
  onClose: (saved?: boolean) => void
}

export function ParcelleFormDialog({ open, parcelle, onClose }: ParcelleFormDialogProps) {
  const { toast } = useToast()
  const [nom, setNom] = useState("")
  const [couches, setCouches] = useState<string[]>([])
  const [geometry, setGeometry] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isEdit = !!parcelle

  // Pre-remplir le formulaire en mode edition
  useEffect(() => {
    if (parcelle) {
      setNom(parcelle.nom)
      setCouches(parcelle.couches || [])
      setGeometry(parcelle.geometry || null)
    } else {
      setNom("")
      setCouches([])
      setGeometry(null)
    }
  }, [parcelle, open])

  const toggleCouche = (couche: string) => {
    setCouches((prev) =>
      prev.includes(couche)
        ? prev.filter((c) => c !== couche)
        : [...prev, couche]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const formData = { nom: nom.trim(), geometry: geometry || "", couches }
    const validation = createParcelleSchema.safeParse(formData)
    if (!validation.success) {
      const msg = validation.error.issues[0]?.message || "Donnees invalides"
      toast({ variant: "destructive", title: "Erreur de validation", description: msg })
      return
    }

    setSubmitting(true)
    try {
      const body = formData
      const url = isEdit ? `/api/parcelles/${parcelle!.id}` : "/api/parcelles"
      const method = isEdit ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Erreur serveur")
      }

      toast({
        title: isEdit ? "Parcelle modifiée" : "Parcelle créée",
        description: `"${nom.trim()}" a ete ${isEdit ? "modifiee" : "creee"}`,
      })
      onClose(true)
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: err instanceof Error ? err.message : "Erreur lors de la sauvegarde",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Modifier "${parcelle!.nom}"` : "Nouvelle parcelle"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nom">Nom de la parcelle</Label>
            <Input
              id="nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex: Parcelle Nord, Verger Est..."
              maxLength={100}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Couches d'activite</Label>
            <div className="flex flex-wrap gap-3">
              {COUCHES_ACTIVITE.map((couche) => (
                <label key={couche} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={couches.includes(couche)}
                    onCheckedChange={() => toggleCouche(couche)}
                  />
                  <span className="text-sm">{COUCHE_LABELS[couche] || couche}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contour de la parcelle</Label>
            <ParcelleFormMap
              geometry={geometry}
              onGeometryChange={setGeometry}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onClose()} disabled={submitting}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting || !nom.trim() || !geometry}>
              {submitting ? "Enregistrement..." : isEdit ? "Modifier" : "Créer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
