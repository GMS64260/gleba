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
  Scissors,
  Stethoscope,
  AlertTriangle,
  Package,
  Check,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  ShieldAlert,
  Download,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

interface DashboardTabProps {
  year: number
}

interface DashboardData {
  stats: {
    animauxActifs: number
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
  cible: { type: string; id: number | null; label: string }
  lait: { finAttente: string; remiseVente: string } | null
  viande: { finAttente: string; remiseVente: string } | null
}

interface SoinItem {
  id: number
  injectionId?: string | null
  numeroInjection?: number | null
  date: string
  type: string
  description: string | null
  produit: string | null
  dose: string | null
  voie: string | null
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

export function DashboardTab({ year }: DashboardTabProps) {
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
    <div className="space-y-6">
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
          {/* Ligne 1 : Stats principales avec tendances N-1 */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            {/* BUG #8 (audit Julien 15/05/2026) — Avant : « 6 + 3 lots » faisait
                lire « 6 animaux » et paniquer l'éleveur. On affiche désormais
                le total cheptel en gros (individus + animaux en lots) + le
                détail en sous-titre. Click = navigation vers Animaux & Lots. */}
            {(() => {
              const total = data.stats.animauxTotal ?? data.stats.animauxActifs
              const individus = data.stats.animauxActifs
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
                  ? `${individus} individu${individus > 1 ? 's' : ''} · ${enLots} en lot${enLots > 1 ? 's' : ''} (${nbLots} lot${nbLots > 1 ? 's' : ''} actif${nbLots > 1 ? 's' : ''})`
                  : `${individus} individu${individus > 1 ? 's' : ''}`
              return (
                <Link href="/elevage/animaux" className="block">
                  <Card className={`${kpiCardClass("neutre")} hover:brightness-110 transition-[filter] cursor-pointer`}>
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

            {data.stats.activiteOeufs && <Card className={kpiCardClass("neutre")}>
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

            {data.stats.activiteOeufs && <Card className={kpiCardClass(data.stats.stockOeufs < 24 ? "alerte" : "neutre")}>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardDescription className={`text-xs ${kpiSubtleClass(data.stats.stockOeufs < 24 ? "alerte" : "neutre")}`}>Stock œufs</CardDescription>
                <CardTitle className="text-2xl">{data.stats.stockOeufs}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                <p className={`text-xs ${kpiSubtleClass(data.stats.stockOeufs < 24 ? "alerte" : "neutre")}`}>disponibles</p>
              </CardContent>
            </Card>}

            <Card className={kpiCardClass("revenu")}>
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
            </Card>

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
          <section aria-labelledby="productions-dashboard-title" className="space-y-3">
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
            ) : (
              <Card>
                <CardContent className="flex min-h-24 items-center justify-center py-4 text-center text-sm text-muted-foreground">
                  Aucune production enregistrée en {year}.
                </CardContent>
              </Card>
            )}
          </section>

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

          {/* Graphiques */}
          <div className="grid gap-4 md:grid-cols-2">
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
            {data.stats.activiteOeufs && <Card className="min-w-0">
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
        </>
      )}

      {/* Délais d'attente — remise en vente (feedback éleveur 2026-07-24) */}
      {attentes.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
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
                    <td className="p-2 font-medium">{a.cible.label}</td>
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
      <div>
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
                key={soin.id}
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
                    <span className="font-medium text-sm truncate">
                      {soin.lot?.nom || soin.animal?.nom || '-'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {soin.produit && (
                      <span className="text-xs text-muted-foreground">{soin.produit}</span>
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
