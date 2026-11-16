"use client"

/**
 * Gel sur la parcelle : ce qui s'est réellement passé à cet endroit sur trente
 * ans (archives SAFRAN de Météo-France), à la place d'une date moyenne par
 * grande zone climatique. Lit `/api/agroclimat/gel`.
 */

import * as React from "react"
import { Loader2, Snowflake } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAccesService } from "@/hooks/use-acces-service"
import type { GelParcelle as Gel } from "@/lib/agroclimat/gel-parcelle"
import type { RepereGel, StatistiquesGel } from "@/lib/agroclimat/gel"
import { libelleCase } from "@/lib/agroclimat/libelles"

/** L'import d'un historique prend quelques minutes : on redemande sans recharger la page. */
const ATTENTE_PREPARATION_MS = 30_000

interface GelParcelleProps {
  parcelleId: string
}

export function GelParcelle(props: GelParcelleProps) {
  const { acces } = useAccesService()
  return acces?.meteo ? <GelParcelleInterne {...props} /> : null
}

function GelParcelleInterne({ parcelleId }: GelParcelleProps) {
  const [gel, setGel] = React.useState<Gel | null>(null)
  const [erreur, setErreur] = React.useState<string | null>(null)

  React.useEffect(() => {
    let actif = true
    let minuterie: ReturnType<typeof setTimeout> | undefined

    async function charger() {
      try {
        const reponse = await fetch(`/api/agroclimat/gel?parcelleId=${encodeURIComponent(parcelleId)}`)
        const corps = await reponse.json().catch(() => null)
        if (!actif) return
        if (!reponse.ok) {
          setErreur(corps?.error ?? "Le gel de la parcelle n'a pas pu être lu.")
          return
        }
        setErreur(null)
        setGel(corps as Gel)
        if (corps?.etat === "en_preparation") minuterie = setTimeout(charger, ATTENTE_PREPARATION_MS)
      } catch {
        if (actif) setErreur("Le gel de la parcelle n'a pas pu être lu. Vérifiez la connexion, puis rechargez la page.")
      }
    }

    setGel(null)
    setErreur(null)
    charger()
    return () => {
      actif = false
      if (minuterie) clearTimeout(minuterie)
    }
  }, [parcelleId])

  // Rien à dire d'une exploitation sans parcelle géolocalisée : la page météo
  // l'explique déjà.
  if (gel?.etat === "sans_localisation") return null

  const nom = gel && "parcelle" in gel ? gel.parcelle.nom : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Snowflake className="h-5 w-5 text-eau" aria-hidden="true" />
          {nom ? `Gel sur ${nom}` : "Gel sur la parcelle"}
        </CardTitle>
        {gel?.etat === "pret" && gel.gelee.periode && (
          <CardDescription>
            Ce qui s&apos;est passé ici de {gel.gelee.periode.debut} à {gel.gelee.periode.fin}, d&apos;après les archives
            de Météo-France.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {erreur ? (
          <p className="text-argile" role="alert">
            {erreur}
          </p>
        ) : gel === null ? (
          <p className="flex items-center gap-2 text-ardoise">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Lecture de l&apos;historique…
          </p>
        ) : gel.etat === "en_preparation" ? (
          <p className="flex items-start gap-2 text-ardoise" role="status">
            <Loader2 className="mt-0.5 h-4 w-4 flex-none animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <span>
              Gleba récupère trente ans de températures de cette parcelle auprès de Météo-France. Comptez quelques
              minutes : les dates s&apos;afficheront ici sans recharger la page.
            </span>
          </p>
        ) : gel.etat === "hors_couverture" ? (
          <p className="text-ardoise">
            L&apos;historique de gel n&apos;existe que pour la France métropolitaine : cette parcelle est en dehors des
            archives de Météo-France utilisées ici.
          </p>
        ) : gel.etat === "indisponible" ? (
          <p className="text-ardoise">
            L&apos;historique de cette parcelle n&apos;a pas pu être récupéré auprès de Météo-France. Gleba réessaie
            chaque nuit, il n&apos;y a rien à faire de votre côté.
          </p>
        ) : gel.etat === "pret" ? (
          <GelPret gel={gel} />
        ) : null}
      </CardContent>
    </Card>
  )
}

function GelPret({ gel }: { gel: Extract<Gel, { etat: "pret" }> }) {
  const { gelee, forteGelee } = gel
  if (gelee.printemps.annees === 0) {
    return <p className="text-ardoise">L&apos;historique de cette parcelle est encore trop court pour situer le gel.</p>
  }

  return (
    <>
      {gel.parcelle.exemple && (
        <p className="rounded-lg border border-paille bg-paille-doux p-3 text-encre">
          Cette parcelle est encore à l&apos;emplacement d&apos;exemple, à Paris : ces dates ne sont pas celles de votre
          ferme. Déplacez-la sur la carte pour lire votre gel.
        </p>
      )}

      <div className="tabular-nums">
        <div className="hidden grid-cols-[minmax(0,1.3fr)_1fr_1fr] gap-x-3 border-b border-lin pb-2 text-xs font-medium text-ardoise sm:grid" aria-hidden="true">
          <span />
          <span>{LIBELLE_MEDIANE}</span>
          <span>{LIBELLE_PRUDENCE}</span>
        </div>
        <LigneRepere titre="Dernière gelée de printemps" repere={gelee.printemps} sens="avant le" />
        <LigneRepere titre="Première gelée d'automne" repere={gelee.automne} sens="après le" />
      </div>

      <ul className="space-y-1.5 text-ardoise">
        {phrasePlantation(forteGelee) && <li>{phrasePlantation(forteGelee)}</li>}
        {gelee.saisonSansGelJours !== null && (
          <li>
            Saison sans gel : <strong className="font-medium text-encre">{gelee.saisonSansGelJours} jours</strong>, une
            année sur deux.
          </li>
        )}
        {gelee.joursDeGelParAn !== null && (
          <li>
            Jours de gel :{" "}
            <strong className="font-medium text-encre">{formatNombre(gelee.joursDeGelParAn)} par an</strong> en moyenne.
          </li>
        )}
        {(gelee.printemps.extreme || gelee.automne.extreme) && (
          <li>
            Records :
            {gelee.printemps.extreme &&
              ` dernière gelée un ${libelleCase(gelee.printemps.extreme.case)} (${gelee.printemps.extreme.annee})`}
            {gelee.printemps.extreme && gelee.automne.extreme && ","}
            {gelee.automne.extreme &&
              ` première gelée un ${libelleCase(gelee.automne.extreme.case)} (${gelee.automne.extreme.annee})`}
            .
          </li>
        )}
      </ul>

      <p className="border-t border-lin pt-3 text-xs text-ardoise">
        Température de l&apos;air sous abri, à 2 m, sur une maille de 8 km. Un bas-fond, ou le ras du sol par nuit
        claire, gèle plus souvent et plus tard. Source : SAFRAN, Météo-France.
      </p>
    </>
  )
}

const LIBELLE_MEDIANE = "Une année sur deux"
const LIBELLE_PRUDENCE = "Neuf années sur dix"

/**
 * Un repère de gel et ses deux dates. Sur téléphone, le titre prend la ligne et
 * chaque date porte son libellé ; à partir de `sm`, les libellés montent dans
 * l'en-tête de colonnes (masqué aux lecteurs d'écran, qui gardent ceux d'ici).
 */
function LigneRepere({ titre, repere, sens }: { titre: string; repere: RepereGel; sens: "avant le" | "après le" }) {
  const valeur = (index: number | null, vide: string) =>
    index === null ? <span className="font-normal text-ardoise">{vide}</span> : `${sens} ${libelleCase(index)}`
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-b border-lin py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1.3fr)_1fr_1fr]">
      <h3 className="col-span-2 text-ardoise sm:col-span-1">{titre}</h3>
      <dl className="col-span-2 grid grid-cols-2 gap-x-3 sm:contents">
        <div>
          <dt className="text-xs text-ardoise sm:sr-only">{LIBELLE_MEDIANE}</dt>
          <dd className="font-medium text-encre">{valeur(repere.mediane, "pas de gelée")}</dd>
        </div>
        <div>
          <dt className="text-xs text-ardoise sm:sr-only">{LIBELLE_PRUDENCE}</dt>
          <dd className="font-medium text-encre">{valeur(repere.prudence, "gel trop rare")}</dd>
        </div>
      </dl>
    </div>
  )
}

/** Le repère le plus utile pour planter : après quelle date une forte gelée devient exceptionnelle. */
function phrasePlantation(forteGelee: StatistiquesGel): string | null {
  const { printemps } = forteGelee
  if (printemps.annees === 0) return null
  if (printemps.prudence === null) return "Forte gelée (−2 °C ou moins) : exceptionnelle sur cette parcelle."
  return `Forte gelée (−2 °C ou moins) : plus aucune après le ${libelleCase(printemps.prudence)}, neuf années sur dix.`
}

function formatNombre(valeur: number): string {
  return valeur.toLocaleString("fr-FR", { maximumFractionDigits: 0 })
}
