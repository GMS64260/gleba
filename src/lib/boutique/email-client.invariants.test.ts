import { describe, expect, it } from 'vitest'
import { qualifierEchecEnvoi } from '@/lib/mail-envoi'

const GRAINE = 20261117

describe(`classification des notifications boutique — graine ${GRAINE}`, () => {
  it('classe les refus SMTP sans dépendre du destinataire ni du statut métier (600 entrées)', () => {
    let graine = GRAINE
    for (let n = 0; n < 600; n++) {
      graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0
      const definitif = n % 2 === 0
      const responseCode = (definitif ? 500 : 400) + graine % 100
      const erreur = Object.assign(new Error(`Erreur de transport fictive ${graine}`), { responseCode, recipient: `client-${n}@example.invalid` })
      expect(qualifierEchecEnvoi(erreur), `entrée ${n}, code ${responseCode}`).toBe(definitif ? 'adresse_refusee' : 'envoi_impossible')
    }
  })
})
