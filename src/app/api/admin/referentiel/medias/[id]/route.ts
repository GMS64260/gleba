import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { moderateurEncyclopedie } from "@/lib/encyclopedie/http";
import { getActeurId } from "@/lib/exploitation/garde-session";

const moderationSchema = z.object({
  statut: z.enum(["VALIDE", "REJETE"]),
  principale: z.boolean().optional().default(false),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await moderateurEncyclopedie(request);
  if (error) return error;
  const parsed = moderationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Décision invalide" }, { status: 400 });
  const { id } = await params;
  const existing = await prisma.mediaReferentiel.findUnique({ where: { id }, select: { id: true, especeId: true } });
  if (!existing) return NextResponse.json({ error: "Média introuvable" }, { status: 404 });

  const media = await prisma.$transaction(async (tx) => {
    // La décision ne s'applique qu'à une photo encore proposée : rejetée depuis
    // un autre onglet, elle redevenait publique par un « Valider » resté
    // affichable (équipe debug, D212).
    const prise = await tx.mediaReferentiel.updateMany({
      where: { id, statut: "PROPOSE" },
      data: {
        statut: parsed.data.statut,
        principale: false,
        valideParId: getActeurId(session),
        valideAt: new Date(),
        controleAt: new Date(),
      },
    });
    if (prise.count === 0) return null;
    if (parsed.data.statut === "VALIDE" && parsed.data.principale) {
      await tx.mediaReferentiel.updateMany({ where: { especeId: existing.especeId, statut: "VALIDE", principale: true, NOT: { id } }, data: { principale: false } });
      await tx.mediaReferentiel.update({ where: { id }, data: { principale: true } });
    }
    return tx.mediaReferentiel.findUnique({ where: { id }, select: { id: true, statut: true, principale: true } });
  });
  if (!media) {
    return NextResponse.json(
      { error: "Cette photo a déjà été modérée depuis un autre onglet. Actualisez la file.", code: "MODIFIE_AILLEURS" },
      { status: 409 },
    );
  }
  return NextResponse.json({ data: media });
}

