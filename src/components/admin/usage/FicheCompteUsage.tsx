"use client"

/**
 * Fiche dépliée d'un compte sur /admin/usage : calendrier de présence sur
 * un an, saisies par semaine et par module, détail des saisies par type,
 * et repères (connexions, notifications, équipe). Chargée à l'ouverture.
 */

import * as React from "react"
import Link from "next/link"
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts"
import { ResponsiveContainer } from "@/components/ui/responsive-container"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { GROUPES_USAGE } from "@/lib/admin-usage-groupes"
import { MODULES } from "@/lib/modules"
import type { CompteUsage, FicheUsage } from "./types"
import { GROUPE_VISUEL, fmtBucketLabel, fmtDate, fmtDay, ilYa, nf } from "./visuel"

export function FicheCompteUsage({ compte, days }: { compte: CompteUsage; days: number }) {
  const [fiche, setFiche] = React.useState<FicheUsage | null>(null)
  const [erreur, setErreur] = React.useState(false)

  React.useEffect(() => {
    let annule = false
    setFiche(null)
    setErreur(false)
    fetch(`/api/admin/usage/${encodeURIComponent(compte.id)}?days=${days}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: FicheUsage) => !annule && setFiche(d))
      .catch(() => !annule && setErreur(true))
    return () => {
      annule = true
    }
  }, [compte.id, days])

  const nonActives = (Object.keys(MODULES) as Array<keyof typeof MODULES>).filter(
    (m) => !compte.modulesActifs.includes(m)
  )

  return (
    <div className="grid gap-6 border-t border-amber-100 bg-amber-50/30 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-6">
        <section aria-labelledby={`cal-${compte.id}`}>
          <h4 id={`cal-${compte.id}`} className="mb-2 text-sm font-semibold text-slate-800">
            Présence sur un an
          </h4>
          {erreur ? (
            <p className="text-sm text-rose-700">La fiche n’a pas pu être chargée. Rouvrez la ligne pour réessayer.</p>
          ) : !fiche ? (
            <Skeleton className="h-[104px] w-full" />
          ) : (
            <CalendrierPresence debut={fiche.calendrier.debut} jours={fiche.calendrier.jours} />
          )}
        </section>

        <section aria-labelledby={`hebdo-${compte.id}`}>
          <h4 id={`hebdo-${compte.id}`} className="mb-2 text-sm font-semibold text-slate-800">
            Saisies par semaine
          </h4>
          {!fiche ? (
            !erreur && <Skeleton className="h-[180px] w-full" />
          ) : (
            <SaisiesHebdo fiche={fiche} />
          )}
        </section>

        {fiche && fiche.sources.length > 0 && (
          <section aria-labelledby={`src-${compte.id}`}>
            <h4 id={`src-${compte.id}`} className="mb-2 text-sm font-semibold text-slate-800">
              Ce qui est saisi
            </h4>
            <div className="overflow-x-auto rounded-md border bg-white">
              <table className="w-full text-sm tabular-nums">
                <thead className="bg-slate-50 text-left text-xs text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 text-right font-medium">Période</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 font-medium">Dernière</th>
                  </tr>
                </thead>
                <tbody>
                  {fiche.sources.map((s) => {
                    const v = GROUPE_VISUEL[s.groupe]
                    return (
                      <tr key={s.source} className="border-t">
                        <td className="px-3 py-1.5">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: v.couleur }} aria-hidden />
                            {s.libelle}
                            <span className="text-xs text-slate-500">{v.court}</span>
                          </span>
                        </td>
                        <td className={`px-3 py-1.5 text-right ${s.fenetre ? "font-semibold text-slate-900" : "text-slate-400"}`}>
                          {nf.format(s.fenetre)}
                        </td>
                        <td className="px-3 py-1.5 text-right text-slate-600">{nf.format(s.total)}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-slate-600">{s.derniere ? fmtDate(s.derniere) : "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <aside className="space-y-4 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <dt className="text-slate-500">Inscrit</dt>
          <dd className="text-slate-900">{fmtDate(compte.createdAt)}</dd>
          <dt className="text-slate-500">1er jour actif</dt>
          <dd className="text-slate-900">{fmtDay(compte.firstActivity)}</dd>
          <dt className="text-slate-500">Dernière visite</dt>
          <dd className="text-slate-900">{ilYa(compte.lastActivity, true)}</dd>
          <dt className="text-slate-500">Dernière saisie</dt>
          <dd className="text-slate-900">{ilYa(compte.derniereSaisie)}</dd>
          <dt className="text-slate-500">Jours actifs</dt>
          <dd className="text-slate-900 tabular-nums">{nf.format(compte.activeDaysTotal)} au total</dd>
          <dt className="text-slate-500">Saisies</dt>
          <dd className="text-slate-900 tabular-nums">{nf.format(compte.contentTotal)} au total</dd>
        </dl>

        <div className="space-y-1.5 border-t border-amber-100 pt-3">
          <p>
            <span className="text-slate-500">Assistant : </span>
            {compte.assistant.questionsTotal === 0 ? (
              <span className="text-slate-700">jamais utilisé</span>
            ) : (
              <span className="text-slate-900">
                {nf.format(compte.assistant.questionsFenetre)} question{compte.assistant.questionsFenetre > 1 ? "s" : ""} sur
                la période, {nf.format(compte.assistant.questionsTotal)} au total, dernière {ilYa(compte.assistant.derniere)}
              </span>
            )}
          </p>
          <p>
            <span className="text-slate-500">Connexions : </span>
            {compte.connexions.fenetre === 0 ? (
              <span className="text-slate-700">
                aucune saisie d’identifiants sur la période
                {compte.connexions.derniere ? ` (dernière ${ilYa(compte.connexions.derniere)})` : ""}
              </span>
            ) : (
              <span className="text-slate-900">
                {nf.format(compte.connexions.fenetre)} sur la période, dont {nf.format(compte.connexions.mobile)} sur mobile
              </span>
            )}
          </p>
          <p>
            <span className="text-slate-500">Notifications : </span>
            <span className="text-slate-900">
              {compte.notifications.appareils === 0
                ? "non activées"
                : `${compte.notifications.appareils} appareil${compte.notifications.appareils > 1 ? "s" : ""}` +
                  (compte.notifications.mobile ? `, dont ${compte.notifications.mobile} mobile` : "")}
            </span>
          </p>
          <p>
            <span className="text-slate-500">Équipe : </span>
            <span className="text-slate-900">
              {compte.equipe.membreDe
                ? `membre de l’exploitation de ${compte.equipe.membreDe} (ses saisies comptent chez le propriétaire)`
                : compte.equipe.membres > 0
                  ? `${compte.equipe.membres} membre${compte.equipe.membres > 1 ? "s" : ""} invité${compte.equipe.membres > 1 ? "s" : ""}`
                  : "seul sur son exploitation"}
            </span>
          </p>
          <p>
            <span className="text-slate-500">Modules masqués : </span>
            <span className="text-slate-900">
              {nonActives.length === 0 ? "aucun" : nonActives.map((m) => MODULES[m].label).join(", ")}
            </span>
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/users/${compte.id}`}>Gérer le compte</Link>
        </Button>
      </aside>
    </div>
  )
}

/** Calendrier façon carnet : 53 colonnes (semaines), 7 lignes (lundi → dimanche). */
function CalendrierPresence({ debut, jours }: { debut: string; jours: string[] }) {
  const actifs = React.useMemo(() => new Set(jours), [jours])
  // Sur mobile le calendrier défile : l'ouvrir sur les semaines récentes.
  const defilement = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const el = defilement.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])
  const today = new Date().toISOString().slice(0, 10)
  const colonnes: Array<Array<{ iso: string; futur: boolean }>> = []
  const cur = new Date(debut + "T00:00:00Z")
  for (let w = 0; w < 53; w++) {
    const col = []
    for (let d = 0; d < 7; d++) {
      const iso = cur.toISOString().slice(0, 10)
      col.push({ iso, futur: iso > today })
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    colonnes.push(col)
  }
  const mois = colonnes.map((col, i) => {
    const d = new Date(col[0].iso + "T00:00:00Z")
    const prev = i > 0 ? new Date(colonnes[i - 1][0].iso + "T00:00:00Z") : null
    return !prev || prev.getUTCMonth() !== d.getUTCMonth()
      ? d.toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" })
      : ""
  })

  return (
    <div>
      <div ref={defilement} className="overflow-x-auto pb-1">
        <div className="inline-grid gap-[3px]" style={{ gridTemplateColumns: `repeat(53, 11px)` }}>
          {mois.map((m, i) => (
            <span key={`m${i}`} className="h-4 overflow-visible whitespace-nowrap text-[10px] leading-4 text-slate-500">
              {m}
            </span>
          ))}
          {Array.from({ length: 7 }).map((_, d) =>
            colonnes.map((col, w) => {
              const c = col[d]
              const actif = actifs.has(c.iso)
              return (
                <span
                  key={`${w}-${d}`}
                  title={c.futur ? undefined : `${fmtDay(c.iso)} : ${actif ? "actif" : "absent"}`}
                  className={`h-[11px] w-[11px] rounded-[2px] ${
                    c.futur ? "bg-transparent" : actif ? "bg-green-600" : "bg-slate-200/80"
                  }`}
                />
              )
            })
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500 tabular-nums">
        {nf.format(jours.length)} jour{jours.length > 1 ? "s" : ""} actif{jours.length > 1 ? "s" : ""} sur les 12 derniers mois
      </p>
    </div>
  )
}

function SaisiesHebdo({ fiche }: { fiche: FicheUsage }) {
  const groupes = GROUPES_USAGE.filter((g) => fiche.hebdo.parGroupe[g.id]?.some((v) => v > 0))
  if (groupes.length === 0) {
    return (
      <p className="rounded-md border border-dashed bg-white px-3 py-6 text-center text-sm text-slate-500">
        Aucune saisie sur la période : le compte consulte sans rien enregistrer.
      </p>
    )
  }
  const data = fiche.hebdo.semaines.map((s, i) => {
    const row: Record<string, string | number> = { semaine: fmtBucketLabel(s, "week") }
    for (const g of groupes) row[g.id] = fiche.hebdo.parGroupe[g.id][i]
    return row
  })
  return (
    <div className="rounded-md border bg-white p-2">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="semaine" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} />
          {groupes.map((g) => (
            <Bar key={g.id} dataKey={g.id} name={g.libelle} stackId="s" fill={GROUPE_VISUEL[g.id].couleur} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 px-2 text-xs text-slate-600">
        {groupes.map((g) => (
          <li key={g.id} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: GROUPE_VISUEL[g.id].couleur }} aria-hidden />
            {g.libelle}
          </li>
        ))}
      </ul>
    </div>
  )
}
