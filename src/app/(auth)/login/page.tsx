/**
 * Page de connexion Gleba — Landing page scrollable premium
 * Aurora bg, glassmorphism, bento grid, animations séquentielles
 */

import type { Metadata } from "next"
import { Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
import { LoginForm } from "@/components/auth/LoginForm"
import {
  Loader2,
  Calendar,
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
} from "lucide-react"

export const metadata: Metadata = {
  title: "Gleba — Logiciel libre de gestion agricole",
  description:
    "Maraîchage, verger, élevage, comptabilité, traçabilité et IA — un seul outil open source pour gérer votre micro-ferme, écolieu ou jardin pédagogique.",
}

function LoginFormFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
    </div>
  )
}

/* ─── Données ─── */

const PILLARS = [
  {
    icon: Calendar,
    title: "Planifiez",
    description: "Calendrier de semis, rotations, associations, calendrier lunaire. Des itinéraires techniques prêts à l'emploi pour ne rien oublier.",
  },
  {
    icon: Wrench,
    title: "Gérez",
    description: "Cultures, verger, élevage, soins, traitements, irrigations et interventions — tout votre quotidien au même endroit.",
  },
  {
    icon: BarChart3,
    title: "Analysez",
    description: "Rendements par planche, coûts de production, factures, traçabilité. Des décisions basées sur vos données.",
  },
]

const MODULES = [
  {
    icon: Sprout,
    title: "Maraîchage & planification",
    description: "Calendrier de semis, rotations intelligentes, associations de cultures et itinéraires techniques prêts à l'emploi.",
    accent: "emerald" as const,
    wide: true,
  },
  {
    icon: TreeDeciduous,
    title: "Verger — 25 espèces",
    description: "Pommiers, cerisiers, oliviers… 40 variétés référencées. Tailles, greffes, traitements, pollinisation et suivi sanitaire.",
    accent: "emerald" as const,
    wide: false,
  },
  {
    icon: Egg,
    title: "Élevage",
    description: "Animaux, généalogie, ponte, soins vétérinaires, alimentation, naissances et analyse des coûts.",
    accent: "amber" as const,
    wide: false,
  },
  {
    icon: Receipt,
    title: "Comptabilité",
    description: "Factures, clients, fournisseurs, TVA, coûts de production. Sachez si vous êtes rentable.",
    accent: "slate" as const,
    wide: false,
  },
  {
    icon: Map,
    title: "Plan du jardin 2D",
    description: "Dessinez vos planches aux vraies dimensions. Cadastre, satellite et données de sol intégrés.",
    accent: "teal" as const,
    wide: false,
  },
  {
    icon: ClipboardCheck,
    title: "Traçabilité",
    description: "Interventions phytosanitaires, numéros AMM, doses, DAR — conformité réglementaire assurée.",
    accent: "slate" as const,
    wide: false,
  },
  {
    icon: CloudSun,
    title: "Météo & irrigation",
    description: "Prévisions météo, pluviométrie par parcelle, irrigation automatisée selon le sol et les cultures.",
    accent: "teal" as const,
    wide: false,
  },
  {
    icon: Moon,
    title: "Calendrier lunaire",
    description: "Phases de la lune et recommandations biodynamiques pour les semis, plantations et récoltes.",
    accent: "emerald" as const,
    wide: false,
  },
  {
    icon: MessageCircle,
    title: "Assistant IA",
    description: "\"Quoi semer cette semaine ?\" — posez vos questions en langage naturel, obtenez des réponses basées sur vos vraies données.",
    accent: "teal" as const,
    wide: true,
  },
]

const ACCENT_STYLES: Record<string, { icon: string; hover: string }> = {
  emerald: { icon: "text-emerald-600 bg-emerald-50", hover: "hover:border-emerald-200" },
  teal:    { icon: "text-teal-600 bg-teal-50",       hover: "hover:border-teal-200" },
  amber:   { icon: "text-amber-600 bg-amber-50",     hover: "hover:border-amber-200" },
  slate:   { icon: "text-slate-600 bg-slate-100",     hover: "hover:border-slate-300" },
}

const STATS = [
  { value: "60+", label: "Espèces végétales & fruitières" },
  { value: "60+", label: "Variétés référencées" },
  { value: "9", label: "Modules intégrés" },
  { value: "100%", label: "Open source" },
]

