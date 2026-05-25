import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import type { BugStatus, BugType, BugPriority, Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

const STATUS_VALUES: BugStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED"]
const TYPE_VALUES: BugType[] = ["BUG", "EVOLUTION", "AUTRE"]
const PRIORITY_VALUES: BugPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

export async function GET(request: Request) {
  const { error } = await requireAdminApi(request)
  if (error) return error

  const url = new URL(request.url)
  const status = url.searchParams.get("status")
  const type = url.searchParams.get("type")
  const priority = url.searchParams.get("priority")
  const search = url.searchParams.get("q")?.trim()

  const where: Prisma.BugReportWhereInput = {}
  if (status && STATUS_VALUES.includes(status as BugStatus)) {
    where.status = status as BugStatus
  }
  if (type && TYPE_VALUES.includes(type as BugType)) {
    where.type = type as BugType
  }
  if (priority && PRIORITY_VALUES.includes(priority as BugPriority)) {
    where.priority = priority as BugPriority
  }
  if (search) {
    where.OR = [
      { message: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { user: { name: { contains: search, mode: "insensitive" } } },
    ]
  }

  const bugs = await prisma.bugReport.findMany({
    where,
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

  return NextResponse.json({ bugs })
}
