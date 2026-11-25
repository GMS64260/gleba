import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * QA cmv2r19al (2026-10-10) : la règle « pas de récolte avant la plantation »
 * vaut aussi en modification. Corps rejoué : celui de la fiche récolte
 * (`/maraichage/recoltes/[id]`), qui renvoie date, quantité et notes.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  recolteFindUnique: vi.fn(),
  recolteUpdate: vi.fn(),
  cultureFindUnique: vi.fn(),
  recolteCreate: vi.fn(),
  recolteFindMany: vi.fn<(requete: unknown) => Promise<Array<{ id: number }>>>(async () => []),
  recolteUpdateMany: vi.fn<(requete: unknown) => Promise<{ count: number }>>(async () => ({ count: 0 })),
  recolteDelete: vi.fn<(requete: unknown) => Promise<object>>(async () => ({})),
  creerFacture: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: vi.fn() }))
vi.mock("@/lib/auto-compta", () => ({ createVenteFromRecolte: vi.fn(), deleteAutoEntry: vi.fn() }))
vi.mock("@/lib/facture-utils", () => ({ creerFacture: mocks.creerFacture, annulerFactureLiee: vi.fn() }))
vi.mock("@/lib/prisma", () => {
  const tx = {
    caisseLot: { findMany: async () => [] },
    caisseAffectation: { findMany: vi.fn().mockResolvedValue([]) },
    // Recalage de la récolte faite après redatation (contre-revue adverse 2) :
    // ces cultures ne sont pas en « récolte faite », rien n'est recalé.
    culture: { findUnique: mocks.cultureFindUnique, findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
    recolte: {
      findFirst: mocks.recolteFindUnique, update: mocks.recolteUpdate, create: mocks.recolteCreate,
      findMany: mocks.recolteFindMany, updateMany: mocks.recolteUpdateMany, delete: mocks.recolteDelete,
    },
    venteManuelle: { findFirst: vi.fn().mockResolvedValue(null) },
    produitBoutique: { count: vi.fn().mockResolvedValue(0) },
    // Verdict DAR de la mise en vente : aucun traitement sur ce lot.
    intervention: { findMany: vi.fn().mockResolvedValue([]) },
    planche: { findFirst: vi.fn().mockResolvedValue(null) },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(1),
  }
  return {
    default: {
      recolte: { findUnique: mocks.recolteFindUnique },
      culture: { findUnique: mocks.cultureFindUnique },
      produitBoutique: { findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0) },
      $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
    },
  }
})

import { DELETE, PATCH, PUT } from "./route"

// Horloge figée après les dates du jeu d'essai : une récolte ne se date pas
// dans le futur, et ces scénarios datent leurs récoltes jusqu'en janvier 2027.
beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2027-03-01T10:00:00.000Z')) })
afterAll(() => { vi.useRealTimers() })

// Le fuseau est fixé au démarrage de Vitest (Paris et UTC dans les contrôles).

const RECOLTE = {
  id: 1150,
  userId: "u1",
  cultureId: 1174,
  especeId: "Zinnia",
  date: new Date("2027-01-20T12:00:00.000Z"),
  quantite: 25,
}

const ZINNIA = {
  id: 1174,
  especeId: "Zinnia",
  dateSemis: new Date("2026-10-09T22:00:00.000Z"),
  datePlantation: new Date("2026-11-20T23:00:00.000Z"),
  semisFait: false,
  plantationFaite: false,
}

const modifier = (body: Record<string, unknown>) =>
  PUT(
    new Request("http://localhost/api/recoltes/1150", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id: "1150" }) }
  )

