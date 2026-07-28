import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Logiciel de potager avec plan 2D et vue 3D — Gleba",
  description: "Dessinez votre potager à l'échelle, visualisez-le en 3D et planifiez semis, associations, rotations, cultures et récoltes avec Gleba.",
  alternates: { canonical: "https://gleba.fr/logiciel-potager" },
  openGraph: { title: "Plan de potager 2D et 3D, semis et récoltes — Gleba", description: "Dessinez les planches de votre potager à l'échelle, explorez la vue 3D et organisez semis, rotations et récoltes.", url: "https://gleba.fr/logiciel-potager", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Logiciel de potager" currentPath="/logiciel-potager" eyebrow="Plan 2D · Vue 3D · Semis · Récoltes" title="Le logiciel de potager" highlightedTitle="avec plan 2D et vue 3D" introduction="Gleba aide à dessiner et organiser un potager du semis à la récolte : planches à l'échelle, implantation des cultures, calendrier adapté au climat, associations et rotations. La vue 3D transforme le plan en jardin navigable et permet d'observer la croissance à une date choisie." proof="les planches et objets se dessinent à l'échelle dans l'éditeur 2D, une photo du terrain peut servir de fond, et la vue 3D restitue cultures, arbres, étiquettes et croissance dans le temps à partir des mêmes données." screenshot={{ src: "/screenshots/gleba-calendrier-semis.png", alt: "Calendrier de semis du potager dans Gleba, avec périodes par culture et jours favorables", caption: "Calendrier de semis du compte de démonstration : périodes de semis, croissance et récolte par culture, ajustées à la zone climatique, avec les jours favorables aux semis." }} capabilities={[
    { title: "Calendrier de semis", description: "Repérez les périodes de semis, de plantation et de récolte de chaque culture, ajustées à la zone climatique de votre potager, pour construire votre planning de saison." },
    { title: "Plan du potager à l'échelle", description: "Dessinez vos planches aux vraies dimensions sur le plan 2D du jardin — au besoin sur une photo aérienne de votre terrain — et visualisez leur implantation." },
    { title: "Vue 3D du jardin", description: "Explorez en trois dimensions les planches, cultures, arbres et objets issus du plan 2D, avec un sol procédural lorsque vous n'utilisez pas de photo." },
    { title: "Croissance dans le temps", description: "Déplacez la date affichée pour faire évoluer la taille et le stade visuel des cultures et des arbres enregistrés." },
    { title: "Associations de cultures", description: "Consultez le référentiel des associations favorables, neutres ou incompatibles avant de composer une planche de légumes." },
    { title: "Rotations et précédents", description: "Préparez les séquences de cultures d'une année sur l'autre et relisez les précédents culturaux planche par planche." },
    { title: "Jours favorables aux semis", description: "Affichez, si vous le souhaitez, les jours feuille, racine, fleur et fruit du calendrier biodynamique en complément des périodes de semis." },
    { title: "Cultures et variétés", description: "Suivez espèce, variété, dates, état, quantités attendues et notes pour chaque légume cultivé, du semis à la fin de culture." },
    { title: "Récoltes et semences", description: "Rattachez les récoltes à leur culture, suivez les quantités récoltées et gardez trace de vos réserves de semences." },
  ]} workflowTitle="Un potager organisé du semis à la récolte" workflow={[
    { title: "Planifier", description: "Choisissez vos légumes et calez semis et plantations grâce au calendrier de semis adapté à votre climat et aux rotations." },
    { title: "Semer et planter", description: "Affectez les cultures aux planches en tenant compte des associations, puis notez les semis et plantations réalisés." },
    { title: "Récolter", description: "Consignez récoltes et interventions pour comparer le prévu au réalisé et préparer l'année suivante." },
  ]} limits="Gleba organise les données de votre potager mais ne décide pas du plan à votre place et ne garantit ni rendement, ni date, ni réussite d'une culture. Le calendrier, les associations et les rotations sont des références à adapter à votre climat, votre sol et votre expérience." faqs={[
    { question: "Gleba aide-t-il à savoir quoi semer et quand ?", answer: "Oui. Le calendrier de semis indique les périodes de semis, de plantation et de récolte de chaque culture, ajustées à la zone climatique configurée, ce qui aide à construire le planning de la saison." },
    { question: "Le calendrier tient-il compte de ma région ?", answer: "Il s'adapte à la zone climatique détectée ou configurée pour votre potager : décalage des dates de référence en métropole, et itinéraires dédiés aux saisons locales en outre-mer. Il reste à ajuster à votre microclimat et à votre sol." },
    { question: "Puis-je gérer les associations et les rotations de mon potager ?", answer: "Oui. Un référentiel recense les associations favorables, neutres ou incompatibles, et les rotations permettent de suivre les précédents culturaux par planche. Ce sont des informations consultables, pas un placement automatique." },
    { question: "Puis-je dessiner le plan de mon potager ?", answer: "Oui. Le plan 2D du jardin permet de tracer vos planches aux vraies dimensions, au besoin sur une photo aérienne de votre terrain, puis d'y affecter les cultures." },
    { question: "Existe-t-il une vue 3D du potager ?", answer: "Oui. La vue 3D reprend les planches, cultures, arbres, objets et le fond du plan 2D. Une barre de temps permet de visualiser la croissance à la date choisie. Les espèces sans modèle fidèle utilisent une représentation végétale procédurale plutôt qu'un faux modèle." },
    { question: "Le logiciel convient-il à un potager amateur ?", answer: "Oui. Les mêmes fonctions servent au potager familial, au jardin pédagogique et à la micro-ferme. Vous n'activez que ce qui vous est utile." },
    { question: "Puis-je suivre mes récoltes ?", answer: "Oui. Chaque récolte est rattachée à sa culture, avec sa date et sa quantité, ce qui permet de relire la saison et de comparer le prévu au réalisé." },
    { question: "Gleba est-il gratuit et open source ?", answer: "Le code est publié sous licence AGPL-3.0 avec une configuration Docker pour l'auto-hébergement, et un compte de démonstration est accessible sans installation." },
  ]} />;
}
