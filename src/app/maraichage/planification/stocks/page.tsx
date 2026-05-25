/**
 * Feedback Marc 2026-05-16 — Bug 15 : l'URL directe
 * /maraichage/planification/stocks renvoyait un 404 alors que
 * l'onglet "Stocks" du hub Planification est mis en avant. On
 * redirige désormais vers /maraichage/stocks (page existante)
 * pour que le lien (et un éventuel partage URL) fonctionne.
 */

import { redirect } from "next/navigation"

export default function StocksPlanificationRedirectPage() {
  redirect("/maraichage/stocks")
}
