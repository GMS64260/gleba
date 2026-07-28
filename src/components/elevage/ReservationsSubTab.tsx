"use client"

/**
 * Réservations (Phase 1 — filière compagnie) : liste d'attente des acquéreurs,
 * acompte, affectation d'une portée et suivi jusqu'à la cession (livrée).
 */

import * as React from "react"
import { CalendarClock, Plus, Trash2, Pencil, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"
import { useFiliereSelection, filiereMatch } from "@/lib/elevage/filiere-context"

type Reservation = {
  id: string
  acquereurNom: string
  acquereurEmail: string | null
  acquereurTel: string | null
  naissanceId: number | null
  petitNaissanceId: string | null
  statut: string
  acompte: number | null
  montant: number | null
  dateReservation: string
  dateLivraison: string | null
  notes: string | null
}
type NaissanceOpt = { id: number; date: string; mere?: { nom: string | null; especeAnimale?: { nom: string; filiere?: string | null } } | null; lot?: { especeAnimale?: { filiere?: string | null } } | null; nombreVivants: number }

const STATUTS: { v: string; label: string; cls: string }[] = [
  { v: "attente", label: "En attente", cls: "bg-amber-100 text-amber-800" },
  { v: "confirmee", label: "Confirmée", cls: "bg-blue-100 text-blue-800" },
  { v: "livree", label: "Livrée", cls: "bg-emerald-100 text-emerald-800" },
  { v: "annulee", label: "Annulée", cls: "bg-slate-100 text-slate-500" },
]
const statutInfo = (v: string) => STATUTS.find((s) => s.v === v) ?? STATUTS[0]

const EMPTY = {
  id: "", acquereurNom: "", acquereurEmail: "", acquereurTel: "",
  naissanceId: "", statut: "attente", acompte: "", montant: "", dateLivraison: "", notes: "",
}

export function ReservationsSubTab() {
  const { toast } = useToast()
  const filiereSel = useFiliereSelection()
  const [loading, setLoading] = React.useState(true)
  const [reservations, setReservations] = React.useState<Reservation[]>([])
  const [naissances, setNaissances] = React.useState<NaissanceOpt[]>([])
  const [open, setOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState(EMPTY)

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const [r, n] = await Promise.all([
        fetch("/api/elevage/reservations", { cache: "no-store" }).then((x) => (x.ok ? x.json() : { data: [] })),
        fetch("/api/elevage/naissances", { cache: "no-store" }).then((x) => (x.ok ? x.json() : { data: [] })),
      ])
      setReservations(r.data ?? [])
      setNaissances(n.data ?? [])
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Chargement impossible" })
    } finally {
      setLoading(false)
    }
  }, [toast])
  React.useEffect(() => { fetchData() }, [fetchData])

  const naissanceLabel = (id: number | null) => {
    if (id == null) return null
    const n = naissances.find((x) => x.id === id)
    if (!n) return `Portée #${id}`
    const d = new Date(n.date).toLocaleDateString("fr-FR")
    const mere = n.mere?.nom || n.mere?.especeAnimale?.nom || "portée"
    return `${mere} · ${d}`
  }

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setOpen(true) }
  const openEdit = (r: Reservation) => {
    setEditingId(r.id)
    setForm({
      id: r.id, acquereurNom: r.acquereurNom, acquereurEmail: r.acquereurEmail ?? "", acquereurTel: r.acquereurTel ?? "",
      naissanceId: r.naissanceId != null ? String(r.naissanceId) : "", statut: r.statut,
      acompte: r.acompte != null ? String(r.acompte) : "", montant: r.montant != null ? String(r.montant) : "",
      dateLivraison: r.dateLivraison ? r.dateLivraison.split("T")[0] : "", notes: r.notes ?? "",
    })
    setOpen(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.acquereurNom.trim()) { toast({ variant: "destructive", title: "Nom de l'acquéreur requis" }); return }
    const payload = {
      ...(editingId ? { id: editingId } : {}),
      acquereurNom: form.acquereurNom, acquereurEmail: form.acquereurEmail || null, acquereurTel: form.acquereurTel || null,
      naissanceId: form.naissanceId ? Number(form.naissanceId) : null,
      statut: form.statut, acompte: form.acompte || null, montant: form.montant || null,
      dateLivraison: form.dateLivraison || null, notes: form.notes || null,
    }
    const res = await fetch("/api/elevage/reservations", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) { const j = await res.json().catch(() => null); toast({ variant: "destructive", title: "Erreur", description: j?.error || "Échec" }); return }
    toast({ title: editingId ? "Réservation modifiée" : "Réservation créée" })
    setOpen(false); fetchData()
  }

  const changerStatut = async (r: Reservation, statut: string) => {
    const res = await fetch("/api/elevage/reservations", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, statut }),
    })
    if (res.ok) { setReservations((prev) => prev.map((x) => (x.id === r.id ? { ...x, statut } : x))) }
    else toast({ variant: "destructive", title: "Erreur" })
  }

  const supprimer = async (r: Reservation) => {
    if (!(await confirmDialog(`Supprimer la réservation de ${r.acquereurNom} ?`))) return
    const res = await fetch(`/api/elevage/reservations?id=${r.id}`, { method: "DELETE" })
    if (res.ok) fetchData(); else toast({ variant: "destructive", title: "Erreur" })
  }

  // Portées proposées au choix : limitées à la filière de l'atelier courant.
  const naissancesF = naissances.filter((n) => filiereMatch(filiereSel, n.mere?.especeAnimale?.filiere ?? n.lot?.especeAnimale?.filiere))
  // Réservations scopées à l'atelier : celles rattachées à une portée de la
  // filière courante ; celles sans portée restent visibles (pas encore tranchées).
  const naissanceIdsF = new Set(naissancesF.map((n) => n.id))
  const reservationsVisibles = reservations.filter((r) => r.naissanceId == null || naissanceIdsF.has(r.naissanceId))
  const enAttente = reservationsVisibles.filter((r) => r.statut === "attente").length
  const totalAcomptes = reservationsVisibles.filter((r) => r.statut !== "annulee").reduce((s, r) => s + (r.acompte ?? 0), 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-amber-600" />Réservations</CardTitle>
            <CardDescription>
              Liste d’attente des acquéreurs, acomptes et affectation d’une portée jusqu’à la cession.
              {reservationsVisibles.length > 0 && ` · ${enAttente} en attente · ${totalAcomptes.toLocaleString("fr-FR")} € d'acomptes`}
            </CardDescription>
          </div>
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Nouvelle réservation</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : reservationsVisibles.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Aucune réservation. Ajoutez un acquéreur en liste d’attente et affectez-lui une portée.
          </p>
        ) : (
          <div className="divide-y">
            {reservationsVisibles.map((r) => {
              const si = statutInfo(r.statut)
              const portee = naissanceLabel(r.naissanceId)
              return (
                <div key={r.id} className="py-3 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {r.acquereurNom}
                      {portee && <Badge variant="outline" className="text-xs font-normal">{portee}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[r.acquereurTel, r.acquereurEmail].filter(Boolean).join(" · ")}
                      {r.acompte ? ` · acompte ${r.acompte.toLocaleString("fr-FR")} €` : ""}
                      {r.dateLivraison ? ` · livraison ${new Date(r.dateLivraison).toLocaleDateString("fr-FR")}` : ""}
                    </div>
                  </div>
                  <Select value={r.statut} onValueChange={(v) => changerStatut(r, v)}>
                    <SelectTrigger className={`h-8 w-[130px] text-xs ${si.cls} border-0`}><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUTS.map((s) => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" title="Documents de cession"><FileText className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => window.open(`/api/elevage/reservations/${r.id}/document?type=contrat`, "_blank")}>Projet de contrat</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.open(`/api/elevage/reservations/${r.id}/document?type=engagement`, "_blank")}>Trame d’engagement</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.open(`/api/elevage/reservations/${r.id}/document?type=attestation`, "_blank")}>Projet d’attestation</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => supprimer(r)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Modifier la réservation" : "Nouvelle réservation"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-2"><Label>Acquéreur *</Label><Input value={form.acquereurNom} onChange={(e) => setForm((f) => ({ ...f, acquereurNom: e.target.value }))} placeholder="Nom / prénom" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Téléphone</Label><Input value={form.acquereurTel} onChange={(e) => setForm((f) => ({ ...f, acquereurTel: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.acquereurEmail} onChange={(e) => setForm((f) => ({ ...f, acquereurEmail: e.target.value }))} /></div>
            </div>
            <div className="space-y-2">
              <Label>Portée (optionnel)</Label>
              <Select value={form.naissanceId || "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, naissanceId: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Aucune / à affecter" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucune / à affecter</SelectItem>
                  {naissancesF.map((n) => (
                    <SelectItem key={n.id} value={String(n.id)}>{naissanceLabel(n.id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Acompte (€)</Label><Input type="number" step="0.01" value={form.acompte} onChange={(e) => setForm((f) => ({ ...f, acompte: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Prix (€)</Label><Input type="number" step="0.01" value={form.montant} onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={form.statut} onValueChange={(v) => setForm((f) => ({ ...f, statut: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUTS.map((s) => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Livraison prévue</Label><Input type="date" value={form.dateLivraison} onChange={(e) => setForm((f) => ({ ...f, dateLivraison: e.target.value }))} /></div>
            </div>
            <div className="space-y-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Préférences, délai de réflexion…" /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={!form.acquereurNom.trim()}>{editingId ? "Enregistrer" : "Créer"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