export default function LoginPage() {
  return (
    <div className="w-full">

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1 — HERO + LOGIN (viewport height)
          ═══════════════════════════════════════════════════════════════ */}
      <section className="min-h-screen flex flex-col relative">

        {/* Nav minimaliste */}
        <nav className="w-full px-6 md:px-8 py-5 flex items-center justify-between max-w-6xl mx-auto animate-fade-in-up">
          <Image
            src="/gleba-logo.png"
            alt="Gleba"
            width={400}
            height={136}
            className="h-12 sm:h-16 w-auto"
            priority
          />
          <div className="flex items-center gap-5">
            <Link
              href="/roadmap"
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-emerald-600 transition-colors duration-200"
            >
              <Milestone className="h-4 w-4" />
              <span className="hidden sm:inline">Roadmap</span>
            </Link>
            <a
              href="https://github.com/GMS64260/gleba"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors duration-200"
            >
              <Github className="h-4 w-4" />
              <span className="hidden sm:inline">Source</span>
            </a>
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 border border-slate-200/60 rounded-full px-3 py-1">
              <Shield className="h-3 w-3" />
              Self-hosted
            </span>
          </div>
        </nav>

        {/* Hero content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-16 md:pb-20">

          {/* Surtitre */}
          <p className="text-xs tracking-[0.25em] uppercase text-emerald-600/70 font-medium mb-6 animate-fade-in-up-1">
            Micro-fermes · Écolieux · Jardins pédagogiques · Maraîchage
          </p>

          {/* Titre hero */}
          <h1 className="font-heading text-center text-5xl sm:text-6xl lg:text-7xl font-extralight tracking-tight text-slate-900 leading-[1.05] mb-8 animate-fade-in-up-2">
            Votre exploitation.
            <br />
            <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-600 bg-clip-text text-transparent">
              Un seul outil.
            </span>
          </h1>

          {/* Sous-titre */}
          <p className="text-base sm:text-lg text-slate-400 font-light max-w-md mx-auto leading-relaxed text-center mb-12 animate-fade-in-up-2">
            Maraîchage, verger, élevage, comptabilité, traçabilité et IA —
            <br className="hidden sm:block" />
            regroupés dans un seul logiciel libre.
          </p>

          {/* Badge nouveauté */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50/80 border border-emerald-100 text-emerald-700 text-xs font-medium mb-8 animate-fade-in-up-2">
            <TreeDeciduous className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Nouveau — 25 espèces d&apos;arbres, traçabilité phytosanitaire, météo et calendrier lunaire</span>
          </div>

          {/* Login Card — glassmorphism avec glow */}
          <div className="w-full max-w-[420px] animate-fade-in-up-3">
            <div className="card-glow rounded-2xl">
              <div className="bg-white/75 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-slate-900/[0.06] p-8 sm:p-9">
                <div className="text-center mb-7">
                  <h2 className="font-heading text-xl font-medium text-slate-900 tracking-tight">
                    Connexion
                  </h2>
                  <p className="text-sm text-slate-400 mt-1.5">
                    Accédez à votre espace de gestion
                  </p>
                </div>

                <Suspense fallback={<LoginFormFallback />}>
                  <LoginForm />
                </Suspense>
              </div>
            </div>

            <p className="text-center text-xs text-slate-400 mt-5">
              Pas de compte ?{" "}
              <Link href="/register" className="text-emerald-600 hover:text-emerald-700 font-medium transition-colors">
                Créer un compte
              </Link>
              {" "}ou essayez la démo.
            </p>
          </div>

          {/* Scroll indicator */}
          <a
            href="#features"
            className="mt-14 flex flex-col items-center gap-2 text-slate-300 hover:text-emerald-500 transition-colors duration-300 animate-fade-in-up-5"
          >
            <span className="text-[11px] tracking-[0.2em] uppercase font-medium">Découvrir</span>
            <ChevronDown className="h-4 w-4 animate-gentle-float" />
          </a>
        </div>
      </section>

      {/* Séparateur gradient */}
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

          {/* Bento grid — les modules "wide" prennent 2 colonnes */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODULES.map((mod) => {
              const style = ACCENT_STYLES[mod.accent] || ACCENT_STYLES.emerald
              return (
                <div
                  key={mod.title}
                  className={`feature-card bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 p-7 ${style.hover} ${
                    mod.wide ? "sm:col-span-2 lg:col-span-2" : ""
                  }`}
                >
                  <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${style.icon} mb-5`}>
                    <mod.icon className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2 tracking-tight">
                    {mod.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {mod.description}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Badge MCP */}
          <div className="mt-10 flex justify-center">
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/70 backdrop-blur-sm border border-slate-100 text-sm text-slate-500 hover:border-teal-200 hover:text-teal-700 transition-all duration-300 cursor-default">
              <Plug className="h-4 w-4 text-teal-500" strokeWidth={1.5} />
              <span>Pilotable via <strong className="font-medium text-slate-700">MCP</strong> depuis Claude, ChatGPT ou toute IA</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 4 — STATS BANNER
          ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-gradient-to-br from-emerald-900 via-emerald-900 to-teal-900 py-20 px-4 relative overflow-hidden">
        {/* Dot texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px" }}
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
              <div className="text-sm text-emerald-300/70 font-light">
                {stat.label}
              </div>
            </div>
          ))}
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
            semis, arbres fruitiers, animaux, recoltes, traitements, traçabilité et comptabilité.
            Les tableurs débordent. Les carnets se perdent. Les outils existants ne couvrent qu&apos;une partie du travail.
          </p>

          <p className="text-lg sm:text-xl text-slate-700 leading-relaxed font-light">
            Gleba regroupe tout au même endroit —
            en <strong className="font-semibold">open source</strong>,
            hébergé <strong className="font-semibold">sur nos serveurs ou les vôtres</strong> — pour que vous puissiez
            vous concentrer sur ce qui compte.
          </p>

          {/* Badges valeurs */}
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
            <span>AGPL-3.0</span>
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
  )
}
