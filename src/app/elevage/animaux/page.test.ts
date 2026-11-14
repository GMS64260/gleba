import { describe, expect, it, vi } from "vitest"
import { CONFIGS } from "@/components/premiers-pas-banner"

const mocks = vi.hoisted(() => ({ redirect: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }))

import AnimauxPage from "./page"

describe("ancienne page des animaux (FRONT-09)", () => {
  it("redirige vers le même parcours complet que les premiers pas", () => {
    mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT") })

    expect(() => AnimauxPage()).toThrow("NEXT_REDIRECT")
    const animal = CONFIGS.elevage.buildSteps({}).find((step) => step.key === "animal")
    expect(mocks.redirect).toHaveBeenCalledTimes(1)
    expect(mocks.redirect).toHaveBeenCalledWith(animal!.href)
    expect(animal!.href).toBe("/elevage?tab=animaux")
  })
})
