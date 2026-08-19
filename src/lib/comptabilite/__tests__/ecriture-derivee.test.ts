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
  CHAMPS_DE_LA_SOURCE,
  champsEnvoyes,
  libelleSource,
  refusModificationDerivee,
} from '../ecriture-derivee'

/** Le garde raisonne sur les clés du corps brut, jamais sur la sortie de zod. */
const envoyes = (updates: Record<string, unknown>) => champsEnvoyes(updates)

const derivee = { auto: true, sourceType: 'achat_animal_individuel' }
const manuelle = { auto: false, sourceType: null }

describe('modification d’une écriture dérivée', () => {
  it('laisse passer toute correction sur une écriture manuelle', () => {
    expect(refusModificationDerivee(manuelle, envoyes({ montant: 120 }))).toBeNull()
    expect(refusModificationDerivee(manuelle, envoyes({ date: new Date() }))).toBeNull()
    expect(refusModificationDerivee({}, envoyes({ montant: 1 }))).toBeNull()
  })

  it('refuse un champ possédé par la source sur une écriture dérivée', () => {
    const refus = refusModificationDerivee(derivee, envoyes({ montant: 0 }))
    expect(refus).toContain('générée automatiquement')
    expect(refus).toContain('montant')
    // Le message dit OÙ corriger, sinon l'utilisateur reste bloqué.
    expect(refus).toContain("le prix d'achat d'un animal")
  })

  it('refuse tous les champs de la source, un par un', () => {
    for (const champ of CHAMPS_DE_LA_SOURCE) {
      expect(
        refusModificationDerivee(derivee, envoyes({ [champ]: 'x' })),
        `${champ} devrait être refusé sur une ligne dérivée`,
      ).not.toBeNull()
    }
  })

  it('laisse le suivi du règlement ouvert sur une écriture dérivée', () => {
    // markAsPaid (écran des impayés) PATCHe `paye` sur des ventes dérivées
    // de récoltes : un refus global casserait « marquer comme payé ».
    for (const updates of [
      { paye: true },
      { notes: 'chèque remis' },
      { modeReglement: 'cheque' },
      { numeroPiece: 'PC-2026-14' },
      { refFacture: 'F-2026-3' },
      { dateEcheance: new Date() },
      { pjUrl: '/x.pdf' },
      { journal: 'VE' },
    ]) {
      expect(
        refusModificationDerivee(derivee, envoyes(updates)),
        `${Object.keys(updates)[0]} devrait rester modifiable`,
      ).toBeNull()
    }
  })

  it('refuse dès qu’un seul champ de la source est présent dans un lot mixte', () => {
    expect(
      refusModificationDerivee(derivee, envoyes({ paye: true, montant: 5 })),
    ).not.toBeNull()
  })

  // Régression du 2026-08-13, arrivée en production : `.partial()` conserve les
  // `.default()`, donc la sortie de zod portait toujours tauxTVA/paye/journal.
  // Le garde refusait alors « marquer comme payé » sur une ligne dérivée.
  it('ignore les valeurs injectées par défaut, absentes du corps envoyé', () => {
    const sortieZod = { id: 7, paye: true, tauxTVA: 5.5, journal: 'VE' }
    const corpsReel = { id: 7, paye: true }
    expect(refusModificationDerivee(derivee, champsEnvoyes(corpsReel))).toBeNull()
    // Preuve du piège : raisonner sur la sortie de zod refuserait à tort.
    expect(champsEnvoyes(sortieZod).has('tauxTVA')).toBe(true)
    expect(champsEnvoyes(corpsReel).has('tauxTVA')).toBe(false)
  })

  it('tolère un corps illisible sans rien interdire', () => {
    expect(champsEnvoyes(null).size).toBe(0)
    expect(champsEnvoyes('texte').size).toBe(0)
    expect(champsEnvoyes([1, 2]).size).toBe(0)
    expect(refusModificationDerivee(derivee, champsEnvoyes(null))).toBeNull()
  })

  it('nomme chaque source connue en clair', () => {
    expect(libelleSource('recolte')).toContain('récolte')
    expect(libelleSource('commande_boutique')).toContain('boutique')
    expect(libelleSource(null)).toContain('Gleba')
    // Une source inconnue est citée telle quelle plutôt que masquée.
    expect(libelleSource('nouvelle_source')).toContain('nouvelle_source')
  })
})
