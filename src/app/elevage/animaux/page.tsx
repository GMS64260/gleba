import { redirect } from "next/navigation"

/** L’ancien carnet rejoint le formulaire et les actions du module Élevage. */
export default function AnimauxPage() {
  redirect("/elevage?tab=animaux")
}
