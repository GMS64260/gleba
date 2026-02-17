"use client"

/**
 * Onglet Productions - Recoltes fruits + Production bois
 */

import * as React from "react"
import Link from "next/link"
import { isPast, differenceInDays } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
} from "lucide-react"
import { Combobox } from "@/components/ui/combobox"
import { useToast } from "@/hooks/use-toast"

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
  { value: "elagage", label: "Elagage" },
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
          Recoltes Fruits
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
  const [newRecolte, setNewRecolte] = React.useState({
    arbreId: "",
    date: new Date().toISOString().split("T")[0],
    quantite: "",
    qualite: "",
    prixKg: "",
    datePeremption: "",
    notes: "",
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
      return <Badge variant="destructive" className="text-xs">Perime</Badge>
    }
    const days = differenceInDays(date, now)
    if (days <= 3) {
      return <Badge className="bg-orange-500 text-xs">{days}j restants</Badge>
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
        }),
      })
      if (res.ok) {
        setShowDialog(false)
        setNewRecolte({
          arbreId: "",
          date: new Date().toISOString().split("T")[0],
          quantite: "",
          qualite: "",
          prixKg: "",
          datePeremption: "",
          notes: "",
        })
        toast({ title: "Recolte enregistree" })
        fetchData()
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette recolte ?")) return
    try {
      const res = await fetch(`/api/arbres/recoltes/${id}`, { method: "DELETE" })
      if (res.ok) {
        setRecoltes(recoltes.filter((r) => r.id !== id))
        toast({ title: "Recolte supprimee" })
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
        toast({ title: "Vente enregistree" })
        fetchData()
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handlePerte = async (id: number) => {
    if (!confirm("Marquer cette recolte comme perte ?")) return
    try {
      const res = await fetch(`/api/arbres/recoltes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: "perte" }),
      })
      if (res.ok) {
        toast({ title: "Perte enregistree" })
        fetchData()
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
              <p className="text-xs text-muted-foreground">{stockValeur.toFixed(0)} EUR estime</p>
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
              Pertes
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
              Total recoltes
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-2xl font-bold">{recoltes.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertes peremption */}
      {(perimesCount > 0 || bientotPerimesCount > 0) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-orange-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alertes peremption
            </CardTitle>
          </CardHeader>
          <CardContent>
            {perimesCount > 0 && (
              <p className="text-red-700">{perimesCount} recolte(s) perimee(s)</p>
            )}
            {bientotPerimesCount > 0 && (
              <p className="text-orange-700">{bientotPerimesCount} recolte(s) proche(s) de la peremption</p>
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
              Pertes ({perteRecoltes.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={() => setShowDialog(true)} size="sm" className="bg-orange-600 hover:bg-orange-700 ml-2">
          <Plus className="h-4 w-4 mr-1" />
          Nouvelle recolte
        </Button>
      </div>

      {/* Onglet Stock */}
      {activeTab === "stock" && (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-8 text-muted-foreground">Chargement...</p>
            ) : stockRecoltes.length === 0 ? (
              <p className="p-8 text-muted-foreground text-center">Aucune recolte en stock</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Arbre</TableHead>
                    <TableHead className="text-right">Quantite</TableHead>
                    <TableHead>Qualite</TableHead>
                    <TableHead className="text-right">Prix/kg</TableHead>
                    <TableHead>Peremption</TableHead>
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
                    <TableHead>Date recolte</TableHead>
                    <TableHead>Arbre</TableHead>
                    <TableHead className="text-right">Quantite</TableHead>
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
              <p className="p-8 text-muted-foreground text-center">Aucune perte enregistree</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Arbre</TableHead>
                    <TableHead className="text-right">Quantite</TableHead>
                    <TableHead>Qualite</TableHead>
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
                          {r.statut === "perte" ? "Perte" : "Consomme"}
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
            <DialogTitle>Enregistrer une recolte</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Arbre *</Label>
              <Select
                value={newRecolte.arbreId}
                onValueChange={(v) => setNewRecolte({ ...newRecolte, arbreId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selectionner un arbre" />
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
                <Label>Quantite (kg) *</Label>
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
                <Label>Qualite</Label>
                <Select
                  value={newRecolte.qualite}
                  onValueChange={(v) => setNewRecolte({ ...newRecolte, qualite: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selectionner" />
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
              <Label>Date de peremption</Label>
              <Input
                type="date"
                value={newRecolte.datePeremption}
                onChange={(e) => setNewRecolte({ ...newRecolte, datePeremption: e.target.value })}
              />
            </div>
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
            <DialogTitle>Vendre la recolte</DialogTitle>
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
                <Label htmlFor="creerFactureRecolte">Creer une facture (TVA 5.5%)</Label>
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

  const [newProduction, setNewProduction] = React.useState({
    arbreId: "",
    date: new Date().toISOString().split("T")[0],
    type: "elagage",
    volumeM3: "",
    poidsKg: "",
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
          poidsKg: newProduction.poidsKg ? parseFloat(newProduction.poidsKg) : null,
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
          poidsKg: "",
          notes: "",
        })
        toast({ title: "Production enregistree en stock" })
        fetchData()
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
        toast({ title: "Vente enregistree" })
        fetchData()
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
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette production ?")) return
    try {
      const res = await fetch(`/api/arbres/bois/${id}`, { method: "DELETE" })
      if (res.ok) {
        setProductions(productions.filter((p) => p.id !== id))
        toast({ title: "Production supprimee" })
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
            <p className="text-2xl font-bold text-amber-800">{stockVolume.toFixed(1)} m3</p>
            <p className="text-xs text-amber-600">{stockProductions.length} lot(s)</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="h-4 w-4 text-green-600" />
              <p className="text-sm text-green-700">Vendu</p>
            </div>
            <p className="text-2xl font-bold text-green-800">{venduVolume.toFixed(1)} m3</p>
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
                      <TableCell className="text-right">{p.volumeM3 ? `${p.volumeM3} m3` : "-"}</TableCell>
                      <TableCell className="text-right">{p.poidsKg ? `${p.poidsKg} kg` : "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
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
              <p className="p-8 text-muted-foreground text-center">Aucune vente enregistree</p>
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
                      <TableCell className="text-right">{p.volumeM3 ? `${p.volumeM3} m3` : "-"}</TableCell>
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
              <p className="p-8 text-muted-foreground text-center">Aucune utilisation enregistree</p>
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
                      <TableCell className="text-right">{p.volumeM3 ? `${p.volumeM3} m3` : "-"}</TableCell>
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
                  <SelectValue placeholder="Aucun arbre specifique" />
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
                <Label>Volume (m3)</Label>
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
                  {selectedProduction.type} - {selectedProduction.volumeM3} m3
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
                    <SelectValue placeholder="Selectionner un client" />
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
                  Creer une facture automatiquement
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
                  {selectedProduction.type} - {selectedProduction.volumeM3} m3
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
    </div>
  )
}
