"use client"

import * as React from "react"

import { AppHeader } from "@/components/shell/AppHeader"
import { messageErreurReponse } from "@/lib/api-erreur"
import { formatNombre, jourLocalISO } from "@/lib/accueil/classement"
import { appliquerElementsAuPlan } from "@/lib/accueil/plan-vignette"
import { calculerFenetreTravail, phraseFenetreTravail, type PhraseFenetre } from "@/lib/accueil/fenetre-travail"
import type { AccueilAujourdhui, ElementAujourdhui } from "@/lib/accueil/types"
import { symboleDevise } from "@/lib/format-utils"

import { AccueilEnTete } from "./AccueilEnTete"
import { NombreAnime } from "./NombreAnime"
import { Repere } from "./Repere"
import { RetourAncienAccueil } from "./RetourAncienAccueil"
import { TuileAgent, alerteMeteoPrioritaire } from "./TuileAgent"
import { TuileAujourdhui } from "./TuileAujourdhui"
import { TuileElevage } from "./TuileElevage"
import { RepereRangee, TuileGrille } from "./TuileGrille"
import { TuilePlan, TuilePlanVide } from "./TuilePlan"
import { TuileSemaine, type MeteoSemaine } from "./TuileSemaine"

/**
 * Accueil v2 « La ferme d'abord » (variante B, bento), livraison L2 :
 * disposition par défaut, rendu sous l'AppHeader actuel, sans ModuleTabBar.
 * Deux requêtes à l'ouverture : la composition serveur (liste du jour, plan,
 * repères, élevage) et la météo de la parcelle suivie (même clé locale que
 * la page Météo et le bandeau). Le mode Personnaliser arrive en L3.
 */

interface Chargement<T> {
  donnees: T | null
  erreur: string | null
  chargement: boolean
}

const INITIAL = { donnees: null, erreur: null, chargement: true }

/** Même clé que `HeaderMeteoWidget` et la page Météo : une seule parcelle suivie. */
const CLE_PARCELLE_METEO = "gleba_meteo_parcelle"

async function chargerMeteo(): Promise<MeteoSemaine | null> {
  const carteRes = await fetch("/api/carte", { cache: "no-store" })
  if (!carteRes.ok) throw new Error(await messageErreurReponse(carteRes))
  const parcelles = (await carteRes.json()) as { id: string; nom: string; centroidLat: number | null; centroidLng: number | null }[]
  const geolocalisees = parcelles.filter((p) => p.centroidLat && p.centroidLng)
  let demandee: string | null = null
  try {
    demandee = window.localStorage.getItem(CLE_PARCELLE_METEO)
  } catch {
    // stockage indisponible : première parcelle
  }
  const parcelle = geolocalisees.find((p) => p.id === demandee) ?? geolocalisees[0]
  if (!parcelle) return null
  const meteoRes = await fetch(`/api/meteo?parcelleId=${encodeURIComponent(parcelle.id)}`)
  if (!meteoRes.ok) throw new Error(await messageErreurReponse(meteoRes))
  const data = await meteoRes.json()
  return {
    parcelle: { id: parcelle.id, nom: parcelle.nom },
    actuelle: data.actuelle ?? null,
    previsions: Array.isArray(data.previsions) ? data.previsions : [],
    alertes: Array.isArray(data.alertes) ? data.alertes : [],
  }
}

