import { enCentimes, ErreurReglement } from '@/lib/comptabilite/monnaie'
import { verrouillerReglements } from '@/lib/comptabilite/verrou-reglements'
/**
 * Auto-Comptabilite - Generation automatique d'ecritures comptables
 *
 * Ce module cree/supprime automatiquement des VenteManuelle et DepenseManuelle
 * lorsque des operations (recoltes, ventes produits, abattages, interventions)
 * sont enregistrees dans les autres modules.
 *
 * Les ecritures auto sont identifiees par : auto=true, sourceType, sourceId
 */

import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { libelleUniteQuantite, type UniteQuantite } from '@/lib/recolte/projection'
import { formatQuantite } from '@/lib/recolte/quantites'
import { selectSuiviConserve, suiviConserve, type SuiviVente } from '@/lib/comptabilite/ecriture-derivee'
import { libellesVenteBois } from '@/lib/verger/production-bois'
import { montantVenteFruit } from '@/lib/verger/montant-vente'
import { TAUX_TVA_BOIS_PAR_DEFAUT } from '@/lib/verger/tva-bois'
import { cleSourceReglement } from '@/lib/comptabilite/cle-reglement'
import { synchroniserReglementSource, verifierSuppressionSourceReglee, rattacherReglementsFacture, suiviReglementActif } from '@/lib/comptabilite/suivi-reglement-source'

// ============================================================
// HELPERS
// ============================================================

type AutoComptaTx = Prisma.TransactionClient

/**
 * Sources dont l'app crée le miroir NON payé : « payé » y est une déclaration
 * de l'utilisateur. Corriger le montant d'une telle pièce sans versement
 * détaillé ferait passer pour payé un montant que personne n'a déclaré (garde
 * du 2026-10-28). Les autres miroirs (soins, interventions, fertilisations,
 * aliments, achats d'animaux, de lots et d'arbres) naissent payés par défaut :
 * ce booléen n'apprend rien, et refuser leur correction de coût bloquait toute
 * modification de la source (régression P1, revue du 2026-10-29). Pour eux, une
 * correction garde le pointage existant comme avant le 2026-10-28 ; un journal
 * de versements détaillés reste géré par `synchroniserReglementSource`.
 */
const SOURCES_DEPENSE_PAIEMENT_DECLARE: ReadonlySet<string> = new Set(['operation_arbre', 'campagne_plantation'])

async function suiviDuMiroirDepense(db: AutoComptaTx, where: { userId: string; sourceType: string; sourceId: number; auto: true }, montant?: number) {
  await verrouillerReglements(db, where.userId)
  await db.$queryRaw`SELECT id FROM depenses_manuelles WHERE user_id = ${where.userId} AND source_type = ${where.sourceType} AND source_id = ${where.sourceId} AND auto = true FOR UPDATE`
  const ancienne = await db.depenseManuelle.findFirst({
    where,
    select: { montant: true, paye: true, modeReglement: true, numeroPiece: true, journal: true, pjUrl: true, notes: true, refFacture: true, dateEcheance: true },
  })
  const cle = cleSourceReglement('depense', where.sourceType, where.sourceId)
  if (SOURCES_DEPENSE_PAIEMENT_DECLARE.has(where.sourceType) && ancienne?.paye && montant !== undefined
    && typeof ancienne.montant === 'number' && enCentimes(ancienne.montant) !== enCentimes(montant)
    && !await suiviReglementActif(db, where.userId, cle)) {
    throw new ErreurReglement('Précisez les versements historiques dans Règlements avant de corriger le montant de cette dépense déclarée payée.')
  }
  const reglement = montant !== undefined ? await synchroniserReglementSource(db, where.userId, cle, montant) : {}
  // Le montant appartient à la source ; seul le suivi est reporté.
  const suivi = ancienne ? { paye: ancienne.paye, modeReglement: ancienne.modeReglement, numeroPiece: ancienne.numeroPiece,
    journal: ancienne.journal, pjUrl: ancienne.pjUrl, notes: ancienne.notes, refFacture: ancienne.refFacture, dateEcheance: ancienne.dateEcheance } : {}
  return { ...suivi, ...reglement }
}

function inAutoComptaTransaction<T>(
  tx: AutoComptaTx | undefined,
  operation: (db: AutoComptaTx) => Promise<T>,
): Promise<T> {
  return tx ? operation(tx) : prisma.$transaction(operation)
}

/**
 * Suivi (règlement, pièce, journal, justificatif, notes) saisi sur le miroir
 * qu'une source va régénérer, à reporter sur le nouveau (ticket cmvgdzsf7,
 * 2026-10-20). Les fonctions ci-dessous suppriment puis recréent le miroir à
 * chaque modification de la source : la pièce saisie dans Comptabilité >
 * Transactions aurait disparu à la modification suivante de la vente.
 */
async function suiviDuMiroirVente(
  db: AutoComptaTx,
  where: Prisma.VenteManuelleWhereInput,
  montant?: number,
  conserverPointage = false,
): Promise<SuiviVente & { paye?: boolean }> {
  if (typeof where.userId === 'string') await verrouillerReglements(db, where.userId)
  const ancienne = await db.venteManuelle.findFirst({
    where,
    select: { ...selectSuiviConserve(), ...(conserverPointage ? { paye: true } : {}) } as Prisma.VenteManuelleSelect,
  })
  const identite = typeof where.userId === 'string' && typeof where.sourceType === 'string' && (typeof where.sourceId === 'number' || typeof where.sourceRef === 'string')
  const reglement = montant !== undefined && identite ? await synchroniserReglementSource(db, where.userId as string, cleSourceReglement('vente', where.sourceType as string, (where.sourceId ?? where.sourceRef) as number | string, where.sourceId == null), montant) : {}
  return { ...suiviConserve(ancienne), ...(conserverPointage && ancienne ? { paye: ancienne.paye } : {}), ...reglement }
}

/**
 * Recherche une ecriture auto existante pour eviter les doublons
 */
export async function findAutoEntry(
  sourceType: string,
  sourceId: number,
  table: 'vente' | 'depense'
) {
  if (table === 'vente') {
    return prisma.venteManuelle.findFirst({
      where: { sourceType, sourceId, auto: true },
    })
  } else {
    return prisma.depenseManuelle.findFirst({
      where: { sourceType, sourceId, auto: true },
    })
  }
}