describe("PUT /api/recoltes/[id] — date de récolte et cycle de la culture", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
    mocks.recolteFindUnique.mockResolvedValue(RECOLTE)
    mocks.cultureFindUnique.mockResolvedValue(ZINNIA)
    mocks.recolteUpdate.mockImplementation(async ({ data }) => ({ ...RECOLTE, ...data }))
  })

  it("refuse de redater une récolte avant la plantation", async () => {
    const res = await modifier({ date: new Date("2026-10-10T00:00:00.000Z").toISOString(), quantite: 25, notes: null })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("Une récolte ne peut pas précéder la plantation.")
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
  })

  it("accepte une nouvelle date postérieure à la plantation", async () => {
    const res = await modifier({ date: new Date("2027-01-24T00:00:00.000Z").toISOString(), quantite: 25, notes: null })
    expect(res.status).toBe(200)
    expect(mocks.recolteUpdate.mock.calls[0][0].data.date).toEqual(new Date("2027-01-24T00:00:00.000Z"))
  })

  it("date inchangée : la retouche de la quantité ne relit pas la culture", async () => {
    // Corps réel de la fiche : la date affichée (20/01) repart à minuit UTC.
    const res = await modifier({ date: "2027-01-20T00:00:00.000Z", quantite: 30, notes: null })
    expect(res.status).toBe(200)
    expect(mocks.cultureFindUnique).not.toHaveBeenCalled()
  })

  it("sans date dans le corps, la récolte n'est pas redatée du jour", async () => {
    const res = await modifier({ quantite: 30 })
    expect(res.status).toBe(200)
    expect(mocks.recolteUpdate.mock.calls[0][0].data).not.toHaveProperty("date")
  })

  it("refuse le rattachement à une culture d'une autre espèce", async () => {
    mocks.cultureFindUnique.mockResolvedValue({ ...ZINNIA, id: 1180, especeId: "Tomate" })
    const res = await modifier({ cultureId: 1180, quantite: 25 })
    expect(res.status).toBe(400)
    expect((await res.json()).champ).toBe("especeId")
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
  })

  it("refuse le rattachement à une culture hors du compte", async () => {
    mocks.cultureFindUnique.mockResolvedValue(null)
    const res = await modifier({ cultureId: 999, quantite: 25 })
    expect(res.status).toBe(400)
    expect(mocks.cultureFindUnique.mock.calls[0][0].where).toEqual({ id: 999, userId: "u1" })
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
  })

  // 2026-10-20 — la fiche affiche désormais « Quantité (tiges) » : la quantité
  // retouchée reste dans l'unité figée à la saisie, que le PUT ne réécrit pas.
  it("conserve l'unité figée de la récolte (corps de la fiche, unité forgée ignorée)", async () => {
    mocks.recolteFindUnique.mockResolvedValue({ ...RECOLTE, unite: "tige" })
    mocks.recolteUpdate.mockImplementation(async ({ data }) => ({ ...RECOLTE, unite: "tige", ...data }))

    const res = await modifier({ date: "2027-01-20T00:00:00.000Z", quantite: 19, notes: null })
    expect(res.status).toBe(200)
    expect(mocks.recolteUpdate.mock.calls[0][0].data).not.toHaveProperty("unite")
    expect((await res.json()).unite).toBe("tige")

    const forge = await modifier({ date: "2027-01-20T00:00:00.000Z", quantite: 19, notes: null, unite: "kg" })
    expect(forge.status).toBe(200)
    expect(mocks.recolteUpdate.mock.calls[1][0].data).not.toHaveProperty("unite")
  })
})

// MAR-04 (revue Codex du 2026-11-12) : redater une récolte, ou la rattacher à
// une autre culture, recalcule son statut bio comme à la création (planche de
// la culture, à la nouvelle date). Le PUT gardait le statut d'origine.
// Défaut D52 de l'équipe debug : la fiche n'envoie que la date, la péremption
// du lot n'était jamais relue.
describe("PUT /api/recoltes/[id] — la péremption ne précède pas la récolte", () => {
  const PERISSABLE = { ...RECOLTE, datePeremption: new Date("2027-01-21T00:00:00.000Z") }
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
    mocks.recolteFindUnique.mockResolvedValue(PERISSABLE)
    mocks.cultureFindUnique.mockResolvedValue(ZINNIA)
    mocks.recolteUpdate.mockImplementation(async ({ data }) => ({ ...PERISSABLE, ...data }))
  })

  it("refuse de redater la récolte après la péremption du lot", async () => {
    const res = await modifier({ date: "2027-01-22T00:00:00.000Z", quantite: 25, notes: null })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ champ: "date", error: expect.stringContaining("La péremption (21/01/2027) précède la récolte (22/01/2027)") })
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
  })

  it("accepte une récolte redatée au jour de la péremption", async () => {
    expect((await modifier({ date: "2027-01-21T00:00:00.000Z", quantite: 25, notes: null })).status).toBe(200)
  })

  it("refuse une péremption ramenée avant la récolte", async () => {
    const res = await modifier({ datePeremption: "2027-01-19T00:00:00.000Z" })
    expect(res.status).toBe(400)
    expect((await res.json()).champ).toBe("datePeremption")
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
  })

  it("laisse corriger la quantité d'un ancien lot déjà incohérent", async () => {
    mocks.recolteFindUnique.mockResolvedValue({ ...RECOLTE, datePeremption: new Date("2027-01-10T00:00:00.000Z") })
    expect((await modifier({ date: "2027-01-20T00:00:00.000Z", quantite: 30, notes: null })).status).toBe(200)
  })
})

