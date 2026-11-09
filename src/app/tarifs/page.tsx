import { jsonLdSoftware } from "@/lib/seo/logiciel"
import type { Metadata } from "next"
import Link from "next/link"
import { MarketingShell } from "@/components/seo/MarketingShell"
import { Offres } from "@/components/abonnement/Offres"
import { TEXTE_OFFRE } from "@/lib/abonnement/catalogue"
import { ogBase } from "@/lib/seo/og"

export const metadata: Metadata = {
  title: "Tarifs Gleba : carnet gratuit, Complet à 12 € par mois",
  description: "Carnet gratuit pour le jardin, le maraîchage, le verger, l’élevage et la facturation. Complet à 12 € HT/mois ajoute l’assistant IA, la météo, la boutique et la gestion, avec trois mois d’essai.",
  alternates: { canonical: "https://gleba.fr/tarifs" },
  openGraph: { ...ogBase, title: "Tarifs Gleba : gratuit, ou Complet à 12 € par mois", description: TEXTE_OFFRE, url: "https://gleba.fr/tarifs", type: "website" },
}
export default function Tarifs() {
  return <MarketingShell><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSoftware) }} /><div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
    <h1 className="max-w-3xl text-balance font-display text-4xl font-medium leading-tight tracking-tight text-foret sm:text-5xl">Les tarifs de Gleba, selon vos besoins.</h1>
    <p className="mt-5 max-w-2xl text-lg leading-8 text-ardoise">Jardin et maraîchage, verger, élevage et facturation : votre carnet est gratuit. Complet ajoute ce qui vous fait gagner du temps chaque jour.</p>
    <div className="mt-12"><Offres /></div>
    <section className="mt-12 max-w-3xl space-y-7" aria-labelledby="questions-tarifs"><h2 id="questions-tarifs" className="font-display text-2xl text-foret">Avant de choisir</h2>
      <div><h3 className="font-semibold text-encre">Que comprend l’essai ?</h3><p className="mt-2 leading-7 text-ardoise">Trois mois calendaires de Complet, sans carte bancaire, dès votre première connexion. À la fin, votre carnet reste gratuit et vos données restent en place. Complet ne continue que si vous y souscrivez.</p></div>
      <div><h3 className="font-semibold text-encre">Y a-t-il une limite dans le carnet gratuit ?</h3><p className="mt-2 leading-7 text-ardoise">Non. Tous les ateliers (jardin et maraîchage, verger, élevage), les cultures, parcelles, arbres, animaux et factures sont compris, sans limite de durée.</p></div>
      <div><h3 className="font-semibold text-encre">La comptabilité est-elle incluse ?</h3><p className="mt-2 leading-7 text-ardoise">Clients, devis, bons de livraison, factures et suivi des règlements sont gratuits. La gestion (dépenses, banque, TVA, bilan, coûts de production) fait partie de Complet. Elle prépare vos données et documents ; Gleba ne remplace pas une clôture comptable ni l’accompagnement de votre comptable.</p></div>
      <div><h3 className="font-semibold text-encre">Et les comptes déjà inscrits ?</h3><p className="mt-2 leading-7 text-ardoise">Les comptes présents lors de l’annonce conservent leur accès complet gratuitement à vie. Ce maintien est attaché au compte existant, sans carte ni abonnement à souscrire.</p></div>
      <div><h3 className="font-semibold text-encre">Puis-je héberger Gleba moi-même ?</h3><p className="mt-2 leading-7 text-ardoise">Oui. Le socle public sous licence AGPL-3.0 reste gratuit et auto-hébergeable. Les services privés du site hébergé, dont l’agent IA et la boutique en ligne, ne font pas partie de ce socle.</p></div>
      <div><h3 className="font-semibold text-encre">Comment résilier ?</h3><p className="mt-2 leading-7 text-ardoise">Le propriétaire gère l’abonnement dans les paramètres. La résiliation conserve la période déjà payée, puis le carnet repasse en gratuit avec toutes ses données.</p></div>
      <Link href="/conditions-service" className="inline-flex min-h-11 items-center font-medium text-foret underline underline-offset-4">Lire les conditions du service hébergé</Link>
    </section>
  </div></MarketingShell>
}
