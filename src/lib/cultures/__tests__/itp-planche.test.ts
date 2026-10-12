/**
 * Conduite d'un ITP contre le type de la planche (ticket QA cmv4z6yhg) : une
 * planche sans type ne reçoit pas d'office un ITP « sous abri », ni « plein
 * champ » ; le choix manuel reste libre et l'incompatibilité est nommée.
 */
import { describe, expect, it } from "vitest"

import {
  avertissementItpPlanche,
  choisirItpParDefaut,
  conduiteItp,
  conduitePlanche,
  verdictItpPlanche,
} from "../itp-planche"

const ABRI = { id: "INRAE-0441", typePlanche: "Sous abri" }
const CHAMP = { id: "INRAE-0454", typePlanche: "Plein champ" }
const LIBRE = { id: "QA-perso", typePlanche: null }

describe("conduite", () => {
  it("lit la conduite de l'ITP et le type de la planche avec la règle de l'arrosage", () => {
    expect(conduiteItp("Sous abri")).toBe("abri")
    expect(conduiteItp("Plein champ")).toBe("plein_champ")
    expect(conduiteItp(null)).toBeNull()
    expect(conduitePlanche("Serre")).toBe("abri")
    expect(conduitePlanche("Tunnel")).toBe("abri")
    expect(conduitePlanche("Châssis")).toBe("abri")
    expect(conduitePlanche("Plein champ")).toBe("plein_champ")
    expect(conduitePlanche("")).toBeNull()
    expect(conduitePlanche(undefined)).toBeNull()
  })
})

describe("verdictItpPlanche", () => {
  it("sans planche ou sans conduite imposée, rien à redire", () => {
    expect(verdictItpPlanche(ABRI, null)).toEqual({ etat: "sans_planche" })
    expect(verdictItpPlanche(LIBRE, { type: null })).toEqual({ etat: "sans_conduite" })
    expect(verdictItpPlanche(null, { type: "Serre" })).toEqual({ etat: "sans_conduite" })
  })
  it("planche sans type : conduite invérifiable, nommée", () => {
    expect(verdictItpPlanche(ABRI, { type: null })).toEqual({ etat: "planche_sans_type", conduite: "abri" })
    expect(verdictItpPlanche(CHAMP, { type: "" })).toEqual({ etat: "planche_sans_type", conduite: "plein_champ" })
  })
  it("planche typée : compatible ou incompatible", () => {
    expect(verdictItpPlanche(ABRI, { type: "Tunnel" })).toEqual({ etat: "compatible", conduite: "abri" })
    expect(verdictItpPlanche(CHAMP, { type: "Plein champ" })).toEqual({ etat: "compatible", conduite: "plein_champ" })
    expect(verdictItpPlanche(ABRI, { type: "Plein champ" })).toEqual({ etat: "incompatible", conduite: "abri", planche: "plein_champ" })
    expect(verdictItpPlanche(CHAMP, { type: "Serre" })).toEqual({ etat: "incompatible", conduite: "plein_champ", planche: "abri" })
  })
})

describe("choisirItpParDefaut", () => {
  it("sans planche : le premier par confiance, comme avant", () => {
    expect(choisirItpParDefaut([ABRI, CHAMP], null)).toEqual({ itp: ABRI, motif: "premier" })
    expect(choisirItpParDefaut([], null)).toEqual({ itp: null, motif: "aucun" })
  })
  it("planche sans type : jamais un ITP à conduite imposée (cas du ticket)", () => {
    expect(choisirItpParDefaut([ABRI, CHAMP], { type: null })).toEqual({ itp: null, motif: "planche_sans_type" })
    expect(choisirItpParDefaut([LIBRE, ABRI, CHAMP], { type: null })).toEqual({ itp: LIBRE, motif: "sans_conduite" })
  })
  it("planche sans type : un ITP de membre sans conduite, derrière la référence, n'est pas proposé (relecture)", () => {
    expect(choisirItpParDefaut([ABRI, LIBRE, CHAMP], { type: null })).toEqual({ itp: null, motif: "planche_sans_type" })
  })
  it("planche typée : le premier ITP qui lui convient, ou rien", () => {
    expect(choisirItpParDefaut([ABRI, CHAMP], { type: "Plein champ" })).toEqual({ itp: CHAMP, motif: "compatible" })
    expect(choisirItpParDefaut([CHAMP, ABRI], { type: "Serre" })).toEqual({ itp: ABRI, motif: "compatible" })
    expect(choisirItpParDefaut([CHAMP, LIBRE], { type: "Serre" })).toEqual({ itp: LIBRE, motif: "compatible" })
    expect(choisirItpParDefaut([CHAMP], { type: "Serre" })).toEqual({ itp: null, motif: "aucun_compatible" })
  })
})

describe("avertissementItpPlanche", () => {
  it("ne parle que de l'incompatibilité", () => {
    expect(avertissementItpPlanche(verdictItpPlanche(ABRI, { type: null }), { itp: "x", planche: "y" })).toBeNull()
    expect(avertissementItpPlanche(verdictItpPlanche(ABRI, { type: "Plein champ" }), { itp: "Radis — sous abri forcé", planche: "B1" })).toBe(
      "L'itinéraire technique « Radis — sous abri forcé » est conduit sous abri ; la planche « B1 » est en plein champ.",
    )
  })
})
