import Link from "next/link"
import { FORMULES, GRATUIT, MOIS_ESSAI, TEXTE_EXISTANTS } from "@/lib/abonnement/catalogue"

/** Même catalogue que le paiement et les droits : aucune grille indépendante dans la vitrine. */
export function Offres({ compacte = false }: { compacte?: boolean }) {
  const complet = FORMULES.complet
  return <section id="tarifs" aria-labelledby="titre-offres" className="scroll-mt-24">
    <h2 id="titre-offres" className="font-display text-3xl font-medium tracking-tight text-foret">Un carnet gratuit, et Complet quand il vous fait gagner du temps.</h2>
    <p className="mt-3 max-w-2xl text-base leading-7 text-ardoise">Tenez toute votre ferme gratuitement. À l’inscription, vous essayez Complet pendant {MOIS_ESSAI} mois, sans carte bancaire. Ensuite, votre carnet reste gratuit si vous ne souscrivez pas.</p>
    <div className="mt-8 grid overflow-hidden rounded-xl border border-lin bg-craie md:grid-cols-2">
      <article className="p-6 sm:p-8">
        <h3 className="font-display text-2xl font-medium text-foret">{GRATUIT.nom}</h3>
        <p className="mt-3 tabular-nums text-encre"><strong className="text-4xl font-semibold">0 €</strong><span className="ml-2 text-sm text-ardoise">sans limite de durée</span></p>
        <p className="mt-4 max-w-prose text-sm leading-6 text-ardoise">{GRATUIT.description}</p>
        <ul className="mt-5 space-y-2 text-sm leading-6 text-encre">{GRATUIT.inclus.map(t => <li key={t}>{t}</li>)}</ul>
        <Link href="/register" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md border border-sauge px-5 py-3 text-sm font-semibold text-foret hover:bg-sauge-doux focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sauge">Créer mon carnet gratuit</Link>
      </article>
      <article className="border-t border-lin bg-sauge-doux/40 p-6 sm:p-8 md:border-l md:border-t-0">
        <h3 className="font-display text-2xl font-medium text-foret">{complet.nom}</h3>
        <p className="mt-3 tabular-nums text-encre"><strong className="text-4xl font-semibold">{complet.prix} €</strong><span className="ml-2 text-sm text-ardoise">HT / mois par exploitation</span></p>
        <p className="mt-4 max-w-prose text-sm leading-6 text-ardoise">{complet.description}</p>
        <ul className="mt-5 space-y-2 text-sm leading-6 text-encre">{complet.inclus.map(t => <li key={t}>{t}</li>)}</ul>
        <Link href="/register" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-sauge px-5 py-3 text-sm font-semibold text-white hover:bg-foret focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sauge">Essayer Complet {MOIS_ESSAI} mois</Link>
      </article>
    </div>
    <p className="mt-4 max-w-3xl text-sm leading-6 text-ardoise">Aucun abonnement payant sans votre accord. Le code libre et l’auto-hébergement restent gratuits. {TEXTE_EXISTANTS}</p>
    {compacte && <Link href="/tarifs" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-foret underline underline-offset-4">Comparer les offres et les conditions</Link>}
  </section>
}
