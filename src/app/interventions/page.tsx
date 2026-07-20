"use client"

/**
 * Page Interventions - Suivi des interventions terrain
 * Semis, plantation, traitements, recoltes, etc.
 */

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { getAvailableYears } from "@/components/year-selector"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { UserMenu } from "@/components/auth/UserMenu"

import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"
import { todayLocalISO } from '@/lib/format-utils'
import {
  Sprout,
  TreeDeciduous,
  Bird,
  Wallet,
  Settings,
  Calendar,
  Clock,
  Euro,
  CheckCircle,
  Plus,
  Filter,
  Search,
  Hammer,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  X,
} from "lucide-react"

// ============================================================
// Types
// ============================================================

interface Intervention {
  id: number
  date: string
  type: string
  cultureId: number | null
  plancheId: string | null
  arbreId: number | null
  description: string | null
  dureeMinutes: number | null
  nbPersonnes: number | null
  coutMainOeuvre: number | null
  coutTotal: number | null
  datePrevue: string | null
  fait: boolean
  produitPhyto: string | null
  numAMM: string | null
  cibleTraitement: string | null
  doseAppliquee: number | null
  uniteDose: string | null
  surfaceTraitee: number | null
  dar: number | null
  delaiReentree: number | null
  conditionsMeteo: string | null
  intrantNom: string | null
  intrantQuantite: number | null
  intrantUnite: string | null
  intrantCout: number | null
  intrantNumLot: string | null
  notes: string | null
  createdAt: string
  // Source tracking (virtual entries from other modules)
  source: 'intervention' | 'culture' | 'irrigation' | 'fertilisation' | 'operation_arbre' | 'soin_animal'
  sourceLabel: string | null
  cultureNom: string | null
  plancheNom: string | null
}

interface Stats {
  total: number
  heuresTravaillees: number
  coutTotal: number
  planifiees: number
}

interface Culture {
  id: number
  nom: string
  variete?: string
  plancheNom?: string
}

interface Planche {
  id: string
  nom: string
}

// ============================================================
// Constants
// ============================================================

const TYPE_OPTIONS = [
  { value: "semis", label: "Semis" },
  { value: "plantation", label: "Plantation" },
  { value: "desherbage", label: "Desherbage" },
  { value: "binage", label: "Binage" },
  { value: "paillage", label: "Paillage" },
  { value: "traitement_phyto", label: "Traitement phyto" },
  { value: "fertilisation", label: "Fertilisation" },
  { value: "recolte", label: "Récolte" },
  { value: "taille", label: "Taille" },
  { value: "arrosage", label: "Arrosage" },
  { value: "tuteurage", label: "Tuteurage" },
  { value: "autre", label: "Autre" },
] as const

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  semis: { bg: "bg-green-100", text: "text-green-800" },
  plantation: { bg: "bg-emerald-100", text: "text-emerald-800" },
  desherbage: { bg: "bg-yellow-100", text: "text-yellow-800" },
  binage: { bg: "bg-amber-100", text: "text-amber-800" },
  paillage: { bg: "bg-orange-100", text: "text-orange-800" },
  traitement_phyto: { bg: "bg-red-100", text: "text-red-800" },
  fertilisation: { bg: "bg-purple-100", text: "text-purple-800" },
  recolte: { bg: "bg-blue-100", text: "text-blue-800" },
  taille: { bg: "bg-cyan-100", text: "text-cyan-800" },
  arrosage: { bg: "bg-sky-100", text: "text-sky-800" },
  tuteurage: { bg: "bg-slate-100", text: "text-slate-800" },
  autre: { bg: "bg-slate-100", text: "text-slate-800" },
}

const TYPE_LABELS: Record<string, string> = {
  semis: "Semis",
  plantation: "Plantation",
  desherbage: "Desherbage",
  binage: "Binage",
  paillage: "Paillage",
  traitement_phyto: "Traitement phyto",
  fertilisation: "Fertilisation",
  recolte: "Récolte",
  taille: "Taille",
  arrosage: "Arrosage",
  tuteurage: "Tuteurage",
  autre: "Autre",
}

