import { beforeEach, describe, expect, it, vi } from "vitest"
import { isValidElement } from "react"

const { toast } = vi.hoisted(() => ({ toast: vi.fn(() => ({ id: "1", dismiss: vi.fn(), update: vi.fn() })) }))
vi.mock("@/hooks/use-toast", () => ({ toast }))
vi.mock("@/components/ui/toast", () => ({
  ToastAction: (props: Record<string, unknown>) => props,
}))

import { DUREE_ANNULATION_MS, notifierEnregistrement } from "./notifications-ecran"

type AppelToast = { title: string; description?: string; action?: unknown; duration?: number; variant?: string }
const dernierAppel = () => (toast.mock.calls as unknown as AppelToast[][]).at(-1)?.[0] as AppelToast

describe("notifierEnregistrement", () => {
  beforeEach(() => toast.mockClear())

  it("confirme avec titre, détail et huit secondes d'annulation", () => {
    notifierEnregistrement({ titre: "Récolte notée", detail: "12 kg de poireaux · C2" })
    const appel = dernierAppel()
    expect(appel.title).toBe("Récolte notée")
    expect(appel.description).toBe("12 kg de poireaux · C2")
    expect(appel.duration).toBe(DUREE_ANNULATION_MS)
    expect(appel.action).toBeUndefined()
  })

  it("propose Annuler qui appelle l'inverse de l'action", async () => {
    const annuler = vi.fn(async () => {})
    notifierEnregistrement({ titre: "Arrosage noté", annuler })
    const action = dernierAppel().action as { props: { onClick: () => Promise<void>; altText: string } }
    expect(isValidElement(action)).toBe(true)
    expect(action.props.altText).toBe("Annuler")
    await action.props.onClick()
    expect(annuler).toHaveBeenCalledTimes(1)
  })

  it("signale un échec d'annulation sans cacher l'enregistrement", async () => {
    notifierEnregistrement({ titre: "Soin noté", annuler: async () => { throw new Error("réseau coupé") } })
    const action = dernierAppel().action as { props: { onClick: () => Promise<void> } }
    await action.props.onClick()
    const erreur = dernierAppel()
    expect(erreur.variant).toBe("destructive")
    expect(erreur.description).toBe("réseau coupé")
  })
})
