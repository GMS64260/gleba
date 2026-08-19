import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Logiciel pour micro-ferme professionnelle et diversifiée",
  description: "Le carnet d'exploitation libre des micro-fermes : planifiez le maraîchage, suivez le verger, l'élevage, les stocks, la traçabilité et la gestion.",
  alternates: { canonical: "https://gleba.fr/logiciel-micro-ferme" },
  openGraph: { title: "Gleba, le carnet d'exploitation libre des micro-fermes", description: "Maraîchage, verger, élevage et gestion reliés dans le même dossier d'exploitation.", url: "https://gleba.fr/logiciel-micro-ferme", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Logiciel pour micro-ferme" currentPath="/logiciel-micro-ferme" eyebrow="Micro-fermes professionnelles · Installation agricole" title="Le carnet d'exploitation libre" highlightedTitle="des micro-fermes diversifiées" introduction="Gleba relie le plan de culture, le terrain, le verger et les éventuels ateliers d'élevage aux stocks, à la traçabilité et à la gestion. Une micro-ferme prépare sa saison puis conserve le réalisé dans le même dossier, sans empiler carnets et tableurs." proof="les modules Maraîchage, Verger, Élevage, Comptabilité, Stocks, Boutique, Météo et Interventions sont présents dans l'application et reliés au même compte." capabilities={[
    { title: "Maraîchage", description: "Planification, planches, cultures, rotations, interventions, récoltes et stocks." },
    { title: "Verger", description: "Arbres, variétés, porte-greffes, opérations, pollinisation, observations et récoltes." },
    { title: "Élevage", description: "Animaux, lots, soins, alimentation, productions, reproduction et naissances." },
    { title: "Comptabilité opérationnelle", description: "Transactions, clients, fournisseurs, factures, TVA, rapports et exports disponibles." },
    { title: "Vente directe", description: "Une boutique publique permet de présenter des produits actifs et de recevoir des commandes." },
    { title: "Météo et tâches", description: "Prévisions, stations compatibles, conseils d'irrigation, calendriers et tâches complètent le suivi quotidien." },
  ]} workflowTitle="Les ateliers dans un référentiel commun" workflow={[
    { title: "Décrire l'exploitation", description: "Créez les parcelles et configurez les informations communes de la ferme." },
    { title: "Activer les ateliers", description: "Utilisez seulement les modules correspondant aux productions réellement conduites." },
    { title: "Relier la gestion", description: "Consignez récoltes, productions, stocks, ventes, dépenses et factures dans leurs écrans dédiés." },
  ]} limits="Gleba ne produit pas de bilan ou de liasse fiscale et ne remplace pas les téléprocédures réglementaires. Les liens entre production, stock, boutique et comptabilité dépendent des flux effectivement pris en charge et des saisies de l'utilisateur." faqs={[
    { question: "Gleba convient-il à un projet d'installation agricole ?", answer: "Oui. Une personne en installation peut préparer parcelles, planches, itinéraires techniques, ateliers et besoins avant la saison, puis conserver le suivi réel dans la même application." },
    { question: "Quels ateliers sont réunis dans Gleba ?", answer: "L'application comprend notamment maraîchage, verger, élevage, stocks, comptabilité, boutique, météo, interventions et plan de l'exploitation." },
    { question: "Peut-on n'utiliser qu'un seul module ?", answer: "Oui. Une exploitation peut utiliser les modules pertinents sans devoir saisir des données dans les autres ateliers." },
    { question: "Gleba remplace-t-il un expert-comptable ?", answer: "Non. Il fournit une gestion opérationnelle, des factures, rapports et certains exports, mais ni bilan ni liasse fiscale." },
    { question: "Le logiciel est-il auto-hébergeable ?", answer: "Oui. Le dépôt contient une configuration Docker Compose et le code est publié sous licence AGPL-3.0." },
  ]} />;
}
