import type { Prisma, ContributionEncyclopedie, RevisionEncyclopedie } from "@prisma/client"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { visibiliteReferentielPublic, nomPublic } from "@/lib/referentiel-public"
import { SECTIONS_ENCYCLOPEDIE, type SectionEncyclopedie, type RevisionEncyclopedieVue, type ContributionEncyclopedieVue, type CommunauteVegetalVue } from "./types"
import type { PropositionEncyclopedie, DecisionEncyclopedie, PropositionCorrectionCiblee } from "./validation"
import { CibleCorrectionIntrouvable, chargerCibleCorrection, cibleCorrectionVue, correctionsPubliques, changementsEffectifs, detailCorrection,
  empreinteCorrection, lireSnapshotCorrection, resumeCorrection, snapshotJson, correctionPublieeVue, typeCibleCorrection, verrouillerCibleCorrection } from "./corrections"

type Base = Prisma.TransactionClient
export class ErreurEncyclopedie extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "ErreurEncyclopedie" }
}
export function reponseErreurEncyclopedie(error: unknown) {
  if (error instanceof CibleCorrectionIntrouvable) return NextResponse.json({ error: "Élément public introuvable." }, { status: 404 })
  if (error instanceof ErreurEncyclopedie) return NextResponse.json({ error: error.message }, { status: error.status })
  const code = error && typeof error === "object" && "code" in error ? error.code : null
  if (code === "P2002" || code === "P2034") {
    return NextResponse.json({ error: "Une autre contribution a modifié cette section. Actualisez la fiche avant de reprendre la proposition." }, { status: 409 })
  }
  console.error("Encyclopédie : échec de l'opération", error instanceof Error ? error.name : "Erreur inconnue")
  return NextResponse.json({ error: "L'opération n'a pas pu être enregistrée." }, { status: 500 })
}
export async function especePublique(especeId: string, db: Base = prisma) {
  const espece = await db.espece.findFirst({
    where: { AND: [{ id: especeId }, visibiliteReferentielPublic] },
    select: { id: true, nom: true, description: true },
  })
  if (!espece) throw new ErreurEncyclopedie(404, "Fiche publique introuvable.")
  return espece
}
function sectionValide(section: string): SectionEncyclopedie {
  if (!(SECTIONS_ENCYCLOPEDIE as readonly string[]).includes(section)) throw new ErreurEncyclopedie(500, "Section invalide.")
  return section as SectionEncyclopedie
}
export function revisionVue(r: RevisionEncyclopedie): RevisionEncyclopedieVue {
  return { id: r.id, section: sectionValide(r.section), contenu: r.contenu, source: r.source, signature: r.signature,
    version: r.version, createdAt: r.createdAt.toISOString(), licence: r.licence, cibleType: "SECTION", refId: r.refId }
}
export function contributionVue(c: ContributionEncyclopedie & { espece: { id: string; nom: string | null } }): ContributionEncyclopedieVue {
  const correction = typeCibleCorrection(c.cibleType) ? detailCorrection(c.snapshot, c.changements) : null
  return { id: c.id, espece: { id: c.espece.id, nom: nomPublic(c.espece) }, section: sectionValide(c.section),
    contenu: c.contenu, source: c.source, motif: c.motif, signature: c.signature, revisionBaseId: c.revisionBaseId,
    statut: c.statut, decisionMotif: c.decisionMotif, createdAt: c.createdAt.toISOString(), licence: c.licence, ...(correction ? { correction } : {}) }
}
export async function lireCommunauteVegetal(especeId: string, acteurId: string | null = null, admin = false): Promise<CommunauteVegetalVue> {
  await especePublique(especeId)
  // La fenêtre d'historique ne doit jamais faire disparaître une section dont
  // la dernière version est plus ancienne que les modifications des autres.
  const [courantes, historique, discussions, corrections] = await Promise.all([
    Promise.all(SECTIONS_ENCYCLOPEDIE.map(section => prisma.revisionEncyclopedie.findFirst({ where: { especeId, section, cibleType: "SECTION", refId: "" }, orderBy: { version: "desc" } }))),
    prisma.revisionEncyclopedie.findMany({ where: { especeId, cibleType: "SECTION", refId: "" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 60 }),
    prisma.discussionEncyclopedie.findMany({ where: { especeId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 30,
      include: { _count: { select: { reponses: true } }, reponses: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 } } }),
    correctionsPubliques(especeId),
  ])
  return {
    sections: courantes.flatMap(r => { if (!r) return []; const v = revisionVue(r); return [{ section: v.section, contenu: v.contenu, source: v.source,
      revisionId: v.id, version: v.version, signature: v.signature, createdAt: v.createdAt, licence: v.licence }] }),
    revisions: historique.map(revisionVue), corrections,
    discussions: discussions.map(d => ({ id: d.id, titre: d.titre, contenu: d.contenu, signature: d.signature,
      createdAt: d.createdAt.toISOString(), nbReponses: d._count.reponses, supprimable: admin || (acteurId !== null && d.userId === acteurId),
      reponses: d.reponses.slice().reverse().map(r => ({ id: r.id, contenu: r.contenu, signature: r.signature, createdAt: r.createdAt.toISOString(), supprimable: admin || (acteurId !== null && r.userId === acteurId) })) })),
  }
}
export async function proposerContribution(especeId: string, acteurId: string, proposition: PropositionEncyclopedie) {
  return prisma.$transaction(async tx => {
    await especePublique(especeId, tx)
    const actuelle = await tx.revisionEncyclopedie.findFirst({ where: { especeId, section: proposition.section, cibleType: "SECTION", refId: "" }, orderBy: { version: "desc" } })
    if ((actuelle?.id ?? null) !== proposition.revisionBaseId) throw new ErreurEncyclopedie(409, "Cette section a changé. Actualisez la fiche avant de soumettre votre texte.")
    const c = await tx.contributionEncyclopedie.create({ data: { especeId, userId: acteurId, section: proposition.section,
      contenu: proposition.contenu, source: proposition.source, motif: proposition.motif, signature: proposition.signature,
      revisionBaseId: proposition.revisionBaseId, licence: "CC BY 4.0", cibleType: "SECTION", refId: "" }, include: { espece: { select: { id: true, nom: true } } } })
    return contributionVue(c)
  })
}
export async function proposerCorrectionCiblee(acteurId: string, proposition: PropositionCorrectionCiblee) {
  return prisma.$transaction(async tx => {
    const snapshot = await chargerCibleCorrection(proposition.cibleType, proposition.refId, tx)
    if (empreinteCorrection(snapshot) !== proposition.empreinteBase) throw new ErreurEncyclopedie(409, "Cet élément a changé. Rechargez ses valeurs avant de proposer une correction.")
    const changements = changementsEffectifs(snapshot, proposition.changements)
    if (!Object.keys(changements).length) throw new ErreurEncyclopedie(400, "Modifiez au moins une valeur avant de soumettre votre correction.")
    const section = snapshot.cibleType === "ESPECE" ? "presentation" : "varietes"
    const actuelle = await tx.revisionEncyclopedie.findFirst({ where: { especeId: snapshot.espece.id, section, cibleType: snapshot.cibleType, refId: snapshot.refId }, orderBy: { version: "desc" } })
    const json = snapshotJson(snapshot)
    const detail = detailCorrection(json, changements)
    if (!detail) throw new ErreurEncyclopedie(400, "Correction invalide.")
    const c = await tx.contributionEncyclopedie.create({ data: {
      especeId: snapshot.espece.id, userId: acteurId, signature: proposition.signature, section,
      cibleType: snapshot.cibleType, refId: snapshot.refId, snapshot: json, changements,
      contenu: resumeCorrection(detail), source: proposition.source, motif: proposition.motif,
      revisionBaseId: actuelle?.id ?? null, licence: "CC BY 4.0",
    }, include: { espece: { select: { id: true, nom: true } } } })
    return contributionVue(c)
  })
}
export async function listerContributions(acteurId: string | null) {
  const contributions = await prisma.contributionEncyclopedie.findMany({
    where: { ...(acteurId === null ? { statut: "EN_ATTENTE" as const } : { userId: acteurId }), espece: visibiliteReferentielPublic },
    include: { espece: { select: { id: true, nom: true, description: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
  })
  const result: Array<ContributionEncyclopedieVue | import("./types").ContributionModerationVue> = []
  for (const c of contributions) {
    const type = typeCibleCorrection(c.cibleType)
    let cibleActuelle: import("./types").CibleCorrectionVue | undefined
    if (type) {
      try {
        const cible = await chargerCibleCorrection(type, c.refId)
        if (cible.espece.id !== c.especeId) continue
        cibleActuelle = cibleCorrectionVue(cible)
      } catch (e) { if (!(e instanceof CibleCorrectionIntrouvable)) throw e; continue }
    }
    const vue = contributionVue(c)
    if (acteurId !== null) { result.push(vue); continue }
    const actuelle = await prisma.revisionEncyclopedie.findFirst({ where: { especeId: c.especeId, section: c.section,
      cibleType: c.cibleType ?? "SECTION", refId: c.refId ?? "" }, orderBy: { version: "desc" } })
    const snapshot = lireSnapshotCorrection(c.snapshot)
    result.push({ ...vue, contenuActuel: cibleActuelle ? JSON.stringify(cibleActuelle.valeurs, null, 2) : actuelle?.contenu ?? (c.section === "presentation" ? c.espece.description ?? "" : ""),
      revisionActuelleId: actuelle?.id ?? null, ...(cibleActuelle ? { cibleActuelle, correctionObsolete: !snapshot || empreinteCorrection(snapshot) !== cibleActuelle.empreinte } : {}) })
  }
  return result
}
export async function deciderContribution(id: string, validateurId: string, decision: DecisionEncyclopedie) {
  return prisma.$transaction(async tx => {
    const contribution = await tx.contributionEncyclopedie.findUnique({ where: { id } })
    if (!contribution) throw new ErreurEncyclopedie(404, "Proposition introuvable.")
    // Même ordre que la suppression de compte : personne, puis proposition.
    // La suppression prend FOR UPDATE avant l'anonymisation ; ce verrou
    // empêche une publication tardive de conserver la signature de l'auteur.
    const auteurs = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "users" WHERE "id" = ${contribution.userId} FOR KEY SHARE
    `
    if (!auteurs.length) throw new ErreurEncyclopedie(404, "L'auteur de cette proposition a supprimé son compte.")
    await especePublique(contribution.especeId, tx)
    if (contribution.statut !== "EN_ATTENTE") throw new ErreurEncyclopedie(409, "Cette proposition a déjà été traitée.")
    const typeCible = typeCibleCorrection(contribution.cibleType)
    let champsCibles: { snapshot: Prisma.InputJsonObject; changements: Prisma.InputJsonObject } | null = null
    if (typeCible) {
      const snapshot = lireSnapshotCorrection(contribution.snapshot)
      if (!snapshot || snapshot.cibleType !== typeCible || snapshot.refId !== contribution.refId || snapshot.espece.id !== contribution.especeId) throw new ErreurEncyclopedie(409, "La cible de cette correction n'est plus cohérente. Demandez une reprise.")
      const detail = detailCorrection(contribution.snapshot, contribution.changements)
      if (!detail || !Object.keys(detail.changements).length) throw new ErreurEncyclopedie(409, "Les valeurs de cette correction sont invalides. Demandez une reprise.")
      champsCibles = { snapshot: snapshotJson(snapshot), changements: { ...detail.changements } }
      if (decision.decision === "PUBLIER") await verrouillerCibleCorrection(snapshot, tx)
      const cible = await chargerCibleCorrection(typeCible, contribution.refId, tx)
      if (cible.espece.id !== contribution.especeId) throw new ErreurEncyclopedie(409, "Cet élément a changé de fiche. Demandez une nouvelle proposition.")
      if (decision.decision === "PUBLIER" && empreinteCorrection(cible) !== empreinteCorrection(snapshot)) throw new ErreurEncyclopedie(409, "Les valeurs de référence ont changé depuis la proposition. Demandez une reprise.")
    } else if (contribution.cibleType && contribution.cibleType !== "SECTION") throw new ErreurEncyclopedie(409, "Type de correction invalide.")
    const statut = decision.decision === "PUBLIER" ? "PUBLIEE" : decision.decision === "REFUSER" ? "REFUSEE" : "A_REPRENDRE"
    const changee = await tx.contributionEncyclopedie.updateMany({ where: { id, statut: "EN_ATTENTE" }, data: { statut, decisionMotif: decision.motif, decisionAt: new Date() } })
    if (changee.count !== 1) throw new ErreurEncyclopedie(409, "Cette proposition vient d'être traitée.")
    let revision: RevisionEncyclopedieVue | import("./types").CorrectionPublieeVue | null = null
    if (decision.decision === "PUBLIER") {
      const actuelle = await tx.revisionEncyclopedie.findFirst({ where: { especeId: contribution.especeId, section: contribution.section, cibleType: contribution.cibleType ?? "SECTION", refId: contribution.refId ?? "" }, orderBy: { version: "desc" } })
      if ((actuelle?.id ?? null) !== contribution.revisionBaseId) throw new ErreurEncyclopedie(409, "Cette section a été modifiée depuis la proposition. Demandez une reprise avant de publier.")
      // La contrainte unique (espece, section, version) arbitre aussi deux
      // publications concurrentes de propositions distinctes. L'échec annule
      // intégralement la transaction, statut compris.
      const publiee = await tx.revisionEncyclopedie.create({ data: {
        especeId: contribution.especeId, section: contribution.section, version: (actuelle?.version ?? 0) + 1,
        cibleType: contribution.cibleType ?? "SECTION", refId: contribution.refId ?? "",
        ...(champsCibles ?? {}),
        contenu: contribution.contenu, source: contribution.source, signature: contribution.signature, licence: contribution.licence,
        authorId: contribution.userId, reviewedById: validateurId, contributionId: contribution.id,
      } })
      revision = typeCible ? correctionPublieeVue(publiee) : revisionVue(publiee)
      if (!revision) throw new ErreurEncyclopedie(409, "La correction n'a pas pu être publiée. Demandez une reprise.")
    }
    return { id, statut, decisionMotif: decision.motif, revision }
  })
}
export async function discussionPublique(id: string, db: Base = prisma) {
  const discussion = await db.discussionEncyclopedie.findFirst({ where: { id, espece: visibiliteReferentielPublic } })
  if (!discussion) throw new ErreurEncyclopedie(404, "Discussion publique introuvable.")
  return discussion
}

/** Les membres peuvent lire le forum général ET les sujets de fiches publiques. */
export async function discussionAccessibleMembre(id: string, db: Base = prisma) {
  const discussion = await db.discussionEncyclopedie.findFirst({ where: {
    id, OR: [{ especeId: null }, { espece: visibiliteReferentielPublic }],
  } })
  if (!discussion) throw new ErreurEncyclopedie(404, "Discussion introuvable.")
  return discussion
}
