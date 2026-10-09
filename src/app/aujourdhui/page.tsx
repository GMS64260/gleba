import type { Metadata } from "next";
import { Accueil } from "@/components/accueil/Accueil";

/**
 * Accueil v2 « La ferme d'abord » (bento), en opt-in par compte (préférence
 * `accueil = "v2"`, livraison L2 du 2026-10-09). La route est protégée par le
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
