"use client"

/**
 * PROMPT DEV 2 Bug #11 — Modale "Compléter toutes les planches".
 *
 * Marc 2026-05-14 : 12/12 planches sans Sol, Rétention, Type, Îlot, Rotation.
 * Sans ces données, les modules Rotations, Irrigation, ITPs sol-spécifique
 * affichent du vide silencieux. Cette modale permet de tout compléter d'un
 * coup avec des défauts intelligents.
 */

import * as React from "react"
import { Wand2, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

type Planche = {
  id: string
  nom: string
  ilot: string | null
  type: string | null
  typeSol: string | null
  retentionEau: string | null
  rotationId: string | null
}

type Rotation = { id: string; active: boolean }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  planches: Planche[]
  rotations: Rotation[]
  onComplete: () => void
}

// Valeurs proposées (cohérentes avec /maraichage/planches/page.tsx).
const TYPES = ["Plein champ", "Serre", "Tunnel", "Châssis"]
const SOLS = ["Limoneux", "Argileux", "Sableux", "Mixte"]
const RETENTIONS = ["Faible", "Moyenne", "Élevée"]

// Défauts intelligents pour pré-remplir les vides en un clic.
const DEFAULTS = {
  type: "Plein champ",
  typeSol: "Limoneux",
  retentionEau: "Moyenne",
}

type Row = {
  id: string
  nom: string
  type: string | null
  typeSol: string | null
  retentionEau: string | null
  ilot: string | null
  rotationId: string | null
}

export function CompleterTerrainDialog({
  open,
  onOpenChange,
  planches,
  rotations,
  onComplete,
}: Props) {
  const { toast } = useToast()
  const [rows, setRows] = React.useState<Row[]>([])
  const [isSaving, setIsSaving] = React.useState(false)

  // Re-synchroniser quand on ouvre la modale.
  React.useEffect(() => {
    if (!open) return
    setRows(
      planches.map((p) => ({
        id: p.id,
        nom: p.nom,
        type: p.type,
        typeSol: p.typeSol,
        retentionEau: p.retentionEau,
        ilot: p.ilot,
        rotationId: p.rotationId,
      }))
    )
  }, [open, planches])

  const rotationsActives = rotations.filter((r) => r.active)

  const applyDefaultsToAll = () => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        type: r.type ?? DEFAULTS.type,
        typeSol: r.typeSol ?? DEFAULTS.typeSol,
        retentionEau: r.retentionEau ?? DEFAULTS.retentionEau,
      }))
    )
    toast({
      title: "Défauts appliqués",
      description: "Les cellules vides ont été pré-remplies. Ajustez par planche puis enregistrez.",
    })
  }

  const updateCell = (rowId: string, field: keyof Row, value: string | null) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, [field]: value || null } : r)))
  }

  const handleSave = async () => {
    setIsSaving(true)
    // On envoie uniquement les diff (réduit la charge + traçabilité).
    const updates = rows
      .map((r) => {
        const original = planches.find((p) => p.id === r.id)
        if (!original) return null
        const diff: Record<string, unknown> = { id: r.id }
        let hasDiff = false
        if (r.type !== original.type) {
          diff.type = r.type
          hasDiff = true
        }
        if (r.typeSol !== original.typeSol) {
          diff.typeSol = r.typeSol
          hasDiff = true
        }
        if (r.retentionEau !== original.retentionEau) {
          diff.retentionEau = r.retentionEau
          hasDiff = true
        }
        if (r.ilot !== original.ilot) {
          diff.ilot = r.ilot
          hasDiff = true
        }
        if (r.rotationId !== original.rotationId) {
          diff.rotationId = r.rotationId
          hasDiff = true
        }
        return hasDiff ? diff : null
      })
      .filter((u): u is Record<string, unknown> => u !== null)

    if (updates.length === 0) {
      toast({ title: "Rien à enregistrer", description: "Aucune modification détectée." })
      setIsSaving(false)
      return
    }

    try {
      const res = await fetch("/api/planches/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Échec de l'enregistrement")
      }
      const data = await res.json()
      toast({
        title: `${data.updated} planche(s) mise(s) à jour`,
        description: data.refused > 0 ? `${data.refused} refusée(s)` : undefined,
      })
      onComplete()
      onOpenChange(false)
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: err instanceof Error ? err.message : "Erreur inconnue",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Compléter le terrain en masse</DialogTitle>
          <DialogDescription>
            Renseignez Type / Sol / Rétention / Îlot / Rotation pour toutes vos planches en une seule fois.
            Les valeurs par défaut sont des points de départ raisonnables : ajustez par planche si besoin.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 py-2">
          <Button type="button" variant="outline" size="sm" onClick={applyDefaultsToAll}>
            <Wand2 className="h-4 w-4 mr-2" />
            Appliquer les défauts aux cellules vides
          </Button>
          <span className="text-xs text-muted-foreground">
            Défauts : Type=« Plein champ » · Sol=« Limoneux » · Rétention=« Moyenne »
          </span>
        </div>

        <div className="flex-1 overflow-auto border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left">
                <th className="px-2 py-2 font-medium">Planche</th>
                <th className="px-2 py-2 font-medium">Type</th>
                <th className="px-2 py-2 font-medium">Sol</th>
                <th className="px-2 py-2 font-medium">Rétention</th>
                <th className="px-2 py-2 font-medium">Îlot</th>
                <th className="px-2 py-2 font-medium">Rotation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t hover:bg-slate-50">
                  <td className="px-2 py-1.5 font-medium">{row.nom}</td>
                  <td className="px-2 py-1.5">
                    <select
                      className="w-full text-xs border rounded px-1 py-0.5 bg-white"
                      value={row.type ?? ""}
                      onChange={(e) => updateCell(row.id, "type", e.target.value)}
                    >
                      <option value="">—</option>
                      {TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      className="w-full text-xs border rounded px-1 py-0.5 bg-white"
                      value={row.typeSol ?? ""}
                      onChange={(e) => updateCell(row.id, "typeSol", e.target.value)}
                    >
                      <option value="">—</option>
                      {SOLS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      className="w-full text-xs border rounded px-1 py-0.5 bg-white"
                      value={row.retentionEau ?? ""}
                      onChange={(e) => updateCell(row.id, "retentionEau", e.target.value)}
                    >
                      <option value="">—</option>
                      {RETENTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      placeholder="Ex: A, B…"
                      className="w-full text-xs border rounded px-1 py-0.5 bg-white"
                      value={row.ilot ?? ""}
                      onChange={(e) => updateCell(row.id, "ilot", e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      className="w-full text-xs border rounded px-1 py-0.5 bg-white"
                      value={row.rotationId ?? ""}
                      onChange={(e) => updateCell(row.id, "rotationId", e.target.value)}
                    >
                      <option value="">—</option>
                      {rotationsActives.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.id}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Enregistrement…" : `Enregistrer (${rows.length} planches)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
