"use client"

/**
 * Menu « Dupliquer » d'un arbre, commun au plan du jardin et à la liste du
 * verger.
 *
 * Revue du 2026-10-29 : la duplication recopiait le prix et la date d'achat de
 * l'arbre source et créait une dépense par copie, sans un mot. La recopie de
 * l'achat est une case décochée à chaque ouverture du menu, proposée
 * seulement quand l'arbre source porte un achat (`recopierAchat` de
 * `POST /api/arbres/[id]/dupliquer`).
 */

import * as React from "react"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export const NOMBRES_COPIES_ARBRE = [1, 2, 3, 5, 10]

export function MenuDuplicationArbre({
  arbre,
  onDupliquer,
  align = "end",
  children,
}: {
  arbre: { prixAchat?: number | null; dateAchat?: string | Date | null }
  onDupliquer: (nombre: number, recopierAchat: boolean) => void
  align?: "start" | "end"
  /** Bouton déclencheur. */
  children: React.ReactNode
}) {
  const [recopierAchat, setRecopierAchat] = React.useState(false)
  const prix = arbre.prixAchat ?? 0
  const aUnAchat = prix > 0 || arbre.dateAchat != null

  return (
    <DropdownMenu onOpenChange={(ouvert) => { if (!ouvert) setRecopierAchat(false) }}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} onClick={(e) => e.stopPropagation()}>
        {aUnAchat && (
          <>
            <DropdownMenuCheckboxItem
              checked={recopierAchat}
              onCheckedChange={(coche) => setRecopierAchat(coche === true)}
              // Le menu reste ouvert : on coche, puis on choisit le nombre de copies.
              onSelect={(e) => e.preventDefault()}
              className="max-w-72"
            >
              <span aria-hidden className="absolute left-2 h-3.5 w-3.5 rounded-sm border border-current" />
              <span>
                Recopier l&apos;achat (prix et date)
                <span className="block text-xs text-muted-foreground">
                  {prix > 0
                    ? "Crée une dépense d’achat pour chaque copie, datée comme l’achat de cet arbre."
                    : "Recopie la date d’achat sur chaque copie."}
                </span>
              </span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
          </>
        )}
        {NOMBRES_COPIES_ARBRE.map((n) => (
          <DropdownMenuItem key={n} onClick={() => onDupliquer(n, aUnAchat && recopierAchat)}>
            {n === 1 ? "Dupliquer" : `Dupliquer ×${n}`}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
