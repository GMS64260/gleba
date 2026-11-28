import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  rows: {} as Record<string, Array<Record<string, unknown>>>,
  create: vi.fn(),
  createMany: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
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
        findFirst: (args: unknown) => mocks.findFirst(name, args),
        count: (args: unknown) => mocks.count(name, args),
        create: (args: { data: Record<string, unknown> }) => mocks.create(name, args),
        createMany: (args: { data: Array<Record<string, unknown>>; skipDuplicates?: boolean }) => mocks.createMany(name, args),
      }
    },
  })
  return { default: client }
})

import { Prisma } from "@prisma/client"
import { ErreurCompteDejaRempli, describeManifest, exportAccount, importAccount } from "./account-transfer"
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

  // Version de fiche : compteur technique, ni sauvegardé ni restauré.
  it("ne sort pas la version de fiche d'une culture dans la sauvegarde", async () => {
    mocks.rows.culture = [{ id: 7, userId: "source", especeId: "laitue", annee: 2026, version: 12 }]
    const sauvegarde = await exportAccount("source")
    expect(sauvegarde.data.Culture).toEqual([expect.objectContaining({ id: 7, annee: 2026 })])
    expect(sauvegarde.data.Culture[0]).not.toHaveProperty("version")
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
    mocks.count.mockImplementation(async (name: string) => (name === "mesureCapteur" ? SEUIL_MESURES_BRUTES_EXPORT : 0))
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

  // FB-GJLDGZ : une espèce personnelle du fichier, absente ou invisible sur le
  // compte cible, était traitée comme introuvable ; ses cultures étaient
  // abandonnées sous « Restauration réussie ».
  it("recrée pour le compte une espèce personnelle du fichier et y rattache ses cultures", async () => {
    mocks.findFirst.mockResolvedValue(null)
    const resultat = await importAccount("importateur", {
      format: "2.0", exportDate: "2026-11-22", appVersion: "test", sourceUserId: "source", stats: {},
      data: {
        Espece: [
          { id: "cmespecesource", nom: "Tomate de la ferme", nomNormalise: "tomate de la ferme", userId: "source", partageCommunaute: true },
          { id: "espece-privee-tiers", nom: "Recopiée d'un tiers", nomNormalise: "recopiee d un tiers", userId: "tiers", partageCommunaute: false },
        ],
        Culture: [{ id: 1, especeId: "cmespecesource", annee: 2026 }, { id: 2, especeId: "espece-privee-tiers", annee: 2026 }],
      },
    } as never)
    const creees = mocks.create.mock.calls.filter(([name]) => name === "espece").map(([, { data }]) => data)
    expect(creees).toHaveLength(2)
    for (const espece of creees) {
      // Toujours une copie du compte, privée, sous un nouvel identifiant : jamais l'entrée d'un autre.
      expect(espece).toMatchObject({ userId: "importateur", partageCommunaute: false })
      expect(["cmespecesource", "espece-privee-tiers"]).not.toContain(espece.id)
    }
    const liees = mocks.create.mock.calls.filter(([name]) => name === "culture").map(([, { data }]) => data.especeId)
    expect(liees).toEqual(creees.map((e) => e.id))
    expect(resultat.imported.Espece).toBe(2)
    expect(resultat.warnings.join(" ")).not.toContain("n'existent pas")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Équipe debug, D76, D77 et D93 (2026-11-26) : types de champ et couverture
// ─────────────────────────────────────────────────────────────────────────────

describe("types de champ du schéma : rien ne se perd ni ne bloque la restauration (D76, D93)", () => {
  const manifeste = describeManifest()
  const transportes = new Set([...manifeste.byClass.owned, ...manifeste.byClass.child])

  it("tout champ scalaire OU énuméré d'un modèle sauvegardé fait partie des champs copiés", () => {
    const oublies: string[] = []
    for (const modele of Prisma.dmmf.datamodel.models) {
      if (!transportes.has(modele.name)) continue
      const copies = new Set(manifeste.champs[modele.name])
      for (const champ of modele.fields) {
        // Une clé primaire entière n'est pas copiée : la base la régénère.
        if (champ.isId) continue
        if ((champ.kind === "scalar" || champ.kind === "enum") && !copies.has(champ.name)) oublies.push(`${modele.name}.${champ.name}`)
      }
    }
    expect(oublies).toEqual([])
  })

  it("tout type scalaire d'un modèle sauvegardé est connu du codec", () => {
    // Un type nouveau doit être examiné : se sérialise-t-il en JSON, et se relit-il ?
    const connus = new Set(["String", "Int", "Float", "Boolean", "DateTime", "Json", "BigInt", "Decimal", "Bytes"])
    const inconnus = new Set<string>()
    for (const modele of Prisma.dmmf.datamodel.models) {
      if (!transportes.has(modele.name)) continue
      for (const champ of modele.fields) if (champ.kind === "scalar" && !connus.has(champ.type)) inconnus.add(`${modele.name}.${champ.name}: ${champ.type}`)
    }
    expect([...inconnus]).toEqual([])
  })

  it("la modération communautaire et les adhésions ne sont ni exportées ni réimportées", async () => {
    expect(manifeste.byClass.excluded).toEqual(expect.arrayContaining(["Signalement", "MembreExploitation", "MediaReferentiel"]))
    vi.clearAllMocks()
    mocks.findMany.mockImplementation(async (name: string) =>
      name === "signalement" ? [{ id: "sig-1", userId: "source", refType: "ESPECE", refId: "e1", motif: "doublon" }]
        : name === "membreExploitation" ? [{ id: "adh-1", userId: "source", proprietaireId: "autre-ferme", email: "a@exemple.test", role: "MEMBRE" }]
          : [])
    mocks.count.mockImplementation(async () => 0)
    const sauvegarde = await exportAccount("source")
    expect(sauvegarde.data).not.toHaveProperty("Signalement")
    expect(sauvegarde.data).not.toHaveProperty("MembreExploitation")

    // Un fichier ancien (ou forgé) qui en contient reste restaurable, sans les écrire.
    mocks.create.mockImplementation(async (_name: string, { data }: { data: Record<string, unknown> }) => ({ ...data, id: data.id ?? 1 }))
    mocks.createMany.mockImplementation(async (_name: string, { data }: { data: unknown[] }) => ({ count: data.length }))
    await importAccount("cible", {
      format: "2.0",
      data: {
        Signalement: [{ id: "sig-1", userId: "source", refId: "e1", motif: "doublon" }],
        MembreExploitation: [{ id: "adh-1", userId: "source", proprietaireId: "victime", email: "a@exemple.test", role: "MEMBRE" }],
      },
    } as never)
    const ecrits = [...mocks.create.mock.calls, ...mocks.createMany.mock.calls].map(([nom]) => String(nom))
    expect(ecrits.filter((nom) => nom === "signalement" || nom === "membreExploitation")).toEqual([])
  })

  it("relit un contenu binaire, au format actuel (base64) comme au format des fichiers déjà téléchargés", async () => {
    vi.clearAllMocks()
    mocks.findMany.mockImplementation(async () => [])
    mocks.count.mockImplementation(async () => 0)
    mocks.create.mockImplementation(async (_name: string, { data }: { data: Record<string, unknown> }) => ({ ...data, id: data.id ?? 1 }))
    mocks.createMany.mockImplementation(async (_name: string, { data }: { data: unknown[] }) => ({ count: data.length }))
    const tentative = (id: string, contenu: unknown) => ({
      id, userId: "source", nomFichier: "releve.csv", contenu, tailleOctets: 3, empreinte: "e".repeat(64), source: "fichier", statut: "importe",
    })
    const octets = Buffer.from([37, 80, 68])
    await importAccount("cible", {
      format: "2.0",
      data: {
        TentativeImportReleve: [
          tentative("t-base64", octets.toString("base64")),
          tentative("t-buffer-json", JSON.parse(JSON.stringify(octets))),
          tentative("t-uint8-json", JSON.parse(JSON.stringify(new Uint8Array(octets)))),
          tentative("t-sans-contenu", null),
        ],
      },
    } as never)
    const crees = [
      ...mocks.create.mock.calls.filter(([nom]) => nom === "tentativeImportReleve").map(([, args]) => args.data),
      ...mocks.createMany.mock.calls.filter(([nom]) => nom === "tentativeImportReleve").flatMap(([, args]) => args.data),
    ] as Array<{ contenu: unknown }>
    expect(crees).toHaveLength(4)
    for (const ligne of crees.slice(0, 3)) {
      expect(Buffer.isBuffer(ligne.contenu)).toBe(true)
      expect([...(ligne.contenu as Buffer)]).toEqual([37, 80, 68])
    }
    expect(crees[3].contenu).toBeNull()
  })

  // Contre-relecture du 2026-11-26 : une photo du référentiel n'a pas de
  // propriétaire ; forgée « validée » dans un fichier, elle se serait publiée
  // sans modération.
  it("n'écrit jamais une photo du référentiel portée par un fichier de sauvegarde", async () => {
    vi.clearAllMocks()
    mocks.findMany.mockImplementation(async () => [])
    mocks.count.mockImplementation(async () => 0)
    mocks.create.mockImplementation(async (_name: string, { data }: { data: Record<string, unknown> }) => ({ ...data, id: data.id ?? 1 }))
    mocks.createMany.mockImplementation(async (_name: string, { data }: { data: unknown[] }) => ({ count: data.length }))
    await importAccount("cible", {
      format: "2.0",
      data: { MediaReferentiel: [{ id: "m1", especeId: "tomate", source: "WIKIMEDIA_COMMONS", statut: "VALIDE", principale: true, url: "/uploads/referentiel/membre/x-1200.jpg", auteur: "x", licence: "x", citation: "x", organe: "fruit" }] },
    } as never)
    const ecrits = [...mocks.create.mock.calls, ...mocks.createMany.mock.calls].map(([nom]) => String(nom))
    expect(ecrits).not.toContain("mediaReferentiel")
  })

  it("n'écrit aucune ligne d'un modèle sans propriétaire que rien ne rattache au compte", async () => {
    // Aucun modèle « enfant » sans lien vers une donnée transportée ne doit
    // rester importable : la liste se recalcule sur le schéma courant.
    const orphelins = Prisma.dmmf.datamodel.models
      .filter((m) => manifeste.byClass.child.includes(m.name))
      .filter((m) => !m.fields.some((f) => f.kind === "object" && f.relationFromFields?.length && f.type !== m.name && transportes.has(f.type)))
      .map((m) => m.name)
    expect(orphelins).toContain("ImpersonationGrant")
    vi.clearAllMocks()
    mocks.findMany.mockImplementation(async () => [])
    mocks.count.mockImplementation(async () => 0)
    mocks.create.mockImplementation(async (_name: string, { data }: { data: Record<string, unknown> }) => ({ ...data, id: data.id ?? 1 }))
    mocks.createMany.mockImplementation(async (_name: string, { data }: { data: unknown[] }) => ({ count: data.length }))
    const resultat = await importAccount("cible", {
      format: "2.0",
      data: Object.fromEntries(orphelins.map((nom) => [nom, [{ id: "forge-1", tokenHash: "a".repeat(64), adminId: "admin", targetId: "victime", expiresAt: "2099-01-01T00:00:00.000Z", adminSessionVersion: 0 }]])),
    } as never)
    expect([...mocks.create.mock.calls, ...mocks.createMany.mock.calls]).toEqual([])
    expect(resultat.skipped).toMatchObject({ ImpersonationGrant: 1 })
  })

  it("refuse un contenu binaire illisible avec un motif, au lieu d'une erreur de base", async () => {
    vi.clearAllMocks()
    mocks.findMany.mockImplementation(async () => [])
    mocks.count.mockImplementation(async () => 0)
    await expect(importAccount("cible", {
      format: "2.0",
      data: { TentativeImportReleve: [{ id: "t1", userId: "source", contenu: { n: "importe quoi" }, tailleOctets: 1, empreinte: "e", source: "fichier", statut: "importe" }] },
    } as never)).rejects.toThrow(/binaire illisible/)
  })
})

describe("la sauvegarde dit ce qu'elle ne contient pas (D77)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findMany.mockImplementation(async () => [])
  })

  it("annonce la boutique en ligne non incluse, avec ses volumes", async () => {
    mocks.count.mockImplementation(async (name: string) => ({ boutique: 1, produitBoutique: 11, commandeBoutique: 3 }[name] ?? 0))
    const { avertissements } = await exportAccount("source")
    expect(avertissements).toHaveLength(1)
    expect(avertissements![0]).toContain("Boutique en ligne non incluse")
    expect(avertissements![0]).toContain("11 produits")
    expect(avertissements![0]).toContain("3 commandes")
    expect(mocks.count).toHaveBeenCalledWith("produitBoutique", { where: { userId: "source" } })
  })

  it("ne dit rien pour un compte sans boutique", async () => {
    mocks.count.mockImplementation(async () => 0)
    expect((await exportAccount("source")).avertissements).toEqual([])
  })
})
