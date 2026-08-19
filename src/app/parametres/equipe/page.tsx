/**
 * Écran Équipe — les comptes invités dans l'exploitation.
 *
 * Réservé au propriétaire : un membre qui ouvre cette page se voit proposer de
 * quitter l'exploitation, rien d'autre. L'API applique la même règle, cet écran
 * ne fait que la refléter.
 */

'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Mail, Trash2, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { MODULES, MODULE_IDS, type ModuleId } from '@/lib/modules'
import { invaliderContexteExploitation, useExploitation } from '@/hooks/use-exploitation'

type Membre = {
  id: string
  email: string
  nom: string | null
  role: 'MEMBRE' | 'CONSULTATION'
  modules: string[]
  etat: 'EN_ATTENTE' | 'EXPIREE' | 'ACTIVE' | 'REVOQUEE'
  accepteLe: string | null
  revoqueLe: string | null
}

const LIBELLE_ROLE: Record<Membre['role'], string> = {
  MEMBRE: 'Membre (saisie)',
  CONSULTATION: 'Consultation (lecture seule)',
}

const LIBELLE_ETAT: Record<Membre['etat'], string> = {
  EN_ATTENTE: 'Invitation envoyée',
  EXPIREE: 'Invitation expirée',
  ACTIVE: 'Actif',
  REVOQUEE: 'Révoqué',
}

function variantEtat(etat: Membre['etat']) {
  if (etat === 'ACTIVE') return 'default' as const
  if (etat === 'REVOQUEE') return 'destructive' as const
  return 'secondary' as const
}

