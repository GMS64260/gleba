import { requireAdmin } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Shield, ChevronLeft } from "lucide-react"
import { BugsDashboard } from "./BugsDashboard"

export const dynamic = "force-dynamic"

export default async function AdminBugsPage() {
  await requireAdmin()

  const bugs = await prisma.bugReport.findMany({
    include: {
      user: { select: { id: true, email: true, name: true } },
      statusLogs: {
        include: { changedBy: { select: { email: true, name: true } } },
        orderBy: { changedAt: "desc" },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 500,
  })

  const counts = await prisma.bugReport.groupBy({
    by: ["status"],
    _count: { _all: true },
  })

  const stats = {
    total: bugs.length,
    open: counts.find((c) => c.status === "OPEN")?._count._all ?? 0,
    inProgress: counts.find((c) => c.status === "IN_PROGRESS")?._count._all ?? 0,
    resolved: counts.find((c) => c.status === "RESOLVED")?._count._all ?? 0,
  }

  const initialBugs = bugs.map((b) => ({
    id: b.id,
    type: b.type,
    status: b.status,
    priority: b.priority,
    message: b.message,
    url: b.url,
    userAgent: b.userAgent,
    viewport: b.viewport,
    adminNote: b.adminNote,
    resolvedAt: b.resolvedAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    user: b.user,
    statusLogs: b.statusLogs.map((l) => ({
      id: l.id,
      fromStatus: l.fromStatus,
      toStatus: l.toStatus,
      note: l.note,
      changedAt: l.changedAt.toISOString(),
      changedBy: l.changedBy,
    })),
  }))

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-amber-600" />
            <h1 className="text-2xl font-bold text-amber-800">
              Retours utilisateurs
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
        <BugsDashboard initialBugs={initialBugs} stats={stats} />
      </main>
    </div>
  )
}
