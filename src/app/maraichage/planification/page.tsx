import { redirect } from "next/navigation"

/**
 * Redirection vers l'onglet Planification de la page d'accueil.
 * L'ancienne page standalone /planification est remplacee par l'onglet
 * dans la page principale.
 */
export default function PlanificationPage() {
  redirect("/?tab=planification")
}
