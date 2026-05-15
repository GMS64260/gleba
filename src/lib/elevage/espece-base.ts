/**
 * QA Julien 2026-05-15 — Bug #9 : le filtre "Espèce" listait tout le
 * référentiel `especes_animales` qui mélange espèce et race
 * (Lacaune, Sussex, Charolaise, …). Pour Julien, "Espèce" =
 * Poule / Brebis / Chèvre / Cochon / Vache / Lapin (niveau supérieur).
 *
 * Convention `EspeceAnimale.id` (cf. seed) : `<espece>_<race>` →
 * "poule_marans", "brebis_solognote", "vache_charolaise"…
 *
 * On extrait le préfixe pour obtenir l'espèce de base, et on mappe
 * vers le libellé FR pluriel pour le sélecteur. Inconnu → on retombe
 * sur l'id complet (defensive).
 */

const LIBELLES: Record<string, string> = {
  poule: "Poule",
  poulet: "Poulet",
  canard: "Canard",
  oie: "Oie",
  dinde: "Dinde",
  pintade: "Pintade",
  caille: "Caille",
  brebis: "Brebis",
  agneau: "Agneau",
  belier: "Bélier",
  chevre: "Chèvre",
  bouc: "Bouc",
  chevreau: "Chevreau",
  vache: "Vache",
  taureau: "Taureau",
  veau: "Veau",
  cochon: "Cochon",
  porc: "Porc",
  porcelet: "Porcelet",
  lapin: "Lapin",
  cheval: "Cheval",
  chevaux: "Chevaux",
  ane: "Âne",
  abeille: "Abeille",
}

export function especeBaseId(especeAnimaleId: string): string {
  const head = especeAnimaleId.split("_")[0]
  return head || especeAnimaleId
}

export function especeBaseLabel(especeAnimaleId: string): string {
  const base = especeBaseId(especeAnimaleId)
  return LIBELLES[base] ?? base
}

/**
 * Renvoie la liste des espèces de base (sans race) effectivement
 * présentes sur la ferme, dédupliquées, triées par libellé.
 *
 * Accepte n'importe quelle collection d'objets qui expose
 * `especeAnimaleId` (ou un champ équivalent).
 */
export function listEspecesBasePresentes(
  items: Array<{ especeAnimaleId: string }>
): Array<{ id: string; label: string }> {
  const map = new Map<string, string>()
  for (const it of items) {
    const id = especeBaseId(it.especeAnimaleId)
    if (!map.has(id)) map.set(id, especeBaseLabel(it.especeAnimaleId))
  }
  return Array.from(map.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"))
}
