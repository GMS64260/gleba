import { describe, expect, it, vi } from 'vitest'
import { ouvrirDictee, type ReconnaissanceVocale } from './dictee-vocale'

function banc() {
  class Micro {
    static instance: Micro
    lang = ''; continuous = true; interimResults = false
    onresult: ReconnaissanceVocale['onresult'] = null
    onerror: ReconnaissanceVocale['onerror'] = null
    onend: ReconnaissanceVocale['onend'] = null
    start = vi.fn(); stop = vi.fn(); abort = vi.fn()
    constructor() { Micro.instance = this }
  }
  const callbacks = { texte: vi.fn(), erreur: vi.fn(), fin: vi.fn() }
  const session = ouvrirDictee(Micro, 'Note', callbacks)
  return { micro: Micro.instance, callbacks, session }
}

describe('dictée au jardin', () => {
  it('remplace les hypothèses sans doubler les mots et préserve le texte saisi', () => {
    const { micro, callbacks } = banc()
    micro.onresult?.({ results: [[{ transcript: 'deux kilos de tomate' }]] })
    micro.onresult?.({ results: [[{ transcript: 'deux kilos de tomates' }], [{ transcript: 'sur A1' }]] })
    expect(callbacks.texte).toHaveBeenLastCalledWith('Note deux kilos de tomates sur A1')
    expect(micro.lang).toBe('fr-FR')
    expect(micro.interimResults).toBe(true)
  })
  it('arrête le micro à la fermeture et ignore les résultats tardifs', () => {
    const { micro, callbacks, session } = banc()
    const resultatTardif = micro.onresult
    session.detruire()
    resultatTardif?.({ results: [[{ transcript: 'oui' }]] })
    expect(micro.abort).toHaveBeenCalledOnce()
    expect(callbacks.texte).not.toHaveBeenCalled()
    expect(micro.onresult).toBeNull()
  })
  it('laisse le navigateur terminer la dernière phrase avant de rendre la main', () => {
    const { micro, callbacks, session } = banc()
    session.arreter()
    expect(micro.stop).toHaveBeenCalledOnce()
    expect(callbacks.fin).not.toHaveBeenCalled()
    micro.onend?.()
    expect(callbacks.fin).toHaveBeenCalledOnce()
  })
  it('explique le refus du micro et la panne réseau sans effacer la saisie', () => {
    const { micro, callbacks } = banc()
    micro.onerror?.({ error: 'not-allowed' })
    expect(callbacks.erreur).toHaveBeenLastCalledWith(expect.stringContaining('refusé'))
    micro.onerror?.({ error: 'network' })
    expect(callbacks.erreur).toHaveBeenLastCalledWith(expect.stringContaining('conservé'))
    expect(callbacks.texte).not.toHaveBeenCalled()
  })
})
