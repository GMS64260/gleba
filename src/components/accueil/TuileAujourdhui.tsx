"use client"

import * as React from "react"
import Link from "next/link"

import { annulerMutation, executerMutation } from "@/lib/accueil/client"
import { sousTitreAujourdhui } from "@/lib/accueil/classement"
import type { ElementAujourdhui } from "@/lib/accueil/types"
import { notifierEnregistrement } from "@/lib/notifications-ecran"
import { toast } from "@/hooks/use-toast"

import { CLASSES_LIEN_DISCRET } from "./boutons"
import { CocheAnimee } from "./CocheAnimee"
import { LigneRegistre } from "./LigneRegistre"
import { PastilleEtat } from "./PastilleEtat"
import { Tuile, TuileVide } from "./Tuile"

/** Lignes visibles avant « Voir les N autres ». */
export const LIGNES_VISIBLES = 8
/** Une ligne cochée reste visible ce temps-là, avec « Annuler », avant de se replier. */
export const DELAI_REPLI_MS = 5000
/** Durée du repli (classe `accueil-sortie`, --d-fast) avant retrait du DOM. */
const DUREE_SORTIE_MS = 140

export interface TuileAujourdhuiProps {
  elements: ElementAujourdhui[]
  /** Sources qui n'ont pas pu être lues : un état vide ne peut pas être affirmé. */
  sourcesEnErreur: string[]
  chargement: boolean
  erreur: string | null
  onReessayer?: () => void
  /** La ligne a quitté la liste (enregistrement confirmé, délai écoulé). */
  onElementFait?: (element: ElementAujourdhui) => void
  /** L'inverse a été rejoué : la ligne doit revenir. */
  onElementRestaure?: (element: ElementAujourdhui) => void
  rang?: number
}

type Phase = "en-cours" | "fait" | "sortie"

function pastillePour(e: ElementAujourdhui): React.ReactNode {
  if (e.etat === "critique") return <PastilleEtat etat="critique" libelle="Urgent" className="hidden sm:inline-flex" />
  if (e.etat === "attention") {
    return (
      <PastilleEtat etat="attention" libelle={e.retardJours > 0 ? "En retard" : "À faire"} className="hidden sm:inline-flex" />
    )
  }
  return null
}

