/**
 * Admin — Journal des erreurs serveur (table api_errors).
 *
 * Rend visibles les frictions silencieuses : erreurs 500 que les utilisateurs
 * subissent sans les signaler (cas fondateur du 2026-08-02 : 10 échecs
 * d'édition de culture découverts par hasard dans les logs docker).
 */

import { requireAdmin } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronLeft, ShieldAlert } from "lucide-react"

export const dynamic = "force-dynamic"

const FENETRE_JOURS = 7

export default async function AdminErreursPage() {
  await requireAdmin()

  const depuis = new Date(Date.now() - FENETRE_JOURS * 86_400_000)
  const [erreurs, parRoute, total24h] = await Promise.all([
    prisma.apiError.findMany({
      where: { createdAt: { gte: depuis } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.apiError.groupBy({
      by: ["route"],
      where: { createdAt: { gte: depuis } },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    prisma.apiError.count({
      where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    }),
  ])

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-red-600" />
          <div>
            <h1 className="text-2xl font-bold">Erreurs serveur</h1>
            <p className="text-sm text-muted-foreground">
              Journal global des {FENETRE_JOURS} derniers jours · {total24h} sur les dernières 24 h ·
              rétention 30 jours
            </p>
          </div>
        </div>
        <Link href="/admin">
          <Button variant="outline" size="sm">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Admin
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Routes les plus touchées ({FENETRE_JOURS} jours)</CardTitle>
          <CardDescription>
            Une même route qui revient = une friction que des utilisateurs subissent probablement en
            silence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {parRoute.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune erreur enregistrée. 🎉</p>
          ) : (
            <ul className="space-y-1">
              {parRoute.map((r) => (
                <li key={r.route ?? "∅"} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">{r._count._all}</Badge>
                  <code className="text-xs">{r.route ?? "sans route identifiée"}</code>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dernières occurrences</CardTitle>
        </CardHeader>
        <CardContent>
          {erreurs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Rien à afficher.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">Quand</th>
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">Route</th>
                    <th className="py-2">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {erreurs.map((e) => (
                    <tr key={e.id} className="border-b align-top last:border-0">
                      <td className="whitespace-nowrap py-2 pr-3 text-xs text-muted-foreground">
                        {e.createdAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={e.source === "uncaught" ? "destructive" : "outline"}>
                          {e.source}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3">
                        <code className="text-xs">{e.route ?? "—"}</code>
                      </td>
                      <td className="max-w-xl break-words py-2 text-xs">
                        {e.message.slice(0, 500)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
