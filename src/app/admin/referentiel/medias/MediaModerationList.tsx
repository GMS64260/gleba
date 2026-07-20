"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Check, Loader2, Star, X } from "lucide-react";

type Media = { id: string; url: string; miniatureUrl: string | null; auteur: string; licence: string; citation: string; organe: string; description: string | null; createdAt: string; espece: { id: string; nom: string | null } };

export function MediaModerationList({ initialMedias }: { initialMedias: Media[] }) {
  const [medias, setMedias] = useState(initialMedias);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, statut: "VALIDE" | "REJETE", principale = false) {
    setBusy(id); setError(null);
    const response = await fetch(`/api/admin/referentiel/medias/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ statut, principale }) });
    if (response.ok) setMedias((items) => items.filter((item) => item.id !== id));
    else setError((await response.json().catch(() => ({}))).error || "Modération impossible");
    setBusy(null);
  }

  if (!medias.length) return <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">Aucune photo en attente.</div>;
  return <div className="mt-8 space-y-5">{error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{medias.map((media) => <article key={media.id} className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-[280px_1fr]"><div className="relative min-h-64 bg-slate-100"><Image src={media.url} alt={`${media.espece.nom || media.espece.id} — ${media.organe}`} fill sizes="280px" className="object-cover" /></div><div className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><Link href={`/referentiel/vegetaux/${encodeURIComponent(media.espece.id)}`} target="_blank" className="text-lg font-semibold text-emerald-800 hover:underline">{media.espece.nom || media.espece.id}</Link><p className="mt-1 text-sm text-slate-500">{media.organe} · proposée le {new Date(media.createdAt).toLocaleDateString("fr-FR")}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{media.licence}</span></div><dl className="mt-5 grid gap-3 text-sm"><div><dt className="text-slate-400">Crédit</dt><dd className="text-slate-800">{media.citation}</dd></div>{media.description && <div><dt className="text-slate-400">Description</dt><dd className="text-slate-800">{media.description}</dd></div>}</dl><div className="mt-6 flex flex-wrap gap-2"><button disabled={busy === media.id} onClick={() => decide(media.id, "VALIDE")} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white"><Check className="h-4 w-4" /> Valider</button><button disabled={busy === media.id} onClick={() => decide(media.id, "VALIDE", true)} className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"><Star className="h-4 w-4" /> Valider comme principale</button><button disabled={busy === media.id} onClick={() => decide(media.id, "REJETE")} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700"><X className="h-4 w-4" /> Rejeter</button>{busy === media.id && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}</div></div></article>)}</div>;
}

