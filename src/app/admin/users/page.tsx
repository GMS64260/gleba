/**
 * Liste des utilisateurs (Admin)
 */

import { requireAdmin } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { UserTable } from "@/components/admin/UserTable"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Shield, UserPlus, ArrowLeft } from "lucide-react"

export default async function UsersPage() {
  await requireAdmin()

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          cultures: true,
          planches: true,
          recoltes: true,
        },
      },
    },
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-amber-600" />
              <h1 className="text-xl font-bold text-amber-800">Utilisateurs</h1>
            </div>
          </div>
          <Link href="/admin/users/new">
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Nouvel utilisateur
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <UserTable users={users} />
      </main>
    </div>
  )
}
