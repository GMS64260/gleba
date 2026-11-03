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
  mouton: "Mouton",
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
  escargot: "Escargot",
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
  chevre: { s: "chevreau / cabri", p: "chevreaux / cabris" },
  bouc: { s: "chevreau / cabri", p: "chevreaux / cabris" },
  brebis: { s: "agneau", p: "agneaux" },
  belier: { s: "agneau", p: "agneaux" },
  mouton: { s: "agneau", p: "agneaux" },
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
  pintade: { s: "pintadeau", p: "pintadeaux" },
  caille: { s: "cailleteau", p: "cailleteaux" },
  escargot: { s: "juvénile", p: "juvéniles" },
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
  const tete = (especeAnimaleId ?? "").split("_")[0].toLowerCase()
  return LIBELLE_PETIT[baseConnue(tete) ?? tete] ?? { s: "petit", p: "petits" }
}

/** Espèces de base dont les petits sortent d'un œuf couvé (volailles, oiseaux de compagnie). */
const BASES_ECLOSION = new Set([
  "poule", "canard", "oie", "dinde", "pintade", "caille",
  "perruche", "calopsitte", "inseparable", "perroquet", "canari", "mandarin",
])

/**
 * Vrai si la naissance de cette espèce est une éclosion et non une mise bas.
 *
 * Ticket cmv292a85 (QA 2026-10-10) — une couvée enregistrée sur un lot de
 * poules pondeuses s'intitulait « Mise bas » et proposait d'élever les
 * poussins « au biberon » : seul `dureeCouvaison` de la mère était lu, et le
 * lot n'en porte pas. Seule source pour le formulaire de naissance et sa liste.
 */
export function naitParEclosion(
  espece: { id?: string | null; dureeCouvaison?: number | null } | null | undefined
): boolean {
  if (!espece) return false
  if (espece.dureeCouvaison != null) return true
  return BASES_ECLOSION.has(especeBaseId((espece.id ?? "").toLowerCase()))
}

/** Pluriels que retirer le « s » ou le « x » final ne ramène pas au singulier. */
// Map, pas objet littéral : `constructor` ou `toString` ne doivent rien désigner.
const PLURIELS_IRREGULIERS = new Map<string, string>([["chevaux", "cheval"]])

/**
 * Espèce de base connue désignée par le premier segment d'un identifiant,
 * ramenée au singulier ; `undefined` pour un préfixe de profil personnel.
 *
 * Relecture de la PR #47 (2026-11-03) : l'identifiant d'un profil personnel
 * vient du nom saisi (`normaliserIdentifiantEspece`, « Poules pondeuses » →
 * `poules_pondeuses`). Sans le singulier, `poules_pondeuses` et
 * `poules_marans`, ou `chevres_alpines` et `chevres_saanen`, cessaient d'être
 * la même espèce dès que seul un préfixe connu groupe les profils.
 */
function baseConnue(segment: string): string | undefined {
  const tete = segment.toLowerCase()
  const irregulier = PLURIELS_IRREGULIERS.get(tete)
  if (irregulier) return irregulier
  if (libelleBaseConnue(tete) !== undefined) return tete
  if (/[sx]$/.test(tete) && libelleBaseConnue(tete.slice(0, -1)) !== undefined) return tete.slice(0, -1)
  return undefined
}

/** Groupe du catalogue connu (au singulier), sinon identité complète du profil personnel. */
export function especeBaseId(especeAnimaleId: string): string {
  return baseConnue(especeAnimaleId.split("_")[0]) ?? especeAnimaleId
}

export function especeBaseLabel(especeAnimaleId: string): string {
  // Le repli court est de l'affichage ; il ne sert pas à identifier un groupe.
  const tete = especeAnimaleId.split("_")[0] || especeAnimaleId
  const base = baseConnue(tete)
  return base !== undefined ? LIBELLES[base] : tete
}

/**
 * Libellé de l'espèce d'un animal ou d'un lot dans les listes (Animaux & Lots,
 * fiche lot, filtre Espèce) : une seule formule.
 *
 * - Préfixe d'id connu (catalogue, ou profil perso dont l'id commence par une
 *   espèce connue : « poule_sussex », « canard_barbarie_maison ») → espèce de
 *   base (« Poule », « Canard ») ; la race a sa propre colonne (Bug #10).
 * - Sinon → nom complet du profil. Ticket cmvnookz7 (QA 2026-10-25) : le
 *   profil « v8-Julien canard 25 octobre » (id `v8_julien_canard_25_octobre`)
 *   s'affichait « v8 », premier segment de son id, dans la liste des lots.
 *
 * Le premier segment brut ne reste qu'à défaut de nom.
 */
export function libelleEspeceAnimale(espece: { id: string; nom?: string | null }): string {
  const tete = espece.id.split("_")[0] || espece.id
  const base = baseConnue(tete)
  return base !== undefined ? LIBELLES[base] : (espece.nom?.trim() || tete)
}

/** Libellé d'une espèce de base connue ; `undefined` pour un préfixe de profil perso. */
function libelleBaseConnue(base: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(LIBELLES, base) ? LIBELLES[base] : undefined
}

/**
 * Clé du filtre Espèce (option ET prédicat de ligne) : l'espèce de base si le
 * préfixe d'id est connu (« poule_sussex » et « poule_marans » → « poule »),
 * sinon l'id complet du profil. Revue du ticket cmvnookz7 : « Mes poules » et
 * « Mes canards » (ids `mes_poules`, `mes_canards`) fusionnaient sous « mes ».
 */
export function cleFiltreEspece(especeAnimaleId: string): string {
  const base = especeBaseId(especeAnimaleId)
  return libelleBaseConnue(base) !== undefined ? base : especeAnimaleId
}

/**
 * Renvoie la liste des espèces de base (sans race) effectivement
 * présentes sur la ferme, dédupliquées par `cleFiltreEspece` (un profil perso
 * hors catalogue est sa propre entrée), triées par libellé.
 *
 * Accepte n'importe quelle collection d'objets qui expose
 * `especeAnimaleId` (ou un champ équivalent), et le nom du profil
 * (`especeNom`) pour libeller un profil personnalisé.
 */
export function listEspecesBasePresentes(
  items: Array<{ especeAnimaleId: string; especeNom?: string | null }>
): Array<{ id: string; label: string }> {
  const map = new Map<string, string>()
  for (const it of items) {
    const id = cleFiltreEspece(it.especeAnimaleId)
    if (!map.has(id)) map.set(id, libelleEspeceAnimale({ id: it.especeAnimaleId, nom: it.especeNom }))
  }
  return Array.from(map.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"))
}
