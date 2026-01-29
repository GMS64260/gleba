/**
 * Creation d'un nouvel utilisateur (Admin)
 */

import { requireAdmin } from "@/lib/auth-utils"
import { UserForm } from "@/components/admin/UserForm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Shield, ArrowLeft, UserPlus } from "lucide-react"

export default async function NewUserPage() {
  await requireAdmin()

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/admin/users">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-amber-600" />
            <h1 className="text-xl font-bold text-amber-800">Nouvel utilisateur</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Creer un compte
            </CardTitle>
            <CardDescription>
              Creer un nouveau compte utilisateur
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserForm />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
