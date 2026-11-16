/**
 * Import de l'historique SAFRAN sur PostgreSQL : demande d'une maille, import
 * sous bail, reprise après une panne, complément nocturne. Les fichiers de
 * Météo-France sont remplacés par des fichiers synthétiques : aucun appel
 * réseau.
 *
 * Inactif sans `GLEBA_AGROCLIMAT_QA_DATABASE_URL` pointant une base jetable
 * nommée `gleba_agroclimat_qa…` (jamais une base de production), migrée.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { caseDuJour } from "./calendrier"
import type { OuvrirFichier } from "./import-safran"
import { ABSENT, URL_RECENT_SAFRAN } from "./safran"

const url = process.env.GLEBA_AGROCLIMAT_QA_DATABASE_URL
const active = Boolean(url && /^\/gleba_agroclimat_qa[0-9a-z_]*$/.test(new URL(url).pathname))

// Pau (maille 3800;18170) et un point sans rapport.
const PAU = { lat: 43.3, lng: -0.37 }
const MAINTENANT = new Date("2026-11-15T12:00:00Z")

let db: PrismaClient
let historiqueDuPoint: typeof import("./historique").historiqueDuPoint
let importerMaillesDemandees: typeof import("./import-safran").importerMaillesDemandees
let actualiserMailles: typeof import("./import-safran").actualiserMailles

/** Fichiers synthétiques : une gelée le 12 avril de chaque année, et un fichier récent. */
function fichiers(options: { panneEn?: number } = {}): { ouvrir: OuvrirFichier; lus: string[] } {
  const lus: string[] = []
  const ouvrir: OuvrirFichier = async (adresse) => {
    lus.push(adresse)
    const lignes = ["LAMBX;LAMBY;DATE;TINF_H;TSUP_H"]
    if (adresse === URL_RECENT_SAFRAN) {
      lignes.push("3800;18170;20261114;-2.5;8.0", "600;24010;20261114;5.0;9.0")
    } else {
      const annee = Number(/QUOT_SIM2_(\d{4})/.exec(adresse)![1])
      if (annee === options.panneEn) throw new Error("SAFRAN : 503 simulé")
      lignes.push(`3800;18170;${annee}0412;-1.0;12.0`, `3800;18170;${annee}0701;14.0;28.0`, `600;24010;${annee}0412;3.0;9.0`)
    }
    return (async function* () {
      yield* lignes
    })()
  }
  return { ouvrir, lus }
}