export function Accueil() {
  const [accueil, setAccueil] = React.useState<Chargement<AccueilAujourdhui>>(INITIAL)
  const [meteo, setMeteo] = React.useState<Chargement<MeteoSemaine>>(INITIAL)
  const [tentative, setTentative] = React.useState(0)
  /** Lignes soldées depuis l'ouverture : le repère Semaine et le plan en tiennent compte. */
  const [soldees, setSoldees] = React.useState<Set<string>>(() => new Set())

  React.useEffect(() => {
    let annule = false
    setAccueil((etat) => ({ ...etat, chargement: true, erreur: null }))
    fetch("/api/accueil/aujourdhui", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(await messageErreurReponse(res))
        return (await res.json()) as AccueilAujourdhui
      })
      .then((donnees) => {
        if (!annule) {
          setAccueil({ donnees, erreur: null, chargement: false })
          setSoldees(new Set())
        }
      })
      .catch((e: unknown) => {
        if (!annule) setAccueil({ donnees: null, erreur: e instanceof Error ? e.message : "Erreur réseau", chargement: false })
      })
    return () => {
      annule = true
    }
  }, [tentative])

  const marquerSoldee = React.useCallback((e: ElementAujourdhui) => setSoldees((s) => new Set(s).add(e.id)), [])
  const restaurer = React.useCallback((e: ElementAujourdhui) => {
    setSoldees((s) => {
      if (!s.has(e.id)) return s
      const suivant = new Set(s)
      suivant.delete(e.id)
      return suivant
    })
  }, [])

  React.useEffect(() => {
    let annule = false
    chargerMeteo()
      .then((donnees) => {
        if (!annule) setMeteo({ donnees, erreur: null, chargement: false })
      })
      .catch((e: unknown) => {
        if (!annule) setMeteo({ donnees: null, erreur: e instanceof Error ? e.message : "Erreur réseau", chargement: false })
      })
    return () => {
      annule = true
    }
  }, [])

  const donnees = accueil.donnees
  const date = donnees?.date ?? jourLocalISO(new Date())
  const annee = donnees?.annee ?? new Date().getFullYear()
  const modules = donnees?.modules ?? []

  const fenetre: PhraseFenetre | null = React.useMemo(() => {
    if (!meteo.donnees || meteo.donnees.previsions.length === 0) return null
    return phraseFenetreTravail(calculerFenetreTravail(meteo.donnees.previsions), new Date())
  }, [meteo.donnees])

  const elementsOuverts = React.useMemo(
    () => (donnees?.elements ?? []).filter((e) => !soldees.has(e.id)),
    [donnees, soldees],
  )
  /** Lignes soldées de la semaine (semis, plantation, arrosage) : le repère Semaine descend d'autant. */
  const tachesSoldees = React.useMemo(
    () => (donnees?.elements ?? []).filter((e) => soldees.has(e.id) && e.action.mutation).length,
    [donnees, soldees],
  )
  const plan = React.useMemo(
    () => (donnees ? appliquerElementsAuPlan(donnees.plan, elementsOuverts) : null),
    [donnees, elementsOuverts],
  )

  const rm = donnees?.reperes.maraichage ?? null
  const rc = donnees?.reperes.comptabilite ?? null
  const rs = donnees?.reperes.semaine ? { ...donnees.reperes.semaine, aFaire: Math.max(0, donnees.reperes.semaine.aFaire - tachesSoldees) } : null
  const nonDemarrees = rm ? Math.max(0, rm.culturesPlanifiees - rm.culturesActives) : 0
  const ecartRecoltes = rm?.recoltes
    ? rm.recoltes.valeurN1 === 0
      ? <span>{rm.recoltes.valeur > 0 ? "première année de récoltes" : "aucune récolte pour l'instant"}</span>
      : rm.recoltes.ecartN1 > 0
      ? <span className="font-semibold text-prairie">+{formatNombre(rm.recoltes.ecartN1)} {rm.recoltes.unite} vs {annee - 1}</span>
      : rm.recoltes.ecartN1 < 0
        ? <span>{formatNombre(rm.recoltes.ecartN1)} {rm.recoltes.unite} vs {annee - 1}</span>
        : <span>comme en {annee - 1}</span>
    : undefined

  const elementCritique = elementsOuverts.find((e) => e.etat === "critique") ?? null
  const elevageActif = modules.includes("elevage")
  let rang = 0

  return (
    <div className="min-h-screen bg-papier font-ui text-encre">
      <AppHeader showLune />
      <main className="container mx-auto max-w-[1600px] space-y-4 px-4 pb-24 pt-5">
        <AccueilEnTete date={date} fenetre={fenetre} chargementFenetre={meteo.chargement} />

        <RepereRangee className="accueil-entree" style={{ "--rang": rang++ } as React.CSSProperties} aria-label="Repères">
          {(accueil.chargement || rm) && (
            <Repere
              libelle="Cultures en place"
              valeur={rm ? <NombreAnime valeur={rm.culturesActives} /> : null}
              unite={rm ? `/ ${rm.culturesPlanifiees}` : undefined}
              detail={rm ? `${nonDemarrees} non démarrée${nonDemarrees > 1 ? "s" : ""}` : undefined}
              vide={accueil.chargement ? "…" : undefined}
              href="/maraichage/cultures"
            />
          )}
          {(accueil.chargement || rm) && (
            <Repere
              libelle="Surface cultivée"
              valeur={rm ? <NombreAnime valeur={rm.surfaceCultiveeM2} /> : null}
              unite="m²"
              detail={rm ? `${rm.planchesCount} planche${rm.planchesCount > 1 ? "s" : ""}` : undefined}
              vide={accueil.chargement ? "…" : undefined}
              href="/maraichage/planches"
            />
          )}
          {(accueil.chargement || rm?.recoltes) && (
            <Repere
              libelle={`Récoltes ${annee}`}
              valeur={rm?.recoltes ? <NombreAnime valeur={rm.recoltes.valeur} format={(n) => formatNombre(n, 1)} /> : null}
              unite={rm?.recoltes?.unite}
              detail={ecartRecoltes}
              vide={accueil.chargement ? "…" : undefined}
              href="/maraichage/recoltes"
            />
          )}
          {(accueil.chargement || rc) && (
            <Repere
              libelle="Trésorerie"
              valeur={rc ? <NombreAnime valeur={rc.beneficeYtd} /> : null}
              unite={rc ? symboleDevise(rc.devise) : undefined}
              detail={rc ? `marge ${rc.margePercentYtd} %` : undefined}
              alerte={rc && rc.nbRevenusNonPayes > 0 ? `${rc.nbRevenusNonPayes} créance${rc.nbRevenusNonPayes > 1 ? "s" : ""}` : undefined}
              vide={accueil.chargement ? "…" : undefined}
              href="/comptabilite"
            />
          )}
          <Repere
            libelle="Semaine"
            valeur={rs ? <NombreAnime valeur={rs.aFaire} /> : null}
            unite={rs ? (rs.aFaire > 1 ? "tâches" : "tâche") : undefined}
            detail={rs && rs.enRetard === 0 ? "rien en retard" : undefined}
            alerte={rs && rs.enRetard > 0 ? `${rs.enRetard} en retard` : undefined}
            vide={accueil.chargement ? "…" : accueil.erreur ? "indisponible" : undefined}
            href="/taches"
          />
        </RepereRangee>

        <TuileGrille>
          <TuileAujourdhui
            key={donnees?.date ?? "chargement"}
            elements={donnees?.elements ?? []}
            sourcesEnErreur={donnees?.sourcesEnErreur ?? []}
            chargement={accueil.chargement}
            erreur={accueil.erreur}
            onReessayer={() => setTentative((n) => n + 1)}
            onElementFait={marquerSoldee}
            onElementRestaure={restaurer}
            rang={rang++}
          />
          {!accueil.chargement && donnees && donnees.plan.planches.length === 0 ? (
            <TuilePlanVide rang={rang++} />
          ) : (
            <TuilePlan plan={plan} nomFerme={donnees?.exploitation.nom ?? null} chargement={accueil.chargement} rang={rang++} />
          )}
          <TuileSemaine meteo={meteo.donnees} chargement={meteo.chargement} erreur={meteo.erreur} rang={rang++} />
          <TuileAgent
            alerteMeteo={alerteMeteoPrioritaire(meteo.donnees?.alertes)}
            elementCritique={elementCritique}
            chargement={accueil.chargement || meteo.chargement}
            rang={rang++}
          />
          {(elevageActif || (accueil.chargement && !donnees)) && (
            <TuileElevage elevage={donnees?.elevage ?? null} chargement={accueil.chargement} rang={rang++} />
          )}
        </TuileGrille>

        <p className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-ardoise">
          <span>Nouvel accueil, en essai : vos retours comptent, surtout « je ne retrouve plus… ».</span>
          <RetourAncienAccueil />
        </p>
      </main>
    </div>
  )
}
