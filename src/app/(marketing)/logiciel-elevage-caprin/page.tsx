import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Logiciel d'élevage caprin — Chèvres, soins et lait",
  description: "Gérez chèvres et boucs : boucles, lots, généalogie, mises bas détaillées, injections, délais d'attente, lait, fromages et registres avec Gleba.",
  alternates: { canonical: "https://gleba.fr/logiciel-elevage-caprin" },
  openGraph: { title: "Logiciel de gestion d'élevage caprin — Gleba", description: "Troupeau caprin, boucles, mises bas, soins tracés, lait, fromages et registres.", url: "https://gleba.fr/logiciel-elevage-caprin", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Logiciel d'élevage caprin" currentPath="/logiciel-elevage-caprin" eyebrow="Boucles · Mises bas · Soins · Lait" title="Suivez votre élevage caprin" highlightedTitle="du troupeau jusqu'aux collectes de lait" introduction="Gleba relie chèvres, boucs et lots à l'identification, la reproduction, aux naissances détaillées, aux soins, à l'alimentation et aux mouvements. Pour l'atelier laitier, les traites, délais d'attente et lots de fabrication fromagère disposent de données dédiées." proof="la recherche fonctionne par numéro de boucle ou nom, chaque cabri d'une portée peut être décrit séparément, les injections sont acquittées une par une et les registres d'élevage, sanitaire et d'inventaire sont exportables depuis l'application." screenshot={{ src: "/screenshots/gleba-gestion-troupeau.png", alt: "Chèvres Alpine suivies dans la liste des animaux de Gleba", caption: "Capture authentique du compte démo avec plusieurs chèvres Alpine identifiées et leur race." }} capabilities={[
    { title: "Boucles, chèvres et lots", description: "Recherchez un caprin par numéro de boucle ou nom, suivez-le individuellement ou rattachez-le à un lot actif." },
    { title: "Généalogie", description: "Rattachez les parents connus et conservez les liens utiles à la lecture de l'ascendance enregistrée." },
    { title: "Saillies et mises bas", description: "Consignez monte, reproducteurs, confirmation, mise bas attendue et naissance ; détaillez chaque cabri avec sexe, boucles, mode d'élevage, poids et état." },
    { title: "Traitements tracés", description: "Planifiez un protocole puis acquittez chaque injection séparément avec date, dose, voie, produit et vétérinaire." },
    { title: "Collectes et délais d'attente", description: "Saisissez traite, litres et analyses ; Gleba écarte le lait concerné et affiche les dates prudentes de remise en vente." },
    { title: "Lots de fromage", description: "Créez un lot de fabrication avec numéro, date, type, lait utilisé, pièces, poids et étiquette générée." },
    { title: "Documents d'élevage", description: "Exportez inventaire du cheptel, registre chronologique, registre sanitaire et suivi des produits vétérinaires saisis." },
  ]} workflowTitle="Relier le troupeau caprin à la production laitière" workflow={[
    { title: "Identifier", description: "Créez les chèvres, boucs et lots avec leurs races et informations réellement connues." },
    { title: "Suivre", description: "Saisissez reproduction, naissances, soins, alimentation, mouvements et traites." },
    { title: "Tracer la fabrication", description: "Affectez les collectes disponibles à un lot de fromage et conservez ses caractéristiques." },
  ]} limits="Gleba ne commande aucun équipement de traite, ne formule pas les rations et ne transmet pas les déclarations réglementaires. La fiche et l'étiquette d'un lot de fromage ne constituent pas une validation sanitaire ou commerciale automatique." faqs={[
    { question: "Quelles races caprines sont déjà référencées ?", answer: "Le référentiel de production comprend notamment Alpine chamoisée, Poitevine, Saanen et chèvre du Rove. Le catalogue peut être enrichi dans Gleba." },
    { question: "Peut-on suivre les traites ?", answer: "Oui. Une collecte enregistre la date, le moment de traite, les litres et l'animal ou le lot. Des analyses facultatives et le lait écarté peuvent aussi être notés." },
    { question: "La fabrication fromagère est-elle présente ?", answer: "Oui. Gleba gère des lots de fromage et peut leur rattacher des collectes de lait, puis générer une étiquette à partir des données saisies." },
    { question: "Peut-on détailler chaque chevreau d'une portée ?", answer: "Oui. Chaque petit peut avoir son sexe, ses boucles provisoire et définitive, son mode d'élevage, son poids et son état. Une fiche animale individuelle peut ensuite être créée pour les petits vivants." },
    { question: "Les traitements à plusieurs injections sont-ils tracés ?", answer: "Oui. Les administrations d'un protocole sont suivies séparément. Les délais lait et viande sont recalculés à partir des injections réalisées et des informations du produit saisi." },
    { question: "Quels documents peut-on exporter ?", answer: "Gleba génère notamment un inventaire du cheptel, un registre d'élevage et un registre sanitaire à partir des données enregistrées. Leur contenu reste à vérifier et compléter selon les obligations de l'exploitation." },
    { question: "Le logiciel se connecte-t-il à une machine à traire ?", answer: "Non. Les données sont saisies dans Gleba ; aucune connexion automatique à une machine à traire n'est actuellement proposée." },
  ]} />;
}
