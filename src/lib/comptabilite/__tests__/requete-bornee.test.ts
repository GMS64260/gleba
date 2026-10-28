import { describe, expect, it } from 'vitest'
import { lireJsonBorne } from '../requete-bornee'

describe('requêtes de banque bornées', () => {
  it('refuse un corps trop grand sans dépendre de Content-Length', async () => {
    const request = new Request('http://localhost/', {
      method: 'POST',
      body: '{"csv":"' + 'x'.repeat(100) + '"}',
    })
    await expect(lireJsonBorne(request, 32)).rejects.toMatchObject({ status: 413 })
  })
  it('refuse un JSON invalide et décode un corps valide', async () => {
    await expect(
      lireJsonBorne(new Request('http://localhost/', { method: 'POST', body: '{' }), 32),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      lireJsonBorne(
        new Request('http://localhost/', { method: 'POST', body: '{"montant":"30,03"}' }),
        32,
      ),
    ).resolves.toEqual({ montant: '30,03' })
  })
})
