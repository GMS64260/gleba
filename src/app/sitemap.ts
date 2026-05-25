import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://gleba.fr";
  const now = new Date();

  // Pages principales
  const corePages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    // /login retiré du sitemap : formulaire pur, noindex. La home "/" est désormais la landing publique.
    {
      url: `${baseUrl}/register`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/roadmap`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];

  // Pages cibles SEO (longue traîne — priorité élevée)
  const seoTargetPages: MetadataRoute.Sitemap = [
    "/logiciel-maraichage",
    "/logiciel-micro-ferme",
    "/logiciel-permaculture",
    "/logiciel-verger",
    "/logiciel-elevage",
    "/calendrier-semis",
    "/assistant-ia-agricole",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.9,
  }));

  // Pages légales
  const legalPages: MetadataRoute.Sitemap = [
    "/cgv",
    "/mentions-legales",
    "/confidentialite",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: "yearly" as const,
    priority: 0.3,
  }));

  return [...corePages, ...seoTargetPages, ...legalPages];
}
