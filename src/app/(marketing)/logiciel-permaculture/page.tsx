import type { Metadata } from "next";
import Link from "next/link";
import {
  Layers,
  Moon,
  Leaf,
  CloudRain,
  Sprout,
  TreeDeciduous,
} from "lucide-react";
import { ScreenshotPlaceholder } from "@/components/seo/ScreenshotPlaceholder";
import { FAQSection, type FAQItem } from "@/components/seo/FAQSection";
import { CTASection } from "@/components/seo/CTASection";
import { Breadcrumb } from "@/components/seo/Breadcrumb";
import { InternalLinks } from "@/components/seo/InternalLinks";

export const metadata: Metadata = {
  title: "Logiciel de permaculture — Conception, design et gestion de ferme permacole",
  description:
    "Gleba est le logiciel libre de référence pour les fermes en permaculture : design 2D, associations de cultures, rotations longues, calendrier lunaire, biodiversité, verger-maraîcher, ruches et poulaillers. Gratuit, open source, hébergé en France.",
  alternates: { canonical: "https://gleba.fr/logiciel-permaculture" },
  openGraph: {
    title: "Logiciel de permaculture — Gleba",
    description:
      "Le logiciel libre pour concevoir, gérer et suivre une ferme en permaculture.",
    url: "https://gleba.fr/logiciel-permaculture",
    type: "article",
  },
};

const FAQS: FAQItem[] = [
  {
    question: "Quel logiciel utiliser pour concevoir une ferme en permaculture ?",
    answer:
      "Pour le design initial (cartographie, zones, secteurs, courbes de niveau), des outils comme QGIS ou des plans manuels restent pertinents. Pour la gestion quotidienne (cultures, rotations, associations, suivi des récoltes, traçabilité, comptabilité), Gleba est le seul logiciel libre qui couvre l'ensemble du cycle de vie d'une ferme permacole.",
  },
  {
    question: "Gleba gère-t-il les associations de cultures et les guildes ?",
    answer:
      "Oui. Gleba intègre une base d'associations bénéfiques (tomate/basilic, carotte/poireau, maïs/haricot/courge) et signale les associations à éviter. Le moteur de planification respecte ces règles automatiquement quand vous placez vos cultures sur les planches.",
  },
  {
    question: "Le calendrier lunaire est-il inclus ?",
    answer:
      "Oui. Gleba affiche les phases de la lune, les jours fruits/feuilles/fleurs/racines selon la biodynamie, et recommande les périodes optimales pour semer, repiquer, tailler ou récolter selon vos cultures.",
  },
  {
    question: "Peut-on suivre verger-maraîcher, ruches et basse-cour ?",
    answer:
      "Oui. Gleba a été conçu pour les systèmes permacoles diversifiés. Vous pouvez gérer simultanément un verger-maraîcher (arbres + cultures intercalaires), des ruches (récoltes de miel, traitements varroa), une basse-cour (ponte, alimentation, généalogie) et des zones de biodiversité.",
  },
  {
    question: "Gleba est-il adapté à un projet de design permacole en amont d'installation ?",
    answer:
      "Oui. Vous pouvez modéliser votre projet sur le plan 2D (parcelles, planches, arbres, zones humides) avant l'installation, simuler vos rotations sur 5 ans et estimer rendements et besoins en intrants. C'est un excellent outil pour les dossiers de prêt ou de subvention.",
  },
];

