import { Breadcrumb } from "@/components/breadcrumb"
import { GardeModule } from "@/components/exploitation/GardeModule"

/**
 * Layout du module Maraîchage (PROMPT 21).
 * Insère le breadcrumb juste sous le header de chaque page enfant.
 */
export default function MaraichageLayout({ children }: { children: React.ReactNode }) {
  // Module fermé au membre connecté : écran de refus (cf. `GardeModule`).
  return (
    <GardeModule moduleId="maraichage">
      <Breadcrumb />
      {children}
    </GardeModule>
  )
}

export const metadata = {
  title: { template: "%s · Maraîchage · Gleba", default: "Maraîchage · Gleba" },
}
