import { MetadataRoute } from "next";
import prisma from "@/lib/prisma";

// Le sitemap dépend de la base (boutiques publiques) : on le génère au runtime
// et non au build (où la DB est inaccessible), avec un cache d'une heure.
export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
      url: `${baseUrl}/communaute`,
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

  // Boutiques publiques actives + leurs produits (vitrines indexables).
  let boutiquePages: MetadataRoute.Sitemap = [];
  try {
    const boutiques = await prisma.boutique.findMany({
      where: { active: true },
      select: {
        slug: true,
        updatedAt: true,
        produits: {
          where: { actif: true },
          select: { id: true, updatedAt: true },
        },
      },
    });

    boutiquePages = boutiques.flatMap((b) => [
      {
        url: `${baseUrl}/boutique/${b.slug}`,
        lastModified: b.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.7,
      },
      ...b.produits.map((p) => ({
        url: `${baseUrl}/boutique/${b.slug}/produit/${p.id}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      })),
    ]);
  } catch {
    // Base indisponible au build : on sert le sitemap statique sans bloquer.
    boutiquePages = [];
  }

  return [...corePages, ...seoTargetPages, ...legalPages, ...boutiquePages];
}
