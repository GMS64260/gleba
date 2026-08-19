"use client"

import * as React from "react"
import { ArrowDownToLine, Package, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  PRODUITS_RUCHE,
  PRODUITS_RUCHE_LABELS,
  type ProduitRuche,
  uniteProduitRucheParDefaut,
} from "@/lib/elevage/produits-ruche"
import { todayLocalISO } from "@/lib/format-utils"
import { confirmDialog } from "@/lib/global-dialog"

interface ProductionRuche {
  id: number
  date: string
  produit: ProduitRuche
  quantite: number
  quantiteDisponible: number
  unite: "kg" | "g"
  numeroLot: string | null
  notes: string | null
  lot: {
    id: number
    nom: string | null
    especeAnimale: { nom: string }
  } | null
  animal: {
    id: number
    nom: string | null
    identifiant: string | null
    especeAnimale: { nom: string }
  } | null
}

interface StatProduitRuche {
  produit: ProduitRuche
  unite: "kg" | "g"
  quantite: number
  nbRecoltes: number
}

interface LotApicole {
  id: number
  nom: string | null
  especeAnimale: { nom: string }
}

// QA cmsbtlka1 — ruche gérée en animal individuel (hors lot), cible de récolte.
interface RucheApicole {
  id: number
  nom: string | null
  identifiant: string | null
  especeAnimale: { nom: string }
}

const libelleRuche = (ruche: RucheApicole) =>
  ruche.nom || ruche.identifiant || `Ruche #${ruche.id}`

interface StockRuche {
  produit: ProduitRuche
  unite: "kg" | "g"
  quantiteProduite: number
  sorti: number
  disponible: number
}

interface MouvementStockRuche {
  operationId: string
  date: string
  type: "autoconsommation" | "don" | "destruction"
  produit: ProduitRuche
  quantite: number
  unite: "kg" | "g"
  notes: string | null
}

const formInitial = () => ({
  date: todayLocalISO(),
  produit: "miel" as ProduitRuche,
  quantite: "",
  unite: "kg" as "kg" | "g",
  // Cible encodée « lot:<id> » ou « animal:<id> » (ruche individuelle).
  cible: "aucun",
  numeroLot: "",
  notes: "",
})

const sortieInitiale = () => ({
  date: todayLocalISO(),
  produit: "miel" as ProduitRuche,
  quantite: "",
  unite: "kg" as "kg" | "g",
  type: "autoconsommation" as MouvementStockRuche["type"],
  notes: "",
})

const LIBELLES_SORTIE: Record<MouvementStockRuche["type"], string> = {
  autoconsommation: "Autoconsommation",
  don: "Don",
  destruction: "Perte / destruction",
}

const formatQuantite = (quantite: number) =>
  quantite.toLocaleString("fr-FR", { maximumFractionDigits: 3 })

