"use client"

/**
 * Modale d'avis communautaires générique (tous référentiels : variété, porte-greffe,
 * espèce, race). Critères et libellés viennent de la config par `refType`.
 * Stats agrégées + badge « confirmé terrain » + dispersion « Selon le terroir »
 * + liste des avis + formulaire à saisie progressive (reprise → notes ★ → commentaire).
 */

import * as React from "react"
import { Sprout, CheckCircle2, Trash2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"
import { StarRating } from "@/components/avis/StarRating"
import { type AvisRefType } from "@/lib/avis/types"
import { avisConfig } from "@/lib/avis/criteres"
import { ZONE_CLIMAT_LABEL, type ZoneClimat } from "@/lib/terroir"

interface GroupeTerroir {
  typeSol: string | null
  zoneClimat: string | null
  nbAvis: number
  noteMoyenne: number | null
  fiable: boolean
}

interface AvisPublic {
  id: string
  auteur: string
  isMine: boolean
  reprend: boolean | null
  notes: Record<string, number | null>
  commentaire: string | null
  contexteTypeSol: string | null
  contexteZoneClimat: string | null
}

interface AvisData {
  avis: AvisPublic[]
  monAvis: AvisPublic | null
  stats: {
    nbAvis: number
    tauxReprise: number | null
    noteMoyenne: number | null
    scoreCommunautaire: number
    moyennesParCritere: Record<string, number | null>
  }
  dispersionTerroir: GroupeTerroir[]
  reel: { nbProductif: number; nbExploitations: number; quantiteTotale: number }
  badgeTerrain: boolean
}

interface FormState {
  reprend: boolean | null
  notes: Record<string, number | null>
  commentaire: string
}

const EMPTY_FORM: FormState = { reprend: null, notes: {}, commentaire: "" }

const fmt = (n: number | null | undefined) => (n == null ? "–" : n.toFixed(1).replace(".", ","))

function labelTerroir(sol: string | null, climat: string | null): string {
  const s = sol || "Sol non précisé"
  const c = climat ? ZONE_CLIMAT_LABEL[climat as ZoneClimat] ?? climat : "climat non précisé"
  return `${s} · ${c}`
}

interface Props {
  refType: AvisRefType
  refId: string | null
  nom?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

export function AvisDialog({ refType, refId, nom, open, onOpenChange, onSaved }: Props) {
  const { toast } = useToast()
  const config = avisConfig(refType)
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [data, setData] = React.useState<AvisData | null>(null)
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  // Garde anti-race : seule la réponse de la requête la plus récente est appliquée.
  const reqIdRef = React.useRef(0)

  const base = refId ? `/api/avis/${refType}/${encodeURIComponent(refId)}` : null

  const charger = React.useCallback(async () => {
    if (!base) return
    const reqId = ++reqIdRef.current
    setLoading(true)
    try {
      const res = await fetch(base)
      if (!res.ok) throw new Error("Chargement impossible")
      const json = await res.json()
      if (reqId !== reqIdRef.current) return
      const d: AvisData = json.data
      setData(d)
      setForm(
        d.monAvis
          ? { reprend: d.monAvis.reprend, notes: { ...d.monAvis.notes }, commentaire: d.monAvis.commentaire || "" }
          : EMPTY_FORM
      )
    } catch (e) {
      if (reqId !== reqIdRef.current) return
      toast({ variant: "destructive", title: "Erreur", description: e instanceof Error ? e.message : "Erreur" })
    } finally {
      if (reqId === reqIdRef.current) setLoading(false)
    }
  }, [base, toast])

  React.useEffect(() => {
    if (open && refId) charger()
    if (!open) {
      setData(null)
      setForm(EMPTY_FORM)
    }
  }, [open, refId, charger])

  const aQuelqueChose =
    form.reprend != null ||
    config.criteres.some((c) => form.notes[c.key] != null) ||
    form.commentaire.trim().length > 0

  const setNote = (key: string, v: number | null) =>
    setForm((f) => ({ ...f, notes: { ...f.notes, [key]: v } }))

  const enregistrer = async () => {
    if (!base || !aQuelqueChose) return
    setSaving(true)
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reprend: form.reprend,
          notes: form.notes,
          commentaire: form.commentaire.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Erreur")
      }
      toast({ title: "Merci !", description: "Votre avis a été enregistré." })
      await charger()
      onSaved?.()
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: e instanceof Error ? e.message : "Erreur" })
    } finally {
      setSaving(false)
    }
  }

  const supprimer = async () => {
    if (!base) return
    if (!(await confirmDialog("Supprimer votre avis ?"))) return
    try {
      const res = await fetch(base, { method: "DELETE" })
      if (!res.ok) throw new Error("Erreur")
      toast({ title: "Avis supprimé" })
      await charger()
      onSaved?.()
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: e instanceof Error ? e.message : "Erreur" })
    }
  }

  const stats = data?.stats

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Avis communautaires — {nom}</DialogTitle>
          <DialogDescription>
            Partagez votre expérience pour aider les autres. Les productions réelles observées
            confirment les avis.
          </DialogDescription>
        </DialogHeader>

        {loading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* En-tête stats */}
            <div className="rounded-lg border bg-slate-50 p-4">
              {stats && stats.nbAvis > 0 ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-2">
                    <StarRating value={stats.noteMoyenne ?? 0} />
                    <span className="font-semibold">{fmt(stats.noteMoyenne)}</span>
                    <span className="text-sm text-muted-foreground">· {stats.nbAvis} avis</span>
                  </div>
                  {stats.tauxReprise != null && (
                    <span className="text-sm text-muted-foreground">
                      {Math.round(stats.tauxReprise * 100)}% le recommandent
                    </span>
                  )}
                  {data.badgeTerrain && (
                    <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Confirmé terrain
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucun avis pour l&apos;instant — soyez le premier à témoigner.
                </p>
              )}
              {data.reel.nbProductif > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  <Sprout className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />
                  Réellement produit dans {data.reel.nbExploitations} exploitation
                  {data.reel.nbExploitations > 1 ? "s" : ""} ({data.reel.nbProductif} unité
                  {data.reel.nbProductif > 1 ? "s" : ""} productive{data.reel.nbProductif > 1 ? "s" : ""}).
                </p>
              )}
            </div>

            {/* Détail par critère */}
            {stats && stats.nbAvis > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {config.criteres.map((c) => (
                  <div key={c.key} className="rounded-md border p-2 text-center">
                    <div className="text-xs text-muted-foreground">{c.label}</div>
                    <div className="mt-1 flex items-center justify-center gap-1">
                      <StarRating value={stats.moyennesParCritere[c.key] ?? 0} size={13} />
                    </div>
                    <div className="text-xs font-medium">{fmt(stats.moyennesParCritere[c.key])}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Selon le terroir */}
            {data.dispersionTerroir.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Selon le terroir</h4>
                <p className="mb-2 text-xs text-muted-foreground">
                  Le comportement varie selon le sol et le climat.
                </p>
                <div className="space-y-1">
                  {data.dispersionTerroir.map((g, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between rounded-md border px-3 py-1.5 text-sm ${
                        g.fiable ? "" : "opacity-60"
                      }`}
                    >
                      <span>{labelTerroir(g.typeSol, g.zoneClimat)}</span>
                      <span className="flex items-center gap-2">
                        <StarRating value={g.noteMoyenne ?? 0} size={14} />
                        <span className="text-xs text-muted-foreground">
                          {g.nbAvis} avis{g.fiable ? "" : " · peu fiable"}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Formulaire — saisie progressive */}
            <div className="rounded-lg border p-4">
              <h4 className="mb-3 text-sm font-semibold">{data.monAvis ? "Modifier mon avis" : "Donner mon avis"}</h4>

              {/* Niveau 0 — la reprise */}
              <div className="mb-4">
                <p className="mb-1.5 text-sm">{config.labelReprend}</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={form.reprend === true ? "default" : "outline"}
                    onClick={() => setForm((f) => ({ ...f, reprend: f.reprend === true ? null : true }))}
                  >
                    Oui
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={form.reprend === false ? "default" : "outline"}
                    onClick={() => setForm((f) => ({ ...f, reprend: f.reprend === false ? null : false }))}
                  >
                    Non
                  </Button>
                </div>
              </div>

              {/* Niveau 1 — notes optionnelles */}
              <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {config.criteres.map((c) => (
                  <div key={c.key} className="flex items-center justify-between">
                    <span className="text-sm">{c.label}</span>
                    <StarRating value={form.notes[c.key] ?? null} onChange={(v) => setNote(c.key, v)} />
                  </div>
                ))}
              </div>

              {/* Niveau 2 — commentaire */}
              <Textarea
                placeholder="Un commentaire ? (facultatif)"
                rows={2}
                value={form.commentaire}
                maxLength={2000}
                onChange={(e) => setForm((f) => ({ ...f, commentaire: e.target.value }))}
              />

              <div className="mt-3 flex items-center justify-between">
                {data.monAvis ? (
                  <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={supprimer}>
                    <Trash2 className="mr-1 h-4 w-4" /> Supprimer mon avis
                  </Button>
                ) : (
                  <span />
                )}
                <Button type="button" disabled={!aQuelqueChose || saving} onClick={enregistrer}>
                  {saving ? "Enregistrement…" : data.monAvis ? "Mettre à jour" : "Publier"}
                </Button>
              </div>
            </div>

            {/* Liste des avis */}
            {data.avis.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Tous les avis ({data.avis.length})</h4>
                <div className="space-y-2">
                  {data.avis.map((a) => (
                    <div key={a.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {a.auteur}
                          {a.isMine && <span className="ml-1 text-xs text-muted-foreground">(vous)</span>}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {labelTerroir(a.contexteTypeSol, a.contexteZoneClimat)}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {a.reprend != null && <span>{a.reprend ? "↻ recommandé" : "✗ non recommandé"}</span>}
                        {config.criteres
                          .filter((c) => a.notes[c.key] != null)
                          .map((c) => (
                            <span key={c.key} className="flex items-center gap-1">
                              {c.label} <StarRating value={a.notes[c.key]} size={11} />
                            </span>
                          ))}
                      </div>
                      {a.commentaire && <p className="mt-1.5">{a.commentaire}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
