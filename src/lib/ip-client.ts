/**
 * IP fiable du client, derrière Caddy. Module PUR (aucun import, aucun effet
 * de bord) : il est atteignable depuis `auth.ts`, donc depuis le middleware.
 *
 * Sécurité (audit 2026-07 #19) : on prend la DERNIÈRE valeur de
 * `X-Forwarded-For`, pas la première. Caddy (proxy unique en frontal, sans
 * `trusted_proxies`) AJOUTE l'IP réelle du pair en fin de liste ; la première
 * valeur est fournie par le client et donc usurpable. Prendre la première
 * permettait de contourner le rate-limit en variant `X-Forwarded-For` à chaque
 * requête (email bombing sur forgot-password, création de comptes en masse…).
 * On se rabat sur `X-Real-IP` puis "unknown".
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1]
  }
  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp.trim()
  return "unknown"
}
