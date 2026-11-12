/**
 * Barres du calendrier Gantt d'un ITP — logique pure, sans React.
 *
 * L'axe fait 52 semaines et un cycle cultural ne s'arrête pas au 31 décembre :
 * toute barre qui dépasse la S52 se poursuit en début d'axe. L'ancien calcul,
 * dans le composant, tronquait à la S52 les barres de semis et de croissance
 * (ail planté S42, récolté S25 : aucune croissance de janvier à juin) et ne
 * bouclait que les fenêtres documentées.
 */

import { semainesDeRecolte } from "@/lib/cultures/fenetre-recolte"

export interface BarreGantt {
  /** Bord gauche, en % de l'axe. */
  start: number
  /** Largeur, en % de l'axe. */
  width: number
  color: string
  label: string
}

/** Semaines d'un ITP utiles au tracé (déjà recalées sur la zone du lecteur). */
export interface ItpGantt {
  semaineSemis?: number | null
  semainePlantation?: number | null
  semaineRecolte?: number | null
  semaineImplantationDebut?: number | null
  semaineImplantationFin?: number | null
  semaineRecolteFin?: number | null
  dureeRecolte?: number | null
  implantation?: string | null
}

const SEMAINES_AXE = 52
const COULEUR_SEMIS = "#ff9800"
const COULEUR_IMPLANTATION = "#f59e0b"
const COULEUR_CROISSANCE = "#4caf50"
const COULEUR_RECOLTE = "#9c27b0"

/**
 * Semaines de germination figurées en orange pour un semis direct, le reste
 * du cycle étant de la croissance (J.-M. Fortier, Le Jardinier-Maraîcher).
 */
const PHASE_SEMIS_SEMAINES_DIRECT = 3

/** Semaines de `debut` à `fin`, en bouclant sur l'année (S50 → S3 = 5). */
export function ecartSemaines(debut: number, fin: number): number {
  return (((fin - debut) % SEMAINES_AXE) + SEMAINES_AXE) % SEMAINES_AXE
}

/** Ramène une semaine quelconque dans 1–52 (S54 → S2). */
function semaineAxe(semaine: number): number {
  return ((((semaine - 1) % SEMAINES_AXE) + SEMAINES_AXE) % SEMAINES_AXE) + 1
}

/**
 * Barres couvrant `duree` semaines à partir de `debut` : une seule, ou deux
 * quand la période passe la fin d'année.
 */
function barresPeriode(debut: number, duree: number, color: string, label: string): BarreGantt[] {
  const semaines = Math.min(SEMAINES_AXE, Math.floor(duree))
  if (semaines <= 0) return []
  const depart = semaineAxe(debut)
  const avantFinAnnee = Math.min(semaines, SEMAINES_AXE - depart + 1)
  const barres: BarreGantt[] = [
    {
      start: ((depart - 1) / SEMAINES_AXE) * 100,
      width: (avantFinAnnee / SEMAINES_AXE) * 100,
      color,
      label,
    },
  ]
  if (semaines > avantFinAnnee) {
    barres.push({
      start: 0,
      width: ((semaines - avantFinAnnee) / SEMAINES_AXE) * 100,
      color,
      label,
    })
  }
  return barres
}

/**
 * Barre de récolte.
 *
 * Une fenêtre documentée (`semaineRecolteFin`) se trace telle quelle, bornes
 * comprises. Sinon la durée vient de `semainesDeRecolte`, source unique de la
 * fenêtre de récolte ; à défaut de toute durée, la seule semaine de début.
 * L'ancien tracé ne lisait que la fin de fenêtre pour les ITP à fenêtre
 * d'implantation et que la durée pour les autres : un ITP créé depuis le
 * formulaire (sans durée de récolte) n'avait aucune barre de récolte.
 */
