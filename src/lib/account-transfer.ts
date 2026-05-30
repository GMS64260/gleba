/**
 * Moteur de transfert de compte — export/import complet des données d'un
 * utilisateur, piloté par le schéma Prisma (DMMF).
 *
 * Objectif : permettre à un utilisateur de l'instance en ligne d'exporter
 * TOUTES ses données (maraîchage, verger, élevage, compta, stocks, météo…)
 * dans un seul fichier JSON, puis de les réimporter à l'identique sur une
 * instance auto-hébergée (Raspberry Pi…). Zéro perte de données.
 *
 * Principe :
 *   - On découvre les modèles via `Prisma.dmmf` (pas de liste codée en dur à
 *     maintenir : un nouveau modèle avec un champ `userId` est pris en compte
 *     automatiquement).
 *   - Trois classes de modèles :
 *       • referential : catalogues partagés à PK string (Espèce, ITP, Variété,
 *         Famille…). Exportés tels quels, ré-importés en upsert par id (l'id est
 *         préservé — il est identique d'une instance à l'autre).
 *       • owned       : modèles possédant un champ `userId`. Exportés filtrés
 *         par utilisateur.
 *       • child       : modèles sans `userId` mais rattachés à un modèle owned
 *         par une clé étrangère (ex. LigneFacture → Facture). Exportés si leur
 *         parent appartient à l'utilisateur.
 *   - À l'import, les PK string (cuid) sont préservées (uniques entre instances,
 *     donc pas de collision), les PK entières (autoincrement) sont remappées
 *     (ancien id → nouvel id) et les FK sont réécrites en conséquence.
 *   - Toute FK pointant vers un modèle non exporté (boutique, référentiel à PK
 *     entière, etc.) est mise à null si la colonne l'autorise, sinon la ligne
 *     est ignorée. Les cycles / références en avant sont gérés par un second
 *     passage de patch.
 */

import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Modèles jamais migrés : authentification, système, cache, communauté, chat
 *  privé, et boutique (fonctionnalité privée sans UI dans la version publique). */
const EXCLUDED = new Set<string>([
  "User",
  "Session",
  "Account",
  "VerificationToken",
  "LoginLog",
  "CookieConsent",
  "BugReport",
  "BugStatusLog",
  "FeedbackToken",
  "FeedbackResponse",
  "Avis",
  "Evolution",
  "EvolutionVote",
  "ChatMessage",
  "Conversation",
  "GenericCache",
  "MeteoCache",
  // Boutique en ligne (privée)
  "Boutique",
  "ProduitBoutique",
  "CommandeBoutique",
  "LigneCommandeBoutique",
])

/** Référentiels partagés à PK string : ré-importés en upsert par id (préservé).
 *  Les référentiels à PK entière/composite (RotationDetail, AssociationDetail,
 *  PorteGreffeEspece, BioagresseurEspece) ne sont pas migrés : ils sont
 *  identiques au seed sur l'instance cible et aucune donnée utilisateur n'y
 *  fait directement référence. */
const REFERENTIAL = new Set<string>([
  "Famille",
  "Fournisseur",
  "Destination",
  "Fertilisant",
  "Espece",
  "PorteGreffe",
  "Bioagresseur",
  "EssenceBocagere",
  "Variete",
  "ITP",
  "Rotation",
  "Association",
  "EspeceAnimale",
  "RaceAnimale",
  "Aliment",
  "ProduitVeterinaire",
  "ProduitPhyto",
  "Parametre",
])

export const EXPORT_FORMAT_VERSION = "2.0"

type Row = Record<string, unknown>

type ModelClass = "referential" | "owned" | "child" | "excluded"

interface RelMeta {
  /** champ scalaire portant la clé étrangère (ex. "factureId") */
  fkField: string
  /** modèle cible (ex. "Facture") */
  targetModel: string
  /** la colonne FK accepte-t-elle null ? */
  nullable: boolean
}

interface ModelMeta {
  name: string
  /** propriété du client Prisma (ex. "ITP" → "iTP", "Culture" → "culture") */
  delegate: string
  pkField: string | null
  pkIsInt: boolean
  /** champs scalaires à copier (hors PK entière, hors champs relationnels) */
  scalarFields: { name: string; type: string }[]
  /** clés étrangères (champ scalaire → modèle cible) */
  rels: RelMeta[]
  hasUserId: boolean
  klass: ModelClass
}

