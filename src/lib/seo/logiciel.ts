import { FORMULES } from "@/lib/abonnement/catalogue"

export const jsonLdSoftware = {
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
  isAccessibleForFree: false,
  offers: (["essentiel", "complet"] as const).map(id => ({
    "@type": "Offer",
    name: `Gleba ${FORMULES[id].nom}`,
    price: FORMULES[id].prix,
    priceCurrency: "EUR",
    url: "https://gleba.fr/tarifs",
    description: id === "essentiel"
      ? "5 € HT par mois et par exploitation pour un atelier ; sans IA, météo, boutique ni comptabilité. Trois mois d’essai gratuits."
      : "12 € HT par mois et par exploitation ; tous les ateliers, IA, météo, boutique et précomptabilité. Trois mois d’essai gratuits.",
    priceSpecification: { "@type": "UnitPriceSpecification", price: FORMULES[id].prix, priceCurrency: "EUR", billingDuration: "P1M", valueAddedTaxIncluded: false },
  })),
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
