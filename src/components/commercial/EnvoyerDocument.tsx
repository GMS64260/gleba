'use client'

import * as React from 'react'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useExploitation } from '@/hooks/use-exploitation'

const LABELS_ENVOI: Record<string, string> = {
  en_cours: 'Envoi en cours ; attendez avant de recommencer', envoye: 'Accepté par le serveur de courrier',
  refuse: 'Refusé par le serveur de courrier', a_verifier: 'Résultat incertain : vérifiez auprès du destinataire avant un nouvel envoi',
}

export function EnvoyerDocument({ type, id, numero }: { type: 'document' | 'facture'; id: string | number; numero: string }) {
  const { peutEcrire } = useExploitation()
  const [ouvert, setOuvert] = React.useState(false)
  const [charge, setCharge] = React.useState(false)
  const [erreur, setErreur] = React.useState('')
  const [destinataire, setDestinataire] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [possible, setPossible] = React.useState(false)
  const [motif, setMotif] = React.useState('')
  const [envois, setEnvois] = React.useState<Array<{ id: string; destinataire: string; statut: string; createdAt: string }>>([])
  const verrou = React.useRef(false)
  const cle = React.useRef('')

  React.useEffect(() => {
    if (!ouvert) return
    let actif = true
    setCharge(true); setErreur(''); setPossible(false); cle.current = crypto.randomUUID()
    fetch(`/api/comptabilite/envois?type=${type}&id=${encodeURIComponent(id)}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Historique indisponible'); return j })
      .then((j) => {
        if (!actif) return
        const enCours = j.data.some((e: { statut: string }) => e.statut === 'en_cours')
        const incertain = j.data.some((e: { statut: string }) => e.statut === 'a_verifier')
        setDestinataire(j.destinataire); setEnvois(j.data); setPossible(j.smtp && !j.demo && !enCours)
        setMotif(j.demo ? 'La démo permet de télécharger le PDF. Les courriels y sont désactivés.' : !j.smtp ? 'L’envoi de courriels n’est pas configuré sur cette instance. Téléchargez le PDF pour le transmettre.' : enCours ? 'Un envoi est en cours. Rouvrez cette fenêtre pour consulter son résultat.' : incertain ? 'Une tentative précédente est incertaine. Vérifiez auprès du destinataire avant de renvoyer le document.' : '')
      }).catch((e) => { if (actif) setErreur(e.message) }).finally(() => { if (actif) setCharge(false) })
    return () => { actif = false }
  }, [ouvert, type, id])

  async function envoyer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (verrou.current) return
    verrou.current = true; setCharge(true); setErreur('')
    const form = new FormData(event.currentTarget)
    try {
      const r = await fetch('/api/comptabilite/envois', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id: String(id), cle: cle.current, destinataire: String(form.get('destinataire') || '').trim(), message: String(form.get('message') || '') }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Envoi impossible')
      setEnvois((avant) => [{ ...j.data, createdAt: new Date().toISOString() }, ...avant.filter((v) => v.id !== j.data.id)])
      setPossible(false)
      setMotif(LABELS_ENVOI[j.data.statut] || 'Consultez l’historique avant de recommencer.')
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Envoi impossible. Vérifiez l’historique avant de réessayer.') }
    finally { verrou.current = false; setCharge(false) }
  }

  return <>
    <Button type="button" variant="outline" size="sm" disabled={!peutEcrire} onClick={() => setOuvert(true)}><Mail className="mr-2 h-4 w-4" />Envoyer</Button>
    <Dialog open={ouvert} onOpenChange={(v) => { if (!verrou.current) setOuvert(v) }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Envoyer {numero}</DialogTitle><DialogDescription>Le courriel contient le PDF en pièce jointe. Les réponses vont à l’adresse de contact de votre exploitation.</DialogDescription></DialogHeader>
        <form onSubmit={envoyer} className="space-y-4">
          <div><Label htmlFor="commercial-destinataire">Destinataire</Label><Input id="commercial-destinataire" name="destinataire" type="email" required maxLength={254} value={destinataire} onChange={(e) => setDestinataire(e.target.value)} /></div>
          <div><Label htmlFor="commercial-message">Votre message (facultatif)</Label><Textarea id="commercial-message" name="message" maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
          {erreur && <p role="alert" className="text-sm text-red-700">{erreur}</p>}
          {motif && <p role="status" className="text-sm text-muted-foreground">{motif}</p>}
          <Button type="submit" disabled={charge || !possible}>{charge ? 'Chargement…' : 'Envoyer le PDF par courriel'}</Button>
        </form>
        {envois.length > 0 && <div className="space-y-2 border-t pt-3 text-sm"><p className="font-medium">Dernières tentatives</p>{envois.map((e) => <p key={e.id} className="break-words">{new Date(e.createdAt).toLocaleString('fr-FR')} · {e.destinataire}<br /><span className="text-muted-foreground">{LABELS_ENVOI[e.statut] || e.statut}</span></p>)}</div>}
      </DialogContent>
    </Dialog>
  </>
}
