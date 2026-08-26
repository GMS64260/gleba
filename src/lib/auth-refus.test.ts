/**
 * L'invariant que ces tests protègent : l'utilisateur ne doit JAMAIS lire un
 * code technique. Le défaut d'origine (2026-08-26) affichait « Configuration »
 * dans la boîte rouge du formulaire de connexion, parce que le client rendait
 * tel quel ce que lui donnait Auth.js.
 */

import { describe, expect, it } from "vitest"
import {
  REFUS_CONNEXION,
  REFUS_MESSAGE_PAR_DEFAUT,
  messageRefusConnexion,
} from "./auth-refus"

describe("messages de refus de connexion", () => {
  it("traduit chaque motif en une phrase, jamais en code", () => {
    for (const code of Object.values(REFUS_CONNEXION)) {
      const message = messageRefusConnexion(code)
      expect(message).not.toBe(code)
      expect(message.length).toBeGreaterThan(20)
      expect(message).toMatch(/[.!]$/)
    }
  })

  it("retombe sur une phrase neutre pour tout code inattendu", () => {
    // Les codes qu'Auth.js produit lui-même quand il n'a pas notre motif.
    expect(messageRefusConnexion("Configuration")).toBe(REFUS_MESSAGE_PAR_DEFAUT)
    expect(messageRefusConnexion("CredentialsSignin")).toBe(REFUS_MESSAGE_PAR_DEFAUT)
    expect(messageRefusConnexion("")).toBe(REFUS_MESSAGE_PAR_DEFAUT)
    expect(messageRefusConnexion(undefined)).toBe(REFUS_MESSAGE_PAR_DEFAUT)
    expect(messageRefusConnexion(null)).toBe(REFUS_MESSAGE_PAR_DEFAUT)
  })

  it("ne distingue pas l'adresse inconnue du mot de passe erroné", () => {
    // Les deux chemins partagent un code unique : le formulaire ne doit pas
    // devenir un oracle d'existence de compte.
    const message = messageRefusConnexion(REFUS_CONNEXION.IDENTIFIANTS)
    expect(message).toContain("ou")
    expect(message.toLowerCase()).not.toContain("inconnu")
    expect(message.toLowerCase()).not.toContain("n'existe pas")
  })

  it("oriente vers le bon geste quand l'adresse n'est pas vérifiée", () => {
    expect(messageRefusConnexion(REFUS_CONNEXION.EMAIL_NON_VERIFIE)).toMatch(/vérifi/i)
  })

  it("oriente vers Google plutôt que vers un mot de passe inexistant", () => {
    expect(messageRefusConnexion(REFUS_CONNEXION.COMPTE_GOOGLE)).toMatch(/Google/)
  })
})
