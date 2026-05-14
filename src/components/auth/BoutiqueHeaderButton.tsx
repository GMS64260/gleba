"use client"

/**
 * Bouton "Boutique" du header global.
 *
 * Dans la version publique (open-source) du repo, la boutique en ligne est
 * désactivée. Ce composant se masque automatiquement si le flag
 * `NEXT_PUBLIC_FEATURE_BOUTIQUE` n'est pas à `"true"`.
 *
 * Pour réactiver côté self-hosting, exporte la variable d'environnement :
 *   NEXT_PUBLIC_FEATURE_BOUTIQUE=true npm run build
 */

import Link from "next/link"
import { Store } from "lucide-react"
import { Button } from "@/components/ui/button"

export function BoutiqueHeaderButton() {
  if (process.env.NEXT_PUBLIC_FEATURE_BOUTIQUE !== "true") {
    return null
  }
  return (
    <Link href="/boutique">
      <Button variant="outline" size="sm" className="text-teal-700 border-teal-300 hover:bg-teal-50">
        <Store className="h-4 w-4 mr-1" />
        <span className="hidden sm:inline">Boutique</span>
      </Button>
    </Link>
  )
}
