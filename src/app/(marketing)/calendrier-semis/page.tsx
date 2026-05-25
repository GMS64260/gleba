import type { Metadata } from "next";
import Link from "next/link";
import {
  Calendar,
  Moon,
  CloudSun,
  MapPin,
  ListChecks,
  Bell,
} from "lucide-react";
import { ScreenshotPlaceholder } from "@/components/seo/ScreenshotPlaceholder";
import { FAQSection, type FAQItem } from "@/components/seo/FAQSection";
import { CTASection } from "@/components/seo/CTASection";
import { Breadcrumb } from "@/components/seo/Breadcrumb";
import { InternalLinks } from "@/components/seo/InternalLinks";

export const metadata: Metadata = {
  title: "Calendrier de semis 2026 — Logiciel libre adapté à votre zone climatique",
  description:
    "Calendrier de semis personnalisé selon votre zone climatique, vos planches et vos cultures. Semis en pleine terre, sous abri, en pépinière. Calendrier lunaire et biodynamique inclus. Gratuit, open source, en ligne.",
  alternates: { canonical: "https://gleba.fr/calendrier-semis" },
  openGraph: {
    title: "Calendrier de semis — Gleba",
    description:
      "Calendrier de semis personnalisé selon votre zone climatique, vos planches et vos cultures.",
    url: "https://gleba.fr/calendrier-semis",
    type: "article",
  },
};

const FAQS: FAQItem[] = [
  {
    question: "Quand semer ses légumes ? Existe-t-il un calendrier de semis ?",
    answer:
      "Les dates de semis varient selon votre zone climatique (Bretagne, Provence, montagne), votre altitude, votre mode de culture (pleine terre, sous abri, en pépinière) et la variété. Gleba génère automatiquement un calendrier de semis personnalisé selon ces paramètres et 135 espèces référencées.",
  },
  {
    question: "Le calendrier de semis Gleba prend-il en compte le calendrier lunaire ?",
    answer:
      "Oui. Pour chaque semaine, Gleba affiche les phases de la lune (croissante/décroissante) et les jours fruits, feuilles, fleurs et racines selon la biodynamie. Vous pouvez activer ou désactiver les recommandations lunaires selon vos pratiques.",
  },
  {
    question: "Comment Gleba sait quand semer dans ma région ?",
    answer:
      "Vous indiquez la localisation de votre ferme (commune ou coordonnées GPS). Gleba en déduit votre zone climatique, la date moyenne des dernières gelées, la date moyenne des premières gelées, et adapte tous les calendriers de semis en conséquence.",
  },
  {
    question: "Le calendrier prend-il en compte la culture sous serre ou tunnel ?",
    answer:
      "Oui. Vous pouvez déclarer vos planches comme « pleine terre », « tunnel froid » ou « serre chauffée ». Gleba décale automatiquement les dates de semis et de plantation pour gagner les 3 à 6 semaines d'avance que permettent les abris.",
  },
  {
    question: "Comment recevoir des rappels de semis ?",
    answer:
      "Gleba envoie chaque lundi un email récapitulatif des semis, plantations et récoltes de la semaine. Vous pouvez aussi recevoir des notifications push sur mobile. Tous les rappels sont personnalisés selon vos cultures planifiées.",
  },
];

