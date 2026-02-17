"use client"

/**
 * Page Abattages
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Scissors, Plus, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface Abattage {
  id: number
  date: string
  quantite: number
  poidsVif: number | null
  poidsCarcasse: number | null
  destination: string
  prixVente: number | null
  lieu: string | null
  notes: string | null
  animal: { id: number; nom: string; identifiant: string; race: string } | null
  lot: { id: number; nom: string } | null
}

interface Lot { id: number; nom: string | null; quantiteActuelle: number; especeAnimale: { nom: string } }

const DEST_LABELS: Record<string, string> = {
  auto_consommation: "Auto-consommation",
  vente: "Vente",
  don: "Don",
}

export default function AbattagesPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [abattages, setAbattages] = React.useState<Abattage[]>([])
  const [lots, setLots] = React.useState<Lot[]>([])
  const [stats, setStats] = React.useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  const [formData, setFormData] = React.useState({
    lotId: "", date: new Date().toISOString().split('T')[0], quantite: "1",
    poidsVif: "", poidsCarcasse: "", destination: "auto_consommation", prixVente: "", lieu: "", notes: "",
  })

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const [abatRes, lotsRes] = await Promise.all([fetch('/api/elevage/abattages?limit=100'), fetch('/api/elevage/lots?statut=actif')])
      if (abatRes.ok) { const r = await abatRes.json(); setAbattages(r.data); setStats(r.stats) }
      if (lotsRes.ok) setLots((await lotsRes.json()).data)
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/elevage/abattages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
      })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: "Abattage enregistré" })
      setIsDialogOpen(false)
      setFormData({ lotId: "", date: new Date().toISOString().split('T')[0], quantite: "1", poidsVif: "", poidsCarcasse: "", destination: "auto_consommation", prixVente: "", lieu: "", notes: "" })
      fetchData()
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer l'abattage" })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/elevage"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Élevage</Button></Link>
            <div className="flex items-center gap-2">
              <Scissors className="h-6 w-6 text-red-600" />
              <h1 className="text-xl font-bold">Abattages</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />Nouvel abattage</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Enregistrer un abattage</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Lot *</Label>
                    <Select value={formData.lotId} onValueChange={(v) => setFormData(f => ({ ...f, lotId: v }))}>
                      <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent>{lots.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.nom || `Lot #${l.id}`} ({l.quantiteActuelle} {l.especeAnimale.nom})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Date</Label><Input type="date" value={formData.date} onChange={(e) => setFormData(f => ({ ...f, date: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Quantité</Label><Input type="number" min="1" value={formData.quantite} onChange={(e) => setFormData(f => ({ ...f, quantite: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Poids vif (kg)</Label><Input type="number" step="0.1" value={formData.poidsVif} onChange={(e) => setFormData(f => ({ ...f, poidsVif: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Poids carcasse (kg)</Label><Input type="number" step="0.1" value={formData.poidsCarcasse} onChange={(e) => setFormData(f => ({ ...f, poidsCarcasse: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Destination *</Label>
                      <Select value={formData.destination} onValueChange={(v) => setFormData(f => ({ ...f, destination: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto_consommation">Auto-consommation</SelectItem>
                          <SelectItem value="vente">Vente</SelectItem>
                          <SelectItem value="don">Don</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Prix vente (€)</Label><Input type="number" step="0.01" value={formData.prixVente} onChange={(e) => setFormData(f => ({ ...f, prixVente: e.target.value }))} disabled={formData.destination !== 'vente'} /></div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                    <Button type="submit" disabled={!formData.lotId}>Enregistrer</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {stats && (
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total animaux</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.totalAnimaux}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Poids vif total</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.poidsVifTotal.toFixed(1)} kg</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Poids carcasse</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.poidsCarcasseTotal.toFixed(1)} kg</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Revenus vente</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{stats.revenusVente.toFixed(2)} €</p></CardContent></Card>
          </div>
        )}

        <Card>
          <CardHeader><CardTitle>Historique des abattages</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Lot/Animal</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">P. vif</TableHead>
                    <TableHead className="text-right">P. carcasse</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead className="text-right">Prix</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {abattages.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{new Date(a.date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell>{a.lot?.nom || a.animal?.nom || '-'}</TableCell>
                      <TableCell className="text-right font-bold">{a.quantite}</TableCell>
                      <TableCell className="text-right">{a.poidsVif ? `${a.poidsVif} kg` : '-'}</TableCell>
                      <TableCell className="text-right">{a.poidsCarcasse ? `${a.poidsCarcasse} kg` : '-'}</TableCell>
                      <TableCell><Badge variant="outline">{DEST_LABELS[a.destination] || a.destination}</Badge></TableCell>
                      <TableCell className="text-right text-green-600">{a.prixVente ? `${a.prixVente.toFixed(2)} €` : '-'}</TableCell>
                    </TableRow>
                  ))}
                  {abattages.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun abattage enregistré</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
