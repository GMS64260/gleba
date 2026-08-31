import { describe, expect, it } from 'vitest'
import { SmtpNonConfigureError } from '../mail'
import { qualifierEchecEnvoi } from '../mail-verification'
import {
  estCauseConnue,
  PHRASE_ECHEC_ENVOI,
  relanceUtile,
  type CauseEchecEnvoi,
} from '../mail-verification-messages'

/**
 * Issue #32 (Siruv, 2026-08-26) : sur une instance auto-hébergée sans SMTP,
 * `sendMail` se contentait de `return`, `envoyerVerification` concluait
 * `envoye: true`, et l'inscrit lisait « Vérifiez votre email » pour un message
 * qui n'existait pas — puis ne pouvait plus jamais se connecter, `authorize()`
 * refusant tant que l'adresse n'est pas vérifiée. Impasse totale.
 */
describe('qualifierEchecEnvoi', () => {
  it('distingue une instance sans SMTP', () => {
    expect(qualifierEchecEnvoi(new SmtpNonConfigureError())).toBe('smtp_absent')
  })

  it("reconnaît le code même si l'erreur a traversé une frontière de module", () => {
    expect(qualifierEchecEnvoi({ code: 'SMTP_NON_CONFIGURE' })).toBe('smtp_absent')
  })

  it('distingue un refus définitif du destinataire', () => {
    expect(qualifierEchecEnvoi({ responseCode: 550 })).toBe('adresse_refusee')
    expect(qualifierEchecEnvoi(new Error('invalid DNS MX or A/AAAA resource record'))).toBe(
      'adresse_refusee',
    )
  })

  it('retombe sur une panne temporaire par défaut', () => {
    expect(qualifierEchecEnvoi(new Error('SMTP_TIMEOUT'))).toBe('envoi_impossible')
  })
})

describe('consigne rendue à l’utilisateur', () => {
  const causes: CauseEchecEnvoi[] = ['adresse_refusee', 'smtp_absent', 'envoi_impossible']

  it('chaque cause porte une phrase', () => {
    for (const cause of causes) {
      expect(PHRASE_ECHEC_ENVOI[cause]).toBeTruthy()
    }
  })

  it('ne propose pas de relance quand aucun envoi ne peut aboutir', () => {
    // Relancer sur une instance sans SMTP fait tourner l'inscrit à vide.
    expect(relanceUtile('smtp_absent')).toBe(false)
    expect(relanceUtile('adresse_refusee')).toBe(true)
    expect(relanceUtile('envoi_impossible')).toBe(true)
  })

  it('oriente vers l’administrateur de l’instance, pas vers un réessai', () => {
    expect(PHRASE_ECHEC_ENVOI.smtp_absent).toMatch(/administrateur/i)
  })

  it('ne fait confiance qu’aux causes connues venues de l’API', () => {
    expect(estCauseConnue('smtp_absent')).toBe(true)
    expect(estCauseConnue('constructor')).toBe(false)
    expect(estCauseConnue(null)).toBe(false)
  })
})
