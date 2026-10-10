import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/dashboard",
          "/aujourdhui",
          "/maraichage",
          "/elevage",
          "/verger",
          "/jardin",
          "/comptabilite",
          "/parametres",
          "/onboarding",
          "/taches",
          "/meteo",
          "/tracabilite",
          "/interventions",
          "/parcelles",
          "/raccourcis",
          "/aide",
          // Pages à jeton : jamais à explorer.
          "/feedback",
          "/desabonnement",
          "/impersonation",
        ],
      },
    ],
    sitemap: "https://gleba.fr/sitemap.xml",
  };
}
