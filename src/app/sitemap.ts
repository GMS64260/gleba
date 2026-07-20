import { MetadataRoute } from "next";
import prisma from "@/lib/prisma";

// Le sitemap dépend de la base (boutiques publiques) : on le génère au runtime
// et non au build (où la DB est inaccessible), avec un cache d'une heure.
export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://gleba.fr";
  // Dates éditoriales réelles : ne pas annoncer artificiellement une mise à
  // jour à chaque génération du sitemap.
  const marketingUpdatedAt = new Date("2026-07-17");

  // Pages principales
  const corePages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: marketingUpdatedAt,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    // /login retiré du sitemap : formulaire pur, noindex. La home "/" est désormais la landing publique.
    {
      url: `${baseUrl}/communaute`,
      lastModified: marketingUpdatedAt,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/referentiel`,
      lastModified: marketingUpdatedAt,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];

  // Pages cibles SEO (longue traîne — priorité élevée)
  const seoTargetPages: MetadataRoute.Sitemap = [
    "/logiciel-maraichage",
    "/planification-maraichage",
    "/rotation-cultures-maraichage",
    "/itineraire-technique-maraichage",
    "/logiciel-micro-ferme",
    "/logiciel-permaculture",
    "/logiciel-jardin",
    "/logiciel-potager",
    "/logiciel-verger",
    "/logiciel-arboriculture",
    "/logiciel-elevage",
    "/logiciel-elevage-volailles",
    "/logiciel-elevage-ovin",
    "/logiciel-elevage-caprin",
    "/registre-phytosanitaire",
    "/calendrier-semis",
    "/assistant-ia-agricole",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: marketingUpdatedAt,
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
    lastModified: marketingUpdatedAt,
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

  // Fiches publiques du référentiel : uniquement catalogue officiel et
  // contributions explicitement partagées, jamais les entrées personnelles.
  let referentielPages: MetadataRoute.Sitemap = [];
  try {
    const especes = await prisma.espece.findMany({
      where: {
        OR: [
          { userId: null },
          { userId: { not: null }, partageCommunaute: true },
        ],
      },
      select: { id: true },
    });
    referentielPages = especes.map((espece) => ({
      url: `${baseUrl}/referentiel/vegetaux/${encodeURIComponent(espece.id)}`,
      lastModified: marketingUpdatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  } catch {
    referentielPages = [];
  }

  return [...corePages, ...seoTargetPages, ...legalPages, ...referentielPages, ...boutiquePages];
}
