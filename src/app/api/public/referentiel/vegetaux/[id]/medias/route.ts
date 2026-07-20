import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { visibiliteReferentielPublic } from "@/lib/referentiel-public";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const espece = await prisma.espece.findFirst({
    where: { AND: [{ id }, visibiliteReferentielPublic] },
    select: { id: true },
  });
  if (!espece) return NextResponse.json({ error: "Végétal introuvable" }, { status: 404 });

  const medias = await prisma.mediaReferentiel.findMany({
    where: { especeId: espece.id, statut: "VALIDE" },
    select: { id: true, url: true, miniatureUrl: true, urlOrigine: true, auteur: true, licence: true, urlLicence: true, citation: true, organe: true, description: true, principale: true },
    orderBy: [{ principale: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ data: medias });
}

