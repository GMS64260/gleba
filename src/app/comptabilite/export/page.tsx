/**
 * Page d'export comptable : FEC (Fichier des Écritures Comptables).
 */

'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

interface ValidationFec {
  exercice: number
  nbEcritures: number
  nbLignes: number
  validation: {
    equilibre: boolean
    ecart: number
    totalDebit: number
    totalCredit: number
    erreursParEcriture: Array<{ ecriture: string; debit: number; credit: number; ecart: number }>
  }
  ventilation: {
    ventes: number
    depenses: number
    factures: number
  }
}

export default function ExportPage() {
  const { toast } = useToast()
  const annees = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
  const [exercice, setExercice] = React.useState<number>(annees[0])
  const [check, setCheck] = React.useState<ValidationFec | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [exploitationOk, setExploitationOk] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    fetch('/api/exploitation').then((r) => r.json()).then(({ data }) => setExploitationOk(!!data)).catch(() => setExploitationOk(false))
  }, [])

  const lancerCheck = async () => {
    setLoading(true)
    setCheck(null)
    try {
      const res = await fetch(`/api/comptabilite/export/fec?exercice=${exercice}&check=1`)
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Erreur', description: json.error || 'Échec' })
      } else {
        setCheck(json)
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erreur réseau', description: String(err) })
    } finally {
      setLoading(false)
    }
  }

  const telecharger = () => {
    const url = `/api/comptabilite/export/fec?exercice=${exercice}`
    window.open(url, '_blank')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/comptabilite">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Comptabilité
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-slate-600" />
              <h1 className="text-xl font-bold">Export comptable</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
        {/* Avertissement exploitation manquante */}
        {exploitationOk === false && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4 text-sm text-amber-900">
              ⚠ Identité légale non configurée. L'export FEC requiert le SIRET et le SIREN
              de l'exploitation pour respecter la nomenclature du fichier (
              <code className="bg-amber-100 px-1 rounded text-xs">&lt;SIREN&gt;FECAAAAMMJJ.txt</code>).{' '}
              <Link href="/parametres/exploitation" className="underline font-medium">
                Configurer maintenant →
              </Link>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Fichier des Écritures Comptables (FEC)</CardTitle>
            <CardDescription>
              Génère le FEC de votre exercice au format normalisé (arrêté du 29/07/2013).
              Ce fichier est l'élément central d'un contrôle fiscal (art. L47 A-I LPF) pour les
              entreprises au réel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-3">
              <div>
                <Label htmlFor="exercice">Exercice</Label>
                <select
                  id="exercice"
                  className="block h-10 rounded-md border border-slate-300 px-3 bg-white mt-1"
                  value={exercice}
                  onChange={(e) => setExercice(parseInt(e.target.value))}
                >
                  {annees.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <Button onClick={lancerCheck} disabled={loading} variant="outline">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Vérifier l'équilibre
              </Button>
              <Button onClick={telecharger} disabled={exploitationOk === false}>
                <Download className="h-4 w-4 mr-2" />
                Télécharger le FEC
              </Button>
            </div>

            {check && (
              <Card className={check.validation.equilibre ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <CardContent className="p-4 text-sm">
                  <div className="flex items-center gap-2 font-semibold mb-3">
                    {check.validation.equilibre ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-700" />
                        <span className="text-green-800">Équilibre Débit = Crédit vérifié</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-5 w-5 text-red-700" />
                        <span className="text-red-800">Déséquilibre détecté</span>
                      </>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs text-slate-700">
                    <div>
                      <div>Écritures : <strong>{check.nbEcritures}</strong></div>
                      <div>Lignes : <strong>{check.nbLignes}</strong></div>
                    </div>
                    <div className="text-right">
                      <div>Total Débit : <strong>{check.validation.totalDebit.toFixed(2)} €</strong></div>
                      <div>Total Crédit : <strong>{check.validation.totalCredit.toFixed(2)} €</strong></div>
                      <div>Écart : <strong>{check.validation.ecart.toFixed(2)} €</strong></div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-600">
                    {check.ventilation.factures} facture(s), {check.ventilation.ventes} vente(s) manuelle(s), {check.ventilation.depenses} dépense(s) manuelle(s).
                  </div>
                  {!check.validation.equilibre && check.validation.erreursParEcriture.length > 0 && (
                    <div className="mt-3 text-xs">
                      <p className="font-semibold text-red-700">Écritures non équilibrées :</p>
                      <ul className="list-disc ml-5 mt-1 text-red-700">
                        {check.validation.erreursParEcriture.slice(0, 10).map((e) => (
                          <li key={e.ecriture}>
                            #{e.ecriture} : D={e.debit.toFixed(2)} C={e.credit.toFixed(2)} (écart {e.ecart.toFixed(2)})
                          </li>
                        ))}
                        {check.validation.erreursParEcriture.length > 10 && (
                          <li>… et {check.validation.erreursParEcriture.length - 10} autres</li>
                        )}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-base text-blue-900">À savoir</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-900 space-y-2">
            <p>
              <strong>Cet export FEC est généré à des fins d'aide.</strong> Le contrôle de
              conformité reste de la responsabilité de l'expert-comptable. Vérifiez l'équilibre
              Débit = Crédit avant transmission, et faites valider le mapping du plan comptable
              avec votre comptable.
            </p>
            <p className="text-xs">
              Format : tabulation, encoding UTF-8, dates AAAAMMJJ, décimales virgule.
              Outil de contrôle officiel : <em>Test Compta Demat</em> (DGFiP).
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
