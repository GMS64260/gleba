"use client"

/**
 * Arbre genealogique 3 generations en CSS flex
 * Grand-parents -> Parents -> Animal courant -> Enfants
 */

import Link from "next/link"
import { Badge } from "@/components/ui/badge"

interface GenealogyNode {
  id: number
  nom: string | null
  identifiant: string | null
  sexe: string | null
}

interface GenealogyNodeMinimal {
  id: number
  nom: string | null
  identifiant: string | null
}

interface AnimalForTree {
  id: number
  nom: string | null
  identifiant: string | null
  sexe: string | null
  pereIdentifiant: string | null
  mere: (GenealogyNode & {
    mere: GenealogyNodeMinimal | null
  }) | null
  enfants: (GenealogyNode & {
    dateNaissance: string | null
    statut: string
  })[]
}

function NodeLabel(node: GenealogyNodeMinimal) {
  return node.nom || node.identifiant || `#${node.id}`
}

function SexSymbol({ sexe }: { sexe: string | null | undefined }) {
  if (sexe === "femelle") return <span className="text-pink-500">{"\u2640"}</span>
  if (sexe === "male") return <span className="text-blue-500">{"\u2642"}</span>
  return <span className="text-slate-400">?</span>
}

function TreeNode({
  node,
  isCurrent = false,
  label,
  isText = false,
  text,
}: {
  node?: GenealogyNodeMinimal & { sexe?: string | null }
  isCurrent?: boolean
  label?: string
  isText?: boolean
  text?: string
}) {
  const baseClasses = "rounded-lg border px-3 py-2 text-center min-w-[100px] max-w-[140px] transition-colors"

  if (isText && text) {
    return (
      <div className="flex flex-col items-center gap-1">
        {label && <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>}
        <div className={`${baseClasses} bg-slate-50 border-dashed border-slate-300`}>
          <p className="text-xs text-muted-foreground truncate">{text}</p>
        </div>
      </div>
    )
  }

  if (!node) {
    return (
      <div className="flex flex-col items-center gap-1">
        {label && <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>}
        <div className={`${baseClasses} bg-slate-50 border-dashed border-slate-300`}>
          <p className="text-xs text-muted-foreground">Inconnu(e)</p>
        </div>
      </div>
    )
  }

  const content = (
    <div className="flex flex-col items-center gap-1">
      {label && <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>}
      <div className={`${baseClasses} ${
        isCurrent
          ? "bg-amber-50 border-amber-400 ring-2 ring-amber-200 shadow-sm"
          : "bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer"
      }`}>
        <div className="flex items-center justify-center gap-1">
          <SexSymbol sexe={node.sexe} />
          <span className={`text-sm font-medium truncate ${isCurrent ? "text-amber-900" : ""}`}>
            {NodeLabel(node)}
          </span>
        </div>
        {node.identifiant && node.nom && (
          <p className="text-[10px] text-muted-foreground truncate">{node.identifiant}</p>
        )}
      </div>
    </div>
  )

  if (isCurrent) return content

  return (
    <Link href={`/elevage/animaux/${node.id}`}>
      {content}
    </Link>
  )
}

function Connector({ vertical = false }: { vertical?: boolean }) {
  if (vertical) {
    return <div className="w-px h-4 bg-slate-300 mx-auto" />
  }
  return <div className="h-px w-6 bg-slate-300 flex-shrink-0" />
}

export function GenealogyTree({ animal }: { animal: AnimalForTree }) {
  const hasMere = !!animal.mere
  const hasGrandMere = !!animal.mere?.mere
  const hasPere = !!animal.pereIdentifiant
  const hasEnfants = animal.enfants.length > 0
  const hasParents = hasMere || hasPere

  if (!hasParents && !hasEnfants) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground">Aucune information genealogique disponible</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto py-2">
      <div className="flex flex-col items-center gap-0 min-w-[300px]">
        {/* Generation -2 : Grand-mere maternelle */}
        {hasGrandMere && (
          <>
            <TreeNode node={animal.mere!.mere!} label="Grand-mere" />
            <Connector vertical />
          </>
        )}

        {/* Generation -1 : Parents */}
        {hasParents && (
          <>
            <div className="flex items-end justify-center gap-2">
              {hasMere && (
                <TreeNode node={animal.mere!} label="Mere" />
              )}
              {hasMere && hasPere && <Connector />}
              {hasPere && (
                <TreeNode isText text={animal.pereIdentifiant!} label="Pere" />
              )}
            </div>
            <Connector vertical />
          </>
        )}

        {/* Generation 0 : Animal courant */}
        <TreeNode
          node={{
            id: animal.id,
            nom: animal.nom,
            identifiant: animal.identifiant,
            sexe: animal.sexe,
          }}
          isCurrent
        />

        {/* Generation +1 : Enfants */}
        {hasEnfants && (
          <>
            <Connector vertical />
            <div className="flex items-start justify-center gap-2 flex-wrap">
              {animal.enfants.slice(0, 8).map((enfant) => (
                <Link key={enfant.id} href={`/elevage/animaux/${enfant.id}`}>
                  <Badge
                    variant="outline"
                    className={`hover:bg-pink-50 cursor-pointer text-xs ${
                      enfant.statut === "mort" ? "opacity-50 line-through" : ""
                    }`}
                  >
                    <SexSymbol sexe={enfant.sexe} />
                    <span className="ml-1">{NodeLabel(enfant)}</span>
                    {enfant.dateNaissance && (
                      <span className="ml-1 text-muted-foreground">
                        ({new Date(enfant.dateNaissance).getFullYear()})
                      </span>
                    )}
                  </Badge>
                </Link>
              ))}
              {animal.enfants.length > 8 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  +{animal.enfants.length - 8} autres
                </Badge>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
