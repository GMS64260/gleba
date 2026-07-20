import type { Metadata } from "next";
import { MaraichageHome } from "@/components/maraichage/MaraichageHome";

export const metadata: Metadata = {
  title: "Tableau de bord",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <MaraichageHome />;
}
