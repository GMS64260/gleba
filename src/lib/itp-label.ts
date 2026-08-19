const MOTS_ACCENTUES: Record<string, string> = {
  ete: "été",
  precoce: "précoce",
  precoces: "précoces",
  pepiniere: "pépinière",
  exterieur: "extérieur",
  interieur: "intérieur",
}

/**
 * Transforme un identifiant technique d'ITP en libellé lisible sans modifier
 * sa clé persistée (ex. `Radis-ete-serre` → `Radis · été · serre`).
 *
 * NE PAS appeler directement sur un libellé d'ITP : passer par
 * `nomAffichableItp`, qui décide si la transformation s'applique.
 */
export function libelleItp(value: string): string {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((mot, index) => {
      const normalise = mot
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
      const lisible = MOTS_ACCENTUES[normalise] ?? mot.toLowerCase()
      return index === 0
        ? lisible.charAt(0).toLocaleUpperCase("fr-FR") + lisible.slice(1)
        : lisible
    })
    .join(" · ")
}

export interface ItpNommable {
  id: string
  nom?: string | null
  /** null = catalogue Gleba officiel ; renseigné = libellé saisi par un membre. */
  userId?: string | null
  especeId?: string | null
  espece?: { id?: string | null; nom?: string | null } | null
  modeDemarrage?: string | null
  typePlanche?: string | null
}

/**
 * Suffixe « — implantation S14–S16 · S20–S31 » que les imports INRAE et fleurs
 * coupées ont figé dans le libellé.
 *
 * Ces semaines sont celles de la SOURCE. Les écrans affichent, eux, les semaines
 * transposées vers la zone de l'exploitation : le libellé finissait donc par
 * contredire la colonne d'à côté (« implantation S5–S7 » en titre, badge
 * « S6–S8 »). Un nom nomme, il ne redit pas les données de la ligne — et pour
 * distinguer deux scénarios d'une même espèce, `fenetreItp` recalcule la fenêtre
 * courante à l'affichage.
 */
const SUFFIXE_SEMAINES_SOURCE = /\s*—\s*implantation\s+S\d+.*$/i

/** Fenêtre d'implantation lisible d'un ITP, telle qu'il la porte MAINTENANT. */
export function fenetreItp(itp: {
  semaineImplantationDebut?: number | null
  semaineImplantationFin?: number | null
  semaineSemis?: number | null
  semainePlantation?: number | null
}): string | null {
  const debut = itp.semaineImplantationDebut ?? itp.semaineSemis ?? itp.semainePlantation
  if (!debut) return null
  const fin = itp.semaineImplantationFin
  return fin && fin !== debut ? `S${debut}–S${fin}` : `S${debut}`
}

/**
 * Nom d'un ITP tel qu'il doit apparaître à l'écran — la SEULE fonction à
 * appeler pour l'afficher, quel que soit l'écran.
 *
 * Trois cas, dans cet ordre :
 *
 *  1. Identifiant technique historique `ITP-…` : reconstruit depuis l'espèce,
 *     car cet identifiant ne veut rien dire pour un maraîcher.
 *  2. Libellé saisi par un membre (`userId` renseigné) : rendu TEL QUEL. Un
 *     libellé appartient à celui qui l'a tapé (règle du brain). C'était le sens
 *     du correctif QA cmswxyuoi côté serveur — mais le sélecteur d'ITP du
 *     formulaire de culture et l'assistant repassaient ensuite `libelleItp`
 *     dessus, si bien que « MARC-V7-Radis-automne-2026 » s'affichait
 *     « Marc · v7 · radis · automne · 2026 » et redevenait méconnaissable.
 *  3. Catalogue officiel : les 122 entrées historiques sont des slugs à tirets
 *     sans espace (`Ail-printemps`) que `libelleItp` rend lisibles ; les 648
 *     autres (INRAE, fleurs coupées) sont déjà des phrases françaises et
 *     contiennent des traits d'union à l'intérieur des mots (`Chou-fleur`) :
 *     les découper les abîmerait. La présence d'une espace tranche.
 */
export function nomAffichableItp(itp: ItpNommable): string {
  const brut = (itp.nom ?? itp.id) || itp.id
  if (/^ITP-/i.test(itp.id)) {
    const espece = itp.espece?.nom ?? itp.espece?.id ?? itp.especeId
    if (espece) {
      const mode = itp.modeDemarrage ?? itp.typePlanche ?? "plein champ"
      return `${espece} — ${mode.toLowerCase()}`
    }
    return brut
  }
  if (itp.userId) return brut
  const sansSemaines = brut.replace(SUFFIXE_SEMAINES_SOURCE, '')
  if (/\s/.test(sansSemaines)) return sansSemaines
  return libelleItp(sansSemaines)
}

/**
 * Nom + fenêtre courante, pour les listes déroulantes où plusieurs scénarios
 * d'une même espèce se suivent et ne se distinguent que par leur calendrier.
 * La fenêtre vient des données affichées (donc déjà recalées sur la zone de
 * l'exploitation), jamais du libellé figé par l'import.
 */
export function nomAffichableItpAvecFenetre(
  itp: ItpNommable & Parameters<typeof fenetreItp>[0]
): string {
  const nom = nomAffichableItp(itp)
  const fenetre = fenetreItp(itp)
  return fenetre ? `${nom} · impl. ${fenetre}` : nom
}

/**
 * Légende de la ligne « Implantation » d'un ITP.
 *
 * Deux écrans jumeaux la calculaient différemment : la liste ITP repliait sur
 * `modeDemarrage` — donc affichait « Sous abri », une CONDUITE, dans une colonne
 * qui annonce une OPÉRATION — et le tableau du Potager inférait « Plantation »
 * ou « Semis » de la seule présence d'une semaine de plantation. Le même
 * itinéraire portait donc deux légendes contradictoires selon l'écran, et l'une
 * des deux affirmait ce que la donnée ne dit pas.
 *
 * On n'affirme plus rien : le champ `implantation` de la source, ou rien.
 */
export function libelleImplantationItp(itp: {
  implantation?: string | null
}): string {
  return itp.implantation ?? "Non précisée"
}
