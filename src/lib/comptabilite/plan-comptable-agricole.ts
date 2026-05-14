/**
 * Plan Comptable Agricole simplifié (PCG agricole 2026).
 * Mapping catégorie métier → numéro de compte général.
 *
 * Référence : Plan comptable général adapté à l'agriculture (CRC 99-03 +
 * adaptations agricoles arrêté du 11/12/1986). Les comptes ici utilisés
 * sont les plus courants pour une exploitation agricole de petite taille.
 *
 * L'exploitant peut surcharger ce mapping via préférence utilisateur (à venir).
 */

/** Comptes de bilan (classes 1-5). */
export const COMPTES_BILAN = {
  // Trésorerie
  banque: '512100',          // Banque (compte courant)
  caisse: '530100',          // Caisse en espèces
  // Tiers
  clients: '411000',         // Créances clients
  fournisseurs: '401000',    // Dettes fournisseurs
  // TVA
  tvaCollectee: '445700',    // TVA collectée (sur ventes)
  tvaDeductibleBiens: '445660', // TVA déductible sur autres biens et services
  tvaDeductibleImmo: '445620',  // TVA déductible sur immobilisations
  tvaAPayer: '445510',       // TVA à décaisser
  // Capitaux
  capital: '101000',
  resultatExercice: '120000',
} as const

/** Comptes de produits (classe 7) — ventes. */
export const COMPTES_VENTES: Record<string, { num: string; lib: string }> = {
  // Production agricole vendue (701)
  legumes: { num: '701100', lib: 'Ventes de légumes' },
  fruits: { num: '701200', lib: 'Ventes de fruits' },
  oeufs: { num: '701300', lib: 'Ventes d\'œufs' },
  viande: { num: '701400', lib: 'Ventes de viande / volailles' },
  produits_transformes: { num: '701500', lib: 'Ventes de produits transformés' },
  // Production animale (702)
  animaux_vivants: { num: '702100', lib: 'Ventes d\'animaux vivants' },
  bois: { num: '702300', lib: 'Ventes de bois' },
  // Travaux & prestations agricoles (706)
  service: { num: '706000', lib: 'Prestations de services agricoles' },
  prestation: { num: '706000', lib: 'Prestations de services agricoles' },
  // Autres produits (708 / 758)
  autre: { num: '708000', lib: 'Autres produits d\'activité annexe' },
  transformation: { num: '701500', lib: 'Ventes de produits transformés' },
}

/** Comptes de charges (classe 6) — achats. */
export const COMPTES_ACHATS: Record<string, { num: string; lib: string }> = {
  // Intrants culture
  semences: { num: '601100', lib: 'Achats de semences et plants' },
  plants: { num: '601100', lib: 'Achats de semences et plants' },
  // Intrants élevage
  aliments: { num: '601200', lib: 'Achats d\'aliments pour animaux' },
  aliments_animaux: { num: '601200', lib: 'Achats d\'aliments pour animaux' },
  animaux: { num: '601300', lib: 'Achats d\'animaux' },
  // Phyto, fertilisants
  fertilisants: { num: '601400', lib: 'Achats d\'engrais et amendements' },
  phyto: { num: '601500', lib: 'Achats de produits phytosanitaires' },
  // Énergie / carburant
  carburant: { num: '606400', lib: 'Carburants' },
  energie: { num: '606100', lib: 'Eau, électricité, gaz' },
  // Matériel
  materiel: { num: '215400', lib: 'Achats de matériel agricole' }, // immo si > seuil
  petit_outillage: { num: '606300', lib: 'Petit outillage' },
  // Travaux & prestations reçus
  prestation: { num: '611000', lib: 'Sous-traitance, prestations' },
  travaux_agricoles: { num: '611000', lib: 'Travaux agricoles par tiers' },
  veterinaire: { num: '622500', lib: 'Honoraires vétérinaires' },
  // Charges sociales
  msa: { num: '645100', lib: 'Cotisations MSA' },
  cotisations: { num: '645100', lib: 'Cotisations sociales' },
  main_oeuvre: { num: '641000', lib: 'Rémunérations du personnel' },
  // Abonnements
  abonnement: { num: '628000', lib: 'Abonnements, divers services' },
  // Autres
  autre: { num: '658000', lib: 'Charges diverses de gestion courante' },
}

/** Journaux comptables (codes courts). */
export const JOURNAUX: Record<string, string> = {
  VE: 'Journal des ventes',
  AC: 'Journal des achats',
  BQ: 'Journal de banque',
  CA: 'Journal de caisse',
  OD: 'Journal des opérations diverses',
}

/**
 * Mapping mode_reglement → compte de trésorerie.
 * Sert à générer la contrepartie d'une vente ou d'un achat.
 */
export function compteTresorerie(modeReglement: string | null | undefined): string | null {
  if (!modeReglement) return null
  switch (modeReglement) {
    case 'Espèces':
      return COMPTES_BILAN.caisse
    case 'Chèque':
    case 'Virement':
    case 'CB':
    case 'Prélèvement':
      return COMPTES_BILAN.banque
    case 'À crédit':
      return null // pas de mouvement de trésorerie
    default:
      return null
  }
}

export function compteVente(categorie: string | null | undefined): { num: string; lib: string } {
  if (!categorie) return COMPTES_VENTES.autre
  return COMPTES_VENTES[categorie] || COMPTES_VENTES.autre
}

export function compteAchat(categorie: string | null | undefined): { num: string; lib: string } {
  if (!categorie) return COMPTES_ACHATS.autre
  return COMPTES_ACHATS[categorie] || COMPTES_ACHATS.autre
}
