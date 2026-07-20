import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Calendrier de semis — Périodes par culture et zone climatique",
  description: "Consultez les périodes de semis, plantation et récolte issues des itinéraires techniques Gleba, ajustées selon la zone climatique de l'exploitation.",
  alternates: { canonical: "https://gleba.fr/calendrier-semis" },
  openGraph: { title: "Calendrier de semis dans Gleba", description: "Semis, plantations et récoltes organisés semaine par semaine.", url: "https://gleba.fr/calendrier-semis", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Calendrier de semis" currentPath="/calendrier-semis" eyebrow="Semis · Plantations · Récoltes" title="Un calendrier de semis" highlightedTitle="relié à vos itinéraires techniques" introduction="Le calendrier de Gleba rassemble les périodes définies dans les itinéraires techniques et les restitue semaine par semaine. La zone climatique configurée peut appliquer un décalage aux références." proof="les ITP distinguent semis sous abri, en pépinière ou en pleine terre, plantation et récolte ; le calendrier lit ces données et affiche aussi le calendrier lunaire." capabilities={[
    { title: "Vue hebdomadaire", description: "Parcourez les opérations prévues semaine par semaine pour les cultures et ITP sélectionnés." },
    { title: "Modes de semis", description: "Distinguez les périodes sous abri, en pépinière et en pleine terre lorsqu'elles sont renseignées dans l'ITP." },
    { title: "Plantation et récolte", description: "Conservez dans la même référence les fenêtres de plantation et de récolte attendues." },
    { title: "Zone climatique", description: "Appliquez le décalage associé à la zone de l'exploitation, y compris les zones ultramarines présentes dans le référentiel." },
    { title: "ITP modifiables", description: "Utilisez les références disponibles ou créez un itinéraire adapté à vos propres pratiques." },
    { title: "Calendrier lunaire", description: "Affichez séparément phase lunaire et catégories biodynamiques si vous souhaitez les consulter." },
  ]} workflowTitle="Des références jusqu'au calendrier de la ferme" workflow={[
    { title: "Choisir les ITP", description: "Sélectionnez ou adaptez les itinéraires correspondant aux cultures conduites." },
    { title: "Configurer le contexte", description: "Renseignez la zone climatique et les cultures prévues pour l'exploitation." },
    { title: "Relire chaque semaine", description: "Consultez les semis, plantations et récoltes issus des dates enregistrées." },
  ]} limits="Le calendrier ne connaît pas les conditions exactes de votre sol, microclimat ou saison. Il n'envoie actuellement ni email hebdomadaire ni notification push et ne garantit aucune date de réussite." faqs={[
    { question: "Le calendrier tient-il compte de la région ?", answer: "Il applique le décalage de la zone climatique configurée. Il ne remplace pas l'ajustement local réalisé par le cultivateur." },
    { question: "Les dates peuvent-elles être modifiées ?", answer: "Oui. Les itinéraires techniques peuvent être adaptés ou créés afin de refléter les pratiques de l'exploitation." },
    { question: "Existe-t-il des notifications automatiques ?", answer: "Non. Gleba affiche les éléments dans ses calendriers et listes de tâches, mais n'envoie actuellement ni récapitulatif email hebdomadaire ni notification push de semis." },
    { question: "Le calendrier lunaire est-il obligatoire ?", answer: "Non. Il s'agit d'une vue distincte que l'utilisateur consulte ou ignore selon ses pratiques." },
  ]} />;
}