export function ProduitsRucheSubTab({ year }: { year?: number } = {}) {
  const effectiveYear = year ?? new Date().getFullYear()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isSortieDialogOpen, setIsSortieDialogOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [productions, setProductions] = React.useState<ProductionRuche[]>([])
  const [stats, setStats] = React.useState<StatProduitRuche[]>([])
  const [stocks, setStocks] = React.useState<StockRuche[]>([])
  const [mouvements, setMouvements] = React.useState<MouvementStockRuche[]>([])
  const [lots, setLots] = React.useState<LotApicole[]>([])
  const [ruches, setRuches] = React.useState<RucheApicole[]>([])
  const [formData, setFormData] = React.useState(formInitial)
  const [sortieData, setSortieData] = React.useState(sortieInitiale)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/elevage/production-ruche?annee=${effectiveYear}`)
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result?.error || "Impossible de charger les récoltes")
      setProductions(result.data ?? [])
      setStats(result.stats ?? [])
      setStocks(result.stocks ?? [])
      setMouvements(result.mouvements ?? [])
      setLots(result.lots ?? [])
      setRuches(result.ruches ?? [])
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "Produits de la ruche",
        description: cause instanceof Error ? cause.message : "Impossible de charger les récoltes",
      })
    } finally {
      setIsLoading(false)
    }
  }, [effectiveYear, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const resetForm = () => {
    setEditingId(null)
    setFormData(formInitial())
  }

  const openEdit = (production: ProductionRuche) => {
    setEditingId(production.id)
    setFormData({
      date: production.date.slice(0, 10),
      produit: production.produit,
      quantite: String(production.quantite),
      unite: production.unite,
      cible: production.lot
        ? `lot:${production.lot.id}`
        : production.animal
          ? `animal:${production.animal.id}`
          : "aucun",
      numeroLot: production.numeroLot ?? "",
      notes: production.notes ?? "",
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const quantite = Number.parseFloat(formData.quantite)
    if (!Number.isFinite(quantite) || quantite <= 0) {
      toast({ variant: "destructive", title: "Quantité invalide" })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/elevage/production-ruche", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          date: formData.date,
          produit: formData.produit,
          quantite,
          unite: formData.unite,
          lotId: formData.cible.startsWith("lot:") ? Number(formData.cible.slice(4)) : null,
          animalId: formData.cible.startsWith("animal:") ? Number(formData.cible.slice(7)) : null,
          numeroLot: formData.numeroLot || null,
          notes: formData.notes || null,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result?.error || "Impossible d’enregistrer la récolte")

      toast({ title: editingId ? "Récolte mise à jour" : "Récolte enregistrée" })
      setIsDialogOpen(false)
      resetForm()
      await fetchData()
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: cause instanceof Error ? cause.message : "Impossible d’enregistrer la récolte",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!(await confirmDialog("Supprimer cette récolte ?"))) return
    try {
      const response = await fetch(`/api/elevage/production-ruche?id=${id}`, { method: "DELETE" })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result?.error || "Impossible de supprimer la récolte")
      toast({ title: "Récolte supprimée" })
      await fetchData()
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: cause instanceof Error ? cause.message : "Impossible de supprimer la récolte",
      })
    }
  }

  const handleSortie = async (event: React.FormEvent) => {
    event.preventDefault()
    const quantite = Number.parseFloat(sortieData.quantite)
    if (!Number.isFinite(quantite) || quantite <= 0) {
      toast({ variant: "destructive", title: "Quantité invalide" })
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/elevage/stock-ruche", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sortieData, quantite, notes: sortieData.notes || null }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result?.error || "Impossible d’enregistrer la sortie")
      toast({ title: "Sortie de stock enregistrée" })
      setIsSortieDialogOpen(false)
      setSortieData(sortieInitiale())
      await fetchData()
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "Stock de la ruche",
        description: cause instanceof Error ? cause.message : "Impossible d’enregistrer la sortie",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSortie = async (operationId: string) => {
    if (!(await confirmDialog("Supprimer cette sortie et restaurer le stock ?"))) return
    try {
      const response = await fetch(
        `/api/elevage/stock-ruche?operationId=${encodeURIComponent(operationId)}`,
        { method: "DELETE" },
      )
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result?.error || "Impossible de supprimer la sortie")
      toast({ title: "Sortie supprimée, stock restauré" })
      await fetchData()
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "Stock de la ruche",
        description: cause instanceof Error ? cause.message : "Impossible de supprimer la sortie",
      })
    }
  }

  const actions = (production: ProductionRuche) => (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Modifier la récolte de ${PRODUITS_RUCHE_LABELS[production.produit]}`}
        onClick={() => openEdit(production)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Supprimer la récolte de ${PRODUITS_RUCHE_LABELS[production.produit]}`}
        onClick={() => handleDelete(production.id)}
      >
        <Trash2 className="h-4 w-4 text-red-600" />
      </Button>
    </div>
  )

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 bg-amber-50/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-5 w-5 text-amber-700" />
            Produits de la ruche
          </CardTitle>
          <CardDescription>
            Enregistrez les récoltes de miel, cire, propolis, pollen et gelée royale.
            Une vente saisie dans l’onglet Ventes déstocke automatiquement les récoltes les plus
            anciennes et crée la recette comptable dans la même opération.
          </CardDescription>
        </CardHeader>
      </Card>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-24" />)}
        </div>
      ) : stocks.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stocks.map((stock) => (
            <Card key={`${stock.produit}-${stock.unite}`}>
              <CardHeader className="pb-2">
                <CardDescription>
                  Stock disponible · {PRODUITS_RUCHE_LABELS[stock.produit]}
                </CardDescription>
                <CardTitle className="text-2xl">
                  {formatQuantite(stock.disponible)} {stock.unite}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {formatQuantite(stock.quantiteProduite)} récolté · {formatQuantite(stock.sorti)} sorti
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!isLoading && stats.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Récolté en {effectiveYear} :</span>
          {stats.map((stat) => (
            <Badge key={`${stat.produit}-${stat.unite}`} variant="secondary">
              {PRODUITS_RUCHE_LABELS[stat.produit]} · {formatQuantite(stat.quantite)} {stat.unite}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className="h-4 w-4" />
          <span className="sr-only">Actualiser</span>
        </Button>
        <Dialog
          open={isSortieDialogOpen}
          onOpenChange={(open) => {
            setIsSortieDialogOpen(open)
            if (!open) setSortieData(sortieInitiale())
          }}
        >
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <ArrowDownToLine className="mr-1 h-4 w-4" />
              Nouvelle sortie
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Sortie du stock de la ruche</DialogTitle>
              <DialogDescription>
                Pour une vente, utilisez l’onglet Ventes. Ici, enregistrez seulement
                l’autoconsommation, les dons et les pertes.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSortie} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sortie-ruche-date">Date *</Label>
                  <Input
                    id="sortie-ruche-date"
                    type="date"
                    required
                    value={sortieData.date}
                    onChange={(event) => setSortieData((current) => ({
                      ...current,
                      date: event.target.value,
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Motif *</Label>
                  <Select
                    value={sortieData.type}
                    onValueChange={(type: MouvementStockRuche["type"]) =>
                      setSortieData((current) => ({ ...current, type }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(LIBELLES_SORTIE).map(([type, libelle]) => (
                        <SelectItem key={type} value={type}>{libelle}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Produit *</Label>
                  <Select
                    value={sortieData.produit}
                    onValueChange={(produit: ProduitRuche) => setSortieData((current) => ({
                      ...current,
                      produit,
                      unite: uniteProduitRucheParDefaut(produit),
                    }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRODUITS_RUCHE.map((produit) => (
                        <SelectItem key={produit} value={produit}>
                          {PRODUITS_RUCHE_LABELS[produit]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="sortie-ruche-quantite">Quantité *</Label>
                    <Input
                      id="sortie-ruche-quantite"
                      type="number"
                      min="0"
                      step="0.001"
                      required
                      value={sortieData.quantite}
                      onChange={(event) => setSortieData((current) => ({
                        ...current,
                        quantite: event.target.value,
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unité *</Label>
                    <Select
                      value={sortieData.unite}
                      onValueChange={(unite: "kg" | "g") =>
                        setSortieData((current) => ({ ...current, unite }))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="g">g</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sortie-ruche-notes">Notes</Label>
                <Input
                  id="sortie-ruche-notes"
                  maxLength={5000}
                  value={sortieData.notes}
                  onChange={(event) => setSortieData((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsSortieDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Enregistrement…" : "Enregistrer la sortie"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger asChild>
            <Button type="button" size="sm" onClick={resetForm}>
              <Plus className="mr-1 h-4 w-4" />
              Nouvelle récolte
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Modifier la récolte" : "Enregistrer une récolte"}</DialogTitle>
              <DialogDescription>
                La ruche et le numéro de lot sont facultatifs, mais utiles pour la traçabilité.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ruche-date">Date *</Label>
                  <Input
                    id="ruche-date"
                    type="date"
                    required
                    value={formData.date}
                    onChange={(event) => setFormData((current) => ({ ...current, date: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Produit *</Label>
                  <Select
                    value={formData.produit}
                    onValueChange={(value: ProduitRuche) => setFormData((current) => ({
                      ...current,
                      produit: value,
                      unite: uniteProduitRucheParDefaut(value),
                    }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRODUITS_RUCHE.map((produit) => (
                        <SelectItem key={produit} value={produit}>
                          {PRODUITS_RUCHE_LABELS[produit]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ruche-quantite">Quantité *</Label>
                  <Input
                    id="ruche-quantite"
                    type="number"
                    min="0"
                    step="0.001"
                    required
                    value={formData.quantite}
                    onChange={(event) => setFormData((current) => ({ ...current, quantite: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unité *</Label>
                  <Select
                    value={formData.unite}
                    onValueChange={(value: "kg" | "g") => setFormData((current) => ({ ...current, unite: value }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Ruche ou lot apicole</Label>
                <Select
                  value={formData.cible}
                  onValueChange={(value) => setFormData((current) => ({ ...current, cible: value }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aucun">Aucun rattachement</SelectItem>
                    {ruches.map((ruche) => (
                      <SelectItem key={`animal:${ruche.id}`} value={`animal:${ruche.id}`}>
                        {libelleRuche(ruche)} · {ruche.especeAnimale.nom}
                      </SelectItem>
                    ))}
                    {lots.map((lot) => (
                      <SelectItem key={`lot:${lot.id}`} value={`lot:${lot.id}`}>
                        {lot.nom || `Lot #${lot.id}`} · {lot.especeAnimale.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {lots.length === 0 && ruches.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Aucune ruche ni lot apicole actif : la récolte peut tout de même être enregistrée.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ruche-numero-lot">Numéro de lot</Label>
                <Input
                  id="ruche-numero-lot"
                  maxLength={100}
                  value={formData.numeroLot}
                  onChange={(event) => setFormData((current) => ({ ...current, numeroLot: event.target.value }))}
                  placeholder="Ex. MIEL-2026-04"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ruche-notes">Notes</Label>
                <textarea
                  id="ruche-notes"
                  maxLength={5000}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.notes}
                  onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Origine florale, humidité, observations…"
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Enregistrement…" : editingId ? "Mettre à jour" : "Enregistrer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-16" />)}
        </div>
      ) : productions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-amber-600" />
            <p className="font-medium">Aucune récolte enregistrée en {effectiveYear}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajoutez la première récolte pour commencer le suivi des produits de la ruche.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {productions.map((production) => (
              <Card key={production.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge variant="outline">{PRODUITS_RUCHE_LABELS[production.produit]}</Badge>
                      <p className="mt-2 text-lg font-semibold">
                        {formatQuantite(production.quantite)} {production.unite}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatQuantite(production.quantiteDisponible)} {production.unite} disponible
                      </p>
                    </div>
                    {actions(production)}
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>{new Date(production.date).toLocaleDateString("fr-FR")}</p>
                    <p>{production.lot?.nom || production.lot?.especeAnimale.nom || (production.animal && libelleRuche(production.animal)) || "Sans ruche rattachée"}</p>
                    {production.numeroLot && <p>Lot : {production.numeroLot}</p>}
                    {production.notes && <p className="whitespace-pre-wrap text-foreground">{production.notes}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Ruche / lot</TableHead>
                    <TableHead>N° de lot</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productions.map((production) => (
                    <TableRow key={production.id}>
                      <TableCell>{new Date(production.date).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{PRODUITS_RUCHE_LABELS[production.produit]}</Badge>
                      </TableCell>
                      <TableCell>{production.lot?.nom || production.lot?.especeAnimale.nom || (production.animal && libelleRuche(production.animal)) || "—"}</TableCell>
                      <TableCell>{production.numeroLot || "—"}</TableCell>
                      <TableCell className="text-right font-medium">
                        <span>{formatQuantite(production.quantite)} {production.unite}</span>
                        <span className="block text-xs font-normal text-muted-foreground">
                          {formatQuantite(production.quantiteDisponible)} disponible
                        </span>
                      </TableCell>
                      <TableCell>{actions(production)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {!isLoading && mouvements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sorties manuelles récentes</CardTitle>
            <CardDescription>
              Les ventes sont consultables dans l’onglet Ventes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {mouvements.map((mouvement) => (
              <div
                key={mouvement.operationId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">
                    {LIBELLES_SORTIE[mouvement.type]} · {PRODUITS_RUCHE_LABELS[mouvement.produit]}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(mouvement.date).toLocaleDateString("fr-FR")} ·{" "}
                    {formatQuantite(mouvement.quantite)} {mouvement.unite}
                    {mouvement.notes ? ` · ${mouvement.notes}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Supprimer la sortie et restaurer le stock"
                  onClick={() => handleDeleteSortie(mouvement.operationId)}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
