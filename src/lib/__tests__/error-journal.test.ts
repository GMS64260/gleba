import { describe, expect, it } from 'vitest'
import { analyseConsoleArgs, estRefusAuthentificationNormal } from '../error-journal'

describe('analyseConsoleArgs — détection des erreurs de routes API', () => {
  it("capture la convention `console.error('PUT /api/... error:', err)` avec la route", () => {
    // Cas fondateur du 2026-08-02 : 10 occurrences de cette forme, vues par
    // hasard dans les logs docker puis perdues au redéploiement.
    const analyse = analyseConsoleArgs([
      'PUT /api/cultures/[id] error:',
      new Error('Invalid `prisma.culture.update()` invocation'),
    ])
    expect(analyse).not.toBeNull()
    expect(analyse!.route).toBe('PUT /api/cultures/[id]')
    expect(analyse!.message).toContain('prisma.culture.update')
  })

  it('capture une Error sans préfixe de route (route inconnue)', () => {
    const analyse = analyseConsoleArgs([new Error('boom')])
    expect(analyse).not.toBeNull()
    expect(analyse!.route).toBeNull()
    expect(analyse!.message).toContain('boom')
  })

  it('ignore le bruit sans rapport avec une erreur', () => {
    expect(analyseConsoleArgs(['démarrage du cache météo'])).toBeNull()
  })

  it('ignore les lignes prisma: orphelines (déjà couvertes par la route appelante)', () => {
    expect(analyseConsoleArgs(['prisma:error '])).toBeNull()
  })

  it('tronque les messages démesurés', () => {
    const analyse = analyseConsoleArgs(['GET /api/x error:', 'y'.repeat(10_000)])
    expect(analyse!.message.length).toBeLessThanOrEqual(4000)
  })
})

/**
 * 2026-08-26 : `api_errors` comptait une ligne rouge à chaque mot de passe mal
 * saisi. Sur la fenêtre observée, 51 refus « mauvais mot de passe » sur 8
 * comptes et 24 « email non vérifié » sur 7 comptes — tous des fonctionnements
 * normaux. Un compteur d'erreurs qui compte des non-incidents cesse d'être un
 * signal, et c'est celui qu'on regarde après une bascule.
 */
describe('refus de connexion — non-incidents', () => {
  const REFUS = '\u001b[31m[auth][error]\u001b[0m CredentialsSignin: Read more at https://errors.authjs.dev#credentialssignin'

  it('reconnaît un refus d’identifiants', () => {
    expect(estRefusAuthentificationNormal(REFUS)).toBe(true)
  })

  it('ne journalise pas un refus de connexion', () => {
    expect(analyseConsoleArgs([REFUS])).toBeNull()
  })

  it('continue de journaliser une VRAIE panne du callback', () => {
    // `CallbackRouteError` n'est plus la trace d'un refus depuis que les motifs
    // passent par `CredentialsSignin` : il ne reste qu'aux pannes réelles.
    const panne = '\u001b[31m[auth][error]\u001b[0m CallbackRouteError: Read more at https://errors.authjs.dev#callbackrouteerror'
    expect(estRefusAuthentificationNormal(panne)).toBe(false)
    expect(analyseConsoleArgs([panne])).not.toBeNull()
  })

  it('ne filtre pas une erreur applicative qui mentionnerait le mot', () => {
    const analyse = analyseConsoleArgs([
      'POST /api/cultures error:',
      new Error('CredentialsSignin mentionné dans un message métier'),
    ])
    expect(analyse).not.toBeNull()
  })
})
