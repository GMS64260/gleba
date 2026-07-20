import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Logiciel de gestion de verger — Arbres, tailles, traitements et récoltes",
  description: "Suivez chaque arbre du verger : variété, porte-greffe, emplacement, tailles, greffes, pollinisation, observations, traitements et récoltes dans Gleba.",
  alternates: { canonical: "https://gleba.fr/logiciel-verger" },
  openGraph: { title: "Logiciel de gestion de verger — Gleba", description: "Le suivi du verger arbre par arbre, de la plantation à la récolte.", url: "https://gleba.fr/logiciel-verger", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Logiciel de gestion de verger" currentPath="/logiciel-verger" eyebrow="Verger · Arbres · Variétés" title="Le logiciel de gestion de verger" highlightedTitle="qui garde l'histoire de chaque arbre" introduction="Gleba associe une fiche individuelle, une position sur la ferme et un historique d'opérations à chaque arbre. Les variétés, porte-greffes, pollinisateurs, observations et récoltes restent consultables au même endroit." proof="le module Verger permet déjà d'ajouter, cartographier, filtrer et documenter les arbres, puis de suivre opérations, campagnes, pollinisation et récoltes." screenshot={{ src: "/screenshots/gleba-gestion-verger.png", alt: "Vue réelle du logiciel de gestion de verger Gleba", caption: "Tableau de bord réel du verger de démonstration, avec indicateurs et calendrier." }} capabilities={[
    { title: "Inventaire du verger", description: "Retrouvez arbres, espèces, variétés, porte-greffes, dates de plantation, états et parcelles." },
    { title: "Position sur la ferme", description: "Placez les arbres sur la carte 2D et conservez leurs coordonnées au sein de la parcelle." },
    { title: "Opérations", description: "Planifiez et consignez tailles, greffes, plantations, traitements et autres travaux du verger." },
    { title: "Observations", description: "Notez l'état sanitaire et les informations de suivi rattachées à l'arbre observé." },
    { title: "Pollinisation", description: "Repérez les compatibilités disponibles et les distances entre arbres pollinisateurs." },
    { title: "Récoltes", description: "Enregistrez les quantités obtenues et conservez l'historique associé aux arbres et campagnes." },
  ]} workflowTitle="Planter, observer, intervenir, récolter" workflow={[
    { title: "Inventorier", description: "Créez l'arbre avec sa variété, son porte-greffe, sa date et son emplacement." },
    { title: "Suivre", description: "Ajoutez observations et opérations tout au long de la vie du verger." },
    { title: "Capitaliser", description: "Relisez les récoltes et l'historique individuel avant les décisions de campagne suivantes." },
  ]} limits="Les recommandations intégrées sont des aides agronomiques générales. Elles ne remplacent ni l'observation sur place, ni un conseil technique adapté à la parcelle et à la réglementation en vigueur." faqs={[
    { question: "Peut-on suivre un arbre individuellement ?", answer: "Oui. Chaque arbre possède une fiche et peut recevoir opérations, observations, récoltes et informations de position." },
    { question: "Les porte-greffes sont-ils gérés ?", answer: "Oui. Un référentiel de porte-greffes existe et le porte-greffe peut être associé à chaque arbre." },
    { question: "Peut-on repérer un problème de pollinisation ?", answer: "Le module analyse les compatibilités connues, la ploïdie et la distance. Il signale les situations à vérifier sans garantir la nouaison." },
    { question: "Le suivi convient-il à une station de conditionnement ?", answer: "Non. Gleba suit le verger et l'exploitation ; il ne gère pas actuellement les palox, lignes de conditionnement, équipes de cueillette ou expéditions." },
  ]} />;
}
