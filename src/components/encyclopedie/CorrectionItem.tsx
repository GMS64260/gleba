"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Edit, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useIsDemoAccount } from "@/hooks/use-is-demo"
import { urlConnexion } from "@/lib/auth-retour"
import { messageErreurReponse } from "@/lib/api-erreur"
import { valeurRenseignee } from "@/lib/referentiel-valeur"
import { dureeCycleItpJours } from "@/lib/cultures/dates-itp"
import { ZONES_CLIMAT, ZONE_CLIMAT_LABEL, type ZoneClimat } from "@/lib/terroir"
import { CHAMPS_CORRECTION, TYPES_CIBLE_CORRECTION, type CibleCorrectionVue, type CorrectionPublieeVue, type TypeCibleCorrection, type ValeursCorrection, type ChampCorrection } from "@/lib/encyclopedie/types"
import { ComparaisonCorrection } from "@/components/encyclopedie/ComparaisonCorrection"
import { ReferenceSource } from "@/components/encyclopedie/ReferenceSource"
import { urlCorrection } from "@/components/encyclopedie/correction-liens"

interface DemandeModification { cibleType: TypeCibleCorrection; refId: string; titre?: string; champs?: readonly string[] }
type Saisie = Record<string, string>
const EVENEMENT = "gleba:modifier-reference"
const NotesContext = React.createContext<CorrectionPublieeVue[] | null>(null)
const CHAMP = "mt-1 min-h-11 w-full rounded-lg border border-lin bg-white px-3 py-2 text-sm text-encre focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge"
const TYPE_LIBELLE: Record<TypeCibleCorrection, string> = { ESPECE: "la fiche", VARIETE: "la variété", ITP: "l’itinéraire" }

export function ContexteCorrections({ corrections, children }: { corrections: CorrectionPublieeVue[]; children: React.ReactNode }) {
  return <NotesContext.Provider value={corrections}>{children}</NotesContext.Provider>
}

/** Le bouton n'embarque jamais la ligne Prisma et ne charge rien avant le clic. */
export function ModifierItem({ cibleType, refId, titre, champs, ariaLabel }: DemandeModification & { ariaLabel?: string }) {
  const [envoyee, setEnvoyee] = React.useState(false)
  React.useEffect(() => {
    const termine = (event: Event) => { const detail = (event as CustomEvent<DemandeModification>).detail; if (detail.cibleType === cibleType && detail.refId === refId) setEnvoyee(true) }
    window.addEventListener("gleba:correction-envoyee", termine)
    return () => window.removeEventListener("gleba:correction-envoyee", termine)
  }, [cibleType, refId])
  return <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" className="min-h-11 shrink-0" aria-label={ariaLabel ?? `Modifier ${TYPE_LIBELLE[cibleType]} ${titre ?? ""}`} onClick={() => window.dispatchEvent(new CustomEvent<DemandeModification>(EVENEMENT, { detail: { cibleType, refId, titre, champs } }))}><Edit className="mr-2 h-4 w-4" aria-hidden />Modifier</Button>{envoyee && <span role="status" className="text-xs text-foret">Modification en attente de relecture</span>}</div>
}

export function CorrectionsItem({ cibleType, refId, champs, corrections = [] }: { cibleType: TypeCibleCorrection; refId: string; champs?: readonly string[]; corrections?: CorrectionPublieeVue[] }) {
  const contexte = React.useContext(NotesContext)
  const notes = (contexte ?? corrections).filter(note => note.cibleType === cibleType && note.refId === refId && (!champs || Object.keys(note.changements).some(cle => champs.includes(cle))))
  if (!notes.length) return null
  return <div className="mt-4 space-y-3">{notes.map(note => <aside key={note.id} className="min-w-0 rounded-xl border border-sauge/30 bg-sauge-doux/40 p-4"><p className="text-sm font-semibold text-foret">Correction de la communauté</p><p className="mt-1 text-xs leading-5 text-ardoise">Note relue ; les repères d’origine restent affichés.</p><div className="mt-3"><ComparaisonCorrection detail={note} /></div><div className="mt-3 space-y-1 text-xs leading-5 text-ardoise"><p>Source : <ReferenceSource source={note.source} /></p><p className="break-words">{note.signature} · {new Date(note.createdAt).toLocaleDateString("fr-FR")} · {note.licence}</p></div></aside>)}</div>
}

