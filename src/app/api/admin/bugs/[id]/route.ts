import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { z } from "zod"
import type { BugStatus, BugPriority, Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

const patchSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  adminNote: z.string().max(2000).nullable().optional(),
  statusNote: z.string().max(500).optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAdminApi(request)
  if (error) return error

  const { id } = await params

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    )
  }

  const { status, priority, adminNote, statusNote } = parsed.data

  const existing = await prisma.bugReport.findUnique({
    where: { id },
    select: { status: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Bug introuvable" }, { status: 404 })
  }

  const data: Prisma.BugReportUpdateInput = {}
  if (status) {
    data.status = status as BugStatus
    if (status === "RESOLVED") data.resolvedAt = new Date()
    else data.resolvedAt = null
  }
  if (priority) data.priority = priority as BugPriority
  if (adminNote !== undefined) data.adminNote = adminNote

  const updated = await prisma.bugReport.update({
    where: { id },
    data,
    include: {
      user: { select: { id: true, email: true, name: true } },
      statusLogs: {
        include: { changedBy: { select: { email: true, name: true } } },
        orderBy: { changedAt: "desc" },
      },
    },
  })

  if (status && status !== existing.status) {
    await prisma.bugStatusLog.create({
      data: {
        bugReportId: id,
        fromStatus: existing.status,
        toStatus: status as BugStatus,
        changedById: session!.user.id,
        note: statusNote ?? null,
      },
    })
  }

  return NextResponse.json({ bug: updated })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminApi(request)
  if (error) return error

  const { id } = await params

  try {
    await prisma.bugReport.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Bug introuvable" }, { status: 404 })
  }
}
