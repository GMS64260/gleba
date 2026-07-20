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
const CROP_STAGES = ["1", "2", "3", "4", "Crop"]

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

/** Stade discret d'une culture selon la croissance [0..1]. */
function stage(c: number): string {
  return c < 0.25 ? "1" : c < 0.45 ? "2" : c < 0.65 ? "3" : c < 0.85 ? "4" : "Crop"
}
const cropUrl = (base: string, c: number) => `${CROP_BASE}${base}_${stage(c)}.glb`

/**
 * Modèle glTF d'une culture. Résout par mot-clé du nom (français), puis par
 * famille botanique (id latin). `croissance` pilote le stade.
 */
export function modelPourCulture(
  nom: string | null | undefined,
  familleId: string | null | undefined,
  croissance: number
): string {
  const n = norm(nom)
  // Par mot-clé d'espèce
  if (/carotte|panais/.test(n)) return cropUrl("Carrot", croissance)
  if (/navet|radis|betterave|rutabaga|topinambour|celeri-rave/.test(n)) return cropUrl("Beet", croissance)
  if (/tomate|poivron|aubergine|piment/.test(n)) return cropUrl("Tomato", croissance)
  if (/courge|courgette|potiron|citrouille|potimarron|butternut|concombre|cornichon|patisson/.test(n)) return cropUrl("Pumpkin", croissance)
  if (/melon|pasteque/.test(n)) return cropUrl("Watermelon", croissance)
  if (/mais/.test(n)) return cropUrl("Corn", croissance)
  if (/ble|avoine|orge|seigle|cereale|sarrasin|epeautre/.test(n)) return cropUrl("Wheat", croissance)
  if (/riz/.test(n)) return cropUrl("Rice", croissance)
  if (/fraise|framboise|groseille|cassis|myrtille|mure|baie|cranberry/.test(n)) return cropUrl("BushBerries", croissance)
  if (/haricot|pois|feve|lentille|soja/.test(n)) return cropUrl("BushBerries", croissance)
  if (/poireau|oignon|ail|echalote|ciboule/.test(n)) return cropUrl("Bamboo", croissance)
  if (/salade|laitue|mache|epinard|roquette|chou|blette|celeri|fenouil|artichaut|endive|cresson|basilic|persil|aromate|menthe|thym/.test(n))
    return cropUrl("Lettuce", croissance)

  // Par famille botanique (id latin)
  switch (familleId) {
    case "Solanaceae": return cropUrl("Tomato", croissance)
    case "Cucurbitaceae": return cropUrl("Pumpkin", croissance)
    case "Apiaceae": return cropUrl("Carrot", croissance)
    case "Poaceae": return cropUrl("Wheat", croissance)
    case "Fabaceae": return cropUrl("BushBerries", croissance)
    case "Brassicaceae": return cropUrl("Lettuce", croissance)
    case "Alliaceae":
    case "Amaryllidaceae": return cropUrl("Bamboo", croissance)
    case "Chenopodiaceae":
    case "Amaranthaceae": return cropUrl("Beet", croissance)
    case "Rosaceae": return cropUrl("BushBerries", croissance)
    default: return cropUrl("Lettuce", croissance) // défaut : feuillu générique
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