// ─────────────────────────────────────────────────────────────────────────────
// Introspection du schéma (DMMF)
// ─────────────────────────────────────────────────────────────────────────────

let cachedManifest: Map<string, ModelMeta> | null = null

function delegateName(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1)
}

function buildManifest(): Map<string, ModelMeta> {
  if (cachedManifest) return cachedManifest

  const models = Prisma.dmmf.datamodel.models
  const manifest = new Map<string, ModelMeta>()

  for (const m of models) {
    // PK simple uniquement ; les PK composites (join référentiels) sont exclues.
    const idField = m.fields.find((f) => f.isId && f.kind === "scalar")
    const hasCompositePk = !!m.primaryKey && (m.primaryKey.fields?.length ?? 0) > 0
    const hasUserId = m.fields.some((f) => f.name === "userId" && f.kind === "scalar")

    // Champs scalaires (hors relations et listes), avec indicateur de nullité
    const scalarFieldNames = new Map<string, { type: string; required: boolean }>()
    for (const f of m.fields) {
      if (f.kind === "scalar" && !f.isList) {
        scalarFieldNames.set(f.name, { type: f.type, required: f.isRequired })
      }
    }

    // Relations many-to-one : un champ objet avec exactement une FK scalaire
    const rels: RelMeta[] = []
    for (const f of m.fields) {
      if (f.kind === "object" && f.relationFromFields && f.relationFromFields.length === 1) {
        const fkField = f.relationFromFields[0]
        const scalar = scalarFieldNames.get(fkField)
        rels.push({
          fkField,
          targetModel: f.type,
          nullable: scalar ? !scalar.required : true,
        })
      }
    }

    let klass: ModelClass
    if (EXCLUDED.has(m.name) || !idField || hasCompositePk) {
      klass = "excluded"
    } else if (REFERENTIAL.has(m.name)) {
      klass = "referential"
    } else if (hasUserId) {
      klass = "owned"
    } else {
      klass = "child"
    }

    // Champs scalaires à copier : on exclut la PK entière (autoincrement) pour
    // laisser la base régénérer ; on garde la PK string (préservée).
    const pkField = idField?.name ?? null
    const pkIsInt = idField?.type === "Int"
    const scalarFields = [...scalarFieldNames.entries()]
      .filter(([name]) => !(pkIsInt && name === pkField))
      .map(([name, meta]) => ({ name, type: meta.type }))

    manifest.set(m.name, {
      name: m.name,
      delegate: delegateName(m.name),
      pkField,
      pkIsInt,
      scalarFields,
      rels,
      hasUserId,
      klass,
    })
  }

  cachedManifest = manifest
  return manifest
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportResult {
  format: string
  exportDate: string
  appVersion: string
  /** id utilisateur source (sert d'information ; non réutilisé tel quel) */
  sourceUserId: string
  /** données : { Modèle: Row[] } */
  data: Record<string, Row[]>
  stats: Record<string, number>
}

export async function exportAccount(userId: string, appVersion = "1.0.0"): Promise<ExportResult> {
  const manifest = buildManifest()
  const data: Record<string, Row[]> = {}
  const stats: Record<string, number> = {}

  // 1) Référentiels : tout
  for (const meta of manifest.values()) {
    if (meta.klass !== "referential") continue
    const rows = (await (prisma as any)[meta.delegate].findMany()) as Row[]
    data[meta.name] = rows
    stats[meta.name] = rows.length
  }

  // 2) Données owned : filtrées par userId. On retire le champ userId du dump
  //    (réinjecté à l'import avec l'utilisateur cible).
  const ownedIds = new Map<string, Set<unknown>>() // model → set des PK exportées
  for (const meta of manifest.values()) {
    if (meta.klass !== "owned") continue
    const rows = (await (prisma as any)[meta.delegate].findMany({
      where: { userId },
    })) as Row[]
    data[meta.name] = rows
    stats[meta.name] = rows.length
    if (meta.pkField) {
      ownedIds.set(
        meta.name,
        new Set(rows.map((r) => r[meta.pkField as string])),
      )
    }
  }

  // 3) Enfants : lignes dont les FK vers des modèles owned/child appartiennent
  //    à l'utilisateur. Plusieurs passes au cas où un enfant dépend d'un enfant.
  const childExportedIds = new Map<string, Set<unknown>>()
  const childModels = [...manifest.values()].filter((m) => m.klass === "child")
  let progress = true
  const done = new Set<string>()
  while (progress) {
    progress = false
    for (const meta of childModels) {
      if (done.has(meta.name)) continue
      // FK pointant vers un modèle owned ou child déjà résolu
      const ownerRels = meta.rels.filter(
        (r) =>
          (manifest.get(r.targetModel)?.klass === "owned" &&
            ownedIds.has(r.targetModel)) ||
          (manifest.get(r.targetModel)?.klass === "child" &&
            childExportedIds.has(r.targetModel)),
      )
      // Si une FK propriétaire pointe vers un child pas encore traité, on
      // attend le prochain tour.
      const waitingOnChild = meta.rels.some(
        (r) =>
          manifest.get(r.targetModel)?.klass === "child" &&
          !childExportedIds.has(r.targetModel),
      )
      if (waitingOnChild) continue

      const allRows = (await (prisma as any)[meta.delegate].findMany()) as Row[]
      const kept = allRows.filter((row) => {
        // garder la ligne si, pour chaque FK propriétaire non nulle, l'id
        // référencé fait partie des données exportées de l'utilisateur
        for (const r of ownerRels) {
          const v = row[r.fkField]
          if (v === null || v === undefined) continue
          const parentSet =
            ownedIds.get(r.targetModel) ?? childExportedIds.get(r.targetModel)
          if (parentSet && !parentSet.has(v)) return false
        }
        // si aucune FK propriétaire résolue, on n'exporte pas (donnée non
        // rattachable à l'utilisateur)
        if (ownerRels.length === 0) return false
        // au moins une FK propriétaire doit être renseignée et appartenir au user
        return ownerRels.some((r) => {
          const v = row[r.fkField]
          if (v === null || v === undefined) return false
          const parentSet =
            ownedIds.get(r.targetModel) ?? childExportedIds.get(r.targetModel)
          return parentSet ? parentSet.has(v) : false
        })
      })
      data[meta.name] = kept
      stats[meta.name] = kept.length
      if (meta.pkField) {
        childExportedIds.set(
          meta.name,
          new Set(kept.map((r) => r[meta.pkField as string])),
        )
      }
      done.add(meta.name)
      progress = true
    }
  }
  // Enfants restés non résolus (dépendance circulaire d'enfants) : export vide
  for (const meta of childModels) {
    if (!done.has(meta.name)) {
      data[meta.name] = []
      stats[meta.name] = 0
    }
  }

  return {
    format: EXPORT_FORMAT_VERSION,
    exportDate: new Date().toISOString(),
    appVersion,
    sourceUserId: userId,
    data,
    stats,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT
// ─────────────────────────────────────────────────────────────────────────────

export interface ImportResult {
  imported: Record<string, number>
  skipped: Record<string, number>
  total: number
  warnings: string[]
}

interface PendingPatch {
  delegate: string
  pkField: string
  newPk: unknown
  fkField: string
  targetModel: string
  oldValue: unknown
}

/** Ordre topologique des modèles owned/child selon leurs FK internes (Kahn). */
function topoOrder(manifest: Map<string, ModelMeta>, models: ModelMeta[]): ModelMeta[] {
  const names = new Set(models.map((m) => m.name))
  const indeg = new Map<string, number>()
  const deps = new Map<string, Set<string>>() // model → modèles dont il dépend
  for (const m of models) {
    deps.set(m.name, new Set())
  }
  for (const m of models) {
    for (const r of m.rels) {
      // dépendance uniquement vers un autre modèle de l'ensemble, hors auto-réf
      if (names.has(r.targetModel) && r.targetModel !== m.name) {
        deps.get(m.name)!.add(r.targetModel)
      }
    }
  }
  for (const m of models) {
    indeg.set(m.name, deps.get(m.name)!.size)
  }
  const queue = models.filter((m) => indeg.get(m.name) === 0).map((m) => m.name)
  const order: string[] = []
  while (queue.length) {
    const n = queue.shift()!
    order.push(n)
    for (const m of models) {
      if (deps.get(m.name)!.has(n)) {
        deps.get(m.name)!.delete(n)
        indeg.set(m.name, indeg.get(m.name)! - 1)
        if (indeg.get(m.name) === 0) queue.push(m.name)
      }
    }
  }
  // cycles éventuels : on ajoute les modèles restants dans un ordre arbitraire
  // (leurs FK non résolues seront patchées en second passage)
  for (const m of models) {
    if (!order.includes(m.name)) order.push(m.name)
  }
  return order.map((n) => manifest.get(n)!).filter(Boolean)
}

function coerceValue(value: unknown, type: string): unknown {
  if (value === null || value === undefined) return value
  if (type === "DateTime") {
    return value instanceof Date ? value : new Date(value as string)
  }
  return value
}

/**
 * Importe les données d'un export dans le compte `userId`.
 * Toutes les écritures sont faites dans une transaction unique : en cas
 * d'erreur, rien n'est appliqué.
 *
 * @param dryRun  si vrai, la transaction est volontairement annulée à la fin
 *                (utilisé pour les tests / pré-validation).
 */
export async function importAccount(
  userId: string,
  payload: ExportResult,
  opts: { dryRun?: boolean } = {},
): Promise<ImportResult> {
  const manifest = buildManifest()
  const data = payload?.data ?? {}
  const warnings: string[] = []
  const imported: Record<string, number> = {}
  const skipped: Record<string, number> = {}

  // idMap[model] : ancien PK → nouveau PK
  const idMap = new Map<string, Map<unknown, unknown>>()
  const ensureMap = (model: string) => {
    if (!idMap.has(model)) idMap.set(model, new Map())
    return idMap.get(model)!
  }

  class RollbackSignal extends Error {}

  const runner = async (tx: Prisma.TransactionClient) => {
    const pending: PendingPatch[] = []

    // 1) RÉFÉRENTIELS — upsert par id (préservé). idMap = identité.
    for (const meta of manifest.values()) {
      if (meta.klass !== "referential" || !meta.pkField) continue
      const rows = data[meta.name] ?? []
      const map = ensureMap(meta.name)
      let count = 0
      for (const row of rows) {
        const pk = row[meta.pkField]
        if (pk === null || pk === undefined) continue
        const createData = buildScalarData(meta, row, userId)
        const updateData = { ...createData }
        delete (updateData as Row)[meta.pkField]
        try {
          await (tx as any)[meta.delegate].upsert({
            where: { [meta.pkField]: pk },
            create: createData,
            update: updateData,
          })
          map.set(pk, pk)
          count++
        } catch (e) {
          warnings.push(
            `Référentiel ${meta.name} #${String(pk)} ignoré : ${(e as Error).message.split("\n")[0]}`,
          )
        }
      }
      imported[meta.name] = count
    }

    // 2) OWNED + CHILD — ordre topologique, remap PK entières, FK réécrites.
    const dynamicModels = [...manifest.values()].filter(
      (m) => m.klass === "owned" || m.klass === "child",
    )
    const ordered = topoOrder(manifest, dynamicModels)

    for (const meta of ordered) {
      if (!meta.pkField) continue
      const rows = data[meta.name] ?? []
      const map = ensureMap(meta.name)
      let count = 0
      let skip = 0

      for (const row of rows) {
        const oldPk = row[meta.pkField]
        const createData = buildScalarData(meta, row, userId)
        // PK : on retire l'entière (autoincrement) ; on garde la string (cuid).
        if (meta.pkIsInt) {
          delete createData[meta.pkField]
        }

        // userId → utilisateur cible
        if (meta.hasUserId) {
          createData.userId = userId
        }

        // Résolution des FK. Les FK différées (référence en avant / cycle /
        // auto-référence) sont mises à null puis reconnectées en 2e passage.
        const deferredForRow: { fkField: string; targetModel: string; oldValue: unknown }[] = []
        let unresolvedRequired = false

        for (const rel of meta.rels) {
          if (rel.fkField === "userId") continue
          const oldVal = createData[rel.fkField]
          if (oldVal === null || oldVal === undefined) continue

          const targetMeta = manifest.get(rel.targetModel)

          // Cible non migrée (exclue, ou référentiel à PK composite) → null
          if (!targetMeta || targetMeta.klass === "excluded") {
            if (rel.nullable) createData[rel.fkField] = null
            else unresolvedRequired = true
            continue
          }

          const targetMap = idMap.get(rel.targetModel)
          if (targetMap && targetMap.has(oldVal)) {
            createData[rel.fkField] = targetMap.get(oldVal)
          } else if (rel.nullable) {
            // référence pas encore connue → null maintenant, patch ensuite
            createData[rel.fkField] = null
            deferredForRow.push({ fkField: rel.fkField, targetModel: rel.targetModel, oldValue: oldVal })
          } else {
            unresolvedRequired = true
          }
        }

        if (unresolvedRequired) {
          skip++
          continue
        }

        try {
          const created = (await (tx as any)[meta.delegate].create({
            data: createData,
          })) as Row
          const newPk = created[meta.pkField]
          if (oldPk !== null && oldPk !== undefined) map.set(oldPk, newPk)
          count++

          for (const d of deferredForRow) {
            pending.push({
              delegate: meta.delegate,
              pkField: meta.pkField,
              newPk,
              fkField: d.fkField,
              targetModel: d.targetModel,
              oldValue: d.oldValue,
            })
          }
        } catch (e) {
          skip++
          warnings.push(
            `${meta.name} : une ligne ignorée (${(e as Error).message.split("\n")[0]})`,
          )
        }
      }

      imported[meta.name] = count
      if (skip) skipped[meta.name] = skip
    }

    // 3) Patches différés (FK en avant / cycles)
    let patched = 0
    for (const p of pending) {
      const targetMap = idMap.get(p.targetModel)
      const newFk = targetMap?.get(p.oldValue)
      if (newFk === undefined) continue // cible jamais importée → reste null
      try {
        await (tx as any)[p.delegate].update({
          where: { [p.pkField]: p.newPk },
          data: { [p.fkField]: newFk },
        })
        patched++
      } catch {
        /* ligne disparue / contrainte : on laisse la FK à null */
      }
    }
    if (patched) warnings.push(`${patched} référence(s) différée(s) reconnectée(s).`)

    if (opts.dryRun) {
      throw new RollbackSignal("dry-run")
    }
  }

  try {
    await prisma.$transaction(runner, { timeout: 120_000 })
  } catch (e) {
    if (!(e instanceof RollbackSignal)) throw e
    warnings.push("Mode test : transaction annulée (aucune donnée écrite).")
  }

  const total = Object.values(imported).reduce((a, b) => a + b, 0)
  return { imported, skipped, total, warnings }
}

/** Construit l'objet de données scalaires (typage Date/Decimal géré). */
function buildScalarData(meta: ModelMeta, row: Row, _userId: string): Row {
  const out: Row = {}
  for (const f of meta.scalarFields) {
    if (!(f.name in row)) continue
    out[f.name] = coerceValue(row[f.name], f.type)
  }
  return out
}

/** Observabilité / tests : décrit la classification et l'ordre d'import. */
export function describeManifest() {
  const manifest = buildManifest()
  const byClass: Record<ModelClass, string[]> = {
    referential: [],
    owned: [],
    child: [],
    excluded: [],
  }
  for (const m of manifest.values()) byClass[m.klass].push(m.name)

  const dynamic = [...manifest.values()].filter(
    (m) => m.klass === "owned" || m.klass === "child",
  )
  const order = topoOrder(manifest, dynamic).map((m) => m.name)

  // Vérifie qu'aucun modèle n'apparaît avant un de ses parents (hors auto-réf
  // et hors cycles, qui sont gérés par patch différé).
  const pos = new Map(order.map((n, i) => [n, i]))
  const violations: string[] = []
  for (const m of dynamic) {
    for (const r of m.rels) {
      const t = manifest.get(r.targetModel)
      if (!t || (t.klass !== "owned" && t.klass !== "child")) continue
      if (r.targetModel === m.name) continue // auto-référence → patch différé
      if ((pos.get(r.targetModel) ?? 0) > (pos.get(m.name) ?? 0)) {
        violations.push(`${m.name} avant ${r.targetModel} (${r.fkField})`)
      }
    }
  }
  return { byClass, order, violations }
}

/** Validation légère d'un payload d'import. */
export function isValidExportPayload(x: unknown): x is ExportResult {
  if (!x || typeof x !== "object") return false
  const o = x as Record<string, unknown>
  return typeof o.format === "string" && !!o.data && typeof o.data === "object"
}
