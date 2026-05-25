import type { Metadata } from "next";
import Link from "next/link";
import {
  TreeDeciduous,
  Scissors,
  Bug,
  Droplets,
  Apple,
  Flower2,
} from "lucide-react";
import { ScreenshotPlaceholder } from "@/components/seo/ScreenshotPlaceholder";
import { FAQSection, type FAQItem } from "@/components/seo/FAQSection";
import { CTASection } from "@/components/seo/CTASection";
import { Breadcrumb } from "@/components/seo/Breadcrumb";
import { InternalLinks } from "@/components/seo/InternalLinks";

export const metadata: Metadata = {
  title: "Logiciel de gestion de verger — Pommiers, poiriers, oliviers et variétés anciennes",
  description:
    "Gleba est le logiciel libre de gestion de verger : 25 espèces et 40 variétés référencées (pommiers, poiriers, cerisiers, oliviers, agrumes…). Tailles, greffes, traitements bio, pollinisation, récoltes par arbre et traçabilité phytosanitaire.",
  alternates: { canonical: "https://gleba.fr/logiciel-verger" },
  openGraph: {
    title: "Logiciel de gestion de verger — Gleba",
    description:
      "Tailles, greffes, traitements, récoltes, pollinisation : tout pour gérer un verger diversifié.",
    url: "https://gleba.fr/logiciel-verger",
    type: "article",
  },
};

const FAQS: FAQItem[] = [
  {
    question: "Quel logiciel utiliser pour gérer un verger ?",
    answer:
      "Pour un verger commercial monovariétal de grande taille, des logiciels spécialisés type Mes Vergers existent. Pour un verger diversifié de variétés anciennes, un verger-maraîcher, ou un jardin fruitier domestique, Gleba est le seul outil libre qui couvre l'ensemble : 25 espèces, 40 variétés, tailles, greffes, traitements bio et récoltes par arbre.",
  },
  {
    question: "Quelles espèces d'arbres fruitiers sont incluses ?",
    answer:
      "Gleba intègre par défaut 25 espèces : pommiers, poiriers, cerisiers, pruniers, abricotiers, pêchers, oliviers, figuiers, noisetiers, noyers, châtaigniers, kiwis, agrumes, cognassiers, néfliers, mûriers, vignes, etc. Vous pouvez ajouter vos propres espèces et variétés.",
  },
  {
    question: "Gleba gère-t-il la pollinisation croisée ?",
    answer:
      "Oui. Pour chaque variété, Gleba connaît les groupes de pollinisation et signale les incompatibilités. Le plan 2D vous aide à positionner les pollinisateurs à proximité des variétés autostériles (notamment pour les pommiers et les poiriers).",
  },
  {
    question: "Peut-on tracer les traitements phytosanitaires sur le verger ?",
    answer:
      "Oui. Gleba enregistre chaque traitement avec produit (numéro AMM), dose, date, surface ou arbre concerné, opérateur, conditions météo, et calcule automatiquement les délais avant récolte (DAR). C'est conforme aux exigences des contrôles bio et phytosanitaires français.",
  },
  {
    question: "Comment Gleba aide-t-il à planifier les tailles d'hiver ?",
    answer:
      "Gleba génère un calendrier de tailles personnalisé selon vos espèces et leur stade (formation, fructification, rajeunissement). Vous pouvez suivre arbre par arbre les opérations réalisées, prendre des photos, et noter les observations sanitaires.",
  },
];

