/**
 * Stub public. La caisse de marché n'est pas distribuée : sur gleba.fr, ce
 * module retient la déconnexion tant que des ventes hors ligne ne sont pas
 * synchronisées (voir docs/private-stubs.md). Sans elle, rien ne la retient.
 */
export async function avantDeconnexionCaisse(): Promise<boolean> {
  return true
}
