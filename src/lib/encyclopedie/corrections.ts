/** Chargement et projection des corrections d'items, sans mutation du catalogue. */
import { createHash } from "node:crypto"
import type { Prisma, RevisionEncyclopedie } from "@prisma/client"
import { z } from "zod"
import prisma from "@/lib/prisma"
import { visibiliteReferentielPublic, visibiliteEnfantPublic, nomPublic } from "@/lib/referentiel-public"
import { nomAffichableItp } from "@/lib/itp-label"
import { CHAMPS_CORRECTION, TYPES_CIBLE_CORRECTION, type TypeCibleCorrection, type ValeursCorrection, type CibleCorrectionVue, type DetailCorrection, type CorrectionPublieeVue } from "./types"
import { changementsEspeceSchema, changementsVarieteSchema, changementsItpSchema } from "./validation"

export class CibleCorrectionIntrouvable extends Error {}
type Base = Prisma.TransactionClient
const valeurSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
const snapshotSchema = z.object({
  cibleType: z.enum(TYPES_CIBLE_CORRECTION), refId: z.string(), titre: z.string(),
  espece: z.object({ id: z.string(), nom: z.string() }),
  valeurs: z.record(z.string(), valeurSchema), provenance: z.record(z.string(), valeurSchema),
})
export type SnapshotCorrection = z.infer<typeof snapshotSchema>
const schemas = { ESPECE: changementsEspeceSchema, VARIETE: changementsVarieteSchema, ITP: changementsItpSchema }
export function typeCibleCorrection(type: string): TypeCibleCorrection | null {
  return (TYPES_CIBLE_CORRECTION as readonly string[]).includes(type) ? type as TypeCibleCorrection : null
}
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  return "{" + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => `${JSON.stringify(key)}:${stable(v)}`).join(",") + "}"
}
export function empreinteCorrection(snapshot: SnapshotCorrection): string {
  return createHash("sha256").update(stable(snapshot)).digest("hex")
}
function valeurs(type: TypeCibleCorrection, row: object): ValeursCorrection {
  const source = row as Record<string, unknown>
  return Object.fromEntries(CHAMPS_CORRECTION[type].map(champ => {
    const value = source[champ.cle]
    return [champ.cle, value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : null]
  }))
}
export async function chargerCibleCorrection(type: TypeCibleCorrection, refId: string, db: Base = prisma): Promise<SnapshotCorrection> {
  if (type === "ESPECE") {
    const item = await db.espece.findFirst({ where: { AND: [{ id: refId }, visibiliteReferentielPublic] }, select: {
      id: true, nom: true, nomLatin: true, description: true, vivace: true, besoinEau: true, irrigation: true,
      densite: true, joursLevee: true, temperatureGerm: true, besoinFroid: true, zonesAdaptees: true,
    } })
    if (!item) throw new CibleCorrectionIntrouvable()
    return { cibleType: type, refId: item.id, titre: nomPublic(item), espece: { id: item.id, nom: nomPublic(item) },
      valeurs: { ...valeurs(type, item), nom: nomPublic(item) }, provenance: {} }
  }
  if (type === "VARIETE") {
    const item = await db.variete.findFirst({ where: { AND: [{ id: refId }, visibiliteEnfantPublic(), { espece: visibiliteReferentielPublic }] }, select: {
      id: true, nom: true, bio: true, semaineRecolte: true, dureeRecolte: true, semaineFloraison: true, dureeFloraison: true,
      groupePollinisation: true, ploidie: true, espece: { select: { id: true, nom: true } },
    } })
    if (!item) throw new CibleCorrectionIntrouvable()
    return { cibleType: type, refId: item.id, titre: nomPublic(item), espece: { id: item.espece.id, nom: nomPublic(item.espece) },
      valeurs: { ...valeurs(type, item), nom: nomPublic(item) }, provenance: {} }
  }
  const item = await db.iTP.findFirst({ where: { AND: [{ id: refId, actif: true }, visibiliteEnfantPublic(), { espece: visibiliteReferentielPublic }] }, select: {
    id: true, nom: true, userId: true, especeId: true, typePlanche: true, modeDemarrage: true,
    semaineSemis: true, semainePlantation: true, semaineRecolte: true, zoneClimat: true,
    sourceRecordId: true, sourceVersion: true, sourceReference: true, sourceUrl: true, sourceLicence: true,
    dureeCulture: true, semaineImplantationDebut: true, delaiPremiereRecolteAnnees: true,
    espece: { select: { id: true, nom: true } },
  } })
  if (!item?.espece) throw new CibleCorrectionIntrouvable()
  return { cibleType: type, refId: item.id, titre: nomAffichableItp(item), espece: { id: item.espece.id, nom: nomPublic(item.espece) },
    valeurs: { ...valeurs(type, item), nom: item.nom ?? item.id }, provenance: {
      sourceRecordId: item.sourceRecordId, sourceVersion: item.sourceVersion, sourceReference: item.sourceReference,
      sourceUrl: item.sourceUrl, sourceLicence: item.sourceLicence, dureeCulture: item.dureeCulture,
      semaineImplantationDebut: item.semaineImplantationDebut, delaiPremiereRecolteAnnees: item.delaiPremiereRecolteAnnees,
    } }
}
export function cibleCorrectionVue(snapshot: SnapshotCorrection): CibleCorrectionVue {
  return { cibleType: snapshot.cibleType, refId: snapshot.refId, espece: snapshot.espece, titre: snapshot.titre, valeurs: snapshot.valeurs, empreinte: empreinteCorrection(snapshot),
    source: [snapshot.provenance.sourceReference, snapshot.provenance.sourceUrl].filter(v => typeof v === "string" && v.trim()).join("\n"),
    ...(typeof snapshot.provenance.sourceLicence === "string" && snapshot.provenance.sourceLicence ? { licenceSource: snapshot.provenance.sourceLicence } : {}),
    ...(snapshot.cibleType === "ITP" ? { cycleBase: {
      dureeCulture: typeof snapshot.provenance.dureeCulture === "number" ? snapshot.provenance.dureeCulture : null,
      semaineImplantationDebut: typeof snapshot.provenance.semaineImplantationDebut === "number" ? snapshot.provenance.semaineImplantationDebut : null,
      delaiPremiereRecolteAnnees: typeof snapshot.provenance.delaiPremiereRecolteAnnees === "number" ? snapshot.provenance.delaiPremiereRecolteAnnees : null,
    } } : {}) }
}
export function snapshotJson(s: SnapshotCorrection): Prisma.InputJsonObject {
  return { cibleType: s.cibleType, refId: s.refId, titre: s.titre, espece: { ...s.espece }, valeurs: { ...s.valeurs }, provenance: { ...s.provenance } }
}
export function lireSnapshotCorrection(value: unknown): SnapshotCorrection | null {
  const result = snapshotSchema.safeParse(value)
  return result.success ? result.data : null
}
export function detailCorrection(snapshot: unknown, changements: unknown): DetailCorrection | null {
  const s = lireSnapshotCorrection(snapshot)
  if (!s) return null
  const parsed = schemas[s.cibleType].safeParse(changements)
  if (!parsed.success) return null
  const patch: ValeursCorrection = Object.fromEntries(Object.entries(parsed.data).filter((entry): entry is [string, string | number | boolean | null] => entry[1] !== undefined))
  return { cibleType: s.cibleType, refId: s.refId, titre: s.titre, avant: s.valeurs, apres: { ...s.valeurs, ...patch }, changements: patch }
}
export function changementsEffectifs(snapshot: SnapshotCorrection, patch: object): ValeursCorrection {
  return Object.fromEntries(Object.entries(patch).filter(([key, value]) => value !== undefined && snapshot.valeurs[key] !== value))
}
export function resumeCorrection(detail: DetailCorrection): string {
  const format = (value: string | number | boolean | null) => value === null ? "Non renseigné" : typeof value === "boolean" ? value ? "Oui" : "Non" : String(value).slice(0, 180)
  const lignes = Object.entries(detail.changements).map(([cle, value]) => {
    const titre = CHAMPS_CORRECTION[detail.cibleType].find(c => c.cle === cle)?.libelle ?? cle
    return `${titre} : ${format(detail.avant[cle])} → ${format(value)}`
  })
  return `Correction proposée pour « ${detail.titre} »\n\n${lignes.join("\n")}\n\nCette correction documente une proposition relue ; les données de référence et la planification ne sont pas modifiées.`
}
export function correctionPublieeVue(r: RevisionEncyclopedie): CorrectionPublieeVue | null {
  const detail = detailCorrection(r.snapshot, r.changements)
  if (!detail || detail.cibleType !== r.cibleType || detail.refId !== r.refId) return null
  return { id: r.id, section: r.section as "presentation" | "varietes", contenu: r.contenu, source: r.source, signature: r.signature,
    version: r.version, createdAt: r.createdAt.toISOString(), licence: r.licence, ...detail }
}
export async function correctionsPubliques(especeId: string, db: Base = prisma, filtre?: { cibleType: TypeCibleCorrection; refId: string }): Promise<CorrectionPublieeVue[]> {
  const revisions = await db.revisionEncyclopedie.findMany({ where: { especeId, cibleType: filtre?.cibleType ?? { in: [...TYPES_CIBLE_CORRECTION] }, ...(filtre ? { refId: filtre.refId } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 })
  const visibles = new Map<string, boolean>()
  const result: CorrectionPublieeVue[] = []
  for (const r of revisions) {
    const type = typeCibleCorrection(r.cibleType)
    if (!type) continue
    const key = `${type}:${r.refId}`
    if (!visibles.has(key)) {
      try { const cible = await chargerCibleCorrection(type, r.refId, db); visibles.set(key, cible.espece.id === especeId) }
      catch (e) { if (!(e instanceof CibleCorrectionIntrouvable)) throw e; visibles.set(key, false) }
    }
    const vue = visibles.get(key) ? correctionPublieeVue(r) : null
    if (vue) result.push(vue)
  }
  return result
}

/** Stabiliser parent puis item jusqu'au commit de la note, sans les modifier. */
export async function verrouillerCibleCorrection(snapshot: SnapshotCorrection, db: Base) {
  const parent = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "espece" AS "id" FROM "especes" WHERE "espece" = ${snapshot.espece.id} FOR SHARE
  `
  if (!parent.length) throw new CibleCorrectionIntrouvable()
  if (snapshot.cibleType === "VARIETE") {
    const cible = await db.$queryRaw<Array<{ id: string }>>`
      SELECT "variete" AS "id" FROM "varietes" WHERE "variete" = ${snapshot.refId} FOR SHARE
    `
    if (!cible.length) throw new CibleCorrectionIntrouvable()
  }
  if (snapshot.cibleType === "ITP") {
    const cible = await db.$queryRaw<Array<{ id: string }>>`
      SELECT "it_plante" AS "id" FROM "itps" WHERE "it_plante" = ${snapshot.refId} FOR SHARE
    `
    if (!cible.length) throw new CibleCorrectionIntrouvable()
  }
}
