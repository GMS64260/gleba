import Link from "next/link"
import { requireAdmin } from "@/lib/auth-utils"
import { ContributionsModeration } from "./ContributionsModeration"

export const dynamic = "force-dynamic"

export default async function ModerationContributionsPage() {
  await requireAdmin()
  return (
    <main className="min-h-screen bg-papier px-4 py-8 text-encre sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin/referentiels" className="inline-flex min-h-11 items-center text-sm text-foret hover:underline">← Référentiels</Link>
        <h1 className="mt-4 font-display text-3xl text-foret">Relire les contributions</h1>
        <p className="mt-3 max-w-3xl text-sm text-ardoise">Comparer le passage proposé, vérifier sa source et expliquer la décision. Une publication ajoute une version documentaire ; elle ne modifie pas les paramètres des cultures.</p>
        <ContributionsModeration />
      </div>
    </main>
  )
}