/**
 * Supprime une ecriture auto lorsque la source est supprimee/modifiee
 */
export async function deleteAutoEntry(
  sourceType: string,
  sourceId: number,
  table: 'vente' | 'depense',
  // Review caprin 2026-07-21 — `userId` OBLIGATOIRE quand `sourceId` n'est pas
  // une PK globalement unique. Les sources historiques passent une PK
  // auto-incrémentée (unique tous tenants confondus) → `userId` optionnel y est
  // sans effet. Mais `paie_lait` utilise un sourceId synthétique (annee*100+mois)
  // COMMUN à tous les utilisateurs : sans `userId`, le deleteMany effacerait les
  // écritures des autres fermes (perte silencieuse de CA). Toujours scoper.
  userId?: string,
  tx?: AutoComptaTx,
) {
  return inAutoComptaTransaction(tx, async (db) => {
    const where = { sourceType, sourceId, auto: true, ...(userId ? { userId } : {}) }
    const proprietaires = userId ? [userId] : (table === 'vente'
      ? await db.venteManuelle.findMany({ where, select: { userId: true } })
      : await db.depenseManuelle.findMany({ where, select: { userId: true } })).map((l) => l.userId)
    for (const proprietaire of [...new Set(proprietaires)].sort()) {
      await verrouillerReglements(db, proprietaire)
      await verifierSuppressionSourceReglee(db, proprietaire, cleSourceReglement(table, sourceType, sourceId))
    }
    return table === 'vente' ? db.venteManuelle.deleteMany({ where }) : db.depenseManuelle.deleteMany({ where })
  })
}

export async function deleteAutoEntryByRef(
  sourceType: string,
  sourceRef: string,
  table: 'vente' | 'depense',
  userId: string,
  tx?: AutoComptaTx,
) {
  return inAutoComptaTransaction(tx, async (db) => {
    await verrouillerReglements(db, userId)
    const where = { sourceType, sourceRef, auto: true, userId }
    await verifierSuppressionSourceReglee(db, userId, cleSourceReglement(table, sourceType, sourceRef, true))
    return table === 'vente' ? db.venteManuelle.deleteMany({ where }) : db.depenseManuelle.deleteMany({ where })
  })
}

/**
 * Calcul TVA : retourne { montantHT, montantTVA, montantTTC }
 * taux: 5.5 pour produits alimentaires, 10 pour services, 20 pour materiel
 */
function calculTVA(montantTTC: number, taux: number = 5.5) {
  const montantHT = montantTTC / (1 + taux / 100)
  const montantTVA = montantTTC - montantHT
  return { montantHT, montantTVA, montantTTC }
}

// ============================================================
// VENTES AUTOMATIQUES
// ============================================================

/**
 * Cree une VenteManuelle quand une Recolte (potager) est marquee "vendu"
 * Utilise une transaction pour eviter les doublons en cas d'appels concurrents
 */
export async function createVenteFromRecolte(
  userId: string,
  recolte: {
    id: number
    especeId: string
    quantite: number
    /**
     * Unité de la récolte vendue (2026-08-20). L'écriture portait `unite: 'kg'`
     * en dur : une vente de 300 tiges de dahlia partait en comptabilité comme
     * 300 kg, et `prixUnitaire` était lu comme un prix au kilo. Le montant, lui,
     * était juste — `prixKg` est un prix PAR UNITÉ — c'est le libellé et la
     * colonne `unite` qui mentaient.
     */
    unite?: string | null
    prixKg?: number | null
    prixTotal?: number | null
    clientNom?: string | null
    clientId?: number | null
    dateVente?: Date | string | null
    factureId?: number | null
  },
  tx?: AutoComptaTx,
) {
  // Contrat anti-double-comptage (cf. kpi/compta.ts) : une vente facturée est
  // comptée via sa Facture — pas d'écriture auto en plus.
  if (recolte.factureId) {
    return inAutoComptaTransaction(tx, async (db) => {
      await rattacherReglementsFacture(db, userId, 'vente', 'recolte', recolte.id, recolte.factureId!)
      await deleteAutoEntry('recolte', recolte.id, 'vente', userId, db)
      return null
    })
  }

  const montantTTC = recolte.prixTotal ?? (recolte.quantite * (recolte.prixKg || 0))
  if (montantTTC <= 0) { await deleteAutoEntry('recolte', recolte.id, 'vente', userId, tx); return null }

  const uniteVente = (recolte.unite ?? 'kg') as UniteQuantite
  const { montantHT, montantTVA } = calculTVA(montantTTC, 5.5)

  // Transaction atomique : supprimer l'ancien + creer le nouveau
  return inAutoComptaTransaction(tx, async (tx) => {
    // Scopé au compte, comme la lecture du suivi (revue du 2026-10-20).
    const miroir = { userId, sourceType: 'recolte', sourceId: recolte.id, auto: true }
    // La récolte ne porte pas son paiement : le miroir le porte. Une
    // régénération garde le pointage (une vente dépointée restait sinon
    // repassée payée), comme les ventes du verger (2026-10-30).
    const suivi = await suiviDuMiroirVente(tx, miroir, montantTTC, true)
    await tx.venteManuelle.deleteMany({ where: miroir })

    return tx.venteManuelle.create({
      data: {
        userId,
        date: recolte.dateVente ? new Date(recolte.dateVente) : new Date(),
        categorie: 'legumes',
        description: `Vente ${recolte.especeId} - ${formatQuantite(recolte.quantite, uniteVente)}`,
        quantite: recolte.quantite,
        unite: libelleUniteQuantite(uniteVente, 1),
        prixUnitaire: recolte.prixKg || null,
        tauxTVA: 5.5,
        montantHT,
        montantTVA,
        montant: montantTTC,
        clientId: recolte.clientId || null,
        clientNom: recolte.clientNom || null,
        module: 'potager',
        paye: true,
        sourceType: 'recolte',
        sourceId: recolte.id,
        auto: true,
        ...suivi,
      },
    })
  })
}

