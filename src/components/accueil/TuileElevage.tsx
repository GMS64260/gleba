import * as React from "react"
import Link from "next/link"

import { etatEcheance, hrefEcheance } from "@/lib/accueil/elevage"
import type { ElevageAccueil } from "@/lib/accueil/types"

import { CLASSES_LIEN_DISCRET } from "./boutons"
import { LigneRegistre } from "./LigneRegistre"
import { Tuile } from "./Tuile"

/** Échéances visibles dans la tuile ; le reste est dans l'agenda du module. */
const LIGNES = 4

function libelleDansListe(n: number): string {
  return n > 1 ? `${n} dans la liste du jour` : "1 dans la liste du jour"
}

export interface TuileElevageProps {
  elevage: ElevageAccueil | null
  chargement: boolean
  rang?: number
}

export function TuileElevage({ elevage, chargement, rang }: TuileElevageProps) {
  const echeances = elevage?.echeances.slice(0, LIGNES) ?? []
  const sousTitre = elevage
    ? [
        `${elevage.animauxActifs} ${elevage.animauxActifs > 1 ? "animaux" : "animal"}`,
        elevage.counts.urgent > 0 ? `${elevage.counts.urgent} urgent${elevage.counts.urgent > 1 ? "s" : ""}` : null,
        elevage.counts.dansListeDuJour > 0 ? libelleDansListe(elevage.counts.dansListeDuJour) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : chargement
      ? "lecture en cours"
      : undefined

  return (
    <Tuile
      idTuile="elevage"
      titre="Élevage"
      sousTitre={sousTitre}
      largeur={5}
      rang={rang}
      actions={
        <Link href="/elevage?tab=calendrier" className={CLASSES_LIEN_DISCRET}>
          Agenda
        </Link>
      }
      vide={!chargement && echeances.length === 0}
      messageVide={
        elevage && elevage.counts.dansListeDuJour > 0
          ? `Rien d'autre sous 7 jours : ${libelleDansListe(elevage.counts.dansListeDuJour)}, au-dessus.`
          : "Aucune échéance sous 7 jours : soins, mises bas et délais d'attente sont à jour."
      }
      actionVide={
        <Link href="/elevage" className={CLASSES_LIEN_DISCRET}>
          Ouvrir l&rsquo;élevage
        </Link>
      }
    >
      {chargement ? (
        <ul className="divide-y divide-lin-doux" aria-label="Chargement des échéances d'élevage">
          {[0, 1].map((i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-3">
              <span className="h-9 w-1 rounded-sm bg-lin" />
              <span className="h-4 w-1/2 rounded bg-lin-doux motion-safe:animate-pulse" />
            </li>
          ))}
        </ul>
      ) : (
        <div role="list">
          {echeances.map((e) => (
            <LigneRegistre
              key={e.id}
              role="listitem"
              etat={etatEcheance(e)}
              titre={e.titre}
              meta={[e.detail ?? ""]}
              action={{ libelle: "Ouvrir", href: hrefEcheance(e) }}
            />
          ))}
        </div>
      )}
    </Tuile>
  )
}
