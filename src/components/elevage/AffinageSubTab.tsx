"use client"

/**
 * Sous-onglet Cave / affinage — PROMPT 27.
 * Inventaire des lots de fromage : stock restant, DLC/DLUO, valorisation,
 * sorties de cave (vente/perte/don) et cycle de vie (affinage → prêt → écoulé).
 */

import * as React from "react"
import { Warehouse, ArrowDownToLine, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { todayLocalISO } from "@/lib/format-utils"

type LotCave = {
  id: string
  numeroLot: string
  typeFromage: string
  dateFabrication: string
  etat: string
  echeanceType: "DLC" | "DLUO" | null
  joursRestants: number | null
  nbPiecesInitial: number
  stockPieces: number
  stockKg: number
  prixMoyenKg: number | null
  valorisation: number | null
}
const ETAT_BADGE: Record<string, string> = {
  affinage: "bg-amber-100 text-amber-800 border-amber-200",
  pret: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ecoule: "bg-slate-100 text-slate-600 border-slate-200",
}
const ETAT_LABEL: Record<string, string> = { affinage: "En affinage", pret: "Prêt", ecoule: "Écoulé" }
const TYPES_SORTIE = [
  { v: "sortie_vente", l: "Vente" },
  { v: "sortie_perte", l: "Perte" },
  { v: "sortie_don", l: "Don" },
  { v: "ajustement", l: "Ajustement" },
]

export function AffinageSubTab() {
  const { toast } = useToast()
  const [lots, setLots] = React.useState<LotCave[]>([])
  const [stats, setStats] = React.useState<{ nbLots: number; stockPiecesTotal: number; stockKgTotal: number; valorisationTotale: number; nbAlerteDlc: number } | null>(null)
  const [inclureEcoules, setInclureEcoules] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [sortie, setSortie] = React.useState<LotCave | null>(null)
  const [form, setForm] = React.useState({ date: todayLocalISO(), type: "sortie_vente", nbPieces: "", poidsKg: "", notes: "" })

  const reload = React.useCallback(() => {
    setLoading(true)
    fetch(`/api/elevage/affinage?inclureEcoules=${inclureEcoules ? "1" : "0"}`)
      .then((r) => r.json())
      .then((j) => { setLots(j.data || []); setStats(j.stats || null) })
      .finally(() => setLoading(false))
  }, [inclureEcoules])
  React.useEffect(() => { reload() }, [reload])

  const changerEtat = async (l: LotCave, etat: string) => {
    await fetch("/api/elevage/affinage", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: l.id, etat }) })
    reload()
  }

  const submitSortie = async () => {
    if (!sortie) return
    const res = await fetch("/api/elevage/mouvements-fromage", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lotFromageId: sortie.id, date: form.date, type: form.type, nbPieces: form.nbPieces || 0, poidsKg: form.poidsKg || 0, notes: form.notes || null }),
    })
    const j = await res.json()
    if (!res.ok) { toast({ variant: "destructive", title: "Erreur", description: j.error }); return }
    toast({ title: "Sortie enregistrée" })
    setSortie(null); setForm({ date: todayLocalISO(), type: "sortie_vente", nbPieces: "", poidsKg: "", notes: "" })
    reload()
  }

  const dlcClass = (j: number | null) => (j == null ? "" : j < 0 ? "text-red-700 font-semibold" : j <= 7 ? "text-amber-700 font-semibold" : "text-slate-600")

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2"><Warehouse className="h-5 w-5 text-amber-700" />Cave d'affinage</CardTitle>
            <CardDescription>Inventaire des lots : stock restant, échéance DLC/DLUO, valorisation et sorties.</CardDescription>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={inclureEcoules} onChange={(e) => setInclureEcoules(e.target.checked)} />
            Inclure les lots écoulés
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3"><div className="text-xs text-slate-500">Lots en stock</div><div className="text-xl font-semibold">{stats.nbLots}</div></div>
            <div className="rounded-lg border p-3"><div className="text-xs text-slate-500">Pièces / poids</div><div className="text-xl font-semibold">{stats.stockPiecesTotal} <span className="text-sm text-slate-400">pc</span> · {stats.stockKgTotal} <span className="text-sm text-slate-400">kg</span></div></div>
            <div className="rounded-lg border p-3"><div className="text-xs text-slate-500">Valorisation stock</div><div className="text-xl font-semibold">{stats.valorisationTotale.toLocaleString("fr-FR")} €</div></div>
            <div className={`rounded-lg border p-3 ${stats.nbAlerteDlc > 0 ? "border-red-200 bg-red-50" : ""}`}><div className="text-xs text-slate-500 flex items-center gap-1">{stats.nbAlerteDlc > 0 && <AlertTriangle className="h-3 w-3 text-red-600" />}Échéance ≤ 7 j</div><div className={`text-xl font-semibold ${stats.nbAlerteDlc > 0 ? "text-red-700" : ""}`}>{stats.nbAlerteDlc}</div></div>
          </div>
        )}

        {loading ? (
          <div className="text-sm text-slate-500">Chargement…</div>
        ) : lots.length === 0 ? (
          <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded">Aucun lot en cave. Les fabrications (onglet Fabrications) alimentent l'inventaire.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="p-2 text-left">Lot</th>
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-center">État</th>
                  <th className="p-2 text-right">Stock</th>
                  <th className="p-2 text-right">Échéance</th>
                  <th className="p-2 text-right">Valorisation</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {lots.map((l) => (
                  <tr key={l.id} className="border-b hover:bg-slate-50">
                    <td className="p-2 font-mono text-xs">{l.numeroLot}</td>
                    <td className="p-2">{l.typeFromage}</td>
                    <td className="p-2 text-center">
                      <select
                        className={`text-xs rounded border px-1 py-0.5 ${ETAT_BADGE[l.etat] || ""}`}
                        value={l.etat}
                        onChange={(e) => changerEtat(l, e.target.value)}
                      >
                        {Object.keys(ETAT_LABEL).map((k) => <option key={k} value={k}>{ETAT_LABEL[k]}</option>)}
                      </select>
                    </td>
                    <td className="p-2 text-right">{l.stockPieces} pc · {l.stockKg} kg</td>
                    <td className="p-2 text-right">
                      {l.echeanceType ? (
                        <span className={dlcClass(l.joursRestants)}>
                          {l.echeanceType} {l.joursRestants != null ? (l.joursRestants < 0 ? `dépassée` : `${l.joursRestants} j`) : ""}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-2 text-right">{l.valorisation != null ? `${l.valorisation.toLocaleString("fr-FR")} €` : "—"}</td>
                    <td className="p-2 text-right">
                      <Button variant="outline" size="sm" onClick={() => setSortie(l)} disabled={l.stockPieces <= 0}>
                        <ArrowDownToLine className="h-4 w-4 mr-1" />Sortie
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-400 mt-2">Stock = pièces fabriquées − sorties. Valorisation au prix de vente moyen constaté du lot. DLC pour le frais, DLUO sinon.</p>
          </div>
        )}
      </CardContent>

      <Dialog open={sortie != null} onOpenChange={(o) => !o && setSortie(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sortie de cave — {sortie?.numeroLot}</DialogTitle>
            <DialogDescription>Stock restant : {sortie?.stockPieces} pièces · {sortie?.stockKg} kg</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></div>
              <div><Label>Type</Label><select className="block h-10 w-full rounded-md border border-slate-300 px-2 bg-white" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>{TYPES_SORTIE.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Pièces</Label><Input type="number" min="0" value={form.nbPieces} onChange={(e) => setForm((f) => ({ ...f, nbPieces: e.target.value }))} /></div>
              <div><Label>Poids (kg)</Label><Input type="number" step="0.01" min="0" value={form.poidsKg} onChange={(e) => setForm((f) => ({ ...f, poidsKg: e.target.value }))} /></div>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setSortie(null)}>Annuler</Button>
            <Button onClick={submitSortie}>Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