/**
 * Bug R28 — Cree une DepenseManuelle "auto" quand un LotAnimaux est acheté
 * (prixAchatTotal). Sans ça, le KPI Dépenses du dashboard (qui somme les
 * DepenseManuelle) ignorait les achats de lots, alors que la liste les agrège.
 * La liste exclut les écritures auto → pas de double comptage.
 */
export async function createDepenseFromLotAnimaux(
  userId: string,
  lot: {
    id: number
    nom?: string | null
    prixAchatTotal?: number | null
    dateArrivee?: Date | string | null
  },
  tx?: AutoComptaTx,
) {
  const montantTTC = lot.prixAchatTotal || 0
  return inAutoComptaTransaction(tx, async (db) => {
    const suivi = await suiviDuMiroirDepense(db, { userId, sourceType: 'achat_animal', sourceId: lot.id, auto: true }, montantTTC)
    await db.depenseManuelle.deleteMany({
      where: { userId, sourceType: 'achat_animal', sourceId: lot.id, auto: true },
    })
    if (montantTTC <= 0) return null
    const { montantHT, montantTVA } = calculTVA(montantTTC, 5.5)
    return db.depenseManuelle.create({
      data: {
        userId,
        date: lot.dateArrivee ? new Date(lot.dateArrivee) : new Date(),
        categorie: 'achats',
        description: `Achat lot ${lot.nom || `#${lot.id}`}`,
        tauxTVA: 5.5,
        montantHT,
        montantTVA,
        montant: montantTTC,
        journal: 'AC',
        module: 'elevage',
        paye: true,
        comptable: true,
        tvaInferee: true,
        sourceType: 'achat_animal',
        sourceId: lot.id,
        auto: true,
        ...suivi,
      },
    })
  })
}

/**
 * Cree une VenteManuelle quand une RecolteArbre est marquee "vendu"
 */
export async function createVenteFromRecolteArbre(
  userId: string,
  recolteArbre: {
    id: number
    quantite: number
    prixKg?: number | null
    prixTotal?: number | null
    clientNom?: string | null
    clientId?: number | null
    dateVente?: Date | string | null
    arbre?: { nom?: string; espece?: string | null } | null
    factureId?: number | null
  },
  tx?: AutoComptaTx,
) {
  // Vente facturée ⇒ comptée via la Facture, pas d'écriture auto (cf. kpi/compta.ts).
  if (recolteArbre.factureId) {
    return inAutoComptaTransaction(tx, async (db) => {
      await rattacherReglementsFacture(db, userId, 'vente', 'recolte_arbre', recolteArbre.id, recolteArbre.factureId!)
      await deleteAutoEntry('recolte_arbre', recolteArbre.id, 'vente', userId, db)
      return null
    })
  }

  const montantTTC = montantVenteFruit(recolteArbre)
  if (montantTTC <= 0) { await deleteAutoEntry('recolte_arbre', recolteArbre.id, 'vente', userId, tx); return null }

  const { montantHT, montantTVA } = calculTVA(montantTTC, 5.5)

  const arbreNom = recolteArbre.arbre?.nom || 'Fruits'
  const especeNom = recolteArbre.arbre?.espece || ''

  return inAutoComptaTransaction(tx, async (tx) => {
    // Scopé au compte, comme la lecture du suivi (revue du 2026-10-20).
    const miroir = { userId, sourceType: 'recolte_arbre', sourceId: recolteArbre.id, auto: true }
    const ancien = await tx.venteManuelle.findFirst({ where: miroir, select: { paye: true } })
    const suivi = await suiviDuMiroirVente(tx, miroir, montantTTC)
    await tx.venteManuelle.deleteMany({ where: miroir })

    return tx.venteManuelle.create({
      data: {
        userId,
        date: recolteArbre.dateVente ? new Date(recolteArbre.dateVente) : new Date(),
        categorie: 'fruits',
        description: `Vente ${arbreNom}${especeNom ? ` (${especeNom})` : ''} - ${recolteArbre.quantite} kg`,
        quantite: recolteArbre.quantite,
        unite: 'kg',
        prixUnitaire: recolteArbre.prixKg || null,
        tauxTVA: 5.5,
        montantHT,
        montantTVA,
        montant: montantTTC,
        clientId: recolteArbre.clientId || null,
        clientNom: recolteArbre.clientNom || null,
        module: 'verger',
        paye: ancien?.paye ?? false,
        sourceType: 'recolte_arbre',
        sourceId: recolteArbre.id,
        auto: true,
        ...suivi,
      },
    })
  })
}

/**
 * Cree une VenteManuelle quand une VenteProduit (oeufs, viande, etc.) est creee
 */
export async function createVenteFromVenteProduit(
  userId: string,
  venteProduit: {
    id: number
    type: string
    description?: string | null
    prixTotal: number
    quantite?: number
    unite?: string
    prixUnitaire?: number
    client?: string | null
    date?: Date | string | null
    tauxTVA?: number | null
    factureId?: number | null
    paye?: boolean | null
    modeReglement?: string | null
  },
  tx?: AutoComptaTx,
) {
  // Vente facturée ⇒ comptée via la Facture, pas d'écriture auto (cf. kpi/compta.ts).
  if (venteProduit.factureId) {
    return inAutoComptaTransaction(tx, async (db) => {
      await rattacherReglementsFacture(db, userId, 'vente', 'vente_produit', venteProduit.id, venteProduit.factureId!)
      await deleteAutoEntry('vente_produit', venteProduit.id, 'vente', userId, db)
      return null
    })
  }

  const montantTTC = venteProduit.prixTotal
  if (montantTTC <= 0) {
    // Revue élevage 2026-07-21 — purge de l'écriture auto précédente : une vente
    // éditée à 0 € (don) laissait sinon un revenu fantôme en compta (le
    // deleteMany plus bas n'était jamais atteint).
    await deleteAutoEntry('vente_produit', venteProduit.id, 'vente', userId, tx)
    return null
  }

  const taux = venteProduit.tauxTVA ?? 5.5
  const { montantHT, montantTVA } = calculTVA(montantTTC, taux)

  // Determiner la categorie selon le type de produit
  let categorie = 'autre'
  if (venteProduit.type === 'oeufs') categorie = 'oeufs'
  else if (venteProduit.type === 'viande') categorie = 'viande'
  else if (venteProduit.type === 'lait') categorie = 'lait'
  else if (venteProduit.type === 'fromage') categorie = 'fromage'
  else if (venteProduit.type === 'animal_vivant') categorie = 'viande'
  else if (['miel', 'cire', 'propolis', 'pollen', 'gelee_royale', 'autre_ruche'].includes(venteProduit.type)) {
    categorie = 'produits_ruche'
  }

  return inAutoComptaTransaction(tx, async (db) => {
    const suivi = await suiviDuMiroirVente(db, { userId, sourceType: 'vente_produit', sourceId: venteProduit.id, auto: true }, montantTTC)
    await db.venteManuelle.deleteMany({
      where: { userId, sourceType: 'vente_produit', sourceId: venteProduit.id, auto: true },
    })

    return db.venteManuelle.create({
      data: {
        userId,
        date: venteProduit.date ? new Date(venteProduit.date) : new Date(),
        categorie,
        description: venteProduit.description || `Vente ${venteProduit.type}`,
        quantite: venteProduit.quantite || null,
        unite: venteProduit.unite || null,
        prixUnitaire: venteProduit.prixUnitaire || null,
        tauxTVA: taux,
        montantHT,
        montantTVA,
        montant: montantTTC,
        clientNom: venteProduit.client || null,
        module: 'elevage',
        // Vente présumée payée sans statut explicite (décision du 2026-10-30).
        paye: venteProduit.paye ?? true,
        sourceType: 'vente_produit',
        sourceId: venteProduit.id,
        auto: true,
        ...suivi,
        ...(venteProduit.modeReglement !== undefined ? { modeReglement: venteProduit.modeReglement } : {}),
      },
    })
  })
}

