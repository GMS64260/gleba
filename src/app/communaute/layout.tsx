import type { Metadata } from "next"
import { ogBase } from "@/lib/seo/og"

// La page est un composant client : ses métadonnées vivent dans ce layout.
export const metadata: Metadata = {
  title: "Feuille de route publique",
  description:
    "Les demandes d'évolution de Gleba proposées et votées par ses utilisateurs : ce qui est prévu, en cours et livré.",
  alternates: { canonical: "https://gleba.fr/communaute" },
  openGraph: {
    ...ogBase,
    title: "Feuille de route publique de Gleba",
    description: "Les demandes d'évolution proposées et votées par les utilisateurs de Gleba.",
    url: "https://gleba.fr/communaute",
    type: "website",
  },
}

export default function CommunauteLayout({ children }: { children: React.ReactNode }) {
  return children
}
