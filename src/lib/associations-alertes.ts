/**
 * Détecteur d'alertes d'associations sur une planche / zone (PROMPT 23 §3).
 *
 * Pour un ensemble de cultures simultanées sur une même planche, on
 * recherche les paires d'espèces dans la table Association via
 * AssociationDetail. Une association "favorable" produit un message vert,
 * une "défavorable" (nom contenant "incompat" ou "défavorable") un
 * message d'alerte rouge.
 *
 * Performance : la liste des associations est petite (< 1000 lignes) ;
 * on charge l'ensemble côté serveur et on cherche en mémoire.
 *
 * L'évaluation est une fonction pure (`evaluerAssociations`) : un appelant qui
 * compare une espèce à plusieurs planches charge les règles une fois et
 * évalue chaque planche en mémoire.
 */

import type { Prisma, PrismaClient } from "@prisma/client"
import { getEspeceAliases } from "@/lib/especes/aliases"

type PrismaTx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

export type AlerteAssociation = {
  type: "favorable" | "defavorable"
  especes: [string, string]
  message: string
  associationId: string
  notes?: string | null
  /** Précision de la règle : la paire est-elle nommée, ou atteinte par alias, groupe ou famille. */
  niveau?: NiveauRegle
}

export type NiveauRegle = "espece" | "alias" | "groupe" | "famille"
const NIVEAUX: NiveauRegle[] = ["espece", "alias", "groupe", "famille"]

/** Ce que l'évaluateur sait d'une espèce présente (clé : identifiant en minuscules). */
export type InfoEspece = { nom?: string | null; familleId?: string | null }
export type ContexteEspeces = Map<string, InfoEspece>

/**
 * Classe une association d'après son champ `type` (favorable | incompatible |
 * neutre), source de vérité. Auparavant on reniflait le `nom` ("incompat") :
 * une association type='incompatible' nommée "Laitue Tomate" était alors
 * affichée comme FAVORABLE (audit 2026-07, #27). Repli sur le nom pour les
 * lignes anciennes dont le type ne serait pas renseigné.
 */
export function classeAssociation(type: string | null | undefined, nom: string): "favorable" | "defavorable" | "neutre" {
  if (type === "incompatible") return "defavorable"
  if (type === "favorable") return "favorable"
  if (type === "neutre") return "neutre"
  const lower = (nom || "").toLowerCase()
  if (lower.includes("incompat") || lower.includes("défavorable") || lower.includes("defavorable")) return "defavorable"
  return "favorable"
}

/** Détail d'association tel que lu par l'évaluateur (champs facultatifs tolérés). */
export type DetailEvaluable = {
  especeId?: string | null
  familleId?: string | null
  groupe?: string | null
  requise?: boolean | null
  notes?: string | null
  espece?: { nom?: string | null } | null
}

/** Association chargée avec ses détails, prête à être évaluée en mémoire. */
export type AssociationEvaluable = {
  id: string
  nom: string
  type?: string | null
  description?: string | null
  notes?: string | null
  details: DetailEvaluable[]
}

/**
 * Sélection Prisma des détails lus par l'évaluateur. L'ordre par identifiant
 * rend le résultat reproductible ; le nom de l'espèce sert au message (une
 * espèce personnelle a un identifiant technique).
 */
export const INCLUDE_DETAILS_EVALUATION = {
  details: {
    orderBy: { id: "asc" },
    include: { espece: { select: { id: true, nom: true } } },
  },
} as const

/**
 * Règle du pivot, unique pour les alertes, les suggestions et la fiche espèce.
 *
 * QA cmsqlhv0c — une entrée du référentiel est EN ÉTOILE : une ou plusieurs
 * espèces pivots (`requise`) et leurs compagnes. « Chou brocoli + » dit que le
 * chou brocoli s'associe bien au concombre et à l'oignon, il ne dit RIEN du
 * couple concombre ↔ oignon ; « Fenouil ! » n'oppose pas l'épinard au
 * concombre. Les partenaires d'une espèce sont donc :
 *   - tous les autres membres si elle est pivot ;
 *   - les seuls pivots si elle est compagne ;
 *   - tous les autres membres quand l'entrée n'a aucun pivot (vrais couples).
 *
 * `estSujet` dit si un identifiant d'espèce désigne l'espèce étudiée : chaque
 * appelant y met sa règle de comparaison (casse, alias).
 */
export function partenairesSelonPivot<D extends Pick<DetailEvaluable, "especeId" | "requise">>(
  details: D[],
  estSujet: (especeId: string) => boolean
): D[] {
  const membres = details.filter((d) => d.especeId)
  const sujets = membres.filter((d) => estSujet(d.especeId as string))
  if (sujets.length === 0) return []
  const autres = membres.filter((d) => !estSujet(d.especeId as string))
  const pivots = membres.filter((d) => d.requise)
  if (pivots.length === 0 || sujets.some((d) => d.requise)) return autres
  return autres.filter((d) => d.requise)
}

