"use client"

/**
 * Dialog d'ajout d'une entrée perso au référentiel communautaire — même
 * expérience que le maraîchage (« Créer »), réutilisable pour toutes les entités
 * (espèces fruitières, porte-greffes, essences bocagères/forestières…).
 *
 * Config-driven : `champs` décrit les champs saisis, `extraBody` fixe les valeurs
 * imposées (ex. type='arbre_fruitier'), `apiBase` est la route POST. L'entrée est
 * créée en PERSO ; une case permet de la proposer directement à la communauté.
 */

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Plus, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export type ChampConfig = {
  key: string
  label: string
  type?: "text" | "select"
  options?: { value: string; label: string }[]
  required?: boolean
  placeholder?: string
  defaut?: string
}

export function AjoutReferentielDialog({
  titre,
  apiBase,
  champs,
  extraBody,
  onCreated,
  triggerLabel = "Ajouter",
}: {
  titre: string
  apiBase: string
  champs: ChampConfig[]
  extraBody?: Record<string, unknown>
  onCreated: () => void
  triggerLabel?: string
}) {
  const { toast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [proposer, setProposer] = React.useState(false)
  const [valeurs, setValeurs] = React.useState<Record<string, string>>({})

  const reset = () => {
    setValeurs({})
    setProposer(false)
  }

  const submit = async () => {
    for (const c of champs) {
      if (c.required && !(valeurs[c.key] ?? c.defaut ?? "").trim()) {
        toast({ variant: "destructive", title: "Champ requis", description: c.label })
        return
      }
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = { ...extraBody, partageCommunaute: proposer }
      for (const c of champs) body[c.key] = (valeurs[c.key] ?? c.defaut ?? "").trim()
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const p = await res.json().catch(() => null)
      if (res.ok) {
        toast({
          title: proposer ? "Ajouté et proposé à la communauté" : "Ajouté à votre catalogue",
        })
        setOpen(false)
        reset()
        onCreated()
      } else {
        toast({ variant: "destructive", title: "Erreur", description: p?.error || "Création impossible" })
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Erreur réseau" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{titre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {champs.map((c) => (
              <div key={c.key}>
                <Label className="text-sm">
                  {c.label}
                  {c.required && " *"}
                </Label>
                {c.type === "select" ? (
                  <select
                    className="mt-1 w-full h-10 rounded-md border border-slate-300 px-3 bg-white text-sm"
                    value={valeurs[c.key] ?? c.defaut ?? ""}
                    onChange={(e) => setValeurs((v) => ({ ...v, [c.key]: e.target.value }))}
                  >
                    {(c.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    className="mt-1"
                    value={valeurs[c.key] ?? ""}
                    placeholder={c.placeholder}
                    onChange={(e) => setValeurs((v) => ({ ...v, [c.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <Checkbox checked={proposer} onCheckedChange={(v) => setProposer(v === true)} />
              Proposer directement à la communauté Gleba
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setOpen(false); reset() }}>Annuler</Button>
              <Button onClick={submit} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Ajouter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
