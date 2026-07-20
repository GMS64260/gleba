import Link from "next/link";
import Image from "next/image";
import { Check, ArrowRight } from "lucide-react";
import { Breadcrumb } from "./Breadcrumb";
import { FAQSection, type FAQItem } from "./FAQSection";
import { InternalLinks } from "./InternalLinks";

type Capability = { title: string; description: string };

type Props = {
  breadcrumb: string;
  currentPath: string;
  eyebrow: string;
  title: string;
  highlightedTitle: string;
  introduction: string;
  proof: string;
  screenshot?: { src: string; alt: string; caption: string };
  capabilities: Capability[];
  workflowTitle: string;
  workflow: Capability[];
  limits?: string;
  faqs: FAQItem[];
};

/**
 * Landing métier sobre : chaque bloc décrit une capacité observable dans
 * l'application. Pas de promesse de résultat, de conformité ou de fonction à venir.
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
      <section className="px-4 pb-20 pt-8 sm:pb-24 sm:pt-12">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-6 text-xs font-medium uppercase tracking-[0.22em] text-emerald-700/70">
            {eyebrow}
          </p>
          <h1 className="font-heading text-4xl font-extralight leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            {title}<br />
            <span className="font-normal text-emerald-700">{highlightedTitle}</span>
          </h1>
          <p className="mx-auto mt-8 max-w-3xl text-lg font-light leading-relaxed text-slate-600 sm:text-xl">
            {introduction}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-7 py-3.5 text-sm font-medium text-white transition-colors hover:bg-emerald-800">
              Essayer Gleba <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="rounded-full border border-slate-200 px-7 py-3.5 text-sm font-medium text-slate-700 transition-colors hover:border-emerald-300">
              Ouvrir le compte de démonstration
            </Link>
          </div>
          <p className="mx-auto mt-8 max-w-2xl rounded-2xl border border-emerald-100 bg-emerald-50/60 px-5 py-4 text-sm leading-relaxed text-emerald-950">
            <strong>Ce qui est vérifiable dans Gleba :</strong> {proof}
          </p>
          {screenshot && (
            <figure className="mt-12 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
              <Image src={screenshot.src} alt={screenshot.alt} width={1440} height={1000} priority className="h-auto w-full rounded-xl" />
              <figcaption className="px-3 py-3 text-sm text-slate-500">{screenshot.caption}</figcaption>
            </figure>
          )}
        </div>
      </section>

      <section className="bg-white/70 px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-heading text-3xl font-extralight tracking-tight text-slate-900 sm:text-4xl">
            Des fonctions <span className="font-normal">déjà disponibles</span>
          </h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((item) => (
              <article key={item.title} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <Check className="mb-4 h-5 w-5 text-emerald-600" />
                <h3 className="font-medium text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center font-heading text-3xl font-extralight tracking-tight text-slate-900 sm:text-4xl">
            {workflowTitle}
          </h2>
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {workflow.map((item, index) => (
              <li key={item.title} className="rounded-2xl border border-slate-100 bg-white/80 p-6">
                <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Étape {index + 1}</span>
                <h3 className="mt-3 text-lg font-medium text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
              </li>
            ))}
          </ol>
          {limits && (
            <p className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm leading-relaxed text-amber-950">
              <strong>Périmètre :</strong> {limits}
            </p>
          )}
        </div>
      </section>

      <InternalLinks currentPath={currentPath} />
      <FAQSection faqs={faqs} />
    </>
  );
}
