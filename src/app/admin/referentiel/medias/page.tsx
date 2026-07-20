import Link from "next/link";
import { ArrowLeft, Images } from "lucide-react";
import { requireAdmin } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";
import { MediaModerationList } from "./MediaModerationList";

export const dynamic = "force-dynamic";

export default async function ModerationMediasPage() {
  await requireAdmin();
  const medias = await prisma.mediaReferentiel.findMany({
    where: { statut: "PROPOSE" },
    select: { id: true, url: true, miniatureUrl: true, auteur: true, licence: true, citation: true, organe: true, description: true, createdAt: true, espece: { select: { id: true, nom: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin/referentiels" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Référentiels</Link>
        <div className="mt-5 flex items-center gap-3"><div className="rounded-xl bg-emerald-100 p-2 text-emerald-700"><Images className="h-6 w-6" /></div><div><h1 className="text-2xl font-bold text-slate-900">Photos proposées</h1><p className="text-sm text-slate-500">Vérifier l’espèce, le contenu et l’attribution avant publication.</p></div></div>
        <MediaModerationList initialMedias={medias.map((media) => ({ ...media, createdAt: media.createdAt.toISOString() }))} />
      </div>
    </main>
  );
}

