import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Logiciel de gestion d'élevage — Animaux, lots, soins et reproduction",
  description: "Gérez animaux et lots, généalogie, soins, alimentation, productions, reproduction, naissances et mouvements avec le logiciel d'élevage open source Gleba.",
  alternates: { canonical: "https://gleba.fr/logiciel-elevage" },
  openGraph: { title: "Logiciel de gestion d'élevage — Gleba", description: "Cheptel, lots, soins, alimentation, production et reproduction dans un même suivi.", url: "https://gleba.fr/logiciel-elevage", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Logiciel de gestion d'élevage" currentPath="/logiciel-elevage" eyebrow="Cheptel · Lots · Soins · Production" title="Un logiciel de gestion d'élevage" highlightedTitle="pour les fermes diversifiées" introduction="Gleba centralise les animaux, les lots, les événements sanitaires, l'alimentation, les productions et la reproduction. Le module est conçu pour cohabiter avec le maraîchage, le verger, les stocks et la comptabilité de la même exploitation." proof="les modules Animaux, Alimentation, Production, Reproduction et soins disposent de modèles, formulaires, historiques et indicateurs déjà exploités en production." screenshot={{ src: "/screenshots/gleba-gestion-elevage.png", alt: "Tableau de bord réel du logiciel de gestion d'élevage Gleba", caption: "Capture du compte de démonstration : tâches, ponte, alimentation et suivi hebdomadaire." }} capabilities={[
    { title: "Cheptel individuel", description: "Identifiant, espèce, race, sexe, parents, poids, statut, origine, destination et notes sur une même fiche." },
    { title: "Gestion par lots", description: "Regroupez les animaux suivis collectivement et rattachez productions, alimentation, soins et mouvements au lot." },
    { title: "Généalogie", description: "Renseignez mère et père puis consultez l'ascendance calculée sur plusieurs générations." },
    { title: "Soins", description: "Planifiez ou enregistrez vaccinations, vermifuges, traitements et autres soins avec leur date et leur cible." },
    { title: "Production et alimentation", description: "Consignez les productions disponibles selon l'atelier ainsi que les achats, stocks et distributions d'aliments." },
    { title: "Reproduction", description: "Conservez événements de reproduction, naissances, nombre de vivants et rattachement aux reproducteurs connus." },
  ]} workflowTitle="Un historique commun à tout le cheptel" workflow={[
    { title: "Créer animaux et lots", description: "Choisissez le niveau de suivi pertinent pour chaque atelier et chaque effectif." },
    { title: "Noter les événements", description: "Ajoutez soins, distributions, productions, reproductions, naissances, entrées et sorties." },
    { title: "Analyser l'historique", description: "Utilisez les tableaux et graphiques calculés à partir des données réellement enregistrées." },
  ]} limits="Gleba ne transmet pas de déclaration aux bases nationales et ne se connecte pas actuellement aux lecteurs de boucles, robots de traite ou automates de bâtiment. Il ne remplace pas les démarches réglementaires propres à chaque filière." faqs={[
    { question: "Quelles espèces peut-on gérer ?", answer: "Le référentiel contient plusieurs espèces animales et peut être enrichi. Les fonctions communes couvrent animaux, lots, soins, alimentation, reproduction, naissances et mouvements. Les écrans spécialisés varient selon la production." },
    { question: "Peut-on gérer à la fois des lots et des animaux identifiés ?", answer: "Oui. Les deux modes coexistent afin de suivre collectivement certains effectifs et individuellement les reproducteurs ou animaux identifiés." },
    { question: "La généalogie est-elle disponible ?", answer: "Oui. Les liens mère et père peuvent être enregistrés et une route dédiée calcule l'arbre généalogique jusqu'à quatre générations." },
    { question: "Gleba réalise-t-il les déclarations officielles ?", answer: "Non. Gleba conserve les données de travail de l'exploitation mais ne les transmet pas automatiquement aux organismes officiels." },
  ]} />;
}
