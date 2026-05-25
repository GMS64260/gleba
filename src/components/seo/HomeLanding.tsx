/**
 * HomeLanding — Server Component
 *
 * Page d'accueil publique de gleba.fr pour les visiteurs non connectés.
 * SSR complet pour SEO. Contient le JSON-LD FAQPage de la home.
 *
 * Différence avec /login : pas de formulaire de connexion intégré, mais 2 CTAs
 * (Essayer Gleba → /register, Se connecter → /login).
 */

import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  LayoutGrid,
  BarChart3,
  Wrench,
  Sprout,
  TreeDeciduous,
  Egg,
  Receipt,
  Map,
  MessageCircle,
  Plug,
  Shield,
  ChevronDown,
  Github,
  Leaf,
  Database,
  Cpu,
  CloudSun,
  ClipboardCheck,
  Moon,
  Milestone,
  ArrowRight,
} from "lucide-react";

/* ─── Données ─── */

const PILLARS = [
  {
    icon: Calendar,
    title: "Planifiez",
    description:
      "Calendrier de semis, rotations, associations, calendrier lunaire. Des itinéraires techniques prêts à l'emploi pour ne rien oublier.",
  },
  {
    icon: Wrench,
    title: "Gérez",
    description:
      "Cultures, verger, élevage, soins, traitements, irrigations et interventions — tout votre quotidien au même endroit.",
  },
  {
    icon: BarChart3,
    title: "Analysez",
    description:
      "Rendements par planche, coûts de production, factures, traçabilité. Des décisions basées sur vos données.",
  },
];

const MODULES = [
  {
    icon: Sprout,
    title: "Maraîchage & planification",
    description:
      "Calendrier de semis, rotations intelligentes, associations de cultures et itinéraires techniques prêts à l'emploi.",
    accent: "emerald" as const,
    wide: true,
    href: "/logiciel-maraichage",
  },
  {
    icon: TreeDeciduous,
    title: "Verger — 25 espèces",
    description:
      "Pommiers, cerisiers, oliviers… 40 variétés référencées. Tailles, greffes, traitements, pollinisation et suivi sanitaire.",
    accent: "emerald" as const,
    wide: false,
    href: "/logiciel-verger",
  },
  {
    icon: Egg,
    title: "Élevage",
    description:
      "Animaux, généalogie, ponte, soins vétérinaires, alimentation, naissances et analyse des coûts.",
    accent: "amber" as const,
    wide: false,
    href: "/logiciel-elevage",
  },
  {
    icon: Receipt,
    title: "Comptabilité",
    description:
      "Factures, clients, fournisseurs, TVA, coûts de production. Sachez si vous êtes rentable.",
    accent: "slate" as const,
    wide: false,
  },
  {
    icon: Map,
    title: "Plan du jardin 2D",
    description:
      "Dessinez vos planches aux vraies dimensions. Cadastre, satellite et données de sol intégrés.",
    accent: "teal" as const,
    wide: false,
  },
  {
    icon: ClipboardCheck,
    title: "Traçabilité",
    description:
      "Interventions phytosanitaires, numéros AMM, doses, DAR — conformité réglementaire assurée.",
    accent: "slate" as const,
    wide: false,
  },
  {
    icon: CloudSun,
    title: "Météo & irrigation",
    description:
      "Prévisions météo, pluviométrie par parcelle, irrigation automatisée selon le sol et les cultures.",
    accent: "teal" as const,
    wide: false,
  },
  {
    icon: Moon,
    title: "Calendrier lunaire",
    description:
      "Phases de la lune et recommandations biodynamiques pour les semis, plantations et récoltes.",
    accent: "emerald" as const,
    wide: false,
    href: "/calendrier-semis",
  },
  {
    icon: MessageCircle,
    title: "Assistant IA",
    description:
      '"Quoi semer cette semaine ?" — posez vos questions en langage naturel, obtenez des réponses basées sur vos vraies données.',
    accent: "teal" as const,
    wide: true,
    href: "/assistant-ia-agricole",
  },
];

