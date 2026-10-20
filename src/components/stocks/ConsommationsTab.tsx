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
import { SelectNatif } from "@/components/ui/select-natif"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { libelleUniteQuantite, type UniteQuantite } from "@/lib/recolte/projection"
import { formatQuantite } from "@/lib/recolte/quantites"
import { uniteSortieAffichee } from "@/lib/stocks/unite-sortie"
import { formatMontantDevise } from "@/lib/format-utils"

interface Consommation {
  id: number
  date: string
  especeId: string
  quantite: number
  /** Unité du stock de l'espèce, servie par la route (QA cmvgef6ou). */
  unite?: UniteQuantite
  prix: number | null
  destinationId: string | null
  notes: string | null
  espece: {
    id: string
    nom?: string | null
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
  /** Unité du stock (kg, tige, pièce, botte) : celle de l'espèce pour la ferme. */
  unite?: UniteQuantite
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
  // `uniteRendement` : unité effective pour la ferme (surcharge comprise),
  // servie par /api/especes.
  const [especes, setEspeces] = React.useState<
    { id: string; nom?: string | null; prixKg: number | null; uniteRendement?: string | null }[]
  >([])
  const [destinations, setDestinations] = React.useState<{ id: string; description: string | null }[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Formulaire
  const [formData, setFormData] = React.useState({
    especeId: '',
    quantite: '',
    prix: '',
    destinationId: '',
    notes: '',
  })

  // QA cmvgef6ou — l'unité de la sortie est celle du stock de l'espèce,
  // servie par la route (`calculerStocksNet`) : 19 tiges de dahlia étaient
  // proposées « 19.0 kg » avec un champ « Quantité (kg) ». Sans stock (espèce
  // jamais récoltée), l'unité effective de l'espèce (revue du 2026-10-20).
  const uniteEspece = (especeId: string): UniteQuantite =>
    uniteSortieAffichee(stocksNet[especeId], especes.find((e) => e.id === especeId))
  const nomEspece = (especeId: string) => especes.find((e) => e.id === especeId)?.nom ?? especeId
  const uniteSaisie = formData.especeId ? uniteEspece(formData.especeId) : "kg"

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
    if (isSubmitting) return

    if (!formData.especeId || !formData.quantite) {
      toast({
        variant: "destructive",
        title: "Champs manquants",
        description: "Espèce et quantité sont requis",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/consommations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          especeId: formData.especeId,
          quantite: parseFloat(formData.quantite),
          // L'unité affichée : la route la confronte à celle du stock.
          unite: uniteSaisie,
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
        description: `${formatQuantite(parseFloat(formData.quantite), uniteSaisie)} de ${nomEspece(formData.especeId)}`,
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
    } finally {
      setIsSubmitting(false)
    }
  }

  // Supprimer consommation
  const handleDelete = async (id: number) => {
    if (!(await confirmDialog('Supprimer cette sortie de stock ?'))) return

    try {
      const response = await fetch(`/api/consommations/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Erreur suppression')

      toast({ title: "Sortie supprimée" })
      fetchData()
    } catch {
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

  // Top 5 especes par stock net
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
                <CardTitle className="text-sm font-medium truncate">{nomEspece(especeId)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatQuantite(stock.stockNet, stock.unite ?? "kg")}
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
                  {/* QA 2026-09-28 — <select> natif : voir SelectNatif. */}
                  <SelectNatif
                    id="espece"
                    name="especeId"
                    value={formData.especeId}
                    onChange={(e) => setFormData(prev => ({ ...prev, especeId: e.target.value }))}
                  >
                    <option value="">Choisir une espèce</option>
                    {especes.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.nom ?? e.id}
                        {stocksNet[e.id]
                          ? ` (stock : ${formatQuantite(stocksNet[e.id].stockNet, uniteEspece(e.id))})`
                          : ""}
                      </option>
                    ))}
                  </SelectNatif>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantite">Quantité ({libelleUniteQuantite(uniteSaisie, 2)}) *</Label>
                    {/* Une tige, une pièce ou une botte se compte : la route
                        refuse un nombre décimal, l'écran ne le propose pas. */}
                    <Input
                      id="quantite"
                      type="number"
                      step={uniteSaisie === "kg" ? "0.1" : "1"}
                      min={uniteSaisie === "kg" ? "0.1" : "1"}
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
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Enregistrement..." : "Enregistrer"}</Button>
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
          <p className="text-sm mt-1">Cliquez sur &quot;Nouvelle sortie&quot; pour commencer</p>
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
                    <span className="font-medium break-words">{conso.espece.nom ?? conso.especeId}</span>
                    <Badge variant="secondary" className="text-xs">
                      {format(new Date(conso.date), "dd MMM yyyy", { locale: fr })}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                    <span className="font-medium text-red-600">- {formatQuantite(conso.quantite, conso.unite ?? "kg")}</span>
                    {conso.prix && (
                      <span className="text-green-600">{formatMontantDevise(conso.prix)}</span>
                    )}
                    {conso.destination && (
                      <span>{conso.destination.id}</span>
                    )}
                    {stockNet && (
                      <span className="text-xs">
                        Stock : {formatQuantite(stockNet.stockNet, stockNet.unite ?? "kg")}
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
