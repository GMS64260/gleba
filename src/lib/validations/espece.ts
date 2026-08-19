/**
 * Schémas de validation Zod pour les Espèces
 */

import { z } from 'zod'

// Types d'especes valides. Convention DB = snake_case ; label FR mappé via
// ESPECE_TYPE_LABELS pour l'affichage (cf. docs/conventions.md).
export const ESPECE_TYPES = [
  'legume',
  'aromatique',
  'fleur',
  'engrais_vert',
  'arbre_fruitier',
  'petit_fruit',
  'ornement',
] as const

export const ESPECE_TYPE_LABELS: Record<typeof ESPECE_TYPES[number], string> = {
  legume: 'Maraîchage',
  aromatique: 'Aromatique',
  fleur: 'Fleur',
  engrais_vert: 'Engrais vert',
  arbre_fruitier: 'Arbre fruitier',
  petit_fruit: 'Petit fruit',
  ornement: 'Ornement',
}

/**
 * Registre « nature de la plante », pour les listes, badges, exports et
 * sélecteurs. Il ne diffère de ESPECE_TYPE_LABELS que sur `legume` : le
 * référentiel nomme ce type d'après le MODULE (« Maraîchage », cf.
 * docs/conventions.md), là où une colonne Type ou une option de menu nomme la
 * plante. Les deux registres sont légitimes ; ce qui ne l'était pas, c'est que
 * le second vive en quatre copies éparpillées dans les écrans.
 *
 * Une seule ligne de delta, ici, plutôt qu'une carte recopiée par écran.
 */
const ESPECE_TYPE_LABELS_PLANTE: Record<typeof ESPECE_TYPES[number], string> = {
  ...ESPECE_TYPE_LABELS,
  legume: 'Légume',
}

/**
 * Libellé affichable du type d'une espèce.
 *
 * Ticket FB-E33FAA (2026-08-18) : quatre écrans du référentiel portaient chacun
 * leur carte de libellés recopiée. Une seule avait reçu le libellé « Ornement »
 * (feedback cmpm71z5s, mai 2026) ; les trois autres affichaient donc le slug
 * brut « ornement » en colonne et dans l'export CSV, et l'écran de création
 * rendait carrément une option VIDE. Un cinquième chemin
 * (`EspeceCombobox`) faisait `type.replace('_', ' ')`.
 *
 * Accepte volontairement un `string` : `Espece.type` est une colonne texte, et
 * le catalogue contient des valeurs héritées hors référentiel (17 espèces en
 * `categorie='fruitier'`). Une donnée hors canon reste VISIBLE sous son slug
 * plutôt que d'afficher un vide — même règle que le sexe des animaux et le type
 * de sol des planches.
 */
export function libelleTypeEspece(type: string | null | undefined): string {
  if (!type) return ''
  return ESPECE_TYPE_LABELS_PLANTE[type as typeof ESPECE_TYPES[number]] ?? type
}

/**
 * Ce que CHOISIR ce type change dans l'application, en une phrase. Affiché sous
 * le champ Type des écrans de création d'espèce.
 *
 * Ticket FB-E33FAA (2026-08-18) : la liste des types est fermée, et rien à
 * l'écran ne disait ni ce que chaque valeur implique, ni pourquoi on ne peut pas
 * en créer une nouvelle. Or ce champ n'est pas un libellé décoratif : il décide
 * de l'écran qui liste l'espèce, de l'unité de son rendement, de sa présence
 * dans les stocks de maraîchage et de sa catégorie boutique. Un type libre
 * rendrait l'espèce muette partout à la fois. La contrainte est donc légitime
 * — c'est son silence qui ne l'était pas.
 *
 * Exhaustif par construction (`Record` sur ESPECE_TYPES) : ajouter un type sans
 * l'expliquer casse la compilation, comme pour ESPECE_TYPE_LABELS.
 */
export const ESPECE_TYPE_DESCRIPTIONS: Record<typeof ESPECE_TYPES[number], string> = {
  legume: 'Conduite sur planche : semis, plantation, récolte, stocks de semences et de plants.',
  aromatique: 'Conduite sur planche, récoltée en petites quantités et valorisée au kilo fort.',
  fleur: 'Fleurs coupées ou séchées : conduite sur planche, comme un légume.',
  engrais_vert: 'Couvert semé pour le sol : rendement en biomasse, aucune récolte commercialisée.',
  arbre_fruitier: 'Verger : se plante en arbre, jamais sur une planche. Rendement par arbre.',
  petit_fruit: 'Arbustes à petits fruits (framboisier, cassissier), rattachés au verger.',
  ornement: 'Ligneux d’agrément du verger : haie, brise-vent, ombrage. Pas de conduite sur planche.',
}

