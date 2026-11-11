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
  { href: "/maraichage/planches/new", libelle: "Nouvelle planche", menu: "maraichage", onglet: "terrain", suite: "Terrain › Planches" },
  { href: "/maraichage/cultures/new", libelle: "Nouvelle culture", menu: "maraichage", onglet: "cultures", suite: "Cultures" },
  { href: "/maraichage/recoltes", libelle: "Récoltes", menu: "maraichage" },
  { href: "/maraichage/recoltes/saisie", libelle: "Nouvelle récolte", menu: "maraichage" },
  { href: "/maraichage/stocks?tab=consommations", libelle: "Sorties de stock", menu: "maraichage", onglet: "planification", suite: "Planification › Stocks › Stocks complets › Consommations" },
  { href: "/maraichage/stocks", libelle: "Stocks des cultures", menu: "maraichage", onglet: "planification", suite: "Planification › Stocks › Stocks complets" },
  { href: "/verger?tab=arbres", libelle: "Arbres du verger", menu: "verger", onglet: "arbres", suite: "Arbres" },
  { href: "/verger?tab=productions", libelle: "Productions du verger", menu: "verger", onglet: "productions", suite: "Productions › Produits transformés" },
  { href: "/verger/recoltes", libelle: "Récoltes de fruits", menu: "verger", onglet: "productions", suite: "Productions › Récoltes Fruits" },
  { href: "/elevage?tab=animaux", libelle: "Animaux et lots", menu: "elevage", onglet: "animaux", suite: "Animaux & Lots" },
  { href: "/elevage?tab=alimentation", libelle: "Alimentation et soins", menu: "elevage", onglet: "alimentation", suite: "Alimentation & Soins" },
  { href: "/elevage?tab=production", libelle: "Production animale", menu: "elevage", onglet: "production", suite: "Production" },
  { href: "/comptabilite/factures?tab=generer", libelle: "Nouvelle facture", menu: "comptabilite", suite: "Devis et facturation › Nouvelle facture" },
  { href: "/comptabilite/banque", libelle: "Banque", menu: "comptabilite", suite: "Banque" },
  { href: "/comptabilite/export", libelle: "Export FEC", menu: "comptabilite", suite: "Export FEC" },
  { href: "/parametres?rubrique=carnet", libelle: "Mon carnet", menu: "parametres", suite: "Mon carnet" },
  { href: "/parametres?rubrique=notifications", libelle: "Assistant et notifications", menu: "parametres", suite: "Assistant et notifications" },
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
