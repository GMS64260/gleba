"use client"

/**
 * Encart « Jours favorables aux semis » — pont entre le calendrier de semis et
 * le calendrier lunaire/biodynamique.
 *
 * Pour les semis dus dans les prochaines semaines (selon les ITP de l'utilisateur,
 * décalage climatique inclus), on classe chaque culture par catégorie lunaire
 * (feuille / fruit / racine / fleur) puis on indique les prochains jours lunaires
 * favorables à chacune. Données lunaires : API /api/lunaire (cf. lib/lunar.ts).
 */

import * as React from "react"
import { Moon, Loader2, Sprout } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  categorieLunaire,
  decalerSemaine,
  CATEGORIE_LUNAIRE_LABEL,
  type CategorieLunaire,
} from "@/lib/calendrier-climat"

interface JourLunaire {
  date: string
  phase: string
  emoji: string
  typeJour: "feuille" | "fruit" | "racine" | "fleur" | "repos"
  conseil: string
}

interface ITPLite {
  id: string
  especeId: string | null
  espece?: { id?: string; couleur?: string | null; famille?: { id?: string } | null } | null
  semaineSemis: number | null
}

interface Props {
  itps: ITPLite[]
  decalage: number
  /** Nombre de semaines à anticiper (fenêtre de semis). */
  horizonSemaines?: number
}

const CAT_STYLE: Record<CategorieLunaire, { bg: string; text: string; ring: string }> = {
  feuille: { bg: "bg-green-50", text: "text-green-700", ring: "ring-green-200" },
  fruit: { bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-200" },
  racine: { bg: "bg-amber-50", text: "text-amber-800", ring: "ring-amber-200" },
  fleur: { bg: "bg-pink-50", text: "text-pink-700", ring: "ring-pink-200" },
}

// Semaine ISO d'une date (lundi = début), cohérent avec lib/assistant-helpers.
function semaineISO(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

// Distance (en semaines, vers l'avant) de la semaine courante à une semaine cible.
function distanceSemaine(courante: number, cible: number): number {
  return ((cible - courante) % 52 + 52) % 52
}

export function SemisLunaireEncart({ itps, decalage, horizonSemaines = 3 }: Props) {
  const [jours, setJours] = React.useState<JourLunaire[]>([])
  const [loading, setLoading] = React.useState(true)

  // Charge le mois courant + le mois suivant (pour ne pas tronquer la fenêtre).
  React.useEffect(() => {
    let annule = false
    async function charger() {
      setLoading(true)
      const now = new Date()
      const mois = [
        { y: now.getFullYear(), m: now.getMonth() + 1 },
        { y: now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear(), m: now.getMonth() === 11 ? 1 : now.getMonth() + 2 },
      ]
      try {
        const reps = await Promise.all(
          mois.map((x) =>
            fetch(`/api/lunaire?year=${x.y}&month=${x.m}`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          )
        )
        if (annule) return
        const tous: JourLunaire[] = reps
          .filter(Boolean)
          .flatMap((j: { calendrier?: { jours?: JourLunaire[] } }) => j?.calendrier?.jours || [])
        setJours(tous)
      } finally {
        if (!annule) setLoading(false)
      }
    }
    charger()
    return () => {
      annule = true
    }
  }, [])

  const now = new Date()
  const semaineCourante = semaineISO(now)
  const todayStr = now.toISOString().split("T")[0]

  // 1) Semis dus dans la fenêtre [maintenant, +horizon], regroupés par catégorie.
  const semisParCat = React.useMemo(() => {
    const map = new Map<CategorieLunaire, Set<string>>()
    for (const itp of itps) {
      const sSemis = decalerSemaine(itp.semaineSemis, decalage)
      if (sSemis == null) continue
      const dist = distanceSemaine(semaineCourante, sSemis)
      if (dist > horizonSemaines) continue
      const cat = categorieLunaire({
        especeId: itp.especeId,
        nom: itp.espece?.id ?? itp.especeId,
        famille: itp.espece?.famille?.id ?? null,
      })
      if (!cat) continue
      const nom = itp.especeId || itp.id
      if (!map.has(cat)) map.set(cat, new Set())
      map.get(cat)!.add(nom)
    }
    return map
  }, [itps, decalage, semaineCourante, horizonSemaines])

  // 2) Prochains jours lunaires favorables (>= aujourd'hui) par type.
  const prochainsJours = React.useMemo(() => {
    const futurs = jours
      .filter((j) => j.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
    const parType: Record<string, JourLunaire[]> = {}
    for (const j of futurs) {
      if (j.typeJour === "repos") continue
      ;(parType[j.typeJour] ||= []).push(j)
    }
    return parType
  }, [jours, todayStr])

  const categoriesActives = Array.from(semisParCat.keys())

  return (
    <Card className="border-indigo-200 bg-indigo-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Moon className="h-4 w-4 text-indigo-600" />
          Jours favorables aux semis
          <span className="text-xs font-normal text-muted-foreground">
            (calendrier biodynamique)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
            <Loader2 className="h-4 w-4 animate-spin" /> Calcul des phases lunaires…
          </div>
        ) : categoriesActives.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Aucun semis recommandé dans les {horizonSemaines} prochaines semaines
            pour vos itinéraires{decalage !== 0 ? " (zone climatique prise en compte)" : ""}.
          </p>
        ) : (
          <div className="space-y-2.5">
            <p className="text-xs text-muted-foreground -mt-1">
              À semer dans les {horizonSemaines} prochaines semaines, et les
              meilleurs jours lunaires pour chaque type :
            </p>
            {(["feuille", "fruit", "racine", "fleur"] as CategorieLunaire[])
              .filter((cat) => semisParCat.has(cat))
              .map((cat) => {
                const cultures = Array.from(semisParCat.get(cat)!)
                const cfg = CATEGORIE_LUNAIRE_LABEL[cat]
                const style = CAT_STYLE[cat]
                const jrs = (prochainsJours[cat] || []).slice(0, 3)
                return (
                  <div
                    key={cat}
                    className={`rounded-md p-2.5 ring-1 ${style.bg} ${style.ring}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-base leading-none">{cfg.emoji}</span>
                      <span className={`text-sm font-medium ${style.text}`}>
                        Jour {cfg.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {cultures.map((c) => (
                        <Badge key={c} variant="outline" className="text-xs bg-white/70">
                          <Sprout className="h-3 w-3 mr-1 text-emerald-600" />
                          {c}
                        </Badge>
                      ))}
                    </div>
                    {jrs.length > 0 ? (
                      <p className="text-xs text-slate-600">
                        Prochains jours favorables :{" "}
                        <span className="font-medium">
                          {jrs
                            .map((j) =>
                              new Date(j.date + "T12:00:00").toLocaleDateString("fr-FR", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              })
                            )
                            .join(" · ")}
                        </span>
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Pas de jour {cfg.label.toLowerCase()} favorable identifié sur la période.
                      </p>
                    )}
                  </div>
                )
              })}
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Indicatif : la catégorie biodynamique est déduite de la partie
              récoltée (feuille / fruit / racine / fleur). Le détail jour par jour
              est dans le widget lunaire 🌙 de l&apos;en-tête.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
