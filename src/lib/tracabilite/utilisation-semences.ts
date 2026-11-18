/**
 * Registre phytosanitaire : semences et plants traités.
 *
 * Arrêté du 24 décembre 2025 relatif à la tenue des registres d'utilisation
 * des produits phytopharmaceutiques (NOR AGRG2536515A) :
 *  - article 2 : « Le semis des semences traitées avec un produit fait
 *    également l'objet d'un enregistrement lorsque le traitement des semences
 *    n'a pas été réalisé et enregistré dans ce même établissement. » ;
 *  - annexe II, tableau C : traitement de semences ou de plants ;
 *  - annexe II, tableau D : semis de semences traitées, lorsque le traitement
 *    n'a pas été enregistré au point C par le même établissement.
 * Règlement d'exécution (UE) 2023/564, annexe, ligne « Traitement des semences
 * ou du matériel de reproduction des végétaux ».
 *
 * Source unique des règles des deux cas : périmètre de lecture, mentions
 * obligatoires manquantes, mise en forme réglementaire. Appelée par la saisie
 * (/api/interventions), le registre (`genererRegistrePhyto`) et son export.
 * Module pur (aucun accès base).
 */

export const UTILISATION_TRAITEMENT_SEMENCES = 'traitement_semences'
export const UTILISATION_SEMIS_TRAITE = 'semis_semences_traitees'
export const UTILISATIONS_SEMENCES = [UTILISATION_TRAITEMENT_SEMENCES, UTILISATION_SEMIS_TRAITE] as const
export type UtilisationSemences = (typeof UTILISATIONS_SEMENCES)[number]

/** Type d'utilisation d'une ligne du registre (annexe II, tableaux A, C et D). */
export type TypeUtilisationRegistre = 'surface' | UtilisationSemences

export const LIBELLES_UTILISATION: Record<TypeUtilisationRegistre, string> = {
  surface: 'Traitement de surface',
  traitement_semences: 'Traitement de semences ou de plants',
  semis_semences_traitees: 'Semis de semences traitées',
}

export function estUtilisationSemences(v: unknown): v is UtilisationSemences {
  return typeof v === 'string' && (UTILISATIONS_SEMENCES as readonly string[]).includes(v)
}

/** Type d'utilisation d'une intervention : NULL en base = traitement de surface. */
export function typeUtilisation(i: { utilisationPhyto?: string | null }): TypeUtilisationRegistre {
  return estUtilisationSemences(i.utilisationPhyto) ? i.utilisationPhyto : 'surface'
}

/**
 * Types d'intervention compatibles avec chaque utilisation. Le traitement (C)
 * est une utilisation de produit : `traitement_phyto`. Le cas D est un semis ;
 * la plantation de plants achetés traités est admise à la saisie (décision du
 * 2026-11-13), bien que le tableau D ne nomme que les semences.
 */
const TYPES_INTERVENTION: Record<UtilisationSemences, readonly string[]> = {
  traitement_semences: ['traitement_phyto'],
  semis_semences_traitees: ['semis', 'plantation'],
}

/** Message de refus si le couple (type d'intervention, utilisation) est incohérent, sinon null. */
export function refusUtilisation(type: string, utilisationPhyto: string | null | undefined): string | null {
  if (utilisationPhyto == null) return null
  if (!estUtilisationSemences(utilisationPhyto)) return "Type d'utilisation phytosanitaire inconnu."
  if (TYPES_INTERVENTION[utilisationPhyto].includes(type)) return null
  return utilisationPhyto === UTILISATION_TRAITEMENT_SEMENCES
    ? 'Un traitement de semences ou de plants est une intervention de type « traitement phytosanitaire ».'
    : 'Un semis de semences traitées est une intervention de type « semis » ou « plantation ».'
}

/**
 * Intervention qui figure au registre phytosanitaire : traitement réalisé
 * (tableaux A et C) ou semis réalisé de semences traitées (tableau D).
 */
export function interventionFigureAuRegistre(i: {
  type: string
  fait: boolean
  utilisationPhyto?: string | null
}): boolean {
  if (!i.fait) return false
  return i.type === 'traitement_phyto' || i.utilisationPhyto === UTILISATION_SEMIS_TRAITE
}

/**
 * Filtre Prisma des interventions du registre, à combiner avec `userId`,
 * `fait: true` et la période. Partagé par le registre et son export.
 */
export const FILTRE_INTERVENTIONS_REGISTRE = {
  OR: [{ type: 'traitement_phyto' }, { utilisationPhyto: UTILISATION_SEMIS_TRAITE }],
}

// ---------------------------------------------------------------------------
// Localisation
// ---------------------------------------------------------------------------

