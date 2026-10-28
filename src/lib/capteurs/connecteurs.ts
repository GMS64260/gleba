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

/** Fuseaux proposés à l'écran et seuls acceptés par la route : liste fermée, sûre pour le SQL. */
export const FUSEAUX_PROPOSES = [...new Set(Object.values(FUSEAU_PAR_TERRITOIRE))]

export function fuseauDuTerritoire(territoire: string | null | undefined): string {
  return (territoire && FUSEAU_PAR_TERRITOIRE[territoire]) || "Europe/Paris"
}
