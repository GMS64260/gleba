/**
 * Correspondance tolérante pour la recherche d'espèces.
 *
 * Friction observée le 2026-07-30 : le filtre du sélecteur était un simple
 * `includes()` normalisé sur les accents. Un utilisateur a créé quatorze
 * espèces perso en doublon d'entrées existantes parce que sa saisie ne tombait
 * jamais pile sur le libellé du référentiel :
 *
 *   « Choux » ≠ « Chou », « Amaranthe » ≠ « Amarante »,
 *   « Rubarbe » ≠ « Rhubarbe », « Groseillers » ≠ « Groseillier ».
 *
 * On tolère désormais le pluriel, la faute de frappe (distance d'édition
 * bornée) et la saisie composée (« Menthe poivrée et marocaine » propose
 * « Menthe »). Le score renvoyé sert aussi au tri : cmdk classe par score
 * décroissant, donc la correspondance exacte reste en tête.
 */

/** Minuscules, sans accents, espaces normalisés. */
export function normaliserRecherche(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/** Découpe en mots signifiants (apostrophes et ponctuation exclues). */
function mots(valeur: string): string[] {
  return valeur.split(/[^a-z0-9]+/).filter((m) => m.length > 0)
}

/**
 * Tolérance de frappe admise selon la longueur de la saisie. En dessous de
 * quatre caractères, aucune : « ail » ne doit pas ramener « mais ».
 */
export function toleranceFrappe(requete: string): number {
  if (requete.length <= 3) return 0
  if (requete.length <= 5) return 1
  return 2
}

/**
 * Distance de Levenshtein bornée : dès que toute la ligne courante dépasse
 * `max`, on abandonne et on renvoie `max + 1`.
 */
export function distanceEdition(a: string, b: string, max: number): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let precedente = Array.from({ length: b.length + 1 }, (_, i) => i)
  let courante = new Array<number>(b.length + 1)

  for (let i = 1; i <= a.length; i++) {
    courante[0] = i
    let minLigne = courante[0]
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1
      courante[j] = Math.min(
        precedente[j] + 1, // suppression
        courante[j - 1] + 1, // insertion
        precedente[j - 1] + cout // substitution
      )
      if (courante[j] < minLigne) minLigne = courante[j]
    }
    if (minLigne > max) return max + 1
    const tampon = precedente
    precedente = courante
    courante = tampon
  }

  return precedente[b.length]
}

/**
 * Score de pertinence d'un nom d'espèce pour une requête.
 *
 * Renvoie 0 quand rien ne correspond, sinon une valeur dans ]0, 1].
 * Une requête vide accepte tout (score 1) : c'est l'affichage par défaut.
 */
export function scoreEspece(nom: string, requete: string): number {
  const q = normaliserRecherche(requete)
  if (!q) return 1

  const n = normaliserRecherche(nom)
  if (!n) return 0

  if (n === q) return 1
  if (n.startsWith(q)) return 0.9

  const motsNom = mots(n)
  if (motsNom.some((m) => m.startsWith(q))) return 0.8
  if (n.includes(q)) return 0.7

  const tolerance = toleranceFrappe(q)
  if (tolerance > 0) {
    if (distanceEdition(q, n, tolerance) <= tolerance) return 0.6
    if (motsNom.some((m) => distanceEdition(q, m, tolerance) <= tolerance)) return 0.5
  }

  // Saisie composée : « Menthe poivrée et marocaine » doit encore proposer
  // « Menthe », et « Fenouil, salade, carottes » proposer « Fenouil ».
  const motsRequete = mots(q)
  if (motsRequete.length > 1) {
    for (const mot of motsRequete) {
      if (mot.length < 4) continue
      const tol = toleranceFrappe(mot)
      const touche = motsNom.some(
        (m) => m === mot || m.startsWith(mot) || (tol > 0 && distanceEdition(mot, m, tol) <= tol)
      )
      if (touche) return 0.4
    }
  }

  return 0
}

/** Vrai si le nom correspond, à la tolérance près, à la requête. */
export function correspondEspece(nom: string, requete: string): boolean {
  return scoreEspece(nom, requete) > 0
}
