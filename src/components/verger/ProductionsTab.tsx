"use client"

/**
 * Onglet Productions - Récoltes fruits + Production bois
 */

import * as React from "react"
import Link from "next/link"
import { isPast, differenceInDays } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { confirmDialog } from "@/lib/global-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Apple,
  Axe,
  Trash2,
  Package,
  ShoppingCart,
  AlertTriangle,
  Euro,
  FileText,
  Plus,
  Sprout,
  Home,
} from "lucide-react"
import { Combobox } from "@/components/ui/combobox"
import { useToast } from "@/hooks/use-toast"
import { AssistantPlantationDialog } from "./AssistantPlantationDialog"

// ============================================================
// Types
// ============================================================

interface Arbre {
  id: number
  nom: string
  type: string
}

interface Client {
  id: number
  nom: string
}

interface RecolteArbre {
  id: number
  arbreId: number
  date: string
  quantite: number
  qualite: string | null
  prixKg: number | null
  statut: string
  dateVente: string | null
  prixTotal: number | null
  clientId: number | null
  clientNom: string | null
  factureId: number | null
  datePeremption: string | null
  notes: string | null
  arbre: Arbre
}

interface ProductionBois {
  id: number
  arbreId: number | null
  date: string
  type: string
  volumeM3: number | null
  poidsKg: number | null
  statut: string
  destination: string | null
  dateVente: string | null
  prixVente: number | null
  clientId: number | null
  clientNom: string | null
  factureId: number | null
  notes: string | null
  arbre: Arbre | null
}

const TYPES_PRODUCTION = [
  { value: "elagage", label: "Élagage" },
  { value: "abattage", label: "Abattage" },
  { value: "branchage", label: "Branchage" },
]

const DESTINATIONS_UTILISATION = [
  { value: "chauffage", label: "Bois de chauffage (perso)" },
  { value: "BRF", label: "BRF / Paillage" },
  { value: "construction", label: "Construction" },
]

// ============================================================
// Main component
// ============================================================

export function ProductionsTab() {
  return (
    <Tabs defaultValue="recoltes" className="space-y-4">
      <TabsList>
        <TabsTrigger value="recoltes" className="flex items-center gap-1.5">
          <Apple className="h-4 w-4" />
          Récoltes Fruits
        </TabsTrigger>
        <TabsTrigger value="bois" className="flex items-center gap-1.5">
          <Axe className="h-4 w-4" />
          Production Bois
        </TabsTrigger>
      </TabsList>

      <TabsContent value="recoltes">
        <RecoltesFruitsSubTab />
      </TabsContent>
      <TabsContent value="bois">
        <ProductionBoisSubTab />
      </TabsContent>
    </Tabs>
  )
}

// ============================================================
// Recoltes Fruits
// ============================================================

