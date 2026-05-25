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
    <section
      id="faq"
      className="py-24 px-4 bg-gradient-to-b from-white to-emerald-50/30 scroll-mt-8"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs tracking-[0.25em] uppercase text-emerald-600/60 font-medium mb-4">
            FAQ
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-extralight text-slate-900 tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-4 text-base text-slate-500 max-w-2xl mx-auto">
              {subtitle}
            </p>
          )}
        </div>

        <div className="space-y-4">
          {faqs.map((faq) => (
            <details
              key={faq.question}
              className="group bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 overflow-hidden hover:border-emerald-200 transition-colors"
            >
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none p-6">
                <h3 className="text-base sm:text-lg font-medium text-slate-900 tracking-tight">
                  {faq.question}
                </h3>
                <ChevronDown className="h-5 w-5 flex-shrink-0 text-emerald-600/60 transition-transform duration-300 group-open:rotate-180" />
              </summary>
              <div className="px-6 pb-6 -mt-2">
                <p className="text-slate-500 leading-relaxed text-[15px] whitespace-pre-line">
                  {faq.answer}
                </p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
