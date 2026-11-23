import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ default: {} }))

import { libelleCategorieDepense } from '@/lib/comptabilite/stats-exercice'

// FB-6PQOC4 — la liste et le CSV des dépenses rangeaient en « Autre » toute
// catégorie hors matériel, carburant, main d'œuvre et abonnement.
describe('libellé d’une catégorie de dépense', () => {
  it.each([
    ['semences', 'Semences et plants'], ['aliments', 'Alimentation animale'],
    ['fertilisants', 'Engrais et amendements'], ['phyto', 'Produits phytosanitaires'],
    ['energie', 'Énergie'], ['petit_outillage', 'Petit outillage'], ['prestation', 'Prestations'],
    ['veterinaire', 'Vétérinaire'], ['msa', 'Cotisations MSA'], ['materiel', 'Matériel'],
  ])('%s → %s', (cle, libelle) => {
    expect(libelleCategorieDepense(cle)).toBe(libelle)
  })
  it('garde le nom d’une catégorie inconnue au lieu de la ranger en « Autre »', () => {
    expect(libelleCategorieDepense('frais_de_marche')).toBe('Frais de marche')
    expect(libelleCategorieDepense('')).toBe('Autre')
    expect(libelleCategorieDepense(null)).toBe('Autre')
  })
})
