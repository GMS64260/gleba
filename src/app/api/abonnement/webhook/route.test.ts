import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const m = vi.hoisted(() => ({
  recevoir: vi.fn(),
  ErreurFacturation: class extends Error { constructor(message: string, readonly status = 503) { super(message) } },
}))
vi.mock("@/lib/abonnement/stripe", () => ({ recevoirEvenement: m.recevoir, ErreurFacturation: m.ErreurFacturation }))
import { POST } from "./route"
const evenement = () => new Request("https://gleba.example/api/abonnement/webhook", { method: "POST", headers: { "stripe-signature": "t=1,v1=signature-fictive" }, body: '{"id":"evt_fictif","client":"charge-fictive"}' })
beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { vi.restoreAllMocks() })
describe("POST /api/abonnement/webhook : trace des pannes", () => {
  it("un refus de facturation attendu ne journalise rien", async () => {
    const journal = vi.spyOn(console, "error").mockImplementation(() => {})
    m.recevoir.mockRejectedValue(new m.ErreurFacturation("Signature de paiement invalide.", 400))
    expect((await POST(evenement())).status).toBe(400)
    expect(journal).not.toHaveBeenCalled()
  })
  it("une panne inattendue garde le 503 et ne journalise que le nom de l’erreur", async () => {
    const journal = vi.spyOn(console, "error").mockImplementation(() => {})
    m.recevoir.mockRejectedValue(new TypeError("charge-fictive illisible"))
    expect((await POST(evenement())).status).toBe(503)
    expect(journal).toHaveBeenCalledWith("POST /api/abonnement/webhook error:", "TypeError")
    expect(journal.mock.calls.flat().map(String).join(" ")).not.toContain("charge-fictive")
  })
})
