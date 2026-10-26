import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";
import { ogBase } from "@/lib/seo/og";

export const metadata: Metadata = {
  title: "Assistant IA agricole — Interroger et saisir les données de la ferme",
  description: "Interrogez les cultures, le verger, l'élevage et la comptabilité de Gleba en langage naturel grâce à un assistant IA doté d'outils applicatifs.",
  alternates: { canonical: "https://gleba.fr/assistant-ia-agricole" },
  openGraph: { ...ogBase, title: "Assistant IA agricole connecté à Gleba", description: "Un assistant qui utilise les données et outils déjà disponibles dans Gleba.", url: "https://gleba.fr/assistant-ia-agricole", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Assistant IA agricole" currentPath="/assistant-ia-agricole" eyebrow="Assistant · Outils Gleba · MCP" title="Un assistant IA agricole" highlightedTitle="connecté aux données de votre ferme" introduction="L'assistant de Gleba ne répond pas seulement à partir d'un texte général : il dispose d'outils dédiés pour consulter les données autorisées du compte et réaliser certaines saisies dans les modules agricoles." proof="l'assistant de gleba.fr s'appuie sur OpenAI (service Codex) et appelle des outils dédiés au maraîchage, au verger, à l'élevage et à la comptabilité. Une API MCP authentifiée expose aussi une sélection d'outils." capabilities={[
    { title: "Cultures et planches", description: "L'assistant peut lister les cultures, planches, récoltes et références nécessaires pour répondre à une question sur la campagne." },
    { title: "Verger", description: "Des outils dédiés permettent de consulter les arbres et d'ajouter un arbre après confirmation demandée dans les instructions de l'assistant." },
    { title: "Élevage", description: "L'assistant peut consulter animaux, lots, productions et soins, puis créer certaines données prévues par ses outils." },
    { title: "Comptabilité", description: "Il peut lister ventes, dépenses, clients, factures et statistiques, ou préparer certaines saisies prévues par les outils." },
    { title: "Météo et agronomie", description: "Les outils couvrent aussi météo de parcelle, calendrier, interventions, registre phyto et référentiels agronomiques." },
    { title: "Accès MCP", description: "Un token API personnel permet d'appeler les outils MCP exposés par l'instance depuis un client compatible correctement configuré." },
  ]} workflowTitle="Une question, des outils, une réponse contextualisée" workflow={[
    { title: "Formuler la demande", description: "Posez une question précise ou demandez une saisie à partir des données de votre exploitation." },
    { title: "Consulter les outils", description: "Le modèle choisit les outils disponibles et reçoit uniquement les résultats autorisés pour le compte." },
    { title: "Vérifier la réponse", description: "Relisez les données et confirmez explicitement les actions demandées avant de vous y fier." },
  ]} limits="Une IA peut se tromper ou choisir un outil inadapté. Les actions proposées en mode Normal nécessitent une confirmation contrôlée par Gleba. Une analyse visuelle reste une aide à vérifier sur le terrain et ne remplace pas un diagnostic vétérinaire. Les actions ne sont pas toutes réversibles et les réponses agronomiques, sanitaires, fiscales ou réglementaires doivent être vérifiées." faqs={[
    { question: "Quel service d'IA utilise gleba.fr ?", answer: "Sur gleba.fr, les questions posées à l'assistant sont traitées par OpenAI (service Codex), aux États-Unis, avec un résumé pseudonymisé de l'exploitation. Le détail figure dans la politique de confidentialité." },
    { question: "Puis-je envoyer des photos ?", answer: "Oui, jusqu'à trois photos depuis la galerie ou l'appareil photo : identification de plantes, indices de maladie ou de carence, verger et animaux. Ajoutez le contexte pour affiner l'analyse. Les photos restent privées dans la conversation et sont transmises à l'IA pour analyse, comme indiqué dans la politique de confidentialité." },
    { question: "L'assistant voit-il toutes les données de tous les utilisateurs ?", answer: "Non. Les outils applicatifs passent par l'authentification et travaillent avec l'identifiant du compte autorisé." },
    { question: "Peut-il modifier les données ?", answer: "Certains outils créent ou modifient des données. Le mode Normal propose les modifications, puis Gleba attend votre confirmation avant de les exécuter. Les modes Support et Extra restent en lecture seule. Contrôlez le résultat dans le module concerné." },
    { question: "Les actions sont-elles toujours réversibles ?", answer: "Non. Certaines suppressions sont explicitement irréversibles. Gleba ne présente donc pas l'assistant comme infaillible ni toutes ses actions comme annulables." },
    { question: "Peut-on connecter un client MCP ?", answer: "Oui, si le client sait appeler un serveur MCP distant avec le mode d'authentification proposé par Gleba. La compatibilité exacte dépend du client et de sa configuration." },
  ]} />;
}
