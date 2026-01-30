"use client"

/**
 * Dashboard Planification
 * Vue d'ensemble de la planification des cultures
 */

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Calendar,
  Sprout,
  LayoutGrid,
  Map,
  BarChart3,
  CalendarRange,
  Users,
  FileStack,
  Leaf,
  Package,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

interface Stats {
  totalCultures: number
  culturesExistantes: number
  culturesACreer: number
  surfaceTotale: number
  recoltesTotales: number
  nbEspeces: number
  annee: number
}

const menuItems = [
  {
    title: "Cultures prevues par espece",
    description: "Liste des cultures prevues groupees par espece",
    href: "/planification/cultures-prevues",
    icon: Leaf,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    title: "Cultures prevues par ilots",
    description: "Liste des cultures prevues groupees par ilot",
    href: "/planification/cultures-prevues/par-ilots",
    icon: Map,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    title: "Cultures prevues par planches",
    description: "Liste des cultures prevues groupees par planche",
    href: "/planification/cultures-prevues/par-planches",
    icon: LayoutGrid,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    title: "Recoltes prevues par mois",
    description: "Prevision des recoltes mois par mois",
    href: "/planification/recoltes-prevues",
    icon: BarChart3,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    title: "Recoltes prevues par semaines",
    description: "Prevision des recoltes semaine par semaine",
    href: "/planification/recoltes-prevues/par-semaines",
    icon: CalendarRange,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
  },
  {
    title: "Associations de cultures",
    description: "Voir les cultures voisines sur les planches",
    href: "/planification/associations",
    icon: Users,
    color: "text-pink-600",
    bgColor: "bg-pink-50",
  },
  {
    title: "Creer les cultures",
    description: "Creer les cultures a partir du plan de rotation",
    href: "/planification/creer-cultures",
    icon: FileStack,
    color: "text-teal-600",
    bgColor: "bg-teal-50",
  },
  {
    title: "Semences necessaires",
    description: "Calcul des besoins en semences",
    href: "/planification/semences",
    icon: Sprout,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  {
    title: "Plants necessaires",
    description: "Calcul des besoins en plants",
    href: "/planification/plants",
    icon: Package,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
  },
]

export default function PlanificationPage() {
  const { toast } = useToast()
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [annee, setAnnee] = React.useState(new Date().getFullYear())

  // Generer les annees disponibles (5 ans avant et apres)
  const annees = React.useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)
  }, [])

  // Charger les statistiques
  const fetchStats = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/planification/stats?annee=${annee}`)
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const data = await response.json()
      setStats(data)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les statistiques",
      })
    } finally {
      setIsLoading(false)
    }
  }, [annee, toast])

  React.useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Accueil
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-emerald-600" />
              <h1 className="text-xl font-bold">Planification</h1>
            </div>
          </div>

          {/* Selecteur d'annee */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Annee:</span>
            <Select
              value={annee.toString()}
              onValueChange={(value) => setAnnee(parseInt(value))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {annees.map((a) => (
                  <SelectItem key={a} value={a.toString()}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-green-100">Cultures prevues</CardDescription>
              <CardTitle className="text-4xl">
                {isLoading ? <Skeleton className="h-10 w-16 bg-green-400" /> : stats?.totalCultures || 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-green-100">
                {stats?.culturesACreer || 0} a creer
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-amber-100">Surface totale</CardDescription>
              <CardTitle className="text-4xl">
                {isLoading ? <Skeleton className="h-10 w-20 bg-amber-400" /> : `${stats?.surfaceTotale || 0} m2`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-amber-100">
                Planifiee pour {annee}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-blue-100">Recoltes prevues</CardDescription>
              <CardTitle className="text-4xl">
                {isLoading ? <Skeleton className="h-10 w-20 bg-blue-400" /> : `${stats?.recoltesTotales || 0} kg`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-blue-100">
                Estimation annuelle
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-purple-100">Especes</CardDescription>
              <CardTitle className="text-4xl">
                {isLoading ? <Skeleton className="h-10 w-12 bg-purple-400" /> : stats?.nbEspeces || 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-purple-100">
                Varietes planifiees
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Menu Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {menuItems.map((item) => (
            <Link key={item.href} href={`${item.href}?annee=${annee}`}>
              <Card className="h-full hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer group">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg ${item.bgColor} flex items-center justify-center mb-2`}>
                    <item.icon className={`h-6 w-6 ${item.color}`} />
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        {/* Liens rapides */}
        <div className="mt-8 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
          <h3 className="font-medium text-emerald-800 mb-2">Liens rapides</h3>
          <div className="flex flex-wrap gap-2">
            <Link href="/itps">
              <Button variant="outline" size="sm">
                Gerer les ITPs
              </Button>
            </Link>
            <Link href="/rotations">
              <Button variant="outline" size="sm">
                Gerer les rotations
              </Button>
            </Link>
            <Link href="/planches">
              <Button variant="outline" size="sm">
                Gerer les planches
              </Button>
            </Link>
            <Link href="/cultures">
              <Button variant="outline" size="sm">
                Voir les cultures
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
