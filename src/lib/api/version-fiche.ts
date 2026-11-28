/**
 * Version de fiche : « la fiche que vous avez ouverte est-elle encore celle de
 * la base ? »
 *
 * Un formulaire de fiche renvoie tous ses champs. Resté ouvert dans un autre
 * onglet, sur un autre appareil ou chez un autre membre, il réécrivait avec
 * ses valeurs d'origine ce qui venait d'être changé ailleurs. Chaque fiche
 * porte un numéro `version` ; l'écran le mémorise au chargement et le renvoie
 * sous `versionLue` ; la route refuse en 409 s'il a changé, sinon écrit et
 * incrémente DANS LA MÊME ÉCRITURE (un `UPDATE` séparé relancerait les
 * déclencheurs de la table).
 *
 * Qui incrémente : toute écriture qui change un champ que le formulaire
 * renvoie (la route du formulaire, les gestes, l'assistant, les imports). Une
 * écriture dérivée (dernier arrosage, stock recalculé) n'incrémente pas :
 * c'est ce qui évite les faux refus du verrou par `updatedAt`
 * (`version-lue.ts`), qui bougeait à chaque écriture.
 *
 * La clé du corps est `versionLue`, jamais `version` : des écrans renvoient
 * l'objet entier reçu du serveur. Un appelant qui ne l'envoie pas (assistant,
 * script, onglet ouvert avant la mise en service) garde le comportement
 * d'avant.
 */
import { NextResponse } from 'next/server'
import { CODE_MODIFIE_AILLEURS } from './version-lue'

/** `'aucune'` : l'écran n'a vu aucune fiche (création attendue par un upsert). */
export type VersionLue = number | 'aucune' | undefined

export const INCREMENT_VERSION = { version: { increment: 1 } } as const

export type LectureVersion =
  | { ok: true; version: VersionLue; ancienneDate?: string }
  | { ok: false; erreur: string }

/**
 * Lit `versionLue` dans le corps brut. Une chaîne de date est l'ancien
 * protocole (verrou par `updatedAt`) d'un onglet ouvert avant la mise en
 * service : elle est rendue à part, pour être contrôlée comme avant.
 */
export function lireVersionLue(corps: unknown): LectureVersion {
  const brute = corps && typeof corps === 'object' ? (corps as Record<string, unknown>).versionLue : undefined
  if (brute === undefined || brute === null || brute === '') return { ok: true, version: undefined }
  if (brute === 'aucune') return { ok: true, version: 'aucune' }
  if (typeof brute === 'number' && Number.isInteger(brute) && brute >= 0) return { ok: true, version: brute }
  if (typeof brute === 'string' && !Number.isNaN(new Date(brute).getTime()) && /\d{4}-\d{2}-\d{2}T/.test(brute)) {
    return { ok: true, version: undefined, ancienneDate: brute }
  }
  return { ok: false, erreur: 'Version de fiche illisible.' }
}

/** Vrai si une version a été lue par l'écran et qu'elle n'est plus celle de la base. */
export function versionFichePerimee(lue: VersionLue, enBase: { version: number } | null | undefined): boolean {
  if (lue === undefined) return false
  if (lue === 'aucune') return enBase != null
  return enBase == null || enBase.version !== lue
}

const messageFicheModifiee = (quoi: string) =>
  `${quoi} : cette fiche a été modifiée depuis son ouverture (autre onglet, autre appareil ou autre membre). Rien n'a été enregistré.`

/** Refus 409 commun, avec la version actuelle pour que l'écran puisse recharger ou insister. */
export function reponseFicheModifiee(quoi: string, versionActuelle: number | null): NextResponse {
  return NextResponse.json(
    { error: messageFicheModifiee(quoi), code: CODE_MODIFIE_AILLEURS, versionActuelle },
    { status: 409 },
  )
}

/** Le même refus, à lever depuis une transaction ou du code de bibliothèque. */
export class FicheModifieeAilleurs extends Error {
  constructor(readonly quoi: string, readonly versionActuelle: number | null) {
    super(messageFicheModifiee(quoi))
  }
  reponse(): NextResponse {
    return reponseFicheModifiee(this.quoi, this.versionActuelle)
  }
}

/**
 * Champs qu'aucun formulaire de fiche ne renvoie : les écrire seuls ne fait
 * pas avancer la version (sinon, faux refus sur le formulaire ouvert à côté).
 */
