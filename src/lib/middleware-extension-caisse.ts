/** Extension privée pure, compatible Edge. Les routes gardent leur authentification serveur. */
export function estExceptionMiddleware(pathname: string, methode: string): boolean {
  return pathname === "/caisse/manifest.webmanifest"
    || pathname === "/caisse/hors-ligne"
    || (pathname === "/api/caisse/clotures/planifiee" && methode === "POST")
}
