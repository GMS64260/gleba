import type { Metadata } from "next";
import Link from "next/link";
import {
  Egg,
  Bird,
  Stethoscope,
  Wheat,
  Baby,
  ClipboardList,
} from "lucide-react";
import { ScreenshotPlaceholder } from "@/components/seo/ScreenshotPlaceholder";
import { FAQSection, type FAQItem } from "@/components/seo/FAQSection";
import { CTASection } from "@/components/seo/CTASection";
import { Breadcrumb } from "@/components/seo/Breadcrumb";
import { InternalLinks } from "@/components/seo/InternalLinks";

export const metadata: Metadata = {
  title: "Logiciel d'élevage pour petits animaux — Volailles, ruches, ovins, lapins",
  description:
    "Gleba est le logiciel libre de gestion d'élevage pour petites fermes : poules, canards, oies, lapins, brebis, chèvres, ruches. Généalogie, ponte, soins vétérinaires, alimentation, naissances et coûts. Gratuit, open source, hébergé en France.",
  alternates: { canonical: "https://gleba.fr/logiciel-elevage" },
  openGraph: {
    title: "Logiciel d'élevage pour micro-fermes — Gleba",
    description:
      "Volailles, ruches, ovins, lapins : tout pour gérer un petit élevage diversifié.",
    url: "https://gleba.fr/logiciel-elevage",
    type: "article",
  },
};

const FAQS: FAQItem[] = [
  {
    question: "Quel logiciel utiliser pour un petit élevage diversifié ?",
    answer:
      "Les logiciels d'élevage professionnels (Tolma, BoviClic, Synel) sont conçus pour les élevages bovins ou ovins de grande taille avec gestion IPG. Pour un petit élevage diversifié (poules, lapins, brebis, ruches) typique des micro-fermes, Gleba est la solution libre la plus adaptée : généalogie simple, suivi sanitaire, alimentation, ponte ou production de miel, calcul de coût.",
  },
  {
    question: "Quelles espèces sont prises en charge ?",
    answer:
      "Gleba gère par défaut les volailles (poules pondeuses, poulets de chair, canards, oies, dindes, pintades), les ruches d'abeilles, les ovins (brebis, chèvres), les lapins, et les escargots. Vous pouvez ajouter vos propres espèces et catégories.",
  },
  {
    question: "Gleba calcule-t-il les coûts de production par animal ?",
    answer:
      "Oui. Vous saisissez l'alimentation distribuée, les traitements vétérinaires, l'amortissement des installations, et Gleba calcule le coût de production par œuf, par kilo de viande ou par kilo de miel. Vous savez immédiatement quelle activité est rentable.",
  },
  {
    question: "Comment se passe le suivi sanitaire ?",
    answer:
      "Chaque traitement vétérinaire est enregistré (produit, dose, date, animal ou lot, délai d'attente avant consommation des œufs ou de la viande). Gleba génère automatiquement le carnet sanitaire conforme aux exigences DGAL et bio. Les rappels de vaccination et vermifugation sont automatiques.",
  },
  {
    question: "Le suivi des ruches est-il inclus ?",
    answer:
      "Oui. Gleba gère vos ruches individuellement : visite, état de la colonie, présence de la reine, couvain, réserves, traitements varroa, récoltes de miel et de propolis. Vous pouvez aussi suivre vos miellées par fleur dominante.",
  },
];

