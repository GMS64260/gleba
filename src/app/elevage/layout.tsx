import { Breadcrumb } from "@/components/breadcrumb"

export default function ElevageLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Breadcrumb />
      {children}
    </>
  )
}

export const metadata = {
  title: { template: "%s · Élevage · Gleba", default: "Élevage · Gleba" },
}
