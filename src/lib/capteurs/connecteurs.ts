/**
 * Types de connecteurs : le format des envois qu'accepte
 * POST /api/capteurs/ingestion pour ce connecteur. Module partagé client et
 * serveur (écran Paramètres > Capteurs), sans Prisma.
 */

export const TYPES_CONNECTEUR = {
  ttn: {
    libelle: "The Things Network (The Things Stack)",
    court: "TTN",
    aide: "Webhook personnalisé de l'application TTN, message « Uplink » coché.",
  },
  chirpstack: {
    libelle: "ChirpStack (v4)",
    court: "ChirpStack",
    aide: "Intégration HTTP de l'application ChirpStack, encodage JSON.",
  },
  generique: {
    libelle: "JSON générique (Home Assistant, Node-RED, script)",
    court: "JSON",
    aide: "Envoi direct au format Gleba, depuis un outil de la ferme.",
  },
} as const

export type TypeConnecteur = keyof typeof TYPES_CONNECTEUR

export const TYPES_CONNECTEUR_IDS = Object.keys(TYPES_CONNECTEUR) as TypeConnecteur[]

export function estTypeConnecteur(valeur: unknown): valeur is TypeConnecteur {
  return typeof valeur === "string" && Object.prototype.hasOwnProperty.call(TYPES_CONNECTEUR, valeur)
}

/**
 * Fuseau du lieu d'après le territoire de l'exploitation (src/lib/territoires.ts) :
 * les agrégats journaliers se comptent en jours du lieu. Polynésie : Tahiti
 * (Marquises et Gambier décalées, rares). Étranger : Paris faute de mieux.
 */
const FUSEAU_PAR_TERRITOIRE: Record<string, string> = {
  METROPOLE: "Europe/Paris",
  GUADELOUPE: "America/Guadeloupe",
  MARTINIQUE: "America/Martinique",
  GUYANE: "America/Cayenne",
  REUNION: "Indian/Reunion",
  MAYOTTE: "Indian/Mayotte",
  NOUVELLE_CALEDONIE: "Pacific/Noumea",
  POLYNESIE: "Pacific/Tahiti",
  WALLIS_FUTUNA: "Pacific/Wallis",
  SAINT_PIERRE_MIQUELON: "America/Miquelon",
  SAINT_BARTHELEMY: "America/St_Barthelemy",
  SAINT_MARTIN: "America/Marigot",
}

/**
 * Fuseaux proposés à l'écran et seuls acceptés par la route et par l'import
 * d'une sauvegarde : liste fermée, sûre pour le SQL (`AT TIME ZONE`).
 */
export const FUSEAUX_PROPOSES = [...new Set(Object.values(FUSEAU_PAR_TERRITOIRE))]

/** Défaut du projet, aussi celui de la colonne `connecteurs_capteurs.fuseau`. */
export const FUSEAU_PAR_DEFAUT = "Europe/Paris"

/** Rétention du brut, en jours civils du lieu ; les agrégats journaliers restent. */
export const RETENTION_MESURES_JOURS = 90

/**
 * Mesures brutes au-delà desquelles la sauvegarde complète ne les emporte
 * plus (revue du 2026-10-30). Une mesure pèse environ 260 octets de JSON
 * indenté : 90 jours d'une ferme type (10 capteurs, 4 grandeurs, 15 min, soit
 * ~350 000 lignes) font ~90 Mo, au-delà du plafond d'import de 50 Mo. 50 000
 * lignes (~13 Mo, un quart du plafond) laissent la place au reste du compte et
 * gardent l'export en mémoire raisonnable ; au-delà, connecteurs, capteurs et
 * agrégats journaliers partent seuls, avec un avertissement.
 */
export const SEUIL_MESURES_BRUTES_EXPORT = 50_000

export function fuseauDuTerritoire(territoire: string | null | undefined): string {
  return (territoire && FUSEAU_PAR_TERRITOIRE[territoire]) || FUSEAU_PAR_DEFAUT
}

/**
 * Fuseau utilisable par `Intl.DateTimeFormat` pour l'affichage. Un fuseau
 * stocké invalide (sauvegarde importée avant la revue du 2026-10-30) levait
 * une RangeError et faisait planter la courbe : on retombe sur le défaut.
 */
export function fuseauAffichable(fuseau: string | null | undefined): string {
  if (!fuseau) return FUSEAU_PAR_DEFAUT
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: fuseau })
    return fuseau
  } catch {
    return FUSEAU_PAR_DEFAUT
  }
}
