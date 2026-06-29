/**
 * GET /api/verger/referentiel/export?onglet=especes|porte-greffes|bioagresseurs|essences
 *
 * PROMPT DEV 2 Bug #4 — Export CSV global du référentiel verger.
 * CSV UTF-8 avec BOM, séparateur `;` (Excel FR).
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

type Onglet = "especes" | "porte-greffes" | "bioagresseurs" | "essences"

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ""
  const s = String(value)
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const BOM = "﻿"
  const lines = [headers.map(escapeCsv).join(";")]
  for (const r of rows) lines.push(r.map(escapeCsv).join(";"))
  return BOM + lines.join("\n")
}

export async function GET(request: NextRequest) {
  const { error } = await requireAuthApi()
  if (error) return error

  const onglet = (request.nextUrl.searchParams.get("onglet") || "especes") as Onglet

  let csv: string
  let filename: string

  if (onglet === "especes") {
    const data = await prisma.espece.findMany({
      where: { type: { in: ["arbre_fruitier", "petit_fruit"] } },
      select: { id: true, type: true, familleId: true, nomLatin: true, rendement: true, uniteRendement: true, besoinEau: true, vivace: true },
      orderBy: { id: "asc" },
    })
    // Unité par ligne : les arbres sont en kg/arbre, pas en kg/m² (V2 Bug 5).
    const uniteLabel = (u: string | null) =>
      u === "kg_arbre" ? "kg/arbre" : u === "biomasse_t_ha" ? "t/ha" : "kg/m²"
    csv = toCsv(
      ["Espèce", "Type", "Famille", "Nom latin", "Rendement", "Unité rendement", "Besoin eau (1-5)", "Vivace"],
      data.map((e) => [
        e.id,
        e.type,
        e.familleId ?? "",
        e.nomLatin ?? "",
        e.rendement ?? "",
        e.rendement != null ? uniteLabel(e.uniteRendement) : "",
        e.besoinEau ?? "",
        e.vivace ? "Oui" : "Non",
      ])
    )
    filename = "referentiel-especes-verger.csv"
  } else if (onglet === "porte-greffes") {
    const data = await prisma.porteGreffe.findMany({
      select: {
        nom: true,
        vigueur: true,
        precocite: true,
        sensibilites: true,
        drageonnement: true,
        notes: true,
        especes: { select: { especeId: true } },
      },
      orderBy: { nom: "asc" },
    })
    csv = toCsv(
      ["Nom", "Vigueur (1-5)", "Précocité (1-5)", "Sensibilités", "Drageonnement", "Espèces compatibles", "Notes"],
      data.map((p) => [
        p.nom,
        p.vigueur,
        p.precocite,
        (p.sensibilites ?? []).join(", "),
        p.drageonnement ? "Oui" : "Non",
        p.especes.map((e) => e.especeId).join(", "),
        p.notes ?? "",
      ])
    )
    filename = "referentiel-porte-greffes.csv"
  } else if (onglet === "bioagresseurs") {
    const data = await prisma.bioagresseur.findMany({
      select: {
        nomCommun: true,
        nomLatin: true,
        type: true,
        organeCible: true,
        periodePression: true,
        methodesPbi: true,
        seuilNuisibilite: true,
        especes: { select: { especeId: true } },
        notes: true,
      },
      orderBy: [{ type: "asc" }, { nomCommun: "asc" }],
    })
    csv = toCsv(
      ["Nom commun", "Nom latin", "Type", "Organe cible", "Période pression", "Méthodes PBI", "Seuil", "Espèces cibles", "Notes"],
      data.map((b) => [
        b.nomCommun,
        b.nomLatin,
        b.type,
        b.organeCible,
        (b.periodePression ?? []).join(", "),
        (b.methodesPbi ?? []).join(", "),
        b.seuilNuisibilite ?? "",
        b.especes.map((e) => e.especeId).join(", "),
        b.notes ?? "",
      ])
    )
    filename = "referentiel-bioagresseurs.csv"
  } else if (onglet === "essences") {
    const data = await prisma.essenceBocagere.findMany({
      orderBy: { nomCommun: "asc" },
    })
    csv = toCsv(
      ["Nom commun", "Nom latin", "Hauteur (m)", "Croissance", "Rôles", "Persistant", "Épineux", "Notes"],
      data.map((e) => [
        e.nomCommun,
        e.nomLatin,
        e.hauteurM,
        e.croissance,
        (e.roles ?? []).join(", "),
        e.persistant ? "Oui" : "Non",
        e.epineux ? "Oui" : "Non",
        e.notes ?? "",
      ])
    )
    filename = "referentiel-essences-bocageres.csv"
  } else {
    return NextResponse.json({ error: "Onglet invalide" }, { status: 400 })
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
