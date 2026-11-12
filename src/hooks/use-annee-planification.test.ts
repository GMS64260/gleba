import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ useSearchParams: vi.fn(), usePathname: vi.fn(), useRouter: vi.fn() }))

import { etatPourDemande } from "./use-annee-planification"

describe("état d’un écran de planification pour la demande courante", () => {
  const recu2026 = { cle: "0:/api/planification/plants?annee=2026", resultat: { data: [1, 2] }, erreur: false }

  it("affiche la réponse de la demande courante", () => {
    expect(etatPourDemande(recu2026, recu2026.cle)).toEqual({ resultat: { data: [1, 2] }, erreur: false, chargement: false })
  })

  it("n’affiche pas les données d’une autre saison pendant le chargement de la nouvelle", () => {
    expect(etatPourDemande(recu2026, "0:/api/planification/plants?annee=2027")).toEqual({
      resultat: null,
      erreur: false,
      chargement: true,
    })
  })

  it("après un échec : ni données de la saison précédente, ni liste « vide », mais une erreur", () => {
    const echec = { cle: "0:/api/planification/plants?annee=2027", resultat: null, erreur: true }
    expect(etatPourDemande(echec, echec.cle)).toEqual({ resultat: null, erreur: true, chargement: false })
  })

  it("ignore une réponse arrivée en retard pour une demande abandonnée", () => {
    // 2026 → 2027 → 2026 (tour suivant) : la première réponse 2027, tardive, ne vaut pas.
    const tardive = { cle: "0:/api/planification/plants?annee=2027", resultat: { data: [9] }, erreur: false }
    expect(etatPourDemande(tardive, "0:/api/planification/plants?annee=2026").resultat).toBeNull()
    expect(etatPourDemande(tardive, "1:/api/planification/plants?annee=2027").chargement).toBe(true)
  })

  it("reste en chargement tant que la saison mémorisée n’est pas restaurée", () => {
    expect(etatPourDemande(null, null)).toEqual({ resultat: null, erreur: false, chargement: true })
    expect(etatPourDemande(recu2026, null).chargement).toBe(true)
  })
})
