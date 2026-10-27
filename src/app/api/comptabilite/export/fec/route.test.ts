/**
 * Export FEC — suivi des ventes générées (ticket cmvgdzsf7, revue du 2026-10-20).
 *
 * Le formulaire « Règlement et pièce » de Transactions > Revenus écrit le
 * règlement et la pièce sur le MIROIR `VenteManuelle` d'une ligne dérivée
 * (vente d'élevage 167 → miroir 909, bois 34 → miroir 910 sur la démo). Le FEC
 * exclut ces miroirs et réinjecte la SOURCE brute : il sortait `ELEV-167` /
 * `BOIS-34` sans mode de règlement, quelle que soit la pièce saisie. Il relit
 * désormais le suivi du miroir (`chargerSuiviDesSources`).
 *
 * Cas repris du test de revue (`route.revue.test.ts`, supprimé). Le mock de
 * `venteManuelle.findMany` évalue le `where` réel de chaque requête (compte,
 * dates, `auto`, `OR` par type, par source ou par id) au lieu de renvoyer ce
 * qu'on veut ; celui de la revue ne connaissait que la forme de la première.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

type Ligne = Record<string, unknown>

const etat = vi.hoisted(() => ({
  recoltes: [] as Array<Record<string, unknown>>,
  miroirs: [] as Array<Record<string, unknown>>,
  ventesElevage: [] as Array<Record<string, unknown>>,
}))

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  venteManuelleFindMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    exploitation: {
      findUnique: vi.fn().mockResolvedValue({ siren: "123456789", territoire: null, regimeTva: "reel-simplifie" }),
    },
    venteManuelle: { findMany: mocks.venteManuelleFindMany },
    depenseManuelle: { findMany: vi.fn().mockResolvedValue([]) },
    facture: { findMany: vi.fn().mockResolvedValue([]) },
    productionBois: {
      findMany: vi.fn().mockResolvedValue([
        { id: 34, date: new Date("2026-10-20"), dateVente: new Date("2026-10-20"), prixVente: 450, qualiteBois: null, numLot: null, arbre: { espece: "Châtaignier", nom: "Châtaignier" }, clientNom: null, statut: "vendu" },
      ]),
    },
    recolteArbre: { findMany: vi.fn().mockResolvedValue([]) },
    venteProduit: { findMany: vi.fn(async () => etat.ventesElevage) },
    recolte: { findMany: vi.fn(async ({ where }) => etat.recoltes.filter(r => correspond(r, where))) },
    abattage: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import { GET } from "./route"

/** Évalue un `where` Prisma simple : égalité, `in`, `not`, bornes de date, `OR`. */
function correspond(ligne: Ligne, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([champ, condition]) => {
    if (champ === "OR") return (condition as Array<Record<string, unknown>>).some((c) => correspond(ligne, c))
    const valeur = ligne[champ]
    if (condition && typeof condition === "object" && !(condition instanceof Date)) {
      const c = condition as { in?: unknown[]; not?: unknown; gte?: Date; lte?: Date }
      if (c.in && !c.in.includes(valeur)) return false
      if ("not" in c && valeur === c.not) return false
      if (c.gte && (valeur as Date) < c.gte) return false
      if (c.lte && (valeur as Date) > c.lte) return false
      return true
    }
    return valeur === condition
  })
}

/** Lignes du FEC exporté, par nom de colonne. */
async function exporter(): Promise<Array<Record<string, string>>> {
  const res = await GET(new NextRequest("http://localhost/api/comptabilite/export/fec?exercice=2026"))
  expect(res.status).toBe(200)
  const [entete, ...lignes] = (await res.text()).trim().split("\n").map((l) => l.split("\t"))
  return lignes.map((l) => Object.fromEntries(entete.map((col, i) => [col, l[i]])))
}

const venteOeufs = (paye: boolean) => ({
  id: 167, date: new Date("2026-10-20"), type: "oeufs", description: "v8 Œufs marché", quantite: 72, unite: "œuf", prixTotal: 86.4, tauxTVA: 5.5, client: null, paye, factureId: null,
})

const miroir = (m: Ligne) => ({
  userId: "u1", auto: true, date: new Date("2026-10-20"), clientNom: null, paye: true, notes: null, ...m,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
  etat.ventesElevage = [venteOeufs(true)]
  etat.recoltes = []
  // État APRÈS l'enregistrement du formulaire « Règlement et pièce » (PATCH ventes-manuelles).
  etat.miroirs = [
    miroir({ id: 909, sourceType: "vente_produit", sourceId: 167, description: "v8 Œufs marché", categorie: "oeufs", montant: 86.4, montantHT: 81.9, montantTVA: 4.5, tauxTVA: 5.5, modeReglement: "Chèque", numeroPiece: "CHQ-0042" }),
    miroir({ id: 910, sourceType: "production_bois", sourceId: 34, description: "Vente bois", categorie: "bois", montant: 450, montantHT: 409.09, montantTVA: 40.91, tauxTVA: 10, modeReglement: "Virement", numeroPiece: "VIR-12" }),
  ]
  mocks.venteManuelleFindMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
    etat.miroirs.filter((m) => correspond(m, where)),
  )
})

