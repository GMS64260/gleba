import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MaraichageHome } from "@/components/maraichage/MaraichageHome";
import { getSession } from "@/lib/auth-utils";
import { CHEMIN_ACCUEIL } from "@/lib/accueil/preference";
import { lireVersionAccueil } from "@/lib/accueil/preference.server";

export const metadata: Metadata = {
  title: "Tableau de bord",
  robots: { index: false, follow: false },
};

// La préférence se lit en base à chaque requête : jamais de rendu statique.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Accueil v2 en opt-in (2026-10-09) : la décision se prend ICI, côté
  // serveur, avant tout rendu (redirection 307, pas de flash de l'ancien
  // écran), parce que le middleware ne lit pas la base. La session brute
  // porte l'ACTEUR : la préférence est celle de la personne, pas de
  // l'exploitation.
  const session = await getSession();
  const acteurId = session?.user?.id;
  if (acteurId) {
    const version = await lireVersionAccueil(acteurId);
    if (version === "v2") redirect(CHEMIN_ACCUEIL.v2);
  }
  return <MaraichageHome />;
}
