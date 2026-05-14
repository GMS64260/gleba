"use client"

/**
 * Tour guidé module Élevage (POSTREVIEW Sprint 6).
 */

import { GuidedTour } from "@/components/guided-tour"
import { useIsDemoAccount } from "@/hooks/use-is-demo"

const STEPS = [
  {
    id: "elevage-intro",
    title: "Module Élevage",
    text: "Bienvenue dans le module Élevage. Suivi animaux, lots, production (œufs, lait, viande), reproduction, soins et registres réglementaires.",
  },
  {
    id: "elevage-identifiants",
    title: "Identifiants réglementaires",
    text: "Chaque animal a un identifiant typé (BDNI bovin, IPG ovin/caprin, SIRE équin, Puce RFID…) validé par regex à la saisie. Le registre d'élevage PDF (arrêté 5 juin 2000) est exportable.",
  },
  {
    id: "elevage-lait",
    title: "Production laitière",
    text: "Le sous-onglet Lait propose une saisie biquotidienne (Matin/Soir), une courbe de lactation 305 jours et la traçabilité descendante animal → collecte → lot fromage → vente.",
  },
  {
    id: "elevage-soins",
    title: "Soins & temps d'attente",
    text: "À l'application d'un soin avec produit véto, les collectes de lait dans la fenêtre temps d'attente sont automatiquement écartées. L'abattage est refusé si un soin est en cours d'attente viande.",
  },
  {
    id: "elevage-saillies",
    title: "Reproduction",
    text: "La saisie d'une saillie calcule la date de mise-bas attendue selon l'espèce, alerte sur la consanguinité (3 générations) et permet le carnet de saillies PDF exigible en contrôle bovin.",
  },
]

export function TourElevage() {
  const isDemo = useIsDemoAccount()
  return <GuidedTour storageKey="elevage" steps={STEPS} autoStart alwaysShow={isDemo} />
}
