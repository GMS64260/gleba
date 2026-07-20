/**
 * Page d'accueil Gleba — Server Component
 *
 * Landing publique statique. Le middleware réécrit en interne les visites
 * authentifiées de `/` vers `/dashboard`, sans changer l'URL du navigateur.
 */

import { HomeLanding } from "@/components/seo/HomeLanding";

export default function Home() {
  return <HomeLanding />;
}
