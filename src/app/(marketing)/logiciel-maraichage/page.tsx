import type { Metadata } from "next";
import Link from "next/link";
import {
  Calendar,
  Sprout,
  Layers,
  BarChart3,
  Repeat,
  CloudSun,
  Map,
} from "lucide-react";
import { ScreenshotPlaceholder } from "@/components/seo/ScreenshotPlaceholder";
import { FAQSection, type FAQItem } from "@/components/seo/FAQSection";
import { CTASection } from "@/components/seo/CTASection";
import { Breadcrumb } from "@/components/seo/Breadcrumb";
import { InternalLinks } from "@/components/seo/InternalLinks";

export const metadata: Metadata = {
  title: "Logiciel de maraîchage open source — Planification, rotations et traçabilité",
  description:
    "Gleba est le logiciel libre de référence pour le maraîchage diversifié bio : calendrier de semis, rotations longues, associations de cultures, itinéraires techniques, traçabilité phytosanitaire et comptabilité. 135 espèces pré-configurées, gratuit et auto-hébergeable.",
  alternates: { canonical: "https://gleba.fr/logiciel-maraichage" },
  openGraph: {
    title: "Logiciel de maraîchage open source — Gleba",
    description:
      "Planification, rotations, traçabilité, comptabilité : tout pour gérer une ferme maraîchère diversifiée.",
    url: "https://gleba.fr/logiciel-maraichage",
    type: "article",
  },
};

const FAQS: FAQItem[] = [
  {
    question: "Quel est le meilleur logiciel de maraîchage en France ?",
    answer:
      "Le « meilleur » dépend de votre ferme. Gleba se positionne comme le logiciel libre le plus complet pour le maraîchage diversifié : il couvre la planification, les rotations, la traçabilité phytosanitaire, la comptabilité, le verger et l'élevage dans une seule interface, sans abonnement. Les alternatives propriétaires (Brinjel, Qrop, Tolma) sont souvent spécialisées sur un seul aspect et facturées au mois.",
  },
  {
    question: "Gleba est-il adapté au maraîchage bio ?",
    answer:
      "Oui. Gleba a été conçu autour des pratiques bio et permacoles : rotations sur 4 à 8 ans, associations de cultures, calendrier lunaire, itinéraires techniques sans intrants chimiques. La traçabilité phytosanitaire intègre les produits utilisables en agriculture biologique (UAB) et leurs numéros AMM.",
  },
  {
    question: "Combien d'espèces et de variétés sont pré-configurées ?",
    answer:
      "Gleba inclut 135 espèces végétales et fruitières, et plus de 155 variétés référencées avec leurs rendements moyens, besoins en NPK, prix de graines, durées de cycle, espacements de rang, calendriers de semis et de récolte.",
  },
  {
    question: "Peut-on utiliser Gleba sur tablette ou smartphone au champ ?",
    answer:
      "Oui. L'interface mobile est optimisée pour la saisie rapide au champ : enregistrement des interventions, observations sanitaires, récoltes, irrigations. Aucune application à installer, tout fonctionne dans le navigateur.",
  },
  {
    question: "Combien coûte Gleba pour une ferme maraîchère ?",
    answer:
      "Gleba est totalement gratuit en auto-hébergement (licence AGPL-3.0). Pour les fermes qui ne veulent pas gérer la partie technique, un hébergement managé est proposé sur gleba.fr.",
  },
];

const FEATURES = [
  {
    icon: Calendar,
    title: "Calendrier de semis intelligent",
    description:
      "Semaine par semaine, Gleba vous indique quoi semer en pleine terre, sous abri ou en pépinière, en fonction de votre zone climatique, de vos planches disponibles et de vos itinéraires techniques.",
  },
  {
    icon: Repeat,
    title: "Rotations et associations",
    description:
      "Le moteur de planification respecte vos règles de rotation (4 à 8 ans), évite les successions à risque (Solanacées après Solanacées) et propose les bonnes associations (tomate/basilic, carotte/poireau).",
  },
  {
    icon: Map,
    title: "Plan 2D du jardin",
    description:
      "Dessinez vos planches aux vraies dimensions sur un fond cadastral ou satellite. Visualisez en temps réel quelle culture est où, quelles planches sont libres et où programmer la prochaine succession.",
  },
  {
    icon: Layers,
    title: "Itinéraires techniques (ITPs)",
    description:
      "154 ITPs prêts à l'emploi : densité, espacement, dates de semis, repiquage, récolte. Personnalisables culture par culture, planche par planche.",
  },
  {
    icon: BarChart3,
    title: "Rendements et marges",
    description:
      "Suivez vos rendements réels par planche, comparez aux références, calculez le coût de production au kilo et la marge nette par culture. Pour savoir ce qui rapporte vraiment.",
  },
  {
    icon: CloudSun,
    title: "Météo et irrigation",
    description:
      "Prévisions météo localisées, pluviométrie par parcelle, recommandations d'arrosage selon le sol et la culture. Évitez les pertes liées au stress hydrique.",
  },
];

