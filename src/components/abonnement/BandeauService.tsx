"use client"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"
import { useAccesService } from "@/hooks/use-acces-service"
export function BandeauService() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { acces } = useAccesService()
  if (!session?.user || !acces || ["libre", "gratuit-vie", "actif", "gratuit", "a-demarrer"].includes(acces.etat) || pathname === "/parametres") return null
  return <div role="status" className="border-b border-lin bg-paille-doux px-4 py-3 text-sm leading-6 text-encre lg:pl-[216px]"><span>{acces.etat === "grace" ? "Votre paiement demande une régularisation." : "Vous profitez de l’essai de Complet pendant trois mois. Ensuite, votre carnet reste gratuit."}</span> <Link href="/parametres?section=abonnement" className="inline-flex min-h-11 items-center font-medium text-foret underline underline-offset-4">Voir mon accès</Link></div>
}
