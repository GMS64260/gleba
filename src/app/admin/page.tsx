/**
 * Dashboard Admin
 */

import { requireAdmin } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Users, UserPlus, Shield, Activity } from "lucide-react"

export default async function AdminPage() {
  await requireAdmin()

  // Stats
  const [totalUsers, activeUsers, adminCount] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { active: true } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
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
                      <span className={`w-2 h-2 rounded-full ${user.active ? "bg-green-500" : "bg-gray-300"}`} />
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
      </main>
    </div>
  )
}
