"use client"

/**
 * Bandeau affiché en permanence pendant une consultation admin (lecture seule).
 * Rappelle qu'on voit le compte d'un autre utilisateur, que rien n'est
 * modifiable, et propose de quitter (déconnexion de la session consultée).
 */

import { useSession, signOut } from "next-auth/react"
import { Eye, LogOut } from "lucide-react"

export function ImpersonationBanner() {
  const { data: session } = useSession()
  if (!session?.user?.impersonatedBy) return null

  const cible = session.user.name || session.user.email

  return (
    <div className="w-full bg-amber-500 text-amber-950 shadow-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-sm">
        <Eye className="h-4 w-4 flex-shrink-0" />
        <span className="font-medium truncate">
          Consultation admin — {cible}
        </span>
        <span className="hidden sm:inline text-amber-900/80">· lecture seule (aucune modification possible)</span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-amber-950/10 px-2.5 py-1 font-medium hover:bg-amber-950/20"
        >
          <LogOut className="h-3.5 w-3.5" />
          Quitter
        </button>
      </div>
    </div>
  )
}
