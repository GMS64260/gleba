"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { confirmDialog } from "@/lib/global-dialog"
import { Button } from "@/components/ui/button"
import { useAccesService, invaliderAccesService } from "@/hooks/use-acces-service"
import { ATELIERS, NOMS_ATELIERS, FORMULES, type Atelier, type Formule } from "@/lib/abonnement/catalogue"

function dateLisible(date: string | null) { return date ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date(date)) : "" }
export function AbonnementSection() {
  const { etat, acces, erreur, rafraichir } = useAccesService()
  const [initialise, setInitialise] = useState(false)
  const [formule, setFormule] = useState<Formule>("essentiel")
  const [atelier, setAtelier] = useState<Atelier>("maraichage")
  const [accepte, setAccepte] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState("")
  const [echec, setEchec] = useState(false)
  useEffect(() => {
    if (initialise || !acces) return
    if (acces.formule === "essentiel" || acces.formule === "complet") setFormule(acces.formule)
    if (acces.ateliers.length === 1) setAtelier(acces.ateliers[0])
    setInitialise(true)
  }, [initialise, acces])
  const agir = async (action: string) => {
    setOccupe(true); setMessage(""); setEchec(false)
    try {
      const r = await fetch("/api/abonnement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, formule, atelier: formule === "essentiel" ? atelier : null, conditionsAcceptees: accepte }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "L’opération n’a pas été confirmée.")
      if (d.url) { window.location.assign(d.url); return }
      invaliderAccesService(); await rafraichir()
      setMessage(d.date ? `Le changement prendra effet le ${dateLisible(d.date)}.` : action === "resilier" ? "La résiliation est enregistrée. Votre période payée reste accessible jusqu’à son terme." : "Votre accès a été mis à jour.")
    } catch (e) { setEchec(true); setMessage(e instanceof Error ? e.message : "Réessayez dans un instant.") } finally { setOccupe(false) }
  }
  if (erreur && !acces) return <p role="alert" className="text-garance">Vos droits ne sont pas disponibles. <button type="button" className="min-h-11 underline" onClick={() => void rafraichir()}>Réessayer</button></p>
  if (!acces || !etat) return <p role="status" className="text-ardoise">Chargement de votre accès…</p>
  if (acces.etat === "gratuit-vie") return <div className="rounded-xl border border-lin bg-craie p-6"><h3 className="font-display text-xl text-foret">Votre accès complet est gratuit à vie.</h3><p className="mt-3 max-w-prose text-sm leading-6 text-ardoise">Votre compte fait partie des inscrits déjà présents lors de l’annonce. Vous conservez tous vos modules, sans abonnement ni carte bancaire.</p><Link href="/tarifs" className="mt-4 inline-flex min-h-11 items-center text-sm text-foret underline underline-offset-4">Voir les offres pour les nouveaux inscrits</Link></div>
  if (acces.etat === "libre") return <p className="max-w-prose text-sm leading-6 text-ardoise">Le carnet est accessible sur cette instance. La facturation du service hébergé n’y est pas activée.</p>
  const actif = acces.etat === "actif" || acces.etat === "grace"
  return <div className="space-y-6">
    <div className="rounded-xl border border-lin bg-craie p-6">
      <h3 className="font-display text-xl text-foret">{acces.etat === "essai" ? "Votre essai complet est en cours" : actif ? `Votre formule ${acces.formule === "essentiel" ? "Essentiel" : "Complet"}` : acces.etat === "a-demarrer" ? "Prenez le temps d’essayer Gleba" : "Votre historique reste disponible"}</h3>
      <p className="mt-3 max-w-prose text-sm leading-6 text-ardoise">{acces.etat === "essai" ? `Tous les modules sont disponibles jusqu’au ${dateLisible(acces.essaiFin)}. Aucun paiement ne sera déclenché sans souscription.` : actif ? `Accès jusqu’au ${dateLisible(acces.valideJusquau)}.${etat.annulationAuTerme ? " Votre abonnement s’arrêtera à cette date." : ""}` : acces.etat === "a-demarrer" ? "Trois mois gratuits avec tous les modules, sans carte bancaire. Choisissez ensuite Essentiel ou Complet." : "Vous pouvez consulter et exporter vos données, ou souscrire pour reprendre les saisies."}</p>
      {acces.formule === "essentiel" && <p className="mt-2 text-sm text-encre">Atelier actif : {NOMS_ATELIERS[acces.ateliers[0]]}</p>}
      {!etat.peutGerer && <p className="mt-3 text-sm text-ardoise">Le propriétaire de l’exploitation gère l’abonnement.</p>}
      {etat.peutGerer && acces.etat === "a-demarrer" && <Button type="button" disabled={occupe} onClick={() => void agir("essai")} className="mt-4 min-h-11">{occupe ? "Démarrage…" : "Démarrer mes trois mois gratuits"}</Button>}
      {etat.peutGerer && etat.compteFacturation && <div className="mt-4 flex flex-wrap gap-3"><Button type="button" variant="outline" disabled={occupe} onClick={() => void agir("portail")}>Factures et moyen de paiement</Button>{etat.contratEnCours && !etat.annulationAuTerme && <Button type="button" variant="outline" disabled={occupe} onClick={async () => { if (await confirmDialog("Arrêter le renouvellement à la fin de votre période payée ? Vos données seront conservées.")) void agir("resilier") }}>{actif ? "Résilier au terme" : "Annuler la souscription"}</Button>}</div>}
      {etat.prochainContrat && etat.peutGerer && <div className="mt-4"><p className="text-sm text-ardoise">Un changement de formule est programmé au prochain renouvellement.</p><Button type="button" variant="outline" disabled={occupe} className="mt-2" onClick={() => void agir("annuler-modification")}>Annuler ce changement</Button></div>}
    </div>
    {etat.peutGerer && acces.etat !== "a-demarrer" && <form className="space-y-5" onSubmit={event => { event.preventDefault(); void agir(actif ? "changer" : "checkout") }}>
      <fieldset disabled={occupe}><legend className="font-display text-xl text-foret">{actif ? "Changer au prochain renouvellement" : "Choisir la suite de votre carnet"}</legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{(["essentiel", "complet"] as Formule[]).map(f => <label key={f} className={`flex min-h-24 cursor-pointer gap-3 rounded-xl border p-4 ${formule === f ? "border-sauge bg-sauge-doux" : "border-lin bg-craie"}`}><input type="radio" name="formule" value={f} checked={formule === f} onChange={() => setFormule(f)} className="mt-1 h-4 w-4 accent-sauge" /><span><strong className="block text-encre">{FORMULES[f].nom} · {FORMULES[f].prix} € HT/mois</strong><span className="mt-1 block text-sm leading-6 text-ardoise">{f === "essentiel" ? "Un atelier. Sans IA, météo, boutique ni comptabilité." : "Tous les ateliers, l’IA, la météo, la boutique et la précomptabilité."}</span></span></label>)}</div>
      </fieldset>
      {formule === "essentiel" && <div><label htmlFor="atelier-abonnement" className="text-sm font-medium text-encre">Votre atelier</label><select id="atelier-abonnement" name="atelier" value={atelier} onChange={event => setAtelier(event.target.value as Atelier)} disabled={occupe} className="mt-2 min-h-11 w-full rounded-md border border-lin bg-craie px-3 text-sm sm:max-w-sm">{ATELIERS.map(a => <option key={a} value={a}>{NOMS_ATELIERS[a]}</option>)}</select></div>}
      <label className="flex min-h-11 items-start gap-3 text-sm leading-6 text-ardoise"><input type="checkbox" name="conditions" checked={accepte} onChange={event => setAccepte(event.target.checked)} required className="mt-1 h-4 w-4 accent-sauge" /><span>Je choisis {FORMULES[formule].nom} à {FORMULES[formule].prix} € HT par mois et j’accepte les <Link href="/conditions-service" className="text-foret underline underline-offset-4">conditions du service</Link>. {actif ? "Le changement s’appliquera au prochain renouvellement." : "Le paiement sera confirmé sur la page sécurisée."}</span></label>
      <Button type="submit" disabled={occupe || !etat.paiementDisponible || acces.etat === "essai" || Boolean(etat.prochainContrat) || etat.annulationAuTerme} className="min-h-11">{occupe ? "Vérification…" : actif ? "Programmer ce changement" : `Souscrire à ${FORMULES[formule].prix} € HT/mois`}</Button>
      {acces.etat === "essai" && <p className="text-sm text-ardoise">Vous pourrez souscrire à la fin de vos trois mois gratuits.</p>}
      {!etat.paiementDisponible && <p className="text-sm text-ardoise">Les paiements ne sont pas encore ouverts. Votre accès actuel est conservé.</p>}
    </form>}
    {message && <p role={echec ? "alert" : "status"} aria-live="polite" className={`rounded-lg border border-lin bg-craie p-4 text-sm leading-6 ${echec ? "text-garance" : "text-foret"}`}>{message}</p>}
  </div>
}
