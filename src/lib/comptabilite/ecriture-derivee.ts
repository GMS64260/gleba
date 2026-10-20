/**
 * Garde de cohérence des écritures dérivées (2026-08-13).
 *
 * Une ligne de `ventes_manuelles` / `depenses_manuelles` peut être MANUELLE
 * (saisie par l'utilisateur) ou DÉRIVÉE d'une source métier : récolte, vente
 * d'animal, commande boutique, achat d'animal, soin, consommation d'aliment,
 * intervention… La colonne `auto` et le couple `sourceType`/`sourceId` portent
 * cette distinction.
 *
 * `DELETE` refusait déjà une ligne dérivée (« modifiez ou supprimez la
 * source »). `PATCH`, lui, ne refusait RIEN : le montant d'une dépense
 * d'achat d'animal pouvait être réécrit à la main et divergeait alors
 * silencieusement de la fiche animal qui l'a produite. Constat fait le
 * 2026-08-13 en préparant l'écran de correction des écritures.
 *
 * Le refus ne peut pas être global : l'écran des impayés marque légitimement
 * `paye: true` sur une vente dérivée d'une récolte (`markAsPaid`). On sépare
 * donc deux familles de champs :
 * - ceux qui appartiennent au SUIVI de l'écriture (règlement, pièce, notes) —
 *   acceptés, y compris sur une ligne dérivée (liste blanche `CHAMPS_DE_SUIVI`) ;
 * - tous les autres (montant, date, périmètre, TVA, tiers…) appartiennent à la
 *   SOURCE — refusés sur une ligne dérivée, car seule la source peut les changer.
 */

/**
 * Liste blanche d'une ligne dérivée (ticket cmvgdzsf7, 2026-10-20).
 *
 * Jusqu'au 2026-10-20, le garde refusait une liste NOIRE (les champs de la
 * source) et laissait passer tout le reste : un champ de la source oublié dans
 * la liste devenait modifiable sans que personne ne le décide. Seuls les champs
 * de SUIVI de l'écriture sont désormais acceptés sur une ligne dérivée ; tout
 * autre champ envoyé est refusé et nommé.
 * - `paye` : l'écran des impayés marque une vente dérivée comme payée ;
 * - la pièce : mode de règlement, numéro de pièce, journal, justificatif,
 *   notes, et pour une dépense la référence de la facture fournisseur et son
 *   échéance (`VenteManuelle` n'a pas de colonne d'échéance).
 */
export type NatureEcriture = 'vente' | 'depense'

export const CHAMPS_DE_SUIVI = {
  vente: ['paye', 'modeReglement', 'numeroPiece', 'journal', 'pjUrl', 'notes'],
  depense: ['paye', 'modeReglement', 'numeroPiece', 'refFacture', 'dateEcheance', 'journal', 'pjUrl', 'notes'],
} as const satisfies Record<NatureEcriture, readonly string[]>

/**
 * Champs du formulaire « Règlement et pièce » de Comptabilité > Transactions >
 * Revenus, ouvert sur une ligne dérivée. Sous-ensemble de `CHAMPS_DE_SUIVI.vente` :
 * l'écran n'envoie que ceux-là, et `chargerSuiviDesSources` ne relit qu'eux.
 * `paye` n'y est pas : sur la liste, le statut affiché d'une ligne dérivée est
 * celui de sa source (vente d'élevage, commande boutique) et se marque depuis
 * la source ou les impayés de Factures.
 */
export const CHAMPS_DE_SUIVI_SAISIS_VENTE = ['modeReglement', 'numeroPiece', 'notes'] as const satisfies readonly (typeof CHAMPS_DE_SUIVI.vente)[number][]

export type ChampSuiviSaisiVente = (typeof CHAMPS_DE_SUIVI_SAISIS_VENTE)[number]

/**
 * Suivi repris quand une source régénère son écriture de vente (`auto-compta.ts`
 * supprime puis recrée le miroir à chaque modification de la source) : sans
 * cette reprise, la pièce saisie dans Transactions disparaissait à la
 * modification suivante de la vente. `paye` n'est pas repris : la source le
 * recalcule (`VenteProduit.paye`).
 */
export const CHAMPS_DE_SUIVI_CONSERVES_VENTE = CHAMPS_DE_SUIVI.vente.filter((c) => c !== 'paye')

/** Suivi reporté sur le miroir régénéré d'une vente. */
export interface SuiviVente {
  modeReglement?: string
  numeroPiece?: string
  journal?: string
  pjUrl?: string
  notes?: string
}

/** Valeurs de suivi d'une ancienne écriture de vente à reporter sur la nouvelle (vide s'il n'y en avait pas). */
export function suiviConserve(ancienne: object | null | undefined): SuiviVente {
  if (!ancienne) return {}
  const valeurs = ancienne as Record<string, unknown>
  const repris: Record<string, unknown> = {}
  for (const champ of CHAMPS_DE_SUIVI_CONSERVES_VENTE) {
    const valeur = valeurs[champ]
    if (valeur !== undefined && valeur !== null) repris[champ] = valeur
  }
  return repris as SuiviVente
}

