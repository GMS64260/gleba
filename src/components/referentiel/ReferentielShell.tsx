import { getSession } from "@/lib/auth-utils"
import { MarketingShell } from "@/components/seo/MarketingShell"
import { AppHeader } from "@/components/shell/AppHeader"

/**
 * Les mêmes fiches restent publiques, mais un membre garde la navigation de
 * son carnet. Le rail est déjà fourni par CoquilleV2 dans le layout racine.
 */
export async function ReferentielShell({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.user) return <MarketingShell>{children}</MarketingShell>

  return (
    <div className="min-h-screen bg-papier text-encre">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-craie focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-encre focus:outline focus:outline-2 focus:outline-sauge">Aller au contenu</a>
      <AppHeader />
      <main id="contenu">{children}</main>
    </div>
  )
}
