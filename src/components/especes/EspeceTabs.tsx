"use client"

/**
 * Onglets enrichis de la fiche Espèce (PROMPT 23).
 * - Associations : compagnons + / incompatibles ! pour cette espèce
 * - Bioagresseurs : liste avec période de pression
 */

import * as React from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Bug, Leaf, ThumbsDown, ThumbsUp } from "lucide-react"

interface AssocItem {
  associationId: string
  nom: string
  description: string | null
  notes: string | null
  type: "favorable" | "defavorable"
  partenaire: string // espece ou famille en face
  niveau: string
}

interface BioagresseurItem {
  id: string
  nom: string
  type: string | null
  periode: string | null
  methodesPbi: string[]
  description: string | null
}

export function AssociationsEspeceTab({ especeId }: { especeId: string }) {
  const [items, setItems] = React.useState<AssocItem[] | null>(null)

  React.useEffect(() => {
    fetch(`/api/maraichage/especes/${encodeURIComponent(especeId)}/associations`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setItems(j.data || []))
  }, [especeId])

  if (!items) return <Skeleton className="h-40 w-full" />

  const favorables = items.filter((i) => i.type === "favorable")
  const defavorables = items.filter((i) => i.type === "defavorable")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Leaf className="h-5 w-5 text-green-600" />
          Associations
        </CardTitle>
        <CardDescription>
          Compagnons et incompatibilités issus du module Associations. Les sources sont
          précisées dans les notes — révisez si l'observation terrain diffère.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <div className="font-semibold text-green-700 mb-2 flex items-center gap-1">
            <ThumbsUp className="h-4 w-4" />
            Favorables ({favorables.length})
          </div>
          {favorables.length === 0 ? (
            <p className="text-slate-500 text-xs">Aucune association favorable connue.</p>
          ) : (
            <ul className="space-y-1.5">
              {favorables.map((a) => (
                <li key={a.associationId} className="border rounded p-2 bg-green-50/50">
                  <div className="font-medium">{a.partenaire}</div>
                  <div className="text-xs text-slate-600">{a.description || a.nom}</div>
                  {a.notes && <div className="text-[11px] text-slate-500 mt-1 italic">Source : {a.notes}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="font-semibold text-red-700 mb-2 flex items-center gap-1">
            <ThumbsDown className="h-4 w-4" />
            Incompatibilités ({defavorables.length})
          </div>
          {defavorables.length === 0 ? (
            <p className="text-slate-500 text-xs">Aucune incompatibilité notable.</p>
          ) : (
            <ul className="space-y-1.5">
              {defavorables.map((a) => (
                <li key={a.associationId} className="border rounded p-2 bg-red-50/50">
                  <div className="font-medium">{a.partenaire}</div>
                  <div className="text-xs text-slate-600">{a.description || a.nom}</div>
                  {a.notes && <div className="text-[11px] text-slate-500 mt-1 italic">Source : {a.notes}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Vous pouvez gérer les associations dans <Link href="/maraichage/associations" className="underline">Associations</Link>.
        </p>
      </CardContent>
    </Card>
  )
}

export function BioagresseursEspeceTab({ especeId }: { especeId: string }) {
  const [items, setItems] = React.useState<BioagresseurItem[] | null>(null)

  React.useEffect(() => {
    fetch(`/api/maraichage/especes/${encodeURIComponent(especeId)}/bioagresseurs`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setItems(j.data || []))
  }, [especeId])

  if (!items) return <Skeleton className="h-40 w-full" />

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5 text-amber-600" />
          Bioagresseurs
        </CardTitle>
        <CardDescription>
          Insectes, maladies cryptogamiques et adventices fréquents sur cette espèce.
          Les méthodes PBI sont issues du référentiel Bioagresseurs Gleba.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {items.length === 0 ? (
          <p className="text-slate-500">Aucun bioagresseur référencé pour cette espèce.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((b) => (
              <li key={b.id} className="border rounded p-3 bg-slate-50">
                <div className="flex items-center gap-2 mb-1">
                  <strong className="text-slate-800">{b.nom}</strong>
                  {b.type && <Badge variant="outline" className="text-xs">{b.type}</Badge>}
                  {b.periode && (
                    <span className="text-xs text-slate-500 ml-auto">Pression : {b.periode}</span>
                  )}
                </div>
                {b.description && <p className="text-xs text-slate-600">{b.description}</p>}
                {b.methodesPbi && b.methodesPbi.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {b.methodesPbi.map((m, i) => (
                      <Badge key={i} className="bg-emerald-50 text-emerald-700 text-[10px]">
                        PBI : {m}
                      </Badge>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
