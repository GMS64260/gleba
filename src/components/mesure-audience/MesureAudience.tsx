"use client"

/**
 * Mesure d'audience Matomo auto-hébergée (stats.synalto.eu, site 4), sans cookie,
 * IP raccourcies : configuration exemptée de consentement (CNIL, décision de
 * Guillaume du 2026-11-09). Elle ne porte que sur les pages publiques consultées
 * SANS session : rien n'est mesuré dans l'application connectée, et l'accueil
 * réécrit en tableau de bord pour un utilisateur connecté n'est jamais compté.
 * Les chemins porteurs de jetons (réinitialisation, désabonnement, retour
 * d'expérience, consultation admin) sont exclus. Un refus explicite de la case
 * « Mesure d'audience » du bandeau cookies vaut opposition.
 */

import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useEffect, useRef } from "react"

const MATOMO = "https://stats.synalto.eu/"
const ID_SITE = "4"

const PAGES_MESUREES = [
  "/login", "/register", "/mot-de-passe-oublie",
  "/communaute", "/referentiel", "/glossaire", "/licence",
  "/cgv", "/mentions-legales", "/confidentialite", "/tarifs", "/conditions-service",
  "/suppression-compte",
  "/logiciel-maraichage", "/logiciel-micro-ferme", "/logiciel-permaculture",
  "/logiciel-verger", "/logiciel-elevage", "/calendrier-semis",
  "/assistant-ia-agricole", "/logiciel-arboriculture",
  "/logiciel-elevage-volailles", "/planification-maraichage",
  "/logiciel-elevage-ovin", "/logiciel-elevage-caprin",
  "/logiciel-elevage-canin-felin", "/logiciel-elevage-equin",
  "/logiciel-elevage-nac",
  "/rotation-cultures-maraichage", "/itineraire-technique-maraichage",
  "/registre-phytosanitaire",
  "/logiciel-potager",
  "/carnet-de-culture", "/plan-de-ferme",
  "/registre-phytosanitaire-numerique", "/comparatif-logiciels-maraichage",
]

export function estPageMesuree(chemin: string): boolean {
  if (chemin === "/") return true
  if (/^\/boutique\/[^/]+/.test(chemin)) return true
  return PAGES_MESUREES.some((page) => chemin === page || chemin.startsWith(page + "/"))
}

function refusExplicite(): boolean {
  try {
    const choix = JSON.parse(localStorage.getItem("gleba-cookie-consent") || "null")
    return choix?.analytics === false
  } catch {
    return false
  }
}

type FileMatomo = unknown[][]

export function MesureAudience() {
  const chemin = usePathname()
  const { status } = useSession()
  const charge = useRef(false)

  useEffect(() => {
    if (status !== "unauthenticated" || !chemin || !estPageMesuree(chemin) || refusExplicite()) return
    const fenetre = window as unknown as { _paq?: FileMatomo }
    const paq = (fenetre._paq = fenetre._paq || [])
    if (!charge.current) {
      charge.current = true
      paq.push(["disableCookies"])
      paq.push(["setTrackerUrl", `${MATOMO}matomo.php`])
      paq.push(["setSiteId", ID_SITE])
      const script = document.createElement("script")
      script.async = true
      script.src = `${MATOMO}matomo.js`
      document.head.appendChild(script)
    }
    // Adresse sans paramètres ni fragment.
    paq.push(["setCustomUrl", `${window.location.origin}${chemin}`])
    paq.push(["setDocumentTitle", document.title])
    paq.push(["trackPageView"])
  }, [chemin, status])

  return null
}
