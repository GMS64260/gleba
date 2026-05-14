/**
 * DEV2 audit Larcher - P1 #6
 * Valorisation de stocks selon PCG 211-23.
 *
 * Trois méthodes au choix par utilisateur :
 *   - PMP (Prix Moyen Pondéré) : valeur unitaire = somme(qté × prix) / qté
 *     totale, recalculé à chaque entrée. Méthode la plus utilisée en
 *     comptabilité agricole car lisse les variations saisonnières.
 *   - FIFO (First In First Out) : les premières entrées sortent en
 *     premier, à leur coût d'entrée. Adapté aux denrées périssables.
 *   - Dernier prix d'achat : valorisation au coût de la dernière entrée
 *     (méthode plus rare, surcôte en période d'inflation).
 *
 * Pour le maraîchage (récoltes propres), le "coût d'entrée" est le coût
 * standard par espèce (paramétrable) ou à défaut prix de vente × marge inverse.
 */

export type MethodeValorisation = "PMP" | "FIFO" | "DERNIER_PRIX"

export interface MouvementStock {
  /** Date de l'entrée ou sortie. */
  date: Date
  /** Quantité (positive = entrée, négative = sortie). */
  quantite: number
  /** Coût unitaire de l'entrée (€/unité). Ignoré pour les sorties. */
  coutUnitaire?: number | null
}

export interface ResultatValorisation {
  /** Stock résiduel après tous les mouvements. */
  quantiteFinale: number
  /** Coût unitaire valorisé selon la méthode. */
  coutUnitaireValorise: number
  /** Valeur totale du stock résiduel. */
  valeurTotale: number
  /** Détails par lot encore en stock (utile pour FIFO surtout). */
  lotsRestants: Array<{ date: Date; quantite: number; coutUnitaire: number }>
  methode: MethodeValorisation
}

/**
 * Calcule la valorisation d'un stock à partir d'une suite chronologique
 * de mouvements. Les sorties consomment les lots dans l'ordre selon la
 * méthode choisie.
 */
export function valoriser(
  mouvements: MouvementStock[],
  methode: MethodeValorisation
): ResultatValorisation {
  // Tri chronologique ascendant
  const tries = [...mouvements].sort((a, b) => a.date.getTime() - b.date.getTime())

  let lots: Array<{ date: Date; quantite: number; coutUnitaire: number }> = []
  let dernierCout = 0

  for (const m of tries) {
    if (m.quantite > 0) {
      // Entrée
      const cu = m.coutUnitaire ?? 0
      lots.push({ date: m.date, quantite: m.quantite, coutUnitaire: cu })
      dernierCout = cu
    } else if (m.quantite < 0) {
      // Sortie
      let aSortir = -m.quantite
      if (methode === "FIFO" || methode === "PMP") {
        // FIFO : consomme les lots dans l'ordre d'entrée
        // PMP : on consomme aussi en FIFO mais on revalorisera à la fin
        while (aSortir > 0 && lots.length > 0) {
          const premier = lots[0]
          if (premier.quantite <= aSortir) {
            aSortir -= premier.quantite
            lots.shift()
          } else {
            premier.quantite -= aSortir
            aSortir = 0
          }
        }
      } else {
        // DERNIER_PRIX : on retire simplement la quantité du dernier lot
        // (et on accepte un solde négatif théorique si stock insuffisant).
        while (aSortir > 0 && lots.length > 0) {
          const dernier = lots[lots.length - 1]
          if (dernier.quantite <= aSortir) {
            aSortir -= dernier.quantite
            lots.pop()
          } else {
            dernier.quantite -= aSortir
            aSortir = 0
          }
        }
      }
    }
  }

  const quantiteFinale = lots.reduce((s, l) => s + l.quantite, 0)
  let coutUnitaireValorise = 0
  let valeurTotale = 0

  if (quantiteFinale > 0) {
    if (methode === "PMP") {
      // PMP = Σ(qté × coût) / Σ(qté) sur tous les lots restants
      valeurTotale = lots.reduce((s, l) => s + l.quantite * l.coutUnitaire, 0)
      coutUnitaireValorise = valeurTotale / quantiteFinale
    } else if (methode === "FIFO") {
      // Valorisation à chaque lot restant à son coût d'entrée
      valeurTotale = lots.reduce((s, l) => s + l.quantite * l.coutUnitaire, 0)
      coutUnitaireValorise = valeurTotale / quantiteFinale
    } else {
      // DERNIER_PRIX : tout le stock résiduel valorisé au dernier prix
      coutUnitaireValorise = dernierCout
      valeurTotale = quantiteFinale * dernierCout
    }
  }

  return {
    quantiteFinale: round2(quantiteFinale),
    coutUnitaireValorise: round2(coutUnitaireValorise),
    valeurTotale: round2(valeurTotale),
    lotsRestants: lots.map((l) => ({ ...l, quantite: round2(l.quantite), coutUnitaire: round2(l.coutUnitaire) })),
    methode,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Estime un coût standard à partir d'un prix de vente moyen et d'une
 * marge cible (en pourcentage). Utilisé pour les récoltes maraîchage où
 * le "coût d'entrée" n'est pas un achat mais une production interne.
 *
 * Ex : prix de vente moyen 3 €/kg, marge cible 40% → coût standard 1.80 €/kg.
 */
export function coutStandardDepuisPrixVente(prixVenteMoyen: number, margePct = 30): number {
  if (prixVenteMoyen <= 0) return 0
  if (margePct < 0 || margePct >= 100) return 0
  return round2(prixVenteMoyen * (1 - margePct / 100))
}
