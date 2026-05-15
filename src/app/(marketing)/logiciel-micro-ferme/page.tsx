import type { Metadata } from "next";
import Link from "next/link";
import {
  Sprout,
  TreeDeciduous,
  Egg,
  Receipt,
  ClipboardCheck,
  Bot,
  ArrowRight,
} from "lucide-react";
import { ScreenshotPlaceholder } from "@/components/seo/ScreenshotPlaceholder";
import { FAQSection, type FAQItem } from "@/components/seo/FAQSection";
import { CTASection } from "@/components/seo/CTASection";

export const metadata: Metadata = {
  title: "Logiciel pour micro-ferme — Gérer maraîchage, verger, élevage et ventes",
  description:
    "Gleba est le logiciel libre tout-en-un pour gérer une micro-ferme diversifiée : maraîchage, verger, élevage, comptabilité, traçabilité et plan 2D. Pensé pour les écolieux, fermes en permaculture et installations bio. Gratuit, hébergé en France.",
  alternates: { canonical: "https://gleba.fr/logiciel-micro-ferme" },
  openGraph: {
    title: "Logiciel pour micro-ferme — Gleba",
    description:
      "Le logiciel libre tout-en-un pour gérer une micro-ferme diversifiée : maraîchage, verger, élevage, comptabilité.",
    url: "https://gleba.fr/logiciel-micro-ferme",
    type: "article",
  },
};

const FAQS: FAQItem[] = [
  {
    question: "Qu'est-ce qu'une micro-ferme ?",
    answer:
      "Une micro-ferme est une exploitation agricole de petite surface (souvent moins de 5 hectares) hautement diversifiée, qui combine généralement maraîchage bio, verger, petit élevage et vente directe. Elle s'oppose au modèle de spécialisation extrême et privilégie l'autonomie, la résilience et la création de valeur sur peu de surface.",
  },
  {
    question: "Quel logiciel choisir pour gérer une micro-ferme ?",
    answer:
      "La majorité des logiciels agricoles sont spécialisés sur un seul métier (maraîchage ou élevage ou viticulture). Gleba est conçu spécifiquement pour les micro-fermes diversifiées : il couvre tous les ateliers dans une seule interface, avec une comptabilité unifiée et une traçabilité commune.",
  },
  {
    question: "Gleba convient-il à un écolieu ou un jardin pédagogique ?",
    answer:
      "Oui. Plusieurs écolieux et jardins partagés utilisent Gleba pour mutualiser la planification des cultures, suivre les interventions des bénévoles, gérer les arbres fruitiers, les ruches ou les poulaillers, et tenir une comptabilité associative simple.",
  },
  {
    question: "Quelle est la différence entre Gleba et un ERP agricole classique ?",
    answer:
      "Un ERP agricole traditionnel (Mes Parcelles, Smag, Geofolia) est conçu pour la grande culture céréalière conventionnelle : déclarations PAC, intrants chimiques, gros matériel. Gleba est pensé pour la petite agriculture diversifiée bio : planches de maraîchage, vergers de variétés anciennes, vente directe, traçabilité simple.",
  },
  {
    question: "Combien de temps faut-il pour démarrer avec Gleba ?",
    answer:
      "Comptez environ 30 minutes pour dessiner vos parcelles, importer vos cultures et lancer votre première planification. Une démo pré-remplie permet de tester immédiatement toutes les fonctionnalités sans saisie.",
  },
];

const ACTIVITIES = [
  {
    icon: Sprout,
    title: "Maraîchage",
    description:
      "Planification des semis, rotations, associations, plan 2D, rendements, marges par culture. 135 espèces pré-configurées.",
    href: "/logiciel-maraichage",
  },
  {
    icon: TreeDeciduous,
    title: "Verger",
    description:
      "Arbres fruitiers, variétés anciennes, tailles, greffes, pollinisation, traitements bio, récoltes par arbre.",
    href: "/logiciel-verger",
  },
  {
    icon: Egg,
    title: "Élevage",
    description:
      "Volailles, ruches, ovins. Généalogie, ponte, soins vétérinaires, alimentation, naissances, coûts.",
    href: "/logiciel-elevage",
  },
  {
    icon: Receipt,
    title: "Comptabilité",
    description:
      "Factures, clients, fournisseurs, TVA, calcul des coûts de production, marges nettes par atelier.",
  },
  {
    icon: ClipboardCheck,
    title: "Traçabilité",
    description:
      "Interventions phytosanitaires, AMM, doses, DAR. Conforme à la réglementation française pour les contrôles bio et phyto.",
  },
  {
    icon: Bot,
    title: "Assistant IA",
    description:
      "Posez vos questions en français : « Quoi semer ? », « Quelle marge sur les tomates ? ». Réponses basées sur vos vraies données.",
  },
];

