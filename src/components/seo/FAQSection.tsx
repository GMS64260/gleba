import { ChevronDown } from "lucide-react";

export type FAQItem = { question: string; answer: string };

type Props = {
  title?: string;
  subtitle?: string;
  faqs: FAQItem[];
};

export function FAQSection({
  title = "Questions fréquentes",
  subtitle,
  faqs,
}: Props) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "fr-FR",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <section id="faq" className="scroll-mt-8 px-4 py-16 sm:px-6 sm:py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sauge">FAQ</p>
          <h2 className="mt-3 font-display text-[30px] font-medium leading-tight tracking-tight text-encre sm:text-[36px]">
            {title}
          </h2>
          {subtitle && <p className="mt-4 text-ardoise">{subtitle}</p>}
        </div>

        <div className="divide-y divide-lin border-y border-lin lg:col-span-8">
          {faqs.map((faq) => (
            <details key={faq.question} className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge [&::-webkit-details-marker]:hidden">
                <h3 className="text-[17px] font-semibold text-encre">{faq.question}</h3>
                <ChevronDown className="h-5 w-5 shrink-0 text-sauge transition-transform duration-base group-open:rotate-180" aria-hidden />
              </summary>
              <p className="whitespace-pre-line pb-5 pr-8 leading-relaxed text-ardoise">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