describe("PUT /api/recoltes/[id] — statut bio recalculé quand l'origine change", () => {
  const RECOLTE_AB = { ...RECOLTE, date: new Date(2026, 10, 12, 0, 30), statutBioSnapshot: "AB" }
  // Planche en conversion depuis le 2023-11-12 (minuit local).
  const PLANCHE_C1 = { statutBio: "C1", dateDebutConversion: new Date(2023, 10, 12) }
  const CULTURE_BIO = { ...ZINNIA, dateSemis: new Date("2025-03-01T00:00:00.000Z"), datePlantation: null, planche: PLANCHE_C1 }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
    mocks.recolteFindUnique.mockResolvedValue(RECOLTE_AB)
    mocks.cultureFindUnique.mockResolvedValue(CULTURE_BIO)
    mocks.recolteUpdate.mockImplementation(async ({ data }) => ({ ...RECOLTE_AB, ...data }))
  })

  it("redatée du 2026-11-12 au 2025-11-12 : C3, comme à la création", async () => {
    const res = await modifier({ date: new Date(2025, 10, 12).toISOString() })
    expect(res.status).toBe(200)
    expect(mocks.recolteUpdate.mock.calls[0][0].data.statutBioSnapshot).toBe("C3")
    // Lecture faite après le verrou, scopée au compte.
    expect(mocks.cultureFindUnique.mock.calls[0][0].where).toEqual({ id: RECOLTE.cultureId, userId: "u1" })
  })

  it("rattachée à une culture sur planche conventionnelle : Conventionnel", async () => {
    mocks.cultureFindUnique.mockResolvedValue({ ...CULTURE_BIO, id: 1190, planche: { statutBio: "Conventionnel", dateDebutConversion: null } })
    const res = await modifier({ cultureId: 1190 })
    expect(res.status).toBe(200)
    expect(mocks.recolteUpdate.mock.calls[0][0].data.statutBioSnapshot).toBe("Conventionnel")
  })

  it("culture sans planche : plus de statut bio (comme à la création)", async () => {
    mocks.cultureFindUnique.mockResolvedValue({ ...CULTURE_BIO, id: 1191, planche: null })
    const res = await modifier({ cultureId: 1191 })
    expect(res.status).toBe(200)
    expect(mocks.recolteUpdate.mock.calls[0][0].data.statutBioSnapshot).toBeNull()
  })

  it("même jour civil, autre heure : le statut figé n'est pas touché", async () => {
    const res = await modifier({ date: "2026-11-12T00:00:00.000Z", quantite: 30 })
    expect(res.status).toBe(200)
    expect(mocks.recolteUpdate.mock.calls[0][0].data).not.toHaveProperty("statutBioSnapshot")
  })

  it("retouche de la quantité seule : le statut figé n'est pas touché", async () => {
    const res = await modifier({ quantite: 30 })
    expect(res.status).toBe(200)
    expect(mocks.recolteUpdate.mock.calls[0][0].data).not.toHaveProperty("statutBioSnapshot")
  })

  it("un statut forgé dans le corps est ignoré", async () => {
    const res = await modifier({ quantite: 30, statutBioSnapshot: "AB" })
    expect(res.status).toBe(200)
    expect(mocks.recolteUpdate.mock.calls[0][0].data).not.toHaveProperty("statutBioSnapshot")
  })
})

