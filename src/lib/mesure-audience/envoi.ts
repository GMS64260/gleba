import { mesureAudienceRefusee } from "@/lib/consentement-cookies"
import { estPageMesuree } from "./pages"

function configuration() {
  const adresse = process.env.NEXT_PUBLIC_MATOMO_URL
  const site = process.env.NEXT_PUBLIC_MATOMO_SITE_ID
  if (!adresse || !site || !/^[1-9]\d*$/.test(site)) return null
  try {
    const url = new URL(adresse)
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null
    if (!url.pathname.endsWith("/")) url.pathname += "/"
    return { endpoint: new URL("matomo.php", url).href, site }
  } catch {
    return null
  }
}

/**
 * API HTTP Matomo : aucune bibliothèque différée, aucun cookie ou identifiant
 * visiteur. L'anonymisation IP et la rétention se configurent côté Matomo.
 * https://developer.matomo.org/api-reference/tracking-api
 */
export function envoyerPageVue(chemin: string): boolean {
  if (!estPageMesuree(chemin) || mesureAudienceRefusee()) return false
  const navigateur = navigator as Navigator & { globalPrivacyControl?: boolean }
  if (["1", "yes"].includes(navigateur.doNotTrack || "") || navigateur.globalPrivacyControl) return false
  const config = configuration()
  if (!config) return false

  const donnees = new URLSearchParams({
    idsite: config.site,
    rec: "1",
    apiv: "1",
    url: `${window.location.origin}${chemin}`,
    // Un titre dynamique ou un référent interne peut contenir une donnée privée.
    action_name: chemin,
    cookie: "0",
    send_image: "0",
  })
  try {
    const origine = new URL(document.referrer)
    if (origine.origin !== window.location.origin && ["http:", "https:"].includes(origine.protocol)) {
      donnees.set("urlref", origine.origin)
    }
  } catch {
    // L'absence de référent est normale lors d'un accès direct.
  }
  // credentials:omit interdit aussi l'acceptation des Set-Cookie de Matomo.
  void fetch(config.endpoint, {
    method: "POST",
    body: donnees,
    mode: "no-cors",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    keepalive: true,
  }).catch(() => { /* Une panne de mesure ne bloque jamais la navigation. */ })
  return true
}
