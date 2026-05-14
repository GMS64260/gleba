"use client"

/**
 * Tour guidé module Verger & Forêt (POSTREVIEW Sprint 6).
 */

import { GuidedTour } from "@/components/guided-tour"
import { useIsDemoAccount } from "@/hooks/use-is-demo"

const STEPS = [
  {
    id: "verger-intro",
    title: "Module Verger & Forêt",
    text: "Bienvenue dans le module Verger. Vous y gérez vos arbres fruitiers, agroforesterie, haies bocagères et campagnes de plantation forestières.",
  },
  {
    id: "verger-arbres",
    title: "Catalogue d'arbres",
    text: "Chaque arbre a son GPS, sa variété, son porte-greffe et son organisme certificateur AB le cas échéant. Le QR code (bouton « Étiquette ») produit un PDF A6 plastifiable.",
  },
  {
    id: "verger-pollinisation",
    title: "Pollinisation",
    text: "Gleba détecte automatiquement les variétés triploïdes (Belle de Boskoop, Reinette du Canada, Jonagold, Bramley, Mutsu) qui nécessitent 2 pollinisateurs diploïdes compatibles à moins de 30 m.",
  },
  {
    id: "verger-cohortes",
    title: "Cohortes de plantation",
    text: "Les campagnes de plantation (/verger/plantations) suivent le taux de reprise à N+1, N+2, N+3. Si < 90 %, un regarnissage est suggéré automatiquement.",
  },
  {
    id: "verger-sante",
    title: "Santé phyto & bioagresseurs",
    text: "L'onglet Santé liste les observations (BBCH, photos), les bioagresseurs par espèce avec méthodes PBI, et le registre phyto réglementaire.",
  },
]

export function TourVerger() {
  const isDemo = useIsDemoAccount()
  return <GuidedTour storageKey="verger" steps={STEPS} autoStart alwaysShow={isDemo} />
}
