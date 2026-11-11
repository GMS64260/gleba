import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  rows: {} as Record<string, Array<Record<string, unknown>>>,
  create: vi.fn(),
  createMany: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}))

vi.mock("@/lib/prisma", () => {
  const client: object = new Proxy({}, {
    get: (_target, name: string) => {
      if (name === "$transaction") return (action: (tx: object) => Promise<unknown>) => action(client)
      if (name === "$executeRawUnsafe") return async () => 0
      if (name === "$executeRaw") return async () => 0
      return {
        findMany: (args: unknown) => mocks.findMany(name, args),
        count: (args: unknown) => mocks.count(name, args),
        create: (args: { data: Record<string, unknown> }) => mocks.create(name, args),
        createMany: (args: { data: Array<Record<string, unknown>>; skipDuplicates?: boolean }) => mocks.createMany(name, args),
      }
    },
  })
  return { default: client }
})

import { ErreurCompteDejaRempli, exportAccount, importAccount } from "./account-transfer"
import { SEUIL_MESURES_BRUTES_EXPORT } from "@/lib/capteurs/connecteurs"

describe("transfert des identifiants BigInt des capteurs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rows = {
      connecteurCapteurs: [{ id: "conn-1", userId: "source", nom: "Banc", type: "generique", jetonHash: "empreinte", jetonPrefixe: "glc_essai" }],
      capteur: [{ id: "cap-1", userId: "source", connecteurId: "conn-1", identifiantExterne: "sonde", clesRecues: ["TempC"], clesInconnues: ["TempC"] }],
      mesureCapteur: [
        { id: BigInt("9007199254740993"), capteurId: "cap-1", grandeur: "temperature_air", valeur: 12, unite: "°C", mesureeA: new Date("2026-10-20T12:00:00Z") },
        { id: BigInt("9007199254740994"), capteurId: "cap-tiers", grandeur: "temperature_air", valeur: 30, unite: "°C" },
      ],
    }
    mocks.findMany.mockImplementation(async (name: string) => mocks.rows[name] ?? [])
    mocks.count.mockImplementation(async (name: string) => (mocks.rows[name] ?? []).length)
    mocks.createMany.mockImplementation(async (_name: string, { data }: { data: unknown[] }) => ({ count: data.length }))
    mocks.create.mockImplementation(async (name: string, { data }: { data: Record<string, unknown> }) => ({
      ...data, id: name === "mesureCapteur" ? BigInt(42) : data.id,
    }))
  })

  it("rend la sauvegarde JSON sérialisable sans perdre la précision ni exporter un capteur tiers", async () => {
    const sauvegarde = await exportAccount("source")
    const relecture = JSON.parse(JSON.stringify(sauvegarde))
    expect(relecture.data.MesureCapteur).toHaveLength(1)
    expect(relecture.data.MesureCapteur[0].id).toBe("9007199254740993")
    expect(relecture.data.MesureCapteur[0].mesureeA).toBe("2026-10-20T12:00:00.000Z")
    expect(mocks.findMany).toHaveBeenCalledWith("mesureCapteur", {
      where: {
        AND: [{ OR: [{ capteurId: { in: ["cap-1"] } }] }],
        OR: [{ capteurId: { in: ["cap-1"] } }],
      },
    })
    expect(sauvegarde.avertissements).toEqual([])
  })

  it("réimporte le fichier JSON et laisse la cible régénérer la PK BigInt", async () => {
    const sauvegarde = JSON.parse(JSON.stringify(await exportAccount("source")))
    const resultat = await importAccount("cible", sauvegarde)
    expect(resultat.imported.MesureCapteur).toBe(1)
    expect(resultat.skipped.MesureCapteur).toBeUndefined()
    const [creation] = mocks.createMany.mock.calls.find(([name]) => name === "mesureCapteur")![1].data
    expect(creation).not.toHaveProperty("id")
    expect(creation).toMatchObject({ capteurId: "cap-1", valeur: 12, mesureeA: new Date("2026-10-20T12:00:00Z") })
    expect(mocks.create.mock.calls.find(([name]) => name === "capteur")![1].data.userId).toBe("cible")
    expect(mocks.create.mock.calls.find(([name]) => name === "capteur")![1].data.clesRecues).toEqual(["TempC"])
  })

  it("accepte aussi un transfert direct non sérialisé", async () => {
    const resultat = await importAccount("cible", await exportAccount("source"))
    expect(resultat.imported.MesureCapteur).toBe(1)
  })

  it("refuse un entier JSON déjà arrondi au-delà de la précision JavaScript", async () => {
    const sauvegarde = await exportAccount("source")
    sauvegarde.data.MesureCapteur[0].id = Number("9007199254740993")
    await expect(importAccount("cible", sauvegarde)).rejects.toThrow("précision suffisante")
  })
})

