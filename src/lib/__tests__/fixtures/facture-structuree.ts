import type { DonneesFactureStructuree } from '@/lib/facture-structuree'

/** Facture structurée fictive (émetteur et client fictifs, SIRET de test valides) partagée par les tests UBL, CII et Factur-X. */
export const factureStructuree = (): DonneesFactureStructuree => ({
  number: 'F-2026-0042',
  issueDate: new Date('2026-07-22T10:00:00Z'),
  dueDate: new Date('2026-08-21T10:00:00Z'),
  currency: 'EUR',
  supplier: { name: 'Ferme & Fils', siret: '732 829 320 00074', siren: '732829320', vatId: 'FR 44 732829320', email: 'contact@ferme.example', address: { street: '1 rue Verte', city: 'Pau', postalCode: '64000', country: 'France' } },
  customer: { name: 'Épicerie <Bio>', siret: '55210055400013', siren: '552100554', vatId: 'FR40552100554', email: 'achats@epicerie.example', address: { street: '2 rue Bio', city: 'Bayonne', postalCode: '64100', country: 'FR' } },
  lines: [
    { id: 1, description: 'Huile & olives', quantity: 2, unit: 'litre', unitPrice: 10, netAmount: 20, vatRate: 5.5 },
    { id: 2, description: 'Prestation de livraison', quantity: 1.5, unit: 'heure', unitPrice: 20, netAmount: 30, vatRate: 20 },
  ],
  totalNet: 50,
  totalVat: 7.1,
  totalGross: 57.1,
  paymentReference: 'F-2026-0042',
  paymentIban: 'FR76 3000 6000 0112 3456 7890 189',
  notes: 'Commande de juillet',
  buyerReference: null,
  typeCode: '380',
  categorieOperation: 'mixte',
  cadreFacturation: 'M1',
  traitement: 'B2B',
  mentions: [
    { code: 'AAB', texte: 'Escompte pour règlement anticipé : néant.' },
    { code: 'PMD', texte: 'Pénalités de retard : 3 × taux légal en cas de paiement après échéance (art. L441-10 C. com.).' },
    { code: 'PMT', texte: 'Indemnité forfaitaire pour frais de recouvrement : 40,00 € (art. L441-10 C. com.).' },
  ],
  exonerationTva: null,
  factureOrigine: null,
  conditionsPaiement: '30 jours fin de mois',
  optionTvaDebits: false,
  dateLivraison: new Date('2026-07-21T10:00:00Z'),
  adresseLivraison: null,
  paiement: null,
})
