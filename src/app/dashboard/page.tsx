import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Tableau de bord",
  robots: { index: false, follow: false },
};

/**
 * Ancienne adresse de l'accueil. L'accueil historique est retiré depuis le
 * 2026-11-26 : il n'en reste qu'un, `/aujourdhui`. La redirection garde les
 * favoris, les liens internes et la réécriture de `/` par le middleware.
 */
export default function DashboardPage() {
  redirect("/aujourdhui");
}
