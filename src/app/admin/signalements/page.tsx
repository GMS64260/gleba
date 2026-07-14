import { requireAdmin } from "@/lib/auth-utils"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Flag } from "lucide-react"
import { SignalementsModeration } from "./SignalementsModeration"

export const dynamic = "force-dynamic"

export default async function AdminSignalementsPage() {
  await requireAdmin()

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Flag className="h-6 w-6 text-orange-600" />
          <h1 className="text-2xl font-bold">Signalements du catalogue communautaire</h1>
        </div>
        <Link href="/admin">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Admin
          </Button>
        </Link>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Modération a posteriori : les entrées proposées à la communauté sont visibles immédiatement.
        Les membres peuvent signaler une entrée erronée, en double ou inappropriée ; vous pouvez la
        retirer de la communauté (rendre privée à son auteur), marquer le signalement comme traité, ou le rejeter.
      </p>
      <SignalementsModeration />
    </div>
  )
}
