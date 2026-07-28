import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"

const currentYear = () => new Date().getUTCFullYear()
const yearSchema = z.coerce.number().int().min(1990).max(currentYear() + 1)

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const rawYear = new URL(request.url).searchParams.get("year")
  const parsedYear = rawYear ? yearSchema.safeParse(rawYear) : null
  if (parsedYear && !parsedYear.success) {
    return NextResponse.json({ error: "Année invalide" }, { status: 400 })
  }

  const archives = await prisma.archiveRegistreElevage.findMany({
    where: {
      userId: session.user.id,
      ...(parsedYear?.success ? { annee: parsedYear.data } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      annee: true,
      periodeDebut: true,
      periodeFin: true,
      genereLe: true,
      snapshotHash: true,
      archiveSha256: true,
      tailleOctets: true,
      nomFichier: true,
      annexesIncluses: true,
      annexesSignalees: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ data: archives })
}