describe.skipIf(!active)("import SAFRAN sur PostgreSQL isolé", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = url
    // Les imports sont lancés par le test, jamais en arrière-plan par la demande.
    process.env.GLEBA_AGROCLIMAT_IMPORT = "false"
    db = (await import("@/lib/prisma")).default
    ;({ historiqueDuPoint } = await import("./historique"))
    ;({ importerMaillesDemandees, actualiserMailles } = await import("./import-safran"))
  })

  beforeEach(async () => {
    process.env.GLEBA_AGROCLIMAT_IMPORT = "false"
    await db.climatMaille.deleteMany({})
  })

  afterAll(async () => {
    await db?.climatMaille.deleteMany({})
    await db?.$disconnect()
  })

  const importer = (options: Parameters<typeof importerMaillesDemandees>[0]) => {
    process.env.GLEBA_AGROCLIMAT_IMPORT = "true"
    return importerMaillesDemandees(options)
  }

  it("inscrit la maille à la première demande, une seule fois", async () => {
    expect((await historiqueDuPoint(PAU.lat, PAU.lng)).etat).toBe("en_preparation")
    expect((await historiqueDuPoint(PAU.lat, PAU.lng)).etat).toBe("en_preparation")
    expect((await historiqueDuPoint(-22.27, 166.45)).etat).toBe("hors_couverture")
    const mailles = await db.climatMaille.findMany()
    expect(mailles).toHaveLength(1)
    expect(mailles[0]).toMatchObject({ lambx: 3800, lamby: 18170, etat: "demandee", tentatives: 0 })
  })

  it("importe toutes les années de la maille demandée et la déclare prête", async () => {
    await historiqueDuPoint(PAU.lat, PAU.lng)
    const { ouvrir, lus } = fichiers()
    const bilan = await importer({ ouvrir, maintenant: MAINTENANT })
    expect(bilan).toEqual({ mailles: 1, annees: 36 })
    expect(lus).toHaveLength(37) // 1991 à 2026, puis le fichier récent
    expect(lus[lus.length - 1]).toBe(URL_RECENT_SAFRAN)

    const maille = await db.climatMaille.findFirstOrThrow()
    expect(maille).toMatchObject({ etat: "prete", erreur: null, verrouJeton: null, verrouJusqua: null })
    expect(maille.importeeLe).not.toBeNull()

    const historique = await historiqueDuPoint(PAU.lat, PAU.lng)
    if (historique.etat !== "pret") throw new Error("historique attendu prêt")
    expect(historique.annees).toHaveLength(36)
    expect(historique.annees[0].annee).toBe(1991)
    expect(historique.annees[0].tmin[caseDuJour(4, 12)]).toBe(-1)
    expect(historique.annees[0].tmax[caseDuJour(7, 1)]).toBe(28)
    expect(historique.annees[0].tmin[caseDuJour(1, 1)]).toBeNull()
    // Le fichier récent complète l'année en cours sans effacer le fichier annuel.
    const enCours = historique.annees[35]
    expect(enCours.annee).toBe(2026)
    expect(enCours.tmin[caseDuJour(11, 14)]).toBe(-2.5)
    expect(enCours.tmin[caseDuJour(4, 12)]).toBe(-1)
    // Aucune autre maille n'a été écrite.
    expect(await db.climatMaille.count()).toBe(1)
  })

  it("ne fait rien sans maille en attente", async () => {
    const { ouvrir, lus } = fichiers()
    expect(await importer({ ouvrir, maintenant: MAINTENANT })).toEqual({ mailles: 0, annees: 0 })
    expect(lus).toHaveLength(0)
  })

  it("garde les années lues après une panne et reprend au passage suivant", async () => {
    await historiqueDuPoint(PAU.lat, PAU.lng)
    await expect(importer({ ouvrir: fichiers({ panneEn: 2000 }).ouvrir, maintenant: MAINTENANT })).rejects.toThrow(/503/)
    let maille = await db.climatMaille.findFirstOrThrow({ include: { _count: { select: { annees: true } } } })
    expect(maille).toMatchObject({ etat: "demandee", tentatives: 1, verrouJeton: null })
    expect(maille.erreur).toContain("503")
    expect(maille._count.annees).toBe(9) // 1991 à 1999
    expect((await historiqueDuPoint(PAU.lat, PAU.lng)).etat).toBe("en_preparation")

    await importer({ ouvrir: fichiers().ouvrir, maintenant: MAINTENANT })
    maille = await db.climatMaille.findFirstOrThrow({ include: { _count: { select: { annees: true } } } })
    expect(maille).toMatchObject({ etat: "prete", erreur: null })
    expect(maille._count.annees).toBe(36)
  })

  it("abandonne après cinq pannes, puis retente la nuit suivante", async () => {
    await historiqueDuPoint(PAU.lat, PAU.lng)
    for (let i = 0; i < 5; i++) {
      await expect(importer({ ouvrir: fichiers({ panneEn: 1991 }).ouvrir, maintenant: MAINTENANT })).rejects.toThrow()
    }
    expect(await db.climatMaille.findFirstOrThrow()).toMatchObject({ etat: "echec", tentatives: 5 })
    expect((await historiqueDuPoint(PAU.lat, PAU.lng)).etat).toBe("indisponible")
    expect(await importer({ ouvrir: fichiers().ouvrir, maintenant: MAINTENANT })).toEqual({ mailles: 0, annees: 0 })

    process.env.GLEBA_AGROCLIMAT_IMPORT = "true"
    expect(await actualiserMailles({ ouvrir: fichiers().ouvrir, maintenant: MAINTENANT })).toBe(0)
    expect(await db.climatMaille.findFirstOrThrow()).toMatchObject({ etat: "demandee", tentatives: 0 })
  })

  it("laisse une maille sous bail à l'import qui la tient", async () => {
    await historiqueDuPoint(PAU.lat, PAU.lng)
    await db.climatMaille.updateMany({ data: { verrouJeton: "autre-processus", verrouJusqua: new Date(Date.now() + 60_000) } })
    const { ouvrir, lus } = fichiers()
    expect(await importer({ ouvrir, maintenant: MAINTENANT })).toEqual({ mailles: 0, annees: 0 })
    expect(lus).toHaveLength(0)
    // Bail expiré : la maille est reprise.
    await db.climatMaille.updateMany({ data: { verrouJusqua: new Date(Date.now() - 1000) } })
    expect((await importer({ ouvrir, maintenant: MAINTENANT })).mailles).toBe(1)
  })

  it("complète chaque nuit les mailles prêtes avec le fichier récent", async () => {
    await historiqueDuPoint(PAU.lat, PAU.lng)
    await importer({ ouvrir: fichiers().ouvrir, maintenant: MAINTENANT })
    const maille = await db.climatMaille.findFirstOrThrow()
    await db.climatMailleAnnee.update({
      where: { mailleId_annee: { mailleId: maille.id, annee: 2026 } },
      data: { tmin: { set: (await db.climatMailleAnnee.findFirstOrThrow({ where: { mailleId: maille.id, annee: 2026 } })).tmin.map((v, i) => (i === caseDuJour(11, 14) ? ABSENT : v)) } },
    })

    process.env.GLEBA_AGROCLIMAT_IMPORT = "true"
    const { ouvrir, lus } = fichiers()
    expect(await actualiserMailles({ ouvrir, maintenant: MAINTENANT })).toBe(1)
    expect(lus).toEqual([URL_RECENT_SAFRAN])
    const annee = await db.climatMailleAnnee.findFirstOrThrow({ where: { mailleId: maille.id, annee: 2026 } })
    expect(annee.tmin[caseDuJour(11, 14)]).toBe(-25)
    expect(annee.tmin[caseDuJour(4, 12)]).toBe(-10)
  })

  it("relit les fichiers annuels après un long arrêt", async () => {
    await historiqueDuPoint(PAU.lat, PAU.lng)
    await importer({ ouvrir: fichiers().ouvrir, maintenant: MAINTENANT })
    await db.climatMaille.updateMany({ data: { actualiseeLe: new Date("2026-08-01T00:00:00Z") } })
    process.env.GLEBA_AGROCLIMAT_IMPORT = "true"
    const { ouvrir, lus } = fichiers()
    await actualiserMailles({ ouvrir, maintenant: MAINTENANT })
    expect(lus).toHaveLength(3)
    expect(lus[2]).toBe(URL_RECENT_SAFRAN)
  })

  it("ne lance rien quand l'import est coupé", async () => {
    await historiqueDuPoint(PAU.lat, PAU.lng)
    const { ouvrir, lus } = fichiers()
    expect(await importerMaillesDemandees({ ouvrir, maintenant: MAINTENANT })).toEqual({ mailles: 0, annees: 0 })
    expect(await actualiserMailles({ ouvrir, maintenant: MAINTENANT })).toBe(0)
    expect(lus).toHaveLength(0)
  })
})
