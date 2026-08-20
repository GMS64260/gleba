import { describe, expect, it } from "vitest"

import {
  ECART_COPIES_M,
  OBJET_COLORS,
  OBJET_COLORS_3D,
  TYPES_CONVERSION_PLANCHE,
  TYPES_OBJETS,
  TYPES_OBJETS_PAR_GROUPE,
  couleurObjet,
  gabaritObjet,
  labelTypeObjet,
  poseCopieObjet,
  typeObjet,
} from "@/lib/jardin/objets-plan"

describe("catalogue des types d'objets", () => {
  it("expose des valeurs uniques", () => {
    const valeurs = TYPES_OBJETS.map(t => t.value)
    expect(new Set(valeurs).size).toBe(valeurs.length)
  })

  it("couvre le bâti que l'éditeur ne savait pas dessiner", () => {
    const valeurs = TYPES_OBJETS.map(t => t.value)
    expect(valeurs).toContain("mur")
    expect(valeurs).toContain("cloture")
    expect(valeurs).toContain("poteau")
    expect(valeurs).toContain("batiment")
    expect(valeurs).toContain("haie")
  })

  it("donne une hauteur bâtie aux volumes verticaux, zéro aux éléments au sol", () => {
    for (const value of ["mur", "cloture", "poteau", "batiment", "haie"]) {
      expect(typeObjet(value).hauteur3D).toBeGreaterThan(0)
    }
    for (const value of ["allee", "passage", "bordure"]) {
      expect(typeObjet(value).hauteur3D).toBe(0)
    }
  })

  it("marque comme linéaires les seuls types qui se tirent en longueur", () => {
    for (const value of ["mur", "cloture", "haie", "allee", "passage", "bordure"]) {
      expect(typeObjet(value).lineaire).toBe(true)
    }
    for (const value of ["poteau", "batiment", "serre", "compost", "eau", "autre"]) {
      expect(typeObjet(value).lineaire).toBe(false)
    }
  })

  it("conserve les types historiques : aucune donnée existante ne devient inconnue", () => {
    for (const historique of ["allee", "passage", "bordure", "serre", "compost", "eau", "autre"]) {
      expect(typeObjet(historique).value).toBe(historique)
    }
  })

  it("donne à chaque type un gabarit exploitable", () => {
    for (const t of TYPES_OBJETS) {
      expect(t.gabarit.largeur).toBeGreaterThan(0)
      expect(t.gabarit.longueur).toBeGreaterThan(0)
    }
  })

  it("range tous les types dans un groupe, sans doublon ni oubli", () => {
    const groupes = TYPES_OBJETS_PAR_GROUPE.flatMap(g => g.types.map(t => t.value))
    expect(groupes.sort()).toEqual(TYPES_OBJETS.map(t => t.value).sort())
  })

  it("dérive les deux palettes du catalogue", () => {
    for (const t of TYPES_OBJETS) {
      expect(OBJET_COLORS[t.value]).toBe(t.color)
      expect(OBJET_COLORS_3D[t.value]).toBe(t.color3D)
    }
  })

  it("ne propose à la conversion que des types connus", () => {
    for (const value of TYPES_CONVERSION_PLANCHE) {
      expect(typeObjet(value).value).toBe(value)
    }
  })
})

describe("repli sur un type inconnu", () => {
  it("rend « Autre » plutôt que de casser l'affichage", () => {
    expect(typeObjet("cabane-a-outils").value).toBe("autre")
    expect(labelTypeObjet(null)).toBe("Autre")
    expect(gabaritObjet(undefined)).toEqual({ largeur: 1, longueur: 1 })
  })

  it("rend un gabarit copié, jamais la référence du catalogue", () => {
    const g = gabaritObjet("mur")
    g.largeur = 99
    expect(gabaritObjet("mur").largeur).toBe(0.2)
  })
})

describe("couleurObjet", () => {
  it("préfère la couleur personnalisée", () => {
    expect(couleurObjet("mur", "#123456")).toBe("#123456")
  })

  it("retombe sur la couleur du type puis sur celle d'« autre »", () => {
    expect(couleurObjet("mur", null)).toBe(OBJET_COLORS.mur)
    expect(couleurObjet("inconnu", null)).toBe(OBJET_COLORS.autre)
  })
})

describe("poseCopieObjet", () => {
  const mur = { posX: 10, posY: 4, largeur: 0.2, longueur: 5, rotation2D: 0 }

  it("enchaîne un élément linéaire bout à bout, sans jeu", () => {
    expect(poseCopieObjet(mur, 1, true)).toEqual({ posX: 10, posY: 9 })
    expect(poseCopieObjet(mur, 2, true)).toEqual({ posX: 10, posY: 14 })
    expect(poseCopieObjet(mur, 4, true)).toEqual({ posX: 10, posY: 24 })
  })

  it("suit l'orientation de l'objet plutôt que les axes du plan", () => {
    // Mur pivoté à 90° : sa longueur pointe vers les x décroissants.
    expect(poseCopieObjet({ ...mur, rotation2D: 90 }, 1, true)).toEqual({ posX: 5, posY: 4 })
    // À 180°, le mur repart vers le haut du plan.
    expect(poseCopieObjet({ ...mur, rotation2D: 180 }, 1, true)).toEqual({ posX: 10, posY: -1 })
    // À 270°, vers les x croissants.
    expect(poseCopieObjet({ ...mur, rotation2D: 270 }, 1, true)).toEqual({ posX: 15, posY: 4 })
  })

  it("garde les copies jointives quel que soit l'angle", () => {
    for (const rotation2D of [0, 15, 45, 90, 135, 210, 359]) {
      const copie = poseCopieObjet({ ...mur, rotation2D }, 1, true)
      const ecart = Math.hypot(copie.posX - mur.posX, copie.posY - mur.posY)
      expect(ecart).toBeCloseTo(mur.longueur, 1)
    }
  })

  it("pose un objet non linéaire côte à côte, avec un jeu de dégagement", () => {
    const cabane = { posX: 0, posY: 0, largeur: 4, longueur: 6, rotation2D: 0 }
    expect(poseCopieObjet(cabane, 1, false)).toEqual({ posX: 4 + ECART_COPIES_M, posY: 0 })
    expect(poseCopieObjet(cabane, 2, false)).toEqual({ posX: 2 * (4 + ECART_COPIES_M), posY: 0 })
  })

  it("ne renvoie jamais la position de la source (une copie superposée serait invisible)", () => {
    for (const lineaire of [true, false]) {
      const copie = poseCopieObjet(mur, 1, lineaire)
      expect(`${copie.posX},${copie.posY}`).not.toBe(`${mur.posX},${mur.posY}`)
    }
  })

  it("arrondit au centimètre pour éviter la dérive sur les angles obliques", () => {
    const copie = poseCopieObjet({ ...mur, rotation2D: 37 }, 3, true)
    expect(copie.posX).toBe(Math.round(copie.posX * 100) / 100)
    expect(copie.posY).toBe(Math.round(copie.posY * 100) / 100)
  })
})
