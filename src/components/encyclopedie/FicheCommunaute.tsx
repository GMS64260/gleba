"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { History, Loader2, RefreshCw, Sprout } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AvisDialog } from "@/components/avis/AvisDialog"
import { useIsDemoAccount } from "@/hooks/use-is-demo"
import { urlConnexion } from "@/lib/auth-retour"
import { SECTIONS_ENCYCLOPEDIE, TITRES_SECTIONS, type CommunauteVegetalVue, type RevisionEncyclopedieVue, type SectionEncyclopedie } from "@/lib/encyclopedie/types"
import { FormContribution, type BrouillonContribution } from "@/components/encyclopedie/FormContribution"
import { FicheDiscussions } from "@/components/encyclopedie/FicheDiscussions"
import { ReferenceSource } from "@/components/encyclopedie/ReferenceSource"
import { ContexteCorrections, EditeurCorrection } from "@/components/encyclopedie/CorrectionItem"

interface Props {
  especeId: string
  nom: string
  description?: string | null
  initialData?: CommunauteVegetalVue
  children?: React.ReactNode
}
const EMPTY: CommunauteVegetalVue = { sections: [], revisions: [], discussions: [] }
const date = (valeur: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(valeur))

export function FicheCommunaute({ especeId, nom, description, initialData, children }: Props) {
  const { status } = useSession()
  const isDemo = useIsDemoAccount()
  const searchParams = useSearchParams()
  const [data, setData] = React.useState<CommunauteVegetalVue>(initialData ?? EMPTY)
  const [loaded, setLoaded] = React.useState(Boolean(initialData))
  const [loading, setLoading] = React.useState(!initialData)
  const [error, setError] = React.useState<string | null>(null)
  const [tab, setTab] = React.useState("fiche")
  const [editor, setEditor] = React.useState(false)
  const [draft, setDraft] = React.useState<BrouillonContribution | null>(null)
  const [avis, setAvis] = React.useState(false)
  const generation = React.useRef(0)
  const deepLink = React.useRef<string | null>(null)
  const peutPublier = status === "authenticated" && !isDemo
  const fichePath = `/referentiel/vegetaux/${encodeURIComponent(especeId)}`
  const query = searchParams.toString()
  const connexion = urlConnexion(`${fichePath}${query ? `?${query}` : ""}#communaute-fiche`)

  const charger = React.useCallback(async (): Promise<CommunauteVegetalVue | null> => {
    const req = ++generation.current
    setLoading(true)
    try {
      const response = await fetch(`/api/public/referentiel/vegetaux/${encodeURIComponent(especeId)}/communaute`, { cache: "no-store" })
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: unknown } | null
        throw new Error(typeof result?.error === "string" ? result.error : "Les contributions ne sont pas accessibles pour le moment.")
      }
      const result = await response.json() as CommunauteVegetalVue
      if (!Array.isArray(result.sections) || !Array.isArray(result.revisions) || !Array.isArray(result.discussions)) throw new Error("Les contributions n’ont pas pu être chargées. Réessayez.")
      if (req !== generation.current) return null
      setData(result); setLoaded(true); setError(null)
      return result
    } catch (e) {
      if (req === generation.current) setError(e instanceof Error ? e.message : "Chargement impossible.")
      return null
    } finally {
      if (req === generation.current) setLoading(false)
    }
  }, [especeId])

  React.useEffect(() => {
    void charger()
    return () => { generation.current += 1 }
  }, [charger, status])

  const proposer = React.useCallback((section: SectionEncyclopedie, ancienne?: RevisionEncyclopedieVue) => {
    if (!peutPublier) return
    const actuelle = data.sections.find(s => s.section === section)
    const base = actuelle?.contenu ?? (section === "presentation" ? description ?? "" : "")
    setDraft({ section, contenu: ancienne?.contenu ?? base, source: ancienne?.source ?? actuelle?.source ?? "", contenuBase: base, revisionBaseId: actuelle?.revisionId ?? null })
    setEditor(true)
  }, [data.sections, description, peutPublier])

  React.useEffect(() => {
    const section = searchParams.get("section")
    if (!section || !SECTIONS_ENCYCLOPEDIE.includes(section as SectionEncyclopedie) || !peutPublier || !loaded || loading) return
    const key = `${especeId}:${section}`
    if (deepLink.current === key) return
    deepLink.current = key
    proposer(section as SectionEncyclopedie)
  }, [searchParams, especeId, peutPublier, loaded, loading, proposer])

  const invitation = status === "loading" ? <p className="text-sm text-ardoise">Vérification de la connexion…</p> : isDemo ? (
    <p className="rounded-lg border border-lin bg-papier p-4 text-sm leading-6 text-ardoise">Le compte de démonstration est partagé. Utilisez un compte personnel pour proposer un texte ou participer aux échanges.</p>
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-lin bg-papier p-4"><p className="max-w-xl text-sm leading-6 text-ardoise">Connectez-vous avec votre compte personnel pour apporter une source, améliorer un passage ou participer aux échanges.</p><Button asChild variant="outline" className="min-h-11"><Link href={connexion}>Se connecter pour contribuer</Link></Button></div>
  )

  return (
    <ContexteCorrections corrections={data.corrections ?? []}>
    <section id="communaute-fiche" className="mt-8 min-w-0 scroll-mt-8 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-lin pb-5">
        <div className="max-w-2xl"><p className="text-xs font-medium uppercase tracking-widest text-sauge">L’encyclopédie se construit ensemble</p><h2 className="mt-2 font-display text-2xl text-foret sm:text-3xl">Les connaissances et le terrain</h2><p className="mt-2 text-sm leading-6 text-ardoise">Les textes sourcés complètent les repères du catalogue. Les observations locales gardent leur contexte.</p></div>
        <div className="flex flex-wrap items-center gap-2"><Button variant="ghost" className="min-h-11" disabled={loading} onClick={() => { void charger() }} aria-label="Actualiser les contributions">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button></div>
      </div>
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p><Button variant="outline" className="min-h-11" disabled={loading} onClick={() => { void charger() }}>Réessayer</Button></div>}
      <Tabs value={tab} onValueChange={setTab} persist={false}>
        <div className="max-w-full overflow-x-auto pb-1"><TabsList className="h-auto min-h-12 w-max min-w-full justify-start gap-1 border-b border-lin bg-transparent p-0" aria-label="Contenus de la fiche"><TabsTrigger value="fiche" className="min-h-11">Fiche</TabsTrigger><TabsTrigger value="terrain" className="min-h-11">Retours du terrain</TabsTrigger><TabsTrigger value="discussion" className="min-h-11">Discussions{data.discussions.length > 0 ? ` (${data.discussions.length})` : ""}</TabsTrigger><TabsTrigger value="historique" className="min-h-11">Historique</TabsTrigger></TabsList></div>
        <TabsContent value="fiche" className="space-y-6 pt-4">
          {loaded && data.sections.length > 0 ? (
            <div className="space-y-5">{SECTIONS_ENCYCLOPEDIE.map(section => {
              const texte = data.sections.find(s => s.section === section)
              return texte ? <section key={section} id={`texte-communaute-${section}`} className="rounded-xl border border-lin bg-white p-4 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-sauge">Texte communautaire relu</p><h3 className="mt-2 font-display text-2xl text-foret">{TITRES_SECTIONS[section]}</h3></div>{peutPublier && <Button variant="outline" className="min-h-11" onClick={() => proposer(section)} aria-label={`Modifier : ${TITRES_SECTIONS[section]}`}>Modifier</Button>}</div><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-encre">{texte.contenu}</p><div className="mt-5 space-y-2 border-t border-lin pt-4 text-xs leading-5 text-ardoise"><p><span className="font-medium">Source : </span><ReferenceSource source={texte.source} /></p><p>{texte.signature} · Version {texte.version} · {date(texte.createdAt)} · {texte.licence}</p></div></section> : null
            })}</div>
          ) : loaded && !error ? (
            <div className="flex flex-col gap-4 rounded-xl border border-lin bg-sauge-doux/40 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="max-w-2xl"><h3 className="font-medium text-foret">Une connaissance à ajouter à cette fiche ?</h3><p className="mt-2 text-sm leading-6 text-ardoise">Les repères du catalogue sont présentés ci-dessous. Vous pouvez les compléter par un texte sourcé sur le semis, la conduite, la récolte ou la conservation.</p></div>{peutPublier && <Button variant="outline" className="min-h-11 shrink-0" onClick={() => proposer("semis")}>Ajouter une première section</Button>}</div>
          ) : !loaded && !error ? <p role="status" className="flex items-center gap-2 py-3 text-sm text-ardoise"><Loader2 className="h-4 w-4 animate-spin" />Chargement des contributions…</p> : null}
          {!peutPublier && invitation}
          {peutPublier && data.sections.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-lin p-4"><p className="text-sm text-ardoise">Une autre partie de la fiche reste à documenter ?</p><Button variant="outline" className="min-h-11" onClick={() => proposer(SECTIONS_ENCYCLOPEDIE.find(cle => !data.sections.some(s => s.section === cle)) ?? "sources")}>Ajouter une section ou une source</Button></div>}
          {children}
        </TabsContent>
        <TabsContent value="terrain" className="space-y-5 pt-5">
          <div className="max-w-3xl"><Sprout className="mb-3 h-7 w-7 text-sauge" /><h3 className="font-display text-2xl text-foret">Ce qui s’apprend en cultivant</h3><p className="mt-3 text-sm leading-7 text-ardoise">Les avis de Gleba réunissent les observations des membres avec leur contexte de sol et de climat. Un résultat local nourrit la réflexion ; il ne remplace pas une référence générale.</p></div>
          {peutPublier ? <div className="rounded-xl border border-lin bg-white p-5"><p className="mb-4 text-sm leading-6 text-ardoise">Retrouvez les avis existants de cette espèce et ajoutez ou modifiez votre propre retour. Cet espace reste réservé aux membres connectés.</p><Button className="min-h-11" onClick={() => setAvis(true)}>Consulter et partager les retours du terrain</Button></div> : invitation}
        </TabsContent>
        <TabsContent value="discussion" className="pt-5">{loaded ? <FicheDiscussions especeId={especeId} discussions={data.discussions} peutPublier={peutPublier} invitation={invitation} onReload={charger} /> : !error && <p className="py-3 text-sm text-ardoise">Chargement des discussions…</p>}</TabsContent>
        <TabsContent value="historique" className="space-y-5 pt-5">
          <div className="max-w-3xl"><History className="mb-3 h-7 w-7 text-sauge" /><h3 className="font-display text-2xl text-foret">La fiche garde sa mémoire</h3><p className="mt-3 text-sm leading-7 text-ardoise">Chaque texte publié conserve sa source, sa signature et sa version. Une version antérieure peut servir de point de départ à une nouvelle proposition.</p></div>
          {loaded && data.revisions.length === 0 && !error ? <p className="rounded-xl border border-dashed border-lin bg-papier/50 p-5 text-sm text-ardoise">Aucun texte communautaire n’a encore été publié sur cette fiche. Les premières versions apparaîtront après relecture des contributions.</p> : data.revisions.map(r => <article key={r.id} className="rounded-xl border border-lin bg-white p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-medium text-foret">{TITRES_SECTIONS[r.section]} · Version {r.version}</h4><p className="text-xs text-ardoise">{date(r.createdAt)} · {r.signature}</p></div><details className="mt-3"><summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-foret">Lire cette version et sa source</summary><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">{r.contenu}</p><p className="mt-4 text-xs leading-5 text-ardoise">Source : <ReferenceSource source={r.source} /> · {r.licence}</p></details>{peutPublier && <Button variant="outline" className="mt-3 min-h-11" onClick={() => proposer(r.section, r)}>Proposer à partir de cette version</Button>}</article>)}
        </TabsContent>
      </Tabs>
      <EditeurCorrection especeId={especeId} />
      <FormContribution especeId={especeId} nom={nom} open={editor} initial={draft} sections={data.sections} onOpenChange={setEditor} onReload={charger} />
      {peutPublier && <AvisDialog refType="ESPECE" refId={especeId} nom={nom} open={avis} onOpenChange={setAvis} />}
    </section>
    </ContexteCorrections>
  )
}
