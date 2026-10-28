"use client"

/**
 * Paramètres > Capteurs connectés (lot 1 du plan LoRaWAN/Meshtastic,
 * 2026-10-23) : connecteurs (jeton montré une fois), capteurs apparus à leur
 * première mesure, rattachement à une cible du compte par id, profil de
 * décodage, règle de chaque clé reçue (modifiable) et courbes.
 */
import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Plus, RefreshCw, Satellite, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SelectNatif } from "@/components/ui/select-natif"
import { GuideConnecteur } from "@/components/capteurs/GuideConnecteur"
import { CourbeCapteur } from "@/components/capteurs/CourbeCapteur"
import { useToast } from "@/hooks/use-toast"
import { useIsDemoAccount } from "@/hooks/use-is-demo"
import { useExploitation } from "@/hooks/use-exploitation"
import { confirmDialog } from "@/lib/global-dialog"
import { MESSAGES_REFUS_DEMO } from "@/lib/demo"
import { FUSEAUX_PROPOSES, TYPES_CONNECTEUR, TYPES_CONNECTEUR_IDS, type TypeConnecteur } from "@/lib/capteurs/connecteurs"
import { GRANDEURS, GRANDEURS_IDS, estGrandeur } from "@/lib/capteurs/grandeurs"
import { LIBELLES_PROFILS, PROFILS_IDS, lireCorrespondances, regleDe, type SourceRegle } from "@/lib/capteurs/decodage"
import { TYPES_CIBLE, type Cible, type OptionCible, type TypeCible } from "@/lib/capteurs/rattachement-types"

interface Connecteur {
  id: string
  nom: string
  type: TypeConnecteur
  jetonPrefixe: string
  fuseau: string
  actif: boolean
  derniereReceptionA: string | null
  nombreCapteurs: number
}

interface Capteur {
  id: string
  connecteurId: string
  identifiantExterne: string
  nom: string | null
  modele: string | null
  cible: Cible | null
  correspondances: Record<string, string | null> | null
  clesInconnues: string[]
  clesRecues: string[]
  refus: Array<{ cle: string; valeur: number; raison: string; a: string }> | null
  avertissement: string | null
  derniereVueA: string | null
  batterie: number | null
  rssi: number | null
  snr: number | null
  dernieresValeurs: Array<{ grandeur: string; valeur: number; unite: string; mesureeA: string }>
}

interface Donnees {
  estProprietaire: boolean
  connecteurs: Connecteur[]
  capteurs: Capteur[]
  cibles: OptionCible[]
}

type Agir = (action: () => Promise<unknown>, succes: string) => Promise<void>

const formatDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" })

function quand(iso: string | null): string {
  return iso ? formatDate.format(new Date(iso)) : "jamais"
}

function valeurCible(c: Cible | null): string {
  return c ? `${c.type}:${c.id}` : ""
}

function lireValeurCible(v: string): Cible | null {
  if (!v) return null
  const i = v.indexOf(":")
  const type = v.slice(0, i) as TypeCible
  const id = v.slice(i + 1)
  return type === "planche" || type === "parcelle" ? { type, id } : ({ type, id: Number(id) } as Cible)
}

const LIBELLES_SOURCE: Record<SourceRegle, string> = {
  manuelle: "choix manuel",
  profil: "profil du modèle",
  dictionnaire: "nom explicite",
  grandeur: "nom Gleba",
}

async function envoyer(url: string, method: string, corps?: unknown) {
  const r = await fetch(url, {
    method,
    headers: corps ? { "Content-Type": "application/json" } : undefined,
    body: corps ? JSON.stringify(corps) : undefined,
  }).catch(() => {
    throw new Error("Pas de connexion au serveur.")
  })
  const reponse = await r.json().catch(() => null)
  if (!r.ok) throw new Error(reponse?.error || "Action impossible")
  return reponse
}

