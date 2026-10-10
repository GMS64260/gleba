import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";
import { ogBase } from "@/lib/seo/og";

export const metadata: Metadata = {
  title: "Plan de ferme sur le cadastre et la photo aérienne",
  description: "Retrouvez vos parcelles cadastrales par commune, section et numéro, dessinez planches et arbres aux vraies dimensions sur la photo aérienne, puis suivez la ferme en 2D et en 3D.",
  alternates: { canonical: "https://gleba.fr/plan-de-ferme" },
  openGraph: {
    ...ogBase,
    title: "Plan de micro-ferme sur le cadastre — Gleba",
    description: "Parcelles cadastrales, photo aérienne, planches et arbres à l'échelle, vue 3D : le plan de la ferme dans le même outil que son suivi.",
    url: "https://gleba.fr/plan-de-ferme",
    type: "article",
  },
};

export default function Page() {
  return (
    <BusinessLanding
      breadcrumb="Plan de ferme"
      currentPath="/plan-de-ferme"
      eyebrow="Cadastre · Photo aérienne · Plan 2D et 3D"
      title="Le plan de la ferme,"
      highlightedTitle="du cadastre à la planche"
      introduction="Une micro-ferme se pense dans l'espace : parcelles, planches, rangs d'arbres, serres, points d'eau. Gleba part des parcelles cadastrales et de la photo aérienne, puis descend jusqu'à la planche dessinée aux vraies dimensions. Le même plan sert ensuite chaque jour : l'écran Aujourd'hui y peint ce qui est à arroser ou à récolter."
      proof="la carte de l'exploitation affiche le parcellaire cadastral et les photographies aériennes de l'IGN (Géoplateforme), retrouve une parcelle par commune, section et numéro (API Carto de l'IGN) et l'ajoute à la carte ; le plan 2D, la vue 3D et l'écran Aujourd'hui réutilisent les mêmes planches et les mêmes arbres."
      screenshot={{ src: "/screenshots/vitrine-plan-bureau.webp", alt: "Plan 2D de la ferme de démonstration dans Gleba : planches et arbres fruitiers dessinés sur la photo aérienne", caption: "Planches et arbres de la ferme de démonstration, dessinés à l'échelle sur la photo aérienne.", width: 1844, height: 1108 }}
      capabilities={[
        { title: "Parcelles cadastrales", description: "Recherche d'une parcelle par commune, section et numéro, puis ajout à la carte de l'exploitation, sur la couche du parcellaire cadastral." },
        { title: "Photo aérienne et plan IGN", description: "Les fonds de carte de la Géoplateforme de l'IGN : photographies aériennes et plan, pour situer chaque parcelle." },
        { title: "Planches et arbres à l'échelle", description: "Planches, objets et arbres se dessinent aux vraies dimensions dans le plan 2D, sur la photo aérienne ou sur une photo de votre terrain." },
        { title: "Vue 3D et croissance", description: "La vue 3D reprend le plan ; une barre de temps fait évoluer la taille des cultures et des arbres à la date choisie." },
        { title: "Sol et pluie par planche", description: "Données de sol issues de SoilGrids (ISRIC) pour la parcelle, et pluviométrie consultable planche par planche depuis le plan." },
        { title: "L'état du jour sur le plan", description: "Sur l'écran Aujourd'hui, la tuile Plan montre les planches à arroser ou à récolter ; la tuile Carte, les parcelles de l'exploitation." },
      ]}
      workflowTitle="De la parcelle à la planche, sans logiciel de cartographie"
      workflow={[
        { title: "Retrouver ses parcelles", description: "Saisissez la commune, la section et le numéro : la parcelle cadastrale s'ajoute à la carte, ou dessinez son contour vous-même." },
        { title: "Dessiner la ferme", description: "Posez planches, serres, points d'eau et arbres aux vraies dimensions sur la photo aérienne." },
        { title: "Suivre chaque jour", description: "Cultures, arrosages et récoltes s'affichent sur le plan ; la vue 3D montre la ferme à n'importe quelle date." },
      ]}
      limits="Le cadastre et les fonds de carte de l'IGN couvrent le territoire français ; ailleurs, le plan se dessine sur une photo de votre terrain. Le plan cadastral a une valeur indicative et ne remplace pas un bornage."
      faqs={[
        { question: "Comment retrouver mes parcelles cadastrales ?", answer: "Depuis la carte de l'exploitation, recherchez la parcelle par commune, section et numéro, tels qu'ils figurent sur votre relevé de propriété ou votre bail. La parcelle trouvée s'ajoute à la carte." },
        { question: "Le plan est-il à l'échelle ?", answer: "Oui. Planches, objets et arbres se dessinent avec leurs dimensions réelles, sur le fond aérien. Les surfaces cultivées et les besoins en plants en découlent." },
        { question: "Faut-il savoir utiliser un logiciel de cartographie ?", answer: "Non. La recherche cadastrale se fait par commune, section et numéro, et le dessin se fait à la souris dans le plan de la ferme." },
        { question: "Gleba fonctionne-t-il hors de France ?", answer: "L'application fonctionne partout, mais le cadastre et les photographies aériennes intégrés viennent de l'IGN et couvrent la France. Ailleurs, utilisez une photo de votre terrain comme fond du plan." },
        { question: "Puis-je voir la ferme en 3D ?", answer: "Oui. La vue 3D reprend le plan 2D et permet de visualiser la croissance des cultures et des arbres à une date donnée. Les espèces sans modèle fidèle utilisent une représentation végétale simplifiée." },
      ]}
    />
  );
}
