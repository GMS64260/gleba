import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import {
  acteurReglementaire,
  journaliserEvenementReglementaire,
} from "@/lib/elevage/audit-reglementaire"
import {
  csvCell,
  empreinteDeclaration,
  STATUTS_DECLARATION,
} from "@/lib/elevage/declarations-reglementaires"
import { chargerDeclarationsReglementaires } from "@/lib/elevage/declarations-reglementaires.server"

const currentYear = () => new Date().getUTCFullYear()
const yearSchema = z.coerce.number().int().min(1990).max(currentYear() + 1)
const statutSchema = z.enum(STATUTS_DECLARATION)

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi(request)
  if (error) return error

  const params = new URL(request.url).searchParams
  const parsedYear = yearSchema.safeParse(params.get("year") ?? String(currentYear()))
  if (!parsedYear.success) {
    return NextResponse.json({ error: "Année invalide" }, { status: 400 })
  }

  const parsedStatut = params.get("statut")
    ? statutSchema.safeParse(params.get("statut"))
    : null
  if (parsedStatut && !parsedStatut.success) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 })
  }

  const userId = session.user.id
  const resultat = await chargerDeclarationsReglementaires(userId, {
    year: parsedYear.data,
  })
  const statut = parsedStatut?.data
  const declarations = statut
    ? resultat.declarations.filter((declaration) => declaration.statut === statut)
    : resultat.declarations

  const entete = [
    "Référence Gleba",
    "Statut",
    "Type",
    "Date événement",
    "Échéance",
    "Organisme",
    "N° EDE",
    "Espèce",
    "Cible",
    "Identifiants",
    "Quantité",
    "Origine",
    "Destination",
    "Anomalies",
    "Date transmission",
    "Canal",
    "Référence transmission",
  ]
  const lignes = declarations.map((declaration) => [
    declaration.key,
    declaration.statut,
    declaration.type,
    declaration.dateEvenement.slice(0, 10),
    declaration.dateEcheance.slice(0, 10),
    declaration.organisme,
    declaration.numeroEde,
    declaration.espece,
    declaration.cible,
    declaration.identifiants.join(", "),
    declaration.quantite,
    declaration.origine,
    declaration.destination,
    declaration.anomalies.join(" | "),
    declaration.transmisAt?.slice(0, 10),
    declaration.canalTransmission,
    declaration.referenceTransmission,
  ])
  const csv = `\uFEFF${[entete, ...lignes].map((ligne) => ligne.map(csvCell).join(";")).join("\r\n")}\r\n`
  const snapshotHash = empreinteDeclaration({
    version: 1,
    year: parsedYear.data,
    statut: statut ?? null,
    declarations: declarations.map((declaration) => ({
      key: declaration.key,
      snapshotHash: declaration.snapshotHash,
      statut: declaration.statut,
    })),
  })
  await journaliserEvenementReglementaire(prisma, {
    userId,
    declarationKey: `export:${parsedYear.data}:${statut ?? "TOUS"}`,
    action: "EXPORT_CSV_GENERE",
    actorUserId: acteurReglementaire(session.user),
    snapshotHash,
    metadata: {
      year: parsedYear.data,
      statut: statut ?? null,
      nombreDeclarations: declarations.length,
    },
  })

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="declarations-elevage-${parsedYear.data}.csv"`,
      "Cache-Control": "private, no-store",
    },
  })
}
