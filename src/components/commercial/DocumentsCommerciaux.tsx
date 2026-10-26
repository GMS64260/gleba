'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectNatif } from '@/components/ui/select-natif'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ouvrirApercu } from '@/lib/apercu-document'
import { confirmDialog } from '@/lib/global-dialog'
import { LABELS_STATUT } from '@/lib/commercial/regles'
import { dateIsoFacture } from '@/lib/facture-regles'
import { todayLocalISO } from '@/lib/format-utils'
import { getAvailableYears } from '@/components/year-selector'
import { updateDashboardSearchParams } from '@/lib/dashboard-navigation'
import { useExploitation } from '@/hooks/use-exploitation'
import type { DocumentComplet } from '@/lib/commercial/service'
import type { EmetteurSnapshot } from '@/lib/facture-utils'
import { FormulaireDocument } from './FormulaireDocument'
import { EnvoyerDocument } from './EnvoyerDocument'

type DatesDocument = 'date' | 'dateValidite' | 'dateLivraison' | 'dateAcceptation' | 'createdAt' | 'updatedAt'
export type DocumentVue = Omit<DocumentComplet, DatesDocument> & {
  date: string; dateValidite: string | null; dateLivraison: string | null; dateAcceptation: string | null; createdAt: string; updatedAt: string
}

