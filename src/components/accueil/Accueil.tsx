"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { CloudSun, LayoutGrid } from "lucide-react"
import Link from "next/link"

import { UserMenu } from "@/components/auth/UserMenu"
import { messageErreurReponse } from "@/lib/api-erreur"
import { formatNombre, jourLocalISO } from "@/lib/accueil/classement"
import {
  IDS_REPERES,
  IDS_TUILES,
  LIBELLES,
  deplacer,
  dispositionDefaut,
  masques,
  memeDisposition,
  remettre,
  retirer,
  visiblesSelonModules,
  type AccueilDisposition,
  type IdRepere,
  type IdTuile,
} from "@/lib/accueil/disposition"
import { calculerFenetreTravail, phraseFenetreTravail, type PhraseFenetre } from "@/lib/accueil/fenetre-travail"
import { appliquerElementsAuPlan } from "@/lib/accueil/plan-vignette"
import type { AccueilAujourdhui, ElementAujourdhui } from "@/lib/accueil/types"
import { symboleDevise } from "@/lib/format-utils"
import { toast } from "@/hooks/use-toast"
import { useAccueilDisposition } from "@/hooks/use-accueil-disposition"
import { cn } from "@/lib/utils"

import { AccueilEnTete } from "./AccueilEnTete"
import { BarreCommande } from "./BarreCommande"
import { CLASSES_BOUTON, CLASSES_BOUTON_PRINCIPAL } from "./boutons"
import { NavigationBasse } from "./NavigationBasse"
import { NombreAnime } from "./NombreAnime"
import { BandeMasques, Personnalisable } from "./Personnalisable"
import { Repere } from "./Repere"
import { RetourAncienAccueil } from "./RetourAncienAccueil"
import { TuileAgent, alerteMeteoPrioritaire } from "./TuileAgent"
import { TuileAujourdhui } from "./TuileAujourdhui"
import { TuileElevage } from "./TuileElevage"
import { RepereRangee, TuileGrille } from "./TuileGrille"
import { TuilePlan, TuilePlanVide } from "./TuilePlan"
import { TuileSemaine, type MeteoSemaine } from "./TuileSemaine"

/**
 * Accueil v2 « La ferme d'abord » (variante B, bento) : rail de navigation
 * et rangée du haut (barre de commande, météo, compte) sur bureau,
 * navigation basse sur téléphone ; repères puis grille, dans la disposition
 * du compte ; mode « Personnaliser » (déplacer, masquer, remettre,
 * réinitialiser), enregistré pour la personne.
 */

interface Chargement<T> {
  donnees: T | null
  erreur: string | null
  chargement: boolean
}

const INITIAL = { donnees: null, erreur: null, chargement: true }

/** Même clé que `HeaderMeteoWidget` et la page Météo : une seule parcelle suivie. */
const CLE_PARCELLE_METEO = "gleba_meteo_parcelle"

/** Largeur et hauteur de chaque tuile dans la grille de douze colonnes. */
const PLACE_TUILE: Record<IdTuile, string> = {
  aujourdhui: "lg:col-span-7 lg:row-span-2",
  plan: "lg:col-span-5",
  semaine: "lg:col-span-5",
  agent: "lg:col-span-7",
  elevage: "lg:col-span-5",
}

async function chargerMeteo(): Promise<(MeteoSemaine & { nbParcelles: number }) | null> {
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
    nbParcelles: parcelles.length,
  }
}

function MeteoResume({ meteo, className }: { meteo: MeteoSemaine | null; className?: string }) {
  if (!meteo?.actuelle) return null
  const a = meteo.actuelle
  return (
    <Link href="/meteo" className={cn("flex items-center gap-2.5 text-sm text-encre hover:underline underline-offset-2", className)} title="Ouvrir la météo">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-eau-doux text-eau" aria-hidden>
        <CloudSun className="h-5 w-5" />
      </span>
      <span className="leading-tight">
        <b className="font-semibold">{Math.round(a.temperature)} °C</b>
        <span className="text-ardoise"> · {a.weatherDescription} · {a.humidity} %</span>
        <br />
        <span className="text-ardoise">
          {meteo.parcelle.nom} · vent {Math.round(a.windSpeed)} km/h
        </span>
      </span>
    </Link>
  )
}

