import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { Toaster } from "@/components/ui/toaster";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { GlobalSearch } from "@/components/global-search";
import { OnboardingRedirect } from "@/components/onboarding-redirect";
import { CookieBanner } from "@/components/CookieBanner";


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

export const metadata: Metadata = {
  title: {
    default: "Gleba — Logiciel libre de gestion pour micro-ferme, maraîchage et élevage",
    template: "%s | Gleba",
  },
  description: "Gleba est le logiciel libre tout-en-un pour gérer votre micro-ferme : planification maraîchage, verger, élevage, traçabilité phytosanitaire, comptabilité et IA. Open source, hébergé pour vous ou auto-hébergeable.",
  keywords: [
    "logiciel maraîchage",
    "logiciel micro-ferme",
    "logiciel permaculture",
    "logiciel planification cultures",
    "logiciel gestion ferme bio",
    "logiciel traçabilité phytosanitaire",
    "logiciel verger",
    "logiciel élevage volailles",
    "calendrier semis",
    "rotation cultures",
    "ERP agricole open source",
    "alternative Brinjel",
    "alternative Qrop",
    "alternative Tolma",
  ],
  authors: [{ name: "Guillaume Gomes" }],
  creator: "Guillaume Gomes",
  publisher: "Gleba",
  metadataBase: new URL("https://gleba.fr"),
  openGraph: {
    title: "Gleba — Logiciel libre pour micro-fermes, maraîchage et élevage",
    description: "Planification, verger, élevage, comptabilité, traçabilité et IA — un seul logiciel open source pour gérer votre exploitation.",
    url: "https://gleba.fr",
    siteName: "Gleba",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Gleba — Logiciel libre de gestion pour micro-ferme",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gleba — Logiciel libre pour micro-fermes",
    description: "Planification maraîchage, verger, élevage, comptabilité, traçabilité et IA. Open source, hébergé pour vous ou auto-hébergeable.",
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
  alternates: {
    canonical: "https://gleba.fr",
  },
  icons: {
    icon: "/favicon.ico",
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
  operatingSystem: "Web, Self-hosted (Docker)",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
  },
  description: "Logiciel libre tout-en-un pour gérer une micro-ferme diversifiée : maraîchage, verger, élevage, comptabilité, traçabilité et IA.",
  url: "https://gleba.fr",
  author: {
    "@type": "Person",
    name: "Guillaume Gomes",
  },
  license: "https://www.gnu.org/licenses/agpl-3.0.html",
  image: "https://gleba.fr/og-image.png",
  screenshot: "https://gleba.fr/og-image.png",
  softwareVersion: "1.0.0",
  inLanguage: "fr-FR",
  featureList: [
    "Planification maraîchère et rotation des cultures",
    "Calendrier de semis et calendrier lunaire",
    "Gestion de verger (25 espèces, 40 variétés)",
    "Suivi d'élevage (volailles, ruches, ovins)",
    "Comptabilité et facturation",
    "Traçabilité phytosanitaire (AMM, DAR)",
    "Plan 2D interactif du jardin",
    "Météo et pilotage de l'irrigation",
    "Assistant IA en langage naturel",
    "135 espèces végétales pré-configurées",
  ],
  aggregateRating: undefined,
};

const jsonLdOrganization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Gleba",
  url: "https://gleba.fr",
  logo: "https://gleba.fr/gleba-logo.png",
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
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <SessionProvider>
          <OnboardingRedirect />
          {children}
          <GlobalSearch />
          <Toaster />
          <FeedbackWidget />
          {/* DEV2 #2 — Bandeau cookies RGPD/CNIL */}
          <CookieBanner />
        </SessionProvider>
      </body>
    </html>
  );
}
