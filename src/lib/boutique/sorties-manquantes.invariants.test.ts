import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/prisma', () => ({ default: {} }))
import { quantiteRestantASortir } from './sorties-manquantes'

const GRAINE = 0x5171e5
describe(`sorties manquantes : conservation des quantités (graine ${GRAINE})`, () => {
  it('600 stocks : fractionner les sorties et convertir kg/g conserve le reliquat ; un retour restaure exactement la demande', () => {
    let graine = GRAINE
    const entier = (max: number) => {
      graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0
      return graine % max
    }
    for (let i = 0; i < 600; i++) {
      const oeufs = i % 3 === 0, grammes = i % 3 === 1
      const commandeId = i + 1
      const stockLieType = oeufs ? 'oeufs' : 'ruche'
      const stockLieRef = oeufs ? 'stock' : grammes ? 'propolis' : 'miel'
      const demande = entier(300) + 1, sorti = entier(demande * 2), retour = entier(sorti + 1)
      const facteur = oeufs || grammes ? 1 : 1000
      const m = (quantite: number, unite: string) => ({ commandeBoutiqueId: commandeId, articleStockType: stockLieType, articleStockId: stockLieRef, quantite, unite })
      const unite = oeufs ? 'pièce' : 'g'
      const mouvements = [m(sorti, unite), m(-retour, unite)]
      const ligne = { commandeId, stockLieType, stockLieRef, stockLieConditionnement: 1, quantite: demande / facteur, mouvementsStock: mouvements }
      const attendu = Math.max(0, demande - sorti + retour) / facteur
      expect(quantiteRestantASortir(ligne), `scénario ${i}`).toBe(attendu)
      const part = entier(sorti + 1)
      const fragments = [m(part, unite), m(sorti - part, unite), m(-retour, unite)]
      if (!oeufs) fragments[0] = m(part / 1000, 'kg')
      expect(quantiteRestantASortir({ ...ligne, mouvementsStock: fragments }), `fragments ${i}`).toBe(attendu)
      expect(quantiteRestantASortir({ ...ligne, mouvementsStock: [...mouvements, m(-(sorti - retour), unite)] }), `retour ${i}`).toBe(demande / facteur)
      // Une sortie d'une autre commande, d'un autre stock, ou dans une unité
      // incohérente ne peut jamais faire disparaître une anomalie.
      expect(quantiteRestantASortir({ ...ligne, mouvementsStock: [
        ...mouvements,
        { ...m(demande * 10, unite), commandeBoutiqueId: commandeId + 1 },
        { ...m(demande * 10, unite), articleStockId: 'autre-stock' },
        m(demande * 10, 'litre'),
      ] }), `origine ${i}`).toBe(attendu)
    }
  })
})