describe("sauvegarde restaurable des capteurs (revue du 2026-10-30)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rows = {
      connecteurCapteurs: [{ id: "conn-1", userId: "source", nom: "Banc", type: "generique", jetonHash: "empreinte", jetonPrefixe: "glc_essai", fuseau: "Pacific/Noumea" }],
      capteur: [{ id: "cap-1", userId: "source", connecteurId: "conn-1", identifiantExterne: "sonde" }],
      mesureCapteur: [{ id: BigInt(1), capteurId: "cap-1", grandeur: "temperature_air", valeur: 12, unite: "°C", mesureeA: new Date("2026-10-20T12:00:00Z") }],
      mesureCapteurJour: [{ id: 7, capteurId: "cap-1", grandeur: "temperature_air", jour: new Date("2026-07-01"), min: 1, max: 3, moyenne: 2, nombre: 96, unite: "°C" }],
    }
    mocks.findMany.mockImplementation(async (name: string) => mocks.rows[name] ?? [])
    mocks.count.mockImplementation(async (name: string) => (mocks.rows[name] ?? []).length)
    mocks.create.mockImplementation(async (_name: string, { data }: { data: Record<string, unknown> }) => ({ ...data, id: data.id ?? 1 }))
    mocks.createMany.mockImplementation(async (_name: string, { data }: { data: unknown[] }) => ({ count: data.length }))
  })

  it("au-delà du seuil, n'emporte pas le brut sans le charger, garde connecteurs, capteurs et agrégats, et le dit", async () => {
    mocks.count.mockImplementation(async (name: string) => (name === "mesureCapteur" ? SEUIL_MESURES_BRUTES_EXPORT + 1 : 0))
    const sauvegarde = await exportAccount("source")
    expect(mocks.count).toHaveBeenCalledWith("mesureCapteur", {
      where: { AND: [{ OR: [{ capteurId: { in: ["cap-1"] } }] }], OR: [{ capteurId: { in: ["cap-1"] } }] },
    })
    expect(mocks.findMany).not.toHaveBeenCalledWith("mesureCapteur", expect.anything())
    expect(sauvegarde.data.MesureCapteur).toEqual([])
    expect(sauvegarde.data.ConnecteurCapteurs).toHaveLength(1)
    expect(sauvegarde.data.Capteur).toHaveLength(1)
    expect(sauvegarde.data.MesureCapteurJour).toHaveLength(1)
    expect(sauvegarde.avertissements).toEqual([expect.stringMatching(/^Mesures brutes des capteurs non incluses .*agrégats journaliers/)])
  })

  it("au seuil exactement, le brut part comme avant", async () => {
    mocks.count.mockResolvedValue(SEUIL_MESURES_BRUTES_EXPORT)
    const sauvegarde = await exportAccount("source")
    expect(sauvegarde.data.MesureCapteur).toHaveLength(1)
    expect(sauvegarde.avertissements).toEqual([])
  })

  it("réimporte le brut par lots (createMany, doublons écartés), jamais ligne par ligne", async () => {
    const sauvegarde = JSON.parse(JSON.stringify(await exportAccount("source")))
    sauvegarde.data.MesureCapteur = Array.from({ length: 2500 }, (_, i) => ({
      id: String(i + 1), capteurId: "cap-1", grandeur: "temperature_air", valeur: i, unite: "°C",
      mesureeA: new Date(Date.UTC(2026, 9, 1) + i * 60_000).toISOString(),
    }))
    mocks.createMany.mockImplementationOnce(async (_name: string, { data }: { data: unknown[] }) => ({ count: data.length - 1 }))
    const resultat = await importAccount("cible", sauvegarde)
    const lots = mocks.createMany.mock.calls.filter(([name]) => name === "mesureCapteur").map(([, args]) => args)
    expect(lots.map((l) => l.data.length)).toEqual([1000, 1000, 500])
    expect(lots.every((l) => l.skipDuplicates === true)).toBe(true)
    expect(lots[0].data[0]).not.toHaveProperty("id")
    expect(lots[0].data[0]).toMatchObject({ capteurId: "cap-1", mesureeA: new Date(Date.UTC(2026, 9, 1)) })
    expect(mocks.create).not.toHaveBeenCalledWith("mesureCapteur", expect.anything())
    expect(resultat.imported.MesureCapteur).toBe(2499)
    expect(resultat.skipped.MesureCapteur).toBe(1)
  })

  it("remplace un fuseau importé hors de la liste fermée par le défaut du projet, et le dit", async () => {
    const sauvegarde = JSON.parse(JSON.stringify(await exportAccount("source")))
    sauvegarde.data.ConnecteurCapteurs[0].fuseau = "Mars/Olympus"
    const resultat = await importAccount("cible", sauvegarde)
    const creation = mocks.create.mock.calls.find(([name]) => name === "connecteurCapteurs")![1].data
    expect(creation.fuseau).toBe("Europe/Paris")
    expect(resultat.warnings).toContainEqual(expect.stringMatching(/« Banc » : fuseau « Mars\/Olympus » inconnu, remplacé par Europe\/Paris/))
  })

  it("garde un fuseau de la liste proposée, sans avertissement", async () => {
    const resultat = await importAccount("cible", JSON.parse(JSON.stringify(await exportAccount("source"))))
    expect(mocks.create.mock.calls.find(([name]) => name === "connecteurCapteurs")![1].data.fuseau).toBe("Pacific/Noumea")
    expect(resultat.warnings.filter((w) => w.includes("fuseau"))).toEqual([])
  })
})

