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
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Pencil, Shield, ShieldOff, UserX, UserCheck, Trash2 } from "lucide-react"
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
    if (!confirm("Supprimer cet utilisateur et toutes ses donnees ?")) return

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
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Utilisateur</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-center">Donnees</TableHead>
            <TableHead>Cree le</TableHead>
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
                  <Badge variant="outline" className="border-gray-300 text-gray-500">
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
  )
}
