import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Assistant IA agricole — Interroger et saisir les données de la ferme",
  description: "Interrogez les cultures, le verger, l'élevage et la comptabilité de Gleba en langage naturel grâce à un assistant IA doté d'outils applicatifs.",
  alternates: { canonical: "https://gleba.fr/assistant-ia-agricole" },
  openGraph: { title: "Assistant IA agricole connecté à Gleba", description: "Un assistant qui utilise les données et outils déjà disponibles dans Gleba.", url: "https://gleba.fr/assistant-ia-agricole", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Assistant IA agricole" currentPath="/assistant-ia-agricole" eyebrow="Assistant · Outils Gleba · MCP" title="Un assistant IA agricole" highlightedTitle="connecté aux données de votre ferme" introduction="L'assistant de Gleba ne répond pas seulement à partir d'un texte général : il dispose d'outils dédiés pour consulter les données autorisées du compte et réaliser certaines saisies dans les modules agricoles." proof="la route de chat utilise actuellement le client Ollama configuré par Gleba et appelle des outils dédiés au maraîchage, au verger, à l'élevage et à la comptabilité. Une API MCP authentifiée expose aussi une sélection d'outils." capabilities={[
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
  ]} limits="Une IA peut se tromper ou choisir un outil inadapté. Les confirmations sont imposées par les instructions du modèle mais ne constituent pas une barrière transactionnelle universelle. Les actions ne sont pas toutes réversibles et les réponses agronomiques, sanitaires, fiscales ou réglementaires doivent être vérifiées." faqs={[
    { question: "Quel service d'IA utilise gleba.fr ?", answer: "La route de chat utilise actuellement l'API Ollama et un modèle configurable par variable d'environnement. Le modèle par défaut dans le code est glm-4.7." },
    { question: "L'assistant voit-il toutes les données de tous les utilisateurs ?", answer: "Non. Les outils applicatifs passent par l'authentification et travaillent avec l'identifiant du compte autorisé." },
    { question: "Peut-il modifier les données ?", answer: "Certains outils créent ou modifient des données. Les instructions demandent une confirmation avant écriture, mais l'utilisateur doit toujours contrôler le résultat dans le module concerné." },
    { question: "Les actions sont-elles toujours réversibles ?", answer: "Non. Certaines suppressions sont explicitement irréversibles. Gleba ne présente donc pas l'assistant comme infaillible ni toutes ses actions comme annulables." },
    { question: "Peut-on connecter un client MCP ?", answer: "Oui, si le client sait appeler un serveur MCP distant avec le mode d'authentification proposé par Gleba. La compatibilité exacte dépend du client et de sa configuration." },
  ]} />;
}
