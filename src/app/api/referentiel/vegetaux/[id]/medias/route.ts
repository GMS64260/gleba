import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthApi } from "@/lib/auth-utils";
import { stockerImageReferentiel, supprimerImagesStockees, verifierTailleImage } from "@/lib/media-storage";
import { visibiliteReferentielPublic } from "@/lib/referentiel-public";
import { contributionMediaSchema } from "@/lib/validations/media-referentiel";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuthApi(request);
  if (error) return error;
  const { id } = await params;

  const espece = await prisma.espece.findFirst({ where: { AND: [{ id }, visibiliteReferentielPublic] }, select: { id: true } });
  if (!espece) return NextResponse.json({ error: "Végétal public introuvable" }, { status: 404 });

  let formData: FormData;
  try { formData = await request.formData(); } catch { return NextResponse.json({ error: "Corps multipart invalide" }, { status: 400 }); }
  const file = formData.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "Image manquante" }, { status: 400 });
  if (!ALLOWED_MIME.has(file.type.toLowerCase())) return NextResponse.json({ error: "Format attendu : JPEG, PNG ou WebP" }, { status: 415 });
  try { verifierTailleImage(file.size); } catch { return NextResponse.json({ error: "Image vide ou supérieure à 8 Mo" }, { status: 413 }); }

  const parsed = contributionMediaSchema.safeParse({
    auteur: formData.get("auteur"),
    organe: formData.get("organe") || "plante",
    description: formData.get("description") || "",
    confirmationDroits: formData.get("confirmationDroits"),
    acceptationLicence: formData.get("acceptationLicence"),
  });
  if (!parsed.success) return NextResponse.json({ error: "Contribution invalide", details: parsed.error.flatten() }, { status: 400 });

  let stored: Awaited<ReturnType<typeof stockerImageReferentiel>> | null = null;
  try {
    stored = await stockerImageReferentiel(Buffer.from(await file.arrayBuffer()), "membre");
    const media = await prisma.mediaReferentiel.create({
      data: {
        especeId: espece.id,
        source: "MEMBRE",
        statut: "PROPOSE",
        url: stored.url,
        miniatureUrl: stored.miniatureUrl,
        auteur: parsed.data.auteur,
        licence: "CC BY 4.0",
        urlLicence: "https://creativecommons.org/licenses/by/4.0/",
        citation: `${parsed.data.auteur} / Gleba, CC BY 4.0`,
        organe: parsed.data.organe,
        description: parsed.data.description || null,
        contributeurId: session!.user.id,
      },
      select: { id: true, statut: true },
    });
    return NextResponse.json({ data: media, message: "Photo proposée à la modération" }, { status: 201 });
  } catch (err) {
    if (stored) await supprimerImagesStockees(stored.absolutePaths);
    const code = err instanceof Error ? err.message : "";
    if (code === "IMAGE_DIMENSIONS") return NextResponse.json({ error: "Image trop petite (minimum 300 × 300 px)" }, { status: 422 });
    console.error("POST media referentiel error", err);
    return NextResponse.json({ error: "Impossible d'enregistrer la contribution" }, { status: 500 });
  }
}