export default function Page() {
  return (
    <>
      <Breadcrumb items={[{ label: "Logiciel de verger", href: "/logiciel-verger" }]} />

      <section className="px-4 pt-6 pb-20 sm:pt-12 sm:pb-24">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs tracking-[0.25em] uppercase text-emerald-600/70 font-medium mb-6">
            Vergers · Variétés anciennes · Verger-maraîcher · Agroforesterie
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extralight tracking-tight text-slate-900 leading-[1.1]">
            Le logiciel libre pour
            <br />
            <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-600 bg-clip-text text-transparent font-normal">
              gérer un verger
            </span>
          </h1>
          <p className="mt-8 text-lg sm:text-xl text-slate-500 font-light max-w-2xl mx-auto leading-relaxed">
            Pommiers, poiriers, cerisiers, oliviers, figuiers… <strong className="text-slate-700 font-medium">25 espèces et 40
            variétés référencées</strong>. Tailles, greffes, traitements bio, pollinisation, récoltes par arbre et
            traçabilité phytosanitaire conforme. Gratuit, open source, hébergé en France.
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
            alt="Vue verger Gleba avec arbres fruitiers, variétés et calendrier de tailles"
            caption="Vue verger avec arbres positionnés sur le plan 2D"
            aspectRatio="16/9"
            priority
            className="mt-16"
          />
        </div>
      </section>

      <section className="py-20 px-4 bg-white/60">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading text-3xl sm:text-4xl font-extralight text-slate-900 tracking-tight text-center mb-12">
            Le verger mérite un <span className="font-normal">outil sérieux</span>
          </h2>

          <div className="space-y-5 text-[17px] leading-relaxed text-slate-600">
            <p>
              Un verger, c&apos;est un investissement de décennies. Un pommier met 5 à 7 ans à entrer en pleine
              production, un olivier 15 ans. Chaque arbre est un individu&nbsp;: avec sa variété, son
              porte-greffe, son année de plantation, ses tailles successives, ses traitements et ses récoltes
              annuelles. Quand le verger compte plus de 50 arbres, le carnet papier ne suit plus.
            </p>
            <p>
              Les logiciels arboricoles professionnels existent (Mes Vergers, Pomalliance) mais ils sont conçus
              pour des vergers commerciaux monovariétaux de plusieurs hectares, avec des intrants chimiques et
              une économie d&apos;échelle. Ils sont inadaptés aux vergers de variétés anciennes, aux
              verger-maraîchers permacoles, ou aux jardins fruitiers diversifiés.
            </p>
            <p>
              <strong className="text-slate-900 font-medium">
                Gleba traite chaque arbre comme un individu unique
              </strong>{" "}
              avec son historique complet&nbsp;: variété, porte-greffe, plantation, tailles, greffes,
              traitements, pollinisation, récoltes. Vous pouvez suivre votre verger sur 30 ans dans le même outil.
            </p>
          </div>
        </div>
      </section>

      <section id="fonctionnalites" className="py-24 px-4 scroll-mt-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extralight text-slate-900 tracking-tight">
              Tout pour le verger,
              <br />
              <span className="font-normal">arbre par arbre</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: TreeDeciduous,
                title: "Catalogue d'espèces et variétés",
                description:
                  "25 espèces et 40 variétés pré-configurées : pommiers, poiriers, cerisiers, oliviers, figuiers, agrumes… Ajoutez les vôtres.",
              },
              {
                icon: Scissors,
                title: "Tailles et greffes",
                description:
                  "Calendrier de tailles d'hiver et en vert. Suivi des greffes (écusson, fente, anglaise) et taux de reprise.",
              },
              {
                icon: Flower2,
                title: "Pollinisation",
                description:
                  "Groupes de pollinisation, variétés pollinisatrices recommandées, positionnement spatial sur le plan 2D.",
              },
              {
                icon: Bug,
                title: "Traitements & traçabilité",
                description:
                  "Traitements bio (bouillie bordelaise, soufre, savon noir, badigeons), AMM, doses, DAR. Conforme contrôles bio.",
              },
              {
                icon: Apple,
                title: "Récoltes par arbre",
                description:
                  "Pointez les récoltes arbre par arbre. Comparez les rendements année après année. Identifiez les variétés les plus productives.",
              },
              {
                icon: Droplets,
                title: "Irrigation & paillage",
                description:
                  "Suivi des arrosages au goutte-à-goutte, des paillages organiques et des amendements (compost, BRF).",
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
            alt="Fiche individuelle d'un pommier avec historique de tailles, greffes et récoltes"
            caption="Fiche arbre avec historique complet sur plusieurs années"
            aspectRatio="4/3"
            className="mt-16"
          />
        </div>
      </section>

      <InternalLinks currentPath="/logiciel-verger" />

      <FAQSection title="Questions sur le logiciel de verger" faqs={FAQS} />

      <CTASection
        title="Donnez à votre verger un suivi à la hauteur"
        subtitle="25 espèces pré-configurées. Gratuit. Open source. Hébergé en France."
      />
    </>
  );
}
