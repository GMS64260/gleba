import type { Metadata } from "next";
import Link from "next/link";
import {
  Bot,
  MessageCircle,
  Sparkles,
  Wrench,
  Receipt,
  Egg,
  TreeDeciduous,
  Sprout,
  Plug,
  Shield,
  Database,
  Cpu,
  Zap,
} from "lucide-react";
import { ScreenshotPlaceholder } from "@/components/seo/ScreenshotPlaceholder";
import { FAQSection, type FAQItem } from "@/components/seo/FAQSection";
import { CTASection } from "@/components/seo/CTASection";
import { Breadcrumb } from "@/components/seo/Breadcrumb";
import { InternalLinks } from "@/components/seo/InternalLinks";

export const metadata: Metadata = {
  title:
    "Assistant IA agricole — Pilotez votre ferme en langage naturel",
  description:
    "Gleba intègre un assistant IA qui connaît vos vraies données : cultures, animaux, comptabilité. Posez vos questions en français, enregistrez des ventes, analysez vos marges. Pilotable depuis Claude, ChatGPT ou n8n via MCP. Open source.",
  alternates: { canonical: "https://gleba.fr/assistant-ia-agricole" },
  openGraph: {
    title: "Assistant IA agricole open source — Gleba",
    description:
      "Une IA qui connaît votre ferme. Maraîchage, verger, élevage, comptabilité. Pilotable via MCP depuis Claude ou ChatGPT.",
    url: "https://gleba.fr/assistant-ia-agricole",
    type: "article",
  },
};

const FAQS: FAQItem[] = [
  {
    question: "Qu'est-ce que l'assistant IA de Gleba ?",
    answer:
      "C'est un agent conversationnel intégré directement à votre exploitation. Contrairement à ChatGPT généraliste, l'assistant Gleba a accès à vos vraies données (cultures, planches, animaux, factures) via des outils sécurisés. Vous pouvez lui poser des questions en français (« Quoi semer cette semaine ? », « Quelle est ma marge sur les tomates ? ») ou lui demander d'enregistrer des actions (« Note une vente de 12 kg de courgettes à 3,50 € »).",
  },
  {
    question: "Quel modèle d'IA Gleba utilise-t-il ?",
    answer:
      "Gleba utilise GLM 4.7 via Ollama Cloud par défaut, un modèle performant en français avec function calling natif. Vous pouvez aussi connecter votre propre instance Ollama auto-hébergée pour faire tourner Llama 3, Mistral ou tout autre modèle local — vos données ne quittent alors jamais votre infrastructure.",
  },
  {
    question: "Peut-on piloter Gleba depuis Claude ou ChatGPT ?",
    answer:
      "Oui, c'est même un différenciateur unique de Gleba. Le serveur MCP intégré (Model Context Protocol) expose vos données et actions Gleba comme des outils accessibles depuis Claude Desktop, ChatGPT (custom GPT), n8n, Zapier ou n'importe quel client MCP. L'authentification se fait via un token API personnel (glb_xxx). Vous gardez ainsi votre assistant préféré tout en travaillant sur vos vraies données agricoles.",
  },
  {
    question: "Mes données restent-elles confidentielles ?",
    answer:
      "Oui. Avec Ollama auto-hébergé, vos données ne quittent jamais votre serveur. Avec Ollama Cloud (option par défaut), les requêtes transitent par l'API d'Ollama mais ne sont pas conservées ni utilisées pour entraîner des modèles. Aucune donnée n'est partagée avec OpenAI ou Anthropic par défaut. Le code est public et auditable sur GitHub.",
  },
  {
    question: "Quelles actions concrètes l'IA peut-elle effectuer ?",
    answer:
      "L'IA peut consulter et modifier vos données dans tous les modules :\n\n• Maraîchage : lister cultures, planches, plannings de semis\n• Verger : suivre arbres, variétés, traitements\n• Élevage : enregistrer ponte, naissances, saillies, registre sanitaire\n• Comptabilité : créer ventes, dépenses, clients, consulter factures et stats\n\nPour les actions sensibles (création/suppression), l'IA demande systématiquement votre confirmation avant d'agir.",
  },
  {
    question: "L'IA fonctionne-t-elle sans connexion internet ?",
    answer:
      "Oui, à condition de l'auto-héberger avec Ollama local. Vous installez Ollama sur votre machine ou un serveur de la ferme, vous téléchargez un modèle (Llama, Mistral, Phi), et Gleba l'utilise sans aucune requête sortante. Idéal pour les zones rurales mal couvertes ou les fermes attachées à leur souveraineté numérique.",
  },
  {
    question: "Combien coûte l'assistant IA ?",
    answer:
      "Avec Gleba hébergé sur gleba.fr : compris dans l'offre d'hébergement, avec un quota de 30 messages par 5 minutes pour éviter les abus. En auto-hébergement avec Ollama local : 100% gratuit, illimité, sans facture API. En auto-hébergement avec Ollama Cloud : tarifs Ollama (très bas, quelques centimes par centaine de requêtes).",
  },
  {
    question: "Y a-t-il un risque que l'IA détruise mes données par erreur ?",
    answer:
      "Non. Pour toute action destructive ou modificatrice (création de vente, suppression d'arbre, etc.), l'IA est entraînée à demander confirmation avant d'exécuter. Toutes les actions sont également loguées et réversibles : vous gardez l'historique complet de ce que l'assistant a fait sur vos données.",
  },
];

