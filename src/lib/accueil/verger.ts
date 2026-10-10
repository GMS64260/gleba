/**
 * Tuile « Verger à faire » de l'accueil : les opérations d'arbres dont la
 * fenêtre est ouverte (ou l'échéance ferme dépassée), regroupées par geste
 * agricole comme dans le calendrier du verger (« taille en vert », 33
 * arbres), du plus pressé au moins pressé. Fonction PURE.
 */
import { debutDeJour, libelleCourtOperation, libelleFenetre, statutOperationArbre } from "@/lib/operation-arbre-statut"

export interface OperationArbreAccueil {
  id: number
  type: string
  description: string | null
  datePrevue: Date | string | null
  fenetreDebut: Date | string | null
  dateLimite: Date | string | null
  abandonneeLe: Date | string | null
  fait: boolean
  arbre: { id: number; nom: string }
}

export interface LotVergerAccueil {
  cle: string
  libelle: string
  type: string
  nbArbres: number
  /** Trois premiers noms d'arbres, pour la métadonnée. */
  arbres: string[]
  fenetre: string | null
  /** Échéance la plus proche du lot (ISO), null sans date. */
  echeance: string | null
  enRetard: boolean
}

export interface VergerAccueil {
  lots: LotVergerAccueil[]
  counts: { aFaire: number; aVenir: number }
}

export function regrouperLotsVerger(operations: readonly OperationArbreAccueil[], maintenant: Date = new Date()): VergerAccueil {
  const aujourdhui = debutDeJour(maintenant)
  const lots = new Map<string, LotVergerAccueil & { echeanceDate: Date | null }>()
  let aVenir = 0
  let aFaire = 0
  for (const op of operations) {
    const statut = statutOperationArbre(op, aujourdhui)
    if (statut === "a_venir") {
      aVenir += 1
      continue
    }
    if (statut !== "a_faire" && statut !== "en_retard") continue
    aFaire += 1
    const libelle = libelleCourtOperation(op.description)
    const cle = `${op.type}|${libelle}`
    const echeance = op.dateLimite ? new Date(op.dateLimite) : op.datePrevue ? new Date(op.datePrevue) : null
    const existant = lots.get(cle)
    if (existant) {
      existant.nbArbres += 1
      if (existant.arbres.length < 3) existant.arbres.push(op.arbre.nom)
      if (echeance && (!existant.echeanceDate || echeance < existant.echeanceDate)) existant.echeanceDate = echeance
      existant.enRetard = existant.enRetard || statut === "en_retard"
      continue
    }
    lots.set(cle, {
      cle,
      libelle,
      type: op.type,
      nbArbres: 1,
      arbres: [op.arbre.nom],
      fenetre: libelleFenetre(op.fenetreDebut, op.dateLimite),
      echeance: null,
      echeanceDate: echeance,
      enRetard: statut === "en_retard",
    })
  }
  const liste = [...lots.values()]
    .sort((a, b) => {
      if (a.enRetard !== b.enRetard) return a.enRetard ? -1 : 1
      const ta = a.echeanceDate?.getTime() ?? Number.POSITIVE_INFINITY
      const tb = b.echeanceDate?.getTime() ?? Number.POSITIVE_INFINITY
      return ta - tb || b.nbArbres - a.nbArbres
    })
    .map(({ echeanceDate, ...lot }) => ({ ...lot, echeance: echeanceDate ? echeanceDate.toISOString() : null }))
  return { lots: liste, counts: { aFaire, aVenir } }
}