const texte = (valeur: string | null | undefined) => (valeur ?? "").replace(/\s+/g, " ").trim()

/**
 * Ce qui justifie une paire, ou `null` si la règle ne dit rien de ce couple.
 * La description d'une entrée en étoile parle d'UNE compagne (« Concombre: Bon
 * voisinage. » sur « Chou brocoli + ») : on ne la prête pas aux autres. On lit
 * donc la note du détail de la compagne, puis la description si l'entrée ne
 * compte que deux membres.
 */
export function justificationPaire(
  a: Pick<AssociationEvaluable, "description" | "details">,
  x: DetailEvaluable,
  y: DetailEvaluable
): string | null {
  // Un seul pivot dans la paire : seule la note de la compagne parle du couple.
  const candidats = !!x.requise !== !!y.requise ? [x.requise ? y : x] : [x, y]
  for (const d of candidats) {
    const note = texte(d.notes)
    if (note) return note
  }
  // Membres : espèces distinctes, plus les lignes de famille ou de groupe seules.
  const especes = new Set(a.details.filter((d) => d.especeId).map((d) => (d.especeId as string).toLowerCase()))
  const sansEspece = a.details.filter((d) => !d.especeId).length
  if (especes.size + sansEspece <= 2) return texte(a.description) || null
  return null
}

/** Alias d'une espèce en minuscules, elle-même comprise. */
export function aliasMinuscules(especeId: string): string[] {
  return Array.from(new Set(getEspeceAliases(especeId).map((a) => a.toLowerCase())))
}

/**
 * Un détail désigne-t-il l'espèce ? Rend la précision de la correspondance
 * (0 espèce nommée, 1 alias, 2 groupe, 3 famille) ou `null`.
 *
 * - ligne d'espèce : l'espèce ou l'un de ses alias (« Haricot vert » suit les
 *   règles de « Haricot », comme sur la fiche espèce) ; sa famille n'est
 *   qu'une annotation et ne désigne personne d'autre ;
 * - ligne de groupe (« Chou ») : texte libre, rapproché des alias ; quand une
 *   famille l'accompagne (Brassicaceae/Chou), le groupe la restreint ;
 * - ligne de famille seule : toute espèce de la famille.
 */
function precisionDetail(d: DetailEvaluable, alias: string[], familleId: string | null): number | null {
  if (d.especeId) {
    const i = alias.indexOf(d.especeId.toLowerCase())
    return i < 0 ? null : i === 0 ? 0 : 1
  }
  const groupe = texte(d.groupe).toLowerCase()
  if (groupe) return alias.includes(groupe) ? 2 : null
  if (d.familleId) return familleId && d.familleId.toLowerCase() === familleId ? 3 : null
  return null
}

/**
 * Évalue en mémoire des associations déjà chargées pour un ensemble d'espèces
 * présentes ensemble. Une seule alerte par paire : le référentiel porte des
 * doublons (« Carotte-Poireau » et « Carotte + Poireau ») et des contradictions
 * (groseillier ↔ haricot ; « Tomate ! » oppose les Alliaceae alors que
 * « Ail + Tomate » est favorable). Ordre de priorité :
 *   1. la règle la plus précise (espèce nommée, puis alias, puis groupe, puis
 *      famille) : une règle d'espèce l'emporte sur une règle de famille ;
 *   2. à précision égale, la règle défavorable (priorité au risque) ;
 *   3. puis la règle de plus petit identifiant.
 *
 * Deux espèces qui ne tombent que sur le MÊME détail ne forment pas une paire
 * (chou-fleur et chou brocoli sous « Chou »).
 *
 * `especes` reste en identifiants réels MINUSCULES : la clé de déduplication
 * des notifications en dépend. `contexte` donne nom et famille des espèces
 * présentes ; sans lui, seules les lignes d'espèce et de groupe sont lues.
 */
