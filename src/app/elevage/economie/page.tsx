"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react"
import { AppHeader } from "@/components/shell/AppHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Atelier = { code: string; libelle: string; effectif: number; couts: { total: number }; revenus: { total: number }; marge: number; production: { oeufs: number; litresLivres: number } }
type Rapprochement = { mois: number; litresLivres: number; litresPayes: number; ecartLitres: number; montantHT: number; statut: string }
type Analyse = { ateliers: Atelier[]; rapprochementLait: Rapprochement[]; stats: { totalCouts: number; totalRevenus: number; margeGlobale: number }; methode: Record<string, string> }
type Administration = { contrats: { id: string; client: string; production: string; dateFin: string | null; actif: boolean }[]; echeances: { id: string; libelle: string; categorie: string; dateEcheance: string; statut: string }[] }
const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })
const mois = ["Jan.", "Fév.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."]

export default function EconomieElevagePage() {
  const [annee, setAnnee] = React.useState(new Date().getFullYear())
  const [analyse, setAnalyse] = React.useState<Analyse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [admin, setAdmin] = React.useState<Administration>({ contrats: [], echeances: [] })
  const [echeance, setEcheance] = React.useState({ libelle: "", categorie: "PAC", dateEcheance: "" })
  const [contrat, setContrat] = React.useState({ client: "", production: "", dateDebut: "", dateFin: "", prix: "" })
  const refreshAdmin = React.useCallback(() => fetch('/api/elevage/administration').then(r => r.json()).then(r => setAdmin(r.data)), [])
  React.useEffect(() => { refreshAdmin().catch(() => undefined) }, [refreshAdmin])
  React.useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetch(`/api/elevage/analyse-couts?annee=${annee}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : Promise.reject(new Error("Chargement impossible")))
      .then(setAnalyse).finally(() => setLoading(false)).catch(() => undefined)
    return () => controller.abort()
  }, [annee])
  const createAdmin = async (body: object) => {
    const response = await fetch('/api/elevage/administration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (response.ok) await refreshAdmin()
  }

  return <div className="min-h-screen bg-slate-50">
    <AppHeader current="elevage" />
    <main className="mx-auto max-w-7xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Économie de l’élevage</h1><p className="text-sm text-muted-foreground">Marges par atelier et contrôle de la paie du lait.</p></div>
        <div className="flex gap-2"><Input aria-label="Année" className="w-24" type="number" value={annee} onChange={e => setAnnee(Number(e.target.value))} /><Button asChild variant="outline"><Link href="/elevage"><ArrowLeft className="h-4 w-4 mr-1" />Retour</Link></Button></div>
      </div>
      {loading || !analyse ? <Card><CardContent className="p-8 text-center">Calcul en cours…</CardContent></Card> : <>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-sm">Coûts</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{euro.format(analyse.stats.totalCouts)}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Revenus</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{euro.format(analyse.stats.totalRevenus)}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Marge</CardTitle></CardHeader><CardContent className={`text-2xl font-bold ${analyse.stats.margeGlobale < 0 ? "text-red-600" : "text-emerald-700"}`}>{euro.format(analyse.stats.margeGlobale)}</CardContent></Card>
        </div>
        <Card><CardHeader><CardTitle>Ateliers</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Atelier</TableHead><TableHead className="text-right">Effectif</TableHead><TableHead className="text-right">Coûts</TableHead><TableHead className="text-right">Revenus</TableHead><TableHead className="text-right">Marge</TableHead></TableRow></TableHeader><TableBody>{analyse.ateliers.map(a => <TableRow key={a.code}><TableCell className="font-medium">{a.libelle}</TableCell><TableCell className="text-right">{a.effectif || "—"}</TableCell><TableCell className="text-right">{euro.format(a.couts.total)}</TableCell><TableCell className="text-right">{euro.format(a.revenus.total)}</TableCell><TableCell className={`text-right font-semibold ${a.marge < 0 ? "text-red-600" : "text-emerald-700"}`}>{euro.format(a.marge)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        <Card><CardHeader><CardTitle>Rapprochement livraisons / paies du lait</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Mois</TableHead><TableHead className="text-right">Livré</TableHead><TableHead className="text-right">Payé</TableHead><TableHead className="text-right">Écart</TableHead><TableHead className="text-right">Montant HT</TableHead><TableHead>Contrôle</TableHead></TableRow></TableHeader><TableBody>{analyse.rapprochementLait.filter(r => r.litresLivres || r.litresPayes).map(r => <TableRow key={r.mois}><TableCell>{mois[r.mois - 1]}</TableCell><TableCell className="text-right">{r.litresLivres} L</TableCell><TableCell className="text-right">{r.litresPayes} L</TableCell><TableCell className="text-right">{r.ecartLitres} L</TableCell><TableCell className="text-right">{euro.format(r.montantHT)}</TableCell><TableCell>{r.statut === "ok" ? <span className="text-emerald-700 flex gap-1"><CheckCircle2 className="h-4 w-4" />OK</span> : <span className="text-amber-700 flex gap-1"><AlertTriangle className="h-4 w-4" />À vérifier</span>}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        <Card><CardHeader><CardTitle>Méthode de calcul</CardTitle></CardHeader><CardContent className="space-y-1 text-sm text-muted-foreground">{Object.values(analyse.methode).map(text => <p key={text}>• {text}</p>)}</CardContent></Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>Échéances et aides</CardTitle></CardHeader><CardContent className="space-y-3">
            <form className="grid gap-2 sm:grid-cols-4" onSubmit={async e => { e.preventDefault(); await createAdmin({ entity: 'echeance', ...echeance }); setEcheance({ libelle: '', categorie: 'PAC', dateEcheance: '' }) }}>
              <Input required placeholder="Libellé" value={echeance.libelle} onChange={e => setEcheance(v => ({ ...v, libelle: e.target.value }))} />
              <select aria-label="Catégorie" className="h-10 rounded-md border bg-white px-2" value={echeance.categorie} onChange={e => setEcheance(v => ({ ...v, categorie: e.target.value }))}><option>PAC</option><option>IDENTIFICATION</option><option>SANITAIRE</option><option>ASSURANCE</option><option>AUTRE</option></select>
              <Input required type="date" value={echeance.dateEcheance} onChange={e => setEcheance(v => ({ ...v, dateEcheance: e.target.value }))} />
              <Button type="submit">Ajouter</Button>
            </form>
            {admin.echeances.map(item => <div key={item.id} className="flex justify-between border-t pt-2 text-sm"><span>{item.categorie} · {item.libelle}</span><span>{new Date(item.dateEcheance).toLocaleDateString('fr-FR')}</span></div>)}
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Contrats commerciaux</CardTitle></CardHeader><CardContent className="space-y-3">
            <form className="grid gap-2 sm:grid-cols-2" onSubmit={async e => { e.preventDefault(); await createAdmin({ entity: 'contrat', ...contrat, dateFin: contrat.dateFin || null }); setContrat({ client: '', production: '', dateDebut: '', dateFin: '', prix: '' }) }}>
              <Input required placeholder="Client / collecteur" value={contrat.client} onChange={e => setContrat(v => ({ ...v, client: e.target.value }))} />
              <Input required placeholder="Production" value={contrat.production} onChange={e => setContrat(v => ({ ...v, production: e.target.value }))} />
              <Input required aria-label="Début" type="date" value={contrat.dateDebut} onChange={e => setContrat(v => ({ ...v, dateDebut: e.target.value }))} />
              <Input aria-label="Fin" type="date" value={contrat.dateFin} onChange={e => setContrat(v => ({ ...v, dateFin: e.target.value }))} />
              <Input placeholder="Prix / grille" value={contrat.prix} onChange={e => setContrat(v => ({ ...v, prix: e.target.value }))} />
              <Button type="submit">Ajouter le contrat</Button>
            </form>
            {admin.contrats.map(item => <div key={item.id} className="flex justify-between border-t pt-2 text-sm"><span>{item.client} · {item.production}</span><span>{item.dateFin ? `fin ${new Date(item.dateFin).toLocaleDateString('fr-FR')}` : 'sans échéance'}</span></div>)}
          </CardContent></Card>
        </div>
      </>}
    </main>
  </div>
}
