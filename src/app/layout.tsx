import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono, Fraunces } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

import { Toaster } from "@/components/ui/toaster";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { GlobalSearch } from "@/components/global-search";
import { OnboardingRedirect } from "@/components/onboarding-redirect";
import { CookieBanner } from "@/components/CookieBanner";
import { GlobalDialogHost } from "@/components/ui/global-dialog-host";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { BandeauExploitation } from "@/components/exploitation/BandeauExploitation";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { PushRegister } from "@/components/notifications/push-register";
import { CoquilleV2 } from "@/components/accueil/CoquilleV2";


const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "500"],
});

// Charte « carnet de ferme » : Geist pour l'interface (fichier local déjà
// dans le dépôt) et Fraunces pour les titres, exposées sous --font-ui et
// --font-display. Depuis L2 (2026-10-09), font-sans et font-heading pointent
// dessus (tailwind.config.ts) ; Inter et Space Grotesk restent chargées
// jusqu'au retrait L5, prouvé par captures.
const geist = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-ui",
  display: "swap",
  weight: "100 900",
});

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: {
    default: "Gleba — Logiciel libre de maraîchage et de micro-ferme",
    template: "%s | Gleba",
  },
  description: "Le carnet d'exploitation libre des micro-fermes professionnelles ou en installation : planification maraîchère, verger, élevage, traçabilité et gestion.",
  keywords: [
    "logiciel maraîchage libre",
    "logiciel maraîchage open source",
    "logiciel micro-ferme",
    "logiciel micro-ferme professionnelle",
    "logiciel ferme diversifiée",
    "carnet d'exploitation agricole",
    "outil installation agricole",
    "logiciel maraîchage",
    "planification maraîchère",
    "logiciel plan de culture",
    "suivi cultures maraîchères",
    "logiciel traçabilité phytosanitaire",
    "logiciel verger",
    "logiciel arboriculture",
    "suivi verger",
    "logiciel élevage ferme diversifiée",
    "logiciel agricole open source",
  ],
  authors: [{ name: "Guillaume Gomes" }],
  creator: "Guillaume Gomes",
  publisher: "Gleba",
  metadataBase: new URL("https://gleba.fr"),
  openGraph: {
    title: "Gleba, le carnet libre des micro-fermes",
    description: "Chaque matin, ce qu'il y a à faire, planche par planche : maraîchage, verger, élevage, météo de la parcelle et plan de la ferme dans un même dossier.",
    url: "https://gleba.fr",
    siteName: "Gleba",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Gleba, le carnet libre des micro-fermes : l'écran Aujourd'hui",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gleba, le carnet libre des micro-fermes",
    description: "Maraîchage, verger, élevage et traçabilité dans un même carnet, hébergé pour vous ou auto-hébergeable.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // Pas de canonical ici : héritée, elle désignait l'accueil comme original
  // de toute page qui n'en déclare pas (/communaute, /glossaire, /licence).
  // Chaque page publique pose la sienne.
  icons: {
    icon: [
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.json",
  category: "agriculture",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // DEV2 #7 — maximumScale retiré (anti-pattern accessibilité : empêche
  // le pinch-zoom mobile, problématique pour les utilisateurs ayant des
  // difficultés visuelles)
};

// JSON-LD Structured Data — multiple schemas pour signaler Software + Organization + WebSite
const jsonLdSoftware = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Gleba",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Farm Management Software",
  operatingSystem: "Web, Linux (Docker)",
  description: "Logiciel libre de gestion pour micro-fermes professionnelles ou en installation : planification maraîchère, verger, élevage, traçabilité et gestion. L'écran Aujourd'hui rassemble chaque matin ce qu'il y a à faire, classé par urgence.",
  url: "https://gleba.fr",
  author: {
    "@type": "Person",
    name: "Guillaume Gomes",
  },
  license: "https://www.gnu.org/licenses/agpl-3.0.html",
  image: "https://gleba.fr/og-image.png",
  screenshot: "https://gleba.fr/screenshots/vitrine-plan-bureau.webp",
  inLanguage: "fr-FR",
  isAccessibleForFree: true,
  // Le code est gratuit ; le service hébergé l'est pendant la bêta seulement
  // (Gleba-produit § Modèle économique) : ne pas promettre davantage ici.
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
    description: "Logiciel libre AGPL-3.0 ; service hébergé sur gleba.fr gratuit pendant la bêta.",
  },
  featureList: [
    "Écran Aujourd'hui : tâches du jour classées par urgence",
    "Planification maraîchère, calendrier de semis et rotation des cultures",
    "Plan 2D et vue 3D de la ferme sur photo aérienne et cadastre",
    "Météo à la parcelle et conseils d'irrigation",
    "Suivi du verger arbre par arbre",
    "Ateliers d'élevage : lots, soins, naissances, productions",
    "Registre phytosanitaire (AMM, dose, DAR, ZNT)",
    "Stocks, boutique de vente directe, factures et TVA",
    "Assistant IA connecté aux données de l'exploitation",
    "Auto-hébergement Docker Compose et export complet des données",
  ],
};

const jsonLdOrganization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Gleba",
  url: "https://gleba.fr",
  logo: "https://gleba.fr/icon-512.png",
  email: "contact@gleba.fr",
  founder: {
    "@type": "Person",
    name: "Guillaume Gomes",
  },
  sameAs: [
    "https://github.com/GMS64260/gleba",
  ],
};

const jsonLdWebSite = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Gleba",
  url: "https://gleba.fr",
  inLanguage: "fr-FR",
  publisher: {
    "@type": "Organization",
    name: "Gleba",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSoftware) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrganization) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebSite) }}
        />
      </head>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${geist.variable} ${fraunces.variable} font-sans antialiased`}
      >
        <SessionProvider>
          <ImpersonationBanner />
          <BandeauExploitation />
          <OnboardingRedirect />
          <CoquilleV2 />
          {children}
          <ChatBubble />
          <GlobalSearch />
          <Toaster />
          <GlobalDialogHost />
          <FeedbackWidget />
          {/* DEV2 #2 — Bandeau cookies RGPD/CNIL */}
          <CookieBanner />
          <PushRegister />
        </SessionProvider>
      </body>
    </html>
  );
}