const STEPS = [
  "Dessinez vos parcelles et vos planches sur le plan 2D",
  "Choisissez vos cultures dans la base de 135 espèces",
  "Gleba génère votre calendrier de semis et de récolte",
  "Saisissez vos interventions au champ depuis votre mobile",
  "Suivez vos rendements, marges et traçabilité en temps réel",
];

export default function Page() {
  return (
    <>
      <Breadcrumb items={[{ label: "Logiciel de maraîchage", href: "/logiciel-maraichage" }]} />

      {/* HERO */}
      <section className="px-4 pt-6 pb-20 sm:pt-12 sm:pb-28">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs tracking-[0.25em] uppercase text-emerald-600/70 font-medium mb-6">
            Logiciel libre · Maraîchage diversifié · Bio & permaculture
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extralight tracking-tight text-slate-900 leading-[1.1]">
            Le logiciel de maraîchage{" "}
            <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-600 bg-clip-text text-transparent font-normal">
              open source
            </span>
            <br className="hidden sm:block" /> qui pense comme vous
          </h1>
          <p className="mt-8 text-lg sm:text-xl text-slate-500 font-light max-w-2xl mx-auto leading-relaxed">
            Planification de cultures, rotations, associations, plan 2D du jardin, traçabilité phytosanitaire et
            comptabilité&nbsp;: <strong className="text-slate-700 font-medium">tout ce dont une ferme maraîchère
            diversifiée a besoin, dans un seul logiciel libre</strong>. Gratuit, hébergé en France, prêt à l&apos;emploi
            avec 135 espèces pré-configurées.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center px-7 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors shadow-lg shadow-emerald-600/20"
            >
              Essayer gratuitement
            </Link>
            <a
              href="#fonctionnalites"
              className="inline-flex items-center px-7 py-3.5 rounded-full border border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700 text-sm font-medium transition-colors"
            >
              Voir les fonctionnalités
            </a>
          </div>

          <ScreenshotPlaceholder
            alt="Vue d'ensemble du calendrier de semis maraîcher dans Gleba"
            caption="Le calendrier de semis hebdomadaire, vue d'ensemble"
            aspectRatio="16/9"
            priority
            className="mt-16"
          />
        </div>
      </section>

      {/* POURQUOI UN LOGICIEL DEDIE */}
      <section className="py-20 px-4 bg-white/60">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading text-3xl sm:text-4xl font-extralight text-slate-900 tracking-tight text-center mb-12">
            Pourquoi un <span className="font-normal">logiciel dédié au maraîchage</span> ?
          </h2>

          <div className="prose prose-slate max-w-none space-y-5 text-[17px] leading-relaxed text-slate-600">
            <p>
              Gérer une ferme maraîchère, c&apos;est jongler chaque semaine avec des dizaines de cultures, des dates
              de semis qui s&apos;enchaînent, des rotations à respecter sur plusieurs années, des doses
              phytosanitaires à tracer, des factures à émettre et des récoltes à pointer. Le tableur Excel ou le
              carnet papier finissent toujours par déborder&nbsp;: dates oubliées, calculs erronés, traçabilité
              incomplète au moment du contrôle.
            </p>
            <p>
              Les logiciels agricoles classiques ont été pensés pour la grande culture conventionnelle. Ils sont
              chers, complexes, et ignorent les besoins spécifiques du maraîchage diversifié bio&nbsp;: planches de
              25&nbsp;m, rotations longues, dizaines d&apos;espèces simultanées, vente directe au panier ou au
              marché.
            </p>
            <p>
              <strong className="text-slate-900 font-medium">
                Gleba a été conçu spécifiquement pour les maraîchers professionnels qui veulent un outil simple,
                complet et qu&apos;ils maîtrisent.
              </strong>{" "}
              Open source, hébergé en France ou sur vos serveurs, gratuit, et compatible avec les pratiques bio,
              biodynamiques et permacoles.
            </p>
          </div>
        </div>
      </section>

      {/* FONCTIONNALITES */}
      <section id="fonctionnalites" className="py-24 px-4 scroll-mt-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs tracking-[0.25em] uppercase text-emerald-600/60 font-medium mb-4">
              Fonctionnalités
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extralight text-slate-900 tracking-tight">
              Tout pour le maraîchage,
              <br />
              <span className="font-normal">dans un seul logiciel</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 p-7 hover:border-emerald-200 transition-colors"
              >
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 mb-5">
                  <feature.icon className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2 tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          <ScreenshotPlaceholder
            alt="Plan 2D d'une ferme maraîchère avec planches colorées par culture"
            caption="Plan 2D du jardin avec planches, cultures et rotations"
            aspectRatio="16/10"
            className="mt-16"
          />
        </div>
      </section>

      {/* COMMENT CA MARCHE */}
      <section className="py-24 px-4 bg-white/60">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs tracking-[0.25em] uppercase text-emerald-600/60 font-medium mb-4">
              En 5 étapes
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl font-extralight text-slate-900 tracking-tight">
              Démarrez en moins de <span className="font-normal">30 minutes</span>
            </h2>
          </div>

          <ol className="space-y-5">
            {STEPS.map((step, i) => (
              <li
                key={step}
                className="flex items-start gap-5 bg-white rounded-2xl border border-slate-100 p-6"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-600 text-white font-medium flex items-center justify-center">
                  {i + 1}
                </div>
                <div className="pt-1.5 text-slate-700 leading-relaxed">{step}</div>
              </li>
            ))}
          </ol>

          <ScreenshotPlaceholder
            alt="Écran de saisie d'une intervention au champ depuis un smartphone"
            caption="Saisie mobile d'une intervention au champ"
            aspectRatio="4/3"
            className="mt-16"
          />
        </div>
      </section>

      {/* COMPARATIF */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-heading text-3xl sm:text-4xl font-extralight text-slate-900 tracking-tight text-center mb-12">
            Gleba vs autres logiciels de maraîchage
          </h2>

          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left p-4 font-medium text-slate-700">Critère</th>
                  <th className="text-center p-4 font-medium text-emerald-700">Gleba</th>
                  <th className="text-center p-4 font-medium text-slate-500">SaaS propriétaire</th>
                  <th className="text-center p-4 font-medium text-slate-500">Tableur Excel</th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                {[
                  ["Prix", "Gratuit", "20-80 €/mois", "Gratuit"],
                  ["Code source ouvert", "✓", "✗", "—"],
                  ["Auto-hébergement", "✓", "✗", "✓"],
                  ["Maraîchage + verger + élevage", "✓", "Partiel", "✗"],
                  ["Traçabilité phytosanitaire", "✓", "Souvent payant", "✗"],
                  ["Comptabilité intégrée", "✓", "✗", "✗"],
                  ["Assistant IA en langage naturel", "✓", "✗", "✗"],
                  ["Conforme RGPD France", "✓", "Variable", "—"],
                ].map(([critere, gleba, saas, excel]) => (
                  <tr key={critere} className="border-b border-slate-100 last:border-0">
                    <td className="p-4 font-medium text-slate-700">{critere}</td>
                    <td className="p-4 text-center text-emerald-700 font-medium">{gleba}</td>
                    <td className="p-4 text-center">{saas}</td>
                    <td className="p-4 text-center">{excel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <InternalLinks currentPath="/logiciel-maraichage" />

      <FAQSection
        title="Questions sur le logiciel de maraîchage"
        subtitle="Tout ce que vous devez savoir avant de tester Gleba sur votre ferme maraîchère."
        faqs={FAQS}
      />

      <CTASection
        title="Prêt à essayer Gleba sur votre ferme maraîchère ?"
        subtitle="Inscription en 1 minute. Gratuit. Vos données restent en France. Pas de carte bancaire."
      />
    </>
  );
}
