"use client"

/**
 * Dialog de confirmation de suppression qui liste les données qui seront perdues.
 * Remplace les confirm() natifs pour les entités à dépendances cascade fortes.
 */

import * as React from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export interface DeleteDependency {
  /** Libellé affiché. Passer un pluriel ("récoltes liées") : il sera
   *  automatiquement adapté au singulier si count === 1.
   *  Conventions singularisation : 'es' -> 'e', 's' final -> ''. */
  label: string
  /** Nombre d'éléments liés */
  count: number
}

/**
 * DEV2 #8 — Singularisation auto FR : "1 récoltes liées" → "1 récolte liée".
 * Règles simples qui couvrent les cas courants côté FR :
 *  - mot terminant par "ées"  → "ée"  (récoltées → récoltée)
 *  - mot terminant par "ies"  → "ie"
 *  - mot terminant par "es"   → "e"   (récoltes → récolte, opérations → opération)
 *    Sauf "us", "ois" (variables) → on ne touche pas.
 *  - mot terminant par "s"    → ""   (soins → soin)
 */
function singulariser(mot: string): string {
  if (mot.endsWith("ées")) return mot.slice(0, -1)        // récoltées→récoltée
  if (mot.endsWith("ies")) return mot.slice(0, -1)        // baies→baie
  if (mot.endsWith("liées")) return mot.slice(0, -1)
  if (mot.length > 3 && mot.endsWith("es")) return mot.slice(0, -1)
  if (mot.length > 2 && mot.endsWith("s") && !/(us|ois|ais)$/.test(mot)) return mot.slice(0, -1)
  return mot
}

function singularisePhrase(label: string, count: number): string {
  if (count !== 1) return label
  return label
    .split(/\s+/)
    .map(singulariser)
    .join(" ")
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Nom de l'entité à supprimer (ex: "l'arbre Pommier Golden") */
  entityLabel: string
  /** Dépendances qui seront supprimées en cascade */
  dependencies?: DeleteDependency[]
  /** Texte additionnel (ex: avertissement spécifique) */
  warning?: string
  /** Callback appelé quand l'utilisateur confirme */
  onConfirm: () => Promise<void> | void
  /**
   * Optionnel : callback "Archiver" — quand fourni, un bouton "Archiver
   * (conserver l'historique)" remplace la perte irréversible. Utile pour
   * les entités à forte traçabilité (Bio/HVE) cf. cmplk9y7q sur les arbres.
   */
  onArchive?: () => Promise<void> | void
  /** Libellé du bouton d'archivage (par défaut : "Archiver (conserver l'historique)") */
  archiveLabel?: string
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  entityLabel,
  dependencies = [],
  warning,
  onConfirm,
  onArchive,
  archiveLabel,
}: Props) {
  const [loading, setLoading] = React.useState(false)
  const [archiving, setArchiving] = React.useState(false)
  const totalDeps = dependencies.reduce((s, d) => s + d.count, 0)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  const handleArchive = async () => {
    if (!onArchive) return
    setArchiving(true)
    try {
      await onArchive()
      onOpenChange(false)
    } finally {
      setArchiving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <DialogTitle>Confirmer la suppression</DialogTitle>
              <DialogDescription className="mt-1">
                Cette action est irréversible.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm">
            Vous êtes sur le point de supprimer <strong>{entityLabel}</strong>.
          </p>

          {totalDeps > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-red-900">
                Les données liées suivantes seront également supprimées :
              </p>
              <ul className="space-y-1 text-sm text-red-800">
                {dependencies
                  .filter((d) => d.count > 0)
                  .map((dep) => (
                    <li key={dep.label} className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums">{dep.count}</span>
                      <span>{singularisePhrase(dep.label, dep.count)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {warning && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
              ⚠️ {warning}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading || archiving}
          >
            Annuler
          </Button>
          {onArchive && (
            <Button
              variant="secondary"
              onClick={handleArchive}
              disabled={loading || archiving}
              title="Marque l'entité comme inactive sans supprimer les données liées (récoltes, traitements, etc.)"
            >
              {archiving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Archivage...
                </>
              ) : (
                archiveLabel ?? "Archiver (conserver l'historique)"
              )}
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading || archiving}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Suppression...
              </>
            ) : (
              "Supprimer définitivement"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