describe("connexion Stripe transférée (revue du 2026-10-30)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rows = {
      connexionStripe: [{
        id: "cx-source", userId: "source", compteStripeId: "acct_QAPARTAGE", jetonChiffre: "v1:jeton-chiffre-fictif",
        modeTest: false, actif: true, verrouSynchroJusqua: new Date("2026-10-30T12:00:00Z"), historiqueComplet: true, dernierTransactionId: "txn_qa1",
      }],
      compteBancaire: [{ id: "cb-source", userId: "source", nom: "Stripe · EUR", devise: "EUR", connexionStripeId: "cx-source" }],
    }
    mocks.findMany.mockImplementation(async (name: string) => mocks.rows[name] ?? [])
    mocks.count.mockResolvedValue(0)
    mocks.create.mockImplementation(async (name: string, { data }: { data: Record<string, unknown> }) => ({
      ...data, id: data.id ?? (name === "connexionStripe" ? "cx-nouvelle" : 1),
    }))
  })

  it("arrive inactive, sans jeton ni bail, sous un nouvel id suivi par ses comptes bancaires", async () => {
    const sauvegarde = JSON.parse(JSON.stringify(await exportAccount("source")))
    expect(sauvegarde.data.ConnexionStripe[0]).toMatchObject({ actif: false, jetonChiffre: "", verrouSynchroJusqua: null })

    const resultat = await importAccount("cible", sauvegarde)

    expect(resultat.imported.ConnexionStripe).toBe(1)
    const connexion = mocks.create.mock.calls.find(([name]) => name === "connexionStripe")![1].data
    // Nouvel id : la source peut encore exister sur la même instance.
    expect(connexion).not.toHaveProperty("id")
    expect(connexion).toMatchObject({
      userId: "cible", compteStripeId: "acct_QAPARTAGE", modeTest: false,
      actif: false, jetonChiffre: "", verrouSynchroJusqua: null, dernierTransactionId: "txn_qa1",
    })
    const compte = mocks.create.mock.calls.find(([name]) => name === "compteBancaire")![1].data
    expect(compte).toMatchObject({ id: "cb-source", userId: "cible", connexionStripeId: "cx-nouvelle" })
  })

  it("neutralise aussi un fichier forgé qui porterait un jeton actif", async () => {
    const sauvegarde = JSON.parse(JSON.stringify(await exportAccount("source")))
    Object.assign(sauvegarde.data.ConnexionStripe[0], { actif: true, jetonChiffre: "v1:jeton-force", verrouSynchroJusqua: "2099-01-01T00:00:00.000Z" })

    await importAccount("cible", sauvegarde)

    const connexion = mocks.create.mock.calls.find(([name]) => name === "connexionStripe")![1].data
    expect(connexion).toMatchObject({ actif: false, jetonChiffre: "", verrouSynchroJusqua: null })
  })
})

