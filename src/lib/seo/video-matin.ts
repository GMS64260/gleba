const page = "/videos/un-matin-a-la-ferme";
const baseUrl = "https://gleba.fr";
const youtubeId = "3VFIKsS3Ins";

export const filmMatin = {
  titre: "Un matin à la ferme avec Gleba",
  description: "Sur la ferme de démonstration, l’agent IA conseille sur le semis des fèves. Suivez ensuite les 8 kg de carottes de la planche B10 jusqu’au stock et à la boutique en ligne.",
  page,
  canonical: baseUrl + page,
  affiche: page + ".webp",
  imageUrl: baseUrl + page + ".webp",
  fichier: page + ".mp4",
  contentUrl: baseUrl + page + ".mp4",
  sousTitres: page + ".fr.vtt",
  youtube: `https://www.youtube.com/watch?v=${youtubeId}`,
  lecteurYouTube: `https://www.youtube-nocookie.com/embed/${youtubeId}`,
  publication: "2026-11-21T12:51:30-08:00",
  secondes: 58,
};

export const jsonLdFilmMatin = {
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "@id": filmMatin.canonical + "#video",
  name: filmMatin.titre,
  description: filmMatin.description,
  thumbnailUrl: filmMatin.imageUrl,
  uploadDate: filmMatin.publication,
  duration: `PT${filmMatin.secondes}S`,
  inLanguage: "fr",
  contentUrl: filmMatin.contentUrl,
  embedUrl: filmMatin.lecteurYouTube,
  sameAs: filmMatin.youtube,
  mainEntityOfPage: filmMatin.canonical,
};