describe("PATCH /api/recoltes/[id] — vente d'une récolte comptée en tiges (QA cmv2r1oao)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ session: { user: { id: "u1" } } })
    mocks.recolteFindUnique.mockResolvedValue({
      ...RECOLTE,
      quantite: 5,
      unite: "tige",
      statut: "en_stock",
      factureId: null,
      espece: { id: "Zinnia", nom: "Zinnia" },
      culture: { variete: null },
    })
    mocks.recolteUpdate.mockResolvedValue({ id: 1150 })
    mocks.creerFacture.mockResolvedValue({ id: 77 })
  })

  it("facture des tiges, pas des kilos", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/recoltes/1150", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statut: "vendu",
          dateVente: "2026-10-11T08:00:00.000Z",
          prixKg: 1.2,
          prixTotal: 6,
          quantiteVendue: 5,
          clientId: null,
          clientNom: "Marché",
          creerFacture: true,
        }),
      }) as never,
      { params: Promise.resolve({ id: "1150" }) }
    )
    expect(res.status).toBe(200)
    const ligne = mocks.creerFacture.mock.calls[0][1].lignes[0]
    expect(ligne).toMatchObject({ quantite: 5, unite: "tige" })
  })

  it("refuse une fraction de tige", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/recoltes/1150", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statut: "vendu",
          dateVente: "2026-10-11T08:00:00.000Z",
          prixKg: 1.2,
          prixTotal: 3,
          quantiteVendue: 2.5,
          clientNom: "Marché",
          creerFacture: false,
        }),
      }) as never,
      { params: Promise.resolve({ id: "1150" }) }
    )
    expect(res.status).toBe(400)
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
  })
})