export default function EquipePage() {
  const { toast } = useToast()
  const { contexte } = useExploitation()
  const [membres, setMembres] = React.useState<Membre[] | null>(null)
  const [interdit, setInterdit] = React.useState(false)
  const [chargement, setChargement] = React.useState(true)
  const [email, setEmail] = React.useState('')
  const [role, setRole] = React.useState<Membre['role']>('MEMBRE')
  const [modules, setModules] = React.useState<ModuleId[]>([])
  const [envoiEnCours, setEnvoiEnCours] = React.useState(false)
  const [actionEnCours, setActionEnCours] = React.useState<string | null>(null)

  const charger = React.useCallback(async () => {
    try {
      const reponse = await fetch('/api/exploitation/membres')
      if (reponse.status === 403) {
        setInterdit(true)
        return
      }
      if (!reponse.ok) throw new Error(String(reponse.status))
      const { data } = (await reponse.json()) as { data: Membre[] }
      setMembres(data)
    } catch {
      toast({ title: 'Chargement impossible', description: 'Réessayez dans un instant.', variant: 'destructive' })
    } finally {
      setChargement(false)
    }
  }, [toast])

  React.useEffect(() => {
    void charger()
  }, [charger])

  async function inviter(event: React.FormEvent) {
    event.preventDefault()
    if (envoiEnCours) return
    setEnvoiEnCours(true)
    try {
      const reponse = await fetch('/api/exploitation/membres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, modules }),
      })
      const corps = await reponse.json().catch(() => ({}))
      if (!reponse.ok) {
        toast({ title: 'Invitation refusée', description: corps.error ?? 'Erreur', variant: 'destructive' })
        return
      }
      toast({
        title: 'Invitation envoyée',
        description: corps.data?.emailEnvoye
          ? `${email} recevra un lien valable 7 jours.`
          : `Invitation créée, mais l'email n'a pas pu partir. Utilisez « Renvoyer ».`,
      })
      setEmail('')
      setModules([])
      await charger()
    } finally {
      setEnvoiEnCours(false)
    }
  }

  async function changerRole(membre: Membre, nouveauRole: Membre['role']) {
    setActionEnCours(membre.id)
    try {
      const reponse = await fetch(`/api/exploitation/membres/${membre.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nouveauRole }),
      })
      const corps = await reponse.json().catch(() => ({}))
      if (!reponse.ok) {
        toast({ title: 'Modification refusée', description: corps.error ?? 'Erreur', variant: 'destructive' })
        return
      }
      toast({
        title: 'Rôle mis à jour',
        description:
          nouveauRole === 'CONSULTATION'
            ? "Ce compte ne peut plus rien modifier, dès sa prochaine action."
            : 'Ce compte peut saisir dans votre exploitation.',
      })
      await charger()
    } finally {
      setActionEnCours(null)
    }
  }

  async function retirer(membre: Membre) {
    const question =
      membre.etat === 'EN_ATTENTE' || membre.etat === 'EXPIREE'
        ? `Annuler l'invitation de ${membre.email} ?`
        : `Retirer ${membre.email} de votre exploitation ? L'accès est coupé immédiatement ; ses saisies restent.`
    if (!window.confirm(question)) return
    setActionEnCours(membre.id)
    try {
      const reponse = await fetch(`/api/exploitation/membres/${membre.id}`, { method: 'DELETE' })
      if (!reponse.ok) {
        const corps = await reponse.json().catch(() => ({}))
        toast({ title: 'Action refusée', description: corps.error ?? 'Erreur', variant: 'destructive' })
        return
      }
      toast({ title: 'Accès retiré' })
      await charger()
    } finally {
      setActionEnCours(null)
    }
  }

  async function renvoyer(membre: Membre) {
    setActionEnCours(membre.id)
    try {
      const reponse = await fetch('/api/exploitation/membres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: membre.email, role: membre.role, modules: membre.modules }),
      })
      const corps = await reponse.json().catch(() => ({}))
      if (!reponse.ok) {
        toast({ title: 'Renvoi impossible', description: corps.error ?? 'Erreur', variant: 'destructive' })
        return
      }
      toast({ title: 'Invitation renvoyée', description: `Nouveau lien envoyé à ${membre.email}.` })
      await charger()
    } finally {
      setActionEnCours(null)
    }
  }

  async function quitter() {
    if (!window.confirm("Quitter cette exploitation ? Vous retrouverez vos propres données aussitôt.")) return
    const reponse = await fetch('/api/exploitation/quitter', { method: 'POST' })
    if (!reponse.ok) {
      toast({ title: 'Action impossible', variant: 'destructive' })
      return
    }
    invaliderContexteExploitation()
    window.location.href = '/'
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/parametres">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Paramètres
          </Link>
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Users className="h-6 w-6" />
          Équipe
        </h1>
      </div>

      {interdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Vous travaillez dans l&apos;exploitation de quelqu&apos;un d&apos;autre</CardTitle>
            <CardDescription>
              {contexte?.exploitation.nom
                ? `Vous êtes rattaché à ${contexte.exploitation.nom}. Seul le propriétaire gère les accès.`
                : 'Seul le propriétaire de l&apos;exploitation gère les accès.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Vos propres données ne sont pas supprimées : elles réapparaissent dès que vous quittez
              cette exploitation.
            </p>
            <Button variant="outline" onClick={quitter}>
              Quitter cette exploitation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Inviter quelqu&apos;un
              </CardTitle>
              <CardDescription>
                La personne reçoit un lien valable 7 jours. Elle doit avoir, ou créer, un compte Gleba
                avec cette adresse email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={inviter} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email-invite">Adresse email</Label>
                    <Input
                      id="email-invite"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="prenom.nom@exemple.fr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rôle</Label>
                    <Select value={role} onValueChange={(v) => setRole(v as Membre['role'])}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEMBRE">{LIBELLE_ROLE.MEMBRE}</SelectItem>
                        <SelectItem value="CONSULTATION">{LIBELLE_ROLE.CONSULTATION}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Modules affichés</Label>
                  <div className="flex flex-wrap gap-4">
                    {MODULE_IDS.map((id) => (
                      <label key={id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={modules.includes(id)}
                          onCheckedChange={(coche) =>
                            setModules((precedents) =>
                              coche ? [...precedents, id] : precedents.filter((m) => m !== id),
                            )
                          }
                        />
                        {MODULES[id].label}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Aucune case cochée = tous les modules. Ce réglage organise l&apos;affichage ; il ne
                    remplace pas le rôle, qui seul détermine le droit de modifier.
                  </p>
                </div>

                <Button type="submit" disabled={envoiEnCours || !email}>
                  {envoiEnCours ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Envoyer l&apos;invitation
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comptes rattachés</CardTitle>
              <CardDescription>
                Un compte invité travaille dans VOTRE exploitation : ses saisies vous appartiennent et
                restent si son accès est retiré.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chargement ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement…
                </div>
              ) : !membres || membres.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Personne pour l&apos;instant. Vous êtes seul sur cette exploitation.
                </p>
              ) : (
                <ul className="divide-y">
                  {membres.map((membre) => (
                    <li key={membre.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {membre.nom ? `${membre.nom} · ` : ''}
                          {membre.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {membre.modules.length > 0
                            ? membre.modules.map((m) => MODULES[m as ModuleId]?.label ?? m).join(', ')
                            : 'Tous les modules'}
                        </p>
                      </div>
                      <Badge variant={variantEtat(membre.etat)}>{LIBELLE_ETAT[membre.etat]}</Badge>
                      {membre.etat !== 'REVOQUEE' && (
                        <Select
                          value={membre.role}
                          onValueChange={(v) => changerRole(membre, v as Membre['role'])}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MEMBRE">{LIBELLE_ROLE.MEMBRE}</SelectItem>
                            <SelectItem value="CONSULTATION">{LIBELLE_ROLE.CONSULTATION}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {(membre.etat === 'EN_ATTENTE' || membre.etat === 'EXPIREE' || membre.etat === 'REVOQUEE') && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionEnCours === membre.id}
                          onClick={() => renvoyer(membre)}
                        >
                          <Mail className="mr-1 h-3.5 w-3.5" />
                          {membre.etat === 'REVOQUEE' ? 'Réinviter' : 'Renvoyer'}
                        </Button>
                      )}
                      {membre.etat !== 'REVOQUEE' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={actionEnCours === membre.id}
                          onClick={() => retirer(membre)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Retirer
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
