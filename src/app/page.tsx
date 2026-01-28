"use client"

import * as React from "react"
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Leaf,
  Sprout,
  Calendar,
  BarChart3,
  Settings,
  ArrowRight,
  LayoutGrid
} from "lucide-react";

const modules = [
  {
    title: "Cultures",
    description: "Gérer vos cultures, semis et plantations",
    href: "/cultures",
    icon: Sprout,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    title: "Espèces",
    description: "Référentiel des plantes cultivables",
    href: "/especes",
    icon: Leaf,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
  {
    title: "Planches",
    description: "Gestion des parcelles et rotations",
    href: "/planches",
    icon: Calendar,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    title: "Récoltes",
    description: "Suivi de la production",
    href: "/recoltes",
    icon: BarChart3,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
];

interface DashboardStats {
  culturesActives: number
  especesCount: number
  planchesCount: number
  recoltesTotal: number
  recoltesMois: number
}

export default function Home() {
  const [stats, setStats] = React.useState<DashboardStats | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function fetchStats() {
      try {
        const [culturesRes, especesRes, planchesRes, recoltesRes] = await Promise.all([
          fetch("/api/cultures?pageSize=1"),
          fetch("/api/especes?pageSize=1"),
          fetch("/api/planches?pageSize=1"),
          fetch("/api/recoltes?pageSize=1"),
        ])

        const [cultures, especes, planches, recoltes] = await Promise.all([
          culturesRes.json(),
          especesRes.json(),
          planchesRes.json(),
          recoltesRes.json(),
        ])

        setStats({
          culturesActives: cultures.total || 0,
          especesCount: especes.total || 0,
          planchesCount: planches.total || 0,
          recoltesTotal: recoltes.stats?.totalQuantite || 0,
          recoltesMois: recoltes.stats?.count || 0,
        })
      } catch (error) {
        console.error("Erreur chargement stats:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="h-8 w-8 text-green-600" />
            <h1 className="text-2xl font-bold text-green-800">Potaléger</h1>
          </div>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Paramètres
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Gérez votre potager efficacement
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Planifiez vos cultures, suivez vos récoltes et optimisez vos rotations
            avec une application moderne et intuitive.
          </p>
        </div>

        {/* Modules Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
          {modules.map((module) => (
            <Link key={module.href} href={module.href}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg ${module.bgColor} flex items-center justify-center mb-2`}>
                    <module.icon className={`h-6 w-6 ${module.color}`} />
                  </div>
                  <CardTitle className="flex items-center justify-between">
                    {module.title}
                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        {/* Tableau de bord */}
        <div className="mt-16 max-w-6xl mx-auto">
          <h3 className="text-2xl font-semibold text-gray-800 mb-6">
            Tableau de bord
          </h3>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Cultures</CardDescription>
                <CardTitle className="text-3xl text-green-600">
                  {loading ? "..." : stats?.culturesActives || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  cultures enregistrées
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Espèces</CardDescription>
                <CardTitle className="text-3xl text-emerald-600">
                  {loading ? "..." : stats?.especesCount || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  variétés disponibles
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Planches</CardDescription>
                <CardTitle className="text-3xl text-amber-600">
                  {loading ? "..." : stats?.planchesCount || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  parcelles configurées
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Récoltes</CardDescription>
                <CardTitle className="text-3xl text-blue-600">
                  {loading ? "..." : `${stats?.recoltesTotal.toFixed(1) || 0} kg`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {stats?.recoltesMois || 0} récoltes enregistrées
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-8 text-center text-sm text-gray-500">
        <p>Potaléger v0.1.0 - Migration React de l&apos;application Qt</p>
      </footer>
    </div>
  );
}
