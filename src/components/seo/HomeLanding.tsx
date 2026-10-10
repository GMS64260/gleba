/**
 * HomeLanding — Server Component
 *
 * Page d'accueil publique de gleba.fr pour les visiteurs non connectés, dans
 * la charte « carnet de ferme » (2026-10-10). SSR complet pour le SEO ; porte
 * le JSON-LD FAQPage de l'accueil. Le shell (navigation, pied de page) vient
 * de MarketingShell, partagé avec les pages métier.
 *
 * Règle de contenu : chaque affirmation se vérifie dans l'application ou dans
 * la ferme de démonstration. Pas de chiffre d'usage, pas de témoignage, pas de
 * lieu d'hébergement non prouvé, pas de promesse de gratuité définitive du
 * service hébergé (Gleba-produit § Modèle économique).
 */

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CaretDown,
  Check,
  CloudSun,
  Database,
  DownloadSimple,
  GithubLogo,
  MapTrifold,
  Plant,
  Megaphone,
  SquaresFour,
  Sparkle,
  ListChecks,
  ChartBar,
  Tree,
  Bird,
  Sprout,
} from "@/lib/phosphor-icons";

import { ApercuAujourdhui } from "./ApercuAujourdhui";
import { CLASSES_CTA, CLASSES_CTA_SECONDAIRE } from "./MarketingShell";

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge";

/* ─── Données ─── */

const AUJOURDHUI = [
  {
    icone: ListChecks,
    titre: "Les gestes du jour, classés par urgence",
    texte:
      "Semis, plantations, récoltes, arrosages, soins aux animaux, déclarations d'élevage et factures échues réunis dans une seule liste. Chaque ligne porte son verbe et un seul geste ; une action enregistrée s'annule pendant quelques secondes.",
  },
  {
    icone: CloudSun,
    titre: "La météo de votre parcelle",
    texte:
      "Fenêtre de travail du jour, prévisions sur sept jours, alertes de gel et de chaleur, conseil d'irrigation calculé selon le sol, les cultures en place et les arrosages déjà notés.",
  },
  {
    icone: MapTrifold,
    titre: "Le plan de la ferme, vivant",
    texte:
      "Planches et arbres dessinés à l'échelle sur la photo aérienne et le cadastre. Ce qui est à arroser ou à récolter se lit directement sur le plan.",
  },
  {
    icone: Sparkle,
    titre: "Un assistant dans la barre de commande",
    texte:
      "Chercher une culture, ouvrir un écran ou poser une question sur vos données sans quitter la page. L'assistant consulte votre exploitation ; ses réponses restent à vérifier.",
  },
  {
    icone: SquaresFour,
    titre: "Une page à votre main",
    texte:
      "Déplacez, masquez ou agrandissez chaque tuile. Treize tuiles au catalogue : récoltes de la semaine, trésorerie, verger à faire, stocks et péremptions, ventes, journal, carte…",
  },
  {
    icone: ChartBar,
    titre: "Les repères qui comptent",
    texte:
      "Cultures en place, surface cultivée, récoltes de l'année, trésorerie et tâches de la semaine, en chiffres lisibles plutôt qu'en graphiques décoratifs.",
  },
];

type Chapitre = {
  numero: string;
  saison: string;
  titre: string;
  texte: string;
  points: string[];
  liens: [string, string][];
  image: { src: string; alt: string; width: number; height: number; legende: string };
};

