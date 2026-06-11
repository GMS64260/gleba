/**
 * Auto-Comptabilite - Generation automatique d'ecritures comptables
 *
 * Ce module cree/supprime automatiquement des VenteManuelle et DepenseManuelle
 * lorsque des operations (recoltes, ventes produits, abattages, interventions)
 * sont enregistrees dans les autres modules.
 *
 * Les ecritures auto sont identifiees par : auto=true, sourceType, sourceId
 */

import prisma from '@/lib/prisma'

// ============================================================
// HELPERS
// ============================================================

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
  table: 'vente' | 'depense'
) {
  if (table === 'vente') {
    return prisma.venteManuelle.deleteMany({
      where: { sourceType, sourceId, auto: true },
    })
  } else {
    return prisma.depenseManuelle.deleteMany({
      where: { sourceType, sourceId, auto: true },
    })
  }
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
    prixKg?: number | null
    prixTotal?: number | null
    clientNom?: string | null
    clientId?: number | null
    dateVente?: Date | string | null
    factureId?: number | null
  }
) {
  // Contrat anti-double-comptage (cf. kpi/compta.ts) : une vente facturée est
  // comptée via sa Facture — pas d'écriture auto en plus.
  if (recolte.factureId) {
    await deleteAutoEntry('recolte', recolte.id, 'vente')
    return null
  }

  const montantTTC = recolte.prixTotal || (recolte.quantite * (recolte.prixKg || 0))
  if (montantTTC <= 0) return null

  const { montantHT, montantTVA } = calculTVA(montantTTC, 5.5)

  // Transaction atomique : supprimer l'ancien + creer le nouveau
  return prisma.$transaction(async (tx) => {
    await tx.venteManuelle.deleteMany({
      where: { sourceType: 'recolte', sourceId: recolte.id, auto: true },
    })

    return tx.venteManuelle.create({
      data: {
        userId,
        date: recolte.dateVente ? new Date(recolte.dateVente) : new Date(),
        categorie: 'legumes',
        description: `Vente ${recolte.especeId} - ${recolte.quantite} kg`,
        quantite: recolte.quantite,
        unite: 'kg',
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
  }
) {
  const montantTTC = lot.prixAchatTotal || 0
  return prisma.$transaction(async (tx) => {
    await tx.depenseManuelle.deleteMany({
      where: { sourceType: 'achat_animal', sourceId: lot.id, auto: true },
    })
    if (montantTTC <= 0) return null
    const { montantHT, montantTVA } = calculTVA(montantTTC, 5.5)
    return tx.depenseManuelle.create({
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
        sourceType: 'achat_animal',
        sourceId: lot.id,
        auto: true,
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
  }
) {
  // Vente facturée ⇒ comptée via la Facture, pas d'écriture auto (cf. kpi/compta.ts).
  if (recolteArbre.factureId) {
    await deleteAutoEntry('recolte_arbre', recolteArbre.id, 'vente')
    return null
  }

  const montantTTC = recolteArbre.prixTotal || (recolteArbre.quantite * (recolteArbre.prixKg || 0))
  if (montantTTC <= 0) return null

  const { montantHT, montantTVA } = calculTVA(montantTTC, 5.5)

  const arbreNom = recolteArbre.arbre?.nom || 'Fruits'
  const especeNom = recolteArbre.arbre?.espece || ''

  return prisma.$transaction(async (tx) => {
    await tx.venteManuelle.deleteMany({
      where: { sourceType: 'recolte_arbre', sourceId: recolteArbre.id, auto: true },
    })

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
        paye: true,
        sourceType: 'recolte_arbre',
        sourceId: recolteArbre.id,
        auto: true,
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
  }
) {
  // Vente facturée ⇒ comptée via la Facture, pas d'écriture auto (cf. kpi/compta.ts).
  if (venteProduit.factureId) {
    await deleteAutoEntry('vente_produit', venteProduit.id, 'vente')
    return null
  }

  const montantTTC = venteProduit.prixTotal
  if (montantTTC <= 0) return null

  const taux = venteProduit.tauxTVA ?? 5.5
  const { montantHT, montantTVA } = calculTVA(montantTTC, taux)

  // Determiner la categorie selon le type de produit
  let categorie = 'autre'
  if (venteProduit.type === 'oeufs') categorie = 'oeufs'
  else if (venteProduit.type === 'viande') categorie = 'viande'
  else if (venteProduit.type === 'lait') categorie = 'lait'
  else if (venteProduit.type === 'animal_vivant') categorie = 'viande'

  return prisma.$transaction(async (tx) => {
    await tx.venteManuelle.deleteMany({
      where: { sourceType: 'vente_produit', sourceId: venteProduit.id, auto: true },
    })

    return tx.venteManuelle.create({
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
        paye: true,
        sourceType: 'vente_produit',
        sourceId: venteProduit.id,
        auto: true,
      },
    })
  })
}

/**
 * Cree une VenteManuelle quand un Abattage a une vente (destination = "vente")
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
  }
) {
  // Vente facturée ⇒ comptée via la Facture, pas d'écriture auto (cf. kpi/compta.ts).
  if (abattage.factureId) {
    await deleteAutoEntry('abattage', abattage.id, 'vente')
    return null
  }

  // Uniquement si destination = vente et qu'il y a un prix
  if (abattage.destination !== 'vente' || !abattage.prixVente || abattage.prixVente <= 0) {
    // Nettoyer toute ecriture auto residuelle
    await deleteAutoEntry('abattage', abattage.id, 'vente')
    return null
  }

  const montantTTC = abattage.prixVente
  const tauxAbattage = abattage.tauxTVA ?? 5.5
  const { montantHT, montantTVA } = calculTVA(montantTTC, tauxAbattage)

  const animalInfo = abattage.animal?.nom || abattage.lot?.nom || 'Abattage'

  return prisma.$transaction(async (tx) => {
    await tx.venteManuelle.deleteMany({
      where: { sourceType: 'abattage', sourceId: abattage.id, auto: true },
    })

    return tx.venteManuelle.create({
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
  }
) {
  // Vente facturée ⇒ comptée via la Facture, pas d'écriture auto (cf. kpi/compta.ts).
  if (productionBois.factureId) {
    await deleteAutoEntry('production_bois', productionBois.id, 'vente')
    return null
  }

  const montantTTC = productionBois.prixVente || 0
  if (montantTTC <= 0) return null

  const { montantHT, montantTVA } = calculTVA(montantTTC, 10) // Bois = TVA 10%

  const typeLabel = productionBois.type || 'Bois'
  const arbreNom = productionBois.arbre?.nom || ''
  const volumeInfo = productionBois.volumeM3 ? `${productionBois.volumeM3} m³` : ''
  const descParts = [`Vente bois - ${typeLabel}`, arbreNom, volumeInfo].filter(Boolean)

  return prisma.$transaction(async (tx) => {
    await tx.venteManuelle.deleteMany({
      where: { sourceType: 'production_bois', sourceId: productionBois.id, auto: true },
    })

    return tx.venteManuelle.create({
      data: {
        userId,
        date: productionBois.dateVente ? new Date(productionBois.dateVente) : new Date(),
        categorie: 'bois',
        description: descParts.join(' - '),
        quantite: productionBois.volumeM3 || productionBois.poidsKg || null,
        unite: productionBois.volumeM3 ? 'm³' : (productionBois.poidsKg ? 'kg' : null),
        tauxTVA: 10,
        montantHT,
        montantTVA,
        montant: montantTTC,
        clientId: productionBois.clientId || null,
        clientNom: productionBois.clientNom || null,
        module: 'verger',
        paye: true,
        sourceType: 'production_bois',
        sourceId: productionBois.id,
        auto: true,
      },
    })
  })
}

// ============================================================
// DEPENSES AUTOMATIQUES
// ============================================================

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
  }
) {
  const montantTTC = intervention.coutTotal || 0
  if (montantTTC <= 0) return null

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
  let module = 'potager'
  if (intervention.arbreId) {
    module = 'verger'
  }

  const { montantHT, montantTVA } = calculTVA(montantTTC, tauxTVA)

  const desc = intervention.description
    || `${intervention.type}${intervention.intrantNom ? ` - ${intervention.intrantNom}` : ''}`

  return prisma.$transaction(async (tx) => {
    await tx.depenseManuelle.deleteMany({
      where: { sourceType: 'intervention', sourceId: intervention.id, auto: true },
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
        module,
        paye: true,
        sourceType: 'intervention',
        sourceId: intervention.id,
        auto: true,
      },
    })
  })
}