/**
 * Cree une VenteManuelle quand une PaieLait (chèque de la laiterie) est saisie.
 *
 * Le chèque de lait est le revenu n°1 d'un éleveur laitier livreur : sans cette
 * écriture, la paie n'apparaissait NI dans le CA (getKpiCompta = Σ VenteManuelle
 * + factures) NI dans les recettes, alors que tous ses coûts (alim, soins,
 * achat) y figuraient → marge affichée massivement négative (review caprin
 * 2026-07-21).
 *
 * sourceId synthétique = annee*100 + mois : PaieLait.id est un cuid alors que
 * VenteManuelle.sourceId est un Int, et la paie est unique par (user, annee,
 * mois) → l'upsert mensuel reste idempotent (deleteMany + create).
 *
 * TVA : la paie est saisie HT (montantHT). On applique 5,5 % comme pour toute
 * vente de lait/produit laitier (VenteProduit type 'lait') pour rester cohérent
 * avec le reste de la compta élevage.
 */
export async function createVenteFromPaieLait(
  userId: string,
  paie: {
    annee: number
    mois: number
    montantHT: number
    litres?: number | null
    laiterie?: string | null
    date?: Date | string | null
  }
) {
  return prisma.$transaction((tx) => upsertVenteFromPaieLait(tx, userId, paie))
}

/** Variante transactionnelle, à utiliser quand la PaieLait est écrite dans la
 * même transaction. Évite une paie validée sans sa recette comptable. */
export async function upsertVenteFromPaieLait(
  tx: Prisma.TransactionClient,
  userId: string,
  paie: {
    annee: number
    mois: number
    montantHT: number
    litres?: number | null
    laiterie?: string | null
    date?: Date | string | null
  }
) {
  const sourceId = paie.annee * 100 + paie.mois
  const montantHT = Number(paie.montantHT)
  if (!(montantHT > 0)) {
    // Paie à 0 (ou négative après pénalités) : pas de revenu, on purge une
    // éventuelle écriture précédente (mois ré-enregistré à 0). Scopé userId :
    // le sourceId synthétique est partagé entre tenants.
    await deleteAutoEntry('paie_lait', sourceId, 'vente', userId, tx)
    return null
  }

  const taux = 5.5
  const montantTVA = (montantHT * taux) / 100
  const montantTTC = montantHT + montantTVA
  const dateVente = paie.date ? new Date(paie.date) : new Date(paie.annee, paie.mois - 1, 1)
  const litres = paie.litres != null ? Number(paie.litres) : null
  const moisLabel = `${String(paie.mois).padStart(2, '0')}/${paie.annee}`

  // Scopé userId : sourceId (annee*100+mois) est commun à tous les tenants.
  const suivi = await suiviDuMiroirVente(tx, { sourceType: 'paie_lait', sourceId, auto: true, userId }, montantTTC)
  await tx.venteManuelle.deleteMany({
    where: { sourceType: 'paie_lait', sourceId, auto: true, userId },
  })

  return tx.venteManuelle.create({
    data: {
        userId,
        date: dateVente,
        categorie: 'lait',
        description:
          `Paie du lait ${moisLabel}` +
          (paie.laiterie ? ` — ${paie.laiterie}` : '') +
          (litres != null ? ` (${Math.round(litres)} L)` : ''),
        quantite: litres,
        unite: litres != null ? 'L' : null,
        prixUnitaire: null,
        tauxTVA: taux,
        montantHT,
        montantTVA,
        montant: montantTTC,
        clientNom: paie.laiterie || null,
        module: 'elevage',
        paye: true,
        tvaInferee: true,
        sourceType: 'paie_lait',
        sourceId,
        auto: true,
        ...suivi,
    },
  })
}

/**
 * Cree une VenteManuelle quand un Abattage a une vente (destination = "vente")
 *
 * Une nouvelle vente d'abattage est présumée payée, comme avant le 2026-10-28
 * (décision du 2026-10-30). La source ne porte pas de pointage : celui du
 * miroir existant est conservé à chaque régénération, un impayé saisi ne
 * redevient jamais payé.
 */
