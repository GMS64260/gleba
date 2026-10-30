/**
 * Réservation d'un numéro de facture : la séquence se recale sur les numéros
 * déjà pris, même quand sa ligne existe déjà (reset démo, import).
 * Régression du 2026-08-12 : trois 500 d'affilée sur un avoir du compte démo.
 */
import { describe, it, expect, vi } from "vitest"
import { annulerFactureLiee, creerFacture, reserverProchainNumeroForEmission } from "@/lib/facture-utils"

function fauxTx(opts: { prochainNum: number; maxExistant: number | null }) {
  const executeRaw = vi.fn().mockResolvedValue(1)
  const queryRaw = vi.fn().mockImplementation(async (sql: string) => {
    if (sql.includes("FOR UPDATE")) {
      return [{ prochain_num: opts.prochainNum, prefixe: "AV-2026-", format: "%04d" }]
    }
    if (sql.includes("MAX(")) return [{ max_num: opts.maxExistant }]
    throw new Error(`SQL inattendu : ${sql}`)
  })
  return {
    tx: { $executeRawUnsafe: executeRaw, $queryRawUnsafe: queryRaw } as never,
    executeRaw,
    queryRaw,
  }
}

const updateCall = (executeRaw: ReturnType<typeof vi.fn>) =>
  executeRaw.mock.calls.find((c) => String(c[0]).includes("UPDATE sequences_facture"))!

describe("reserverProchainNumero", () => {
  it("séquence en retard sur les factures existantes : saute au premier numéro libre", async () => {
    const { tx, executeRaw } = fauxTx({ prochainNum: 1, maxExistant: 4 })
    const { numero } = await reserverProchainNumeroForEmission(tx, "u1", 2026, "AVOIR")
    expect(numero).toBe("AV-2026-0005")
    // et le compteur repart APRÈS ce numéro, pas de l'ancien compteur + 1
    expect(updateCall(executeRaw).slice(1)).toEqual(["u1", 2026, "AVOIR", 6])
  })

  it("séquence en avance (numéros supprimés) : ne recule jamais", async () => {
    const { tx, executeRaw } = fauxTx({ prochainNum: 7, maxExistant: 4 })
    const { numero } = await reserverProchainNumeroForEmission(tx, "u1", 2026, "AVOIR")
    expect(numero).toBe("AV-2026-0007")
    expect(updateCall(executeRaw)[4]).toBe(8)
  })

  it("aucune facture pour ce préfixe : le compteur fait foi", async () => {
    const { tx, executeRaw } = fauxTx({ prochainNum: 3, maxExistant: null })
    const { numero } = await reserverProchainNumeroForEmission(tx, "u1", 2026, "AVOIR")
    expect(numero).toBe("AV-2026-0003")
    expect(updateCall(executeRaw)[4]).toBe(4)
  })

  it("la recherche des numéros pris se fait sur le préfixe DE LA LIGNE, sous le verrou", async () => {
    const { tx, queryRaw } = fauxTx({ prochainNum: 1, maxExistant: 1 })
    await reserverProchainNumeroForEmission(tx, "u1", 2026, "AVOIR")
    const ordre = queryRaw.mock.calls.map((c) => (String(c[0]).includes("FOR UPDATE") ? "lock" : "max"))
    expect(ordre).toEqual(["lock", "max"])
    const maxCall = queryRaw.mock.calls[1]
    expect(maxCall.slice(1)).toEqual(["u1", "AV-2026-"])
  })
})

/**
 * Ticket cmvfljaru (QA 2026-10-19) — une facture rattachée à une fiche client
 * fige son identité d'acheteur (SIRET, SIREN, TVA intracommunautaire) ; une
 * fiche sans adresse ne remplace plus l'adresse saisie par une chaîne vide.
 */
