'use client'
import * as React from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectNatif } from '@/components/ui/select-natif'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { MODES_REGLEMENT } from '@/lib/validations/reglement'
import { ReglementsDialog } from '@/components/comptabilite/ReglementsDialog'
import { useCandidatsBancaires } from '@/components/comptabilite/use-candidats-bancaires'
import type { TypeCibleReglement } from '@/lib/comptabilite/cle-reglement'
interface Compte {
  id: string
  nom: string
  devise: string
  source: string
  solde: number | null
  soldeAu: string | null
}
interface Connexion {
  id: string
  actif: boolean
  modeTest: boolean
  derniereSynchro: string | null
  resteHistorique: boolean
}
interface Operation {
  virementId: string | null
  virementRapproche: boolean
  id: string
  compteId: string
  date: string
  libelle: string
  reference: string
  montant: number
  brut: number
  frais: number
  famille: string
  statut: string
  aVerifier: boolean
  restePrincipal: number
  resteFrais: number
  motifExclusion: string | null
}
interface Reglement {
  reference?: string | null
  piece?: string | null
  id: string
  montant: number
  date: string
  libelle: string
  sens: string
  devise: string
}
interface Cible {
  type: TypeCibleReglement
  id: number
  libelle: string
  sens: string
  devise: string
  montantTotal: number
  resteAPayer: number
  montantRegle: number
  detaille: boolean
}
interface CandidatVirement {
  id: string
  compteId: string
  compteNom: string
  devise: string
  date: string
  libelle: string
  montant: number
}
interface Donnees {
  compteDemo: boolean
  comptes: Compte[]
  connexions: Connexion[]
  operations: Operation[]
  curseurSuivant: string | null
  peutConnecter: boolean
  configuration: { oauthDisponible: boolean; chiffrementDisponible: boolean }
}
const VIREMENTS = ['payout', 'payout_cancel', 'payout_failure', 'transfer', 'transfer_cancel']
const argent = (n: number, devise = 'EUR') =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: devise }).format(n)
export default function BanquePage() {
  const { data: session } = useSession(),
    lectureSeule =
      session?.user.peutEcrireExploitation === false || Boolean(session?.user.impersonatedBy)
  const [donnees, setDonnees] = React.useState<Donnees | null>(null),
    [compteId, setCompteId] = React.useState(''),
    [charge, setCharge] = React.useState(false),
    [enCours, setEnCours] = React.useState(false)
  const [erreur, setErreur] = React.useState<string | null>(null),
    [message, setMessage] = React.useState<string | null>(null)
  const [nomCompte, setNomCompte] = React.useState(''),
    [devise, setDevise] = React.useState('EUR'),
    [cleStripe, setCleStripe] = React.useState(''),
    [dialogStripe, setDialogStripe] = React.useState(false)
  const [operation, setOperation] = React.useState<Operation | null>(null),
    [partie, setPartie] = React.useState<'principal' | 'frais'>('principal')
  const [actualisationCibles, setActualisationCibles] = React.useState(0)
  const [cibles, setCibles] = React.useState<Cible[]>([]),
    [recherche, setRecherche] = React.useState(''),
    [choix, setChoix] = React.useState(''),
    [montant, setMontant] = React.useState(''),
    [mode, setMode] = React.useState(''),
    [remboursement, setRemboursement] = React.useState(false),
    [cleRapprochement, setCleRapprochement] = React.useState('')
  const [virement, setVirement] = React.useState<Operation | null>(null),
    [contrepartie, setContrepartie] = React.useState('')
  const [rechercheVirement, setRechercheVirement] = React.useState('')
  const reglementsCandidats = useCandidatsBancaires<Reglement>(
    operation?.id ?? null,
    'reglements',
    partie,
    recherche,
    actualisationCibles,
  )
  const virementsCandidats = useCandidatsBancaires<CandidatVirement>(
    virement?.id ?? null,
    'virements',
    'principal',
    rechercheVirement,
  )
  const [exclusion, setExclusion] = React.useState<Operation | null>(null),
    [motif, setMotif] = React.useState('')
  const charger = React.useCallback(
    async (curseur?: string) => {
      setCharge(true)
      try {
        const r = await fetch(
          '/api/comptabilite/banque?' +
            new URLSearchParams({
              ...(compteId ? { compteId } : {}),
              ...(curseur ? { curseur } : {}),
            }),
        )
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Chargement impossible.')
        setDonnees((ancien) =>
          curseur && ancien
            ? { ...d, operations: [...ancien.operations, ...d.operations] }
            : d,
        )
      } catch (e) {
        setErreur(e instanceof Error ? e.message : 'Chargement impossible.')
      } finally {
        setCharge(false)
      }
    },
    [compteId],
  )
  React.useEffect(() => {
    void charger()
  }, [charger])
  React.useEffect(() => {
    const url = new URL(window.location.href),
      resultat = url.searchParams.get('connexion')
    if (resultat === 'connecte')
      setMessage('Stripe connecté. La synchronisation peut commencer.')
    if (resultat === 'echec')
      setErreur(
        'La connexion Stripe n’a pas abouti. Relancez-la ou utilisez une clé restreinte.',
      )
    if (resultat) {
      url.searchParams.delete('connexion')
      window.history.replaceState(null, '', url.pathname + url.search)
    }
  }, [])
  React.useEffect(() => {
    if (!operation) return
    setCibles([])
    setChoix('')
    const controleur = new AbortController()
    const timer = setTimeout(() => {
      fetch('/api/comptabilite/reglements/cibles?' + new URLSearchParams({ q: recherche }), {
        signal: controleur.signal,
      })
        .then(async (r) => {
          const d = await r.json()
          if (!r.ok) throw new Error(d.error || 'Pièces indisponibles.')
          setCibles(d.data)
        })
        .catch((e: unknown) => {
          if (!controleur.signal.aborted)
            setErreur(e instanceof Error ? e.message : 'Pièces indisponibles.')
        })
    }, 200)
    return () => {
      clearTimeout(timer)
      controleur.abort()
    }
  }, [operation, recherche, actualisationCibles])
  const action = async (body: object) => {
    const r = await fetch('/api/comptabilite/banque', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error || 'Opération impossible.')
    return d
  }
  const executer = async (fn: () => Promise<void>) => {
    setEnCours(true)
    setErreur(null)
    setMessage(null)
    try {
      await fn()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Opération impossible.')
    } finally {
      await charger()
      setEnCours(false)
    }
  }
  const connecterOAuth = () =>
    executer(async () => {
      const r = await fetch('/api/comptabilite/banque/stripe', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Connexion indisponible.')
      if (new URL(d.url).origin !== 'https://connect.stripe.com')
        throw new Error('Adresse de connexion invalide.')
      window.location.assign(d.url)
    })
  const compte = (id: string) => donnees?.comptes.find((c) => c.id === id)
  const ouvrirRapprochement = (o: Operation, p: 'principal' | 'frais') => {
    setOperation(o)
    setPartie(p)
    setChoix('')
    setMontant(String(p === 'frais' ? o.resteFrais : o.restePrincipal))
    setMode('')
    setRemboursement(false)
    setRecherche('')
    setErreur(null)
    setCleRapprochement(crypto.randomUUID())
  }
  const flux = operation ? (partie === 'frais' ? -operation.frais : operation.brut) : 0
  const selection = cibles.find((c) => choix === c.type + ':' + c.id)
  const candidats = cibles.filter(
    (c) =>
      c.devise === compte(operation?.compteId || '')?.devise &&
      (remboursement
        ? c.sens === 'encaissement'
          ? -1
          : 1
        : c.sens === 'encaissement'
          ? 1
          : -1) === Math.sign(flux),
  )
  const existants =
    reglementsCandidats.lignes.filter(
      (r) =>
        r.devise === compte(operation?.compteId || '')?.devise &&
        Math.sign((r.sens === 'encaissement' ? 1 : -1) * r.montant) === Math.sign(flux) &&
        Math.abs(r.montant) <=
          (partie === 'frais'
            ? (operation?.resteFrais ?? 0)
            : (operation?.restePrincipal ?? 0)),
    ) || []
  const rapprocher = () =>
    executer(async () => {
      if (!operation) return
      const reglementId = choix.startsWith('reg:') ? choix.slice(4) : undefined
      if (reglementId && !existants.some((r) => r.id === reglementId))
        throw new Error('Choisissez un règlement actuellement proposé.')
      if (!reglementId && !selection) throw new Error('Choisissez une pièce ou un règlement.')
      await action({
        action: 'rapprocher',
        rapprochement: {
          operationId: operation.id,
          partie,
          reglementId,
          cible: selection ? { type: selection.type, id: selection.id } : undefined,
          montant: reglementId ? undefined : montant,
          modeReglement: reglementId ? undefined : mode,
          remboursement,
          cleIdempotence: cleRapprochement,
        },
      })
      setOperation(null)
      setMessage('Rapprochement enregistré, reste à payer actualisé.')
    })
  const importer = (file?: File) =>
    executer(async () => {
      if (!file || !compteId) throw new Error('Choisissez d’abord le compte du relevé.')
      if (file.size > 1_000_000) throw new Error('Le fichier doit faire moins de 1 Mo.')
      const d = await action({ action: 'importer', compteId, csv: await file.text() })
      setMessage(
        d.importees + ' opérations importées, ' + d.dejaPresentes + ' déjà présentes.',
      )
    })
  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Banque et rapprochement</h1>
          <p className="text-sm text-muted-foreground">
            Reliez les mouvements aux règlements, factures et dépenses.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/comptabilite/transactions">Transactions</Link>
          </Button>
          <Button variant="outline" disabled={charge || enCours} onClick={() => charger()}>
            Actualiser
          </Button>
        </div>
      </header>
      {erreur && (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {erreur}
        </p>
      )}
      {message && (
        <p role="status" className="rounded bg-green-50 p-3 text-sm text-green-800">
          {message}
        </p>
      )}
      {donnees && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Comptes suivis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!donnees.comptes.length && (
                  <p className="text-sm text-muted-foreground">
                    Ajoutez votre compte de relevés ou connectez Stripe.
                  </p>
                )}
                {donnees.comptes.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap justify-between gap-2 rounded border p-3"
                  >
                    <div>
                      <p className="font-medium">{c.nom}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.soldeAu
                          ? 'Solde disponible au ' +
                            new Date(c.soldeAu).toLocaleString('fr-FR')
                          : 'Solde bancaire non renseigné'}
                      </p>
                    </div>
                    <p>{c.solde == null ? '—' : argent(c.solde, c.devise)}</p>
                  </div>
                ))}
                {!lectureSeule && (
                  <form
                    className="flex flex-wrap items-end gap-2 border-t pt-3"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void executer(async () => {
                        await action({ action: 'compte', nom: nomCompte, devise })
                        setNomCompte('')
                        setMessage('Compte ajouté.')
                      })
                    }}
                  >
                    <div className="min-w-40 flex-1">
                      <Label htmlFor="banque-nom">Compte de relevés</Label>
                      <Input
                        id="banque-nom"
                        value={nomCompte}
                        onChange={(e) => setNomCompte(e.target.value)}
                        placeholder="Compte professionnel"
                        maxLength={100}
                        required
                      />
                    </div>
                    <div className="w-24">
                      <Label htmlFor="banque-devise">Devise</Label>
                      <Input
                        id="banque-devise"
                        value={devise}
                        onChange={(e) => setDevise(e.target.value.toUpperCase())}
                        maxLength={3}
                        minLength={3}
                        pattern="[A-Z]{3}"
                        required
                      />
                    </div>
                    <Button disabled={enCours} type="submit">
                      Ajouter
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Stripe</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {donnees.compteDemo && (
                  <p className="text-sm text-muted-foreground">
                    Créez votre compte pour connecter Stripe et importer vos relevés bancaires.
                  </p>
                )}
                <p className="text-sm">
                  Encaissements, frais et virements Stripe actualisés périodiquement. Les
                  autres mouvements de votre banque se suivent par import de relevé.
                </p>
                {donnees.connexions.map((c) => (
                  <div key={c.id} className="space-y-2 rounded border p-3">
                    <p className="font-medium">
                      {c.modeTest ? 'Connexion de test' : 'Connexion réelle'} ·{' '}
                      {c.actif ? 'active' : 'désactivée'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.derniereSynchro
                        ? 'Dernière synchronisation : ' +
                          new Date(c.derniereSynchro).toLocaleString('fr-FR')
                        : 'Synchronisation à lancer'}
                    </p>
                    {c.modeTest && (
                      <p className="text-xs text-amber-800">
                        Ces opérations de test ne règlent aucune pièce réelle.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {c.actif && !lectureSeule && (
                        <Button
                          disabled={enCours}
                          size="sm"
                          onClick={() =>
                            executer(async () => {
                              const d = await action({
                                action: 'synchroniser',
                                connexionId: c.id,
                              })
                              setMessage(
                                d.importees +
                                  ' opérations ajoutées.' +
                                  (!d.historiqueComplet
                                    ? ' Poursuivez la synchronisation pour charger la suite.'
                                    : ''),
                              )
                            })
                          }
                        >
                          {c.resteHistorique
                            ? 'Poursuivre la synchronisation'
                            : 'Synchroniser'}
                        </Button>
                      )}
                      {c.actif && donnees.peutConnecter && (
                        <Button
                          disabled={enCours}
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            executer(async () => {
                              await action({ action: 'deconnecter', connexionId: c.id })
                              setMessage('Accès Stripe retiré, historique conservé.')
                            })
                          }
                        >
                          Déconnecter
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {donnees.peutConnecter && (
                  <div className="flex flex-wrap gap-2">
                    {donnees.configuration.oauthDisponible && (
                      <Button disabled={enCours} onClick={connecterOAuth}>
                        Connecter mon compte Stripe
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      disabled={!donnees.configuration.chiffrementDisponible || enCours}
                      onClick={() => setDialogStripe(true)}
                    >
                      Connecter avec une clé restreinte
                    </Button>
                  </div>
                )}
                {donnees.peutConnecter && !donnees.configuration.chiffrementDisponible && (
                  <p className="text-sm text-amber-800">
                    Le chiffrement des connexions doit être configuré sur le serveur.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Opérations à rapprocher</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-52">
                  <Label htmlFor="banque-compte">Compte</Label>
                  <SelectNatif
                    id="banque-compte"
                    value={compteId}
                    onChange={(e) => setCompteId(e.target.value)}
                  >
                    <option value="">Tous les comptes</option>
                    {donnees.comptes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom}
                      </option>
                    ))}
                  </SelectNatif>
                </div>
                {!lectureSeule &&
                  !donnees.compteDemo &&
                  compte(compteId)?.source === 'releve' && (
                    <div>
                      <Label htmlFor="banque-csv">Importer un relevé CSV</Label>
                      <Input
                        id="banque-csv"
                        type="file"
                        accept=".csv,text/csv"
                        disabled={enCours}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          e.target.value = ''
                          if (file) void importer(file)
                        }}
                      />
                    </div>
                  )}
              </div>
              <p className="text-xs text-muted-foreground">
                CSV UTF-8 : Date, Libellé, Montant (ou Débit et Crédit), Référence facultative.
                Sans référence bancaire, vérifiez les lignes identiques entre plusieurs
                relevés.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2">Date et libellé</th>
                      <th className="p-2">Net</th>
                      <th className="p-2">Brut et frais</th>
                      <th className="p-2">Rapprochement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donnees.operations.map((o) => (
                      <tr key={o.id} className="border-b align-top">
                        <td className="max-w-xs p-2">
                          <p>
                            {new Date(o.date).toLocaleDateString('fr-FR')} ·{' '}
                            {compte(o.compteId)?.nom}
                          </p>
                          <p className="font-medium">{o.libelle}</p>
                          <p className="break-all text-xs text-muted-foreground">
                            {o.reference}
                          </p>
                        </td>
                        <td className="whitespace-nowrap p-2">
                          {argent(o.montant, compte(o.compteId)?.devise)}
                        </td>
                        <td className="whitespace-nowrap p-2">
                          <p>{argent(o.brut, compte(o.compteId)?.devise)}</p>
                          {o.frais !== 0 && (
                            <p className="text-xs">
                              Frais : {argent(o.frais, compte(o.compteId)?.devise)}
                            </p>
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-2">
                            {o.virementId && !lectureSeule && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={enCours}
                                onClick={() =>
                                  executer(async () => {
                                    await action({
                                      action: 'annuler-virement',
                                      virementId: o.virementId,
                                    })
                                    setMessage(
                                      'Les deux mouvements sont de nouveau disponibles pour le rapprochement.',
                                    )
                                  })
                                }
                              >
                                Défaire le rapprochement
                              </Button>
                            )}
                            {o.aVerifier ? (
                              <>
                                <span className="text-amber-800">
                                  Données modifiées : à vérifier
                                </span>
                                {!lectureSeule && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={enCours}
                                    onClick={() =>
                                      executer(async () => {
                                        await action({
                                          action: 'valider-operation',
                                          operationId: o.id,
                                        })
                                        setMessage('Mouvement vérifié, règlements conservés.')
                                      })
                                    }
                                  >
                                    J’ai vérifié ce mouvement
                                  </Button>
                                )}
                              </>
                            ) : o.statut === 'en_attente' ? (
                              <span>Fonds en attente</span>
                            ) : o.statut === 'ignoree' ? (
                              <>
                                <span>Exclue : {o.motifExclusion}</span>
                                {!lectureSeule && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={enCours}
                                    onClick={() =>
                                      executer(async () => {
                                        await action({ action: 'retablir', operationId: o.id })
                                      })
                                    }
                                  >
                                    Rétablir
                                  </Button>
                                )}
                              </>
                            ) : (
                              <>
                                {o.restePrincipal === 0 && o.resteFrais === 0 ? (
                                  <span className="text-green-700">
                                    {o.virementRapproche ? 'Virement rapproché' : 'Rapprochée'}
                                  </span>
                                ) : (
                                  <>
                                    {o.restePrincipal > 0 &&
                                      !lectureSeule &&
                                      !VIREMENTS.includes(o.famille) && (
                                        <Button
                                          size="sm"
                                          disabled={enCours}
                                          onClick={() => ouvrirRapprochement(o, 'principal')}
                                        >
                                          Rapprocher{' '}
                                          {argent(
                                            o.restePrincipal,
                                            compte(o.compteId)?.devise,
                                          )}
                                        </Button>
                                      )}
                                    {o.resteFrais > 0 && !lectureSeule && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={enCours}
                                        onClick={() => ouvrirRapprochement(o, 'frais')}
                                      >
                                        Rapprocher les frais
                                      </Button>
                                    )}
                                    {o.restePrincipal > 0 &&
                                      !lectureSeule &&
                                      Math.round(o.restePrincipal * 100) ===
                                        Math.abs(Math.round(o.brut * 100)) && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={enCours}
                                          onClick={() => {
                                            setVirement(o)
                                            setRechercheVirement('')
                                            setContrepartie('')
                                          }}
                                        >
                                          Virement entre comptes
                                        </Button>
                                      )}
                                    {!lectureSeule &&
                                      !o.virementRapproche &&
                                      Math.round(o.restePrincipal * 100) ===
                                        Math.abs(Math.round(o.brut * 100)) &&
                                      Math.round(o.resteFrais * 100) ===
                                        Math.abs(Math.round(o.frais * 100)) && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          disabled={enCours}
                                          onClick={() => {
                                            setExclusion(o)
                                            setMotif(
                                              VIREMENTS.includes(o.famille)
                                                ? 'Virement entre comptes'
                                                : '',
                                            )
                                          }}
                                        >
                                          Exclure
                                        </Button>
                                      )}
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!donnees.operations.length && !charge && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aucune opération. Importez un relevé ou synchronisez Stripe.
                </p>
              )}
              {donnees.curseurSuivant && (
                <Button
                  variant="outline"
                  disabled={charge}
                  onClick={() => charger(donnees.curseurSuivant!)}
                >
                  Afficher la suite
                </Button>
              )}
            </CardContent>
          </Card>
        </>
      )}
      {charge && <p className="text-sm text-muted-foreground">Chargement…</p>}
      <Dialog
        open={dialogStripe}
        onOpenChange={(ouvert) => {
          setDialogStripe(ouvert)
          if (!ouvert) setCleStripe('')
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connecter Stripe en lecture</DialogTitle>
            <DialogDescription>
              Créez dans Stripe une clé restreinte autorisant la lecture du compte, du solde et
              des opérations. Cette clé sera chiffrée sur le serveur.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              void executer(async () => {
                await action({ action: 'stripe-cle', cle: cleStripe })
                setCleStripe('')
                setDialogStripe(false)
                setMessage('Stripe connecté. Lancez la synchronisation.')
              })
            }}
          >
            <Label htmlFor="stripe-cle-restreinte">Clé restreinte Stripe</Label>
            <Input
              id="stripe-cle-restreinte"
              type="password"
              autoComplete="off"
              value={cleStripe}
              onChange={(e) => setCleStripe(e.target.value)}
              placeholder="rk_live_…"
              required
            />
            <Button disabled={enCours} type="submit">
              Connecter en lecture
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(operation)}
        onOpenChange={(v) => {
          if (!v) setOperation(null)
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {partie === 'frais' ? 'Rapprocher les frais' : 'Rapprocher le mouvement'}
            </DialogTitle>
            <DialogDescription>{operation?.libelle}</DialogDescription>
          </DialogHeader>
          {erreur && (
            <p role="alert" className="text-sm text-red-700">
              {erreur}
            </p>
          )}
          <p className="text-sm">
            Solde disponible :{' '}
            {argent(
              partie === 'frais'
                ? (operation?.resteFrais ?? 0)
                : (operation?.restePrincipal ?? 0),
              compte(operation?.compteId || '')?.devise,
            )}
            .
          </p>
          <Label htmlFor="banque-recherche">Rechercher une pièce</Label>
          <Input
            id="banque-recherche"
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value)
              setChoix('')
            }}
            placeholder="N° de facture, client ou libellé"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={remboursement}
              onChange={(e) => {
                setRemboursement(e.target.checked)
                setChoix('')
              }}
            />
            Il s’agit d’un remboursement.
          </label>
          {reglementsCandidats.erreur && (
            <p role="alert" className="text-sm text-red-700">
              {reglementsCandidats.erreur}
            </p>
          )}
          <Label htmlFor="banque-piece">Pièce à régler ou règlement existant</Label>
          <SelectNatif
            id="banque-piece"
            value={choix}
            onChange={(e) => setChoix(e.target.value)}
          >
            <option value="">Choisir…</option>
            {existants.length > 0 && (
              <optgroup label="Règlements déjà saisis">
                {existants.map((r) => (
                  <option key={r.id} value={'reg:' + r.id}>
                    {r.piece || r.libelle} · {new Date(r.date).toLocaleDateString('fr-FR')} ·{' '}
                    {r.reference || r.libelle} · {argent(r.montant, r.devise)}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Créer un règlement sur une pièce">
              {candidats.map((c) => (
                <option key={c.type + c.id} value={c.type + ':' + c.id}>
                  {c.libelle} · reste {argent(c.resteAPayer, c.devise)}
                </option>
              ))}
            </optgroup>
          </SelectNatif>
          {reglementsCandidats.curseur && (
            <Button
              size="sm"
              variant="outline"
              disabled={reglementsCandidats.charge}
              onClick={reglementsCandidats.suivant}
            >
              Afficher d’autres règlements déjà saisis
            </Button>
          )}

          {!choix.startsWith('reg:') && (
            <>
              <Label htmlFor="banque-montant">Montant à affecter</Label>
              <Input
                id="banque-montant"
                inputMode="decimal"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
              />
              <Label htmlFor="banque-mode">Mode réellement utilisé</Label>
              <SelectNatif
                id="banque-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="">Choisir…</option>
                {MODES_REGLEMENT.filter((m) => m !== 'À crédit').map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </SelectNatif>
              {selection && (
                <ReglementsDialog
                  type={selection.type}
                  id={selection.id}
                  label="Voir les règlements de la pièce"
                  onChange={() => {
                    void charger()
                    setActualisationCibles((n) => n + 1)
                  }}
                />
              )}
            </>
          )}
          <p className="text-xs text-muted-foreground">
            Un mouvement peut solder plusieurs pièces : rapprochez chaque part. Utilisez un
            règlement existant lorsqu’il a déjà été saisi.
          </p>
          <Button
            disabled={
              enCours ||
              !choix ||
              (choix.startsWith('reg:')
                ? !reglementsCandidats.lignes.some((r) => `reg:${r.id}` === choix)
                : !mode || !montant)
            }
            onClick={rapprocher}
          >
            Confirmer le rapprochement
          </Button>
          <Button variant="outline" asChild>
            <Link href="/comptabilite/transactions">Saisir une dépense ou une recette</Link>
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(virement)}
        onOpenChange={(v) => {
          if (!v) setVirement(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rapprocher un virement entre comptes</DialogTitle>
            <DialogDescription>
              Reliez le débit et le crédit du même virement. Ce transfert de trésorerie ne crée
              aucune vente ni dépense.
            </DialogDescription>
          </DialogHeader>
          {erreur && (
            <p role="alert" className="text-sm text-red-700">
              {erreur}
            </p>
          )}
          <p className="text-sm">
            {virement?.libelle} ·{' '}
            {argent(virement?.brut ?? 0, compte(virement?.compteId || '')?.devise)}
          </p>
          <Label htmlFor="banque-recherche-virement">
            Rechercher un mouvement ou un compte
          </Label>
          <Input
            id="banque-recherche-virement"
            value={rechercheVirement}
            onChange={(e) => {
              setRechercheVirement(e.target.value)
              setContrepartie('')
            }}
          />
          {virementsCandidats.erreur && (
            <p role="alert" className="text-sm text-red-700">
              {virementsCandidats.erreur}
            </p>
          )}
          <Label htmlFor="banque-contrepartie">
            Mouvement correspondant de l’autre compte
          </Label>
          <SelectNatif
            id="banque-contrepartie"
            value={contrepartie}
            onChange={(e) => setContrepartie(e.target.value)}
          >
            <option value="">Choisir…</option>
            {virementsCandidats.lignes
              .filter(
                (c) =>
                  virement &&
                  c.compteId !== virement.compteId &&
                  c.devise === compte(virement.compteId)?.devise &&
                  Math.round(c.montant * 100) === -Math.round(virement.brut * 100),
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.compteNom} · {new Date(c.date).toLocaleDateString('fr-FR')} · {c.libelle}{' '}
                  · {argent(c.montant, c.devise)}
                </option>
              ))}
          </SelectNatif>
          {virementsCandidats.curseur && (
            <Button
              size="sm"
              variant="outline"
              disabled={virementsCandidats.charge}
              onClick={virementsCandidats.suivant}
            >
              Afficher plus de mouvements
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            Importez le relevé du compte destinataire si le mouvement n’est pas encore proposé.
          </p>
          <Button
            disabled={
              enCours ||
              !contrepartie ||
              !virementsCandidats.lignes.some((c) => c.id === contrepartie)
            }
            onClick={() =>
              executer(async () => {
                if (!virement) return
                await action({
                  action: 'virement',
                  sortieId: virement.brut < 0 ? virement.id : contrepartie,
                  entreeId: virement.brut > 0 ? virement.id : contrepartie,
                })
                setVirement(null)
                setMessage('Virement rapproché entre les deux comptes.')
              })
            }
          >
            Confirmer le virement
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(exclusion)}
        onOpenChange={(v) => {
          if (!v) setExclusion(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exclure du rapprochement commercial</DialogTitle>
            <DialogDescription>
              Le mouvement reste dans l’historique bancaire. Indiquez pourquoi il ne règle pas
              une facture ou une dépense.
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor="banque-motif">Motif</Label>
          <Input
            id="banque-motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            maxLength={500}
          />
          <Button
            disabled={enCours || motif.trim().length < 3}
            onClick={() =>
              executer(async () => {
                if (exclusion)
                  await action({ action: 'exclure', operationId: exclusion.id, motif })
                setExclusion(null)
              })
            }
          >
            Confirmer l’exclusion
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  )
}