export async function createVenteFromAbattage(
  userId: string,
  abattage: {
    id: number
    prixVente?: number | null
    date?: Date | string | null
    destination: string
    quantite?: number
    poidsCarcasse?: number | null
    animal?: { nom?: string | null } | null
    lot?: { nom?: string | null } | null
    tauxTVA?: number | null
    factureId?: number | null
  },
  tx?: AutoComptaTx,
) {
  // Vente facturée ⇒ comptée via la Facture, pas d'écriture auto (cf. kpi/compta.ts).
  if (abattage.factureId) {
    return inAutoComptaTransaction(tx, async (db) => {
      await rattacherReglementsFacture(db, userId, 'vente', 'abattage', abattage.id, abattage.factureId!)
      await deleteAutoEntry('abattage', abattage.id, 'vente', userId, db)
      return null
    })
  }

  // Uniquement si destination = vente et qu'il y a un prix
  if (abattage.destination !== 'vente' || !abattage.prixVente || abattage.prixVente <= 0) {
    // Nettoyer toute ecriture auto residuelle
    await deleteAutoEntry('abattage', abattage.id, 'vente', userId, tx)
    return null
  }

  const montantTTC = abattage.prixVente
  const tauxAbattage = abattage.tauxTVA ?? 5.5
  const { montantHT, montantTVA } = calculTVA(montantTTC, tauxAbattage)

  const animalInfo = abattage.animal?.nom || abattage.lot?.nom || 'Abattage'

  return inAutoComptaTransaction(tx, async (db) => {
    const suivi = await suiviDuMiroirVente(db, { userId, sourceType: 'abattage', sourceId: abattage.id, auto: true }, montantTTC, true)
    await db.venteManuelle.deleteMany({
      where: { userId, sourceType: 'abattage', sourceId: abattage.id, auto: true },
    })

    return db.venteManuelle.create({
      data: {
        userId,
        date: abattage.date ? new Date(abattage.date) : new Date(),
        categorie: 'viande',
        description: `Vente abattage - ${animalInfo}${abattage.poidsCarcasse ? ` (${abattage.poidsCarcasse} kg carcasse)` : ''}`,
        quantite: abattage.poidsCarcasse || abattage.quantite || null,
        unite: abattage.poidsCarcasse ? 'kg' : 'animal',
        tauxTVA: tauxAbattage,
        montantHT,
        montantTVA,
        montant: montantTTC,
        module: 'elevage',
        paye: true,
        sourceType: 'abattage',
        sourceId: abattage.id,
        auto: true,
        ...suivi,
      },
    })
  })
}

/**
 * Cree une VenteManuelle quand une ProductionBois est marquee "vendu"
 */
export async function createVenteFromProductionBois(
  userId: string,
  productionBois: {
    id: number
    type: string
    volumeM3?: number | null
    poidsKg?: number | null
    prixVente?: number | null
    clientNom?: string | null
    clientId?: number | null
    dateVente?: Date | string | null
    arbre?: { nom?: string; espece?: string | null } | null
    factureId?: number | null
  },
  tx?: AutoComptaTx,
) {
  // Vente facturée ⇒ comptée via la Facture, pas d'écriture auto (cf. kpi/compta.ts).
  if (productionBois.factureId) {
    return inAutoComptaTransaction(tx, async (db) => {
      await rattacherReglementsFacture(db, userId, 'vente', 'production_bois', productionBois.id, productionBois.factureId!)
      await deleteAutoEntry('production_bois', productionBois.id, 'vente', userId, db)
      return null
    })
  }

  const montantTTC = productionBois.prixVente || 0
  if (montantTTC <= 0) { await deleteAutoEntry('production_bois', productionBois.id, 'vente', userId, tx); return null }

  const { montantHT, montantTVA } = calculTVA(montantTTC, TAUX_TVA_BOIS_PAR_DEFAUT)

  // QA cmvnp0dm9 — même libellé que l'écran et la facture (« Élagage »).
  const { description } = libellesVenteBois({
    type: productionBois.type,
    volumeM3: productionBois.volumeM3,
    poidsKg: productionBois.poidsKg,
    arbreNom: productionBois.arbre?.nom,
  })

  return inAutoComptaTransaction(tx, async (tx) => {
    // Scopé au compte, comme la lecture du suivi (revue du 2026-10-20).
    const miroir = { userId, sourceType: 'production_bois', sourceId: productionBois.id, auto: true }
    const ancien = await tx.venteManuelle.findFirst({ where: miroir, select: { paye: true } })
    const suivi = await suiviDuMiroirVente(tx, miroir, montantTTC)
    await tx.venteManuelle.deleteMany({ where: miroir })

    return tx.venteManuelle.create({
      data: {
        userId,
        date: productionBois.dateVente ? new Date(productionBois.dateVente) : new Date(),
        categorie: 'bois',
        description,
        quantite: productionBois.volumeM3 || productionBois.poidsKg || null,
        unite: productionBois.volumeM3 ? 'm³' : (productionBois.poidsKg ? 'kg' : null),
        tauxTVA: TAUX_TVA_BOIS_PAR_DEFAUT,
        montantHT,
        montantTVA,
        montant: montantTTC,
        clientId: productionBois.clientId || null,
        clientNom: productionBois.clientNom || null,
        module: 'verger',
        paye: ancien?.paye ?? false,
        sourceType: 'production_bois',
        sourceId: productionBois.id,
        auto: true,
        ...suivi,
      },
    })
  })
}

// ============================================================
// DEPENSES AUTOMATIQUES
// ============================================================

/**
 * Audit compta 2026-06 (lot 5) — Dépenses SSOT unifiée : le KPI, la TVA
 * déductible et le FEC somment toutes les DepenseManuelle (auto incluses).
 * Chaque source de coût métier doit donc produire son écriture auto, comme
 * les ventes. Les écrans qui agrègent les sources brutes (liste Dépenses,
 * stats, coûts de production) excluent les écritures auto correspondantes.
 */

/**
 * Achat d'un arbre : même date et montant que la fiche. Présumé réglé comme les
 * achats d'animaux et de lots (décision du 2026-10-30) : hors de la garde des
 * paiements déclarés. Une régénération garde le taux, la catégorie et le
 * pointage du miroir existant (la reprise de mai l'avait classé à 5,5 % en
 * « achats ») ; seuls montant, HT et TVA suivent la fiche.
 */
