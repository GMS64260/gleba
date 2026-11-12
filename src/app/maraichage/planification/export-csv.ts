/**
 * Export CSV des écrans de planification.
 *
 * Revue du 2026-11-11 — cinq écrans écrivaient leurs lignes par un simple
 * `join(";")` : un nom de planche ou de variété contenant « ; » décalait les
 * colonnes, un nom commençant par « = » était exécuté comme une formule à
 * l'ouverture, et sans BOM Excel lisait les accents en Windows-1252. Même
 * format que les autres exports Gleba : BOM UTF-8, « ; », fins de ligne CRLF,
 * cellules passées par `celluleCsv`.
 */

import { celluleCsv } from "@/lib/csv-cellule"

export type LigneCsv = readonly (string | number | null | undefined)[]

export function construireCsv(lignes: readonly LigneCsv[]): string {
  return `﻿${lignes.map((ligne) => ligne.map(celluleCsv).join(";")).join("\r\n")}\r\n`
}

/** Déclenche le téléchargement du fichier dans le navigateur. */
export function telechargerCsv(nomFichier: string, lignes: readonly LigneCsv[]): void {
  const blob = new Blob([construireCsv(lignes)], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const lien = document.createElement("a")
  lien.href = url
  lien.download = nomFichier
  lien.click()
  URL.revokeObjectURL(url)
}
