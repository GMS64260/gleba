"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { BookOpen, Camera, ChevronLeft, ChevronRight, Leaf, Loader2, Search, TreeDeciduous } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TYPES_CATALOGUE, type PageCatalogue } from "@/lib/encyclopedie/catalogue"
import { TITRES_SECTIONS, type SectionEncyclopedie } from "@/lib/encyclopedie/types"
import { estTypeVerger, libelleTypeEspece } from "@/lib/validations/espece"

export function CatalogueCommunaute() {
  const router = useRouter()
  const params = useSearchParams()
  const recherche = params.toString()
  const [q, setQ] = React.useState(params.get("q") ?? "")
  const [type, setType] = React.useState(params.get("type") ?? "")
  const [sansPhoto, setSansPhoto] = React.useState(params.get("sansPhoto") === "1")
  const [data, setData] = React.useState<PageCatalogue | null>(null)
  const [erreur, setErreur] = React.useState<string | null>(null)
  const [chargement, setChargement] = React.useState(true)
  const [reessai, setReessai] = React.useState(0)

  React.useEffect(() => {
    const query = new URLSearchParams(recherche)
    setQ(query.get("q") ?? "")
    setType(query.get("type") ?? "")
    setSansPhoto(query.get("sansPhoto") === "1")
    const controller = new AbortController()
    setChargement(true)
    setErreur(null)
    fetch(`/api/public/communaute?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Le catalogue n’a pas pu être chargé. Réessayez dans un instant.")
        return response.json() as Promise<PageCatalogue>
      })
      .then(setData)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setErreur(error instanceof Error ? error.message : "Le catalogue n’a pas pu être chargé.")
      })
      .finally(() => { if (!controller.signal.aborted) setChargement(false) })
    return () => controller.abort()
  }, [recherche, reessai])

  function chercher(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = new URLSearchParams(recherche)
    query.set("tab", "encyclopedie")
    query.delete("page")
    if (q.trim()) query.set("q", q.trim()); else query.delete("q")
    if (type) query.set("type", type); else query.delete("type")
    if (sansPhoto) query.set("sansPhoto", "1"); else query.delete("sansPhoto")
    router.replace(`/communaute?${query}`, { scroll: false })
  }

  function pageUrl(page: number) {
    const query = new URLSearchParams(recherche)
    query.set("tab", "encyclopedie")
    query.set("page", String(page))
    return `/communaute?${query}`
  }

  return (
    <div className="space-y-8">
      <form onSubmit={chercher} className="rounded-xl border border-lin bg-craie p-4 sm:p-5" aria-label="Rechercher dans l’encyclopédie">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_auto]">
          <div>
            <label htmlFor="communaute-recherche" className="mb-1.5 block text-sm font-medium">Un nom de plante, une culture</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-ardoise" aria-hidden />
              <Input id="communaute-recherche" name="q" type="search" value={q} onChange={(event) => setQ(event.target.value)} maxLength={80} placeholder="Tomate, carotte, pommier…" className="h-11 pl-9" />
            </div>
          </div>
          <div>
            <label htmlFor="communaute-type" className="mb-1.5 block text-sm font-medium">Type de plante</label>
            <select id="communaute-type" name="type" value={type} onChange={(event) => setType(event.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Tous les végétaux</option>
              {TYPES_CATALOGUE.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <Button type="submit" className="h-11 self-end">Rechercher</Button>
        </div>
        <label className="mt-4 flex min-h-11 items-center gap-2 text-sm text-ardoise">
          <input name="sansPhoto" type="checkbox" checked={sansPhoto} onChange={(event) => setSansPhoto(event.target.checked)} className="h-4 w-4 accent-sauge" />
          <Camera className="h-4 w-4" aria-hidden /> Fiches à illustrer : aucune photo validée
        </label>
      </form>

      {erreur ? (
        <div role="alert" className="rounded-xl border border-lin bg-craie p-6">
          <p>{erreur}</p>
          <Button variant="outline" onClick={() => setReessai((n) => n + 1)} className="mt-3 min-h-11">Réessayer</Button>
        </div>
      ) : chargement ? (
        <div role="status" className="flex items-center justify-center gap-3 py-16 text-ardoise"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Chargement des fiches…</div>
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ardoise" aria-live="polite">
            <p>{data.total} fiche{data.total > 1 ? "s" : ""} publique{data.total > 1 ? "s" : ""}{data.pages > 1 ? ` · page ${data.page} sur ${data.pages}` : ""}</p>
            {(params.get("q") || params.get("type") || params.get("sansPhoto")) && <Link href="/communaute?tab=encyclopedie" className="inline-flex min-h-11 items-center text-foret underline underline-offset-4">Effacer les filtres</Link>}
          </div>
          {data.especes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-lin bg-craie p-8 text-center text-ardoise">Aucune fiche publique ne correspond à cette recherche. Essayez un autre nom ou retirez un filtre.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.especes.map((espece) => {
                const Icon = estTypeVerger(espece.type) ? TreeDeciduous : Leaf
                return (
                  <Link key={espece.id} href={`/referentiel/vegetaux/${encodeURIComponent(espece.id)}`} className="group flex min-w-0 flex-col rounded-xl border border-lin bg-craie p-5 transition-colors hover:border-sauge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge">
                    <div className="flex items-center justify-between gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sauge-doux text-sauge"><Icon className="h-5 w-5" aria-hidden /></span><span className="text-xs text-ardoise">{libelleTypeEspece(espece.type)}</span></div>
                    <h2 className="mt-4 break-words font-display text-2xl text-encre group-hover:text-foret">{espece.nom}</h2>
                    {espece.nomLatin && <p className="mt-1 break-words text-sm italic text-ardoise">{espece.nomLatin}</p>}
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-ardoise">{espece.description || "Une fiche à enrichir avec des références, des photos et des observations du terrain."}</p>
                    <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-5 text-xs text-ardoise"><span>{espece.nbVarietes} variété{espece.nbVarietes > 1 ? "s" : ""}</span><span>{espece.nbItineraires} itinéraire{espece.nbItineraires > 1 ? "s" : ""}</span></div>
                    <span className="mt-4 flex items-center justify-between border-t border-lin pt-3 text-sm font-medium text-foret">Lire et enrichir la fiche <ChevronRight className="h-4 w-4 shrink-0" aria-hidden /></span>
                  </Link>
                )
              })}
            </div>
          )}
          {data.pages > 1 && (
            <nav aria-label="Pagination de l’encyclopédie" className="flex items-center justify-center gap-3">
              {data.page > 1 ? <Button asChild variant="outline" className="min-h-11"><Link href={pageUrl(data.page - 1)} scroll={false}><ChevronLeft className="mr-1 h-4 w-4" aria-hidden /> Précédente</Link></Button> : <Button variant="outline" disabled className="min-h-11"><ChevronLeft className="mr-1 h-4 w-4" aria-hidden /> Précédente</Button>}
              <span className="text-sm text-ardoise">{data.page} / {data.pages}</span>
              {data.page < data.pages ? <Button asChild variant="outline" className="min-h-11"><Link href={pageUrl(data.page + 1)} scroll={false}>Suivante <ChevronRight className="ml-1 h-4 w-4" aria-hidden /></Link></Button> : <Button variant="outline" disabled className="min-h-11">Suivante <ChevronRight className="ml-1 h-4 w-4" aria-hidden /></Button>}
            </nav>
          )}
          <section className="border-t border-lin pt-6" aria-labelledby="ameliorations-recentes">
            <div className="flex items-center gap-3"><BookOpen className="h-5 w-5 text-sauge" aria-hidden /><h2 id="ameliorations-recentes" className="font-display text-2xl">Dernières améliorations publiées</h2></div>
            {data.contributionsRecentes.length ? <ul className="mt-4 divide-y divide-lin">{data.contributionsRecentes.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-4"><Link href={`/referentiel/vegetaux/${encodeURIComponent(item.espece.id)}#communaute-fiche`} className="min-w-0 text-sm font-medium text-foret underline-offset-4 hover:underline">{item.espece.nom} · {TITRES_SECTIONS[item.section as SectionEncyclopedie] || "Fiche"}</Link><span className="min-w-0 max-w-full break-words text-xs text-ardoise">Par {item.signature} · {new Date(item.createdAt).toLocaleDateString("fr-FR")}</span></li>)}</ul> : <p className="mt-3 text-sm text-ardoise">Les premières corrections relues et publiées apparaîtront ici. Une source ou une précision peut déjà faire avancer une fiche.</p>}
          </section>
        </>
      ) : null}
    </div>
  )
}
