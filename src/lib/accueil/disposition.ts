/**
 * Disposition de l'accueil v2 par compte (maquette retenue, livraison L3) :
 * deux listes ordonnées d'identifiants VISIBLES, une pour les repères, une
 * pour les tuiles, et la taille choisie pour chaque tuile. Tout ce qui n'y
 * est pas est masqué. Stockée dans les préférences de la PERSONNE
 * (`accueilDisposition`), jamais de l'exploitation : deux associés peuvent
 * avoir deux accueils. Module PUR, testé sans Prisma.
 *
 * Catalogue (2026-10-10, demande de Guillaume : « chacun doit pouvoir
 * construire sa page en fonction de son activité ») : la liste des tuiles
 * proposées dépasse celles affichées par défaut ; le mode Personnaliser
 * les propose, grisées quand leur module est désactivé.
 */

import type { ModuleId } from "@/lib/modules"

export const CLE_PREFERENCE_DISPOSITION = "accueilDisposition"

export const IDS_REPERES = ["repere:cultures", "repere:surface", "repere:recoltes", "repere:tresorerie", "repere:semaine"] as const
export type IdRepere = (typeof IDS_REPERES)[number]

export const IDS_TUILES = [
  "aujourdhui",
  "plan",
  "semaine",
  "agent",
  "elevage",
  "recoltes-semaine",
  "tresorerie",
  "verger",
  "stocks",
  "ventes",
  "journal",
  "raccourcis",
  "carte",
] as const
export type IdTuile = (typeof IDS_TUILES)[number]

/** Tuiles de la maquette, affichées tant que la personne n'a rien choisi. */
export const TUILES_DEFAUT: readonly IdTuile[] = ["aujourdhui", "plan", "semaine", "agent", "elevage"]

/** Tuiles dont les données ne sont composées que si la tuile est affichée. */
export const TUILES_OPTIONNELLES: readonly IdTuile[] = ["recoltes-semaine", "tresorerie", "verger", "stocks", "ventes", "journal", "carte"]

/** Largeur d'une tuile en colonnes (grille de douze sur grand écran). */
export type TailleTuile = 4 | 6 | 8 | 12
export const TAILLES_TUILE: readonly TailleTuile[] = [4, 6, 8, 12]
export const LIBELLES_TAILLE: Record<TailleTuile, string> = { 4: "Petite", 6: "Moyenne", 8: "Grande", 12: "Pleine largeur" }

export type LargeurDefaut = 4 | 5 | 6 | 7 | 8 | 12

export interface FicheTuile {
  id: IdTuile
  libelle: string
  /** Une phrase, voix de terrain, pour le catalogue. */
  description: string
  /** Module qui conditionne la tuile ; absent = toujours disponible. */
  module?: ModuleId
  /** Largeur de la maquette quand la personne n'a rien choisi. */
  largeur: LargeurDefaut
  hauteur: 1 | 2
  /** Tailles que la personne peut choisir. */
  tailles: readonly TailleTuile[]
}

export const CATALOGUE_TUILES: Record<IdTuile, FicheTuile> = {
  aujourdhui: { id: "aujourdhui", libelle: "Aujourd'hui", description: "La liste du jour classée par urgence, avec l'action de chaque ligne.", largeur: 7, hauteur: 2, tailles: [6, 8, 12] },
  plan: { id: "plan", libelle: "Plan de la ferme", description: "Vos planches, arbres et objets, l'état du jour en liseré.", largeur: 5, hauteur: 1, tailles: [4, 6, 8] },
  semaine: { id: "semaine", libelle: "Semaine météo", description: "Sept jours de prévisions sur la parcelle suivie, fenêtre de travail comprise.", largeur: 5, hauteur: 1, tailles: [4, 6, 8] },
  agent: { id: "agent", libelle: "Gleba", description: "L'alerte du moment, le point le plus pressant, une question à poser.", largeur: 7, hauteur: 1, tailles: [6, 8, 12] },
  elevage: { id: "elevage", libelle: "Élevage", description: "Les échéances à venir sous 7 jours : soins, mises bas, délais d'attente.", module: "elevage", largeur: 5, hauteur: 1, tailles: [4, 6, 8] },
  "recoltes-semaine": { id: "recoltes-semaine", libelle: "Récoltes de la semaine", description: "Ce qui arrive à maturité dans la semaine, à noter d'un geste.", module: "maraichage", largeur: 6, hauteur: 1, tailles: [4, 6, 8] },
  tresorerie: { id: "tresorerie", libelle: "Trésorerie et créances", description: "Résultat de l'année, factures émises à encaisser, dépenses à régler.", module: "comptabilite", largeur: 6, hauteur: 1, tailles: [4, 6, 8] },
  verger: { id: "verger", libelle: "Verger à faire", description: "Les gestes dont la fenêtre est ouverte, par lot d'arbres.", module: "verger", largeur: 6, hauteur: 1, tailles: [4, 6, 8] },
  stocks: { id: "stocks", libelle: "Stocks et péremptions", description: "Aliments sous le seuil d'alerte, médicaments proches de la péremption.", module: "elevage", largeur: 4, hauteur: 1, tailles: [4, 6, 8] },
  ventes: { id: "ventes", libelle: "Ventes récentes", description: "Les dernières ventes et le total du mois en cours.", module: "comptabilite", largeur: 6, hauteur: 1, tailles: [4, 6, 8] },
  journal: { id: "journal", libelle: "Journal de bord", description: "Vos dernières interventions, pour reprendre le fil.", largeur: 6, hauteur: 1, tailles: [4, 6, 8] },
  raccourcis: { id: "raccourcis", libelle: "Raccourcis", description: "Les saisies et écrans que vous ouvrez le plus, en un geste.", largeur: 4, hauteur: 1, tailles: [4, 6, 8] },
  carte: { id: "carte", libelle: "Carte", description: "Vos parcelles telles qu'au cadastre, et le lien vers la carte.", largeur: 6, hauteur: 1, tailles: [4, 6, 8, 12] },
}

