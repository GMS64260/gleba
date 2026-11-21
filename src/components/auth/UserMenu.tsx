"use client"

/**
 * Menu utilisateur (header)
 */

import * as React from "react"
import { signOut } from "next-auth/react"
import {avantDeconnexionCaisse} from "@/lib/caisse/sortie"
import {alertDialog} from "@/lib/global-dialog"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { User, LogOut, Shield, Settings, Megaphone, Store, Inbox, MessageSquarePlus } from "lucide-react"
import { OPEN_FEEDBACK_EVENT } from "@/components/feedback/OpenFeedbackButton"
import { getEntreeNavigation } from "@/lib/navigation-principale"

interface UserMenuProps {
  user: {
    name?: string | null
    email?: string | null
    role?: string
  }
}

export function UserMenu({ user }: UserMenuProps) {
  const sortieEnCours=React.useRef(false)
  async function deconnecter(){
    if(sortieEnCours.current)return
    sortieEnCours.current=true
    try{if(await avantDeconnexionCaisse())await signOut({callbackUrl:'/login'})}
    catch{await alertDialog('Le journal de caisse n’a pas pu être vérifié. Retrouvez la caisse pour conserver ou exporter les opérations avant de vous déconnecter.',{title:'Caisse à vérifier'})}
    finally{sortieEnCours.current=false}
  }
  const isAdmin = user.role === "ADMIN"
  // Boutique en ligne : module proprietary, masqué dans la build open-source.
  const featureBoutique = process.env.NEXT_PUBLIC_FEATURE_BOUTIQUE === "true"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-lin bg-craie text-encre hover:bg-papier hover:text-encre" aria-label="Menu du compte" title="Mon compte">
          <User className="h-4 w-4 text-ardoise" />
          <span className="hidden sm:inline">
            {user.name || user.email?.split("@")[0]}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user.name || "Utilisateur"}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            {isAdmin && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-ocre">
                <Shield className="h-3 w-3" />
                Administrateur
              </span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {featureBoutique && (
          <Link href="/boutique">
            <DropdownMenuItem className="cursor-pointer">
              <Store className="mr-2 h-4 w-4" />
              {getEntreeNavigation("boutique").libelle}
            </DropdownMenuItem>
          </Link>
        )}

        <Link href="/communaute">
          <DropdownMenuItem className="cursor-pointer">
            <Megaphone className="mr-2 h-4 w-4" />
            Communauté
          </DropdownMenuItem>
        </Link>

        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() =>
            window.dispatchEvent(
              new CustomEvent(OPEN_FEEDBACK_EVENT, { detail: { view: "send" } }),
            )
          }
        >
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          Envoyer un feedback
        </DropdownMenuItem>

        {/* Signalement 2026-10-07 : l'utilisateur cherchait « Mes signalements »
            dans ce menu. Le suivi vit dans le panneau de feedback (onglet
            « Mes demandes ») : on l'ouvre directement dessus. */}
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() =>
            window.dispatchEvent(
              new CustomEvent(OPEN_FEEDBACK_EVENT, { detail: { view: "requests" } }),
            )
          }
        >
          <Inbox className="mr-2 h-4 w-4" />
          Mes demandes
        </DropdownMenuItem>

        <Link href="/parametres">
          <DropdownMenuItem className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Paramètres
          </DropdownMenuItem>
        </Link>

        {isAdmin && (
          <Link href="/admin">
            <DropdownMenuItem className="cursor-pointer">
              <Shield className="mr-2 h-4 w-4" />
              Administration
            </DropdownMenuItem>
          </Link>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="cursor-pointer text-garance focus:text-garance"
          onClick={() => void deconnecter()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
