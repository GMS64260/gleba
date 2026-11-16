/**
 * `GET /api/agroclimat/gel` : gel d'une parcelle de l'exploitation, et états
 * d'attente (historique en préparation, hors métropole).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { CASES_ANNEE, caseDuJour } from "@/lib/agroclimat/calendrier"

const m = vi.hoisted(() => ({ parcelle: vi.fn(), historique: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ default: { parcelleGeo: { findFirst: m.parcelle } } }))
vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: "ferme-synthetique" } } }),
  getUserId: (s: { user: { id: string } }) => s.user.id,
}))
vi.mock("@/lib/agroclimat/historique", () => ({ historiqueDuPoint: m.historique }))
import { GET } from "./route"

const appel = (requete = "") => GET(new NextRequest(`http://localhost/api/agroclimat/gel${requete}`))
const maille = { lambx: 3800, lamby: 18170, lat: 43.3212, lng: -0.3709, distanceKm: 2.4 }

/** Trente années identiques : gel jusqu'au 10 avril, puis à partir du 5 novembre. */
function trenteAns() {
  return Array.from({ length: 30 }, (_, k) => {
    const tmin: (number | null)[] = new Array(CASES_ANNEE).fill(6)
    for (let i = 0; i <= caseDuJour(4, 10); i += 5) tmin[i] = -1
    tmin[caseDuJour(4, 10)] = -1
    tmin[caseDuJour(3, 1)] = -4
    for (let i = caseDuJour(11, 5); i < CASES_ANNEE; i += 5) tmin[i] = -1
    return { annee: 1996 + k, tmin, tmax: tmin.map((t) => (t === null ? null : t + 8)) }
  })
}

beforeEach(() => {
  m.parcelle.mockReset()
  m.historique.mockReset()
  m.parcelle.mockResolvedValue({ id: "p1", nom: "Les Graves", centroidLat: 43.3, centroidLng: -0.37 })
})

describe("GET /api/agroclimat/gel", () => {
  it("rend les dates de gel de la parcelle demandée", async () => {
    m.historique.mockResolvedValue({ etat: "pret", maille, annees: trenteAns(), actualiseLe: new Date("2026-11-14T04:07:00Z") })
    const reponse = await appel("?parcelleId=p1")
    expect(reponse.status).toBe(200)
    expect(reponse.headers.get("Cache-Control")).toBe("private, no-store")
    const gel = await reponse.json()
    expect(gel).toMatchObject({
      etat: "pret",
      parcelle: { id: "p1", nom: "Les Graves", exemple: false },
      distanceMailleKm: 2.4,
      actualiseLe: "2026-11-14",
    })
    expect(gel.gelee.periode).toEqual({ debut: 1996, fin: 2025 })
    expect(gel.gelee.printemps).toMatchObject({ annees: 30, mediane: caseDuJour(4, 10), prudence: caseDuJour(4, 10) })
    expect(gel.gelee.automne).toMatchObject({ mediane: caseDuJour(11, 5) })
    // Forte gelée : seul le 1er mars descend sous −2 °C.
    expect(gel.forteGelee.printemps.mediane).toBe(caseDuJour(3, 1))
    expect(gel.forteGelee.automne.anneesSansGel).toBe(30)
    expect(m.historique).toHaveBeenCalledWith(43.3, -0.37)
  })

  it("ne lit que les parcelles géolocalisées de l'exploitation", async () => {
    m.historique.mockResolvedValue({ etat: "en_preparation", maille })
    await appel("?parcelleId=p1")
    expect(m.parcelle.mock.calls[0][0].where).toEqual({
      userId: "ferme-synthetique",
      centroidLat: { not: null },
      centroidLng: { not: null },
      id: "p1",
    })
  })

  it("prend la plus ancienne parcelle géolocalisée sans parcelle demandée", async () => {
    m.historique.mockResolvedValue({ etat: "en_preparation", maille })
    const gel = await (await appel()).json()
    expect(gel).toEqual({ etat: "en_preparation", parcelle: { id: "p1", nom: "Les Graves", exemple: false } })
    const requete = m.parcelle.mock.calls[0][0]
    expect(requete.where).not.toHaveProperty("id")
    expect(requete.orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }])
  })

  it("annonce l'absence d'historique hors métropole", async () => {
    m.historique.mockResolvedValue({ etat: "hors_couverture" })
    const gel = await (await appel("?parcelleId=p1")).json()
    expect(gel.etat).toBe("hors_couverture")
  })

  it("signale la parcelle d'exemple jamais déplacée", async () => {
    m.parcelle.mockResolvedValue({ id: "p0", nom: "Potager", centroidLat: 48.85675, centroidLng: 2.352 })
    m.historique.mockResolvedValue({ etat: "en_preparation", maille })
    const gel = await (await appel("?parcelleId=p0")).json()
    expect(gel.parcelle.exemple).toBe(true)
  })

  it("répond 404 pour une parcelle inconnue ou d'une autre exploitation", async () => {
    m.parcelle.mockResolvedValue(null)
    const reponse = await appel("?parcelleId=ailleurs")
    expect(reponse.status).toBe(404)
    expect(m.historique).not.toHaveBeenCalled()
  })

  it("rend un état sans localisation quand l'exploitation n'a aucune parcelle placée", async () => {
    m.parcelle.mockResolvedValue(null)
    const reponse = await appel()
    expect(reponse.status).toBe(200)
    expect(await reponse.json()).toEqual({ etat: "sans_localisation" })
  })

  it("refuse un identifiant de parcelle vide", async () => {
    expect((await appel("?parcelleId=")).status).toBe(400)
  })

  it("répond 500 sans détail si la lecture échoue", async () => {
    const journal = vi.spyOn(console, "error").mockImplementation(() => {})
    m.historique.mockRejectedValue(new Error("base injoignable"))
    const reponse = await appel("?parcelleId=p1")
    expect(reponse.status).toBe(500)
    expect(JSON.stringify(await reponse.json())).not.toContain("injoignable")
    journal.mockRestore()
  })
})