export const CHAMPS_HORS_FICHE = {
  culture: ['aIrriguer', 'derniereIrrigation'],
  recolte: ['statut', 'dateVente', 'dateSortie', 'prixKg', 'prixTotal', 'clientId', 'clientNom', 'factureId', 'consommationId', 'stockDisponibleCommercial', 'recolteOrigineId'],
} as const

/** `data` complété de l'incrément si l'écriture touche autre chose que des champs hors fiche. */
export function avecVersionSiFiche<T extends object>(data: T, horsFiche: readonly string[]): T & { version?: { increment: 1 } } {
  return Object.keys(data).some((cle) => (data as Record<string, unknown>)[cle] !== undefined && !horsFiche.includes(cle))
    ? { ...data, ...INCREMENT_VERSION }
    : data
}

/** Tables dotées d'une version de fiche et d'une clé primaire `id`. */
export type TableAVersion =
  | 'itps' | 'especes' | 'varietes' | 'associations' | 'rotations'
  | 'arbres' | 'objets_jardin' | 'lots_arbres' | 'recoltes_arbres' | 'observations_sante' | 'parcelles_geo'
  | 'animaux' | 'lots_animaux' | 'naissances_animales' | 'saillies' | 'especes_animales'
  | 'abattages' | 'ventes_produits' | 'production_oeufs' | 'productions_ruche'
  | 'soins_animaux' | 'consommations_aliments' | 'plans_ration' | 'reservations_elevage'
  | 'justificatifs_aliments_elevage' | 'justificatifs_equarrissage_elevage' | 'prophylaxies_elevage'
  | 'lieux_detention_elevage' | 'intervenants_elevage'
  | 'clients' | 'fournisseurs' | 'documents_commerciaux' | 'boutiques' | 'commandes_boutique'

type TransactionBrute = { $queryRawUnsafe: <T = unknown>(requete: string, ...valeurs: unknown[]) => Promise<T> }

/**
 * Dans une transaction : verrouille la ligne, relit sa version et lève
 * `FicheModifieeAilleurs` si l'écran en a lu une autre. À appeler AVANT toute
 * écriture ; l'écriture qui suit porte `INCREMENT_VERSION`. Deux
 * enregistrements concurrents porteurs de la même version ne passent pas tous
 * les deux : le second attend le verrou, relit la version avancée et est
 * refusé. Sans version lue (assistant, script, ancien onglet), rien n'est
 * verrouillé ni contrôlé : comportement d'avant.
 *
 * `table` est un littéral du type `TableAVersion`, jamais une saisie.
 */
export async function controlerVersionFiche(
  tx: TransactionBrute,
  table: TableAVersion,
  id: string | number,
  lue: VersionLue,
  quoi: string,
): Promise<void> {
  if (lue === undefined) return
  const lignes = await tx.$queryRawUnsafe<Array<{ version: number }>>(`SELECT "version" FROM "${table}" WHERE "id" = $1 FOR UPDATE`, id)
  const enBase = lignes[0] ?? null
  if (versionFichePerimee(lue, enBase)) throw new FicheModifieeAilleurs(quoi, enBase?.version ?? null)
}

type ClientTransactionnel<Tx extends TransactionBrute> = { $transaction: <R>(action: (tx: Tx) => Promise<R>) => Promise<R> }

/**
 * Écriture d'une fiche hors transaction existante. Avec une version lue : la
 * ligne est verrouillée, la version contrôlée, puis `ecrire` s'exécute dans la
 * même transaction. Sans version lue : `ecrire` s'exécute directement, comme
 * avant. Dans les deux cas, `ecrire` porte `INCREMENT_VERSION` dans son `data`.
 * Lève `FicheModifieeAilleurs` (à rendre par `.reponse()`).
 */
export async function ecrireFicheVersionnee<Tx extends TransactionBrute, R>(
  client: ClientTransactionnel<Tx> & Tx,
  table: TableAVersion,
  id: string | number,
  lue: VersionLue,
  quoi: string,
  ecrire: (db: Tx) => Promise<R>,
): Promise<R> {
  if (lue === undefined) return ecrire(client)
  return client.$transaction(async (tx) => {
    await controlerVersionFiche(tx, table, id, lue, quoi)
    return ecrire(tx)
  })
}
