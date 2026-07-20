import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Registre phytosanitaire numérique — Interventions, AMM, DAR et ZNT",
  description: "Consignez vos interventions phytosanitaires : parcelle, culture ou arbre, produit, AMM, dose, DAR, délai de rentrée, ZNT, météo et export PDF avec Gleba.",
  alternates: { canonical: "https://gleba.fr/registre-phytosanitaire" },
  openGraph: { title: "Registre phytosanitaire numérique — Gleba", description: "Saisie et export des interventions phytosanitaires de la ferme.", url: "https://gleba.fr/registre-phytosanitaire", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Registre phytosanitaire" currentPath="/registre-phytosanitaire" eyebrow="Traçabilité · AMM · DAR · ZNT" title="Un registre phytosanitaire" highlightedTitle="relié aux cultures et au verger" introduction="Gleba permet de consigner les traitements avec leur contexte agronomique, puis de retrouver et exporter les informations saisies. Le même registre couvre les interventions rattachées aux parcelles, cultures et arbres." proof="la route d'export du registre restitue notamment produit, substance active, AMM, dose, DAR, délai de rentrée, ZNT, opérateur et météo lorsqu'ils ont été renseignés." screenshot={{ src: "/screenshots/gleba-registre-phytosanitaire.png", alt: "Registre phytosanitaire réel de Gleba avec contrôle des champs manquants", caption: "Le registre de démonstration signale explicitement une fiche incomplète au lieu de présenter une conformité fictive." }} capabilities={[
    { title: "Contexte de l'intervention", description: "Rattachez la saisie à une parcelle, une planche, une culture ou un arbre selon le travail effectué." },
    { title: "Produit et usage", description: "Conservez nom commercial, substance active, numéro AMM, cible et informations d'autorisation disponibles." },
    { title: "Dose et surface", description: "Saisissez dose appliquée, unité, surface traitée et quantité utilisée." },
    { title: "Délais", description: "Renseignez le délai avant récolte et le délai de rentrée associés à l'intervention." },
    { title: "ZNT et météo", description: "Documentez les informations ZNT et les conditions météorologiques observées lors du traitement." },
    { title: "Export", description: "Générez un document PDF à partir des enregistrements conservés dans le registre." },
  ]} workflowTitle="Tracer une intervention sans double saisie" workflow={[
    { title: "Choisir la cible", description: "Sélectionnez la parcelle, la culture ou l'arbre concerné par l'intervention." },
    { title: "Documenter l'application", description: "Renseignez produit, cible, dose, surface, délais, ZNT, opérateur et météo disponibles." },
    { title: "Relire et exporter", description: "Filtrez l'historique puis produisez l'export du registre depuis les données enregistrées." },
  ]} limits="Gleba facilite la tenue et l'export du registre mais ne certifie pas à lui seul la conformité d'une exploitation. L'utilisateur reste responsable de l'exactitude des saisies, de l'autorisation du produit et des règles applicables le jour du traitement." faqs={[
    { question: "Quelles données peut-on enregistrer ?", answer: "Le registre accepte notamment date, cible, produit, substance active, AMM, dose, unité, surface, DAR, délai de rentrée, ZNT, opérateur et conditions météo." },
    { question: "Le registre couvre-t-il le maraîchage et le verger ?", answer: "Oui. Une intervention peut être rattachée aux éléments de culture et aux arbres suivis dans Gleba." },
    { question: "Peut-on exporter le registre ?", answer: "Oui. Une route dédiée génère un export PDF à partir des interventions enregistrées." },
    { question: "Gleba garantit-il la conformité réglementaire ?", answer: "Non. Le logiciel structure les informations et aide à repérer les champs manquants, mais la conformité dépend des produits, usages, règles en vigueur et saisies de l'utilisateur." },
  ]} />;
}
