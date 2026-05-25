"use client"

import { useState, useMemo } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Bug,
  Lightbulb,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Download,
  Search,
  Loader2,
  Trash2,
  ExternalLink,
  Save,
} from "lucide-react"

type BugType = "BUG" | "EVOLUTION" | "AUTRE"
type BugStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED"
type BugPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

interface StatusLog {
  id: string
  fromStatus: BugStatus | null
  toStatus: BugStatus
  note: string | null
  changedAt: string
  changedBy: { email: string; name: string | null } | null
}

interface BugRow {
  id: string
  type: BugType
  status: BugStatus
  priority: BugPriority
  message: string
  url: string | null
  userAgent: string | null
  viewport: string | null
  adminNote: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  user: { id: string; email: string; name: string | null }
  statusLogs: StatusLog[]
}

interface Props {
  initialBugs: BugRow[]
  stats: { total: number; open: number; inProgress: number; resolved: number }
}

const TYPE_LABELS: Record<BugType, string> = {
  BUG: "Bug",
  EVOLUTION: "Évolution",
  AUTRE: "Autre",
}

const STATUS_LABELS: Record<BugStatus, string> = {
  OPEN: "Ouvert",
  IN_PROGRESS: "En cours",
  RESOLVED: "Résolu",
}

const PRIORITY_LABELS: Record<BugPriority, string> = {
  LOW: "Basse",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
  CRITICAL: "Critique",
}

function typeIcon(t: BugType) {
  switch (t) {
    case "BUG":
      return <Bug className="h-4 w-4 text-red-600" />
    case "EVOLUTION":
      return <Lightbulb className="h-4 w-4 text-amber-600" />
    default:
      return <HelpCircle className="h-4 w-4 text-slate-500" />
  }
}

function statusBadgeClass(s: BugStatus) {
  switch (s) {
    case "OPEN":
      return "bg-red-50 text-red-700 ring-red-200"
    case "IN_PROGRESS":
      return "bg-amber-50 text-amber-700 ring-amber-200"
    case "RESOLVED":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  }
}

