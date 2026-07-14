/**
 * Dashboard Admin
 */

import { requireAdmin } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Users, UserPlus, Shield, Activity, Database, MessageSquare, Bug, TrendingUp, Flag } from "lucide-react"
import { AdminTabs } from "@/components/admin/AdminTabs"

export default async function AdminPage() {
  await requireAdmin()

  // Stats
  const [totalUsers, activeUsers, adminCount, openBugsCount] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { active: true } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.bugReport.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
  ])

  // Derniers utilisateurs crees
  const recentUsers = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      createdAt: true,
    },
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-amber-600" />
            <h1 className="text-2xl font-bold text-amber-800">Administration</h1>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm">
              Retour au jardin
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Utilisateurs</CardDescription>
              <CardTitle className="text-3xl text-amber-600">{totalUsers}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {activeUsers} actifs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Administrateurs</CardDescription>
              <CardTitle className="text-3xl text-amber-600">{adminCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Comptes avec droits admin
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Statut</CardDescription>
              <CardTitle className="text-3xl text-green-600">Actif</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Systeme operationnel
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Actions rapides */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gestion des utilisateurs
              </CardTitle>
              <CardDescription>
                Gerer les comptes utilisateurs
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Link href="/admin/users">
                <Button variant="outline">
                  <Users className="mr-2 h-4 w-4" />
                  Voir tous
                </Button>
              </Link>
              <Link href="/admin/users/new">
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Nouveau
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-green-600" />
                Référentiels globaux
              </CardTitle>
              <CardDescription>
                Gérer les espèces, ITPs, variétés (partagés entre tous)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/referentiels">
                <Button variant="outline" className="w-full">
                  <Database className="mr-2 h-4 w-4" />
                  Import / Export référentiels
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-amber-600" />
                Feedback utilisateurs
              </CardTitle>
              <CardDescription>
                Voir les retours et relancer les non-répondants
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/feedback">
                <Button variant="outline" className="w-full">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Tableau de bord feedback
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5 text-red-600" />
                Bugs & retours
                {openBugsCount > 0 && (
                  <span className="ml-auto text-sm font-semibold px-2 py-0.5 rounded-md bg-red-50 text-red-700 ring-1 ring-red-200">
                    {openBugsCount}
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Bugs / évolutions remontés depuis le widget
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/bugs">
                <Button variant="outline" className="w-full">
                  <Bug className="mr-2 h-4 w-4" />
                  Dashboard bugs
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5 text-orange-600" />
                Signalements
              </CardTitle>
              <CardDescription>
                Entrées du catalogue communautaire signalées par les membres
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/signalements">
                <Button variant="outline" className="w-full">
                  <Flag className="mr-2 h-4 w-4" />
                  Modérer les signalements
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-amber-600" />
                Utilisation des comptes
              </CardTitle>
              <CardDescription>
                Courbes d&apos;usage dans le temps et top utilisateurs (démo &amp; admins exclus)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/usage">
                <Button variant="outline" className="w-full">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Voir l&apos;utilisation par compte
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activite recente
              </CardTitle>
              <CardDescription>
                Derniers utilisateurs crees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {recentUsers.map((user) => (
                  <li key={user.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${user.active ? "bg-green-500" : "bg-slate-300"}`} />
                      {user.name || user.email}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {user.role === "ADMIN" && (
                        <Shield className="inline h-3 w-3 mr-1 text-amber-500" />
                      )}
                      {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Logs & Métriques */}
        <AdminTabs />
      </main>
    </div>
  )
}
