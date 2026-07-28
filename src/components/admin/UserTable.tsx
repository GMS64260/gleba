"use client"

/**
 * Table des utilisateurs
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { confirmDialog } from "@/lib/global-dialog"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Pencil, Shield, ShieldOff, UserX, UserCheck, Trash2, Eye, LogIn, Copy, ExternalLink } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

interface User {
  id: string
  email: string
  name: string | null
  role: string
  active: boolean
  createdAt: Date
  updatedAt: Date
  _count: {
    cultures: number
    planches: number
    recoltes: number
  }
}

interface UserTableProps {
  users: User[]
}

export function UserTable({ users }: UserTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState<string | null>(null)
  // Consultation lecture seule : lien one-time à ouvrir en navigation privée.
  const [impersonation, setImpersonation] = React.useState<{
    url: string
    label: string
    expiresInSec: number
  } | null>(null)

  async function ouvrirSession(user: User) {
    setLoading(user.id)
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Erreur")
      setImpersonation({
        url: `${window.location.origin}${data.url}`,
        label: user.name || user.email,
        expiresInSec: data.expiresInSec ?? 120,
      })
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Impossible d'ouvrir la consultation",
        variant: "destructive",
      })
    } finally {
      setLoading(null)
    }
  }

  async function toggleActive(userId: string, currentActive: boolean) {
    setLoading(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      })

      if (!res.ok) throw new Error("Erreur")

      toast({
        title: currentActive ? "Utilisateur desactive" : "Utilisateur active",
      })
      router.refresh()
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'utilisateur",
        variant: "destructive",
      })
    } finally {
      setLoading(null)
    }
  }

  async function toggleRole(userId: string, currentRole: string) {
    setLoading(userId)
    try {
      const newRole = currentRole === "ADMIN" ? "USER" : "ADMIN"
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      })

      if (!res.ok) throw new Error("Erreur")

      toast({
        title: `Role modifie en ${newRole}`,
      })
      router.refresh()
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le role",
        variant: "destructive",
      })
    } finally {
      setLoading(null)
    }
  }

  async function deleteUser(userId: string) {
    if (!(await confirmDialog("Supprimer cet utilisateur et toutes ses donnees ?"))) return

    setLoading(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      })

      if (!res.ok) throw new Error("Erreur")

      toast({ title: "Utilisateur supprime" })
      router.refresh()
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'utilisateur",
        variant: "destructive",
      })
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Utilisateur</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-center">Donnees</TableHead>
            <TableHead>Créé le</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id} className={loading === user.id ? "opacity-50" : ""}>
              <TableCell>
                <div>
                  <p className="font-medium">{user.name || "-"}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </TableCell>
              <TableCell>
                {user.role === "ADMIN" ? (
                  <Badge variant="default" className="bg-amber-500">
                    <Shield className="h-3 w-3 mr-1" />
                    Admin
                  </Badge>
                ) : (
                  <Badge variant="secondary">Utilisateur</Badge>
                )}
              </TableCell>
              <TableCell>
                {user.active ? (
                  <Badge variant="outline" className="border-green-500 text-green-600">
                    Actif
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-slate-300 text-slate-500">
                    Inactif
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-center text-sm text-muted-foreground">
                {user._count.cultures} cultures / {user._count.planches} planches / {user._count.recoltes} recoltes
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(user.createdAt).toLocaleDateString("fr-FR")}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" disabled={loading === user.id}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => ouvrirSession(user)}
                      disabled={loading === user.id}
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      Ouvrir sa session (nav privé)
                    </DropdownMenuItem>
                    <Link href={`/admin/users/${user.id}/consultation`}>
                      <DropdownMenuItem className="cursor-pointer">
                        <Eye className="mr-2 h-4 w-4" />
                        Aperçu des données
                      </DropdownMenuItem>
                    </Link>
                    <Link href={`/admin/users/${user.id}`}>
                      <DropdownMenuItem className="cursor-pointer">
                        <Pencil className="mr-2 h-4 w-4" />
                        Modifier
                      </DropdownMenuItem>
                    </Link>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => toggleActive(user.id, user.active)}
                    >
                      {user.active ? (
                        <>
                          <UserX className="mr-2 h-4 w-4" />
                          Desactiver
                        </>
                      ) : (
                        <>
                          <UserCheck className="mr-2 h-4 w-4" />
                          Activer
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => toggleRole(user.id, user.role)}
                    >
                      {user.role === "ADMIN" ? (
                        <>
                          <ShieldOff className="mr-2 h-4 w-4" />
                          Retirer admin
                        </>
                      ) : (
                        <>
                          <Shield className="mr-2 h-4 w-4" />
                          Promouvoir admin
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer text-red-600 focus:text-red-600"
                      onClick={() => deleteUser(user.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    <Dialog open={impersonation != null} onOpenChange={(o) => { if (!o) setImpersonation(null) }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5 text-amber-600" />
            Consulter la session de {impersonation?.label}
          </DialogTitle>
          <DialogDescription>
            Lien à usage unique, valable {impersonation ? Math.round(impersonation.expiresInSec / 60) : 2} min.
            Ouvre-le dans une <strong>fenêtre de navigation privée</strong> pour te connecter comme cet
            utilisateur <strong>sans perdre ta session admin</strong>. La session sera en <strong>lecture seule</strong>.
          </DialogDescription>
        </DialogHeader>
        {impersonation && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={impersonation.url} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  navigator.clipboard?.writeText(impersonation.url)
                  toast({ title: "Lien copié" })
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
              <li>Copie le lien ci-dessus.</li>
              <li>Ouvre une fenêtre de navigation privée (Ctrl/Cmd+Maj+N).</li>
              <li>Colle le lien : tu verras l&apos;app exactement comme l&apos;utilisateur.</li>
            </ol>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => window.open(impersonation.url, "_blank", "noopener")}
            >
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Ouvrir dans un nouvel onglet (remplace ta session ici)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  )
}
