"use client"

/**
 * Tour guidé module Maraîchage (POSTREVIEW Sprint 6).
 *
 * Démarrage automatique au premier passage sur le module ; re-déclenchable
 * via `resetTour("maraichage")` depuis /aide.
 */

import { GuidedTour } from "@/components/guided-tour"

const STEPS = [
  {
    id: "maraichage-intro",
    title: "Module Maraîchage",
    text: "Bienvenue dans le module Maraîchage. Il regroupe vos planches, cultures, ITPs, rotations, semences et récoltes.",
  },
  {
    id: "maraichage-cultures",
    title: "Cultures",
    text: "Depuis /maraichage/cultures vous suivez chaque culture (semis → plantation → récolte). Le choix d'un ITP pré-remplit automatiquement les dates par semaine ISO.",
  },
  {
    id: "maraichage-planches",
    title: "Plan du jardin",
    text: "Le plan 2D (/jardin) place vos planches géographiquement. Cliquez sur une planche pour voir les cultures actives et les alertes d'association compagnon/incompatible.",
  },
  {
    id: "maraichage-calendrier",
    title: "Calendrier hebdomadaire",
    text: "Sur la page d'accueil, le calendrier liste les semis, plantations et récoltes de la semaine. Le bouton « Tout fait » coche d'un coup plusieurs tâches.",
  },
  {
    id: "maraichage-rotations",
    title: "Rotations",
    text: "Le module Rotations (/maraichage/rotations) vous aide à respecter les retours minimaux par famille botanique (Solanacées, Brassicacées, etc.).",
  },
]

export function TourMaraichage() {
  return <GuidedTour storageKey="maraichage" steps={STEPS} autoStart />
}