export function TuileAujourdhui({
  elements,
  sourcesEnErreur,
  chargement,
  erreur,
  onReessayer,
  onElementFait,
  onElementRestaure,
  rang,
}: TuileAujourdhuiProps) {
  const [toutVoir, setToutVoir] = React.useState(false)
  const [phases, setPhases] = React.useState<Record<string, Phase>>({})
  const [retires, setRetires] = React.useState<Set<string>>(() => new Set())
  const minuteries = React.useRef<Map<string, number[]>>(new Map())

  React.useEffect(() => {
    const m = minuteries.current
    return () => {
      m.forEach((ids) => ids.forEach((id) => window.clearTimeout(id)))
    }
  }, [])

  const poserPhase = (id: string, phase: Phase | null) =>
    setPhases((p) => {
      const suivant = { ...p }
      if (phase === null) delete suivant[id]
      else suivant[id] = phase
      return suivant
    })

  const annulerMinuteries = (id: string) => {
    minuteries.current.get(id)?.forEach((t) => window.clearTimeout(t))
    minuteries.current.delete(id)
  }

  const programmerRepli = (e: ElementAujourdhui) => {
    const t1 = window.setTimeout(() => {
      poserPhase(e.id, "sortie")
      const t2 = window.setTimeout(() => {
        setRetires((r) => new Set(r).add(e.id))
        poserPhase(e.id, null)
        minuteries.current.delete(e.id)
        onElementFait?.(e)
      }, DUREE_SORTIE_MS)
      minuteries.current.set(e.id, [t2])
    }, DELAI_REPLI_MS)
    minuteries.current.set(e.id, [t1])
  }

  const annuler = async (e: ElementAujourdhui) => {
    const mutation = e.action.mutation
    if (!mutation) return
    annulerMinuteries(e.id)
    const resultat = await annulerMutation(mutation)
    if (!resultat.ok) {
      toast({ variant: "destructive", title: "Annulation impossible", description: resultat.error ?? "L'enregistrement est conservé." })
      // La ligne est déjà cochée : on reprend le repli là où il en était.
      if (!retires.has(e.id)) programmerRepli(e)
      return
    }
    poserPhase(e.id, null)
    setRetires((r) => {
      if (!r.has(e.id)) return r
      const suivant = new Set(r)
      suivant.delete(e.id)
      return suivant
    })
    onElementRestaure?.(e)
  }

  const marquerFait = async (e: ElementAujourdhui) => {
    const mutation = e.action.mutation
    if (!mutation || phases[e.id]) return
    poserPhase(e.id, "en-cours")
    const resultat = await executerMutation(mutation)
    if (!resultat.ok) {
      poserPhase(e.id, null)
      toast({ variant: "destructive", title: "Non enregistré", description: resultat.error ?? "Erreur réseau" })
      return
    }
    poserPhase(e.id, "fait")
    notifierEnregistrement({ titre: mutation.titre, detail: mutation.detail, annuler: () => annuler(e) })
    programmerRepli(e)
  }

  const ouverts = elements.filter((e) => !retires.has(e.id))
  const visibles = toutVoir ? ouverts : ouverts.slice(0, LIGNES_VISIBLES)
  const reste = ouverts.length - visibles.length

  let corps: React.ReactNode
  if (chargement) {
    corps = (
      <ul className="divide-y divide-lin-doux" aria-label="Chargement de la liste du jour">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="flex items-center gap-3 px-3 py-3">
            <span className="h-9 w-1 rounded-sm bg-lin" />
            <span className="h-4 w-2/3 rounded bg-lin-doux motion-safe:animate-pulse" />
          </li>
        ))}
      </ul>
    )
  } else if (erreur) {
    corps = (
      <TuileVide
        message={`Impossible de lire la liste du jour : ${erreur}`}
        action={
          onReessayer && (
            <button type="button" onClick={onReessayer} className={CLASSES_LIEN_DISCRET}>
              Réessayer
            </button>
          )
        }
      />
    )
  } else if (ouverts.length === 0) {
    corps =
      sourcesEnErreur.length > 0 ? (
        <TuileVide
          message={`Rien à signaler dans ce qui a pu être lu. Sources indisponibles : ${sourcesEnErreur.join(", ")}.`}
          action={
            onReessayer && (
              <button type="button" onClick={onReessayer} className={CLASSES_LIEN_DISCRET}>
                Réessayer
              </button>
            )
          }
        />
      ) : (
        <TuileVide
          message="Rien d'urgent aujourd'hui. Le calendrier garde le détail de la semaine."
          action={
            <Link href="/taches" className={CLASSES_LIEN_DISCRET}>
              Ouvrir le calendrier
            </Link>
          }
        />
      )
  } else {
    corps = (
      <>
        <div role="list">
          {visibles.map((e) => {
            const phase = phases[e.id]
            if (phase === "fait" || phase === "sortie") {
              return (
                <LigneRegistre
                  key={e.id}
                  role="listitem"
                  etat="ok"
                  titre={e.titre}
                  meta={e.meta}
                  className={phase === "sortie" ? "accueil-sortie" : undefined}
                  pastille={<PastilleEtat etat="ok" libelle="Fait" icone={CocheAnimee} />}
                  action={{ libelle: "Annuler", onClick: () => annuler(e) }}
                />
              )
            }
            return (
              <LigneRegistre
                key={e.id}
                role="listitem"
                etat={e.etat}
                titre={e.titre}
                meta={e.meta}
                pastille={pastillePour(e)}
                action={
                  e.action.mutation
                    ? { libelle: e.action.libelle, onClick: () => marquerFait(e), disabled: phase === "en-cours" }
                    : { libelle: e.action.libelle, href: e.action.href }
                }
              />
            )
          })}
        </div>
        {reste > 0 && (
          <div className="border-t border-lin-doux px-3 py-1">
            <button type="button" onClick={() => setToutVoir(true)} className={CLASSES_LIEN_DISCRET}>
              Voir {reste === 1 ? "la dernière" : `les ${reste} autres`}
            </button>
          </div>
        )}
        {sourcesEnErreur.length > 0 && (
          <p className="border-t border-lin-doux px-4 py-2 text-xs text-ardoise">
            Non lu aujourd&rsquo;hui : {sourcesEnErreur.join(", ")}.
          </p>
        )}
      </>
    )
  }

  return (
    <Tuile
      idTuile="aujourdhui"
      titre="Aujourd'hui"
      sousTitre={chargement ? "lecture en cours" : erreur ? "indisponible" : sousTitreAujourdhui(ouverts.length)}
      largeur={7}
      hauteur={2}
      rang={rang}
    >
      {corps}
    </Tuile>
  )
}