export async function createDepenseFromAchatArbre(userId: string, arbre: {
  id: number; nom: string; prixAchat: number | null; fournisseur: string | null;
  dateAchat: Date | null; datePlantation: Date | null; createdAt: Date
}, tx?: AutoComptaTx) {
  const montant = arbre.prixAchat ?? 0
  if (!Number.isFinite(montant) || montant < 0) throw new ErreurReglement('Le prix d’achat doit être positif ou nul.', 400)
  return inAutoComptaTransaction(tx, async db => {
    const where = { userId, sourceType: 'achat_arbre', sourceId: arbre.id, auto: true as const }
    const suivi = await suiviDuMiroirDepense(db, where, montant)
    const existant = await db.depenseManuelle.findFirst({ where, select: { tauxTVA: true, categorie: true } })
    await db.depenseManuelle.deleteMany({ where })
    if (montant === 0) return null
    const tauxTVA = typeof existant?.tauxTVA === 'number' && Number.isFinite(existant.tauxTVA) ? existant.tauxTVA : 10
    const tva = calculTVA(montant, tauxTVA)
    return db.depenseManuelle.create({ data: {
      ...where, date: arbre.dateAchat ?? arbre.datePlantation ?? arbre.createdAt,
      categorie: existant?.categorie || 'plants', description: `Achat ${arbre.nom}`,
      fournisseurNom: arbre.fournisseur, montant, montantHT: tva.montantHT, montantTVA: tva.montantTVA,
      tauxTVA, tvaInferee: true, journal: 'AC', module: 'verger', comptable: true, paye: true, ...suivi,
    } })
  })
}

/**
 * Cree une DepenseManuelle quand une OperationArbre a un coût (taille,
 * traitement, greffe...). TVA : 20 % traitement (intrants), 10 % sinon (service).
 */
export async function createDepenseFromOperationArbre(
  userId: string,
  operation: {
    id: number
    type: string
    description?: string | null
    cout?: number | null
    date?: Date | string | null
    fait?: boolean | null
  },
  tx?: AutoComptaTx,
) {
  // Une opération planifiée (fait=false) n'est pas une dépense réelle.
  const montantTTC = operation.fait === false ? 0 : operation.cout || 0
  return inAutoComptaTransaction(tx, async (tx) => {
    const suivi = await suiviDuMiroirDepense(tx, { userId, sourceType: 'operation_arbre', sourceId: operation.id, auto: true }, montantTTC)
    await tx.depenseManuelle.deleteMany({
      where: { userId, sourceType: 'operation_arbre', sourceId: operation.id, auto: true },
    })
    if (montantTTC <= 0) return null
    const tauxTVA = operation.type === 'traitement' ? 20 : 10
    const { montantHT, montantTVA } = calculTVA(montantTTC, tauxTVA)
    return tx.depenseManuelle.create({
      data: {
        userId,
        date: operation.date ? new Date(operation.date) : new Date(),
        categorie: operation.type === 'traitement' ? 'intrants' : 'main_oeuvre',
        description: operation.description || `Opération verger - ${operation.type}`,
        tauxTVA,
        montantHT,
        montantTVA,
        montant: montantTTC,
        journal: 'AC',
        module: 'verger',
        paye: false,
        sourceType: 'operation_arbre',
        sourceId: operation.id,
        auto: true,
        ...suivi,
      },
    })
  })
}

/**
 * Cree une DepenseManuelle quand une CampagnePlantation a un coût réel.
 * TVA 10 % (végétaux vivants).
 */
export async function createDepenseFromCampagnePlantation(
  userId: string,
  campagne: {
    id: number
    nom?: string | null
    coutReel?: number | null
    datePlantationReelle?: Date | string | null
    datePlantationPrevue?: Date | string | null
    createdAt?: Date | string | null
  },
  tx?: AutoComptaTx,
) {
  const montantTTC = campagne.coutReel || 0
  return inAutoComptaTransaction(tx, async (tx) => {
    const suivi = await suiviDuMiroirDepense(tx, { userId, sourceType: 'campagne_plantation', sourceId: campagne.id, auto: true }, montantTTC)
    await tx.depenseManuelle.deleteMany({
      where: { userId, sourceType: 'campagne_plantation', sourceId: campagne.id, auto: true },
    })
    if (montantTTC <= 0) return null
    const { montantHT, montantTVA } = calculTVA(montantTTC, 10)
    // Sans date de plantation, la date de création de la campagne, comme la
    // liste Transactions : la date du jour déplaçait la dépense à chaque sauvegarde.
    const creation = campagne.datePlantationReelle || campagne.datePlantationPrevue ? null
      : campagne.createdAt ?? (await tx.campagnePlantation.findFirst({ where: { id: campagne.id, userId }, select: { createdAt: true } }))?.createdAt
    return tx.depenseManuelle.create({
      data: {
        userId,
        date: campagne.datePlantationReelle
          ? new Date(campagne.datePlantationReelle)
          : campagne.datePlantationPrevue
            ? new Date(campagne.datePlantationPrevue)
            : creation ? new Date(creation) : new Date(),
        categorie: 'plants',
        description: `Campagne de plantation - ${campagne.nom || `#${campagne.id}`}`,
        tauxTVA: 10,
        montantHT,
        montantTVA,
        montant: montantTTC,
        journal: 'AC',
        module: 'verger',
        paye: false,
        sourceType: 'campagne_plantation',
        sourceId: campagne.id,
        auto: true,
        ...suivi,
      },
    })
  })
}

/**
 * Cree une DepenseManuelle quand une ConsommationAliment est enregistrée.
 * Valorisation : coutUnitaire per-user ?? prix per-user ?? prix global.
 * TVA 10 % (aliments pour animaux), aligné sur l'inférence historique de tva.ts.
 */