export interface AccueilDisposition {
  reperes: IdRepere[]
  tuiles: IdTuile[]
  /** Taille choisie par tuile ; absente = largeur de la maquette. */
  tailles: Partial<Record<IdTuile, TailleTuile>>
}

/** Module qui conditionne une tuile ou un repère ; absent = toujours disponible. */
export const MODULE_DE: Partial<Record<IdRepere | IdTuile, ModuleId>> = {
  "repere:cultures": "maraichage",
  "repere:surface": "maraichage",
  "repere:recoltes": "maraichage",
  "repere:tresorerie": "comptabilite",
  ...Object.fromEntries(
    IDS_TUILES.filter((id) => CATALOGUE_TUILES[id].module).map((id) => [id, CATALOGUE_TUILES[id].module]),
  ),
}

export const LIBELLES: Record<IdRepere | IdTuile, string> = {
  "repere:cultures": "Cultures en place",
  "repere:surface": "Surface cultivée",
  "repere:recoltes": "Récoltes",
  "repere:tresorerie": "Trésorerie",
  "repere:semaine": "Semaine",
  ...(Object.fromEntries(IDS_TUILES.map((id) => [id, CATALOGUE_TUILES[id].libelle])) as Record<IdTuile, string>),
}

/** Disposition Gleba par défaut : la maquette, sans taille choisie. */
export function dispositionDefaut(): AccueilDisposition {
  return { reperes: [...IDS_REPERES], tuiles: [...TUILES_DEFAUT], tailles: {} }
}

export function estIdRepere(v: unknown): v is IdRepere {
  return typeof v === "string" && (IDS_REPERES as readonly string[]).includes(v)
}
export function estIdTuile(v: unknown): v is IdTuile {
  return typeof v === "string" && (IDS_TUILES as readonly string[]).includes(v)
}
function estTailleTuile(v: unknown): v is TailleTuile {
  return typeof v === "number" && (TAILLES_TUILE as readonly number[]).includes(v)
}

function dedoublonner<T>(liste: T[]): T[] {
  return liste.filter((v, i) => liste.indexOf(v) === i)
}

function sanitizeTailles(input: unknown): Partial<Record<IdTuile, TailleTuile>> {
  if (!input || typeof input !== "object") return {}
  const propre: Partial<Record<IdTuile, TailleTuile>> = {}
  for (const [id, taille] of Object.entries(input as Record<string, unknown>)) {
    if (!estIdTuile(id) || !estTailleTuile(taille)) continue
    if (!CATALOGUE_TUILES[id].tailles.includes(taille)) continue
    propre[id] = taille
  }
  return propre
}

/**
 * Nettoyage d'une préférence lue : identifiants inconnus ignorés, doublons
 * retirés, listes manquantes remises par défaut, tailles hors catalogue
 * ignorées. Une liste vide est permise (« de cinq repères à trois ou à zéro »).
 */
export function sanitizeAccueilDisposition(input: unknown): AccueilDisposition {
  const defaut = dispositionDefaut()
  if (!input || typeof input !== "object") return defaut
  const o = input as { reperes?: unknown; tuiles?: unknown; tailles?: unknown }
  return {
    reperes: Array.isArray(o.reperes) ? dedoublonner(o.reperes.filter(estIdRepere)) : defaut.reperes,
    tuiles: Array.isArray(o.tuiles) ? dedoublonner(o.tuiles.filter(estIdTuile)) : defaut.tuiles,
    tailles: sanitizeTailles(o.tailles),
  }
}

