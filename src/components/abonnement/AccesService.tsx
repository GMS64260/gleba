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
const LIEN = "inline-flex min-h-11 items-center rounded-md px-5 py-3 font-medium"
const FACTURATION = [
  { href: "/comptabilite/factures", libelle: "Factures, devis et bons de livraison" },
  { href: "/comptabilite/clients", libelle: "Clients" },
  { href: "/comptabilite/fournisseurs", libelle: "Fournisseurs" },
]
export function GardePageService({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { acces, erreur } = useAccesService()
  // Seules les surfaces applicatives sont concernées ; la vitrine reste publique.
  const protege = /^\/(maraichage|verger|elevage|comptabilite|meteo|jardin|interventions|taches|dashboard|aujourdhui)(\/|$)/.test(pathname) || pathname === "/boutique"
  if (!session?.user || !protege) return <>{children}</>
  if (!acces) return <main className="mx-auto max-w-3xl px-4 py-10"><p role="status">{erreur ? "Votre accès n’est pas disponible. Actualisez la page pour réessayer." : "Vérification de votre accès…"}</p></main>
  if (operationPermise(acces, pathname, "GET")) return <>{children}</>
  // Le carnet gratuit garde la facturation : l'entrée Comptabilité y mène.
  const facturationSeule = pathname.startsWith("/comptabilite") && acces.facturation
  return <main className="mx-auto max-w-3xl px-4 py-10">
    {facturationSeule && <section aria-labelledby="titre-facturation" className="mb-10">
      <h1 id="titre-facturation" className="font-display text-3xl text-foret">Vos ventes et vos factures</h1>
      <ul className="mt-5 grid gap-3 sm:grid-cols-3">{FACTURATION.map(l => <li key={l.href}><Link href={l.href} className="flex min-h-20 items-center rounded-xl border border-lin bg-craie p-4 font-medium text-encre hover:border-sauge">{l.libelle}</Link></li>)}</ul>
    </section>}
    {facturationSeule ? <h2 className="font-display text-2xl text-foret">La gestion est comprise dans Complet.</h2> : <h1 className="font-display text-3xl text-foret">Cette fonction est comprise dans Complet.</h1>}
    <p className="mt-4 max-w-prose text-base leading-7 text-ardoise">{facturationSeule ? "Tableau de bord, dépenses, banque, TVA, bilan et coûts de production font partie de l’offre Complet, avec l’assistant IA, la météo et la boutique en ligne. Vos données sont conservées et restent exportables." : "Votre carnet gratuit comprend tous vos ateliers et la facturation. L’assistant IA, la météo, la boutique en ligne et la gestion font partie de l’offre Complet. Vos données sont conservées."}</p>
    <Link href="/parametres?section=abonnement" className={`${LIEN} mt-6 bg-sauge text-white hover:bg-foret`}>Voir l’offre Complet</Link>
  </main>
}
