"use client"

import * as React from "react"

/**
 * Menu déroulant qui, au doigt, ne s'ouvre qu'une fois le toucher terminé.
 *
 * Un menu Radix s'ouvre dès l'appui (`pointerdown`). Au doigt, le clic du même
 * toucher arrive après l'ouverture et tombe sur l'élément apparu sous le
 * doigt : ouvrir « Dupliquer » créait aussitôt dix planches quand « ×10 » se
 * trouvait là (équipe debug, D121). À la souris et au clavier, rien ne change.
 *
 *   const menu = useMenuOuvertAuClic()
 *   <DropdownMenu open={menu.open} onOpenChange={menu.onOpenChange}>
 *     <DropdownMenuTrigger {...menu.declencheur} asChild>…
 */
export function useMenuOuvertAuClic() {
  const [open, setOpen] = React.useState(false)
  const auDoigt = React.useRef(false)
  const declencheur = React.useMemo(() => ({
    onPointerDown: (e: React.PointerEvent) => {
      auDoigt.current = e.pointerType === "touch" || e.pointerType === "pen"
      // Empêche l'ouverture à l'appui ; le clic ci-dessous ouvre le menu.
      if (auDoigt.current) e.preventDefault()
    },
    onClick: () => {
      if (!auDoigt.current) return
      auDoigt.current = false
      setOpen((ouvert) => !ouvert)
    },
  }), [])
  return { open, onOpenChange: setOpen, declencheur }
}
