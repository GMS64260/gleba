/**
 * Écran d'acceptation d'une invitation.
 *
 * Le lien arrive par email. La page exige une session (le middleware redirige
 * vers /login en conservant l'URL), puis dit franchement ce qui va se passer,
 * y compris la conséquence gênante : tant qu'on est membre d'une autre
 * exploitation, ses propres données ne sont plus affichées. Rien n'est
 * supprimé, et quitter les fait revenir.
 */

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { invaliderContexteExploitation } from '@/hooks/use-exploitation'

type Invitation = {
  exploitation: string
  emailProprietaire: string
  emailInvite: string
  role: 'MEMBRE' | 'CONSULTATION'
  modules: string[]
  etat: string
  acceptable: boolean
  motif: string | null
  message: string | null
  donneesPropres: number
}

export default function InvitationPage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const [invitation, setInvitation] = React.useState<Invitation | null>(null)
  const [erreur, setErreur] = React.useState<string | null>(null)
  const [chargement, setChargement] = React.useState(true)
  const [acceptation, setAcceptation] = React.useState(false)

  React.useEffect(() => {
    let annule = false
    async function charger() {
      try {
        const reponse = await fetch(`/api/exploitation/invitations/${params.token}`)
        const corps = await reponse.json().catch(() => ({}))
        if (annule) return
        if (!reponse.ok) {
          setErreur(corps.error ?? "Cette invitation n'est pas valide.")
          return
        }
        setInvitation(corps.data as Invitation)
      } catch {
        if (!annule) setErreur('Chargement impossible. Réessayez dans un instant.')
      } finally {
        if (!annule) setChargement(false)
      }
    }
    void charger()
    return () => {
      annule = true
    }
  }, [params.token])

  async function accepter() {
    if (acceptation) return
    setAcceptation(true)
    try {
      const reponse = await fetch(`/api/exploitation/invitations/${params.token}`, { method: 'POST' })
      const corps = await reponse.json().catch(() => ({}))
      if (!reponse.ok) {
        toast({
          title: 'Impossible de rejoindre',
          description: corps.error ?? 'Erreur',
          variant: 'destructive',
        })
        return
      }
      invaliderContexteExploitation()
      toast({
        title: `Vous avez rejoint ${corps.data?.exploitation ?? "l'exploitation"}`,
        description: 'Vos écrans affichent désormais les données de cette exploitation.',
      })
      router.push('/')
    } finally {
      setAcceptation(false)
    }
  }

  return (
    <div className="container mx-auto flex max-w-lg flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Invitation à une exploitation
          </CardTitle>
          {invitation && (
            <CardDescription>
              {invitation.emailProprietaire} vous invite à rejoindre {invitation.exploitation}.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {chargement ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Vérification de l&apos;invitation…
            </div>
          ) : erreur ? (
            <>
              <p className="text-sm text-destructive">{erreur}</p>
              <Button variant="outline" asChild>
                <Link href="/">Retour à l&apos;accueil</Link>
              </Button>
            </>
          ) : invitation ? (
            <>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <p>
                  Rôle proposé :{' '}
                  <strong>
                    {invitation.role === 'CONSULTATION'
                      ? 'consultation, en lecture seule'
                      : 'membre, avec droit de saisie'}
                  </strong>
                </p>
                <p className="mt-1 text-muted-foreground">
                  Adresse invitée : {invitation.emailInvite}
                </p>
              </div>

              {invitation.acceptable ? (
                <>
                  {invitation.donneesPropres > 0 && (
                    <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <p>
                        Votre compte contient déjà {invitation.donneesPropres} élément
                        {invitation.donneesPropres > 1 ? 's' : ''} (planches, cultures, arbres,
                        animaux). Tant que vous travaillerez dans cette exploitation, vos écrans
                        afficheront les données de {invitation.exploitation} et non les vôtres. Rien
                        n&apos;est supprimé : tout revient si vous quittez l&apos;exploitation.
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={accepter} disabled={acceptation}>
                      {acceptation ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Rejoindre {invitation.exploitation}
                    </Button>
                    <Button variant="ghost" asChild>
                      <Link href="/">Plus tard</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-destructive">{invitation.message}</p>
                  <Button variant="outline" asChild>
                    <Link href="/">Retour à l&apos;accueil</Link>
                  </Button>
                </>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
