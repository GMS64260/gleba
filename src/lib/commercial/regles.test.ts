import { describe, expect, it } from 'vitest'
import { arrondir, calculerDocument, contenuDocumentSchema, dateCivileSchema, transitionDocument, verifierSourcesFacturables, type SourceFacturable } from './regles'

const devis = { type: 'devis', statut: 'emis', dateValidite: new Date('2026-10-31T12:00:00Z'), factureId: null, bonLivraison: null }
const bon = (plus: Partial<SourceFacturable> = {}): SourceFacturable => ({
  type: 'livraison', statut: 'livre', clientId: 1, clientNom: 'Restaurant', clientAdresse: 'Adresse', clientSiret: null,
  clientSiren: null, clientTvaIntra: null, clientExonere: false, dateLivraison: new Date('2026-10-26T12:00:00Z'), categorieOperation: 'biens', factureId: null, ...plus,
})

describe('Documents commerciaux : montants et engagement', () => {
  it('conserve le demi-centime HT de 277,835, avec ou sans taxe', () => {
    for (const sansTaxe of [false, true]) {
      const r = calculerDocument([{ description: 'Lot fictif', quantite: 1, unite: 'kg', prixUnitaire: 277.835, tauxTVA: 0 }], sansTaxe)
      expect(r.lignes[0]).toMatchObject({ montantHT: 277.84, montantTVA: 0, montantTTC: 277.84 })
      expect(r.totalHT).toBe(277.84)
    }
  })
  it('conserve le demi-centime de TVA sur 225 HT à 2,1 %', () => {
    const r = calculerDocument([{ description: 'Lot fictif', quantite: 1, unite: 'kg', prixUnitaire: 225, tauxTVA: 2.1 }])
    expect(r.lignes[0]).toMatchObject({ montantHT: 225, montantTVA: 4.73, montantTTC: 229.73 })
    expect(r).toMatchObject({ totalHT: 225, totalTVA: 4.73, totalTTC: 229.73 })
  })
  it.each([
    [1, 277.834999999, 277.83], [1, 277.835000001, 277.84],
    [229.64, 645.625, 148261.33], [0.1, 0.35, 0.04],
    [1e-7, 50000, 0.01], [1e-7, 49999.99, 0],
  ])('arrondit le produit décimal %s × %s sans déplacer les seuils', (quantite, prixUnitaire, attendu) => {
    const r = calculerDocument([{ description: 'Lot fictif', quantite, unite: 'kg', prixUnitaire, tauxTVA: 0 }])
    expect(r.totalHT).toBe(attendu)
  })
  it('somme les arrondis de ligne, même lorsque la somme brute donnerait un autre total', () => {
    const r = calculerDocument(Array.from({ length: 2 }, () => ({ description: 'Lot fictif', quantite: 1, unite: 'kg', prixUnitaire: 0.05, tauxTVA: 10 as const })))
    expect(r).toMatchObject({ totalHT: 0.1, totalTVA: 0.02, totalTTC: 0.12 })
  })
  it.each([
    [277.835, 277.84], [277.834999999, 277.83], [277.835000001, 277.84],
    [-1.235, -1.23], [-1.235000001, -1.24], [-1.234999999, -1.23],
    [5e-3, 0.01], [1e-7, 0], [0, 0],
  ])('arrondit %s au centime %s, demi-centime vers le haut', (valeur, attendu) => {
    expect(arrondir(valeur)).toBe(attendu)
  })
  it('laisse le formulaire calculer avant validation des nombres non finis', () => {
    expect(arrondir(NaN)).toBeNaN()
    expect(arrondir(Infinity)).toBe(Infinity)
    expect(() => calculerDocument([{ description: 'Saisie provisoire', quantite: NaN, unite: 'kg', prixUnitaire: 1, tauxTVA: 0 }])).not.toThrow()
  })
  it('conserve la compensation historique pour un prorata déjà calculé en flottant', () => {
    // Le suivi commercial du verger transmet des proratas déjà multipliés.
    expect(arrondir(0.35 * 0.1 / 1)).toBe(0.04)
  })
  it('calcule et arrondit chaque ligne côté serveur sans mélanger les unités', () => {
    const r = calculerDocument([
      { description: 'Carottes', quantite: 3.25, unite: 'kg', prixUnitaire: 2.3, tauxTVA: 5.5 },
      { description: 'Fleurs', quantite: 7, unite: 'tiges', prixUnitaire: 1.2, tauxTVA: 10 },
    ])
    expect(r.lignes[0]).toMatchObject({ montantHT: 7.48, montantTVA: 0.41, montantTTC: 7.89, unite: 'kg' })
    expect(r.totalHT).toBe(15.88); expect(r.totalTVA).toBe(1.25); expect(r.totalTTC).toBe(17.13)
  })
  it('applique une exonération au prix HT annoncé, avant acceptation du devis', () => {
    expect(calculerDocument([{ description: 'Légumes', quantite: 2, unite: 'kg', prixUnitaire: 3, tauxTVA: 5.5 }], true)).toMatchObject({ totalHT: 6, totalTVA: 0, totalTTC: 6 })
  })
  it('refuse une date impossible, les totaux fournis par le navigateur et un devis sans validité', () => {
    expect(dateCivileSchema.safeParse('2026-02-31').success).toBe(false)
    const contenu = { type: 'devis', clientId: 1, date: '2026-10-26', dateValidite: '2026-10-30', dateLivraison: null,
      objet: 'Récolte', lignes: [{ description: 'Légumes', quantite: 1, unite: 'kg', prixUnitaire: 2, tauxTVA: 5.5 }] }
    expect(contenuDocumentSchema.safeParse(contenu).success).toBe(true)
    expect(contenuDocumentSchema.safeParse({ ...contenu, totalTTC: 0.01 }).success).toBe(false)
    expect(contenuDocumentSchema.safeParse({ ...contenu, dateValidite: null }).success).toBe(false)
  })
  it('accepte le dernier jour de validité à Paris et refuse un devis expiré', () => {
    expect(transitionDocument(devis, 'accepter', new Date('2026-10-31T20:00:00Z'))).toBe('accepte')
    expect(() => transitionDocument(devis, 'accepter', new Date('2026-10-31T23:30:00Z'))).toThrow('expiré')
  })
  it('fige les documents convertis et refuse les transitions inverses', () => {
    expect(() => transitionDocument({ ...devis, bonLivraison: { id: 'bl' } }, 'annuler')).toThrow('converti')
    expect(() => transitionDocument({ ...devis, factureId: 1 }, 'refuser')).toThrow('converti')
    expect(() => transitionDocument({ ...devis, statut: 'refuse' }, 'accepter')).toThrow('état')
  })
})

describe('Facturation groupée', () => {
  it('groupe des livraisons d’un même mois et d’une même identité client', () => {
    expect(() => verifierSourcesFacturables([bon(), bon({ dateLivraison: new Date('2026-10-01T12:00:00Z') })])).not.toThrow()
  })
  it.each([
    [{ clientId: 2 }, 'même client'], [{ clientNom: 'Nouveau nom' }, 'coordonnées'],
    [{ dateLivraison: new Date('2026-09-30T12:00:00Z') }, 'mois civil'],
    [{ statut: 'emis' }, 'marqués livrés'], [{ factureId: 8 }, 'déjà facturé'],
    [{ clientId: null }, 'fiche client'],
  ] as const)('refuse une sélection incompatible : %j', (changement, message) => {
    expect(() => verifierSourcesFacturables([bon(), bon(changement)])).toThrow(message)
  })
  it('ne facture pas directement un devis qui possède déjà un BL', () => {
    expect(() => verifierSourcesFacturables([bon({ type: 'devis', statut: 'accepte', bonLivraison: { id: 'bl' } })])).toThrow('sans bon')
    expect(() => verifierSourcesFacturables([bon({ type: 'devis', statut: 'accepte' })])).not.toThrow()
  })
})
