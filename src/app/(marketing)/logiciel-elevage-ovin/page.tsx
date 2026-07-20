import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Logiciel d'élevage ovin — Troupeau, reproduction et soins",
  description: "Suivez brebis et béliers : identification, lots, généalogie, saillies, agnelages, soins, alimentation, mouvements et lait avec Gleba.",
  alternates: { canonical: "https://gleba.fr/logiciel-elevage-ovin" },
  openGraph: { title: "Logiciel de gestion d'élevage ovin — Gleba", description: "Troupeau ovin, reproduction, agnelages, soins, alimentation et mouvements.", url: "https://gleba.fr/logiciel-elevage-ovin", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Logiciel d'élevage ovin" currentPath="/logiciel-elevage-ovin" eyebrow="Ovins · Troupeau · Agnelages" title="Suivez votre élevage ovin" highlightedTitle="de l'animal aux événements du troupeau" introduction="Gleba réunit les brebis, béliers et lots avec leur identification, leur généalogie, les saillies, les naissances, les soins, l'alimentation et les mouvements entre parcelles. Les productions laitières peuvent aussi être saisies pour les brebis concernées." proof="le référentiel de production contient notamment les brebis Lacaune, Mérinos d'Arles, Solognote et Suffolk ; les modèles Animaux, Lots, Saillies, Naissances, Soins, Alimentation, Mouvements et Collectes de lait sont déjà utilisés par l'application." screenshot={{ src: "/screenshots/gleba-gestion-troupeau.png", alt: "Liste réelle de brebis et chèvres suivies dans Gleba", caption: "Capture du compte de démonstration : animaux identifiés, espèces, races, sexe et statut, sans maquette." }} capabilities={[
    { title: "Animaux et lots", description: "Enregistrez un ovin individuellement ou regroupez plusieurs animaux dans un lot avec effectif et statut." },
    { title: "Identification et races", description: "Conservez identifiant, espèce, race, sexe, date de naissance, provenance, poids et statut de l'animal." },
    { title: "Généalogie", description: "Reliez mère et père connus afin de consulter les ascendants enregistrés et les liens de parenté disponibles." },
    { title: "Saillies et agnelages", description: "Saisissez monte ou insémination, reproducteurs, statut, mise bas attendue puis naissance et nombre de vivants." },
    { title: "Soins et alimentation", description: "Rattachez soins, produits vétérinaires et distributions d'aliments à un animal ou à un lot." },
    { title: "Mouvements et lait", description: "Historisez les passages entre parcelles et, pour un atelier laitier, les collectes par traite et par animal ou lot." },
  ]} workflowTitle="Tenir le suivi ovin dans un même dossier" workflow={[
    { title: "Décrire le troupeau", description: "Ajoutez les animaux suivis individuellement, leurs races et les lots de travail." },
    { title: "Noter les événements", description: "Enregistrez reproduction, agnelages, soins, alimentation, mortalités et mouvements au fil de la campagne." },
    { title: "Relire l'historique", description: "Retrouvez les fiches animales, liens familiaux et événements issus des saisies de l'exploitation." },
  ]} limits="Gleba ne transmet pas les notifications réglementaires, ne gère pas le stock officiel de boucles et ne se connecte actuellement ni aux lecteurs électroniques ni aux balances. Il ne remplace pas les outils nationaux d'identification ou de déclaration." faqs={[
    { question: "Peut-on suivre les brebis individuellement ?", answer: "Oui. Chaque animal peut avoir son identifiant, sa race, son sexe, ses parents, son poids, son statut et son historique. La gestion par lot reste disponible lorsque le suivi collectif est plus adapté." },
    { question: "Les saillies et agnelages sont-ils enregistrables ?", answer: "Oui. Gleba conserve la saillie, les reproducteurs ou références disponibles, la date attendue, le statut et la naissance liée avec les nombres de vivants et morts saisis." },
    { question: "Peut-on saisir le lait de brebis ?", answer: "Oui. Les collectes de lait acceptent une traite du matin, du soir ou unique, une quantité et un rattachement à l'animal ou au lot." },
    { question: "Gleba réalise-t-il les déclarations ovines ?", answer: "Non. Gleba sert au suivi interne du troupeau mais n'envoie aucune notification à une base administrative et ne pilote aucun lecteur de boucle." },
  ]} />;
}