describe("GET /api/comptabilite/export/fec — suivi des ventes générées", () => {
  it("vente d'élevage 167 (miroir 909) : la pièce CHQ-0042 figure au FEC", async () => {
    const lignes = await exporter()
    const ecriture = lignes.filter((l) => l.PieceRef === "CHQ-0042")
    expect(ecriture.length).toBeGreaterThan(0)
    // La référence de la source reste lisible dans le libellé.
    expect(ecriture[0].EcritureLib).toContain("ELEV-167")
    // Chèque encaissé : banque, journal de banque.
    expect(ecriture.find((l) => l.Debit !== "0,00")?.CompteNum).toBe("512100")
    expect(ecriture[0].JournalCode).toBe("BQ")
  })

  it("vente de bois 34 (miroir 910) : la pièce VIR-12 figure au FEC", async () => {
    const lignes = await exporter()
    expect(lignes.some((l) => l.PieceRef === "VIR-12")).toBe(true)
    expect(lignes.some((l) => l.PieceRef === "BOIS-34")).toBe(false)
  })

  it("sans pièce saisie, garde la référence technique et ne lit que les miroirs du compte", async () => {
    etat.miroirs = [
      miroir({ id: 909, sourceType: "vente_produit", sourceId: 167, modeReglement: null, numeroPiece: null }),
      // Même source chez un autre compte : jamais lue.
      miroir({ id: 999, userId: "u2", sourceType: "production_bois", sourceId: 34, modeReglement: "Virement", numeroPiece: "AUTRE-COMPTE" }),
    ]

    const lignes = await exporter()

    expect(lignes.some((l) => l.PieceRef === "ELEV-167")).toBe(true)
    expect(lignes.some((l) => l.PieceRef === "BOIS-34")).toBe(true)
    expect(lignes.some((l) => l.PieceRef === "AUTRE-COMPTE")).toBe(false)
    const lecture = mocks.venteManuelleFindMany.mock.calls.find(([args]) => args.select)?.[0]
    expect(lecture.where).toMatchObject({ userId: "u1", auto: true })
  })

  it("un mode bancaire saisi sur une vente impayée laisse la créance en 411", async () => {
    etat.ventesElevage = [venteOeufs(false)]
    etat.miroirs = [
      miroir({ id: 909, sourceType: "vente_produit", sourceId: 167, paye: false, modeReglement: "Virement", numeroPiece: "VIR-99" }),
    ]

    const lignes = await exporter()
    const ecriture = lignes.filter((l) => l.PieceRef === "VIR-99")

    expect(ecriture.find((l) => l.Debit !== "0,00")?.CompteNum).toBe("411000")
    expect(ecriture.some((l) => l.CompteNum === "512100")).toBe(false)
    expect(ecriture[0].JournalCode).toBe("VE")
  })
})

it('une ancienne récolte au PU seul produit une écriture équilibrée de 20 euros', async () => {
  const r = { id: 7, userId: 'u1', statut: 'vendu', factureId: null, quantite: 10,
    prixKg: 2, prixTotal: null, date: new Date('2026-06-01'), dateVente: new Date('2026-06-02'),
    especeId: 'Radis', espece: { id: 'Radis' }, clientNom: 'Marché' }
  etat.recoltes = [r, { ...r, id: 8, factureId: 42 }, { ...r, id: 9, userId: 'autre' }]
  const lignes = (await exporter()).filter(l => l.PieceRef.startsWith('RECOLTE-'))
  const montant = (s: string) => Number(s.replace(',', '.'))
  expect(lignes.length).toBeGreaterThan(0)
  expect(lignes.every(l => l.PieceRef === 'RECOLTE-7')).toBe(true)
  expect(lignes.reduce((s,l) => s + montant(l.Debit),0)).toBeCloseTo(20,2)
  expect(lignes.reduce((s,l) => s + montant(l.Credit),0)).toBeCloseTo(20,2)
})

it('le FEC conserve aussi la dernière seconde de l’exercice civil de Paris', async () => {
  etat.recoltes = [{ id: 7, userId: 'u1', statut: 'vendu', factureId: null, quantite: 10, prixKg: 2,
    prixTotal: 20, date: new Date('2026-12-31T22:59:59.500Z'), dateVente: new Date('2026-12-31T22:59:59.500Z'),
    especeId: 'Radis', espece: { id: 'Radis' }, clientNom: 'Marché' }]
  expect((await exporter()).some(l => l.PieceRef === 'RECOLTE-7')).toBe(true)
})
