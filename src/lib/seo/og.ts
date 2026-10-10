/**
 * Champs Open Graph communs à toutes les pages publiques.
 *
 * Next.js remplace l'objet `openGraph` d'un layout par celui de la page au
 * lieu de les fusionner : une page qui déclare son titre perdait l'image, le
 * nom du site et la locale (constat sur gleba.fr le 2026-10-10). Chaque page
 * publique étale donc `ogBase` avant ses propres champs.
 */
export const OG_IMAGE = {
  url: "https://gleba.fr/og-image.png",
  width: 1200,
  height: 630,
  alt: "Gleba, le carnet libre des micro-fermes : l'écran Aujourd'hui",
} as const;

export const ogBase = {
  siteName: "Gleba",
  locale: "fr_FR",
  images: [OG_IMAGE],
};
