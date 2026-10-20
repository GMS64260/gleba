/**
 * Invariant : une écriture dérivée appartient à sa source.
 *
 * Constat du 2026-08-13 : `DELETE` refusait déjà une ligne `auto`, mais
 * `PATCH` n'en refusait aucune — le montant d'une dépense d'achat d'animal
 * pouvait être réécrit à la main et divergeait de la fiche qui l'a produite.
 * Le refus ne peut pas être global : l'écran des impayés marque légitimement
 * `paye: true` sur une vente dérivée d'une récolte.
 */

import { describe, expect, it } from 'vitest'
import {
  CHAMPS_DE_SUIVI,
  CHAMPS_DE_SUIVI_SAISIS_VENTE,
  champsEnvoyes,
  libelleSource,
  refusModificationDerivee,
  selectSuiviConserve,
  suiviConserve,
} from '../ecriture-derivee'

/** Le garde raisonne sur les clés du corps brut, jamais sur la sortie de zod. */
const envoyes = (updates: Record<string, unknown>) => champsEnvoyes(updates)

const derivee = { auto: true, sourceType: 'achat_animal_individuel' }
const venteDerivee = { auto: true, sourceType: 'vente_produit' }
const manuelle = { auto: false, sourceType: null }

/** Champs que la source possède : jamais modifiables sur une ligne dérivée. */
const CHAMPS_SOURCE = [
  'date', 'montant', 'montantHT', 'montantTVA', 'tauxTVA', 'categorie', 'description',
  'quantite', 'unite', 'prixUnitaire', 'module', 'clientNom', 'clientId',
  'fournisseurNom', 'fournisseurId',
]

