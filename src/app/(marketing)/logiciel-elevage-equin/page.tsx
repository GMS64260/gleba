import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Logiciel de gestion d'élevage équin — Chevaux et poneys",
  description: "Suivez chevaux, poneys, ânes et mulets : fiches, races, pedigree, reproduction, santé, tests ADN, soins et calendrier avec Gleba.",
  alternates: { canonical: "https://gleba.fr/logiciel-elevage-equin" },
  openGraph: {
    title: "Logiciel de gestion d'élevage équin — Gleba",
    description: "Chevaux, poneys et ânes : fiches, généalogie, reproduction, soins et mouvements.",
    url: "https://gleba.fr/logiciel-elevage-equin",
    type: "article",
  },
};

export default function Page() {
  return <BusinessLanding
    breadcrumb="Logiciel de gestion d'élevage équin"
    currentPath="/logiciel-elevage-equin"
    eyebrow="Chevaux · Poneys · Ânes · Soins"
    title="Suivez vos équidés"
    highlightedTitle="dans un dossier commun"
    introduction="Le mode Équins organise les fiches des chevaux, poneys, ânes et mulets avec leurs races, généalogie, reproduction, naissances, soins, tests de santé et papiers d'élevage."
    proof="la filière équine possède son catalogue d'espèces et races ; elle propose les numéros SIRE ou UELN, un pedigree PDF interne, la détection d'ancêtres communs et des tests de santé adaptés."
    capabilities={[
      { title: "Chevaux, poneys et ânes", description: "Créez une fiche individuelle avec identification, race, sexe, robe, naissance, poids, statut et notes." },
      { title: "Catalogue de races", description: "Sélectionnez une race équine dans le catalogue filtré pour ne pas mélanger les référentiels d'autres élevages." },
      { title: "Généalogie et pedigree", description: "Rattachez les parents, conservez numéro SIRE ou UELN, stud-book et qualifications, puis exportez l'arbre interne sur trois générations." },
      { title: "Reproduction", description: "Consignez saillies, reproducteurs, statut, date attendue et naissance liée." },
      { title: "Soins et santé", description: "Planifiez les soins et consignez radios d'ostéochondrose, panels ADN équins, filiation ou test de Coggins." },
      { title: "Compatibilité d'accouplement", description: "Comparez une femelle et un mâle de la même espèce afin de repérer les ancêtres communs sur quatre générations." },
      { title: "Mouvements et calendrier", description: "Historisez les événements et retrouvez les tâches programmées dans le calendrier de l'atelier." },
    ]}
    workflowTitle="Un historique par équidé"
    workflow={[
      { title: "Identifier", description: "Créez l'équidé, choisissez son espèce et sa race, puis complétez les informations connues." },
      { title: "Noter les événements", description: "Enregistrez reproduction, naissances, soins, traitements et changements de statut." },
      { title: "Relire", description: "Consultez la fiche, la généalogie et la chronologie constituées à partir de vos saisies." },
    ]}
    limits="Gleba ne se connecte pas au SIRE ou à l'IFCE, ne produit aucun document d'identification officiel et ne remplace pas le registre d'élevage ni les démarches réglementaires obligatoires."
    faqs={[
      { question: "Quels équidés peut-on suivre ?", answer: "Le catalogue comprend les chevaux, poneys, ânes et mulets ou bardots, avec des races associées lorsque cela est pertinent." },
      { question: "Peut-on suivre la reproduction ?", answer: "Oui. Gleba conserve les reproducteurs, saillies, statuts, dates attendues, naissances et liens de filiation saisis." },
      { question: "Les soins sont-ils planifiables ?", answer: "Oui. Un soin peut être prévu puis marqué comme réalisé, avec son produit, sa dose, sa voie et ses administrations lorsqu'elles sont renseignées." },
      { question: "Peut-on conserver les informations SIRE et les tests de santé ?", answer: "Oui. Gleba enregistre un numéro SIRE ou UELN, l'inscription au stud-book, les qualifications et différents tests équins. Ces données restent internes et ne sont pas transmises à l'IFCE." },
      { question: "Gleba transmet-il les informations au SIRE ?", answer: "Non. Le suivi reste interne à Gleba et aucune déclaration n'est transmise automatiquement au SIRE ou à l'IFCE." },
    ]}
  />;
}
