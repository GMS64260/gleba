/**
 * Types partagés du système de notifications métier (alertes par email).
 * Logique pure : aucun import runtime — sûr pour les tests unitaires.
 */

/** Types d'alerte météo notifiés par email. */
export type TypeAlerteMeteo = "gel" | "orage" | "canicule" | "vent" | "pluie"

export interface AlerteMeteoNotification {
  type: TypeAlerteMeteo
  /** Date concernée (YYYY-MM-DD). */
  date: string
  niveau: "attention" | "danger"
  message: string
  details: string
  /**
   * Clé stable anti-redondance, propre à l'alerte (ex. `gel:2026-08-10`).
   * Le sender la préfixe par l'id utilisateur avant d'écrire dans le store.
   */
  key: string
}

/** Type d'une action du calendrier / du résumé du jour. */
export type TypeTache = "semis" | "plantation" | "recolte" | "irrigation"

export interface TacheJour {
  id: string | number
  type: TypeTache
  especeNom: string
  varieteNom: string | null
  plancheName: string | null
  ilot: string | null
  date: string // ISO
  fait: boolean
  couleur: string | null
  /** Enrichissement irrigation : pluie prévue le jour J (mm). */
  pluiePrevue?: number | null
  /** Enrichissement irrigation : passage probablement inutile (pluie). */
  probablementInutile?: boolean
}

export interface ResumeQuotidien {
  /** Date du résumé (YYYY-MM-DD). */
  date: string
  taches: TacheJour[]
  alertesMeteo: AlerteMeteoNotification[]
  /** Tâches ITP de la semaine courante (issue #16), absentes si aucune. */
  tachesItpSemaine?: TacheItpSemaine[]
  /** Stocks sous seuil minimum (issue #16), absents si aucun. */
  stocksBas?: StockBas[]
}

/** Type d'opération d'un itinéraire technique (ITP). */
export type TypeOperationItp = "semis" | "plantation" | "recolte"

/**
 * Tâche « cette semaine » dérivée du calendrier ITP d'une culture active
 * (issue #16) : semis, plantation ou récolte dont la fenêtre couvre la
 * semaine civile courante (lundi → dimanche).
 */
export interface TacheItpSemaine {
  cultureId: number
  type: TypeOperationItp
  especeNom: string
  varieteNom: string | null
  plancheName: string | null
  ilot: string | null
  /** Date cible de l'opération (YYYY-MM-DD, lundi de la semaine de l'op). */
  date: string
  /** Numéro de semaine ISO concernée (1-53). */
  semaine: number
  couleur: string | null
}

/** Types d'alertes urgentes (temps réel). */
export type TypeAlerteUrgente =
  | "irrigation-inutile"
  /** Issue #16 : irrigation planifiée non effectuée. */
  | "irrigation-rappel"
  | "association-incompatible"
  | "tache-retard"
  | "recolte-mure" // Issue #16 : maturité calculée (date semis/plantation + durée culture ITP)
  | "tache-itp-semaine" // Issue #16 : opérations ITP prévues sur la semaine courante
  | "stock-bas" // Issue #16 : stock passé sous le seuil minimum

export interface AlerteUrgente {
  type: TypeAlerteUrgente
  /** Titre court, repris dans l'objet de l'email (ex. « irrigation planche S4 »). */
  titre: string
  message: string
  /**
   * Clé stable anti-redondance propre à l'action
   * (ex. `retard:semis:1234`). Préfixée par l'id utilisateur dans le store.
   */
  key: string
}

/** Type de stock concerné par une alerte stock bas. */
export type TypeStockBas = "variete" | "fertilisant" | "aliment"

/** Stock détecté sous son seuil minimum. */
export interface StockBas {
  type: TypeStockBas
  /** ID de l'entrée de stock (UserStockVariete.id, UserStockFertilisant.id, UserStockAliment.id). */
  stockId: number
  /** Nom de l'élément (variété, fertilisant, aliment). */
  nom: string
  /** Unité du stock (g, plants, kg, L). */
  unite: string
  /** Quantité actuelle en stock. */
  quantite: number
  /** Seuil minimum défini. */
  seuilMin: number
  /** Pourcentage du seuil atteint (ex. 0.5 = 50% du seuil). */
  ratio: number
  /** Localisation optionnelle (planche, ilot, etc.). */
  localisation?: string
  /** Clé stable anti-redondance (ex. `stock-bas:variete:123:50`). */
  key: string
}

/** Destinataire d'une notification (user actif, email valide, pas d'opt-out). */
export interface DestinataireNotification {
  id: string
  email: string
  name: string | null
}