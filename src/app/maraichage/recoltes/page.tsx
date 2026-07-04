"use client"

/**
 * Page Récoltes - Suivi de la production avec gestion stock/vente
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, differenceInCalendarDays } from "date-fns"
import { fr } from "date-fns/locale"
import { ArrowLeft, BarChart3, Package, ShoppingCart, Euro, Trash2, AlertTriangle, Plus, RefreshCw, FileText, Clock, Timer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Combobox } from "@/components/ui/combobox"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"

interface RecolteWithRelations {
  id: number
  especeId: string
  cultureId: number
  date: string
  quantite: number
  statut: string
  dateVente: string | null
  prixKg: number | null
  prixTotal: number | null
  clientId: number | null
  clientNom: string | null
  factureId: number | null
  datePeremption: string | null
  notes: string | null
  espece: {
    id: string
    prixKg: number | null
    famille: { id: string; couleur: string | null } | null
  }
  culture: {
    id: number
    variete: { id: string } | null
    planche: { id: string; nom: string } | null
  }
}

interface Client {
  id: number
  nom: string
}

export default function RecoltesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = React.useState<RecolteWithRelations[]>([])
  const [clients, setClients] = React.useState<Client[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState("stock")

  const [selectedAnnee, setSelectedAnnee] = React.useState<string>('all')
  const [selectedEspece, setSelectedEspece] = React.useState<string>('all')
  const [especes, setEspeces] = React.useState<{ id: string }[]>([])

  // Dialog vente
  const [showVenteDialog, setShowVenteDialog] = React.useState(false)
  const [selectedRecolte, setSelectedRecolte] = React.useState<RecolteWithRelations | null>(null)
  const [venteData, setVenteData] = React.useState({
    clientId: "",
    clientNom: "",
    prixKg: "",
    quantiteVendue: "",
    creerFacture: false,
  })
  const [venteSubmitting, setVenteSubmitting] = React.useState(false)

  // Générer les annees disponibles (5 dernières annees)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  // Charger les données
  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      let url = `/api/recoltes?pageSize=500`
      if (selectedAnnee && selectedAnnee !== 'all') {
        url += `&annee=${selectedAnnee}`
      }
      if (selectedEspece && selectedEspece !== 'all') {
        url += `&especeId=${encodeURIComponent(selectedEspece)}`
      }

      const [recoltesRes, clientsRes] = await Promise.all([
        fetch(url),
        fetch("/api/comptabilite/clients?actif=true"),
      ])

      if (recoltesRes.ok) {
        const result = await recoltesRes.json()
        setData(result.data || [])
        if (result.especes) {
          setEspeces(result.especes)
        }
      }
      if (clientsRes.ok) {
        const result = await clientsRes.json()
        setClients(result.data || [])
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les récoltes",
      })
    } finally {
      setIsLoading(false)
    }
  }, [selectedAnnee, selectedEspece, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filtrer par statut
  const stockRecoltes = data.filter(r => !r.statut || r.statut === "en_stock")
  const venduRecoltes = data.filter(r => r.statut === "vendu")
  const perteRecoltes = data.filter(r => r.statut === "perte" || r.statut === "consomme")

  const clientOptions = React.useMemo(() =>
    clients.map(c => ({ value: c.nom, label: c.nom })),
    [clients]
  )

  // Compter les périmés et proches de péremption.
  // Audit fuseaux #77 : la DLC est une date « jour seul » stockée à minuit UTC.
  // On reconstruit son jour calendaire en date LOCALE et on compare en JOURS :
  // un lot n'est périmé qu'APRÈS son jour de DLC (pas dès 00:00/02:00 le jour
  // même), et le décompte n'est plus faussé en Outre-mer.
  const now = new Date()
  // Reconstruit le jour calendaire (stocké minuit UTC) en date LOCALE, pour
  // affichage et comparaison sans décalage de fuseau.
  const jourLocal = (iso: string) => {
    const d = new Date(iso)
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  }
  const joursAvantDLC = (iso: string) => differenceInCalendarDays(jourLocal(iso), now)
  const perimesCount = stockRecoltes.filter(r => r.datePeremption && joursAvantDLC(r.datePeremption) < 0).length
  const bientotPerimesCount = stockRecoltes.filter(r => {
    if (!r.datePeremption) return false
    const days = joursAvantDLC(r.datePeremption)
    return days >= 0 && days <= 3
  }).length

  // Stats
  const stockKg = stockRecoltes.reduce((sum, r) => sum + r.quantite, 0)
  const venduKg = venduRecoltes.reduce((sum, r) => sum + r.quantite, 0)
  const totalVentes = venduRecoltes.reduce((sum, r) => sum + (r.prixTotal || 0), 0)
  const stockValeur = stockRecoltes.reduce((sum, r) => sum + (r.quantite * (r.espece?.prixKg || 0)), 0)

  const handleDelete = async (id: number) => {
    if (!(await confirmDialog("Supprimer cette récolte ?"))) return

    try {
      const response = await fetch(`/api/recoltes/${id}`, { method: "DELETE" })
      if (response.ok) {
        setData(data.filter(r => r.id !== id))
        toast({ title: "Récolte supprimée" })
      } else {
        const payload = await response.json().catch(() => null)
        toast({
          variant: "destructive",
          title: "Erreur",
          description: payload?.error || "La suppression a échoué",
        })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  const openVenteDialog = (recolte: RecolteWithRelations) => {
    setSelectedRecolte(recolte)
    setVenteData({
      clientId: "",
      clientNom: "",
      prixKg: recolte.espece?.prixKg?.toString() || "",
      quantiteVendue: recolte.quantite.toString(),
      creerFacture: false,
    })
    setShowVenteDialog(true)
  }

  const handleVendre = async () => {
    if (!selectedRecolte || venteSubmitting) return

    // Règle projet (famille C) : pas de bouton grisé muet — gardes
    // early-return avec toast au submit. Le serveur exige prix + date +
    // client (recoltePatchSchema), on valide donc les trois ici.
    const prixKg = parseFloat(venteData.prixKg)
    if (!prixKg || prixKg <= 0) {
      toast({
        variant: "destructive",
        title: "Prix manquant",
        description: "Saisissez un prix au kg supérieur à 0 €.",
      })
      return
    }
    const quantite = parseFloat(venteData.quantiteVendue)
    if (!quantite || quantite <= 0) {
      toast({
        variant: "destructive",
        title: "Quantité invalide",
        description: "Saisissez la quantité vendue en kg.",
      })
      return
    }
    if (quantite > selectedRecolte.quantite) {
      toast({
        variant: "destructive",
        title: "Quantité trop élevée",
        description: `Maximum disponible : ${selectedRecolte.quantite.toFixed(2)} kg.`,
      })
      return
    }
    if (!venteData.clientNom.trim()) {
      toast({
        variant: "destructive",
        title: "Client manquant",
        description: "Sélectionnez un client ou saisissez son nom.",
      })
      return
    }
    const prixTotal = prixKg * quantite

    setVenteSubmitting(true)
    try {
      const res = await fetch(`/api/recoltes/${selectedRecolte.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statut: "vendu",
          dateVente: new Date().toISOString(),
          prixKg,
          prixTotal,
          quantiteVendue: quantite,
          clientId: venteData.clientId ? parseInt(venteData.clientId) : null,
          clientNom: venteData.clientNom || null,
          creerFacture: venteData.creerFacture,
        }),
      })

      if (res.ok) {
        setShowVenteDialog(false)
        setSelectedRecolte(null)
        toast({
          title: "Vente enregistrée",
          description: venteData.creerFacture ? "Facture créée" : undefined
        })
        // Une vente partielle scinde la récolte (reliquat en stock) → on
        // recharge la liste plutôt que de patcher la ligne localement.
        fetchData()
      } else {
        const payload = await res.json().catch(() => null)
        toast({
          variant: "destructive",
          title: "Erreur",
          description: payload?.error || "La vente n'a pas pu être enregistrée",
        })
      }
    } catch (err) {
      toast({ title: "Erreur", variant: "destructive" })
    } finally {
      setVenteSubmitting(false)
    }
  }

  const handleMarquerPerte = async (recolte: RecolteWithRelations) => {
    if (!(await confirmDialog("Marquer cette récolte comme perte ?"))) return

    try {
      const res = await fetch(`/api/recoltes/${recolte.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: "perte" }),
      })

      if (res.ok) {
        const updated = await res.json()
        setData(data.map(r => r.id === updated.id ? updated : r))
        toast({ title: "Marqué comme perte" })
      } else {
        const payload = await res.json().catch(() => null)
        toast({
          variant: "destructive",
          title: "Erreur",
          description: payload?.error || "Le changement de statut a échoué",
        })
      }
    } catch (err) {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleConsommer = async (recolte: RecolteWithRelations) => {
    if (!(await confirmDialog("Marquer cette récolte comme consommation perso (auto-consommation) ?"))) return

    try {
      const res = await fetch(`/api/recoltes/${recolte.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: "consomme" }),
      })

      if (res.ok) {
        const updated = await res.json()
        setData(data.map(r => r.id === updated.id ? updated : r))
        toast({ title: "Consommation perso enregistrée" })
      } else {
        const payload = await res.json().catch(() => null)
        toast({
          variant: "destructive",
          title: "Erreur",
          description: payload?.error || "Le changement de statut a échoué",
        })
      }
    } catch (err) {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Accueil
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-green-600" />
              <h1 className="text-xl font-bold">Récoltes</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Link href="/maraichage/recoltes/saisie">
              <Button className="bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4 mr-1" />
                Nouvelle récolte
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Filtres */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Année :</span>
            <Select value={selectedAnnee} onValueChange={(v) => setSelectedAnnee(v)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Espèce :</span>
            <Select value={selectedEspece} onValueChange={(v) => setSelectedEspece(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {especes.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-green-600" />
                <p className="text-sm text-green-700">En stock</p>
              </div>
              <p className="text-2xl font-bold text-green-800">{stockKg.toFixed(1)} kg</p>
              <p className="text-xs text-green-600">Valeur: {stockValeur.toFixed(2)} €</p>
              {(perimesCount > 0 || bientotPerimesCount > 0) && (
                <div className="mt-1 flex gap-2 text-xs">
                  {perimesCount > 0 && (
                    <span className="text-red-600">{perimesCount} périmé(s)</span>
                  )}
                  {bientotPerimesCount > 0 && (
                    <span className="text-amber-600">{bientotPerimesCount} bientôt</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
                <p className="text-sm text-blue-700">Vendu</p>
              </div>
              <p className="text-2xl font-bold text-blue-800">{venduKg.toFixed(1)} kg</p>
              <p className="text-xs text-blue-600">{venduRecoltes.length} vente(s)</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Euro className="h-4 w-4 text-emerald-600" />
                <p className="text-sm text-emerald-700">CA Ventes</p>
              </div>
              <p className="text-2xl font-bold text-emerald-800">{totalVentes.toFixed(2)} €</p>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <p className="text-sm text-orange-700">Pertes</p>
              </div>
              <p className="text-2xl font-bold text-orange-800">
                {perteRecoltes.reduce((sum, r) => sum + r.quantite, 0).toFixed(1)} kg
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="stock" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Stock ({stockRecoltes.length})
            </TabsTrigger>
            <TabsTrigger value="vendu" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Vendu ({venduRecoltes.length})
            </TabsTrigger>
            <TabsTrigger value="perte" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Pertes ({perteRecoltes.length})
            </TabsTrigger>
          </TabsList>

          {/* Stock */}
          <TabsContent value="stock">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Récoltes en stock</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-muted-foreground">Chargement...</p>
                ) : stockRecoltes.length === 0 ? (
                  <p className="text-muted-foreground">Aucune récolte en stock</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Espèce</TableHead>
                        <TableHead>Variété</TableHead>
                        <TableHead>Planche</TableHead>
                        <TableHead className="text-right">Quantité</TableHead>
                        <TableHead>Péremption</TableHead>
                        <TableHead className="text-right">Valeur est.</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockRecoltes.map((r) => {
                        const isPerime = r.datePeremption ? joursAvantDLC(r.datePeremption) < 0 : false
                        const daysLeft = r.datePeremption ? joursAvantDLC(r.datePeremption) : null
                        const isBientotPerime = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3

                        return (
                          <TableRow
                            key={r.id}
                            className={isPerime ? "bg-red-50" : isBientotPerime ? "bg-amber-50" : ""}
                          >
                            <TableCell>{format(jourLocal(r.date), "dd/MM/yyyy", { locale: fr })}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: r.espece?.famille?.couleur || '#888' }}
                                />
                                <span className="font-medium">{r.especeId}</span>
                              </div>
                            </TableCell>
                            <TableCell>{r.culture?.variete?.id || "-"}</TableCell>
                            <TableCell>{r.culture?.planche?.nom || "-"}</TableCell>
                            <TableCell className="text-right font-medium text-green-600">
                              {r.quantite.toFixed(2)} kg
                            </TableCell>
                            <TableCell>
                              {r.datePeremption ? (
                                <div className="flex items-center gap-1">
                                  {isPerime ? (
                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                  ) : isBientotPerime ? (
                                    <Timer className="h-4 w-4 text-amber-500" />
                                  ) : (
                                    <Clock className="h-4 w-4 text-slate-400" />
                                  )}
                                  <span className={
                                    isPerime ? "text-red-600 font-medium" :
                                    isBientotPerime ? "text-amber-600" :
                                    "text-slate-600"
                                  }>
                                    {format(jourLocal(r.datePeremption), "dd/MM", { locale: fr })}
                                    {daysLeft !== null && daysLeft >= 0 && (
                                      <span className="text-xs ml-1">
                                        ({daysLeft === 0 ? "aujourd'hui" : `J-${daysLeft}`})
                                      </span>
                                    )}
                                    {isPerime && <span className="text-xs ml-1">(périmé)</span>}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-blue-600">
                              {r.espece?.prixKg ? `${(r.quantite * r.espece.prixKg).toFixed(2)} €` : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="outline" size="sm" onClick={() => openVenteDialog(r)}>
                                  <Euro className="h-4 w-4 mr-1" />
                                  Vendre
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleConsommer(r)}>
                                  Conso perso
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleMarquerPerte(r)}>
                                  Perte
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vendu */}
          <TabsContent value="vendu">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Récoltes vendues</CardTitle>
              </CardHeader>
              <CardContent>
                {venduRecoltes.length === 0 ? (
                  <p className="text-muted-foreground">Aucune vente enregistrée</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date vente</TableHead>
                        <TableHead>Espèce</TableHead>
                        <TableHead className="text-right">Quantité</TableHead>
                        <TableHead className="text-right">Prix/kg</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Facture</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {venduRecoltes.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            {r.dateVente ? format(new Date(r.dateVente), "dd/MM/yyyy", { locale: fr }) : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: r.espece?.famille?.couleur || '#888' }}
                              />
                              <span>{r.especeId}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{r.quantite.toFixed(2)} kg</TableCell>
                          <TableCell className="text-right">{r.prixKg ? `${r.prixKg.toFixed(2)} €` : "-"}</TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            {r.prixTotal ? `${r.prixTotal.toFixed(2)} €` : "-"}
                          </TableCell>
                          <TableCell>{r.clientNom || "-"}</TableCell>
                          <TableCell>
                            {r.factureId ? (
                              <Link href={`/comptabilite/factures?id=${r.factureId}`}>
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
          </TabsContent>

          {/* Pertes */}
          <TabsContent value="perte">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pertes / Consommation perso</CardTitle>
              </CardHeader>
              <CardContent>
                {perteRecoltes.length === 0 ? (
                  <p className="text-muted-foreground">Aucune perte enregistrée</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date récolte</TableHead>
                        <TableHead>Espèce</TableHead>
                        <TableHead>Variété</TableHead>
                        <TableHead className="text-right">Quantité</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {perteRecoltes.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{format(new Date(r.date), "dd/MM/yyyy", { locale: fr })}</TableCell>
                          <TableCell>{r.especeId}</TableCell>
                          <TableCell>{r.culture?.variete?.id || "-"}</TableCell>
                          <TableCell className="text-right text-orange-600">{r.quantite.toFixed(2)} kg</TableCell>
                          <TableCell className="text-muted-foreground">{r.notes || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog Vente */}
        <Dialog open={showVenteDialog} onOpenChange={setShowVenteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vendre cette récolte</DialogTitle>
            </DialogHeader>
            {selectedRecolte && (
              <div className="space-y-4">
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-700">
                    {selectedRecolte.especeId} - {selectedRecolte.quantite.toFixed(2)} kg
                    {selectedRecolte.culture?.variete && ` (${selectedRecolte.culture.variete.id})`}
                  </p>
                </div>
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Prix au kg (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={venteData.prixKg}
                      onChange={(e) => setVenteData({ ...venteData, prixKg: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Quantité vendue (kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={venteData.quantiteVendue}
                      onChange={(e) => setVenteData({ ...venteData, quantiteVendue: e.target.value })}
                    />
                  </div>
                </div>
                {venteData.prixKg && venteData.quantiteVendue && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">
                      Total: <span className="font-bold">
                        {(parseFloat(venteData.prixKg) * parseFloat(venteData.quantiteVendue)).toFixed(2)} €
                      </span>
                    </p>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="creerFacture"
                    checked={venteData.creerFacture}
                    onCheckedChange={(checked) => setVenteData({ ...venteData, creerFacture: checked === true })}
                  />
                  <label htmlFor="creerFacture" className="text-sm">
                    Créer une facture automatiquement
                  </label>
                </div>
                <Button
                  onClick={handleVendre}
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={venteSubmitting}
                >
                  {venteSubmitting ? "Enregistrement…" : "Confirmer la vente"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