export default function Page() {
  return (
    <>
      {/* HERO */}
      <section className="px-4 pt-12 pb-20 sm:pt-20 sm:pb-24">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs tracking-[0.25em] uppercase text-emerald-600/70 font-medium mb-6">
            Micro-fermes · Écolieux · Permaculture · Vente directe
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extralight tracking-tight text-slate-900 leading-[1.1]">
            Le logiciel libre pour gérer{" "}
            <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-600 bg-clip-text text-transparent font-normal">
              une micro-ferme
            </span>
            <br className="hidden sm:block" /> diversifiée
          </h1>
          <p className="mt-8 text-lg sm:text-xl text-slate-500 font-light max-w-2xl mx-auto leading-relaxed">
            Maraîchage, verger, élevage, comptabilité, traçabilité et IA dans un <strong className="text-slate-700 font-medium">seul logiciel
            open source</strong>. Conçu spécifiquement pour les fermes diversifiées bio, les écolieux et les
            jardins pédagogiques. Gratuit, hébergé en France, prêt en 30 minutes.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center px-7 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors shadow-lg shadow-emerald-600/20"
            >
              Essayer Gleba gratuitement
            </Link>
            <a
              href="#ateliers"
              className="inline-flex items-center px-7 py-3.5 rounded-full border border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700 text-sm font-medium transition-colors"
            >
              Voir les modules
            </a>
          </div>

          <ScreenshotPlaceholder
            alt="Tableau de bord Gleba d'une micro-ferme avec vue maraîchage, verger et élevage"
            caption="Tableau de bord d'une micro-ferme diversifiée"
            aspectRatio="16/9"
            priority
            className="mt-16"
          />
        </div>
      </section>

      {/* POURQUOI UN LOGICIEL DEDIE AUX MICRO-FERMES */}
      <section className="py-20 px-4 bg-white/60">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading text-3xl sm:text-4xl font-extralight text-slate-900 tracking-tight text-center mb-12">
            Pourquoi les <span className="font-normal">micro-fermes</span> méritent
            <br />
            leur propre logiciel
          </h2>

          <div className="space-y-5 text-[17px] leading-relaxed text-slate-600">
            <p>
              Une micro-ferme, ce n&apos;est pas juste « une petite ferme ». C&apos;est un modèle agricole
              radicalement différent&nbsp;: forte diversification, vente directe, intensification écologique,
              autonomie sur les semences et les intrants, et souvent un projet de vie autant qu&apos;une activité
              économique. Les outils numériques disponibles aujourd&apos;hui ne tiennent pas compte de cette
              spécificité.
            </p>
            <p>
              Les ERP agricoles classiques (Mes Parcelles, Smag, Geofolia, Isagri) ont été pensés pour la grande
              culture céréalière conventionnelle&nbsp;: ils gèrent des centaines d&apos;hectares mais ignorent
              les planches de 25&nbsp;mètres, les associations de cultures, les rotations longues bio, les variétés
              anciennes ou les ruches partagées. Les logiciels spécialisés (Brinjel pour le maraîchage, Tolma
              pour l&apos;élevage) couvrent un seul atelier et obligent à jongler entre plusieurs abonnements.
            </p>
            <p>
              <strong className="text-slate-900 font-medium">
                Gleba est conçu autour du modèle micro-fermicole&nbsp;: une seule interface pour le maraîchage, le
                verger, l&apos;élevage, la comptabilité et la traçabilité.
              </strong>{" "}
              Vos données sont reliées : la récolte de carottes alimente la traçabilité, la facture et le calcul
              de marge en une seule saisie.
            </p>
          </div>
        </div>
      </section>

      {/* ATELIERS */}
      <section id="ateliers" className="py-24 px-4 scroll-mt-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs tracking-[0.25em] uppercase text-emerald-600/60 font-medium mb-4">
              Tous vos ateliers
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extralight text-slate-900 tracking-tight">
              Un seul logiciel pour <span className="font-normal">toute la ferme</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ACTIVITIES.map((activity) => {
              const Wrapper = activity.href ? Link : "div";
              const wrapperProps = activity.href ? { href: activity.href } : {};
              return (
                <Wrapper
                  key={activity.title}
                  {...(wrapperProps as { href: string })}
                  className={`block bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 p-7 hover:border-emerald-200 transition-colors ${
                    activity.href ? "cursor-pointer" : ""
                  }`}
                >
                  <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 mb-5">
                    <activity.icon className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2 tracking-tight flex items-center gap-2">
                    {activity.title}
                    {activity.href && (
                      <ArrowRight className="h-4 w-4 text-emerald-600/60" />
                    )}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {activity.description}
                  </p>
                </Wrapper>
              );
            })}
          </div>

          <ScreenshotPlaceholder
            alt="Vue plan 2D d'une micro-ferme avec parcelles maraîchères, verger et poulailler"
            caption="Plan 2D complet d'une micro-ferme : maraîchage, verger, élevage"
            aspectRatio="16/10"
            className="mt-16"
          />
        </div>
      </section>

      {/* POUR QUI */}
      <section className="py-24 px-4 bg-white/60">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-heading text-3xl sm:text-4xl font-extralight text-slate-900 tracking-tight">
              Pour qui est conçu <span className="font-normal">Gleba</span> ?
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: "Maraîchers bio en installation",
                description:
                  "Pour structurer votre exploitation dès le départ, planifier vos rotations sur 5 ans et tracer vos pratiques.",
              },
              {
                title: "Fermes en permaculture",
                description:
                  "Pour gérer ensemble vergers, mares, ruches, poulaillers et planches de maraîchage avec une vision systémique.",
              },
              {
                title: "Écolieux et collectifs",
                description:
                  "Pour mutualiser la planification, suivre les chantiers participatifs et tenir une comptabilité partagée.",
              },
              {
                title: "Jardins pédagogiques",
                description:
                  "Pour outiller des projets associatifs, scolaires ou d'insertion avec un logiciel libre et gratuit.",
              },
            ].map((profile) => (
              <div
                key={profile.title}
                className="bg-white rounded-2xl border border-slate-100 p-6"
              >
                <h3 className="text-base font-medium text-slate-900 mb-3 tracking-tight">
                  {profile.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {profile.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FAQSection
        title="Questions sur le logiciel de micro-ferme"
        faqs={FAQS}
      />

      <CTASection
        title="Lancez votre micro-ferme avec un seul logiciel"
        subtitle="Gratuit. Open source. Hébergé en France. Démarrage en 30 minutes."
      />
    </>
  );
}