/**
 * Types conduits comme des cultures de plein champ ou d'abri, sur planche :
 * ils partagent le même cycle (semis, plantation, récolte), les mêmes stocks
 * (semences, plants, récoltes) et les mêmes écrans de maraîchage.
 *
 * Ticket FB-PMWX8O (ferme florale, 2026-08-18) : `fleur` manquait à cette
 * famille. Les fleurs du catalogue étaient éparpillées en `legume` (Cosmos,
 * Tagètes), `aromatique` (Souci) ou `engrais_vert` (Tournesol), donc invisibles
 * en tant que production. Toute liste qui énumérait le triplet historique
 * doit passer par cette constante, sans quoi un type ajouté ici disparaît
 * silencieusement d'un écran.
 *
 * `ornement` en est exclu volontairement : il porte les ligneux d'agrément du
 * verger (Albizia, Bambou, Frêne, Tilleul), qui ne se conduisent pas sur planche.
 */
export const ESPECE_TYPES_MARAICHAGE = [
  'legume',
  'aromatique',
  'fleur',
  'engrais_vert',
] as const

// Unités de rendement métier — dépendent du type.
//   kg_m2          : maraîchage, aromatique, fleur, petit fruit, ornement
//   kg_arbre       : arbre fruitier
//   biomasse_t_ha  : engrais vert
export const UNITE_RENDEMENT = ['kg_m2', 'kg_arbre', 'biomasse_t_ha'] as const

export const UNITE_RENDEMENT_LABELS: Record<typeof UNITE_RENDEMENT[number], string> = {
  kg_m2: 'kg/m²',
  kg_arbre: 'kg/arbre',
  biomasse_t_ha: 't/ha',
}

/**
 * Rendement formaté avec SON unité.
 *
 * QA cmsqlu3os : l'onglet Référentiel de l'accueil titrait sa colonne
 * « Rendement (kg/m²) » et y affichait tels quels les 150 kg de l'arbre à pain,
 * les 100 kg de l'avocatier ou les 80 kg de la carambole — des rendements PAR
 * ARBRE. Les données du référentiel sont justes (`especes.unite_rendement`),
 * c'était l'étiquette qui mentait. Le repli sur kg/m² couvre les lignes
 * historiques dont l'unité n'est pas renseignée.
 */
