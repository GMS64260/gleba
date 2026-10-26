"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { PhotoContributionForm } from "@/components/referentiel/PhotoContributionForm"
import { urlConnexion } from "@/lib/auth-retour"

export function AjouterPhoto({ especeId, nom }: { especeId: string; nom: string }) {
  const { status } = useSession()
  const params = useSearchParams()
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => { if (params.get("photo") === "1") setOpen(true) }, [params])
  const retour = `/referentiel/vegetaux/${encodeURIComponent(especeId)}?photo=1#images-documentaires`
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" className="min-h-11"><Camera className="mr-2 h-4 w-4" aria-hidden />Ajouter une photo</Button></DialogTrigger><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto border-lin bg-craie"><DialogHeader><DialogTitle className="pr-6 font-display text-2xl text-foret">Ajouter une photo de {nom}</DialogTitle><DialogDescription>Choisissez votre photo et indiquez ce qu’elle montre. Elle sera visible après relecture.</DialogDescription></DialogHeader>{status === "unauthenticated" ? <div className="space-y-4"><p className="text-sm leading-6 text-ardoise">Connectez-vous pour proposer une photo avec votre signature.</p><Button asChild className="min-h-11"><Link href={urlConnexion(retour)}>Se connecter pour ajouter la photo</Link></Button></div> : <PhotoContributionForm especeId={especeId} nom={nom} />}</DialogContent></Dialog>
}
