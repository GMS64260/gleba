import { Breadcrumb } from "@/components/breadcrumb"
import { GardeModule } from "@/components/exploitation/GardeModule"

export default function ElevageLayout({ children }: { children: React.ReactNode }) {
  // Module fermé au membre connecté : écran de refus (cf. `GardeModule`).
  return (
    <GardeModule moduleId="elevage">
      <Breadcrumb />
      {children}
    </GardeModule>
  )
}

export const metadata = {
  title: { template: "%s · Élevage · Gleba", default: "Élevage · Gleba" },
}
