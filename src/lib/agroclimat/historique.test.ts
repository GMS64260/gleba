import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const db = vi.hoisted(() => ({
  climatMaille: { findUnique: vi.fn(), createMany: vi.fn(), upsert: vi.fn() },
  climatMailleAnnee: { findMany: vi.fn() },
  parcelleGeo: { findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
}))
vi.mock("@/lib/prisma", () => ({ default: db }))
vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: "ferme-synthetique" } } }),
  getUserId: (session: { user: { id: string } }) => session.user.id,
}))
vi.mock("@/lib/exploitation/garde-session", () => ({ refusSiLectureSeule: () => null }))
vi.mock("@/lib/terroir", async (original) => ({
  ...await original<typeof import("@/lib/terroir")>(),
  terroirDeUser: async () => ({ zoneClimat: "oceanique" }),
}))

import { historiqueDuPoint } from "./historique"
import { GET as gel } from "@/app/api/agroclimat/gel/route"
import { GET as calendrier } from "@/app/api/calendrier-climat/route"

const point = [43.3, -0.37] as const
const parcelle = { id: "parcelle-synthetique", nom: "Parcelle test", centroidLat: point[0], centroidLng: point[1] }

/** Les deux SELECT ont répondu « absent » avant qu'une insertion soit possible. */
function lecturesAbsentes(nombre: number) {
  let lectures = 0
  let liberer!: () => void
  const barriere = new Promise<void>((resolve) => { liberer = resolve })
  db.climatMaille.findUnique.mockImplementation(async () => {
    if (++lectures === nombre) liberer()
    await barriere
    return null
  })
  // Modèle du conflit : un upsert Prisma avec update vide lit puis insère.
  // Les lectures internes se croisent avant l'insertion de la seconde demande.
  let inseree = false
  db.climatMaille.upsert.mockImplementation(async () => {
    await Promise.resolve()
    if (inseree) throw Object.assign(new Error("Doublon de maille"), { code: "P2002" })
    inseree = true
    return { id: 1 }
  })
  db.climatMaille.createMany.mockImplementation(async () => {
    const count = inseree ? 0 : 1
    inseree = true
    return { count }
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("GLEBA_AGROCLIMAT_IMPORT", "false")
  db.parcelleGeo.findFirst.mockResolvedValue(parcelle)
  db.user.findUnique.mockResolvedValue({ zoneClimat: null })
  db.climatMailleAnnee.findMany.mockResolvedValue([{ annee: 2025, tmin: [-10, -9999], tmax: [120, -9999] }])
})
afterEach(() => { vi.unstubAllEnvs() })

describe("historique partagé du gel", () => {
  it("accepte deux premières lectures ayant toutes deux trouvé la maille absente", async () => {
    lecturesAbsentes(2)
    const resultats = await Promise.all([historiqueDuPoint(...point), historiqueDuPoint(...point)])
    expect(resultats.map((r) => r.etat)).toEqual(["en_preparation", "en_preparation"])
    expect(db.climatMaille.createMany).toHaveBeenCalledTimes(2)
    expect(db.climatMaille.createMany).toHaveBeenCalledWith({
      data: [{ lambx: 3800, lamby: 18170, etat: "demandee" }], skipDuplicates: true,
    })
  })

  it.each([
    ["demandee", "en_preparation"], ["prete", "pret"], ["echec", "indisponible"],
  ])("relit une maille %s ancienne sans toucher son état, son bail ou ses années", async (etat, attendu) => {
    db.climatMaille.findUnique.mockResolvedValue({ id: 17, etat, actualiseeLe: null })
    const resultat = await historiqueDuPoint(...point)
    expect(resultat.etat).toBe(attendu)
    if (resultat.etat === "pret") {
      expect(resultat.actualiseLe).toBeNull()
      expect(resultat.annees).toEqual([{ annee: 2025, tmin: [-1, null], tmax: [12, null] }])
      expect(db.climatMailleAnnee.findMany).toHaveBeenCalledWith({
        where: { mailleId: 17 }, orderBy: { annee: "asc" }, select: { annee: true, tmin: true, tmax: true },
      })
    } else expect(db.climatMailleAnnee.findMany).not.toHaveBeenCalled()
    expect(db.climatMaille.createMany).not.toHaveBeenCalled()
    expect(db.climatMaille.upsert).not.toHaveBeenCalled()
  })

  it("ne demande aucune maille hors couverture", async () => {
    expect(await historiqueDuPoint(-22.27, 166.45)).toEqual({ etat: "hors_couverture" })
    expect(db.climatMaille.findUnique).not.toHaveBeenCalled()
    expect(db.climatMaille.createMany).not.toHaveBeenCalled()
  })

  it("propage une erreur d'insertion autre que le doublon", async () => {
    db.climatMaille.findUnique.mockResolvedValue(null)
    const erreur = Object.assign(new Error("Connexion perdue"), { code: "P1001" })
    db.climatMaille.createMany.mockRejectedValue(erreur)
    db.climatMaille.upsert.mockRejectedValue(erreur)
    await expect(historiqueDuPoint(...point)).rejects.toBe(erreur)
  })

  it("sert deux GET gel et le calendrier simultanés via le vrai helper initial", async () => {
    lecturesAbsentes(3)
    const requete = () => new NextRequest("http://localhost/api/agroclimat/gel?parcelleId=parcelle-synthetique")
    const reponses = await Promise.all([gel(requete()), gel(requete()), calendrier()])
    expect(reponses.map((r) => r.status)).toEqual([200, 200, 200])
    for (const reponse of reponses.slice(0, 2)) {
      expect(await reponse.json()).toEqual({ etat: "en_preparation", parcelle: { id: parcelle.id, nom: parcelle.nom, exemple: false } })
      expect(reponse.headers.get("Cache-Control")).toBe("private, no-store")
    }
    expect(await reponses[2].json()).toMatchObject({ geleesMesurees: null, zone: "oceanique", source: "auto" })
    expect(db.parcelleGeo.findFirst.mock.calls.map(([appel]) => appel.where.userId)).toEqual(Array(3).fill("ferme-synthetique"))
    expect(db.climatMaille.createMany).toHaveBeenCalledTimes(3)
  })

  it("sert une ancienne maille prête aux deux routes avec actualiseeLe null", async () => {
    db.climatMaille.findUnique.mockResolvedValue({ id: 17, etat: "prete", actualiseeLe: null })
    db.climatMailleAnnee.findMany.mockResolvedValue([{ annee: 2025, tmin: Array(366).fill(-10), tmax: Array(366).fill(120) }])
    const [reponseGel, reponseCalendrier] = await Promise.all([
      gel(new NextRequest("http://localhost/api/agroclimat/gel")), calendrier(),
    ])
    expect(reponseGel.status).toBe(200)
    expect(await reponseGel.json()).toMatchObject({ etat: "pret", actualiseLe: null, gelee: { printemps: { annees: 1 } } })
    expect(reponseCalendrier.status).toBe(200)
    expect(await reponseCalendrier.json()).toMatchObject({ geleesMesurees: { parcelle: parcelle.nom, annees: 1 } })
    expect(db.climatMaille.createMany).not.toHaveBeenCalled()
  })
})
