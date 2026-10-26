import type { Metadata } from "next"
import { ogBase } from "@/lib/seo/og"

// La page est un composant client : ses métadonnées vivent dans ce layout.
export const metadata: Metadata = {
  title: "Communauté et encyclopédie collaborative",
  description:
    "Une encyclopédie des cultures enrichie par la communauté, des échanges entre producteurs et le suivi des évolutions de Gleba.",
  alternates: { canonical: "https://gleba.fr/communaute" },
  openGraph: {
    ...ogBase,
    title: "Communauté et encyclopédie de Gleba",
    description: "Partagez les connaissances de culture, contribuez aux fiches et échangez avec la communauté Gleba.",
    url: "https://gleba.fr/communaute",
    type: "website",
  },
}

export default function CommunauteLayout({ children }: { children: React.ReactNode }) {
  return children
}
