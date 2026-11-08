"use client"
import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useAccesService } from "@/hooks/use-acces-service"
import { operationPermise } from "@/lib/abonnement/requetes"

export function FonctionService({ fonction, children }: { fonction: "ia" | "meteo" | "boutique"; children: ReactNode }) {
  const { acces } = useAccesService()
  return acces?.[fonction] ? <>{children}</> : null
}
export function GardePageService({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { acces, erreur } = useAccesService()
  // Seules les surfaces applicatives sont concernées ; la vitrine reste publique.
  const protege = /^\/(maraichage|verger|elevage|comptabilite|meteo|jardin|interventions|taches|dashboard|aujourdhui)(\/|$)/.test(pathname) || pathname === "/boutique"
  if (!session?.user || !protege) return <>{children}</>
  if (!acces) return <main className="mx-auto max-w-3xl px-4 py-10"><p role="status">{erreur ? "Votre accès n’est pas disponible. Actualisez la page pour réessayer." : "Vérification de votre accès…"}</p></main>
  if (operationPermise(acces, pathname, "GET")) return <>{children}</>
  return <main className="mx-auto max-w-3xl px-4 py-10"><h1 className="font-display text-3xl text-foret">Cette fonction demande l’offre Complet.</h1><p className="mt-4 max-w-prose text-base leading-7 text-ardoise">Votre carnet Essentiel comprend votre atelier choisi. Retrouvez vos droits et les possibilités de changement dans votre abonnement. Vos données sont conservées.</p><Link href="/parametres?section=abonnement" className="mt-6 inline-flex min-h-11 items-center rounded-md bg-sauge px-5 py-3 font-medium text-white hover:bg-foret">Voir mon abonnement</Link></main>
}
