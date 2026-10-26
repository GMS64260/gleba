import type { ComponentType } from "react"
import { Bird, CalendarCheck, ClipboardList, CloudSun, Map as MapIcon, Megaphone, Settings, Sprout, Store, TreeDeciduous, Wallet } from "lucide-react"
import type { ModuleId } from "@/lib/modules"
import type { VersionAccueil } from "@/lib/accueil/preference"

export type PagePrincipaleId = "aujourdhui" | "jardin" | "maraichage" | "interventions" | "verger" | "elevage" | "comptabilite" | "meteo"
export type PageNavigationId = PagePrincipaleId | "communaute" | "parametres" | "boutique"

export interface EntreeNavigation {
  id: PageNavigationId
  href: string
  libelle: string
  icone: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  module?: ModuleId
  feature?: "boutique"
}

export const ENTREES_PRINCIPALES: readonly EntreeNavigation[] = [
  { id: "aujourdhui", href: "/aujourdhui", libelle: "Aujourd’hui", icone: CalendarCheck },
  { id: "jardin", href: "/jardin", libelle: "Plan & carte", icone: MapIcon },
  { id: "maraichage", href: "/maraichage", libelle: "Cultures", icone: Sprout, module: "maraichage" },
  { id: "interventions", href: "/interventions", libelle: "Interventions", icone: ClipboardList },
  { id: "verger", href: "/verger", libelle: "Verger", icone: TreeDeciduous, module: "verger" },
  { id: "elevage", href: "/elevage", libelle: "Élevage", icone: Bird, module: "elevage" },
  { id: "comptabilite", href: "/comptabilite", libelle: "Comptabilité", icone: Wallet, module: "comptabilite" },
  { id: "meteo", href: "/meteo", libelle: "Météo", icone: CloudSun },
]

export const ENTREES_SECONDAIRES: readonly EntreeNavigation[] = [
  { id: "boutique", href: "/boutique", libelle: "Boutique", icone: Store, feature: "boutique" },
  { id: "communaute", href: "/communaute", libelle: "Communauté", icone: Megaphone },
  { id: "parametres", href: "/parametres", libelle: "Paramètres", icone: Settings },
]

export const ENTREES_NAVIGATION: readonly EntreeNavigation[] = [...ENTREES_PRINCIPALES, ...ENTREES_SECONDAIRES]

export function getEntreeNavigation(id: PageNavigationId): EntreeNavigation {
  const entree = ENTREES_NAVIGATION.find(e => e.id === id)
  if (!entree) throw new Error("Page de navigation inconnue")
  return entree
}

/** Une frontière de chemin évite d'activer /verger pour /verger-autre. */
export function estEntreeNavigationActive(pathname: string | null, href: string): boolean {
  return Boolean(pathname && (pathname === href || pathname.startsWith(`${href}/`)))
}

export function entreeNavigationVisible(entree: EntreeNavigation, modules: readonly ModuleId[], boutique: boolean): boolean {
  return (!entree.module || modules.includes(entree.module)) && (!entree.feature || boutique)
}

const CHEMINS_SANS_SHELL = ["/login", "/register", "/mot-de-passe-oublie", "/reset-password", "/onboarding", "/invitation", "/impersonation", "/admin", "/apercu"]

export function estCheminSansShell(pathname: string | null): boolean {
  return !pathname || CHEMINS_SANS_SHELL.some(p => estEntreeNavigationActive(pathname, p))
}

export function estCoquilleV2Active(pathname: string | null, version: VersionAccueil, connecte: boolean): boolean {
  return connecte && !estCheminSansShell(pathname) && (version === "v2" || pathname === "/aujourdhui")
}
