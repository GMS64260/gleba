"use client"

/**
 * Page Transactions unifiée
 * Onglets: Revenus, Dépenses, Saisie
 */

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Receipt, RefreshCw, Filter, Plus, Sprout, TreeDeciduous, Bird, TrendingUp, TrendingDown, Store, Info, ChevronDown, ChevronUp, Pencil, Trash2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { useToast } from "@/hooks/use-toast"
import { MODULE_COMPTA_LABELS } from "@/lib/comptabilite/modules"
import {
  compteVente,
  compteAchat,
  JOURNAUX,
} from "@/lib/comptabilite/plan-comptable-agricole"
import { todayLocalISO } from '@/lib/format-utils'
import { getAvailableYears } from "@/components/year-selector"

// DEV1 #3 — Modes de règlement (lus par compteTresorerie pour générer
// la contrepartie 512 banque / 530 caisse / 411 client / 401 fournisseur).
const MODES_REGLEMENT = [
  { value: "Espèces", label: "Espèces" },
  { value: "Chèque", label: "Chèque" },
  { value: "Virement", label: "Virement" },
  { value: "CB", label: "Carte bancaire" },
  { value: "Prélèvement", label: "Prélèvement SEPA" },
  { value: "À crédit", label: "À crédit (pas de mouvement)" },
] as const

const TAUX_TVA = ["0", "2.1", "5.5", "10", "20"] as const

interface SourceBreakdown {
  module: string
  source: string
  label: string
  count: number
  montant: number
}

interface Transaction {
  id: string
  source: string
  sourceId: number
  module: string
  date: string
  description: string
  quantite: number | null
  unite: string | null
  prixUnitaire: number | null
  montant: number
  client?: string | null
  fournisseur?: string | null
  paye: boolean | null
  categorie: string
  // false = coût interne de production : visible ici mais non ajouté au FEC,
  // à la TVA déductible ni au total comptable.
  comptable?: boolean
  /**
   * Écriture saisie à la main : corrigeable et supprimable ici (2026-08-13).
   * Calculé par l'API — une vente manuelle peut être AUTO (boutique,
   * réservation) et porter malgré tout le nom de source `VenteManuelle`.
   */
  corrigeable?: boolean
}

/**
 * Écrans où corriger une écriture dérivée. Deux utilisateurs ont demandé la
 * suppression d'une dépense sans jamais l'obtenir : quand l'action n'est pas
 * possible ici, l'écran doit dire OÙ elle l'est, pas se taire.
 */
/**
 * Modules proposés à la saisie et à la correction. Même liste que le
 * formulaire de saisie : ces quatre valeurs sont celles que la ventilation
 * comptable sait ranger (cf. src/lib/comptabilite/modules.ts).
 */
const MODULES_SAISIE = ["potager", "verger", "elevage", "autre"] as const


const ECRAN_SOURCE: Record<string, string> = {
  Recolte: "la récolte, dans Maraîchage > Récoltes",
  RecolteArbre: "la récolte, dans Verger > Récoltes",
  VenteProduit: "la vente, dans Élevage > Production",
  Abattage: "l'abattage, dans Élevage",
  ProductionBois: "la production, dans Verger > Bois",
  VenteManuelle: "sa source (commande boutique ou réservation)",
  SoinAnimal: "le soin, dans Élevage > Alimentation & Soins",
  ConsommationAliment: "la consommation, dans Élevage > Alimentation & Soins",
  Fertilisation: "l'intervention, dans Interventions",
  Intervention: "l'intervention, dans Interventions",
  OperationArbre: "l'opération, dans Verger > Opérations",
  LotAnimaux: "le prix d'achat du lot, dans Élevage > Animaux & Lots",
  Animal: "le prix d'achat de l'animal, sur sa fiche",
  Arbre: "l'arbre, sur sa fiche",
}

const CATEGORIES_VENTE = [
  ["legumes", "Légumes"], ["fruits", "Fruits"], ["oeufs", "Œufs"], ["viande", "Viande"],
  ["transformation", "Transformation"], ["service", "Service / prestation"],
  ["bois", "Bois et produits forestiers"], ["autre", "Autre"],
] as const

const CATEGORIES_DEPENSE = [
  ["semences", "Semences et plants"], ["engrais", "Engrais et amendements"],
  ["phyto", "Produits phytosanitaires"], ["carburant", "Carburant"],
  ["energie", "Énergie (eau, élec, gaz)"], ["materiel", "Matériel agricole"],
  ["petit_outillage", "Petit outillage"], ["prestation", "Prestation / sous-traitance"],
  ["veterinaire", "Vétérinaire"], ["msa", "Cotisations MSA"],
  ["main_oeuvre", "Main d'œuvre"], ["abonnement", "Abonnement / services"], ["autre", "Autre"],
] as const

const MODULE_ICONS: Record<string, React.ReactNode> = {
  potager: <Sprout className="h-4 w-4 text-green-600" />,
  verger: <TreeDeciduous className="h-4 w-4 text-lime-600" />,
  elevage: <Bird className="h-4 w-4 text-amber-600" />,
  boutique: <Store className="h-4 w-4 text-teal-600" />,
  autre: <Receipt className="h-4 w-4 text-blue-600" />,
}

