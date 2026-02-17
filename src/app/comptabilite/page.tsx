"use client"

/**
 * Dashboard Comptabilité
 * Vue financière agrégée de tous les modules
 */

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
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
  AreaChart,
  Area,
} from "recharts"
import {
  Sprout,
  TreeDeciduous,
  Bird,
  Settings,
  ArrowRight,
  Calendar,
  TrendingUp,
  TrendingDown,
  Wallet,
  Package,
  Receipt,
  ShoppingCart,
  AlertCircle,
  Download,
  FileText,
  Euro,
  AlertTriangle,
  Users,
  Truck,
  Percent,
} from "lucide-react"
import { AssistantDialog, AssistantButton } from "@/components/assistant"

// Modules du dashboard comptabilité (rationalisé)
const modulesCompta = [
  {
    title: "Transactions",
    description: "Revenus, dépenses, saisie",
    href: "/comptabilite/transactions",
    icon: Receipt,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    title: "Factures",
    description: "Génération, avoirs, impayées",
    href: "/comptabilite/factures",
    icon: FileText,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    title: "Clients",
    description: "Gestion des clients",
    href: "/comptabilite/clients",
    icon: Users,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
  {
    title: "Fournisseurs",
    description: "Gestion des fournisseurs",
    href: "/comptabilite/fournisseurs",
    icon: Truck,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
  },
  {
    title: "Stocks",
    description: "Vue globale des stocks",
    href: "/comptabilite/stocks",
    icon: Package,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
  },
  {
    title: "Rapports & TVA",
    description: "Bilan, TVA, export",
    href: "/comptabilite/rapports",
    icon: Download,
    color: "text-slate-600",
    bgColor: "bg-slate-50",
  },
]

interface ComptaStats {
  stats: {
    revenus: number
    depenses: number
    benefice: number
    margePercent: number
    revenusParModule: { potager: number; verger: number; elevage: number; autre: number }
    depensesParModule: { potager: number; verger: number; elevage: number; autre: number }
    revenusAnneePrecedente: number
    facturesImpayees: number
    facturesImpayeesTotal: number
    stocksBas: number
  }
  charts: {
    mensuel: { mois: string; revenus: number; depenses: number; benefice: number }[]
    revenusParCategorie: { categorie: string; montant: number; couleur: string }[]
    depensesParCategorie: { categorie: string; montant: number; couleur: string }[]
    parModule: { module: string; revenus: number; depenses: number; benefice: number }[]
  }
  activity: {
    dernieresTransactions: {
      id: number
      type: "revenu" | "depense"
      date: string
      description: string
      montant: number
      module: string
      paye: boolean
    }[]
    facturesImpayees: {
      id: number
      type: string
      date: string
      client: string
      montant: number
    }[]
    alertesStock: {
      id: string
      nom: string
      stock: number
      stockMin: number
      module: string
    }[]
  }
  meta: {
    year: number
    generatedAt: string
  }
}

export default function DashboardComptabilite() {
  const { data: session } = useSession()
  const [showAssistant, setShowAssistant] = React.useState(false)
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear())
  const [data, setData] = React.useState<ComptaStats | null>(null)
  const [loading, setLoading] = React.useState(true)

  // Années disponibles
  const currentYear = new Date().getFullYear()
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i)

  // Charger les données
  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/comptabilite/stats?year=${selectedYear}`)
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch (err) {
        console.error("Erreur chargement stats compta:", err)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchData()
    }
  }, [selectedYear, session?.user])

  // Calcul différence année précédente
  const yearDiff = React.useMemo(() => {
    if (!data?.stats) return { diff: 0, percent: "0" }
    const current = data.stats.revenus
    const previous = data.stats.revenusAnneePrecedente
    const diff = current - previous
    const percent = previous > 0 ? Math.round((diff / previous) * 100) : 0
    return { diff, percent: percent.toString() }
  }, [data?.stats])

  const formatEuro = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-gray-50">
      {/* Assistant */}
      <AssistantDialog open={showAssistant} onOpenChange={setShowAssistant} />

      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between max-w-[1600px]">
          <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
            <Image
              src="/gleba.png"
              alt="Gleba"
              width={150}
              height={100}
              className="rounded-lg"
              priority
            />
          </Link>
          <div className="flex items-center gap-2">
            {/* Boutons Potager / Verger / Élevage / Compta */}
            <div className="flex items-center border rounded-lg overflow-hidden">
              <Link href="/">
                <Button variant="ghost" size="sm" className="rounded-none text-green-700 hover:text-green-800 hover:bg-green-50 border-r">
                  <Sprout className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Potager</span>
                </Button>
              </Link>
              <Link href="/arbres">
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
              <Button variant="ghost" size="sm" className="rounded-none bg-blue-50 text-blue-700">
                <Wallet className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Compta</span>
              </Button>
            </div>
            <AssistantButton onClick={() => setShowAssistant(true)} />
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
        {/* Titre + Sélecteur d'année */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Euro className="h-5 w-5 text-blue-700" />
            </div>
            <h1 className="text-xl font-semibold text-gray-800">Gestion Comptable</h1>
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

        {/* Stats Cards */}
        <div className="grid gap-4 lg:grid-cols-4 mb-6">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <Card key={i} className="bg-gradient-to-br from-gray-100 to-gray-200">
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))
          ) : data?.stats ? (
            <>
              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-green-100 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Revenus {selectedYear}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{formatEuro(data.stats.revenus)}</p>
                  {parseInt(yearDiff.percent) !== 0 && (
                    <p className="text-sm text-green-100 mt-1">
                      {parseInt(yearDiff.percent) > 0 ? "+" : ""}{yearDiff.percent}% vs {selectedYear - 1}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-red-100 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    Dépenses {selectedYear}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{formatEuro(data.stats.depenses)}</p>
                </CardContent>
              </Card>

              <Card className={`bg-gradient-to-br ${data.stats.benefice >= 0 ? 'from-purple-500 to-purple-600' : 'from-orange-500 to-orange-600'} text-white`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-white/80 flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    {data.stats.benefice >= 0 ? 'Bénéfice' : 'Perte'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{formatEuro(Math.abs(data.stats.benefice))}</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-slate-500 to-slate-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-100 flex items-center gap-2">
                    Marge
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{data.stats.margePercent}%</p>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        {/* Alertes */}
        {data?.stats && (data.stats.facturesImpayees > 0 || data.stats.stocksBas > 0) && (
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            {data.stats.facturesImpayees > 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-amber-700 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Factures impayées
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-amber-800">
                    {data.stats.facturesImpayees} facture(s) en attente ({formatEuro(data.stats.facturesImpayeesTotal)})
                  </p>
                </CardContent>
              </Card>
            )}
            {data.stats.stocksBas > 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-orange-700 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Stocks bas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-orange-800">{data.stats.stocksBas} article(s) en dessous du seuil minimum</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Modules Grid */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-8">
          {modulesCompta.map((module) => (
            <Link key={module.href} href={module.href}>
              <Card className="h-full hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer group">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className={`w-10 h-10 rounded-lg ${module.bgColor} flex items-center justify-center`}>
                      <module.icon className={`h-5 w-5 ${module.color}`} />
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <CardTitle className="text-base">{module.title}</CardTitle>
                  <CardDescription className="text-xs">{module.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        {/* Charts */}
        {data?.charts && (
          <div className="grid gap-6 lg:grid-cols-2 mb-8">
            {/* P&L Mensuel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Résultat mensuel</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.charts.mensuel}>
                    <defs>
                      <linearGradient id="colorRevenus" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="colorDepenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}€`} />
                    <Tooltip
                      formatter={(value) => [formatEuro(Number(value || 0)), '']}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                    />
                    <Area type="monotone" dataKey="revenus" name="Revenus" stroke="#22c55e" fill="url(#colorRevenus)" />
                    <Area type="monotone" dataKey="depenses" name="Dépenses" stroke="#ef4444" fill="url(#colorDepenses)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Revenus par catégorie */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenus par catégorie</CardTitle>
              </CardHeader>
              <CardContent>
                {data.charts.revenusParCategorie.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.charts.revenusParCategorie}
                        dataKey="montant"
                        nameKey="categorie"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {data.charts.revenusParCategorie.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.couleur} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [formatEuro(Number(value || 0)), '']} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Aucun revenu enregistré
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dépenses par catégorie */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dépenses par catégorie</CardTitle>
              </CardHeader>
              <CardContent>
                {data.charts.depensesParCategorie.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.charts.depensesParCategorie}
                        dataKey="montant"
                        nameKey="categorie"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {data.charts.depensesParCategorie.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.couleur} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [formatEuro(Number(value || 0)), '']} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Aucune dépense enregistrée
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Comparaison par module */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Résultat par module</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.charts.parModule} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}€`} />
                    <YAxis dataKey="module" type="category" tick={{ fontSize: 12 }} width={70} />
                    <Tooltip formatter={(value) => [formatEuro(Number(value || 0)), '']} />
                    <Bar dataKey="revenus" name="Revenus" fill="#22c55e" />
                    <Bar dataKey="depenses" name="Dépenses" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
