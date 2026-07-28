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
  // Phase 0 modes d'élevage — filières compagnie / équin / NAC.
  // Tout id du catalogue (cf. catalogue-compagnie.ts) doit avoir son libellé
  // ici : le test `catalogue-compagnie.test.ts` le vérifie.
  chien: "Chien",
  chat: "Chat",
  poney: "Poney",
  mulet: "Mulet",
  furet: "Furet",
  cobaye: "Cochon d'Inde",
  hamster: "Hamster",
  rat: "Rat",
  souris: "Souris",
  gerbille: "Gerbille",
  chinchilla: "Chinchilla",
  octodon: "Octodon",
  perruche: "Perruche",
  calopsitte: "Calopsitte",
  inseparable: "Inséparable",
  perroquet: "Perroquet",
  canari: "Canari",
  mandarin: "Diamant mandarin",
  tortue: "Tortue",
  gecko: "Gecko",
  pogona: "Agame barbu",
  serpent: "Serpent",
  python: "Python",
  axolotl: "Axolotl",
}

// Vocabulaire du « petit » par espèce de base (singulier/pluriel). Corrige le
// biais historique « cabri » et donne chiot/chaton pour la filière compagnie.
const LIBELLE_PETIT: Record<string, { s: string; p: string }> = {
  chien: { s: "chiot", p: "chiots" },
  chat: { s: "chaton", p: "chatons" },
  chevre: { s: "cabri", p: "cabris" },
  bouc: { s: "cabri", p: "cabris" },
  brebis: { s: "agneau", p: "agneaux" },
  belier: { s: "agneau", p: "agneaux" },
  agneau: { s: "agneau", p: "agneaux" },
  vache: { s: "veau", p: "veaux" },
  taureau: { s: "veau", p: "veaux" },
  cochon: { s: "porcelet", p: "porcelets" },
  porc: { s: "porcelet", p: "porcelets" },
  lapin: { s: "lapereau", p: "lapereaux" },
  cheval: { s: "poulain", p: "poulains" },
  jument: { s: "poulain", p: "poulains" },
  poney: { s: "poulain", p: "poulains" },
  mulet: { s: "poulain", p: "poulains" },
  ane: { s: "ânon", p: "ânons" },
  furet: { s: "fureton", p: "furetons" },
  poule: { s: "poussin", p: "poussins" },
  canard: { s: "caneton", p: "canetons" },
  oie: { s: "oison", p: "oisons" },
  dinde: { s: "dindonneau", p: "dindonneaux" },
  // NAC — rongeurs, oiseaux, reptiles (cf. catalogue-compagnie.ts).
  cobaye: { s: "jeune cobaye", p: "jeunes cobayes" },
  hamster: { s: "bébé hamster", p: "bébés hamsters" },
  rat: { s: "raton", p: "ratons" },
  souris: { s: "souriceau", p: "souriceaux" },
  gerbille: { s: "bébé gerbille", p: "bébés gerbilles" },
  chinchilla: { s: "bébé chinchilla", p: "bébés chinchillas" },
  octodon: { s: "bébé octodon", p: "bébés octodons" },
  perruche: { s: "oisillon", p: "oisillons" },
  calopsitte: { s: "oisillon", p: "oisillons" },
  inseparable: { s: "oisillon", p: "oisillons" },
  perroquet: { s: "oisillon", p: "oisillons" },
  canari: { s: "oisillon", p: "oisillons" },
  mandarin: { s: "oisillon", p: "oisillons" },
  tortue: { s: "juvénile", p: "juvéniles" },
  gecko: { s: "juvénile", p: "juvéniles" },
  pogona: { s: "juvénile", p: "juvéniles" },
  serpent: { s: "juvénile", p: "juvéniles" },
  python: { s: "juvénile", p: "juvéniles" },
  axolotl: { s: "juvénile", p: "juvéniles" },
}

/** Terme du « petit » (chiot, chaton, cabri, agneau…) dérivé de l'espèce ; défaut « petit ». */
export function libellePetit(especeAnimaleId: string | null | undefined): { s: string; p: string } {
  const base = (especeAnimaleId ?? "").split("_")[0].toLowerCase()
  return LIBELLE_PETIT[base] ?? { s: "petit", p: "petits" }
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