/** `select` Prisma des champs de suivi conservés, pour relire l'ancienne écriture de vente. */
export function selectSuiviConserve(): Record<string, true> {
  return Object.fromEntries(CHAMPS_DE_SUIVI_CONSERVES_VENTE.map((c) => [c, true]))
}

/** Libellés lisibles des sources, pour dire à l'utilisateur où corriger. */
const LIBELLE_SOURCE: Record<string, string> = {
  recolte: 'une récolte du maraîchage',
  recolte_arbre: 'une récolte du verger',
  vente_produit: "une vente de l'atelier d'élevage",
  commande_boutique: 'une commande de la boutique',
  reservation_elevage: "une réservation d'animal",
  paie_lait: 'une paie du lait',
  production_bois: 'une vente de bois du verger',
  campagne_plantation: 'une campagne de plantation',
  abattage: 'un abattage',
  achat_animal: "l'achat d'un lot d'animaux",
  achat_animal_individuel: "le prix d'achat d'un animal",
  achat_arbre: "l'achat d'un arbre",
  soin_animal: 'un soin',
  consommation_aliment: "une consommation d'aliment",
  fertilisation: 'une fertilisation',
  intervention: 'une intervention culturale',
  operation_arbre: 'une opération du verger',
}

export function libelleSource(sourceType: string | null | undefined): string {
  if (!sourceType) return 'une autre saisie de Gleba'
  return LIBELLE_SOURCE[sourceType] ?? `la source « ${sourceType} »`
}

export interface EcritureDerivee {
  auto?: boolean | null
  sourceType?: string | null
}

/**
 * Champs RÉELLEMENT envoyés par l'appelant.
 *
 * Piège vérifié en production le 2026-08-13 : les schémas de mise à jour sont
 * bâtis en `createSchema.partial()`, et `.partial()` ne retire PAS les
 * `.default()`. La sortie de zod contient donc toujours `tauxTVA`, `paye` et
 * `journal`, même quand le corps de la requête n'en parle pas. Raisonner sur la
 * sortie de zod revient à croire que l'appelant a demandé ces changements.
 * Deux conséquences observées : le garde ci-dessous refusait TOUTE modification
 * d'une ligne dérivée (y compris « marquer comme payé »), et — défaut
 * antérieur — chaque PATCH réécrivait le taux de TVA à sa valeur par défaut
 * puis recalculait le HT. On travaille donc sur les clés du corps brut.
 */
export function champsEnvoyes(body: unknown): Set<string> {
  return new Set(
    body && typeof body === 'object' && !Array.isArray(body)
      ? Object.keys(body as Record<string, unknown>)
      : [],
  )
}

/** Libellés des champs refusés, pour que le message soit lisible. */
const LIBELLE_CHAMP: Record<string, string> = {
  date: 'la date',
  montant: 'le montant',
  montantHT: 'le montant HT',
  montantTVA: 'le montant de TVA',
  tauxTVA: 'le taux de TVA',
  categorie: 'la catégorie',
  description: 'le libellé',
  quantite: 'la quantité',
  unite: "l'unité",
  prixUnitaire: 'le prix unitaire',
  module: 'le module',
  clientNom: 'le client',
  clientId: 'le client',
  fournisseurNom: 'le fournisseur',
  fournisseurId: 'le fournisseur',
  refFacture: 'la référence de la facture fournisseur',
  dateEcheance: "l'échéance",
  tvaInferee: "l'indicateur de TVA déduite",
  auto: "l'origine automatique",
  sourceType: 'la source',
  sourceId: 'la source',
  sourceRef: 'la source',
}

/**
 * Refus si la modification demandée sort du suivi sur une écriture dérivée,
 * `null` si elle est acceptable. `champ` nomme le premier champ refusé.
 *
 * `envoyes` doit venir de `champsEnvoyes(body)` : jamais de la sortie de zod.
 */
export function refusModificationDerivee(
  existing: EcritureDerivee,
  envoyes: Set<string>,
  nature: NatureEcriture,
): { error: string; champ: string } | null {
  if (!existing.auto) return null

  const permis = new Set<string>(['id', ...CHAMPS_DE_SUIVI[nature]])
  const interdits = [...envoyes].filter((champ) => !permis.has(champ))
  if (interdits.length === 0) return null

  const libelles = [...new Set(interdits.map((c) => LIBELLE_CHAMP[c] ?? c))]
  return {
    champ: interdits[0],
    error: `Cette écriture est générée automatiquement depuis ${libelleSource(
      existing.sourceType,
    )} : ${libelles.join(', ')} ${libelles.length > 1 ? 'ne se corrigent' : 'ne se corrige'} pas ici. Modifiez la source, l'écriture suivra. Le suivi du règlement, la pièce et les notes restent modifiables.`,
  }
}