export default function Page() {
  return (
    <>
      <Breadcrumb items={[{ label: "Logiciel d'élevage", href: "/logiciel-elevage" }]} />

      <section className="px-4 pt-6 pb-20 sm:pt-12 sm:pb-24">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs tracking-[0.25em] uppercase text-emerald-600/70 font-medium mb-6">
            Volailles · Ruches · Ovins · Lapins · Élevage paysan
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extralight tracking-tight text-slate-900 leading-[1.1]">
            Le logiciel libre pour
            <br />
            <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-600 bg-clip-text text-transparent font-normal">
              les petits élevages
            </span>
          </h1>
          <p className="mt-8 text-lg sm:text-xl text-slate-500 font-light max-w-2xl mx-auto leading-relaxed">
            Poules pondeuses, canards, oies, brebis, lapins, ruches… <strong className="text-slate-700 font-medium">Tout pour
            gérer un élevage paysan diversifié</strong> : généalogie, ponte, soins vétérinaires, alimentation,
            naissances et coûts. Gratuit, open source, hébergé en France.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center px-7 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors shadow-lg shadow-emerald-600/20"
            >
              Essayer Gleba gratuitement
            </Link>
            <a
              href="#fonctionnalites"
              className="inline-flex items-center px-7 py-3.5 rounded-full border border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700 text-sm font-medium transition-colors"
            >
              Voir les fonctionnalités
            </a>
          </div>

          <ScreenshotPlaceholder
            alt="Vue suivi élevage Gleba avec poulailler, ruches et coûts d'alimentation"
            caption="Vue d'ensemble d'un élevage diversifié"
            aspectRatio="16/9"
            priority
            className="mt-16"
          />
        </div>
      </section>

      <section className="py-20 px-4 bg-white/60">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading text-3xl sm:text-4xl font-extralight text-slate-900 tracking-tight text-center mb-12">
            Un outil pour l&apos;<span className="font-normal">élevage paysan</span>
          </h2>

          <div className="space-y-5 text-[17px] leading-relaxed text-slate-600">
            <p>
              Sur une micro-ferme, l&apos;élevage est rarement « gros ». Une trentaine de poules pondeuses, dix
              ruches, vingt brebis, une cinquantaine de lapins. Pourtant, la charge mentale est énorme&nbsp;:
              alimentation quotidienne, ramassage des œufs, observations sanitaires, naissances, traitements,
              tenue du carnet sanitaire obligatoire, gestion des reproducteurs.
            </p>
            <p>
              Les logiciels d&apos;élevage existants sont calibrés pour les fermes industrielles bovines ou
              ovines avec gestion IPG et performance technico-économique. Ils sont chers, complexes et inadaptés
              à un atelier de 30 poules ou à 10 ruches. La majorité des éleveurs paysans en sont réduits au
              cahier ou au tableur.
            </p>
            <p>
              <strong className="text-slate-900 font-medium">
                Gleba est conçu pour les petits élevages diversifiés
              </strong>{" "}
              et s&apos;intègre naturellement avec votre maraîchage et votre verger&nbsp;: les fientes de
              poulailler nourrissent le compost, les ruches pollinisent le verger, les brebis tondent les
              inter-rangs. Tout est suivi dans la même interface, avec une comptabilité unifiée.
            </p>
          </div>
        </div>
      </section>

      <section id="fonctionnalites" className="py-24 px-4 scroll-mt-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extralight text-slate-900 tracking-tight">
              Le quotidien de l&apos;élevage,
              <br />
              <span className="font-normal">simplifié</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: Egg,
                title: "Ponte et production",
                description:
                  "Pointez la ponte au jour le jour. Suivez la production de miel par hausse, le poids des agneaux, les portées de lapins.",
              },
              {
                icon: Bird,
                title: "Généalogie",
                description:
                  "Reproducteurs, lignées, arbres généalogiques. Pour les races locales et les sélections paysannes.",
              },
              {
                icon: Stethoscope,
                title: "Carnet sanitaire",
                description:
                  "Traitements vétérinaires, vaccinations, vermifugations, délais d'attente. Conforme DGAL et bio. Exportable pour le contrôle.",
              },
              {
                icon: Wheat,
                title: "Alimentation",
                description:
                  "Suivi des distributions, des stocks de céréales et de fourrage, du coût alimentaire par animal et par mois.",
              },
              {
                icon: Baby,
                title: "Naissances & mortalité",
                description:
                  "Couvaisons, naissances, taux de prolificité, mortalité néonatale, sevrage. Pour piloter votre renouvellement.",
              },
              {
                icon: ClipboardList,
                title: "Coûts & rentabilité",
                description:
                  "Coût de production par œuf, par kilo de viande, par kilo de miel. Marge nette par atelier. Pour savoir ce qui rapporte.",
              },
            ].map((feature) => (
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
            alt="Carnet sanitaire numérique avec traitements vétérinaires et délais d'attente"
            caption="Carnet sanitaire numérique, prêt pour le contrôle"
            aspectRatio="4/3"
            className="mt-16"
          />
        </div>
      </section>

      <InternalLinks currentPath="/logiciel-elevage" />

      <FAQSection title="Questions sur le logiciel d'élevage" faqs={FAQS} />

      <CTASection
        title="Pilotez votre élevage paysan avec sérénité"
        subtitle="Carnet sanitaire numérique, généalogie, coûts. Gratuit. Hébergé en France."
      />
    </>
  );
}