export async function createDepenseFromConsommationAliment(
  userId: string,
  consommation: {
    id: number
    alimentId: string
    quantite: number
    date?: Date | string | null
  },
  tx?: AutoComptaTx,
) {
  return inAutoComptaTransaction(tx, async (db) => {
    const aliment = await db.aliment.findUnique({
      where: { id: consommation.alimentId },
      select: {
        nom: true,
        prix: true,
        userStocks: { where: { userId }, select: { prix: true, coutUnitaire: true }, take: 1 },
      },
    })
    const prixUnitaire =
      aliment?.userStocks?.[0]?.coutUnitaire ?? aliment?.userStocks?.[0]?.prix ?? aliment?.prix ?? 0
    const montantTTC = consommation.quantite * prixUnitaire

    const suivi = await suiviDuMiroirDepense(db, { userId, sourceType: 'consommation_aliment', sourceId: consommation.id, auto: true }, montantTTC)
    await db.depenseManuelle.deleteMany({
      where: { userId, sourceType: 'consommation_aliment', sourceId: consommation.id, auto: true },
    })
    if (montantTTC <= 0) return null
    const { montantHT, montantTVA } = calculTVA(montantTTC, 10)
    return db.depenseManuelle.create({
      data: {
        userId,
        date: consommation.date ? new Date(consommation.date) : new Date(),
        categorie: 'alimentation',
        description: `Consommation aliment - ${aliment?.nom || consommation.alimentId} (${consommation.quantite} kg)`,
        tauxTVA: 10,
        montantHT,
        montantTVA,
        montant: montantTTC,
        journal: 'AC',
        module: 'elevage',
        paye: true,
        comptable: false,
        tvaInferee: true,
        sourceType: 'consommation_aliment',
        sourceId: consommation.id,
        auto: true,
        ...suivi,
      },
    })
  })
}

/**
 * Cree une DepenseManuelle quand un SoinAnimal a un coût (véto, produits).
 * TVA 20 % (prestations/produits vétérinaires).
 */
export async function createDepenseFromSoinAnimal(
  userId: string,
  soin: {
    id: number
    type: string
    cout?: number | null
    date?: Date | string | null
    fait?: boolean | null
  },
  tx?: AutoComptaTx,
) {
  // Un soin planifié (fait=false) n'est pas une dépense réelle.
  const montantTTC = soin.fait === false ? 0 : soin.cout || 0
  return inAutoComptaTransaction(tx, async (db) => {
    const suivi = await suiviDuMiroirDepense(db, { userId, sourceType: 'soin_animal', sourceId: soin.id, auto: true }, montantTTC)
    await db.depenseManuelle.deleteMany({
      where: { userId, sourceType: 'soin_animal', sourceId: soin.id, auto: true },
    })
    if (montantTTC <= 0) return null
    const { montantHT, montantTVA } = calculTVA(montantTTC, 20)
    return db.depenseManuelle.create({
      data: {
        userId,
        date: soin.date ? new Date(soin.date) : new Date(),
        categorie: 'veterinaire',
        description: `Soin animal - ${soin.type}`,
        tauxTVA: 20,
        montantHT,
        montantTVA,
        montant: montantTTC,
        journal: 'AC',
        module: 'elevage',
        paye: true,
        comptable: false,
        tvaInferee: true,
        sourceType: 'soin_animal',
        sourceId: soin.id,
        auto: true,
        ...suivi,
      },
    })
  })
}

/**
 * Cree une DepenseManuelle quand un Animal individuel est acheté (prixAchat).
 * sourceType distinct de 'achat_animal' (réservé aux lots, ids différents).
 * TVA 5,5 % — aligné sur createDepenseFromLotAnimaux.
 */
export async function createDepenseFromAchatAnimal(
  userId: string,
  animal: {
    id: number
    nom?: string | null
    identifiant?: string | null
    prixAchat?: number | null
    dateArrivee?: Date | string | null
    prixAchatInclusDansLot?: boolean | null
  },
  tx?: AutoComptaTx,
) {
  const montantTTC = animal.prixAchatInclusDansLot ? 0 : animal.prixAchat || 0
  return inAutoComptaTransaction(tx, async (db) => {
    const suivi = await suiviDuMiroirDepense(db, { userId, sourceType: 'achat_animal_individuel', sourceId: animal.id, auto: true }, montantTTC)
    await db.depenseManuelle.deleteMany({
      where: { userId, sourceType: 'achat_animal_individuel', sourceId: animal.id, auto: true },
    })
    if (montantTTC <= 0) return null
    const { montantHT, montantTVA } = calculTVA(montantTTC, 5.5)
    return db.depenseManuelle.create({
      data: {
        userId,
        date: animal.dateArrivee ? new Date(animal.dateArrivee) : new Date(),
        categorie: 'achats',
        description: `Achat animal - ${animal.nom || animal.identifiant || `#${animal.id}`}`,
        tauxTVA: 5.5,
        montantHT,
        montantTVA,
        montant: montantTTC,
        journal: 'AC',
        module: 'elevage',
        paye: true,
        comptable: true,
        tvaInferee: true,
        sourceType: 'achat_animal_individuel',
        sourceId: animal.id,
        auto: true,
        ...suivi,
      },
    })
  })
}

type ReservationComptaInput = {
  id: string
  statut: string
  acompte?: number | null
  montant?: number | null
  dateReservation?: Date | string | null
  dateLivraison?: Date | string | null
  acquereurNom?: string | null
}

/**
 * Une réservation porte une seule écriture évolutive :
 * - avant livraison : acompte encaissé ;
 * - à la livraison : prix total de cession, acompte compris ;
 * - annulation : aucune recette.
 */
export async function upsertVenteFromReservationElevage(
  tx: AutoComptaTx,
  userId: string,
  reservation: ReservationComptaInput,
) {
  const refs = [`${reservation.id}:acompte`, `${reservation.id}:solde`]
  const suiviParRef = new Map<string, SuiviVente>()
  for (const sourceRef of refs) {
    suiviParRef.set(
      sourceRef,
      await suiviDuMiroirVente(tx, { userId, sourceType: 'reservation_elevage', sourceRef, auto: true }),
    )
  }
  await tx.venteManuelle.deleteMany({
    where: {
      userId,
      sourceType: 'reservation_elevage',
      sourceRef: { in: refs },
      auto: true,
    },
  })

  if (reservation.statut === 'annulee') return null
  const acompte = Number(reservation.acompte || 0)
  const total = Number(reservation.montant || 0)
  const livree = reservation.statut === 'livree'
  const taux = 5.5
  const encaisse = livree && total > 0 ? Math.min(acompte, total) : acompte
  const solde = livree && total > 0 ? Math.max(total - encaisse, 0) : 0
  const rows: Array<{
    sourceRef: string
    montant: number
    date: Date
    description: string
    paye: boolean
  }> = []
  if (encaisse > 0) {
    rows.push({
      sourceRef: `${reservation.id}:acompte`,
      montant: encaisse,
      date: new Date(reservation.dateReservation || new Date()),
      description: `Acompte réservation animal${reservation.acquereurNom ? ` — ${reservation.acquereurNom}` : ''}`,
      paye: true,
    })
  }
  if (solde > 0) {
    rows.push({
      sourceRef: `${reservation.id}:solde`,
      montant: solde,
      date: new Date(reservation.dateLivraison || new Date()),
      description: `Solde cession animal${reservation.acquereurNom ? ` — ${reservation.acquereurNom}` : ''}`,
      paye: false,
    })
  }
  if (rows.length === 0) return null

  const created = []
  for (const row of rows) {
    const { montantHT, montantTVA } = calculTVA(row.montant, taux)
    created.push(await tx.venteManuelle.create({
      data: {
        userId,
        date: row.date,
        categorie: 'animal_vivant',
        description: row.description,
        tauxTVA: taux,
        montantHT,
        montantTVA,
        montant: row.montant,
        clientNom: reservation.acquereurNom || null,
        module: 'elevage',
        paye: row.paye,
        tvaInferee: true,
        sourceType: 'reservation_elevage',
        sourceRef: row.sourceRef,
        auto: true,
        ...suiviParRef.get(row.sourceRef),
      },
    }))
  }
  return created
}

