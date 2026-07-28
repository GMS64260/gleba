import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Logiciel d'élevage de volailles — Ponte, lots, soins et coûts",
  description: "Suivez poules et volailles par animal ou lot : ponte, alimentation, traitements, reproduction, naissances, mortalité, stocks et coûts dans Gleba.",
  alternates: { canonical: "https://gleba.fr/logiciel-elevage-volailles" },
  openGraph: { title: "Logiciel de gestion d'élevage de volailles — Gleba", description: "Lots, ponte, alimentation, soins, reproduction et coûts.", url: "https://gleba.fr/logiciel-elevage-volailles", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Logiciel d'élevage de volailles" currentPath="/logiciel-elevage-volailles" eyebrow="Lots · Ponte · Aliments · Suivi sanitaire" title="Suivez votre élevage de volailles" highlightedTitle="du lot jusqu'au coût de production" introduction="Gleba réunit cheptel, lots, ponte, stocks d'aliments, soins, reproduction et événements d'élevage. Les saisies portent sur un animal identifié ou sur un lot, et les indicateurs œufs ne s'affichent que lorsqu'une activité de ponte existe." proof="la collecte d'œufs, les stocks, les traitements planifiés ou réalisés et les indicateurs de ponte reposent sur des données distinctes ; le dashboard évite de compter ou d'afficher plusieurs fois la même production." screenshot={{ src: "/screenshots/gleba-gestion-elevage.png", alt: "Suivi réel d'un élevage de volailles dans Gleba", caption: "Le tableau de bord Élevage du compte de démonstration, sans maquette ni fonctionnalité fictive." }} capabilities={[
    { title: "Animaux et lots", description: "Créez des animaux identifiés ou des lots avec espèce, race, effectif, provenance, statut et parcelle." },
    { title: "Suivi de ponte", description: "Enregistrez les œufs produits, les œufs cassés, la date et le lot ou l'animal concerné." },
    { title: "Alimentation", description: "Consignez achats, distributions et stocks d'aliments pour suivre les quantités et les dépenses." },
    { title: "Soins et traitements", description: "Planifiez ou réalisez les soins d'un animal ou lot et suivez séparément chaque administration d'un protocole." },
    { title: "Reproduction et naissances", description: "Suivez reproducteurs, événements de reproduction, naissances, mère et père connu ou identifié." },
    { title: "Indicateurs sans doublon", description: "Le tableau de bord restitue production, stock et collecte mensuelle d'œufs sans répéter la même quantité dans plusieurs agrégats." },
    { title: "Registres et inventaire", description: "Exportez l'inventaire du cheptel et les registres constitués à partir des animaux, lots et soins enregistrés." },
  ]} workflowTitle="Un journal d'élevage utilisable au quotidien" workflow={[
    { title: "Structurer le cheptel", description: "Ajoutez les lots et, lorsque nécessaire, les animaux suivis individuellement." },
    { title: "Saisir les événements", description: "Notez ponte, alimentation, soins, reproduction, naissances, entrées et sorties." },
    { title: "Relire les résultats", description: "Consultez l'historique et les indicateurs calculés à partir de vos propres saisies." },
  ]} limits="Gleba n'est pas connecté aux bases réglementaires nationales, aux lecteurs de boucles ou aux automates de bâtiment. Il ne promet pas une déclaration administrative automatique." faqs={[
    { question: "Peut-on suivre les poules par lot ?", answer: "Oui. La gestion par lot est prévue pour les effectifs suivis collectivement, avec production, alimentation et soins rattachables au lot." },
    { question: "Le suivi individuel est-il possible ?", answer: "Oui. Un animal peut avoir son identifiant, sa race, son sexe, ses parents, son statut sanitaire, son poids et son historique." },
    { question: "Gleba calcule-t-il la ponte ?", answer: "Gleba enregistre les productions quotidiennes et affiche des synthèses à partir des quantités saisies. Il ne compte pas automatiquement les œufs avec une caméra ou un capteur." },
    { question: "Les stocks d'œufs et d'aliments sont-ils séparés ?", answer: "Oui. La production d'œufs, le stock disponible et les mouvements ou distributions d'aliments sont suivis par des données dédiées." },
    { question: "Peut-on suivre un traitement à plusieurs administrations ?", answer: "Oui. Chaque injection ou administration planifiée peut être réalisée, annulée ou rouverte séparément dans le suivi sanitaire." },
    { question: "Le logiciel effectue-t-il les déclarations réglementaires ?", answer: "Non. Les données peuvent servir au suivi interne, mais Gleba ne transmet actuellement aucune déclaration à une base administrative nationale." },
  ]} />;
}
