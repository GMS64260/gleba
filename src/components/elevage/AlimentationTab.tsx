"use client"

/**
 * Onglet Alimentation - Stocks aliments + Consommations + Soins en sous-onglets
 */

import * as React from "react"
import {
  Package,
  TrendingDown,
  Stethoscope,
  Plus,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Check,
  Trash2,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"

// ============================================================
// Composant principal
// ============================================================

export function AlimentationTab() {
  return (
    <Tabs defaultValue="stocks" className="space-y-4">
      <TabsList>
        <TabsTrigger value="stocks" className="flex items-center gap-1.5">
          <Package className="h-4 w-4" />
          Stocks
        </TabsTrigger>
        <TabsTrigger value="consommations" className="flex items-center gap-1.5">
          <TrendingDown className="h-4 w-4" />
          Consommations
        </TabsTrigger>
        <TabsTrigger value="soins" className="flex items-center gap-1.5">
          <Stethoscope className="h-4 w-4" />
          Soins
        </TabsTrigger>
      </TabsList>

      <TabsContent value="stocks">
        <StocksSubTab />
      </TabsContent>
      <TabsContent value="consommations">
        <ConsommationsSubTab />
      </TabsContent>
      <TabsContent value="soins">
        <SoinsSubTab />
      </TabsContent>
    </Tabs>
  )
}

// ============================================================
// Stocks Aliments
// ============================================================

interface Aliment {
  id: string
  nom: string
  type: string | null
  especesCibles: string | null
  proteines: number | null
  prix: number | null
  stock: number | null
  stockMin: number | null
  dateStock: string | null
  fournisseur: { id: string; contact: string | null } | null
  _count: { consommations: number }
}

function StocksSubTab() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [aliments, setAliments] = React.useState<Aliment[]>([])
  const [stats, setStats] = React.useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingStock, setEditingStock] = React.useState<string | null>(null)
  const [newStock, setNewStock] = React.useState("")

  const [formData, setFormData] = React.useState({
    id: "", nom: "", type: "granules", especesCibles: "", prix: "", stock: "", stockMin: "", description: "",
  })

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/elevage/aliments')
      if (response.ok) {
        const result = await response.json()
        setAliments(result.data)
        setStats(result.stats)
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les aliments" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/elevage/aliments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: "Aliment cree" })
      setIsDialogOpen(false)
      setFormData({ id: "", nom: "", type: "granules", especesCibles: "", prix: "", stock: "", stockMin: "", description: "" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de creer l'aliment" })
    }
  }

  const updateStock = async (id: string) => {
    try {
      const response = await fetch('/api/elevage/aliments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, stock: parseFloat(newStock) }),
      })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: "Stock mis a jour" })
      setEditingStock(null)
      setNewStock("")
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  return (
    <div className="space-y-4">
      {stats && stats.stockBas > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-orange-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alerte stock bas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-800">{stats.stockBas} aliment(s) en dessous du seuil minimum</p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Nouvel aliment</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Ajouter un aliment</DialogTitle>
              <DialogDescription>Granules, cereales, foin...</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>ID *</Label><Input value={formData.id} onChange={(e) => setFormData(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s/g, '_') }))} placeholder="granules_pondeuses" /></div>
                <div className="space-y-2"><Label>Nom *</Label><Input value={formData.nom} onChange={(e) => setFormData(f => ({ ...f, nom: e.target.value }))} placeholder="Granules pondeuses" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Prix (&euro;/kg)</Label><Input type="number" step="0.01" value={formData.prix} onChange={(e) => setFormData(f => ({ ...f, prix: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Stock (kg)</Label><Input type="number" step="0.1" value={formData.stock} onChange={(e) => setFormData(f => ({ ...f, stock: e.target.value }))} /></div>
              </div>
              <div className="space-y-2"><Label>Stock minimum (alerte)</Label><Input type="number" step="0.1" value={formData.stockMin} onChange={(e) => setFormData(f => ({ ...f, stockMin: e.target.value }))} /></div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={!formData.id || !formData.nom}>Creer</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aliment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Prix/kg</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Seuil min</TableHead>
                  <TableHead>MAJ</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aliments.map((a) => {
                  const stockBas = a.stock !== null && a.stockMin !== null && a.stock <= a.stockMin
                  return (
                    <TableRow key={a.id} className={stockBas ? "bg-orange-50" : ""}>
                      <TableCell className="font-medium">{a.nom}</TableCell>
                      <TableCell><Badge variant="outline">{a.type || '-'}</Badge></TableCell>
                      <TableCell className="text-right">{a.prix ? `${a.prix.toFixed(2)} \u20ac` : '-'}</TableCell>
                      <TableCell className="text-right">
                        {editingStock === a.id ? (
                          <div className="flex items-center gap-1 justify-end">
                            <Input type="number" step="0.1" value={newStock} onChange={(e) => setNewStock(e.target.value)} className="w-20 h-8" autoFocus />
                            <Button size="sm" variant="ghost" onClick={() => updateStock(a.id)}>&#10003;</Button>
                            <Button size="sm" variant="ghost" onClick={() => { setEditingStock(null); setNewStock("") }}>&times;</Button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingStock(a.id); setNewStock(a.stock?.toString() || "") }} className={`font-bold hover:underline ${stockBas ? 'text-orange-600' : ''}`}>
                            {a.stock !== null ? `${a.stock} kg` : '-'}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{a.stockMin !== null ? `${a.stockMin} kg` : '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{a.dateStock ? new Date(a.dateStock).toLocaleDateString('fr-FR') : '-'}</TableCell>
                      <TableCell>{stockBas && <AlertTriangle className="h-4 w-4 text-orange-500" />}</TableCell>
                    </TableRow>
                  )
                })}
                {aliments.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun aliment enregistre</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Consommations
// ============================================================

interface Consommation {
  id: number
  date: string
  quantite: number
  notes: string | null
  aliment: { id: string; nom: string; type: string | null }
  lot: { id: number; nom: string | null } | null
}

interface AlimentSimple { id: string; nom: string; type: string | null }
interface LotSimple { id: number; nom: string | null; especeAnimale: { nom: string } }

interface ConsoStats {
  totalKg: number
  nbEnregistrements: number
  parAliment: { alimentId: string; nom: string; totalKg: number; count: number }[]
}

function ConsommationsSubTab() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [consommations, setConsommations] = React.useState<Consommation[]>([])
  const [aliments, setAliments] = React.useState<AlimentSimple[]>([])
  const [lots, setLots] = React.useState<LotSimple[]>([])
  const [stats, setStats] = React.useState<ConsoStats | null>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [filterDateDebut, setFilterDateDebut] = React.useState("")
  const [filterDateFin, setFilterDateFin] = React.useState("")

  const [formData, setFormData] = React.useState({
    alimentId: "", lotId: "", date: new Date().toISOString().split("T")[0], quantite: "", notes: "",
  })

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      let url = "/api/elevage/consommations-aliments?limit=200"
      if (filterDateDebut) url += `&dateDebut=${filterDateDebut}`
      if (filterDateFin) url += `&dateFin=${filterDateFin}`

      const [consRes, alimRes, lotsRes] = await Promise.all([
        fetch(url),
        fetch("/api/elevage/aliments"),
        fetch("/api/elevage/lots?statut=actif"),
      ])

      if (consRes.ok) { const r = await consRes.json(); setConsommations(r.data); setStats(r.stats) }
      if (alimRes.ok) setAliments((await alimRes.json()).data)
      if (lotsRes.ok) setLots((await lotsRes.json()).data)
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les donnees" })
    } finally {
      setIsLoading(false)
    }
  }, [toast, filterDateDebut, filterDateFin])

  React.useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch("/api/elevage/consommations-aliments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alimentId: formData.alimentId,
          lotId: formData.lotId ? parseInt(formData.lotId) : null,
          date: formData.date,
          quantite: parseFloat(formData.quantite),
          notes: formData.notes || null,
        }),
      })
      if (!response.ok) throw new Error("Erreur")
      toast({ title: "Consommation enregistree", description: `${formData.quantite} kg ajoutes` })
      setIsDialogOpen(false)
      setFormData({ alimentId: formData.alimentId, lotId: formData.lotId, date: new Date().toISOString().split("T")[0], quantite: "", notes: "" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer" })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette consommation ? Le stock sera restaure.")) return
    try {
      await fetch(`/api/elevage/consommations-aliments?id=${id}`, { method: "DELETE" })
      toast({ title: "Consommation supprimee, stock restaure" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid gap-3 grid-cols-3">
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardDescription className="text-xs">Total consomme</CardDescription>
              <CardTitle className="text-2xl">{stats.totalKg.toFixed(1)} kg</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              <p className="text-xs text-muted-foreground">{stats.nbEnregistrements} enregistrements</p>
            </CardContent>
          </Card>
          {stats.parAliment.slice(0, 2).map((a) => (
            <Card key={a.alimentId}>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardDescription className="text-xs">{a.nom}</CardDescription>
                <CardTitle className="text-2xl">{a.totalKg.toFixed(1)} kg</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                <p className="text-xs text-muted-foreground">{a.count} distributions</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filtres et actions */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={filterDateDebut} onChange={(e) => setFilterDateDebut(e.target.value)} className="w-[150px]" />
          <span className="text-muted-foreground">au</span>
          <Input type="date" value={filterDateFin} onChange={(e) => setFilterDateFin(e.target.value)} className="w-[150px]" />
          {(filterDateDebut || filterDateFin) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterDateDebut(""); setFilterDateFin("") }}>Effacer</Button>
          )}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Saisie rapide</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nouvelle consommation</DialogTitle>
                <DialogDescription>Enregistrer une distribution d'aliment</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Aliment *</Label>
                  <Select value={formData.alimentId} onValueChange={(v) => setFormData(f => ({ ...f, alimentId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selectionner l'aliment..." /></SelectTrigger>
                    <SelectContent>{aliments.map(a => <SelectItem key={a.id} value={a.id}>{a.nom}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Lot (optionnel)</Label>
                  <Select value={formData.lotId} onValueChange={(v) => setFormData(f => ({ ...f, lotId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Tous les animaux" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Tous</SelectItem>
                      {lots.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.nom || `Lot #${l.id}`} ({l.especeAnimale.nom})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Date</Label><Input type="date" value={formData.date} onChange={(e) => setFormData(f => ({ ...f, date: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Quantite (kg) *</Label><Input type="number" min="0" step="0.1" value={formData.quantite} onChange={(e) => setFormData(f => ({ ...f, quantite: e.target.value }))} placeholder="0" /></div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                  <Button type="submit" disabled={!formData.alimentId || !formData.quantite}>Enregistrer</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Aliment</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead className="text-right">Quantite</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consommations.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{new Date(c.date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell className="font-medium">{c.aliment.nom}</TableCell>
                    <TableCell>{c.lot?.nom || (c.lot ? `Lot #${c.lot.id}` : "-")}</TableCell>
                    <TableCell className="text-right font-bold">{c.quantite} kg</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{c.notes || "-"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {consommations.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune consommation enregistree</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Soins
// ============================================================

interface Soin {
  id: number
  date: string
  type: string
  description: string | null
  produit: string | null
  quantite: number | null
  unite: string | null
  cout: number | null
  veterinaire: string | null
  datePrevue: string | null
  fait: boolean
  notes: string | null
  animal: { id: number; nom: string; identifiant: string } | null
  lot: { id: number; nom: string } | null
}

interface LotSoin { id: number; nom: string | null; quantiteActuelle: number }

const SOIN_TYPE_LABELS: Record<string, string> = {
  vaccination: "Vaccination",
  vermifuge: "Vermifuge",
  traitement: "Traitement",
  autre: "Autre",
}

function SoinsSubTab() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [soins, setSoins] = React.useState<Soin[]>([])
  const [lots, setLots] = React.useState<LotSoin[]>([])
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [filterFait, setFilterFait] = React.useState<string>("all")

  const [formData, setFormData] = React.useState({
    lotId: "", date: new Date().toISOString().split('T')[0], type: "vaccination",
    description: "", produit: "", quantite: "", unite: "", cout: "", fait: true, notes: "",
  })

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      let url = '/api/elevage/soins?limit=100'
      if (filterFait !== 'all') url += `&fait=${filterFait}`
      const [soinsRes, lotsRes] = await Promise.all([fetch(url), fetch('/api/elevage/lots?statut=actif')])
      if (soinsRes.ok) setSoins((await soinsRes.json()).data)
      if (lotsRes.ok) setLots((await lotsRes.json()).data)
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les donnees" })
    } finally {
      setIsLoading(false)
    }
  }, [filterFait, toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/elevage/soins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: "Soin enregistre" })
      setIsDialogOpen(false)
      setFormData({ lotId: "", date: new Date().toISOString().split('T')[0], type: "vaccination", description: "", produit: "", quantite: "", unite: "", cout: "", fait: true, notes: "" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer le soin" })
    }
  }

  const toggleFait = async (id: number, fait: boolean) => {
    try {
      const response = await fetch('/api/elevage/soins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, fait: !fait, date: !fait ? new Date().toISOString() : undefined }),
      })
      if (!response.ok) throw new Error('Erreur')
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtres + Actions */}
      <div className="flex items-center gap-3">
        <Select value={filterFait} onValueChange={setFilterFait}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="false">A faire</SelectItem>
            <SelectItem value="true">Faits</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Nouveau soin</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Enregistrer un soin</DialogTitle><DialogDescription>Vaccination, vermifuge, traitement...</DialogDescription></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Lot *</Label>
                    <Select value={formData.lotId} onValueChange={(v) => setFormData(f => ({ ...f, lotId: v }))}>
                      <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent>{lots.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.nom || `Lot #${l.id}`}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type *</Label>
                    <Select value={formData.type} onValueChange={(v) => setFormData(f => ({ ...f, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vaccination">Vaccination</SelectItem>
                        <SelectItem value="vermifuge">Vermifuge</SelectItem>
                        <SelectItem value="traitement">Traitement</SelectItem>
                        <SelectItem value="autre">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Date</Label><Input type="date" value={formData.date} onChange={(e) => setFormData(f => ({ ...f, date: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Produit</Label><Input value={formData.produit} onChange={(e) => setFormData(f => ({ ...f, produit: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Quantite</Label><Input type="number" step="0.01" value={formData.quantite} onChange={(e) => setFormData(f => ({ ...f, quantite: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Unite</Label><Input value={formData.unite} onChange={(e) => setFormData(f => ({ ...f, unite: e.target.value }))} placeholder="mL, doses..." /></div>
                  <div className="space-y-2"><Label>Cout (&euro;)</Label><Input type="number" step="0.01" value={formData.cout} onChange={(e) => setFormData(f => ({ ...f, cout: e.target.value }))} /></div>
                </div>
                <div className="space-y-2"><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
                <div className="flex items-center gap-2">
                  <Checkbox id="fait" checked={formData.fait} onCheckedChange={(c) => setFormData(f => ({ ...f, fait: !!c }))} />
                  <Label htmlFor="fait">Deja effectue</Label>
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

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Lot/Animal</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead className="text-right">Cout</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {soins.map((soin) => (
                  <TableRow key={soin.id} className={!soin.fait ? "bg-blue-50" : ""}>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => toggleFait(soin.id, soin.fait)} className={soin.fait ? "text-green-600" : "text-gray-400"}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </TableCell>
                    <TableCell>{new Date(soin.date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell><Badge variant="outline">{SOIN_TYPE_LABELS[soin.type] || soin.type}</Badge></TableCell>
                    <TableCell>{soin.lot?.nom || soin.animal?.nom || '-'}</TableCell>
                    <TableCell>{soin.produit || '-'}</TableCell>
                    <TableCell className="text-right">{soin.cout ? `${soin.cout.toFixed(2)} \u20ac` : '-'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{soin.notes || '-'}</TableCell>
                  </TableRow>
                ))}
                {soins.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun soin enregistre</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
