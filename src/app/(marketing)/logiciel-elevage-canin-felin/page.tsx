import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Logiciel d'élevage canin et félin — Chiens et chats",
  description: "Suivez chiens, chats, races, généalogie, portées, tests de santé, consanguinité, réservations, acomptes et documents de cession avec Gleba.",
  alternates: { canonical: "https://gleba.fr/logiciel-elevage-canin-felin" },
  openGraph: {
    title: "Logiciel d'élevage canin et félin — Gleba",
    description: "Fiches chiens et chats, généalogie, portées, santé et réservations dans un même suivi.",
    url: "https://gleba.fr/logiciel-elevage-canin-felin",
    type: "article",
  },
};

export default function Page() {
  return <BusinessLanding
    breadcrumb="Logiciel d'élevage canin et félin"
    currentPath="/logiciel-elevage-canin-felin"
    eyebrow="Chiens · Chats · Portées · Santé"
    title="Gérez votre élevage canin ou félin"
    highlightedTitle="sans écrans agricoles inutiles"
    introduction="Le mode Chiens & chats adapte le module Élevage aux élevages canins et félins. Il réunit fiches individuelles, races, généalogie, reproduction, portées, santé, sélection, réservations et documents de cession."
    proof="le catalogue distingue chiens et chats avec leurs races ; l'application détecte les ancêtres communs sur quatre générations, enregistre les tests de santé, suit réservations et acomptes et génère des documents PDF à relire."
    capabilities={[
      { title: "Fiches chiens et chats", description: "Conservez identifiant, nom, race, sexe, robe, naissance, poids, statut, provenance et notes sur chaque animal." },
      { title: "Races canines et félines", description: "Recherchez une race dans le catalogue dédié et rattachez-la à l'animal sans mélanger les autres filières." },
      { title: "Généalogie et sélection", description: "Reliez les parents, détectez les ancêtres communs sur quatre générations et conservez numéro de registre, confirmation, cotation et résultats." },
      { title: "Reproduction et portées", description: "Suivez saillies, dates attendues, naissances et détail de chaque petit avec sexe, poids, couleur et état." },
      { title: "Santé", description: "Enregistrez soins, vaccinations et tests de sélection : dysplasie, tares oculaires, panels ADN et filiation." },
      { title: "Réservations et acomptes", description: "Tenez la liste d'attente, rattachez une réservation à une portée et suivez acompte, montant, livraison et statut." },
      { title: "Documents PDF", description: "Générez pedigree sur trois générations, contrat de réservation, certificat d'engagement et attestation de cession à partir des données saisies." },
    ]}
    workflowTitle="Du reproducteur au suivi de la portée"
    workflow={[
      { title: "Décrire les reproducteurs", description: "Créez les chiens ou chats avec leur race, leur identification et les liens familiaux connus." },
      { title: "Suivre la reproduction", description: "Consignez saillies, gestation, naissance et informations propres à chaque petit." },
      { title: "Préparer le suivi", description: "Rattachez santé et réservations aux dossiers conservés dans Gleba." },
    ]}
    limits="Gleba est un outil de suivi interne. Il ne transmet aucune déclaration à I-CAD, à la SCC/LOF ou au LOOF, ne génère pas de pedigree officiel et ne garantit aucune conformité réglementaire."
    faqs={[
      { question: "Peut-on gérer à la fois des chiens et des chats ?", answer: "Oui. Le mode compagnie contient les deux espèces, avec des catalogues de races distincts et les mêmes fonctions de fiche, généalogie, reproduction, naissance et santé." },
      { question: "Chaque chiot ou chaton peut-il avoir sa propre fiche ?", answer: "Oui. Le détail d'une naissance conserve chaque petit et permet de créer une fiche animale individuelle pour les petits vivants." },
      { question: "Le pedigree officiel est-il généré ?", answer: "Gleba génère un PDF interne sur trois générations avec les données saisies. Ce document n'est pas un pedigree officiel : seul l'organisme compétent peut délivrer celui-ci." },
      { question: "Peut-on générer des documents de réservation et de cession ?", answer: "Oui. Gleba produit des modèles PDF de contrat de réservation, certificat d'engagement et attestation de cession. L'éleveur doit en contrôler et compléter le contenu avant utilisation." },
      { question: "Gleba est-il connecté à I-CAD, au LOF ou au LOOF ?", answer: "Non. Aucune transmission automatique n'est réalisée ; les démarches officielles restent à effectuer dans les services concernés." },
    ]}
  />;
}