function barresRecolte(itp: ItpGantt, label: string): BarreGantt[] {
  if (!itp.semaineRecolte) return []
  const duree = itp.semaineRecolteFin
    ? ecartSemaines(itp.semaineRecolte, itp.semaineRecolteFin) + 1
    : (semainesDeRecolte(itp) ?? 1)
  return barresPeriode(itp.semaineRecolte, duree, COULEUR_RECOLTE, label)
}

/** Barres d'un ITP, dans l'ordre de superposition (la récolte au-dessus). */
export function barresGantt(itp: ItpGantt): BarreGantt[] {
  const barres: BarreGantt[] = []

  // Jeu documenté : les bornes sont de vraies fenêtres de décision, pas une
  // date unique artificielle. On les rend directement, avec une bande de
  // croissance indicative entre la fin d'implantation et la récolte.
  if (itp.semaineImplantationDebut && itp.semaineImplantationFin) {
    const debut = itp.semaineImplantationDebut
    const dureeImplantation = ecartSemaines(debut, itp.semaineImplantationFin)
    barres.push(
      ...barresPeriode(debut, dureeImplantation + 1, COULEUR_IMPLANTATION, itp.implantation ?? "Implantation")
    )

    if (itp.semaineRecolte) {
      // Positions comptées depuis le début du cycle. Quand la récolte commence
      // AVANT la fin de la fenêtre d'implantation (semis échelonnés : mesclun
      // implanté S10–S30, récolté dès S16), il n'y a pas d'intervalle à
      // figurer : l'écart bouclé donnait 36 à 50 semaines de « croissance ».
      const positionRecolte = ecartSemaines(debut, itp.semaineRecolte)
      if (positionRecolte > dureeImplantation) {
        barres.push(
          ...barresPeriode(
            itp.semaineImplantationFin,
            positionRecolte - dureeImplantation,
            COULEUR_CROISSANCE,
            "Croissance indicative"
          )
        )
      }
    }

    barres.push(...barresRecolte(itp, "Fenêtre de récolte"))

    // Semis en pépinière ANTÉRIEUR à la fenêtre d'implantation (zinnia S13 pour
    // une implantation S18–S22, giroflée S32 pour S40–S44…) : la planification
    // part bien de ce semis (`semaineSemisEffective`), le calendrier aussi.
    if (itp.semaineSemis && itp.semaineSemis !== debut) {
      const avance = ecartSemaines(itp.semaineSemis, debut)
      if (avance > 0 && avance < 26) {
        barres.push(...barresPeriode(itp.semaineSemis, avance, COULEUR_SEMIS, "Semis en pépinière"))
      }
    }
    return barres
  }

  if (itp.semaineSemis && itp.semainePlantation) {
    // Pépinière : semis (orange) jusqu'à la plantation.
    barres.push(
      ...barresPeriode(
        itp.semaineSemis,
        ecartSemaines(itp.semaineSemis, itp.semainePlantation),
        COULEUR_SEMIS,
        "Semis"
      )
    )
  } else if (itp.semaineSemis && itp.semaineRecolte) {
    // Semis direct : germination (orange) puis croissance (vert).
    const cycle = ecartSemaines(itp.semaineSemis, itp.semaineRecolte)
    const phaseSemis = Math.min(PHASE_SEMIS_SEMAINES_DIRECT, Math.max(1, Math.floor(cycle / 3)))
    barres.push(...barresPeriode(itp.semaineSemis, phaseSemis, COULEUR_SEMIS, "Semis / germination"))
    barres.push(
      ...barresPeriode(itp.semaineSemis + phaseSemis, cycle - phaseSemis, COULEUR_CROISSANCE, "Croissance")
    )
  }

  if (itp.semainePlantation && itp.semaineRecolte) {
    barres.push(
      ...barresPeriode(
        itp.semainePlantation,
        ecartSemaines(itp.semainePlantation, itp.semaineRecolte),
        COULEUR_CROISSANCE,
        "Croissance"
      )
    )
  }

  barres.push(...barresRecolte(itp, "Récolte"))
  return barres
}
