"use client"

/**
 * Onglets admin : Logs de connexion + Métriques d'utilisation
 */

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { LogIn, BarChart3, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"

interface LoginLog {
  id: number
  email: string
  success: boolean
  reason: string | null
  ip: string | null
  createdAt: string
  user: { name: string | null; role: string } | null
}

interface DemoMetrics {
  user: { email: string; name: string | null; createdAt: string } | null
  data: {
    cultures: number
    planches: number
    recoltes: number
    arbres: number
    animaux: number
  }
  activity: {
    totalLogins: number
    logins7d: number
    logins30d: number
    lastLogin: string | null
  }
}

interface GlobalMetrics {
  totalUsers: number
  activeUsers: number
  totalLogins30d: number
  failedLogins30d: number
  totalCultures: number
  totalRecoltes: number
}

const REASON_LABELS: Record<string, string> = {
  ok: "Succes",
  bad_password: "Mauvais mot de passe",
  not_found: "Compte inexistant",
  inactive: "Compte desactive",
  email_not_verified: "Email non verifie",
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function AdminTabs() {
  return (
    <Tabs defaultValue="logs" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="logs" className="gap-2">
          <LogIn className="h-4 w-4" />
          Logs de connexion
        </TabsTrigger>
        <TabsTrigger value="metrics" className="gap-2">
          <BarChart3 className="h-4 w-4" />
          Metriques
        </TabsTrigger>
      </TabsList>

      <TabsContent value="logs">
        <LoginLogsPanel />
      </TabsContent>

      <TabsContent value="metrics">
        <MetricsPanel />
      </TabsContent>
    </Tabs>
  )
}

function LoginLogsPanel() {
  const [logs, setLogs] = React.useState<LoginLog[]>([])
  const [page, setPage] = React.useState(1)
  const [pages, setPages] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [emailFilter, setEmailFilter] = React.useState("")

  const fetchLogs = React.useCallback(async (p: number, email?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: "30" })
      if (email) params.set("email", email)
      const res = await fetch(`/api/admin/logs?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLogs(data.logs)
      setPages(data.pages)
      setTotal(data.total)
      setPage(data.page)
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchLogs(1)
  }, [fetchLogs])

  const handleFilter = () => {
    fetchLogs(1, emailFilter || undefined)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logs de connexion</CardTitle>
        <CardDescription>{total} entrees au total</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtre par email */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Filtrer par email..."
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFilter()}
            className="flex h-9 w-full max-w-sm rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button variant="outline" size="sm" onClick={handleFilter}>
            Filtrer
          </Button>
          {emailFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEmailFilter("")
                fetchLogs(1)
              }}
            >
              Effacer
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Aucun log de connexion</p>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Statut</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Raison</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {log.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.user?.name || "-"}
                        {log.user?.role === "ADMIN" && (
                          <Badge variant="outline" className="ml-2 text-xs border-amber-400 text-amber-600">
                            Admin
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={log.success ? "outline" : "destructive"}
                          className={log.success ? "border-green-300 text-green-700" : ""}
                        >
                          {REASON_LABELS[log.reason || ""] || log.reason || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {page} sur {pages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => fetchLogs(page - 1, emailFilter || undefined)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pages}
                    onClick={() => fetchLogs(page + 1, emailFilter || undefined)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function MetricsPanel() {
  const [global, setGlobal] = React.useState<GlobalMetrics | null>(null)
  const [demo, setDemo] = React.useState<DemoMetrics | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch("/api/admin/metrics")
      .then((r) => r.json())
      .then((data) => {
        setGlobal(data.global)
        setDemo(data.demo)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Métriques globales */}
      {global && (
        <Card>
          <CardHeader>
            <CardTitle>Metriques globales (30 jours)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <Stat label="Connexions reussies" value={global.totalLogins30d} />
              <Stat label="Connexions echouees" value={global.failedLogins30d} color="red" />
              <Stat label="Utilisateurs actifs" value={global.activeUsers} />
              <Stat label="Total cultures" value={global.totalCultures} />
              <Stat label="Total récoltes" value={global.totalRecoltes} />
              <Stat label="Total utilisateurs" value={global.totalUsers} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Métriques compte démo */}
      {demo && (
        <Card>
          <CardHeader>
            <CardTitle>Compte demo (demo@gleba.fr)</CardTitle>
            <CardDescription>
              {demo.user && (
                <>
                  Cree le {formatDate(demo.user.createdAt)}
                  {demo.activity.lastLogin && (
                    <> &middot; Derniere connexion : {formatDate(demo.activity.lastLogin)}</>
                  )}
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <Stat label="Connexions totales" value={demo.activity.totalLogins} />
              <Stat label="Connexions (7j)" value={demo.activity.logins7d} />
              <Stat label="Connexions (30j)" value={demo.activity.logins30d} />
              <Stat label="Cultures" value={demo.data.cultures} />
              <Stat label="Planches" value={demo.data.planches} />
              <Stat label="Récoltes" value={demo.data.recoltes} />
              <Stat label="Arbres" value={demo.data.arbres} />
              <Stat label="Animaux" value={demo.data.animaux} />
            </div>
          </CardContent>
        </Card>
      )}

      {!demo && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucun compte demo (demo@gleba.fr) trouve
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${color === "red" ? "text-red-500" : "text-slate-900"}`}>
        {value}
      </p>
    </div>
  )
}