function priorityBadgeClass(p: BugPriority) {
  switch (p) {
    case "LOW":
      return "bg-slate-100 text-slate-700"
    case "MEDIUM":
      return "bg-sky-100 text-sky-700"
    case "HIGH":
      return "bg-orange-100 text-orange-700"
    case "CRITICAL":
      return "bg-red-100 text-red-700"
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function BugsDashboard({ initialBugs, stats }: Props) {
  const [bugs, setBugs] = useState<BugRow[]>(initialBugs)
  const [filterType, setFilterType] = useState<"all" | BugType>("all")
  const [filterStatus, setFilterStatus] = useState<"all" | BugStatus>("all")
  const [filterPriority, setFilterPriority] = useState<"all" | BugPriority>(
    "all"
  )
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return bugs.filter((b) => {
      if (filterType !== "all" && b.type !== filterType) return false
      if (filterStatus !== "all" && b.status !== filterStatus) return false
      if (filterPriority !== "all" && b.priority !== filterPriority) return false
      if (search) {
        const q = search.toLowerCase()
        const hay = `${b.message} ${b.user.email} ${b.user.name ?? ""} ${b.url ?? ""}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [bugs, filterType, filterStatus, filterPriority, search])

  const updateBug = async (
    id: string,
    payload: {
      status?: BugStatus
      priority?: BugPriority
      adminNote?: string | null
      statusNote?: string
    }
  ) => {
    setSavingId(id)
    try {
      const res = await fetch(`/api/admin/bugs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "Erreur lors de la mise à jour")
        return
      }
      const { bug } = await res.json()
      setBugs((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                ...bug,
                createdAt: new Date(bug.createdAt).toISOString(),
                updatedAt: new Date(bug.updatedAt).toISOString(),
                resolvedAt: bug.resolvedAt
                  ? new Date(bug.resolvedAt).toISOString()
                  : null,
                statusLogs: bug.statusLogs.map((l: StatusLog) => ({
                  ...l,
                  changedAt: new Date(l.changedAt).toISOString(),
                })),
              }
            : b
        )
      )
    } finally {
      setSavingId(null)
    }
  }

  const deleteBug = async (id: string) => {
    if (!confirm("Supprimer définitivement ce retour ?")) return
    setSavingId(id)
    try {
      const res = await fetch(`/api/admin/bugs/${id}`, { method: "DELETE" })
      if (!res.ok) {
        alert("Erreur lors de la suppression")
        return
      }
      setBugs((prev) => prev.filter((b) => b.id !== id))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-red-700">Ouverts</CardDescription>
            <CardTitle className="text-3xl text-red-700">{stats.open}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-amber-700">En cours</CardDescription>
            <CardTitle className="text-3xl text-amber-700">
              {stats.inProgress}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-emerald-700">Résolus</CardDescription>
            <CardTitle className="text-3xl text-emerald-700">
              {stats.resolved}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-lg">Filtres</CardTitle>
            <a
              href="/api/admin/bugs/export"
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </a>
          </div>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Rechercher (message, email, URL)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">Tous types</option>
            <option value="BUG">Bug</option>
            <option value="EVOLUTION">Évolution</option>
            <option value="AUTRE">Autre</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as typeof filterStatus)
            }
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">Tous statuts</option>
            <option value="OPEN">Ouvert</option>
            <option value="IN_PROGRESS">En cours</option>
            <option value="RESOLVED">Résolu</option>
          </select>
          <select
            value={filterPriority}
            onChange={(e) =>
              setFilterPriority(e.target.value as typeof filterPriority)
            }
            className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-4"
          >
            <option value="all">Toutes priorités</option>
            <option value="CRITICAL">Critique</option>
            <option value="HIGH">Haute</option>
            <option value="MEDIUM">Moyenne</option>
            <option value="LOW">Basse</option>
          </select>
        </CardContent>
      </Card>

      {/* Liste */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Retours ({filtered.length} / {bugs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              Aucun retour ne correspond aux filtres.
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((b) => (
                <BugCard
                  key={b.id}
                  bug={b}
                  expanded={expandedId === b.id}
                  onToggle={() =>
                    setExpandedId(expandedId === b.id ? null : b.id)
                  }
                  onUpdate={(payload) => updateBug(b.id, payload)}
                  onDelete={() => deleteBug(b.id)}
                  saving={savingId === b.id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function BugCard({
  bug,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
  saving,
}: {
  bug: BugRow
  expanded: boolean
  onToggle: () => void
  onUpdate: (payload: {
    status?: BugStatus
    priority?: BugPriority
    adminNote?: string | null
    statusNote?: string
  }) => void
  onDelete: () => void
  saving: boolean
}) {
  const [note, setNote] = useState(bug.adminNote ?? "")
  const noteDirty = note !== (bug.adminNote ?? "")

  return (
    <div className="rounded-lg border bg-white hover:shadow-sm transition">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-4 flex items-start justify-between gap-3 flex-wrap"
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 mt-1 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 mt-1 shrink-0 text-slate-400" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {typeIcon(bug.type)}
              <span className="font-medium text-slate-900">
                {TYPE_LABELS[bug.type]}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-md ring-1 ${statusBadgeClass(bug.status)}`}
              >
                {STATUS_LABELS[bug.status]}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-md ${priorityBadgeClass(bug.priority)}`}
              >
                {PRIORITY_LABELS[bug.priority]}
              </span>
            </div>
            <p className="text-sm text-slate-700 mt-1.5 line-clamp-2 break-words">
              {bug.message}
            </p>
            <div className="text-xs text-slate-500 mt-1.5 font-mono truncate">
              {bug.user.name ? `${bug.user.name} · ` : ""}
              {bug.user.email}
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-400 shrink-0">
          {formatDate(bug.createdAt)}
        </div>
      </button>

      {expanded && (
        <div className="border-t bg-slate-50/50 p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Message complet
            </p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">
              {bug.message}
            </p>
          </div>

          {(bug.url || bug.userAgent || bug.viewport) && (
            <div className="rounded-md bg-white border p-3 space-y-1.5 text-xs font-mono">
              {bug.url && (
                <div className="flex items-start gap-2">
                  <span className="text-slate-500 shrink-0">URL :</span>
                  <a
                    href={bug.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all inline-flex items-center gap-1"
                  >
                    {bug.url}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              )}
              {bug.viewport && (
                <div className="flex gap-2">
                  <span className="text-slate-500 shrink-0">Viewport :</span>
                  <span className="text-slate-700">{bug.viewport}</span>
                </div>
              )}
              {bug.userAgent && (
                <div className="flex items-start gap-2">
                  <span className="text-slate-500 shrink-0">UA :</span>
                  <span className="text-slate-700 break-all">{bug.userAgent}</span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Statut
              </label>
              <select
                value={bug.status}
                disabled={saving}
                onChange={(e) =>
                  onUpdate({ status: e.target.value as BugStatus })
                }
                className="mt-1 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
              >
                <option value="OPEN">Ouvert</option>
                <option value="IN_PROGRESS">En cours</option>
                <option value="RESOLVED">Résolu</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Priorité
              </label>
              <select
                value={bug.priority}
                disabled={saving}
                onChange={(e) =>
                  onUpdate({ priority: e.target.value as BugPriority })
                }
                className="mt-1 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
              >
                <option value="LOW">Basse</option>
                <option value="MEDIUM">Moyenne</option>
                <option value="HIGH">Haute</option>
                <option value="CRITICAL">Critique</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Note interne admin
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Note interne (visible uniquement par les admins)…"
              className="mt-1"
            />
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                disabled={!noteDirty || saving}
                onClick={() => onUpdate({ adminNote: note || null })}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1" />
                )}
                Enregistrer la note
              </Button>
            </div>
          </div>

          {bug.statusLogs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Historique de statut
              </p>
              <ul className="space-y-1.5 text-xs">
                {bug.statusLogs.map((l) => (
                  <li
                    key={l.id}
                    className="flex flex-wrap items-center gap-1.5 text-slate-600"
                  >
                    <span className="text-slate-400">{formatDate(l.changedAt)}</span>
                    <Badge variant="outline" className="text-xs">
                      {l.fromStatus ? STATUS_LABELS[l.fromStatus] : "—"} →{" "}
                      {STATUS_LABELS[l.toStatus]}
                    </Badge>
                    {l.changedBy && (
                      <span className="text-slate-500">
                        par {l.changedBy.name || l.changedBy.email}
                      </span>
                    )}
                    {l.note && (
                      <span className="text-slate-500 italic">— {l.note}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              disabled={saving}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Supprimer
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
