"use client"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"
import { useAccesService } from "@/hooks/use-acces-service"
export function BandeauService() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { acces } = useAccesService()
  if (!session?.user || !acces || ["libre", "gratuit-vie", "actif"].includes(acces.etat) || pathname === "/parametres") return null
  return <div role="status" className="border-b border-lin bg-paille-doux px-4 py-3 text-sm leading-6 text-encre lg:pl-[216px]"><span>{acces.etat === "a-demarrer" ? "Commencez vos trois mois gratuits pour utiliser votre carnet." : acces.etat === "lecture" ? "Votre essai est terminé. Votre historique reste disponible en lecture et à l’export." : acces.etat === "grace" ? "Votre paiement demande une régularisation." : "Vous profitez de l’essai complet de trois mois."}</span> <Link href="/parametres?section=abonnement" className="inline-flex min-h-11 items-center font-medium text-foret underline underline-offset-4">Voir mon accès</Link></div>
}