export function Accueil() {
  const { data: session } = useSession()
  const [accueil, setAccueil] = React.useState<Chargement<AccueilAujourdhui>>(INITIAL)
  const [meteo, setMeteo] = React.useState<Chargement<MeteoSemaine & { nbParcelles: number }>>(INITIAL)
  const [tentative, setTentative] = React.useState(0)
  /** Lignes soldées depuis l'ouverture : le repère Semaine et le plan en tiennent compte. */
  const [soldees, setSoldees] = React.useState<Set<string>>(() => new Set())

  // Disposition par compte et mode Personnaliser
  const { disposition, enregistrer } = useAccueilDisposition()
  const [edition, setEdition] = React.useState(false)
  const [brouillon, setBrouillon] = React.useState<AccueilDisposition | null>(null)
  const dispositionAffichee = brouillon ?? disposition

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

  const marquerSoldee = React.useCallback((e: ElementAujourdhui) => setSoldees((s) => new Set(s).add(e.id)), [])
  const restaurer = React.useCallback((e: ElementAujourdhui) => {
    setSoldees((s) => {
      if (!s.has(e.id)) return s
      const suivant = new Set(s)
      suivant.delete(e.id)
      return suivant
    })
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
  const chargementRepere = accueil.chargement ? "…" : undefined

  // ── Mode Personnaliser ──
  const commencerEdition = () => {
    setBrouillon({ reperes: [...disposition.reperes], tuiles: [...disposition.tuiles] })
    setEdition(true)
  }
  const terminerEdition = async () => {
    const cible = brouillon ?? disposition
    setEdition(false)
    setBrouillon(null)
    if (memeDisposition(cible, disposition)) return
    const r = await enregistrer(cible)
    if (!r.ok) toast({ title: "Disposition non enregistrée", description: r.error ?? "Erreur réseau" })
    else toast({ title: "Disposition enregistrée", description: "Votre accueil garde cet ordre sur tous vos appareils." })
  }
  const reinitialiser = () => setBrouillon(dispositionDefaut())
  const majBrouillon = (fn: (d: AccueilDisposition) => AccueilDisposition) =>
    setBrouillon((b) => fn(b ?? { reperes: [...disposition.reperes], tuiles: [...disposition.tuiles] }))

  // Repères et tuiles réellement affichés : la disposition, moins les modules désactivés.
  const reperesVisibles = visiblesSelonModules(dispositionAffichee.reperes, modules.length ? modules : ["maraichage", "verger", "elevage", "comptabilite"])
  const tuilesVisibles = visiblesSelonModules(dispositionAffichee.tuiles, modules.length ? modules : ["maraichage", "verger", "elevage", "comptabilite"])
  const reperesMasques = masques(IDS_REPERES, dispositionAffichee.reperes, modules)
  const tuilesMasquees = masques(IDS_TUILES, dispositionAffichee.tuiles, modules)

  const rendreRepere = (id: IdRepere): React.ReactNode => {
    switch (id) {
      case "repere:cultures":
        return (
          <Repere libelle="Cultures en place" valeur={rm ? <NombreAnime valeur={rm.culturesActives} /> : null} unite={rm ? `/ ${rm.culturesPlanifiees}` : undefined} detail={rm ? `${nonDemarrees} non démarrée${nonDemarrees > 1 ? "s" : ""}` : undefined} vide={chargementRepere} href="/maraichage/cultures" />
        )
      case "repere:surface":
        return (
          <Repere libelle="Surface cultivée" valeur={rm ? <NombreAnime valeur={rm.surfaceCultiveeM2} /> : null} unite="m²" detail={rm ? `${rm.planchesCount} planche${rm.planchesCount > 1 ? "s" : ""}` : undefined} vide={chargementRepere} href="/maraichage/planches" />
        )
      case "repere:recoltes":
        return (
          <Repere libelle={`Récoltes ${annee}`} valeur={rm?.recoltes ? <NombreAnime valeur={rm.recoltes.valeur} format={(n) => formatNombre(n, 1)} /> : null} unite={rm?.recoltes?.unite} detail={ecartRecoltes} vide={chargementRepere} href="/maraichage/recoltes" />
        )
      case "repere:tresorerie":
        return (
          <Repere libelle="Trésorerie" valeur={rc ? <NombreAnime valeur={rc.beneficeYtd} /> : null} unite={rc ? symboleDevise(rc.devise) : undefined} detail={rc ? `marge ${rc.margePercentYtd} %` : undefined} alerte={rc && rc.nbRevenusNonPayes > 0 ? `${rc.nbRevenusNonPayes} créance${rc.nbRevenusNonPayes > 1 ? "s" : ""}` : undefined} vide={chargementRepere} href="/comptabilite" />
        )
      case "repere:semaine":
        return (
          <Repere libelle="Semaine" valeur={rs ? <NombreAnime valeur={rs.aFaire} /> : null} unite={rs ? (rs.aFaire > 1 ? "tâches" : "tâche") : undefined} detail={rs && rs.enRetard === 0 ? "rien en retard" : undefined} alerte={rs && rs.enRetard > 0 ? `${rs.enRetard} en retard` : undefined} vide={accueil.chargement ? "…" : accueil.erreur ? "indisponible" : undefined} href="/taches" />
        )
    }
  }

  const rendreTuile = (id: IdTuile, rang: number): React.ReactNode => {
    switch (id) {
      case "aujourdhui":
        return (
          <TuileAujourdhui key={donnees?.date ?? "chargement"} elements={donnees?.elements ?? []} sourcesEnErreur={donnees?.sourcesEnErreur ?? []} chargement={accueil.chargement} erreur={accueil.erreur} onReessayer={() => setTentative((n) => n + 1)} onElementFait={marquerSoldee} onElementRestaure={restaurer} rang={rang} />
        )
      case "plan":
        return !accueil.chargement && donnees && donnees.plan.planches.length === 0 ? (
          <TuilePlanVide rang={rang} />
        ) : (
          <TuilePlan plan={plan} nomFerme={donnees?.exploitation.nom ?? null} chargement={accueil.chargement} rang={rang} />
        )
      case "semaine":
        return <TuileSemaine meteo={meteo.donnees} chargement={meteo.chargement} erreur={meteo.erreur} rang={rang} />
      case "agent":
        return <TuileAgent alerteMeteo={alerteMeteoPrioritaire(meteo.donnees?.alertes)} elementCritique={elementCritique} chargement={accueil.chargement || meteo.chargement} rang={rang} />
      case "elevage":
        return <TuileElevage elevage={donnees?.elevage ?? null} chargement={accueil.chargement} rang={rang} />
    }
  }

  return (
    <div className="min-h-screen bg-papier font-ui text-encre">
      <div className="min-w-0">
        <main className="mx-auto max-w-[1400px] space-y-4 px-4 pb-28 pt-4 lg:px-7 lg:pb-8 lg:pt-5">
          {/* Rangée du haut : barre de commande, météo, compte */}
          <div className="flex items-center gap-3">
            <BarreCommande className="max-w-[560px] flex-1" compact />
            <MeteoResume meteo={meteo.donnees} className="ml-auto hidden md:flex" />
            {session?.user && <UserMenu user={session.user} />}
          </div>

          <AccueilEnTete
            date={date}
            fenetre={fenetre}
            chargementFenetre={meteo.chargement}
            temperature={meteo.donnees?.actuelle?.temperature ?? null}
            actions={
              !edition && (
                <button type="button" onClick={commencerEdition} className={`${CLASSES_BOUTON} px-2.5`} aria-label="Personnaliser l'accueil" title="Personnaliser l'accueil">
                  <LayoutGrid className="h-4 w-4 text-ardoise" aria-hidden />
                </button>
              )
            }
          />

          {edition && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-lin bg-sauge-doux px-4 py-2.5 text-[13.5px] accueil-entree" role="region" aria-label="Personnaliser l'accueil">
              <b className="font-semibold text-foret">Personnaliser l&rsquo;accueil</b>
              <span className="text-ardoise">Les flèches déplacent, l&rsquo;œil masque. Enregistré pour votre compte.</span>
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={reinitialiser} className={`${CLASSES_BOUTON} min-h-9 px-3 text-xs`}>
                  Réinitialiser
                </button>
                <button type="button" onClick={terminerEdition} className={`${CLASSES_BOUTON_PRINCIPAL} min-h-9 px-3 text-xs`}>
                  Terminer
                </button>
              </div>
            </div>
          )}

          {(reperesVisibles.length > 0 || edition) && (
            <RepereRangee className="accueil-entree" style={{ "--rang": 0 } as React.CSSProperties} aria-label="Repères">
              {reperesVisibles.map((id, i) => (
                <Personnalisable
                  key={id}
                  libelle={LIBELLES[id]}
                  edition={edition}
                  axe="rangee"
                  premier={i === 0}
                  dernier={i === reperesVisibles.length - 1}
                  onMonter={() => majBrouillon((d) => ({ ...d, reperes: deplacer(d.reperes, id, -1) }))}
                  onDescendre={() => majBrouillon((d) => ({ ...d, reperes: deplacer(d.reperes, id, 1) }))}
                  onMasquer={() => majBrouillon((d) => ({ ...d, reperes: retirer(d.reperes, id) }))}
                  className="rounded-xl"
                >
                  {rendreRepere(id)}
                </Personnalisable>
              ))}
              {edition && (
                <BandeMasques
                  titre="Repères masqués"
                  elements={reperesMasques.map((id) => ({ id, libelle: LIBELLES[id] }))}
                  onRemettre={(id) => majBrouillon((d) => ({ ...d, reperes: remettre(d.reperes, id as IdRepere, IDS_REPERES) }))}
                  className="rounded-xl sm:col-span-3 lg:col-span-2"
                />
              )}
            </RepereRangee>
          )}

          <TuileGrille>
            {tuilesVisibles.map((id, i) => (
              <Personnalisable
                key={id}
                libelle={LIBELLES[id]}
                edition={edition}
                premier={i === 0}
                dernier={i === tuilesVisibles.length - 1}
                onMonter={() => majBrouillon((d) => ({ ...d, tuiles: deplacer(d.tuiles, id, -1) }))}
                onDescendre={() => majBrouillon((d) => ({ ...d, tuiles: deplacer(d.tuiles, id, 1) }))}
                onMasquer={() => majBrouillon((d) => ({ ...d, tuiles: retirer(d.tuiles, id) }))}
                className={cn("col-span-1", PLACE_TUILE[id])}
              >
                {rendreTuile(id, i + 1)}
              </Personnalisable>
            ))}
            {edition && (
              <BandeMasques
                titre="Tuiles masquées"
                elements={tuilesMasquees.map((id) => ({ id, libelle: LIBELLES[id] }))}
                onRemettre={(id) => majBrouillon((d) => ({ ...d, tuiles: remettre(d.tuiles, id as IdTuile, IDS_TUILES) }))}
                className="col-span-1 min-h-[120px] lg:col-span-5"
              />
            )}
          </TuileGrille>

          <p className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-ardoise">
            <span>Nouvel accueil, en essai : vos retours comptent, surtout « je ne retrouve plus… ».</span>
            <RetourAncienAccueil />
          </p>
        </main>
        <NavigationBasse className="lg:hidden" />
      </div>
    </div>
  )
}