function saisieInitiale(cible: CibleCorrectionVue): Saisie {
  return Object.fromEntries(CHAMPS_CORRECTION[cible.cibleType].map(champ => {
    const value = cible.valeurs[champ.cle]
    return [champ.cle, typeof value === "string" ? valeurRenseignee(value) ?? "" : value == null ? "" : String(value)]
  }))
}
function changementsSaisis(cible: CibleCorrectionVue, saisie: Saisie): ValeursCorrection {
  const initiale = saisieInitiale(cible)
  const changements: ValeursCorrection = {}
  for (const champ of CHAMPS_CORRECTION[cible.cibleType]) {
    const raw = saisie[champ.cle] ?? ""
    if (raw === initiale[champ.cle]) continue
    changements[champ.cle] = raw === "" ? null : champ.type === "nombre" ? Number(raw) : champ.type === "booleen" ? raw === "true" : raw.trim()
  }
  return changements
}
function cycleLisible(cible: CibleCorrectionVue, saisie: Saisie) {
  const nombre = (cle: string) => { const value = saisie[cle]; return value === "" || value === undefined ? null : Number(value) }
  const base = cible.cycleBase
  if (base?.delaiPremiereRecolteAnnees && base.delaiPremiereRecolteAnnees > 0) return `Première récolte au bout de ${base.delaiPremiereRecolteAnnees} an${base.delaiPremiereRecolteAnnees > 1 ? "s" : ""}`
  const jours = dureeCycleItpJours({ ...base, semaineSemis: nombre("semaineSemis"), semainePlantation: nombre("semainePlantation"), semaineRecolte: nombre("semaineRecolte") })
  return jours ? `${jours} jours` : "Non précisé"
}
function labelOption(option: string) {
  return ({ aucun: "Aucun", faible: "Faible", modere: "Modéré", eleve: "Élevé", Chassis: "Châssis" } as Record<string, string>)[option] || option
}