// Bug R1 : libellé de module cohérent (le code interne « potager » s'affichait
// « Potager » dans les lignes mais « Maraîchage » dans les filtres/cartes).
const MODULE_LABELS: Record<string, string> = {
  potager: "Maraîchage",
  verger: "Verger",
  elevage: "Élevage",
  boutique: "Boutique",
  autre: "Autre",
}
const moduleLabel = (m: string) => MODULE_LABELS[m] ?? (m.charAt(0).toUpperCase() + m.slice(1))

export default function TransactionsPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <TransactionsPageInner />
    </React.Suspense>
  )
}

const TRANSACTION_TABS = ["revenus", "depenses", "saisie"] as const
type TransactionTab = (typeof TRANSACTION_TABS)[number]
type ManualTransactionType = "vente" | "depense"

function isTransactionTab(value: string | null): value is TransactionTab {
  return value !== null && TRANSACTION_TABS.includes(value as TransactionTab)
}

function isManualTransactionType(value: string | null): value is ManualTransactionType {
  return value === "vente" || value === "depense"
}

// TICKETS cmsog6ddw / cmsogfefz — le filtre de module est lié à l'URL comme
// tab/type : /comptabilite/transactions?module=boutique ouvre filtré Boutique
// et un F5 après filtrage conserve le filtre. Liste blanche = valeurs du
// Select ci-dessous ("all" = pas de filtre, jamais écrit dans l'URL).
const TRANSACTION_MODULES = ["all", "potager", "verger", "elevage", "boutique", "autre"] as const
type TransactionModule = (typeof TRANSACTION_MODULES)[number]

function isTransactionModule(value: string | null): value is TransactionModule {
  return value !== null && TRANSACTION_MODULES.includes(value as TransactionModule)
}

