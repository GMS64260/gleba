"use client"

import * as React from "react"
import Link from "next/link"

import { annulerRecolte, noterRecolte, rouvrirCulture, terminerCulture } from "@/lib/accueil/client"
import type { RecolteSemaineAccueil, SaisieRecolte } from "@/lib/accueil/types"
import { notifierEnregistrement } from "@/lib/notifications-ecran"
import { toast } from "@/hooks/use-toast"

import { CLASSES_LIEN_DISCRET } from "./boutons"
import { CocheAnimee } from "./CocheAnimee"
import { DialogueRecolte } from "./DialogueRecolte"
import { LigneRegistre } from "./LigneRegistre"
import { PastilleEtat } from "./PastilleEtat"
import { Tuile } from "./Tuile"

/**
 * Tuile « Récoltes de la semaine » (catalogue, 2026-10-10) : ce qui arrive à
 * maturité plus tard dans la semaine. Les récoltes du jour et en retard sont
 * dans la liste Aujourd'hui, jamais ici (pas de doublon). « Noter » ouvre la
 * même saisie courte que la liste du jour, avec Annuler.
 */
export interface TuileRecoltesSemaineProps {
  recoltes: RecolteSemaineAccueil[] | undefined
  chargement: boolean
  rang?: number
}

const JOUR = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric" })

export function TuileRecoltesSemaine({ recoltes, chargement, rang }: TuileRecoltesSemaineProps) {
  const [enSaisie, setEnSaisie] = React.useState<RecolteSemaineAccueil | null>(null)
  const [enCours, setEnCours] = React.useState(false)
  const [faites, setFaites] = React.useState<Map<number, { recolteId: number | null; terminee: boolean }>>(() => new Map())

  const saisieDe = (r: RecolteSemaineAccueil): SaisieRecolte => ({
    cultureId: r.cultureId,
    especeId: r.especeId,
    especeNom: r.especeNom,
    plancheNom: r.plancheNom,
    unite: r.unite,
  })

  const annuler = async (r: RecolteSemaineAccueil) => {
    const fait = faites.get(r.cultureId)
    if (!fait) return
    const resultat = fait.terminee ? await rouvrirCulture(r.cultureId) : await annulerRecolte(saisieDe(r), fait.recolteId)
    if (!resultat.ok) {
      toast({ variant: "destructive", title: "Annulation impossible", description: resultat.error ?? "L'enregistrement est conservé." })
      return
    }
    setFaites((f) => {
      const suivant = new Map(f)
      suivant.delete(r.cultureId)
      return suivant
    })
  }

  const confirmer = async (quantite: number) => {
    const r = enSaisie
    if (!r || enCours) return
    setEnCours(true)
    const resultat = await noterRecolte(saisieDe(r), quantite)
    setEnCours(false)
    if (!resultat.ok) {
      toast({ variant: "destructive", title: "Récolte non enregistrée", description: resultat.error })
      return
    }
    setEnSaisie(null)
    setFaites((f) => new Map(f).set(r.cultureId, { recolteId: resultat.recolteId, terminee: false }))
    notifierEnregistrement({
      titre: "Récolte notée",
      detail: `${quantite.toLocaleString("fr-FR")} ${r.unite} · ${r.especeNom}${r.plancheNom ? ` · ${r.plancheNom}` : ""}`,
      annuler: () => annuler(r),
    })
  }

  const terminer = async () => {
    const r = enSaisie
    if (!r || enCours) return
    setEnCours(true)
    const resultat = await terminerCulture(r.cultureId)
    setEnCours(false)
    if (!resultat.ok) {
      toast({ variant: "destructive", title: "Culture non terminée", description: resultat.error ?? "Erreur réseau" })
      return
    }
    setEnSaisie(null)
    setFaites((f) => new Map(f).set(r.cultureId, { recolteId: null, terminee: true }))
    notifierEnregistrement({
      titre: "Culture terminée sans récolte",
      detail: `${r.especeNom}${r.plancheNom ? ` · ${r.plancheNom}` : ""}`,
      annuler: () => annuler(r),
    })
  }

  const liste = recoltes ?? []
  return (
    <Tuile
      idTuile="recoltes-semaine"
      titre="Récoltes de la semaine"
      sousTitre={chargement ? "lecture en cours" : liste.length > 0 ? `${liste.length} à venir` : undefined}
      rang={rang}
      actions={
        <Link href="/maraichage/recoltes" className={CLASSES_LIEN_DISCRET}>
          Récoltes
        </Link>
      }
      vide={!chargement && liste.length === 0}
      messageVide="Rien d'autre à récolter cette semaine. Les récoltes prêtes sont dans la liste du jour."
      actionVide={
        <Link href="/maraichage?tab=calendrier" className={CLASSES_LIEN_DISCRET}>
          Ouvrir le calendrier
        </Link>
      }
    >
      {chargement ? (
        <ul className="divide-y divide-lin-doux" aria-label="Chargement des récoltes">
          {[0, 1].map((i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-3">
              <span className="h-9 w-1 rounded-sm bg-lin" />
              <span className="h-4 w-1/2 rounded bg-lin-doux motion-safe:animate-pulse" />
            </li>
          ))}
        </ul>
      ) : (
        <div role="list">
          {liste.map((r) => {
            const fait = faites.get(r.cultureId)
            if (fait) {
              return (
                <LigneRegistre
                  key={r.cultureId}
                  role="listitem"
                  etat="ok"
                  titre={`${r.especeNom}${r.plancheNom ? ` ${r.plancheNom}` : ""}`}
                  meta={[fait.terminee ? "terminée sans récolte" : "notée", r.varieteNom ?? ""]}
                  pastille={<PastilleEtat etat="ok" libelle={fait.terminee ? "Terminée" : "Récoltée"} icone={CocheAnimee} />}
                  action={{ libelle: "Annuler", onClick: () => annuler(r) }}
                />
              )
            }
            return (
              <LigneRegistre
                key={r.cultureId}
                role="listitem"
                etat="neutre"
                titre={`${r.especeNom}${r.plancheNom ? ` ${r.plancheNom}` : ""}`}
                meta={[JOUR.format(new Date(r.date)), r.varieteNom ?? ""]}
                pastille={<PastilleEtat etat="neutre" libelle="À récolter" className="hidden sm:inline-flex" />}
                action={{ libelle: "Noter", onClick: () => setEnSaisie(r) }}
              />
            )
          })}
        </div>
      )}
      <DialogueRecolte
        saisie={enSaisie ? saisieDe(enSaisie) : null}
        enCours={enCours}
        onFermer={() => setEnSaisie(null)}
        onConfirmer={confirmer}
        onTerminer={terminer}
      />
    </Tuile>
  )
}
