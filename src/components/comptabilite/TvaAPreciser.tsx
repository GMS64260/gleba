"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { SelectNatif } from "@/components/ui/select-natif"
import { useExploitation } from "@/hooks/use-exploitation"
import { formatMontantDevise } from "@/lib/format-utils"
import { LABELS_REGIME_TVA, TERRITOIRES, type Devise } from "@/lib/territoires"
import {
  MESSAGE_REGIME_NON_PRECISABLE,
  TAUX_BOUTIQUE_PRECISABLES,
  tauxPrecisablesBoutique,
} from "@/lib/comptabilite/taux-boutique-precisables"

const ENDPOINT = "/api/comptabilite/tva/a-preciser"

interface ContexteCommande {
  regimeTva: string
  territoire: string
  devise: Devise
}

interface CommandeAPreciser {
  id: string | number
  numero: string
  date: string
  totalTTC: number
  /**
   * Régime, territoire et devise établis à la date de la commande ; null si le
   * profil a été modifié depuis : ils sont alors à déclarer avec les taux.
   */
  contexte?: ContexteCommande | null
  lignes: {
    ligneId: string
    produitNom: string
    montantTTC: number
    categorie: string | null
    tauxSuggere: number | null
  }[]
}

interface ReponseAPreciser {
  commandes: CommandeAPreciser[]
  total: { nombre: number; totalTTC: number }
}

const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 })

/** Montant dans la devise de la commande ; sans devise tant qu'elle n'est pas connue (jamais celle du profil actuel). */
function montant(valeur: number, devise: Devise | null) {
  return devise === null ? `${nombre.format(valeur)} (devise à préciser)` : formatMontantDevise(valeur, devise)
}

function messageErreur(data: unknown, defaut: string) {
  return data && typeof data === "object" && "error" in data && typeof data.error === "string"
    ? data.error
    : defaut
}

const libelleTaux = (t: number) => `${String(t).replace(".", ",")} %`