export async function createVenteFromReservationElevage(
  userId: string,
  reservation: ReservationComptaInput,
) {
  return prisma.$transaction((tx) =>
    upsertVenteFromReservationElevage(tx, userId, reservation),
  )
}

/**
 * Cree une DepenseManuelle quand une Fertilisation est enregistrée.
 * Valorisation : coutUnitaire per-user ?? prix per-user ?? prix global.
 * TVA 20 % — aligné sur l'inférence historique de tva.ts.
 */
export async function createDepenseFromFertilisation(
  userId: string,
  fertilisation: {
    id: number
    fertilisantId: string
    quantite: number
    date?: Date | string | null
  }
) {
  // NB : sur Fertilisant, l'id EST le nom (pas de champ nom, contrairement à Aliment)
  const fertilisant = await prisma.fertilisant.findUnique({
    where: { id: fertilisation.fertilisantId },
    select: {
      prix: true,
      userStocks: { where: { userId }, select: { prix: true, coutUnitaire: true }, take: 1 },
    },
  })
  const prixUnitaire =
    fertilisant?.userStocks?.[0]?.coutUnitaire ?? fertilisant?.userStocks?.[0]?.prix ?? fertilisant?.prix ?? 0
  const montantTTC = fertilisation.quantite * prixUnitaire

  return prisma.$transaction(async (tx) => {
    const suivi = await suiviDuMiroirDepense(tx, { userId, sourceType: 'fertilisation', sourceId: fertilisation.id, auto: true }, montantTTC)
    await tx.depenseManuelle.deleteMany({
      where: { userId, sourceType: 'fertilisation', sourceId: fertilisation.id, auto: true },
    })
    if (montantTTC <= 0) return null
    const { montantHT, montantTVA } = calculTVA(montantTTC, 20)
    return tx.depenseManuelle.create({
      data: {
        userId,
        date: fertilisation.date ? new Date(fertilisation.date) : new Date(),
        categorie: 'intrants',
        description: `Fertilisation - ${fertilisation.fertilisantId} (${fertilisation.quantite} kg)`,
        tauxTVA: 20,
        montantHT,
        montantTVA,
        montant: montantTTC,
        journal: 'AC',
        module: 'potager',
        paye: true,
        sourceType: 'fertilisation',
        sourceId: fertilisation.id,
        auto: true,
        ...suivi,
      },
    })
  })
}

/**
 * Cree une DepenseManuelle quand une Intervention a des couts (intrants, main d'oeuvre)
 */
export async function createDepenseFromIntervention(
  userId: string,
  intervention: {
    id: number
    type: string
    description?: string | null
    coutTotal?: number | null
    coutMainOeuvre?: number | null
    intrantCout?: number | null
    intrantNom?: string | null
    date?: Date | string | null
    cultureId?: number | null
    plancheId?: string | null
    arbreId?: number | null
    fait?: boolean | null
  },
  tx?: AutoComptaTx,
) {
  // Audit compta 2026-06 (#9) : une intervention planifiée (fait=false)
  // n'est pas une dépense réelle — elle faussait dépenses et TVA déductible.
  const montantTTC = intervention.fait === false ? 0 : intervention.coutTotal || 0
  if (montantTTC <= 0) {
    await deleteAutoEntry('intervention', intervention.id, 'depense', userId, tx)
    return null
  }

  // Determiner la categorie et le taux TVA
  let categorie = 'intrants'
  let tauxTVA = 20 // Taux par defaut pour intrants/materiel
  if (intervention.coutMainOeuvre && intervention.coutMainOeuvre > 0 && !intervention.intrantCout) {
    categorie = 'main_oeuvre'
    tauxTVA = 10 // Services
  } else if (intervention.type === 'traitement_phyto') {
    categorie = 'intrants'
    tauxTVA = 20
  }

  // Determiner le module selon le contexte
  let moduleCible = 'potager'
  if (intervention.arbreId) {
    moduleCible = 'verger'
  }

  const { montantHT, montantTVA } = calculTVA(montantTTC, tauxTVA)

  const desc = intervention.description
    || `${intervention.type}${intervention.intrantNom ? ` - ${intervention.intrantNom}` : ''}`

  return inAutoComptaTransaction(tx, async (tx) => {
    const suivi = await suiviDuMiroirDepense(tx, { userId, sourceType: 'intervention', sourceId: intervention.id, auto: true }, montantTTC)
    await tx.depenseManuelle.deleteMany({
      where: { userId, sourceType: 'intervention', sourceId: intervention.id, auto: true },
    })

    return tx.depenseManuelle.create({
      data: {
        userId,
        date: intervention.date ? new Date(intervention.date) : new Date(),
        categorie,
        description: desc,
        tauxTVA,
        montantHT,
        montantTVA,
        montant: montantTTC,
        module: moduleCible,
        paye: true,
        sourceType: 'intervention',
        sourceId: intervention.id,
        auto: true,
        ...suivi,
      },
    })
  })
}
