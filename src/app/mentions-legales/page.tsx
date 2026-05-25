/**
 * DEV2 audit Larcher - P0 #2
 * Mentions légales (LCEN art. 6-III).
 *
 * Affiche l'identité légale de la première exploitation publique trouvée,
 * et celle de l'éditeur du logiciel (Gleba).
 */

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Mentions légales",
  description:
    "Mentions légales de Gleba conformes à la LCEN (art. 6-III) : éditeur du site, hébergeur, responsable de publication et coordonnées de contact.",
  alternates: {
    canonical: "https://gleba.fr/mentions-legales",
  },
}

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 max-w-3xl flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Retour
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Mentions légales</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl prose prose-slate">
        <h2>Éditeur du site</h2>
        <p>
          Le site est édité par le producteur dont la fiche boutique est consultée.
          L&apos;identité légale (raison sociale, forme juridique, SIRET, adresse,
          contact) figure sur la fiche publique de la boutique.
        </p>

        <h2>Hébergement</h2>
        <p>
          Le site est hébergé via la plateforme Gleba (gleba.fr), éditée par{" "}
          Guillaume Gomes.
        </p>

        <h2>Logiciel</h2>
        <p>
          Gleba est un logiciel open-source sous licence AGPL-3.0. Le code source
          est disponible sur le dépôt public du projet.
        </p>

        <h2>Propriété intellectuelle</h2>
        <p>
          Le contenu de la boutique (textes, images, descriptions de produits) est
          la propriété du producteur. Toute reproduction sans autorisation est
          interdite.
        </p>

        <h2>Liens utiles</h2>
        <ul>
          <li>
            <Link href="/cgv">Conditions Générales de Vente</Link>
          </li>
          <li>
            <Link href="/confidentialite">Politique de confidentialité</Link>
          </li>
        </ul>

        <p className="text-xs text-slate-500 mt-12">
          Dernière mise à jour : 2026-05-14.
        </p>
      </main>
    </div>
  )
}
