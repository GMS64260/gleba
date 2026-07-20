import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Logiciel d'élevage de volailles — Ponte, lots, soins et coûts",
  description: "Suivez poules et volailles par animal ou par lot : ponte, alimentation, soins, reproduction, naissances, mortalité et coûts dans Gleba.",
  alternates: { canonical: "https://gleba.fr/logiciel-elevage-volailles" },
  openGraph: { title: "Logiciel de gestion d'élevage de volailles — Gleba", description: "Lots, ponte, alimentation, soins, reproduction et coûts.", url: "https://gleba.fr/logiciel-elevage-volailles", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Logiciel d'élevage de volailles" currentPath="/logiciel-elevage-volailles" eyebrow="Volailles · Ponte · Suivi sanitaire" title="Suivez votre élevage de volailles" highlightedTitle="du lot jusqu'au coût de production" introduction="Gleba réunit le cheptel, les lots, la ponte, l'alimentation, les soins, la reproduction et les événements d'élevage. Les saisies peuvent porter sur un animal identifié ou sur un lot, selon l'organisation de la ferme." proof="les écrans Animaux, Production, Alimentation, Soins et Reproduction utilisent des routes et modèles dédiés déjà présents dans l'application." screenshot={{ src: "/screenshots/gleba-gestion-elevage.png", alt: "Suivi réel d'un élevage de volailles dans Gleba", caption: "Le tableau de bord Élevage du compte de démonstration, sans maquette ni fonctionnalité fictive." }} capabilities={[
    { title: "Animaux et lots", description: "Créez des animaux identifiés ou des lots avec espèce, race, effectif, provenance, statut et parcelle." },
    { title: "Suivi de ponte", description: "Enregistrez les œufs produits, les œufs cassés, la date et le lot ou l'animal concerné." },
    { title: "Alimentation", description: "Consignez achats, distributions et stocks d'aliments pour suivre les quantités et les dépenses." },
    { title: "Soins et traitements", description: "Conservez les soins réalisés ou prévus, leur type, leur date, leur description et l'animal ou le lot ciblé." },
    { title: "Reproduction et naissances", description: "Suivez reproducteurs, événements de reproduction, naissances, mère et père connu ou identifié." },
    { title: "Indicateurs", description: "Le tableau de bord restitue notamment la production d'œufs et la répartition du cheptel à partir des données saisies." },
  ]} workflowTitle="Un journal d'élevage utilisable au quotidien" workflow={[
    { title: "Structurer le cheptel", description: "Ajoutez les lots et, lorsque nécessaire, les animaux suivis individuellement." },
    { title: "Saisir les événements", description: "Notez ponte, alimentation, soins, reproduction, naissances, entrées et sorties." },
    { title: "Relire les résultats", description: "Consultez l'historique et les indicateurs calculés à partir de vos propres saisies." },
  ]} limits="Gleba n'est pas connecté aux bases réglementaires nationales, aux lecteurs de boucles ou aux automates de bâtiment. Il ne promet pas une déclaration administrative automatique." faqs={[
    { question: "Peut-on suivre les poules par lot ?", answer: "Oui. La gestion par lot est prévue pour les effectifs suivis collectivement, avec production, alimentation et soins rattachables au lot." },
    { question: "Le suivi individuel est-il possible ?", answer: "Oui. Un animal peut avoir son identifiant, sa race, son sexe, ses parents, son statut sanitaire, son poids et son historique." },
    { question: "Gleba calcule-t-il la ponte ?", answer: "Gleba enregistre les productions quotidiennes et affiche des synthèses à partir des quantités saisies. Il ne compte pas automatiquement les œufs avec une caméra ou un capteur." },
    { question: "Le logiciel effectue-t-il les déclarations réglementaires ?", answer: "Non. Les données peuvent servir au suivi interne, mais Gleba ne transmet actuellement aucune déclaration à une base administrative nationale." },
  ]} />;
}
