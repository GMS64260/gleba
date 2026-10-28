'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SelectNatif } from '@/components/ui/select-natif'
import { calculerDocument, contenuDocumentSchema, factureSansTaxe, type ContenuDocument } from '@/lib/commercial/regles'
import { todayLocalISO } from '@/lib/format-utils'
import { ChoisirStock, prixHTDuStock } from './ChoisirStock'
import type { ArticleStockCommercial, TypeStockCommercial } from '@/lib/commercial/stock-types'
import type { DocumentVue } from './DocumentsCommerciaux'

interface ClientVue { id: number; nom: string; exonererTVA: boolean }
const nouvelleLigne = () => ({ cle: crypto.randomUUID(), description: '', quantite: '1', unite: 'kg', prixUnitaire: '', tauxTVA: '5.5', articleStockType: null as TypeStockCommercial | null, articleStockId: null as string | null })

export function FormulaireDocument({ type, initial, copie, preselection, onSauver, onFermer }: {
  preselection?: string; type: 'devis' | 'livraison'; initial?: DocumentVue; copie?: boolean;
  onSauver: (contenu: ContenuDocument) => Promise<void>; onFermer: () => void;
}) {
  const [clients, setClients] = React.useState<ClientVue[]>([])
  const [regime, setRegime] = React.useState<string | null>(null)
  const [devise, setDevise] = React.useState('EUR')
  const [charge, setCharge] = React.useState(true)
  const [erreur, setErreur] = React.useState('')
  const [clientId, setClientId] = React.useState(String(initial?.clientId || ''))
  const [lignes, setLignes] = React.useState(() => initial?.lignes.map((l) => ({ cle: crypto.randomUUID(), description: l.description, quantite: String(l.quantite), unite: l.unite, prixUnitaire: String(l.prixUnitaire), tauxTVA: String(l.tauxTVA), articleStockType: l.articleStockType as TypeStockCommercial | null, articleStockId: l.articleStockId })) || [nouvelleLigne()])
  const verrou = React.useRef(false)
  const [sauve, setSauve] = React.useState(false)
  const today = todayLocalISO()
  const [dateBrouillon, setDateBrouillon] = React.useState(copie ? today : initial?.date.slice(0, 10) || today)
  const [dateLivraison, setDateLivraison] = React.useState(copie ? '' : initial?.dateLivraison?.slice(0, 10) || '')
  const dans30jours = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  const sansTaxe = factureSansTaxe(regime) || !!clients.find((c) => c.id === Number(clientId))?.exonererTVA
  const nombre = (s: string) => Number(s.replace(',', '.'))
  const totaux = calculerDocument(lignes.map((l) => ({ ...l, quantite: nombre(l.quantite), prixUnitaire: nombre(l.prixUnitaire), tauxTVA: nombre(l.tauxTVA) as 5.5 })), sansTaxe)
  const argent = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: devise }).format(Number.isFinite(n) ? n : 0)

  React.useEffect(() => {
    let actif = true
    Promise.all(['/api/comptabilite/clients?actif=true', '/api/exploitation'].map(async (url) => {
      const r = await fetch(url); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Données indisponibles'); return j.data
    })).then(([fiches, exploitation]) => {
      if (actif) { setClients(fiches); setRegime(exploitation?.regimeTva); setDevise(exploitation?.devise || 'EUR') }
    }).catch((e) => { if (actif) setErreur(e.message) }).finally(() => { if (actif) setCharge(false) })
    return () => { actif = false }
  }, [])

  function changerLigne(cle: string, champ: string, valeur: string) {
    setLignes((ls) => ls.map((l) => l.cle === cle ? { ...l, [champ]: valeur } : l))
  }

  function ajouterStock(a: ArticleStockCommercial) {
    const ligne = { ...nouvelleLigne(), description: a.nom, unite: a.unite, prixUnitaire: prixHTDuStock(a, sansTaxe)?.toString() ?? '', tauxTVA: String(a.tauxTVA), articleStockType: a.type, articleStockId: a.id }
    setLignes((ls) => ls.length === 1 && !ls[0].description && !ls[0].articleStockId ? [ligne] : [...ls, ligne])
  }

  async function soumettre(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (verrou.current) return
    const f = new FormData(event.currentTarget)
    const texte = (k: string) => String(f.get(k) || '').trim()
    const contenu = {
      type, clientId: Number(texte('clientId')), date: texte('date'), dateValidite: type === 'devis' ? texte('dateValidite') : null,
      dateLivraison: texte('dateLivraison') || null, objet: texte('objet'), notes: texte('notes'), adresseLivraison: texte('adresseLivraison'),
      categorieOperation: texte('categorieOperation') || 'biens',
      lignes: lignes.map((l) => ({ description: texte(`${l.cle}-description`), quantite: nombre(texte(`${l.cle}-quantite`)), unite: texte(`${l.cle}-unite`),
        articleStockType: l.articleStockType as TypeStockCommercial | null, articleStockId: l.articleStockId, prixUnitaire: nombre(texte(`${l.cle}-prixUnitaire`)), tauxTVA: nombre(texte(`${l.cle}-tauxTVA`)) })),
    }
    const parsed = contenuDocumentSchema.safeParse(contenu)
    if (!parsed.success) { setErreur(parsed.error.issues[0]?.message || 'Vérifiez la saisie'); return }
    verrou.current = true; setSauve(true); setErreur('')
    try { await onSauver(parsed.data) }
    catch (e) { setErreur(e instanceof Error ? e.message : 'Enregistrement impossible') }
    finally { verrou.current = false; setSauve(false) }
  }

  return <form onSubmit={soumettre} className="space-y-5 rounded-xl border bg-white p-4 md:p-6">
    <h3 className="text-lg font-semibold">{initial && !copie ? 'Modifier le brouillon' : type === 'devis' ? 'Nouveau devis' : 'Nouveau bon de livraison'}</h3>
    <p className="text-sm text-muted-foreground">Enregistrez un brouillon, vérifiez son PDF puis émettez-le pour lui attribuer un numéro. Les prix sont saisis hors taxes.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <div><Label htmlFor="doc-client">Fiche client *</Label><SelectNatif id="doc-client" name="clientId" required value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Choisir un client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</SelectNatif><Link href="/comptabilite/clients" className="text-sm text-primary underline">Gérer les fiches clients</Link></div>
      <div><Label htmlFor="doc-objet">Objet *</Label><Input id="doc-objet" name="objet" required maxLength={500} defaultValue={initial?.objet || ''} placeholder="Légumes pour le restaurant" /></div>
      <div><Label htmlFor="doc-date">Date du brouillon *</Label><Input id="doc-date" name="date" type="date" required value={dateBrouillon} onChange={e => setDateBrouillon(e.target.value)} /></div>
      {type === 'devis' && <div><Label htmlFor="doc-validite">Valable jusqu’au *</Label><Input id="doc-validite" name="dateValidite" type="date" required defaultValue={copie ? dans30jours : initial?.dateValidite?.slice(0, 10) || dans30jours} /></div>}
      <div><Label htmlFor="doc-livraison">Livraison prévue le</Label><Input id="doc-livraison" name="dateLivraison" type="date" value={dateLivraison} onChange={e => setDateLivraison(e.target.value)} /></div>
      <div><Label htmlFor="doc-categorie">Nature de l’opération</Label><SelectNatif id="doc-categorie" name="categorieOperation" defaultValue={type === 'livraison' ? 'biens' : initial?.categorieOperation || 'biens'} disabled={type === 'livraison'}><option value="biens">Livraison de biens</option><option value="services">Prestation de services</option><option value="mixte">Biens et services</option></SelectNatif></div>
    </div>
    <div><Label htmlFor="doc-adresse">Adresse de livraison</Label><Textarea id="doc-adresse" name="adresseLivraison" maxLength={500} defaultValue={initial?.adresseLivraison || ''} placeholder="Laisser vide pour reprendre l’adresse de la fiche client" /></div>
    {sansTaxe && <p className="rounded-md bg-amber-50 p-3 text-sm">TVA à 0 % : régime de l’exploitation ou exonération de la fiche client. Les prix HT saisis restent les prix à payer.</p>}
    {!charge && <ChoisirStock dateEffet={dateLivraison || dateBrouillon} onChoisir={ajouterStock} preselection={preselection} />}
    <p className="text-sm text-muted-foreground">{type === 'devis' ? 'Les quantités restent disponibles jusqu’à la livraison ou la facturation directe du devis.' : 'Les produits liés au stock seront déduits lorsque vous confirmerez la livraison.'} Les lignes libres restent possibles pour les prestations et produits sans stock suivi.</p>
    <div className="space-y-3">{lignes.map((l, index) => <fieldset key={l.cle} className="grid gap-3 rounded-lg border bg-slate-50 p-3 sm:grid-cols-6">
      <legend className="px-1 text-sm font-medium">Ligne {index + 1}{l.articleStockId ? ' · Liée au stock' : ' · Ligne libre'}</legend>
      <div className="sm:col-span-6"><Label htmlFor={`${l.cle}-description`}>Désignation *</Label><Input id={`${l.cle}-description`} name={`${l.cle}-description`} required maxLength={500} value={l.description} onChange={(e) => changerLigne(l.cle, 'description', e.target.value)} /></div>
      <div><Label htmlFor={`${l.cle}-quantite`}>Quantité *</Label><Input id={`${l.cle}-quantite`} name={`${l.cle}-quantite`} type="number" step="any" min="0.000001" max="1000000" required value={l.quantite} onChange={(e) => changerLigne(l.cle, 'quantite', e.target.value)} /></div>
      <div><Label htmlFor={`${l.cle}-unite`}>Unité *</Label><Input id={`${l.cle}-unite`} name={`${l.cle}-unite`} required readOnly={!!l.articleStockId} maxLength={20} value={l.unite} onChange={(e) => changerLigne(l.cle, 'unite', e.target.value)} /></div>
      <div className="sm:col-span-2"><Label htmlFor={`${l.cle}-prixUnitaire`}>Prix unitaire HT *</Label><Input id={`${l.cle}-prixUnitaire`} name={`${l.cle}-prixUnitaire`} type="number" step="any" min="0" max="1000000" required value={l.prixUnitaire} onChange={(e) => changerLigne(l.cle, 'prixUnitaire', e.target.value)} /></div>
      <div><Label htmlFor={`${l.cle}-tauxTVA`}>TVA</Label><SelectNatif id={`${l.cle}-tauxTVA`} name={`${l.cle}-tauxTVA`} value={sansTaxe ? '0' : l.tauxTVA} onChange={(e) => changerLigne(l.cle, 'tauxTVA', e.target.value)}>{[0, 2.1, 5.5, 10, 20].map((t) => <option key={t} value={t}>{t.toLocaleString('fr-FR')} %</option>)}</SelectNatif></div>
      <div className="flex items-end"><Button type="button" variant="ghost" disabled={lignes.length === 1} onClick={() => setLignes((ls) => ls.filter((v) => v.cle !== l.cle))} aria-label={`Retirer la ligne ${index + 1}`}>Retirer</Button></div>
      {l.articleStockId && <div className="sm:col-span-6"><Button type="button" variant="ghost" size="sm" onClick={() => setLignes((ls) => ls.map((v) => v.cle === l.cle ? { ...v, articleStockType: null, articleStockId: null } : v))}>Passer en ligne libre (sans sortie de stock)</Button></div>}
    </fieldset>)}</div>
    <Button type="button" variant="outline" disabled={lignes.length >= 100} onClick={() => setLignes((ls) => [...ls, nouvelleLigne()])}>Ajouter une ligne</Button>
    <p className="text-right font-medium">HT {argent(totaux.totalHT)} · TVA {argent(totaux.totalTVA)} · TTC {argent(totaux.totalTTC)}</p>
    <div><Label htmlFor="doc-notes">Conditions et notes</Label><Textarea id="doc-notes" name="notes" maxLength={5000} defaultValue={initial?.notes || ''} placeholder="Conditions de livraison et de paiement convenues avec le client…" /></div>
    {erreur && <p role="alert" className="text-sm text-red-700">{erreur}</p>}
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={charge || sauve}>{sauve ? 'Enregistrement…' : 'Enregistrer le brouillon'}</Button><Button type="button" variant="outline" disabled={sauve} onClick={onFermer}>Fermer</Button></div>
  </form>
}