// Modèle de stock unique, lot 1 (2026-11-24) : une perte, une consommation
// personnelle ou un don sort d'un lot en tout ou partie, à son jour. La partie
// sortie garde la ligne, le reste redevient un lot en stock.
describe("PATCH /api/recoltes/[id] — sortie hors vente, partielle et datée", () => {
  const LOT = {
    ...RECOLTE,
    quantite: 10,
    unite: "kg",
    statut: "en_stock",
    factureId: null,
    datePeremption: null,
    statutBioSnapshot: "AB",
    espece: { id: "Zinnia", nom: "Zinnia" },
    culture: { variete: null },
  }
  const sortir = (body: Record<string, unknown>) =>
    PATCH(
      new Request("http://localhost/api/recoltes/1150", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }) as never,
      { params: Promise.resolve({ id: "1150" }) },
    )

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ session: { user: { id: "u1" } } })
    mocks.recolteFindUnique.mockResolvedValue(LOT)
    mocks.recolteUpdate.mockResolvedValue({ id: 1150 })
  })

  it("don de 3 kg sur 10 : 3 kg sortent à leur jour, 7 kg restent en stock", async () => {
    const res = await sortir({ statut: "don", quantiteSortie: 3, dateSortie: "2027-02-10" })
    expect(res.status).toBe(200)
    expect(mocks.recolteUpdate.mock.calls[0][0].data).toMatchObject({
      statut: "don", quantite: 3, dateSortie: new Date("2027-02-10T00:00:00.000Z"),
    })
    expect(mocks.recolteCreate.mock.calls[0][0].data).toMatchObject({
      userId: "u1", especeId: "Zinnia", cultureId: 1174, date: LOT.date, quantite: 7, unite: "kg",
      statut: "en_stock", statutBioSnapshot: "AB",
      // Lignée : le reliquat est une part de la récolte saisie.
      recolteOrigineId: 1150,
    })
  })

  it("le reliquat d'une part pointe la récolte saisie, pas la part", async () => {
    mocks.recolteFindUnique.mockResolvedValue({ ...LOT, recolteOrigineId: 900 })
    expect((await sortir({ statut: "perte", quantiteSortie: 2, dateSortie: "2027-02-10" })).status).toBe(200)
    expect(mocks.recolteCreate.mock.calls[0][0].data.recolteOrigineId).toBe(900)
  })

  it("sans quantité : le lot entier sort, sans reliquat, daté du jour", async () => {
    const res = await sortir({ statut: "perte" })
    expect(res.status).toBe(200)
    const data = mocks.recolteUpdate.mock.calls[0][0].data
    expect(data).toMatchObject({ statut: "perte", dateSortie: new Date("2027-03-01T10:00:00.000Z") })
    expect(data).not.toHaveProperty("quantite")
    expect(mocks.recolteCreate).not.toHaveBeenCalled()
  })

  it.each([
    ["plus que le lot", { statut: "perte", quantiteSortie: 10.5 }, "quantiteSortie"],
    ["avant la récolte du lot", { statut: "perte", quantiteSortie: 1, dateSortie: "2027-01-19" }, "dateSortie"],
    ["après demain", { statut: "consomme", quantiteSortie: 1, dateSortie: "2027-03-03" }, "dateSortie"],
  ])("refuse une sortie %s", async (_cas, body, champ) => {
    const res = await sortir(body)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ champ })
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
    expect(mocks.recolteCreate).not.toHaveBeenCalled()
  })

  it("refuse une fraction de botte", async () => {
    mocks.recolteFindUnique.mockResolvedValue({ ...LOT, unite: "botte" })
    const res = await sortir({ statut: "don", quantiteSortie: 2.5 })
    expect(res.status).toBe(400)
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
  })

  it("refuse de sortir un lot déjà sorti", async () => {
    mocks.recolteFindUnique.mockResolvedValue({ ...LOT, statut: "perte" })
    const res = await sortir({ statut: "don", quantiteSortie: 1 })
    expect(res.status).toBe(409)
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
  })

  it("refuse une quantité de sortie hors d'une sortie", async () => {
    const res = await sortir({ statut: "en_stock", quantiteSortie: 1 })
    expect(res.status).toBe(400)
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
  })

  it("refuse de vendre un lot sorti sans le remettre en stock", async () => {
    mocks.recolteFindUnique.mockResolvedValue({ ...LOT, statut: "don", dateSortie: new Date("2027-02-10T00:00:00.000Z") })
    const res = await sortir({ statut: "vendu", dateVente: "2027-02-20", prixKg: 2, clientNom: "Marché" })
    expect(res.status).toBe(409)
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
  })

  it("refuse de passer une vente en perte sans la remettre en stock", async () => {
    mocks.recolteFindUnique.mockResolvedValue({ ...LOT, statut: "vendu", prixKg: 2, prixTotal: 20, dateVente: new Date("2027-02-01T00:00:00.000Z"), clientNom: "Marché" })
    const res = await sortir({ statut: "perte" })
    expect(res.status).toBe(409)
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
  })

  it("la note de la sortie s'ajoute à celle du lot, que le reste conserve", async () => {
    mocks.recolteFindUnique.mockResolvedValue({ ...LOT, notes: "Planche 4, pour AMAP" })
    const res = await sortir({ statut: "don", quantiteSortie: 3, notes: "Restos" })
    expect(res.status).toBe(200)
    expect(mocks.recolteUpdate.mock.calls[0][0].data.notes).toBe("Planche 4, pour AMAP · Restos")
    expect(mocks.recolteCreate.mock.calls[0][0].data.notes).toBe("Planche 4, pour AMAP")
  })

  it("remise en stock : le jour de sortie est effacé", async () => {
    mocks.recolteFindUnique.mockResolvedValue({ ...LOT, statut: "don", dateSortie: new Date("2027-02-10T00:00:00.000Z") })
    const res = await sortir({ statut: "en_stock" })
    expect(res.status).toBe(200)
    expect(mocks.recolteUpdate.mock.calls[0][0].data).toMatchObject({ statut: "en_stock", dateSortie: null })
    expect(mocks.recolteCreate).not.toHaveBeenCalled()
  })

  it("refuse une péremption antérieure à la récolte", async () => {
    const res = await sortir({ datePeremption: "2027-01-19T00:00:00.000Z" })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ champ: "datePeremption" })
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
  })
})

// Modèle de stock unique, lot 2 : un lot pris par une sortie de Consommations
// ne revient au stock que par l'annulation de cette sortie.
describe("PATCH /api/recoltes/[id] — lot pris par une sortie de Consommations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ session: { user: { id: "u1" } } })
    mocks.recolteFindUnique.mockResolvedValue({
      ...RECOLTE, quantite: 2, unite: "kg", statut: "don", consommationId: 42, factureId: null,
      dateSortie: new Date("2027-02-10T00:00:00.000Z"), espece: { id: "Zinnia", nom: "Zinnia" }, culture: { variete: null },
    })
  })

  it("refuse la remise en stock depuis l'écran Récoltes", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/recoltes/1150", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut: "en_stock" }) }) as never,
      { params: Promise.resolve({ id: "1150" }) },
    )
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/Consommations/)
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
  })
})

