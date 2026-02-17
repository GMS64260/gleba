"use client"

/**
 * Page Ventes de Produits
 */

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ShoppingCart,
  Plus,
  RefreshCw,
  TrendingUp,
  Egg,
  Bird,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

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

const TYPE_ICONS: Record<string, any> = {
  oeufs: Egg,
  animal_vivant: Bird,
}

export default function VentesPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [ventes, setVentes] = React.useState<Vente[]>([])
  const [stats, setStats] = React.useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  // Form state
  const [formData, setFormData] = React.useState({
    date: new Date().toISOString().split('T')[0],
    type: "oeufs",
    description: "",
    quantite: "",
    unite: "douzaine",
    prixUnitaire: "",
    client: "",
    paye: true,
    notes: "",
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
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les ventes",
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
      const response = await fetch('/api/elevage/ventes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          paye: formData.paye,
        }),
      })

      if (!response.ok) throw new Error('Erreur création')

      const total = parseFloat(formData.quantite) * parseFloat(formData.prixUnitaire)
      toast({
        title: "Vente enregistrée",
        description: `${total.toFixed(2)} €`,
      })
      setIsDialogOpen(false)
      setFormData({
        date: new Date().toISOString().split('T')[0],
        type: "oeufs",
        description: "",
        quantite: "",
        unite: "douzaine",
        prixUnitaire: "",
        client: "",
        paye: true,
        notes: "",
      })
      fetchData()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'enregistrer la vente",
      })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette vente ?")) return

    try {
      const response = await fetch(`/api/elevage/ventes?id=${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Erreur suppression')
      toast({ title: "Vente supprimée" })
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
              <ShoppingCart className="h-6 w-6 text-green-600" />
              <h1 className="text-xl font-bold">Ventes</h1>
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
                  Nouvelle vente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Enregistrer une vente</DialogTitle>
                  <DialogDescription>
                    Oeufs, viande, animaux vivants...
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
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
                      <Label>Type *</Label>
                      <Select
                        value={formData.type}
                        onValueChange={(v) => setFormData(f => ({ ...f, type: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
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
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                      placeholder="Oeufs plein air, Poulet fermier..."
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Quantité *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.quantite}
                        onChange={(e) => setFormData(f => ({ ...f, quantite: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unité *</Label>
                      <Select
                        value={formData.unite}
                        onValueChange={(v) => setFormData(f => ({ ...f, unite: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unite">Unité</SelectItem>
                          <SelectItem value="douzaine">Douzaine</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="L">Litre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Prix unit. *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.prixUnitaire}
                        onChange={(e) => setFormData(f => ({ ...f, prixUnitaire: e.target.value }))}
                        placeholder="€"
                      />
                    </div>
                  </div>
                  {formData.quantite && formData.prixUnitaire && (
                    <div className="text-center py-2 bg-green-50 rounded-lg">
                      <span className="text-sm text-muted-foreground">Total: </span>
                      <span className="text-xl font-bold text-green-700">
                        {(parseFloat(formData.quantite) * parseFloat(formData.prixUnitaire)).toFixed(2)} €
                      </span>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Client</Label>
                    <Input
                      value={formData.client}
                      onChange={(e) => setFormData(f => ({ ...f, client: e.target.value }))}
                      placeholder="Nom du client (optionnel)"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button type="submit" disabled={!formData.quantite || !formData.prixUnitaire}>
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
        {/* Stats */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  Chiffre d'affaires
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  {stats.totalVentes.toFixed(2)} €
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Nombre de ventes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.nbVentes}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Panier moyen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {stats.nbVentes > 0 ? (stats.totalVentes / stats.nbVentes).toFixed(2) : 0} €
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Historique des ventes</CardTitle>
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
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
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
                      <TableCell>
                        {new Date(vente.date).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {TYPE_LABELS[vente.type] || vente.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{vente.description || '-'}</TableCell>
                      <TableCell className="text-right">
                        {vente.quantite} {vente.unite}
                      </TableCell>
                      <TableCell className="text-right">
                        {vente.prixUnitaire.toFixed(2)} €
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {vente.prixTotal.toFixed(2)} €
                      </TableCell>
                      <TableCell>{vente.client || '-'}</TableCell>
                      <TableCell>
                        <Badge className={vente.paye ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>
                          {vente.paye ? "Payé" : "À payer"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(vente.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          ×
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {ventes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Aucune vente enregistrée
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
