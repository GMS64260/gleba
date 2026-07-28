import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import PDFDocument from "pdfkit"
import { z } from "zod"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import {
  acteurReglementaire,
  journaliserEvenementReglementaire,
} from "@/lib/elevage/audit-reglementaire"
import { empreinteDeclaration } from "@/lib/elevage/declarations-reglementaires"
import { chargerDeclarationsReglementaires } from "@/lib/elevage/declarations-reglementaires.server"
import {
  anomaliesDocumentCirculation,
  construireSnapshotDocumentCirculation,
  declarationCompatibleDocumentCirculation,
  PREPARATION_CIRCULATION_VIDE,
  type PreparationDocumentCirculation,
} from "@/lib/elevage/document-circulation"

const currentYear = () => new Date().getUTCFullYear()
const yearSchema = z.coerce.number().int().min(1990).max(currentYear() + 1)
const keySchema = z.string().min(5).max(300)
const nullableText = (max: number) =>
  z.union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((value) => value || null)

const preparationSchema = z.object({
  key: keySchema,
  year: yearSchema,
  numeroDocumentEde: nullableText(100),
  typeExploitationEde: nullableText(150),
  categorieAnimaux: z.union([
    z.enum(["NON_DEROGATAIRES", "BOUCHERIE_DEROGATAIRES", "MIXTE"]),
    z.literal(""),
    z.null(),
  ]).optional().transform((value) => value || null),
  indicatifsMarquage: nullableText(1000),
  tiersNom: nullableText(200),
  tiersNumeroEde: nullableText(100),
  tiersSiren: nullableText(30),
  tiersAdresse: nullableText(500),
  numeroAgrementSanitaire: nullableText(100),
  transporteurNom: nullableText(200),
  numeroTransporteur: nullableText(100),
  immatriculationVehicule: nullableText(50),
  motifMouvement: nullableText(200),
  contactDepart: nullableText(200),
  contactArrivee: nullableText(200),
  notes: nullableText(2000),
})

type PreparationPersisted = PreparationDocumentCirculation & {
  snapshotHash?: string | null
}

const selectPreparation = {
  numeroDocumentEde: true,
  typeExploitationEde: true,
  categorieAnimaux: true,
  indicatifsMarquage: true,
  tiersNom: true,
  tiersNumeroEde: true,
  tiersSiren: true,
  tiersAdresse: true,
  numeroAgrementSanitaire: true,
  transporteurNom: true,
  numeroTransporteur: true,
  immatriculationVehicule: true,
  motifMouvement: true,
  contactDepart: true,
  contactArrivee: true,
  notes: true,
  snapshotHash: true,
} as const

function normaliserPreparation(
  value: PreparationPersisted | null | undefined,
): PreparationDocumentCirculation {
  return {
    ...PREPARATION_CIRCULATION_VIDE,
    ...value,
  }
}

async function chargerContexte(userId: string, year: number, key: string) {
  const [resultat, exploitation, preparation] = await Promise.all([
    chargerDeclarationsReglementaires(userId, { year }),
    prisma.exploitation.findUnique({
      where: { userId },
      select: {
        raisonSociale: true,
        numeroEde: true,
        siren: true,
        adresseSiege: true,
        codePostal: true,
        ville: true,
      },
    }),
    prisma.preparationDocumentCirculation.findUnique({
      where: { userId_declarationKey: { userId, declarationKey: key } },
      select: selectPreparation,
    }),
  ])
  return {
    declaration: resultat.declarations.find((item) => item.key === key) ?? null,
    exploitation,
    preparation,
  }
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("fr-FR", { timeZone: "UTC" })
}

function identiteTiers(
  preparation: PreparationDocumentCirculation,
  fallback: string | null,
) {
  return [
    preparation.tiersNom,
    preparation.tiersNumeroEde ? `EDE ${preparation.tiersNumeroEde}` : null,
    preparation.tiersSiren ? `SIREN ${preparation.tiersSiren}` : null,
    preparation.numeroAgrementSanitaire
      ? `Agrément ${preparation.numeroAgrementSanitaire}`
      : null,
    preparation.tiersAdresse,
    fallback,
  ].filter(Boolean).join(" · ") || "À compléter"
}