export default function CapteursPage() {
  const { toast } = useToast()
  const estDemo = useIsDemoAccount()
  const { peutEcrire } = useExploitation()
  const [donnees, setDonnees] = React.useState<Donnees | null>(null)
  const [erreur, setErreur] = React.useState<string | null>(null)
  const [jetonAffiche, setJetonAffiche] = React.useState<{ connecteurId: string; type: TypeConnecteur; jeton: string } | null>(null)

  const charger = React.useCallback(() => {
    fetch("/api/capteurs")
      .then(async (r) => {
        const corps = await r.json().catch(() => null)
        if (!r.ok) throw new Error(corps?.error || "Capteurs indisponibles")
        setDonnees(corps)
        setErreur(null)
      })
      .catch((e) => setErreur(e instanceof Error ? e.message : "Capteurs indisponibles"))
  }, [])

  React.useEffect(charger, [charger])

  const agir: Agir = async (action, succes) => {
    try {
      await action()
      toast({ title: succes })
      charger()
    } catch (e) {
      toast({ title: "Erreur", description: e instanceof Error ? e.message : "Action impossible", variant: "destructive" })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/parametres?rubrique=meteo">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Paramètres
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Satellite className="h-6 w-6 text-slate-600" />
              <h1 className="text-xl font-bold">Capteurs connectés</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Comment ça marche</CardTitle>
            <CardDescription>
              Vos capteurs LoRaWAN passent par une passerelle et un serveur de réseau (The Things Network, ChirpStack) qui
              envoie leurs mesures à Gleba. Créez un connecteur pour ce serveur : chaque capteur apparaît ici à sa première
              mesure, puis se rattache à une planche, une parcelle, un arbre, un lot ou un élément du plan. Un outil de la
              ferme (Home Assistant, Node-RED, script) peut aussi envoyer ses mesures au format JSON générique. Meshtastic
              arrive dans une étape suivante.
            </CardDescription>
          </CardHeader>
        </Card>

        {erreur && <p className="text-sm text-red-700">{erreur}</p>}
        {!donnees && !erreur && <Loader2 className="h-8 w-8 animate-spin text-slate-400" />}

        {donnees && (
          <>
            <SectionConnecteurs
              donnees={donnees}
              estDemo={estDemo}
              jetonAffiche={jetonAffiche}
              onJeton={setJetonAffiche}
              agir={agir}
              recharger={charger}
            />
            <SectionCapteurs donnees={donnees} peutEcrire={peutEcrire} agir={agir} />
          </>
        )}
      </main>
    </div>
  )
}

function SectionConnecteurs({
  donnees,
  estDemo,
  jetonAffiche,
  onJeton,
  agir,
  recharger,
}: {
  donnees: Donnees
  estDemo: boolean
  jetonAffiche: { connecteurId: string; type: TypeConnecteur; jeton: string } | null
  onJeton: (j: { connecteurId: string; type: TypeConnecteur; jeton: string } | null) => void
  agir: Agir
  recharger: () => void
}) {
  const { toast } = useToast()
  const [nom, setNom] = React.useState("")
  const [type, setType] = React.useState<TypeConnecteur>("ttn")
  const [creation, setCreation] = React.useState(false)
  const peutGerer = donnees.estProprietaire && !estDemo

  const creer = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreation(true)
    try {
      const r = await envoyer("/api/capteurs/connecteurs", "POST", { nom, type })
      onJeton({ connecteurId: r.connecteur.id, type: r.connecteur.type, jeton: r.jeton })
      setNom("")
      recharger()
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Création impossible", variant: "destructive" })
    } finally {
      setCreation(false)
    }
  }

  const regenerer = async (c: Connecteur) => {
    const ok = await confirmDialog(
      `Régénérer le jeton de « ${c.nom} » ? L'ancien cessera aussitôt de fonctionner : il faudra reporter le nouveau dans ${TYPES_CONNECTEUR[c.type].court}.`,
      { variant: "warning" },
    )
    if (!ok) return
    try {
      const r = await envoyer(`/api/capteurs/connecteurs/${c.id}`, "PATCH", { regenererJeton: true })
      onJeton({ connecteurId: c.id, type: c.type, jeton: r.jeton })
      recharger()
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Régénération impossible", variant: "destructive" })
    }
  }

  const supprimer = async (c: Connecteur) => {
    const ok = await confirmDialog(
      `Supprimer « ${c.nom} » ? Ses ${c.nombreCapteurs} capteur(s) et toutes leurs mesures seront effacés.`,
      { variant: "destructive", confirmLabel: "Supprimer" },
    )
    if (!ok) return
    if (jetonAffiche?.connecteurId === c.id) onJeton(null)
    await agir(() => envoyer(`/api/capteurs/connecteurs/${c.id}`, "DELETE"), "Connecteur supprimé")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connecteurs</CardTitle>
        <CardDescription>
          Un connecteur par serveur de réseau ou par outil qui envoie des mesures. Son jeton fait entrer des données dans
          votre exploitation : il n&apos;est montré qu&apos;une fois.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {donnees.connecteurs.length === 0 && <p className="text-sm text-slate-500">Aucun connecteur pour l&apos;instant.</p>}
        {donnees.connecteurs.map((c) => (
          <div key={c.id} className="rounded-md border border-slate-200 bg-white p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{c.nom}</span>
              <Badge variant="outline">{TYPES_CONNECTEUR[c.type]?.court ?? c.type}</Badge>
              {!c.actif && <Badge variant="secondary">Désactivé</Badge>}
              <code className="text-xs text-slate-500">{c.jetonPrefixe}…</code>
            </div>
            <p className="text-xs text-slate-500">
              Dernière réception : {quand(c.derniereReceptionA)} · {c.nombreCapteurs} capteur(s)
            </p>
            {peutGerer ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => regenerer(c)}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Régénérer le jeton
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    agir(
                      () => envoyer(`/api/capteurs/connecteurs/${c.id}`, "PATCH", { actif: !c.actif }),
                      c.actif ? "Connecteur désactivé" : "Connecteur réactivé",
                    )
                  }
                >
                  {c.actif ? "Désactiver" : "Réactiver"}
                </Button>
                <Button size="sm" variant="outline" className="text-red-700" onClick={() => supprimer(c)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Supprimer
                </Button>
                <Label htmlFor={`fuseau-${c.id}`} className="text-xs text-slate-500">
                  Jours comptés à l&apos;heure de
                </Label>
                <SelectNatif
                  id={`fuseau-${c.id}`}
                  className="h-8 w-auto"
                  value={c.fuseau}
                  onChange={(e) =>
                    agir(() => envoyer(`/api/capteurs/connecteurs/${c.id}`, "PATCH", { fuseau: e.target.value }), "Fuseau enregistré")
                  }
                >
                  {[...new Set([c.fuseau, ...FUSEAUX_PROPOSES])].map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </SelectNatif>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Jours comptés à l&apos;heure de {c.fuseau}</p>
            )}
            {jetonAffiche?.connecteurId === c.id && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <GuideConnecteur type={jetonAffiche.type} jeton={jetonAffiche.jeton} />
                <Button size="sm" variant="ghost" className="mt-2" onClick={() => onJeton(null)}>
                  J&apos;ai copié le jeton
                </Button>
              </div>
            )}
          </div>
        ))}

        {estDemo && <p className="text-xs text-amber-800" role="note">{MESSAGES_REFUS_DEMO.connecteurCapteurs}</p>}
        {!donnees.estProprietaire && (
          <p className="text-xs text-slate-500">Seul le propriétaire de l&apos;exploitation crée et gère les connecteurs.</p>
        )}
        {peutGerer && (
          <form onSubmit={creer} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="connecteur-nom">Nom</Label>
              <Input id="connecteur-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="TTN de la ferme" maxLength={80} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="connecteur-type">Envoyé par</Label>
              <SelectNatif id="connecteur-type" value={type} onChange={(e) => setType(e.target.value as TypeConnecteur)}>
                {TYPES_CONNECTEUR_IDS.map((t) => (
                  <option key={t} value={t}>
                    {TYPES_CONNECTEUR[t].libelle}
                  </option>
                ))}
              </SelectNatif>
            </div>
            <Button type="submit" disabled={creation || !nom.trim()}>
              {creation ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Ajouter
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

function SectionCapteurs({ donnees, peutEcrire, agir }: { donnees: Donnees; peutEcrire: boolean; agir: Agir }) {
  const connecteurs = new Map(donnees.connecteurs.map((c) => [c.id, c]))
  return (
    <Card>
      <CardHeader>
        <CardTitle>Capteurs</CardTitle>
        <CardDescription>
          Un capteur apparaît à sa première mesure reçue. Rattachez-le à ce qu&apos;il mesure et vérifiez ce que Gleba lit
          dans chacune de ses valeurs : une valeur au nom ambigu reste en attente jusqu&apos;à ce que vous lui donniez un sens.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {donnees.capteurs.length === 0 && <p className="text-sm text-slate-500">Aucun capteur n&apos;a encore émis vers Gleba.</p>}
        {donnees.capteurs.map((c) => (
          <FicheCapteur
            key={c.id}
            capteur={c}
            connecteur={connecteurs.get(c.connecteurId)}
            cibles={donnees.cibles}
            peutEcrire={peutEcrire}
            agir={agir}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function FicheCapteur({
  capteur,
  connecteur,
  cibles,
  peutEcrire,
  agir,
}: {
  capteur: Capteur
  connecteur: Connecteur | undefined
  cibles: OptionCible[]
  peutEcrire: boolean
  agir: Agir
}) {
  const [nom, setNom] = React.useState(capteur.nom ?? "")
  // Aucune courbe chargée d'office : une par capteur au chargement ferait N requêtes.
  const [grandeur, setGrandeur] = React.useState("")
  const [jours, setJours] = React.useState(7)
  const url = `/api/capteurs/${capteur.id}`

  const parType = new Map<TypeCible, OptionCible[]>()
  for (const o of cibles) parType.set(o.type, [...(parType.get(o.type) ?? []), o])

  const correspondances = lireCorrespondances(capteur.correspondances)
  // Les noms de grandeurs Gleba ne valent que pour le format générique (decodage.ts, règle 4).
  const nomsGleba = connecteur?.type === "generique"
  const cles = [...new Set([...capteur.clesRecues, ...capteur.clesInconnues])]
  const modeleConnu = !capteur.modele || PROFILS_IDS.includes(capteur.modele)

  const supprimer = async () => {
    const ok = await confirmDialog(
      `Supprimer le capteur ${capteur.nom || capteur.identifiantExterne} et toutes ses mesures ? S'il émet encore, il reviendra « à rattacher ».`,
      { variant: "destructive", confirmLabel: "Supprimer" },
    )
    if (ok) await agir(() => envoyer(url, "DELETE"), "Capteur supprimé")
  }

  const changerRegle = (cle: string, choix: string) => {
    const corps =
      choix === "__auto"
        ? { retirerCorrespondances: [cle] }
        : { correspondances: { [cle]: choix === "__ignorer" ? null : choix } }
    return agir(() => envoyer(url, "PATCH", corps), "Règle enregistrée, appliquée aux prochaines mesures")
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{capteur.nom || capteur.identifiantExterne}</span>
        {!capteur.cible && <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">À rattacher</Badge>}
        {capteur.clesInconnues.length > 0 && (
          <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">{capteur.clesInconnues.length} valeur(s) à interpréter</Badge>
        )}
        {connecteur && <Badge variant="outline">{connecteur.nom}</Badge>}
      </div>
      <p className="text-xs text-slate-500">
        <code>{capteur.identifiantExterne}</code> · vu le {quand(capteur.derniereVueA)}
        {capteur.batterie !== null && ` · batterie ${Math.round(capteur.batterie)} %`}
        {capteur.rssi !== null && ` · signal ${capteur.rssi} dBm${capteur.snr !== null ? `, SNR ${capteur.snr} dB` : ""}`}
      </p>
      {capteur.avertissement && (
        <p className="rounded bg-amber-50 p-2 text-sm text-amber-900" role="note">
          {capteur.avertissement}
        </p>
      )}

      {capteur.dernieresValeurs.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {capteur.dernieresValeurs.map((v) => (
            <button
              key={v.grandeur}
              type="button"
              onClick={() => setGrandeur(grandeur === v.grandeur ? "" : v.grandeur)}
              aria-pressed={grandeur === v.grandeur}
              className={`rounded border p-2 text-left text-sm ${grandeur === v.grandeur ? "border-green-600 bg-green-50" : "border-slate-200"}`}
            >
              <span className="block text-xs text-slate-500">{estGrandeur(v.grandeur) ? GRANDEURS[v.grandeur].libelle : v.grandeur}</span>
              <span className="font-medium">
                {v.valeur} {v.unite}
              </span>
              <span className="block text-xs text-slate-400">{quand(v.mesureeA)} · voir la courbe</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Aucune mesure lisible depuis 30 jours.</p>
      )}

      <div className="space-y-1">
        <Label htmlFor={`historique-${capteur.id}`}>Consulter l&apos;historique</Label>
        <SelectNatif id={`historique-${capteur.id}`} value={grandeur} onChange={(e) => setGrandeur(e.target.value)}>
          <option value="">Choisir une grandeur</option>
          {GRANDEURS_IDS.map((g) => (
            <option key={g} value={g}>{GRANDEURS[g].libelle} ({GRANDEURS[g].unite})</option>
          ))}
        </SelectNatif>
      </div>

      {grandeur && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {[1, 7, 30, 90, 365].map((j) => (
              <Button key={j} size="sm" variant={jours === j ? "default" : "outline"} onClick={() => setJours(j)}>
                {j === 1 ? "24 h" : j === 365 ? "1 an" : `${j} j`}
              </Button>
            ))}
          </div>
          <CourbeCapteur capteurId={capteur.id} grandeur={grandeur} jours={jours} fuseau={connecteur?.fuseau ?? "Europe/Paris"} />
        </div>
      )}

      {peutEcrire && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor={`nom-${capteur.id}`}>Nom</Label>
            <Input
              id={`nom-${capteur.id}`}
              value={nom}
              maxLength={80}
              placeholder={capteur.identifiantExterne}
              onChange={(e) => setNom(e.target.value)}
              onBlur={() => {
                if (nom.trim() !== (capteur.nom ?? "")) agir(() => envoyer(url, "PATCH", { nom: nom.trim() || null }), "Nom enregistré")
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`cible-${capteur.id}`}>Mesure</Label>
            <SelectNatif
              id={`cible-${capteur.id}`}
              value={valeurCible(capteur.cible)}
              onChange={(e) => agir(() => envoyer(url, "PATCH", { cible: lireValeurCible(e.target.value) }), "Rattachement enregistré")}
            >
              <option value="">Non rattaché</option>
              {(Object.keys(TYPES_CIBLE) as TypeCible[]).map((t) =>
                parType.get(t)?.length ? (
                  <optgroup key={t} label={TYPES_CIBLE[t]}>
                    {parType.get(t)!.map((o) => (
                      <option key={`${o.type}:${o.id}`} value={`${o.type}:${o.id}`}>
                        {o.libelle}
                      </option>
                    ))}
                  </optgroup>
                ) : null,
              )}
            </SelectNatif>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`profil-${capteur.id}`}>Profil de décodage</Label>
            <SelectNatif
              id={`profil-${capteur.id}`}
              value={capteur.modele ?? ""}
              onChange={(e) => agir(() => envoyer(url, "PATCH", { modele: e.target.value || null }), "Profil enregistré")}
            >
              <option value="">Aucun profil</option>
              {!modeleConnu && <option value={capteur.modele!}>Annoncé : {capteur.modele} (sans profil Gleba)</option>}
              {PROFILS_IDS.map((p) => (
                <option key={p} value={p}>
                  {LIBELLES_PROFILS[p] ?? p}
                </option>
              ))}
            </SelectNatif>
          </div>
        </div>
      )}

      {cles.length > 0 && (
        <details open={capteur.clesInconnues.length > 0} className="rounded-md bg-slate-50 p-2">
          <summary className="cursor-pointer text-sm font-medium">Ce que Gleba lit dans les valeurs reçues ({cles.length})</summary>
          <div className="mt-2 space-y-2">
            {cles.map((cle) => {
              const regle = regleDe(cle, capteur.modele, correspondances, nomsGleba)
              const manuelle = Object.prototype.hasOwnProperty.call(correspondances, cle)
              const valeurChoix = !manuelle ? "__auto" : correspondances[cle] === null ? "__ignorer" : (correspondances[cle] as string)
              const auto = regleDe(cle, capteur.modele, {}, nomsGleba)
              return (
                <div key={cle} className="grid gap-2 sm:grid-cols-[1fr_1fr] sm:items-center">
                  <div>
                    <code className="text-xs">{cle}</code>
                    <span className={`block text-xs ${regle === undefined ? "text-amber-800" : "text-slate-500"}`}>
                      {regle === undefined
                        ? "À interpréter : valeur non enregistrée"
                        : regle === null
                          ? "Ignorée"
                          : `${GRANDEURS[regle.grandeur].libelle} (${GRANDEURS[regle.grandeur].unite}) · ${LIBELLES_SOURCE[regle.source]}`}
                    </span>
                  </div>
                  {peutEcrire && (
                    <SelectNatif aria-label={`Règle de ${cle}`} value={valeurChoix} onChange={(e) => changerRegle(cle, e.target.value)}>
                      <option value="__auto">
                        {auto ? `Automatique : ${GRANDEURS[auto.grandeur].libelle}` : "Automatique : rien de reconnu"}
                      </option>
                      {GRANDEURS_IDS.map((g) => (
                        <option key={g} value={g}>
                          {GRANDEURS[g].libelle} ({GRANDEURS[g].unite})
                        </option>
                      ))}
                      <option value="__ignorer">Ignorer cette valeur</option>
                    </SelectNatif>
                  )}
                </div>
              )
            })}
          </div>
        </details>
      )}

      {capteur.refus && capteur.refus.length > 0 && (
        <details className="text-xs text-slate-600">
          <summary className="cursor-pointer">Dernières valeurs refusées ({capteur.refus.length})</summary>
          <ul className="mt-1 space-y-0.5">
            {capteur.refus.map((r, i) => (
              <li key={i}>
                {quand(r.a)} · <code>{r.cle}</code> = {r.valeur} : {r.raison}
              </li>
            ))}
          </ul>
        </details>
      )}

      {peutEcrire && (
        <Button size="sm" variant="ghost" className="text-red-700" onClick={supprimer}>
          <Trash2 className="h-4 w-4 mr-1" /> Supprimer le capteur
        </Button>
      )}
    </div>
  )
}
