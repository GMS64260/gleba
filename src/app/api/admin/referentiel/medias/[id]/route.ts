import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth-utils";

const moderationSchema = z.object({
  statut: z.enum(["VALIDE", "REJETE"]),
  principale: z.boolean().optional().default(false),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAdminApi(request);
  if (error) return error;
  const parsed = moderationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Décision invalide" }, { status: 400 });
  const { id } = await params;
  const existing = await prisma.mediaReferentiel.findUnique({ where: { id }, select: { id: true, especeId: true } });
  if (!existing) return NextResponse.json({ error: "Média introuvable" }, { status: 404 });

  const media = await prisma.$transaction(async (tx) => {
    if (parsed.data.statut === "VALIDE" && parsed.data.principale) {
      await tx.mediaReferentiel.updateMany({ where: { especeId: existing.especeId, statut: "VALIDE", principale: true }, data: { principale: false } });
    }
    return tx.mediaReferentiel.update({
      where: { id },
      data: {
        statut: parsed.data.statut,
        principale: parsed.data.statut === "VALIDE" && parsed.data.principale,
        valideParId: session!.user.id,
        valideAt: new Date(),
        controleAt: new Date(),
      },
      select: { id: true, statut: true, principale: true },
    });
  });
  return NextResponse.json({ data: media });
}

