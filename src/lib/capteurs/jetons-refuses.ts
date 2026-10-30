/**
 * Empreintes de jetons déjà refusées, gardées 10 min : un webhook resté sur un
 * jeton périmé (régénéré sans être reporté dans TTN) ne coûte plus de lecture
 * en base à chaque envoi. Ne bloque jamais un jeton valide : un jeton créé ou
 * régénéré a une empreinte neuve (192 bits aléatoires), absente d'ici.
 *
 * Empreintes acceptées, gardées 24 h : quand une adresse a atteint son plafond
 * d'échecs, elles lisent encore la base sans attendre, quand les autres se
 * partagent une lecture toutes les 10 s (`route.ts`). Les webhooks TTN
 * partagent leurs adresses entre tous les comptes : un jeton qui fonctionnait
 * continue de passer. Elles n'ouvrent qu'une lecture, jamais l'accès : un jeton
 * régénéré entre-temps est refusé par la base, puis oublié ici.
 *
 * En mémoire, un seul conteneur ; hors de `route.ts`, qui ne peut exporter
 * que ses méthodes HTTP.
 */
const TTL_MS = 10 * 60 * 1000
const TTL_ACCEPTEE_MS = 24 * 3600 * 1000
const MAX = 10000
const refusees = new Map<string, number>()
const acceptees = new Map<string, number>()

export function empreinteRefusee(empreinte: string, maintenant: number = Date.now()): boolean {
  const jusqua = refusees.get(empreinte)
  return jusqua !== undefined && jusqua > maintenant
}

export function noterEmpreinteRefusee(empreinte: string, maintenant: number = Date.now()) {
  if (refusees.size >= MAX) refusees.clear()
  refusees.set(empreinte, maintenant + TTL_MS)
  acceptees.delete(empreinte)
}

export function empreinteAcceptee(empreinte: string, maintenant: number = Date.now()): boolean {
  const jusqua = acceptees.get(empreinte)
  return jusqua !== undefined && jusqua > maintenant
}

export function noterEmpreinteAcceptee(empreinte: string, maintenant: number = Date.now()) {
  if (acceptees.size >= MAX) acceptees.clear()
  acceptees.set(empreinte, maintenant + TTL_ACCEPTEE_MS)
}

/** Tests seulement. */
export function viderEmpreintesRefusees() {
  refusees.clear()
  acceptees.clear()
}