export default function Page() {
  return (
    <>
      <Breadcrumb items={[{ label: "Assistant IA agricole", href: "/assistant-ia-agricole" }]} />

      {/* HERO */}
      <section className="px-4 pt-6 pb-20 sm:pt-12 sm:pb-24">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs tracking-[0.25em] uppercase text-emerald-600/70 font-medium mb-6">
            IA agricole · MCP · Open source · Ollama / Claude / ChatGPT
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extralight tracking-tight text-slate-900 leading-[1.1]">
            L&apos;intelligence artificielle qui{" "}
            <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-600 bg-clip-text text-transparent font-normal">
              connaît votre ferme
            </span>
          </h1>
          <p className="mt-8 text-lg sm:text-xl text-slate-500 font-light max-w-2xl mx-auto leading-relaxed">
            Posez vos questions en français, déléguez la saisie, analysez vos marges en une phrase.{" "}
            <strong className="text-slate-700 font-medium">
              L&apos;assistant IA de Gleba a accès à vos vraies données
            </strong>{" "}
            — cultures, animaux, factures — et peut aussi être piloté depuis Claude ou ChatGPT via
            MCP. Open source, hébergeable en local.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center px-7 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors shadow-lg shadow-emerald-600/20"
            >
              Essayer Gleba gratuitement
            </Link>
            <a
              href="#exemples"
              className="inline-flex items-center px-7 py-3.5 rounded-full border border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700 text-sm font-medium transition-colors"
            >
              Voir des exemples
            </a>
          </div>

          <ScreenshotPlaceholder
            alt="Conversation avec l'assistant IA de Gleba à propos d'un planning de semis"
            caption="Conversation avec l'assistant IA — vraie donnée, vraie ferme"
            aspectRatio="16/9"
            priority
            className="mt-16"
          />
        </div>
      </section>

      {/* POURQUOI UNE IA SPECIALISEE */}
      <section className="py-20 px-4 bg-white/60">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading text-3xl sm:text-4xl font-extralight text-slate-900 tracking-tight text-center mb-12">
            Pourquoi une IA <span className="font-normal">connectée à votre ferme</span> ?
          </h2>

          <div className="space-y-5 text-[17px] leading-relaxed text-slate-600">
            <p>
              ChatGPT, Claude ou Gemini sont des outils impressionnants — mais ils ne connaissent
              rien de votre ferme. Quand vous demandez « Quelle est ma marge sur les tomates ?
              », ils inventent une réponse plausible mais fausse. Pour avoir une vraie aide à la
              décision, l&apos;IA doit avoir accès à <strong className="text-slate-900 font-medium">vos
              cultures, vos planches, vos animaux, vos ventes et vos coûts réels</strong>.
            </p>
            <p>
              C&apos;est exactement ce que fait l&apos;assistant IA intégré à Gleba. Il dispose
              d&apos;outils sécurisés (function calling) pour lire et écrire dans votre base de
              données. Vous posez la question — il consulte vos vraies données, calcule, répond,
              et peut enregistrer des actions si vous le confirmez.
            </p>
            <p>
              <strong className="text-slate-900 font-medium">
                Gleba est aussi le seul logiciel agricole compatible MCP.
              </strong>{" "}
              Ce protocole ouvert (Model Context Protocol, créé par Anthropic) permet de piloter
              Gleba depuis Claude Desktop, ChatGPT (custom GPT), n8n, Zapier ou n&apos;importe
              quel client MCP. Vous gardez votre assistant préféré, tout en travaillant sur vos
              données agricoles réelles.
            </p>
          </div>
        </div>
      </section>

      {/* EXEMPLES CONCRETS */}
      <section id="exemples" className="py-24 px-4 scroll-mt-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs tracking-[0.25em] uppercase text-emerald-600/60 font-medium mb-4">
              Cas d&apos;usage
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extralight text-slate-900 tracking-tight">
              Ce que vous pouvez{" "}
              <span className="font-normal">demander à l&apos;IA</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                icon: Sprout,
                category: "Maraîchage",
                question: "Quoi semer cette semaine sous tunnel ?",
                answer:
                  "L'IA consulte votre zone climatique, vos planches sous abri et votre planning. Elle propose 4-5 cultures adaptées avec leurs dates limites.",
              },
              {
                icon: TreeDeciduous,
                category: "Verger",
                question: "Quels pommiers ont besoin d'une taille cet hiver ?",
                answer:
                  "L'IA liste vos pommiers avec la date de dernière taille, recommande ceux à tailler en priorité selon l'âge et la variété.",
              },
              {
                icon: Egg,
                category: "Élevage",
                question: "Enregistre 18 œufs ramassés ce matin du poulailler nord.",
                answer:
                  "L'IA crée l'entrée de ponte du jour, l'associe au bon lot d'animaux, et met à jour automatiquement vos statistiques de production.",
              },
              {
                icon: Receipt,
                category: "Comptabilité",
                question: "Quelle est ma marge nette sur les courgettes en 2026 ?",
                answer:
                  "L'IA récupère vos ventes de courgettes, vos coûts de production (graines, plants, main d'œuvre), calcule la marge et la compare aux autres cultures.",
              },
              {
                icon: Wrench,
                category: "Interventions",
                question: "Note un traitement à la bouillie bordelaise sur les tomates plein champ.",
                answer:
                  "L'IA crée l'entrée de traitement avec produit, dose, AMM, DAR. Vous confirmez, c'est tracé pour le contrôle bio.",
              },
              {
                icon: Sparkles,
                category: "Analyse",
                question: "Quelles sont mes 3 cultures les moins rentables ?",
                answer:
                  "L'IA compare vos rendements, prix de vente et coûts pour identifier les cultures à reconsidérer ou abandonner.",
              },
            ].map((ex) => (
              <div
                key={ex.question}
                className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 p-7 hover:border-emerald-200 transition-colors"
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600">
                    <ex.icon className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <span className="text-xs uppercase tracking-wider text-emerald-700 font-medium">
                    {ex.category}
                  </span>
                </div>
                <p className="text-base font-medium text-slate-900 mb-3 italic">
                  «&nbsp;{ex.question}&nbsp;»
                </p>
                <p className="text-sm text-slate-500 leading-relaxed">{ex.answer}</p>
              </div>
            ))}
          </div>

          <ScreenshotPlaceholder
            alt="Vue d'une analyse de marges générée par l'assistant IA de Gleba"
            caption="L'IA répond avec vos vraies données — pas des moyennes inventées"
            aspectRatio="16/10"
            className="mt-16"
          />
        </div>
      </section>

      {/* MCP */}
      <section className="py-24 px-4 bg-gradient-to-b from-white to-emerald-50/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-50 border border-teal-100 text-teal-700 text-xs font-medium mb-6">
              <Plug className="h-3.5 w-3.5" />
              Unique sur le marché
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extralight text-slate-900 tracking-tight">
              Pilotez Gleba depuis{" "}
              <span className="font-normal">Claude, ChatGPT ou n8n</span>
            </h2>
            <p className="mt-6 text-base sm:text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
              Grâce au protocole MCP (Model Context Protocol), Gleba expose ses outils à
              n&apos;importe quel client compatible. Votre assistant préféré, vos données réelles.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                title: "Claude Desktop",
                description:
                  "Ajoutez Gleba comme serveur MCP dans Claude. Demandez « Combien d'œufs cette semaine ? » directement dans Claude.",
              },
              {
                title: "ChatGPT (custom GPT)",
                description:
                  "Connectez Gleba à un GPT personnalisé via le bridge MCP. Idéal pour partager un assistant ferme avec votre équipe.",
              },
              {
                title: "n8n / Zapier",
                description:
                  "Automatisez des workflows : « Chaque lundi, demande à l'IA un rapport de la semaine et envoie-le par email ».",
              },
            ].map((tool) => (
              <div
                key={tool.title}
                className="bg-white rounded-2xl border border-slate-100 p-6"
              >
                <h3 className="text-base font-medium text-slate-900 mb-3 tracking-tight">
                  {tool.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">{tool.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 bg-slate-900 rounded-2xl p-6 sm:p-8 overflow-x-auto">
            <p className="text-xs text-slate-400 mb-3 uppercase tracking-wider">
              Exemple — Authentification MCP
            </p>
            <pre className="text-sm text-emerald-300 font-mono leading-relaxed">
              {`POST https://gleba.fr/api/mcp
Authorization: Bearer glb_votre_token_personnel
Content-Type: application/json

{
  "tool": "get_cultures",
  "args": { "annee": 2026 },
  "section": "potager"
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* CAPACITES PAR MODULE */}
      <section className="py-24 px-4 bg-white/60">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extralight text-slate-900 tracking-tight">
              Une IA pour <span className="font-normal">chaque module</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: Sprout,
                module: "Maraîchage",
                actions: [
                  "Lister cultures et plannings",
                  "Proposer rotations et associations",
                  "Calendrier de semis personnalisé",
                  "Suivi des récoltes",
                ],
              },
              {
                icon: TreeDeciduous,
                module: "Verger",
                actions: [
                  "Inventaire des arbres",
                  "Tailles et greffes",
                  "Traitements phytosanitaires",
                  "Récoltes par arbre",
                ],
              },
              {
                icon: Egg,
                module: "Élevage",
                actions: [
                  "Ponte, naissances, saillies",
                  "Registre sanitaire (DGAL)",
                  "Alimentation et coûts",
                  "Généalogie",
                ],
              },
              {
                icon: Receipt,
                module: "Comptabilité",
                actions: [
                  "Ventes et dépenses",
                  "Clients et factures",
                  "Calcul de marges",
                  "Statistiques CA / TVA",
                ],
              },
            ].map((mod) => (
              <div
                key={mod.module}
                className="bg-white rounded-2xl border border-slate-100 p-6"
              >
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 mb-4">
                  <mod.icon className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <h3 className="text-base font-medium text-slate-900 mb-4 tracking-tight">
                  {mod.module}
                </h3>
                <ul className="space-y-2">
                  {mod.actions.map((a) => (
                    <li
                      key={a}
                      className="text-xs text-slate-500 leading-relaxed flex items-start gap-2"
                    >
                      <span className="text-emerald-500 mt-0.5">•</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONFIDENTIALITE */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extralight text-slate-900 tracking-tight">
              Vos données <span className="font-normal">restent les vôtres</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                icon: Cpu,
                title: "IA locale via Ollama",
                description:
                  "Installez Ollama sur votre serveur. Téléchargez Llama 3, Mistral ou Phi. Vos données ne sortent jamais.",
              },
              {
                icon: Shield,
                title: "Conforme RGPD",
                description:
                  "Hébergement France, chiffrement, export complet de vos données à tout moment. Vous restez propriétaire.",
              },
              {
                icon: Database,
                title: "Open source AGPL-3.0",
                description:
                  "Tout le code est public sur GitHub. Auditez l'IA, modifiez les prompts, contrôlez ce qui est envoyé.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-2xl border border-slate-100 p-7"
              >
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 mb-5">
                  <item.icon className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <h3 className="text-base font-medium text-slate-900 mb-3 tracking-tight">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARATIF */}
      <section className="py-24 px-4 bg-white/60">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-heading text-3xl sm:text-4xl font-extralight text-slate-900 tracking-tight text-center mb-12">
            Assistant Gleba vs <span className="font-normal">ChatGPT généraliste</span>
          </h2>

          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left p-4 font-medium text-slate-700">Critère</th>
                  <th className="text-center p-4 font-medium text-emerald-700">Assistant Gleba</th>
                  <th className="text-center p-4 font-medium text-slate-500">
                    ChatGPT / Claude généraliste
                  </th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                {[
                  ["Accès à vos vraies données de ferme", "✓", "✗"],
                  ["Réponses précises (pas d'hallucination)", "✓", "Partiel"],
                  ["Création / modification de données", "✓", "✗"],
                  ["Confidentialité (auto-hébergement)", "✓", "✗"],
                  ["Adapté maraîchage / élevage bio FR", "✓", "Générique"],
                  ["Pilotable depuis Claude / ChatGPT (MCP)", "✓", "—"],
                  ["Open source AGPL-3.0", "✓", "✗"],
                  ["Coût", "Gratuit en local", "20 €/mois"],
                ].map(([critere, gleba, gpt]) => (
                  <tr key={critere} className="border-b border-slate-100 last:border-0">
                    <td className="p-4 font-medium text-slate-700">{critere}</td>
                    <td className="p-4 text-center text-emerald-700 font-medium">{gleba}</td>
                    <td className="p-4 text-center">{gpt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <InternalLinks currentPath="/assistant-ia-agricole" />

      <FAQSection
        title="Questions sur l'assistant IA agricole"
        subtitle="Tout ce qu'il faut savoir avant d'activer l'IA sur votre ferme."
        faqs={FAQS}
      />

      <CTASection
        title="Activez l'IA sur votre ferme dès aujourd'hui"
        subtitle="Inscription en 1 minute. Vraies données. Open source. Hébergé en France ou chez vous."
      />
    </>
  );
}
