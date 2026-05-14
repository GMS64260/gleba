import { Breadcrumb } from "@/components/breadcrumb"

/**
 * Layout du module Maraîchage (PROMPT 21).
 * Insère le breadcrumb juste sous le header de chaque page enfant.
 */
export default function MaraichageLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Breadcrumb />
      {children}
    </>
  )
}

export const metadata = {
  title: { template: "%s · Maraîchage · Gleba", default: "Maraîchage · Gleba" },
}
