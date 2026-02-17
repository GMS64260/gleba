"use client"

/**
 * Onglet Production - Oeufs + Ventes + Abattages en sous-onglets
 */

import * as React from "react"
import {
  Egg,
  ShoppingCart,
  Scissors,
  Plus,
  RefreshCw,
  Package,
  TrendingUp,
  Calendar,
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
import { useToast } from "@/hooks/use-toast"

// ============================================================
// Composant principal
// ============================================================

export function ProductionTab() {
  return (
    <Tabs defaultValue="oeufs" className="space-y-4">
      <TabsList>
        <TabsTrigger value="oeufs" className="flex items-center gap-1.5">
          <Egg className="h-4 w-4" />
          Oeufs
        </TabsTrigger>
        <TabsTrigger value="ventes" className="flex items-center gap-1.5">
          <ShoppingCart className="h-4 w-4" />
          Ventes
        </TabsTrigger>
        <TabsTrigger value="abattages" className="flex items-center gap-1.5">
          <Scissors className="h-4 w-4" />
          Abattages
        </TabsTrigger>
      </TabsList>

      <TabsContent value="oeufs">
        <OeufsSubTab />
      </TabsContent>
      <TabsContent value="ventes">
        <VentesSubTab />
      </TabsContent>
      <TabsContent value="abattages">
        <AbattagesSubTab />
      </TabsContent>
    </Tabs>
  )
}

// ============================================================
// Production d'Oeufs
// ============================================================

interface Production {
  id: number
  date: string
  quantite: number
  casses: number | null
  sales: number | null
  calibre: string | null
  notes: string | null
  lot: { id: number; nom: string } | null
  animal: { id: number; nom: string; identifiant: string } | null
}

interface LotVolaille {
  id: number
  nom: string | null
  quantiteActuelle: number
  especeAnimale: { nom: string; type: string }
}

interface OeufsStats {
  total: number
  casses: number
  sales: number
  nbEnregistrements: number
}

interface StockOeufs {
  stockNet: number
  detail: { produits: number; casses: number; vendus: number }
}

function OeufsSubTab() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [productions, setProductions] = React.useState<Production[]>([])
  const [lots, setLots] = React.useState<LotVolaille[]>([])
  const [stats, setStats] = React.useState<OeufsStats | null>(null)
  const [stockOeufs, setStockOeufs] = React.useState<StockOeufs | null>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  const [formData, setFormData] = React.useState({
    lotId: "", date: new Date().toISOString().split('T')[0],
    quantite: "", casses: "0", sales: "0", calibre: "", notes: "",
  })

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const [prodRes, lotsRes, statsRes] = await Promise.all([
        fetch('/api/elevage/production-oeufs?limit=100'),
        fetch('/api/elevage/lots?statut=actif'),
        fetch('/api/elevage/stats'),
      ])

      if (prodRes.ok) {
        const result = await prodRes.json()
        setProductions(result.data)
        setStats(result.stats)
      }
      if (lotsRes.ok) {
        const result = await lotsRes.json()
        setLots(result.data.filter((l: any) => l.especeAnimale.type === 'volaille'))
      }
      if (statsRes.ok) {
        const result = await statsRes.json()
        if (result.stats?.stockOeufs !== undefined) {
          setStockOeufs({
            stockNet: result.stats.stockOeufs,
            detail: result.stats.stockOeufsDetail || { produits: 0, casses: 0, vendus: 0 },
          })
        }
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les donnees" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/elevage/production-oeufs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: "Production enregistree", description: `${formData.quantite} oeufs ajoutes` })
      setIsDialogOpen(false)
      setFormData({ lotId: formData.lotId, date: new Date().toISOString().split('T')[0], quantite: "", casses: "0", sales: "0", calibre: "", notes: "" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer" })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cet enregistrement ?")) return
    try {
      await fetch(`/api/elevage/production-oeufs?id=${id}`, { method: 'DELETE' })
      toast({ title: "Enregistrement supprime" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  return (
    <div className="space-y-4">
      {/* Stock disponible + Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {stockOeufs && (
          <Card className={`bg-gradient-to-br ${stockOeufs.stockNet < 24 ? "from-orange-500 to-red-500" : "from-yellow-400 to-yellow-500"} text-white`}>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardDescription className="text-white/80 text-xs">Stock disponible</CardDescription>
              <CardTitle className="text-2xl">{stockOeufs.stockNet}</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              <p className="text-xs text-white/80">oeufs disponibles</p>
            </CardContent>
          </Card>
        )}
        {stats && (
          <>
            <Card>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardDescription className="text-xs">Total oeufs</CardDescription>
                <CardTitle className="text-2xl">{stats.total}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                <p className="text-xs text-muted-foreground">{stats.nbEnregistrements} collectes</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardDescription className="text-xs">Casses</CardDescription>
                <CardTitle className="text-2xl text-red-600">{stats.casses}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                <p className="text-xs text-muted-foreground">{stats.total > 0 ? ((stats.casses / stats.total) * 100).toFixed(1) : 0}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardDescription className="text-xs">Sales</CardDescription>
                <CardTitle className="text-2xl text-orange-600">{stats.sales}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                <p className="text-xs text-muted-foreground">{stats.total > 0 ? ((stats.sales / stats.total) * 100).toFixed(1) : 0}%</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Saisie rapide</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nouvelle production</DialogTitle>
              <DialogDescription>Enregistrer la collecte du jour</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Lot de pondeuses *</Label>
                <Select value={formData.lotId} onValueChange={(v) => setFormData(f => ({ ...f, lotId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selectionner le lot..." /></SelectTrigger>
                  <SelectContent>
                    {lots.map(lot => (
                      <SelectItem key={lot.id} value={lot.id.toString()}>
                        {lot.nom || `Lot #${lot.id}`} ({lot.quantiteActuelle} {lot.especeAnimale.nom})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Nombre d'oeufs *</Label>
                  <Input type="number" min="0" value={formData.quantite} onChange={(e) => setFormData(f => ({ ...f, quantite: e.target.value }))} placeholder="0" className="text-2xl font-bold text-center" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Casses</Label>
                  <Input type="number" min="0" value={formData.casses} onChange={(e) => setFormData(f => ({ ...f, casses: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Sales</Label>
                  <Input type="number" min="0" value={formData.sales} onChange={(e) => setFormData(f => ({ ...f, sales: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Calibre</Label>
                  <Select value={formData.calibre} onValueChange={(v) => setFormData(f => ({ ...f, calibre: v }))}>
                    <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="petit">Petit</SelectItem>
                      <SelectItem value="moyen">Moyen</SelectItem>
                      <SelectItem value="gros">Gros</SelectItem>
                      <SelectItem value="tres_gros">Tres gros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={!formData.lotId || !formData.quantite}>Enregistrer</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Historique des collectes</CardTitle>
          <CardDescription>100 derniers enregistrements</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead className="text-right">Oeufs</TableHead>
                  <TableHead className="text-right">Casses</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead>Calibre</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productions.map((prod) => (
                  <TableRow key={prod.id}>
                    <TableCell>{new Date(prod.date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>{prod.lot?.nom || prod.animal?.nom || '-'}</TableCell>
                    <TableCell className="text-right font-bold">{prod.quantite}</TableCell>
                    <TableCell className="text-right text-red-600">{prod.casses || 0}</TableCell>
                    <TableCell className="text-right text-orange-600">{prod.sales || 0}</TableCell>
                    <TableCell>{prod.calibre || '-'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{prod.notes || '-'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(prod.id)} className="text-red-600 hover:text-red-700">&times;</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {productions.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucune production enregistree</TableCell></TableRow>
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
// Ventes
// ============================================================

interface Vente {
  id: number
  date: string
  type: string
  description: string | null
  quantite: number
  unite: string
  prixUnitaire: number
  prixTotal: number
  client: string | null
  paye: boolean
  notes: string | null
}

const TYPE_LABELS: Record<string, string> = {
  oeufs: "Oeufs",
  viande: "Viande",
  animal_vivant: "Animal vivant",
  lait: "Lait",
  autre: "Autre",
}

function VentesSubTab() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [ventes, setVentes] = React.useState<Vente[]>([])
  const [stats, setStats] = React.useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  const [formData, setFormData] = React.useState({
    date: new Date().toISOString().split('T')[0],
    type: "oeufs", description: "", quantite: "", unite: "douzaine",
    prixUnitaire: "", client: "", paye: true, notes: "",
  })

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/elevage/ventes?limit=100')
      if (response.ok) {
        const result = await response.json()
        setVentes(result.data)
        setStats(result.stats)
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les ventes" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/elevage/ventes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) throw new Error('Erreur')
      const total = parseFloat(formData.quantite) * parseFloat(formData.prixUnitaire)
      toast({ title: "Vente enregistree", description: `${total.toFixed(2)} \u20ac` })
      setIsDialogOpen(false)
      setFormData({ date: new Date().toISOString().split('T')[0], type: "oeufs", description: "", quantite: "", unite: "douzaine", prixUnitaire: "", client: "", paye: true, notes: "" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer" })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette vente ?")) return
    try {
      await fetch(`/api/elevage/ventes?id=${id}`, { method: 'DELETE' })
      toast({ title: "Vente supprimee" })
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
          <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardDescription className="text-green-100 text-xs">Chiffre d'affaires</CardDescription>
              <CardTitle className="text-2xl">{stats.totalVentes.toFixed(2)} &euro;</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardDescription className="text-xs">Nombre de ventes</CardDescription>
              <CardTitle className="text-2xl">{stats.nbVentes}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardDescription className="text-xs">Panier moyen</CardDescription>
              <CardTitle className="text-2xl">{stats.nbVentes > 0 ? (stats.totalVentes / stats.nbVentes).toFixed(2) : 0} &euro;</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Nouvelle vente</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Enregistrer une vente</DialogTitle>
              <DialogDescription>Oeufs, viande, animaux vivants...</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Type *</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData(f => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oeufs">Oeufs</SelectItem>
                      <SelectItem value="viande">Viande</SelectItem>
                      <SelectItem value="animal_vivant">Animal vivant</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={formData.description} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))} placeholder="Oeufs plein air, Poulet fermier..." />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Quantite *</Label>
                  <Input type="number" step="0.01" value={formData.quantite} onChange={(e) => setFormData(f => ({ ...f, quantite: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Unite *</Label>
                  <Select value={formData.unite} onValueChange={(v) => setFormData(f => ({ ...f, unite: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unite">Unite</SelectItem>
                      <SelectItem value="douzaine">Douzaine</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="L">Litre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prix unit. *</Label>
                  <Input type="number" step="0.01" value={formData.prixUnitaire} onChange={(e) => setFormData(f => ({ ...f, prixUnitaire: e.target.value }))} placeholder="\u20ac" />
                </div>
              </div>
              {formData.quantite && formData.prixUnitaire && (
                <div className="text-center py-2 bg-green-50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Total: </span>
                  <span className="text-xl font-bold text-green-700">
                    {(parseFloat(formData.quantite) * parseFloat(formData.prixUnitaire)).toFixed(2)} &euro;
                  </span>
                </div>
              )}
              <div className="space-y-2">
                <Label>Client</Label>
                <Input value={formData.client} onChange={(e) => setFormData(f => ({ ...f, client: e.target.value }))} placeholder="Nom du client (optionnel)" />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={!formData.quantite || !formData.prixUnitaire}>Enregistrer</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qte</TableHead>
                  <TableHead className="text-right">P.U.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventes.map((vente) => (
                  <TableRow key={vente.id}>
                    <TableCell>{new Date(vente.date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell><Badge variant="outline">{TYPE_LABELS[vente.type] || vente.type}</Badge></TableCell>
                    <TableCell>{vente.description || '-'}</TableCell>
                    <TableCell className="text-right">{vente.quantite} {vente.unite}</TableCell>
                    <TableCell className="text-right">{vente.prixUnitaire.toFixed(2)} &euro;</TableCell>
                    <TableCell className="text-right font-bold text-green-600">{vente.prixTotal.toFixed(2)} &euro;</TableCell>
                    <TableCell>{vente.client || '-'}</TableCell>
                    <TableCell>
                      <Badge className={vente.paye ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>
                        {vente.paye ? "Paye" : "A payer"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(vente.id)} className="text-red-600 hover:text-red-700">&times;</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {ventes.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucune vente enregistree</TableCell></TableRow>
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
// Abattages
// ============================================================

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

interface LotActif { id: number; nom: string | null; quantiteActuelle: number; especeAnimale: { nom: string } }

const DEST_LABELS: Record<string, string> = {
  auto_consommation: "Auto-consommation",
  vente: "Vente",
  don: "Don",
}

function AbattagesSubTab() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [abattages, setAbattages] = React.useState<Abattage[]>([])
  const [lots, setLots] = React.useState<LotActif[]>([])
  const [stats, setStats] = React.useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  const [formData, setFormData] = React.useState({
    lotId: "", date: new Date().toISOString().split('T')[0], quantite: "1",
    poidsVif: "", poidsCarcasse: "", destination: "auto_consommation", prixVente: "", lieu: "", notes: "",
  })

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const [abatRes, lotsRes] = await Promise.all([
        fetch('/api/elevage/abattages?limit=100'),
        fetch('/api/elevage/lots?statut=actif'),
      ])
      if (abatRes.ok) { const r = await abatRes.json(); setAbattages(r.data); setStats(r.stats) }
      if (lotsRes.ok) setLots((await lotsRes.json()).data)
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les donnees" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/elevage/abattages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: "Abattage enregistre" })
      setIsDialogOpen(false)
      setFormData({ lotId: "", date: new Date().toISOString().split('T')[0], quantite: "1", poidsVif: "", poidsCarcasse: "", destination: "auto_consommation", prixVente: "", lieu: "", notes: "" })
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer" })
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardDescription className="text-xs">Total animaux</CardDescription>
              <CardTitle className="text-2xl">{stats.totalAnimaux}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardDescription className="text-xs">Poids vif total</CardDescription>
              <CardTitle className="text-2xl">{stats.poidsVifTotal.toFixed(1)} kg</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardDescription className="text-xs">Poids carcasse</CardDescription>
              <CardTitle className="text-2xl">{stats.poidsCarcasseTotal.toFixed(1)} kg</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardDescription className="text-green-100 text-xs">Revenus vente</CardDescription>
              <CardTitle className="text-2xl">{stats.revenusVente.toFixed(2)} &euro;</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Nouvel abattage</Button>
          </DialogTrigger>
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
                <div className="space-y-2"><Label>Quantite</Label><Input type="number" min="1" value={formData.quantite} onChange={(e) => setFormData(f => ({ ...f, quantite: e.target.value }))} /></div>
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
                <div className="space-y-2"><Label>Prix vente</Label><Input type="number" step="0.01" value={formData.prixVente} onChange={(e) => setFormData(f => ({ ...f, prixVente: e.target.value }))} disabled={formData.destination !== 'vente'} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={!formData.lotId}>Enregistrer</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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
                  <TableHead>Lot/Animal</TableHead>
                  <TableHead className="text-right">Qte</TableHead>
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
                    <TableCell className="text-right text-green-600">{a.prixVente ? `${a.prixVente.toFixed(2)} \u20ac` : '-'}</TableCell>
                  </TableRow>
                ))}
                {abattages.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun abattage enregistre</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
