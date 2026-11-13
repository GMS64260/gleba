import { describe, expect, it } from "vitest"
import { segmentsUpload } from "./uploads-chemin"

const PHOTO = "0f8fad5b-d9cb-469f-a165-70867728950e-1200.jpg"

describe("segmentsUpload : chemin /uploads lu comme le service statique le résout", () => {
  it("rend les segments décodés d'une photo, d'un ancien justificatif et d'un nom encodé", () => {
    expect(segmentsUpload(`/uploads/compte-a/${PHOTO}`)).toEqual(["compte-a", PHOTO])
    expect(segmentsUpload("/uploads/compte-a/justificatifs/facture%20mars.pdf")).toEqual(["compte-a", "justificatifs", "facture mars.pdf"])
  })

  it("garde un nom qui porte un % littéral ou un double encodage sans remontée", () => {
    expect(segmentsUpload("/uploads/compte-a/justificatifs/remise%2010%25.pdf")).toEqual(["compte-a", "justificatifs", "remise 10%.pdf"])
    expect(segmentsUpload("/uploads/compte-a/facture%2520mars.pdf")).toEqual(["compte-a", "facture%20mars.pdf"])
  })

  it("une barre encodée devient un séparateur, comme sur le disque (preuve HTTP du 2026-11-13)", () => {
    expect(segmentsUpload(`/uploads/compte-b%2F${PHOTO}`)).toEqual(["compte-b", PHOTO])
    expect(segmentsUpload(`/uploads/compte-b%2f${PHOTO}`)).toEqual(["compte-b", PHOTO])
  })

  it.each([
    [`/uploads/compte-a/..%2Fcompte-b%2F${PHOTO}`, "remontée encodée"],
    [`/uploads/compte-a/%2E%2E/compte-b/${PHOTO}`, "points encodés"],
    [`/uploads/compte-a/%2e%2e%2Fcompte-b%2F${PHOTO}`, "points et barre encodés"],
    [`/uploads/compte-a/..%252Fcompte-b%252F${PHOTO}`, "remontée doublement encodée"],
    [`/uploads/compte-a/%252e%252e%252Fcompte-b%252F${PHOTO}`, "points doublement encodés"],
    [`/uploads/compte-a/..%255Ccompte-b%255C${PHOTO}`, "barre inverse doublement encodée"],
    [`/uploads/compte-b%5C${PHOTO}`, "barre oblique inverse seule"],
    [`/uploads/compte-a/./${PHOTO}`, "segment point"],
    [`/uploads//compte-b/${PHOTO}`, "segment vide"],
    [`/uploads/compte-a/${PHOTO}/`, "barre finale"],
    [`/uploads/compte-a/..%5Ccompte-b%5C${PHOTO}`, "barre oblique inverse"],
    [`/uploads/compte-a/x%00.jpg`, "caractère nul"],
    ["/uploads/compte-a/%E0%A4%A.jpg", "encodage cassé"],
    ["/uploads/", "racine seule"],
  ])("refuse %s (%s)", (chemin) => {
    expect(segmentsUpload(chemin)).toBeNull()
  })

  it("reconnaît /uploads sur le chemin décodé, quelle que soit la lettre encodée (régression photosRacineEncodee)", () => {
    expect(segmentsUpload(`/%75ploads/compte-a/${PHOTO}`)).toEqual(["compte-a", PHOTO])
    expect(segmentsUpload(`/u%70loads/compte-a/${PHOTO}`)).toEqual(["compte-a", PHOTO])
    expect(segmentsUpload(`/uploads%2Fcompte-a%2F${PHOTO}`)).toEqual(["compte-a", PHOTO])
    expect(segmentsUpload("/%75ploads/compte-a/justificatifs/facture.pdf")).toEqual(["compte-a", "justificatifs", "facture.pdf"])
  })

  it("rend undefined pour un chemin qui n'est pas sous /uploads une fois décodé", () => {
    expect(segmentsUpload("/")).toBeUndefined()
    expect(segmentsUpload("/maraichage/cultures")).toBeUndefined()
    expect(segmentsUpload("/login/")).toBeUndefined()
    expect(segmentsUpload("/boutique/ferme%20du%20pr%C3%A9")).toBeUndefined()
    expect(segmentsUpload("/uploadsx/compte-a/a.jpg")).toBeUndefined()
    expect(segmentsUpload("/api/uploads/compte-a/a.jpg")).toBeUndefined()
    // Un seul décodage, comme le service statique : `%2575` reste `%75`.
    expect(segmentsUpload(`/%2575ploads/compte-a/${PHOTO}`)).toBeUndefined()
  })

  it.each([
    ["/uploads", "racine nue"],
    ["/%75ploads", "racine nue encodée"],
    [`/x/..%2Fuploads%2Fcompte-a%2F${PHOTO}`, "remontée encodée depuis un autre préfixe"],
    [`/models/..%2Fuploads%2Fcompte-a%2F${PHOTO}`, "remontée depuis /models"],
    [`/x/..%5Cuploads%5Ccompte-a%5C${PHOTO}`, "barre oblique inverse hors /uploads"],
    ["/maraichage/%2E%2E", "remontée finale"],
    ["/maraichage/%E0%A4%A", "encodage cassé hors /uploads"],
  ])("refuse %s (%s), quel que soit le préfixe", (chemin) => {
    expect(segmentsUpload(chemin)).toBeNull()
  })
})
