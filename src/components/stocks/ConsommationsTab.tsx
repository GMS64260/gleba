"use client"

/**
 * Onglet Consommations - Sorties de stock
 * Ventes, dons, autoconsommation
 */

import * as React from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Plus, Trash2, TrendingDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Consommation {
  id: number
  date: string
  especeId: string
  quantite: number
  prix: number | null
  destinationId: string | null
  notes: string | null
  espece: {
    id: string
    couleur: string | null
    prixKg: number | null
  }
  destination: {
    id: string
    description: string | null
  } | null
}

interface StockNetData {
  stockNet: number
  detail: {
    inventaire: number
    recoltes: number
    consommations: number
  }
}

export function ConsommationsTab() {
  const { toast } = useToast()
  const [consommations, setConsommations] = React.useState<Consommation[]>([])
  const [stocksNet, setStocksNet] = React.useState<Record<string, StockNetData>>({})
  const [especes, setEspeces] = React.useState<{ id: string; prixKg: number | null }[]>([])
  const [destinations, setDestinations] = React.useState<{ id: string; description: string | null }[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)

  // Formulaire
  const [formData, setFormData] = React.useState({
    especeId: '',
    quantite: '',
    prix: '',
    destinationId: '',
    notes: '',
  })

  // Charger données
  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const [consosRes, especesRes, destsRes] = await Promise.all([
        fetch('/api/consommations'),
        fetch('/api/especes?pageSize=500'),
        fetch('/api/destinations'),
      ])

      if (consosRes.ok) {
        const data = await consosRes.json()
        setConsommations(data.consommations || [])
        setStocksNet(data.stocksNet || {})
      }

      if (especesRes.ok) {
        const data = await especesRes.json()
        setEspeces(data.data || data.especes || [])
      }

      if (destsRes.ok) {
        const data = await destsRes.json()
        setDestinations(data.data || data.destinations || [])
      }
    } catch (error) {
      console.error('Erreur chargement:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Créer consommation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.especeId || !formData.quantite) {
      toast({
        variant: "destructive",
        title: "Champs manquants",
        description: "Espèce et quantité sont requis",
      })
      return
    }

    try {
      const response = await fetch('/api/consommations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          especeId: formData.especeId,
          quantite: parseFloat(formData.quantite),
          prix: formData.prix ? parseFloat(formData.prix) : undefined,
          destinationId: formData.destinationId || undefined,
          notes: formData.notes || undefined,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error)
      }

      toast({
        title: "Sortie enregistrée",
        description: `${formData.quantite} kg de ${formData.especeId}`,
      })

      setDialogOpen(false)
      setFormData({ especeId: '', quantite: '', prix: '', destinationId: '', notes: '' })
      fetchData()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'enregistrer",
      })
    }
  }

  // Supprimer consommation
  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette sortie de stock ?')) return

    try {
      const response = await fetch(`/api/consommations/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Erreur suppression')

      toast({ title: "Sortie supprimée" })
      fetchData()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer",
      })
    }
  }

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />
  }

  // Top 5 espèces par stock net
  const topStocks = Object.entries(stocksNet)
    .sort(([, a], [, b]) => b.stockNet - a.stockNet)
    .slice(0, 5)

  return (
    <div className="space-y-4">
      {/* Stocks nets */}
      {topStocks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {topStocks.map(([especeId, stock]) => (
            <Card key={especeId}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium truncate">{especeId}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stock.stockNet.toFixed(1)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">kg</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Stock net actuel
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Header avec bouton */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Sorties de stock</h3>
          <p className="text-sm text-muted-foreground">
            {consommations.length} sortie(s) enregistrée(s)
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle sortie
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Enregistrer une sortie de stock</DialogTitle>
                <DialogDescription>
                  Vente, don, autoconsommation...
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="espece">Espèce *</Label>
                  <Select value={formData.especeId} onValueChange={(v) => setFormData(prev => ({ ...prev, especeId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une espèce" />
                    </SelectTrigger>
                    <SelectContent>
                      {especes.map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.id}
                          {stocksNet[e.id] && ` (stock: ${stocksNet[e.id].stockNet.toFixed(1)} kg)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantite">Quantité (kg) *</Label>
                    <Input
                      id="quantite"
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={formData.quantite}
                      onChange={(e) => setFormData(prev => ({ ...prev, quantite: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prix">Prix total (€)</Label>
                    <Input
                      id="prix"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.prix}
                      onChange={(e) => setFormData(prev => ({ ...prev, prix: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="destination">Destination</Label>
                  <Select value={formData.destinationId} onValueChange={(v) => setFormData(prev => ({ ...prev, destinationId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {destinations.map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.id} {d.description && `- ${d.description}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Remarques..."
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit">Enregistrer</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Liste des consommations */}
      {consommations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <TrendingDown className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Aucune sortie de stock enregistrée</p>
          <p className="text-sm mt-1">Cliquez sur "Nouvelle sortie" pour commencer</p>
        </div>
      ) : (
        <div className="space-y-2">
          {consommations.map(conso => {
            const stockNet = stocksNet[conso.especeId]
            return (
              <div
                key={conso.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white rounded-lg border gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {conso.espece.couleur && (
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: conso.espece.couleur }}
                      />
                    )}
                    <span className="font-medium break-words">{conso.especeId}</span>
                    <Badge variant="secondary" className="text-xs">
                      {format(new Date(conso.date), "dd MMM yyyy", { locale: fr })}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                    <span className="font-medium text-red-600">- {conso.quantite} kg</span>
                    {conso.prix && (
                      <span className="text-green-600">{conso.prix.toFixed(2)} €</span>
                    )}
                    {conso.destination && (
                      <span>{conso.destination.id}</span>
                    )}
                    {stockNet && (
                      <span className="text-xs">
                        Stock: {stockNet.stockNet.toFixed(1)} kg
                      </span>
                    )}
                  </div>

                  {conso.notes && (
                    <p className="text-xs text-muted-foreground mt-1 break-words">{conso.notes}</p>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(conso.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
