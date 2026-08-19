"use client"

/**
 * Page Coûts de Production (P1b)
 * Analyse de la rentabilité par espece et par culture
 */

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { getAvailableYears } from "@/components/year-selector"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UserMenu } from "@/components/auth/UserMenu"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import {
  Sprout,
  TreeDeciduous,
  Bird,
  Settings,
  Wallet,
  Calendar,
  TrendingUp,
  TrendingDown,
  Euro,
  BarChart3,
  ArrowLeft,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Package,
  Clock,
  Leaf,
  X,
} from "lucide-react"


// ============================================================
// Types
// ============================================================

interface EspeceData {
  especeId: string
  especeNom?: string
  nbCultures: number
  surface: number
  production: number
  revenus: number
  quantiteVendue: number
  coutSemences: number
  coutIntrants: number
  coutFertilisation: number
  coutMainOeuvre: number
  coutTotal: number
  margeBrute: number
  margePercent: number
  coutKg: number
  prixMoyenKg: number
  heuresTravaillees: number
  rendement: number
}

interface CultureData {
  cultureId: number
  especeId: string
  especeNom?: string
  variete: string | null
  plancheNom: string | null
  surface: number
  production: number
  revenus: number
  quantiteVendue: number
  coutSemences: number
  coutIntrants: number
  coutFertilisation: number
  coutMainOeuvre: number
  coutTotal: number
  margeBrute: number
  margePercent: number
  coutKg: number
  prixMoyenKg: number
  heuresTravaillees: number
  rendement: number
}

interface Totaux {
  revenus: number
  coutTotal: number
  // TICKET cmsoez28o — dépenses comptables SSOT (dashboard Comptabilité),
  // exposées par la lib pour afficher l'écart avec les coûts analytiques.
  // Optionnel pour tolérer une réponse d'une version antérieure de l'API.
  depensesComptables?: number
  coutSemences: number
  coutIntrants: number
  coutFertilisation: number
  coutMainOeuvre: number
  margeBrute: number
  margePercent: number
  production: number
  surface: number
  heuresTravaillees: number
  nbEspeces: number
  nbCultures: number
}

interface ModuleData {
  revenus: number
  couts: number
  marge: number
  production?: number
  heures?: number
  detailCouts?: {
    alimentation: number
    soins: number
    autres: number
  }
}

interface CoutsData {
  parEspece: EspeceData[]
  parCulture: CultureData[]
  parModule?: {
    potager: ModuleData
    verger: ModuleData
    elevage: ModuleData
    general: { couts: number }
  }
  totaux: Totaux
  // Sous-total des lignes espèces affichées (QA cmsno0ixf) — optionnel pour
  // tolérer une réponse d'une version antérieure de l'API pendant une bascule.
  totauxEspeces?: {
    revenus: number
    coutTotal: number
    margeBrute: number
    margePercent: number
    production: number
    surface: number
    heuresTravaillees: number
    nbEspeces: number
    nbCultures: number
  }
  meta: {
    annee: number
    module: string
    generatedAt: string
  }
}

// ============================================================
// Helpers
// ============================================================

const formatEuro = (value: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value)

const formatNumber = (value: number, decimals = 1) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: decimals }).format(value)

const getMargeColorBg = (percent: number) => {
  if (percent > 30) return "bg-green-100 text-green-700"
  if (percent >= 10) return "bg-amber-100 text-amber-700"
  return "bg-red-100 text-red-700"
}

const COST_COLORS = {
  semences: "#22c55e",
  intrants: "#3b82f6",
  fertilisation: "#f59e0b",
  mainOeuvre: "#8b5cf6",
}

type SortKey = keyof EspeceData
type SortDir = "asc" | "desc"

// ============================================================
// Component
// ============================================================

