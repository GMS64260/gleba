import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";
import { ogBase } from "@/lib/seo/og";

export const metadata: Metadata = {
  title: "Carnet de culture numérique pour le maraîchage",
  description: "Le cahier de culture de chaque planche tenu au fil du travail : semis, plantation, interventions, fertilisation, traitements et récoltes, imprimable par culture.",
  alternates: { canonical: "https://gleba.fr/carnet-de-culture" },
  openGraph: {
    ...ogBase,
    title: "Carnet de culture numérique — Gleba",
    description: "Semis, interventions, fertilisation, traitements et récoltes de chaque culture, réunis dans un carnet imprimable.",
    url: "https://gleba.fr/carnet-de-culture",
    type: "article",
  },
};

export default function Page() {
  return (
    <BusinessLanding
      breadcrumb="Carnet de culture"
      currentPath="/carnet-de-culture"
      eyebrow="Cahier de culture · Traçabilité · Maraîchage"
      title="Le carnet de culture"
      highlightedTitle="qui se remplit au fil du travail"
      introduction="Un carnet de culture retrace la vie de chaque culture : variété, planche, dates de semis et de plantation, interventions, fertilisation, traitements et récoltes. Dans Gleba, il n'est pas une saisie de plus en fin de saison : il se compose à partir de ce que vous notez au champ, depuis l'écran Aujourd'hui ou les fiches de culture."
      proof="l'onglet Registre de culture de la page Traçabilité compile, pour chaque culture de l'année, l'espèce, la variété, la planche, l'itinéraire technique, les dates, les interventions rattachées, les fertilisations de la planche et les récoltes ; il s'imprime ou s'enregistre en PDF depuis le navigateur."
      screenshot={{ src: "/screenshots/vitrine-carnet-culture-bureau.webp", alt: "Registre de culture de Gleba : chaque culture de l'année avec sa planche, ses dates, ses interventions et ses récoltes", caption: "Registre de culture du compte de démonstration, compilé à partir des saisies de l'année.", width: 1920, height: 847 }}
      capabilities={[
        { title: "Une fiche par culture", description: "Espèce, variété (avec la mention bio quand elle est renseignée), planche et parcelle, itinéraire technique, nombre de rangs et espacement." },
        { title: "Chronologie de la culture", description: "Semis, plantation, interventions, apports et récoltes rangés par date dans la fiche de la culture." },
        { title: "Interventions rattachées", description: "Les interventions liées à la culture, et celles faites sur la planche pendant qu'elle était en place ; pas celles des cultures qui l'ont précédée." },
        { title: "Fertilisation", description: "Les apports enregistrés dans l'année sur la planche de la culture, avec leur date et leur quantité." },
        { title: "Récoltes", description: "Chaque récolte rattachée à sa culture, avec la date et la quantité dans l'unité choisie." },
        { title: "Traitements", description: "Les traitements alimentent aussi le registre phytosanitaire, exportable en PDF et en CSV." },
      ]}
      workflowTitle="Un carnet qui se tient sans y penser"
      workflow={[
        { title: "Planifier", description: "Les cultures sont posées sur leurs planches avec leur itinéraire technique : le carnet connaît déjà leur cadre." },
        { title: "Noter au champ", description: "Semis, plantation, arrosage ou récolte se notent d'un geste depuis l'écran Aujourd'hui, sur téléphone comme sur ordinateur." },
        { title: "Relire et imprimer", description: "En fin de saison, le registre de culture rassemble l'année par culture, prêt à imprimer ou à enregistrer en PDF." },
      ]}
      limits="Le carnet de culture reflète les saisies faites dans Gleba ; il ne vaut ni certification ni contrôle. La liste des documents exigés, en agriculture biologique notamment, relève de votre organisme certificateur."
      faqs={[
        { question: "Qu'est-ce qu'un carnet de culture ?", answer: "C'est le document qui retrace chaque culture d'une exploitation : ce qui a été semé ou planté, où, quand, les interventions et apports réalisés, puis les récoltes. Il sert à relire la saison, à préparer les rotations et à répondre aux demandes de traçabilité." },
        { question: "Quelle différence avec le registre phytosanitaire ?", answer: "Le registre phytosanitaire ne recense que les traitements (produit, numéro d'AMM, dose, surface, délais). Le carnet de culture couvre toute la vie de la culture. Dans Gleba, un traitement saisi apparaît dans les deux." },
        { question: "Puis-je imprimer le carnet de culture ?", answer: "Oui. Le registre de culture s'imprime depuis la page Traçabilité, ou s'enregistre en PDF par la fonction d'impression du navigateur. Le registre phytosanitaire dispose en plus d'exports PDF et CSV dédiés." },
        { question: "Faut-il tout ressaisir en fin de saison ?", answer: "Non. Le registre est compilé à partir des cultures, interventions, fertilisations et récoltes déjà enregistrées au fil de la saison." },
        { question: "Gleba suffit-il pour la certification bio ?", answer: "Gleba conserve les informations de culture, mais ne délivre aucune certification. Vérifiez auprès de votre organisme certificateur les documents et les informations qu'il exige." },
      ]}
    />
  );
}
