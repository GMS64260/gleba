import { Breadcrumb } from "@/components/breadcrumb"

export default function VergerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Breadcrumb />
      {children}
    </>
  )
}

export const metadata = {
  title: { template: "%s · Verger · Gleba", default: "Verger · Gleba" },
}
