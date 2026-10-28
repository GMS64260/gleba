'use client'
import * as React from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectNatif } from '@/components/ui/select-natif'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { MODES_REGLEMENT } from '@/lib/validations/reglement'
import { todayLocalISO } from '@/lib/format-utils'
import type { TypeCibleReglement } from '@/lib/comptabilite/cle-reglement'
interface LigneReglement {
  id: string
  montant: number
  date: string
  modeReglement: string
  reference: string | null
  notes: string | null
  annuleLe: string | null
  motifAnnulation: string | null
  operationBancaireId: string | null
}
interface Suivi {
  cible: { type: TypeCibleReglement; id: number }
  detaille: boolean
  montantTotal: number
  montantRegle: number
  montantPieceAvantAvoirs: number
  resteAPayer: number
  tropPercu: number
  devise: string
  libelle: string
  historiquePaye: boolean
  historiqueDeclarePaye: boolean
  reglements: LigneReglement[]
}
export function ReglementsDialog({
  type,
  id,
  onChange,
  label = 'Règlements',
}: {
  type: TypeCibleReglement
  id: number
  onChange?: () => void
  label?: string
}) {
  const [ouvert, setOuvert] = React.useState(false),
    [suivi, setSuivi] = React.useState<Suivi | null>(null)
  const [montant, setMontant] = React.useState(''),
    [date, setDate] = React.useState(todayLocalISO()),
    [mode, setMode] = React.useState(''),
    [reference, setReference] = React.useState(''),
    [notes, setNotes] = React.useState('')
  const [remboursement, setRemboursement] = React.useState(false),
    [historique, setHistorique] = React.useState(false),
    [cle, setCle] = React.useState('')
  const [erreur, setErreur] = React.useState<string | null>(null),
    [charge, setCharge] = React.useState(false),
    [enCours, setEnCours] = React.useState(false)
  const [annuler, setAnnuler] = React.useState<string | null>(null),
    [motif, setMotif] = React.useState('')
  const { data: session } = useSession()
  const lectureSeule =
    session?.user.peutEcrireExploitation === false || Boolean(session?.user.impersonatedBy)
  const argent = (v: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: suivi?.devise || 'EUR' }).format(
      v,
    )
  const charger = React.useCallback(async () => {
    setCharge(true)
    setErreur(null)
    try {
      const r = await fetch(
        '/api/comptabilite/reglements?' + new URLSearchParams({ type, id: String(id) }),
      )
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Chargement impossible.')
      setSuivi(d)
      setMontant(
        String(d.resteAPayer || (d.historiquePaye && !d.detaille ? d.montantPieceAvantAvoirs : '')),
      )
      setHistorique(!d.detaille && d.historiquePaye)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.')
    } finally {
      setCharge(false)
    }
  }, [id, type])
  React.useEffect(() => {
    if (ouvert) {
      void charger()
      setCle(crypto.randomUUID())
      setRemboursement(false)
      setAnnuler(null)
      setMotif('')
      setMode('')
      setReference('')
      setNotes('')
      setDate(todayLocalISO())
    }
  }, [ouvert, charger])
  const enregistrer = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!suivi) return
    setEnCours(true)
    setErreur(null)
    try {
      const r = await fetch('/api/comptabilite/reglements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...suivi.cible,
          montant,
          date,
          modeReglement: mode,
          reference,
          notes,
          remboursement,
          regularisationHistorique: historique,
          cleIdempotence: cle,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Enregistrement impossible.')
      setCle(crypto.randomUUID())
      setReference('')
      setNotes('')
      setRemboursement(false)
      await charger()
      onChange?.()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Enregistrement impossible.')
    } finally {
      setEnCours(false)
    }
  }
  const confirmerAnnulation = async () => {
    setEnCours(true)
    setErreur(null)
    try {
      const r = await fetch('/api/comptabilite/reglements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: annuler, motif }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Annulation impossible.')
      setAnnuler(null)
      setMotif('')
      await charger()
      onChange?.()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Annulation impossible.')
    } finally {
      setEnCours(false)
    }
  }
  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Règlements et reste à payer</DialogTitle>
          <DialogDescription>
            {suivi?.libelle || 'Historique des versements, références et rapprochement.'}
          </DialogDescription>
        </DialogHeader>
        {erreur && (
          <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">
            {erreur}
          </p>
        )}
        {charge && <p className="text-sm">Chargement…</p>}
        {suivi && (
          <>
            <dl className="grid grid-cols-3 gap-3 rounded-lg bg-muted p-3 text-sm">
              <div>
                <dt>Montant net</dt>
                <dd className="font-semibold">{argent(suivi.montantTotal)}</dd>
              </div>
              <div>
                <dt>Réglé</dt>
                <dd className="font-semibold">{argent(suivi.montantRegle)}</dd>
              </div>
              <div>
                <dt>Reste à payer</dt>
                <dd className="font-semibold">{argent(suivi.resteAPayer)}</dd>
              </div>
            </dl>
            {!suivi.detaille && suivi.historiquePaye && (
              <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">
                Statut payé historique sans détail. Saisissez les versements réellement reçus pour
                initialiser ce journal.
              </p>
            )}
            {suivi.tropPercu > 0 && (
              <p className="text-sm text-amber-800">
                Trop-perçu ou somme à rembourser : {argent(suivi.tropPercu)}.
              </p>
            )}
            {!lectureSeule && (
              <form onSubmit={enregistrer} className="space-y-3 border-t pt-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={'reg-montant-' + id}>
                      Montant {remboursement ? 'remboursé' : 'reçu ou versé'}
                    </Label>
                    <Input
                      id={'reg-montant-' + id}
                      inputMode="decimal"
                      value={montant}
                      onChange={(e) => setMontant(e.target.value)}
                      placeholder="30,00"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor={'reg-date-' + id}>Date du règlement</Label>
                    <Input
                      id={'reg-date-' + id}
                      type="date"
                      value={date}
                      max={todayLocalISO()}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={'reg-mode-' + id}>Mode de règlement</Label>
                    <SelectNatif
                      id={'reg-mode-' + id}
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                      required
                    >
                      <option value="">Choisir…</option>
                      {MODES_REGLEMENT.filter((m) => m !== 'À crédit').map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </SelectNatif>
                  </div>
                  <div>
                    <Label htmlFor={'reg-reference-' + id}>Référence du règlement</Label>
                    <Input
                      id={'reg-reference-' + id}
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      maxLength={200}
                      placeholder="Virement, chèque…"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor={'reg-notes-' + id}>Note</Label>
                  <Input
                    id={'reg-notes-' + id}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={2000}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={remboursement}
                    onChange={(e) => {
                      setRemboursement(e.target.checked)
                      setCle(crypto.randomUUID())
                    }}
                  />
                  Il s’agit d’un remboursement réellement effectué.
                </label>
                {suivi.historiqueDeclarePaye && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={historique}
                      onChange={(e) => setHistorique(e.target.checked)}
                    />
                    Je détaille un règlement historique déjà déclaré payé.
                  </label>
                )}
                <Button type="submit" disabled={enCours || charge || !mode}>
                  {enCours
                    ? 'Enregistrement…'
                    : remboursement
                      ? 'Enregistrer le remboursement'
                      : 'Enregistrer ce règlement'}
                </Button>
              </form>
            )}
            <div className="space-y-2 border-t pt-3">
              <h3 className="text-sm font-semibold">Historique</h3>
              {!suivi.reglements.length && (
                <p className="text-sm text-muted-foreground">
                  Aucun versement détaillé enregistré.
                </p>
              )}
              {suivi.reglements.map((r) => (
                <div
                  key={r.id}
                  className={
                    'rounded border p-3 text-sm ' + (r.annuleLe ? 'text-muted-foreground' : '')
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {new Date(r.date).toLocaleDateString('fr-FR')} · {r.modeReglement} ·{' '}
                      {argent(r.montant)}
                    </span>
                    {r.annuleLe ? (
                      <span>Annulé</span>
                    ) : (
                      !lectureSeule && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={enCours}
                          onClick={() => {
                            setAnnuler(r.id)
                            setMotif('')
                          }}
                        >
                          Annuler la saisie
                        </Button>
                      )
                    )}
                  </div>
                  {r.reference && <p>Référence : {r.reference}</p>}
                  {r.notes && <p>{r.notes}</p>}
                  {r.operationBancaireId && <p>Rapproché avec une opération bancaire.</p>}
                  {r.motifAnnulation && <p>Motif : {r.motifAnnulation}</p>}
                </div>
              ))}
            </div>
            {annuler && (
              <div className="space-y-2 rounded border border-amber-300 p-3">
                <Label htmlFor="annulation-reglement">Motif de correction de cette saisie</Label>
                <Input
                  id="annulation-reglement"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  minLength={3}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  Cette action corrige le journal et conserve la trace. Elle n’effectue aucun
                  remboursement bancaire.
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setAnnuler(null)}>
                    Conserver
                  </Button>
                  <Button
                    type="button"
                    disabled={enCours || motif.trim().length < 3}
                    onClick={confirmerAnnulation}
                  >
                    Confirmer l’annulation
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
