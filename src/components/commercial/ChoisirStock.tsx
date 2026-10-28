'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectNatif } from '@/components/ui/select-natif'
import { cleArticle, type ArticleStockCommercial } from '@/lib/commercial/stock-types'

export function prixHTDuStock(a: ArticleStockCommercial, sansTaxe: boolean) {
  return a.prixTTC == null ? null : Math.round(a.prixTTC / (sansTaxe ? 1 : 1 + a.tauxTVA / 100) * 10000) / 10000
}

export function ChoisirStock({ onChoisir, preselection }: { onChoisir: (a: ArticleStockCommercial) => void; preselection?: string }) {
  const [articles, setArticles] = React.useState<ArticleStockCommercial[]>([])
  const [charge, setCharge] = React.useState(true)
  const [erreur, setErreur] = React.useState('')
  const [recherche, setRecherche] = React.useState('')
  const [choix, setChoix] = React.useState('')
  const [version, setVersion] = React.useState(0)
  const id = React.useId()
  const callback = React.useRef(onChoisir); callback.current = onChoisir
  const preselectionFaite = React.useRef(false)
  React.useEffect(() => {
    const controller = new AbortController()
    setCharge(true); setErreur('')
    fetch('/api/comptabilite/documents/stock', { signal: controller.signal })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Stocks indisponibles'); return j.data as ArticleStockCommercial[] })
      .then((liste) => {
        setArticles(liste)
        const a = liste.find((a) => cleArticle(a) === preselection)
        if (a && !preselectionFaite.current) { preselectionFaite.current = true; setChoix(cleArticle(a)); callback.current(a) }
      })
      .catch((e) => { if (!controller.signal.aborted) setErreur(e.message) })
      .finally(() => { if (!controller.signal.aborted) setCharge(false) })
    return () => controller.abort()
  }, [version, preselection])
  const visibles = articles.filter((a) => `${a.nom} ${a.categorie} ${a.dateLot || ''}`.toLocaleLowerCase('fr-FR').includes(recherche.toLocaleLowerCase('fr-FR')))
  const selection = articles.find((a) => cleArticle(a) === choix)
  return <div className="space-y-3 rounded-lg border border-green-200 bg-green-50/50 p-3">
    <p className="font-medium">Ajouter depuis mes stocks</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><Label htmlFor={`${id}-recherche`}>Rechercher un produit ou un lot</Label><Input id={`${id}-recherche`} value={recherche} onChange={(e) => { setRecherche(e.target.value); setChoix('') }} placeholder="Carotte, œufs, miel…" /></div>
      <div><Label htmlFor={`${id}-stock`}>Produit disponible</Label><SelectNatif id={`${id}-stock`} value={choix} disabled={charge} onChange={(e) => setChoix(e.target.value)}>
        <option value="">{charge ? 'Chargement des stocks…' : visibles.length ? 'Choisir un produit' : 'Aucun stock correspondant'}</option>
        {[...new Set(visibles.map((a) => a.categorie))].map((categorie) => <optgroup key={categorie} label={categorie}>{visibles.filter((a) => a.categorie === categorie).map((a) => <option key={cleArticle(a)} value={cleArticle(a)}>{a.nom}{a.dateLot ? ` · ${a.dateLot.split('-').reverse().join('/')}` : ''} · {a.disponible == null ? 'stock non limité' : `${a.disponible.toLocaleString('fr-FR')} ${a.unite}`}</option>)}</optgroup>)}
      </SelectNatif></div>
    </div>
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!selection || charge} onClick={() => { if (selection) onChoisir(selection) }}>Ajouter ce produit</Button><Button type="button" variant="ghost" disabled={charge} onClick={() => setVersion((v) => v + 1)}>Actualiser les stocks</Button></div>
    <p className="text-xs text-muted-foreground">La désignation, l’unité et le prix connu sont repris. Ajustez la quantité et le prix HT avant d’enregistrer.</p>
    {selection?.avertissements?.map((message) => <p key={message} role="alert" className="text-sm text-amber-800">{message}</p>)}
    {erreur && <p role="alert" className="text-sm text-red-700">{erreur}</p>}
  </div>
}
