import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Rotation des cultures en maraîchage — Cycles et planches",
  description: "Créez des rotations pluriannuelles, associez chaque année à un itinéraire technique et affectez les cycles aux planches avec Gleba.",
  alternates: { canonical: "https://gleba.fr/rotation-cultures-maraichage" },
  openGraph: { title: "Gestion des rotations de cultures maraîchères — Gleba", description: "Cycles pluriannuels, ITP, planches et historique des cultures.", url: "https://gleba.fr/rotation-cultures-maraichage", type: "article" },
};

export default function Page() {
  return <BusinessLanding breadcrumb="Rotation des cultures" currentPath="/rotation-cultures-maraichage" eyebrow="Rotations · Planches · ITP" title="Organisez vos rotations de cultures" highlightedTitle="sur plusieurs années et par planche" introduction="Dans Gleba, une rotation décrit une succession annuelle d'itinéraires techniques. Elle peut ensuite être affectée aux planches concernées afin de relier le cycle prévu à l'historique des cultures de la ferme." proof="l'écran Rotations affiche le nombre d'années, le plan de rotation, les planches rattachées et le statut actif, incomplet ou non appliqué ; l'ajout, l'édition, la suppression et l'export sont déjà disponibles." screenshot={{ src: "/screenshots/gleba-rotations-maraichage.png", alt: "Écran réel des rotations de cultures maraîchères dans Gleba", caption: "Rotations de trois et quatre ans du compte démo, avec cultures successives et nombre de planches affectées." }} capabilities={[
    { title: "Cycles pluriannuels", description: "Définissez le nombre d'années du cycle et nommez la rotation selon l'organisation de la ferme." },
    { title: "Une étape par année", description: "Associez chaque année à un itinéraire technique et à la culture qu'il décrit." },
    { title: "Affectation aux planches", description: "Rattachez une rotation aux planches où elle doit être utilisée et visualisez le nombre d'affectations." },
    { title: "Statuts explicites", description: "Repérez une rotation active, incomplète ou active sans planche afin de corriger sa configuration." },
    { title: "Historique de culture", description: "Les cultures réellement enregistrées sur les planches restent consultables avec leurs dates et familles." },
    { title: "Export", description: "Exportez la liste des rotations depuis l'écran de gestion disponible dans le module Maraîchage." },
  ]} workflowTitle="Construire une rotation sans masquer les choix agronomiques" workflow={[
    { title: "Créer le cycle", description: "Choisissez sa durée et ajoutez l'itinéraire prévu pour chaque année." },
    { title: "Affecter les surfaces", description: "Sélectionnez les planches qui suivent ce cycle dans leur fiche de rotation." },
    { title: "Contrôler la configuration", description: "Relisez le statut, les étapes et les affectations avant d'utiliser la rotation pour la planification." },
  ]} limits="Gleba structure et visualise les successions choisies par le maraîcher. Il ne garantit ni l'effet agronomique d'une rotation, ni l'absence de maladie, ni le rendement futur ; les familles, délais et contraintes restent à valider selon le terrain." faqs={[
    { question: "Une rotation peut-elle durer plusieurs années ?", answer: "Oui. Le cycle comporte un nombre d'années et chaque étape annuelle peut référencer un itinéraire technique différent." },
    { question: "Peut-on appliquer une rotation à plusieurs planches ?", answer: "Oui. Une même rotation peut être rattachée à plusieurs planches. L'écran signale aussi les rotations actives qui ne sont encore appliquées à aucune planche." },
    { question: "Gleba choisit-il automatiquement la meilleure rotation ?", answer: "Non. Le logiciel enregistre, affecte et contrôle la cohérence de configuration du cycle ; la succession agronomique reste décidée par l'utilisateur." },
    { question: "L'historique réel est-il conservé ?", answer: "Oui. Les cultures saisies restent liées aux planches et permettent de relire ce qui a réellement été cultivé, indépendamment du cycle prévu." },
  ]} />;
}