const CHAPITRES: Chapitre[] = [
  {
    numero: "01",
    saison: "Hiver",
    titre: "Planifier la saison",
    texte:
      "Le plan de culture se prépare planche par planche : calendrier de semis ajusté à votre zone climatique, rotations relues sur plusieurs années, associations, itinéraires techniques prêts à adapter.",
    points: [
      "Plus de 750 itinéraires techniques dans le référentiel ouvert",
      "Semis, plantations et récoltes datés par culture",
      "Précédents culturaux visibles planche par planche",
    ],
    liens: [
      ["/planification-maraichage", "Planification maraîchère"],
      ["/rotation-cultures-maraichage", "Rotation des cultures"],
      ["/calendrier-semis", "Calendrier de semis"],
    ],
    image: {
      src: "/screenshots/vitrine-maraichage-bureau.webp",
      alt: "Écran Cultures de Gleba : repères de la saison et conseils d'irrigation planche par planche",
      width: 1920,
      height: 878,
      legende: "Cultures en place, surface, récoltes et conseils d'irrigation par planche, sur la ferme de démonstration.",
    },
  },
  {
    numero: "02",
    saison: "Toute l'année",
    titre: "Dessiner la ferme",
    texte:
      "Parcelles, planches, arbres et objets se dessinent aux vraies dimensions sur la photo aérienne et le cadastre. La vue 3D et la barre de temps montrent la croissance des cultures et des arbres à la date choisie.",
    points: [
      "Plan 2D à l'échelle, fond aérien ou photo de votre terrain",
      "Parcelles cadastrales sur la carte de l'exploitation",
      "Vue 3D du jardin et du verger",
    ],
    liens: [
      ["/plan-de-ferme", "Plan de ferme sur le cadastre"],
      ["/logiciel-potager", "Plan de potager 2D et 3D"],
    ],
    image: {
      src: "/screenshots/vitrine-plan-bureau.webp",
      alt: "Plan 2D de la ferme dans Gleba : planches et arbres fruitiers dessinés sur photo aérienne",
      width: 1844,
      height: 1108,
      legende: "Planches et arbres de la ferme de démonstration, dessinés sur la photo aérienne.",
    },
  },
  {
    numero: "03",
    saison: "Printemps, été",
    titre: "Suivre le terrain",
    texte:
      "Interventions, irrigations, opérations au verger, soins et productions des animaux se notent au fil du travail réel, au bureau comme au champ sur téléphone.",
    points: [
      "Registre phytosanitaire : produit, AMM, dose, DAR et ZNT",
      "Verger suivi arbre par arbre : tailles, greffes, traitements, récoltes",
      "Ateliers d'élevage : lots, soins, naissances, productions",
    ],
    liens: [
      ["/carnet-de-culture", "Carnet de culture"],
      ["/registre-phytosanitaire", "Registre phytosanitaire"],
      ["/logiciel-verger", "Logiciel de verger"],
      ["/logiciel-elevage", "Ateliers d'élevage"],
    ],
    image: {
      src: "/screenshots/vitrine-meteo-bureau.webp",
      alt: "Écran Météo de Gleba : prévisions à la parcelle, fenêtres de travail et conseils d'irrigation",
      width: 1920,
      height: 878,
      legende: "Prévisions à la parcelle, fenêtres de travail et conseils d'irrigation.",
    },
  },
  {
    numero: "04",
    saison: "Automne",
    titre: "Vendre et compter",
    texte:
      "Récoltes, stocks, boutique de vente directe, factures et TVA restent reliés au même dossier. La fin de saison se relit sans reconstituer les chiffres à la main.",
    points: [
      "Boutique publique pour la vente directe",
      "Factures, clients, fournisseurs, TVA et coûts de production",
      "Export FEC sous conditions, sans bilan ni liasse fiscale",
    ],
    liens: [
      ["/logiciel-micro-ferme", "Gestion de la micro-ferme"],
      ["/logiciel-maraichage", "Logiciel de maraîchage"],
    ],
    image: {
      src: "/screenshots/vitrine-comptabilite-bureau.webp",
      alt: "Écran Comptabilité de Gleba : créances, commandes de la boutique, stocks bas et accès aux factures",
      width: 1920,
      height: 968,
      legende: "Créances, commandes de la boutique et stocks bas, à côté des factures et des exports.",
    },
  },
];

const METIERS = [
  {
    href: "/logiciel-maraichage",
    icone: Plant,
    titre: "Maraîchage diversifié",
    texte: "Plan de culture, planches, rotations, irrigation, récoltes et traçabilité.",
  },
  {
    href: "/logiciel-verger",
    icone: Tree,
    titre: "Verger et arboriculture",
    texte: "Chaque arbre avec sa variété, son porte-greffe, ses opérations et ses récoltes.",
  },
  {
    href: "/logiciel-elevage",
    icone: Bird,
    titre: "Ateliers d'élevage",
    texte: "Volailles, ovins, caprins, équins : lots, soins, naissances et productions.",
  },
  {
    href: "/logiciel-micro-ferme",
    icone: Sprout,
    titre: "Micro-ferme en installation",
    texte: "Préparer parcelles, ateliers et besoins avant la première saison.",
  },
];

