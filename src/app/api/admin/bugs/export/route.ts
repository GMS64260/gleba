import { requireAdminApi } from "@/lib/auth-utils"
import { celluleCsv } from "@/lib/csv-cellule"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

// Les signalements sont écrits par les utilisateurs et ouverts par l'équipe
// dans un tableur : formules neutralisées (cf. `csv-cellule.ts`).
const csvEscape = (v: string | null | undefined): string => celluleCsv(v)

export async function GET(request: Request) {
  const { error } = await requireAdminApi(request)
  if (error) return error

  const bugs = await prisma.bugReport.findMany({
    include: { user: { select: { email: true, name: true } } },
    orderBy: { createdAt: "desc" },
  })

  const headers = [
    "id",
    "createdAt",
    "type",
    "status",
    "priority",
    "userEmail",
    "userName",
    "message",
    "url",
    "userAgent",
    "viewport",
    "adminNote",
    "resolvedAt",
  ]

  const rows = bugs.map((b) =>
    [
      b.id,
      b.createdAt.toISOString(),
      b.type,
      b.status,
      b.priority,
      b.user.email,
      b.user.name,
      b.message,
      b.url,
      b.userAgent,
      b.viewport,
      b.adminNote,
      b.resolvedAt?.toISOString() ?? "",
    ]
      .map(csvEscape)
      .join(",")
  )

  const csv = "﻿" + [headers.join(","), ...rows].join("\n")
  const date = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gleba-bugs-${date}.csv"`,
    },
  })
}
