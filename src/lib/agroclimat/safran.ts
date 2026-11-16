/**
 * Lecture des fichiers quotidiens SAFRAN-ISBA (« SIM2 ») de Météo-France.
 *
 * Un fichier par année depuis 1958, plus un fichier « latest » des 60 derniers
 * jours mis à jour chaque jour. CSV compressé, séparé par des points-virgules,
 * une ligne par maille et par jour (3,6 millions de lignes par an). On n'en
 * garde que le minimum (`TINF_H`) et le maximum (`TSUP_H`) des températures
 * horaires du jour, pour les seules mailles demandées.
 *
 * Source : jeu « Données changement climatique - SIM quotidienne »,
 * data.gouv.fr, Météo-France, Licence Ouverte 2.0.
 *
 * Fonctions pures : le téléchargement est dans `import-safran.ts`.
 */

import { CASES_ANNEE, caseDuJour } from "./calendrier"

const BASE_URL = "https://meteofrance.s3.sbg.io.cloud.ovh.net/data/REF_CC/SIM"

/** Première année publiée. */
export const PREMIERE_ANNEE_SAFRAN = 1958

export function urlAnneeSafran(annee: number): string {
  return `${BASE_URL}/QUOT_SIM2_${annee}.csv.gz`
}

/** Fichier des 60 derniers jours. */
export const URL_RECENT_SAFRAN = `${BASE_URL}/QUOT_SIM2_latest.csv.gz`

/**
 * Valeur d'un jour sans donnée dans les tableaux stockés (dixièmes de degré).
 * Un tableau d'entiers PostgreSQL ne porte pas de `null` de façon sûre côté
 * Prisma : on réserve une valeur impossible.
 */
export const ABSENT = -9999

/** Année vide : 366 jours sans donnée. */
export function anneeVide(): number[] {
  return new Array<number>(CASES_ANNEE).fill(ABSENT)
}

/** Dixièmes de degré stockés → degrés, `null` pour un jour sans donnée. */
export function versDegres(dixiemes: readonly number[]): (number | null)[] {
  return dixiemes.map((v) => (v === ABSENT ? null : v / 10))
}

export interface SerieAnnee {
  /** Minimums du jour en dixièmes de degré, 366 cases (`calendrier.ts`). */
  tmin: number[]
  /** Maximums du jour, mêmes conventions. */
  tmax: number[]
}

/** Séries lues : clé de maille (`cleMaille`) → année → série. */
export type SeriesSafran = Map<string, Map<number, SerieAnnee>>

function dixiemes(texte: string): number {
  if (texte === "") return ABSENT
  const v = Number(texte)
  return Number.isFinite(v) ? Math.round(v * 10) : ABSENT
}

/**
 * Lecteur d'un fichier SAFRAN, ligne par ligne. La première ligne passée doit
 * être l'en-tête : les colonnes sont repérées par leur nom, pas par leur
 * position, pour survivre à l'ajout d'un paramètre par Météo-France.
 */
export function creerLecteurSafran(mailles: ReadonlySet<string>) {
  const series: SeriesSafran = new Map()
  let colonnes: { date: number; tmin: number; tmax: number } | null = null
  let lignesLues = 0
  let lignesGardees = 0

  function lireEntete(ligne: string) {
    const noms = ligne.replace(/^﻿/, "").trim().split(";")
    const position = (nom: string) => {
      const i = noms.indexOf(nom)
      if (i < 0) throw new Error(`Fichier SAFRAN : colonne ${nom} absente de l'en-tête`)
      return i
    }
    if (noms[0] !== "LAMBX" || noms[1] !== "LAMBY") {
      throw new Error("Fichier SAFRAN : l'en-tête ne commence pas par LAMBX;LAMBY")
    }
    colonnes = { date: position("DATE"), tmin: position("TINF_H"), tmax: position("TSUP_H") }
  }

  return {
    /** Traite une ligne du fichier, en-tête compris. */
    ligne(ligne: string): void {
      if (colonnes === null) {
        lireEntete(ligne)
        return
      }
      lignesLues++
      // La clé « LAMBX;LAMBY » ouvre la ligne : on écarte les autres mailles
      // sans découper la ligne entière.
      const finCle = ligne.indexOf(";", ligne.indexOf(";") + 1)
      if (finCle < 0) return
      const cle = ligne.slice(0, finCle)
      if (!mailles.has(cle)) return

      const champs = ligne.split(";")
      const date = champs[colonnes.date]
      if (!/^\d{8}$/.test(date)) return
      const annee = Number(date.slice(0, 4))
      const index = caseDuJour(Number(date.slice(4, 6)), Number(date.slice(6, 8)))
      if (!(index >= 0 && index < CASES_ANNEE)) return

      let parAnnee = series.get(cle)
      if (!parAnnee) series.set(cle, (parAnnee = new Map()))
      let serie = parAnnee.get(annee)
      if (!serie) parAnnee.set(annee, (serie = { tmin: anneeVide(), tmax: anneeVide() }))
      serie.tmin[index] = dixiemes(champs[colonnes.tmin])
      serie.tmax[index] = dixiemes(champs[colonnes.tmax])
      lignesGardees++
    },
    series,
    bilan() {
      return { enteteLue: colonnes !== null, lignesLues, lignesGardees }
    },
  }
}

/**
 * Superpose une série lue à une série déjà stockée : un jour présent dans la
 * nouvelle remplace l'ancien, un jour absent laisse l'ancien en place. Le
 * fichier « latest » complète ainsi l'année en cours sans rien effacer.
 */
export function fusionnerSerie(existante: SerieAnnee | null, nouvelle: SerieAnnee): SerieAnnee {
  if (!existante) return { tmin: [...nouvelle.tmin], tmax: [...nouvelle.tmax] }
  const superposer = (ancien: readonly number[], recent: readonly number[]) =>
    Array.from({ length: CASES_ANNEE }, (_, i) => (recent[i] !== undefined && recent[i] !== ABSENT ? recent[i] : ancien[i] ?? ABSENT))
  return { tmin: superposer(existante.tmin, nouvelle.tmin), tmax: superposer(existante.tmax, nouvelle.tmax) }
}
