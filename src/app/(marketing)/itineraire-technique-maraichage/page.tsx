import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Itinéraire technique maraîcher — Semis, plantation et récolte",
  description: "Créez et adaptez des itinéraires techniques : périodes, démarrage, durée, densité, espacements et zone climatique pour planifier les cultures dans Gleba.",
  alternates: { canonical: "https://gleba.fr/itineraire-technique-maraichage" },
  openGraph: { title: "Itinéraires techniques de maraîchage — Gleba", description: "ITP, calendrier, zone climatique, semis, plantation et récolte.", url: "https://gleba.fr/itineraire-technique-maraichage", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Itinéraire technique maraîcher" currentPath="/itineraire-technique-maraichage" eyebrow="ITP · Calendrier · Climat" title="Transformez vos itinéraires techniques" highlightedTitle="en dates et cultures planifiées" introduction="Un itinéraire technique de Gleba décrit la conduite d'une culture : mode de démarrage, semaines de semis, plantation et récolte, durée, densité et espacements disponibles. Ces données servent ensuite à calculer les dates d'une culture planifiée." proof="les écrans ITP, calendrier annuel et assistant de création de culture lisent les mêmes données ; l'utilisateur peut sélectionner une référence, la modifier ou créer son propre itinéraire." screenshot={{ src: "/screenshots/gleba-calendrier-lunaire.png", alt: "Calendrier annuel réel des itinéraires techniques dans Gleba", caption: "Calendrier des ITP du compte démo : zone climatique, réglage de précocité, semis, croissance et récolte." }} capabilities={[
    { title: "Périodes culturales", description: "Renseignez les semaines de semis, plantation, début et fin de récolte prévues dans l'itinéraire." },
    { title: "Mode de démarrage", description: "Distinguez semis direct, pépinière, plantation et conditions de conduite lorsqu'elles sont renseignées." },
    { title: "Densité et espacements", description: "Conservez nombre de rangs, distance entre plants et paramètres utilisés pour préparer la culture." },
    { title: "Zone climatique", description: "Utilisez un itinéraire rattaché à une zone ou appliquez le décalage prévu pour les références métropolitaines compatibles." },
    { title: "Calendrier annuel", description: "Visualisez sur une frise les périodes de semis, croissance et récolte des itinéraires disponibles." },
    { title: "Création de culture", description: "Préremplissez dates et paramètres depuis l'ITP sélectionné, avec possibilité de décalage ou de saisie manuelle." },
  ]} workflowTitle="Passer d'une référence à une culture de la ferme" workflow={[
    { title: "Choisir ou créer", description: "Sélectionnez l'itinéraire de l'espèce ou créez une variante correspondant à vos pratiques." },
    { title: "Adapter les paramètres", description: "Vérifiez zone, semaines, durée, densité et espacements réellement applicables." },
    { title: "Planifier la culture", description: "Utilisez l'ITP pour calculer les dates, puis modifiez manuellement ce qui doit l'être pour la série concernée." },
  ]} limits="Un ITP est une référence de planification, pas une prescription agronomique universelle. Les dates calculées ne connaissent pas tous les aléas de la parcelle ou de la saison et ne garantissent ni levée, ni récolte, ni rendement." faqs={[
    { question: "Que signifie ITP dans Gleba ?", answer: "ITP signifie itinéraire technique de production. Il sert de modèle réutilisable pour les dates et paramètres d'une culture." },
    { question: "Peut-on créer son propre itinéraire ?", answer: "Oui. L'utilisateur peut créer ou adapter un ITP afin de refléter ses pratiques plutôt que de conserver uniquement les références disponibles." },
    { question: "Les dates sont-elles calculées automatiquement ?", answer: "Gleba peut calculer les dates d'une culture depuis les semaines de l'ITP et un décalage choisi. L'utilisateur peut aussi passer en saisie manuelle." },
    { question: "La zone climatique est-elle prise en compte ?", answer: "Oui, selon le type de référence : les ITP dédiés sont filtrés par zone et les références métropolitaines compatibles peuvent recevoir le décalage climatique configuré." },
  ]} />;
}
