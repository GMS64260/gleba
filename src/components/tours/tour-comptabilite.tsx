"use client"

/**
 * Tour guidé module Comptabilité (POSTREVIEW Sprint 6).
 */

import { GuidedTour } from "@/components/guided-tour"
import { useIsDemoAccount } from "@/hooks/use-is-demo"

const STEPS = [
  {
    id: "compta-intro",
    title: "Module Comptabilité",
    text: "Bienvenue dans le module Comptabilité. Factures conformes, déclaration TVA CA3, export FEC, suivi clients & fournisseurs.",
  },
  {
    id: "compta-exploitation",
    title: "Identité de l'exploitation",
    text: "Avant d'émettre des factures, renseignez Paramètres > Exploitation (SIRET validé Luhn, régime fiscal, mentions obligatoires art. 242 nonies A CGI).",
  },
  {
    id: "compta-factures",
    title: "Factures",
    text: "La numérotation est continue, garantie par lock SQL FOR UPDATE. Le PDF intègre les mentions légales (293 B, pénalités, indemnité 40 €). Une facture émise ne peut être supprimée, seulement annulée (avoir).",
  },
  {
    id: "compta-tva",
    title: "Déclaration TVA",
    text: "Rapports & TVA permet de pré-remplir la déclaration CA3 (formulaire 3310-CA3) en PDF ou CSV, à recopier sur impots.gouv.fr.",
  },
  {
    id: "compta-fec",
    title: "Export FEC",
    text: "L'export FEC (Comptabilité > Export FEC) génère un fichier conforme arrêté du 29/07/2013, exigible en contrôle fiscal. Le validateur intégré vérifie l'équilibre Débit = Crédit.",
  },
]

export function TourComptabilite() {
  const isDemo = useIsDemoAccount()
  return <GuidedTour storageKey="comptabilite" steps={STEPS} autoStart alwaysShow={isDemo} />
}
