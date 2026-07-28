import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Logiciel d'élevage ovin — Troupeau, reproduction et soins",
  description: "Suivez brebis et béliers : boucles, lots, généalogie, agnelages détaillés, traitements, délais d'attente, mouvements, lait et registres avec Gleba.",
  alternates: { canonical: "https://gleba.fr/logiciel-elevage-ovin" },
  openGraph: { title: "Logiciel de gestion d'élevage ovin — Gleba", description: "Troupeau ovin, reproduction, agnelages, soins, alimentation et mouvements.", url: "https://gleba.fr/logiciel-elevage-ovin", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Logiciel d'élevage ovin" currentPath="/logiciel-elevage-ovin" eyebrow="Boucles · Agnelages · Soins · Registres" title="Suivez votre élevage ovin" highlightedTitle="de l'animal aux événements du troupeau" introduction="Gleba réunit brebis, béliers et lots avec leur identification, généalogie, reproduction, agnelages détaillés, traitements, alimentation et mouvements entre parcelles. Les ateliers laitiers peuvent aussi saisir leurs collectes et délais d'attente." proof="les animaux sont recherchables par boucle, chaque petit d'une naissance peut être détaillé, les injections sont tracées individuellement et les inventaires et registres sont générés à partir des données saisies." screenshot={{ src: "/screenshots/gleba-gestion-troupeau.png", alt: "Liste réelle de brebis et chèvres suivies dans Gleba", caption: "Capture du compte de démonstration : animaux identifiés, espèces, races, sexe et statut, sans maquette." }} capabilities={[
    { title: "Boucles, animaux et lots", description: "Recherchez un ovin par numéro de boucle ou nom et utilisez le suivi individuel ou collectif selon le troupeau." },
    { title: "Identification et races", description: "Conservez identifiant, espèce, race, sexe, date de naissance, provenance, poids et statut de l'animal." },
    { title: "Généalogie", description: "Reliez mère et père connus afin de consulter les ascendants enregistrés et les liens de parenté disponibles." },
    { title: "Saillies et agnelages", description: "Saisissez monte ou insémination, reproducteurs, statut et date attendue, puis détaillez les petits de la naissance." },
    { title: "Soins et injections", description: "Rattachez les traitements à un animal ou un lot et acquittez séparément les administrations d'un protocole." },
    { title: "Mouvements, lait et attentes", description: "Historisez les passages entre parcelles et, pour le lait, les collectes et dates prudentes de remise en vente." },
    { title: "Inventaire et registres", description: "Exportez l'inventaire complet, le registre d'élevage et le registre sanitaire constitués depuis vos saisies." },
  ]} workflowTitle="Tenir le suivi ovin dans un même dossier" workflow={[
    { title: "Décrire le troupeau", description: "Ajoutez les animaux suivis individuellement, leurs races et les lots de travail." },
    { title: "Noter les événements", description: "Enregistrez reproduction, agnelages, soins, alimentation, mortalités et mouvements au fil de la campagne." },
    { title: "Relire l'historique", description: "Retrouvez les fiches animales, liens familiaux et événements issus des saisies de l'exploitation." },
  ]} limits="Gleba ne transmet pas les notifications réglementaires, ne gère pas le stock officiel de boucles et ne se connecte actuellement ni aux lecteurs électroniques ni aux balances. Il ne remplace pas les outils nationaux d'identification ou de déclaration." faqs={[
    { question: "Peut-on suivre les brebis individuellement ?", answer: "Oui. Chaque animal peut avoir son identifiant, sa race, son sexe, ses parents, son poids, son statut et son historique. La gestion par lot reste disponible lorsque le suivi collectif est plus adapté." },
    { question: "Les saillies et agnelages sont-ils enregistrables ?", answer: "Oui. Gleba conserve la saillie, les reproducteurs ou références disponibles, la date attendue, le statut et la naissance liée avec les nombres de vivants et morts saisis." },
    { question: "Les agneaux peuvent-ils être détaillés individuellement ?", answer: "Oui. Le détail d'une naissance peut décrire chaque petit et créer ensuite une fiche individuelle pour les petits vivants." },
    { question: "Peut-on sortir un registre sanitaire ?", answer: "Oui. Un export PDF regroupe les soins et traitements enregistrés. Il doit être relu et complété selon la situation et les obligations de l'élevage." },
    { question: "Peut-on saisir le lait de brebis ?", answer: "Oui. Les collectes de lait acceptent une traite du matin, du soir ou unique, une quantité et un rattachement à l'animal ou au lot." },
    { question: "Gleba réalise-t-il les déclarations ovines ?", answer: "Non. Gleba sert au suivi interne du troupeau mais n'envoie aucune notification à une base administrative et ne pilote aucun lecteur de boucle." },
  ]} />;
}
