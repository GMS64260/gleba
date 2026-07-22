"use client"

import * as React from "react"
import { Download, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { ANIMAUX_CSV_COLUMNS, csvRowToAnimal, parseAnimauxCsv, type AnimalCsvRow } from "@/lib/elevage/import-animaux"

type Espece = { id: string; nom: string }

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export function ImportAnimauxCsv({ especes, existingIdentifiers, onImported }: { especes: Espece[]; existingIdentifiers: string[]; onImported: () => void }) {
  const { toast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [rows, setRows] = React.useState<AnimalCsvRow[]>([])
  const [fileName, setFileName] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  const resolveEspece = (value: string) => especes.find((e) => normalize(e.id) === normalize(value) || normalize(e.nom) === normalize(value))
  const identifiers = new Set(existingIdentifiers.map(normalize))
  const seen = new Set<string>()
  const invalidRows = rows.map((row, index) => {
    const issues: string[] = []
    if (!resolveEspece(row.espece)) issues.push('espèce inconnue')
    const identifiant = normalize(row.identifiant)
    if (identifiant && (identifiers.has(identifiant) || seen.has(identifiant))) issues.push('identifiant déjà présent')
    if (identifiant) seen.add(identifiant)
    for (const [label, value] of [['prix', row.prix_achat], ['poids', row.poids_kg]] as const) {
      if (value && !Number.isFinite(Number(value.replace(',', '.')))) issues.push(`${label} invalide`)
    }
    return { index: index + 2, row, issues }
  }).filter(({ issues }) => issues.length > 0)

  const readFile = async (file?: File) => {
    if (!file) return
    try {
      setRows(parseAnimauxCsv(await file.text()))
      setFileName(file.name)
    } catch (error) {
      setRows([])
      toast({ variant: 'destructive', title: 'CSV invalide', description: error instanceof Error ? error.message : 'Lecture impossible' })
    }
  }

  const downloadTemplate = () => {
    const example = ['chevre_alpine', 'FR123456789012', 'IPG caprin', 'Neige', 'Alpine', 'femelle', '2023-02-15', '2023-02-15', '', '350', '55', ''].join(';')
    const blob = new Blob([`${ANIMAUX_CSV_COLUMNS.join(';')}\n${example}\n`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'modele-import-animaux.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const submit = async () => {
    if (!rows.length || invalidRows.length) return
    setLoading(true)
    const errors: string[] = []
    let imported = 0
    for (let i = 0; i < rows.length; i++) {
      const espece = resolveEspece(rows[i].espece)!
      const response = await fetch('/api/elevage/animaux', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(csvRowToAnimal(rows[i], espece.id)),
      })
      if (response.ok) imported++
      else {
        const payload = await response.json().catch(() => ({}))
        errors.push(`ligne ${i + 2}: ${payload.error || 'erreur inconnue'}`)
      }
    }
    setLoading(false)
    if (imported) onImported()
    toast({
      variant: errors.length ? 'destructive' : 'default',
      title: `${imported} animal(aux) importe(s)`,
      description: errors.length ? `${errors.length} rejet(s) — ${errors.slice(0, 3).join(' ; ')}` : 'Import termine sans erreur.',
    })
    if (!errors.length) { setOpen(false); setRows([]); setFileName('') }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-1" />Importer CSV</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importer un troupeau</DialogTitle>
          <DialogDescription>Une ligne par animal. L’espèce peut être son identifiant Gleba ou son nom exact. Chaque ligne est validée par les mêmes règles que la saisie manuelle.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Button type="button" variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-1" />Télécharger le modèle</Button>
          <Input type="file" accept=".csv,text/csv" onChange={(e) => readFile(e.target.files?.[0])} />
          {rows.length > 0 && <div className="rounded-md border p-3 text-sm space-y-2">
            <p><strong>{fileName}</strong> — {rows.length} ligne(s) détectée(s)</p>
            {invalidRows.length > 0 && <div className="text-red-700 space-y-1">{invalidRows.slice(0, 10).map((x) => <p key={x.index}>Ligne {x.index} : {x.issues.join(', ')}.</p>)}</div>}
            <div className="max-h-52 overflow-auto"><table className="w-full text-xs"><thead><tr><th className="text-left">Ligne</th><th className="text-left">Espèce</th><th className="text-left">IPG</th><th className="text-left">Nom</th><th className="text-left">Race</th></tr></thead><tbody>{rows.slice(0, 20).map((row, i) => <tr key={i} className="border-t"><td>{i + 2}</td><td>{row.espece}</td><td>{row.identifiant || '—'}</td><td>{row.nom || '—'}</td><td>{row.race || '—'}</td></tr>)}</tbody></table></div>
          </div>}
          <div className="flex justify-end"><Button onClick={submit} disabled={loading || !rows.length || invalidRows.length > 0}>{loading ? 'Import en cours…' : `Importer ${rows.length || ''}`}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
