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
          "/maraichage",
          "/elevage",
          "/verger",
          "/jardin",
          "/comptabilite",
          "/parametres",
          "/onboarding",
          "/taches",
          "/meteo",
        ],
      },
    ],
    sitemap: "https://gleba.fr/sitemap.xml",
  };
}
