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
 * - ceux que la SOURCE possède (montant, date, périmètre, TVA) — refusés sur
 *   une ligne dérivée, car seule la source peut les changer ;
 * - ceux qui appartiennent au SUIVI de l'écriture (règlement, pièce, notes) —
 *   toujours acceptés, y compris sur une ligne dérivée.
 */

/** Champs possédés par la source métier : interdits sur une ligne dérivée. */
export const CHAMPS_DE_LA_SOURCE = [
  'date',
  'montant',
  'montantHT',
  'montantTVA',
  'tauxTVA',
  'categorie',
  'description',
  'quantite',
  'unite',
  'module',
  'clientNom',
  'clientId',
  'fournisseurNom',
  'fournisseurId',
] as const

/** Libellés lisibles des sources, pour dire à l'utilisateur où corriger. */
const LIBELLE_SOURCE: Record<string, string> = {
  recolte: 'une récolte du maraîchage',
  recolte_arbre: 'une récolte du verger',
  vente_produit: "une vente de l'atelier d'élevage",
  commande_boutique: 'une commande de la boutique',
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

/**
 * Message d'erreur si la modification demandée touche un champ de la source
 * sur une écriture dérivée, `null` si la modification est acceptable.
 *
 * `envoyes` doit venir de `champsEnvoyes(body)` : jamais de la sortie de zod.
 */
export function refusModificationDerivee(
  existing: EcritureDerivee,
  envoyes: Set<string>,
): string | null {
  if (!existing.auto) return null

  const interdits = CHAMPS_DE_LA_SOURCE.filter((champ) => envoyes.has(champ))
  if (interdits.length === 0) return null

  return `Cette écriture est générée automatiquement depuis ${libelleSource(
    existing.sourceType,
  )} : ${interdits.join(', ')} ne peut pas être corrigé ici. Modifiez la source, l'écriture suivra. Le suivi du règlement, la pièce et les notes restent modifiables.`
}
