"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserMenu } from "@/components/auth/UserMenu"
import { WelcomeDialog } from "@/components/onboarding/WelcomeDialog"
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
  Leaf,
  Sprout,
  LayoutGrid,
  BarChart3,
  Settings,
  ArrowRight,
  Map as MapIcon,
  TreeDeciduous,
  TrendingUp,
  TrendingDown,
  Calendar,
  Droplets,
  Heart,
  Package,
  ClipboardCheck,
} from "lucide-react"
import { AssistantDialog, AssistantButton } from "@/components/assistant"
import { CalendarView } from "@/components/dashboard/CalendarView"

const modules = [
  {
    title: "Taches",
    description: "Actions du jour et de la semaine",
    href: "/taches",
    icon: ClipboardCheck,
    color: "text-red-600",
    bgColor: "bg-red-50",
  },
  {
    title: "Plan du jardin",
    description: "Visualiser et organiser vos planches",
    href: "/jardin",
    icon: MapIcon,
    color: "text-teal-600",
    bgColor: "bg-teal-50",
  },
  {
    title: "Planification",
    description: "Planifier les cultures et recoltes",
    href: "/planification",
    icon: Calendar,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    title: "Cultures",
    description: "Gerer vos cultures, semis et plantations",
    href: "/cultures",
    icon: Sprout,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    title: "Especes",
    description: "Referentiel des plantes cultivables",
    href: "/especes",
    icon: Leaf,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
  {
    title: "Planches",
    description: "Gestion des parcelles et rotations",
    href: "/planches",
    icon: LayoutGrid,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    title: "Recoltes",
    description: "Suivi de la production",
    href: "/recoltes",
    icon: BarChart3,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    title: "ITPs",
    description: "Itineraires techniques des plantes",
    href: "/itps",
    icon: Sprout,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
  },
  {
    title: "Rotations",
    description: "Plans de rotation des cultures",
    href: "/rotations",
    icon: BarChart3,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  {
    title: "Associations",
    description: "Compagnonnage des plantes",
    href: "/associations",
    icon: Heart,
    color: "text-pink-600",
    bgColor: "bg-pink-50",
  },
  {
    title: "Stocks",
    description: "Semences, plants, fertilisants",
    href: "/stocks",
    icon: Package,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
  },
  {
    title: "Irrigation",
    description: "Cultures a irriguer",
    href: "/cultures/irriguer",
    icon: Droplets,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
  },
]

interface DashboardData {
  stats: {
    culturesTotal: number
    culturesActives: number
    planches: number
    surfaceTotale: number
    especes: number
    arbres: number
    recoltesAnnee: number
    recoltesCount: number
    recoltesAnneePrecedente: number
  }
  charts: {
    monthlyHarvest: { mois: string; quantite: number }[]
    harvestBySpecies: { espece: string; quantite: number; couleur: string }[]
    culturesByFamily: { famille: string; count: number; couleur: string }[]
    yieldByPlanche: { planche: string; totalKg: number; surface: number; rendement: number }[]
  }
  activity: {
    culturesStatus: { enCours: number; terminees: number; total: number }
    upcomingTasks: {
      id: number
      especeId: string
      plancheId: string | null
      dateSemis: string | null
      datePlantation: string | null
      semisFait: boolean
      plantationFaite: boolean
    }[]
  }
  meta: {
    year: number
    generatedAt: string
  }
}

// Générer la liste des années disponibles (5 ans en arrière + année courante)
const currentYearNow = new Date().getFullYear()
const availableYears = Array.from({ length: 6 }, (_, i) => currentYearNow - 5 + i).reverse()

export default function Home() {
  const { data: session } = useSession()
  const [data, setData] = React.useState<DashboardData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [showWelcome, setShowWelcome] = React.useState(false)
  const [selectedYear, setSelectedYear] = React.useState(currentYearNow)
  const [showAssistant, setShowAssistant] = React.useState(false)

  // Vérifier si l'utilisateur est nouveau (pas de données)
  React.useEffect(() => {
    async function checkNewUser() {
      // Ne pas afficher si déjà vu
      if (localStorage.getItem("gleba-onboarding-complete")) {
        return
      }

      try {
        const response = await fetch("/api/import-test-data")
        if (response.ok) {
          const result = await response.json()
          if (result.canImport) {
            setShowWelcome(true)
          }
        }
      } catch (error) {
        console.error("Erreur vérification nouvel utilisateur:", error)
      }
    }

    if (session?.user) {
      checkNewUser()
    }
  }, [session])

  const handleOnboardingComplete = React.useCallback(() => {
    localStorage.setItem("gleba-onboarding-complete", "true")
    // Recharger les données du dashboard
    window.location.reload()
  }, [])

  React.useEffect(() => {
    async function fetchDashboard() {
      setLoading(true)
      try {
        const response = await fetch(`/api/dashboard?year=${selectedYear}`)
        if (response.ok) {
          const json = await response.json()
          setData(json)
        }
      } catch (error) {
        console.error("Erreur chargement dashboard:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [selectedYear])

  // Memoization des calculs de stats pour éviter recalculs inutiles
  const { progressPercent, yearDiff, yearDiffPercent } = React.useMemo(() => {
    const progress = data?.stats
      ? Math.round((data.activity.culturesStatus.terminees / Math.max(data.activity.culturesStatus.total, 1)) * 100)
      : 0

    const diff = data?.stats
      ? data.stats.recoltesAnnee - data.stats.recoltesAnneePrecedente
      : 0

    const diffPercent = data?.stats?.recoltesAnneePrecedente
      ? Math.round((diff / data.stats.recoltesAnneePrecedente) * 100)
      : 0

    return {
      progressPercent: progress,
      yearDiff: diff,
      yearDiffPercent: diffPercent,
    }
  }, [data?.stats, data?.activity.culturesStatus])

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Dialog de bienvenue pour les nouveaux utilisateurs */}
      <WelcomeDialog
        open={showWelcome}
        onOpenChange={setShowWelcome}
        onComplete={handleOnboardingComplete}
      />

      {/* Assistant Maraîcher */}
      <AssistantDialog open={showAssistant} onOpenChange={setShowAssistant} />

      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
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

      <main className="container mx-auto px-4 py-8">
        {/* Sélecteur d'année */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-700">Tableau de bord</h2>
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

        {/* Modules Grid */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          {modules.map((module) => (
            <Link key={module.href} href={module.href}>
              <Card className="h-full hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer group">
                <CardHeader className="pb-2">
                  <div className={`w-10 h-10 rounded-lg ${module.bgColor} flex items-center justify-center mb-1`}>
                    <module.icon className={`h-5 w-5 ${module.color}`} />
                  </div>
                  <CardTitle className="text-sm flex items-center justify-between">
                    {module.title}
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-green-100">Cultures actives</CardDescription>
              <CardTitle className="text-4xl">
                {loading ? "..." : data?.stats.culturesActives || 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-green-100">
                sur {data?.stats.culturesTotal || 0} total
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-amber-100">Surface cultivée</CardDescription>
              <CardTitle className="text-4xl">
                {loading ? "..." : `${data?.stats.surfaceTotale || 0} m²`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-amber-100">
                {data?.stats.planches || 0} planches
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-blue-100">Récoltes {data?.meta.year}</CardDescription>
              <CardTitle className="text-4xl">
                {loading ? "..." : `${data?.stats.recoltesAnnee || 0} kg`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1 text-sm">
                {yearDiff >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-200" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-200" />
                )}
                <span className={yearDiff >= 0 ? "text-green-200" : "text-red-200"}>
                  {yearDiff >= 0 ? "+" : ""}{yearDiffPercent}% vs {(data?.meta.year || 2024) - 1}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-purple-100">Arbres & arbustes</CardDescription>
              <CardTitle className="text-4xl">
                {loading ? "..." : data?.stats.arbres || 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1">
                <TreeDeciduous className="h-4 w-4 text-purple-200" />
                <span className="text-sm text-purple-100">
                  {data?.stats.especes || 0} espèces disponibles
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid gap-6 lg:grid-cols-2 mb-6">
          {/* Récoltes mensuelles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Récoltes mensuelles
              </CardTitle>
              <CardDescription>
                Production en kg par mois ({data?.meta.year})
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Chargement...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data?.charts.monthlyHarvest || []}>
                    <defs>
                      <linearGradient id="colorQty" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} unit=" kg" />
                    <Tooltip
                      formatter={(value) => [`${Number(value).toFixed(1)} kg`, "Récolte"]}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="quantite"
                      stroke="#22c55e"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorQty)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Récoltes par espèce */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Leaf className="h-5 w-5 text-green-600" />
                Top 10 des récoltes
              </CardTitle>
              <CardDescription>
                Quantité récoltée par espèce (kg)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Chargement...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={data?.charts.harvestBySpecies || []}
                    layout="vertical"
                    margin={{ left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 12 }} unit=" kg" />
                    <YAxis dataKey="espece" type="category" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip
                      formatter={(value) => [`${Number(value).toFixed(1)} kg`, "Récolte"]}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                    />
                    <Bar dataKey="quantite" radius={[0, 4, 4, 0]}>
                      {(data?.charts.harvestBySpecies || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.couleur} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-6 lg:grid-cols-3 mb-6">
          {/* Cultures par famille */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sprout className="h-5 w-5 text-emerald-600" />
                Cultures par famille
              </CardTitle>
              <CardDescription>
                Répartition des cultures {data?.meta.year}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Chargement...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={data?.charts.culturesByFamily || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="famille"
                      label={({ name, percent }) =>
                        `${name} (${((percent || 0) * 100).toFixed(0)}%)`
                      }
                      labelLine={false}
                    >
                      {(data?.charts.culturesByFamily || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.couleur} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [value, name]}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Rendement par planche */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-amber-600" />
                Rendement par planche
              </CardTitle>
              <CardDescription>
                kg/m² par parcelle
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Chargement...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data?.charts.yieldByPlanche || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="planche" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value, name) => [
                        name === "rendement" ? `${Number(value).toFixed(1)} kg/m²` : `${Number(value).toFixed(1)} kg`,
                        name === "rendement" ? "Rendement" : "Total",
                      ]}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                    />
                    <Bar dataKey="rendement" fill="#f59e0b" radius={[4, 4, 0, 0]} name="rendement" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* État des cultures */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Avancement {data?.meta.year}
              </CardTitle>
              <CardDescription>
                Progression des cultures
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Progress circle */}
                <div className="flex items-center justify-center">
                  <div className="relative w-32 h-32">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="#e5e7eb"
                        strokeWidth="12"
                        fill="none"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="#22c55e"
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${progressPercent * 3.52} 352`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold">{progressPercent}%</span>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {data?.activity.culturesStatus.terminees || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Terminées</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-600">
                      {data?.activity.culturesStatus.enCours || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">En cours</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calendrier des cultures */}
        <div className="mb-6">
          <CalendarView year={selectedYear} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-8 py-6 text-center text-sm text-gray-500">
        <p>
          Gleba v0.1.0 - Basé sur{" "}
          <a
            href="https://github.com/marcpley/potaleger"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 hover:underline"
          >
            Potaléger Qt par marcpley
          </a>
        </p>
      </footer>
    </div>
  )
}