export default function Page() {
  return (
    <>
      <Breadcrumb items={[{ label: "Calendrier de semis", href: "/calendrier-semis" }]} />

      <section className="px-4 pt-6 pb-20 sm:pt-12 sm:pb-24">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs tracking-[0.25em] uppercase text-emerald-600/70 font-medium mb-6">
            Calendrier de semis · Zone climatique · Calendrier lunaire
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extralight tracking-tight text-slate-900 leading-[1.1]">
            Le calendrier de semis qui{" "}
            <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-600 bg-clip-text text-transparent font-normal">
              connaît votre ferme
            </span>
          </h1>
          <p className="mt-8 text-lg sm:text-xl text-slate-500 font-light max-w-2xl mx-auto leading-relaxed">
            <strong className="text-slate-700 font-medium">Semaine par semaine, Gleba vous dit quoi semer</strong> : en
            pleine terre, sous abri, en pépinière. Adapté à votre zone climatique, vos planches disponibles, vos
            cultures préférées. Calendrier lunaire et biodynamique inclus.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center px-7 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors shadow-lg shadow-emerald-600/20"
            >
              Obtenir mon calendrier gratuit
            </Link>
            <a
              href="#comment"
              className="inline-flex items-center px-7 py-3.5 rounded-full border border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700 text-sm font-medium transition-colors"
            >
              Comment ça marche
            </a>
          </div>

          <ScreenshotPlaceholder
            alt="Calendrier hebdomadaire de semis Gleba avec phases de lune"
            caption="Calendrier hebdomadaire de semis personnalisé"
            aspectRatio="16/9"
            priority
            className="mt-16"
          />
        </div>
      </section>

      <section className="py-20 px-4 bg-white/60">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading text-3xl sm:text-4xl font-extralight text-slate-900 tracking-tight text-center mb-12">
            Pourquoi un calendrier de semis <span className="font-normal">générique ne suffit pas</span>
          </h2>

          <div className="space-y-5 text-[17px] leading-relaxed text-slate-600">
            <p>
              Les calendriers de semis qu&apos;on trouve en ligne ou au dos des sachets de graines indiquent
              « semer en mars-avril ». C&apos;est juste pour la moyenne nationale, mais inutilisable en
              pratique&nbsp;: en Bretagne et dans le Vaucluse, les vraies dates sont décalées de 6 semaines. Dans
              une serre chauffée, on peut semer 3 mois plus tôt. En montagne, la fenêtre de semis dure 4 mois au
              lieu de 8.
            </p>
            <p>
              Un calendrier de semis utile doit prendre en compte votre <strong className="text-slate-900 font-medium">localisation
              précise, vos planches disponibles, vos abris (serre, tunnel), votre mode de culture (pleine terre,
              pépinière), et vos préférences (calendrier lunaire ou pas)</strong>. C&apos;est exactement ce que
              Gleba fait automatiquement.
            </p>
            <p>
              En quelques minutes, vous obtenez un calendrier hebdomadaire personnalisé, à imprimer ou à
              consulter sur mobile, avec rappels par email. Plus de semis oubliés, plus de fenêtres ratées, plus
              de planches qui restent vides.
            </p>
          </div>
        </div>
      </section>

      <section id="comment" className="py-24 px-4 scroll-mt-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extralight text-slate-900 tracking-tight">
              Comment fonctionne <span className="font-normal">le calendrier Gleba</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: MapPin,
                title: "Localisation et zone climatique",
                description:
                  "Vous indiquez votre commune. Gleba en déduit votre zone climatique, vos dates de gelées moyennes et adapte tous les calendriers.",
              },
              {
                icon: ListChecks,
                title: "Vos cultures, vos planches",
                description:
                  "Vous choisissez vos cultures parmi 135 espèces. Vous indiquez si la planche est en pleine terre, sous tunnel ou en serre chauffée.",
              },
              {
                icon: Calendar,
                title: "Calendrier hebdomadaire",
                description:
                  "Gleba génère une vue semaine par semaine avec semis, plantations, repiquages et récoltes prévus.",
              },
              {
                icon: Moon,
                title: "Calendrier lunaire",
                description:
                  "Phases de la lune et jours fruits/feuilles/fleurs/racines selon la biodynamie. Activable selon vos pratiques.",
              },
              {
                icon: CloudSun,
                title: "Ajustements météo",
                description:
                  "Si la météo annonce un coup de froid ou une vague de chaleur, Gleba vous suggère de décaler les semis sensibles.",
              },
              {
                icon: Bell,
                title: "Rappels personnalisés",
                description:
                  "Email récapitulatif chaque lundi. Notifications mobiles. Plus jamais d'oubli de semis ou de fenêtre ratée.",
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
            alt="Vue calendrier lunaire avec jours fruits, feuilles, fleurs et racines pour le mois en cours"
            caption="Calendrier lunaire biodynamique du mois"
            aspectRatio="4/3"
            className="mt-16"
          />
        </div>
      </section>

      <InternalLinks currentPath="/calendrier-semis" />

      <FAQSection title="Questions sur le calendrier de semis" faqs={FAQS} />

      <CTASection
        title="Obtenez votre calendrier de semis personnalisé"
        subtitle="Inscription en 1 minute. 135 espèces référencées. Calendrier lunaire inclus. Gratuit."
        primaryLabel="Créer mon calendrier"
      />
    </>
  );
}
