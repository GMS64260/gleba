import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Logiciel pour micro-ferme — Cultures, verger, élevage et ventes",
  description: "Gérez maraîchage, verger, élevage, stocks, interventions, ventes, factures et coûts dans une application open source destinée aux fermes diversifiées.",
  alternates: { canonical: "https://gleba.fr/logiciel-micro-ferme" },
  openGraph: { title: "Logiciel de gestion pour micro-ferme — Gleba", description: "Les ateliers d'une ferme diversifiée dans une application commune.", url: "https://gleba.fr/logiciel-micro-ferme", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Logiciel pour micro-ferme" currentPath="/logiciel-micro-ferme" eyebrow="Cultures · Verger · Élevage · Gestion" title="Le logiciel pour micro-ferme" highlightedTitle="qui réunit les ateliers diversifiés" introduction="Gleba rassemble le suivi des cultures, des arbres et des animaux avec les stocks, la boutique, les factures et les transactions de l'exploitation. Chaque module reste spécialisé tout en partageant parcelles, calendrier et données de gestion." proof="les modules Maraîchage, Verger, Élevage, Comptabilité, Stocks, Boutique, Météo et Interventions sont présents dans l'application et reliés au même compte." capabilities={[
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
    { question: "Quels ateliers sont réunis dans Gleba ?", answer: "L'application comprend notamment maraîchage, verger, élevage, stocks, comptabilité, boutique, météo, interventions et plan de l'exploitation." },
    { question: "Peut-on n'utiliser qu'un seul module ?", answer: "Oui. Une exploitation peut utiliser les modules pertinents sans devoir saisir des données dans les autres ateliers." },
    { question: "Gleba remplace-t-il un expert-comptable ?", answer: "Non. Il fournit une gestion opérationnelle, des factures, rapports et certains exports, mais ni bilan ni liasse fiscale." },
    { question: "Le logiciel est-il auto-hébergeable ?", answer: "Oui. Le dépôt contient une configuration Docker Compose et le code est publié sous licence AGPL-3.0." },
  ]} />;
}
