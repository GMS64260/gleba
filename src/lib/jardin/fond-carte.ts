/**
 * Fond et calques de la carte des parcelles (`/jardin/carte`, carte du
 * formulaire de parcelle) : catalogue des couches, lecture et écriture du
 * choix dans le stockage du navigateur. Seule règle de persistance de ce
 * choix ; `src/components/carte/MapContainer.tsx` s'y branche.
 *
 * Les valeurs enregistrées sont les noms donnés aux couches dans le contrôle
 * Calques de Leaflet : ils ne sont ni traduits ni saisis, servent
 * d'identifiants stables, et les préférences déjà enregistrées dans les
 * navigateurs restent lisibles.
 *
 * Historique (QA cmsno90km, cmsoaabhl, cmswtxnnb, cmsx6dvhu, cmul1e6xi,
 * cmulatx23, cmv5cpu7q, cmvflvsk4) : chaque correctif précédent accrochait
 * l'écriture à un événement (baselayerchange, change, click, input). Un
 * sélecteur coché sans aucun de ces événements restait affiché sans être
 * enregistré. L'écriture compare désormais un état (ce qui est coché, ce que
 * la carte montre) au dernier choix connu, à chaque interaction et à la sortie
 * de la page.
 */

export const CLE_FOND_CARTE = "gleba_carte_fond"
export const CLE_CALQUES_CARTE = "gleba_carte_overlays"

export const FONDS_CARTE = ["OpenStreetMap", "Satellite IGN", "Plan IGN"] as const
export type FondCarte = (typeof FONDS_CARTE)[number]
export const FOND_CARTE_DEFAUT: FondCarte = "OpenStreetMap"

export const CALQUES_CARTE = ["Cadastre IGN"] as const
export type CalqueCarte = (typeof CALQUES_CARTE)[number]
export const CALQUE_CADASTRE: CalqueCarte = "Cadastre IGN"

export type CoucheCarte = FondCarte | CalqueCarte
export const COUCHES_CARTE: readonly CoucheCarte[] = [...FONDS_CARTE, ...CALQUES_CARTE]

/** Choix complet : celui qu'on restaure, ou le dernier enregistré. */
export interface ChoixCalques {
  fond: FondCarte
  calques: CalqueCarte[]
}

/** Ce qu'une carte montre ou ce que son contrôle coche : le fond peut manquer. */
export interface EtatCalques {
  fond: FondCarte | null
  calques: CalqueCarte[]
}

/** Accès minimal au stockage : `localStorage` en page, un double en test. */
export type StockageCalques = Pick<Storage, "getItem" | "setItem">

/** Fond connu, espaces de bord ignorés (libellé lu dans le contrôle) ; null sinon. */
export function fondCarte(valeur: unknown): FondCarte | null {
  if (typeof valeur !== "string") return null
  const nom = valeur.trim()
  return (FONDS_CARTE as readonly string[]).includes(nom) ? (nom as FondCarte) : null
}

/** Calque connu ; null sinon. */
export function calqueCarte(valeur: unknown): CalqueCarte | null {
  if (typeof valeur !== "string") return null
  const nom = valeur.trim()
  return (CALQUES_CARTE as readonly string[]).includes(nom) ? (nom as CalqueCarte) : null
}

/** Couche connue (fond ou calque) ; null sinon. */
export function coucheCarte(valeur: unknown): CoucheCarte | null {
  return fondCarte(valeur) ?? calqueCarte(valeur)
}

/** Calques connus, sans doublon, dans l'ordre du catalogue ; [] pour tout autre contenu. */
export function calquesCarte(valeurs: unknown): CalqueCarte[] {
  if (!Array.isArray(valeurs)) return []
  const presents = new Set(valeurs.map(calqueCarte).filter((c): c is CalqueCarte => c !== null))
  return CALQUES_CARTE.filter((c) => presents.has(c))
}

export function memesCalques(a: readonly CalqueCarte[], b: readonly CalqueCarte[]): boolean {
  const ca = calquesCarte(a)
  const cb = calquesCarte(b)
  return ca.length === cb.length && ca.every((c, i) => c === cb[i])
}

/** `localStorage` s'il est accessible (un navigateur peut en refuser l'accès), sinon null. */
export function stockageNavigateur(): StockageCalques | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

/**
 * Choix enregistré, avec repli : fond inconnu, absent ou stockage
 * indisponible donnent OpenStreetMap ; calques illisibles, aucun.
 */
export function lireChoixCalques(stockage: StockageCalques | null): ChoixCalques {
  let fond: FondCarte = FOND_CARTE_DEFAUT
  let calques: CalqueCarte[] = []
  if (!stockage) return { fond, calques }
  try {
    fond = fondCarte(stockage.getItem(CLE_FOND_CARTE)) ?? FOND_CARTE_DEFAUT
  } catch {
    // lecture refusée : défaut
  }
  try {
    const brut = stockage.getItem(CLE_CALQUES_CARTE)
    calques = brut ? calquesCarte(JSON.parse(brut)) : []
  } catch {
    // JSON illisible ou lecture refusée : aucun calque
  }
  return { fond, calques }
}

/**
 * Choix à retenir quand le contrôle Calques et la carte divergent : ce qui
 * est coché l'emporte, c'est ce que l'utilisateur voit et a choisi (un
 * sélecteur coché par script sans événement n'est jamais appliqué par
 * Leaflet). Sans contrôle lisible, ou sans fond coché, l'état de la carte.
 */
export function choixAffiche(selecteurs: EtatCalques | null, carte: EtatCalques): EtatCalques {
  if (!selecteurs) return carte
  return { fond: selecteurs.fond ?? carte.fond, calques: calquesCarte(selecteurs.calques) }
}

export interface ResultatEnregistrement {
  /** Dernier choix connu après l'écriture (inchangé pour une partie non écrite). */
  connu: ChoixCalques
  ecrits: Array<"fond" | "calques">
  /** Une écriture nécessaire a échoué (stockage absent, plein ou refusé). */
  echec: boolean
}

/**
 * Enregistre ce que la carte montre, partie par partie, seulement là où cela
 * diffère du dernier choix connu de cette page (restauré au montage ou déjà
 * écrit). Une page restée ouverte sans changement n'écrase donc jamais le
 * choix fait entre-temps dans un autre onglet, et un clic sur le Cadastre ne
 * réécrit pas le fond. Un état sans fond (carte en cours de démontage)
 * n'écrit rien.
 */
export function enregistrerChoixCalques(
  stockage: StockageCalques | null,
  etat: EtatCalques,
  connu: ChoixCalques,
): ResultatEnregistrement {
  const resultat: ResultatEnregistrement = { connu: { ...connu, calques: [...connu.calques] }, ecrits: [], echec: false }
  if (!etat.fond) return resultat
  const calques = calquesCarte(etat.calques)
  const ecrire = (cle: string, valeur: string): boolean => {
    if (!stockage) return false
    try {
      stockage.setItem(cle, valeur)
      return true
    } catch {
      return false
    }
  }
  if (etat.fond !== connu.fond) {
    if (ecrire(CLE_FOND_CARTE, etat.fond)) {
      resultat.connu.fond = etat.fond
      resultat.ecrits.push("fond")
    } else {
      resultat.echec = true
    }
  }
  if (!memesCalques(calques, connu.calques)) {
    if (ecrire(CLE_CALQUES_CARTE, JSON.stringify(calques))) {
      resultat.connu.calques = calques
      resultat.ecrits.push("calques")
    } else {
      resultat.echec = true
    }
  }
  return resultat
}
