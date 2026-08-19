import type { TypeAlerteUrgente } from "./types"

/** Préférences disponibles pour les emails de notifications métier. */
export interface NotifPrefs {
  meteo: boolean
  resume: boolean
  stocks: boolean
  itpSemaine: boolean
  recoltes: boolean
  irrigations: boolean
  autresUrgentes: boolean
}

/**
 * Valeurs appliquées quand aucune préférence n'a encore été enregistrée.
 *
 * **Tout est éteint : les alertes par email sont sur OPT-IN**, chaque
 * utilisateur les active lui-même dans `/parametres`. Décision du
 * 2026-08-19, prise à la mise en service : le store anti-redondance vit en
 * mémoire et démarre vide, donc un défaut « activé » aurait envoyé l'arriéré
 * entier (retards, rappels d'irrigation, tâches de la semaine) à tous les
 * comptes existants dans la minute suivant la bascule, sans que personne
 * l'ait demandé — et de nouveau à chaque redémarrage du conteneur.
 *
 * Un défaut éteint est aussi le seul repli sûr : `chargerPrefsNotif` retombe
 * ici quand la lecture des préférences échoue, et une panne de base ne doit
 * pas se traduire par un envoi massif.
 */
export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  meteo: false,
  resume: false,
  stocks: false,
  itpSemaine: false,
  recoltes: false,
  irrigations: false,
  autresUrgentes: false,
}

/** Toutes les notifications activées — utile aux tests et à un « tout cocher ». */
export const TOUTES_NOTIF_PREFS: NotifPrefs = {
  meteo: true,
  resume: true,
  stocks: true,
  itpSemaine: true,
  recoltes: true,
  irrigations: true,
  autresUrgentes: true,
}

/** Au moins une alerte « urgente » est-elle demandée ? (évite un scan pour rien) */
export function auMoinsUneAlerteUrgenteActivee(prefs: NotifPrefs): boolean {
  return (
    prefs.stocks ||
    prefs.itpSemaine ||
    prefs.recoltes ||
    prefs.irrigations ||
    prefs.autresUrgentes
  )
}

/** Parse une préférence sauvegardée sans faire confiance à son contenu. */
export function parseNotifPrefs(value: unknown): NotifPrefs {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_NOTIF_PREFS }
  }

  const objet = value as Record<string, unknown>
  return {
    meteo: typeof objet.meteo === "boolean" ? objet.meteo : DEFAULT_NOTIF_PREFS.meteo,
    resume: typeof objet.resume === "boolean" ? objet.resume : DEFAULT_NOTIF_PREFS.resume,
    stocks: typeof objet.stocks === "boolean" ? objet.stocks : DEFAULT_NOTIF_PREFS.stocks,
    itpSemaine:
      typeof objet.itpSemaine === "boolean" ? objet.itpSemaine : DEFAULT_NOTIF_PREFS.itpSemaine,
    recoltes: typeof objet.recoltes === "boolean" ? objet.recoltes : DEFAULT_NOTIF_PREFS.recoltes,
    irrigations:
      typeof objet.irrigations === "boolean" ? objet.irrigations : DEFAULT_NOTIF_PREFS.irrigations,
    autresUrgentes:
      typeof objet.autresUrgentes === "boolean"
        ? objet.autresUrgentes
        : DEFAULT_NOTIF_PREFS.autresUrgentes,
  }
}

/** Indique si une alerte urgente doit être envoyée selon son type. */
export function typeAlerteEstActivee(type: TypeAlerteUrgente, prefs: NotifPrefs): boolean {
  switch (type) {
    case "stock-bas":
      return prefs.stocks
    case "tache-itp-semaine":
      return prefs.itpSemaine
    case "recolte-mure":
      return prefs.recoltes
    case "irrigation-inutile":
    case "irrigation-rappel":
      return prefs.irrigations
    case "association-incompatible":
    case "tache-retard":
      return prefs.autresUrgentes
  }
}
