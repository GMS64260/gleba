import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Logiciel d'élevage caprin — Chèvres, lait et reproduction",
  description: "Gérez chèvres et boucs : identification, races, généalogie, saillies, chevreaux, soins, alimentation, collectes de lait et lots de fromage.",
  alternates: { canonical: "https://gleba.fr/logiciel-elevage-caprin" },
  openGraph: { title: "Logiciel de gestion d'élevage caprin — Gleba", description: "Troupeau caprin, reproduction, lait, soins et lots de fromage.", url: "https://gleba.fr/logiciel-elevage-caprin", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Logiciel d'élevage caprin" currentPath="/logiciel-elevage-caprin" eyebrow="Caprins · Lait · Reproduction" title="Suivez votre élevage caprin" highlightedTitle="du troupeau jusqu'aux collectes de lait" introduction="Gleba relie les chèvres, boucs et lots à la reproduction, aux naissances, aux soins, à l'alimentation et aux mouvements. Pour l'atelier laitier, les traites et les lots de fabrication fromagère disposent de données dédiées." proof="le référentiel de production contient notamment les chèvres Alpine, Poitevine, Saanen et du Rove ; les routes Collectes de lait, Lactation, Lots de fromage et Étiquette complètent les écrans communs du troupeau." screenshot={{ src: "/screenshots/gleba-gestion-troupeau.png", alt: "Chèvres Alpine suivies dans la liste des animaux de Gleba", caption: "Capture authentique du compte démo avec plusieurs chèvres Alpine identifiées et leur race." }} capabilities={[
    { title: "Chèvres et lots", description: "Suivez chaque caprin identifié ou utilisez des lots avec espèce, race, effectif, statut et parcelle." },
    { title: "Généalogie", description: "Rattachez les parents connus et conservez les liens utiles à la lecture de l'ascendance enregistrée." },
    { title: "Saillies et mises bas", description: "Consignez type de monte, reproducteurs, confirmation, mise bas attendue, tarissement prévu et naissance liée." },
    { title: "Soins et alimentation", description: "Enregistrez les soins, traitements, produits vétérinaires et distributions d'aliments du troupeau." },
    { title: "Collectes de lait", description: "Saisissez date, traite, quantité, animal ou lot, analyses éventuelles et lait écarté pendant un délai d'attente." },
    { title: "Lots de fromage", description: "Créez un lot de fabrication avec numéro, date, type, lait utilisé, pièces, poids et étiquette générée." },
  ]} workflowTitle="Relier le troupeau caprin à la production laitière" workflow={[
    { title: "Identifier", description: "Créez les chèvres, boucs et lots avec leurs races et informations réellement connues." },
    { title: "Suivre", description: "Saisissez reproduction, naissances, soins, alimentation, mouvements et traites." },
    { title: "Tracer la fabrication", description: "Affectez les collectes disponibles à un lot de fromage et conservez ses caractéristiques." },
  ]} limits="Gleba ne commande aucun équipement de traite, ne formule pas les rations et ne transmet pas les déclarations réglementaires. La fiche et l'étiquette d'un lot de fromage ne constituent pas une validation sanitaire ou commerciale automatique." faqs={[
    { question: "Quelles races caprines sont déjà référencées ?", answer: "Le référentiel de production comprend notamment Alpine chamoisée, Poitevine, Saanen et chèvre du Rove. Le catalogue peut être enrichi dans Gleba." },
    { question: "Peut-on suivre les traites ?", answer: "Oui. Une collecte enregistre la date, le moment de traite, les litres et l'animal ou le lot. Des analyses facultatives et le lait écarté peuvent aussi être notés." },
    { question: "La fabrication fromagère est-elle présente ?", answer: "Oui. Gleba gère des lots de fromage et peut leur rattacher des collectes de lait, puis générer une étiquette à partir des données saisies." },
    { question: "Le logiciel se connecte-t-il à une machine à traire ?", answer: "Non. Les données sont saisies dans Gleba ; aucune connexion automatique à une machine à traire n'est actuellement proposée." },
  ]} />;
}
