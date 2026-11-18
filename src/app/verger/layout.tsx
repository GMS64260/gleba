import { Breadcrumb } from "@/components/breadcrumb"
import { GardeModule } from "@/components/exploitation/GardeModule"

export default function VergerLayout({ children }: { children: React.ReactNode }) {
  // Module fermé au membre connecté : écran de refus (cf. `GardeModule`).
  return (
    <GardeModule moduleId="verger">
      <Breadcrumb />
      {children}
    </GardeModule>
  )
}

export const metadata = {
  title: { template: "%s · Verger · Gleba", default: "Verger · Gleba" },
}