function TransactionsPageInner() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get("tab")
  const requestedType = searchParams.get("type")
  const requestedModule = searchParams.get("module")
  const searchQuery = searchParams.toString()
  const [activeTab, setActiveTab] = React.useState<TransactionTab>(
    isTransactionTab(requestedTab) ? requestedTab : "revenus",
  )
  const [isLoading, setIsLoading] = React.useState(true)
  const [revenus, setRevenus] = React.useState<Transaction[]>([])
  const [depenses, setDepenses] = React.useState<Transaction[]>([])
  const [statsRevenus, setStatsRevenus] = React.useState<any>(null)
  const [statsDepenses, setStatsDepenses] = React.useState<any>(null)
  const [sourcesBreakdown, setSourcesBreakdown] = React.useState<SourceBreakdown[]>([])
  const [sourcesOpen, setSourcesOpen] = React.useState(false)
  // Bug R2 : l'année choisie sur le dashboard Compta se propage aux sous-pages
  // via localStorage (partagé), au lieu de toujours réinitialiser à l'année courante.
  // QA cmsnny4pl / cmsnoctbj — la page LISAIT la préférence mais ne l'écrivait
  // jamais : changer d'année ici ne persistait rien, et le reload retombait sur
  // la valeur écrite par une autre page. Même motif que /comptabilite : lecture
  // au montage (client-only), persistance des changements après hydratation.
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear())
  // QA cmsoamukd — state et non ref : le fetch du montage ne doit partir
  // qu'APRÈS l'hydratation, sinon une salve « année par défaut » peut revenir
  // après celle de l'année choisie et l'écraser.
  const [yearHydrated, setYearHydrated] = React.useState(false)
  React.useEffect(() => {
    const stored = window.localStorage.getItem("gleba_compta_year")
    if (stored && /^\d{4}$/.test(stored)) {
      const y = parseInt(stored, 10)
      setSelectedYear((prev) => (y !== prev ? y : prev))
    }
    setYearHydrated(true)
    // Montage uniquement : lecture initiale de la préférence.
  }, [])
  React.useEffect(() => {
    // Ne persiste qu'après la lecture initiale, sinon le fallback écrase la préférence.
    if (yearHydrated) window.localStorage.setItem("gleba_compta_year", String(selectedYear))
  }, [yearHydrated, selectedYear])
  // TICKETS cmsog6ddw / cmsogfefz — initialisé depuis l'URL (validé contre la
  // liste blanche), et resynchronisé si l'URL change (lien profond, retour).
  const [selectedModule, setSelectedModule] = React.useState<string>(
    isTransactionModule(requestedModule) ? requestedModule : "all",
  )

  // Form states for manual entry (DEV1 #3 — refonte conforme)
  const [formType, setFormType] = React.useState<ManualTransactionType>(
    isManualTransactionType(requestedType) ? requestedType : "vente",
  )
  const [formData, setFormData] = React.useState({
    date: todayLocalISO(),
    categorie: "",
    description: "",
    quantite: "",
    unite: "",
    prixUnitaire: "",
    montant: "",
    client: "",
    fournisseur: "",
    module: "potager",
    paye: true,
    // DEV1 #3 — nouveaux champs réglementaires
    tauxTVA: "5.5",
    journal: "VE",
    modeReglement: "",
    numeroPiece: "",
    pjUrl: "",
    pjFilename: "",
  })
  const [pjUploading, setPjUploading] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Correction et suppression d'une écriture saisie à la main (2026-08-13).
  // Frictions réelles : « SUPPRIME LA DEPENSE DE 5€ » et « mes dépenses restent
  // à 3 433 € » — l'écran listait les écritures sans jamais permettre de les
  // corriger, et l'assistant n'avait aucun outil pour le faire non plus.
  const [editing, setEditing] = React.useState<Transaction | null>(null)
  // Ticket cmsx5xjhn — la correction ne portait que sur cinq champs : une
  // erreur de taux de TVA ou d'imputation obligeait à supprimer puis ressaisir
  // l'écriture. Les champs ajoutés ici sont ceux que le PATCH accepte
  // réellement ; laissés vides, ils ne sont pas envoyés (donc inchangés).
  const editFormVide = {
    date: "",
    description: "",
    montant: "",
    categorie: "",
    module: "",
    tauxTVA: "",
    modeReglement: "",
    numeroPiece: "",
    tiers: "",
    paye: "true",
  }
  const [editForm, setEditForm] = React.useState(editFormVide)
  const [isSavingEdit, setIsSavingEdit] = React.useState(false)
  const [deleting, setDeleting] = React.useState<Transaction | null>(null)

  const endpointFor = (t: Transaction) =>
    t.source === "VenteManuelle"
      ? "/api/comptabilite/ventes-manuelles"
      : "/api/comptabilite/depenses-manuelles"

  const openEdit = (t: Transaction) => {
    setEditForm({
      ...editFormVide,
      date: new Date(t.date).toISOString().slice(0, 10),
      description: t.description ?? "",
      montant: String(t.montant ?? ""),
      // La liste affiche un libellé ; la valeur canonique n'est pas rendue, on
      // laisse donc le choix vide plutôt que de deviner une catégorie fausse.
      categorie: "",
      // Le module, lui, est renvoyé tel quel par l'API. Une valeur hors des
      // quatre postes de saisie (`general`, `boutique`) laisse le champ vide :
      // on ne réimpute pas une écriture sans que l'utilisateur le demande.
      module: (MODULES_SAISIE as readonly string[]).includes(t.module) ? t.module : "",
      tiers: (t.source === "VenteManuelle" ? t.client : t.fournisseur) ?? "",
      paye: t.paye === false ? "false" : "true",
    })
    setEditing(t)
  }

  const saveEdit = async () => {
    if (!editing || isSavingEdit) return
    const montant = parseFloat(editForm.montant.replace(",", "."))
    if (!Number.isFinite(montant) || montant < 0) {
      toast({ variant: "destructive", title: "Montant invalide", description: "Saisissez un montant en euros." })
      return
    }
    setIsSavingEdit(true)
    try {
      const body: Record<string, unknown> = {
        id: editing.sourceId,
        date: new Date(editForm.date).toISOString(),
        description: editForm.description.trim(),
        montant,
        paye: editForm.paye === "true",
      }
      if (editForm.categorie) body.categorie = editForm.categorie
      if (editForm.module) body.module = editForm.module
      if (editForm.modeReglement) body.modeReglement = editForm.modeReglement
      if (editForm.numeroPiece.trim()) body.numeroPiece = editForm.numeroPiece.trim()
      if (editForm.tauxTVA) {
        const taux = parseFloat(editForm.tauxTVA.replace(",", "."))
        if (!Number.isFinite(taux) || taux < 0 || taux > 100) {
          toast({ variant: "destructive", title: "Taux de TVA invalide", description: "Saisissez un taux entre 0 et 100." })
          setIsSavingEdit(false)
          return
        }
        body.tauxTVA = taux
      }
      const tiers = editForm.tiers.trim()
      if (tiers) {
        if (editing.source === "VenteManuelle") body.clientNom = tiers
        else body.fournisseurNom = tiers
      }
      const res = await fetch(endpointFor(editing), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Correction refusée")
      }
      toast({ title: "Écriture corrigée", description: formatEuro(montant) })
      setEditing(null)
      fetchData()
    } catch (err) {
      toast({ variant: "destructive", title: "Erreur", description: err instanceof Error ? err.message : "Correction impossible" })
    } finally {
      setIsSavingEdit(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    const res = await fetch(`${endpointFor(deleting)}?id=${deleting.sourceId}`, { method: "DELETE" })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast({ variant: "destructive", title: "Suppression refusée", description: data.error || "Erreur" })
      return
    }
    toast({ title: "Écriture supprimée", description: formatEuro(deleting.montant) })
    setDeleting(null)
    fetchData()
  }

  /** Cellule d'actions : corriger/supprimer, ou dire où corriger. */
  const cellulActions = (t: Transaction) =>
    t.corrigeable ? (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Corriger cette écriture" onClick={() => openEdit(t)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:bg-red-100 hover:text-red-700" title="Supprimer cette écriture" onClick={() => setDeleting(t)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    ) : (
      <span className="text-xs text-muted-foreground" title={`Écriture générée par Gleba : corrigez ${ECRAN_SOURCE[t.source] ?? "sa source"}.`}>
        Générée · corriger {ECRAN_SOURCE[t.source] ?? "sa source"}
      </span>
    )


  // Les raccourcis et résultats de recherche peuvent ouvrir directement la
  // saisie voulue. L'URL reste synchronisée aussi lors des clics dans la page.
  React.useEffect(() => {
    setActiveTab(isTransactionTab(requestedTab) ? requestedTab : "revenus")
    if (isManualTransactionType(requestedType)) setFormType(requestedType)
    setSelectedModule(isTransactionModule(requestedModule) ? requestedModule : "all")
  }, [requestedTab, requestedType, requestedModule])

  const handleTabChange = React.useCallback((value: string) => {
    if (!isTransactionTab(value)) return
    setActiveTab(value)
    const params = new URLSearchParams(searchQuery)
    params.set("tab", value)
    if (value !== "saisie") params.delete("type")
    router.replace(`/comptabilite/transactions?${params.toString()}`, { scroll: false })
  }, [router, searchQuery])

  // TICKETS cmsog6ddw / cmsogfefz — même motif URL que handleTabChange :
  // chaque changement de filtre module est reflété dans l'URL (en préservant
  // tab/type déjà présents dans searchQuery). "all" retire le paramètre.
  const handleModuleChange = React.useCallback((value: string) => {
    if (!isTransactionModule(value)) return
    setSelectedModule(value)
    const params = new URLSearchParams(searchQuery)
    if (value === "all") params.delete("module")
    else params.set("module", value)
    const qs = params.toString()
    router.replace(qs ? `/comptabilite/transactions?${qs}` : "/comptabilite/transactions", { scroll: false })
  }, [router, searchQuery])

  const handleFormTypeChange = React.useCallback((value: ManualTransactionType) => {
    setFormType(value)
    const params = new URLSearchParams(searchQuery)
    params.set("tab", "saisie")
    params.set("type", value)
    router.replace(`/comptabilite/transactions?${params.toString()}`, { scroll: false })
  }, [router, searchQuery])

  // DEV1 #3 — Synchroniser le journal par défaut avec le type d'opération.
  React.useEffect(() => {
    setFormData((prev) => {
      const defaultJournal = formType === "vente" ? "VE" : "AC"
      // Ne change que si l'utilisateur n'a pas explicitement choisi autre chose.
      if (prev.journal === "VE" || prev.journal === "AC") {
        return { ...prev, journal: defaultJournal }
      }
      return prev
    })
  }, [formType])

  // QA cmsqltuok / cmsqm3cry — même SSOT d'exercices que le dashboard et les
  // rapports, avec lesquels cet écran partage la clé `gleba_compta_year`.
  const years = getAvailableYears()

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ year: selectedYear.toString() })
      if (selectedModule && selectedModule !== 'all') params.set('module', selectedModule)

      const [revRes, depRes, srcRes] = await Promise.all([
        fetch(`/api/comptabilite/revenus?${params}`),
        fetch(`/api/comptabilite/depenses?${params}`),
        fetch(`/api/comptabilite/sources?year=${selectedYear}`),
      ])

      if (revRes.ok) {
        const result = await revRes.json()
        setRevenus(result.data)
        setStatsRevenus(result.stats)
      }
      if (depRes.ok) {
        const result = await depRes.json()
        setDepenses(result.data)
        setStatsDepenses(result.stats)
      }
      if (srcRes.ok) {
        const result = await srcRes.json()
        setSourcesBreakdown(result.sources || [])
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données" })
    } finally {
      setIsLoading(false)
    }
  }, [selectedYear, selectedModule, toast])

  // QA cmsoamukd — pas de fetch avant l'hydratation de l'année persistée.
  React.useEffect(() => {
    if (yearHydrated) fetchData()
  }, [yearHydrated, fetchData])

  const formatEuro = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
  }

  // DEV1 #3 — Upload PJ (PDF / JPG / PNG, max 10 Mo, Art. L102 B LPF).
  const handlePjUpload = async (file: File) => {
    setPjUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload/justificatif", { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Échec de l'upload")
      }
      const data = await res.json()
      setFormData((prev) => ({ ...prev, pjUrl: data.url, pjFilename: data.filename }))
      toast({ title: "Pièce justificative jointe", description: data.filename })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erreur upload PJ",
        description: err instanceof Error ? err.message : "Inconnue",
      })
    } finally {
      setPjUploading(false)
    }
  }

  // DEV1 #3 — Compte PCA dérivé pour affichage temps réel sous le sélecteur.
  const comptePCADerivé = React.useMemo(() => {
    if (!formData.categorie) return null
    return formType === "vente"
      ? compteVente(formData.categorie)
      : compteAchat(formData.categorie)
  }, [formType, formData.categorie])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.categorie) {
      toast({
        variant: "destructive",
        title: "Catégorie requise",
        description: "Veuillez choisir une catégorie avant d'enregistrer.",
      })
      return
    }

    const endpoint = formType === "vente"
      ? "/api/comptabilite/ventes-manuelles"
      : "/api/comptabilite/depenses-manuelles"

    const tauxTVA = parseFloat(formData.tauxTVA) || 0

    const commonExtras = {
      tauxTVA,
      journal: formData.journal,
      modeReglement: formData.modeReglement || null,
      numeroPiece: formData.numeroPiece || null,
      pjUrl: formData.pjUrl || null,
    }

    const body = formType === "vente" ? {
      date: formData.date,
      categorie: formData.categorie,
      description: formData.description,
      quantite: formData.quantite ? parseFloat(formData.quantite) : null,
      unite: formData.unite || null,
      prixUnitaire: formData.prixUnitaire ? parseFloat(formData.prixUnitaire) : null,
      montant: parseFloat(formData.montant),
      clientNom: formData.client || null,
      module: formData.module,
      paye: formData.paye,
      ...commonExtras,
    } : {
      date: formData.date,
      categorie: formData.categorie,
      description: formData.description,
      montant: parseFloat(formData.montant),
      fournisseurNom: formData.fournisseur || null,
      module: formData.module,
      paye: formData.paye,
      ...commonExtras,
    }

    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast({ title: "Enregistré", description: `${formType === "vente" ? "Vente" : "Dépense"} ajoutée` })
        setFormData({
          date: todayLocalISO(),
          categorie: "",
          description: "",
          quantite: "",
          unite: "",
          prixUnitaire: "",
          montant: "",
          client: "",
          fournisseur: "",
          module: "potager",
          paye: true,
          tauxTVA: "5.5",
          journal: formType === "vente" ? "VE" : "AC",
          modeReglement: "",
          numeroPiece: "",
          pjUrl: "",
          pjFilename: "",
        })
        fetchData()
      } else {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Erreur ${res.status}`)
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible d'enregistrer",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      <header className="border-b border-b-2 border-b-blue-500 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        {/* QA cmsqlx0t7 — à 375 px l'en-tête dépassait 600 px de large :
            les filtres Année/Module sortaient de l'écran. flex-wrap au lieu
            d'une seule ligne rigide. */}
        <div className="container mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/comptabilite"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Comptabilité</Button></Link>
            <div className="flex items-center gap-2 min-w-0">
              <Receipt className="h-6 w-6 text-blue-600 shrink-0" />
              <h1 className="text-xl font-bold truncate">Transactions</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedModule} onValueChange={handleModuleChange}>
              <SelectTrigger className="w-[130px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="potager">Maraîchage</SelectItem>
                <SelectItem value="verger">Verger</SelectItem>
                <SelectItem value="elevage">Élevage</SelectItem>
                <SelectItem value="boutique">Boutique</SelectItem>
                <SelectItem value="autre">Autre</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      {/* QA cmsw9fo4j — pb-24 : le bouton feedback flottant recouvrait
          « Enregistrer la vente » en bas du formulaire de saisie à 375 px.
          Même pattern que /maraichage/recoltes/saisie (QA cmsbu4f00). */}
      <div className="container mx-auto px-4 py-6 pb-24">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-6">
            <TabsTrigger value="revenus" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Revenus
            </TabsTrigger>
            <TabsTrigger value="depenses" className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Dépenses
            </TabsTrigger>
            <TabsTrigger value="saisie" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Saisie
            </TabsTrigger>
          </TabsList>

          {/* Onglet Revenus */}
          <TabsContent value="revenus">
            {/* Card "Source de vérité" - explique d'où viennent les chiffres */}
            <Card className="mb-6 border-blue-200 bg-blue-50/40">
              <CardHeader
                className="cursor-pointer select-none py-4"
                onClick={() => setSourcesOpen(o => !o)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-base">D'où viennent ces chiffres ?</CardTitle>
                  </div>
                  {sourcesOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
              {sourcesOpen && (
                <CardContent className="space-y-4 text-sm">
                  <p className="text-muted-foreground">
                    Ce total agrège toutes vos ventes, qu'elles proviennent du potager,
                    du verger, de l'elevage, de la boutique en ligne ou de saisies manuelles.
                  </p>

                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="flex items-start gap-2">
                      <Sprout className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Potager</strong> — récoltes au statut « vendu » (avec prix renseigné).</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <TreeDeciduous className="h-4 w-4 text-lime-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Verger (fruits)</strong> — récoltes d'arbres au statut « vendu ».</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <TreeDeciduous className="h-4 w-4 text-amber-800 mt-0.5 flex-shrink-0" />
                      <span><strong>Verger (bois)</strong> — productions de bois avec destination « vente ».</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Bird className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Élevage (produits)</strong> — œufs, lait, animaux vivants…</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Bird className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Élevage (viande)</strong> — abattages avec destination « vente ».</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Store className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Boutique en ligne</strong> — commandes au statut « livrée ».</span>
                    </div>
                    <div className="flex items-start gap-2 md:col-span-2">
                      <Receipt className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Saisies manuelles</strong> — ventes ajoutées via l'onglet Saisie (hors automatiques).</span>
                    </div>
                  </div>

                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 text-xs">
                    Une commande boutique apparaît ici <strong>uniquement quand son statut
                    est « livrée »</strong>. Avant ce statut, elle est visible dans{' '}
                    <Link href="/boutique" className="underline font-medium">
                      /boutique → Commandes
                    </Link>
                    .
                  </div>

                  {/* Mini tableau de réconciliation */}
                  <div>
                    <p className="font-medium mb-2">Détail par source ({selectedYear})</p>
                    <div className="overflow-x-auto border rounded-md bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Module</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead className="text-right">Nb</TableHead>
                            <TableHead className="text-right">Montant</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sourcesBreakdown.map((s) => (
                            <TableRow key={`${s.module}-${s.source}`}>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  {MODULE_ICONS[s.module] || MODULE_ICONS.autre}
                                  <span className="capitalize text-xs">{moduleLabel(s.module)}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs">{s.label}</TableCell>
                              <TableCell className="text-right text-xs">{s.count}</TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatEuro(s.montant)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {sourcesBreakdown.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-4 text-muted-foreground text-xs">
                                Aucune donnée pour cette annee
                              </TableCell>
                            </TableRow>
                          )}
                          {sourcesBreakdown.length > 0 && (
                            <TableRow className="bg-slate-50 font-semibold">
                              <TableCell colSpan={2}>Total</TableCell>
                              <TableCell className="text-right">
                                {sourcesBreakdown.reduce((s, x) => s + x.count, 0)}
                              </TableCell>
                              <TableCell className="text-right text-blue-700">
                                {formatEuro(sourcesBreakdown.reduce((s, x) => s + x.montant, 0))}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {statsRevenus && (
              <div className="grid gap-4 md:grid-cols-5 mb-6">
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-blue-100">Total</CardTitle></CardHeader>
                  <CardContent><p className="text-2xl font-bold">{formatEuro(statsRevenus.total)}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Maraîchage</CardTitle></CardHeader>
                  <CardContent><p className="text-xl font-bold text-green-600">{formatEuro(statsRevenus.parModule?.potager || 0)}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Verger</CardTitle></CardHeader>
                  <CardContent><p className="text-xl font-bold text-lime-600">{formatEuro(statsRevenus.parModule?.verger || 0)}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Élevage</CardTitle></CardHeader>
                  <CardContent><p className="text-xl font-bold text-amber-600">{formatEuro(statsRevenus.parModule?.elevage || 0)}</p></CardContent>
                </Card>
                {/* Bug feedback cmpkyeynq — Card Boutique manquait : Total ≠ somme
                    des modules visibles. Pour la démo Marie Dubois/Jean Bertin…,
                    389 € de revenus boutique n'apparaissaient nulle part. */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Boutique</CardTitle></CardHeader>
                  <CardContent><p className="text-xl font-bold text-teal-600">{formatEuro(statsRevenus.parModule?.boutique || 0)}</p></CardContent>
                </Card>
              </div>
            )}
            <Card>
              <CardHeader><CardTitle>Revenus ({revenus.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Module</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {revenus.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="whitespace-nowrap">{new Date(r.date).toLocaleDateString('fr-FR')}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {MODULE_ICONS[r.module]}
                                <span className="capitalize text-sm">{moduleLabel(r.module)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[250px] truncate">{r.description}</TableCell>
                            <TableCell className="text-right font-bold text-green-600">
                              {formatEuro(r.montant)}
                              {/* Bug cmp8skoaa (Marc 2026-05-16) — badge sur les
                                  transactions à 0 € marquées Payé : héritées de
                                  l'ancienne saisie permissive (bug 13). */}
                              {r.montant === 0 && r.paye === true && (
                                <span
                                  className="ml-1 inline-block text-amber-600"
                                  title="Transaction à 0 € marquée Payé — à vérifier (saisie probablement incomplète)"
                                >
                                  ⚠
                                </span>
                              )}
                            </TableCell>
                            <TableCell>{r.client || '-'}</TableCell>
                            <TableCell>
                              {r.paye === null ? (
                                <Badge variant="outline">N/A</Badge>
                              ) : r.paye ? (
                                <Badge className="bg-green-100 text-green-800">Payé</Badge>
                              ) : (
                                <Badge className="bg-orange-100 text-orange-800">À payer</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{cellulActions(r)}</TableCell>
                          </TableRow>
                        ))}
                        {revenus.length === 0 && (
                          <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun revenu</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Dépenses */}
          <TabsContent value="depenses">
            {statsDepenses && (
              <div className="grid gap-4 md:grid-cols-5 mb-6">
                <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-red-100">Total comptable</CardTitle></CardHeader>
                  <CardContent><p className="text-2xl font-bold">{formatEuro(statsDepenses.total)}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Coûts analytiques</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-amber-600">{formatEuro(statsDepenses.totalAnalytique || 0)}</p>
                    <p className="text-xs text-muted-foreground">Non cumulés au total comptable</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Maraîchage</CardTitle></CardHeader>
                  <CardContent><p className="text-xl font-bold text-red-600">{formatEuro(statsDepenses.parModule?.potager || 0)}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Verger</CardTitle></CardHeader>
                  <CardContent><p className="text-xl font-bold text-red-600">{formatEuro(statsDepenses.parModule?.verger || 0)}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Élevage</CardTitle></CardHeader>
                  <CardContent><p className="text-xl font-bold text-red-600">{formatEuro(statsDepenses.parModule?.elevage || 0)}</p></CardContent>
                </Card>
              </div>
            )}
            <Card>
              <CardHeader><CardTitle>Dépenses ({depenses.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Module</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead>Fournisseur</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {depenses.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="whitespace-nowrap">{new Date(d.date).toLocaleDateString('fr-FR')}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {MODULE_ICONS[d.module]}
                                <span className="capitalize text-sm">{moduleLabel(d.module)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[250px] truncate">{d.description}</TableCell>
                            <TableCell className="text-right font-bold text-red-600">{formatEuro(d.montant)}</TableCell>
                            <TableCell>{d.fournisseur || '-'}</TableCell>
                            <TableCell>
                              {d.comptable === false ? (
                                <Badge className="bg-amber-100 text-amber-800">Analytique</Badge>
                              ) : d.paye === null ? (
                                <Badge variant="outline">N/A</Badge>
                              ) : d.paye ? (
                                <Badge className="bg-green-100 text-green-800">Payé</Badge>
                              ) : (
                                <Badge className="bg-orange-100 text-orange-800">À payer</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{cellulActions(d)}</TableCell>
                          </TableRow>
                        ))}
                        {depenses.length === 0 && (
                          <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune dépense</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Saisie */}
          <TabsContent value="saisie">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Nouvelle transaction</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant={formType === "vente" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleFormTypeChange("vente")}
                      className={formType === "vente" ? "bg-green-600" : ""}
                    >
                      <TrendingUp className="h-4 w-4 mr-1" />
                      Vente
                    </Button>
                    <Button
                      variant={formType === "depense" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleFormTypeChange("depense")}
                      className={formType === "depense" ? "bg-red-600" : ""}
                    >
                      <TrendingDown className="h-4 w-4 mr-1" />
                      Dépense
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Module</Label>
                      <Select value={formData.module} onValueChange={(v) => setFormData({ ...formData, module: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="potager">Maraîchage</SelectItem>
                          <SelectItem value="verger">Verger</SelectItem>
                          <SelectItem value="elevage">Élevage</SelectItem>
                          <SelectItem value="autre">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Catégorie</Label>
                      <Select value={formData.categorie} onValueChange={(v) => setFormData({ ...formData, categorie: v })}>
                        <SelectTrigger><SelectValue placeholder="— Choisir une catégorie —" /></SelectTrigger>
                        <SelectContent>
                          {formType === "vente" ? (
                            <>
                              <SelectItem value="legumes">Légumes</SelectItem>
                              <SelectItem value="fruits">Fruits</SelectItem>
                              <SelectItem value="oeufs">Œufs</SelectItem>
                              <SelectItem value="viande">Viande</SelectItem>
                              <SelectItem value="transformation">Transformation</SelectItem>
                              <SelectItem value="service">Service / prestation</SelectItem>
                              <SelectItem value="bois">Bois et produits forestiers</SelectItem>
                              <SelectItem value="autre">Autre</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="semences">Semences / Plants</SelectItem>
                              <SelectItem value="aliments">Aliments animaux</SelectItem>
                              <SelectItem value="fertilisants">Fertilisants / engrais</SelectItem>
                              <SelectItem value="phyto">Produits phytosanitaires</SelectItem>
                              <SelectItem value="carburant">Carburant</SelectItem>
                              <SelectItem value="energie">Énergie (eau, élec, gaz)</SelectItem>
                              <SelectItem value="materiel">Matériel agricole</SelectItem>
                              <SelectItem value="petit_outillage">Petit outillage</SelectItem>
                              <SelectItem value="prestation">Prestation / sous-traitance</SelectItem>
                              <SelectItem value="veterinaire">Vétérinaire</SelectItem>
                              <SelectItem value="msa">Cotisations MSA</SelectItem>
                              <SelectItem value="main_oeuvre">Main d&apos;œuvre</SelectItem>
                              <SelectItem value="abonnement">Abonnement / services</SelectItem>
                              <SelectItem value="autre">Autre</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      {/* DEV1 #3 — Compte PCA dérivé affiché en temps réel */}
                      {comptePCADerivé && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          PCA : <span className="font-mono font-medium">{comptePCADerivé.num}</span> · {comptePCADerivé.lib}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* DEV1 #3 — Bloc compta réglementaire : Journal / Mode règlement / N° pièce / TVA */}
                  <div className="grid gap-4 md:grid-cols-4 border-t pt-4">
                    <div>
                      <Label>Journal *</Label>
                      <Select
                        value={formData.journal}
                        onValueChange={(v) => setFormData({ ...formData, journal: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(JOURNAUX).map(([code, lib]) => (
                            <SelectItem key={code} value={code}>{code} — {lib}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Mode de règlement</Label>
                      <Select
                        value={formData.modeReglement}
                        onValueChange={(v) => setFormData({ ...formData, modeReglement: v })}
                      >
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {MODES_REGLEMENT.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>N° pièce justificative</Label>
                      <Input
                        value={formData.numeroPiece}
                        onChange={(e) => setFormData({ ...formData, numeroPiece: e.target.value })}
                        placeholder={formType === "vente" ? "Auto" : "Ex: FA-2026-042"}
                      />
                    </div>
                    <div>
                      <Label>Taux TVA (%)</Label>
                      <Select
                        value={formData.tauxTVA}
                        onValueChange={(v) => setFormData({ ...formData, tauxTVA: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TAUX_TVA.map((t) => (
                            <SelectItem key={t} value={t}>{t} %</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* DEV1 #3 — Upload pièce justificative (Art. L102 B LPF) */}
                  <div>
                    <Label>Pièce justificative (PDF / JPG / PNG, max 10 Mo)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        disabled={pjUploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) handlePjUpload(f)
                        }}
                        className="flex-1"
                      />
                      {formData.pjUrl && (
                        <>
                          <a
                            href={formData.pjUrl}
                            target="_blank"
                            className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                          >
                            📎 {formData.pjFilename || "PJ jointe"}
                          </a>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setFormData({ ...formData, pjUrl: "", pjFilename: "" })}
                          >
                            Retirer
                          </Button>
                        </>
                      )}
                    </div>
                    {pjUploading && (
                      <p className="text-xs text-muted-foreground mt-1">Upload en cours…</p>
                    )}
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder={formType === "vente" ? "Ex: Panier légumes famille Martin" : "Ex: Sac granulés pondeuses 25kg"}
                      required
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <Label>Montant (EUR)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.montant}
                        onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                        placeholder="0.00"
                        required
                      />
                    </div>
                    {formType === "vente" && (
                      <>
                        <div>
                          <Label>Quantité</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.quantite}
                            onChange={(e) => setFormData({ ...formData, quantite: e.target.value })}
                            placeholder="Optionnel"
                          />
                        </div>
                        <div>
                          <Label>Unité</Label>
                          <Input
                            value={formData.unite}
                            onChange={(e) => setFormData({ ...formData, unite: e.target.value })}
                            placeholder="kg, unité..."
                          />
                        </div>
                        <div>
                          <Label>Client</Label>
                          <Input
                            value={formData.client}
                            onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                            placeholder="Nom client"
                          />
                        </div>
                      </>
                    )}
                    {formType === "depense" && (
                      <div>
                        <Label>Fournisseur</Label>
                        <Input
                          value={formData.fournisseur}
                          onChange={(e) => setFormData({ ...formData, fournisseur: e.target.value })}
                          placeholder="Nom fournisseur"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.paye}
                        onChange={(e) => setFormData({ ...formData, paye: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Payé</span>
                    </label>
                  </div>

                  <Button type="submit" disabled={isSubmitting} className={formType === "vente" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}>
                    <Plus className="h-4 w-4 mr-2" />
                    {isSubmitting ? "Enregistrement..." : `Enregistrer ${formType === "vente" ? "la vente" : "la dépense"}`}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Correction d'une écriture manuelle. Les écritures dérivées ne sont
          jamais proposées ici : leur montant appartient à leur source, et le
          serveur les refuse (lib/comptabilite/ecriture-derivee.ts). */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Corriger l&apos;écriture</DialogTitle>
            <DialogDescription>
              {editing?.source === "VenteManuelle" ? "Vente" : "Dépense"} saisie à la main.
              Un champ laissé vide reste inchangé. Le HT et la TVA sont recalculés
              dès que le montant ou le taux change.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-date">Date</Label>
              <Input id="edit-date" type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Input id="edit-description" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="edit-montant">Montant TTC (€)</Label>
              <Input id="edit-montant" inputMode="decimal" value={editForm.montant} onChange={(e) => setEditForm({ ...editForm, montant: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="edit-categorie">Catégorie</Label>
              <Select value={editForm.categorie} onValueChange={(v) => setEditForm({ ...editForm, categorie: v })}>
                <SelectTrigger id="edit-categorie" name="categorie">
                  <SelectValue placeholder="Inchangée" />
                </SelectTrigger>
                <SelectContent>
                  {(editing?.source === "VenteManuelle" ? CATEGORIES_VENTE : CATEGORIES_DEPENSE).map(([valeur, libelle]) => (
                    <SelectItem key={valeur} value={valeur}>{libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-module">Imputation (module)</Label>
              <Select value={editForm.module} onValueChange={(v) => setEditForm({ ...editForm, module: v })}>
                <SelectTrigger id="edit-module" name="module">
                  <SelectValue placeholder="Inchangée" />
                </SelectTrigger>
                <SelectContent>
                  {MODULES_SAISIE.map((m) => (
                    <SelectItem key={m} value={m}>{MODULE_COMPTA_LABELS[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Décide de la ligne du compte de résultat où la somme apparaît.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-taux">Taux de TVA</Label>
                <Select value={editForm.tauxTVA} onValueChange={(v) => setEditForm({ ...editForm, tauxTVA: v })}>
                  <SelectTrigger id="edit-taux" name="tauxTVA">
                    <SelectValue placeholder="Inchangé" />
                  </SelectTrigger>
                  <SelectContent>
                    {TAUX_TVA.map((t) => (
                      <SelectItem key={t} value={t}>{t} %</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-piece">N° de pièce</Label>
                <Input
                  id="edit-piece"
                  placeholder="Inchangé"
                  value={editForm.numeroPiece}
                  onChange={(e) => setEditForm({ ...editForm, numeroPiece: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-tiers">
                {editing?.source === "VenteManuelle" ? "Client" : "Fournisseur"}
              </Label>
              <Input
                id="edit-tiers"
                placeholder="Inchangé"
                value={editForm.tiers}
                onChange={(e) => setEditForm({ ...editForm, tiers: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-mode">Mode de règlement</Label>
              <Select value={editForm.modeReglement} onValueChange={(v) => setEditForm({ ...editForm, modeReglement: v })}>
                <SelectTrigger id="edit-mode" name="modeReglement">
                  <SelectValue placeholder="Inchangé" />
                </SelectTrigger>
                <SelectContent>
                  {MODES_REGLEMENT.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-paye">Règlement</Label>
              <Select value={editForm.paye} onValueChange={(v) => setEditForm({ ...editForm, paye: v })}>
                <SelectTrigger id="edit-paye" name="paye"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Payé</SelectItem>
                  <SelectItem value="false">À payer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={isSavingEdit}>Annuler</Button>
            <Button onClick={saveEdit} disabled={isSavingEdit}>
              {isSavingEdit && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isSavingEdit ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        entityLabel={
          deleting
            ? `${deleting.source === "VenteManuelle" ? "la vente" : "la dépense"} « ${deleting.description} » du ${new Date(deleting.date).toLocaleDateString("fr-FR")}`
            : ""
        }
        warning="Le montant sera retiré de vos totaux, de la TVA et de l'export FEC de l'année."
        onConfirm={confirmDelete}
      />
    </div>
  )
}