export function evaluerAssociations(
  associations: AssociationEvaluable[],
  especesIds: string[],
  contexte: ContexteEspeces = new Map()
): AlerteAssociation[] {
  const uniq = Array.from(new Set(especesIds.map((s) => s.toLowerCase())))
  if (uniq.length < 2) return []
  const alias = uniq.map(aliasMinuscules)
  const familles = uniq.map((e) => contexte.get(e)?.familleId?.toLowerCase() ?? null)

  const parPaire = new Map<string, { alerte: AlerteAssociation; precision: number }>()
  const triees = [...associations].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  for (const a of triees) {
    const classe = classeAssociation(a.type, a.nom)
    if (classe === "neutre") continue // pas d'alerte pour une association neutre

    const aDesPivots = a.details.some((d) => d.requise)
    const lignes = uniq.map((_e, i) =>
      a.details.flatMap((d) => {
        const precision = precisionDetail(d, alias[i], familles[i])
        return precision === null ? [] : [{ d, precision }]
      })
    )

    for (let i = 0; i < uniq.length; i++) {
      if (lignes[i].length === 0) continue
      for (let j = i + 1; j < uniq.length; j++) {
        // Meilleur couple de lignes distinctes ; règle du pivot : sans pivot
        // tous les membres sont reliés, sinon l'un des deux doit être pivot.
        let meilleur: { x: DetailEvaluable; y: DetailEvaluable; px: number; py: number } | null = null
        for (const lx of lignes[i]) {
          for (const ly of lignes[j]) {
            if (lx.d === ly.d) continue
            if (aDesPivots && !lx.d.requise && !ly.d.requise) continue
            if (!meilleur || Math.max(lx.precision, ly.precision) < Math.max(meilleur.px, meilleur.py)) {
              meilleur = { x: lx.d, y: ly.d, px: lx.precision, py: ly.precision }
            }
          }
        }
        if (!meilleur) continue
        const precision = Math.max(meilleur.px, meilleur.py)
        const cle = [uniq[i], uniq[j]].sort().join("\u0000")
        const existante = parPaire.get(cle)
        if (existante) {
          if (existante.precision < precision) continue
          if (
            existante.precision === precision &&
            (existante.alerte.type === "defavorable" || classe !== "defavorable")
          ) continue
        }
        const { x, y, px, py } = meilleur
        const nom = (e: string, d: DetailEvaluable, p: number) =>
          texte(contexte.get(e)?.nom) || (p === 0 ? texte(d.espece?.nom) || (d.especeId as string) : e)
        // Règle atteinte par alias, groupe ou famille : on dit laquelle.
        const origines = [
          [x, px] as const,
          [y, py] as const,
        ].flatMap(([d, p]) => (p === 0 ? [] : [p === 1 ? d.especeId : p === 2 ? texte(d.groupe) : d.familleId]))
        const origine = origines.length ? ` (règle portant sur ${origines.join(" et ")})` : ""
        parPaire.set(cle, {
          precision,
          alerte: {
            type: classe,
            especes: [uniq[i], uniq[j]],
            message: `Association ${classe === "defavorable" ? "défavorable" : "favorable"} : ${nom(uniq[i], x, px)} ↔ ${nom(uniq[j], y, py)} — ${justificationPaire(a, x, y) ?? a.nom}${origine}`,
            associationId: a.id,
            notes: a.notes,
            niveau: NIVEAUX[precision],
          },
        })
      }
    }
  }
  return Array.from(parPaire.values()).map((v) => v.alerte)
}

/**
 * Nom et famille des espèces présentes. Tolère un client simulé sans modèle
 * `espece` (tests anciens) : le contexte est alors vide.
 */
export async function chargerContexteEspeces(
  tx: PrismaTx | PrismaClient,
  especesIds: string[]
): Promise<ContexteEspeces> {
  const contexte: ContexteEspeces = new Map()
  const modele = (tx as { espece?: { findMany?: unknown } }).espece
  if (!modele || typeof modele.findMany !== "function" || especesIds.length === 0) return contexte
  const especes = await (tx as PrismaClient).espece.findMany({
    where: { id: { in: especesIds, mode: "insensitive" } },
    select: { id: true, nom: true, familleId: true },
  })
  for (const e of especes ?? []) contexte.set(e.id.toLowerCase(), { nom: e.nom, familleId: e.familleId })
  return contexte
}

/**
 * Filtre Prisma des associations qui peuvent concerner ces espèces : lignes
 * d'espèce (alias compris), lignes de groupe, lignes de famille SEULE (la
 * famille d'une ligne d'espèce n'est qu'une annotation).
 */
export function whereAssociationsConcernant(
  especesIds: string[],
  contexte: ContexteEspeces = new Map()
): Prisma.AssociationWhereInput {
  const noms = Array.from(new Set(especesIds.flatMap(aliasMinuscules)))
  const familles = Array.from(
    new Set(
      especesIds
        .map((e) => contexte.get(e.toLowerCase())?.familleId)
        .filter((f): f is string => !!f)
    )
  )
  const OR: Prisma.AssociationDetailWhereInput[] = [
    { especeId: { in: noms, mode: "insensitive" } },
    { especeId: null, groupe: { in: noms, mode: "insensitive" } },
  ]
  if (familles.length) OR.push({ especeId: null, familleId: { in: familles } })
  return { details: { some: { OR } } }
}

/**
 * Pour un ensemble d'identifiants d'espèces présents simultanément,
 * retourne la liste des alertes (favorable et défavorable).
 */
export async function alertesAssociations(
  tx: PrismaTx | PrismaClient,
  especesIds: string[]
): Promise<AlerteAssociation[]> {
  const uniq = Array.from(new Set(especesIds.map((s) => s.toLowerCase())))
  if (uniq.length < 2) return []

  const contexte = await chargerContexteEspeces(tx, uniq)
  const associations = await tx.association.findMany({
    where: whereAssociationsConcernant(uniq, contexte),
    include: INCLUDE_DETAILS_EVALUATION,
  })

  return evaluerAssociations(associations, uniq, contexte)
}
