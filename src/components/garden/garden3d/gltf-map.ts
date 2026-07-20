/**
 * Correspondance espèce / famille botanique → modèle glTF low-poly (Kenney
 * Nature Kit, CC0). Fonctions pures (aucun import three). Le repli procédural
 * n'intervient plus que si un modèle échoue au chargement.
 *
 * Voir public/models/nature/CREDITS.md pour la licence (CC0).
 */

export const MODEL_BASE = "/models/nature/"

/** Tous les fichiers à précharger (useGLTF.preload). */
export const MODELES = [
  "tree_default", "tree_oak", "tree_fat", "tree_detailed", "tree_small", "tree_cone", "tree_thin",
  "crop_carrot", "crop_melon", "crop_pumpkin", "crop_turnip",
  "crops_cornStageA", "crops_cornStageB", "crops_cornStageC", "crops_cornStageD",
  "crops_wheatStageA", "crops_wheatStageB", "crops_leafsStageA", "crops_leafsStageB",
  "plant_bush", "plant_bushSmall", "plant_bushDetailed", "plant_bushLarge",
  "flower_redA", "flower_yellowA", "flower_purpleA", "grass_leafs",
].map((n) => MODEL_BASE + n + ".glb")

const url = (n: string) => MODEL_BASE + n + ".glb"

/** minuscule + sans accents, pour matcher les noms français. */
function norm(s: string | null | undefined): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
}

/** Stade discret d'un modèle multi-stades selon la croissance [0..1]. */
function stageCorn(c: number): string {
  return c < 0.3 ? "crops_cornStageA" : c < 0.55 ? "crops_cornStageB" : c < 0.8 ? "crops_cornStageC" : "crops_cornStageD"
}
function stage2(base: string, c: number): string {
  return c < 0.6 ? base + "StageA" : base + "StageB"
}

/**
 * Modèle glTF d'une culture. Résout d'abord par mot-clé du nom (français),
 * puis par famille botanique (id latin). `croissance` pilote le stade des
 * modèles multi-stades (maïs, blé, feuillus).
 */
export function modelPourCulture(
  nom: string | null | undefined,
  familleId: string | null | undefined,
  croissance: number
): string {
  const n = norm(nom)
  // Par mot-clé d'espèce
  if (/carotte|panais/.test(n)) return url("crop_carrot")
  if (/melon|pasteque/.test(n)) return url("crop_melon")
  if (/courge|courgette|potiron|citrouille|potimarron|butternut|concombre|cornichon/.test(n)) return url("crop_pumpkin")
  if (/navet|radis|betterave|rutabaga|topinambour/.test(n)) return url("crop_turnip")
  if (/mais|maïs/.test(n)) return url(stageCorn(croissance))
  if (/ble|avoine|orge|seigle|cereale|sarrasin|quinoa/.test(n)) return url(stage2("crops_wheat", croissance))
  if (/tomate|poivron|aubergine|piment/.test(n)) return url("plant_bush")
  if (/fraise|framboise|groseille|cassis|myrtille|mure|baie/.test(n)) return url("plant_bushLarge")
  if (/haricot|pois|feve|lentille|soja|pois-chiche/.test(n)) return url("plant_bushSmall")
  if (/basilic|thym|menthe|persil|coriandre|ciboulette|romarin|origan|sauge|aromate/.test(n)) return url("plant_bushDetailed")
  if (/salade|laitue|mache|epinard|roquette|chou|blette|poireau|oignon|ail|echalote|celeri|fenouil|artichaut|endive|cresson/.test(n))
    return url(stage2("crops_leafs", croissance))

  // Par famille botanique (id latin)
  switch (familleId) {
    case "Solanaceae": return url("plant_bush")
    case "Cucurbitaceae": return url("crop_pumpkin")
    case "Apiaceae": return url("crop_carrot")
    case "Poaceae": return url(stage2("crops_wheat", croissance))
    case "Fabaceae": return url("plant_bushSmall")
    case "Brassicaceae": return url(stage2("crops_leafs", croissance))
    case "Alliaceae":
    case "Amaryllidaceae": return url(stage2("crops_leafs", croissance))
    case "Lamiaceae": return url("plant_bushDetailed")
    case "Rosaceae": return url("plant_bushLarge")
    case "Asteraceae": return url("flower_yellowA")
    default: return url(stage2("crops_leafs", croissance)) // défaut : feuillu générique
  }
}

/** Modèle glTF d'un arbre selon son type, varié de façon déterministe par id. */
export function modelPourArbre(type: string, seed: number): string {
  const feuillus = ["tree_default", "tree_oak", "tree_fat", "tree_detailed"]
  switch (type) {
    case "petit_fruit": return url(seed % 2 ? "tree_small" : "plant_bushLarge")
    case "ornement": return url(seed % 2 ? "tree_cone" : "tree_thin")
    case "haie": return url("tree_thin")
    case "fruitier":
    default: return url(feuillus[seed % feuillus.length])
  }
}
