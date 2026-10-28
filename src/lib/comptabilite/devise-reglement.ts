import { deviseDuTerritoire } from '@/lib/territoires'

/** La devise d'une facture émise reste celle de son identité figée. */
export function deviseFactureReglement(snapshot: unknown, defaut: string): string {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return defaut
  const emetteur = snapshot as Record<string, unknown>
  if (typeof emetteur.devise === 'string' && /^[A-Z]{3}$/.test(emetteur.devise))
    return emetteur.devise
  return typeof emetteur.territoire === 'string'
    ? deviseDuTerritoire(emetteur.territoire)
    : defaut
}