const DIFFERENCES = [
  {
    titre: "La ferme entière, pas un seul atelier",
    texte:
      "Les logiciels de planification maraîchère s'arrêtent souvent au potager. Gleba relie maraîchage, verger arbre par arbre et ateliers d'élevage dans le même dossier.",
  },
  {
    titre: "Le terrain dessiné, pas une liste de planches",
    texte: "Le plan repose sur la photo aérienne et le cadastre ; l'état du jour s'y lit d'un coup d'œil.",
  },
  {
    titre: "Libre et auto-hébergeable",
    texte:
      "Code public sous licence AGPL-3.0, installation Docker Compose sur votre serveur, export complet de vos données : rien n'est enfermé.",
  },
  {
    titre: "Une journée, pas un tableau de bord",
    texte: "L'écran d'accueil répond à la question du matin : qu'est-ce qui ne peut pas attendre aujourd'hui ?",
  },
];

const FAQS: { question: string; answer: string }[] = [
  {
    question: "Qu'est-ce que Gleba ?",
    answer:
      "Gleba est un logiciel libre de gestion pour les micro-fermes professionnelles ou en installation. Il relie la planification maraîchère, le suivi du verger, les ateliers d'élevage, les stocks, la traçabilité et la gestion dans un même carnet d'exploitation. Chaque matin, l'écran Aujourd'hui rassemble ce qu'il y a à faire, classé par urgence.",
  },
  {
    question: "Que montre l'écran Aujourd'hui ?",
    answer:
      "Les semis, plantations, récoltes, arrosages, soins, déclarations d'élevage et factures échues du jour, classés par urgence, avec la fenêtre de travail météo de votre parcelle, les prévisions de la semaine, le plan de la ferme et vos principaux repères. Chaque personne peut déplacer, masquer ou agrandir les tuiles de sa page.",
  },
  {
    question: "Combien coûte Gleba ?",
    answer:
      "Le code est libre (AGPL-3.0) : l'installer sur votre propre serveur est gratuit. Le service hébergé sur gleba.fr est gratuit pendant la bêta ; il deviendra payant une fois le produit finalisé. Le code et l'auto-hébergement restent gratuits.",
  },
  {
    question: "Gleba est-il un logiciel de maraîchage adapté au bio et à la permaculture ?",
    answer:
      "Oui. Gleba intègre les rotations, les associations de cultures, le calendrier lunaire, des itinéraires techniques et un registre phytosanitaire comprenant notamment AMM, doses, DAR et ZNT. Les références et saisies restent à vérifier et à adapter par l'exploitant.",
  },
  {
    question: "Quelle différence entre Gleba, Brinjel et Ouvretaferme ?",
    answer:
      "Brinjel se concentre sur la planification maraîchère ; Ouvretaferme organise la production et la vente. Gleba relie dans un même dossier le maraîchage, le verger suivi arbre par arbre et les ateliers d'élevage, sur un plan de ferme dessiné sur photo aérienne et cadastre. Son code AGPL-3.0 s'auto-héberge, et l'application comprend un assistant connecté aux données de l'exploitation.",
  },
  {
    question: "Puis-je héberger Gleba sur mon propre serveur ?",
    answer:
      "Oui. Gleba se déploie avec Docker Compose sur un serveur Linux. Le code source est public sur GitHub. Vos données restent chez vous et vous gardez la main sur les sauvegardes. L'assistant IA, lui, n'est disponible que sur gleba.fr.",
  },
  {
    question: "Gleba peut-il remplacer un logiciel de comptabilité ?",
    answer:
      "Gleba inclut factures, clients, fournisseurs, TVA, suivi des transactions, coûts de production et export FEC sous conditions. Il ne produit ni liasse fiscale ni bilan et ne remplace donc pas un logiciel comptable complet ou un expert-comptable.",
  },
  {
    question: "Comment fonctionne le calendrier de semis ?",
    answer:
      "Le calendrier de semis indique, culture par culture, les périodes de semis, de plantation et de récolte ajustées à la zone climatique de votre exploitation. Il intègre en option le calendrier lunaire. Il reste à adapter à votre microclimat et à votre sol.",
  },
  {
    question: "Où sont mes données et puis-je les récupérer ?",
    answer:
      "L'instance gleba.fr est hébergée chez IONOS. Chaque compte peut exporter l'ensemble de ses données : un fichier CSV par table, dans une archive ZIP. En auto-hébergement, l'exploitant choisit lui-même son infrastructure et sa politique de sauvegarde.",
  },
  {
    question: "Gleba propose-t-il une intelligence artificielle ?",
    answer:
      "Oui. Un assistant répond en langage naturel à partir des données de votre exploitation et peut exécuter certains outils de l'application. Ses réponses sont une aide, à vérifier comme tout conseil. Gleba se pilote aussi par le protocole MCP depuis un client compatible.",
  },
  {
    question: "Sur quels appareils Gleba fonctionne-t-il ?",
    answer:
      "Dans un navigateur, sur ordinateur, tablette et téléphone. Sur téléphone, l'écran Aujourd'hui et la navigation basse sont pensés pour noter au champ : récolte, semis, arrosage, observation.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  inLanguage: "fr-FR",
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
};

/* ─── Petits éléments ─── */

function Surtitre({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sauge">{children}</p>;
}

function TitreSection({ id, children, className = "" }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <h2 id={id} className={`mt-3 text-balance font-display text-[32px] font-medium leading-[1.12] tracking-tight text-encre sm:text-[40px] ${className}`}>
      {children}
    </h2>
  );
}

/* ─── Page ─── */

export function HomeLanding() {
  return (
    <div className="w-full">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      {/* ═══ 1. En-tête ═══ */}
      <section aria-labelledby="titre-accueil" className="overflow-hidden px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <Surtitre>Logiciel libre · maraîchage, verger, élevage</Surtitre>
            <h1 id="titre-accueil" className="mt-4 font-display text-[40px] font-medium leading-[1.04] tracking-tight text-encre sm:text-[56px] lg:text-[64px]">
              Votre <span className="whitespace-nowrap">micro-ferme,</span>{" "}
              <span className="italic text-sauge">du plan de culture à la récolte.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ardoise sm:text-xl">
              Gleba est un logiciel de maraîchage et de gestion de ferme diversifiée. Chaque matin, il
              rassemble ce qu&apos;il y a à faire, planche par planche : semis, arrosages, récoltes, soins
              et factures, avec la météo de la parcelle et le plan de la ferme.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/register" className={`${CLASSES_CTA} min-h-12 px-6 text-[15px]`}>
                Créer mon carnet
                <ArrowRight className="h-4 w-4" weight="bold" aria-hidden />
              </Link>
              <Link href="/login?demo=1" className={`${CLASSES_CTA_SECONDAIRE} min-h-12 px-6 text-[15px]`}>
                Visiter la ferme de démonstration
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ardoise">
              {["Gratuit pendant la bêta", "Code AGPL-3.0", "Auto-hébergeable", "Données exportables"].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-prairie" weight="bold" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <figure className="mt-12 lg:mt-16">
            <ApercuAujourdhui />
            <figcaption className="mt-3 text-sm text-ardoise">
              L&apos;écran Aujourd&apos;hui, ici avec une journée d&apos;exemple : la liste du jour classée par
              urgence, le plan de la ferme, la semaine météo et l&apos;alerte de l&apos;assistant.{" "}
              <Link href="/login?demo=1" className={`font-semibold text-sauge underline-offset-2 hover:underline ${FOCUS}`}>
                Le voir sur la ferme de démonstration
              </Link>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ═══ 2. Ce que montre l'écran Aujourd'hui ═══ */}
      <section aria-labelledby="titre-aujourdhui" className="border-y border-lin bg-craie px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <Surtitre>L&apos;écran Aujourd&apos;hui</Surtitre>
            <TitreSection id="titre-aujourdhui">Ouvrir Gleba le matin, savoir quoi faire.</TitreSection>
            <p className="mt-5 text-lg leading-relaxed text-ardoise">
              Plutôt qu&apos;un tableau de bord à interpréter, une page qui répond à la question du
              matin. Tout ce qui ne peut pas attendre remonte en tête, quel que soit l&apos;atelier.
            </p>
          </div>
          <ol className="mt-14 grid gap-x-12 gap-y-0 md:grid-cols-2">
            {AUJOURDHUI.map(({ icone: Icone, titre, texte }) => (
              <li key={titre} className="flex gap-4 border-t border-lin py-6">
                <Icone className="mt-0.5 h-6 w-6 shrink-0 text-sauge" weight="duotone" aria-hidden />
                <div>
                  <h3 className="text-[17px] font-semibold leading-snug text-encre">{titre}</h3>
                  <p className="mt-1.5 leading-relaxed text-ardoise">{texte}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══ 3. Une saison dans Gleba ═══ */}
      <section id="fonctions" aria-labelledby="titre-saison" className="scroll-mt-6 px-4 py-20 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <Surtitre>Une saison dans Gleba</Surtitre>
            <TitreSection id="titre-saison">Du plan de culture à la facture, un seul dossier.</TitreSection>
            <p className="mt-5 text-lg leading-relaxed text-ardoise">
              Les tableurs débordent, les carnets se perdent, et chaque outil ne couvre qu&apos;une partie
              du travail. Gleba suit l&apos;exploitation d&apos;un bout à l&apos;autre de l&apos;année.
            </p>
          </div>

          <div className="mt-16 space-y-20 lg:space-y-28">
            {CHAPITRES.map((c, i) => (
              <article key={c.numero} className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
                <div className={`lg:col-span-5 ${i % 2 === 1 ? "lg:order-2" : ""}`}>
                  <p className="flex items-baseline gap-3 text-sm text-ardoise">
                    <span className="font-display text-2xl font-medium text-argile">{c.numero}</span>
                    {c.saison}
                  </p>
                  <h3 className="mt-2 font-display text-[28px] font-medium leading-tight tracking-tight text-encre">{c.titre}</h3>
                  <p className="mt-4 leading-relaxed text-ardoise">{c.texte}</p>
                  <ul className="mt-5 space-y-2.5">
                    {c.points.map((p) => (
                      <li key={p} className="flex gap-2.5 text-[15px] text-encre">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-prairie" weight="bold" aria-hidden />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-1">
                    {c.liens.map(([href, label]) => (
                      <li key={href}>
                        <Link href={href} className={`inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-sauge underline-offset-2 hover:underline ${FOCUS}`}>
                          {label}
                          <ArrowRight className="h-3.5 w-3.5" weight="bold" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <figure className={`lg:col-span-7 ${i % 2 === 1 ? "lg:order-1" : ""}`}>
                  <div className="overflow-hidden rounded-2xl border border-lin bg-craie">
                    <Image
                      src={c.image.src}
                      alt={c.image.alt}
                      width={c.image.width}
                      height={c.image.height}
                      sizes="(min-width: 1152px) 640px, (min-width: 1024px) 56vw, 100vw"
                      className="h-auto w-full"
                    />
                  </div>
                  <figcaption className="mt-2.5 text-sm text-ardoise">{c.image.legende}</figcaption>
                </figure>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 4. Pour quelle ferme ═══ */}
      <section aria-labelledby="titre-metiers" className="border-y border-lin bg-craie px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <Surtitre>Pour quelle ferme</Surtitre>
            <TitreSection id="titre-metiers">Activez seulement les ateliers que vous conduisez.</TitreSection>
            <p className="mt-5 text-lg leading-relaxed text-ardoise">
              Pensé d&apos;abord pour les micro-fermes professionnelles et les projets en installation,
              en maraîchage et en verger ; l&apos;élevage s&apos;y ajoute comme atelier complémentaire.
            </p>
          </div>
          <ul className="mt-12 divide-y divide-lin border-y border-lin">
            {METIERS.map(({ href, icone: Icone, titre, texte }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={`group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-5 transition-colors duration-fast hover:bg-sauge-doux sm:gap-6 sm:px-3 ${FOCUS}`}
                >
                  <Icone className="h-7 w-7 text-sauge" weight="duotone" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold text-encre">{titre}</span>
                    <span className="mt-0.5 block text-ardoise">{texte}</span>
                  </span>
                  <ArrowRight className="h-5 w-5 text-sauge transition-transform duration-fast group-hover:translate-x-1" weight="bold" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-ardoise">
            Aussi :{" "}
            {[
              ["/logiciel-potager", "plan de potager"],
              ["/logiciel-permaculture", "ferme en permaculture"],
              ["/logiciel-arboriculture", "arboriculture"],
              ["/logiciel-elevage-volailles", "élevage de volailles"],
              ["/logiciel-elevage-ovin", "élevage ovin"],
            ].map(([href, label], i, tout) => (
              <span key={href}>
                <Link href={href} className={`font-semibold text-sauge underline-offset-2 hover:underline ${FOCUS}`}>
                  {label}
                </Link>
                {i < tout.length - 1 ? " · " : "."}
              </span>
            ))}
          </p>
        </div>
      </section>

      {/* ═══ 5. Ce qui distingue Gleba ═══ */}
      <section aria-labelledby="titre-differences" className="px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Surtitre>Ce qui distingue Gleba</Surtitre>
            <TitreSection id="titre-differences">Un logiciel agricole libre pour toute la ferme.</TitreSection>
          </div>
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:col-span-8">
            {DIFFERENCES.map(({ titre, texte }) => (
              <div key={titre} className="border-t-2 border-encre pt-4">
                <dt className="text-[17px] font-semibold text-encre">{titre}</dt>
                <dd className="mt-2 leading-relaxed text-ardoise">{texte}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ═══ 6. Libre, ouvert, tarif ═══ */}
      <section aria-labelledby="titre-libre" className="border-y border-lin bg-craie px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
          <div>
            <Surtitre>Libre et ouvert</Surtitre>
            <TitreSection id="titre-libre">Vos données restent les vôtres.</TitreSection>
            <ul className="mt-8 space-y-5">
              {[
                { icone: GithubLogo, titre: "Code public sous licence AGPL-3.0", texte: "Lisible, vérifiable et modifiable sur GitHub.", href: "https://github.com/GMS64260/gleba", lien: "Voir le code" },
                { icone: Database, titre: "Auto-hébergement avec Docker Compose", texte: "Installez Gleba sur votre serveur ou celui de votre structure ; l'assistant IA reste propre à gleba.fr." },
                { icone: DownloadSimple, titre: "Export complet du compte", texte: "Toutes vos données à tout moment : un fichier CSV par table, dans une archive ZIP." },
                { icone: Plant, titre: "Référentiel agricole ouvert", texte: "Plus de 200 végétaux et 750 itinéraires techniques, consultables sans compte.", href: "/referentiel", lien: "Parcourir le référentiel" },
                { icone: Megaphone, titre: "Feuille de route publique", texte: "Les demandes et les votes des utilisateurs sont visibles par tous.", href: "/communaute", lien: "Voir la feuille de route" },
              ].map(({ icone: Icone, titre, texte, href, lien }) => (
                <li key={titre} className="flex gap-4">
                  <Icone className="mt-0.5 h-6 w-6 shrink-0 text-sauge" weight="duotone" aria-hidden />
                  <div>
                    <p className="font-semibold text-encre">{titre}</p>
                    <p className="mt-0.5 text-ardoise">
                      {texte}{" "}
                      {href && lien && (
                        <Link href={href} className={`font-semibold text-sauge underline-offset-2 hover:underline ${FOCUS}`}>
                          {lien}
                        </Link>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm text-ardoise">
              Référencé sur{" "}
              <a href="https://framalibre.org/notices/gleba-fr.html" rel="noopener" className={`font-semibold text-sauge underline-offset-2 hover:underline ${FOCUS}`}>
                Framalibre
              </a>
              , l&apos;annuaire du logiciel libre.
            </p>
          </div>

          <div className="self-start rounded-2xl border border-lin bg-papier p-6 sm:p-8">
            <Surtitre>Tarif</Surtitre>
            <p className="mt-3 font-display text-[28px] font-medium leading-tight tracking-tight text-encre">Gratuit pendant la bêta.</p>
            <dl className="mt-6 divide-y divide-lin border-y border-lin">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-4">
                <dt>
                  <span className="font-semibold text-encre">Service hébergé sur gleba.fr</span>
                  <span className="mt-0.5 block text-sm text-ardoise">Mises à jour et assistant compris.</span>
                </dt>
                <dd className="text-right font-semibold text-prairie">0 € en bêta</dd>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-4">
                <dt>
                  <span className="font-semibold text-encre">Auto-hébergement</span>
                  <span className="mt-0.5 block text-sm text-ardoise">Le code public, sur votre serveur, sans l&apos;assistant IA.</span>
                </dt>
                <dd className="text-right font-semibold text-prairie">Gratuit</dd>
              </div>
            </dl>
            <p className="mt-5 text-sm leading-relaxed text-ardoise">
              Après la bêta, le service hébergé deviendra payant. Le code et l&apos;auto-hébergement
              restent gratuits.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className={CLASSES_CTA}>
                Créer mon carnet
              </Link>
              <Link href="/licence" className={CLASSES_CTA_SECONDAIRE}>
                Lire la licence
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 7. Questions fréquentes ═══ */}
      <section id="faq" aria-labelledby="titre-faq" className="scroll-mt-6 px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Surtitre>Questions fréquentes</Surtitre>
            <TitreSection id="titre-faq">Avant de commencer.</TitreSection>
            <p className="mt-5 text-ardoise">
              Une autre question ?{" "}
              <a href="mailto:contact@gleba.fr" className={`font-semibold text-sauge underline-offset-2 hover:underline ${FOCUS}`}>
                contact@gleba.fr
              </a>
            </p>
          </div>
          <div className="divide-y divide-lin border-y border-lin lg:col-span-8">
            {FAQS.map((faq) => (
              <details key={faq.question} className="group">
                <summary className={`flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden ${FOCUS}`}>
                  <h3 className="text-[17px] font-semibold text-encre">{faq.question}</h3>
                  <CaretDown className="h-5 w-5 shrink-0 text-sauge transition-transform duration-base group-open:rotate-180" weight="bold" aria-hidden />
                </summary>
                <p className="pb-5 pr-8 leading-relaxed text-ardoise">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 8. Appel final ═══ */}
      <section aria-labelledby="titre-final" className="px-4 pb-24 sm:px-6">
        <div className="mx-auto max-w-6xl rounded-[20px] bg-foret px-6 py-14 text-center sm:px-12">
          <h2 id="titre-final" className="mx-auto max-w-2xl text-balance font-display text-[32px] font-medium leading-tight tracking-tight text-craie sm:text-[40px]">
            La prochaine saison se prépare cet hiver.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-sauge-doux">
            Dessinez vos planches, posez votre plan de culture, et retrouvez chaque matin ce qu&apos;il y
            a à faire.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-craie px-6 text-[15px] font-semibold text-foret transition-colors duration-fast hover:bg-sauge-doux focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-craie"
            >
              Créer mon carnet
              <ArrowRight className="h-4 w-4" weight="bold" aria-hidden />
            </Link>
            <Link
              href="/login?demo=1"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-sauge-doux px-6 text-[15px] font-semibold text-craie transition-colors duration-fast hover:bg-sauge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-craie"
            >
              Visiter la ferme de démonstration
            </Link>
          </div>
          <p className="mt-6 text-sm text-sauge-doux">
            Vous voulez accompagner Gleba comme ferme pilote cet hiver ?{" "}
            <a href="mailto:contact@gleba.fr?subject=Ferme%20pilote" className="font-semibold text-craie underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-craie">
              Écrivez-nous
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
