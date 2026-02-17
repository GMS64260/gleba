"use client"

/**
 * Page Production d'Oeufs
 */

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Egg,
  Plus,
  RefreshCw,
  Calendar,
  TrendingUp,
  Package,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

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

interface Lot {
  id: number
  nom: string | null
  quantiteActuelle: number
  especeAnimale: { nom: string; type: string }
}

interface Stats {
  total: number
  casses: number
  sales: number
  nbEnregistrements: number
}

interface StockOeufs {
  stockNet: number
  detail: { produits: number; casses: number; vendus: number }
}

export default function ProductionOeufsPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [productions, setProductions] = React.useState<Production[]>([])
  const [lots, setLots] = React.useState<Lot[]>([])
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [stockOeufs, setStockOeufs] = React.useState<StockOeufs | null>(null)

  // Form state
  const [formData, setFormData] = React.useState({
    lotId: "",
    date: new Date().toISOString().split('T')[0],
    quantite: "",
    casses: "0",
    sales: "0",
    calibre: "",
    notes: "",
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
        // Filtrer les lots de volailles
        const lotsVolailles = result.data.filter((l: any) =>
          l.especeAnimale.type === 'volaille'
        )
        setLots(lotsVolailles)
      }
      if (statsRes.ok) {
        const result = await statsRes.json()
        if (result.stockOeufs !== undefined) {
          setStockOeufs({
            stockNet: result.stockOeufs,
            detail: result.stockOeufsDetail || { produits: 0, casses: 0, vendus: 0 },
          })
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les données",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/elevage/production-oeufs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Erreur création')

      toast({
        title: "Production enregistrée",
        description: `${formData.quantite} oeufs ajoutés`,
      })
      setIsDialogOpen(false)
      setFormData({
        lotId: formData.lotId, // Garder le lot sélectionné
        date: new Date().toISOString().split('T')[0],
        quantite: "",
        casses: "0",
        sales: "0",
        calibre: "",
        notes: "",
      })
      fetchData()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'enregistrer la production",
      })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cet enregistrement ?")) return

    try {
      const response = await fetch(`/api/elevage/production-oeufs?id=${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Erreur suppression')
      toast({ title: "Enregistrement supprimé" })
      fetchData()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer",
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/elevage">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Élevage
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Egg className="h-6 w-6 text-yellow-600" />
              <h1 className="text-xl font-bold">Production d'Oeufs</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Saisie rapide
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Nouvelle production</DialogTitle>
                  <DialogDescription>
                    Enregistrer la collecte du jour
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Lot de pondeuses *</Label>
                    <Select
                      value={formData.lotId}
                      onValueChange={(v) => setFormData(f => ({ ...f, lotId: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le lot..." />
                      </SelectTrigger>
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
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData(f => ({ ...f, date: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nombre d'oeufs *</Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.quantite}
                        onChange={(e) => setFormData(f => ({ ...f, quantite: e.target.value }))}
                        placeholder="0"
                        className="text-2xl font-bold text-center"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Cassés</Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.casses}
                        onChange={(e) => setFormData(f => ({ ...f, casses: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sales</Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.sales}
                        onChange={(e) => setFormData(f => ({ ...f, sales: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Calibre</Label>
                      <Select
                        value={formData.calibre}
                        onValueChange={(v) => setFormData(f => ({ ...f, calibre: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="petit">Petit</SelectItem>
                          <SelectItem value="moyen">Moyen</SelectItem>
                          <SelectItem value="gros">Gros</SelectItem>
                          <SelectItem value="tres_gros">Très gros</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button type="submit" disabled={!formData.lotId || !formData.quantite}>
                      Enregistrer
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Stock disponible */}
        {stockOeufs && (
          <Card className={`mb-6 ${stockOeufs.stockNet < 24 ? 'border-orange-300 bg-orange-50' : 'border-green-300 bg-green-50'}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Package className={`h-4 w-4 ${stockOeufs.stockNet < 24 ? 'text-orange-600' : 'text-green-600'}`} />
                Stock disponible
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${stockOeufs.stockNet < 24 ? 'text-orange-700' : 'text-green-700'}`}>
                {stockOeufs.stockNet} oeufs
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stockOeufs.detail.produits} produits - {stockOeufs.detail.casses} cassés - {stockOeufs.detail.vendus} vendus
              </p>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Egg className="h-4 w-4 text-yellow-600" />
                  Total oeufs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Cassés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{stats.casses}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.total > 0 ? ((stats.casses / stats.total) * 100).toFixed(1) : 0}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Sales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-orange-600">{stats.sales}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.total > 0 ? ((stats.sales / stats.total) * 100).toFixed(1) : 0}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Enregistrements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.nbEnregistrements}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Historique des collectes</CardTitle>
            <CardDescription>100 derniers enregistrements</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead className="text-right">Oeufs</TableHead>
                    <TableHead className="text-right">Cassés</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead>Calibre</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productions.map((prod) => (
                    <TableRow key={prod.id}>
                      <TableCell>
                        {new Date(prod.date).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell>
                        {prod.lot?.nom || prod.animal?.nom || '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {prod.quantite}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {prod.casses || 0}
                      </TableCell>
                      <TableCell className="text-right text-orange-600">
                        {prod.sales || 0}
                      </TableCell>
                      <TableCell>{prod.calibre || '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {prod.notes || '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(prod.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          ×
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {productions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Aucune production enregistrée
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
