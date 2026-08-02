import { describe, expect, it } from 'vitest'
import { analyseConsoleArgs } from '../error-journal'

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
