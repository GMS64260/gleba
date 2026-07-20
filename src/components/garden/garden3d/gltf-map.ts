/**
 * Correspondance espèce / famille botanique → modèle glTF low-poly. Fonctions
 * pures (aucun import three). Le repli procédural n'intervient plus.
 *
 * - Cultures : pack Quaternius « Nature Crops » (CC0), converti OBJ→GLB dans
 *   `public/models/crops/` — 11 cultures × 5 stades (1→4 croissance, Crop =
 *   maturité). Le stade suit la croissance du « plan vivant ».
 * - Arbres : Kenney Nature Kit (CC0), `public/models/nature/`.
 * Licences CC0 : voir les fichiers CREDITS sous public/models/nature et crops.
 */

const NATURE_BASE = "/models/nature/"
const CROP_BASE = "/models/crops/"

const treeUrl = (n: string) => NATURE_BASE + n + ".glb"

// Cultures Quaternius disponibles (toutes ont les stades 1,2,3,4,Crop).
const CROP_BASES = ["Carrot", "Beet", "Tomato", "Lettuce", "Corn", "Wheat", "Pumpkin", "Watermelon", "BushBerries", "Bamboo", "Rice"]
const CROP_STAGES = ["1", "2", "3", "4"]

const TREE_MODELS = ["tree_oak", "tree_fat", "tree_detailed", "tree_small", "tree_cone", "tree_thin", "plant_bushLarge"]

/** Tous les fichiers à précharger (évite le « pop » et le flash au changement de stade). */
export const MODELES = [
  ...CROP_BASES.flatMap((b) => CROP_STAGES.map((s) => `${CROP_BASE}${b}_${s}.glb`)),
  ...TREE_MODELS.map((n) => treeUrl(n)),
]

/** minuscule + sans accents, pour matcher les noms français. */
function norm(s: string | null | undefined): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
}

/**
 * Stade discret d'une culture selon la croissance [0..1]. On s'arrête au stade
 * « plante sur pied » (_4) : le stade `_Crop` de Quaternius est le légume
 * RÉCOLTÉ (produit isolé) — moche une fois mis à l'échelle de la planche.
 */
function stage(c: number): string {
  return c < 0.3 ? "1" : c < 0.55 ? "2" : c < 0.8 ? "3" : "4"
}
const cropUrl = (base: string, c: number) => `${CROP_BASE}${base}_${stage(c)}.glb`

/**
 * Modèle glTF d'une culture — UNIQUEMENT si un modèle fidèle existe (le pack
 * gratuit ne couvre pas toutes les espèces). Renvoie `null` sinon : l'appelant
 * bascule alors sur un rendu procédural par famille (jamais de « faux légume »).
 * `croissance` pilote le stade.
 */
export function modelPourCulture(
  nom: string | null | undefined,
  familleId: string | null | undefined,
  croissance: number
): string | null {
  const n = norm(nom)
  // Espèces avec un modèle VRAIMENT fidèle (mot-clé)
  if (/carotte|panais/.test(n)) return cropUrl("Carrot", croissance)
  if (/betterave|radis|navet|rutabaga/.test(n)) return cropUrl("Beet", croissance)
  if (/tomate/.test(n)) return cropUrl("Tomato", croissance)
  if (/courge|courgette|potiron|citrouille|potimarron|butternut|concombre|cornichon|patisson/.test(n)) return cropUrl("Pumpkin", croissance)
  if (/melon|pasteque/.test(n)) return cropUrl("Watermelon", croissance)
  if (/mais/.test(n)) return cropUrl("Corn", croissance)
  if (/\bble\b|avoine|orge|seigle|cereale|epeautre|sarrasin/.test(n)) return cropUrl("Wheat", croissance)
  if (/riz/.test(n)) return cropUrl("Rice", croissance)
  if (/fraise|framboise|groseille|cassis|myrtille|mure/.test(n)) return cropUrl("BushBerries", croissance)
  if (/laitue|salade|mache|epinard|roquette|cresson|blette/.test(n)) return cropUrl("Lettuce", croissance)
  if (/poireau/.test(n)) return cropUrl("Bamboo", croissance)

  // Repli par famille : seulement là où le modèle représente bien toute la famille
  switch (familleId) {
    case "Apiaceae": return cropUrl("Carrot", croissance)
    case "Cucurbitaceae": return cropUrl("Pumpkin", croissance)
    case "Poaceae": return cropUrl("Wheat", croissance)
    case "Chenopodiaceae":
    case "Amaranthaceae": return cropUrl("Beet", croissance)
    default: return null // aubergine, poivron, oignon, ail, haricot, pois,
    // fève, basilic, pomme de terre, chou… → rendu procédural par famille
  }
}

/** Modèle glTF d'un arbre selon son type, varié de façon déterministe par id. */
export function modelPourArbre(type: string, seed: number): string {
  // Modèles ronds (rapport hauteur/largeur ~1,5–1,66) : évite les arbres
  // « tours » (tree_default 2,26 / tree_small 2,71 écartés du choix par défaut).
  const feuillus = ["tree_oak", "tree_fat", "tree_detailed"]
  switch (type) {
    case "petit_fruit": return treeUrl(seed % 2 ? "tree_small" : "plant_bushLarge")
    case "ornement": return treeUrl(seed % 2 ? "tree_cone" : "tree_thin")
    case "haie": return treeUrl("tree_thin")
    case "fruitier":
    default: return treeUrl(feuillus[seed % feuillus.length])
  }
}
