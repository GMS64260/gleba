'use client'
import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export interface LigneTentative {
  id: string
  quand: string
  email: string
  nomFichier: string | null
  tailleOctets: number
  source: string
  statut: string
  message: string | null
  importees: number | null
  dejaPresentes: number | null
  fichierConserve: boolean
}
type Rejeu =
  | { id: string; lisible: true; operations: number; du: string; au: string; netCentimes: number }
  | { id: string; lisible: false | null; message: string }

const STATUT: Record<string, { texte: string; variante: 'outline' | 'destructive' | 'secondary' }> = {
  importe: { texte: 'importé', variante: 'outline' },
  refuse: { texte: 'refusé', variante: 'destructive' },
  erreur: { texte: 'panne', variante: 'destructive' },
}
const euros = (c: number) =>
  (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function TentativesImport({ lignes }: { lignes: LigneTentative[] }) {
  const [rejeux, setRejeux] = React.useState<Record<string, Rejeu>>({})
  const [enCours, setEnCours] = React.useState(false)
  const [erreur, setErreur] = React.useState('')
  const rejouer = async (ids?: string[]) => {
    setEnCours(true)
    setErreur('')
    try {
      const r = await fetch('/api/admin/imports-releve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids ? { ids } : {}),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Rejeu impossible.')
      setRejeux((avant) => ({
        ...avant,
        ...Object.fromEntries((d.data as Rejeu[]).map((x) => [x.id, x])),
      }))
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Rejeu impossible.')
    } finally {
      setEnCours(false)
    }
  }
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Dernières tentatives</CardTitle>
          <CardDescription>
            « Rejouer » relit le fichier conservé avec le lecteur en service, sans rien importer.
          </CardDescription>
        </div>
        <Button size="sm" disabled={enCours} onClick={() => void rejouer()}>
          Rejouer tous les refus
        </Button>
      </CardHeader>
      <CardContent>
        {erreur && <p className="mb-3 text-sm text-red-600">{erreur}</p>}
        {lignes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun import de relevé sur la période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Quand</th>
                  <th className="py-2 pr-3">Compte</th>
                  <th className="py-2 pr-3">Fichier</th>
                  <th className="py-2 pr-3">Résultat</th>
                  <th className="py-2 pr-3">Avec le lecteur actuel</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => {
                  const r = rejeux[l.id]
                  const s = STATUT[l.statut] ?? { texte: l.statut, variante: 'secondary' as const }
                  return (
                    <tr key={l.id} className="border-b align-top last:border-0">
                      <td className="whitespace-nowrap py-2 pr-3 text-xs text-muted-foreground">
                        {l.quand}
                      </td>
                      <td className="py-2 pr-3 text-xs">{l.email}</td>
                      <td className="py-2 pr-3 text-xs">
                        {l.nomFichier || 'sans nom'} · {Math.ceil(l.tailleOctets / 1024)} Ko
                        {l.source === 'texte' && ' · texte décodé par le navigateur'}
                      </td>
                      <td className="max-w-sm break-words py-2 pr-3 text-xs">
                        <Badge variant={s.variante}>{s.texte}</Badge>{' '}
                        {l.statut === 'importe'
                          ? (l.importees ?? 0) + ' importées, ' + (l.dejaPresentes ?? 0) + ' déjà présentes'
                          : l.message}
                      </td>
                      <td className="max-w-sm break-words py-2 pr-3 text-xs">
                        {r &&
                          (r.lisible
                            ? `lisible : ${r.operations} opérations du ${r.du} au ${r.au}, net ${euros(r.netCentimes)}`
                            : r.message)}
                      </td>
                      <td className="whitespace-nowrap py-2 text-xs">
                        {l.fichierConserve ? (
                          <span className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={enCours}
                              onClick={() => void rejouer([l.id])}
                            >
                              Rejouer
                            </Button>
                            <a
                              className="self-center underline"
                              href={`/api/admin/imports-releve/${l.id}/fichier`}
                            >
                              Fichier
                            </a>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">fichier non conservé</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