/** Largeur affichée d'une tuile : la taille choisie, sinon celle de la maquette. */
export function largeurTuile(id: IdTuile, disposition: Pick<AccueilDisposition, "tailles">): LargeurDefaut {
  return disposition.tailles[id] ?? CATALOGUE_TUILES[id].largeur
}

/**
 * Taille suivante dans le cycle propre à la tuile (après la dernière, la
 * première). Depuis la largeur de la maquette, qui n'est pas toujours dans
 * les choix (7, 5), on va d'abord au premier choix au moins aussi large.
 */
export function tailleSuivante(id: IdTuile, disposition: Pick<AccueilDisposition, "tailles">): TailleTuile {
  const choix = CATALOGUE_TUILES[id].tailles
  const actuelle = largeurTuile(id, disposition)
  const rang = choix.indexOf(actuelle as TailleTuile)
  if (rang >= 0) return choix[(rang + 1) % choix.length]
  const premierPlusLarge = choix.find((t) => t >= actuelle)
  return premierPlusLarge ?? choix[0]
}

export function definirTaille(disposition: AccueilDisposition, id: IdTuile, taille: TailleTuile): AccueilDisposition {
  if (!CATALOGUE_TUILES[id].tailles.includes(taille)) return disposition
  return { ...disposition, tailles: { ...disposition.tailles, [id]: taille } }
}

/** Ce qui s'affiche : la disposition, moins ce qu'un module désactivé retire, sans réécrire la préférence. */
export function visiblesSelonModules<T extends IdRepere | IdTuile>(ids: readonly T[], modules: readonly ModuleId[]): T[] {
  return ids.filter((id) => {
    const moduleRequis = MODULE_DE[id]
    return !moduleRequis || modules.includes(moduleRequis)
  })
}

/** Ce qui est masqué et peut être remis (hors modules désactivés). */
export function masques<T extends IdRepere | IdTuile>(tous: readonly T[], visibles: readonly T[], modules: readonly ModuleId[]): T[] {
  return visiblesSelonModules(
    tous.filter((id) => !visibles.includes(id)),
    modules,
  )
}

/** Entrée du catalogue en mode Personnaliser : proposée, déjà affichée, ou grisée faute de module. */
export interface PropositionTuile {
  fiche: FicheTuile
  affichee: boolean
  /** Module requis mais désactivé : la tuile se propose, grisée. */
  moduleManquant: ModuleId | null
}

export function catalogue(visibles: readonly IdTuile[], modules: readonly ModuleId[]): PropositionTuile[] {
  return IDS_TUILES.map((id) => {
    const fiche = CATALOGUE_TUILES[id]
    const moduleManquant = fiche.module && !modules.includes(fiche.module) ? fiche.module : null
    return { fiche, affichee: visibles.includes(id), moduleManquant }
  })
}

export function deplacer<T>(liste: readonly T[], id: T, sens: -1 | 1): T[] {
  const i = liste.indexOf(id)
  if (i < 0) return [...liste]
  const j = i + sens
  if (j < 0 || j >= liste.length) return [...liste]
  const copie = [...liste]
  ;[copie[i], copie[j]] = [copie[j], copie[i]]
  return copie
}

/** Glisser-déposer : `id` prend la place de `cible`, les autres se décalent. */
export function reordonner<T>(liste: readonly T[], id: T, cible: T): T[] {
  const de = liste.indexOf(id)
  const vers = liste.indexOf(cible)
  if (de < 0 || vers < 0 || de === vers) return [...liste]
  const copie = [...liste]
  const [element] = copie.splice(de, 1)
  copie.splice(vers, 0, element)
  return copie
}

export function retirer<T>(liste: readonly T[], id: T): T[] {
  return liste.filter((v) => v !== id)
}

/** Remet un élément à sa place d'origine (ordre de la maquette), ou à la fin. */
export function remettre<T>(liste: readonly T[], id: T, ordreReference: readonly T[]): T[] {
  if (liste.includes(id)) return [...liste]
  const copie = [...liste]
  const rangCible = ordreReference.indexOf(id)
  const position = copie.findIndex((v) => ordreReference.indexOf(v) > rangCible)
  if (position < 0) copie.push(id)
  else copie.splice(position, 0, id)
  return copie
}

export function memeDisposition(a: AccueilDisposition, b: AccueilDisposition): boolean {
  const tailles = (d: AccueilDisposition) =>
    IDS_TUILES.map((id) => `${id}=${d.tailles[id] ?? ""}`).join("|")
  return a.reperes.join("|") === b.reperes.join("|") && a.tuiles.join("|") === b.tuiles.join("|") && tailles(a) === tailles(b)
}

/** Identifiants de tuiles optionnelles à composer côté serveur pour cette disposition. */
export function tuilesOptionnellesDemandees(tuiles: readonly IdTuile[]): IdTuile[] {
  return TUILES_OPTIONNELLES.filter((id) => tuiles.includes(id))
}
