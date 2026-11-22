import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const m = vi.hoisted(() => ({ auth: vi.fn(), findMany: vi.fn() }))
vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: m.auth }))
vi.mock("@/lib/prisma", () => ({ default: { arbre: { findMany: m.findMany } } }))

import { GET } from "./route"

const appeler = (requete: string) => GET(new NextRequest(`http://localhost/api/verger/etiquettes-planche${requete}`))

beforeEach(() => {
  vi.clearAllMocks()
  m.auth.mockResolvedValue({ error: null, session: { user: { id: "ferme-test" } } })
  m.findMany.mockResolvedValue([])
})

// FB-AJYAIU : une liste vide ou illisible retombait sur « tous les arbres ».
describe("planche d'étiquettes du verger : liste d'arbres demandée", () => {
  it.each(["?ids=", "?ids=abc,,", "?ids=,"])("refuse %s sans rien lire en base", async (requete) => {
    const reponse = await appeler(requete)
    expect(reponse.status).toBe(400)
    expect(await reponse.json()).toMatchObject({ champ: "ids" })
    expect(m.findMany).not.toHaveBeenCalled()
  })

  it("refuse plus de 60 arbres au lieu de tronquer la planche", async () => {
    const reponse = await appeler(`?ids=${Array.from({ length: 61 }, (_, i) => i + 1).join(",")}`)
    expect(reponse.status).toBe(400)
    expect(m.findMany).not.toHaveBeenCalled()
  })

  it("ne lit que les arbres demandés, dans le compte de la session", async () => {
    await appeler("?ids=71,72")
    expect(m.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "ferme-test", id: { in: [71, 72] } },
    }))
  })
})