function RecoltesFruitsSubTab() {
  const { toast } = useToast()
  const [recoltes, setRecoltes] = React.useState<RecolteArbre[]>([])
  const [arbres, setArbres] = React.useState<Arbre[]>([])
  const [clients, setClients] = React.useState<Client[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState("stock")
  const [showDialog, setShowDialog] = React.useState(false)
  const [showVenteDialog, setShowVenteDialog] = React.useState(false)
  const [selectedRecolte, setSelectedRecolte] = React.useState<RecolteArbre | null>(null)
  const [venteData, setVenteData] = React.useState({
    clientId: "",
    clientNom: "",
    prixKg: "",
    creerFacture: false,
  })
  // DEV3 #4 — Champs traçabilité AB (audit Marc 2026-05-14)
  const [newRecolte, setNewRecolte] = React.useState({
    arbreId: "",
    date: new Date().toISOString().split("T")[0],
    quantite: "",
    qualite: "",
    prixKg: "",
    datePeremption: "",
    notes: "",
    // Bloquant #4
    statutBioSnapshot: "" as string, // auto depuis parcelle si vide
    parcelleId: "",
    numLot: "", // auto-généré si vide
    categorieCommerciale: "",
    destinationCommerce: "",
    conditionnement: "",
  })

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const [recoltesRes, arbresRes, clientsRes] = await Promise.all([
        fetch("/api/arbres/recoltes"),
        fetch("/api/arbres"),
        fetch("/api/comptabilite/clients?actif=true"),
      ])
      if (recoltesRes.ok) setRecoltes(await recoltesRes.json())
      if (arbresRes.ok) setArbres(await arbresRes.json())
      if (clientsRes.ok) {
        const result = await clientsRes.json()
        setClients(result.data || [])
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const stockRecoltes = recoltes.filter(r => !r.statut || r.statut === "en_stock")
  const venduRecoltes = recoltes.filter(r => r.statut === "vendu")
  const perteRecoltes = recoltes.filter(r => r.statut === "perte" || r.statut === "consomme")

  const now = new Date()
  const perimesCount = stockRecoltes.filter(r => r.datePeremption && isPast(new Date(r.datePeremption))).length
  const bientotPerimesCount = stockRecoltes.filter(r => {
    if (!r.datePeremption) return false
    const days = differenceInDays(new Date(r.datePeremption), now)
    return days >= 0 && days <= 3
  }).length

  const stockKg = stockRecoltes.reduce((sum, r) => sum + r.quantite, 0)
  const venduKg = venduRecoltes.reduce((sum, r) => sum + r.quantite, 0)
  const totalCA = venduRecoltes.reduce((sum, r) => sum + (r.prixTotal || 0), 0)
  const perteKg = perteRecoltes.reduce((sum, r) => sum + r.quantite, 0)
  const stockValeur = stockRecoltes.reduce((sum, r) => sum + r.quantite * (r.prixKg || 0), 0)

  const clientOptions = React.useMemo(() =>
    clients.map(c => ({ value: c.nom, label: c.nom })),
    [clients]
  )

  const arbresFruitiers = arbres.filter((a) =>
    ["fruitier", "petit_fruit"].includes(a.type)
  )

  const getPeremptionBadge = (datePeremption: string | null) => {
    if (!datePeremption) return null
    const date = new Date(datePeremption)
    if (isPast(date)) {
      return <Badge variant="destructive" className="text-xs">Périmé</Badge>
    }
    const days = differenceInDays(date, now)
    if (days <= 3) {
      return <Badge className="bg-orange-500 text-xs">{days}j restants</Badge>
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Famille C — au lieu d'un bouton grisé muet, on valide explicitement
    // l'arbre requis avec un message clair.
    if (!newRecolte.arbreId) {
      toast({ title: "Sélectionnez un arbre", variant: "destructive" })
      return
    }
    try {
      const res = await fetch("/api/arbres/recoltes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arbreId: parseInt(newRecolte.arbreId),
          date: newRecolte.date,
          quantite: parseFloat(newRecolte.quantite),
          qualite: newRecolte.qualite || null,
          prixKg: newRecolte.prixKg ? parseFloat(newRecolte.prixKg) : null,
          datePeremption: newRecolte.datePeremption || null,
          notes: newRecolte.notes || null,
          // DEV3 #4 — traçabilité AB
          statutBioSnapshot: newRecolte.statutBioSnapshot || null,
          // On n'envoie la parcelle que si elle est renseignée, pour laisser
          // l'API appliquer le défaut (parcelle de l'arbre) — sinon le N° de
          // lot tombait en "-NA-" (traçabilité AB cassée).
          ...(newRecolte.parcelleId ? { parcelleId: newRecolte.parcelleId } : {}),
          numLot: newRecolte.numLot || null,
          categorieCommerciale: newRecolte.categorieCommerciale || null,
          destinationCommerce: newRecolte.destinationCommerce || null,
          conditionnement: newRecolte.conditionnement || null,
        }),
      })
      if (res.ok) {
        // Feedback Marc 2026-05-16 — Bug 08 : si l'API a retourné un
        // warning saisonnier, on l'affiche en plus du toast de succès
        // (récolte hors saison agronomique de la variété).
        const payload = (await res.json().catch(() => null)) as { warnings?: string[] } | null
        setShowDialog(false)
        setNewRecolte({
          arbreId: "",
          date: new Date().toISOString().split("T")[0],
          quantite: "",
          qualite: "",
          prixKg: "",
          datePeremption: "",
          notes: "",
          statutBioSnapshot: "",
          parcelleId: "",
          numLot: "",
          categorieCommerciale: "",
          destinationCommerce: "",
          conditionnement: "",
        })
        toast({ title: "Récolte enregistrée" })
        if (payload?.warnings && payload.warnings.length > 0) {
          for (const w of payload.warnings) {
            toast({ title: "Attention saison", description: w, variant: "destructive" })
          }
        }
        fetchData()
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: "Échec de l'enregistrement", description: data.error || `Erreur ${res.status}`, variant: "destructive" })
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleDelete = async (id: number) => {
    if (!(await confirmDialog("Supprimer cette récolte ?"))) return
    try {
      const res = await fetch(`/api/arbres/recoltes/${id}`, { method: "DELETE" })
      if (res.ok) {
        setRecoltes(recoltes.filter((r) => r.id !== id))
        toast({ title: "Récolte supprimée" })
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: "Échec de la suppression", description: data.error || `Erreur ${res.status}`, variant: "destructive" })
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const openVenteDialog = (recolte: RecolteArbre) => {
    setSelectedRecolte(recolte)
    setVenteData({
      clientId: "",
      clientNom: "",
      prixKg: recolte.prixKg?.toString() || "",
      creerFacture: false,
    })
    setShowVenteDialog(true)
  }

  const handleVendre = async () => {
    if (!selectedRecolte) return
    const prixKg = parseFloat(venteData.prixKg) || 0
    const prixTotal = prixKg * selectedRecolte.quantite

    try {
      const res = await fetch(`/api/arbres/recoltes/${selectedRecolte.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statut: "vendu",
          prixKg,
          prixTotal,
          clientId: venteData.clientId ? parseInt(venteData.clientId) : null,
          clientNom: venteData.clientNom || null,
          creerFacture: venteData.creerFacture,
        }),
      })
      if (res.ok) {
        setShowVenteDialog(false)
        toast({ title: "Vente enregistrée" })
        fetchData()
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: "Échec de la vente", description: data.error || `Erreur ${res.status}`, variant: "destructive" })
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handlePerte = async (id: number) => {
    if (!(await confirmDialog("Marquer cette récolte comme perte ?"))) return
    try {
      const res = await fetch(`/api/arbres/recoltes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: "perte" }),
      })
      if (res.ok) {
        toast({ title: "Perte enregistrée" })
        fetchData()
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: "Échec de l'enregistrement de la perte", description: data.error || `Erreur ${res.status}`, variant: "destructive" })
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleUsageInterne = async (id: number) => {
    if (!(await confirmDialog("Marquer cette récolte comme usage interne (auto-consommation) ?"))) return
    try {
      const res = await fetch(`/api/arbres/recoltes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: "consomme" }),
      })
      if (res.ok) {
        toast({ title: "Usage interne enregistré" })
        fetchData()
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: "Échec de l'enregistrement", description: data.error || `Erreur ${res.status}`, variant: "destructive" })
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4 text-green-600" />
              En stock
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-2xl font-bold">{stockKg.toFixed(1)} kg</p>
            {stockValeur > 0 && (
              <p className="text-xs text-muted-foreground">{stockValeur.toFixed(0)} € estimé</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-blue-600" />
              Vendu
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-2xl font-bold">{venduKg.toFixed(1)} kg</p>
            <p className="text-xs text-muted-foreground">{totalCA.toFixed(0)} EUR CA</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Pertes / usages
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-2xl font-bold">{perteKg.toFixed(1)} kg</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Apple className="h-4 w-4 text-orange-600" />
              Total récoltes
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-2xl font-bold">{recoltes.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertes péremption */}
      {(perimesCount > 0 || bientotPerimesCount > 0) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-orange-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alertes péremption
            </CardTitle>
          </CardHeader>
          <CardContent>
            {perimesCount > 0 && (
              <p className="text-red-700">{perimesCount} récolte(s) périmée(s)</p>
            )}
            {bientotPerimesCount > 0 && (
              <p className="text-orange-700">{bientotPerimesCount} récolte(s) proche(s) de la péremption</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bouton ajouter + Tabs stock/vendu/pertes */}
      <div className="flex items-center justify-between">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList>
            <TabsTrigger value="stock" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Stock ({stockRecoltes.length})
            </TabsTrigger>
            <TabsTrigger value="vendu" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Vendu ({venduRecoltes.length})
            </TabsTrigger>
            <TabsTrigger value="pertes" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Pertes & usages ({perteRecoltes.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={() => setShowDialog(true)} size="sm" className="bg-orange-600 hover:bg-orange-700 ml-2">
          <Plus className="h-4 w-4 mr-1" />
          Nouvelle récolte
        </Button>
      </div>

      {/* Onglet Stock */}
      {activeTab === "stock" && (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-8 text-muted-foreground">Chargement...</p>
            ) : stockRecoltes.length === 0 ? (
              <p className="p-8 text-muted-foreground text-center">Aucune récolte en stock</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Arbre</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead>Qualité</TableHead>
                    <TableHead className="text-right">Prix/kg</TableHead>
                    <TableHead>Péremption</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockRecoltes.map((r) => (
                    <TableRow key={r.id} className={r.datePeremption && isPast(new Date(r.datePeremption)) ? "bg-red-50" : ""}>
                      <TableCell>{new Date(r.date).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell className="font-medium">{r.arbre.nom}</TableCell>
                      <TableCell className="text-right">{r.quantite} kg</TableCell>
                      <TableCell className="capitalize">{r.qualite || "-"}</TableCell>
                      <TableCell className="text-right">{r.prixKg ? `${r.prixKg} EUR` : "-"}</TableCell>
                      <TableCell>
                        {r.datePeremption ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{new Date(r.datePeremption).toLocaleDateString("fr-FR")}</span>
                            {getPeremptionBadge(r.datePeremption)}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => openVenteDialog(r)} title="Vendre">
                            <Euro className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleUsageInterne(r.id)} title="Usage interne (auto-consommation)">
                            <Home className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handlePerte(r.id)} title="Perte">
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} title="Supprimer">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Onglet Vendu */}
      {activeTab === "vendu" && (
        <Card>
          <CardContent className="p-0">
            {venduRecoltes.length === 0 ? (
              <p className="p-8 text-muted-foreground text-center">Aucune vente</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date récolte</TableHead>
                    <TableHead>Arbre</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead className="text-right">Prix/kg</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Date vente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {venduRecoltes.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{new Date(r.date).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell className="font-medium">{r.arbre.nom}</TableCell>
                      <TableCell className="text-right">{r.quantite} kg</TableCell>
                      <TableCell className="text-right">{r.prixKg ? `${r.prixKg} EUR` : "-"}</TableCell>
                      <TableCell className="text-right font-bold">{r.prixTotal ? `${r.prixTotal.toFixed(2)} EUR` : "-"}</TableCell>
                      <TableCell>{r.clientNom || "-"}</TableCell>
                      <TableCell>{r.dateVente ? new Date(r.dateVente).toLocaleDateString("fr-FR") : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Onglet Pertes */}
      {activeTab === "pertes" && (
        <Card>
          <CardContent className="p-0">
            {perteRecoltes.length === 0 ? (
              <p className="p-8 text-muted-foreground text-center">Aucune perte ni usage interne enregistré</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Arbre</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead>Qualité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perteRecoltes.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{new Date(r.date).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell className="font-medium">{r.arbre.nom}</TableCell>
                      <TableCell className="text-right">{r.quantite} kg</TableCell>
                      <TableCell className="capitalize">{r.qualite || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={r.statut === "perte" ? "destructive" : "outline"}>
                          {r.statut === "perte" ? "Perte" : "Usage interne"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{r.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog Nouvelle recolte */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enregistrer une récolte</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Arbre *</Label>
              <Select
                value={newRecolte.arbreId}
                onValueChange={(v) => setNewRecolte({ ...newRecolte, arbreId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un arbre" />
                </SelectTrigger>
                <SelectContent>
                  {arbresFruitiers.map((a) => (
                    <SelectItem key={a.id} value={a.id.toString()}>
                      {a.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newRecolte.date}
                  onChange={(e) => setNewRecolte({ ...newRecolte, date: e.target.value })}
                />
              </div>
              <div>
                <Label>Quantité (kg) *</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={newRecolte.quantite}
                  onChange={(e) => setNewRecolte({ ...newRecolte, quantite: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Qualité</Label>
                <Select
                  value={newRecolte.qualite}
                  onValueChange={(v) => setNewRecolte({ ...newRecolte, qualite: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="bon">Bon</SelectItem>
                    <SelectItem value="moyen">Moyen</SelectItem>
                    <SelectItem value="mauvais">Mauvais</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prix/kg</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newRecolte.prixKg}
                  onChange={(e) => setNewRecolte({ ...newRecolte, prixKg: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Date de péremption</Label>
              <Input
                type="date"
                value={newRecolte.datePeremption}
                onChange={(e) => setNewRecolte({ ...newRecolte, datePeremption: e.target.value })}
              />
            </div>

            {/* DEV3 #4 — Bloc traçabilité Bio/HVE */}
            <fieldset className="rounded-md border bg-emerald-50/40 p-3 space-y-3">
              <legend className="px-2 text-xs font-semibold text-emerald-800">
                Traçabilité Bio / HVE
              </legend>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Statut Bio</Label>
                  <Select
                    value={newRecolte.statutBioSnapshot}
                    onValueChange={(v) => setNewRecolte({ ...newRecolte, statutBioSnapshot: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Auto (depuis parcelle)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AB">AB</SelectItem>
                      <SelectItem value="C3">C3 (3e année conversion)</SelectItem>
                      <SelectItem value="C2">C2 (2e année conversion)</SelectItem>
                      <SelectItem value="C1">C1 (1re année conversion)</SelectItem>
                      <SelectItem value="Conventionnel">Conventionnel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">N° de lot</Label>
                  <Input
                    placeholder="Auto YYYYMMDD-PARCELLE-ESPECE-NN"
                    value={newRecolte.numLot}
                    onChange={(e) => setNewRecolte({ ...newRecolte, numLot: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">Catégorie</Label>
                  <Select
                    value={newRecolte.categorieCommerciale}
                    onValueChange={(v) => setNewRecolte({ ...newRecolte, categorieCommerciale: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cat I Extra">Cat I Extra</SelectItem>
                      <SelectItem value="Cat I">Cat I</SelectItem>
                      <SelectItem value="Cat II">Cat II</SelectItem>
                      <SelectItem value="Industrie">Industrie</SelectItem>
                      <SelectItem value="Écart de tri">Écart de tri</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Destination</Label>
                  <Select
                    value={newRecolte.destinationCommerce}
                    onValueChange={(v) => setNewRecolte({ ...newRecolte, destinationCommerce: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Frais marché">Frais marché</SelectItem>
                      <SelectItem value="Frais AMAP">Frais AMAP</SelectItem>
                      <SelectItem value="Transformation interne">Transformation interne</SelectItem>
                      <SelectItem value="Jus/Cidre">Jus / Cidre</SelectItem>
                      <SelectItem value="Industrie">Industrie</SelectItem>
                      <SelectItem value="Don">Don</SelectItem>
                      <SelectItem value="Compost">Compost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Conditionnement</Label>
                  <Select
                    value={newRecolte.conditionnement}
                    onValueChange={(v) => setNewRecolte({ ...newRecolte, conditionnement: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Vrac">Vrac</SelectItem>
                      <SelectItem value="Cagette 5kg">Cagette 5kg</SelectItem>
                      <SelectItem value="Cagette 10kg">Cagette 10kg</SelectItem>
                      <SelectItem value="Palox">Palox</SelectItem>
                      <SelectItem value="Big-bag">Big-bag</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </fieldset>

            <div>
              <Label>Notes</Label>
              <Input
                value={newRecolte.notes}
                onChange={(e) => setNewRecolte({ ...newRecolte, notes: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full">
              Enregistrer
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Vente */}
      <Dialog open={showVenteDialog} onOpenChange={setShowVenteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vendre la récolte</DialogTitle>
          </DialogHeader>
          {selectedRecolte && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {selectedRecolte.arbre.nom} - {selectedRecolte.quantite} kg
              </p>
              <div>
                <Label>Client</Label>
                <Combobox
                  value={venteData.clientNom}
                  onValueChange={(v) => {
                    const client = clients.find(c => c.nom === v)
                    setVenteData({
                      ...venteData,
                      clientId: client ? client.id.toString() : "",
                      clientNom: v
                    })
                  }}
                  options={clientOptions}
                  placeholder="Nom du client"
                />
              </div>
              <div>
                <Label>Prix/kg</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={venteData.prixKg}
                  onChange={(e) => setVenteData({ ...venteData, prixKg: e.target.value })}
                />
              </div>
              {venteData.prixKg && (
                <p className="text-sm font-bold">
                  Total : {(parseFloat(venteData.prixKg) * selectedRecolte.quantite).toFixed(2)} EUR
                </p>
              )}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="creerFactureRecolte"
                  checked={venteData.creerFacture}
                  onCheckedChange={(checked) =>
                    setVenteData({ ...venteData, creerFacture: checked === true })
                  }
                />
                <Label htmlFor="creerFactureRecolte">Créer une facture (TVA 5.5%)</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowVenteDialog(false)}>
                  Annuler
                </Button>
                <Button onClick={handleVendre} disabled={!venteData.prixKg}>
                  Valider la vente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// Production Bois
// ============================================================

function ProductionBoisSubTab() {
  const { toast } = useToast()
  const [productions, setProductions] = React.useState<ProductionBois[]>([])
  const [arbres, setArbres] = React.useState<Arbre[]>([])
  const [clients, setClients] = React.useState<Client[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState("stock")
  const [showDialog, setShowDialog] = React.useState(false)
  const [showVenteDialog, setShowVenteDialog] = React.useState(false)
  const [showUtiliseDialog, setShowUtiliseDialog] = React.useState(false)
  const [selectedProduction, setSelectedProduction] = React.useState<ProductionBois | null>(null)

  // DEV3 #4 — Champs traçabilité bois (audit Marc)
  const [newProduction, setNewProduction] = React.useState({
    arbreId: "",
    date: new Date().toISOString().split("T")[0],
    type: "elagage",
    volumeM3: "",
    volumeStere: "",
    poidsKg: "",
    qualiteBois: "",
    destination: "",
    notes: "",
  })

  const [venteData, setVenteData] = React.useState({
    clientId: "",
    clientNom: "",
    prixVente: "",
    creerFacture: false,
  })

  const [utiliseData, setUtiliseData] = React.useState({
    destination: "chauffage",
  })

  // Workflow "Replanter après coupe"
  const [showReplanter, setShowReplanter] = React.useState(false)
  const [replanterPrefill, setReplanterPrefill] = React.useState<Record<string, string> | null>(null)

  const openReplanter = (p: ProductionBois) => {
    const arbreNom = p.arbre?.nom || ""
    setReplanterPrefill({
      nom: arbreNom ? `Replantation suite à coupe ${arbreNom}` : `Replantation suite à coupe du ${new Date(p.date).toLocaleDateString("fr-FR")}`,
      nature: "replantation_apres_coupe",
      cause: "coupe_programmee",
      essencePrecedente: arbreNom,
      productionBoisId: String(p.id),
    })
    setShowReplanter(true)
  }

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const [boisRes, arbresRes, clientsRes] = await Promise.all([
        fetch("/api/arbres/bois"),
        fetch("/api/arbres"),
        fetch("/api/comptabilite/clients?actif=true"),
      ])
      if (boisRes.ok) setProductions(await boisRes.json())
      if (arbresRes.ok) {
        const allArbres = await arbresRes.json()
        setArbres(allArbres.filter((a: Arbre) => a.type === "forestier" || a.type === "haie"))
      }
      if (clientsRes.ok) {
        const data = await clientsRes.json()
        setClients(data.data || [])
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const stockProductions = productions.filter(p => p.statut === "en_stock")
  const venduProductions = productions.filter(p => p.statut === "vendu")
  const utiliseProductions = productions.filter(p => p.statut === "utilise")

  const stockVolume = stockProductions.reduce((sum, p) => sum + (p.volumeM3 || 0), 0)
  const venduVolume = venduProductions.reduce((sum, p) => sum + (p.volumeM3 || 0), 0)
  const totalVentes = venduProductions.reduce((sum, p) => sum + (p.prixVente || 0), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch("/api/arbres/bois", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arbreId: newProduction.arbreId ? parseInt(newProduction.arbreId) : null,
          date: newProduction.date,
          type: newProduction.type,
          volumeM3: newProduction.volumeM3 ? parseFloat(newProduction.volumeM3) : null,
          volumeStere: newProduction.volumeStere ? parseFloat(newProduction.volumeStere) : null,
          poidsKg: newProduction.poidsKg ? parseFloat(newProduction.poidsKg) : null,
          qualiteBois: newProduction.qualiteBois || null,
          destination: newProduction.destination || null,
          statut: "en_stock",
          notes: newProduction.notes || null,
        }),
      })
      if (res.ok) {
        setShowDialog(false)
        setNewProduction({
          arbreId: "",
          date: new Date().toISOString().split("T")[0],
          type: "elagage",
          volumeM3: "",
          volumeStere: "",
          poidsKg: "",
          qualiteBois: "",
          destination: "",
          notes: "",
        })
        toast({ title: "Production enregistrée en stock" })
        fetchData()
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: "Échec de l'enregistrement", description: data.error || `Erreur ${res.status}`, variant: "destructive" })
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleVendre = async () => {
    if (!selectedProduction) return
    try {
      const res = await fetch(`/api/arbres/bois/${selectedProduction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statut: "vendu",
          dateVente: new Date().toISOString(),
          prixVente: venteData.prixVente ? parseFloat(venteData.prixVente) : null,
          clientId: venteData.clientId ? parseInt(venteData.clientId) : null,
          clientNom: venteData.clientNom || null,
          destination: "vente",
          creerFacture: venteData.creerFacture,
        }),
      })
      if (res.ok) {
        setShowVenteDialog(false)
        setSelectedProduction(null)
        setVenteData({ clientId: "", clientNom: "", prixVente: "", creerFacture: false })
        toast({ title: "Vente enregistrée" })
        fetchData()
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: "Échec de la vente", description: data.error || `Erreur ${res.status}`, variant: "destructive" })
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleUtiliser = async () => {
    if (!selectedProduction) return
    try {
      const res = await fetch(`/api/arbres/bois/${selectedProduction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statut: "utilise",
          destination: utiliseData.destination,
        }),
      })
      if (res.ok) {
        setShowUtiliseDialog(false)
        setSelectedProduction(null)
        setUtiliseData({ destination: "chauffage" })
        toast({ title: "Marque comme utilise" })
        fetchData()
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: "Échec de la mise à jour", description: data.error || `Erreur ${res.status}`, variant: "destructive" })
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleDelete = async (id: number) => {
    if (!(await confirmDialog("Supprimer cette production ?"))) return
    try {
      const res = await fetch(`/api/arbres/bois/${id}`, { method: "DELETE" })
      if (res.ok) {
        setProductions(productions.filter((p) => p.id !== id))
        toast({ title: "Production supprimée" })
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: "Échec de la suppression", description: data.error || `Erreur ${res.status}`, variant: "destructive" })
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const openVenteDialog = (p: ProductionBois) => {
    setSelectedProduction(p)
    setVenteData({ clientId: "", clientNom: "", prixVente: "", creerFacture: false })
    setShowVenteDialog(true)
  }

  const openUtiliseDialog = (p: ProductionBois) => {
    setSelectedProduction(p)
    setUtiliseData({ destination: "chauffage" })
    setShowUtiliseDialog(true)
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid gap-3 grid-cols-3">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-amber-600" />
              <p className="text-sm text-amber-700">En stock</p>
            </div>
            <p className="text-2xl font-bold text-amber-800">{stockVolume.toFixed(1)} m³</p>
            <p className="text-xs text-amber-600">{stockProductions.length} lot(s)</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="h-4 w-4 text-green-600" />
              <p className="text-sm text-green-700">Vendu</p>
            </div>
            <p className="text-2xl font-bold text-green-800">{venduVolume.toFixed(1)} m³</p>
            <p className="text-xs text-green-600">{venduProductions.length} vente(s)</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Euro className="h-4 w-4 text-blue-600" />
              <p className="text-sm text-blue-700">CA Ventes</p>
            </div>
            <p className="text-2xl font-bold text-blue-800">{totalVentes.toFixed(2)} EUR</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + bouton ajouter */}
      <div className="flex items-center justify-between">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList>
            <TabsTrigger value="stock" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Stock ({stockProductions.length})
            </TabsTrigger>
            <TabsTrigger value="vendu" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Vendu ({venduProductions.length})
            </TabsTrigger>
            <TabsTrigger value="utilise" className="flex items-center gap-2">
              <Axe className="h-4 w-4" />
              Utilise ({utiliseProductions.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={() => setShowDialog(true)} size="sm" className="bg-amber-600 hover:bg-amber-700 ml-2">
          <Plus className="h-4 w-4 mr-1" />
          Nouvelle production
        </Button>
      </div>

      {/* Stock */}
      {activeTab === "stock" && (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-8 text-muted-foreground">Chargement...</p>
            ) : stockProductions.length === 0 ? (
              <p className="p-8 text-muted-foreground text-center">Aucun bois en stock</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Arbre</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-right">Poids</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockProductions.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(p.date).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell className="capitalize">{p.type}</TableCell>
                      <TableCell>{p.arbre?.nom || "-"}</TableCell>
                      <TableCell className="text-right">{p.volumeM3 ? `${p.volumeM3} m³` : "-"}</TableCell>
                      <TableCell className="text-right">{p.poidsKg ? `${p.poidsKg} kg` : "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {p.type === "abattage" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openReplanter(p)}
                              className="text-green-700 border-green-300 hover:bg-green-50"
                              title="Créer une campagne de replantation à partir de cette coupe"
                            >
                              <Sprout className="h-4 w-4 mr-1" />
                              Replanter
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => openVenteDialog(p)}>
                            <Euro className="h-4 w-4 mr-1" />
                            Vendre
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openUtiliseDialog(p)}>
                            Utiliser
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Vendu */}
      {activeTab === "vendu" && (
        <Card>
          <CardContent className="p-0">
            {venduProductions.length === 0 ? (
              <p className="p-8 text-muted-foreground text-center">Aucune vente enregistrée</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date vente</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Prix</TableHead>
                    <TableHead>Facture</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {venduProductions.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.dateVente ? new Date(p.dateVente).toLocaleDateString("fr-FR") : "-"}</TableCell>
                      <TableCell className="capitalize">{p.type}</TableCell>
                      <TableCell className="text-right">{p.volumeM3 ? `${p.volumeM3} m³` : "-"}</TableCell>
                      <TableCell>{p.clientNom || "-"}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {p.prixVente ? `${p.prixVente} EUR` : "-"}
                      </TableCell>
                      <TableCell>
                        {p.factureId ? (
                          <Link href={`/comptabilite/factures?id=${p.factureId}`}>
                            <Button variant="ghost" size="sm">
                              <FileText className="h-4 w-4" />
                            </Button>
                          </Link>
                        ) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Utilise */}
      {activeTab === "utilise" && (
        <Card>
          <CardContent className="p-0">
            {utiliseProductions.length === 0 ? (
              <p className="p-8 text-muted-foreground text-center">Aucune utilisation enregistrée</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date prod.</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead>Destination</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {utiliseProductions.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(p.date).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell className="capitalize">{p.type}</TableCell>
                      <TableCell className="text-right">{p.volumeM3 ? `${p.volumeM3} m³` : "-"}</TableCell>
                      <TableCell className="capitalize">{p.destination || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog Nouvelle production */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enregistrer une production</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type *</Label>
                <Select
                  value={newProduction.type}
                  onValueChange={(v) => setNewProduction({ ...newProduction, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES_PRODUCTION.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newProduction.date}
                  onChange={(e) => setNewProduction({ ...newProduction, date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Arbre (optionnel)</Label>
              <Select
                value={newProduction.arbreId}
                onValueChange={(v) => setNewProduction({ ...newProduction, arbreId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucun arbre spécifique" />
                </SelectTrigger>
                <SelectContent>
                  {arbres.map((a) => (
                    <SelectItem key={a.id} value={a.id.toString()}>
                      {a.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Volume (m³)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={newProduction.volumeM3}
                  onChange={(e) => setNewProduction({ ...newProduction, volumeM3: e.target.value })}
                />
              </div>
              <div>
                <Label>Poids (kg)</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={newProduction.poidsKg}
                  onChange={(e) => setNewProduction({ ...newProduction, poidsKg: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={newProduction.notes}
                onChange={(e) => setNewProduction({ ...newProduction, notes: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full">
              Ajouter au stock
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Vente Bois */}
      <Dialog open={showVenteDialog} onOpenChange={setShowVenteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vendre ce lot de bois</DialogTitle>
          </DialogHeader>
          {selectedProduction && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 rounded-lg">
                <p className="text-sm text-amber-700">
                  {selectedProduction.type} - {selectedProduction.volumeM3} m³
                  {selectedProduction.arbre && ` (${selectedProduction.arbre.nom})`}
                </p>
              </div>
              <div>
                <Label>Client</Label>
                <Select
                  value={venteData.clientId}
                  onValueChange={(v) => {
                    const client = clients.find(c => c.id.toString() === v)
                    setVenteData({
                      ...venteData,
                      clientId: v,
                      clientNom: client?.nom || ""
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ou nom du client (si pas dans la liste)</Label>
                <Input
                  value={venteData.clientNom}
                  onChange={(e) => setVenteData({ ...venteData, clientNom: e.target.value, clientId: "" })}
                  placeholder="Nom du client"
                />
              </div>
              <div>
                <Label>Prix de vente (EUR) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={venteData.prixVente}
                  onChange={(e) => setVenteData({ ...venteData, prixVente: e.target.value })}
                  placeholder="Ex: 150.00"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="creerFactureBois"
                  checked={venteData.creerFacture}
                  onCheckedChange={(checked) => setVenteData({ ...venteData, creerFacture: checked === true })}
                />
                <label htmlFor="creerFactureBois" className="text-sm">
                  Créer une facture automatiquement
                </label>
              </div>
              <Button
                onClick={handleVendre}
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={!venteData.prixVente}
              >
                Confirmer la vente
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Utilisation */}
      <Dialog open={showUtiliseDialog} onOpenChange={setShowUtiliseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marquer comme utilise</DialogTitle>
          </DialogHeader>
          {selectedProduction && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 rounded-lg">
                <p className="text-sm text-amber-700">
                  {selectedProduction.type} - {selectedProduction.volumeM3} m³
                </p>
              </div>
              <div>
                <Label>Destination</Label>
                <Select
                  value={utiliseData.destination}
                  onValueChange={(v) => setUtiliseData({ ...utiliseData, destination: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DESTINATIONS_UTILISATION.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleUtiliser} className="w-full">
                Confirmer
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Wizard "Replanter après coupe" */}
      <AssistantPlantationDialog
        open={showReplanter}
        onOpenChange={(open) => {
          setShowReplanter(open)
          if (!open) setReplanterPrefill(null)
        }}
        prefill={replanterPrefill || undefined}
        onSuccess={() => {
          toast({ title: "Campagne de replantation créée" })
        }}
      />
    </div>
  )
}
