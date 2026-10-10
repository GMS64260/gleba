/**
 * Accueil « La ferme d'abord » (variante B, bento) — types partagés entre la
 * composition serveur (`composition.server.ts`), la route
 * `GET /api/accueil/aujourdhui` et les tuiles client.
 *
 * Logique pure : aucun import runtime, sûr pour les tests unitaires.
 */

import type { ModuleId } from "@/lib/modules"
import type { EtatRegistre } from "@/components/accueil/PastilleEtat"
import type { EcheanceElevage } from "@/lib/elevage/agenda.server"
import type { MutationLigne } from "./mutations"

export type { EtatRegistre }

/** D'où vient une ligne de la tuile Aujourd'hui. */
export type SourceAujourdhui =
  | "irrigation"
  | "recolte"
  | "semis"
  | "plantation"
  | "elevage"
  | "declaration"
  | "facture"
  | "creance"

export interface ActionAccueil {
  libelle: string
  /** Écran de l'action ; sert aussi de repli si la mutation n'est pas possible. */
  href: string
  /**
   * Quand la ligne peut être soldée d'un geste (semis, plantation, arrosage
   * planifié), l'action devient un bouton qui joue cette mutation, confirme
   * avec « Annuler » et rejoue l'inverse. Sinon, c'est un lien.
   */
  mutation?: MutationLigne
  /**
   * Une récolte ne se solde pas d'un clic : il faut une quantité. L'action
   * ouvre alors une saisie courte (quantité, unité de la culture), crée la
   * récolte et marque la culture récoltée, avec « Annuler ».
   */
  saisieRecolte?: SaisieRecolte
}

export interface SaisieRecolte {
  cultureId: number
  especeId: string
  especeNom: string
  plancheNom: string | null
  /** Unité de saisie de la culture (kg, tige, pièce, botte…), figée côté serveur à la création. */
  unite: string
}

/** Une ligne de registre de la tuile Aujourd'hui. */
export interface ElementAujourdhui {
  /** Identifiant stable, préfixé par la source (`recolte:1234`). */
  id: string
  source: SourceAujourdhui
  module: ModuleId
  etat: EtatRegistre
  titre: string
  /** Métadonnées courtes, séparées par un point médian à l'affichage. */
  meta: string[]
  action: ActionAccueil
  /**
   * Jours de retard (positif), 0 = aujourd'hui, négatif = à venir. Sert de
   * départage à état égal : le plus en retard d'abord.
   */
  retardJours: number
  /** Planches concernées (id), pour peindre l'état du jour sur la vignette du plan. */
  plancheIds: string[]
}

/** État du jour d'une planche sur la vignette : la couleur ne porte jamais seule l'information. */
export type EtatPlanche = "arroser" | "recolter" | "en-place" | "libre"

export interface PlancheVignette {
  id: string
  nom: string
  posX: number
  posY: number
  largeur: number
  longueur: number
  rotation2D: number
  etat: EtatPlanche
}

export interface ArbreVignette {
  id: number
  posX: number
  posY: number
  envergure: number
}

export interface ObjetVignette {
  id: number
  type: string
  posX: number
  posY: number
  largeur: number
  longueur: number
  rotation2D: number
}

export interface PlanVignetteDonnees {
  planches: PlancheVignette[]
  arbres: ArbreVignette[]
  objets: ObjetVignette[]
}

/** Repères (mesures) : mêmes calculs que les KPI existants, jamais un second calcul. */
export interface ReperesAccueil {
  maraichage: {
    culturesActives: number
    culturesPlanifiees: number
    surfaceCultiveeM2: number
    planchesCount: number
    /** Récolte dominante de l'année : la plus grosse unité (kg, tige, pièce…). */
    recoltes: { valeur: number; unite: string; valeurN1: number; ecartN1: number } | null
  } | null
  comptabilite: {
    beneficeYtd: number
    margePercentYtd: number
    nbRevenusNonPayes: number
    devise: "EUR" | "XPF"
  } | null
  semaine: {
    /** Tâches de la semaine ISO courante non faites, retards compris. */
    aFaire: number
    enRetard: number
  }
}

export interface ElevageAccueil {
  animauxActifs: number
  echeances: EcheanceElevage[]
  counts: {
    total: number
    urgent: number
    /** Échéances déjà portées par la liste du jour, donc absentes de la tuile. */
    dansListeDuJour: number
  }
}

/** Récolte prévue plus tard dans la semaine (celles du jour sont dans la liste). */
export interface RecolteSemaineAccueil {
  cultureId: number
  especeId: string
  especeNom: string
  varieteNom: string | null
  plancheNom: string | null
  /** Date prévue (ISO). */
  date: string
  unite: string
}

export interface TresorerieAccueil {
  devise: "EUR" | "XPF"
  revenusYtd: number
  depensesYtd: number
  beneficeYtd: number
  margePercentYtd: number
  /** Factures émises non encaissées, de la plus ancienne échéance à la plus récente. */
  creances: { id: number; numero: string; client: string; montant: number; echeance: string | null; retardJours: number }[]
  totalCreances: number
  nbDepensesNonPayees: number
  depensesNonPayees: number
}

export interface StocksAccueil {
  /** Aliments dont le stock est sous le seuil d'alerte. */
  aliments: { id: string; nom: string; stock: number; stockMin: number }[]
  /** Échéances de péremption de médicaments (agenda élevage). */
  peremptions: { id: string; titre: string; detail: string | null; joursRestants: number | null }[]
}

export interface VentesAccueil {
  devise: "EUR" | "XPF"
  totalMois: number
  nbMois: number
  dernieres: { id: number; date: string; description: string; montant: number; client: string | null; paye: boolean }[]
}

export interface JournalAccueil {
  entrees: { id: string; date: string; titre: string; detail: string | null; href: string }[]
}

export interface CarteAccueil {
  nbParcelles: number
  surfaceHa: number
  vignette: import("./carte").CarteVignette
}

/** Données des tuiles optionnelles, composées seulement si la tuile est affichée. */
export interface TuilesOptionnelles {
  recoltesSemaine?: RecolteSemaineAccueil[]
  tresorerie?: TresorerieAccueil | null
  verger?: import("./verger").VergerAccueil | null
  stocks?: StocksAccueil | null
  ventes?: VentesAccueil | null
  journal?: JournalAccueil | null
  carte?: CarteAccueil | null
}

export interface AccueilAujourdhui {
  /** Jour civil local (AAAA-MM-JJ). */
  date: string
  annee: number
  exploitation: { nom: string | null }
  /** Modules affichables : préférence de la personne ∩ restriction de l'exploitation. */
  modules: ModuleId[]
  elements: ElementAujourdhui[]
  plan: PlanVignetteDonnees
  reperes: ReperesAccueil
  elevage: ElevageAccueil | null
  optionnelles: TuilesOptionnelles
  /**
   * Sources dont la lecture a échoué. La page le dit, au lieu d'afficher un
   * faux « rien à signaler » (règle du vault : un état vide affirmé teste
   * toutes ses sources).
   */
  sourcesEnErreur: string[]
}
