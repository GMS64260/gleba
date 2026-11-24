"use client"

import { devisePieceAffichage, formatMontantPiece, totalDansDeviseCourante, type PieceAvecDevise } from "@/lib/comptabilite/devise-piece-affichage"
import { useDevise } from "@/hooks/use-devise"

/**
 * Page Récoltes - Suivi de la production avec gestion stock/vente
 */

import * as React from "react"
import Link from "next/link"
import { format, differenceInCalendarDays } from "date-fns"
import { jourCivilStocke, jourLocalISO } from "@/lib/jour-civil"
import { SelectNatif } from "@/components/ui/select-natif"
import { fr } from "date-fns/locale"
import { ArrowLeft, BarChart3, Package, ShoppingCart, Euro, Trash2, AlertTriangle, Plus, RefreshCw, FileText, Clock, Timer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
  DialogDescription,
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
import { nomEspece } from "@/lib/especes/affichage"
import { confirmDialog } from "@/lib/global-dialog"
import { BoutonPartagerRecolte } from "@/components/avis/PartagerRecolte"
import { AppHeader, PageToolbar } from "@/components/shell/AppHeader"
import { getAvailableYears } from "@/components/year-selector"
import { libelleUniteQuantite, type UniteQuantite } from "@/lib/recolte/projection"
import { symboleDevise, formatMontantDevise } from "@/lib/format-utils"
import { formatPrixUnitaire } from "@/lib/comptabilite/prix-unitaire"
import {
  libelleCourtValorisation,
  libelleMethodesValorisation,
  libelleValorisationLot,
  prixProposeDeVente,
  type ValorisationLot,
} from "@/lib/recolte/valorisation"
import {
  ajouterQuantite,
  formatQuantite,
  formatQuantiteParUnite,
  type QuantiteParUnite,
} from "@/lib/recolte/quantites"

/** Unité d'une ligne de récolte ; null = kg (lignes antérieures au 2026-08-20). */
const uniteRecolte = (unite: string | null | undefined): UniteQuantite =>
  (unite ?? 'kg') as UniteQuantite

/**
 * QA cmv2r1oao — la vente d'une récolte en tiges parlait de kilos (« Zinnia -
 * 5.00 kg », « Prix au kg ») : le prix porté par `prixKg` est un prix PAR UNITÉ
 * de la récolte, l'écran doit nommer cette unité.
 */
const prixParUnite = (unite: UniteQuantite): string =>
  unite === 'kg' ? 'au kg' : `par ${libelleUniteQuantite(unite, 1)}`

/** Sorties de stock hors vente : la vente, elle, crée une recette. */
type MotifSortie = "perte" | "consomme" | "don"
const MOTIFS_SORTIE: Record<MotifSortie, { libelle: string; fait: string; badge: string }> = {
  perte: { libelle: "Perte", fait: "Perte enregistrée", badge: "border-orange-300 text-orange-700" },
  consomme: { libelle: "Conso perso", fait: "Consommation perso enregistrée", badge: "border-sky-300 text-sky-700" },
  don: { libelle: "Don", fait: "Don enregistré", badge: "border-violet-300 text-violet-700" },
}

interface RecolteWithRelations extends PieceAvecDevise {
  id: number
  especeId: string
  cultureId: number
  date: string
  quantite: number
  stockDisponibleCommercial?: number | null
  produitsBoutique?: Array<{ id: number }>
  /** Lot dont le stock vit en boutique, hors du stock de l'espèce (même règle que lui, servie par `GET /api/recoltes`). */
  horsStock?: boolean
  /** Unité figée à la saisie ; null = kg (lignes antérieures au 2026-08-20). */
  unite: string | null
  statut: string
  dateVente: string | null
  /** Jour d'une sortie hors vente (perte, consommation personnelle, don). */
  dateSortie?: string | null
  /** Sortie saisie dans Stocks > Consommations qui a pris ce lot : elle seule le rend au stock. */
  consommationId?: number | null
  prixKg: number | null
  prixTotal: number | null
  clientId: number | null
  clientNom: string | null
  factureId: number | null
  datePeremption: string | null
  notes: string | null
  /**
   * Valeur d'un lot en stock servie par `GET /api/recoltes` (règle unique
   * `valoriserLot`, la même que Comptabilité > Stocks unifiés), source
   * toujours dite (`aucune` = sans prix dans son unité) ; null = lot sorti.
   */
  valorisation?: ValorisationLot | null
  espece: {
    nom: string | null
    id: string
    prixKg: number | null
    famille: { id: string; couleur: string | null } | null
  }
  /** null : lot d'inventaire, né d'un comptage du stock, sans culture d'origine. */
  culture: {
    id: number
    variete: { id: string; nom: string | null } | null
    planche: { id: string; nom: string } | null
  } | null
}

interface Client {
  id: number
  nom: string
}

/** Sorties (ventes, pertes, consommations) chargées au plus, les plus récentes d'abord. */
const PLAFOND_HISTORIQUE = 1000

export default function RecoltesPage() {
  const devise = useDevise()
  const symbole = devise === null ? "—" : symboleDevise(devise)
  const formatMontant = (value: number) => devise === null ? "—" : formatMontantDevise(value, devise)
  const formatPrixVente = (recolte: RecolteWithRelations) => {
    const monnaie = devisePieceAffichage(recolte, devise)
    return monnaie === null ? "—" : `${formatPrixUnitaire(recolte.prixKg ?? 0, monnaie)} ${symboleDevise(monnaie)} / ${libelleUniteQuantite(uniteRecolte(recolte.unite), 1)}`
  }
  const { toast } = useToast()
  const [data, setData] = React.useState<RecolteWithRelations[]>([])
  const [clients, setClients] = React.useState<Client[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  // Un échec de chargement est dit dans les onglets : « Aucune récolte en
  // stock » sous une erreur laissait croire le stock vide.
  const [erreurChargement, setErreurChargement] = React.useState(false)
  // Seule la dernière demande écrit (année ou espèce changée entre-temps).
  const demandeRef = React.useRef(0)
  const [activeTab, setActiveTab] = React.useState("stock")

  const [selectedAnnee, setSelectedAnnee] = React.useState<string>('all')
  // Nombre total de sorties quand l'historique chargé est tronqué (sinon null).
  const [historiqueTronque, setHistoriqueTronque] = React.useState<number | null>(null)
  const [selectedEspece, setSelectedEspece] = React.useState<string>('all')
  const [especes, setEspeces] = React.useState<{ id: string; nom: string | null }[]>([])

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

  // Dialog sortie hors vente (perte, consommation personnelle, don)
  const [sortieRecolte, setSortieRecolte] = React.useState<RecolteWithRelations | null>(null)
  const [sortieData, setSortieData] = React.useState({ motif: "perte" as MotifSortie, quantite: "", date: "", notes: "" })
  const [sortieSubmitting, setSortieSubmitting] = React.useState(false)

  const years = getAvailableYears()

  // Charger les données
  const fetchData = React.useCallback(async () => {
    const demande = ++demandeRef.current
    setIsLoading(true)
    try {
      // Revue du 2026-11-04 — deux lectures : les lots EN STOCK sans plafond
      // (un lot de septembre 2025 encore en stock sortait des 500 dernières
      // récoltes, donc de l'onglet Stock, et ne pouvait plus être vendu d'ici),
      // et l'historique des sorties, borné et signalé quand il est tronqué.
      let filtres = ""
      if (selectedAnnee && selectedAnnee !== 'all') {
        filtres += `&annee=${selectedAnnee}`
      }
      if (selectedEspece && selectedEspece !== 'all') {
        filtres += `&especeId=${encodeURIComponent(selectedEspece)}`
      }

      const [stockRes, historiqueRes, clientsRes] = await Promise.all([
        fetch(`/api/recoltes?statut=en_stock&pageSize=5000${filtres}`),
        fetch(`/api/recoltes?statut=vendu,consomme,perte,don,ecart,a_completer&pageSize=${PLAFOND_HISTORIQUE}${filtres}`),
        fetch("/api/comptabilite/clients?actif=true"),
      ])

      if (stockRes.ok && historiqueRes.ok) {
        const [stock, historique] = await Promise.all([stockRes.json(), historiqueRes.json()])
        if (demande !== demandeRef.current) return
        setErreurChargement(false)
        setData([...(stock.data || []), ...(historique.data || [])])
        setHistoriqueTronque(
          typeof historique.total === "number" && historique.total > (historique.data?.length ?? 0)
            ? historique.total
            : null,
        )
        if (stock.especes) {
          setEspeces(stock.especes)
        }
      } else {
        throw new Error("Récoltes indisponibles")
      }
      if (clientsRes.ok) {
        const result = await clientsRes.json()
        if (demande === demandeRef.current) setClients(result.data || [])
      }
    } catch {
      if (demande !== demandeRef.current) return
      // Les lignes d'un autre filtre ne restent pas sous le nouveau.
      setData([])
      setHistoriqueTronque(null)
      setErreurChargement(true)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les récoltes",
      })
    } finally {
      if (demande === demandeRef.current) setIsLoading(false)
    }
  }, [selectedAnnee, selectedEspece, toast])

  /** Texte d'un onglet sans ligne : chargement, échec, ou vraiment vide. */
  const messageSansLigne = (vide: string) =>
    isLoading
      ? "Chargement..."
      : erreurChargement
        ? "Les récoltes n'ont pas pu être chargées. Changez de filtre ou rechargez la page pour réessayer."
        : vide

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filtrer par statut
  const stockRecoltes = data.filter(r => (!r.statut || r.statut === "en_stock") && !r.horsStock && (r.stockDisponibleCommercial ?? r.quantite) > 0).map(r => ({ ...r, quantite: r.stockDisponibleCommercial ?? r.quantite }))
  const venduRecoltes = data.filter(r => r.statut === "vendu")
  // QA 2026-07-30 — L'auto-consommation était rangée avec les pertes : le KPI
  // annonçait « Pertes 0,8 kg » pour une récolte simplement consommée à la
  // ferme. Ce sont deux notions de gestion différentes ; la distinction existe
  // déjà en base (statut « consomme » vs « perte »).
  const perteRecoltes = data.filter(r => r.statut === "perte")
  const consoPersoRecoltes = data.filter(r => r.statut === "consomme")
  const donRecoltes = data.filter(r => r.statut === "don")
  // Écarts d'inventaire : ce qu'un comptage n'a pas retrouvé, à part des pertes.
  const ecartRecoltes = data.filter(r => r.statut === "ecart")
  const sortiesRecoltes = [...perteRecoltes, ...consoPersoRecoltes, ...donRecoltes, ...ecartRecoltes]

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

  // Stats. Les quantités sont VENTILÉES par unité : depuis le 2026-08-20 une
  // récolte peut être comptée en tiges, pièces ou bottes, et un total unique
  // additionnerait des tiges de dahlia à des kilos de carotte.
  // Les montants en euros, eux, restent additionnables : `prixKg` est un prix
  // PAR UNITÉ de la récolte, quelle que soit cette unité.
  const ventiler = (lignes: RecolteWithRelations[]) =>
    lignes.reduce<QuantiteParUnite>(
      (acc, r) => ajouterQuantite(acc, uniteRecolte(r.unite), r.quantite),
      {},
    )
  const stockParUnite = ventiler(stockRecoltes)
  const venduParUnite = ventiler(venduRecoltes)
  const totalVentes = venduRecoltes.reduce((sum, r) => sum + (r.prixTotal || 0), 0)
  // Ticket cmvnvaal2 — la valeur d'un lot vient du serveur (`valoriserLot`),
  // jamais de `quantité × Espece.prixKg` : ce prix de catalogue est en €/kg
  // (dahlia à 30) et faisait valoir 30 € à une tige. Même règle et même
  // chiffre que Comptabilité > Stocks unifiés, méthode dite à l'écran.
  const stockValeur =
    Math.round(stockRecoltes.reduce((sum, r) => sum + (r.valorisation?.valeur ?? 0), 0) * 100) / 100
  const stockMethode = libelleMethodesValorisation(
    stockRecoltes.flatMap((r) => (r.valorisation ? [r.valorisation] : [])),
  )

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
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  const openVenteDialog = (recolte: RecolteWithRelations) => {
    setSelectedRecolte(recolte)
    setVenteData({
      clientId: "",
      clientNom: "",
      // Prix proposé = prix de valorisation du lot DANS SON UNITÉ, limité aux
      // sources admises pour une vente (`prixProposeDeVente`, la même liste que
      // la boutique) : jamais le barème indicatif ni un prix au kilo pour des tiges.
      prixKg: String(prixProposeDeVente(recolte.valorisation) ?? ""),
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
    const unite = uniteRecolte(selectedRecolte.unite)
    const prixKg = parseFloat(venteData.prixKg)
    if (!prixKg || prixKg <= 0) {
      toast({
        variant: "destructive",
        title: "Prix manquant",
        description: `Saisissez un prix ${prixParUnite(unite)} supérieur à 0 ${symbole}.`,
      })
      return
    }
    const quantite = parseFloat(venteData.quantiteVendue)
    if (!quantite || quantite <= 0 || (unite !== 'kg' && !Number.isInteger(quantite))) {
      toast({
        variant: "destructive",
        title: "Quantité invalide",
        description: unite === 'kg'
          ? "Saisissez la quantité vendue en kg."
          : `Saisissez un nombre entier de ${libelleUniteQuantite(unite, 2)} vendu(e)s.`,
      })
      return
    }
    if (quantite > selectedRecolte.quantite) {
      toast({
        variant: "destructive",
        title: "Quantité trop élevée",
        description: `Maximum disponible : ${formatQuantite(selectedRecolte.quantite, unite)}.`,
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
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    } finally {
      setVenteSubmitting(false)
    }
  }

  const ouvrirSortie = (recolte: RecolteWithRelations, motif: MotifSortie) => {
    setSortieRecolte(recolte)
    setSortieData({ motif, quantite: recolte.quantite.toString(), date: jourLocalISO(new Date()), notes: "" })
  }

  // Sortie en tout ou partie, à son jour : la partie sortie garde la ligne, le
  // reste redevient un lot en stock (le serveur scinde, comme pour une vente).
  const handleSortir = async () => {
    if (!sortieRecolte || sortieSubmitting) return
    const quantite = parseFloat(sortieData.quantite.replace(",", "."))
    if (!Number.isFinite(quantite) || quantite <= 0) {
      toast({ variant: "destructive", title: "Quantité invalide", description: "Indiquez une quantité supérieure à zéro." })
      return
    }
    setSortieSubmitting(true)
    try {
      const res = await fetch(`/api/recoltes/${sortieRecolte.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statut: sortieData.motif,
          quantiteSortie: quantite,
          // Aujourd'hui (jour du navigateur) : pas de date, le serveur garde l'instant.
          dateSortie: sortieData.date && sortieData.date !== jourLocalISO(new Date()) ? sortieData.date : undefined,
          ...(sortieData.notes.trim() ? { notes: sortieData.notes.trim() } : {}),
        }),
      })
      if (res.ok) {
        setSortieRecolte(null)
        toast({ title: MOTIFS_SORTIE[sortieData.motif].fait })
        fetchData()
      } else {
        const payload = await res.json().catch(() => null)
        toast({ variant: "destructive", title: "Erreur", description: payload?.error || "La sortie n'a pas pu être enregistrée" })
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    } finally {
      setSortieSubmitting(false)
    }
  }

  const handleRemettreEnStock = async (recolte: RecolteWithRelations) => {
    if (!(await confirmDialog("Remettre ce lot en stock ? La sortie sera annulée."))) return
    try {
      const res = await fetch(`/api/recoltes/${recolte.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: "en_stock" }),
      })
      if (res.ok) {
        toast({ title: "Lot remis en stock" })
        fetchData()
      } else {
        const payload = await res.json().catch(() => null)
        toast({ variant: "destructive", title: "Erreur", description: payload?.error || "Le lot n'a pas pu être remis en stock" })
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      {/* Header */}
      <AppHeader current="maraichage" showLune />
      <PageToolbar>
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
      </PageToolbar>

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
                  <SelectItem key={e.id} value={e.id}>{nomEspece(e)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 max-md:[&>*>*]:px-3 max-md:[&>*>*:first-child]:pt-3 max-md:[&>*>*:last-child]:pb-3 max-md:[&_.text-2xl]:text-xl md:grid-cols-4">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-green-600" />
                <p className="text-sm text-green-700">En stock</p>
              </div>
              <p className="text-2xl font-bold text-green-800">
                {formatQuantiteParUnite(stockParUnite)}
              </p>
              <p className="text-xs text-green-600">Valeur : {formatMontant(stockValeur)}</p>
              {stockMethode && (
                <p className="text-[11px] text-green-700/80">{stockMethode}</p>
              )}
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
              <p className="text-2xl font-bold text-blue-800">
                {formatQuantiteParUnite(venduParUnite)}
              </p>
              <p className="text-xs text-blue-600">{venduRecoltes.length} vente(s)</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Euro className="h-4 w-4 text-emerald-600" />
                <p className="text-sm text-emerald-700">CA Ventes</p>
              </div>
              <p className="text-2xl font-bold text-emerald-800">{totalDansDeviseCourante(venduRecoltes, devise) ? formatMontant(totalVentes) : "—"}</p>
              {historiqueTronque !== null && (
                <p className="text-[11px] text-emerald-700/80">
                  Sur les {PLAFOND_HISTORIQUE} sorties les plus récentes ({historiqueTronque} au total) : choisissez une année pour le détail.
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <p className="text-sm text-orange-700">Pertes</p>
              </div>
              <p className="text-2xl font-bold text-orange-800">
                {formatQuantiteParUnite(ventiler(perteRecoltes))}
              </p>
              {consoPersoRecoltes.length > 0 && (
                <p className="mt-1 text-xs text-orange-700/80">
                  dont conso perso à part : {formatQuantiteParUnite(ventiler(consoPersoRecoltes))}
                </p>
              )}
              {donRecoltes.length > 0 && (
                <p className="mt-1 text-xs text-orange-700/80">
                  dons à part : {formatQuantiteParUnite(ventiler(donRecoltes))}
                </p>
              )}
              {ecartRecoltes.length > 0 && (
                <p className="mt-1 text-xs text-orange-700/80">
                  écarts d&apos;inventaire à part : {formatQuantiteParUnite(ventiler(ecartRecoltes))}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Responsive 360px — 3 onglets + compteurs : TabsList inline-flex h-9 clippe sinon */}
          <TabsList className="mb-4 flex-wrap h-auto gap-y-1">
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
              Sorties ({sortiesRecoltes.length})
            </TabsTrigger>
          </TabsList>

          {/* Stock */}
          <TabsContent value="stock">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Récoltes en stock</CardTitle>
              </CardHeader>
              <CardContent>
                {data.some((r) => r.produitsBoutique?.length) && <p className="mb-3 text-sm text-muted-foreground">Les récoltes mises en boutique sont suivies dans leur catalogue. <Link className="text-primary underline" href="/boutique?tab=produits">Voir les stocks boutique</Link></p>}
                {isLoading || stockRecoltes.length === 0 ? (
                  <p className="text-muted-foreground" role={erreurChargement ? "alert" : undefined}>
                    {messageSansLigne("Aucune récolte en stock")}
                  </p>
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
                            <TableCell>
                              {/* Seul accès à la fiche de la récolte (correction de la date, de la quantité, des notes). */}
                              <Link
                                className="text-primary underline"
                                href={`/maraichage/recoltes/${r.id}`}
                                title="Ouvrir la fiche de cette récolte"
                              >
                                {format(jourLocal(r.date), "dd/MM/yyyy", { locale: fr })}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: r.espece?.famille?.couleur || '#888' }}
                                />
                                <span className="font-medium">{nomEspece({ id: r.especeId, nom: r.espece?.nom })}</span>
                              </div>
                            </TableCell>
                            <TableCell>{r.culture?.variete?.nom ?? r.culture?.variete?.id ?? "-"}</TableCell>
                            <TableCell>
                              {r.culture
                                ? r.culture.planche?.nom || "-"
                                : <Badge variant="outline" className="border-slate-300 text-slate-600" title="Lot né d'un comptage du stock, sans récolte d'origine">Comptage</Badge>}
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-600">
                              {formatQuantite(r.quantite, uniteRecolte(r.unite))}
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
                              {r.valorisation && r.valorisation.source !== "aucune" ? (
                                <span title={libelleValorisationLot(r.valorisation)}>
                                  {formatMontant(r.valorisation.valeur)}
                                  <span className="block text-[10px] text-muted-foreground">
                                    {devise === null ? "—" : formatPrixUnitaire(r.valorisation.prixUnitaire, devise)} {symbole} / {libelleUniteQuantite(r.valorisation.unite, 1)}, {libelleCourtValorisation(r.valorisation)}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  -
                                  <span className="block text-[10px]">
                                    sans prix en {libelleUniteQuantite(uniteRecolte(r.unite), 2)}
                                  </span>
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Link className="block text-sm text-primary underline" href={`/comptabilite/factures?tab=livraisons&stock=recolte:${r.id}`}>Préparer un BL</Link>
                              <div className="flex flex-wrap justify-end gap-1">
                                <BoutonPartagerRecolte recolteId={r.id} />
                                <Button variant="outline" size="sm" disabled={r.stockDisponibleCommercial != null} onClick={() => openVenteDialog(r)}>
                                  <Euro className="h-4 w-4 mr-1" />
                                  Vendre
                                </Button>
                                <Button variant="ghost" size="sm" disabled={r.stockDisponibleCommercial != null} onClick={() => ouvrirSortie(r, "consomme")}>
                                  Conso perso
                                </Button>
                                <Button variant="ghost" size="sm" disabled={r.stockDisponibleCommercial != null} onClick={() => ouvrirSortie(r, "don")}>
                                  Don
                                </Button>
                                <Button variant="ghost" size="sm" disabled={r.stockDisponibleCommercial != null} onClick={() => ouvrirSortie(r, "perte")}>
                                  Perte
                                </Button>
                                <Button variant="ghost" size="sm" disabled={r.stockDisponibleCommercial != null || r.culture == null} title={r.culture == null ? "Lot né d'un comptage : corrigez le stock par un nouveau comptage" : undefined} onClick={() => handleDelete(r.id)}>
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
                  <p className="text-muted-foreground" role={erreurChargement ? "alert" : undefined}>
                    {messageSansLigne("Aucune vente enregistrée")}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date vente</TableHead>
                        <TableHead>Espèce</TableHead>
                        <TableHead className="text-right">Quantité</TableHead>
                        <TableHead className="text-right">Prix unitaire</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Facture</TableHead>
                        <TableHead>Communauté</TableHead>
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
                              <span>{nomEspece({ id: r.especeId, nom: r.espece?.nom })}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatQuantite(r.quantite, uniteRecolte(r.unite))}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.prixKg ? formatPrixVente(r) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            {r.prixTotal ? formatMontantPiece(r.prixTotal, r, devise) : "-"}
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
                          <TableCell><BoutonPartagerRecolte recolteId={r.id} /></TableCell>
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
                <CardTitle className="text-base">Sorties de stock</CardTitle>
              </CardHeader>
              <CardContent>
                {sortiesRecoltes.length === 0 ? (
                  <p className="text-muted-foreground" role={erreurChargement ? "alert" : undefined}>
                    {messageSansLigne("Aucune perte, consommation personnelle ni don enregistré")}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date récolte</TableHead>
                        <TableHead>Sortie le</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Espèce</TableHead>
                        <TableHead>Variété</TableHead>
                        <TableHead className="text-right">Quantité</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Communauté</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortiesRecoltes.map((r) => (
                        <TableRow key={r.id}>
                          {/* Jour civil stocké : `new Date(r.date)` reculait d'un jour à l'ouest d'UTC. */}
                          <TableCell>{format(jourLocal(r.date), "dd/MM/yyyy", { locale: fr })}</TableCell>
                          {/* Jour seul (minuit UTC) ou instant d'une sortie du jour : `jourCivilStocke` lit les deux. */}
                          <TableCell>{r.dateSortie ? format(jourLocal(jourCivilStocke(r.dateSortie) ?? r.dateSortie), "dd/MM/yyyy", { locale: fr }) : "-"}</TableCell>
                          <TableCell>
                            {r.statut === "ecart" ? (
                              <Badge variant="outline" className="border-slate-300 text-slate-600">Écart d&apos;inventaire</Badge>
                            ) : (
                              <Badge variant="outline" className={MOTIFS_SORTIE[r.statut as MotifSortie]?.badge ?? ""}>
                                {MOTIFS_SORTIE[r.statut as MotifSortie]?.libelle ?? r.statut}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{nomEspece({ id: r.especeId, nom: r.espece?.nom })}</TableCell>
                          <TableCell>{r.culture?.variete?.nom ?? r.culture?.variete?.id ?? "-"}</TableCell>
                          <TableCell className={`text-right ${r.statut === "perte" ? "text-orange-600" : r.statut === "don" ? "text-violet-700" : r.statut === "ecart" ? "text-slate-600" : "text-sky-700"}`}>
                            {formatQuantite(r.quantite, uniteRecolte(r.unite))}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{r.notes || "-"}</TableCell>
                          <TableCell><BoutonPartagerRecolte recolteId={r.id} /></TableCell>
                          <TableCell className="text-right">
                            {r.statut === "ecart" ? (
                              <span className="text-xs text-muted-foreground">Corrigé par un comptage</span>
                            ) : r.consommationId != null ? (
                              <span className="text-xs text-muted-foreground">Via Stocks &gt; Consommations</span>
                            ) : (
                              <Button variant="ghost" size="sm" onClick={() => handleRemettreEnStock(r)}>
                                Remettre en stock
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog Sortie hors vente */}
        <Dialog open={sortieRecolte !== null} onOpenChange={(ouvert) => { if (!ouvert) setSortieRecolte(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sortir du stock</DialogTitle>
              <DialogDescription>Perte, consommation personnelle ou don : la vente se fait par le bouton Vendre.</DialogDescription>
            </DialogHeader>
            {sortieRecolte && (
              <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSortir() }}>
                <div className="p-3 bg-orange-50 rounded-lg">
                  <p className="text-sm text-orange-800">
                    {nomEspece({ id: sortieRecolte.especeId, nom: sortieRecolte.espece?.nom })} - {formatQuantite(sortieRecolte.quantite, uniteRecolte(sortieRecolte.unite))} en stock
                    {sortieRecolte.culture?.variete && ` (${sortieRecolte.culture.variete.nom ?? sortieRecolte.culture.variete.id})`}
                  </p>
                </div>
                <div>
                  <Label htmlFor="sortie-motif">Motif</Label>
                  <SelectNatif id="sortie-motif" value={sortieData.motif} onChange={(e) => setSortieData({ ...sortieData, motif: e.target.value as MotifSortie })}>
                    {(Object.keys(MOTIFS_SORTIE) as MotifSortie[]).map((motif) => (
                      <option key={motif} value={motif}>{MOTIFS_SORTIE[motif].libelle}</option>
                    ))}
                  </SelectNatif>
                </div>
                <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2">
                  <div>
                    <Label htmlFor="sortie-quantite">Quantité ({libelleUniteQuantite(uniteRecolte(sortieRecolte.unite), 2)})</Label>
                    <Input
                      id="sortie-quantite"
                      type="number"
                      step={uniteRecolte(sortieRecolte.unite) === "kg" ? "any" : "1"}
                      min="0"
                      value={sortieData.quantite}
                      onChange={(e) => setSortieData({ ...sortieData, quantite: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sortie-date">Jour de la sortie</Label>
                    <Input
                      id="sortie-date"
                      type="date"
                      max={jourLocalISO(new Date())}
                      value={sortieData.date}
                      onChange={(e) => setSortieData({ ...sortieData, date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="sortie-notes">Note (facultatif)</Label>
                  <Input id="sortie-notes" maxLength={500} value={sortieData.notes} onChange={(e) => setSortieData({ ...sortieData, notes: e.target.value })} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Une sortie partielle laisse le reste du lot en stock. Elle s&apos;annule depuis l&apos;onglet Sorties.
                </p>
                <Button type="submit" className="w-full" disabled={sortieSubmitting}>
                  {sortieSubmitting ? "Enregistrement…" : "Enregistrer la sortie"}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>

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
                    {nomEspece({ id: selectedRecolte.especeId, nom: selectedRecolte.espece?.nom })} - {formatQuantite(selectedRecolte.quantite, uniteRecolte(selectedRecolte.unite))}
                    {selectedRecolte.culture?.variete && ` (${selectedRecolte.culture.variete.nom ?? selectedRecolte.culture.variete.id})`}
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
                    <Label>Prix {prixParUnite(uniteRecolte(selectedRecolte.unite))} ({symbole})</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={venteData.prixKg}
                      onChange={(e) => setVenteData({ ...venteData, prixKg: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Quantité vendue ({libelleUniteQuantite(uniteRecolte(selectedRecolte.unite), 2)})</Label>
                    <Input
                      type="number"
                      step={uniteRecolte(selectedRecolte.unite) === "kg" ? "0.01" : "1"}
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
                        {formatMontant(parseFloat(venteData.prixKg) * parseFloat(venteData.quantiteVendue))}
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
