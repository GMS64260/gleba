import { describe, expect, it } from 'vitest'
import {
  categorieFecLigneFactureElevage,
  categorieFecMiroirDepense,
  categorieFecMiroirVente,
} from '@/lib/comptabilite/categorie-fec'
import { compteAchat, compteVente } from '@/lib/comptabilite/plan-comptable-agricole'

describe('classement FEC des écritures d’élevage', () => {
  it('l’achat d’un lot ou d’un animal va en 601300, pas en charges diverses', () => {
    expect(compteAchat('achats').num).toBe('658000') // catégorie d'affichage du miroir
    expect(compteAchat(categorieFecMiroirDepense('achat_animal', 'achats')).num).toBe('601300')
    expect(compteAchat(categorieFecMiroirDepense('achat_animal_individuel', 'achats')).num).toBe('601300')
    // Une dépense saisie à la main garde sa catégorie.
    expect(categorieFecMiroirDepense(null, 'veterinaire')).toBe('veterinaire')
  })

  it('la paie du lait rejoint le compte du lait vendu en direct, la réservation celui des animaux vivants', () => {
    expect(compteVente(categorieFecMiroirVente('paie_lait', 'lait')).num).toBe('701500')
    expect(compteVente(categorieFecMiroirVente('reservation_elevage', 'animal_vivant')).num).toBe('702100')
    expect(categorieFecMiroirVente('commande_boutique', 'legumes')).toBe('legumes')
  })

  it('la ligne d’une facture d’élevage est classée par sa source, pas par son libellé', () => {
    const ligne = [{ description: 'animal_vivant - Brebis 1234' }]
    expect(categorieFecLigneFactureElevage({ lignes: ligne, ventesProduits: [{ type: 'animal_vivant' }], abattages: [] })).toBe('animaux_vivants')
    expect(categorieFecLigneFactureElevage({ lignes: [{ description: 'Marguerite' }], ventesProduits: [], abattages: [{ id: 4 }] })).toBe('viande')
    // Facture libre, ou à plusieurs lignes : classement par libellé (null ici).
    expect(categorieFecLigneFactureElevage({ lignes: ligne, ventesProduits: [], abattages: [] })).toBeNull()
    expect(categorieFecLigneFactureElevage({ lignes: [...ligne, ...ligne], ventesProduits: [{ type: 'oeufs' }] })).toBeNull()
  })
})