async function requete(url: string, method = 'GET', body?: unknown) {
  const r = await fetch(url, { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || 'Action impossible')
  return j
}

export function DocumentsCommerciaux({ type, onFacture }: { type: 'devis' | 'livraison'; onFacture: () => void }) {
  const { peutEcrire } = useExploitation()
  const [documents, setDocuments] = React.useState<DocumentVue[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [annee, setAnnee] = React.useState(String(new Date().getFullYear()))
  const [preselection, setPreselection] = React.useState('')
  const [pret, setPret] = React.useState(false)
  const [recherche, setRecherche] = React.useState('')
  const [filtre, setFiltre] = React.useState('')
  const [documentCible, setDocumentCible] = React.useState('')
  const [charge, setCharge] = React.useState(true)
  const [erreur, setErreur] = React.useState('')
  const [actionEnCours, setActionEnCours] = React.useState(false)
  const [version, setVersion] = React.useState(0)
  const [editeur, setEditeur] = React.useState<{ cle: string; document?: DocumentVue; copie?: boolean } | null>(null)
  const [selection, setSelection] = React.useState<string[]>([])
  const [facturation, setFacturation] = React.useState<string[] | null>(null)
  const [livraison, setLivraison] = React.useState<DocumentVue | null>(null)
  const verrou = React.useRef(false)

  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const a = q.get('anneeDocuments')
    if (a === 'all' || /^20\d\d$/.test(a || '')) setAnnee(a!)
    setDocumentCible(q.get('document') || '')
    if (q.get('stock') && type === 'livraison') { setPreselection(q.get('stock')!); setEditeur({ cle: crypto.randomUUID() }) }
    setPret(true)
  }, [])

  React.useEffect(() => {
    if (!pret) return
    const controller = new AbortController()
    setCharge(true); setErreur('')
    const timer = setTimeout(() => {
      const q = new URLSearchParams({ type, annee, page: String(page), q: recherche, statut: filtre, ...(documentCible ? { id: documentCible } : {}) })
      fetch(`/api/comptabilite/documents?${q}`, { signal: controller.signal })
        .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Documents indisponibles'); return j })
        .then((j) => { setDocuments(j.data); setTotal(j.total); setSelection([]) })
        .catch((e) => { if (!controller.signal.aborted) { setErreur(e.message); setDocuments([]); setTotal(0) } })
        .finally(() => { if (!controller.signal.aborted) setCharge(false) })
    }, 200)
    return () => { clearTimeout(timer); controller.abort() }
  }, [type, annee, page, recherche, filtre, version, pret, documentCible])

  function exercice(a: string) {
    setAnnee(a); setPage(1)
    const q = new URLSearchParams(window.location.search); q.set('anneeDocuments', a)
    updateDashboardSearchParams(q, 'replace')
  }
  function fermerEditeur() {
    setEditeur(null); setPreselection('')
    const q = new URLSearchParams(window.location.search); q.delete('stock'); updateDashboardSearchParams(q, 'replace')
  }
  const actualiser = () => setVersion((v) => v + 1)
  const argent = (d: DocumentVue) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: (d.emetteurSnapshot as unknown as EmetteurSnapshot).devise || 'EUR' }).format(d.totalTTC)
  const date = (s: string) => dateIsoFacture(s).split('-').reverse().join('/')

  async function mutation(action: () => Promise<void>) {
    if (verrou.current) return
    verrou.current = true; setActionEnCours(true); setErreur('')
    try { await action(); actualiser() }
    catch (e) { setErreur(e instanceof Error ? e.message : 'Action impossible') }
    finally { verrou.current = false; setActionEnCours(false) }
  }

  async function agir(d: DocumentVue, action: string) {
    const descriptions: Record<string, [string, string]> = {
      emettre: ['Émettre ce document ?', 'Un numéro définitif sera attribué. Le client, les lignes et les conditions seront figés. Aucun courriel ne part à cette étape.'],
      accepter: ['Enregistrer l’accord du client ?', 'Confirmez avoir reçu son accord et conservez le devis signé ou la preuve de son acceptation.'],
      refuser: ['Enregistrer le refus du client ?', 'Le devis restera consultable dans votre historique.'],
      annuler: ['Annuler ce document ?', 'Il restera consultable, sans pouvoir être facturé. Si les produits ont été livrés, confirmez leur retour physique : les quantités seront remises en stock.'],
      retourner: ['Confirmer le retour physique ?', 'Toutes les quantités liées à ce bon seront remises en stock. La facture reste inchangée : émettez un avoir si le client doit être remboursé.'],
    }
    const [titre, description] = descriptions[action]
    if (!await confirmDialog(description, { title: titre, variant: action === 'annuler' ? 'destructive' : 'default' })) return
    await mutation(async () => { await requete(`/api/comptabilite/documents/${d.id}`, 'PATCH', { action }) })
  }

  async function facturer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const dateEcheance = new FormData(event.currentTarget).get('dateEcheance')
    const ids = facturation
    if (!ids) return
    await mutation(async () => {
      const j = await requete('/api/comptabilite/documents/facturer', 'POST', { ids, dateEcheance })
      setFacturation(null); setSelection([])
      ouvrirApercu(`/api/comptabilite/factures/${j.data.id}/pdf`, `Facture ${j.data.numero}`)
      onFacture()
    })
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-semibold">{type === 'devis' ? 'Devis' : 'Bons de livraison'}</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">{type === 'devis' ? 'Préparez votre offre, enregistrez l’accord du client puis créez le bon de livraison ou la facture.' : 'Suivez les livraisons puis facturez un bon ou regroupez les bons d’un même client sur un même mois.'}</p></div>
      {peutEcrire && <Button disabled={actionEnCours} onClick={() => setEditeur({ cle: crypto.randomUUID() })}>{type === 'devis' ? 'Nouveau devis' : 'Nouveau bon de livraison'}</Button>}
    </div>
    <p className="rounded-lg border bg-white p-3 text-sm text-muted-foreground">{type === 'devis' ? 'Le devis et son acceptation ne créent aucun revenu. Le chiffre d’affaires apparaît à l’émission de la facture.' : 'Choisissez vos produits dans les stocks : leurs quantités sont déduites à la confirmation de livraison. La facture reprend le bon sans nouvelle sortie de stock.'}</p>
    {editeur && <FormulaireDocument key={editeur.cle} type={type} initial={editeur.document} preselection={!editeur.document ? preselection : undefined} copie={editeur.copie} onFermer={fermerEditeur} onSauver={async (contenu) => {
      if (editeur.document && !editeur.copie) await requete(`/api/comptabilite/documents/${editeur.document.id}`, 'PUT', contenu)
      else await requete('/api/comptabilite/documents', 'POST', { cle: editeur.cle, contenu })
      fermerEditeur(); setPage(1); setFiltre(''); setRecherche(''); setDocumentCible(''); exercice('all'); actualiser()
    }} />}
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1"><Label htmlFor={`${type}-recherche`}>Rechercher</Label><Input id={`${type}-recherche`} value={recherche} placeholder="Client, numéro ou objet" onChange={(e) => { setRecherche(e.target.value); setPage(1) }} /></div>
      <div><Label htmlFor={`${type}-exercice`}>Exercice</Label><SelectNatif id={`${type}-exercice`} value={annee} onChange={(e) => exercice(e.target.value)}><option value="all">Tous les exercices</option>{getAvailableYears().map((y) => <option key={y} value={y}>{y}</option>)}</SelectNatif></div>
      <div><Label htmlFor={`${type}-statut`}>Statut</Label><SelectNatif id={`${type}-statut`} value={filtre} onChange={(e) => { setFiltre(e.target.value); setPage(1) }}><option value="">Tous</option>{Object.entries(LABELS_STATUT).filter(([s]) => type === 'devis' ? s !== 'livre' : !['accepte', 'refuse'].includes(s)).map(([s, label]) => <option key={s} value={s}>{label}</option>)}{type === 'livraison' && <option value="a_facturer">Livrés, à facturer</option>}</SelectNatif></div>
      <Button variant="outline" onClick={actualiser} disabled={charge}>Actualiser</Button>
    </div>
    {documentCible && <Button variant="outline" onClick={() => { setDocumentCible(''); const q = new URLSearchParams(window.location.search); q.delete('document'); updateDashboardSearchParams(q, 'replace') }}>Afficher tous les documents</Button>}
    {erreur && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erreur}</p>}
    {type === 'livraison' && selection.length > 0 && <div className="flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 p-3"><p>{selection.length} bon(s) sélectionné(s)</p><Button disabled={actionEnCours} onClick={() => setFacturation([...selection])}>Facturer la sélection</Button><Button variant="ghost" onClick={() => setSelection([])}>Désélectionner</Button></div>}
    {charge ? <p role="status">Chargement des documents…</p> : documents.length === 0 ? erreur ? null : <div className="rounded-xl border bg-white p-8 text-center text-muted-foreground">Aucun document pour ces filtres. {peutEcrire ? 'Créez votre premier brouillon avec le bouton ci-dessus.' : ''}</div> : documents.map((d) => {
      const converti = !!d.factureId || !!d.bonLivraison
      const expire = d.type === 'devis' && d.statut === 'emis' && d.dateValidite && dateIsoFacture(d.dateValidite) < todayLocalISO()
      return <article key={d.id} id={`document-${d.id}`} className="space-y-3 rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2">
            {peutEcrire && type === 'livraison' && d.statut === 'livre' && !d.factureId && <input type="checkbox" aria-label={`Sélectionner ${d.numero}`} checked={selection.includes(d.id)} onChange={(e) => setSelection((s) => e.target.checked ? [...s, d.id] : s.filter((id) => id !== d.id))} className="h-5 w-5" />}
            <h3 className="break-words font-semibold">{d.statut === 'brouillon' ? 'Brouillon' : d.numero} · {d.clientNom}</h3><Badge variant="outline">{d.factureId ? 'Facturé' : LABELS_STATUT[d.statut]}</Badge>{d.factureId && d.statut === 'retourne' && <Badge variant="outline">Stock retourné</Badge>}{expire && <Badge variant="outline">Expiré</Badge>}
          </div><p className="mt-1 break-words text-sm">{d.objet}</p><p className="mt-1 text-xs text-muted-foreground">{date(d.date)}{d.dateValidite ? ` · Valable jusqu’au ${date(d.dateValidite)}` : ''}{d.dateLivraison ? ` · Livraison ${date(d.dateLivraison)}` : ''}</p></div>
          <p className="font-semibold">{argent(d)} TTC</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => ouvrirApercu(`/api/comptabilite/documents/${d.id}/pdf`, d.numero)}>Voir le PDF</Button>
          {d.facture && <Button size="sm" variant="outline" onClick={() => ouvrirApercu(`/api/comptabilite/factures/${d.facture!.id}/pdf`, d.facture!.numero)}>Facture {d.facture.numero}</Button>}
          {d.devisOrigine && <a className="inline-flex items-center text-sm text-primary underline" href={`/comptabilite/factures?tab=devis&document=${d.devisOrigine.id}`}>Devis {d.devisOrigine.numero}</a>}
          {d.bonLivraison && <a className="inline-flex items-center text-sm text-primary underline" href={`/comptabilite/factures?tab=livraisons&document=${d.bonLivraison.id}`}>Bon {d.bonLivraison.numero}</a>}
          {peutEcrire && <>
            {['emis', 'accepte', 'livre'].includes(d.statut) && <EnvoyerDocument type="document" id={d.id} numero={d.numero} />}
            {d.statut === 'brouillon' && <><Button size="sm" variant="outline" disabled={actionEnCours} onClick={() => setEditeur({ cle: crypto.randomUUID(), document: d })}>Modifier</Button><Button size="sm" disabled={actionEnCours} onClick={() => agir(d, 'emettre')}>Émettre</Button><Button size="sm" variant="ghost" disabled={actionEnCours} onClick={async () => { if (await confirmDialog('Aucun numéro définitif n’a été attribué.', { title: 'Supprimer ce brouillon ?' })) await mutation(async () => { await requete(`/api/comptabilite/documents/${d.id}`, 'DELETE') }) }}>Supprimer</Button></>}
            {type === 'devis' && d.statut === 'emis' && !converti && <><Button size="sm" disabled={actionEnCours || !!expire} onClick={() => agir(d, 'accepter')}>Enregistrer l’accord</Button><Button size="sm" variant="outline" disabled={actionEnCours} onClick={() => agir(d, 'refuser')}>Refusé par le client</Button></>}
            {type === 'devis' && d.statut === 'accepte' && !converti && <>{d.categorieOperation === 'biens' && <Button size="sm" disabled={actionEnCours} onClick={() => mutation(async () => { await requete(`/api/comptabilite/documents/${d.id}/livraison`, 'POST'); window.location.assign('/comptabilite/factures?tab=livraisons&anneeDocuments=all') })}>Créer le bon de livraison</Button>}<Button size="sm" variant="outline" disabled={actionEnCours} onClick={() => setFacturation([d.id])}>Facturer le devis</Button></>}
            {type === 'livraison' && d.statut === 'emis' && !converti && <Button size="sm" disabled={actionEnCours} onClick={() => setLivraison(d)}>Marquer livré</Button>}
            {type === 'livraison' && d.statut === 'livre' && !d.factureId && <Button size="sm" disabled={actionEnCours} onClick={() => setFacturation([d.id])}>Facturer ce bon</Button>}
            {type === 'livraison' && d.statut === 'livre' && d.mouvementsStock.some((m) => m.quantite > 0) && <Button size="sm" variant="outline" disabled={actionEnCours} onClick={() => agir(d, 'retourner')}>Retour en stock</Button>}
            <Button size="sm" variant="ghost" disabled={actionEnCours} onClick={() => setEditeur({ cle: crypto.randomUUID(), document: d, copie: true })}>Dupliquer</Button>
            {['emis', 'accepte'].includes(d.statut) && !converti && <Button size="sm" variant="ghost" disabled={actionEnCours} onClick={() => agir(d, 'annuler')}>Annuler le document</Button>}
          </>}
        </div>
        <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Détail des lignes et conditions</summary><div className="mt-2 space-y-2">{d.lignes.map((l) => <p key={l.id} className="break-words">{l.description} · {l.quantite.toLocaleString('fr-FR')} {l.unite}{l.articleStockId ? ' · Liée au stock' : ''} · TVA {l.tauxTVA.toLocaleString('fr-FR')} %</p>)}{d.notes && <p className="whitespace-pre-wrap break-words border-t pt-2">{d.notes}</p>}</div></details>
      </article>
    })}
    {!charge && total > 50 && <div className="flex items-center justify-center gap-3"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>Précédente</Button><span>Page {page} / {Math.ceil(total / 50)}</span><Button variant="outline" disabled={page * 50 >= total} onClick={() => setPage((v) => v + 1)}>Suivante</Button></div>}
    <Dialog open={!!facturation} onOpenChange={(o) => { if (!o && !actionEnCours) setFacturation(null) }}><DialogContent><DialogHeader><DialogTitle>Émettre la facture</DialogTitle><DialogDescription>{facturation?.length || 0} document(s). Les lignes et conditions seront reprises sur une facture définitive. Les bons groupés doivent concerner le même client et le même mois ; émettez la facture récapitulative avant la fin de ce mois.</DialogDescription></DialogHeader><form onSubmit={facturer} className="space-y-4"><div><Label htmlFor="doc-echeance">Date limite de paiement *</Label><Input id="doc-echeance" name="dateEcheance" type="date" required min={todayLocalISO()} defaultValue={todayLocalISO()} /></div>{erreur && <p role="alert" className="text-sm text-red-700">{erreur}</p>}<Button type="submit" disabled={actionEnCours}>{actionEnCours ? 'Facturation…' : 'Confirmer et générer la facture'}</Button></form></DialogContent></Dialog>
    <Dialog open={!!livraison} onOpenChange={(o) => { if (!o && !actionEnCours) setLivraison(null) }}><DialogContent><DialogHeader><DialogTitle>Confirmer la livraison</DialogTitle><DialogDescription>Les produits liés seront déduits du stock à cette confirmation. Indiquez la date réelle et conservez le bon signé par le destinataire.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const dateLivraison = new FormData(e.currentTarget).get('dateLivraison'); const id = livraison?.id; void mutation(async () => { await requete(`/api/comptabilite/documents/${id}`, 'PATCH', { action: 'livrer', dateLivraison }); setLivraison(null) }) }}><Label htmlFor="doc-livre">Livré le *</Label><Input id="doc-livre" name="dateLivraison" type="date" required max={todayLocalISO()} defaultValue={todayLocalISO()} />{erreur && <p role="alert" className="text-sm text-red-700">{erreur}</p>}<Button type="submit" disabled={actionEnCours}>Confirmer la livraison</Button></form></DialogContent></Dialog>
  </div>
}