// QA Camille 2026-05-15 — bonus : plage factorisée [N+1 … N-4]
const currentYearNow = new Date().getFullYear()
const availableYears = getAvailableYears()

// ============================================================
// Helper functions
// ============================================================

function formatEuro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR")
}

function formatDuration(minutes: number | null) {
  if (!minutes) return "-"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${m.toString().padStart(2, "0")}`
}

// ============================================================
// Main component
// ============================================================

export default function InterventionsPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  // Data state
  const [interventions, setInterventions] = React.useState<Intervention[]>([])
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [cultures, setCultures] = React.useState<Culture[]>([])
  const [planches, setPlanches] = React.useState<Planche[]>([])

  // Filter state
  const [filterType, setFilterType] = React.useState("")
  const [filterDateFrom, setFilterDateFrom] = React.useState("")
  const [filterDateTo, setFilterDateTo] = React.useState("")
  const [filterFait, setFilterFait] = React.useState<string>("all") // "all" | "true" | "false"
  const [selectedYear, setSelectedYear] = React.useState(currentYearNow)
  const [searchText, setSearchText] = React.useState("")

  // UI state
  const [expandedRow, setExpandedRow] = React.useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingIntervention, setEditingIntervention] = React.useState<Intervention | null>(null)

  // Form state
  const emptyForm = {
    date: todayLocalISO(),
    type: "autre",
    cultureId: "",
    plancheId: "",
    description: "",
    dureeHeures: "",
    dureeMinutesForm: "",
    nbPersonnes: "1",
    coutMainOeuvre: "",
    fait: true,
    // Phyto
    produitPhyto: "",
    numAMM: "",
    cibleTraitement: "",
    doseAppliquee: "",
    uniteDose: "L/ha",
    surfaceTraitee: "",
    dar: "",
    conditionsMeteo: "",
    // Intrants
    intrantNom: "",
    intrantQuantite: "",
    intrantUnite: "kg",
    intrantCout: "",
    intrantNumLot: "",
    notes: "",
    // PROMPT 11 LOT D — Champs de traçabilité pré-remplis depuis Observation Santé
    arbreId: "",
    observationLieeId: "",
    justification: "",
  }
  const [form, setForm] = React.useState(emptyForm)

  // PROMPT 11 LOT D — Si un param `?prefill=` est présent (depuis le bouton
  // "Déclencher un traitement" sur la fiche Observation Santé), ouvrir le
  // dialog pré-rempli en mode "traitement_phyto".
  // Note : on lit `window.location.search` plutôt que `useSearchParams` pour
  // éviter d'avoir à envelopper toute la page dans un <Suspense> (Next 16).
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const sp = new URLSearchParams(window.location.search)
    const prefill = sp.get("prefill")
    if (!prefill) return
    const params = new URLSearchParams(prefill)
    setForm((f) => ({
      ...f,
      type: params.get("type") || "traitement_phyto",
      arbreId: params.get("arbreId") || "",
      cibleTraitement: params.get("cible") || "",
      justification: params.get("justification") || "",
      observationLieeId: params.get("observationLieeId") || "",
    }))
    setDialogOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ============================================================
  // Data fetching
  // ============================================================

  const fetchInterventions = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ annee: selectedYear.toString() })
      if (filterType) params.set("type", filterType)
      if (filterDateFrom) params.set("dateFrom", filterDateFrom)
      if (filterDateTo) params.set("dateTo", filterDateTo)
      if (filterFait !== "all") params.set("fait", filterFait)

      const res = await fetch(`/api/interventions?${params}`)
      if (res.ok) {
        const result = await res.json()
        setInterventions(result.data)
        setStats(result.stats)
      } else {
        toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les interventions" })
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Erreur de connexion" })
    } finally {
      setIsLoading(false)
    }
  }, [selectedYear, filterType, filterDateFrom, filterDateTo, filterFait, toast])

  const fetchReferenceData = React.useCallback(async () => {
    try {
      const [cultRes, plRes] = await Promise.all([
        fetch("/api/cultures?pageSize=500"),
        fetch("/api/planches?pageSize=500"),
      ])
      if (cultRes.ok) {
        const data = await cultRes.json()
        setCultures(data.data || data || [])
      }
      if (plRes.ok) {
        const data = await plRes.json()
        setPlanches(data.data || data || [])
      }
    } catch {
      // Non-blocking - reference data is optional
    }
  }, [])

  React.useEffect(() => {
    if (session?.user) {
      fetchInterventions()
    }
  }, [session?.user, fetchInterventions])

  React.useEffect(() => {
    if (session?.user) {
      fetchReferenceData()
    }
  }, [session?.user, fetchReferenceData])

  // ============================================================
  // Actions
  // ============================================================

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    const dureeMinutes =
      (form.dureeHeures ? parseInt(form.dureeHeures) * 60 : 0) +
      (form.dureeMinutesForm ? parseInt(form.dureeMinutesForm) : 0)

    const intrantCout = form.intrantCout ? parseFloat(form.intrantCout) : 0
    const coutMainOeuvre = form.coutMainOeuvre ? parseFloat(form.coutMainOeuvre) : 0
    const coutTotal = coutMainOeuvre + intrantCout

    const body = {
      date: form.date,
      type: form.type,
      cultureId: form.cultureId ? parseInt(form.cultureId) : null,
      plancheId: form.plancheId || null,
      description: form.description,
      dureeMinutes: dureeMinutes || null,
      nbPersonnes: form.nbPersonnes ? parseInt(form.nbPersonnes) : 1,
      coutMainOeuvre: coutMainOeuvre || null,
      coutTotal: coutTotal || null,
      fait: form.fait,
      // Phyto
      produitPhyto: form.produitPhyto,
      numAMM: form.numAMM,
      cibleTraitement: form.cibleTraitement,
      doseAppliquee: form.doseAppliquee,
      uniteDose: form.uniteDose,
      surfaceTraitee: form.surfaceTraitee,
      dar: form.dar,
      conditionsMeteo: form.conditionsMeteo,
      // Intrant
      intrantNom: form.intrantNom,
      intrantQuantite: form.intrantQuantite,
      intrantUnite: form.intrantUnite,
      intrantCout: form.intrantCout,
      intrantNumLot: form.intrantNumLot,
      notes: form.notes,
      // PROMPT 11 LOT D — Traçabilité origine observation santé (verger)
      arbreId: form.arbreId ? parseInt(form.arbreId) : null,
      observationLieeId: form.observationLieeId ? parseInt(form.observationLieeId) : null,
      justification: form.justification || null,
    }

    try {
      const url = editingIntervention
        ? "/api/interventions"
        : "/api/interventions"
      const method = editingIntervention ? "PATCH" : "POST"
      const payload = editingIntervention ? { id: editingIntervention.id, ...body } : body

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast({
          title: editingIntervention ? "Modifié" : "Créé",
          description: editingIntervention ? "Intervention modifiée" : "Intervention créée",
        })
        setDialogOpen(false)
        setEditingIntervention(null)
        setForm(emptyForm)
        fetchInterventions()
      } else {
        throw new Error()
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer l'intervention" })
    }
  }

  const handleMarkDone = async (intervention: Intervention) => {
    try {
      const res = await fetch("/api/interventions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: intervention.id,
          fait: true,
          date: new Date().toISOString(),
        }),
      })
      if (res.ok) {
        toast({ title: "Fait", description: "Intervention marquee comme realisee" })
        fetchInterventions()
      } else {
        throw new Error()
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de modifier" })
    }
  }

  const handleDelete = async (id: number) => {
    if (!(await confirmDialog("Supprimer cette intervention ?"))) return

    try {
      const res = await fetch(`/api/interventions?id=${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Supprimé", description: "Intervention supprimée" })
        fetchInterventions()
      } else {
        throw new Error()
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer" })
    }
  }

  const handleEdit = (intervention: Intervention) => {
    const totalMin = intervention.dureeMinutes || 0
    setEditingIntervention(intervention)
    setForm({
      date: intervention.date ? intervention.date.split("T")[0] : todayLocalISO(),
      type: intervention.type,
      cultureId: intervention.cultureId?.toString() || "",
      plancheId: intervention.plancheId || "",
      description: intervention.description || "",
      dureeHeures: totalMin >= 60 ? Math.floor(totalMin / 60).toString() : "",
      dureeMinutesForm: (totalMin % 60).toString() || "",
      nbPersonnes: (intervention.nbPersonnes || 1).toString(),
      coutMainOeuvre: intervention.coutMainOeuvre?.toString() || "",
      fait: intervention.fait,
      produitPhyto: intervention.produitPhyto || "",
      numAMM: intervention.numAMM || "",
      cibleTraitement: intervention.cibleTraitement || "",
      doseAppliquee: intervention.doseAppliquee?.toString() || "",
      uniteDose: intervention.uniteDose || "L/ha",
      surfaceTraitee: intervention.surfaceTraitee?.toString() || "",
      dar: intervention.dar?.toString() || "",
      conditionsMeteo: intervention.conditionsMeteo || "",
      intrantNom: intervention.intrantNom || "",
      intrantQuantite: intervention.intrantQuantite?.toString() || "",
      intrantUnite: intervention.intrantUnite || "kg",
      intrantCout: intervention.intrantCout?.toString() || "",
      intrantNumLot: intervention.intrantNumLot || "",
      notes: intervention.notes || "",
      // PROMPT 11 LOT D — Champs PBI (recharger si présents sur la fiche)
      arbreId: (intervention as Intervention & { arbreId?: number | null }).arbreId?.toString() || "",
      observationLieeId:
        (intervention as Intervention & { observationLieeId?: number | null }).observationLieeId?.toString() || "",
      justification: (intervention as Intervention & { justification?: string | null }).justification || "",
    })
    setDialogOpen(true)
  }

  const handleOpenNew = () => {
    setEditingIntervention(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const clearFilters = () => {
    setFilterType("")
    setFilterDateFrom("")
    setFilterDateTo("")
    setFilterFait("all")
    setSearchText("")
  }

  // ============================================================
  // Filtered interventions (client-side text search)
  // ============================================================

  const filteredInterventions = React.useMemo(() => {
    if (!searchText) return interventions
    const lower = searchText.toLowerCase()
    return interventions.filter((i) => {
      const typeLabel = TYPE_LABELS[i.type] || i.type
      return (
        typeLabel.toLowerCase().includes(lower) ||
        (i.description && i.description.toLowerCase().includes(lower)) ||
        (i.plancheId && i.plancheId.toLowerCase().includes(lower)) ||
        (i.intrantNom && i.intrantNom.toLowerCase().includes(lower)) ||
        (i.notes && i.notes.toLowerCase().includes(lower))
      )
    })
  }, [interventions, searchText])

  // ============================================================
  // Render
  // ============================================================

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Chargement...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      {/* Header global */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between max-w-[1600px]">
          <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
            <Image
              src="/gleba-logo.png"
              alt="Gleba"
              width={120}
              height={80}
              className="h-10 w-auto rounded-lg"
              priority
            />
          </Link>
          <div className="flex items-center gap-2">
            {/* Navigation modules */}
            <div className="flex items-center border rounded-lg overflow-hidden">
              <Link href="/">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-none text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-r"
                >
                  <Sprout className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Maraîchage</span>
                </Button>
              </Link>
              <Link href="/verger">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-none text-lime-700 hover:text-lime-800 hover:bg-lime-50 border-r"
                >
                  <TreeDeciduous className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Verger</span>
                </Button>
              </Link>
              <Link href="/elevage">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-none text-amber-700 hover:text-amber-800 hover:bg-amber-50 border-r"
                >
                  <Bird className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Élevage</span>
                </Button>
              </Link>
              <Link href="/comptabilite">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-none text-blue-700 hover:text-blue-800 hover:bg-blue-50 border-r"
                >
                  <Wallet className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Compta</span>
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-none bg-orange-50 text-orange-700"
              >
                <Hammer className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Interventions</span>
              </Button>
            </div>
            <Link href="/parametres">
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            {session?.user && <UserMenu user={session.user} />}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-[1600px]">
        {/* Title + Year + Add button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Hammer className="h-5 w-5 text-orange-700" />
            </div>
            <h1 className="text-xl font-semibold text-slate-800">Interventions</h1>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open)
              if (!open) {
                setEditingIntervention(null)
                setForm(emptyForm)
              }
            }}>
              <DialogTrigger asChild>
                <Button
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={handleOpenNew}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Nouvelle intervention
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingIntervention ? "Modifier l'intervention" : "Nouvelle intervention"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingIntervention ? "Modifiez les champs puis enregistrez." : "Remplissez les informations de l'intervention."}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  {/* PROMPT 11 LOT D — Bannière de traçabilité si l'intervention
                      est déclenchée depuis une observation santé verger. */}
                  {form.observationLieeId && (
                    <div className="rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900">
                      <p className="font-medium">🔗 Lié à l'observation santé #{form.observationLieeId}</p>
                      <p className="text-xs mt-1">
                        L'arbre cible et la justification sont pré-remplis. Vous pouvez les ajuster avant validation.
                      </p>
                    </div>
                  )}
                  {/* Row 1: Date, Type, Status */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <select
                        value={form.type}
                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        required
                      >
                        {TYPE_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="flex items-center gap-2 cursor-pointer h-9">
                        <input
                          type="checkbox"
                          checked={form.fait}
                          onChange={(e) => setForm({ ...form, fait: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm">{form.fait ? "Realisee" : "Planifiee"}</span>
                      </label>
                    </div>
                  </div>

                  {/* Row 2: Culture, Planche */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Culture</Label>
                      <select
                        value={form.cultureId}
                        onChange={(e) => setForm({ ...form, cultureId: e.target.value })}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">-- Aucune --</option>
                        {cultures.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nom}{c.variete ? ` (${c.variete})` : ""}{c.plancheNom ? ` - ${c.plancheNom}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Planche</Label>
                      <select
                        value={form.plancheId}
                        onChange={(e) => setForm({ ...form, plancheId: e.target.value })}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">-- Aucune --</option>
                        {planches.map((p) => (
                          <option key={p.id || p.nom} value={p.nom || p.id}>
                            {p.nom || p.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Détails de l'intervention..."
                      rows={2}
                    />
                  </div>

                  {/* Row 3: Duration, Nb personnes, Cost */}
                  <div className="grid gap-4 sm:grid-cols-4">
                    <div>
                      <Label>Heures</Label>
                      <Input
                        type="number"
                        min="0"
                        value={form.dureeHeures}
                        onChange={(e) => setForm({ ...form, dureeHeures: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label>Minutes</Label>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={form.dureeMinutesForm}
                        onChange={(e) => setForm({ ...form, dureeMinutesForm: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label>Nb personnes</Label>
                      <Input
                        type="number"
                        min="1"
                        value={form.nbPersonnes}
                        onChange={(e) => setForm({ ...form, nbPersonnes: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Cout main d'oeuvre (EUR)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.coutMainOeuvre}
                        onChange={(e) => setForm({ ...form, coutMainOeuvre: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Phyto section - conditional */}
                  {form.type === "traitement_phyto" && (
                    <div className="border rounded-lg p-4 bg-red-50/50 space-y-4">
                      <h3 className="text-sm font-semibold text-red-800 flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" />
                        Traitement phytosanitaire
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label>Produit</Label>
                          <Input
                            value={form.produitPhyto}
                            onChange={(e) => setForm({ ...form, produitPhyto: e.target.value })}
                            placeholder="Nom commercial"
                          />
                        </div>
                        <div>
                          <Label>Num AMM</Label>
                          <Input
                            value={form.numAMM}
                            onChange={(e) => setForm({ ...form, numAMM: e.target.value })}
                            placeholder="Autorisation de mise sur le marche"
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label>Cible</Label>
                          <Input
                            value={form.cibleTraitement}
                            onChange={(e) => setForm({ ...form, cibleTraitement: e.target.value })}
                            placeholder="Ravageur / maladie"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>Dose</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={form.doseAppliquee}
                              onChange={(e) => setForm({ ...form, doseAppliquee: e.target.value })}
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <Label>Unité</Label>
                            <select
                              value={form.uniteDose}
                              onChange={(e) => setForm({ ...form, uniteDose: e.target.value })}
                              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                            >
                              <option value="L/ha">L/ha</option>
                              <option value="kg/ha">kg/ha</option>
                              <option value="g/L">g/L</option>
                              <option value="mL/L">mL/L</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                          <Label>Surface traitee (m2)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={form.surfaceTraitee}
                            onChange={(e) => setForm({ ...form, surfaceTraitee: e.target.value })}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <Label>DAR (jours)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={form.dar}
                            onChange={(e) => setForm({ ...form, dar: e.target.value })}
                            placeholder="Délai Avant Récolte"
                          />
                        </div>
                        <div>
                          <Label>Conditions meteo</Label>
                          <Input
                            value={form.conditionsMeteo}
                            onChange={(e) => setForm({ ...form, conditionsMeteo: e.target.value })}
                            placeholder="Soleil, vent faible..."
                          />
                        </div>
                      </div>
                      {/* PROMPT 11 LOT B/D — Justification du traitement (obligatoire en PBI). */}
                      <div>
                        <Label>Justification du traitement</Label>
                        <Textarea
                          value={form.justification}
                          onChange={(e) => setForm({ ...form, justification: e.target.value })}
                          placeholder="Ex: Seuil PBI franchi (5 captures/piège/semaine), BSV régional du 12/05, observation #42"
                          rows={2}
                        />
                      </div>
                    </div>
                  )}

                  {/* Intrant section */}
                  <div className="border rounded-lg p-4 bg-slate-50/50 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-700">Intrant utilise</h3>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <Label>Nom</Label>
                        <Input
                          value={form.intrantNom}
                          onChange={(e) => setForm({ ...form, intrantNom: e.target.value })}
                          placeholder="Ex: Compost, paillage BRF..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Quantité</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={form.intrantQuantite}
                            onChange={(e) => setForm({ ...form, intrantQuantite: e.target.value })}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <Label>Unité</Label>
                          <select
                            value={form.intrantUnite}
                            onChange={(e) => setForm({ ...form, intrantUnite: e.target.value })}
                            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="kg">kg</option>
                            <option value="L">L</option>
                            <option value="g">g</option>
                            <option value="unites">unités</option>
                            <option value="m3">m³</option>
                            <option value="T">T</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Cout (EUR)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={form.intrantCout}
                            onChange={(e) => setForm({ ...form, intrantCout: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label>Num lot</Label>
                          <Input
                            value={form.intrantNumLot}
                            onChange={(e) => setForm({ ...form, intrantNumLot: e.target.value })}
                            placeholder="Traçabilité"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Remarques supplementaires..."
                      rows={2}
                    />
                  </div>

                  {/* Submit */}
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setDialogOpen(false)
                        setEditingIntervention(null)
                        setForm(emptyForm)
                      }}
                    >
                      Annuler
                    </Button>
                    <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
                      <Plus className="h-4 w-4 mr-1" />
                      {editingIntervention ? "Enregistrer" : "Créer"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))
          ) : stats ? (
            <>
              <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-orange-100 flex items-center gap-2">
                    <Hammer className="h-4 w-4" />
                    Total interventions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Heures travaillees
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-orange-700">
                    {stats.heuresTravaillees.toFixed(1)}h
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Euro className="h-4 w-4" />
                    Cout total
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-orange-700">{formatEuro(stats.coutTotal)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Planifiées
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-orange-700">{stats.planifiees}</p>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        {/* Filters row */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                Filtres
              </div>
              <div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Tous les types</option>
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="h-9 w-[150px]"
                  placeholder="Du"
                />
              </div>
              <div>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="h-9 w-[150px]"
                  placeholder="Au"
                />
              </div>
              <div>
                <select
                  value={filterFait}
                  onChange={(e) => setFilterFait(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">Toutes</option>
                  <option value="false">Planifiées uniquement</option>
                  <option value="true">Realisees</option>
                </select>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Rechercher..."
                  className="h-9 pl-8 w-[180px]"
                />
              </div>
              {(filterType || filterDateFrom || filterDateTo || filterFait !== "all" || searchText) && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                  <X className="h-4 w-4 mr-1" />
                  Effacer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Interventions table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Interventions ({filteredInterventions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredInterventions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Hammer className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p>Aucune intervention trouvée</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={handleOpenNew}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter une intervention
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Culture / Planche</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Durée</TableHead>
                      <TableHead className="text-right">Cout</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInterventions.map((intervention) => {
                      const isExpanded = expandedRow === intervention.id
                      const typeColor = TYPE_COLORS[intervention.type] || TYPE_COLORS.autre
                      const typeLabel = TYPE_LABELS[intervention.type] || intervention.type

                      // Try to find culture name
                      const isVirtual = intervention.source !== 'intervention'
                      const culture = intervention.cultureId
                        ? cultures.find((c) => c.id === intervention.cultureId)
                        : null
                      const cultureLabel = intervention.cultureNom
                        || (culture ? `${culture.nom}${culture.variete ? ` (${culture.variete})` : ""}` : null)
                      const plancheLabel = intervention.plancheNom || intervention.plancheId || null

                      return (
                        <React.Fragment key={intervention.id}>
                          <TableRow
                            className="cursor-pointer hover:bg-orange-50/50"
                            onClick={() =>
                              setExpandedRow(isExpanded ? null : intervention.id)
                            }
                          >
                            <TableCell className="px-2">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {formatDate(intervention.date)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Badge className={`${typeColor.bg} ${typeColor.text} border-0`}>
                                  {typeLabel}
                                </Badge>
                                {isVirtual && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground border-dashed">
                                    {intervention.source === 'culture' ? 'Culture' : intervention.source === 'irrigation' ? 'Irrig.' : intervention.source === 'fertilisation' ? 'Fertil.' : intervention.source === 'operation_arbre' ? 'Arbre' : intervention.source === 'soin_animal' ? 'Elevage' : ''}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[150px] truncate">
                              {cultureLabel || plancheLabel || "-"}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {intervention.description || "-"}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {formatDuration(intervention.dureeMinutes)}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {intervention.coutTotal
                                ? formatEuro(intervention.coutTotal)
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {intervention.fait ? (
                                <Badge className="bg-green-100 text-green-800 border-0">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Fait
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-800 border-0">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  Planifie
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div
                                className="flex items-center justify-end gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {isVirtual ? (
                                  <span className="text-xs text-muted-foreground italic">
                                    {intervention.source === 'culture' ? 'via Cultures' : intervention.source === 'irrigation' ? 'via Irrigations' : intervention.source === 'fertilisation' ? 'via Fertilisations' : intervention.source === 'operation_arbre' ? 'via Verger' : intervention.source === 'soin_animal' ? 'via Elevage' : ''}
                                  </span>
                                ) : (
                                  <>
                                    {!intervention.fait && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-green-700 hover:text-green-800 hover:bg-green-50"
                                        onClick={() => handleMarkDone(intervention)}
                                        title="Marquer comme fait"
                                      >
                                        <CheckCircle className="h-4 w-4" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                                      onClick={() => handleEdit(intervention)}
                                      title="Modifier"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-red-700 hover:text-red-800 hover:bg-red-50"
                                      onClick={() => handleDelete(intervention.id)}
                                      title="Supprimer"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Expanded details */}
                          {isExpanded && (
                            <TableRow className="bg-orange-50/30">
                              <TableCell colSpan={9} className="p-4">
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                                  {/* General info */}
                                  <div className="space-y-1">
                                    <p className="font-medium text-slate-700">Informations générales</p>
                                    <p>
                                      <span className="text-muted-foreground">Nb personnes :</span>{" "}
                                      {intervention.nbPersonnes || 1}
                                    </p>
                                    {intervention.coutMainOeuvre !== null && (
                                      <p>
                                        <span className="text-muted-foreground">Coût main d'œuvre :</span>{" "}
                                        {formatEuro(intervention.coutMainOeuvre)}
                                      </p>
                                    )}
                                    {intervention.datePrevue && (
                                      <p>
                                        <span className="text-muted-foreground">Date prévue :</span>{" "}
                                        {formatDate(intervention.datePrevue)}
                                      </p>
                                    )}
                                    {intervention.notes && (
                                      <p>
                                        <span className="text-muted-foreground">Notes :</span>{" "}
                                        {intervention.notes}
                                      </p>
                                    )}
                                  </div>

                                  {/* Intrant info */}
                                  {intervention.intrantNom && (
                                    <div className="space-y-1">
                                      <p className="font-medium text-slate-700">Intrant</p>
                                      <p>
                                        <span className="text-muted-foreground">Nom :</span>{" "}
                                        {intervention.intrantNom}
                                      </p>
                                      {intervention.intrantQuantite !== null && (
                                        <p>
                                          <span className="text-muted-foreground">Quantité :</span>{" "}
                                          {intervention.intrantQuantite} {intervention.intrantUnite}
                                        </p>
                                      )}
                                      {intervention.intrantCout !== null && (
                                        <p>
                                          <span className="text-muted-foreground">Coût :</span>{" "}
                                          {formatEuro(intervention.intrantCout)}
                                        </p>
                                      )}
                                      {intervention.intrantNumLot && (
                                        <p>
                                          <span className="text-muted-foreground">Num lot :</span>{" "}
                                          {intervention.intrantNumLot}
                                        </p>
                                      )}
                                    </div>
                                  )}

                                  {/* Phyto info */}
                                  {intervention.type === "traitement_phyto" && intervention.produitPhyto && (
                                    <div className="space-y-1">
                                      <p className="font-medium text-red-700">Traitement phytosanitaire</p>
                                      <p>
                                        <span className="text-muted-foreground">Produit :</span>{" "}
                                        {intervention.produitPhyto}
                                      </p>
                                      {intervention.numAMM && (
                                        <p>
                                          <span className="text-muted-foreground">AMM :</span>{" "}
                                          {intervention.numAMM}
                                        </p>
                                      )}
                                      {intervention.cibleTraitement && (
                                        <p>
                                          <span className="text-muted-foreground">Cible :</span>{" "}
                                          {intervention.cibleTraitement}
                                        </p>
                                      )}
                                      {intervention.doseAppliquee !== null && (
                                        <p>
                                          <span className="text-muted-foreground">Dose :</span>{" "}
                                          {intervention.doseAppliquee} {intervention.uniteDose}
                                        </p>
                                      )}
                                      {intervention.surfaceTraitee !== null && (
                                        <p>
                                          <span className="text-muted-foreground">Surface :</span>{" "}
                                          {intervention.surfaceTraitee} m2
                                        </p>
                                      )}
                                      {intervention.dar !== null && (
                                        <p>
                                          <span className="text-muted-foreground">DAR :</span>{" "}
                                          {intervention.dar} jours
                                        </p>
                                      )}
                                      {intervention.conditionsMeteo && (
                                        <p>
                                          <span className="text-muted-foreground">Meteo :</span>{" "}
                                          {intervention.conditionsMeteo}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t mt-8 py-4 text-center text-sm text-slate-500">
        <p>Gleba v1.1.0</p>
      </footer>
    </div>
  )
}
