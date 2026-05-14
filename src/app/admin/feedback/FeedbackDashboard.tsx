"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Mail,
  Users,
  Star,
} from "lucide-react"

interface Response {
  id: string
  email: string
  name: string | null
  lang: string
  rating: number
  blockers: string[]
  whatBlocked: string | null
  missing: string | null
  modules: string[]
  willReturn: string | null
  comment: string | null
  createdAt: string
}

interface Pending {
  id: string
  email: string
  name: string | null
  createdAt: string
}

interface DashboardData {
  stats: {
    totalSent: number
    totalResponses: number
    responseRate: number
    avgRating: number | null
    pendingCount: number
    willReturn: Record<string, number>
    willReturnLabels: Record<string, string>
  }
  topBlockers: { code: string; label: string; count: number; pct: number }[]
  topModules: { code: string; label: string; count: number }[]
  responses: Response[]
  pending: Pending[]
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

function ratingColor(r: number) {
  if (r >= 8) return "text-emerald-700 bg-emerald-50 ring-emerald-200"
  if (r >= 5) return "text-amber-700 bg-amber-50 ring-amber-200"
  return "text-red-700 bg-red-50 ring-red-200"
}

export function FeedbackDashboard({ data }: { data: DashboardData }) {
  const router = useRouter()
  const { stats, topBlockers, topModules, responses, pending } = data

  const [resending, setResending] = useState(false)
  const [resendResult, setResendResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const handleResend = async () => {
    if (
      !confirm(
        `Renvoyer l'invitation feedback aux ${pending.length} utilisateur(s) qui n'ont pas répondu ?`
      )
    ) {
      return
    }
    setResending(true)
    setResendResult(null)
    try {
      const res = await fetch("/api/admin/feedback/resend", { method: "POST" })
      const json = await res.json()
      if (!res.ok) {
        setResendResult({
          success: false,
          message: json.error || "Erreur lors de la relance",
        })
      } else {
        setResendResult({
          success: true,
          message: `${json.sent} email(s) envoyé(s), ${json.failed} échec(s).`,
        })
        router.refresh()
      }
    } catch (err) {
      setResendResult({
        success: false,
        message: err instanceof Error ? err.message : "Erreur réseau",
      })
    }
    setResending(false)
  }

  return (
    <div className="space-y-8">
      {/* Stats globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> Envoyés
            </CardDescription>
            <CardTitle className="text-3xl">{stats.totalSent}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Réponses
            </CardDescription>
            <CardTitle className="text-3xl">{stats.totalResponses}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Taux
            </CardDescription>
            <CardTitle className="text-3xl">{stats.responseRate}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Star className="h-4 w-4" /> Note moyenne
            </CardDescription>
            <CardTitle className="text-3xl">
              {stats.avgRating !== null ? stats.avgRating.toFixed(1) : "—"}
              <span className="text-base text-slate-400">/10</span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Relance */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-lg">Relance des non-répondants</CardTitle>
              <CardDescription>
                {pending.length === 0
                  ? "Tout le monde a répondu 🎉"
                  : `${pending.length} utilisateur(s) n'ont pas encore répondu.`}
              </CardDescription>
            </div>
            <Button
              onClick={handleResend}
              disabled={resending || pending.length === 0}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {resending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Envoi en cours…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Relancer ({pending.length})
                </>
              )}
            </Button>
          </div>
          {resendResult && (
            <div
              className={`mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
                resendResult.success
                  ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                  : "bg-red-50 text-red-800 ring-1 ring-red-200"
              }`}
            >
              {resendResult.success ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <span>{resendResult.message}</span>
            </div>
          )}
        </CardHeader>
        {pending.length > 0 && (
          <CardContent>
            <div className="rounded-lg border bg-slate-50/50 max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Inscrit le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-xs">
                        {u.email}
                      </TableCell>
                      <TableCell>{u.name || "—"}</TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {formatDate(u.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Agrégats */}
      {responses.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top points bloquants</CardTitle>
              <CardDescription>Cochés par les répondants</CardDescription>
            </CardHeader>
            <CardContent>
              {topBlockers.length === 0 ? (
                <p className="text-sm text-slate-500">—</p>
              ) : (
                <div className="space-y-3">
                  {topBlockers.map((b) => (
                    <div key={b.code}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-slate-700">
                          {b.label}
                        </span>
                        <span className="text-slate-500">
                          {b.count} ({b.pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
                          style={{ width: `${b.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Reviendront-ils ?</CardTitle>
              <CardDescription>Intention déclarée</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(["yes", "maybe", "no"] as const).map((k) => {
                  const count = stats.willReturn[k] || 0
                  const pct = responses.length
                    ? Math.round((count / responses.length) * 100)
                    : 0
                  const colors: Record<string, string> = {
                    yes: "from-emerald-400 to-teal-500",
                    maybe: "from-amber-400 to-yellow-500",
                    no: "from-red-400 to-rose-500",
                  }
                  return (
                    <div key={k}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-slate-700">
                          {stats.willReturnLabels[k]}
                        </span>
                        <span className="text-slate-500">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${colors[k]}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              {topModules.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Modules essayés
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {topModules.map((m) => (
                      <Badge key={m.code} variant="secondary">
                        {m.label} · {m.count}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Liste des réponses */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Réponses ({responses.length})
          </CardTitle>
          <CardDescription>Les plus récentes en premier</CardDescription>
        </CardHeader>
        <CardContent>
          {responses.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              Aucune réponse pour le moment.
            </p>
          ) : (
            <div className="space-y-4">
              {responses.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border bg-white p-4 hover:shadow-sm transition"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-medium text-slate-900">
                        {r.name || r.email}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {r.email}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold ring-1 ${ratingColor(
                          r.rating
                        )}`}
                      >
                        {r.rating}/10
                      </span>
                      {r.willReturn && (
                        <Badge variant="outline">{r.willReturn}</Badge>
                      )}
                      <Badge variant="secondary" className="uppercase text-xs">
                        {r.lang}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {formatDate(r.createdAt)}
                      </span>
                    </div>
                  </div>

                  {r.blockers.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {r.blockers.map((b, i) => (
                        <Badge
                          key={i}
                          className="bg-amber-100 text-amber-800 hover:bg-amber-100"
                        >
                          {b}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {r.whatBlocked && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Ce qui l&apos;a freiné
                      </p>
                      <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">
                        {r.whatBlocked}
                      </p>
                    </div>
                  )}

                  {r.missing && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Fonctionnalités manquantes
                      </p>
                      <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">
                        {r.missing}
                      </p>
                    </div>
                  )}

                  {r.modules.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Modules :
                      </span>
                      {r.modules.map((m, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {r.comment && (
                    <div className="mt-3 rounded-md bg-emerald-50 border-l-2 border-emerald-400 p-3">
                      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                        Commentaire
                      </p>
                      <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">
                        {r.comment}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
