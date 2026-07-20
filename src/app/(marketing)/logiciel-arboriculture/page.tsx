import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Logiciel d'arboriculture — Suivi du verger arbre par arbre",
  description: "Gérez arbres, parcelles, variétés, porte-greffes, tailles, greffes, traitements, pollinisation et récoltes avec le logiciel d'arboriculture open source Gleba.",
  alternates: { canonical: "https://gleba.fr/logiciel-arboriculture" },
  openGraph: { title: "Logiciel d'arboriculture open source — Gleba", description: "Suivi du verger, opérations, pollinisation, traitements et récoltes.", url: "https://gleba.fr/logiciel-arboriculture", type: "article" },
};

const capabilities = [
  { title: "Fiche de chaque arbre", description: "Espèce, variété, porte-greffe, date de plantation, état, emplacement et notes restent réunis dans un historique individuel." },
  { title: "Carte et parcelles", description: "Les arbres peuvent être rattachés à une parcelle et positionnés sur le plan 2D de l'exploitation." },
  { title: "Tailles, greffes et opérations", description: "Les interventions du verger sont planifiées puis enregistrées avec leur date, leur type et leurs observations." },
  { title: "Pollinisation", description: "Gleba analyse les variétés compatibles, la ploïdie et la distance entre arbres pour signaler les pollinisateurs manquants." },
  { title: "Traitements tracés", description: "Les interventions peuvent conserver produit, dose, AMM, DAR, délai de rentrée, ZNT et conditions météo renseignées." },
  { title: "Récoltes et rendements", description: "Les récoltes sont associées aux arbres et permettent de retrouver les quantités par arbre, variété et campagne." },
];

export default function Page() {
  return <BusinessLanding breadcrumb="Logiciel d'arboriculture" currentPath="/logiciel-arboriculture" eyebrow="Arboriculture · Verger · Traçabilité" title="Le logiciel d'arboriculture pour" highlightedTitle="suivre chaque arbre et chaque campagne" introduction="Gleba centralise le plan du verger, les variétés, les porte-greffes, les opérations, la pollinisation, les traitements et les récoltes. Il convient particulièrement aux vergers diversifiés et aux exploitations qui veulent conserver un historique arbre par arbre." proof="les fiches arbres, campagnes, opérations, observations, récoltes, porte-greffes et analyses de pollinisation sont accessibles dans le module Verger." screenshot={{ src: "/screenshots/gleba-gestion-verger.png", alt: "Tableau de bord du module arboriculture et verger de Gleba", caption: "Capture réelle du compte de démonstration : arbres, surface, récoltes et calendrier des opérations." }} capabilities={capabilities} workflowTitle="Du plan du verger à la récolte" workflow={[
    { title: "Décrire le patrimoine", description: "Créez les parcelles et les arbres avec leur variété, porte-greffe, date et position." },
    { title: "Conduire le verger", description: "Planifiez et consignez tailles, greffes, observations, soins et traitements." },
    { title: "Comparer les campagnes", description: "Enregistrez les récoltes et consultez l'historique conservé pour chaque arbre." },
  ]} limits="Gleba ne prétend pas gérer la paie des saisonniers, les palox, une station de conditionnement ou la logistique d'expédition. Son périmètre actuel est la conduite technique et économique d'un verger diversifié." faqs={[
    { question: "Gleba suit-il les arbres individuellement ?", answer: "Oui. Chaque arbre possède sa fiche, son emplacement, sa variété, son porte-greffe et son historique d'opérations et de récoltes." },
    { question: "Le logiciel aide-t-il pour la pollinisation ?", answer: "Oui. Le module calcule les compatibilités connues et tient compte de la distance entre arbres. Le résultat reste une aide à vérifier selon le contexte réel du verger." },
    { question: "Peut-on enregistrer les traitements du verger ?", answer: "Oui. Les interventions acceptent notamment le produit, la dose, le numéro AMM, le DAR, le délai de rentrée, les informations ZNT et les conditions météo lorsque l'utilisateur les renseigne." },
    { question: "Gleba remplace-t-il un ERP de station fruitière ?", answer: "Non. Gleba ne gère actuellement ni palox, ni paie saisonnière, ni chaîne de conditionnement. Il vise le suivi du verger et de l'exploitation." },
  ]} />;
}
