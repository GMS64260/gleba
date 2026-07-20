import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Logiciel de maraîchage — Planification, cultures et traçabilité",
  description: "Planifiez cultures et rotations, gérez planches, semis, interventions, récoltes, stocks et registre phytosanitaire avec le logiciel de maraîchage Gleba.",
  alternates: { canonical: "https://gleba.fr/logiciel-maraichage" },
  openGraph: { title: "Logiciel de maraîchage open source — Gleba", description: "Planification, planches, cultures, interventions, récoltes et traçabilité.", url: "https://gleba.fr/logiciel-maraichage", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Logiciel de maraîchage" currentPath="/logiciel-maraichage" eyebrow="Maraîchage · Plan de culture · Récoltes" title="Le logiciel de maraîchage" highlightedTitle="qui relie le prévu au réalisé" introduction="Gleba réunit itinéraires techniques, planches, cultures, rotations, interventions, récoltes, stocks et coûts. Le maraîcher prépare sa saison puis conserve les événements réellement saisis au champ dans le même dossier." proof="les modules Planification, Cultures, Planches, Rotations, Interventions, Récoltes et Stocks sont déjà disponibles, reliés aux mêmes espèces et parcelles." screenshot={{ src: "/screenshots/gleba-planification-maraichage.png", alt: "Écran réel de planification maraîchère dans Gleba", caption: "Organisation de la saison dans le compte de démonstration : plan, îlots, planches, semences et plants." }} capabilities={[
    { title: "Planification", description: "Préparez ITP, besoins, prévisionnels, affectations aux planches et calendrier de la saison." },
    { title: "Planches et carte 2D", description: "Décrivez les surfaces de culture et visualisez leur implantation sur le terrain." },
    { title: "Cultures", description: "Suivez espèce, variété, planche, dates, état, quantités attendues, notes et historique." },
    { title: "Rotations", description: "Construisez des séquences pluriannuelles et relisez les précédents culturaux par planche." },
    { title: "Interventions", description: "Enregistrez semis, plantation, désherbage, fertilisation, traitement, irrigation, taille et autres travaux." },
    { title: "Récoltes et stocks", description: "Rattachez les récoltes aux cultures puis suivez inventaires, entrées et sorties dans le module Stocks." },
  ]} workflowTitle="Une saison suivie dans un seul dossier" workflow={[
    { title: "Préparer", description: "Choisissez les espèces et ITP, estimez les besoins et organisez les séries." },
    { title: "Implanter", description: "Affectez les cultures aux planches et mettez à jour semis et plantations réalisés." },
    { title: "Mesurer", description: "Consignez interventions, récoltes et sorties pour conserver l'historique de la campagne." },
  ]} limits="Gleba aide à organiser les données mais ne décide pas automatiquement du plan de culture et ne garantit ni rendement, ni date, ni conformité d'une pratique. Les références doivent être adaptées par le maraîcher." faqs={[
    { question: "Gleba permet-il de planifier les cultures ?", answer: "Oui. Les ITP, besoins, prévisionnels, affectations aux planches, rotations et calendriers sont réunis dans le module de planification." },
    { question: "Peut-on enregistrer les travaux au champ ?", answer: "Oui. Les interventions peuvent être rattachées à une culture, une planche, une parcelle ou un arbre selon leur nature." },
    { question: "Les récoltes sont-elles reliées aux cultures ?", answer: "Oui. Chaque récolte conserve notamment sa culture, son espèce, sa date et sa quantité, ce qui permet de relire le réalisé." },
    { question: "Gleba fonctionne-t-il sur smartphone ?", answer: "Oui. L'application web est responsive et les écrans principaux ont été adaptés à la consultation et à la saisie sur smartphone." },
  ]} />;
}
