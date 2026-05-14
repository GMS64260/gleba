/**
 * Module Maraîchage — home par défaut (PROMPT 21).
 *
 * La page d'accueil du maraîchage redirige vers le dashboard global `/`
 * qui contient le calendrier de la semaine. Le calendrier dédié est
 * accessible via les sous-routes (`/maraichage/cultures`, `/maraichage/recoltes`,
 * `/maraichage/planches`, etc.).
 *
 * Note : à terme, la home pourrait afficher une vue calendrier dédiée
 * sans le dashboard global. C'est une étape de simplification.
 */

import { redirect } from "next/navigation"

export default function MaraichagePage() {
  redirect("/")
}
