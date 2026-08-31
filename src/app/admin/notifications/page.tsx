import { requireAdmin } from "@/lib/auth-utils"
import { ReglagesNotifications } from "@/components/admin/ReglagesNotifications"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Bell, Shield } from "lucide-react"
import Link from "next/link"

export default async function SettingsPage() {
  await requireAdmin()

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
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
              <h1 className="text-xl font-bold text-amber-800">
                Réglages des notifications
              </h1>
            </div>
          </div>
          <Bell className="h-6 w-6 text-amber-600" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <ReglagesNotifications />
      </main>
    </div>
  )
}
