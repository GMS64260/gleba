"use client"

/**
 * Sous-onglet Livraisons laiterie & paie du lait — PROMPT 26.
 * Pour les exploitations qui livrent au collecteur (vs transformation ferme).
 */

import * as React from "react"
import { Truck, Plus, Trash2, Euro, Calculator } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"
import { todayLocalISO } from "@/lib/format-utils"
import { estimePrimeQualite, montantPaie } from "@/lib/elevage/paie-lait"

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"]

type Livraison = {
  id: string
  date: string
  litres: string | number
  laiterie: string | null
  tb: string | number | null
  tp: string | number | null
  cellules: number | null
  germes: number | null
}
type Paie = {
  id: string
  annee: number
  mois: number
  litres: string | number
  prixBaseMille: string | number
  primeQualite: string | number
  penalite: string | number
  montantHT: string | number
  laiterie: string | null
}

export function LivraisonLaitSubTab() {
  const { toast } = useToast()
  const [annee, setAnnee] = React.useState(new Date().getFullYear())
  const [livraisons, setLivraisons] = React.useState<Livraison[]>([])
  const [paies, setPaies] = React.useState<Paie[]>([])
  const [paieStats, setPaieStats] = React.useState<{ montantTotal: number; litresTotal: number; prixMoyenMille: number | null } | null>(null)
  const [livStats, setLivStats] = React.useState<{ nb: number; litresTotal: number } | null>(null)

  const [livForm, setLivForm] = React.useState({ date: todayLocalISO(), litres: "", laiterie: "", tb: "", tp: "", cellules: "", germes: "" })
  const [paieForm, setPaieForm] = React.useState({ mois: new Date().getMonth() + 1, litres: "", prixBaseMille: "700", primeQualite: "0", penalite: "0", laiterie: "" })

  const reload = React.useCallback(() => {
    fetch(`/api/elevage/livraisons-lait?annee=${annee}`).then((r) => r.json()).then((j) => { setLivraisons(j.data || []); setLivStats(j.stats || null) })
    fetch(`/api/elevage/paies-lait?annee=${annee}`).then((r) => r.json()).then((j) => { setPaies(j.data || []); setPaieStats(j.stats || null) })
  }, [annee])
  React.useEffect(() => { reload() }, [reload])

  const submitLiv = async () => {
    if (!livForm.litres) { toast({ variant: "destructive", title: "Litres requis" }); return }
    const res = await fetch("/api/elevage/livraisons-lait", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: livForm.date, litres: livForm.litres, laiterie: livForm.laiterie || null,
        tb: livForm.tb || null, tp: livForm.tp || null, cellules: livForm.cellules || null, germes: livForm.germes || null,
      }),
    })
    if (res.ok) { toast({ title: "Livraison enregistrée" }); setLivForm({ date: todayLocalISO(), litres: "", laiterie: "", tb: "", tp: "", cellules: "", germes: "" }); reload() }
    else toast({ variant: "destructive", title: "Erreur" })
  }
  const delLiv = async (l: Livraison) => {
    if (!(await confirmDialog("Supprimer cette livraison ?"))) return
    await fetch(`/api/elevage/livraisons-lait?id=${l.id}`, { method: "DELETE" }); reload()
  }

  // Estimation prime/pénalité à partir des livraisons du mois sélectionné
  const estimerPaie = () => {
    const moisLiv = livraisons.filter((l) => new Date(l.date).getMonth() + 1 === paieForm.mois)
    const litres = moisLiv.reduce((s, l) => s + Number(l.litres), 0)
    // Moyenne pondérée simple des taux (sur les livraisons renseignées)
    const avg = (getter: (l: Livraison) => number | null): number | null => {
      const vals = moisLiv.map(getter).filter((v): v is number => v != null)
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
    }
    const q = { tb: avg((l) => (l.tb != null ? Number(l.tb) : null)), tp: avg((l) => (l.tp != null ? Number(l.tp) : null)), cellules: avg((l) => l.cellules), germes: avg((l) => l.germes) }
    const { prime, penalite } = estimePrimeQualite(q, litres || 0)
    setPaieForm((f) => ({ ...f, litres: litres ? String(Math.round(litres * 100) / 100) : f.litres, primeQualite: String(prime), penalite: String(penalite) }))
    toast({ title: "Estimation calculée", description: `${moisLiv.length} livraison(s) du mois — grille indicative` })
  }

  const submitPaie = async () => {
    if (!paieForm.litres || !paieForm.prixBaseMille) { toast({ variant: "destructive", title: "Litres et prix de base requis" }); return }
    const res = await fetch("/api/elevage/paies-lait", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ annee, mois: paieForm.mois, litres: paieForm.litres, prixBaseMille: paieForm.prixBaseMille, primeQualite: paieForm.primeQualite || 0, penalite: paieForm.penalite || 0, laiterie: paieForm.laiterie || null }),
    })
    if (res.ok) { toast({ title: "Paie enregistrée" }); reload() }
    else toast({ variant: "destructive", title: "Erreur" })
  }
  const delPaie = async (p: Paie) => {
    if (!(await confirmDialog(`Supprimer la paie de ${MOIS[p.mois - 1]} ?`))) return
    await fetch(`/api/elevage/paies-lait?id=${p.id}`, { method: "DELETE" }); reload()
  }

  const montantEstime = montantPaie(Number(paieForm.litres) || 0, Number(paieForm.prixBaseMille) || 0, Number(paieForm.primeQualite) || 0, Number(paieForm.penalite) || 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <select className="h-9 rounded-md border border-slate-300 px-2 bg-white text-sm" value={annee} onChange={(e) => setAnnee(parseInt(e.target.value, 10))}>
          {[0, -1, -2].map((d) => <option key={d} value={new Date().getFullYear() + d}>{new Date().getFullYear() + d}</option>)}
        </select>
      </div>

      {/* Paie du lait */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Euro className="h-5 w-5 text-emerald-600" />Paie du lait {annee}</CardTitle>
          <CardDescription>Relevé mensuel du collecteur. Le montant = (litres/1000 × prix base) + prime − pénalité.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paieStats && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3"><div className="text-xs text-slate-500">Litres livrés</div><div className="text-xl font-semibold">{paieStats.litresTotal.toLocaleString("fr-FR")} L</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-slate-500">Recette lait</div><div className="text-xl font-semibold">{paieStats.montantTotal.toLocaleString("fr-FR")} €</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-slate-500">Prix moyen /1000 L</div><div className="text-xl font-semibold">{paieStats.prixMoyenMille ?? "—"} €</div></div>
            </div>
          )}
          {/* Formulaire paie */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end border rounded-lg p-3 bg-slate-50">
            <div><Label className="text-xs">Mois</Label><select className="block h-9 w-full rounded-md border border-slate-300 px-1 bg-white text-sm" value={paieForm.mois} onChange={(e) => setPaieForm((f) => ({ ...f, mois: parseInt(e.target.value, 10) }))}>{MOIS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
            <div><Label className="text-xs">Litres</Label><Input type="number" value={paieForm.litres} onChange={(e) => setPaieForm((f) => ({ ...f, litres: e.target.value }))} /></div>
            <div><Label className="text-xs">Prix /1000L</Label><Input type="number" value={paieForm.prixBaseMille} onChange={(e) => setPaieForm((f) => ({ ...f, prixBaseMille: e.target.value }))} /></div>
            <div><Label className="text-xs">Prime €</Label><Input type="number" value={paieForm.primeQualite} onChange={(e) => setPaieForm((f) => ({ ...f, primeQualite: e.target.value }))} /></div>
            <div><Label className="text-xs">Pénalité €</Label><Input type="number" value={paieForm.penalite} onChange={(e) => setPaieForm((f) => ({ ...f, penalite: e.target.value }))} /></div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={estimerPaie} title="Estimer d'après les livraisons du mois"><Calculator className="h-4 w-4" /></Button>
              <Button size="sm" onClick={submitPaie}>{montantEstime.toFixed(0)} €</Button>
            </div>
          </div>
          {paies.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b"><tr><th className="p-2 text-left">Mois</th><th className="p-2 text-right">Litres</th><th className="p-2 text-right">Prix/1000L</th><th className="p-2 text-right">Prime</th><th className="p-2 text-right">Pénalité</th><th className="p-2 text-right">Montant HT</th><th className="p-2"></th></tr></thead>
                <tbody>
                  {paies.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-slate-50">
                      <td className="p-2 font-medium">{MOIS[p.mois - 1]}</td>
                      <td className="p-2 text-right">{Number(p.litres).toLocaleString("fr-FR")}</td>
                      <td className="p-2 text-right">{Number(p.prixBaseMille).toFixed(0)} €</td>
                      <td className="p-2 text-right text-emerald-700">{Number(p.primeQualite) > 0 ? `+${Number(p.primeQualite).toFixed(0)}` : Number(p.primeQualite).toFixed(0)}</td>
                      <td className="p-2 text-right text-red-700">{Number(p.penalite) > 0 ? `−${Number(p.penalite).toFixed(0)}` : "0"}</td>
                      <td className="p-2 text-right font-semibold">{Number(p.montantHT).toFixed(2)} €</td>
                      <td className="p-2 text-right"><Button variant="ghost" size="sm" onClick={() => delPaie(p)}><Trash2 className="h-4 w-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Livraisons au tank */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-blue-600" />Livraisons au collecteur</CardTitle>
          <CardDescription>Volumes livrés et analyses du tank (TB, TP, cellules, germes) — base de la paie.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-7 gap-2 items-end border rounded-lg p-3 bg-slate-50">
            <div><Label className="text-xs">Date</Label><Input type="date" value={livForm.date} onChange={(e) => setLivForm((f) => ({ ...f, date: e.target.value }))} /></div>
            <div><Label className="text-xs">Litres</Label><Input type="number" value={livForm.litres} onChange={(e) => setLivForm((f) => ({ ...f, litres: e.target.value }))} /></div>
            <div><Label className="text-xs">TB g/L</Label><Input type="number" step="0.1" value={livForm.tb} onChange={(e) => setLivForm((f) => ({ ...f, tb: e.target.value }))} /></div>
            <div><Label className="text-xs">TP g/L</Label><Input type="number" step="0.1" value={livForm.tp} onChange={(e) => setLivForm((f) => ({ ...f, tp: e.target.value }))} /></div>
            <div><Label className="text-xs">Cellules</Label><Input type="number" value={livForm.cellules} onChange={(e) => setLivForm((f) => ({ ...f, cellules: e.target.value }))} /></div>
            <div><Label className="text-xs">Germes</Label><Input type="number" value={livForm.germes} onChange={(e) => setLivForm((f) => ({ ...f, germes: e.target.value }))} /></div>
            <div><Button size="sm" onClick={submitLiv}><Plus className="h-4 w-4 mr-1" />Ajouter</Button></div>
          </div>
          {livStats && <p className="text-xs text-slate-500">{livStats.nb} livraison(s) · {livStats.litresTotal.toLocaleString("fr-FR")} L livrés en {annee}</p>}
          {livraisons.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b"><tr><th className="p-2 text-left">Date</th><th className="p-2 text-right">Litres</th><th className="p-2 text-right">TB/TP</th><th className="p-2 text-right">Cellules</th><th className="p-2 text-right">Germes</th><th className="p-2"></th></tr></thead>
                <tbody>
                  {livraisons.map((l) => (
                    <tr key={l.id} className="border-b hover:bg-slate-50">
                      <td className="p-2">{new Date(l.date).toLocaleDateString("fr-FR")}</td>
                      <td className="p-2 text-right font-medium">{Number(l.litres).toLocaleString("fr-FR")} L</td>
                      <td className="p-2 text-right text-slate-600">{l.tb != null ? Number(l.tb) : "—"} / {l.tp != null ? Number(l.tp) : "—"}</td>
                      <td className="p-2 text-right text-slate-600">{l.cellules != null ? `${l.cellules} k` : "—"}</td>
                      <td className="p-2 text-right text-slate-600">{l.germes != null ? `${l.germes} k` : "—"}</td>
                      <td className="p-2 text-right"><Button variant="ghost" size="sm" onClick={() => delLiv(l)}><Trash2 className="h-4 w-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
