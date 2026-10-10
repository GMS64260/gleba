/**
 * Page d'accueil Gleba — Server Component
 *
 * Landing publique statique. Le middleware réécrit en interne les visites
 * authentifiées de `/` vers `/dashboard`, sans changer l'URL du navigateur.
 */

import type { Metadata } from "next";
import { HomeLanding } from "@/components/seo/HomeLanding";
import { MarketingShell } from "@/components/seo/MarketingShell";
import { ogBase } from "@/lib/seo/og";

// La canonical est posée ici et non dans le layout racine : une canonical
// héritée faisait de /communaute, /glossaire et /licence des doublons de
// l'accueil aux yeux des moteurs (constat du 2026-10-10).
export const metadata: Metadata = {
  title: { absolute: "Gleba — Logiciel libre de maraîchage et de micro-ferme" },
  description:
    "Plan de culture, planches, verger, élevage, registre phyto, stocks et ventes dans un seul carnet libre. Chaque matin, ce qu'il y a à faire. Gratuit en bêta.",
  alternates: { canonical: "https://gleba.fr" },
  openGraph: {
    ...ogBase,
    title: "Gleba, le carnet libre des micro-fermes",
    description:
      "Chaque matin, ce qu'il y a à faire, planche par planche : maraîchage, verger, élevage, météo de la parcelle et plan de la ferme dans un même dossier.",
    url: "https://gleba.fr",
    type: "website",
  },
};

export default function Home() {
  return (
    <MarketingShell>
      <HomeLanding />
    </MarketingShell>
  );
}
