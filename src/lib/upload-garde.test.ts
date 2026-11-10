import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const mocks = vi.hoisted(() => ({ refusDemo: vi.fn(), debit: vi.fn() }))
vi.mock("@/lib/demo-garde", () => ({ MESSAGES_REFUS_DEMO: { envoiFichier: "démo" }, refusSiCompteDemo: mocks.refusDemo }))
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.debit }))

import { dossierEnvoi, extensionReelle, QUOTAS_ENVOI, refusEnvoiFichier, volumeDossier } from "./upload-garde"

let racine: string
beforeEach(async () => {
  racine = await mkdtemp(path.join(os.tmpdir(), "gleba-upload-"))
  vi.spyOn(process, "cwd").mockReturnValue(racine)
  mocks.refusDemo.mockResolvedValue(null)
  mocks.debit.mockReturnValue(null)
})
afterEach(async () => {
  vi.restoreAllMocks()
  await rm(racine, { recursive: true, force: true })
})

describe("gardes des envois de fichiers", () => {
  it("refuse le compte de démonstration avant toute autre lecture", async () => {
    const refus = { status: 403 }
    mocks.refusDemo.mockResolvedValue(refus)
    expect(await refusEnvoiFichier("image", "user1", 10)).toBe(refus)
    expect(mocks.debit).not.toHaveBeenCalled()
  })

  it("limite le débit par compte et par type d’envoi", async () => {
    const refus = { status: 429 }
    mocks.debit.mockReturnValue(refus)
    expect(await refusEnvoiFichier("justificatif", "user1", 10)).toBe(refus)
    expect(mocks.debit).toHaveBeenCalledWith("upload:justificatif:user1", { windowMs: 600_000, max: QUOTAS_ENVOI.justificatif.envoisParDixMinutes })
  })

  it("laisse passer un envoi sous le quota, dossier absent compris", async () => {
    expect(await refusEnvoiFichier("image", "user1", 1024)).toBeNull()
  })

  it("refuse l’envoi qui ferait dépasser le quota du compte, sans compter le dossier d’un autre", async () => {
    const dossier = dossierEnvoi("image", "user1")
    await mkdir(dossier, { recursive: true })
    await writeFile(path.join(dossier, "a.jpg"), Buffer.alloc(2048))
    await mkdir(dossierEnvoi("image", "user2"), { recursive: true })
    await writeFile(path.join(dossierEnvoi("image", "user2"), "b.jpg"), Buffer.alloc(4096))
    expect(await volumeDossier(dossier)).toBe(2048)
    const refus = await refusEnvoiFichier("image", "user1", QUOTAS_ENVOI.image.octets - 2047)
    expect(refus?.status).toBe(413)
    expect((await refus!.json()).code).toBe("QUOTA_STOCKAGE")
    expect(await refusEnvoiFichier("image", "user1", QUOTAS_ENVOI.image.octets - 2048)).toBeNull()
  })

  it("refuse un identifiant de compte qui sortirait du dossier", () => {
    expect(() => dossierEnvoi("image", "../autre")).toThrow()
    expect(dossierEnvoi("justificatif", "cmabc_12-x")).toBe(path.join(racine, "storage", "justificatifs", "cmabc_12-x"))
  })

  it("reconnaît le format au contenu, pas au type annoncé", () => {
    expect(extensionReelle(Buffer.from("%PDF-1.7\n"))).toBe("pdf")
    expect(extensionReelle(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg")
    expect(extensionReelle(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png")
    expect(extensionReelle(Buffer.from("<html><script>"))).toBeNull()
    expect(extensionReelle(new Uint8Array())).toBeNull()
  })
})
