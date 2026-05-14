"use client"

/**
 * Tour guidé pour la page d'accueil (POSTREVIEW Sprint 6).
 *
 * Steps minimaux ciblant les éléments présents sur le dashboard :
 *  - Bandeau "Premiers pas" (PROMPT 22)
 *  - Sélecteur d'année
 *  - Navigation par onglets
 *  - Raccourcis (Cmd+K)
 *
 * Démarrage automatique au premier rendu (clé localStorage
 * `gleba.tour.home.done`). Re-déclenchable via `resetTour("home")`.
 */

import { GuidedTour } from "@/components/guided-tour"
import { useIsDemoAccount } from "@/hooks/use-is-demo"

const HOME_TOUR_STEPS = [
  {
    id: "welcome",
    title: "Bienvenue sur Gleba !",
    text: "En quelques secondes, voici les points clés pour démarrer. Vous pourrez relancer ce tour à tout moment depuis /aide.",
  },
  {
    id: "premiers-pas",
    title: "Vos premiers pas",
    text: "Le bandeau ci-contre liste les actions recommandées : renseigner l'identité de l'exploitation, créer une première culture, ajouter un client. Cliquez sur une ligne pour aller au formulaire correspondant.",
    attachTo: { element: '[data-tour="premiers-pas"]', on: "bottom" as const },
  },
  {
    id: "navigation",
    title: "Naviguer entre modules",
    text: "Utilisez le menu en haut, ou les raccourcis `g` + `m / v / e / c` (Maraîchage / Verger / Élevage / Compta). La touche `?` ouvre la liste complète des raccourcis.",
  },
  {
    id: "search",
    title: "Recherche globale Cmd+K",
    text: "Appuyez sur Cmd/Ctrl + K depuis n'importe où pour rechercher une culture, un animal, une facture, un client, une parcelle — 11 entités indexées.",
  },
  {
    id: "aide",
    title: "Centre d'aide",
    text: "La page /aide contient les FAQ par module et les liens vers le glossaire, la roadmap et le feedback. Bon démarrage !",
  },
]

export function TourHome() {
  const isDemo = useIsDemoAccount()
  return <GuidedTour storageKey="home" steps={HOME_TOUR_STEPS} autoStart alwaysShow={isDemo} />
}
