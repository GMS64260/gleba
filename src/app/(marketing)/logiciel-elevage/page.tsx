import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Logiciel de gestion d'élevage et animaux — Gleba",
  description: "Suivez bovins, ovins, caprins, volailles, chiens, chats, équins et NAC : animaux, races, reproduction, naissances et soins dans Gleba.",
  alternates: { canonical: "https://gleba.fr/logiciel-elevage" },
  openGraph: { title: "Logiciel de gestion d'élevage multi-espèces — Gleba", description: "Bovins, ovins, caprins, volailles, chiens, chats, équins et NAC dans un même suivi.", url: "https://gleba.fr/logiciel-elevage", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Logiciel de gestion d'élevage" currentPath="/logiciel-elevage" eyebrow="Bovins · Ovins · Caprins · Volailles · Chiens & chats · Équins · NAC" title="Un logiciel de gestion d'élevage" highlightedTitle="adapté à chaque espèce" introduction="Gleba centralise les animaux, les lots, les événements sanitaires, l'alimentation, les productions et la reproduction. Bovins, ovins, caprins, volailles, chiens, chats, chevaux, ânes et nouveaux animaux de compagnie disposent d'un suivi commun dont les écrans s'adaptent à leurs besoins." proof="les modes chiens et chats, équins et NAC sont activables par compte ; ils filtrent les espèces et races proposées et adaptent le tableau de bord, les productions, le pâturage, l'économie et les délais d'attente selon les animaux sélectionnés." screenshot={{ src: "/screenshots/gleba-gestion-elevage.png", alt: "Tableau de bord réel du logiciel de gestion d'élevage Gleba", caption: "Capture du compte de démonstration : tâches, ponte, alimentation et suivi hebdomadaire." }} capabilities={[
    { title: "Cheptel individuel", description: "Identifiant, espèce, race, sexe, parents, poids, statut, origine, destination et notes sur une même fiche." },
    { title: "Gestion par lots", description: "Regroupez les animaux suivis collectivement et rattachez productions, alimentation, soins et mouvements au lot." },
    { title: "Généalogie", description: "Renseignez mère et père puis consultez l'ascendance calculée sur plusieurs générations." },
    { title: "Soins", description: "Planifiez ou enregistrez vaccinations, vermifuges, traitements et autres soins avec leur date et leur cible." },
    { title: "Production et alimentation", description: "Consignez les productions disponibles selon l'atelier ainsi que les achats, stocks et distributions d'aliments." },
    { title: "Reproduction", description: "Conservez événements de reproduction, naissances, nombre de vivants et rattachement aux reproducteurs connus." },
    { title: "Chiens, chats, équins et NAC", description: "Activez les catalogues dédiés avec leurs espèces et races, puis utilisez les fiches, soins, généalogie, reproduction et naissances communs." },
    { title: "Écrans adaptés aux animaux", description: "La ponte, le lait, l'abattage, le pâturage ou l'économie s'affichent uniquement lorsqu'ils ont du sens pour l'élevage sélectionné." },
  ]} workflowTitle="Un historique commun à tout le cheptel" workflow={[
    { title: "Créer animaux et lots", description: "Choisissez le niveau de suivi pertinent pour chaque atelier et chaque effectif." },
    { title: "Noter les événements", description: "Ajoutez soins, distributions, productions, reproductions, naissances, entrées et sorties." },
    { title: "Analyser l'historique", description: "Utilisez les tableaux et graphiques calculés à partir des données réellement enregistrées." },
  ]} limits="Gleba ne transmet pas de déclaration aux bases nationales et ne se connecte pas actuellement aux lecteurs de boucles, robots de traite ou automates de bâtiment. Il ne remplace pas les démarches réglementaires propres à chaque filière." faqs={[
    { question: "Quelles espèces peut-on gérer ?", answer: "Le référentiel couvre notamment bovins, ovins, caprins et volailles, ainsi que les chiens et chats, chevaux, poneys, ânes, mulets et de nombreux NAC : furets, rongeurs, oiseaux, reptiles et amphibiens. Les écrans spécialisés varient selon les animaux." },
    { question: "Le logiciel convient-il à un élevage canin ou félin ?", answer: "Le mode Chiens & chats fournit les fiches animales, races, généalogie, reproduction, naissances, soins, tests de santé et réservations. Gleba ne transmet toutefois aucune donnée à I-CAD, au LOF ou au LOOF." },
    { question: "Peut-on suivre des chevaux et des NAC ?", answer: "Oui. Les modes Équins et NAC activent leurs catalogues d'espèces et adaptent les écrans communs. Gleba ne remplace pas le SIRE, l'i-FAP, les registres officiels ni les démarches propres aux espèces réglementées." },
    { question: "Peut-on gérer à la fois des lots et des animaux identifiés ?", answer: "Oui. Les deux modes coexistent afin de suivre collectivement certains effectifs et individuellement les reproducteurs ou animaux identifiés." },
    { question: "La généalogie est-elle disponible ?", answer: "Oui. Les liens mère et père peuvent être enregistrés et une route dédiée calcule l'arbre généalogique jusqu'à quatre générations." },
    { question: "Gleba réalise-t-il les déclarations officielles ?", answer: "Non. Gleba conserve les données de travail de l'exploitation mais ne les transmet pas automatiquement aux organismes officiels." },
  ]} />;
}
