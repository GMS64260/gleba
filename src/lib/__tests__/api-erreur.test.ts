/**
 * `messageErreurReponse` — le message de l'API doit arriver lisible.
 *
 * Motif (2026-09-09) : les hooks rendaient `HTTP 403: {"error":"…"}`, affiché
 * tel quel dans un toast. Le refus posé sur les préférences du compte démo est
 * précisément ce que l'utilisateur doit lire.
 */

import { describe, expect, it } from "vitest"
import { messageErreurReponse } from "../api-erreur"

function reponse(body: string, status = 403): Response {
  return new Response(body, { status })
}

describe("messageErreurReponse", () => {
  it("extrait le champ `error` d'une réponse JSON", async () => {
    const res = reponse(JSON.stringify({ error: "Le compte de démonstration est partagé." }))
    await expect(messageErreurReponse(res)).resolves.toBe(
      "Le compte de démonstration est partagé."
    )
  })

  it("garde le corps brut quand ce n'est pas du JSON", async () => {
    await expect(messageErreurReponse(reponse("<html>502 Bad Gateway</html>", 502))).resolves.toBe(
      "HTTP 502: <html>502 Bad Gateway</html>"
    )
  })

  it("retombe sur le statut seul quand le corps est vide", async () => {
    await expect(messageErreurReponse(reponse("", 500))).resolves.toBe("HTTP 500")
  })

  it("ignore un champ `error` vide ou non textuel", async () => {
    await expect(messageErreurReponse(reponse(JSON.stringify({ error: "  " })))).resolves.toBe(
      'HTTP 403: {"error":"  "}'
    )
    await expect(messageErreurReponse(reponse(JSON.stringify({ error: 42 })))).resolves.toBe(
      'HTTP 403: {"error":42}'
    )
  })
})
