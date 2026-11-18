import { GardeModule } from "@/components/exploitation/GardeModule"

export default function TachesLayout({ children }: { children: React.ReactNode }) {
  // Tâches du jour = semis, plantations, récoltes et arrosages des cultures
  // (`/api/taches` relève du maraîchage) : écran de refus si le module est
  // fermé au membre connecté (cf. `GardeModule`).
  return <GardeModule moduleId="maraichage">{children}</GardeModule>
}