function CorrectionCommande({ commande, peutCorriger, onCorrige }: {
  commande: CommandeAPreciser
  peutCorriger: boolean
  onCorrige: (id: CommandeAPreciser["id"]) => void
}) {
  const etabli = commande.contexte ?? null
  const [taux, setTaux] = React.useState<Record<string, string>>(() => Object.fromEntries(
    commande.lignes.map((ligne) => [ligne.ligneId, ligne.tauxSuggere == null ? "" : String(ligne.tauxSuggere)]),
  ))
  // Déclaration du régime à la date de la commande : vide au départ, jamais
  // recopiée du profil actuel.
  const [territoire, setTerritoire] = React.useState("")
  const [regime, setRegime] = React.useState("")
  const [erreur, setErreur] = React.useState("")
  const [enCours, setEnCours] = React.useState(false)
  const envoi = React.useRef(false)
  const id = React.useId()

  const configTerritoire = territoire ? TERRITOIRES[territoire] ?? null : null
  const declare: ContexteCommande | null = !etabli && configTerritoire && regime && configTerritoire.regimesTva.includes(regime)
    ? { regimeTva: regime, territoire, devise: configTerritoire.devise }
    : null
  const contexte = etabli ?? declare
  const devise: Devise | null = etabli?.devise ?? configTerritoire?.devise ?? null
  // Même règle que le serveur : 0 % sous un régime sans taxe, taux français
  // sous la TVA française, aucune qualification sous une taxe locale (TGC).
  const permis: readonly number[] | null = contexte ? tauxPrecisablesBoutique(contexte.regimeTva) : TAUX_BOUTIQUE_PRECISABLES
  const valeur = (ligneId: string) => {
    const v = taux[ligneId]
    return v !== "" && permis?.some((t) => t === Number(v)) ? v : ""
  }
  const suggestion = (ligne: CommandeAPreciser["lignes"][number]) =>
    permis && permis.length === 1 ? permis[0] : ligne.tauxSuggere
  const complet = contexte !== null && permis !== null && commande.lignes.length > 0 &&
    commande.lignes.every((ligne) => valeur(ligne.ligneId) !== "")

  function choisirTerritoire(code: string) {
    setTerritoire(code)
    const regimes = code ? TERRITOIRES[code]?.regimesTva ?? [] : []
    setRegime(regimes.length === 1 ? regimes[0] : regimes.includes(regime) ? regime : "")
  }

  function choisirRegime(code: string) {
    setRegime(code)
    const seul = tauxPrecisablesBoutique(code)
    // Un seul taux possible (régime sans taxe) : présélectionné ; sinon retour
    // aux suggestions, pour ne pas garder un 0 % choisi sous un autre régime.
    setTaux(Object.fromEntries(commande.lignes.map((ligne) => [ligne.ligneId,
      seul && seul.length === 1 ? String(seul[0]) : ligne.tauxSuggere == null ? "" : String(ligne.tauxSuggere)])))
  }

  async function corriger(event: React.FormEvent) {
    event.preventDefault()
    if (!peutCorriger || !complet || !contexte || envoi.current) return
    envoi.current = true
    setEnCours(true)
    setErreur("")
    try {
      const reponse = await fetch(`${ENDPOINT}/${encodeURIComponent(commande.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lignes: commande.lignes.map((ligne) => ({ ligneId: ligne.ligneId, taux: Number(valeur(ligne.ligneId)) })),
          ...(declare ? { contexte: declare } : {}),
        }),
      })
      if (!reponse.ok) {
        const data: unknown = await reponse.json().catch(() => null)
        setErreur(messageErreur(data, "La correction n’a pas pu être enregistrée. Réessayez."))
        return
      }
      onCorrige(commande.id)
    } catch {
      setErreur("La connexion ne permet pas d’enregistrer la correction. Réessayez.")
    } finally {
      envoi.current = false
      setEnCours(false)
    }
  }

  const desactive = !peutCorriger || enCours

  return (
    <form onSubmit={corriger} className="min-w-0 space-y-4 rounded-lg border bg-background p-4" aria-label={`Commande ${commande.numero}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words font-medium">Commande {commande.numero}</h3>
          <p className="text-sm text-muted-foreground">{new Date(commande.date).toLocaleDateString("fr-FR")}</p>
        </div>
        <p className="text-sm font-medium">{montant(commande.totalTTC, devise)} TTC</p>
      </div>
      {!etabli && (
        <fieldset className="min-w-0 space-y-3 rounded-md border border-dashed p-3">
          <legend className="px-1 text-sm font-medium">Situation à la date de la commande</legend>
          <p className="text-sm text-muted-foreground">
            Le profil de l’exploitation a été modifié depuis cette commande : indiquez le territoire et le régime de taxe
            qui s’appliquaient à sa date. La devise suit le territoire.
          </p>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1">
              <Label htmlFor={`${id}-territoire`}>Territoire à la date de la commande</Label>
              <SelectNatif
                id={`${id}-territoire`}
                className="h-11"
                value={territoire}
                onChange={(event) => choisirTerritoire(event.target.value)}
                disabled={desactive}
                required
              >
                <option value="" disabled>Choisir un territoire</option>
                {Object.entries(TERRITOIRES).map(([code, t]) => (
                  <option key={code} value={code}>{t.label}</option>
                ))}
              </SelectNatif>
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor={`${id}-regime`}>Régime de taxe à la date de la commande</Label>
              <SelectNatif
                id={`${id}-regime`}
                className="h-11"
                value={regime}
                onChange={(event) => choisirRegime(event.target.value)}
                disabled={desactive || !configTerritoire}
                required
              >
                <option value="" disabled>Choisir un régime</option>
                {(configTerritoire?.regimesTva ?? []).map((code) => (
                  <option key={code} value={code}>{LABELS_REGIME_TVA[code] ?? code}</option>
                ))}
              </SelectNatif>
            </div>
          </div>
          <p className="text-sm">Devise : {configTerritoire ? configTerritoire.devise : "à préciser (choisissez le territoire)"}</p>
        </fieldset>
      )}
      {permis === null && <p role="note" className="break-words text-sm text-amber-800">{MESSAGE_REGIME_NON_PRECISABLE}</p>}
      {commande.lignes.map((ligne, index) => (
        <div key={ligne.ligneId} className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center">
          <div className="min-w-0">
            <Label htmlFor={`${id}-${index}`} className="break-words">{ligne.produitNom}</Label>
            <p className="text-sm text-muted-foreground">{montant(ligne.montantTTC, devise)} TTC</p>
          </div>
          {permis !== null && (
            <div className="min-w-0">
              <SelectNatif
                id={`${id}-${index}`}
                aria-label={`Taux de TVA — ${ligne.produitNom}`}
                className="h-11"
                value={valeur(ligne.ligneId)}
                onChange={(event) => setTaux((precedents) => ({ ...precedents, [ligne.ligneId]: event.target.value }))}
                disabled={desactive}
                required
              >
                <option value="" disabled>Choisir un taux</option>
                {permis.map((t) => (
                  <option key={t} value={t}>
                    {libelleTaux(t)}{t === suggestion(ligne) ? " — suggestion" : ""}
                  </option>
                ))}
              </SelectNatif>
            </div>
          )}
        </div>
      ))}
      {erreur && <p role="alert" className="break-words text-sm text-destructive">{erreur}</p>}
      {peutCorriger && permis !== null && (
        <Button type="submit" className="h-11 w-full sm:w-auto" disabled={enCours || !complet}>
          {enCours ? "Enregistrement…" : "Confirmer les taux"}
        </Button>
      )}
    </form>
  )
}

export function TvaAPreciser({ onCorrection }: { onCorrection?: () => void }) {
  const { contexte, contexteConfirme, chargement: chargementDroits } = useExploitation()
  const { data: session } = useSession()
  const peutCorriger = contexteConfirme && !chargementDroits && contexte?.peutEcrire === true && !session?.user.impersonatedBy
  const [commandes, setCommandes] = React.useState<CommandeAPreciser[] | null>(null)
  const [erreur, setErreur] = React.useState("")
  const [chargement, setChargement] = React.useState(true)
  const [revision, setRevision] = React.useState(0)
  const titreId = React.useId()

  React.useEffect(() => {
    const controller = new AbortController()
    setChargement(true)
    setErreur("")
    async function charger() {
      try {
        const reponse = await fetch(ENDPOINT, { signal: controller.signal, cache: "no-store" })
        const data = await reponse.json().catch(() => null)
        if (controller.signal.aborted) return
        if (!reponse.ok) {
          setErreur(messageErreur(data, "Les commandes à préciser ne peuvent pas être chargées. Réessayez."))
          return
        }
        setCommandes((data as ReponseAPreciser).commandes)
      } catch {
        if (!controller.signal.aborted) setErreur("La connexion ne permet pas de charger les commandes à préciser. Réessayez.")
      } finally {
        if (!controller.signal.aborted) setChargement(false)
      }
    }
    void charger()
    return () => controller.abort()
  }, [revision])

  if (!chargement && !erreur && commandes?.length === 0) return null

  // La liste complète est la source de vérité de ces repères, y compris après correction.
  const liste = commandes ?? []
  const totalTTC = liste.reduce((somme, commande) => somme + Math.round(commande.totalTTC * 100), 0) / 100
  // Total monétaire seulement si chaque commande a une devise établie et que
  // toutes partagent la même : une devise inconnue n'est jamais remplacée par
  // celle du profil actuel, et deux devises ne s'additionnent pas.
  const devisesInconnues = liste.filter((commande) => !commande.contexte).length
  const devisesListe = new Set(liste.flatMap((commande) => (commande.contexte ? [commande.contexte.devise] : [])))
  const deviseTotal = devisesInconnues === 0 && devisesListe.size === 1 ? [...devisesListe][0] : null
  const resume = commandes === null ? null
    : liste.length === 0 || deviseTotal !== null
      ? `${liste.length} commande(s)${deviseTotal !== null ? ` · ${formatMontantDevise(totalTTC, deviseTotal)} TTC` : ""}`
      : devisesInconnues > 0
        ? `${liste.length} commande(s) · total non calculé : devise à préciser pour ${devisesInconnues} commande(s)`
        : `${liste.length} commande(s) · total non calculé : plusieurs devises`

  return (
    <section aria-labelledby={titreId}>
      <Card className="min-w-0 border-amber-200">
        <CardHeader>
          <CardTitle id={titreId}>Taux de TVA à préciser</CardTitle>
          <CardDescription>
            Commandes de la boutique, toutes périodes confondues. Vérifiez le taux de chaque ligne avant de confirmer.
            Les suggestions restent à vérifier.
          </CardDescription>
          {resume && <p className="text-sm font-medium" aria-live="polite">{resume}</p>}
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
          {chargement && <p role="status" className="text-sm text-muted-foreground">Chargement des commandes…</p>}
          {erreur && (
            <div className="space-y-2">
              <p role="alert" className="break-words text-sm text-destructive">{erreur}</p>
              <Button type="button" variant="outline" className="h-11" onClick={() => setRevision((v) => v + 1)}>Réessayer</Button>
            </div>
          )}
          {!chargement && !erreur && commandes?.map((commande) => (
            <CorrectionCommande
              key={commande.id}
              commande={commande}
              peutCorriger={peutCorriger}
              onCorrige={(id) => {
                setCommandes((precedentes) => precedentes?.filter((c) => c.id !== id) ?? [])
                onCorrection?.()
              }}
            />
          ))}
        </CardContent>
      </Card>
    </section>
  )
}
