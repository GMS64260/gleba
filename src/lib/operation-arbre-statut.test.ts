import { describe, expect, it } from "vitest"
import {
  debutDeJour,
  estActionnable,
  libelleCourtOperation,
  libelleFenetre,
  statutOperationArbre,
} from "./operation-arbre-statut"

const AOUT_3 = new Date(2026, 7, 3)

describe("statutOperationArbre", () => {
  it("classe une fenêtre encore ouverte comme à faire, même si la date conseillée est passée", () => {
    // Le cas de production : taille en vert conseillée le 15/06, fenêtre
    // juin-juillet. Le 3 août la fenêtre est fermée ; le 3 juillet non.
    const statut = statutOperationArbre(
      {
        fait: false,
        datePrevue: new Date(2026, 5, 15),
        dateLimite: new Date(2026, 6, 31),
      },
      new Date(2026, 6, 3)
    )
    expect(statut).toBe("a_faire")
    expect(estActionnable(statut)).toBe(true)
  })

  it("ne déclare jamais « en retard » une opération à fenêtre : elle est dépassée", () => {
    const statut = statutOperationArbre(
      {
        fait: false,
        datePrevue: new Date(2026, 5, 15),
        dateLimite: new Date(2026, 6, 31),
      },
      AOUT_3
    )
    expect(statut).toBe("fenetre_depassee")
    expect(estActionnable(statut)).toBe(false)
  })

  it("conserve le retard d'une échéance ferme saisie à la main", () => {
    // Sans fenêtre, l'utilisateur a choisi la date : un rappel antidaté est un
    // signal volontaire, il doit rester visible.
    const statut = statutOperationArbre(
      { fait: false, datePrevue: new Date(2026, 6, 20), dateLimite: null },
      AOUT_3
    )
    expect(statut).toBe("en_retard")
    expect(estActionnable(statut)).toBe(true)
  })

  it("distingue à venir, fait et soldé", () => {
    expect(
      statutOperationArbre(
        { fait: false, datePrevue: new Date(2026, 8, 10), dateLimite: new Date(2026, 9, 31) },
        AOUT_3
      )
    ).toBe("a_venir")
    expect(
      statutOperationArbre({ fait: true, datePrevue: new Date(2026, 5, 15) }, AOUT_3)
    ).toBe("faite")
    expect(
      statutOperationArbre(
        {
          fait: false,
          datePrevue: new Date(2026, 5, 15),
          dateLimite: new Date(2026, 6, 31),
          abandonneeLe: new Date(2026, 7, 3),
        },
        AOUT_3
      )
    ).toBe("soldee")
  })

  it("traite une opération conseillée aujourd'hui comme à faire, pas comme à venir", () => {
    expect(
      statutOperationArbre(
        { fait: false, datePrevue: AOUT_3, dateLimite: new Date(2026, 8, 30) },
        AOUT_3
      )
    ).toBe("a_faire")
  })

  it("accepte les dates sérialisées et ignore les valeurs illisibles", () => {
    expect(
      statutOperationArbre(
        { fait: false, datePrevue: "2026-06-15T00:00:00.000Z", dateLimite: "2026-07-31T00:00:00.000Z" },
        AOUT_3
      )
    ).toBe("fenetre_depassee")
    expect(
      statutOperationArbre({ fait: false, datePrevue: "pas-une-date" }, AOUT_3)
    ).toBe("a_faire")
  })

  it("normalise le jour de référence à minuit local", () => {
    const jour = debutDeJour(new Date(2026, 7, 3, 18, 42))
    expect(jour.getHours()).toBe(0)
    expect(jour.getDate()).toBe(3)
  })
})

describe("libelleCourtOperation", () => {
  it("isole le libellé du détail agronomique", () => {
    expect(
      libelleCourtOperation("Taille en vert — Pincement des pousses vigoureuses")
    ).toBe("Taille en vert")
  })

  it("retombe sur la description entière sans séparateur", () => {
    expect(libelleCourtOperation("Désherbage du pied")).toBe("Désherbage du pied")
    expect(libelleCourtOperation(null)).toBe("Opération")
  })
})

describe("libelleFenetre", () => {
  it("nomme la fenêtre comme un arboriculteur", () => {
    expect(libelleFenetre(new Date(2026, 5, 1), new Date(2026, 6, 31))).toBe("juin-juillet")
    expect(libelleFenetre(new Date(2026, 8, 1), new Date(2026, 8, 30))).toBe("septembre")
  })

  it("reste silencieux sans fenêtre", () => {
    expect(libelleFenetre(null, new Date(2026, 6, 31))).toBeNull()
  })
})