export default function CoutsProductionPage() {
  const { data: session } = useSession()
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear())
  const [data, setData] = React.useState<CoutsData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [expandedEspece, setExpandedEspece] = React.useState<string | null>(null)
  const [sortKey, setSortKey] = React.useState<SortKey>("revenus")
  const [sortDir, setSortDir] = React.useState<SortDir>("desc")

  // Même motif que /comptabilite et /comptabilite/transactions : l'année
  // choisie se partage entre les écrans compta via `gleba_compta_year`
  // (lecture au montage, persistance après hydratation).
  // QA cmsoamukd — state et non ref : le fetch du montage attend l'hydratation
  // (sinon la salve « année par défaut » peut écraser celle de l'année choisie).
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

  // QA Camille 2026-05-15 — bonus : plage factorisée [N+1 … N-4]
  const currentYear = new Date().getFullYear()
  const availableYears = getAvailableYears()

  // Fetch data
  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/comptabilite/couts-production?annee=${selectedYear}&module=all`)
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch (err) {
        console.error("Erreur chargement couts de production:", err)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user && yearHydrated) {
      fetchData()
    }
  }, [selectedYear, session?.user, yearHydrated])

  // Sorting
  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const sortedEspeces = React.useMemo(() => {
    if (!data?.parEspece) return []
    return [...data.parEspece].sort((a, b) => {
      const aVal = a[sortKey] as number
      const bVal = b[sortKey] as number
      return sortDir === "asc" ? aVal - bVal : bVal - aVal
    })
  }, [data?.parEspece, sortKey, sortDir])

  // Get cultures for expanded espece
  const expandedCultures = React.useMemo(() => {
    if (!expandedEspece || !data?.parCulture) return []
    return data.parCulture.filter(c => c.especeId === expandedEspece)
  }, [expandedEspece, data?.parCulture])

  // Chart data: Top 10 by margin
  const topMarginData = React.useMemo(() => {
    if (!data?.parEspece) return []
    return [...data.parEspece]
      .filter(e => e.revenus > 0 || e.coutTotal > 0)
      .sort((a, b) => b.margeBrute - a.margeBrute)
      .slice(0, 10)
      .map(e => ({
        name: e.especeNom ?? e.especeId,
        marge: e.margeBrute,
        revenus: e.revenus,
        couts: e.coutTotal,
      }))
  }, [data?.parEspece])

  // Chart data: Cost breakdown pie
  const costBreakdownData = React.useMemo(() => {
    if (!data?.totaux) return []
    const items = [
      { name: "Semences", value: data.totaux.coutSemences, color: COST_COLORS.semences },
      { name: "Intrants", value: data.totaux.coutIntrants, color: COST_COLORS.intrants },
      { name: "Fertilisation", value: data.totaux.coutFertilisation, color: COST_COLORS.fertilisation },
      { name: "Main d'oeuvre", value: data.totaux.coutMainOeuvre, color: COST_COLORS.mainOeuvre },
    ]
    return items.filter(i => i.value > 0)
  }, [data?.totaux])

  // Chart data: Cost/kg vs Price/kg
  const profitabilityData = React.useMemo(() => {
    if (!data?.parEspece) return []
    return data.parEspece
      .filter(e => e.production > 0 && (e.coutKg > 0 || e.prixMoyenKg > 0))
      .map(e => ({
        name: e.especeNom ?? e.especeId,
        coutKg: e.coutKg,
        prixKg: e.prixMoyenKg,
        margeKg: e.prixMoyenKg - e.coutKg,
      }))
      .sort((a, b) => b.margeKg - a.margeKg)
      .slice(0, 15)
  }, [data?.parEspece])

  // Sortable column header
  const SortHeader = ({ label, field, className = "" }: { label: string; field: SortKey; className?: string }) => (
    <TableHead
      className={`cursor-pointer select-none hover:bg-slate-50 ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortKey === field ? "text-blue-600" : "text-slate-400"}`} />
      </div>
    </TableHead>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-slate-50">
      {/* Header */}
      <header className="border-b border-b-2 border-b-blue-500 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between max-w-[1600px]">
          <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
            <Image
              src="/gleba-logo.png"
              alt="Gleba"
              width={150}
              height={100}
              className="h-10 w-auto rounded-lg"
              priority
            />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-lg overflow-hidden">
              <Link href="/">
                <Button variant="ghost" size="sm" className="rounded-none text-green-700 hover:text-green-800 hover:bg-green-50 border-r">
                  <Sprout className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Maraîchage</span>
                </Button>
              </Link>
              <Link href="/verger">
                <Button variant="ghost" size="sm" className="rounded-none text-lime-700 hover:text-lime-800 hover:bg-lime-50 border-r">
                  <TreeDeciduous className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Verger</span>
                </Button>
              </Link>
              <Link href="/elevage">
                <Button variant="ghost" size="sm" className="rounded-none text-amber-700 hover:text-amber-800 hover:bg-amber-50 border-r">
                  <Bird className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Élevage</span>
                </Button>
              </Link>
              <Link href="/comptabilite">
                <Button variant="ghost" size="sm" className="rounded-none bg-blue-50 text-blue-700">
                  <Wallet className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Compta</span>
                </Button>
              </Link>
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

      <main className="container mx-auto px-4 py-8 max-w-[1600px]">
        {/* Title + Back + Year selector */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/comptabilite">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Comptabilité
              </Button>
            </Link>
            <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-teal-700" />
            </div>
            <h1 className="text-xl font-semibold text-slate-800">Coûts de production</h1>
          </div>
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(parseInt(value))}
          >
            <SelectTrigger className="w-[120px]">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 lg:grid-cols-4 mb-6">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
                <CardContent><Skeleton className="h-8 w-32" /></CardContent>
              </Card>
            ))
          ) : data?.totaux ? (
            <>
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-blue-100 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Revenus totaux
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{formatEuro(data.totaux.revenus)}</p>
                  <p className="text-sm text-blue-100 mt-1">
                    {data.totaux.nbEspeces} espèce(s) — {data.totaux.nbCultures} culture(s)
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-red-100 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    Coûts totaux
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{formatEuro(data.totaux.coutTotal)}</p>
                  <p className="text-sm text-red-100 mt-1">
                    {formatNumber(data.totaux.surface)} m² — {formatNumber(data.totaux.production)} kg
                  </p>
                </CardContent>
              </Card>

              <Card className={`bg-gradient-to-br ${data.totaux.margeBrute >= 0 ? "from-emerald-500 to-emerald-600" : "from-orange-500 to-orange-600"} text-white`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-white/80 flex items-center gap-2">
                    <Euro className="h-4 w-4" />
                    Marge brute
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{formatEuro(data.totaux.margeBrute)}</p>
                  <p className="text-sm text-white/80 mt-1">
                    {formatNumber(data.totaux.heuresTravaillees)} heures travaillées
                  </p>
                </CardContent>
              </Card>

              <Card className={`bg-gradient-to-br ${
                data.totaux.margePercent > 30 ? "from-teal-500 to-teal-600" :
                data.totaux.margePercent >= 10 ? "from-amber-500 to-amber-600" :
                "from-red-500 to-red-600"
              } text-white`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-white/80 flex items-center gap-2">
                    Marge %
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{formatNumber(data.totaux.margePercent)}%</p>
                  <p className="text-sm text-white/80 mt-1">
                    {data.totaux.margePercent > 30 ? "Bonne rentabilité" :
                     data.totaux.margePercent >= 10 ? "Rentabilité moyenne" :
                     "Rentabilité faible"}
                  </p>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        {/* Résumé par module */}
        {data?.parModule && (
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card className="border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                  <Sprout className="h-4 w-4" /> Maraîchage
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Revenus</span><span className="font-medium text-green-700">{formatEuro(data.parModule.potager.revenus)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Coûts</span><span className="font-medium text-red-600">{formatEuro(data.parModule.potager.couts)}</span></div>
                <div className="flex justify-between border-t pt-1"><span className="font-medium">Marge</span><span className={`font-bold ${data.parModule.potager.marge >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatEuro(data.parModule.potager.marge)}</span></div>
                {data.parModule.potager.production ? <div className="flex justify-between text-muted-foreground"><span>Production</span><span>{formatNumber(data.parModule.potager.production)} kg</span></div> : null}
              </CardContent>
            </Card>
            <Card className="border-lime-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-lime-700">
                  <TreeDeciduous className="h-4 w-4" /> Verger
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Revenus</span><span className="font-medium text-green-700">{formatEuro(data.parModule.verger.revenus)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Coûts</span><span className="font-medium text-red-600">{formatEuro(data.parModule.verger.couts)}</span></div>
                <div className="flex justify-between border-t pt-1"><span className="font-medium">Marge</span><span className={`font-bold ${data.parModule.verger.marge >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatEuro(data.parModule.verger.marge)}</span></div>
                {data.parModule.verger.production ? <div className="flex justify-between text-muted-foreground"><span>Production</span><span>{formatNumber(data.parModule.verger.production)} kg</span></div> : null}
              </CardContent>
            </Card>
            <Card className="border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
                  <Bird className="h-4 w-4" /> Élevage
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Revenus</span><span className="font-medium text-green-700">{formatEuro(data.parModule.elevage.revenus)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Coûts</span><span className="font-medium text-red-600">{formatEuro(data.parModule.elevage.couts)}</span></div>
                <div className="flex justify-between border-t pt-1"><span className="font-medium">Marge</span><span className={`font-bold ${data.parModule.elevage.marge >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatEuro(data.parModule.elevage.marge)}</span></div>
                {data.parModule.elevage.detailCouts && (
                  <div className="text-xs text-muted-foreground pt-1 border-t space-y-0.5">
                    <div className="flex justify-between"><span>Alimentation</span><span>{formatEuro(data.parModule.elevage.detailCouts.alimentation)}</span></div>
                    <div className="flex justify-between"><span>Soins</span><span>{formatEuro(data.parModule.elevage.detailCouts.soins)}</span></div>
                    <div className="flex justify-between"><span>Autres</span><span>{formatEuro(data.parModule.elevage.detailCouts.autres)}</span></div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main table: Rentabilité par espece */}
        {loading ? (
          <Card className="mb-8">
            <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
            <CardContent><Skeleton className="h-64 w-full" /></CardContent>
          </Card>
        ) : data?.parEspece && data.parEspece.length > 0 ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Leaf className="h-5 w-5 text-teal-600" />
                Rentabilité par espèce
              </CardTitle>
              <CardDescription>
                Cliquez sur une espèce pour voir le détail par culture
              </CardDescription>
            </CardHeader>
            {/* TICKET cmsof7s3n — mobile 375px : le tableau (12 colonnes,
                ~637px incompressibles) doit défiler DANS sa carte, pas pousser
                la page. Même motif que DataTable.tsx / tableau Opérations du
                10/08 : min-w explicite sur le <table> + conteneur
                overflow-x-auto (min-w-0 : aucun ancêtre flex/grid ici, la
                carte est en flux bloc direct sous <main>). */}
            <CardContent className="min-w-0 overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <SortHeader label="Espèce" field="especeId" />
                    <SortHeader label="Surface (m²)" field="surface" className="text-right" />
                    <SortHeader label="Production (kg)" field="production" className="text-right" />
                    <SortHeader label="Rdt (kg/m²)" field="rendement" className="text-right" />
                    <SortHeader label="Revenus" field="revenus" className="text-right" />
                    <SortHeader label="Coûts" field="coutTotal" className="text-right" />
                    <SortHeader label="Marge" field="margeBrute" className="text-right" />
                    <SortHeader label="Marge %" field="margePercent" className="text-right" />
                    <SortHeader label="Coût/kg" field="coutKg" className="text-right" />
                    <SortHeader label="Prix/kg" field="prixMoyenKg" className="text-right" />
                    <SortHeader label="Heures" field="heuresTravaillees" className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEspeces.map((espece) => (
                    <React.Fragment key={espece.especeId}>
                      <TableRow
                        className="cursor-pointer hover:bg-teal-50/50 transition-colors"
                        onClick={() => setExpandedEspece(expandedEspece === espece.especeId ? null : espece.especeId)}
                      >
                        <TableCell className="w-8">
                          {expandedEspece === espece.especeId ? (
                            <ChevronDown className="h-4 w-4 text-teal-600" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {espece.especeNom ?? espece.especeId}
                          <span className="text-xs text-muted-foreground ml-2">({espece.nbCultures})</span>
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(espece.surface)}</TableCell>
                        <TableCell className="text-right">{formatNumber(espece.production)}</TableCell>
                        <TableCell className="text-right">{formatNumber(espece.rendement, 2)}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">{formatEuro(espece.revenus)}</TableCell>
                        <TableCell className="text-right text-red-600">{formatEuro(espece.coutTotal)}</TableCell>
                        <TableCell className={`text-right font-medium ${espece.margeBrute >= 0 ? "text-emerald-600" : "text-orange-600"}`}>
                          {formatEuro(espece.margeBrute)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getMargeColorBg(espece.margePercent)}`}>
                            {formatNumber(espece.margePercent)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{formatEuro(espece.coutKg)}</TableCell>
                        <TableCell className="text-right">{formatEuro(espece.prixMoyenKg)}</TableCell>
                        <TableCell className="text-right">
                          <span className="flex items-center justify-end gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {formatNumber(espece.heuresTravaillees)}
                          </span>
                        </TableCell>
                      </TableRow>

                      {/* Expanded detail */}
                      {expandedEspece === espece.especeId && (
                        <TableRow>
                          <TableCell colSpan={12} className="bg-teal-50/30 p-0">
                            <div className="p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-teal-800">
                                  Detail des cultures - {espece.especeNom ?? espece.especeId}
                                </h3>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); setExpandedEspece(null) }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>

                              {/* Cost breakdown for this species */}
                              <div className="grid gap-3 md:grid-cols-4 mb-4">
                                <div className="bg-white rounded-lg p-3 border">
                                  <p className="text-xs text-muted-foreground">Semences</p>
                                  <p className="text-sm font-semibold text-green-600">{formatEuro(espece.coutSemences)}</p>
                                </div>
                                <div className="bg-white rounded-lg p-3 border">
                                  <p className="text-xs text-muted-foreground">Intrants</p>
                                  <p className="text-sm font-semibold text-blue-600">{formatEuro(espece.coutIntrants)}</p>
                                </div>
                                <div className="bg-white rounded-lg p-3 border">
                                  <p className="text-xs text-muted-foreground">Fertilisation</p>
                                  <p className="text-sm font-semibold text-amber-600">{formatEuro(espece.coutFertilisation)}</p>
                                </div>
                                <div className="bg-white rounded-lg p-3 border">
                                  <p className="text-xs text-muted-foreground">Main d&apos;oeuvre</p>
                                  <p className="text-sm font-semibold text-violet-600">{formatEuro(espece.coutMainOeuvre)}</p>
                                </div>
                              </div>

                              {/* Cultures table — même motif anti-débordement
                                  (cmsof7s3n) : min-w + conteneur overflow-x-auto */}
                              <div className="bg-white rounded-lg border min-w-0 overflow-x-auto">
                                <Table className="min-w-[720px]">
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Culture</TableHead>
                                      <TableHead>Variété</TableHead>
                                      <TableHead>Planche</TableHead>
                                      <TableHead className="text-right">Surface</TableHead>
                                      <TableHead className="text-right">Prod. (kg)</TableHead>
                                      <TableHead className="text-right">Revenus</TableHead>
                                      <TableHead className="text-right">Coûts</TableHead>
                                      <TableHead className="text-right">Marge</TableHead>
                                      <TableHead className="text-right">Marge %</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {expandedCultures.map((culture) => (
                                      <TableRow key={culture.cultureId}>
                                        <TableCell className="text-sm">#{culture.cultureId}</TableCell>
                                        <TableCell className="text-sm">{culture.variete || "-"}</TableCell>
                                        <TableCell className="text-sm">{culture.plancheNom || "-"}</TableCell>
                                        <TableCell className="text-right text-sm">{formatNumber(culture.surface)} m²</TableCell>
                                        <TableCell className="text-right text-sm">{formatNumber(culture.production)}</TableCell>
                                        <TableCell className="text-right text-sm text-green-600">{formatEuro(culture.revenus)}</TableCell>
                                        <TableCell className="text-right text-sm text-red-600">{formatEuro(culture.coutTotal)}</TableCell>
                                        <TableCell className={`text-right text-sm font-medium ${culture.margeBrute >= 0 ? "text-emerald-600" : "text-orange-600"}`}>
                                          {formatEuro(culture.margeBrute)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getMargeColorBg(culture.margePercent)}`}>
                                            {formatNumber(culture.margePercent)}%
                                          </span>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                    {expandedCultures.length === 0 && (
                                      <TableRow>
                                        <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-4">
                                          Aucune culture trouvée
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}

                  {/* QA cmsno0ixf / cmsnogwaz — la ligne TOTAL reprend les KPI
                      ferme (SSOT), pas la somme des lignes espèces. On rend la
                      pyramide vérifiable : Σ espèces + non affecté = TOTAL. */}
                  {data?.totauxEspeces && (
                    <TableRow className="border-t-2 font-semibold bg-slate-50/60">
                      <TableCell />
                      <TableCell>
                        Sous-total espèces
                        <span className="text-xs text-muted-foreground ml-2 font-normal">({data.totauxEspeces.nbCultures} cultures)</span>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(data.totauxEspeces.surface)}</TableCell>
                      <TableCell className="text-right">{formatNumber(data.totauxEspeces.production)}</TableCell>
                      <TableCell className="text-right">
                        {data.totauxEspeces.surface > 0 ? formatNumber(data.totauxEspeces.production / data.totauxEspeces.surface, 2) : "-"}
                      </TableCell>
                      <TableCell className="text-right text-green-600">{formatEuro(data.totauxEspeces.revenus)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatEuro(data.totauxEspeces.coutTotal)}</TableCell>
                      <TableCell className={`text-right ${data.totauxEspeces.margeBrute >= 0 ? "text-emerald-600" : "text-orange-600"}`}>
                        {formatEuro(data.totauxEspeces.margeBrute)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getMargeColorBg(data.totauxEspeces.margePercent)}`}>
                          {formatNumber(data.totauxEspeces.margePercent)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {formatNumber(data.totauxEspeces.heuresTravaillees)}
                        </span>
                      </TableCell>
                    </TableRow>
                  )}
                  {data?.totauxEspeces && data?.totaux && (
                    <TableRow className="text-muted-foreground bg-slate-50/60">
                      <TableCell />
                      <TableCell>
                        Non affecté aux espèces
                        <span className="block text-xs font-normal">
                          autres modules, ventes non rattachées, charges générales
                        </span>
                      </TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(Math.round((data.totaux.production - data.totauxEspeces.production) * 100) / 100)}
                      </TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">
                        {formatEuro(Math.round((data.totaux.revenus - data.totauxEspeces.revenus) * 100) / 100)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatEuro(Math.round((data.totaux.coutTotal - data.totauxEspeces.coutTotal) * 100) / 100)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatEuro(Math.round((data.totaux.margeBrute - data.totauxEspeces.margeBrute) * 100) / 100)}
                      </TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {formatNumber(Math.round((data.totaux.heuresTravaillees - data.totauxEspeces.heuresTravaillees) * 10) / 10)}
                        </span>
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Totals row — KPI ferme entière (SSOT), tous modules */}
                  {data?.totaux && (
                    <TableRow className="border-t-2 font-bold bg-slate-50">
                      <TableCell />
                      <TableCell>
                        TOTAL ferme
                        {/* TICKET cmsoez28o — l'ancien libellé (« aligné sur le
                            dashboard Comptabilité ») était faux pour les coûts :
                            seuls les REVENUS reprennent la SSOT du dashboard,
                            les coûts restent analytiques (saisis dans les
                            modules, hors dépenses générales non ventilées). */}
                        <span className="block text-xs font-normal text-muted-foreground">
                          tous modules — revenus alignés sur le dashboard Comptabilité ;
                          coûts = coûts analytiques saisis dans les modules
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(data.totaux.surface)}</TableCell>
                      <TableCell className="text-right">{formatNumber(data.totaux.production)}</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right text-green-600">{formatEuro(data.totaux.revenus)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatEuro(data.totaux.coutTotal)}</TableCell>
                      <TableCell className={`text-right ${data.totaux.margeBrute >= 0 ? "text-emerald-600" : "text-orange-600"}`}>
                        {formatEuro(data.totaux.margeBrute)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getMargeColorBg(data.totaux.margePercent)}`}>
                          {formatNumber(data.totaux.margePercent)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {formatNumber(data.totaux.heuresTravaillees)}
                        </span>
                      </TableCell>
                    </TableRow>
                  )}

                  {/* TICKET cmsoez28o — écart explicite entre les coûts
                      analytiques ci-dessus et les dépenses comptables du
                      dashboard (SSOT), au lieu d'un « aligné » mensonger. */}
                  {data?.totaux && typeof data.totaux.depensesComptables === "number" && (
                    <TableRow className="bg-slate-50">
                      <TableCell />
                      <TableCell colSpan={11} className="py-2 text-xs font-normal text-muted-foreground">
                        Dépenses comptables du dashboard : {formatEuro(data.totaux.depensesComptables)}{" "}
                        (écart {formatEuro(Math.round((data.totaux.depensesComptables - data.totaux.coutTotal) * 100) / 100)}{" "}
                        = dépenses générales non ventilées − valorisations analytiques)
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : !loading ? (
          <Card className="mb-8">
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-muted-foreground">
                Aucune donnée de production pour {selectedYear}.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Enregistrez des cultures et des récoltes pour voir l&apos;analyse des coûts.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Charts */}
        {data?.parEspece && data.parEspece.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-2 mb-8">
            {/* Bar chart: Top 10 by margin */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-teal-600" />
                  Top espèces par marge brute
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topMarginData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={topMarginData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}\u00A0\u20AC`} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
                      <Tooltip
                        formatter={(value) => [formatEuro(Number(value || 0)), ""]}
                        contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                      />
                      <Legend />
                      <Bar dataKey="revenus" name="Revenus" fill="#22c55e" radius={[0, 2, 2, 0]} />
                      <Bar dataKey="couts" name="Coûts" fill="#ef4444" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                    Aucune donnée
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pie chart: Cost breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Répartition des coûts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {costBreakdownData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={costBreakdownData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {costBreakdownData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [formatEuro(Number(value || 0)), ""]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                    Aucun coût enregistré
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bar chart: Cost/kg vs Price/kg */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                  Coût/kg vs Prix de vente/kg par espèce
                </CardTitle>
                <CardDescription>
                  Compare le coût de production au prix de vente moyen par kilogramme
                </CardDescription>
              </CardHeader>
              <CardContent>
                {profitabilityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={profitabilityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}\u00A0\u20AC`} />
                      <Tooltip
                        formatter={(value, name) => [
                          formatEuro(Number(value || 0)),
                          name === "coutKg" ? "Coût/kg" : name === "prixKg" ? "Prix/kg" : "Marge/kg",
                        ]}
                        contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                      />
                      <Legend
                        formatter={(value: string) =>
                          value === "coutKg" ? "Coût/kg" : value === "prixKg" ? "Prix/kg" : "Marge/kg"
                        }
                      />
                      <Bar dataKey="coutKg" name="coutKg" fill="#ef4444" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="prixKg" name="prixKg" fill="#22c55e" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                    Aucune donnée de production avec coût
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
