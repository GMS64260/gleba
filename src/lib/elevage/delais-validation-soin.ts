/**
 * ADV88 (contre-revue 2026-11-15) — délais d'attente exigés au PASSAGE d'un
 * soin à « fait ».
 *
 * La création refusait un soin médicamenteux administré sans médicament ni
 * délai (B6), mais un soin PLANIFIÉ sans délai passait ensuite à « fait » sans
 * aucun contrôle : aucune attente viande, l'animal restait abattable. Règle
 * unique (`refusDelaisSaisieLibre`), appelée par toutes les transitions vers
 * « fait » :
 *  - PATCH /api/elevage/soins (`fait: true`) ;
 *  - `daterInjection` (injection réalisée sur un soin encore à faire) : PATCH
 *    /api/elevage/soins/[id]/injections et outil `dater_injection` de
 *    l'assistant.
 * Les délais pris en compte sont ceux du corps de la validation, sinon ceux
 * déjà stockés sur le soin. La cible (animal ou lot) est relue dans
 * l'exploitation du propriétaire (`userId` = tenant), jamais celle de l'acteur.
 *
 * Revues QA115 / ADV116 : la décision se prend SOUS le verrou des écritures de
 * soins (`verrouillerReglements`), sur le soin relu (type, produit, cible,
 * délais) fusionné avec le corps ; le contrôle fait avant la transaction n'est
 * qu'un refus anticipé. Les fenêtres d'attente se calculent avec ces mêmes
 * délais. Toutes les écritures du type, du produit, de la cible ou des délais
 * d'un soin prennent ce verrou (PATCH soin, `daterInjection`,
 * `mettreAJourProtocoleSoin`).
 */
import type { Prisma } from '@prisma/client'
import {
  refusDelaisSaisieLibre, soinSaisieLibreMedicamenteux,
  type CibleDelaisSaisieLibre, type DelaisSaisis, type RefusDelaisAttente,
} from './delais-saisie-libre'

type Lecteur = Pick<Prisma.TransactionClient, 'animal' | 'lotAnimaux'>

const ESPECE = { select: { type: true, production: true, productions: true } } as const

/** Cible d'un soin relue dans l'exploitation `userId` ; null si absente ou d'un autre compte. */
export async function chargerCibleDelais(
  db: Lecteur,
  userId: string,
  animalId: number | null | undefined,
  lotId: number | null | undefined,
): Promise<CibleDelaisSaisieLibre | null> {
  if (animalId != null) {
    return db.animal.findFirst({
      where: { id: animalId, userId },
      select: { sexe: true, orientationProduction: true, especeAnimale: ESPECE },
    })
  }
  if (lotId != null) {
    return db.lotAnimaux.findFirst({ where: { id: lotId, userId }, select: { especeAnimale: ESPECE } })
  }
  return null
}

/**
 * Refus à opposer à un soin qui DEVIENT fait (l'appelant ne l'appelle qu'à la
 * transition), ou null. `soin` porte les valeurs finales (type, produit,
 * cible) ; `delais` les délais finaux (corps, sinon valeur stockée).
 */
export async function refusDelaisValidationSoin(
  db: Lecteur,
  userId: string,
  soin: { type: string | null | undefined; produitId?: string | null; animalId?: number | null; lotId?: number | null },
  delais: DelaisSaisis,
): Promise<RefusDelaisAttente | null> {
  if (!soinSaisieLibreMedicamenteux(soin)) return null
  const cible = await chargerCibleDelais(db, userId, soin.animalId, soin.lotId)
  return refusDelaisSaisieLibre(soin, cible, delais, 'validation')
}

/** Délais finaux : la valeur du corps quand elle est fournie (null compris), sinon celle du soin. */
export function delaisFinaux(
  stockes: { tempsAttenteLaitJ: number | null; tempsAttenteViandeJ: number | null; tempsAttenteOeufsJ: number | null },
  corps: { tempsAttenteLaitJ?: number | null; tempsAttenteViandeJ?: number | null; tempsAttenteOeufsJ?: number | null } | undefined,
) {
  return {
    tempsAttenteLaitJ: corps?.tempsAttenteLaitJ !== undefined ? corps.tempsAttenteLaitJ : stockes.tempsAttenteLaitJ,
    tempsAttenteViandeJ: corps?.tempsAttenteViandeJ !== undefined ? corps.tempsAttenteViandeJ : stockes.tempsAttenteViandeJ,
    tempsAttenteOeufsJ: corps?.tempsAttenteOeufsJ !== undefined ? corps.tempsAttenteOeufsJ : stockes.tempsAttenteOeufsJ,
  }
}

export const MESSAGE_DELAI_INVALIDE = 'Délai d’attente invalide : un nombre entier de jours, de 0 à 365.'

/**
 * Délais fournis à une écriture de soin (revue QA115) : chacun est absent,
 * null, ou un entier de 0 à 365 — mêmes bornes que les routes. Contrôle du
 * point d'écriture partagé (`daterInjection`, `mettreAJourProtocoleSoin`) :
 * un délai négatif, fractionnaire ou non numérique effaçait la fin d'attente
 * déjà posée (`ajouterJours` ignore les durées <= 0). `null` = valide.
 */
export function refusDelaisInvalides(
  delais: { tempsAttenteLaitJ?: unknown; tempsAttenteViandeJ?: unknown; tempsAttenteOeufsJ?: unknown } | undefined,
): { ok: false; status: 400; error: string } | null {
  if (!delais) return null
  const valide = (v: unknown) => v === undefined || v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 365)
  return valide(delais.tempsAttenteLaitJ) && valide(delais.tempsAttenteViandeJ) && valide(delais.tempsAttenteOeufsJ)
    ? null
    : { ok: false, status: 400, error: MESSAGE_DELAI_INVALIDE }
}

/** Refus constaté sous le verrou de la transaction : l'appelant l'annule et rend le refus. */
export class RefusDelaisSousVerrou extends Error {
  constructor(public readonly refus: RefusDelaisAttente) {
    super(refus.error)
  }
}
