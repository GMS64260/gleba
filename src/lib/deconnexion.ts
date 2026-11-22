import { signOut } from 'next-auth/react'
import { envoyerFileAvantDeconnexion, purgerCacheTournee } from '@/lib/elevage/offline-tournee'
import { alertDialog, confirmDialog } from '@/lib/global-dialog'

/**
 * Déconnexion depuis le navigateur : efface d'abord les données hors connexion
 * du compte (cache et file de la tournée), que le compte suivant de ce
 * navigateur ne doit ni lire ni rejouer (revue Codex SEC-02, 2026-11-12).
 */
export async function seDeconnecter(options?: Parameters<typeof signOut>[0]) {
  await purgerCacheTournee()
  return signOut(options)
}

/**
 * À appeler avant une déconnexion demandée depuis le menu : la purge ci-dessus
 * efface aussi les tâches de tournée validées hors réseau et pas encore envoyées.
 * Elles sont d'abord envoyées. S'il en reste, sans réseau la déconnexion est
 * retenue (elle ne pourrait pas aboutir non plus) ; sinon la personne choisit.
 * Faux : rester connecté.
 */
export async function avantDeconnexionTournee(): Promise<boolean> {
  const { restantes, cause } = await envoyerFileAvantDeconnexion()
  if (restantes === 0) return true
  const une = restantes === 1
  const quoi = une ? 'Une tâche de tournée cochée sans réseau n’a pas encore été envoyée' : `${restantes} tâches de tournée cochées sans réseau n’ont pas encore été envoyées`
  if (cause === 'reseau') {
    await alertDialog(
      `${quoi}, et le réseau ne répond pas : la déconnexion n’est pas possible pour l’instant. ${une ? 'Elle reste' : 'Elles restent'} sur cet appareil. Quand le réseau sera revenu, rouvrez la tournée pour ${une ? 'l’envoyer' : 'les envoyer'}, puis déconnectez-vous.`,
      { title: 'Tâches de tournée non envoyées' },
    )
    return false
  }
  return confirmDialog(
    `${quoi} : Gleba ne ${une ? 'l’a pas acceptée' : 'les a pas acceptées'}. Si vous vous déconnectez maintenant, ${une ? 'elle sera effacée' : 'elles seront effacées'} de cet appareil. Vérifiez dans la tournée ce qui reste à faire avant de partir.`,
    { title: 'Tâches de tournée non envoyées', confirmLabel: 'Se déconnecter quand même', cancelLabel: 'Rester connecté' },
  )
}
