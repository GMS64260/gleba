/**
 * QA cmvgdp9fn — l'écran Planches demande ici, avant de confirmer, le refus
 * que DELETE opposerait : même texte, même lien, aucune suppression.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  delete: vi.fn(),
  cultureGroupBy: vi.fn(),
  interventionGroupBy: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    planche: { findFirst: mocks.findFirst, findUnique: mocks.findUnique, delete: mocks.delete },
    culture: { groupBy: mocks.cultureGroupBy },
    intervention: { groupBy: mocks.interventionGroupBy },
  },
}))

import { GET } from "./route"
import { DELETE } from "../route"

const PLANCHE = { id: "cmvgdh487000u4jmqv2w09fam", nom: "v8-Marc-2010" }
const params = () => ({ params: Promise.resolve({ id: PLANCHE.id }) })
const requete = (method = "GET") =>
  new Request(`http://localhost/api/planches/${PLANCHE.id}/suppression`, { method }) as never

describe("GET /api/planches/[id]/suppression", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
    mocks.findFirst.mockResolvedValue({ id: PLANCHE.id })
    mocks.findUnique.mockResolvedValue({ ...PLANCHE, _count: { fertilisations: 0 } })
    mocks.cultureGroupBy.mockResolvedValue([])
    mocks.interventionGroupBy.mockResolvedValue([])
  })

  it("rend le refus de la route, années et lien compris, sans rien supprimer", async () => {
    mocks.cultureGroupBy.mockResolvedValue([{ plancheId: PLANCHE.id, annee: 2027, _count: { _all: 4 } }])
    mocks.interventionGroupBy.mockResolvedValue([
      {
        plancheId: PLANCHE.id,
        _count: { _all: 2 },
        _min: { date: new Date("2026-10-20T08:00:00Z") },
        _max: { date: new Date("2026-10-20T08:00:00Z") },
      },
    ])

    const res = await GET(requete(), params())

    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.supprimable).toBe(false)
    expect(corps.error).toBe(
      "La planche « v8-Marc-2010 » porte encore 4 cultures (année 2027) et 2 interventions (année 2026) : supprimez ces saisies ou rattachez-les à une autre planche depuis les écrans Cultures et Interventions, puis supprimez la planche."
    )
    expect(corps.lien).toEqual({
      href: `/maraichage/cultures?planche=${PLANCHE.id}&annee=2027`,
      libelle: "Voir les cultures",
    })
    expect(mocks.delete).not.toHaveBeenCalled()

    // Un seul message : DELETE rend exactement le même.
    mocks.findUnique.mockResolvedValue(PLANCHE)
    const refus = await DELETE(requete("DELETE"), params())
    expect(refus.status).toBe(409)
    const corpsDelete = await refus.json()
    expect(corpsDelete.error).toBe(corps.error)
    expect(corpsDelete.lien).toEqual(corps.lien)
  })

  it("annonce les fertilisations importées d'une planche supprimable", async () => {
    mocks.findUnique.mockResolvedValue({ ...PLANCHE, _count: { fertilisations: 3 } })

    const res = await GET(requete(), params())

    expect(await res.json()).toEqual({ supprimable: true, fertilisations: 3 })
  })

  it("répond 404 sur une planche d'un autre compte", async () => {
    mocks.findFirst.mockResolvedValue(null)

    const res = await GET(requete(), params())

    expect(res.status).toBe(404)
    expect(mocks.cultureGroupBy).not.toHaveBeenCalled()
  })
})
