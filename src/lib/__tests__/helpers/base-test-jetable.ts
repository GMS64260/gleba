/** Autorise uniquement la base jetable explicitement désignée pour les tests. */
export function estBaseTestJetable(url: string | undefined, testUrl: string | undefined): boolean {
  if (!url || url !== testUrl) return false
  try {
    return /^\/gleba_tests(_[a-z0-9_]+)?$/.test(new URL(url).pathname)
  } catch {
    return false
  }
}
