/**
 * Comptabilité > Transactions > Revenus — écriture des lignes dérivées
 * (ticket cmvgdzsf7, 2026-10-20).
 *
 * La liste affiche les sources brutes (vente d'élevage, récolte, bois) : une
 * ligne dérivée n'offrait ni bouton ni formulaire, faute de connaître son
 * miroir comptable. La route rattache désormais à chaque ligne dérivée son
 * écriture (id + suivi modifiable) ou la facture qui porte la vente.
 * Requête rejouée : celle de l'écran (`fetchData`), `?year=2026`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  venteProduit: vi.fn(),
  recolteArbre: vi.fn(),
  productionBois: vi.fn(),
  abattage: vi.fn(),
  recolte: vi.fn(),
  venteManuelle: vi.fn(),
  commandeBoutique: vi.fn(),
  paieLait: vi.fn(),
  facture: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/kpi", () => ({ getKpiCompta: vi.fn().mockResolvedValue({}) }))
vi.mock("@/lib/prisma", () => ({
  default: {
    cibleReglement: { findMany: vi.fn().mockResolvedValue([]) },
    venteProduit: { findMany: mocks.venteProduit },
    recolteArbre: { findMany: mocks.recolteArbre },
    productionBois: { findMany: mocks.productionBois },
    abattage: { findMany: mocks.abattage },
    recolte: { findMany: mocks.recolte },
    venteManuelle: { findMany: mocks.venteManuelle },
    commandeBoutique: { findMany: mocks.commandeBoutique },
    paieLait: { findMany: mocks.paieLait },
    facture: { findMany: mocks.facture },
  },
}))

import { GET } from "./route"

const d = (iso: string) => new Date(iso)

/** Miroirs `auto` lus par `chargerSuiviDesLignes` (appel avec `select`). */
const miroirs = [
  { id: 909, sourceType: "vente_produit", sourceId: 167, modeReglement: null, numeroPiece: null, notes: null },
  { id: 910, sourceType: "production_bois", sourceId: 34, modeReglement: "Virement", numeroPiece: "VIR-12", notes: null },
  { id: 913, sourceType: "commande_boutique", sourceId: 103, modeReglement: null, numeroPiece: null, notes: "Retrait" },
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
  mocks.venteProduit.mockResolvedValue([
    { id: 167, date: d("2026-10-20"), type: "oeufs", description: "v8-Nathalie 2010 Œufs marché", quantite: 72, unite: "œuf", prixUnitaire: 1.2, prixTotal: 86.4, client: null, paye: true, factureId: null },
  ])
  mocks.recolteArbre.mockResolvedValue([])
  mocks.productionBois.mockResolvedValue([
    { id: 34, date: d("2026-10-20"), dateVente: d("2026-10-20"), type: "elagage", volumeM3: 3, poidsKg: null, prixVente: 450, clientNom: null, factureId: null, arbre: { nom: "Châtaignier" } },
  ])
  mocks.abattage.mockResolvedValue([])
  mocks.recolte.mockResolvedValue([
    // Vente Dahlia facturée : pas de miroir, la facture F-2026-0007 la porte.
    { id: 1177, date: d("2026-10-20"), dateVente: d("2026-10-20"), especeId: "Dahlia", quantite: 40, prixKg: 1.2, prixTotal: 48, clientNom: "v8-Nathalie Amap 2010", factureId: 40 },
  ])
  mocks.venteManuelle.mockImplementation(async (args: { select?: object }) =>
    args.select
      ? miroirs
      : [
          { id: 905, date: d("2026-10-19"), auto: false, sourceType: null, sourceId: null, module: "potager", description: "Marché samedi", quantite: null, unite: null, prixUnitaire: null, montant: 127.5, clientNom: null, paye: true, categorie: "legumes" },
          { id: 913, date: d("2026-10-20"), auto: true, sourceType: "commande_boutique", sourceId: 103, module: "boutique", description: "Commande boutique CMD-2026-0017", quantite: null, unite: null, prixUnitaire: null, montant: 5, clientNom: null, paye: true, categorie: "epicerie" },
        ],
  )
  mocks.commandeBoutique.mockResolvedValue([])
  mocks.paieLait.mockResolvedValue([])
  mocks.facture.mockResolvedValue([{ id: 40, numero: "F-2026-0007" }])
})

describe("GET /api/comptabilite/revenus — suivi des lignes dérivées", () => {
  it("rattache son écriture à chaque ligne dérivée, sa facture à une vente facturée", async () => {
    const res = await GET(new NextRequest("http://localhost/api/comptabilite/revenus?year=2026"))

    expect(res.status).toBe(200)
    const { data } = await res.json()
    const ligne = (id: string) => data.find((r: { id: string }) => r.id === id)

    expect(ligne("vente-167").ecriture).toEqual({
      id: 909,
      suivi: { modeReglement: null, numeroPiece: null, notes: null },
    })
    expect(ligne("bois-34").ecriture).toEqual({
      id: 910,
      suivi: { modeReglement: "Virement", numeroPiece: "VIR-12", notes: null },
    })
    // QA cmvnp0dm9 — libellé du type, pas la valeur technique « elagage ».
    expect(ligne("bois-34").description).toBe("Vente bois - Élagage - Châtaignier - 3 m³")
    // Miroir affiché tel quel (commande boutique) : retrouvé par son id.
    expect(ligne("manuel-913").ecriture.id).toBe(913)
    expect(ligne("recolte-potager-1177")).toMatchObject({
      ecriture: null,
      facture: { id: 40, numero: "F-2026-0007" },
    })
    // Une ligne saisie à la main garde son formulaire complet, sans écriture rattachée.
    expect(ligne("manuel-905").corrigeable).toBe(true)
    expect(ligne("manuel-905").ecriture).toBeUndefined()
  })

  it("lit miroirs et factures dans le seul compte de la session", async () => {
    await GET(new NextRequest("http://localhost/api/comptabilite/revenus?year=2026"))

    const lectureMiroirs = mocks.venteManuelle.mock.calls.find(([args]) => args.select)?.[0]
    expect(lectureMiroirs.where).toEqual({
      userId: "u1",
      auto: true,
      OR: [
        { id: { in: [913] } },
        { sourceType: "vente_produit", sourceId: { in: [167] } },
        { sourceType: "production_bois", sourceId: { in: [34] } },
        { sourceType: "recolte", sourceId: { in: [1177] } },
      ],
    })
    expect(lectureMiroirs.select).toEqual({
      id: true,
      sourceType: true,
      sourceId: true,
      modeReglement: true,
      numeroPiece: true,
      notes: true,
    })
    expect(mocks.facture).toHaveBeenCalledWith({
      where: { userId: "u1", id: { in: [40] } },
      select: { id: true, numero: true },
    })
  })
})