/** Annexe II, tableaux C et D : « [-]deg.ddddd , [-]deg.ddddd » (WGS84, cinq décimales). */
export function coordonneesDecimales(lat: number | null | undefined, lng: number | null | undefined): string | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return `${lat.toFixed(5)} , ${lng.toFixed(5)}`
}

/** Coordonnées figées dans la localisation du contexte (« GPS 43.2951234, -0.3707890 (WGS84) »). */
export function gpsDeLocalisation(localisation: string | null | undefined): { lat: number; lng: number } | null {
  const m = localisation?.match(/GPS (-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)/)
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null
}

/** Référence RPG complète (îlot, parcelle, code commune Insee), sinon null. */
export function referenceRpg(i: {
  rpgIlot?: string | null
  rpgParcelle?: string | null
  rpgCommuneInsee?: string | null
}): string | null {
  if (!i.rpgIlot || !i.rpgParcelle || !i.rpgCommuneInsee) return null
  return `îlot ${i.rpgIlot}, parcelle ${i.rpgParcelle}, commune ${i.rpgCommuneInsee}`
}

// ---------------------------------------------------------------------------
// Projection et mentions manquantes
// ---------------------------------------------------------------------------

export interface LigneSemences {
  utilisationPhyto?: string | null
  produit: string | null | undefined
  numAMM: string | null | undefined
  numAMMValide: boolean
  /** Le produit relève d'une autorisation (hors substances de base, PNPP…). */
  ammExigee: boolean
  substancesActives?: string | null
  doseAppliquee?: number | null
  uniteDose?: string | null
  quantiteSemences?: number | null
  uniteQuantiteSemences?: string | null
  densiteSemis?: number | null
  uniteDensiteSemis?: string | null
  surfaceM2: number | null
  gpsLat?: number | null
  gpsLng?: number | null
  rpgIlot?: string | null
  rpgParcelle?: string | null
  rpgCommuneInsee?: string | null
  culture: string | null | undefined
  localisationRegistre: string | null | undefined
  conduiteBio: boolean | null | undefined
}

/** Point représentatif d'une ligne : coordonnées saisies, sinon celles figées dans le contexte. */
export function pointRepresentatif(l: {
  utilisationPhyto?: string | null
  gpsLat?: number | null
  gpsLng?: number | null
  localisationRegistre?: string | null
}): string | null {
  const saisi = coordonneesDecimales(l.gpsLat, l.gpsLng)
  if (saisi) return saisi
  // Tableau C : l'installation de traitement n'est pas la parcelle du contexte.
  if (l.utilisationPhyto === UTILISATION_TRAITEMENT_SEMENCES) return null
  const fige = gpsDeLocalisation(l.localisationRegistre)
  return fige ? coordonneesDecimales(fige.lat, fige.lng) : null
}

/**
 * Mentions OBLIGATOIRES manquantes d'une ligne C ou D (clés stables, libellés
 * dans `LIBELLES_MENTIONS_SEMENCES`). Les mentions « le cas échéant » de
 * l'annexe I (numéro de lot, SIRET du bénéficiaire d'une prestation) ne sont
 * jamais signalées manquantes : leur absence ne prouve rien.
 */
export function champsManquantsSemences(l: LigneSemences): string[] {
  const manquants: string[] = []
  if (!l.produit?.trim()) manquants.push('produitPhyto')
  if (l.utilisationPhyto === UTILISATION_TRAITEMENT_SEMENCES) {
    // Tableau C : numéro d'autorisation (7 chiffres), dose, installation,
    // quantité traitée, dénomination de la culture. La conduite biologique
    // n'est pas une colonne du tableau C, mais c'est une mention commune de
    // l'annexe I (item 11) : le préambule de l'annexe II n'en laisse libre que
    // le format, sans en dispenser le traitement de semences ou de plants.
    if (l.ammExigee && !l.numAMM) manquants.push('numAMM')
    else if (l.numAMM && !l.numAMMValide) manquants.push('numAMM invalide')
    if (!l.doseAppliquee) manquants.push('doseAppliquee')
    else if (!l.uniteDose?.trim()) manquants.push('uniteDose')
    if (!pointRepresentatif(l)) manquants.push('localisationInstallation')
    if (!l.quantiteSemences) manquants.push('quantiteSemences')
    else if (!l.uniteQuantiteSemences?.trim()) manquants.push('uniteQuantiteSemences')
    if (!l.culture?.trim()) manquants.push('culture')
    if (l.conduiteBio == null) manquants.push('conduiteBio')
    return manquants
  }
  // Tableau D : le numéro d'autorisation n'y figure pas ; seul un numéro saisi
  // et mal formé est signalé.
  if (l.numAMM && !l.numAMMValide) manquants.push('numAMM invalide')
  if (!l.substancesActives?.trim()) manquants.push('substancesActives')
  if (!referenceRpg(l) && !pointRepresentatif(l)) manquants.push('localisationSemis')
  if (!l.surfaceM2) manquants.push('surfaceSemee')
  if (!l.densiteSemis) manquants.push('densiteSemis')
  else if (!l.uniteDensiteSemis?.trim()) manquants.push('uniteDensiteSemis')
  if (!l.culture?.trim()) manquants.push('culture')
  if (l.conduiteBio == null) manquants.push('conduiteBio')
  return manquants
}

