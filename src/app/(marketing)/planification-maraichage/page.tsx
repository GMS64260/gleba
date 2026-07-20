import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Planification maraîchère — Plan de culture, rotations et semis",
  description: "Construisez votre planification maraîchère avec itinéraires techniques, calendrier de semis, planches, rotations, besoins en plants et suivi des cultures.",
  alternates: { canonical: "https://gleba.fr/planification-maraichage" },
  openGraph: { title: "Logiciel de planification maraîchère — Gleba", description: "Plan de culture, ITP, semis, planches, rotations et récoltes.", url: "https://gleba.fr/planification-maraichage", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Planification maraîchère" currentPath="/planification-maraichage" eyebrow="Plan de culture · Semis · Rotations" title="Une planification maraîchère" highlightedTitle="reliée au travail réellement réalisé" introduction="Gleba transforme les itinéraires techniques en cultures planifiées, les place sur les planches et conserve ensuite semis, plantations, interventions et récoltes dans le même outil." proof="les ITP, besoins, prévisionnels, affectations aux planches, rotations et calendriers sont des écrans distincts du module Maraîchage." screenshot={{ src: "/screenshots/gleba-planification-maraichage.png", alt: "Planification de cultures maraîchères dans Gleba", caption: "Capture authentique de l'espace Organiser ma saison du compte de démonstration." }} capabilities={[
    { title: "Itinéraires techniques", description: "Définissez les semaines de semis, plantation et récolte, les espacements, la densité et la durée de chaque conduite." },
    { title: "Calendrier climatique", description: "Les périodes peuvent être décalées selon la zone climatique configurée pour l'exploitation." },
    { title: "Besoins et prévisionnels", description: "Préparez les quantités et surfaces attendues avant d'affecter les séries aux planches." },
    { title: "Planches et cultures", description: "Rattachez chaque culture à une planche et suivez son état de la planification jusqu'à la fin de récolte." },
    { title: "Rotations", description: "Construisez des séquences pluriannuelles et relisez les familles cultivées sur chaque planche." },
    { title: "Récoltes réelles", description: "Les quantités récoltées restent associées aux cultures, espèces, dates et planches concernées." },
  ]} workflowTitle="Construire, implanter, suivre" workflow={[
    { title: "Construire le plan", description: "Choisissez espèces, variétés et ITP puis préparez besoins et séries pour la saison." },
    { title: "Affecter les planches", description: "Placez les cultures sur les surfaces disponibles en tenant compte des rotations prévues." },
    { title: "Suivre la campagne", description: "Mettez à jour les états, interventions et récoltes pour comparer le prévu au réalisé." },
  ]} limits="Gleba propose des références et des décalages climatiques, mais ne garantit ni rendement ni date de récolte. Le plan reste une décision agronomique de l'utilisateur." faqs={[
    { question: "Gleba permet-il de créer un plan de culture ?", answer: "Oui. Le module réunit ITP, besoins, cultures prévisionnelles, affectation aux planches, rotations et calendrier." },
    { question: "Les dates sont-elles adaptées au climat ?", answer: "La zone climatique de l'exploitation peut décaler les périodes de référence. Ces dates constituent une aide et doivent être ajustées aux conditions locales." },
    { question: "Peut-on comparer planification et récoltes ?", answer: "Les récoltes sont rattachées aux cultures planifiées. Gleba conserve donc prévisions, implantation et quantités réellement enregistrées dans la même base." },
    { question: "Le logiciel décide-t-il automatiquement quoi planter ?", answer: "Non. Gleba organise les références et les données de la ferme ; le maraîcher garde la décision sur les espèces, volumes, dates et emplacements." },
  ]} />;
}
