"use client"

/**
 * Gantt 12 mois du calendrier d'entretien par espèce d'arbre
 * Barres colorées par type d'opération
 */

import * as React from "react"
import {
  TREE_CARE_PROFILES,
  findTreeCareProfile,
  getMonthlyCalendar,
  type TreeCareProfile,
  type TreeCareOperation,
} from "@/lib/tree-care-calendar"

const TYPE_COLORS: Record<string, string> = {
  taille: "#9c27b0",
  traitement: "#ef4444",
  fertilisation: "#f59e0b",
  recolte: "#22c55e",
  greffe: "#10b981",
  autre: "#6b7280",
}

const TYPE_LABELS: Record<string, string> = {
  taille: "Taille",
  traitement: "Traitement",
  fertilisation: "Fertilisation",
  recolte: "Récolte",
  greffe: "Greffe",
  autre: "Autre",
}

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

interface TreeCareGanttProps {
  especes: string[]  // Liste des especes uniques de l'utilisateur
}

export function TreeCareGantt({ especes }: TreeCareGanttProps) {
  const [expandedEspece, setExpandedEspece] = React.useState<string | null>(null)
  // Bug #3 — Toggle "Mes arbres / Tous les profils" pour explorer le
  // référentiel complet (Marc 2026-05-14 : la frise ne montrait que les
  // 3 espèces de l'user, alors que 26 profils existent).
  const [scope, setScope] = React.useState<"mine" | "all">("mine")

  // Profils filtrés selon le scope.
  const profiles = React.useMemo(() => {
    if (scope === "all") return TREE_CARE_PROFILES
    const found: TreeCareProfile[] = []
    const seen = new Set<string>()
    for (const espece of especes) {
      const profile = findTreeCareProfile(espece)
      if (profile && !seen.has(profile.espece)) {
        seen.add(profile.espece)
        found.push(profile)
      }
    }
    return found
  }, [especes, scope])

  if (profiles.length === 0 && scope === "mine") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground py-4">
          Aucune espèce d'arbre saisie pour l'instant.
        </p>
        <button
          onClick={() => setScope("all")}
          className="text-xs px-3 py-1.5 rounded-md bg-lime-100 text-lime-800 hover:bg-lime-200"
        >
          Voir les {TREE_CARE_PROFILES.length} profils du référentiel
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Bug #3 — Toggle scope mes arbres / référentiel complet */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex items-center rounded-md border bg-white text-xs">
          <button
            onClick={() => setScope("mine")}
            className={`px-3 py-1 rounded-l-md ${scope === "mine" ? "bg-lime-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            Mes espèces ({Math.min(especes.length, profiles.length)})
          </button>
          <button
            onClick={() => setScope("all")}
            className={`px-3 py-1 rounded-r-md border-l ${scope === "all" ? "bg-lime-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            Tout le référentiel ({TREE_CARE_PROFILES.length})
          </button>
        </div>
        <a
          href={`/api/verger/calendrier/export?scope=${scope}`}
          className="text-xs px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
          title="Télécharger le calendrier en PDF"
        >
          📥 Export PDF
        </a>
      </div>

      {/* Espèces détectées */}
      <div className="flex flex-wrap gap-1.5 text-xs">
        {profiles.map((p) => (
          <span
            key={p.espece}
            className="px-2 py-0.5 rounded-full bg-lime-100 text-lime-700 font-medium"
          >
            {p.espece}
          </span>
        ))}
        {scope === "mine" && especes.filter((e) => !profiles.some((p) =>
          p.espece.toLowerCase() === e.toLowerCase() ||
          p.aliases.some((a) => a.toLowerCase() === e.toLowerCase())
        )).map((e) => (
          <span
            key={e}
            className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500"
            title="Espèce non reconnue dans le référentiel d'entretien"
          >
            {e}
          </span>
        ))}
      </div>

      {/* Légende types */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span>{TYPE_LABELS[type] || type}</span>
          </div>
        ))}
      </div>

      {/* Tableau Gantt */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left p-2 text-sm font-medium sticky left-0 bg-slate-50 z-10 border-r w-[160px] min-w-[160px]">
                Espèce
              </th>
              {MOIS.map((m) => (
                <th
                  key={m}
                  className="text-center p-1 text-xs font-medium text-muted-foreground border-l"
                  style={{ minWidth: "54px" }}
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => {
              const calendar = getMonthlyCalendar(profile)
              const isExpanded = expandedEspece === profile.espece

              return (
                <React.Fragment key={profile.espece}>
                  <tr
                    className="border-t hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() =>
                      setExpandedEspece(isExpanded ? null : profile.espece)
                    }
                  >
                    <td className="p-2 sticky left-0 bg-white z-10 border-r">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {isExpanded ? "▼" : "▶"}
                        </span>
                        <div>
                          <div className="font-medium text-sm">{profile.espece}</div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {profile.type.replace("_", " ")}
                          </div>
                        </div>
                      </div>
                    </td>
                    {calendar.map((month) => (
                      <td key={month.mois} className="p-0.5 border-l align-middle">
                        <div className="flex flex-wrap gap-0.5 justify-center">
                          {/* Dédupliquer par type pour la vue condensée */}
                          {[...new Set(month.operations.map((op) => op.type))].map(
                            (type) => (
                              <div
                                key={type}
                                className="w-full h-2 rounded-sm"
                                style={{
                                  backgroundColor: TYPE_COLORS[type] || "#6b7280",
                                }}
                                title={`${TYPE_LABELS[type] || type}`}
                              />
                            )
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Détails des opérations */}
                  {isExpanded && (
                    <tr className="border-t bg-slate-50/50">
                      <td colSpan={13} className="p-3">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {profile.operations.map((op, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 p-2 bg-white rounded-md border text-sm"
                            >
                              <div
                                className="w-2.5 h-2.5 rounded-sm mt-1 flex-shrink-0"
                                style={{
                                  backgroundColor:
                                    TYPE_COLORS[op.type] || "#6b7280",
                                }}
                              />
                              <div className="min-w-0">
                                <div className="font-medium text-xs">
                                  {op.label}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {op.description}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {MOIS[op.moisDebut - 1]}
                                  {op.moisFin !== op.moisDebut && ` → ${MOIS[op.moisFin - 1]}`}
                                  {" · "}
                                  <span className="capitalize">{op.saisonRecommandee}</span>
                                  {" · Priorité "}
                                  <span
                                    className={
                                      op.priorite === "haute"
                                        ? "text-red-600 font-medium"
                                        : op.priorite === "moyenne"
                                        ? "text-amber-600"
                                        : "text-slate-500"
                                    }
                                  >
                                    {op.priorite}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
