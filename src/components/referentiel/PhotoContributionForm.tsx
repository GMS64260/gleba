"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Camera, Loader2 } from "lucide-react";

const ORGANES = [
  ["plante", "Plante entière"], ["feuille", "Feuille"], ["fleur", "Fleur"],
  ["fruit", "Fruit"], ["graine", "Graine"], ["ecorce", "Écorce"], ["autre", "Autre"],
] as const;

export function PhotoContributionForm({ especeId, nom }: { especeId: string; nom: string }) {
  const { status } = useSession();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (status === "unauthenticated") {
    return <Link href={`/login?callbackUrl=${encodeURIComponent(`/referentiel/vegetaux/${especeId}`)}`} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-emerald-800 hover:bg-emerald-50"><Camera className="h-4 w-4" /> Se connecter pour proposer une photo</Link>;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true); setError(null); setMessage(null);
    const response = await fetch(`/api/referentiel/vegetaux/${encodeURIComponent(especeId)}/medias`, { method: "POST", body: new FormData(form) }).catch(() => null);
    const result = response ? await response.json().catch(() => ({})) : {};
    if (!response?.ok) setError(result.error || "Envoi impossible");
    else { setMessage("Merci ! La photo sera visible après validation."); form.reset(); }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 sm:grid-cols-2">
      <div className="sm:col-span-2"><h3 className="font-semibold text-slate-900">Photographier {nom}</h3><p className="mt-1 text-sm text-slate-600">Votre photo sera publiée sous CC BY 4.0 après modération. Les métadonnées GPS sont supprimées du fichier.</p></div>
      <label className="text-sm font-medium text-slate-700">Photo JPEG, PNG ou WebP<input required name="file" type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-sm" /></label>
      <label className="text-sm font-medium text-slate-700">Votre nom pour le crédit<input required name="auteur" maxLength={120} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3" /></label>
      <label className="text-sm font-medium text-slate-700">Organe représenté<select name="organe" className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3">{ORGANES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm font-medium text-slate-700">Description facultative<input name="description" maxLength={500} placeholder="Stade, contexte, particularité…" className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3" /></label>
      <label className="flex gap-2 text-sm text-slate-700 sm:col-span-2"><input required type="checkbox" name="confirmationDroits" value="true" className="mt-1" /> Je confirme être l’auteur de cette photo et détenir les droits nécessaires.</label>
      <label className="flex gap-2 text-sm text-slate-700 sm:col-span-2"><input required type="checkbox" name="acceptationLicence" value="true" className="mt-1" /> J’accepte de publier cette photo sous licence CC BY 4.0 avec mon nom comme attribution.</label>
      {error && <p className="text-sm text-red-700 sm:col-span-2">{error}</p>}{message && <p className="text-sm text-emerald-700 sm:col-span-2">{message}</p>}
      <div className="sm:col-span-2"><button disabled={busy || status === "loading"} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} Proposer la photo</button></div>
    </form>
  );
}
