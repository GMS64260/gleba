/**
 * Module Maraîchage : la page rend le module (onglets Calendrier, Cultures,
 * Terrain…) sous le rail, et l'URL reste `/maraichage` avec ses paramètres
 * (`?tab=cultures` ouvre le bon onglet). Sans session, le middleware et le
 * layout du module ont déjà renvoyé vers la connexion.
 */

import { MaraichageHome } from "@/components/maraichage/MaraichageHome"

// Le module lit les paramètres d'URL (onglet) : jamais de rendu statique.
export const dynamic = "force-dynamic"

export default function MaraichagePage() {
  return <MaraichageHome />
}