// Modèle de stock unique, L3 : un lot d'inventaire (né d'un comptage, sans
// culture) et un écart d'inventaire ne se corrigent que par un comptage.
describe("lot d'inventaire et écart d'inventaire", () => {
  const corps = (body: Record<string, unknown>, method = "PATCH") =>
    new Request("http://localhost/api/recoltes/1150", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) as never
  const params = { params: Promise.resolve({ id: "1150" }) }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ session: { user: { id: "u1" } } })
  })

  it("refuse de remettre en stock un écart d'inventaire", async () => {
    mocks.recolteFindUnique.mockResolvedValue({ ...RECOLTE, quantite: 2, unite: "kg", statut: "ecart", consommationId: null, factureId: null, espece: { id: "Zinnia", nom: "Zinnia" }, culture: null, cultureId: null })
    const res = await PATCH(corps({ statut: "en_stock" }), params)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/comptage/)
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
  })

  it("refuse de changer la quantité d'un lot d'inventaire depuis la fiche", async () => {
    mocks.recolteFindUnique.mockResolvedValue({ ...RECOLTE, cultureId: null, culture: null, quantite: 24, unite: "kg", statut: "en_stock", consommationId: null })
    const res = await PUT(corps({ quantite: 20 }, "PUT"), params)
    expect(res.status).toBe(409)
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
  })

  it("la fiche renvoie le même jour : le lot d'inventaire garde l'instant de son comptage", async () => {
    const instant = new Date("2027-01-20T15:30:00.000Z")
    mocks.recolteFindUnique.mockResolvedValue({ ...RECOLTE, cultureId: null, culture: null, date: instant, quantite: 24, unite: "kg", statut: "en_stock", consommationId: null })
    mocks.recolteUpdate.mockResolvedValue({ id: 1150 })
    const res = await PUT(corps({ date: "2027-01-20T00:00:00.000Z", quantite: 24, notes: "Cave nord" }, "PUT"), params)
    expect(res.status).toBe(200)
    const data = mocks.recolteUpdate.mock.calls[0][0].data
    expect(data).not.toHaveProperty("date")
    expect(data).toMatchObject({ notes: "Cave nord" })
  })

  it("refuse de supprimer un écart d'inventaire, ou d'écrire ce statut à la main", async () => {
    mocks.recolteFindUnique.mockResolvedValue({ ...RECOLTE, quantite: 2, unite: "kg", statut: "ecart", consommationId: null, factureId: null, espece: { id: "Zinnia", nom: "Zinnia" }, culture: { variete: null } })
    const suppression = await DELETE(new Request("http://localhost/api/recoltes/1150", { method: "DELETE" }) as never, params)
    expect(suppression.status).toBe(409)
    mocks.recolteFindUnique.mockResolvedValue({ ...RECOLTE, quantite: 2, unite: "kg", statut: "en_stock", consommationId: null, factureId: null, espece: { id: "Zinnia", nom: "Zinnia" }, culture: { variete: null } })
    const forge = await PATCH(corps({ statut: "ecart" }), params)
    expect(forge.status).toBe(409)
    expect(mocks.recolteUpdate).not.toHaveBeenCalled()
  })

  it("vend un lot d'inventaire sans délai de traitement à juger ni variété", async () => {
    mocks.recolteFindUnique.mockResolvedValue({ ...RECOLTE, cultureId: null, culture: null, quantite: 24, unite: "kg", statut: "en_stock", consommationId: null, factureId: null, espece: { id: "Zinnia", nom: "Zinnia" } })
    mocks.recolteUpdate.mockResolvedValue({ id: 1150, statut: "vendu" })
    mocks.creerFacture.mockResolvedValue({ id: 78 })
    const res = await PATCH(corps({ statut: "vendu", dateVente: "2027-02-20", prixKg: 2, prixTotal: 48, quantiteVendue: 24, clientNom: "Marché", creerFacture: true }), params)
    expect(res.status).toBe(200)
    expect(mocks.creerFacture.mock.calls[0][1].lignes[0].description).toBe("Zinnia")
  })
})

