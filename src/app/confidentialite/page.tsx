/**
 * DEV2 audit Larcher - P0 #2
 * Politique de confidentialité (RGPD).
 *
 * Mentions obligatoires CNIL : responsable de traitement, finalités, base
 * légale, durée de conservation, droits utilisateur, contact DPO.
 */

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Politique de confidentialité",
}

export default function ConfidentialitePage() {
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
          <h1 className="text-xl font-bold">Politique de confidentialité</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl prose prose-slate">
        <h2>1. Responsable de traitement</h2>
        <p>
          Le responsable du traitement des données personnelles est le producteur
          dont l&apos;identité est précisée sur la page{" "}
          <Link href="/mentions-legales">Mentions légales</Link>. Gleba (sous-traitant
          technique) traite les données en son nom et pour son compte.
        </p>

        <h2>2. Données collectées</h2>
        <ul>
          <li>Identification : nom, email, téléphone, adresse</li>
          <li>Commercial : commandes, factures, préférences de livraison</li>
          <li>Technique : cookies, journal de connexion, adresse IP (hashée pour le consentement cookies)</li>
        </ul>

        <h2>3. Finalités</h2>
        <ul>
          <li>Traitement des commandes et facturation</li>
          <li>Communication relative aux livraisons</li>
          <li>Statistiques anonymes (avec consentement)</li>
          <li>Newsletter (si opt-in explicite)</li>
          <li>Obligations légales : conservation comptable 10 ans (Code de commerce art. L123-22)</li>
        </ul>

        <h2>4. Base légale</h2>
        <p>
          Les traitements sont fondés sur : exécution du contrat (commandes), obligation
          légale (comptabilité, traçabilité Bio), consentement (cookies analytics,
          newsletter), intérêt légitime (sécurité du site).
        </p>

        <h2>5. Durée de conservation</h2>
        <ul>
          <li>Compte utilisateur : tant que le compte est actif + 3 ans après dernier accès</li>
          <li>Données comptables : 10 ans (obligation légale)</li>
          <li>Consentement cookies : 13 mois maximum (CNIL délibération 2020-091)</li>
          <li>Logs de connexion : 12 mois</li>
        </ul>

        <h2>6. Vos droits</h2>
        <p>
          Conformément au RGPD et à la loi Informatique et Libertés, vous disposez d&apos;un
          droit d&apos;accès, de rectification, d&apos;effacement, de limitation, de portabilité
          et d&apos;opposition sur vos données. Vous pouvez exercer ces droits en contactant
          le producteur via l&apos;email indiqué sur les mentions légales.
        </p>
        <p>
          Vous pouvez également introduire une réclamation auprès de la CNIL{" "}
          <a href="https://www.cnil.fr/" target="_blank" rel="noopener noreferrer">
            (cnil.fr)
          </a>
          .
        </p>

        <h2>7. Cookies</h2>
        <p>
          Le site utilise des cookies essentiels (toujours actifs : session, panier,
          sécurité) et, avec votre consentement, des cookies de mesure d&apos;audience,
          marketing et personnalisation. Vous pouvez modifier votre choix à tout moment
          via le bandeau cookies (clic sur la coquille en bas de page après suppression
          du choix actuel).
        </p>

        <p className="text-xs text-slate-500 mt-12">
          Dernière mise à jour : 2026-05-14 — version 1.0.
        </p>
      </main>
    </div>
  )
}
