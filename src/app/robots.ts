import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Les images des vitrines publiques sont servies par une route d'API :
        // sans cette exception (la règle la plus longue l'emporte sur
        // `Disallow: /api/`), les robots de partage et de recherche d'images
        // ne peuvent pas les lire.
        allow: ["/", "/api/boutique/public/*/media/"],
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
