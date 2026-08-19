import Link from "next/link"
import { ArrowLeft, Mail, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = {
  title: "Supprimer mon compte — Gleba",
  description:
    "Procédure de suppression d'un compte Gleba et des données associées : ce qui est effacé, ce qui est conservé et pendant combien de temps.",
}

/**
 * Page publique de demande de suppression de compte.
 *
 * Exigée par Google Play : l'URL est déclarée dans le formulaire « Sécurité des
 * données » et affichée sur la fiche Play Store. Elle doit rester accessible
 * SANS authentification (cf. liste des routes publiques du middleware), nommer
 * l'application, décrire la procédure et détailler données supprimées et
 * conservées.
 */
export default function SuppressionComptePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-red-100">
            <Trash2 className="h-5 w-5 text-red-700" />
          </div>
          <CardTitle>Supprimer mon compte Gleba</CardTitle>
          <CardDescription>
            Gleba est un logiciel de gestion agricole édité par Gleba. Vous pouvez
            supprimer votre compte et les données de votre exploitation à tout moment,
            vous-même et sans nous contacter.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 text-sm text-slate-600">
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">
              Depuis l&apos;application
            </h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>Connectez-vous à votre compte sur gleba.fr ou dans l&apos;application Android.</li>
              <li>
                Ouvrez <strong>Paramètres</strong>, puis faites défiler jusqu&apos;à la{" "}
                <strong>Zone de danger</strong>.
              </li>
              <li>
                Choisissez <strong>Supprimer mon compte</strong>, tapez{" "}
                <strong>SUPPRIMER</strong> et saisissez votre mot de passe pour confirmer.
              </li>
            </ol>
            <p>
              La suppression est <strong>immédiate et définitive</strong>. Un e-mail de
              confirmation vous est envoyé. Pensez à exporter vos données auparavant si
              vous souhaitez les conserver : Paramètres puis « Exporter mes données ».
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Par e-mail</h2>
            <p>
              Si vous ne parvenez plus à vous connecter, écrivez à{" "}
              <a
                href="mailto:contact@gleba.fr?subject=Suppression%20de%20mon%20compte%20Gleba"
                className="font-medium text-emerald-700 underline underline-offset-2"
              >
                contact@gleba.fr
              </a>{" "}
              depuis l&apos;adresse associée à votre compte. La demande est traitée sous
              trente jours au maximum.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">
              Données supprimées
            </h2>
            <p>
              Tout ce qui constitue votre compte et votre exploitation est effacé de nos
              bases et de nos serveurs de fichiers :
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>compte, identifiants, préférences et jetons d&apos;accès&nbsp;;</li>
              <li>parcelles, planches, plans du jardin et fonds de plan&nbsp;;</li>
              <li>cultures, semis, interventions, irrigations et récoltes&nbsp;;</li>
              <li>verger, arbres et campagnes associées&nbsp;;</li>
              <li>animaux, lots, suivi sanitaire et registres d&apos;élevage&nbsp;;</li>
              <li>comptabilité, ventes, factures, justificatifs et boutique&nbsp;;</li>
              <li>photos et documents que vous avez téléversés&nbsp;;</li>
              <li>fiches de référentiel que vous aviez gardées privées.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">
              Données conservées
            </h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Les fiches de référentiel que vous avez <strong>explicitement partagées</strong>{" "}
                avec la communauté (espèces, variétés, itinéraires techniques, races…)
                restent disponibles pour les autres membres. Elles sont réattribuées au
                compte « Communauté Gleba » et ne portent plus votre nom.
              </li>
              <li>
                Les journaux techniques de connexion et de sécurité sont conservés jusqu&apos;à{" "}
                <strong>douze mois</strong>, durée imposée par la réglementation.
              </li>
              <li>
                Les pièces comptables que vous nous auriez adressées dans un cadre
                contractuel sont conservées <strong>dix ans</strong>, comme l&apos;exige le
                code de commerce.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">
              Supprimer seulement mes données
            </h2>
            <p>
              Vous pouvez aussi effacer vos données d&apos;exploitation{" "}
              <strong>en gardant votre compte</strong>, pour repartir d&apos;une base
              vierge : Paramètres, Zone de danger, « Supprimer toutes mes données ».
            </p>
          </section>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild>
              <Link href="/parametres">
                <Trash2 className="mr-2 h-4 w-4" />
                Aller dans mes paramètres
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a href="mailto:contact@gleba.fr?subject=Suppression%20de%20mon%20compte%20Gleba">
                <Mail className="mr-2 h-4 w-4" />
                Nous écrire
              </a>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour à Gleba
              </Link>
            </Button>
          </div>

          <p className="border-t border-slate-100 pt-4 text-xs text-slate-500">
            Pour le détail des traitements, consultez notre{" "}
            <Link href="/confidentialite" className="underline underline-offset-2">
              politique de confidentialité
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
