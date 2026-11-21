import { signOut } from 'next-auth/react'
import { purgerCacheTournee } from '@/lib/elevage/offline-tournee'

/**
 * Déconnexion depuis le navigateur : efface d'abord les données hors connexion
 * du compte (cache et file de la tournée), que le compte suivant de ce
 * navigateur ne doit ni lire ni rejouer (revue Codex SEC-02, 2026-11-12).
 */
export async function seDeconnecter(options?: Parameters<typeof signOut>[0]) {
  await purgerCacheTournee()
  return signOut(options)
}
