import Link from "next/link"
import { FORMULES, TEXTE_EXISTANTS, type Formule } from "@/lib/abonnement/catalogue"
import { cn } from "@/lib/utils"

/** Même catalogue que le paiement et les droits : aucune grille indépendante dans la vitrine. */
export function Offres({ compacte = false }: { compacte?: boolean }) {
  return <section id="tarifs" aria-labelledby="titre-offres" className="scroll-mt-24">
    <h2 id="titre-offres" className="font-display text-3xl font-medium tracking-tight text-foret">Trois mois pour prendre vos marques.</h2>
    <p className="mt-3 max-w-2xl text-base leading-7 text-ardoise">Essayez Gleba avec tous ses modules. À la fin des trois mois gratuits, choisissez l’offre qui correspond à votre ferme. Sans carte bancaire pour commencer.</p>
    <div className="mt-8 grid overflow-hidden rounded-xl border border-lin bg-craie md:grid-cols-2">
      {(["essentiel", "complet"] as Formule[]).map((id, i) => {
        const offre = FORMULES[id]
        return <article key={id} className={cn("p-6 sm:p-8", i === 1 && "border-t border-lin bg-sauge-doux/40 md:border-l md:border-t-0")}>
          <h3 className="font-display text-2xl font-medium text-foret">{offre.nom}</h3>
          <p className="mt-3 tabular-nums text-encre"><strong className="text-4xl font-semibold">{offre.prix} €</strong><span className="ml-2 text-sm text-ardoise">HT / mois par exploitation</span></p>
          <p className="mt-4 max-w-prose text-sm leading-6 text-ardoise">{offre.description}</p>
          <ul className="mt-5 space-y-2 text-sm leading-6 text-encre">{offre.inclus.map(t => <li key={t}>{t}</li>)}</ul>
          {offre.exclus.length > 0 && <p className="mt-5 border-t border-lin pt-4 text-sm leading-6 text-ardoise">Sans agent IA, météo, boutique en ligne ni comptabilité.</p>}
          <Link href="/register" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-sauge px-5 py-3 text-sm font-semibold text-white hover:bg-foret focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sauge">Commencer les trois mois gratuits</Link>
        </article>
      })}
    </div>
    <p className="mt-4 max-w-3xl text-sm leading-6 text-ardoise">Aucun abonnement payant sans votre accord. Le code libre et l’auto-hébergement restent gratuits. {TEXTE_EXISTANTS}</p>
    {compacte && <Link href="/tarifs" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-foret underline underline-offset-4">Comparer les offres et les conditions</Link>}
  </section>
}
