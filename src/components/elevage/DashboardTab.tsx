"use client"

/**
 * Onglet Dashboard & Soins - Vue d'ensemble de l'elevage
 * Stats, alertes, graphiques, et soins à planifier
 */

import * as React from "react"
import Link from "next/link"
import {
  Bird,
  Egg,
  TrendingUp,
  Stethoscope,
  AlertTriangle,
  Package,
  Check,
  ChevronRight,
  ChevronDown,
  TrendingDown,
  ShieldAlert,
  Download,
  Baby,
  Search,
  BarChart3,
  ClipboardCheck,
  Settings,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { BulkActions } from "@/components/calendrier/BulkActions"
import { SoinDetailDialog } from "@/components/elevage/SoinDetailDialog"
import { useToast } from "@/hooks/use-toast"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts"
import { kpiCardClass, kpiSubtleClass } from "@/lib/kpi-theme"
import { useFiliereSelection, capacitesSelection } from "@/lib/elevage/filiere-context"
import {
  attentesSanitairesPrioritaires,
  soinsSanitairesPrioritaires,
} from "@/lib/elevage/dashboard-priorites"

interface DashboardTabProps {
  year: number
}

interface DashboardData {
  stats: {
    animauxActifs: number
    animauxHorsLot?: number
    animauxRattachesLots?: number
    lotsActifs: number
    animauxEnLots?: number
    animauxTotal?: number
    productionOeufsAnnee: number
    productionOeufsAnneePrecedente: number
    ventesAnnee: number
    ventesAnneePrecedente: number
    nbVentes: number
    abattagesAnnee: number
    poidsCarcasseAnnee: number
    soinsAPlanifier: number
    alimentsStockBas: number
    stockOeufs: number
    stockOeufsDetail: { produits: number; casses: number; sales?: number; vendus: number }
    mortaliteAnnee: number
    tauxMortalite: number
    tauxPonte: number | null
    nbPondeuses: number
    activiteOeufs: boolean
    fcr: number | null
    consoAlimentsKg: number
    // PROMPT 17 — KPI lait
    laitTotalAnnee?: number
    laitMoyenJourJ30?: number
    laitStockTransformable?: number
    nbCollectesAnnee?: number
    tauxPonteSaisonAttendu?: number | null
  }
  animauxParType: {
    especeAnimaleId: string
    nom: string
    couleur: string | null
    count: number
  }[]
  productionOeufsMois: {
    mois: number
    total: number
  }[]
  ventesParCategorie: {
    categories: { categorie: string; label: string }[]
    mois: Array<{ mois: number; label: string; [categorie: string]: number | string }>
  }
  productions: {
    type: "oeufs" | "lait" | "fromage" | "viande"
    label: string
    quantite: number
    unite: string
    detail?: string
  }[]
}

interface QualiteLaitSummary {
  nbSuivis: number
  nbAvecMesure: number
  nbAlerte: number
  nbSurveillance: number
  cellulesMoyennes: number | null
}

// Feedback éleveur 2026-07-24 — délais d'attente lait/viande (remise en vente)
interface AttenteItem {
  soinId: number
  date: string
  traitement: string
  cible: { type: string; id: number | null; label: string; nom?: string | null }
  lait: { finAttente: string; remiseVente: string } | null
  viande: { finAttente: string; remiseVente: string } | null
}

interface SoinItem {
  id: number
  injectionId?: string | null
  numeroInjection?: number | null
  nombreInjections?: number | null
  date: string
  type: string
  description: string | null
  produit: string | null
  dose: string | null
  voie: string | null
  remiseVenteLait?: string | null
  remiseVenteViande?: string | null
  cout: number | null
  fait: boolean
  datePrevue: string | null
  animal: { id: number; nom: string; identifiant: string } | null
  lot: { id: number; nom: string } | null
}

const MOIS_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const COLORS = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

const TYPE_LABELS: Record<string, string> = {
  vaccination: "Vaccination",
  vermifuge: "Vermifuge",
  traitement: "Traitement",
  autre: "Autre",
}

const DASHBOARD_PREFS_KEY = "gleba:elevage:dashboard-preferences:v1"
type DashboardPreferences = {
  prioriteTerrain: boolean
  oeufs: boolean
  commercial: boolean
  productions: boolean
  graphiques: boolean
}
const DASHBOARD_PREFS_DEFAULT: DashboardPreferences = {
  prioriteTerrain: false,
  oeufs: true,
  commercial: true,
  productions: true,
  graphiques: true,
}

export function DashboardTab({ year }: DashboardTabProps) {
  const caps = capacitesSelection(useFiliereSelection())
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [data, setData] = React.useState<DashboardData | null>(null)
  const [statsError, setStatsError] = React.useState<string | null>(null)
  const [soins, setSoins] = React.useState<SoinItem[]>([])
  const [loadingSoins, setLoadingSoins] = React.useState(true)
  // PROMPT 20 — synthèse qualité du lait (cellules) sur 90 j
  const [qualite, setQualite] = React.useState<QualiteLaitSummary | null>(null)
  // Délais d'attente lait/viande en cours (remise en vente)
  const [attentes, setAttentes] = React.useState<AttenteItem[]>([])
  const [validationRapide, setValidationRapide] = React.useState<string | null>(null)
  // Ticket cmrz0s7r8 — sur mobile, les graphiques repoussent le travail du jour
  // sous plusieurs écrans. On les replie par défaut sur petit écran (bouton
  // « Voir les indicateurs ») ; ils restent toujours visibles sur desktop (lg).
  const [showGraphs, setShowGraphs] = React.useState(false)
  const [preferences, setPreferences] = React.useState<DashboardPreferences>(DASHBOARD_PREFS_DEFAULT)
  const soinsPrioritaires = React.useMemo(
    () => soinsSanitairesPrioritaires(soins),
    [soins],
  )
  const attentesPrioritaires = React.useMemo(
    () => attentesSanitairesPrioritaires(attentes),
    [attentes],
  )

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DASHBOARD_PREFS_KEY)
      if (stored) setPreferences({ ...DASHBOARD_PREFS_DEFAULT, ...JSON.parse(stored) })
    } catch {
      // Préférences locales facultatives : le dashboard reste utilisable.
    }
  }, [])

  const modifierPreference = (key: keyof DashboardPreferences, value: boolean) => {
    setPreferences((current) => {
      const next = { ...current, [key]: value }
      window.localStorage.setItem(DASHBOARD_PREFS_KEY, JSON.stringify(next))
      return next
    })
  }

  const appliquerPresetTerrain = () => {
    const next: DashboardPreferences = {
      prioriteTerrain: true,
      oeufs: false,
      commercial: false,
      productions: false,
      graphiques: false,
    }
    setPreferences(next)
    window.localStorage.setItem(DASHBOARD_PREFS_KEY, JSON.stringify(next))
  }

  // Charger stats dashboard
  React.useEffect(() => {
    async function fetchStats() {
      setIsLoading(true)
      setStatsError(null)
      try {
        const response = await fetch(`/api/elevage/stats?annee=${year}`)
        if (!response.ok) throw new Error("Réponse statistiques invalide")
        setData(await response.json())
      } catch {
        setData(null)
        setStatsError("Impossible de charger les statistiques de l’élevage. Réessayez dans quelques instants.")
      } finally {
        setIsLoading(false)
      }
    }
    fetchStats()
  }, [year])

  // Charger soins a faire
  const fetchSoins = React.useCallback(async () => {
    setLoadingSoins(true)
    try {
      const debut = new Date()
      debut.setDate(debut.getDate() - 30)
      const fin = new Date()
      fin.setDate(fin.getDate() + 30)
      const res = await fetch(`/api/elevage/taches?start=${debut.toISOString()}&end=${fin.toISOString()}`)
      if (res.ok) {
        const result = await res.json()
        setSoins((result.soins || []).filter((s: SoinItem) => !s.fait).slice(0, 20))
      }
    } catch {
      // silent
    } finally {
      setLoadingSoins(false)
    }
  }, [])

  React.useEffect(() => {
    fetchSoins()
  }, [fetchSoins])

  // PROMPT 20 — charge la synthèse qualité (silencieux : absent = pas d'élevage laitier)
  React.useEffect(() => {
    fetch('/api/elevage/qualite-lait?fenetre=90')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.troupeau) setQualite(j.troupeau) })
      .catch(() => {})
  }, [])

  // Délais d'attente en cours (remise en vente lait/viande)
  React.useEffect(() => {
    fetch('/api/elevage/attentes')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setAttentes(j.data) })
      .catch(() => {})
  }, [])

  // PROMPT 20a — Bulk actions sur les soins
  const bulkSoinsDone = async () => {
    if (soins.length === 0) return
    setSoins([]) // optimistic
    try {
      // Audit #83 : on vérifie chaque res.ok — fetch ne rejette pas sur 4xx/5xx,
      // donc un échec passait pour un succès. Si une PATCH échoue, on recharge.
      const res = await Promise.all(
        soins.map((soin) =>
          soin.injectionId
            ? fetch(`/api/elevage/soins/${soin.id}/injections`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ injectionId: soin.injectionId, statut: 'realisee', dateRealisee: new Date().toISOString() }),
              })
            : fetch('/api/elevage/soins', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: soin.id, fait: true, date: new Date().toISOString() }),
              })
        )
      )
      const echecs = res.filter((r) => !r.ok).length
      if (echecs > 0) {
        toast({ variant: 'destructive', title: `${echecs} soin(s) non enregistré(s)`, description: 'Rechargement…' })
        fetchSoins()
      } else {
        toast({ title: `${soins.length} soin(s) marqué(s) comme fait(s)` })
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erreur, recharge en cours' })
      fetchSoins()
    }
  }
  const bulkSoinsReport = async (days: number) => {
    const ids = soins.filter((s) => s.datePrevue).map((s) => s.id)
    if (ids.length === 0) return
    try {
      const res = await fetch('/api/soins/bulk-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, days }),
      })
      if (!res.ok) throw new Error('Échec')
      toast({ title: `${ids.length} soin(s) reporté(s) de ${days} jour(s)` })
      fetchSoins()
    } catch {
      toast({ variant: 'destructive', title: 'Erreur' })
    }
  }
  const bulkSoinsReportTo = async (date: string) => {
    const ids = soins.map((s) => s.id)
    if (ids.length === 0) return
    try {
      const res = await fetch('/api/soins/bulk-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, date }),
      })
      if (!res.ok) throw new Error('Échec')
      toast({ title: `${ids.length} soin(s) reporté(s) au ${new Date(date).toLocaleDateString('fr-FR')}` })
      fetchSoins()
    } catch {
      toast({ variant: 'destructive', title: 'Erreur' })
    }
  }

  // QA #5/#8 — un toucher OUVRE le détail (dose/voie) ; l'enregistrement passe
  // par un bouton explicite, jamais par le simple tap sur la carte.
  const [soinDetail, setSoinDetail] = React.useState<SoinItem | null>(null)

  // Toggle soin fait
  const toggleSoin = async (id: number, fait: boolean) => {
    try {
      const response = await fetch('/api/elevage/soins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, fait: !fait, date: !fait ? new Date().toISOString() : undefined }),
      })
      if (!response.ok) throw new Error('Erreur')
      setSoins(prev => prev.filter(s => s.id !== id))
      toast({ title: "Soin marque comme fait !" })
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  const validerSoinOuInjection = async (soin: SoinItem) => {
    if (!soin.injectionId) return toggleSoin(soin.id, soin.fait)
    try {
      const response = await fetch(`/api/elevage/soins/${soin.id}/injections`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          injectionId: soin.injectionId,
          statut: 'realisee',
          dateRealisee: new Date().toISOString(),
        }),
      })
      if (!response.ok) throw new Error('Erreur')
      toast({ title: "Injection enregistrée" })
      fetchSoins()
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  const validerPriorite = async (soin: SoinItem) => {
    const key = soin.injectionId ?? `soin-${soin.id}`
    setValidationRapide(key)
    try {
      await validerSoinOuInjection(soin)
    } finally {
      setValidationRapide(null)
    }
  }

  // Preparer donnees graphique production oeufs par mois
  // Feedback Marc 2026-05-16 — V4 Bug 3 : la requête $queryRaw renvoie
  // `mois` typé `Prisma.Decimal` (sérialisé en string dans certains cas)
  // et `total` en `bigint`. Le mapping côté API faisait déjà `Number()`,
  // mais on blinde ici en cas de désynchronisation type (chart vide alors
  // que les 1345 œufs/2026 existent en base).
  const productionMoisData = React.useMemo(() => {
    if (!data?.productionOeufsMois) return []
    const map = new Map<number, number>()
    for (const p of data.productionOeufsMois) {
      const m = Number(p.mois)
      const t = Number(p.total)
      if (Number.isFinite(m) && Number.isFinite(t)) map.set(m, t)
    }
    return MOIS_LABELS.map((label, i) => ({
      mois: label,
      oeufs: map.get(i + 1) ?? 0,
    }))
  }, [data])

  return (
    <div className="flex flex-col gap-6">
      {/* Mini-stats */}
      {isLoading ? (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : statsError ? (
        <Card role="alert" className="border-red-200">
          <CardContent className="py-6 text-center text-sm text-red-700">{statsError}</CardContent>
        </Card>
      ) : data && (
        <>
          {/* Bandeau « Aujourd'hui » — travail du jour + raccourcis en tête, pour
              ne pas enterrer les actions sous les stats/graphes sur mobile
              (ticket cmrz0s7r8). */}
          {(() => {
            const soinsRetard = soins.filter(
              (s) => s.datePrevue && new Date(s.datePrevue) < new Date(new Date().toDateString())
            ).length
            const chip = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
            const action = "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-slate-50 min-h-11"
            return (
              <div className={`rounded-xl border bg-white p-3 sm:p-4 space-y-3 ${preferences.prioriteTerrain ? "-order-3" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold">Aujourd&apos;hui</h2>
                  <div className="flex items-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0">
                          <Settings className="mr-1 h-4 w-4" />
                          Personnaliser
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Personnaliser le dashboard</DialogTitle>
                          <DialogDescription>Priorisez le travail quotidien et masquez les ateliers inutiles sur cet appareil.</DialogDescription>
                        </DialogHeader>
                        <Button type="button" variant="outline" onClick={appliquerPresetTerrain}>
                          Appliquer le preset « terrain laitier »
                        </Button>
                        <div className="space-y-3">
                          {([
                            ["prioriteTerrain", "Soins et délais avant les indicateurs"],
                            ["oeufs", "Cartes œufs"],
                            ["commercial", "Ventes et abattages"],
                            ["productions", "Synthèse des productions"],
                            ["graphiques", "Graphiques annuels"],
                          ] as const).map(([key, label]) => (
                            <label key={key} className="flex min-h-11 items-center gap-3 rounded-md border px-3">
                              <Checkbox
                                checked={preferences[key]}
                                onCheckedChange={(checked) => modifierPreference(key, checked === true)}
                              />
                              <span className="text-sm">{label}</span>
                            </label>
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                    <span className="hidden text-xs text-muted-foreground capitalize sm:inline">
                      {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="#soins-section"
                    className={`${chip} ${soinsRetard > 0 ? "bg-red-50 text-red-700" : soins.length > 0 ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}
                  >
                    <Stethoscope className="h-4 w-4" />
                    {soins.length > 0 ? `${soins.length} soin(s) à faire` : "Aucun soin à faire"}
                    {soinsRetard > 0 ? ` · ${soinsRetard} en retard` : ""}
                  </a>
                  {attentes.length > 0 && (
                    <a href="#delais-section" className={`${chip} bg-amber-50 text-amber-800`}>
                      <AlertTriangle className="h-4 w-4" />
                      {attentes.length} délai(s) lait/viande
                    </a>
                  )}
                </div>
                {(soinsPrioritaires.length > 0 || attentesPrioritaires.length > 0) && (
                  <section aria-labelledby="priorites-sanitaires-title" className="rounded-lg border border-red-100 bg-red-50/40 p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 id="priorites-sanitaires-title" className="flex items-center gap-2 text-sm font-semibold text-red-900">
                        <ShieldAlert className="h-4 w-4" />
                        Priorités sanitaires
                      </h3>
                      <Link href="/elevage?tab=alimentation&sub=registre" className="text-xs font-medium text-emerald-700 hover:underline">
                        Ouvrir le registre
                      </Link>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {soinsPrioritaires.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            3 prochains soins maximum
                          </p>
                          {soinsPrioritaires.map((soin) => {
                            const key = soin.injectionId ?? `soin-${soin.id}`
                            const cible = soin.lot?.nom
                              || (soin.animal?.nom && soin.animal?.identifiant
                                ? `${soin.animal.nom} · ${soin.animal.identifiant}`
                                : soin.animal?.nom || soin.animal?.identifiant)
                              || "Troupeau"
                            const cibleHref = soin.animal?.id
                              ? `/elevage/animaux/${soin.animal.id}`
                              : soin.lot?.id
                                ? `/elevage/lots/${soin.lot.id}`
                                : null
                            const datePriorite = new Date(soin.datePrevue ?? soin.date)
                            const enRetard = datePriorite < new Date(new Date().toDateString())
                            return (
                              <div key={key} className="rounded-md border bg-white p-2.5">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="break-words text-sm font-medium [overflow-wrap:anywhere]">{cible}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {soin.numeroInjection
                                        ? `Injection ${soin.numeroInjection}/${soin.nombreInjections ?? "?"}`
                                        : TYPE_LABELS[soin.type] || soin.type}
                                      {soin.produit ? ` · ${soin.produit}` : ""}
                                    </p>
                                    {(soin.dose || soin.voie) && (
                                      <p className="text-xs font-medium text-slate-700">
                                        {soin.dose ? `Dose ${soin.dose}` : ""}
                                        {soin.dose && soin.voie ? " · " : ""}
                                        {soin.voie ? `Voie ${soin.voie}` : ""}
                                      </p>
                                    )}
                                    {(soin.remiseVenteLait || soin.remiseVenteViande) && (
                                      <p className="text-[11px] text-amber-700">
                                        {soin.remiseVenteLait
                                          ? `Lait ${new Date(soin.remiseVenteLait).toLocaleDateString("fr-FR")}`
                                          : ""}
                                        {soin.remiseVenteLait && soin.remiseVenteViande ? " · " : ""}
                                        {soin.remiseVenteViande
                                          ? `Viande ${new Date(soin.remiseVenteViande).toLocaleDateString("fr-FR")}`
                                          : ""}
                                      </p>
                                    )}
                                  </div>
                                  <Badge variant={enRetard ? "destructive" : "outline"} className="shrink-0 text-[11px]">
                                    {datePriorite.toLocaleDateString("fr-FR")}
                                  </Badge>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-8"
                                    disabled={validationRapide === key}
                                    onClick={() => validerPriorite(soin)}
                                  >
                                    <Check className="mr-1 h-3.5 w-3.5" />
                                    {validationRapide === key
                                      ? "Enregistrement…"
                                      : soin.injectionId
                                        ? "Injection faite"
                                        : "Soin fait"}
                                  </Button>
                                  {cibleHref && (
                                    <Button asChild size="sm" variant="outline" className="h-8">
                                      <Link href={cibleHref}>
                                        {soin.animal?.id ? "Fiche animal" : "Fiche lot"}
                                      </Link>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {attentesPrioritaires.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Prochaines remises en vente
                          </p>
                          {attentesPrioritaires.map((attente) => {
                            const cible = attente.cible.nom && attente.cible.nom !== attente.cible.label
                              ? `${attente.cible.nom} · ${attente.cible.label}`
                              : attente.cible.label
                            const cibleHref = attente.cible.id == null
                              ? null
                              : attente.cible.type === "animal"
                                ? `/elevage/animaux/${attente.cible.id}`
                                : `/elevage/lots/${attente.cible.id}`
                            return (
                              <div key={`${attente.soinId}-${attente.cible.type}-${attente.cible.id ?? "all"}`} className="rounded-md border bg-white p-2.5">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="break-words text-sm font-medium [overflow-wrap:anywhere]">{cible}</p>
                                    <p className="text-xs text-muted-foreground">{attente.traitement}</p>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {attente.lait && (
                                      <Badge variant="outline" className="border-blue-200 text-[11px] text-blue-700">
                                        Lait {new Date(attente.lait.remiseVente).toLocaleDateString("fr-FR")}
                                      </Badge>
                                    )}
                                    {attente.viande && (
                                      <Badge variant="outline" className="border-red-200 text-[11px] text-red-700">
                                        Viande {new Date(attente.viande.remiseVente).toLocaleDateString("fr-FR")}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                {cibleHref && (
                                  <Button asChild size="sm" variant="ghost" className="mt-1 h-7 px-1 text-xs">
                                    <Link href={cibleHref}>
                                      Ouvrir {attente.cible.type === "animal" ? "la fiche animal" : "le lot"}
                                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                    </Link>
                                  </Button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </section>
                )}
                <div className="flex flex-wrap gap-2">
                  <Link href="/elevage?tab=alimentation&sub=soins&action=nouveau-soin" className={action}>
                    <Stethoscope className="h-4 w-4 text-blue-600" />+ Soin
                  </Link>
                  <Link href="/elevage?tab=reproduction&sub=naissances&action=nouvelle-naissance" className={action}>
                    <Baby className="h-4 w-4 text-pink-600" />+ Naissance
                  </Link>
                  <Link href="/elevage?tab=animaux&action=rechercher" className={action}>
                    <Search className="h-4 w-4 text-slate-500" />Rechercher (boucle)
                  </Link>
                  <Link href="/elevage?tab=alimentation&sub=registre" className={action}>
                    <ClipboardCheck className="h-4 w-4 text-emerald-600" />Registres
                  </Link>
                </div>
              </div>
            )
          })()}

          {/* Ligne 1 : Stats principales avec tendances N-1 */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            {/* BUG #8 (audit Julien 15/05/2026) — Avant : « 6 + 3 lots » faisait
                lire « 6 animaux » et paniquer l'éleveur. On affiche désormais
                le total cheptel en gros (individus + animaux en lots) + le
                détail en sous-titre. Click = navigation vers Animaux & Lots. */}
            {(() => {
              // QA caprin cms1v227a / cms1vcvc5 — effectif physique sans double
              // comptage : lots (fiches rattachées incluses) + fiches hors lot.
              const total = data.stats.animauxTotal ?? data.stats.animauxActifs
              const horsLot = data.stats.animauxHorsLot ?? data.stats.animauxActifs
              const rattaches = data.stats.animauxRattachesLots ?? 0
              const enLots = data.stats.animauxEnLots ?? 0
              const nbLots = data.stats.lotsActifs
              // Bug cmp8rw40u (Marc 2026-05-16) — "2 lots" comptait les lots
              // ACTIFS mais la page Lots affiche tous les lots (terminés inclus),
              // d'où l'incohérence visuelle. On précise "actif" dans le label
              // pour lever l'ambiguïté.
              const sousTitre =
                total === 0
                  ? null
                  : enLots > 0
                  ? `${enLots} en lot${enLots > 1 ? 's' : ''} (${nbLots} lot${nbLots > 1 ? 's' : ''} actif${nbLots > 1 ? 's' : ''}) + ${horsLot} hors lot`
                  : `${horsLot} individu${horsLot > 1 ? 's' : ''}`
              const infoBulle = rattaches > 0
                ? `Effectif = ${enLots} têtes dans les lots (dont ${rattaches} fiche${rattaches > 1 ? 's' : ''} nominative${rattaches > 1 ? 's' : ''} rattachée${rattaches > 1 ? 's' : ''}) + ${horsLot} fiche${horsLot > 1 ? 's' : ''} hors lot. Les fiches rattachées à un lot ne sont pas comptées deux fois.`
                : undefined
              return (
                <Link href="/elevage/animaux" className="block">
                  <Card title={infoBulle} className={`${kpiCardClass("neutre")} hover:brightness-110 transition-[filter] cursor-pointer`}>
                    <CardHeader className="pb-1 pt-3 px-4">
                      <CardDescription className={`${kpiSubtleClass("neutre")} text-xs`}>Animaux actifs</CardDescription>
                      <CardTitle className="text-2xl">
                        {total === 0 ? 'Aucun animal' : `${total} animau${total > 1 ? 'x' : ''}`}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3 px-4">
                      {sousTitre ? (
                        <p className={`text-xs ${kpiSubtleClass("neutre")}`}>{sousTitre}</p>
                      ) : (
                        <p className={`text-xs ${kpiSubtleClass("neutre")}`}>Ajoutez votre premier animal</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )
            })()}

            {preferences.oeufs && data.stats.activiteOeufs && <Card className={kpiCardClass("neutre")}>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardDescription className={`${kpiSubtleClass("neutre")} text-xs flex items-center gap-1`}>
                  Production œufs
                  {(() => {
                    const diff = data.stats.productionOeufsAnnee - data.stats.productionOeufsAnneePrecedente
                    if (data.stats.productionOeufsAnneePrecedente === 0) return null
                    return diff >= 0
                      ? <TrendingUp className="h-3 w-3 text-slate-300" />
                      : <TrendingDown className="h-3 w-3 text-red-300" />
                  })()}
                </CardDescription>
                <CardTitle className="text-2xl">{data.stats.productionOeufsAnnee}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                <p className={`text-xs ${kpiSubtleClass("neutre")}`}>
                  {data.stats.productionOeufsAnneePrecedente > 0
                    ? `${data.stats.productionOeufsAnnee >= data.stats.productionOeufsAnneePrecedente ? '+' : ''}${Math.round(((data.stats.productionOeufsAnnee - data.stats.productionOeufsAnneePrecedente) / data.stats.productionOeufsAnneePrecedente) * 100)}% vs ${year - 1}`
                    : `œufs en ${year}`
                  }
                </p>
              </CardContent>
            </Card>}

            {preferences.oeufs && data.stats.activiteOeufs && <Card className={kpiCardClass(data.stats.stockOeufs < 24 ? "alerte" : "neutre")}>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardDescription className={`text-xs ${kpiSubtleClass(data.stats.stockOeufs < 24 ? "alerte" : "neutre")}`}>Stock œufs</CardDescription>
                <CardTitle className="text-2xl">{data.stats.stockOeufs}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                <p className={`text-xs ${kpiSubtleClass(data.stats.stockOeufs < 24 ? "alerte" : "neutre")}`}>disponibles</p>
              </CardContent>
            </Card>}

            {preferences.commercial && <Card className={kpiCardClass("revenu")}>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardDescription className={`${kpiSubtleClass("revenu")} text-xs flex items-center gap-1`}>
                  Ventes {year}
                  {(() => {
                    const diff = data.stats.ventesAnnee - data.stats.ventesAnneePrecedente
                    if (data.stats.ventesAnneePrecedente === 0) return null
                    return diff >= 0
                      ? <TrendingUp className="h-3 w-3 text-emerald-200" />
                      : <TrendingDown className="h-3 w-3 text-red-200" />
                  })()}
                </CardDescription>
                <CardTitle className="text-2xl">{data.stats.ventesAnnee.toFixed(0)} &euro;</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                {/* Feedback Marc 2026-05-16 — V4 Bug 4 : on signale
                    l'incohérence « X ventes / 0 € » (prix de vente non
                    renseignés) pour éviter la lecture trompeuse
                    « Ventes 0 € » alors qu'on en a une à 0 €. */}
                <p className={`text-xs ${kpiSubtleClass("revenu")}`}>
                  {data.stats.ventesAnneePrecedente > 0
                    ? `${data.stats.ventesAnnee >= data.stats.ventesAnneePrecedente ? '+' : ''}${Math.round(((data.stats.ventesAnnee - data.stats.ventesAnneePrecedente) / data.stats.ventesAnneePrecedente) * 100)}% vs ${year - 1}`
                    : `${data.stats.nbVentes} vente${data.stats.nbVentes > 1 ? 's' : ''}${data.stats.nbVentes > 0 && data.stats.ventesAnnee === 0 ? ' (prix manquants)' : ''}`
                  }
                </p>
              </CardContent>
            </Card>}

            {preferences.commercial && caps.abattage && (
            <Card className={kpiCardClass("neutre")}>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardDescription className={`${kpiSubtleClass("neutre")} text-xs`}>Abattages {year}</CardDescription>
                <CardTitle className="text-2xl">{data.stats.abattagesAnnee}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                {/* Feedback Marc 2026-05-16 — V4 Bug 4 : si poids vif > 0
                    mais carcasse à 0, on signale l'incohérence agronomique
                    (perte de rendement ~30% normale entre vif et carcasse). */}
                <p className={`text-xs ${kpiSubtleClass("neutre")}`}>
                  {data.stats.poidsCarcasseAnnee > 0
                    ? `${data.stats.poidsCarcasseAnnee.toFixed(1)} kg carcasse`
                    : data.stats.abattagesAnnee > 0
                      ? "Poids carcasse à compléter"
                      : "—"}
                </p>
              </CardContent>
            </Card>
            )}
          </div>

          {/* Ligne 2 : Métriques de performance */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {data.stats.tauxPonte !== null && (
              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardDescription
                    className="text-xs flex items-center gap-1 cursor-help"
                    title="Taux observé sur les 7 derniers jours (fenêtre glissante). Il évolue à chaque nouvelle collecte récente — c'est attendu. La référence « attendu période » indique le taux théorique de saison."
                  >
                    <Egg className="h-3 w-3" />
                    Taux de ponte (7 derniers jours)
                  </CardDescription>
                  <CardTitle className={`text-2xl ${data.stats.tauxPonte >= 70 ? 'text-green-600' : data.stats.tauxPonte >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                    {data.stats.tauxPonte}%
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  <p className="text-xs text-muted-foreground">
                    {data.stats.nbPondeuses} pondeuses
                    {data.stats.tauxPonteSaisonAttendu != null && (
                      <> — attendu période ≈ {data.stats.tauxPonteSaisonAttendu}%</>
                    )}
                  </p>
                </CardContent>
              </Card>
            )}
            {/* PROMPT 17 — KPI Lait */}
            {data.stats.laitMoyenJourJ30 != null && data.stats.laitMoyenJourJ30 > 0 && (
              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardDescription className="text-xs flex items-center gap-1">
                    🥛 Production lait (30 j)
                  </CardDescription>
                  <CardTitle className="text-2xl text-blue-700">
                    {data.stats.laitMoyenJourJ30} L/j
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  <p className="text-xs text-muted-foreground">{data.stats.nbCollectesAnnee ?? 0} collectes cette année</p>
                </CardContent>
              </Card>
            )}
            {data.stats.laitStockTransformable != null && data.stats.laitStockTransformable > 0 && (
              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardDescription className="text-xs flex items-center gap-1">
                    📦 Stock lait transformable
                  </CardDescription>
                  <CardTitle className="text-2xl text-cyan-700">
                    {data.stats.laitStockTransformable} L
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  <p className="text-xs text-muted-foreground">non affecté à un lot</p>
                </CardContent>
              </Card>
            )}
            {/* PROMPT 20 — Qualité du lait / cellules (uniquement si élevage laitier suivi) */}
            {qualite && qualite.nbSuivis > 0 && qualite.nbAvecMesure > 0 && (
              <Link href="/elevage?tab=production" className="block">
                <Card
                  className={
                    (qualite.nbAlerte > 0
                      ? "border-red-200 bg-red-50 "
                      : qualite.nbSurveillance > 0
                        ? "border-amber-200 bg-amber-50 "
                        : "") + "hover:brightness-105 transition-[filter] cursor-pointer"
                  }
                >
                  <CardHeader className="pb-1 pt-3 px-4">
                    <CardDescription className="text-xs flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" />
                      Qualité lait (cellules)
                    </CardDescription>
                    <CardTitle
                      className={`text-2xl ${
                        qualite.nbAlerte > 0
                          ? "text-red-600"
                          : qualite.nbSurveillance > 0
                            ? "text-amber-600"
                            : "text-emerald-600"
                      }`}
                    >
                      {qualite.nbAlerte > 0
                        ? `${qualite.nbAlerte} en alerte`
                        : qualite.nbSurveillance > 0
                          ? `${qualite.nbSurveillance} à surveiller`
                          : "OK"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-3 px-4">
                    <p className="text-xs text-muted-foreground">
                      {qualite.cellulesMoyennes != null
                        ? `moyenne ${
                            qualite.cellulesMoyennes >= 1000
                              ? `${(qualite.cellulesMoyennes / 1000).toFixed(2)} M`
                              : `${qualite.cellulesMoyennes} k`
                          }/mL sur 90 j`
                        : "sur 90 j"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )}
            {data.stats.mortaliteAnnee > 0 && (
              <Card className={data.stats.tauxMortalite > 5 ? "border-red-200 bg-red-50" : ""}>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardDescription className="text-xs flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Mortalite {year}
                  </CardDescription>
                  <CardTitle className={`text-2xl ${data.stats.tauxMortalite > 5 ? 'text-red-600' : 'text-slate-700'}`}>
                    {data.stats.mortaliteAnnee}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  <p className="text-xs text-muted-foreground">taux : {data.stats.tauxMortalite}%</p>
                </CardContent>
              </Card>
            )}
            {data.stats.fcr !== null && (
              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardDescription className="text-xs flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    Indice conso. (FCR)
                  </CardDescription>
                  <CardTitle className="text-2xl">{data.stats.fcr}</CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  <p className="text-xs text-muted-foreground">kg aliment / kg carcasse</p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardDescription className="text-xs flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  Alimentation {year}
                </CardDescription>
                <CardTitle className="text-2xl">{data.stats.consoAlimentsKg} kg</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                <p className="text-xs text-muted-foreground">total distribué</p>
              </CardContent>
            </Card>
          </div>

          {/* Synthèse de toutes les productions enregistrées sur la période. */}
          {preferences.productions && <section aria-labelledby="productions-dashboard-title" className="space-y-3">
            <div>
              <h2 id="productions-dashboard-title" className="text-lg font-semibold">Productions enregistrées</h2>
              <p className="text-sm text-muted-foreground">Année {year}</p>
            </div>
            {data.productions.length > 0 ? (
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {data.productions.map((production) => (
                  <Card key={production.type} className="min-w-0">
                    <CardHeader className="px-4 pb-1 pt-3">
                      <CardDescription className="text-xs">{production.label}</CardDescription>
                      <CardTitle className="break-words text-2xl">
                        {production.quantite.toLocaleString("fr-FR")} {production.unite}
                      </CardTitle>
                    </CardHeader>
                    {production.detail && (
                      <CardContent className="px-4 pb-3">
                        <p className="text-xs text-muted-foreground">{production.detail}</p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            ) : data.stats.activiteOeufs ? (
              // Ticket QA caprin cmrz0qrrb (2026-07-24) — un atelier qui ne produit
              // que des œufs voyait « Aucune production enregistrée » ici alors que
              // les cartes/graphe affichent la production d'œufs. Les œufs gardent
              // leurs surfaces dédiées (cartes + graphe mensuel, cf. TIN-33) : on
              // lève la contradiction avec un message explicite au lieu d'un « aucune ».
              <Card>
                <CardContent className="flex min-h-24 items-center justify-center py-4 text-center text-sm text-muted-foreground">
                  La production d&apos;œufs est détaillée ci-dessus (cartes et graphique mensuel). Aucune autre production (lait, fromage, viande) enregistrée en {year}.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex min-h-24 items-center justify-center py-4 text-center text-sm text-muted-foreground">
                  Aucune production enregistrée en {year}.
                </CardContent>
              </Card>
            )}
          </section>}

          {/* Alertes */}
          {(data.stats.soinsAPlanifier > 0 || data.stats.alimentsStockBas > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {data.stats.soinsAPlanifier > 0 && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-blue-700 flex items-center gap-2">
                      <Stethoscope className="h-4 w-4" />
                      Soins a planifier
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-blue-800">
                      {data.stats.soinsAPlanifier} soin(s) prevu(s) dans les 30 prochains jours
                    </p>
                  </CardContent>
                </Card>
              )}
              {data.stats.alimentsStockBas > 0 && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-orange-700 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Stock aliments bas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-orange-800">
                      {data.stats.alimentsStockBas} aliment(s) a reapprovisionner
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Graphiques — repliés par défaut sur mobile (ticket cmrz0s7r8),
              toujours visibles sur desktop (lg). */}
          {preferences.graphiques && <>
          <button
            type="button"
            onClick={() => setShowGraphs((v) => !v)}
            aria-expanded={showGraphs}
            className="lg:hidden inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium min-h-11"
          >
            {showGraphs ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <BarChart3 className="h-4 w-4 text-slate-500" />
            {showGraphs ? "Masquer les indicateurs" : "Voir les indicateurs"}
          </button>
          <div className={`${showGraphs ? "grid" : "hidden"} lg:grid gap-4 md:grid-cols-2`}>
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="text-sm">Ventes par catégorie</CardTitle>
                <CardDescription>Chiffre d&apos;affaires {year}</CardDescription>
              </CardHeader>
              <CardContent className="min-w-0 overflow-x-auto pb-2">
                {data.ventesParCategorie.categories.length > 0 ? (
                  <ChartContainer config={{}} className="h-[240px] min-w-[620px] w-full aspect-auto sm:h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.ventesParCategorie.mois} margin={{ left: 4, right: 8 }}>
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${value} €`} />
                        <ChartTooltip
                          content={<ChartTooltipContent formatter={(value) => `${Number(value).toLocaleString("fr-FR")} €`} />}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        {data.ventesParCategorie.categories.map(({ categorie, label }, index) => (
                          <Bar
                            key={categorie}
                            dataKey={categorie}
                            name={label}
                            stackId="ventes"
                            fill={`hsl(${(index * 67 + 145) % 360} 65% 45%)`}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="h-[250px] flex flex-col items-center justify-center text-muted-foreground gap-1">
                    <TrendingUp className="h-8 w-8 opacity-30" />
                    <p className="text-sm">Aucune vente enregistrée en {year}.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Production œufs par mois — BUG #7 : axe Y dynamique sur
                max(données) × 1.2 (jamais hardcodé), placeholder « Pas
                encore de données » si l'année est vide plutôt qu'un
                graphe blanc déconcertant. */}
            {preferences.oeufs && data.stats.activiteOeufs && <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="text-sm">Production d&apos;œufs par mois</CardTitle>
                <CardDescription>Année {year}</CardDescription>
              </CardHeader>
              <CardContent className="min-w-0 overflow-hidden">
                {(() => {
                  const maxOeufs = Math.max(0, ...productionMoisData.map((d) => d.oeufs))
                  if (maxOeufs <= 0) {
                    return (
                      <div className="h-[250px] flex flex-col items-center justify-center text-muted-foreground gap-1">
                        <Egg className="h-8 w-8 opacity-30" />
                        <p className="text-sm">Pas encore de collecte sur {year}.</p>
                      </div>
                    )
                  }
                  const yMax = Math.ceil(maxOeufs * 1.2)
                  return (
                    <ChartContainer config={{}} className="h-[250px] aspect-auto">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={productionMoisData}>
                          <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} domain={[0, yMax]} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="oeufs" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  )
                })()}
              </CardContent>
            </Card>}

            {/* Repartition animaux par type */}
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="text-sm">Répartition par espèce</CardTitle>
                <CardDescription>Animaux actifs</CardDescription>
              </CardHeader>
              <CardContent className="min-w-0 overflow-hidden">
                {data.animauxParType.length > 0 ? (
                  <ChartContainer config={{}} className="h-[280px] aspect-auto">
                    {/* Bug feedback testeur 2026-05-25 (cmplkfit/cmplk944c) —
                        Le PieChart restait blanc même avec 69 animaux à
                        afficher. On force un remount via la clé (signature
                        des données) et on désactive l'animation. La hauteur
                        est élargie pour laisser la place à la Legend. */}
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart key={data.animauxParType.map((e) => `${e.nom}:${e.count}`).join("|")}>
                        <Pie
                          data={data.animauxParType}
                          dataKey="count"
                          nameKey="nom"
                          cx="50%"
                          cy="45%"
                          outerRadius={70}
                          label={false}
                          isAnimationActive={false}
                        >
                          {data.animauxParType.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.couleur || COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="h-[250px] flex flex-col items-center justify-center text-muted-foreground gap-1">
                    <Bird className="h-8 w-8 opacity-30" />
                    <p className="text-sm">Pas encore d&apos;animal enregistré.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          </>}
        </>
      )}

      {/* Délais d'attente — remise en vente (feedback éleveur 2026-07-24) */}
      {attentes.length > 0 && (
        <div id="delais-section" className={`scroll-mt-24 rounded-xl border border-amber-200 bg-amber-50/60 p-4 ${preferences.prioriteTerrain ? "-order-2" : ""}`}>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Délais d&apos;attente — remise en vente
            <Badge variant="secondary">{attentes.length}</Badge>
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            Lait et viande à ne pas commercialiser avant la date indiquée (temps d&apos;attente vétérinaire).
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-amber-200">
                <tr>
                  <th className="p-2 text-left">Animal / Lot</th>
                  <th className="p-2 text-left">Traitement</th>
                  <th className="p-2 text-left">🥛 Lait — remise en vente</th>
                  <th className="p-2 text-left">🥩 Viande — remise en vente</th>
                </tr>
              </thead>
              <tbody>
                {attentes.map((a) => (
                  <tr key={a.soinId} className="border-b border-amber-100">
                    {/* QA caprin cms1vbkl4 — nom + boucle, pas la boucle seule */}
                    <td className="p-2 font-medium">{a.cible.nom && a.cible.nom !== a.cible.label ? `${a.cible.nom} · ${a.cible.label}` : a.cible.label}</td>
                    <td className="p-2 text-slate-600">{a.traitement}</td>
                    <td className="p-2">
                      {a.lait ? (
                        <span className="text-blue-700 font-medium">le {new Date(a.lait.remiseVente).toLocaleDateString('fr-FR')}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-2">
                      {a.viande ? (
                        <span className="text-red-700 font-medium">le {new Date(a.viande.remiseVente).toLocaleDateString('fr-FR')}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Soins à faire */}
      <div id="soins-section" className={`scroll-mt-24 ${preferences.prioriteTerrain ? "-order-1" : ""}`}>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-blue-600" />
            Soins à faire
            {soins.length > 0 && (
              <Badge variant="secondary">{soins.length}</Badge>
            )}
          </h2>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/elevage/registre-sanitaire?year=${new Date().getFullYear()}`}>
              <Download className="h-4 w-4 mr-1" />Télécharger tous les soins
            </a>
          </Button>
          {/* PROMPT 20a — Actions en masse sur les soins */}
          {soins.length >= 2 && (
            <BulkActions
              count={soins.length}
              markAllLabel={`Tout fait (${soins.length})`}
              onMarkAllDone={bulkSoinsDone}
              onReport={bulkSoinsReport}
              onReportTo={bulkSoinsReportTo}
            />
          )}
        </div>

        {loadingSoins ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : soins.length === 0 ? (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="py-4">
              <p className="text-sm text-green-700">Tous les soins sont à jour !</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {soins.map((soin) => (
              <button
                key={soin.injectionId ?? `soin-${soin.id}`}
                onClick={() => setSoinDetail(soin)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border bg-white border-blue-200 hover:border-blue-400 hover:shadow-sm transition-all text-left"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Stethoscope className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {TYPE_LABELS[soin.type] || soin.type}
                    </Badge>
                    <span className="break-words text-sm font-medium [overflow-wrap:anywhere]">
                      {soin.lot?.nom || (soin.animal?.nom && soin.animal?.identifiant ? `${soin.animal.nom} · ${soin.animal.identifiant}` : soin.animal?.nom || soin.animal?.identifiant) || '-'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {soin.numeroInjection && (
                      <span className="text-xs font-medium text-blue-700">
                        Injection {soin.numeroInjection}/{soin.nombreInjections ?? "?"}
                      </span>
                    )}
                    {soin.produit && (
                      <span className="text-xs text-muted-foreground">{soin.produit}</span>
                    )}
                    {(soin.dose || soin.voie) && (
                      <span className="text-xs text-muted-foreground">
                        {[soin.dose && `dose ${soin.dose}`, soin.voie && `voie ${soin.voie}`].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    {soin.cout && (
                      <span className="text-xs text-muted-foreground">{soin.cout.toFixed(2)} &euro;</span>
                    )}
                  </div>
                </div>
                {(() => {
                  // Bug cmp8rwths — badge "En retard" si datePrevue (ou date)
                  // est antérieure à aujourd'hui et soin pas encore fait.
                  const ref = soin.datePrevue ?? (!soin.fait ? soin.date : null)
                  if (!ref) return null
                  const refDate = new Date(ref)
                  const today = new Date(); today.setHours(0, 0, 0, 0)
                  const isLate = !soin.fait && refDate < today
                  return (
                    <span className={`text-xs flex-shrink-0 flex items-center gap-1 ${isLate ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                      {isLate && <AlertTriangle className="h-3 w-3" />}
                      {refDate.toLocaleDateString('fr-FR')}
                      {isLate && ' (en retard)'}
                    </span>
                  )
                })()}
                <Check className="h-4 w-4 text-slate-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      <SoinDetailDialog
        soin={soinDetail}
        onClose={() => setSoinDetail(null)}
        typeLabels={TYPE_LABELS}
        onMarquerFait={async (s) => { await validerSoinOuInjection(s as SoinItem); setSoinDetail(null) }}
      />
    </div>
  )
}