export function EditeurCorrection({ especeId }: { especeId: string }) {
  const { data: session, status } = useSession()
  const demo = useIsDemoAccount()
  const params = useSearchParams()
  const [demande, setDemande] = React.useState<DemandeModification | null>(null)
  const [cible, setCible] = React.useState<CibleCorrectionVue | null>(null)
  const [saisie, setSaisie] = React.useState<Saisie>({})
  const [source, setSource] = React.useState("")
  const [motif, setMotif] = React.useState("")
  const [signature, setSignature] = React.useState("")
  const [licence, setLicence] = React.useState(false)
  const [chargement, setChargement] = React.useState(false)
  const [envoi, setEnvoi] = React.useState(false)
  const [envoyee, setEnvoyee] = React.useState(false)
  const [erreur, setErreur] = React.useState<string | null>(null)
  const [conflit, setConflit] = React.useState(false)
  const [essai, setEssai] = React.useState(0)
  const [autres, setAutres] = React.useState(false)
  const retourFocus = React.useRef<HTMLElement | null>(null)
  const lienLu = React.useRef<string | null>(null)
  const uid = React.useId()
  const peutEnvoyer = status === "authenticated" && !demo && !session?.user?.impersonatedBy
  const signatureKey = session?.user?.id ? `gleba-signature-contribution:${session.user.id}` : null

  React.useEffect(() => {
    const ouvrir = (event: Event) => { retourFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setDemande((event as CustomEvent<DemandeModification>).detail) }
    window.addEventListener(EVENEMENT, ouvrir)
    return () => window.removeEventListener(EVENEMENT, ouvrir)
  }, [])
  React.useEffect(() => {
    const type = params.get("corriger"), refId = params.get("ref")
    if (!refId || !(TYPES_CIBLE_CORRECTION as readonly string[]).includes(type ?? "")) return
    const key = `${type}:${refId}`
    if (lienLu.current === key) return
    lienLu.current = key
    setDemande({ cibleType: type as TypeCibleCorrection, refId })
  }, [params])
  React.useEffect(() => {
    if (!demande) return
    const controller = new AbortController()
    setChargement(true); setCible(null); setErreur(null); setConflit(false); setEnvoyee(false); setLicence(false); setMotif(""); setAutres(false)
    fetch(`/api/public/referentiel/corrections/${demande.cibleType}/${encodeURIComponent(demande.refId)}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error(await messageErreurReponse(response)); return response.json() as Promise<{ cible: CibleCorrectionVue }> })
      .then(result => {
        if (controller.signal.aborted) return
        if (result.cible.espece.id !== especeId) throw new Error("Cet élément n’appartient pas à cette fiche.")
        setCible(result.cible); setSaisie(saisieInitiale(result.cible)); setSource(result.cible.source.split(/\r?\n/).map(valeurRenseignee).filter((ligne): ligne is string => ligne !== null).join("\n"))
      })
      .catch((error: unknown) => { if (!controller.signal.aborted) setErreur(error instanceof Error ? error.message : "Les valeurs n’ont pas pu être chargées.") })
      .finally(() => { if (!controller.signal.aborted) setChargement(false) })
    return () => controller.abort()
  }, [demande, especeId, essai])
  React.useEffect(() => {
    if (!demande || !signatureKey || demo) return
    try { setSignature(localStorage.getItem(signatureKey) ?? "") } catch { setSignature("") }
  }, [demande, signatureKey, demo])

  const changements = cible ? changementsSaisis(cible, saisie) : {}
  const champs = cible ? CHAMPS_CORRECTION[cible.cibleType] : []
  const principaux = demande?.champs?.length ? champs.filter(champ => demande.champs!.includes(champ.cle)) : champs
  const secondaires = demande?.champs?.length ? champs.filter(champ => !demande.champs!.includes(champ.cle)) : []
  const connexion = demande ? urlConnexion(urlCorrection(especeId, demande.cibleType, demande.refId, true)) : ""

  function champEdition(champ: ChampCorrection) {
    const id = `${uid}-${champ.cle}`
    const value = saisie[champ.cle] ?? ""
    const setValue = (next: string) => setSaisie(s => ({ ...s, [champ.cle]: next }))
    const zone = champ.cle === "zoneClimat"
    const options = zone ? ZONES_CLIMAT : champ.options
    return <div key={champ.cle} className={champ.cle === "description" ? "sm:col-span-2" : ""}><label htmlFor={id} className="block text-sm font-medium">{champ.libelle}{champ.unite && <span className="ml-1 font-normal text-ardoise">({champ.unite})</span>}</label>{champ.type === "booleen" ? <select id={id} aria-label={champ.libelle} value={value} onChange={event => setValue(event.target.value)} className={CHAMP}>{value === "" && <option value="">Non renseigné</option>}<option value="true">Oui</option><option value="false">Non</option></select> : champ.cle === "description" ? <textarea id={id} aria-label={champ.libelle} value={value} onChange={event => setValue(event.target.value)} rows={5} maxLength={12000} className={CHAMP} /> : options ? <select id={id} aria-label={champ.libelle} value={value} onChange={event => setValue(event.target.value)} className={CHAMP}><option value="">Non renseigné</option>{value && !(options as readonly string[]).includes(value) && <option value={value}>{value}</option>}{options.map(option => <option key={option} value={option}>{zone ? ZONE_CLIMAT_LABEL[option as ZoneClimat] : labelOption(option)}</option>)}</select> : <input id={id} aria-label={champ.libelle} type={champ.type === "nombre" ? "number" : "text"} step={champ.pas ?? "any"} value={value} onChange={event => setValue(event.target.value)} placeholder="Non renseigné" maxLength={champ.cle === "nom" ? cible?.cibleType === "ITP" ? 100 : 200 : 500} className={CHAMP} />}</div>
  }

  async function envoyer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!cible || !demande || !peutEnvoyer) return
    setErreur(null)
    if (!Object.keys(changements).length) { setErreur("Modifiez au moins une valeur avant d’envoyer votre proposition."); return }
    for (const champ of champs) {
      const value = changements[champ.cle]
      if (value === undefined) continue
      if (champ.cle === "nom" && (typeof value !== "string" || !value.trim())) { setErreur("Le nom doit rester renseigné."); return }
      if (champ.type === "nombre" && value !== null && (typeof value !== "number" || !Number.isFinite(value) || (champ.min !== undefined && value < champ.min) || (champ.max !== undefined && value > champ.max) || (champ.pas === 1 && !Number.isInteger(value)))) { setErreur(`Vérifiez « ${champ.libelle} »${champ.min !== undefined && champ.max !== undefined ? ` : entre ${champ.min} et ${champ.max}` : ""}.`); return }
    }
    if (source.trim().length < 5) { setErreur("Ajoutez une source ou une référence pour appuyer la modification."); return }
    if (signature.trim().length < 2 || !licence) { setErreur("Indiquez votre signature publique et acceptez la licence pour envoyer la modification."); return }
    setEnvoi(true)
    try {
      const response = await fetch("/api/referentiel/corrections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cibleType: demande.cibleType, refId: demande.refId, changements, empreinteBase: cible.empreinte, source: source.trim(), motif: motif.trim(), signature: signature.trim(), acceptationLicence: licence }) })
      if (!response.ok) { setConflit(response.status === 409); throw new Error(await messageErreurReponse(response)) }
      if (signatureKey) { try { localStorage.setItem(signatureKey, signature.trim()) } catch { /* Le navigateur peut refuser le stockage local. */ } }
      setEnvoyee(true)
      window.dispatchEvent(new CustomEvent<DemandeModification>("gleba:correction-envoyee", { detail: demande }))
    } catch (error) { setErreur(error instanceof Error ? error.message : "La modification n’a pas pu être envoyée.") }
    finally { setEnvoi(false) }
  }

  return <Dialog open={demande !== null} onOpenChange={open => { if (!open && !envoi) setDemande(null) }}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto border-lin bg-craie" onCloseAutoFocus={event => { event.preventDefault(); retourFocus.current?.focus() }}><DialogHeader><DialogTitle className="pr-6 font-display text-2xl text-foret">{envoyee ? "Votre modification est envoyée" : `Modifier ${cible ? TYPE_LIBELLE[cible.cibleType] : demande ? TYPE_LIBELLE[demande.cibleType] : "la fiche"}`}</DialogTitle><DialogDescription className="break-words">{cible?.titre ?? demande?.titre ?? "Chargement des valeurs affichées…"}</DialogDescription></DialogHeader>{envoyee ? <div className="space-y-4"><p role="status" className="rounded-lg bg-sauge-doux p-4 text-sm text-foret">La modification est en attente de relecture. Elle reste rattachée à cet élément de la fiche.</p><div className="flex flex-wrap gap-3"><Button className="min-h-11" onClick={() => setDemande(null)}>Revenir à la fiche</Button><Button asChild variant="outline" className="min-h-11"><Link href="/communaute?tab=contribuer">Suivre ma modification</Link></Button></div></div> : chargement ? <p role="status" className="flex items-center gap-2 py-8 text-sm text-ardoise"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Chargement des valeurs…</p> : cible ? <form onSubmit={envoyer} noValidate className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">{principaux.map(champEdition)}{cible.cibleType === "ITP" && <div className="rounded-lg border border-lin bg-papier p-3 sm:col-span-2"><p className="text-xs font-medium text-ardoise">Cycle calculé</p><output aria-label="Cycle calculé" className="mt-1 block text-sm font-medium">{cycleLisible(cible, saisie)}</output><p className="mt-1 text-xs text-ardoise">Actualisé à partir des semaines indiquées.</p></div>}</div>{secondaires.length > 0 && <details open={autres} onToggle={event => setAutres(event.currentTarget.open)}><summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-foret">Autres informations de la fiche</summary><div className="mt-3 grid gap-4 sm:grid-cols-2">{secondaires.map(champEdition)}</div></details>}<label className="block text-sm font-medium" htmlFor={`${uid}-source`}>Source ou référence<textarea id={`${uid}-source`} aria-label="Source ou référence" value={source} onChange={event => setSource(event.target.value)} rows={2} maxLength={2000} className={CHAMP} placeholder="Une publication, un lien ou une référence vérifiable" /></label><details><summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-foret">Ajouter une précision (facultatif)</summary><textarea aria-label="Précision facultative" value={motif} onChange={event => setMotif(event.target.value)} rows={2} maxLength={500} className={CHAMP} placeholder="Ce que vous avez observé ou pourquoi vous corrigez cette valeur" /></details>{Object.keys(changements).length > 0 && <details><summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-foret">Voir les {Object.keys(changements).length} modification{Object.keys(changements).length > 1 ? "s" : ""}</summary><ComparaisonCorrection detail={{ cibleType: cible.cibleType, refId: cible.refId, titre: cible.titre, avant: cible.valeurs, apres: { ...cible.valeurs, ...changements }, changements }} /></details>}{peutEnvoyer ? <><label className="block text-sm font-medium" htmlFor={`${uid}-signature`}>Votre signature publique<input id={`${uid}-signature`} aria-label="Votre signature publique" value={signature} onChange={event => setSignature(event.target.value)} autoComplete="off" minLength={2} maxLength={80} className={CHAMP} placeholder="Un nom ou pseudonyme choisi" /></label><label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input type="checkbox" checked={licence} onChange={event => setLicence(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" /><span>J’accepte de proposer cette modification sous <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline">CC BY 4.0</a>, avec cette signature.</span></label></> : <p className="rounded-lg border border-lin bg-papier p-3 text-sm leading-6 text-ardoise">{status === "loading" ? "Vérification de la connexion…" : demo ? "Connectez-vous avec un compte personnel pour envoyer cette modification. Le compte de démonstration est partagé." : session?.user?.impersonatedBy ? "Cette session de consultation ne peut pas envoyer de modification." : "Connectez-vous pour proposer une modification de cet élément."}</p>}{erreur && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erreur}</p>}{conflit && <Button type="button" variant="outline" className="min-h-11" onClick={() => setEssai(n => n + 1)}>Recharger les valeurs actuelles</Button>}<div className="flex flex-wrap justify-end gap-3 border-t border-lin pt-4"><Button type="button" variant="outline" className="min-h-11" disabled={envoi} onClick={() => setDemande(null)}>Annuler</Button>{peutEnvoyer ? <Button type="submit" className="min-h-11" disabled={envoi || conflit || Object.keys(changements).length === 0}>{envoi && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}Envoyer la modification</Button> : status !== "loading" && !session?.user?.impersonatedBy && <Button asChild className="min-h-11"><Link href={connexion}>Se connecter pour envoyer</Link></Button>}</div><p className="text-xs leading-5 text-ardoise">La proposition sera relue avant publication sur cet élément. Les données de référence restent conservées.</p></form> : <div className="space-y-3"><p role="alert" className="text-sm text-red-700">{erreur}</p><Button variant="outline" className="min-h-11" onClick={() => setEssai(n => n + 1)}>Réessayer</Button></div>}</DialogContent></Dialog>
}
