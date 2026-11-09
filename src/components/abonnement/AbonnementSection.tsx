"use client"
import { useState } from "react"
import Link from "next/link"
import { confirmDialog } from "@/lib/global-dialog"
import { Button } from "@/components/ui/button"
import { useAccesService, invaliderAccesService } from "@/hooks/use-acces-service"
import { FORMULES, GRATUIT } from "@/lib/abonnement/catalogue"

function dateLisible(date: string | null) { return date ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date(date)) : "" }
const complet = FORMULES.complet
export function AbonnementSection() {
  const { etat, acces, erreur, rafraichir } = useAccesService()
  const [accepte, setAccepte] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState("")
  const [echec, setEchec] = useState(false)
  const agir = async (action: string) => {
    setOccupe(true); setMessage(""); setEchec(false)
    try {
      const r = await fetch("/api/abonnement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "checkout" ? { action, formule: "complet", conditionsAcceptees: accepte } : { action }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "L’opération n’a pas été confirmée.")
      if (d.url) { window.location.assign(d.url); return }
      invaliderAccesService(); await rafraichir()
      setMessage(action === "resilier" ? "La résiliation est enregistrée. Complet reste actif jusqu’à la fin de la période payée, puis votre carnet reste gratuit." : "Votre accès a été mis à jour.")
    } catch (e) { setEchec(true); setMessage(e instanceof Error ? e.message : "Réessayez dans un instant.") } finally { setOccupe(false) }
  }
  if (erreur && !acces) return <p role="alert" className="text-garance">Vos droits ne sont pas disponibles. <button type="button" className="min-h-11 underline" onClick={() => void rafraichir()}>Réessayer</button></p>
  if (!acces || !etat) return <p role="status" className="text-ardoise">Chargement de votre accès…</p>
  if (acces.etat === "gratuit-vie") return <div className="rounded-xl border border-lin bg-craie p-6"><h3 className="font-display text-xl text-foret">Votre accès complet est gratuit à vie.</h3><p className="mt-3 max-w-prose text-sm leading-6 text-ardoise">Votre compte fait partie des inscrits déjà présents lors de l’annonce. Vous conservez tous vos modules, sans abonnement ni carte bancaire.</p><Link href="/tarifs" className="mt-4 inline-flex min-h-11 items-center text-sm text-foret underline underline-offset-4">Voir les offres pour les nouveaux inscrits</Link></div>
  if (acces.etat === "libre") return <p className="max-w-prose text-sm leading-6 text-ardoise">Le carnet est accessible sur cette instance. La facturation du service hébergé n’y est pas activée.</p>
  const actif = acces.etat === "actif" || acces.etat === "grace"
  const titre = acces.etat === "essai" ? "Votre essai de Complet est en cours" : actif ? "Votre abonnement Complet" : "Votre carnet gratuit"
  const texte = acces.etat === "essai" ? `L’assistant IA, la météo, la boutique et la gestion sont disponibles jusqu’au ${dateLisible(acces.essaiFin)}. Ensuite, votre carnet reste gratuit : aucun paiement sans souscription.`
    : actif ? `Complet est actif jusqu’au ${dateLisible(acces.valideJusquau)}.${etat.annulationAuTerme ? " Votre abonnement s’arrêtera à cette date ; votre carnet restera gratuit." : ""}`
    : "Tous vos ateliers, le plan de votre terrain, les stocks, la traçabilité et la facturation restent gratuits. Toutes vos données sont conservées."
  return <div className="space-y-6">
    <div className="rounded-xl border border-lin bg-craie p-6">
      <h3 className="font-display text-xl text-foret">{titre}</h3>
      <p className="mt-3 max-w-prose text-sm leading-6 text-ardoise">{texte}</p>
      {!etat.peutGerer && <p className="mt-3 text-sm text-ardoise">Le propriétaire de l’exploitation gère l’abonnement.</p>}
      {etat.peutGerer && acces.etat === "a-demarrer" && <Button type="button" disabled={occupe} onClick={() => void agir("essai")} className="mt-4 min-h-11">{occupe ? "Démarrage…" : "Essayer Complet trois mois"}</Button>}
      {etat.peutGerer && etat.compteFacturation && <div className="mt-4 flex flex-wrap gap-3"><Button type="button" variant="outline" disabled={occupe} onClick={() => void agir("portail")}>Factures et moyen de paiement</Button>{etat.contratEnCours && !etat.annulationAuTerme && <Button type="button" variant="outline" disabled={occupe} onClick={async () => { if (await confirmDialog("Arrêter le renouvellement à la fin de votre période payée ? Votre carnet restera gratuit et vos données seront conservées.")) void agir("resilier") }}>{actif ? "Résilier au terme" : "Annuler la souscription"}</Button>}</div>}
    </div>
    {etat.peutGerer && acces.etat === "gratuit" && <form className="space-y-5 rounded-xl border border-sauge bg-sauge-doux/40 p-6" onSubmit={event => { event.preventDefault(); void agir("checkout") }}>
      <h3 className="font-display text-xl text-foret">{complet.nom} · {complet.prix} € HT/mois</h3>
      <p className="max-w-prose text-sm leading-6 text-ardoise">{complet.description}</p>
      <ul className="space-y-1 text-sm leading-6 text-encre">{GRATUIT.exclus.map(t => <li key={t}>{t}</li>)}</ul>
      <label className="flex min-h-11 items-start gap-3 text-sm leading-6 text-ardoise"><input type="checkbox" name="conditions" checked={accepte} onChange={event => setAccepte(event.target.checked)} required disabled={occupe} className="mt-1 h-4 w-4 accent-sauge" /><span>Je choisis Complet à {complet.prix} € HT par mois et j’accepte les <Link href="/conditions-service" className="text-foret underline underline-offset-4">conditions du service</Link>. Le paiement sera confirmé sur la page sécurisée.</span></label>
      <Button type="submit" disabled={occupe || !etat.paiementDisponible} className="min-h-11">{occupe ? "Vérification…" : `Passer à Complet, ${complet.prix} € HT/mois`}</Button>
      {!etat.paiementDisponible && <p className="text-sm text-ardoise">Les paiements ne sont pas encore ouverts. Votre carnet gratuit est conservé.</p>}
    </form>}
    {message && <p role={echec ? "alert" : "status"} aria-live="polite" className={`rounded-lg border border-lin bg-craie p-4 text-sm leading-6 ${echec ? "text-garance" : "text-foret"}`}>{message}</p>}
  </div>
}