/** Libellés des mentions manquantes propres aux tableaux C et D. */
export const LIBELLES_MENTIONS_SEMENCES: Record<string, string> = {
  produitPhyto: 'Produit',
  numAMM: "Numéro d'autorisation du produit",
  'numAMM invalide': "Numéro d'autorisation invalide (7 chiffres)",
  doseAppliquee: 'Dose utilisée',
  uniteDose: 'Unité de la dose',
  localisationInstallation: "Localisation de l'installation de traitement (GPS)",
  quantiteSemences: 'Quantité de semences ou plants traitée',
  uniteQuantiteSemences: 'Unité de la quantité traitée',
  substancesActives: 'Substance(s) active(s)',
  localisationSemis: 'Localisation de la surface semée (référence RPG ou GPS)',
  surfaceSemee: 'Surface semée',
  densiteSemis: 'Densité de semis',
  uniteDensiteSemis: 'Unité de la densité de semis',
  culture: 'Dénomination de la culture',
  conduiteBio: 'Conduite biologique de la production',
}

/** « 12,5 kg » : valeur et unité d'une grandeur « Numérique + unité ». */
function grandeur(valeur: number | null | undefined, unite: string | null | undefined): string | null {
  if (valeur == null) return null
  return `${valeur} ${unite ?? ''}`.trim()
}

/**
 * Colonnes des tableaux C et D d'une intervention, communes à l'écran du
 * registre et à son export. Toutes nulles pour un traitement de surface.
 */
export function mentionsSemences(i: {
  utilisationPhyto?: string | null
  substancesActives?: string | null
  quantiteSemences?: number | null
  uniteQuantiteSemences?: string | null
  densiteSemis?: number | null
  uniteDensiteSemis?: string | null
  gpsLat?: number | null
  gpsLng?: number | null
  rpgIlot?: string | null
  rpgParcelle?: string | null
  rpgCommuneInsee?: string | null
  localisationRegistre?: string | null
  surfaceM2?: number | null
}) {
  const type = typeUtilisation(i)
  const semences = type !== 'surface'
  return {
    typeUtilisation: type,
    typeUtilisationLibelle: LIBELLES_UTILISATION[type],
    substancesActives: semences ? i.substancesActives ?? null : null,
    quantiteSemences: type === UTILISATION_TRAITEMENT_SEMENCES ? i.quantiteSemences ?? null : null,
    uniteQuantiteSemences: type === UTILISATION_TRAITEMENT_SEMENCES ? i.uniteQuantiteSemences ?? null : null,
    quantiteSemencesTexte:
      type === UTILISATION_TRAITEMENT_SEMENCES ? grandeur(i.quantiteSemences, i.uniteQuantiteSemences) : null,
    densiteSemis: type === UTILISATION_SEMIS_TRAITE ? i.densiteSemis ?? null : null,
    uniteDensiteSemis: type === UTILISATION_SEMIS_TRAITE ? i.uniteDensiteSemis ?? null : null,
    densiteSemisTexte: type === UTILISATION_SEMIS_TRAITE ? grandeur(i.densiteSemis, i.uniteDensiteSemis) : null,
    surfaceSemeeM2: type === UTILISATION_SEMIS_TRAITE ? i.surfaceM2 ?? null : null,
    localisationInstallation:
      type === UTILISATION_TRAITEMENT_SEMENCES ? coordonneesDecimales(i.gpsLat, i.gpsLng) : null,
    localisationRpg: type === UTILISATION_SEMIS_TRAITE ? referenceRpg(i) : null,
    rpgIlot: type === UTILISATION_SEMIS_TRAITE ? i.rpgIlot ?? null : null,
    rpgParcelle: type === UTILISATION_SEMIS_TRAITE ? i.rpgParcelle ?? null : null,
    rpgCommuneInsee: type === UTILISATION_SEMIS_TRAITE ? i.rpgCommuneInsee ?? null : null,
    localisationGpsSemis: type === UTILISATION_SEMIS_TRAITE ? pointRepresentatif(i) : null,
  }
}

/** Mentions « à compléter » lisibles d'une ligne C ou D. */
export function mentionsACompleter(cles: string[]): string[] {
  return cles.map((cle) => LIBELLES_MENTIONS_SEMENCES[cle] ?? cle)
}
