/**
 * Identifiants externes des capteurs, normalisés avant toute recherche : un
 * même appareil ne doit jamais donner deux capteurs selon la façon dont son
 * serveur l'écrit (TTN en majuscules, ChirpStack en minuscules, Meshtastic
 * avec ou sans zéros de tête : `!2ead82c` et `!02ead82c` sont le même nœud).
 */

/** DevEUI LoRaWAN : 16 chiffres hexadécimaux, séparateurs retirés, en minuscules. */
export function normaliserDevEui(brut: unknown): string | null {
  if (typeof brut !== "string") return null
  const hex = brut.replace(/[\s:-]/g, "").toLowerCase()
  return /^[0-9a-f]{16}$/.test(hex) ? hex : null
}

/**
 * Nœud Meshtastic : `!` puis 8 chiffres hexadécimaux, zéros de tête compris.
 * Accepte aussi le numéro de nœud décimal (champ `from` des paquets).
 */
export function normaliserNoeudMeshtastic(brut: unknown): string | null {
  let numero: number | null = null
  if (typeof brut === "number" && Number.isInteger(brut)) {
    numero = brut
  } else if (typeof brut === "string") {
    const texte = brut.trim().toLowerCase()
    const hex = texte.startsWith("!") ? texte.slice(1) : null
    if (hex !== null && /^[0-9a-f]{1,8}$/.test(hex)) numero = parseInt(hex, 16)
    else if (/^\d{1,10}$/.test(texte)) numero = Number(texte)
  }
  if (numero === null || numero < 0 || numero > 0xffffffff) return null
  return "!" + numero.toString(16).padStart(8, "0")
}

/**
 * Identifiant libre du format générique (Home Assistant, script) ou appareil
 * TTN sans DevEUI (`ttn:application/appareil`, jusqu'à 77 caractères) : comparé
 * tel quel après retrait des espaces de bord, jeu de caractères borné.
 */
export function normaliserIdentifiantGenerique(brut: unknown): string | null {
  if (typeof brut !== "string") return null
  const texte = brut.trim()
  return /^[A-Za-z0-9!._:@/-]{1,100}$/.test(texte) ? texte : null
}
