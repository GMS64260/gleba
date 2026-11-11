import { ENTREES_NAVIGATION, getEntreeNavigation, type PageNavigationId } from "@/lib/navigation-principale"

/** Parcours vérifiés dans l'interface, sans donnée de compte ni sélecteur fourni par l'IA. */
export interface CibleAide {
  href: string
  libelle: string
  menu?: PageNavigationId
  onglet?: string
  suite?: string
}

export const CIBLES_AIDE: readonly CibleAide[] = [
  ...ENTREES_NAVIGATION.map(({ href, libelle, id }) => ({ href, libelle, menu: id })),
  { href: "/tracabilite", libelle: "Registre phytosanitaire", menu: "interventions", suite: "Registre phyto complet" },
  { href: "/parametres/equipe", libelle: "Équipe", menu: "parametres", suite: "Équipe, devise et unités › Gérer l’équipe" },
  { href: "/parametres?rubrique=abonnement", libelle: "Abonnement", menu: "parametres", suite: "Abonnement" },
  { href: "/parametres/exploitation", libelle: "Identité de l’exploitation", menu: "parametres", suite: "Exploitation et équipe" },
  { href: "/comptabilite/transactions", libelle: "Transactions", menu: "comptabilite", suite: "Transactions" },
  { href: "/comptabilite/factures", libelle: "Devis et facturation", menu: "comptabilite", suite: "Devis et facturation" },
  { href: "/comptabilite/stocks", libelle: "Stocks", menu: "comptabilite", suite: "Stocks" },
  { href: "/maraichage/planches", libelle: "Planches", menu: "maraichage", onglet: "terrain", suite: "Terrain › Planches" },
  { href: "/verger?tab=productions", libelle: "Productions du verger", menu: "verger", onglet: "productions", suite: "Productions › Produits transformés" },
  { href: "/verger/recoltes", libelle: "Récoltes de fruits", menu: "verger", onglet: "productions", suite: "Productions › Récoltes Fruits" },
  { href: "/register", libelle: "Créer un compte" },
  { href: "/tarifs", libelle: "Tarifs" },
]

/** Correspondance exacte : jamais d'URL externe, d'API, de paramètre libre ou d'identifiant privé. */
export function cibleAide(href: string): CibleAide | undefined {
  return CIBLES_AIDE.find(cible => cible.href === href)
}

export function cheminAide(cible: CibleAide): string {
  if (!cible.menu) return cible.libelle
  return [getEntreeNavigation(cible.menu).libelle, cible.suite].filter(Boolean).join(" › ")
}

/** Liens explicites seulement : aucun routage par mots-clés de la question. */
export function ciblesAideDansTexte(texte: string): CibleAide[] {
  const chemins = texte.match(/(?<![\w/.:])\/[a-zA-Z0-9_/?=&%#-]+/g) ?? []
  return [...new Set(chemins)].map(cibleAide).filter((cible): cible is CibleAide => Boolean(cible)).slice(0, 3)
}
