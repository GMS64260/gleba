/**
 * DEV2 audit Larcher - P0 #2
 * Politique de confidentialité (RGPD).
 *
 * Mentions obligatoires CNIL : responsable de traitement, finalités, base
 * légale, durée de conservation, droits utilisateur, contact.
 *
 * Cette page est aussi le document que Google Play confronte à la fiche
 * « Sécurité des données » de l'application Android : toute catégorie déclarée
 * dans la Play Console doit apparaître ici, et réciproquement. En cas de
 * modification des données collectées, mettre à jour les DEUX.
 */

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Politique de confidentialité",
  description:
    "Politique de confidentialité de Gleba conforme au RGPD et à la CNIL : responsable de traitement, données collectées, finalités, base légale, durées de conservation, suppression du compte et droits des utilisateurs.",
  alternates: {
    canonical: "https://gleba.fr/confidentialite",
  },
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
        <p className="lead">
          Cette politique s&apos;applique au site gleba.fr, à l&apos;application
          Android Gleba et aux boutiques en ligne hébergées par la plateforme.
        </p>

        <h2>1. Qui est responsable de vos données</h2>
        <p>Deux situations doivent être distinguées.</p>
        <ul>
          <li>
            <strong>Vous êtes membre de Gleba</strong> (vous avez un compte pour gérer
            votre exploitation). Le responsable de traitement est Guillaume Gomes,
            éditeur de la plateforme Gleba, joignable à{" "}
            <a href="mailto:contact@gleba.fr">contact@gleba.fr</a>.
          </li>
          <li>
            <strong>Vous êtes client d&apos;une boutique</strong>{" "}
            hébergée sur Gleba.
            Le responsable de traitement est le producteur dont vous consultez la
            boutique, dont l&apos;identité figure sur sa fiche publique et sur les{" "}
            <Link href="/mentions-legales">mentions légales</Link>. Gleba intervient
            alors comme sous-traitant technique, au sens de l&apos;article 28 du RGPD.
          </li>
        </ul>

        <h2>2. Données collectées</h2>

        <h3>2.1 Compte et identité</h3>
        <ul>
          <li>Nom et adresse e-mail, indispensables à la création du compte.</li>
          <li>
            Mot de passe, jamais conservé en clair : seule une empreinte bcrypt est
            stockée.
          </li>
          <li>
            Si vous choisissez la connexion Google, Google nous transmet votre
            adresse e-mail, votre nom et l&apos;état de vérification de
            l&apos;adresse. Nous ne recevons jamais votre mot de passe Google et
            un compte créé ainsi n&apos;a pas de mot de passe Gleba tant que vous
            n&apos;en définissez pas un.
          </li>
          <li>
            Identité de l&apos;exploitation : raison sociale, adresse du siège, code
            postal, commune, SIRET, téléphone et e-mail de contact.
          </li>
        </ul>

        <h3>2.2 Position géographique</h3>
        <p>
          Les contours de vos parcelles sont enregistrés sous forme de coordonnées
          géographiques. Avec votre autorisation, l&apos;application peut lire la
          position de votre appareil pour vous situer sur le plan ou dessiner une
          parcelle depuis le terrain. Cette autorisation est facultative et
          révocable à tout moment dans les réglages de votre téléphone ou de votre
          navigateur ; l&apos;application reste utilisable sans elle.
        </p>

        <h3>2.3 Données d&apos;exploitation</h3>
        <p>
          Tout ce que vous saisissez dans l&apos;outil : parcelles, planches, plans
          du jardin, cultures, semis, interventions, traitements phytosanitaires,
          irrigations, récoltes, verger et arbres, animaux, lots, suivi sanitaire,
          reproduction, productions, stocks, tâches et notes.
        </p>

        <h3>2.4 Données financières</h3>
        <ul>
          <li>
            Écritures comptables, ventes, dépenses, factures, devis et exports
            réglementaires (FEC).
          </li>
          <li>
            Coordonnées bancaires de votre exploitation (IBAN et BIC) lorsque vous
            les renseignez pour les faire figurer sur vos factures. Elles servent
            uniquement à cet affichage : Gleba n&apos;exécute aucun paiement et
            n&apos;a accès à aucun moyen de paiement.
          </li>
        </ul>

        <h3>2.5 Photos, fichiers et documents</h3>
        <ul>
          <li>Photos et images que vous téléversez, y compris les fonds de plan satellite ou drone.</li>
          <li>Justificatifs comptables et pièces jointes.</li>
          <li>Registres d&apos;élevage archivés et documents générés par l&apos;application.</li>
        </ul>

        <h3>2.6 Données techniques</h3>
        <ul>
          <li>Journaux de connexion et adresse IP, à des fins de sécurité.</li>
          <li>
            Cookies, dont l&apos;adresse IP conservée sous forme hachée pour la preuve
            du consentement.
          </li>
        </ul>

        <h3>2.7 Boutique en ligne</h3>
        <p>
          Pour les clients d&apos;une boutique : nom, coordonnées, commandes,
          factures et préférences de livraison, sous la responsabilité du producteur.
        </p>

        <h2>3. Finalités</h2>
        <ul>
          <li>Fournir les fonctions de gestion agricole que vous utilisez.</li>
          <li>Gérer votre compte, votre authentification et la sécurité du service.</li>
          <li>Produire vos documents réglementaires : registres, traçabilité, comptabilité.</li>
          <li>Traiter les commandes et la facturation des boutiques.</li>
          <li>Vous envoyer les e-mails nécessaires au service (vérification d&apos;adresse, réinitialisation de mot de passe, confirmations).</li>
          <li>Vous adresser des informations sur le produit, uniquement si vous ne vous y êtes pas opposé, avec un lien de désabonnement en un clic dans chaque envoi.</li>
          <li>Respecter les obligations légales, notamment comptables.</li>
        </ul>
        <p>
          Gleba n&apos;affiche aucune publicité, n&apos;utilise aucun traqueur
          publicitaire et ne vend aucune donnée.
        </p>

        <h2>4. Base légale</h2>
        <ul>
          <li><strong>Exécution du contrat</strong> : compte, fonctionnalités, commandes.</li>
          <li><strong>Obligation légale</strong> : comptabilité, traçabilité, registres réglementaires.</li>
          <li><strong>Consentement</strong> : géolocalisation, notifications, cookies de mesure d&apos;audience, assistant IA.</li>
          <li><strong>Intérêt légitime</strong> : sécurité du service et prévention des abus.</li>
        </ul>

        <h2>5. Destinataires et sous-traitants</h2>
        <p>
          Vos données ne sont ni vendues, ni cédées, ni transmises à des fins
          publicitaires. Elles sont hébergées sur des serveurs situés en France.
          Certaines fonctions font toutefois appel à des services extérieurs :
        </p>
        <ul>
          <li>
            <strong>Assistant IA</strong> : lorsque vous l&apos;interrogez, votre
            question et les éléments de contexte nécessaires à la réponse sont
            transmis à Ollama Cloud, situé hors de l&apos;Union européenne, qui
            effectue le calcul et ne conserve pas ces contenus pour son propre
            compte. Si vous ne souhaitez pas ce transfert, n&apos;utilisez pas
            l&apos;assistant : le reste de l&apos;application fonctionne sans lui.
          </li>
          <li>
            <strong>Météo, sol et eau</strong> : les coordonnées de la parcelle
            concernée sont envoyées à Open-Meteo, à SoilGrids (ISRIC) et au service
            public Hub&apos;Eau afin d&apos;obtenir prévisions, données pédologiques
            et données hydrologiques. Aucune information de compte ne les accompagne.
          </li>
          <li>
            <strong>Station météo personnelle</strong> : si, et seulement si, vous en
            configurez une, l&apos;application interroge le service de votre
            fabricant avec les identifiants que vous fournissez.
          </li>
          <li>
            <strong>Envoi d&apos;e-mails</strong> : un prestataire SMTP achemine les
            messages transactionnels.
          </li>
          <li>
            <strong>Connexion Google</strong> : si vous utilisez « Continuer avec
            Google », l&apos;authentification est effectuée par Google (Google
            Ireland Ltd), qui nous communique uniquement votre identité (nom,
            e-mail, vérification de l&apos;adresse). L&apos;usage que Google fait
            de vos données est décrit dans sa propre politique de confidentialité.
            Cette méthode de connexion est facultative : l&apos;inscription par
            e-mail et mot de passe reste toujours disponible.
          </li>
        </ul>

        <h2>6. Durée de conservation</h2>
        <ul>
          <li>Compte et données d&apos;exploitation : tant que le compte existe, puis 3 ans après le dernier accès.</li>
          <li>Données comptables : 10 ans (Code de commerce, art. L123-22).</li>
          <li>Journaux de connexion : 12 mois.</li>
          <li>Consentement aux cookies : 13 mois au maximum (délibération CNIL 2020-091).</li>
        </ul>
        <p>
          En cas de suppression de votre compte, ces durées ne s&apos;appliquent plus
          qu&apos;aux catégories que la loi impose de conserver.
        </p>

        <h2>7. Supprimer votre compte et vos données</h2>
        <p>
          Vous pouvez supprimer votre compte vous-même, à tout moment, depuis{" "}
          <strong>Paramètres</strong> puis <strong>Zone de danger</strong>. La
          suppression est immédiate et définitive, et un e-mail de confirmation vous
          est envoyé. Vous pouvez aussi effacer vos seules données d&apos;exploitation
          en conservant votre compte.
        </p>
        <p>
          La procédure détaillée, la liste de ce qui est supprimé et de ce qui est
          conservé figurent sur la page{" "}
          <Link href="/suppression-compte">Supprimer mon compte</Link>.
        </p>
        <p>
          Les fiches de référentiel que vous avez explicitement choisi de partager
          avec la communauté (espèces, variétés, itinéraires techniques, races) ne
          sont pas supprimées : elles restent utiles aux autres membres et sont
          réattribuées au compte « Communauté Gleba », détachées de votre identité.
          Vous pouvez les repasser en privé avant de supprimer votre compte si vous
          souhaitez qu&apos;elles disparaissent avec lui.
        </p>

        <h2>8. Vos droits</h2>
        <p>
          Conformément au RGPD et à la loi Informatique et Libertés, vous disposez
          d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de
          limitation, de portabilité et d&apos;opposition. L&apos;application vous
          permet d&apos;exercer directement l&apos;essentiel de ces droits :
          consultation et correction de vos données dans chaque écran, export complet
          au format lisible depuis les paramètres, et suppression de votre compte.
        </p>
        <p>
          Pour toute autre demande, écrivez à{" "}
          <a href="mailto:contact@gleba.fr">contact@gleba.fr</a>. Si vous êtes client
          d&apos;une boutique, adressez-vous au producteur concerné. Vous pouvez
          également introduire une réclamation auprès de la CNIL{" "}
          <a href="https://www.cnil.fr/" target="_blank" rel="noopener noreferrer">
            (cnil.fr)
          </a>
          .
        </p>

        <h2>9. Sécurité</h2>
        <p>
          Les échanges avec l&apos;application sont chiffrés en transit via HTTPS.
          Les mots de passe sont hachés. Les justificatifs comptables, fonds de plan
          et registres archivés sont stockés hors de la racine publique du site et
          servis uniquement après vérification que vous en êtes le propriétaire.
        </p>

        <h2>10. Application Android</h2>
        <p>
          L&apos;application Android est une enveloppe qui affiche le site gleba.fr :
          elle ne collecte rien de plus que ce qui est décrit ci-dessus et ne contient
          aucun kit publicitaire ni outil de mesure tiers. Elle demande deux
          autorisations, toutes deux facultatives : la position, pour vous situer sur
          vos parcelles, et les notifications, pour vous alerter sur vos tâches et
          rappels. Vous pouvez les refuser ou les retirer dans les réglages Android.
        </p>

        <h2>11. Cookies</h2>
        <p>
          Le site utilise des cookies essentiels, toujours actifs, pour la session, le
          panier et la sécurité, et, avec votre consentement, des cookies de mesure
          d&apos;audience, de marketing et de personnalisation. Vous pouvez modifier
          votre choix à tout moment via le bandeau cookies.
        </p>

        <p className="text-xs text-slate-500 mt-12">
          Dernière mise à jour : 2026-07-30 — version 2.0.
        </p>
      </main>
    </div>
  )
}
