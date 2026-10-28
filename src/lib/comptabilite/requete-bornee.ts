import { ErreurReglement } from './monnaie'

/** Limite aussi les requêtes sans Content-Length (transfert par morceaux). */
export async function lireJsonBorne(request: Request, limite: number): Promise<unknown> {
  if (Number(request.headers.get('content-length') || 0) > limite) {
    throw new ErreurReglement('Requête trop volumineuse.', 413)
  }
  const lecteur = request.body?.getReader()
  if (!lecteur) throw new ErreurReglement('Données invalides.', 400)
  const morceaux: Uint8Array[] = []
  let taille = 0
  try {
    while (true) {
      const { value, done } = await lecteur.read()
      if (done) break
      taille += value.byteLength
      if (taille > limite) {
        await lecteur.cancel()
        throw new ErreurReglement('Requête trop volumineuse.', 413)
      }
      morceaux.push(value)
    }
  } finally {
    lecteur.releaseLock()
  }
  try {
    return JSON.parse(Buffer.concat(morceaux).toString('utf8'))
  } catch {
    throw new ErreurReglement('Données invalides.', 400)
  }
}
