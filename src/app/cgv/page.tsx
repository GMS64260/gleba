/**
 * DEV2 audit Larcher - P0 #2
 * Page Conditions Générales de Vente (CGV).
 *
 * Stub minimal : un producteur configure ses CGV via Paramètres > Boutique
 * (à venir avec le générateur templaté). En attendant, on affiche un
 * placeholder neutre conforme aux mentions obligatoires françaises.
 */

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Conditions Générales de Vente",
}

export default function CgvPage() {
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
          <h1 className="text-xl font-bold">Conditions Générales de Vente</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl prose prose-slate">
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
          ℹ️ Ces CGV sont un modèle générique. Chaque producteur doit les
          personnaliser via Paramètres &gt; Boutique (générateur à venir).
        </p>

        <h2>1. Objet</h2>
        <p>
          Les présentes Conditions Générales de Vente (CGV) régissent les ventes de
          produits agricoles effectuées sur la boutique en ligne du producteur, à
          destination de consommateurs et professionnels.
        </p>

        <h2>2. Identification du vendeur</h2>
        <p>
          Voir la page <Link href="/mentions-legales">Mentions légales</Link> pour
          l&apos;identité légale du producteur (raison sociale, SIRET, adresse).
        </p>

        <h2>3. Commande</h2>
        <p>
          Toute commande passée sur la boutique vaut acceptation pleine et entière
          des présentes CGV. La validation de la commande se fait par cochage de
          l&apos;option « J&apos;ai lu et j&apos;accepte les CGV » lors du checkout.
        </p>

        <h2>4. Prix et paiement</h2>
        <p>
          Les prix affichés sont en euros toutes taxes comprises (TTC). Le paiement
          peut s&apos;effectuer en ligne ou à la livraison/retrait, selon les modalités
          précisées par le producteur. Aucune somme ne peut être encaissée avant
          confirmation de la commande.
        </p>

        <h2>5. Livraison et retrait</h2>
        <p>
          Les modalités de livraison et de retrait sont précisées sur la fiche
          boutique du producteur. Les délais sont indicatifs.
        </p>

        <h2>6. Droit de rétractation</h2>
        <p>
          Conformément à l&apos;article L.221-28 du Code de la consommation, le droit
          de rétractation ne s&apos;applique pas aux denrées périssables. Pour les
          autres produits, le consommateur dispose de 14 jours pour exercer son
          droit de rétractation.
        </p>

        <h2>7. Médiateur de la consommation</h2>
        <p>
          En cas de litige, le consommateur peut recourir gratuitement au médiateur
          de la consommation référencé par le producteur (à compléter via
          Paramètres &gt; Boutique).
        </p>

        <h2>8. Droit applicable</h2>
        <p>
          Les présentes CGV sont soumises au droit français. Tout litige relèvera
          des tribunaux français compétents.
        </p>

        <p className="text-xs text-slate-500 mt-12">
          Dernière mise à jour : 2026-05-14 — version 1.0.
        </p>
      </main>
    </div>
  )
}
