import { Breadcrumb } from "@/components/breadcrumb"
import { GardeModule } from "@/components/exploitation/GardeModule"

export default function ComptabiliteLayout({ children }: { children: React.ReactNode }) {
  // Module fermé au membre connecté : écran de refus (cf. `GardeModule`).
  return (
    <GardeModule moduleId="comptabilite">
      <Breadcrumb />
      {children}
    </GardeModule>
  )
}

export const metadata = {
  title: { template: "%s · Comptabilité · Gleba", default: "Comptabilité · Gleba" },
}
