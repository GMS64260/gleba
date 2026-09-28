"use client"

/**
 * `<select>` natif, habillé comme le SelectTrigger Radix.
 *
 * À utiliser pour un champ OBLIGATOIRE d'un formulaire (planche d'une culture,
 * espèce d'un lot, d'un ITP ou d'une sortie de stock…).
 *
 * Pourquoi (QA 2026-09-28, cinq tickets « le choix revient au placeholder ») :
 * le Select Radix rend, dans un <form>, un <select> natif caché (BubbleInput)
 * synchronisé par un `change` re-dispatché ; un remplissage par automate ou
 * aide à la saisie qui n'atteint pas `onValueChange` laisse l'état React vide,
 * et le « filet DOM » (name= + relecture FormData) ne suffisait pas : le
 * formulaire ITP, qui le portait, a perdu son espèce quand même. Un <select>
 * natif contrôlé par React n'a ni élément caché ni course : clic, clavier,
 * `selectOption` d'un automate et saisie vocale passent tous par `onChange`.
 * Un humain n'a jamais été touché ; l'objectif est que le CHAMP ne puisse plus
 * mentir, quel que soit le mode de saisie.
 */

import * as React from "react"

import { cn } from "@/lib/utils"

export const SelectNatif = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
)
SelectNatif.displayName = "SelectNatif"