describe('modification d’une écriture dérivée', () => {
  it('laisse passer toute correction sur une écriture manuelle', () => {
    expect(refusModificationDerivee(manuelle, envoyes({ montant: 120 }), 'vente')).toBeNull()
    expect(refusModificationDerivee(manuelle, envoyes({ date: new Date() }), 'depense')).toBeNull()
    expect(refusModificationDerivee({}, envoyes({ montant: 1 }), 'vente')).toBeNull()
  })

  it('refuse un champ possédé par la source sur une écriture dérivée et le nomme', () => {
    const refus = refusModificationDerivee(derivee, envoyes({ id: 3, montant: 0 }), 'depense')
    expect(refus?.champ).toBe('montant')
    expect(refus?.error).toContain('générée automatiquement')
    expect(refus?.error).toContain('le montant')
    // Le message dit OÙ corriger, sinon l'utilisateur reste bloqué.
    expect(refus?.error).toContain("le prix d'achat d'un animal")
  })

  it('refuse tous les champs de la source, un par un', () => {
    for (const nature of ['vente', 'depense'] as const) {
      for (const champ of CHAMPS_SOURCE) {
        expect(
          refusModificationDerivee(derivee, envoyes({ id: 1, [champ]: 'x' }), nature)?.champ,
          `${champ} devrait être refusé sur une ${nature} dérivée`,
        ).toBe(champ)
      }
    }
  })

  // Ticket cmvgdzsf7 (2026-10-20) : liste blanche. Un champ que personne n'a
  // rangé (ici `prixUnitaire`, `tvaInferee`, `auto`) n'est plus accepté par défaut.
  it('refuse tout champ hors de la liste blanche du suivi', () => {
    for (const champ of ['tvaInferee', 'auto', 'sourceType', 'sourceId', 'champInconnu']) {
      expect(refusModificationDerivee(venteDerivee, envoyes({ id: 1, [champ]: 1 }), 'vente')?.champ).toBe(champ)
    }
  })

  it('laisse le suivi du règlement et la pièce ouverts sur une écriture dérivée', () => {
    // markAsPaid (écran des impayés) PATCHe `paye` sur des ventes dérivées
    // de récoltes : un refus global casserait « marquer comme payé ».
    for (const nature of ['vente', 'depense'] as const) {
      for (const champ of CHAMPS_DE_SUIVI[nature]) {
        expect(
          refusModificationDerivee(derivee, envoyes({ id: 1, [champ]: 'x' }), nature),
          `${champ} devrait rester modifiable sur une ${nature} dérivée`,
        ).toBeNull()
      }
    }
    expect(refusModificationDerivee(derivee, envoyes({ id: 1, paye: true }), 'vente')).toBeNull()
  })

  it("la référence fournisseur et l'échéance n'existent que sur une dépense", () => {
    expect(refusModificationDerivee(venteDerivee, envoyes({ refFacture: 'F-3' }), 'vente')?.champ).toBe('refFacture')
    expect(refusModificationDerivee(venteDerivee, envoyes({ dateEcheance: '2026-11-01' }), 'vente')?.champ).toBe('dateEcheance')
    expect(refusModificationDerivee(derivee, envoyes({ refFacture: 'F-3', dateEcheance: '2026-11-01' }), 'depense')).toBeNull()
  })

  it('le formulaire « Règlement et pièce » de Transactions n’envoie que des champs acceptés', () => {
    const corps = Object.fromEntries([['id', 909], ...CHAMPS_DE_SUIVI_SAISIS_VENTE.map((c) => [c, null])])
    expect(refusModificationDerivee(venteDerivee, champsEnvoyes(corps), 'vente')).toBeNull()
    // `paye` n'est pas saisi là : le statut affiché est celui de la source.
    expect(CHAMPS_DE_SUIVI_SAISIS_VENTE).not.toContain('paye')
  })

  it('nomme en clair un champ refusé, même hors des champs de la source', () => {
    const refus = refusModificationDerivee(venteDerivee, envoyes({ id: 1, refFacture: 'F-3', tvaInferee: false }), 'vente')
    expect(refus?.error).toContain('la référence de la facture fournisseur')
    expect(refus?.error).toContain("l'indicateur de TVA déduite")
    expect(refus?.error).toContain('ne se corrigent pas ici')
    expect(refus?.error).not.toMatch(/\brefFacture\b|\btvaInferee\b/)
  })

  it('refuse dès qu’un seul champ de la source est présent dans un lot mixte', () => {
    expect(
      refusModificationDerivee(derivee, envoyes({ paye: true, montant: 5 }), 'vente')?.champ,
    ).toBe('montant')
  })

  // Régression du 2026-08-13, arrivée en production : `.partial()` conserve les
  // `.default()`, donc la sortie de zod portait toujours tauxTVA/paye/journal.
  // Le garde refusait alors « marquer comme payé » sur une ligne dérivée.
  it('ignore les valeurs injectées par défaut, absentes du corps envoyé', () => {
    const sortieZod = { id: 7, paye: true, tauxTVA: 5.5, journal: 'VE' }
    const corpsReel = { id: 7, paye: true }
    expect(refusModificationDerivee(derivee, champsEnvoyes(corpsReel), 'vente')).toBeNull()
    // Preuve du piège : raisonner sur la sortie de zod refuserait à tort.
    expect(refusModificationDerivee(derivee, champsEnvoyes(sortieZod), 'vente')?.champ).toBe('tauxTVA')
    expect(champsEnvoyes(corpsReel).has('tauxTVA')).toBe(false)
  })

  it('tolère un corps illisible sans rien interdire', () => {
    expect(champsEnvoyes(null).size).toBe(0)
    expect(champsEnvoyes('texte').size).toBe(0)
    expect(champsEnvoyes([1, 2]).size).toBe(0)
    expect(refusModificationDerivee(derivee, champsEnvoyes(null), 'vente')).toBeNull()
  })

  it('nomme chaque source connue en clair', () => {
    expect(libelleSource('recolte')).toContain('récolte')
    expect(libelleSource('commande_boutique')).toContain('boutique')
    expect(libelleSource('production_bois')).toContain('bois')
    expect(libelleSource('paie_lait')).toContain('lait')
    expect(libelleSource(null)).toContain('Gleba')
    // Une source inconnue est citée telle quelle plutôt que masquée.
    expect(libelleSource('nouvelle_source')).toContain('nouvelle_source')
  })
})

describe('suivi reporté à la régénération d’un miroir de vente', () => {
  it('reprend la pièce non vide, jamais le statut payé', () => {
    const ancienne = { paye: false, modeReglement: 'Chèque', numeroPiece: 'CHQ-1', notes: null, journal: 'VE' }
    expect(suiviConserve(ancienne)).toEqual({ modeReglement: 'Chèque', numeroPiece: 'CHQ-1', journal: 'VE' })
    expect(suiviConserve(null)).toEqual({})
  })

  it('relit les seuls champs de suivi d’une vente, sans `paye`', () => {
    expect(selectSuiviConserve()).toEqual({ modeReglement: true, numeroPiece: true, journal: true, pjUrl: true, notes: true })
  })
})
