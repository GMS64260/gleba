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
import { useAccesService } from "@/hooks/use-acces-service"

export function BoutiqueHeaderButton() {
  const { acces } = useAccesService()
  if (process.env.NEXT_PUBLIC_FEATURE_BOUTIQUE !== "true" || !acces?.boutique) {
    return null
  }
  return (
    <Link href="/boutique">
      <Button variant="outline" size="sm" className="border-lin bg-craie text-encre hover:bg-papier hover:text-encre">
        <Store className="mr-1 h-4 w-4 text-ardoise" />
        <span className="hidden sm:inline">Boutique</span>
      </Button>
    </Link>
  )
}
