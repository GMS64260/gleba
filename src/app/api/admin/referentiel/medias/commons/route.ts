import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth-utils";
import { stockerImageReferentiel, supprimerImagesStockees, verifierTailleImage } from "@/lib/media-storage";
import { importCommonsSchema } from "@/lib/validations/media-referentiel";

const IMAGE_HOST = "upload.wikimedia.org";
const ORIGIN_HOST = "commons.wikimedia.org";
const LICENSE_HOSTS = new Set(["creativecommons.org", "creativecommons.org."]);

function verifierUrls(data: { imageUrl: string; miniatureUrl?: string; urlOrigine: string; urlLicence: string }) {
  if (new URL(data.imageUrl).hostname !== IMAGE_HOST) throw new Error("IMAGE_HOST");
  if (data.miniatureUrl && new URL(data.miniatureUrl).hostname !== IMAGE_HOST) throw new Error("IMAGE_HOST");
  if (new URL(data.urlOrigine).hostname !== ORIGIN_HOST) throw new Error("ORIGIN_HOST");
  const licenseHost = new URL(data.urlLicence).hostname;
  if (!LICENSE_HOSTS.has(licenseHost)) throw new Error("LICENSE_HOST");
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAdminApi(request);
  if (error) return error;
  const parsed = importCommonsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Métadonnées Commons invalides", details: parsed.error.flatten() }, { status: 400 });

  try { verifierUrls(parsed.data); } catch { return NextResponse.json({ error: "Seuls les fichiers upload.wikimedia.org, leurs pages Commons et une licence Creative Commons sont acceptés" }, { status: 400 }); }
  const espece = await prisma.espece.findUnique({ where: { id: parsed.data.especeId }, select: { id: true } });
  if (!espece) return NextResponse.json({ error: "Végétal introuvable" }, { status: 404 });

  let stored: Awaited<ReturnType<typeof stockerImageReferentiel>> | null = null;
  try {
    const response = await fetch(parsed.data.imageUrl, { redirect: "error", signal: AbortSignal.timeout(12_000), headers: { "User-Agent": "Gleba/1.0 (https://gleba.fr; referentiel media import)" } });
    if (!response.ok) throw new Error("DOWNLOAD");
    const contentType = response.headers.get("content-type")?.split(";")[0];
    if (!contentType || !["image/jpeg", "image/png", "image/webp"].includes(contentType)) throw new Error("CONTENT_TYPE");
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength) verifierTailleImage(declaredLength);
    const buffer = Buffer.from(await response.arrayBuffer());
    verifierTailleImage(buffer.length);
    stored = await stockerImageReferentiel(buffer, "commons");

    const media = await prisma.$transaction(async (tx) => {
      if (parsed.data.principale) await tx.mediaReferentiel.updateMany({ where: { especeId: espece.id, statut: "VALIDE", principale: true }, data: { principale: false } });
      return tx.mediaReferentiel.create({
        data: { especeId: espece.id, source: "WIKIMEDIA_COMMONS", statut: "VALIDE", url: stored!.url, miniatureUrl: stored!.miniatureUrl, urlOrigine: parsed.data.urlOrigine, auteur: parsed.data.auteur, licence: parsed.data.licence, urlLicence: parsed.data.urlLicence, citation: parsed.data.citation, organe: parsed.data.organe, description: parsed.data.description || null, principale: parsed.data.principale, valideParId: session!.user.id, valideAt: new Date(), controleAt: new Date() },
        select: { id: true, url: true, miniatureUrl: true },
      });
    });
    return NextResponse.json({ data: media }, { status: 201 });
  } catch (err) {
    if (stored) await supprimerImagesStockees(stored.absolutePaths);
    console.error("POST import Commons referentiel error", err);
    return NextResponse.json({ error: "Import Commons impossible" }, { status: 422 });
  }
}