// Lignée des lots (défaut D51) : la part créée par une scission pointe la
// récolte saisie. Supprimée ou rattachée ailleurs, celle-ci laisse sa lignée à
// sa part la plus ancienne ; une part rattachée ailleurs redevient une récolte.
describe("lignée d'une récolte scindée", () => {
  const params = { params: Promise.resolve({ id: "1150" }) }
  const SAISIE = { ...RECOLTE, quantite: 7, unite: "kg", statut: "en_stock", consommationId: null, factureId: null, recolteOrigineId: null, espece: { id: "Zinnia", nom: "Zinnia" }, culture: { variete: null } }
  const AUTRE_CULTURE = { ...ZINNIA, id: 1180 }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
    mocks.recolteFindUnique.mockResolvedValue(SAISIE)
    mocks.recolteFindMany.mockResolvedValue([])
    mocks.cultureFindUnique.mockResolvedValue(AUTRE_CULTURE)
    mocks.recolteUpdate.mockImplementation(async ({ data }) => ({ ...SAISIE, ...data }))
  })

  it("supprimée avec trois parts : la plus ancienne hérite, avant la suppression", async () => {
    mocks.recolteFindMany.mockResolvedValue([{ id: 1151 }, { id: 1152 }, { id: 1153 }])
    const res = await DELETE(new Request("http://localhost/api/recoltes/1150", { method: "DELETE" }) as never, params)
    expect(res.status).toBe(200)
    expect(mocks.recolteFindMany).toHaveBeenCalledWith({ where: { userId: "u1", recolteOrigineId: 1150 }, orderBy: { id: "asc" }, select: { id: true } })
    expect(mocks.recolteUpdateMany.mock.calls.map(([appel]) => appel)).toEqual([
      { where: { userId: "u1", recolteOrigineId: 1150, id: { not: 1151 } }, data: { recolteOrigineId: 1151 } },
      { where: { userId: "u1", id: 1151 }, data: { recolteOrigineId: null } },
    ])
    expect(mocks.recolteUpdateMany.mock.invocationCallOrder.at(-1)!).toBeLessThan(mocks.recolteDelete.mock.invocationCallOrder[0])
  })

  it("supprimée sans part : aucune écriture de lignée", async () => {
    const res = await DELETE(new Request("http://localhost/api/recoltes/1150", { method: "DELETE" }) as never, params)
    expect(res.status).toBe(200)
    expect(mocks.recolteUpdateMany).not.toHaveBeenCalled()
    expect(mocks.recolteDelete).toHaveBeenCalledWith({ where: { id: 1150 } })
  })

  it("une part rattachée à une autre culture redevient une récolte", async () => {
    mocks.recolteFindUnique.mockResolvedValue({ ...SAISIE, recolteOrigineId: 900 })
    const res = await modifier({ cultureId: 1180, especeId: "Zinnia", date: "2027-01-20T00:00:00.000Z", quantite: 7 })
    expect(res.status).toBe(200)
    expect(mocks.recolteUpdate.mock.calls[0][0].data.recolteOrigineId).toBeNull()
    expect(mocks.recolteUpdateMany).not.toHaveBeenCalled()
  })

  it("une récolte saisie rattachée ailleurs laisse sa lignée à sa part la plus ancienne", async () => {
    mocks.recolteFindMany.mockResolvedValue([{ id: 1151 }, { id: 1152 }])
    const res = await modifier({ cultureId: 1180, especeId: "Zinnia", date: "2027-01-20T00:00:00.000Z", quantite: 7 })
    expect(res.status).toBe(200)
    expect(mocks.recolteUpdateMany).toHaveBeenCalledWith({ where: { userId: "u1", recolteOrigineId: 1150, id: { not: 1151 } }, data: { recolteOrigineId: 1151 } })
    expect(mocks.recolteUpdate.mock.calls[0][0].data).not.toHaveProperty("recolteOrigineId")
  })

  it("corrigée sans changer de culture : la lignée ne bouge pas", async () => {
    mocks.recolteFindUnique.mockResolvedValue({ ...SAISIE, recolteOrigineId: 900 })
    const res = await modifier({ date: "2027-01-20T00:00:00.000Z", quantite: 6, notes: null })
    expect(res.status).toBe(200)
    expect(mocks.recolteUpdate.mock.calls[0][0].data).not.toHaveProperty("recolteOrigineId")
    expect(mocks.recolteFindMany).not.toHaveBeenCalled()
  })
})
