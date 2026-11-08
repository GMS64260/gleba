import { jsonLdSoftware } from "@/lib/seo/logiciel"
import type { Metadata } from "next"
import Link from "next/link"
import { MarketingShell } from "@/components/seo/MarketingShell"
import { Offres } from "@/components/abonnement/Offres"
import { TEXTE_OFFRE } from "@/lib/abonnement/catalogue"
import { ogBase } from "@/lib/seo/og"

export const metadata: Metadata = {
  title: "Tarifs Gleba : Essentiel à 5 €, Complet à 12 € par mois",
  description: "Trois mois d’essai gratuits. Un atelier jardin, verger ou élevage à 5 € HT/mois ; tous les modules, l’IA et la précomptabilité à 12 € HT/mois.",
  alternates: { canonical: "https://gleba.fr/tarifs" },
  openGraph: { ...ogBase, title: "Tarifs Gleba : un atelier ou toute la ferme", description: TEXTE_OFFRE, url: "https://gleba.fr/tarifs", type: "website" },
}
export default function Tarifs() {
  return <MarketingShell><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSoftware) }} /><div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
    <h1 className="max-w-3xl text-balance font-display text-4xl font-medium leading-tight tracking-tight text-foret sm:text-5xl">Les tarifs de Gleba, selon vos besoins.</h1>
    <p className="mt-5 max-w-2xl text-lg leading-8 text-ardoise">Pour le jardin et le maraîchage, le verger ou l’élevage : commencez avec votre travail quotidien, puis choisissez ce qui vous est utile.</p>
    <div className="mt-12"><Offres /></div>
    <section className="mt-12 max-w-3xl space-y-7" aria-labelledby="questions-tarifs"><h2 id="questions-tarifs" className="font-display text-2xl text-foret">Avant de choisir</h2>
      <div><h3 className="font-semibold text-encre">Que comprend l’essai ?</h3><p className="mt-2 leading-7 text-ardoise">Trois mois calendaires avec l’accès complet, sans carte bancaire, dès votre première connexion. À la fin, vous souscrivez explicitement à Essentiel ou Complet. Vos données restent consultables et exportables si vous ne souscrivez pas.</p></div>
      <div><h3 className="font-semibold text-encre">Qu’est-ce qu’un atelier ?</h3><p className="mt-2 leading-7 text-ardoise">Une activité de production : jardin et maraîchage, verger ou élevage. Plusieurs cultures, parcelles ou espèces animales ne créent pas de supplément à l’intérieur de cet atelier.</p></div>
      <div><h3 className="font-semibold text-encre">La comptabilité est-elle incluse ?</h3><p className="mt-2 leading-7 text-ardoise">La facturation et la précomptabilité sont incluses dans Complet à 12 € HT/mois. Elles préparent vos données et documents ; Gleba ne remplace pas une clôture comptable ni l’accompagnement de votre comptable.</p></div>
      <div><h3 className="font-semibold text-encre">Et les comptes déjà inscrits ?</h3><p className="mt-2 leading-7 text-ardoise">Les comptes présents lors de l’annonce conservent leur accès complet gratuitement à vie. Ce maintien est attaché au compte existant, sans carte ni abonnement à souscrire.</p></div>
      <div><h3 className="font-semibold text-encre">Puis-je héberger Gleba moi-même ?</h3><p className="mt-2 leading-7 text-ardoise">Oui. Le socle public sous licence AGPL-3.0 reste gratuit et auto-hébergeable. Les services privés du site hébergé, dont l’agent IA et la boutique en ligne, ne font pas partie de ce socle.</p></div>
      <div><h3 className="font-semibold text-encre">Comment changer ou résilier ?</h3><p className="mt-2 leading-7 text-ardoise">Le propriétaire gère l’abonnement dans les paramètres. Un changement de formule prend effet au prochain renouvellement ; la résiliation conserve la période déjà payée. L’historique reste récupérable.</p></div>
      <Link href="/conditions-service" className="inline-flex min-h-11 items-center font-medium text-foret underline underline-offset-4">Lire les conditions du service hébergé</Link>
    </section>
  </div></MarketingShell>
}
