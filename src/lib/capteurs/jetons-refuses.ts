/**
 * Empreintes de jetons déjà refusées, gardées 10 min : un webhook resté sur un
 * jeton périmé (régénéré sans être reporté dans TTN) ne coûte plus de lecture
 * en base à chaque envoi. Ne bloque jamais un jeton valide : un jeton créé ou
 * régénéré a une empreinte neuve (192 bits aléatoires), absente d'ici.
 * En mémoire, un seul conteneur ; hors de `route.ts`, qui ne peut exporter
 * que ses méthodes HTTP.
 */
const TTL_MS = 10 * 60 * 1000
const MAX = 10000
const refusees = new Map<string, number>()

export function empreinteRefusee(empreinte: string, maintenant: number = Date.now()): boolean {
  const jusqua = refusees.get(empreinte)
  return jusqua !== undefined && jusqua > maintenant
}

export function noterEmpreinteRefusee(empreinte: string, maintenant: number = Date.now()) {
  if (refusees.size >= MAX) refusees.clear()
  refusees.set(empreinte, maintenant + TTL_MS)
}

/** Tests seulement. */
export function viderEmpreintesRefusees() {
  refusees.clear()
}
