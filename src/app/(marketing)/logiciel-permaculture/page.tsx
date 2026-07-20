import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Logiciel pour ferme en permaculture — Plan 2D, cultures et verger",
  description: "Cartographiez planches, arbres et objets, puis suivez cultures, associations, rotations, verger, élevage, récoltes et interventions avec Gleba.",
  alternates: { canonical: "https://gleba.fr/logiciel-permaculture" },
  openGraph: { title: "Gleba pour une ferme en permaculture", description: "Plan 2D et suivi des productions diversifiées dans un logiciel open source.", url: "https://gleba.fr/logiciel-permaculture", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Logiciel pour ferme en permaculture" currentPath="/logiciel-permaculture" eyebrow="Plan 2D · Cultures · Verger · Élevage" title="Un logiciel pour documenter" highlightedTitle="une ferme diversifiée" introduction="Les fermes inspirées de la permaculture combinent souvent planches, arbres, haies, animaux et petits aménagements. Gleba permet de représenter ces éléments puis de suivre les productions et interventions associées." proof="le plan 2D manipule parcelles, planches, arbres et objets ; les modules Maraîchage, Verger et Élevage partagent ensuite les données de la même exploitation." capabilities={[
    { title: "Plan 2D", description: "Dessinez les planches et positionnez arbres et objets aux dimensions et coordonnées choisies." },
    { title: "Associations", description: "Consultez le référentiel d'associations favorables, incompatibles ou neutres entre espèces." },
    { title: "Rotations", description: "Préparez et relisez les séquences de cultures prévues sur chaque planche." },
    { title: "Verger", description: "Suivez arbres, variétés, porte-greffes, pollinisation, opérations, observations et récoltes." },
    { title: "Élevage", description: "Gérez animaux ou lots, soins, alimentation, production, reproduction et naissances." },
    { title: "Interventions", description: "Conservez un historique commun des travaux réalisés sur cultures, parcelles et arbres." },
  ]} workflowTitle="Dessiner puis documenter le système" workflow={[
    { title: "Représenter", description: "Créez les parcelles et placez les éléments suivis sur le plan de l'exploitation." },
    { title: "Organiser", description: "Préparez cultures, rotations, arbres et ateliers animaux dans leurs modules dédiés." },
    { title: "Observer", description: "Enregistrez interventions, observations, productions et récoltes au fil des saisons." },
  ]} limits="Gleba n'est pas un logiciel de conception permacole automatique : il ne calcule ni zones, ni secteurs, ni courbes de niveau, ni design optimal. Il ne place pas automatiquement des guildes de plantes. Ces décisions restent celles du concepteur." faqs={[
    { question: "Gleba réalise-t-il automatiquement un design en permaculture ?", answer: "Non. Le plan 2D sert à dessiner et documenter les éléments décidés par l'utilisateur ; aucun moteur ne conçoit automatiquement le site." },
    { question: "Les associations de cultures sont-elles disponibles ?", answer: "Oui. Un référentiel recense des relations favorables, incompatibles ou neutres. Il s'agit d'une information consultable, pas d'un placement automatique." },
    { question: "Peut-on suivre arbres, légumes et animaux ensemble ?", answer: "Oui. Les trois modules existent dans la même application et utilisent les parcelles de l'exploitation." },
    { question: "Gleba remplace-t-il un SIG ?", answer: "Non. Le plan 2D est conçu pour le suivi de la ferme ; un SIG spécialisé reste plus adapté aux analyses topographiques ou hydrologiques avancées." },
  ]} />;
}
