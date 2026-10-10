import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, Info } from "@/lib/phosphor-icons";
import { Breadcrumb } from "./Breadcrumb";
import { FAQSection, type FAQItem } from "./FAQSection";
import { InternalLinks } from "./InternalLinks";
import { CLASSES_CTA, CLASSES_CTA_SECONDAIRE } from "./MarketingShell";

type Capability = { title: string; description: string };

type Props = {
  breadcrumb: string;
  currentPath: string;
  eyebrow: string;
  title: string;
  highlightedTitle: string;
  introduction: string;
  proof: string;
  /** Dimensions réelles de l'image (réservent la place, pas de décalage au chargement). */
  screenshot?: { src: string; alt: string; caption: string; width?: number; height?: number };
  capabilities: Capability[];
  workflowTitle: string;
  workflow: Capability[];
  limits?: string;
  faqs: FAQItem[];
};

/**
 * Landing métier sobre, dans la charte « carnet de ferme » : chaque bloc
 * décrit une capacité observable dans l'application. Pas de promesse de
 * résultat, de conformité ou de fonction à venir.
 */
export function BusinessLanding({
  breadcrumb,
  currentPath,
  eyebrow,
  title,
  highlightedTitle,
  introduction,
  proof,
  screenshot,
  capabilities,
  workflowTitle,
  workflow,
  limits,
  faqs,
}: Props) {
  return (
    <>
      <Breadcrumb items={[{ label: breadcrumb, href: currentPath }]} />
      <section className="px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-10">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sauge">{eyebrow}</p>
            <h1 className="mt-4 font-display text-[36px] font-medium leading-[1.08] tracking-tight text-encre sm:text-[48px] lg:text-[56px]">
              {title} <span className="italic text-sauge">{highlightedTitle}</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-ardoise sm:text-xl">{introduction}</p>
            <p className="mt-4 text-sm font-medium text-encre">
              Pensé en priorité pour les micro-fermes professionnelles et les projets en installation.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className={`${CLASSES_CTA} min-h-12 px-6 text-[15px]`}>
                Créer mon carnet <ArrowRight className="h-4 w-4" weight="bold" aria-hidden />
              </Link>
              <Link href="/login?demo=1" className={`${CLASSES_CTA_SECONDAIRE} min-h-12 px-6 text-[15px]`}>
                Visiter la ferme de démonstration
              </Link>
            </div>
            <p className="mt-8 flex gap-3 border-l-4 border-prairie bg-craie px-5 py-4 text-sm leading-relaxed text-encre">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-prairie" weight="bold" aria-hidden />
              <span>
                <strong className="font-semibold">Ce qui est vérifiable dans Gleba :</strong> {proof}
              </span>
            </p>
          </div>
          {screenshot && (
            <figure className="mt-12">
              <div className="overflow-hidden rounded-2xl border border-lin bg-craie">
                <Image
                  src={screenshot.src}
                  alt={screenshot.alt}
                  width={screenshot.width ?? 1440}
                  height={screenshot.height ?? 1000}
                  sizes="(min-width: 1152px) 1104px, 100vw"
                  priority
                  className="h-auto w-full"
                />
              </div>
              <figcaption className="mt-2.5 text-sm text-ardoise">{screenshot.caption}</figcaption>
            </figure>
          )}
        </div>
      </section>

      <section className="border-y border-lin bg-craie px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sauge">Fonctions</p>
          <h2 className="mt-3 font-display text-[30px] font-medium leading-tight tracking-tight text-encre sm:text-[36px]">
            Déjà disponibles dans l&apos;application
          </h2>
          <ul className="mt-10 grid gap-x-12 md:grid-cols-2">
            {capabilities.map((item) => (
              <li key={item.title} className="flex gap-3 border-t border-lin py-5">
                <Check className="mt-1 h-4 w-4 shrink-0 text-prairie" weight="bold" aria-hidden />
                <div>
                  <h3 className="font-semibold text-encre">{item.title}</h3>
                  <p className="mt-1 leading-relaxed text-ardoise">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-3xl font-display text-[30px] font-medium leading-tight tracking-tight text-encre sm:text-[36px]">
            {workflowTitle}
          </h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {workflow.map((item, index) => (
              <li key={item.title} className="border-t-2 border-encre pt-4">
                <span className="font-display text-2xl font-medium text-argile">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 text-lg font-semibold text-encre">{item.title}</h3>
                <p className="mt-2 leading-relaxed text-ardoise">{item.description}</p>
              </li>
            ))}
          </ol>
          {limits && (
            <p className="mt-12 flex gap-3 rounded-xl border border-lin bg-paille-doux px-5 py-4 text-sm leading-relaxed text-encre">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-ocre" weight="bold" aria-hidden />
              <span>
                <strong className="font-semibold">Périmètre :</strong> {limits}
              </span>
            </p>
          )}
        </div>
      </section>

      <InternalLinks currentPath={currentPath} />
      <FAQSection faqs={faqs} />
    </>
  );
}