describe("creerFacture — identité de l'acheteur figée depuis la fiche", () => {
  function txFacture(client: Record<string, unknown> | null) {
    const { tx } = fauxTx({ prochainNum: 3, maxExistant: 2 })
    const create = vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data)
    return {
      tx: {
        ...(tx as unknown as Record<string, unknown>),
        client: { findFirst: vi.fn().mockResolvedValue(client) },
        exploitation: { findUnique: vi.fn().mockResolvedValue(null) },
        facture: { create },
      } as never,
      create,
    }
  }
  const params = (clientId: number | null) => ({
    userId: "u1",
    type: "facture",
    clientId,
    clientNom: "Restaurant du Port",
    clientAdresse: "2 quai des Pêcheurs, 64500 Ciboure",
    objet: "Livraison",
    totalHT: 100,
    totalTVA: 5.5,
    totalTTC: 105.5,
    lignes: [{ description: "Légumes", quantite: 10, unite: "kg", prixUnitaire: 10, tauxTVA: 5.5, montantHT: 100, montantTVA: 5.5, montantTTC: 105.5 }],
  })

  it("reprend SIRET, SIREN dérivé et TVA intracommunautaire de la fiche", async () => {
    const { tx, create } = txFacture({
      id: 9, nom: "Restaurant du Port", adresse: "2 quai des Pêcheurs", codePostal: "64500", ville: "Ciboure",
      siret: "73282932000074", siren: null, tvaIntra: "FR44732829320", exonererTVA: false,
    })
    await creerFacture(tx, params(9))
    const data = create.mock.calls[0][0].data
    expect(data).toMatchObject({
      clientId: 9,
      clientSiret: "73282932000074",
      clientSiren: "732829320",
      clientTvaIntra: "FR44732829320",
      clientAdresse: "2 quai des Pêcheurs, 64500, Ciboure",
    })
  })

  it("garde l'adresse saisie quand la fiche n'en a pas", async () => {
    const { tx, create } = txFacture({
      id: 9, nom: "Restaurant du Port", adresse: null, codePostal: null, ville: null,
      siret: "73282932000074", siren: "732829320", tvaIntra: null, exonererTVA: false,
    })
    await creerFacture(tx, params(9))
    expect(create.mock.calls[0][0].data.clientAdresse).toBe("2 quai des Pêcheurs, 64500 Ciboure")
  })

  it("sans fiche : aucune identité d'acheteur, nom et adresse saisis", async () => {
    const { tx, create } = txFacture(null)
    await creerFacture(tx, params(null))
    expect(create.mock.calls[0][0].data).toMatchObject({
      clientId: null, clientSiret: null, clientSiren: null, clientTvaIntra: null,
      clientNom: "Restaurant du Port", clientAdresse: "2 quai des Pêcheurs, 64500 Ciboure",
    })
  })
})

/**
 * Revue du 2026-10-29 : une facture émise dont l'unique versement a été annulé
 * gardait son dossier de règlements ; annuler la vente exigeait alors des
 * avoirs couvrant toute la facture. Seul un versement actif l'impose.
 */
describe("annulerFactureLiee — dossier de règlements", () => {
  function fauxDossier(actifs: number) {
    const update = vi.fn().mockResolvedValue({})
    const tx = {
      $queryRaw: vi.fn(async (sql: TemplateStringsArray) =>
        sql.join("?").includes("cibles_reglement")
          ? [{ dossier_id: "dossier-qa", regle: BigInt(actifs ? 5000 : 0), actifs: BigInt(actifs) }]
          : [{ id: 9 }]),
      facture: {
        findFirst: vi.fn().mockResolvedValue({ id: 9, numero: "F-QA-9", statut: "emise", totalTTC: 50 }),
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalTTC: null } }),
        update,
      },
    }
    return { tx: tx as never, update }
  }

  it("annule la facture d'une vente dont tous les versements sont annulés", async () => {
    const { tx, update } = fauxDossier(0)
    await expect(annulerFactureLiee(tx, "u1", 9)).resolves.toEqual({ ok: true })
    expect(update).toHaveBeenCalledWith({ where: { id: 9 }, data: { statut: "annulee" } })
  })

  it("exige toujours un avoir quand un versement actif reste enregistré", async () => {
    const { tx, update } = fauxDossier(1)
    await expect(annulerFactureLiee(tx, "u1", 9)).resolves.toMatchObject({ ok: false })
    expect(update).not.toHaveBeenCalled()
  })
})
