/**
 * Anti-redondance des notifications : le test qui compte est « survit à un
 * redémarrage ».
 *
 * Le store était en mémoire. Le 2026-08-20, deux bascules dans la journée ont
 * rejoué des alertes déjà envoyées — une à 14:08, deux à 17:24 — et le nombre
 * grimpe à chaque compte qui active ses alertes. Le vider ici simule exactement
 * ce qu'un `docker compose up -d` fait au processus.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const bdd = new Map<string, { key: string; data: unknown; expiresAt: Date }>()
const echecEcriture = { actif: false }

vi.mock("@/lib/prisma", () => ({
  default: {
    genericCache: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) => bdd.get(where.key) ?? null),
      findMany: vi.fn(async ({ where }: { where: { key: { startsWith: string }; expiresAt: { gt: Date } } }) =>
        [...bdd.values()].filter(
          (l) => l.key.startsWith(where.key.startsWith) && l.expiresAt > where.expiresAt.gt,
        ),
      ),
      upsert: vi.fn(async ({ where, create }: { where: { key: string }; create: { key: string; data: unknown; expiresAt: Date } }) => {
        if (echecEcriture.actif) throw new Error("base indisponible")
        bdd.set(where.key, { key: create.key, data: create.data, expiresAt: create.expiresAt })
        return create
      }),
      deleteMany: vi.fn(async ({ where }: { where: { key?: string | { startsWith: string }; expiresAt?: { lt: Date } } }) => {
        let count = 0
        for (const [cle, ligne] of bdd) {
          const parCle =
            typeof where.key === "string"
              ? cle === where.key
              : where.key
                ? cle.startsWith(where.key.startsWith)
                : true
          const parExpiration = where.expiresAt ? ligne.expiresAt < where.expiresAt.lt : true
          if (parCle && parExpiration) {
            bdd.delete(cle)
            count++
          }
        }
        return { count }
      }),
    },
  },
}))

import {
  alerteDejaEnvoyee,
  marquerAlerteEnvoyee,
  nettoyerAlertesEnvoyees,
  nombreAlertesMemorisees,
  prechargerAlertesEnvoyees,
  resetStorePourTests,
} from "./store"

function jourIso(decalage: number): string {
  const d = new Date()
  d.setDate(d.getDate() + decalage)
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const j = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${j}`
}
const hierIso = () => jourIso(-1)
const demainIso = () => jourIso(1)

/** Ce que fait `docker compose up -d` : le processus repart, la base reste. */
function redemarrerLeConteneur(): void {
  resetStorePourTests()
}

describe("store anti-redondance", () => {
  beforeEach(() => {
    bdd.clear()
    echecEcriture.actif = false
    resetStorePourTests()
  })

  it("une alerte non envoyée n'est pas mémorisée", async () => {
    expect(await alerteDejaEnvoyee("gel:2026-08-10")).toBe(false)
    expect(nombreAlertesMemorisees()).toBe(0)
  })

  it("bloque une seconde notification de la même alerte active", async () => {
    const demain = demainIso()
    await marquerAlerteEnvoyee(`u1:gel:${demain}`, { until: demain })
    expect(await alerteDejaEnvoyee(`u1:gel:${demain}`)).toBe(true)
  })

  it("l'anti-redondance est scellée par utilisateur", async () => {
    const demain = demainIso()
    await marquerAlerteEnvoyee(`u1:gel:${demain}`, { until: demain })
    // L'utilisateur 2 dans la même région doit bien être notifié
    expect(await alerteDejaEnvoyee(`u2:gel:${demain}`)).toBe(false)
  })

  it("libère l'alerte une fois sa date passée (re-notification possible)", async () => {
    const hier = hierIso()
    await marquerAlerteEnvoyee(`u1:gel:${hier}`, { until: hier })
    expect(await alerteDejaEnvoyee(`u1:gel:${hier}`)).toBe(false)
  })

  it("les entrées expirées sont purgées par nettoyerAlertesEnvoyees", async () => {
    const hier = hierIso()
    await marquerAlerteEnvoyee(`u1:gel:${hier}`, { until: hier })
    await marquerAlerteEnvoyee("u1:canicule:2099-01-01")
    expect(nombreAlertesMemorisees()).toBe(2)
    await nettoyerAlertesEnvoyees()
    expect(nombreAlertesMemorisees()).toBe(1)
  })

  it("une alerte sans date de validité reste mémorisée", async () => {
    await marquerAlerteEnvoyee("u1:tache-retard:semis:123")
    expect(await alerteDejaEnvoyee("u1:tache-retard:semis:123")).toBe(true)
  })
})

describe("persistance : le redémarrage ne rejoue plus les alertes", () => {
  beforeEach(() => {
    bdd.clear()
    echecEcriture.actif = false
    resetStorePourTests()
  })

  it("une alerte du jour reste bloquée après un redémarrage (le bug du 2026-08-20)", async () => {
    const demain = demainIso()
    await marquerAlerteEnvoyee(`u1:gel:${demain}`, { until: demain })

    redemarrerLeConteneur()
    expect(nombreAlertesMemorisees()).toBe(0) // mémoire vide, comme après un `up -d`
    expect(await alerteDejaEnvoyee(`u1:gel:${demain}`)).toBe(true) // et pourtant : pas de doublon
  })

  it("une alerte sans date de validité survit aussi au redémarrage", async () => {
    await marquerAlerteEnvoyee("u1:tache-itp-semaine:S34")
    redemarrerLeConteneur()
    expect(await alerteDejaEnvoyee("u1:tache-itp-semaine:S34")).toBe(true)
  })

  it("une entrée expirée en base ne bloque pas, et est nettoyée au passage", async () => {
    const hier = hierIso()
    await marquerAlerteEnvoyee(`u1:gel:${hier}`, { until: hier })
    redemarrerLeConteneur()

    expect(await alerteDejaEnvoyee(`u1:gel:${hier}`)).toBe(false)
    expect([...bdd.keys()]).toHaveLength(0)
  })

  it("le préchargement hydrate la mémoire en UNE requête", async () => {
    const demain = demainIso()
    await marquerAlerteEnvoyee(`u1:gel:${demain}`, { until: demain })
    await marquerAlerteEnvoyee(`u2:gel:${demain}`, { until: demain })
    redemarrerLeConteneur()

    expect(await prechargerAlertesEnvoyees()).toBe(2)
    expect(nombreAlertesMemorisees()).toBe(2)
  })

  it("la date de validité couvre la JOURNÉE entière, pas son minuit", async () => {
    // Une alerte de gel pour demain doit rester scellée toute la journée de
    // demain : une expiration à minuit la rejouerait dès le lendemain matin.
    const demain = demainIso()
    await marquerAlerteEnvoyee(`u1:gel:${demain}`, { until: demain })
    const ligne = [...bdd.values()][0]
    const finDeDemain = new Date(`${demain}T23:59:59`)
    expect(ligne.expiresAt.getTime()).toBeGreaterThanOrEqual(finDeDemain.getTime())
  })

  it("une base indisponible ne casse pas le scan et protège quand même l'envoi en cours", async () => {
    echecEcriture.actif = true
    await expect(marquerAlerteEnvoyee("u1:gel:2099-01-01")).resolves.toBeUndefined()
    // Protégé jusqu'au prochain redémarrage : l'ancien comportement, en repli.
    expect(await alerteDejaEnvoyee("u1:gel:2099-01-01")).toBe(true)
  })
})
