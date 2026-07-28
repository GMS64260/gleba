import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
}))

vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }))

import {
  ErreurFichierJustificatif,
  verifierFichierJustificatif,
} from "./justificatif-fichier.server"

const url = "/api/upload/justificatif/123e4567-e89b-42d3-a456-426614174000.pdf"

describe("intégrité d’un fichier justificatif", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calcule la taille et l’empreinte depuis la copie serveur du compte", async () => {
    mocks.readFile.mockResolvedValue(Buffer.from("abc"))

    await expect(verifierFichierJustificatif("user-1", url)).resolves.toEqual({
      tailleOctets: 3,
      empreinteSha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    })
    expect(mocks.readFile).toHaveBeenCalledWith(expect.stringContaining(
      "storage/justificatifs/user-1/123e4567-e89b-42d3-a456-426614174000.pdf",
    ))
  })

  it("refuse une référence dont le fichier n’existe pas dans le compte", async () => {
    mocks.readFile.mockRejectedValue(new Error("ENOENT"))

    await expect(verifierFichierJustificatif("user-1", url))
      .rejects.toBeInstanceOf(ErreurFichierJustificatif)
  })
})
