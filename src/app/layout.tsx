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
  title: "GLEBA | Logiciel open source gestion micro-ferme & maraîchage",
  description: "ERP open source pour micro-fermes : maraîchage, verger, élevage, ventes. Auto-hebergeable ou heberge pour vous. 135+ espèces.",
  keywords: ["logiciel maraîchage", "gestion micro-ferme", "planification cultures", "ERP agricole", "open source", "verger", "élevage volailles", "maraîchage", "rotation cultures"],
  authors: [{ name: "Guillaume Gomes" }],
  creator: "Guillaume Gomes",
  publisher: "GLEBA",
  metadataBase: new URL("https://gleba.fr"),
  openGraph: {
    title: "GLEBA - Gérez votre micro-ferme efficacement",
    description: "Maraîchage + Verger + Élevage + Ventes en un seul outil open source.",
    url: "https://gleba.fr",
    siteName: "GLEBA",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "GLEBA - Logiciel open source gestion micro-ferme",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GLEBA | Logiciel open source gestion micro-ferme",
    description: "ERP open source : maraîchage, verger, élevage, ventes. Hébergé pour vous ou auto-hebergeable.",
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

// JSON-LD Structured Data
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "GLEBA",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Farm Management Software",
  operatingSystem: "Web, Self-hosted",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
  },
  description: "ERP open source pour micro-fermes diversifiees : maraîchage, verger, élevage, ventes.",
  url: "https://gleba.fr",
  author: {
    "@type": "Person",
    name: "Guillaume Gomes",
  },
  license: "https://www.gnu.org/licenses/agpl-3.0.html",
  screenshot: "https://gleba.fr/screenshot.png",
  softwareVersion: "1.0.0",
  featureList: [
    "Planification maraîchère",
    "Gestion de verger",
    "Suivi d'élevage",
    "Gestion des ventes",
    "Plan 2D interactif",
    "135+ espèces pre-configurees",
  ],
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
