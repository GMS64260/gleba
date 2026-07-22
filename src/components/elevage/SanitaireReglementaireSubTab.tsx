"use client"

import * as React from "react"
import { AlertTriangle, Check, Download, Plus, Trash2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

type Produit = { id: string; nom: string; amm: string | null }
type Stock = { id: string; produitId: string; numeroLot: string; quantite: number; unite: string; datePeremption: string | null; ordonnanceUrl: string | null; produit: Produit | null }
type Prophylaxie = { id: string; type: string; datePrevue: string; dateRealisee: string | null; statut: string; organisme: string | null; resultat: string | null }

const dateISO = (date = new Date()) => date.toISOString().slice(0, 10)

export function SanitaireReglementaireSubTab() {
  const { toast } = useToast()
  const [stocks, setStocks] = React.useState<Stock[]>([])
  const [prophylaxies, setProphylaxies] = React.useState<Prophylaxie[]>([])
  const [produits, setProduits] = React.useState<Produit[]>([])
  const [stockOpen, setStockOpen] = React.useState(false)
  const [proOpen, setProOpen] = React.useState(false)
  const [stockForm, setStockForm] = React.useState({ produitId: "", numeroLot: "", quantite: "", unite: "mL", datePeremption: "", ordonnanceUrl: "", fournisseur: "", notes: "" })
  const [proForm, setProForm] = React.useState({ type: "", datePrevue: dateISO(), organisme: "", notes: "" })

  const reload = React.useCallback(async () => {
    const [s, p, produitsRes] = await Promise.all([
      fetch('/api/elevage/stock-medicaments'),
      fetch('/api/elevage/prophylaxies'),
      fetch('/api/elevage/produits-veterinaires'),
    ])
    if (s.ok) setStocks((await s.json()).data)
    if (p.ok) setProphylaxies((await p.json()).data)
    if (produitsRes.ok) setProduits((await produitsRes.json()).data)
  }, [])
  React.useEffect(() => { void reload() }, [reload])

  async function saveStock(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/elevage/stock-medicaments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...stockForm, quantite: Number(stockForm.quantite), datePeremption: stockForm.datePeremption || null, ordonnanceUrl: stockForm.ordonnanceUrl || null }),
    })
    if (!res.ok) return toast({ variant: 'destructive', title: 'Stock non enregistré', description: (await res.json()).error })
    setStockOpen(false); await reload()
    toast({ title: 'Stock de médicament enregistré' })
  }

  async function savePro(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/elevage/prophylaxies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(proForm),
    })
    if (!res.ok) return toast({ variant: 'destructive', title: 'Échéance non enregistrée', description: (await res.json()).error })
    setProOpen(false); await reload()
    toast({ title: 'Prophylaxie ajoutée à l’agenda' })
  }

  async function realisee(p: Prophylaxie) {
    const res = await fetch('/api/elevage/prophylaxies', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...p, datePrevue: p.datePrevue, dateRealisee: new Date(), statut: 'realisee' }),
    })
    if (res.ok) await reload()
  }

  async function supprimerStock(id: string) {
    const res = await fetch(`/api/elevage/stock-medicaments?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (res.ok) await reload()
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline"><a href="/api/elevage/inventaire-cheptel"><Download className="h-4 w-4 mr-2" />Inventaire complet du cheptel</a></Button>
      <Button asChild variant="outline"><a href={`/api/elevage/registre-sanitaire?year=${new Date().getFullYear()}`}><Download className="h-4 w-4 mr-2" />Registre sanitaire PDF</a></Button>
      <Button asChild variant="outline"><a href={`/api/elevage/registre-elevage?year=${new Date().getFullYear()}`}><Download className="h-4 w-4 mr-2" />Registre d’élevage PDF</a></Button>
    </div>

    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div><CardTitle>Pharmacie d’élevage</CardTitle><CardDescription>Lots, quantités, péremptions et lien vers l’ordonnance.</CardDescription></div>
        <Dialog open={stockOpen} onOpenChange={setStockOpen}><DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Stock</Button></DialogTrigger><DialogContent>
          <DialogHeader><DialogTitle>Enregistrer un lot de médicament</DialogTitle><DialogDescription>Les produits proviennent du référentiel vétérinaire Gleba.</DialogDescription></DialogHeader>
          <form onSubmit={saveStock} className="space-y-3">
            <div><Label>Produit</Label><Select value={stockForm.produitId} onValueChange={(v) => setStockForm(f => ({ ...f, produitId: v }))}><SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger><SelectContent>{produits.map(p => <SelectItem key={p.id} value={p.id}>{p.nom}{p.amm ? ` · ${p.amm}` : ''}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>N° lot</Label><Input required value={stockForm.numeroLot} onChange={e => setStockForm(f => ({ ...f, numeroLot: e.target.value }))} /></div><div><Label>Péremption</Label><Input type="date" value={stockForm.datePeremption} onChange={e => setStockForm(f => ({ ...f, datePeremption: e.target.value }))} /></div></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Quantité</Label><Input required type="number" min="0" step="any" value={stockForm.quantite} onChange={e => setStockForm(f => ({ ...f, quantite: e.target.value }))} /></div><div><Label>Unité</Label><Input required value={stockForm.unite} onChange={e => setStockForm(f => ({ ...f, unite: e.target.value }))} /></div></div>
            <div><Label>URL ordonnance</Label><Input type="url" value={stockForm.ordonnanceUrl} onChange={e => setStockForm(f => ({ ...f, ordonnanceUrl: e.target.value }))} /></div>
            <Button type="submit" disabled={!stockForm.produitId}>Enregistrer</Button>
          </form>
        </DialogContent></Dialog>
      </CardHeader>
      <CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Produit</TableHead><TableHead>Lot</TableHead><TableHead>Stock</TableHead><TableHead>Péremption</TableHead><TableHead>Ordonnance</TableHead><TableHead /></TableRow></TableHeader><TableBody>
        {stocks.map(s => { const expire = s.datePeremption && new Date(s.datePeremption) < new Date(); return <TableRow key={s.id}><TableCell>{s.produit?.nom || s.produitId}</TableCell><TableCell>{s.numeroLot}</TableCell><TableCell>{s.quantite} {s.unite}</TableCell><TableCell className={expire ? 'text-red-700 font-medium' : ''}>{s.datePeremption ? new Date(s.datePeremption).toLocaleDateString('fr-FR') : '—'} {expire && <AlertTriangle className="inline h-4 w-4" />}</TableCell><TableCell>{s.ordonnanceUrl ? <a className="underline" href={s.ordonnanceUrl} target="_blank" rel="noreferrer">Ouvrir</a> : '—'}</TableCell><TableCell><Button size="icon" variant="ghost" onClick={() => supprimerStock(s.id)} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow> })}
        {!stocks.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Pharmacie non inventoriée</TableCell></TableRow>}
      </TableBody></Table></div></CardContent>
    </Card>

    <Card><CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>Prophylaxies et contrôles</CardTitle><CardDescription>Échéances réglementaires, visites et dépistages.</CardDescription></div>
      <Dialog open={proOpen} onOpenChange={setProOpen}><DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Échéance</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Planifier une prophylaxie</DialogTitle></DialogHeader><form onSubmit={savePro} className="space-y-3"><div><Label>Type</Label><Input required value={proForm.type} onChange={e => setProForm(f => ({ ...f, type: e.target.value }))} placeholder="Brucellose, visite sanitaire…" /></div><div><Label>Date prévue</Label><Input required type="date" value={proForm.datePrevue} onChange={e => setProForm(f => ({ ...f, datePrevue: e.target.value }))} /></div><div><Label>Organisme / vétérinaire</Label><Input value={proForm.organisme} onChange={e => setProForm(f => ({ ...f, organisme: e.target.value }))} /></div><div><Label>Notes</Label><Textarea value={proForm.notes} onChange={e => setProForm(f => ({ ...f, notes: e.target.value }))} /></div><Button type="submit">Planifier</Button></form></DialogContent></Dialog>
    </CardHeader><CardContent className="space-y-2">{prophylaxies.map(p => <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><div><div className="font-medium">{p.type}</div><div className="text-sm text-muted-foreground">{new Date(p.datePrevue).toLocaleDateString('fr-FR')} · {p.organisme || 'organisme à préciser'}</div></div><div className="flex items-center gap-2"><Badge variant={p.statut === 'realisee' ? 'default' : 'secondary'}>{p.statut === 'realisee' ? 'Réalisée' : 'À faire'}</Badge>{p.statut !== 'realisee' && <Button size="sm" variant="outline" onClick={() => realisee(p)}><Check className="h-4 w-4 mr-1" />Réalisée</Button>}</div></div>)}{!prophylaxies.length && <p className="text-center text-muted-foreground py-8">Aucune prophylaxie planifiée</p>}</CardContent></Card>
  </div>
}
