/**
 * Salon de discussion de la page Communauté — accès et écriture.
 *
 * Règle demandée (2026-10-25) : réservé aux utilisateurs authentifiés, HORS
 * compte de démonstration. L'anonyme est arrêté en 401 par le middleware ; ces
 * tests prouvent le reste au niveau de la route : la démo ne lit ni n'écrit, un
 * membre invité parle en son nom (acteur) et non au nom de l'exploitation.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  userFindUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: mocks.userFindUnique },
    messageSalon: { findMany: mocks.findMany, create: mocks.create },
  },
}))

import { GET, POST } from "./route"

// Le plafond par personne vit en mémoire pour tout le fichier : chaque test
// prend un acteur neuf pour ne pas hériter du compteur d'un autre.
let numero = 0
let acteur = ""

function connecter(options: { role?: string; acteurId?: string; tenant?: string } = {}) {
  acteur = options.acteurId ?? `acteur-${++numero}`
  mocks.requireAuthApi.mockResolvedValue({
    error: null,
    session: {
      user: { id: options.tenant ?? acteur, acteurId: acteur, role: options.role ?? "USER" },
    },
  })
}

function ligne(id: string, iso: string, auteur: { id: string; name: string | null; role?: string }) {
  return {
    id,
    contenu: `message ${id}`,
    createdAt: new Date(iso),
    userId: auteur.id,
    user: { name: auteur.name, role: auteur.role ?? "USER" },
  }
}

function requeteGet(query = "") {
  return new Request(`http://localhost/api/communaute/salon${query}`)
}

function requetePost(body: unknown) {
  return new Request("http://localhost/api/communaute/salon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.userFindUnique.mockResolvedValue({ email: "membre@exemple.fr" })
  mocks.findMany.mockResolvedValue([])
  mocks.create.mockImplementation(({ data }: { data: { userId: string; contenu: string } }) =>
    Promise.resolve({
      id: "nouveau",
      contenu: data.contenu,
      createdAt: new Date("2026-10-25T10:00:00.000Z"),
      userId: data.userId,
      user: { name: "Camille", role: "USER" },
    })
  )
  connecter()
})

describe("compte de démonstration", () => {
  it("ne lit pas le salon : 403 COMPTE_DEMO, aucune lecture des messages", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: " Demo@Gleba.FR " })

    const res = await GET(requeteGet())

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.code).toBe("COMPTE_DEMO")
    expect(json.error).toContain("salon de discussion est réservé aux comptes personnels")
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it("n'écrit pas dans le salon", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: "demo@gleba.fr" })

    const res = await POST(requetePost({ contenu: "Bonjour" }))

    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe("COMPTE_DEMO")
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it("lit l'identité en base par l'id de la PERSONNE connectée", async () => {
    connecter({ tenant: "exploitation-1", acteurId: "personne-1" })

    await GET(requeteGet())

    expect(mocks.userFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "personne-1" } })
    )
  })
})

describe("GET /api/communaute/salon", () => {
  it("rend la fenêtre dans l'ordre chronologique, avec auteur et droits", async () => {
    connecter({ acteurId: "moi" })
    // La base rend du plus récent au plus ancien.
    mocks.findMany.mockResolvedValue([
      ligne("m3", "2026-10-25T09:02:00.000Z", { id: "moi", name: "Camille" }),
      ligne("m2", "2026-10-25T09:01:00.000Z", { id: "equipe", name: "Gleba", role: "ADMIN" }),
      ligne("m1", "2026-10-25T09:00:00.000Z", { id: "autre", name: "  " }),
    ])

    const res = await GET(requeteGet())

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.plusAnciens).toBe(false)
    expect(json.messages.map((m: { id: string }) => m.id)).toEqual(["m1", "m2", "m3"])
    expect(json.messages[0]).toEqual({
      id: "m1",
      contenu: "message m1",
      createdAt: "2026-10-25T09:00:00.000Z",
      auteur: { nom: "Membre de Gleba", estMoi: false, equipe: false },
      supprimable: false,
    })
    expect(json.messages[1].auteur).toEqual({ nom: "Gleba", estMoi: false, equipe: true })
    expect(json.messages[2]).toMatchObject({ auteur: { estMoi: true }, supprimable: true })
  })

  it("ne lit jamais l'adresse e-mail des auteurs", async () => {
    await GET(requeteGet())

    const args = mocks.findMany.mock.calls[0][0]
    expect(args.select.user).toEqual({ select: { name: true, role: true } })
  })

  it("signale l'historique au-delà de la page", async () => {
    mocks.findMany.mockResolvedValue(
      Array.from({ length: 51 }, (_, i) =>
        ligne(`m${i}`, new Date(Date.UTC(2026, 9, 25, 9, 0, 59 - i)).toISOString(), { id: "x", name: "X" })
      )
    )

    const json = await (await GET(requeteGet())).json()

    expect(mocks.findMany.mock.calls[0][0].take).toBe(51)
    expect(json.messages).toHaveLength(50)
    expect(json.plusAnciens).toBe(true)
  })

  it("un administrateur peut retirer le message d'un autre", async () => {
    connecter({ role: "ADMIN" })
    mocks.findMany.mockResolvedValue([ligne("m1", "2026-10-25T09:00:00.000Z", { id: "autre", name: "Lou" })])

    const json = await (await GET(requeteGet())).json()

    expect(json.messages[0].supprimable).toBe(true)
  })

  it("pagine l'historique par un curseur date + id", async () => {
    await GET(requeteGet("?avantLe=2026-10-25T09:00:00.000Z&avantId=m1"))

    const date = new Date("2026-10-25T09:00:00.000Z")
    expect(mocks.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ createdAt: { lt: date } }, { createdAt: date, id: { lt: "m1" } }],
    })
  })

  it("refuse un curseur incomplet ou invalide", async () => {
    for (const query of ["?avantLe=hier&avantId=m1", "?avantLe=2026-10-25T09:00:00.000Z", "?avantId=m1"]) {
      const res = await GET(requeteGet(query))
      expect(res.status).toBe(400)
    }
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it("n'use pas le plafond par IP commun à toute l'application", async () => {
    await GET(requeteGet())

    // Sans la requête, `requireAuthApi` ne compte pas l'interrogation dans les
    // 100 requêtes / 15 min par IP partagées par tous les écrans.
    expect(mocks.requireAuthApi).toHaveBeenCalledWith()
  })

  it("plafonne les lectures par personne", async () => {
    for (let i = 0; i < 60; i++) {
      expect((await GET(requeteGet())).status).toBe(200)
    }
    expect((await GET(requeteGet())).status).toBe(429)
  })
})

describe("POST /api/communaute/salon", () => {
  it("publie au nom de la personne, pas de l'exploitation", async () => {
    connecter({ tenant: "exploitation-1", acteurId: "membre-invite" })

    const res = await POST(requetePost({ contenu: "  Qui a des plants de tomates ?  " }))

    expect(res.status).toBe(201)
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: "membre-invite", contenu: "Qui a des plants de tomates ?" },
      })
    )
    const json = await res.json()
    expect(json.message).toMatchObject({ id: "nouveau", auteur: { nom: "Camille", estMoi: true }, supprimable: true })
  })

  it("resserre les lignes vides en rafale", async () => {
    await POST(requetePost({ contenu: "a\r\n\r\n\r\n\r\nb\n\n\n\nc" }))

    expect(mocks.create.mock.calls[0][0].data.contenu).toBe("a\n\nb\n\nc")
  })

  it("refuse un message vide ou trop long", async () => {
    for (const contenu of ["", "   \n  ", "x".repeat(1001)]) {
      const res = await POST(requetePost({ contenu }))
      expect(res.status).toBe(400)
    }
    expect((await (await POST(requetePost({}))).json()).error).toBeTruthy()
    expect((await POST(requetePost("{pas du json"))).status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it("accepte exactement 1000 caractères", async () => {
    expect((await POST(requetePost({ contenu: "x".repeat(1000) }))).status).toBe(201)
  })

  it("arrête une rafale au-delà de 10 messages par minute", async () => {
    for (let i = 0; i < 10; i++) {
      expect((await POST(requetePost({ contenu: `message ${i}` }))).status).toBe(201)
    }

    const res = await POST(requetePost({ contenu: "un de trop" }))

    expect(res.status).toBe(429)
    expect((await res.json()).error).toContain("patientez une minute")
    expect(mocks.create).toHaveBeenCalledTimes(10)
  })

  it("un envoi refusé pour sa forme ne consomme pas le quota", async () => {
    for (let i = 0; i < 12; i++) await POST(requetePost({ contenu: "" }))

    expect((await POST(requetePost({ contenu: "enfin" }))).status).toBe(201)
  })
})
