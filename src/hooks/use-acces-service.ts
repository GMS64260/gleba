"use client"
import { useEffect, useState, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import type { AccesService } from "@/lib/abonnement/politique"
export interface EtatServiceClient {
  acces: AccesService
  actif: boolean
  paiementDisponible: boolean
  peutGerer: boolean
  contratEnCours: boolean
  compteFacturation: boolean
  annulationAuTerme: boolean
  prochainContrat: { programme: boolean } | null
}
const caches = new Map<string, { date: number; valeur: EtatServiceClient }>()
const requetes = new Map<string, Promise<EtatServiceClient>>()
let revision = 0
let abonnes = 0
const EVENEMENT = "gleba:abonnement-change"
export function invaliderAccesService() { revision++; caches.clear(); requetes.clear(); window.dispatchEvent(new Event(EVENEMENT)) }
export function useAccesService() {
  const { data: session } = useSession()
  const acteur = session?.user?.id
  const identite = useRef(acteur)
  identite.current = acteur
  const sequence = useRef(0)
  const [etat, setEtat] = useState<EtatServiceClient | null>(null)
  const [erreur, setErreur] = useState(false)
  const charger = useCallback(async () => {
    if (!acteur) { setEtat(null); return }
    const tour = ++sequence.current
    const version = revision
    try {
      const cache = caches.get(acteur)
      if (cache && Date.now() - cache.date < 30000) { setEtat(cache.valeur); return }
      let requete = requetes.get(acteur)
      if (!requete) {
        requete = fetch("/api/abonnement", { cache: "no-store" }).then(async r => {
          if (!r.ok) throw new Error("Droits indisponibles")
          return r.json() as Promise<EtatServiceClient>
        })
        requetes.set(acteur, requete)
      }
      const valeur = await requete
      if (identite.current !== acteur || tour !== sequence.current || version !== revision) return
      caches.set(acteur, { date: Date.now(), valeur }); setEtat(valeur); setErreur(false)
    } catch { if (identite.current === acteur && tour === sequence.current) setErreur(true) } finally { if (version === revision) requetes.delete(acteur) }
  }, [acteur])
  const annulerChargement = useCallback(() => { sequence.current++ }, [])
  useEffect(() => {
    setEtat(null)
    void charger()
    const refresh = () => { if (acteur) caches.delete(acteur); void charger() }
    const intervalle = window.setInterval(refresh, 30000)
    window.addEventListener(EVENEMENT, refresh)
    if (abonnes++ === 0) window.addEventListener("gleba:exploitation-changee", invaliderAccesService)
    return () => { annulerChargement(); clearInterval(intervalle); window.removeEventListener(EVENEMENT, refresh); if (--abonnes === 0) window.removeEventListener("gleba:exploitation-changee", invaliderAccesService) }
  }, [charger, acteur, annulerChargement])
  return { etat, acces: etat?.acces ?? null, erreur, rafraichir: () => { if (acteur) caches.delete(acteur); return charger() } }
}
