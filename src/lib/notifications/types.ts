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
}

/** Types d'alertes urgentes (temps réel). */
export type TypeAlerteUrgente =
  | "irrigation-inutile"
  | "association-incompatible"
  | "tache-retard"
  | "recolte-mure" // Issue #16 : maturité calculée (date semis/plantation + durée culture ITP)

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

/** Destinataire d'une notification (user actif, email valide, pas d'opt-out). */
export interface DestinataireNotification {
  id: string
  email: string
  name: string | null
}