async function genererPdf(args: {
  declaration: NonNullable<Awaited<ReturnType<typeof chargerContexte>>["declaration"]>
  exploitation: Awaited<ReturnType<typeof chargerContexte>>["exploitation"]
  preparation: PreparationDocumentCirculation
  anomalies: string[]
  snapshotHash: string
}) {
  const { declaration, exploitation, preparation, anomalies, snapshotHash } = args
  const doc = new PDFDocument({ size: "A4", margin: 42 })
  const chunks: Buffer[] = []

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    doc.font("Helvetica-Bold").fontSize(16).fillColor("#0f172a")
      .text("Fiche préparatoire au document de circulation")
    doc.fontSize(12).text("Ovins / caprins")
    doc.moveDown(0.6)
    doc.font("Helvetica-Bold").fontSize(9)
      .fillColor(anomalies.length ? "#b91c1c" : "#9a3412")
      .text(
        anomalies.length
          ? "INCOMPLET — corriger les éléments signalés avant tout mouvement."
          : "DOCUMENT PRÉPARATOIRE — à reporter sur le modèle officiel fourni par l’EDE, puis à faire signer ou valider.",
      )
    doc.moveDown()

    const ligne = (label: string, value: string) => {
      doc.font("Helvetica-Bold").fillColor("#334155").text(`${label} : `, { continued: true })
      doc.font("Helvetica").fillColor("#0f172a").text(value || "—")
    }

    ligne("Référence Gleba", declaration.key)
    ligne("N° du document EDE", preparation.numeroDocumentEde || "À reporter depuis le modèle officiel")
    ligne("Type d’exploitation EDE", preparation.typeExploitationEde || "À compléter")
    ligne("Mouvement", declaration.type === "ENTREE" ? "Entrée" : "Sortie")
    ligne("Date", formatDate(declaration.dateEvenement))
    ligne("Espèce", declaration.espece)
    ligne("Nombre d’animaux", String(declaration.quantite))
    ligne(
      "Catégorie des animaux",
      {
        NON_DEROGATAIRES: "Non dérogataires",
        BOUCHERIE_DEROGATAIRES: "Animaux de boucherie dérogataires",
        MIXTE: "Mouvement mixte",
      }[preparation.categorieAnimaux || ""] || "À compléter",
    )
    ligne(
      "Identifiants / indicatifs",
      [
        declaration.identifiants.join(", "),
        preparation.indicatifsMarquage,
      ].filter(Boolean).join(" · ") || "À compléter",
    )
    ligne("Motif", preparation.motifMouvement || "À compléter")
    doc.moveDown()

    const exploitationTexte = exploitation
      ? [
          exploitation.raisonSociale,
          exploitation.numeroEde ? `EDE ${exploitation.numeroEde}` : null,
          exploitation.siren ? `SIREN ${exploitation.siren}` : null,
          `${exploitation.adresseSiege}, ${exploitation.codePostal} ${exploitation.ville}`,
        ].filter(Boolean).join(" · ")
      : "Exploitation à compléter"
    const tiersTexte = identiteTiers(
      preparation,
      declaration.type === "ENTREE" ? declaration.origine : declaration.destination,
    )
    ligne("Détenteur / exploitation de départ", declaration.type === "ENTREE" ? tiersTexte : exploitationTexte)
    ligne("Contact au départ", preparation.contactDepart || "À compléter")
    ligne("Détenteur / exploitation d’arrivée", declaration.type === "ENTREE" ? exploitationTexte : tiersTexte)
    ligne("Contact à l’arrivée", preparation.contactArrivee || "À compléter")
    doc.moveDown()

    ligne("Transporteur", preparation.transporteurNom || "À compléter")
    ligne("Numéro du transporteur", preparation.numeroTransporteur || "À compléter")
    ligne("Immatriculation du véhicule", preparation.immatriculationVehicule || "À compléter")
    if (preparation.notes) ligne("Notes", preparation.notes)

    doc.moveDown()
    doc.font("Helvetica-Bold").fillColor("#0f172a").text("Contrôles avant départ")
    doc.font("Helvetica").fontSize(9)
    if (anomalies.length) {
      for (const anomalie of anomalies) {
        doc.fillColor("#991b1b").text(`• ${anomalie}`)
      }
    } else {
      doc.fillColor("#166534").text("• Les données préparatoires saisies ne présentent pas d’anomalie détectée par Gleba.")
    }
    doc.fillColor("#0f172a")
      .text("• Utiliser le document de circulation officiel fourni par l’EDE.")
      .text("• Faire signer ou valider le document par les détenteurs concernés et le transporteur.")
      .text("• Conserver les doubles ou copies et effectuer séparément la notification officielle.")

    doc.moveDown(1.5)
    doc.font("Helvetica-Bold").text("Signatures à recueillir sur le document officiel")
    doc.moveDown(0.5)
    doc.font("Helvetica").text(
      "Détenteur de départ : ____________________     Transporteur : ____________________",
    )
    doc.moveDown(1.2)
    doc.text("Détenteur d’arrivée : ____________________")

    doc.moveDown(2)
    doc.fontSize(7).fillColor("#64748b")
      .text(`Empreinte de préparation : ${snapshotHash}`)
      .text(`Généré par Gleba le ${formatDate(new Date())}. Cette fiche n’est ni un formulaire EDE ni un accusé de notification.`)
    doc.end()
  })

  return buffer
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi(request)
  if (error) return error

  const params = new URL(request.url).searchParams
  const parsedYear = yearSchema.safeParse(params.get("year") ?? String(currentYear()))
  const parsedKey = keySchema.safeParse(params.get("key"))
  if (!parsedYear.success || !parsedKey.success) {
    return NextResponse.json({ error: "Année ou référence invalide" }, { status: 400 })
  }

  const userId = session.user.id
  const contexte = await chargerContexte(userId, parsedYear.data, parsedKey.data)
  if (!contexte.declaration) {
    return NextResponse.json({ error: "Déclaration introuvable" }, { status: 404 })
  }
  if (!declarationCompatibleDocumentCirculation(contexte.declaration)) {
    return NextResponse.json(
      { error: "Le document de circulation préparatoire concerne les mouvements ovins/caprins" },
      { status: 409 },
    )
  }

  const preparation = normaliserPreparation(contexte.preparation)
  const anomalies = anomaliesDocumentCirculation(contexte.declaration, preparation)
  const snapshot = construireSnapshotDocumentCirculation(contexte.declaration, preparation)
  const snapshotHash = empreinteDeclaration(snapshot)
  const modifieDepuisPreparation = Boolean(
    contexte.preparation?.snapshotHash
    && contexte.preparation.snapshotHash !== snapshotHash,
  )

  if (params.get("format") !== "pdf") {
    return NextResponse.json({
      declaration: contexte.declaration,
      preparation,
      anomalies,
      pret: anomalies.length === 0,
      modifieDepuisPreparation,
    })
  }

  const buffer = await genererPdf({
    declaration: contexte.declaration,
    exploitation: contexte.exploitation,
    preparation,
    anomalies,
    snapshotHash,
  })
  await journaliserEvenementReglementaire(prisma, {
    userId,
    declarationKey: contexte.declaration.key,
    action: "DOCUMENT_CIRCULATION_GENERE",
    actorUserId: acteurReglementaire(session.user),
    snapshotHash,
    metadata: {
      year: parsedYear.data,
      complet: anomalies.length === 0,
      anomalies,
    },
  })

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="preparation-circulation-${contexte.declaration.categorie.toLowerCase()}-${parsedYear.data}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi(request)
  if (error) return error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 })
  }
  const parsed = preparationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const userId = session.user.id
  const contexte = await chargerContexte(userId, parsed.data.year, parsed.data.key)
  if (!contexte.declaration) {
    return NextResponse.json({ error: "Déclaration introuvable" }, { status: 404 })
  }
  if (!declarationCompatibleDocumentCirculation(contexte.declaration)) {
    return NextResponse.json(
      { error: "Le document de circulation préparatoire concerne les mouvements ovins/caprins" },
      { status: 409 },
    )
  }

  const { key, year, ...champs } = parsed.data
  const preparation = normaliserPreparation({
    ...contexte.preparation,
    ...champs,
  })
  const snapshot = construireSnapshotDocumentCirculation(contexte.declaration, preparation)
  const snapshotHash = empreinteDeclaration(snapshot)
  const anomalies = anomaliesDocumentCirculation(contexte.declaration, preparation)

  const data = {
    ...preparation,
    snapshot: snapshot as unknown as Prisma.InputJsonValue,
    snapshotHash,
  }
  const saved = await prisma.$transaction(async (tx) => {
    const document = await tx.preparationDocumentCirculation.upsert({
      where: { userId_declarationKey: { userId, declarationKey: key } },
      create: { userId, declarationKey: key, ...data },
      update: data,
      select: selectPreparation,
    })
    await journaliserEvenementReglementaire(tx, {
      userId,
      declarationKey: key,
      action: "DOCUMENT_CIRCULATION_PREPARE",
      actorUserId: acteurReglementaire(session.user),
      snapshotHash,
      metadata: {
        year,
        complet: anomalies.length === 0,
        anomalies,
      },
    })
    return document
  })

  return NextResponse.json({
    data: normaliserPreparation(saved),
    anomalies,
    pret: anomalies.length === 0,
    snapshotHash,
  })
}
