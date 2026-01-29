"use client"

/**
 * Formulaire de creation/edition d'utilisateur
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface User {
  id: string
  email: string
  name: string | null
  role: string
  active: boolean
}

interface UserFormProps {
  user?: User
}

export function UserForm({ user }: UserFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const isEdit = !!user

  const [loading, setLoading] = React.useState(false)
  const [formData, setFormData] = React.useState({
    email: user?.email || "",
    name: user?.name || "",
    password: "",
    role: user?.role || "USER",
    active: user?.active ?? true,
    createSampleData: true, // Par défaut, créer les données d'exemple
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const url = isEdit ? `/api/admin/users/${user.id}` : "/api/admin/users"
      const method = isEdit ? "PATCH" : "POST"

      // Pour l'edition, n'envoyer le mot de passe que s'il est rempli
      const body = isEdit
        ? {
            name: formData.name || null,
            role: formData.role,
            active: formData.active,
            ...(formData.password && { password: formData.password }),
          }
        : formData

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Erreur")
      }

      toast({
        title: isEdit ? "Utilisateur modifie" : "Utilisateur cree",
        description: isEdit ? undefined : `Mot de passe temporaire : ${formData.password}`,
      })

      router.push("/admin/users")
      router.refresh()
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="utilisateur@example.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
          disabled={loading || isEdit}
        />
        {isEdit && (
          <p className="text-xs text-muted-foreground">
            L&apos;email ne peut pas etre modifie
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Nom</Label>
        <Input
          id="name"
          type="text"
          placeholder="Prenom Nom"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">
          {isEdit ? "Nouveau mot de passe (laisser vide pour conserver)" : "Mot de passe"}
        </Label>
        <Input
          id="password"
          type="password"
          placeholder={isEdit ? "Nouveau mot de passe..." : "Mot de passe initial"}
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required={!isEdit}
          disabled={loading}
          minLength={6}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select
          value={formData.role}
          onValueChange={(value) => setFormData({ ...formData, role: value })}
          disabled={loading}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USER">Utilisateur</SelectItem>
            <SelectItem value="ADMIN">Administrateur</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="active">Compte actif</Label>
          <p className="text-xs text-muted-foreground">
            Les comptes inactifs ne peuvent pas se connecter
          </p>
        </div>
        <Switch
          id="active"
          checked={formData.active}
          onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
          disabled={loading}
        />
      </div>

      {!isEdit && (
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="createSampleData">Données d&apos;exemple</Label>
            <p className="text-xs text-muted-foreground">
              Créer 2 planches, 4 cultures et 2 arbres pour démarrer
            </p>
          </div>
          <Switch
            id="createSampleData"
            checked={formData.createSampleData}
            onCheckedChange={(checked) => setFormData({ ...formData, createSampleData: checked })}
            disabled={loading}
          />
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEdit ? "Modification..." : "Creation..."}
            </>
          ) : (
            isEdit ? "Enregistrer" : "Creer l'utilisateur"
          )}
        </Button>
      </div>
    </form>
  )
}
