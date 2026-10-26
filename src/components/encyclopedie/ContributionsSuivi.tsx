"use client"

import * as React from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { ComparaisonCorrection } from "./ComparaisonCorrection"
import { urlCorrection } from "./correction-liens"
import { useIsDemoAccount } from "@/hooks/use-is-demo"
import { messageErreurReponse } from "@/lib/api-erreur"
import { urlConnexion } from "@/lib/auth-retour"
import { TITRES_SECTIONS, type ContributionEncyclopedieVue, type StatutContribution } from "@/lib/encyclopedie/types"

const LIBELLES: Record<StatutContribution, string> = {
  EN_ATTENTE: "En relecture", PUBLIEE: "Publiée", A_REPRENDRE: "À reprendre", REFUSEE: "Non retenue",
}

export function ContributionsSuivi() {
  const { status } = useSession()
  const demo = useIsDemoAccount()
  const [items, setItems] = React.useState<ContributionEncyclopedieVue[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [generation, setGeneration] = React.useState(0)

  React.useEffect(() => {
    if (status !== "authenticated" || demo) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const response = await fetch("/api/communaute/contributions", { signal: controller.signal, cache: "no-store" })
        if (!response.ok) throw new Error(await messageErreurReponse(response))
        const data: { contributions: ContributionEncyclopedieVue[] } = await response.json()
        if (!controller.signal.aborted) setItems(data.contributions)
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Le suivi est momentanément indisponible.")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()
    return () => controller.abort()
  }, [status, demo, generation])

  if (status === "loading") return <p role="status" className="py-8 text-sm text-ardoise">Chargement du suivi…</p>
  if (status === "unauthenticated") return (
    <div className="rounded-xl border border-lin bg-craie p-6">
      <h2 className="font-display text-2xl text-foret">Contribuer à une connaissance commune</h2>
      <p className="mt-2 max-w-2xl text-sm text-ardoise">Ouvrez une fiche pour proposer un passage sourcé ou une photo. Un compte personnel permet de suivre la relecture et les réponses de l’équipe.</p>
      <Button asChild className="mt-4"><Link href={urlConnexion("/communaute?tab=contribuer")}>Se connecter pour contribuer</Link></Button>
    </div>
  )
  if (demo) return <p role="note" className="rounded-xl border border-lin bg-craie p-6 text-sm text-ardoise">Les contributions sont signées par une personne. Créez votre compte pour proposer une amélioration et en suivre la relecture.</p>
  return (
    <section aria-labelledby="mes-contributions" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="mes-contributions" className="font-display text-2xl text-foret">Mes propositions</h2>
        <Button variant="outline" disabled={loading} onClick={() => setGeneration(v => v + 1)}>Actualiser</Button>
      </div>
      {loading && <p role="status" className="text-sm text-ardoise">Chargement des propositions…</p>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {!loading && !error && items.length === 0 && <p className="rounded-xl border border-dashed border-lin p-6 text-sm text-ardoise">Vous n’avez pas encore proposé de modification. Ouvrez un végétal dans l’encyclopédie, puis cliquez sur « Modifier » auprès de l’élément à corriger.</p>}
      {items.map(item => (
        <article key={item.id} className="rounded-xl border border-lin bg-craie p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-md bg-sauge-doux px-2.5 py-1 text-xs font-medium text-foret">{LIBELLES[item.statut]}</span>
            <time dateTime={item.createdAt} className="text-xs text-ardoise">{new Date(item.createdAt).toLocaleDateString("fr-FR")}</time>
          </div>
          <h3 className="mt-3 font-medium text-encre">{item.espece.nom} · {item.correction?.titre ?? TITRES_SECTIONS[item.section]}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ardoise">{item.motif}</p>
          {item.decisionMotif && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-papier p-3 text-sm text-encre"><strong>Retour de relecture : </strong>{item.decisionMotif}</p>}
          <details className="mt-3 text-sm">
            <summary className="flex min-h-11 cursor-pointer items-center text-foret">Relire ma proposition</summary>
            {item.correction ? <ComparaisonCorrection detail={item.correction} /> : <p className="whitespace-pre-wrap break-words text-ardoise">{item.contenu}</p>}
            <p className="mt-3 whitespace-pre-wrap break-words text-xs text-ardoise">Source : {item.source}</p>
          </details>
          <Link className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-foret underline-offset-4 hover:underline" href={item.correction ? urlCorrection(item.espece.id, item.correction.cibleType, item.correction.refId, item.statut === "A_REPRENDRE") : `/referentiel/vegetaux/${encodeURIComponent(item.espece.id)}${item.statut === "A_REPRENDRE" ? `?section=${item.section}` : ""}#communaute-fiche`}>{item.statut === "A_REPRENDRE" ? "Préparer une nouvelle proposition" : "Revoir la fiche"} →</Link>
        </article>
      ))}
    </section>
  )
}