const ACCENT_STYLES: Record<string, { icon: string; hover: string }> = {
  emerald: { icon: "text-emerald-600 bg-emerald-50", hover: "hover:border-emerald-200" },
  teal: { icon: "text-teal-600 bg-teal-50", hover: "hover:border-teal-200" },
  amber: { icon: "text-amber-600 bg-amber-50", hover: "hover:border-amber-200" },
  slate: { icon: "text-slate-600 bg-slate-100", hover: "hover:border-slate-300" },
};

const STATS = [
  { value: "135+", label: "Espèces végétales & fruitières" },
  { value: "155+", label: "Variétés référencées" },
  { value: "9", label: "Modules intégrés" },
  { value: "100%", label: "Open source" },
];

const FAQS: { question: string; answer: string }[] = [
  {
    question: "Qu'est-ce que Gleba ?",
    answer:
      "Gleba est un logiciel libre tout-en-un de gestion pour micro-fermes diversifiées. Il regroupe planification maraîchage, gestion de verger, suivi d'élevage, comptabilité, traçabilité phytosanitaire, plan 2D du jardin et assistant IA. Il s'adresse aux maraîchers professionnels, écolieux, jardins pédagogiques et fermes en permaculture.",
  },
  {
    question: "Gleba est-il un logiciel de maraîchage adapté au bio et à la permaculture ?",
    answer:
      "Oui. Gleba intègre par défaut les rotations longues, les associations de cultures, le calendrier lunaire, les itinéraires techniques bio et la traçabilité phytosanitaire conforme à la réglementation (numéros AMM, doses, DAR). C'est pensé pour les fermes diversifiées, pas pour l'agriculture conventionnelle.",
  },
  {
    question: "Combien coûte Gleba ?",
    answer:
      "Gleba est 100% open source sous licence AGPL-3.0. Vous pouvez l'installer gratuitement sur votre propre serveur (auto-hébergement). Si vous préférez ne pas gérer la technique, nous proposons un hébergement managé sur gleba.fr.",
  },
  {
    question: "Puis-je héberger Gleba sur mon propre serveur ?",
    answer:
      "Oui. Gleba se déploie en une commande avec Docker Compose sur n'importe quel serveur Linux. Le code source est public sur GitHub. Vos données restent chez vous et vous gardez le contrôle complet sur les sauvegardes.",
  },
  {
    question: "Quelle est la différence entre Gleba et Brinjel, Qrop ou Tolma ?",
    answer:
      "Gleba est le seul logiciel libre qui couvre à la fois le maraîchage, le verger, l'élevage, la comptabilité et la traçabilité dans une interface unique. Les outils concurrents sont souvent propriétaires, spécialisés sur un seul métier (maraîchage uniquement) ou en SaaS payant. Gleba est gratuit, auto-hébergeable et inclut une IA.",
  },
  {
    question: "Gleba peut-il remplacer un logiciel de comptabilité ?",
    answer:
      "Gleba inclut un module de comptabilité agricole avec factures, clients, fournisseurs, TVA, calcul des coûts de production et marges par culture. Pour une comptabilité fiscale complète (liasse, bilan), il est complémentaire d'un expert-comptable mais il génère tous les exports nécessaires.",
  },
  {
    question: "Comment fonctionne le calendrier de semis dans Gleba ?",
    answer:
      "Le calendrier de semis s'adapte automatiquement à votre zone climatique, à vos planches et à vos itinéraires techniques. Il vous indique semaine par semaine quoi semer en pleine terre, sous abri ou en pépinière. Il intègre aussi le calendrier lunaire pour les fermes en biodynamie.",
  },
  {
    question: "Mes données agricoles sont-elles en sécurité ?",
    answer:
      "Oui. Gleba est hébergé en France sur des serveurs souverains et respecte le RGPD. En version auto-hébergée, les données ne quittent jamais votre infrastructure. Les sauvegardes sont chiffrées et vous pouvez exporter toutes vos données à tout moment (format CSV / JSON).",
  },
  {
    question: "Gleba propose-t-il une intelligence artificielle ?",
    answer:
      "Oui. Gleba intègre un assistant IA capable de répondre à des questions en langage naturel (\"Quoi semer cette semaine ?\", \"Quelle est ma marge sur les tomates ?\"). L'IA peut fonctionner en local via Ollama pour garantir la confidentialité, ou via les API Claude / OpenAI au choix.",
  },
  {
    question: "Sur quels appareils Gleba fonctionne-t-il ?",
    answer:
      "Gleba fonctionne dans un navigateur web sur ordinateur, tablette et smartphone. L'interface mobile est optimisée pour la saisie au champ (interventions, récoltes, observations). Aucune installation d'application n'est nécessaire.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  inLanguage: "fr-FR",
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export function HomeLanding() {
  return (
    <div className="w-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1 — HERO
          ═══════════════════════════════════════════════════════════════ */}
      <section className="min-h-screen flex flex-col relative">
        {/* Nav minimaliste */}
        <nav className="w-full px-6 md:px-8 py-5 flex items-center justify-between max-w-6xl mx-auto animate-fade-in-up">
          <Link href="/" aria-label="Accueil Gleba">
            <Image
              src="/gleba-logo.png"
              alt="Gleba"
              width={400}
              height={136}
              className="h-12 sm:h-16 w-auto"
              priority
            />
          </Link>
          <div className="flex items-center gap-3 sm:gap-5">
            <Link
              href="/roadmap"
              className="hidden sm:flex items-center gap-1.5 text-sm text-slate-400 hover:text-emerald-600 transition-colors duration-200"
            >
              <Milestone className="h-4 w-4" />
              <span>Roadmap</span>
            </Link>
            <a
              href="https://github.com/GMS64260/gleba"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors duration-200"
            >
              <Github className="h-4 w-4" />
              <span>Source</span>
            </a>
            <Link
              href="/login"
              className="text-sm text-slate-500 hover:text-emerald-700 font-medium transition-colors"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors shadow-sm"
            >
              Inscription
            </Link>
          </div>
        </nav>

        {/* Hero content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 md:py-20">
          <p className="text-xs tracking-[0.25em] uppercase text-emerald-600/70 font-medium mb-6 animate-fade-in-up-1">
            Micro-fermes · Écolieux · Jardins pédagogiques · Maraîchage
          </p>

          <h1 className="font-heading text-center text-5xl sm:text-6xl lg:text-7xl font-extralight tracking-tight text-slate-900 leading-[1.05] mb-8 animate-fade-in-up-2">
            <span className="sr-only">
              Gleba, le logiciel libre de gestion pour micro-ferme, maraîchage, verger et élevage.
            </span>
            <span aria-hidden="true">
              Votre exploitation.
              <br />
              <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-600 bg-clip-text text-transparent">
                Un seul outil.
              </span>
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 font-light max-w-md mx-auto leading-relaxed text-center mb-10 animate-fade-in-up-2">
            Maraîchage, verger, élevage, comptabilité, traçabilité et IA —
            <br className="hidden sm:block" />
            regroupés dans un seul logiciel libre.
          </p>

          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50/80 border border-emerald-100 text-emerald-700 text-xs font-medium mb-10 animate-fade-in-up-2">
            <TreeDeciduous className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              Nouveau — 25 espèces d&apos;arbres, traçabilité phytosanitaire, météo et calendrier lunaire
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 animate-fade-in-up-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors shadow-lg shadow-emerald-600/20"
            >
              Créer mon compte
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login?demo=1"
              className="inline-flex items-center px-7 py-3.5 rounded-full border border-emerald-300 bg-white/80 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 text-sm font-medium transition-colors"
            >
              Essayer la démo
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center px-7 py-3.5 rounded-full border border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700 text-sm font-medium transition-colors"
            >
              Se connecter
            </Link>
          </div>

          <p className="text-xs text-slate-400 mt-5">
            Gratuit · Open source AGPL-3.0 · Hébergé en France
          </p>

          <a
            href="#features"
            className="mt-14 flex flex-col items-center gap-2 text-slate-300 hover:text-emerald-500 transition-colors duration-300 animate-fade-in-up-5"
          >
            <span className="text-[11px] tracking-[0.2em] uppercase font-medium">Découvrir</span>
            <ChevronDown className="h-4 w-4 animate-gentle-float" />
          </a>
        </div>
      </section>

      <div className="section-divider" />

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2 — TROIS PILIERS
          ═══════════════════════════════════════════════════════════════ */}
      <section id="features" className="py-28 px-4 bg-white/60 backdrop-blur-sm scroll-mt-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-xs tracking-[0.25em] uppercase text-emerald-600/60 font-medium mb-4">
              Trois dimensions
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extralight text-slate-900 tracking-tight">
              Conçu pour ceux qui
              <br />
              <span className="font-normal">font vivre la terre</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-16 md:gap-12">
            {PILLARS.map((pillar) => (
              <div key={pillar.title} className="text-center group">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 mb-6 group-hover:scale-110 transition-transform duration-500">
                  <pillar.icon className="h-7 w-7 text-emerald-600" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-medium text-slate-900 mb-3 tracking-tight">
                  {pillar.title}
                </h3>
                <p className="text-slate-500 leading-relaxed text-[15px]">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3 — BENTO GRID MODULES
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-28 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-xs tracking-[0.25em] uppercase text-emerald-600/60 font-medium mb-4">
              Neuf modules intégrés
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extralight text-slate-900 tracking-tight">
              Tout au <span className="font-normal">même endroit</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODULES.map((mod) => {
              const style = ACCENT_STYLES[mod.accent] || ACCENT_STYLES.emerald;
              const card = (
                <>
                  <div
                    className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${style.icon} mb-5`}
                  >
                    <mod.icon className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2 tracking-tight flex items-center gap-2">
                    {mod.title}
                    {mod.href && (
                      <ArrowRight className="h-4 w-4 text-emerald-600/60" />
                    )}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{mod.description}</p>
                </>
              );
              const className = `feature-card bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 p-7 ${style.hover} ${
                mod.wide ? "sm:col-span-2 lg:col-span-2" : ""
              }`;
              return mod.href ? (
                <Link key={mod.title} href={mod.href} className={`block ${className}`}>
                  {card}
                </Link>
              ) : (
                <div key={mod.title} className={className}>
                  {card}
                </div>
              );
            })}
          </div>

          {/* Badge MCP */}
          <div className="mt-10 flex justify-center">
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/70 backdrop-blur-sm border border-slate-100 text-sm text-slate-500 hover:border-teal-200 hover:text-teal-700 transition-all duration-300 cursor-default">
              <Plug className="h-4 w-4 text-teal-500" strokeWidth={1.5} />
              <span>
                Pilotable via <strong className="font-medium text-slate-700">MCP</strong> depuis
                Claude, ChatGPT ou toute IA
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 4 — STATS BANNER
          ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-gradient-to-br from-emerald-900 via-emerald-900 to-teal-900 py-20 px-4 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-0 relative z-10">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className={`text-center ${
                i < STATS.length - 1 ? "md:border-r md:border-emerald-700/40" : ""
              }`}
            >
              <div className="stat-number text-4xl sm:text-5xl font-extralight text-white mb-2">
                {stat.value}
              </div>
              <div className="text-sm text-emerald-300/70 font-light">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 4.5 — REFERENCES (Framalibre, etc.)
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-4 bg-white/40">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs tracking-[0.25em] uppercase text-slate-400 font-medium mb-8">
            Référencé sur
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://framalibre.org/notices/gleba-fr.html"
              target="_blank"
              rel="noopener"
              title="Voir la fiche Gleba sur Framalibre — annuaire du logiciel libre"
              className="group inline-flex items-center gap-3 px-5 py-3 rounded-full bg-white border border-slate-200 hover:border-orange-300 hover:bg-orange-50/30 transition-all duration-200 shadow-sm"
            >
              <span
                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white font-bold text-sm"
                aria-hidden="true"
              >
                F
              </span>
              <span className="text-left">
                <span className="block text-xs text-slate-400 uppercase tracking-wider">
                  Annuaire du logiciel libre
                </span>
                <span className="block text-sm font-medium text-slate-900 group-hover:text-orange-700 transition-colors">
                  Framalibre
                </span>
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 5 — POURQUOI GLEBA (mission)
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-28 px-4 bg-white/60">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 mb-8">
            <Leaf className="h-6 w-6 text-emerald-600" strokeWidth={1.5} />
          </div>

          <h2 className="font-heading text-3xl sm:text-4xl font-extralight text-slate-900 tracking-tight mb-10">
            Pourquoi <span className="font-normal">Gleba</span> ?
          </h2>

          <p className="text-lg sm:text-xl text-slate-400 leading-relaxed mb-6 font-light">
            Gérer une micro-ferme, un écolieu ou un jardin pédagogique demande de jongler entre
            semis, arbres fruitiers, animaux, récoltes, traitements, traçabilité et comptabilité.
            Les tableurs débordent. Les carnets se perdent. Les outils existants ne couvrent
            qu&apos;une partie du travail.
          </p>

          <p className="text-lg sm:text-xl text-slate-700 leading-relaxed font-light">
            Gleba regroupe tout au même endroit — en{" "}
            <strong className="font-semibold">open source</strong>, hébergé{" "}
            <strong className="font-semibold">sur nos serveurs ou les vôtres</strong> — pour que
            vous puissiez vous concentrer sur ce qui compte.
          </p>

          <div className="mt-14 flex flex-wrap justify-center gap-3">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50/80 border border-emerald-100 text-emerald-700 text-sm font-medium">
              <Shield className="h-3.5 w-3.5" strokeWidth={2} />
              Vos données restent chez vous
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-sm font-medium">
              <Database className="h-3.5 w-3.5" strokeWidth={2} />
              AGPL-3.0
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-50/80 border border-teal-100 text-teal-700 text-sm font-medium">
              <Cpu className="h-3.5 w-3.5" strokeWidth={2} />
              IA locale (Ollama)
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50/80 border border-emerald-100 text-emerald-700 text-sm font-medium">
              <Sprout className="h-3.5 w-3.5" strokeWidth={2} />
              Pensé pour le bio
            </span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 6 — FAQ (SEO)
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="faq"
        className="py-28 px-4 bg-gradient-to-b from-white/60 to-emerald-50/30 scroll-mt-8"
      >
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs tracking-[0.25em] uppercase text-emerald-600/60 font-medium mb-4">
              Questions fréquentes
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extralight text-slate-900 tracking-tight">
              Tout ce qu&apos;il faut savoir
              <br />
              <span className="font-normal">sur Gleba</span>
            </h2>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq) => (
              <details
                key={faq.question}
                className="group bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 overflow-hidden hover:border-emerald-200 transition-colors"
              >
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none p-6 sm:p-7">
                  <h3 className="text-base sm:text-lg font-medium text-slate-900 tracking-tight">
                    {faq.question}
                  </h3>
                  <ChevronDown className="h-5 w-5 flex-shrink-0 text-emerald-600/60 transition-transform duration-300 group-open:rotate-180" />
                </summary>
                <div className="px-6 sm:px-7 pb-6 sm:pb-7 -mt-2">
                  <p className="text-slate-500 leading-relaxed text-[15px]">{faq.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════════ */}
      <footer className="py-10 px-4 border-t border-slate-100/80">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-3">
            <Image
              src="/gleba-logo.png"
              alt="Gleba"
              width={100}
              height={34}
              className="h-8 w-auto opacity-40"
            />
            <span className="text-slate-300">v1.0.0</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <Link href="/logiciel-maraichage" className="hover:text-emerald-600 transition-colors">
              Maraîchage
            </Link>
            <Link href="/logiciel-verger" className="hover:text-emerald-600 transition-colors">
              Verger
            </Link>
            <Link href="/logiciel-elevage" className="hover:text-emerald-600 transition-colors">
              Élevage
            </Link>
            <Link href="/calendrier-semis" className="hover:text-emerald-600 transition-colors">
              Calendrier semis
            </Link>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="mailto:contact@gleba.fr"
              className="hover:text-slate-600 transition-colors duration-200"
            >
              contact@gleba.fr
            </a>
            <Link href="/roadmap" className="hover:text-slate-600 transition-colors duration-200">
              Roadmap
            </Link>
            <a
              href="https://github.com/GMS64260/gleba"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-slate-600 transition-colors duration-200"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
