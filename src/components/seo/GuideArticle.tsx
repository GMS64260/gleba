import Link from "next/link";
import { ArrowRight, Info } from "@/lib/phosphor-icons";
import { Breadcrumb } from "./Breadcrumb";
import { FAQSection, type FAQItem } from "./FAQSection";
import { InternalLinks } from "./InternalLinks";

export type SourceArticle = { titre: string; url: string; editeur: string };

type Props = {
  breadcrumb: string;
  currentPath: string;
  eyebrow: string;
  title: string;
  chapeau: string;
  /** Date de la dernière vérification des faits, AAAA-MM-JJ. */
  miseAJour: string;
  aRetenir?: string[];
  sections: { titre: string; contenu: React.ReactNode }[];
  appel: { titre: string; texte: string; href: string; libelle: string };
  sources: SourceArticle[];
  faqs: FAQItem[];
};

const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Page éditoriale (guide, comparatif) dans la charte « carnet de ferme » :
 * date de vérification visible, sources citées en fin de page, données
 * structurées Article. Une affirmation sans source n'y entre pas.
 */
export function GuideArticle({ breadcrumb, currentPath, eyebrow, title, chapeau, miseAJour, aRetenir, sections, appel, sources, faqs }: Props) {
  const date = new Date(`${miseAJour}T00:00:00Z`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: chapeau,
    inLanguage: "fr-FR",
    dateModified: miseAJour,
    mainEntityOfPage: `https://gleba.fr${currentPath}`,
    image: "https://gleba.fr/og-image.png",
    author: { "@type": "Organization", name: "Gleba", url: "https://gleba.fr" },
    publisher: { "@type": "Organization", name: "Gleba", logo: { "@type": "ImageObject", url: "https://gleba.fr/icon-512.png" } },
    citation: sources.map((s) => s.url),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumb items={[{ label: breadcrumb, href: currentPath }]} />
      <article className="px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <header className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sauge">{eyebrow}</p>
          <h1 className="mt-4 text-balance font-display text-[34px] font-medium leading-[1.1] tracking-tight text-encre sm:text-[46px]">{title}</h1>
          <p className="mt-6 text-lg leading-relaxed text-ardoise sm:text-xl">{chapeau}</p>
          <p className="mt-5 text-sm text-ardoise">
            Mis à jour le <time dateTime={miseAJour}>{FORMAT_DATE.format(date)}</time> · {sources.length} sources citées en fin de page
          </p>
        </header>

        {aRetenir && aRetenir.length > 0 && (
          <aside aria-labelledby="a-retenir" className="mx-auto mt-10 max-w-3xl rounded-2xl border border-lin bg-craie p-6">
            <h2 id="a-retenir" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-sauge">
              <Info className="h-4 w-4" weight="bold" aria-hidden />À retenir
            </h2>
            <ul className="mt-3 space-y-2 leading-relaxed text-encre">
              {aRetenir.map((point) => (
                <li key={point} className="flex gap-2.5">
                  <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-argile" />
                  {point}
                </li>
              ))}
            </ul>
          </aside>
        )}

        <div className="mx-auto mt-12 max-w-3xl space-y-12">
          {sections.map((section) => (
            <section key={section.titre}>
              <h2 className="text-balance font-display text-[26px] font-medium leading-tight tracking-tight text-encre sm:text-[30px]">{section.titre}</h2>
              <div className="mt-4 space-y-4 text-[17px] leading-relaxed text-encre [&_a]:font-semibold [&_a]:text-sauge [&_a]:underline-offset-2 hover:[&_a]:underline [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-6 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6 [&_ul]:marker:text-argile">{section.contenu}</div>
            </section>
          ))}

          <aside className="rounded-2xl bg-foret px-6 py-8 text-craie sm:px-8">
            <h2 className="font-display text-[24px] font-medium leading-tight">{appel.titre}</h2>
            <p className="mt-3 leading-relaxed text-sauge-doux">{appel.texte}</p>
            <Link
              href={appel.href}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-craie px-5 text-sm font-semibold text-foret transition-colors duration-fast hover:bg-sauge-doux focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-craie"
            >
              {appel.libelle}
              <ArrowRight className="h-4 w-4" weight="bold" aria-hidden />
            </Link>
          </aside>

          <section aria-labelledby="sources">
            <h2 id="sources" className="font-display text-[22px] font-medium text-encre">Sources</h2>
            <p className="mt-2 text-sm text-ardoise">
              Consultées le <time dateTime={miseAJour}>{FORMAT_DATE.format(date)}</time>. Signalez une information dépassée à{" "}
              <a href="mailto:contact@gleba.fr" className="font-semibold text-sauge underline-offset-2 hover:underline">contact@gleba.fr</a>.
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-encre marker:text-ardoise">
              {sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} rel="noopener" className="font-medium text-sauge underline-offset-2 hover:underline">
                    {s.titre}
                  </a>
                  <span className="text-ardoise"> — {s.editeur}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </article>
      <InternalLinks currentPath={currentPath} />
      <FAQSection faqs={faqs} />
    </>
  );
}
