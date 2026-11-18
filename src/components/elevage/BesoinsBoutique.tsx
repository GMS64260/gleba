"use client"

import * as React from "react"
import { useExploitation } from "@/hooks/use-exploitation"
import { useModules } from "@/hooks/use-modules"
import type { BesoinAProduire } from "@/lib/boutique/stock-lie-disponible"

const nombre = (v: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(v)
const jour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })

type Props = { type?: "oeufs" | "ruche"; recharge?: unknown }
type Lecture = { etat: "chargement" } | { etat: "erreur"; message: string } | { etat: "succes"; besoins: BesoinAProduire[] }

/** Lecture seule, autorisée après confirmation du tenant et des modules. */
export function BesoinsBoutique(props: Props) {
  const { contexte, contexteConfirme } = useExploitation()
  const { loading, isActif } = useModules()
  if (!contexteConfirme || !contexte?.tenantId || loading || !isActif("elevage") || (contexte.modules !== null && !contexte.modules.includes("elevage"))) return null
  // Le changement de tenant détruit l'état précédent avant le prochain rendu.
  return <LectureBesoins key={contexte.tenantId} {...props} />
}

function LectureBesoins({ type, recharge }: Props) {
  const [lecture, setLecture] = React.useState<Lecture>({ etat: "chargement" })
  const [tentative, setTentative] = React.useState(0)
  React.useEffect(() => {
    const controle = new AbortController()
    let actif = true
    setLecture({ etat: "chargement" })
    fetch("/api/elevage/besoins-boutique", { cache: "no-store", signal: controle.signal })
      .then(async (r) => {
        if (!r.ok) {
          if (actif) setLecture({ etat: "erreur", message: r.status === 403 ? "Vous n’avez pas accès aux besoins de l’élevage." : "Impossible de charger les besoins de la boutique." })
          return
        }
        const besoins: BesoinAProduire[] = await r.json()
        if (!Array.isArray(besoins)) throw new Error("Réponse des besoins de la boutique invalide.")
        if (actif) setLecture({ etat: "succes", besoins })
      })
      .catch(() => {
        if (actif) setLecture({ etat: "erreur", message: "Impossible de charger les besoins de la boutique. Vérifiez votre connexion puis réessayez." })
      })
    return () => { actif = false; controle.abort() }
  }, [recharge, tentative])
  const besoins = lecture.etat === "succes" ? lecture.besoins.filter((b) => type ? b.type === type : b.type === "oeufs" || b.type === "ruche") : []
  return (
    <section aria-label="À produire pour la boutique" className="min-w-0 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <h3 className="font-medium">À produire pour la boutique</h3>
      {lecture.etat === "chargement" && <p role="status">Chargement des besoins…</p>}
      {lecture.etat === "erreur" && <p role="alert">{lecture.message}</p>}
      {lecture.etat === "succes" && (besoins.length ? <ListeBesoins besoins={besoins} /> : <p>Aucune commande à produire pour la boutique.</p>)}
      {lecture.etat !== "chargement" && <button type="button" className="mt-2 min-h-11 underline" onClick={() => setTentative((n) => n + 1)}>{lecture.etat === "erreur" ? "Réessayer" : "Actualiser les besoins"}</button>}
    </section>
  )
}

/** Présente les grandeurs renvoyées par le serveur, sans les recalculer. */
export function ListeBesoins({ besoins }: { besoins: BesoinAProduire[] }) {
  return <ul className="mt-1 space-y-2 break-words">
    {besoins.map((b) => <li key={`${b.type}:${b.ref}`}>
      <span className="font-medium">{b.nom}</span> : {nombre(b.quantite)} {b.unite} à fournir pour {b.commandes} commande{b.commandes > 1 ? "s" : ""}
      {b.retraitLePlusProche ? `, premier retrait ${jour(b.retraitLePlusProche)}` : ", date de retrait non précisée"}.{" "}
      Stock libre : {nombre(b.disponible)} {b.unite}.{" "}
      {b.manque > 0 ? `Reste à produire : ${nombre(b.manque)} ${b.unite}.` : "Le stock libre couvre ces commandes : elles peuvent être livrées."}
    </li>)}
  </ul>
}
