import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Roadmap — Gleba | Feuille de route du logiciel agricole open source",
  description:
    "Découvrez les fonctionnalités en cours de développement et celles prévues pour Gleba, le logiciel libre de gestion de micro-fermes. Bugs, améliorations et nouvelles fonctionnalités.",
  openGraph: {
    title: "Roadmap Gleba — Fonctionnalités prévues et en cours",
    description:
      "Suivez l'évolution de Gleba : nouvelles fonctionnalités, corrections de bugs et améliorations prévues pour le logiciel de gestion agricole open source.",
    url: "https://gleba.fr/roadmap",
    siteName: "GLEBA",
    locale: "fr_FR",
    type: "website",
  },
  alternates: {
    canonical: "https://gleba.fr/roadmap",
  },
}

export default function RoadmapLayout({ children }: { children: React.ReactNode }) {
  return children
}
