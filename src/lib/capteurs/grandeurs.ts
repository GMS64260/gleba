/**
 * Grandeurs mesurées par les capteurs : liste FERMÉE, une unité canonique
 * chacune. Toute mesure est convertie dans cette unité à l'entrée et la porte
 * en base (`MesureCapteur.unite`) : une valeur sans unité ne se compare à rien
 * (motif « une quantité sans unité », vault Gleba-motifs-bugs).
 *
 * Les bornes écartent les valeurs physiquement impossibles (sonde débranchée
 * qui renvoie -127 °C, pression en Pa prise pour des hPa) : une valeur hors
 * bornes est refusée et montrée, jamais corrigée en silence.
 */

export const GRANDEURS = {
  temperature_air: { libelle: "Température de l'air", unite: "°C", min: -60, max: 70 },
  humidite_air: { libelle: "Humidité de l'air", unite: "%", min: 0, max: 100 },
  pression: { libelle: "Pression atmosphérique", unite: "hPa", min: 300, max: 1100 },
  temperature_sol: { libelle: "Température du sol", unite: "°C", min: -40, max: 70 },
  // Teneur en eau volumique (% VWC), pas un % de réserve utile : la
  // correspondance avec la réserve dépend du sol (lot 3 du plan).
  humidite_sol: { libelle: "Humidité du sol (volumique)", unite: "%", min: 0, max: 100 },
  tension_sol: { libelle: "Tension de l'eau du sol", unite: "kPa", min: 0, max: 2000 },
  conductivite_sol: { libelle: "Conductivité du sol", unite: "µS/cm", min: 0, max: 50000 },
  luminosite: { libelle: "Luminosité", unite: "lx", min: 0, max: 200000 },
  vent_vitesse: { libelle: "Vitesse du vent", unite: "m/s", min: 0, max: 100 },
  vent_rafale: { libelle: "Rafale de vent", unite: "m/s", min: 0, max: 120 },
  vent_direction: { libelle: "Direction du vent", unite: "°", min: 0, max: 360 },
  // Trois façons de compter la pluie, qui ne s'additionnent pas entre elles :
  // fenêtres glissantes (Meshtastic) ou compteur cumulé (pluviomètres à augets).
  pluie_1h: { libelle: "Pluie sur 1 h", unite: "mm", min: 0, max: 500 },
  pluie_24h: { libelle: "Pluie sur 24 h", unite: "mm", min: 0, max: 2000 },
  pluie_cumul: { libelle: "Pluie cumulée (compteur)", unite: "mm", min: 0, max: 1000000 },
  // Distance du capteur à la surface (cuve, abreuvoir) : le niveau s'en déduit
  // avec la hauteur de pose, propre à chaque installation.
  distance: { libelle: "Distance à la surface", unite: "mm", min: 0, max: 30000 },
  poids: { libelle: "Poids", unite: "kg", min: 0, max: 10000 },
  batterie: { libelle: "Batterie", unite: "%", min: 0, max: 100 },
  tension_batterie: { libelle: "Tension de la batterie", unite: "V", min: 0, max: 60 },
} as const satisfies Record<string, { libelle: string; unite: string; min: number; max: number }>

export type Grandeur = keyof typeof GRANDEURS

export const GRANDEURS_IDS = Object.keys(GRANDEURS) as Grandeur[]

export function estGrandeur(valeur: unknown): valeur is Grandeur {
  return typeof valeur === "string" && Object.prototype.hasOwnProperty.call(GRANDEURS, valeur)
}

export type ControleValeur = { ok: true; valeur: number } | { ok: false; raison: string }

/** Contrôle une valeur DÉJÀ convertie dans l'unité canonique de sa grandeur. */
export function controlerValeur(grandeur: Grandeur, valeur: number): ControleValeur {
  if (!Number.isFinite(valeur)) return { ok: false, raison: "valeur non numérique" }
  const { min, max, unite } = GRANDEURS[grandeur]
  if (valeur < min || valeur > max) {
    return { ok: false, raison: `hors bornes (${min} à ${max} ${unite})` }
  }
  return { ok: true, valeur }
}