export default function Page() {
  return (
    <>
      <Breadcrumb items={[{ label: "Logiciel de permaculture", href: "/logiciel-permaculture" }]} />

      <section className="px-4 pt-6 pb-20 sm:pt-12 sm:pb-24">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs tracking-[0.25em] uppercase text-emerald-600/70 font-medium mb-6">
            Permaculture · Agroécologie · Biodynamie · Systèmes vivants
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extralight tracking-tight text-slate-900 leading-[1.1]">
            Le logiciel libre pour
            <br />
            <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-600 bg-clip-text text-transparent font-normal">
              vos fermes en permaculture
            </span>
          </h1>
          <p className="mt-8 text-lg sm:text-xl text-slate-500 font-light max-w-2xl mx-auto leading-relaxed">
            Design 2D du site, associations de cultures, rotations longues, calendrier lunaire, verger-maraîcher,
            ruches, basse-cour. <strong className="text-slate-700 font-medium">Tout pour concevoir, lancer et suivre une ferme
            permacole productive</strong> — dans un logiciel libre, gratuit et hébergé en France.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center px-7 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors shadow-lg shadow-emerald-600/20"
            >
              Essayer gratuitement
            </Link>
            <a
              href="#principes"
              className="inline-flex items-center px-7 py-3.5 rounded-full border border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700 text-sm font-medium transition-colors"
            >
              Voir les fonctionnalités
            </a>
          </div>

          <ScreenshotPlaceholder
            alt="Design 2D d'une ferme en permaculture avec zones, planches, arbres et mare"
            caption="Design 2D d'une ferme permacole avec zones, planches et verger-maraîcher"
            aspectRatio="16/9"
            priority
            className="mt-16"
          />
        </div>
      </section>

      <section className="py-20 px-4 bg-white/60">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading text-3xl sm:text-4xl font-extralight text-slate-900 tracking-tight text-center mb-12">
            La permaculture, en pratique <span className="font-normal">au quotidien</span>
          </h2>

          <div className="space-y-5 text-[17px] leading-relaxed text-slate-600">
            <p>
              La permaculture est une éthique et un ensemble de principes&nbsp;: observer avant d&apos;agir, créer
              des systèmes résilients, intégrer plutôt que séparer, valoriser la diversité, transformer le déchet
              en ressource. Au quotidien sur une ferme, c&apos;est aussi&nbsp;: trois ateliers en parallèle, vingt
              espèces dans la même planche, des arbres fruitiers entre les rangs de légumes, une ruche dans le
              fond, et trente poules qui se baladent dans le verger.
            </p>
            <p>
              Aucun logiciel agricole grand public ne pense comme ça. Tous séparent les activités (maraîchage
              d&apos;un côté, élevage de l&apos;autre), traitent une planche comme une monoculture, et ignorent
              les interactions entre cultures, arbres et animaux. Résultat&nbsp;: les permaculteurs reviennent au
              papier ou au tableur.
            </p>
            <p>
              <strong className="text-slate-900 font-medium">
                Gleba a été construit autour des pratiques permacoles&nbsp;:
              </strong>{" "}
              associations de cultures, guildes, étagement vertical, rotations longues, verger-maraîcher,
              calendrier lunaire et biodynamique, intégration animale, traçabilité non chimique.
            </p>
          </div>
        </div>
      </section>

      <section id="principes" className="py-24 px-4 scroll-mt-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extralight text-slate-900 tracking-tight">
              Conçu pour les <span className="font-normal">systèmes vivants</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: Layers,
                title: "Associations & guildes",
                description:
                  "Base d'associations bénéfiques et antagonistes intégrée. Le moteur respecte vos guildes lors de la planification automatique.",
              },
              {
                icon: TreeDeciduous,
                title: "Verger-maraîcher",
                description:
                  "Modélisez vos lignes d'arbres fruitiers avec cultures intercalaires. Suivez la productivité par strate et par parcelle.",
              },
              {
                icon: Moon,
                title: "Calendrier lunaire",
                description:
                  "Phases de la lune, jours fruits/feuilles/fleurs/racines selon la biodynamie. Recommandations adaptées culture par culture.",
              },
              {
                icon: CloudRain,
                title: "Gestion de l'eau",
                description:
                  "Pluviométrie par parcelle, baissières, mares, irrigation par cycle de plante. Adapté aux installations en climat sec.",
              },
              {
                icon: Leaf,
                title: "Biodiversité",
                description:
                  "Suivi des haies, mares, bandes fleuries, hôtels à insectes. Indicateurs de biodiversité par parcelle.",
              },
              {
                icon: Sprout,
                title: "Semences paysannes",
                description:
                  "Gérez vos lots de semences, vos sélections variétales, vos échanges avec d'autres fermes. Aucune dépendance aux catalogues.",
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
            alt="Vue calendrier lunaire avec jours fruits, feuilles, fleurs et racines"
            caption="Calendrier lunaire biodynamique intégré"
            aspectRatio="16/10"
            className="mt-16"
          />
        </div>
      </section>

      <InternalLinks currentPath="/logiciel-permaculture" />

      <FAQSection
        title="Questions sur le logiciel de permaculture"
        faqs={FAQS}
      />

      <CTASection
        title="Concevez et suivez votre ferme permacole avec Gleba"
        subtitle="Logiciel libre, gratuit, hébergé en France. Démarrez votre design 2D en quelques minutes."
      />
    </>
  );
}
