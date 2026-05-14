"use client"

/**
 * /admin/pca
 *
 * PROMPT DEV 1 #8 — Matrice Plan Comptable Agricole (lecture seule).
 *
 * Affiche la matrice catégorie → compte 6xx/7xx. La source de vérité est
 * `data/pca-mapping.yaml` (versionné Git, modifiable par PR uniquement —
 * audit-trail réglementaire). Cette page consomme `lib/comptabilite/plan-comptable-agricole.ts`
 * qui doit rester synchronisé avec le YAML.
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, FileCode, Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  COMPTES_VENTES,
  COMPTES_ACHATS,
  COMPTES_BILAN,
  JOURNAUX,
} from "@/lib/comptabilite/plan-comptable-agricole"

export default function AdminPcaPage() {
  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Admin
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <FileCode className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold">Plan Comptable Agricole</h1>
            </div>
          </div>
          <a
            href="/api/admin/pca-mapping"
            download="pca-mapping.yaml"
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            <Download className="h-3.5 w-3.5" />
            Télécharger YAML
          </a>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-5xl">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-4 text-sm text-blue-900">
            <p className="font-medium mb-1">ℹ Source de vérité Git</p>
            <p className="text-xs">
              La matrice ci-dessous est <strong>versionnée dans le repo</strong> via{" "}
              <code className="font-mono">data/pca-mapping.yaml</code>. Toute modification
              passe par une <strong>pull request validée par un expert-comptable agricole</strong>,
              afin de garantir la traçabilité réglementaire. Cette page est en lecture seule.
            </p>
            <p className="text-xs mt-2">
              Référence : CRC 99-03 + adaptations agricoles (arrêté du 11/12/1986). Validation
              audit Sophie Larcher — 2026-05-14.
            </p>
          </CardContent>
        </Card>

        {/* Journaux */}
        <Card>
          <CardHeader>
            <CardTitle>Journaux comptables</CardTitle>
            <CardDescription>5 journaux distincts pour la ventilation FEC (arrêté 29/07/2013)</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead>Libellé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(JOURNAUX).map(([code, lib]) => (
                  <TableRow key={code}>
                    <TableCell className="font-mono font-medium">{code}</TableCell>
                    <TableCell>{lib}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Comptes de produits 7xx */}
        <Card>
          <CardHeader>
            <CardTitle>Produits — comptes 7xx (Ventes)</CardTitle>
            <CardDescription>Mapping catégorie métier → compte PCA agricole</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="w-28">Compte</TableHead>
                  <TableHead>Libellé compte</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(COMPTES_VENTES).map(([cat, info]) => (
                  <TableRow key={cat}>
                    <TableCell className="font-medium">{cat}</TableCell>
                    <TableCell className="font-mono">{info.num}</TableCell>
                    <TableCell className="text-muted-foreground">{info.lib}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Comptes de charges 6xx */}
        <Card>
          <CardHeader>
            <CardTitle>Charges — comptes 6xx (Achats)</CardTitle>
            <CardDescription>
              Audit Larcher : « Bouillie bordelaise » = catégorie <code>phyto</code> → <code>601500</code>{" "}
              (et non 215400 qui serait une immobilisation).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="w-28">Compte</TableHead>
                  <TableHead>Libellé compte</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(COMPTES_ACHATS).map(([cat, info]) => (
                  <TableRow key={cat}>
                    <TableCell className="font-medium">{cat}</TableCell>
                    <TableCell className="font-mono">{info.num}</TableCell>
                    <TableCell className="text-muted-foreground">{info.lib}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Comptes de bilan 1xx-5xx */}
        <Card>
          <CardHeader>
            <CardTitle>Bilan — comptes 1xx à 5xx</CardTitle>
            <CardDescription>Tiers, trésorerie, TVA, capitaux propres</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rôle</TableHead>
                  <TableHead className="w-28">Compte</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(COMPTES_BILAN).map(([role, num]) => (
                  <TableRow key={role}>
                    <TableCell className="font-medium">{role}</TableCell>
                    <TableCell className="font-mono">{num}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