export function formatRendement(val: number | null | undefined, unite?: string | null): string {
  if (val == null) return '-'
  const nombre = val.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${nombre} ${libelleUniteRendement(unite)}`
}

/**
 * Libellé court d'une unité de rendement, pour étiqueter un champ de saisie.
 * Tolère une valeur absente ou hors canon en retombant sur kg/m², comme
 * `formatRendement` — dont il porte désormais la moitié « unité ».
 */
export function libelleUniteRendement(unite: string | null | undefined): string {
  const cle = (unite ?? 'kg_m2') as typeof UNITE_RENDEMENT[number]
  return UNITE_RENDEMENT_LABELS[cle] ?? UNITE_RENDEMENT_LABELS.kg_m2
}

/**
 * Unité de rendement impliquée par le type d'espèce — SSOT de la règle que le
 * commentaire de UNITE_RENDEMENT énonçait en prose et que chaque écran
 * réimplémentait à sa façon.
 *
 * Ticket FB-E33FAA (2026-08-18) : trois versions coexistaient. La fiche espèce
 * dérivait `type === 'arbre_fruitier' ? 'kg/arbre' : 'kg/m²'`, donc étiquetait
 * en kg/m² les 11 engrais verts que le catalogue stocke en t/ha. L'écran de
 * CRÉATION, lui, affichait « Rendement (kg/m²) » en dur pour les sept types et
 * n'envoyait jamais `uniteRendement` : une espèce saisie à la main repartait
 * donc systématiquement en kg/m², quelle que soit sa nature. Même famille que
 * QA cmsqlu3os, où l'étiquette mentait sur des rendements par arbre.
 *
 * `ornement` reste en kg/m² : c'est la convention de docs/conventions.md et le
 * cas majoritaire des lignes existantes (bambou, ricin), même si trois ligneux
 * du catalogue portent kg/arbre. Une valeur déjà stockée n'est jamais réécrite
 * par cette fonction — elle ne sert qu'à la création et à l'étiquetage.
 */
export function uniteRendementParType(
  type: string | null | undefined
): typeof UNITE_RENDEMENT[number] {
  switch (type) {
    case 'arbre_fruitier':
      return 'kg_arbre'
    case 'engrais_vert':
      return 'biomasse_t_ha'
    default:
      return 'kg_m2'
  }
}

/**
 * Plafond de plausibilité du rendement, PAR UNITÉ.
 *
 * Le champ était borné à 100 tous types confondus, ce qui est cohérent en kg/m²
 * et absurde en kg/arbre : le catalogue lui-même porte 150 kg pour l'arbre à
 * pain et 100 pour l'avocatier, valeurs entrées par migration donc jamais
 * passées par zod. Un utilisateur ne pouvait pas déclarer son propre fruitier
 * au-delà de 100 kg/arbre, et le refus arrivait en « Données invalides » sans
 * nommer le champ. Le défaut restait invisible tant que l'écran affichait kg/m²
 * pour tout le monde ; l'afficher honnêtement le rend atteignable.
 */
const RENDEMENT_MAX: Record<typeof UNITE_RENDEMENT[number], number> = {
  kg_m2: 100,
  kg_arbre: 1000,
  biomasse_t_ha: 100,
}

/** Plafond le plus large, seul filet quand le payload n'établit aucune unité. */
const RENDEMENT_MAX_ABSOLU = Math.max(...Object.values(RENDEMENT_MAX))

/**
 * Borne le rendement contre l'unité que le payload ÉTABLIT, et seulement dans
 * ce cas.
 *
 * `updateEspeceSchema` est un `.partial()` : un PATCH peut porter `rendement`
 * seul, sans `uniteRendement` ni `type`. L'unité vit alors en base et ce schéma
 * ne peut pas la connaître — deviner « kg/m² » y refuserait précisément la
 * correction de rendement d'un arbre fruitier que cette borne existe pour
 * autoriser. Dans ce cas on s'en remet au plafond absolu du champ : mieux vaut
 * accepter une valeur qu'on ne sait pas juger que rejeter une saisie légitime.
 * La création, elle, porte toujours `type` (requis), donc reste bornée.
 */
function bornerRendement(
  data: {
    rendement?: number | null
    uniteRendement?: typeof UNITE_RENDEMENT[number]
    type?: typeof ESPECE_TYPES[number]
  },
  ctx: z.RefinementCtx
) {
  if (data.rendement == null) return
  const unite = data.uniteRendement ?? (data.type ? uniteRendementParType(data.type) : null)
  if (!unite) return
  const maximum = RENDEMENT_MAX[unite]
  if (data.rendement > maximum) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rendement'],
      message: `Rendement invraisemblable : maximum ${maximum} ${UNITE_RENDEMENT_LABELS[unite]}`,
    })
  }
}

// Catégories visuelles
export const ESPECE_CATEGORIES = [
  'racine', 'bulbe', 'feuille', 'fleur', 'fruit_legume', 'grain',
  'petit_fruit', 'fruit', 'agrume', 'engrais_vert', 'mellifere', 'bois', 'arbre', 'ornement'
] as const

/**
 * Libellés métier des catégories. Même règle que ESPECE_TYPE_LABELS : la
 * colonne stocke un slug snake_case, l'écran affiche du français.
 *
 * Ticket cmsx5wjsb (campagne QA du 2026-08-17) : la fiche espèce affichait le
 * code interne « fruit_legume » dans son champ Catégorie, et la liste
 * déroulante proposait « engrais_vert » et « petit_fruit » à choisir. Le
 * référentiel du verger, lui, avait déjà sa carte de libellés recopiée en
 * local — donc deux écrans, deux vérités, une seule accentuée.
 *
 * Exhaustif par construction sur ESPECE_CATEGORIES : ajouter une catégorie
 * sans son libellé casse la compilation.
 */
export const ESPECE_CATEGORIE_LABELS: Record<typeof ESPECE_CATEGORIES[number], string> = {
  racine: 'Racine',
  bulbe: 'Bulbe',
  feuille: 'Légume-feuille',
  fleur: 'Fleur',
  fruit_legume: 'Légume-fruit',
  grain: 'Grain',
  petit_fruit: 'Petit fruit',
  fruit: 'Fruit',
  agrume: 'Agrume',
  engrais_vert: 'Engrais vert',
  mellifere: 'Mellifère',
  bois: 'Bois',
  arbre: 'Arbre',
  ornement: 'Ornement',
}

/**
 * Valeurs héritées rencontrées en base hors ESPECE_CATEGORIES (17 espèces en
 * `fruitier`, quelques `legume`/`aromatique` datant du premier référentiel).
 * Elles restent VISIBLES sous un libellé lisible plutôt que sous leur slug.
 */
const ESPECE_CATEGORIE_LABELS_HERITES: Record<string, string> = {
  fruitier: 'Fruitier',
  arbre_fruitier: 'Arbre fruitier',
  legume: 'Légume',
  aromatique: 'Aromatique',
}

/**
 * Libellé affichable de la catégorie d'une espèce. Accepte un `string` : la
 * colonne est libre et le catalogue porte des valeurs héritées, parfois un
 * simple émoji — qui passe alors au travers, inchangé.
 */
export function libelleCategorieEspece(categorie: string | null | undefined): string {
  if (!categorie) return ''
  return (
    ESPECE_CATEGORIE_LABELS[categorie as typeof ESPECE_CATEGORIES[number]] ??
    ESPECE_CATEGORIE_LABELS_HERITES[categorie] ??
    categorie
  )
}

// Niveaux de difficulté
export const ESPECE_NIVEAUX = ['Facile', 'Moyen', 'Difficile'] as const

// Niveaux d'irrigation
// NB : la valeur 'Eleve' (sans accent) est l'identifiant STOCKÉ en base et
// comparé dans la logique (cf. api/cultures/irriguer, assistant-helpers). On la
// conserve telle quelle pour ne rien casser, mais on expose un libellé accentué
// pour l'affichage (Bug #8 testeur : « Eleve » → « Élevé »).
export const ESPECE_IRRIGATION = ['Faible', 'Moyen', 'Eleve'] as const

export const ESPECE_IRRIGATION_LABELS: Record<(typeof ESPECE_IRRIGATION)[number], string> = {
  Faible: 'Faible',
  Moyen: 'Moyen',
  Eleve: 'Élevé',
}

// Schéma de base pour une espece (correspond au modèle Prisma)
export const baseEspeceSchema = z.object({
  id: z.string().min(1, "Le nom de l'espèce est requis").max(100),
  type: z.enum(ESPECE_TYPES),
  uniteRendement: z.enum(UNITE_RENDEMENT).optional(),
  familleId: z.string().nullable().optional(),
  nomLatin: z.string().max(200).nullable().optional(),
  // Plafond du CHAMP = le plus large des plafonds par unité ; la borne fine,
  // qui dépend de l'unité, est posée par `bornerRendement` sur les deux schémas
  // exportés (un `.max(100)` uniforme interdisait tout rendement par arbre).
  rendement: z.number().min(0).max(RENDEMENT_MAX_ABSOLU).nullable().optional(),
  vivace: z.boolean(),
  besoinN: z.number().min(0).max(5).nullable().optional(),
  besoinP: z.number().min(0).max(5).nullable().optional(),
  besoinK: z.number().min(0).max(5).nullable().optional(),
  besoinEau: z.number().min(0).max(5).nullable().optional(),
  dateInventaire: z.union([z.string(), z.date()]).nullable().optional(),
  inventaire: z.number().min(0).nullable().optional(),
  aPlanifier: z.boolean(),
  couleur: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Format couleur invalide (#RRGGBB)").nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  // Champs métier complémentaires
  categorie: z.string().max(50).nullable().optional(),
  niveau: z.string().max(20).nullable().optional(),
  densite: z.number().min(0).max(1000).nullable().optional(),
  // Étalement/diamètre à maturité (m) — dessine l'empreinte de chaque plante
  // à l'échelle sur le plan 2D (équivalent potager de l'envergure des arbres)
  etalement: z.number().min(0.01).max(30).nullable().optional(),
  doseSemis: z.number().min(0).max(1000).nullable().optional(),
  // Audit Marc — unité explicite + type de culture pour empêcher les
  // saisies aberrantes (carotte avec date plantation, etc.)
  uniteDose: z.enum(['g_m2','pieces_m2','graines_plant','caieux_m2']).nullable().optional(),
  typeCultureSemis: z.enum(['semis_direct','pepiniere_puis_repiquage','plantation_bulbes_caieux','bouture']).nullable().optional(),
  tauxGermination: z.number().min(0).max(100).nullable().optional(),
  temperatureGerm: z.string().max(50).nullable().optional(),
  joursLevee: z.number().int().min(0).max(365).nullable().optional(),
  irrigation: z.string().max(20).nullable().optional(),
  conservation: z.boolean().nullable().optional(),
  effet: z.string().max(1000).nullable().optional(),
  usages: z.string().max(1000).nullable().optional(),
  objectifAnnuel: z.number().min(0).nullable().optional(),
  prixKg: z.number().min(0).nullable().optional(),
  semaineTaille: z.number().int().min(1).max(52).nullable().optional(),
})

// Schéma pour la création (id requis)
// `superRefine` produit un ZodEffects : les dérivations `.partial()`/`.omit()`
// se font donc sur `baseEspeceSchema`, jamais sur ces deux exports.
export const createEspeceSchema = baseEspeceSchema.superRefine(bornerRendement)

// Schéma pour la mise à jour (id optionnel, tous les champs optionnels)
export const updateEspeceSchema = baseEspeceSchema
  .partial()
  .omit({ id: true })
  .superRefine(bornerRendement)

// Types inférés
export type EspeceInput = z.infer<typeof baseEspeceSchema>
export type CreateEspeceInput = z.infer<typeof createEspeceSchema>
export type UpdateEspeceInput = z.infer<typeof updateEspeceSchema>
