import { beforeEach, describe, expect, it, vi } from "vitest"

// « Résolu sans mail » (2026-10-30) : FB-8CXUUN avait été résolu en base à la
// main parce que l'écran d'administration écrivait toujours à l'auteur, déjà
// remercié par un mail personnel.
const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  logCreate: vi.fn(),
  sendMail: vi.fn(),
}))
vi.mock("@/lib/auth-utils", () => ({
  requireAdminApi: async () => ({ error: null, session: { user: { id: "admin-1" } } }),
}))
vi.mock("@/lib/prisma", () => ({
  default: {
    bugReport: { findUnique: m.findUnique, update: m.update },
    bugStatusLog: { create: m.logCreate },
  },
}))
vi.mock("@/lib/mail", () => ({
  feedbackResolvedEmail: () => ({ subject: "Résolu", html: "<p>Résolu</p>" }),
  sendMail: m.sendMail,
}))

const { PATCH } = await import("./route")

function patcher(corps: object) {
  return PATCH(
    new Request("http://localhost/api/admin/bugs/b1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corps),
    }),
    { params: Promise.resolve({ id: "b1" }) },
  )
}

describe("PATCH /api/admin/bugs/[id] : mail de résolution", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.findUnique.mockResolvedValue({ status: "OPEN", user: { email: "auteur@example.org", name: "Auteur" }, statusLogs: [] })
    m.update.mockResolvedValue({ id: "b1", status: "RESOLVED", statusLogs: [] })
  })

  it("Résolu prévient l'auteur une fois", async () => {
    expect((await patcher({ status: "RESOLVED" })).status).toBe(200)
    expect(m.sendMail).toHaveBeenCalledTimes(1)
    expect(m.logCreate.mock.calls[0][0].data).toMatchObject({ fromStatus: "OPEN", toStatus: "RESOLVED", note: null })
  })

  it("Résolu sans mail résout et journalise sans écrire à l'auteur", async () => {
    expect((await patcher({ status: "RESOLVED", notifier: false })).status).toBe(200)
    expect(m.update.mock.calls[0][0].data).toMatchObject({ status: "RESOLVED", resolvedAt: expect.any(Date) })
    expect(m.logCreate.mock.calls[0][0].data).toMatchObject({
      fromStatus: "OPEN", toStatus: "RESOLVED", changedById: "admin-1", note: "Résolu sans mail à l'auteur.",
    })
    expect(m.sendMail).not.toHaveBeenCalled()
  })

  it("refuse une option sans mail mal typée", async () => {
    expect((await patcher({ status: "RESOLVED", notifier: "non" })).status).toBe(400)
    expect(m.update).not.toHaveBeenCalled()
    expect(m.sendMail).not.toHaveBeenCalled()
  })
})
