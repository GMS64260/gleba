import { Breadcrumb } from "@/components/breadcrumb"

export default function ComptabiliteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Breadcrumb />
      {children}
    </>
  )
}

export const metadata = {
  title: { template: "%s · Comptabilité · Gleba", default: "Comptabilité · Gleba" },
}
