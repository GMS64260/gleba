import { requireAdmin } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Shield, ChevronLeft } from "lucide-react"
import { FeedbackDashboard } from "./FeedbackDashboard"

export const dynamic = "force-dynamic"

const BLOCKER_LABELS: Record<string, string> = {
  ux_confusing: "Interface confuse",
  missing_features: "Fonctionnalités manquantes",
  bugs_perf: "Bugs / lenteur",
  not_suited: "Pas adapté",
  onboarding_unclear: "Onboarding peu clair",
  mobile_lacking: "Pas pratique mobile",
  docs_lacking: "Doc insuffisante",
  no_time: "Pas eu le temps",
}

const MODULE_LABELS: Record<string, string> = {
  jardin: "Jardin",
  verger: "Verger",
  elevage: "Élevage",
  compta: "Compta",
  ia: "IA",
  meteo: "Météo",
}

const WILL_RETURN_LABELS: Record<string, string> = {
  yes: "Oui",
  maybe: "Peut-être",
  no: "Non",
}

export default async function AdminFeedbackPage() {
  await requireAdmin()

  const [tokens, responses, pendingUsers] = await Promise.all([
    prisma.feedbackToken.findMany({
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.feedbackResponse.findMany({
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    // Users actifs, non-admin, hors démo, sans réponse
    prisma.user.findMany({
      where: {
        role: "USER",
        active: true,
        email: { not: "demo@gleba.fr" },
        feedbackResponses: { none: {} },
      },
      select: { id: true, email: true, name: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ])

  const totalSent = tokens.length
  const totalResponses = responses.length
  const responseRate = totalSent
    ? Math.round((totalResponses / totalSent) * 100)
    : 0

  const avgRating = responses.length
    ? responses.reduce((s, r) => s + r.rating, 0) / responses.length
    : null

  // Distribution blockers
  const blockerCounts: Record<string, number> = {}
  for (const r of responses) {
    for (const b of r.blockers) {
      blockerCounts[b] = (blockerCounts[b] || 0) + 1
    }
  }
  const topBlockers = Object.entries(blockerCounts)
    .map(([code, count]) => ({
      code,
      label: BLOCKER_LABELS[code] || code,
      count,
      pct: Math.round((count / Math.max(responses.length, 1)) * 100),
    }))
    .sort((a, b) => b.count - a.count)

  // Distribution modules
  const moduleCounts: Record<string, number> = {}
  for (const r of responses) {
    for (const m of r.modules) {
      moduleCounts[m] = (moduleCounts[m] || 0) + 1
    }
  }
  const topModules = Object.entries(moduleCounts)
    .map(([code, count]) => ({
      code,
      label: MODULE_LABELS[code] || code,
      count,
    }))
    .sort((a, b) => b.count - a.count)

  // Distribution will_return
  const willReturnCounts: Record<string, number> = {
    yes: 0,
    maybe: 0,
    no: 0,
  }
  for (const r of responses) {
    if (r.willReturn) willReturnCounts[r.willReturn] = (willReturnCounts[r.willReturn] || 0) + 1
  }

  const dashboardData = {
    stats: {
      totalSent,
      totalResponses,
      responseRate,
      avgRating,
      pendingCount: pendingUsers.length,
      willReturn: willReturnCounts,
      willReturnLabels: WILL_RETURN_LABELS,
    },
    topBlockers,
    topModules,
    responses: responses.map((r) => ({
      id: r.id,
      email: r.user.email,
      name: r.user.name,
      lang: r.lang,
      rating: r.rating,
      blockers: r.blockers.map((b) => BLOCKER_LABELS[b] || b),
      whatBlocked: r.whatBlocked,
      missing: r.missing,
      modules: r.modules.map((m) => MODULE_LABELS[m] || m),
      willReturn: r.willReturn ? WILL_RETURN_LABELS[r.willReturn] || r.willReturn : null,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
    })),
    pending: pendingUsers.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.createdAt.toISOString(),
    })),
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-amber-600" />
            <h1 className="text-2xl font-bold text-amber-800">
              Feedback utilisateurs
            </h1>
          </div>
          <Link href="/admin">
            <Button variant="outline" size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Admin
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <FeedbackDashboard data={dashboardData} />
      </main>
    </div>
  )
}
