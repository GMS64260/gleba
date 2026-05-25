/**
 * Page d'accueil Gleba — Server Component
 *
 * Comportement conditionnel selon la session :
 *  - Visiteur non connecté → <HomeLanding /> (landing publique, SSR full, SEO)
 *  - Utilisateur connecté → <MaraichageHome /> (l'app, comme avant)
 *
 * Permet à gleba.fr d'être indexable directement par Google sans passer par /login.
 */

import { auth } from "@/lib/auth";
import { HomeLanding } from "@/components/seo/HomeLanding";
import { MaraichageHome } from "@/components/maraichage/MaraichageHome";

export default async function Home() {
  const session = await auth();
  if (!session?.user) {
    return <HomeLanding />;
  }
  return <MaraichageHome />;
}
