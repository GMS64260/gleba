import type { Metadata } from "next";
import { Accueil } from "@/components/accueil/Accueil";

/**
 * Accueil « La ferme d'abord » (bento) : le seul accueil depuis le retrait de
 * l'ancien (2026-11-26). La route est protégée par le
 * middleware comme toute page applicative ; les données viennent de
 * `GET /api/accueil/aujourdhui`.
 */
export const metadata: Metadata = {
  title: "Aujourd'hui",
  robots: { index: false, follow: false },
};

export default function AujourdhuiPage() {
  return <Accueil />;
}
