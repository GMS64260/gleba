"use client"

/**
 * Page Factures
 * Onglets: Impayées, Générer facture, Avoirs
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, FileText, RefreshCw, Check, Plus, AlertCircle, Download, Printer, CreditCard } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

interface Impayee {
  id: number
  source: string
  date: string
  type: string
  description: string
  montant: number
  client: string | null
}

interface LigneFacture {
  id: string
  description: string
  quantite: number
  unite: string
  prixUnitaire: number
  montant: number
}

export default function FacturesPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = React.useState("impayees")
  const [isLoading, setIsLoading] = React.useState(true)
  const [impayees, setImpayees] = React.useState<Impayee[]>([])
  const [total, setTotal] = React.useState(0)

  // État formulaire facture
  const [factureData, setFactureData] = React.useState({
    numero: `F-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(4, '0')}`,
    date: new Date().toISOString().split('T')[0],
    echeance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    client: "",
    adresse: "",
    email: "",
    objet: "",
    notes: "",
  })
  const [lignes, setLignes] = React.useState<LigneFacture[]>([
    { id: "1", description: "", quantite: 1, unite: "unité", prixUnitaire: 0, montant: 0 }
  ])

  // État formulaire avoir
  const [avoirData, setAvoirData] = React.useState({
    numero: `AV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(4, '0')}`,
    date: new Date().toISOString().split('T')[0],
    factureRef: "",
    client: "",
    motif: "",
    montant: "",
  })

  const fetchImpayees = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const [ventesRes, manuellesRes] = await Promise.all([
        fetch('/api/elevage/ventes?paye=false'),
        fetch('/api/comptabilite/ventes-manuelles?paye=false'),
      ])

      const items: Impayee[] = []

      if (ventesRes.ok) {
        const ventesData = await ventesRes.json()
        const ventes = ventesData.data || []
        ventes.forEach((v: any) => {
          items.push({
            id: v.id,
            source: 'VenteProduit',
            date: v.date,
            type: v.type,
            description: v.description || `Vente ${v.type}`,
            montant: v.prixTotal,
            client: v.client,
          })
        })
      }

      if (manuellesRes.ok) {
        const manuellesData = await manuellesRes.json()
        const manuelles = manuellesData.data || []
        manuelles.forEach((m: any) => {
          items.push({
            id: m.id,
            source: 'VenteManuelle',
            date: m.date,
            type: m.categorie,
            description: m.description,
            montant: m.montant,
            client: m.client,
          })
        })
      }

      items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      setImpayees(items)
      setTotal(items.reduce((sum, i) => sum + i.montant, 0))
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => { fetchImpayees() }, [fetchImpayees])

  const formatEuro = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
  }

  const daysSince = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  }

  const markAsPaid = async (item: Impayee) => {
    try {
      const endpoint = item.source === 'VenteProduit'
        ? '/api/elevage/ventes'
        : '/api/comptabilite/ventes-manuelles'

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, paye: true }),
      })

      if (!response.ok) throw new Error('Erreur')

      toast({ title: "Marqué comme payé", description: formatEuro(item.montant) })
      fetchImpayees()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de mettre à jour" })
    }
  }

  const addLigne = () => {
    setLignes([
      ...lignes,
      { id: String(Date.now()), description: "", quantite: 1, unite: "unité", prixUnitaire: 0, montant: 0 }
    ])
  }

  const updateLigne = (id: string, field: keyof LigneFacture, value: any) => {
    setLignes(lignes.map(l => {
      if (l.id !== id) return l
      const updated = { ...l, [field]: value }
      if (field === 'quantite' || field === 'prixUnitaire') {
        updated.montant = updated.quantite * updated.prixUnitaire
      }
      return updated
    }))
  }

  const removeLigne = (id: string) => {
    if (lignes.length > 1) {
      setLignes(lignes.filter(l => l.id !== id))
    }
  }

  const totalFacture = lignes.reduce((sum, l) => sum + l.montant, 0)

  const generateFacturePDF = () => {
    // Génération simple en ouvrant une nouvelle fenêtre avec le contenu
    const content = `
      <html>
        <head>
          <title>Facture ${factureData.numero}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            h1 { color: #2563eb; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background: #f3f4f6; }
            .total { font-size: 1.2em; font-weight: bold; text-align: right; margin-top: 20px; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .client { margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>FACTURE</h1>
              <p><strong>N°:</strong> ${factureData.numero}</p>
              <p><strong>Date:</strong> ${new Date(factureData.date).toLocaleDateString('fr-FR')}</p>
              <p><strong>Échéance:</strong> ${new Date(factureData.echeance).toLocaleDateString('fr-FR')}</p>
            </div>
          </div>
          <div class="client">
            <strong>Client:</strong> ${factureData.client}<br/>
            ${factureData.adresse ? `<strong>Adresse:</strong> ${factureData.adresse}<br/>` : ''}
            ${factureData.email ? `<strong>Email:</strong> ${factureData.email}` : ''}
          </div>
          ${factureData.objet ? `<p><strong>Objet:</strong> ${factureData.objet}</p>` : ''}
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantité</th>
                <th>Unité</th>
                <th>Prix unitaire</th>
                <th>Montant</th>
              </tr>
            </thead>
            <tbody>
              ${lignes.map(l => `
                <tr>
                  <td>${l.description}</td>
                  <td>${l.quantite}</td>
                  <td>${l.unite}</td>
                  <td>${l.prixUnitaire.toFixed(2)} €</td>
                  <td>${l.montant.toFixed(2)} €</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p class="total">TOTAL: ${totalFacture.toFixed(2)} €</p>
          ${factureData.notes ? `<p style="margin-top: 40px; color: #666;"><em>${factureData.notes}</em></p>` : ''}
        </body>
      </html>
    `
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(content)
      win.document.close()
      win.print()
    }
    toast({ title: "Facture générée", description: `Facture ${factureData.numero}` })
  }

  const generateAvoirPDF = () => {
    const content = `
      <html>
        <head>
          <title>Avoir ${avoirData.numero}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            h1 { color: #dc2626; }
            .info { margin: 20px 0; padding: 15px; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca; }
            .total { font-size: 1.5em; font-weight: bold; color: #dc2626; margin-top: 30px; }
          </style>
        </head>
        <body>
          <h1>AVOIR</h1>
          <p><strong>N°:</strong> ${avoirData.numero}</p>
          <p><strong>Date:</strong> ${new Date(avoirData.date).toLocaleDateString('fr-FR')}</p>
          ${avoirData.factureRef ? `<p><strong>Réf. facture:</strong> ${avoirData.factureRef}</p>` : ''}
          <div class="info">
            <strong>Client:</strong> ${avoirData.client}<br/>
            <strong>Motif:</strong> ${avoirData.motif}
          </div>
          <p class="total">Montant de l'avoir: ${parseFloat(avoirData.montant || '0').toFixed(2)} €</p>
        </body>
      </html>
    `
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(content)
      win.document.close()
      win.print()
    }
    toast({ title: "Avoir généré", description: `Avoir ${avoirData.numero}` })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/comptabilite"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Comptabilité</Button></Link>
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-amber-600" />
              <h1 className="text-xl font-bold">Factures</h1>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchImpayees}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="impayees" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Impayées
              {impayees.length > 0 && (
                <Badge className="ml-1 bg-amber-500">{impayees.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="generer" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nouvelle facture
            </TabsTrigger>
            <TabsTrigger value="avoir" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Avoir
            </TabsTrigger>
          </TabsList>

          {/* Onglet Impayées */}
          <TabsContent value="impayees">
            <div className="grid gap-4 md:grid-cols-2 mb-6">
              <Card className={impayees.length > 0 ? "border-amber-200 bg-amber-50" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Factures en attente</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-3xl font-bold ${impayees.length > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {impayees.length}
                  </p>
                </CardContent>
              </Card>
              <Card className={total > 0 ? "border-amber-200 bg-amber-50" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Montant total dû</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-3xl font-bold ${total > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {formatEuro(total)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Factures en attente de paiement</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : impayees.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                      <Check className="h-8 w-8 text-green-600" />
                    </div>
                    <p className="text-lg font-medium text-green-600">Toutes les factures sont payées !</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Ancienneté</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {impayees.map((item) => {
                        const days = daysSince(item.date)
                        return (
                          <TableRow key={`${item.source}-${item.id}`} className={days > 30 ? "bg-red-50" : days > 14 ? "bg-orange-50" : ""}>
                            <TableCell>{new Date(item.date).toLocaleDateString('fr-FR')}</TableCell>
                            <TableCell>
                              <Badge className={
                                days > 30 ? "bg-red-100 text-red-800" :
                                days > 14 ? "bg-orange-100 text-orange-800" :
                                "bg-yellow-100 text-yellow-800"
                              }>
                                {days} jours
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">{item.description}</TableCell>
                            <TableCell>{item.client || '-'}</TableCell>
                            <TableCell className="text-right font-bold text-amber-600">{formatEuro(item.montant)}</TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => markAsPaid(item)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Payé
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Générer facture */}
          <TabsContent value="generer">
            <Card>
              <CardHeader>
                <CardTitle>Nouvelle facture</CardTitle>
                <CardDescription>Créez une facture à imprimer ou envoyer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <Label>N° Facture</Label>
                    <Input
                      value={factureData.numero}
                      onChange={(e) => setFactureData({ ...factureData, numero: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={factureData.date}
                      onChange={(e) => setFactureData({ ...factureData, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Échéance</Label>
                    <Input
                      type="date"
                      value={factureData.echeance}
                      onChange={(e) => setFactureData({ ...factureData, echeance: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label>Client *</Label>
                    <Input
                      value={factureData.client}
                      onChange={(e) => setFactureData({ ...factureData, client: e.target.value })}
                      placeholder="Nom du client"
                      required
                    />
                  </div>
                  <div>
                    <Label>Adresse</Label>
                    <Input
                      value={factureData.adresse}
                      onChange={(e) => setFactureData({ ...factureData, adresse: e.target.value })}
                      placeholder="Adresse complète"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={factureData.email}
                      onChange={(e) => setFactureData({ ...factureData, email: e.target.value })}
                      placeholder="email@exemple.com"
                    />
                  </div>
                </div>

                <div>
                  <Label>Objet</Label>
                  <Input
                    value={factureData.objet}
                    onChange={(e) => setFactureData({ ...factureData, objet: e.target.value })}
                    placeholder="Ex: Vente légumes semaine 45"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Lignes de facturation</Label>
                    <Button variant="outline" size="sm" onClick={addLigne}>
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter ligne
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">Description</TableHead>
                        <TableHead>Qté</TableHead>
                        <TableHead>Unité</TableHead>
                        <TableHead>Prix unit.</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lignes.map((ligne) => (
                        <TableRow key={ligne.id}>
                          <TableCell>
                            <Input
                              value={ligne.description}
                              onChange={(e) => updateLigne(ligne.id, 'description', e.target.value)}
                              placeholder="Description"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={ligne.quantite}
                              onChange={(e) => updateLigne(ligne.id, 'quantite', parseFloat(e.target.value) || 0)}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Select value={ligne.unite} onValueChange={(v) => updateLigne(ligne.id, 'unite', v)}>
                              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unité">unité</SelectItem>
                                <SelectItem value="kg">kg</SelectItem>
                                <SelectItem value="pièce">pièce</SelectItem>
                                <SelectItem value="heure">heure</SelectItem>
                                <SelectItem value="forfait">forfait</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={ligne.prixUnitaire}
                              onChange={(e) => updateLigne(ligne.id, 'prixUnitaire', parseFloat(e.target.value) || 0)}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell className="font-bold">{formatEuro(ligne.montant)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => removeLigne(ligne.id)} disabled={lignes.length === 1}>
                              ×
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="text-right mt-4">
                    <p className="text-2xl font-bold">Total: {formatEuro(totalFacture)}</p>
                  </div>
                </div>

                <div>
                  <Label>Notes / Conditions</Label>
                  <Textarea
                    value={factureData.notes}
                    onChange={(e) => setFactureData({ ...factureData, notes: e.target.value })}
                    placeholder="Conditions de paiement, mentions légales..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={generateFacturePDF} disabled={!factureData.client || totalFacture === 0}>
                    <Printer className="h-4 w-4 mr-2" />
                    Générer et imprimer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Avoir */}
          <TabsContent value="avoir">
            <Card>
              <CardHeader>
                <CardTitle>Nouvel avoir</CardTitle>
                <CardDescription>Créez un avoir (note de crédit) pour un remboursement</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label>N° Avoir</Label>
                    <Input
                      value={avoirData.numero}
                      onChange={(e) => setAvoirData({ ...avoirData, numero: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={avoirData.date}
                      onChange={(e) => setAvoirData({ ...avoirData, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Réf. facture d'origine</Label>
                    <Input
                      value={avoirData.factureRef}
                      onChange={(e) => setAvoirData({ ...avoirData, factureRef: e.target.value })}
                      placeholder="F-2026-0001"
                    />
                  </div>
                </div>

                <div>
                  <Label>Client *</Label>
                  <Input
                    value={avoirData.client}
                    onChange={(e) => setAvoirData({ ...avoirData, client: e.target.value })}
                    placeholder="Nom du client"
                    required
                  />
                </div>

                <div>
                  <Label>Motif de l'avoir *</Label>
                  <Textarea
                    value={avoirData.motif}
                    onChange={(e) => setAvoirData({ ...avoirData, motif: e.target.value })}
                    placeholder="Ex: Marchandise retournée, erreur de facturation..."
                    required
                  />
                </div>

                <div>
                  <Label>Montant de l'avoir (EUR) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={avoirData.montant}
                    onChange={(e) => setAvoirData({ ...avoirData, montant: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>

                <Button
                  onClick={generateAvoirPDF}
                  disabled={!avoirData.client || !avoirData.motif || !avoirData.montant}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Générer l'avoir
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
