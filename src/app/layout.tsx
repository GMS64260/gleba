import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { ChatBubble } from "@/components/chat/ChatBubble";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "GLEBA | Logiciel gratuit gestion micro-ferme & maraichage",
  description: "ERP 100% gratuit pour micro-fermes : maraichage, verger, elevage, ventes. Open source, auto-hebergeable. 135+ especes. Essayez sans inscription.",
  keywords: ["logiciel maraichage gratuit", "gestion micro-ferme", "planification cultures", "ERP agricole", "open source", "verger", "elevage volailles", "potager", "rotation cultures"],
  authors: [{ name: "Guillaume Gomes" }],
  creator: "Guillaume Gomes",
  publisher: "GLEBA",
  metadataBase: new URL("https://gleba.fr"),
  openGraph: {
    title: "GLEBA - Gerez votre micro-ferme gratuitement",
    description: "Maraichage + Verger + Elevage + Ventes en un seul outil open source. 100% gratuit.",
    url: "https://gleba.fr",
    siteName: "GLEBA",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "GLEBA - Logiciel gratuit gestion micro-ferme",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GLEBA | Logiciel gratuit gestion micro-ferme",
    description: "ERP 100% gratuit : maraichage, verger, elevage, ventes. Open source.",
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
  description: "ERP gratuit et open source pour micro-fermes diversifiees : maraichage, verger, elevage, ventes.",
  url: "https://gleba.fr",
  author: {
    "@type": "Person",
    name: "Guillaume Gomes",
  },
  license: "https://www.gnu.org/licenses/agpl-3.0.html",
  screenshot: "https://gleba.fr/screenshot.png",
  softwareVersion: "1.0.0",
  featureList: [
    "Planification maraichere",
    "Gestion de verger",
    "Suivi d'elevage",
    "Gestion des ventes",
    "Plan 2D interactif",
    "135+ especes pre-configurees",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          {children}
          <Toaster />
          <ChatBubble />
        </SessionProvider>
      </body>
    </html>
  );
}