describe("sauvegarde de compte : rien qui appartienne à l'instance ou aux autres comptes (revue du 2026-11-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rows = {
      parametre: [{ id: "smtp.pass", valeur: "secret-de-l-instance" }],
      fournisseur: [{ id: "Graines SA", email: "contact@graines.example", iban: "FR7630006000011234567890189", bic: "AGRIFRPP", ribCle: "89", banqueNom: "Banque" }],
      aliment: [{ id: "foin", nom: "Foin", ownerUserId: null }],
    }
    mocks.findMany.mockImplementation(async (name: string) => mocks.rows[name] ?? [])
    mocks.count.mockImplementation(async (name: string) => (mocks.rows[name] ?? []).length)
  })

  it("n'exporte jamais les réglages de l'instance (SMTP, VAPID…)", async () => {
    const res = await exportAccount("compte-a")
    expect(res.data.Parametre).toBeUndefined()
    expect(mocks.findMany.mock.calls.some(([name]) => name === "parametre")).toBe(false)
  })

  it("exporte les fournisseurs sans IBAN, BIC ni clé RIB", async () => {
    const res = await exportAccount("compte-a")
    expect(res.data.Fournisseur).toEqual([{ id: "Graines SA", email: "contact@graines.example", banqueNom: "Banque" }])
  })

  it("ne lit que les aliments officiels et ceux du compte", async () => {
    await exportAccount("compte-a")
    const appel = mocks.findMany.mock.calls.find(([name]) => name === "aliment")
    expect(appel?.[1]).toEqual({ where: { OR: [{ ownerUserId: null }, { ownerUserId: "compte-a" }] } })
  })
})

describe("restauration sur un compte déjà rempli", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rows = {}
    mocks.findMany.mockImplementation(async () => [])
  })

  it("est annulée avant toute écriture, avec le décompte de ce qui existe", async () => {
    mocks.count.mockImplementation(async (modele: string, args: { where: { userId: string } }) =>
      modele === "planche" && args.where.userId === "cible" ? 12 : 0)
    const sauvegarde = { data: { Planche: [{ id: "p1", userId: "source", nom: "A1" }] } } as never
    const erreur = await importAccount("cible", sauvegarde).then(() => null, (e: unknown) => e)
    expect(erreur).toBeInstanceOf(ErreurCompteDejaRempli)
    expect((erreur as ErreurCompteDejaRempli).existants).toEqual({ planche: 12 })
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.createMany).not.toHaveBeenCalled()
  })

  it("ne compte que les données du compte cible", async () => {
    mocks.count.mockImplementation(async () => 0)
    await importAccount("cible", { data: {} } as never)
    const filtres = mocks.count.mock.calls.map(([, args]) => (args as { where: { userId: string } }).where.userId)
    expect(filtres.length).toBeGreaterThan(0)
    expect(new Set(filtres)).toEqual(new Set(["cible"]))
  })
})

describe("import d'un compte : aucun rattachement à l'entrée privée d'un autre compte (revue du 2026-11-11)", () => {
  const especes = [
    { id: "espece-privee-tiers", userId: "tiers", partageCommunaute: false },
    { id: "espece-partagee-tiers", userId: "tiers", partageCommunaute: true },
    { id: "espece-officielle", userId: null, partageCommunaute: false },
    { id: "espece-perso", userId: "importateur", partageCommunaute: false },
  ]
  type Filtre = { id?: { in: string[] }; AND?: Filtre[]; OR?: Array<Record<string, unknown>> }
  const correspond = (ligne: Record<string, unknown>, where: Filtre): boolean =>
    (!where.id || where.id.in.includes(ligne.id as string))
    && (where.AND ?? []).every((w) => correspond(ligne, w))
    && (!where.OR || where.OR.some((w) => Object.entries(w).every(([k, v]) => ligne[k] === v)))

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.count.mockResolvedValue(0)
    mocks.findMany.mockImplementation(async (name: string, args: { where?: Filtre }) =>
      name === "espece" ? especes.filter((e) => correspond(e, args?.where ?? {})).map(({ id }) => ({ id })) : [])
    mocks.create.mockImplementation(async (_name: string, { data }: { data: Record<string, unknown> }) => ({ id: 1, ...data }))
    mocks.createMany.mockResolvedValue({ count: 0 })
  })

  it("ne lie une culture importée qu'à une espèce officielle, partagée ou du compte", async () => {
    const resultat = await importAccount("importateur", {
      format: "2.0", exportDate: "2026-11-11", appVersion: "test", sourceUserId: "source", stats: {},
      data: {
        Espece: especes.map(({ id }) => ({ id })),
        Culture: especes.map(({ id }, i) => ({ id: i + 1, especeId: id, annee: 2026 })),
      },
    } as never)
    const liees = mocks.create.mock.calls.filter(([name]) => name === "culture").map(([, { data }]) => data.especeId)
    expect(liees).not.toContain("espece-privee-tiers")
    expect(liees).toEqual(expect.arrayContaining(["espece-partagee-tiers", "espece-officielle", "espece-perso"]))
    expect(resultat.warnings.join(" ")).toContain("1 référence(s) du fichier n'existent pas")
  })
})
