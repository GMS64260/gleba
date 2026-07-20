import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Logiciel de potager — Calendrier de semis, associations et récoltes",
  description: "Planifiez votre potager saison après saison : calendrier de semis adapté à votre climat, plan des planches, associations, rotations, cultures et récoltes réunis dans le logiciel de potager Gleba, gratuit et open source.",
  alternates: { canonical: "https://gleba.fr/logiciel-potager" },
  openGraph: { title: "Logiciel de gestion de potager — Gleba", description: "Calendrier de semis adapté à votre climat, associations, rotations et suivi des récoltes pour organiser votre potager.", url: "https://gleba.fr/logiciel-potager", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Logiciel de potager" currentPath="/logiciel-potager" eyebrow="Semis · Associations · Rotations · Récoltes" title="Le logiciel de potager" highlightedTitle="pour planifier chaque saison" introduction="Gleba aide à organiser un potager du semis à la récolte : quoi semer, quand, sur quelle planche, à côté de quoi et après quelle culture. Le calendrier de semis s'adapte à votre zone climatique, les associations et les rotations préparent la saison, puis les cultures et récoltes conservent ce qui a réellement été fait." proof="le calendrier de semis affiche les périodes par culture ajustées à la zone climatique, les planches se dessinent à l'échelle sur le plan 2D, et les associations, rotations, cultures et récoltes sont reliées aux mêmes espèces et variétés." screenshot={{ src: "/screenshots/gleba-calendrier-semis.png", alt: "Calendrier de semis du potager dans Gleba, avec périodes par culture et jours favorables", caption: "Calendrier de semis du compte de démonstration : périodes de semis, croissance et récolte par culture, ajustées à la zone climatique, avec les jours favorables aux semis." }} capabilities={[
    { title: "Calendrier de semis", description: "Repérez les périodes de semis, de plantation et de récolte de chaque culture, ajustées à la zone climatique de votre potager, pour construire votre planning de saison." },
    { title: "Plan du potager à l'échelle", description: "Dessinez vos planches aux vraies dimensions sur le plan 2D du jardin — au besoin sur une photo aérienne de votre terrain — et visualisez leur implantation." },
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
    { question: "Le logiciel convient-il à un potager amateur ?", answer: "Oui. Les mêmes fonctions servent au potager familial, au jardin pédagogique et à la micro-ferme. Vous n'activez que ce qui vous est utile." },
    { question: "Puis-je suivre mes récoltes ?", answer: "Oui. Chaque récolte est rattachée à sa culture, avec sa date et sa quantité, ce qui permet de relire la saison et de comparer le prévu au réalisé." },
    { question: "Gleba est-il gratuit et open source ?", answer: "Le code est publié sous licence AGPL-3.0 avec une configuration Docker pour l'auto-hébergement, et un compte de démonstration est accessible sans installation." },
  ]} />;
}
