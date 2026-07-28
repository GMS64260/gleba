import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthApi } from "@/lib/auth-utils"
import {
  acteurReglementaire,
  journaliserEvenementReglementaire,
} from "@/lib/elevage/audit-reglementaire"
import prisma from "@/lib/prisma"

const idSchema = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/)
const stockageSchema =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.zip$/i

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const parsedId = idSchema.safeParse((await context.params).id)
  if (!parsedId.success) {
    return NextResponse.json({ error: "Archive invalide" }, { status: 400 })
  }
  const archive = await prisma.archiveRegistreElevage.findFirst({
    where: { id: parsedId.data, userId: session.user.id },
  })
  if (!archive || !stockageSchema.test(archive.stockageNom)) {
    return NextResponse.json({ error: "Archive introuvable" }, { status: 404 })
  }

  let contenu: Buffer
  try {
    contenu = await readFile(path.join(
      process.cwd(),
      "storage",
      "registres",
      session.user.id,
      archive.stockageNom,
    ))
  } catch {
    return NextResponse.json(
      { error: "Le fichier archivé est introuvable. Contactez le support." },
      { status: 404 },
    )
  }

  const empreinteCalculee = createHash("sha256").update(contenu).digest("hex")
  if (empreinteCalculee !== archive.archiveSha256) {
    return NextResponse.json(
      {
        error:
          "Le contrôle d’intégrité de l’archive a échoué. Le téléchargement est bloqué.",
      },
      { status: 409 },
    )
  }

  await journaliserEvenementReglementaire(prisma, {
    userId: session.user.id,
    declarationKey: `registre-complet:${archive.annee}`,
    action: "REGISTRE_COMPLET_ARCHIVE_TELECHARGE",
    actorUserId: acteurReglementaire(session.user),
    snapshotHash: archive.snapshotHash,
    metadata: {
      archiveId: archive.id,
      archiveSha256: archive.archiveSha256,
      tailleOctets: archive.tailleOctets,
    },
  })

  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${archive.nomFichier}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Gleba-Archive-Sha256": archive.archiveSha256,
    },
  })
}
