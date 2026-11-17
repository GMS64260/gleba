"use client"

import * as React from "react"

interface Besoin { type: string; ref: string; nom: string; unite: string; quantite: number; commandes: number; retraitLePlusProche: string | null; disponible: number; manque: number }

const nombre = (v: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(v)
const jour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })

/**
 * Ce que les commandes « à produire » de la boutique en ligne attendent de cet
 * atelier. Ne s'affiche que s'il y a un besoin ; une ferme sans boutique, ou
 * une lecture en échec, ne montre rien et ne gêne pas l'écran de production.
 */
export function BesoinsBoutique({ type, recharge }: { type: "oeufs" | "ruche"; recharge?: unknown }) {
  const [besoins, setBesoins] = React.useState<Besoin[]>([])
  React.useEffect(() => {
    const controle = new AbortController()
    fetch("/api/elevage/besoins-boutique", { cache: "no-store", signal: controle.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Besoin[]) => setBesoins(Array.isArray(d) ? d.filter((b) => b.type === type) : []))
      .catch(() => {})
    return () => controle.abort()
  }, [type, recharge])
  if (!besoins.length) return null
  return (
    <section aria-label="À produire pour la boutique" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <h3 className="font-medium">À produire pour la boutique</h3>
      <ul className="mt-1 space-y-1">
        {besoins.map((b) => (
          <li key={`${b.type}:${b.ref}`}>
            <span className="font-medium">{b.nom}</span> : {nombre(b.quantite)} {b.unite} à fournir pour {b.commandes} commande{b.commandes > 1 ? "s" : ""}
            {b.retraitLePlusProche ? `, premier retrait ${jour(b.retraitLePlusProche)}` : ""}.{" "}
            {b.manque > 0 ? `Stock libre : ${nombre(b.disponible)} ${b.unite}. Reste à produire : ${nombre(b.manque)} ${b.unite}.` : "Le stock libre couvre ces commandes : elles peuvent être livrées."}
          </li>
        ))}
      </ul>
    </section>
  )
}
