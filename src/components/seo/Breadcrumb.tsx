import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export type BreadcrumbItem = { label: string; href: string };

/**
 * Fil d'ariane SEO : JSON-LD BreadcrumbList + UI minimale.
 * Les rich snippets Google affichent le chemin sous le title.
 */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  // Items injectés dans le JSON-LD : home + items
  const fullItems = [{ label: "Accueil", href: "/" }, ...items];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: fullItems.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      item: `https://gleba.fr${item.href === "/" ? "" : item.href}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Fil d'ariane" className="px-4 pb-2 pt-6 text-sm text-ardoise sm:px-6">
        <ol className="mx-auto flex max-w-6xl flex-wrap items-center gap-1.5">
          <li>
            <Link
              href="/"
              className="flex min-h-9 items-center gap-1 hover:text-foret focus-visible:outline focus-visible:outline-2 focus-visible:outline-sauge"
            >
              <Home className="h-3.5 w-3.5" />
              <span className="sr-only">Accueil</span>
            </Link>
          </li>
          {items.map((item, i) => {
            const isLast = i === items.length - 1;
            return (
              <li key={item.href} className="flex items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5 text-lin" aria-hidden />
                {isLast ? (
                  <span className="font-medium text-encre" aria-current="page">
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="hover:text-foret"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
