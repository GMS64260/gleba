import * as React from "react"

import { toast } from "@/hooks/use-toast"
import { ToastAction } from "@/components/ui/toast"

/**
 * Confirmation unique d'un enregistrement (récolte notée, arrosage, soin,
 * dépense, tâche faite) : titre, détail et bouton « Annuler » qui appelle
 * l'inverse de l'action. Politique de notifications du plan d'accueil
 * (2026-10-08) : un enregistrement produit toujours une confirmation
 * immédiate à l'écran, avec annulation ; le registre fait foi, rien n'est
 * envoyé au centre ni en push.
 *
 * Palier 1 : posé, appelé par personne. Les appels `toast()` existants
 * migrent module par module à partir de L2.
 */
export interface EnregistrementNotifie {
  /** « Récolte notée » */
  titre: string
  /** « 12 kg de poireaux · C2 » */
  detail?: string
  /** Inverse de l'action. S'il échoue, un toast d'erreur le dit et la ligne reste. */
  annuler?: () => Promise<void> | void
  /** Libellé du bouton d'annulation. */
  libelleAnnuler?: string
}

export const DUREE_ANNULATION_MS = 8000

export function notifierEnregistrement({ titre, detail, annuler, libelleAnnuler = "Annuler" }: EnregistrementNotifie) {
  const action = annuler
    ? (
        <ToastAction
          altText={libelleAnnuler}
          onClick={async () => {
            try {
              await annuler()
            } catch (e) {
              toast({
                variant: "destructive",
                title: "Annulation impossible",
                description: e instanceof Error ? e.message : "L'enregistrement est conservé.",
              })
            }
          }}
        >
          {libelleAnnuler}
        </ToastAction>
      )
    : undefined
  return toast({ title: titre, description: detail, action, duration: DUREE_ANNULATION_MS })
}
