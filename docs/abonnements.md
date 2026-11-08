# Abonnements du service hébergé

Le socle AGPL reste gratuit et auto-hébergeable. La facturation SaaS est
désactivée par défaut (`GLEBA_ABONNEMENTS_ACTIFS=false`). Les préférences de
menus organisent l'affichage ; elles n'accordent aucun droit commercial.

## Catalogue et comptes existants

- Trois mois calendaires gratuits, sans carte, dès la première connexion.
  Aucun passage automatique au payant. Un nouvel essai ne peut pas être obtenu
  en se reconnectant, en important un compte ou en vidant ses données métier.
- Essentiel : 5 € HT/mois/exploitation, un atelier (`maraichage`, `verger` ou
  `elevage`), sans IA/MCP, météo/conseil météo d'irrigation, boutique ni
  comptabilité/facturation. Le référentiel botanique et les outils communs du
  terrain restent utilisables. Les stocks respectent l'atelier choisi.
- Complet : 12 € HT/mois/exploitation, tous les modules existants.
- Les comptes créés avant ou à `2026-11-08T20:32:07.000Z` gardent Complet
  gratuitement à vie. Cette borne est fixée dans le catalogue et la migration ;
  ne pas la remplacer par la date de déploiement. Le droit survit à la fin
  d'essai, à la résiliation et à la suppression des données métier.

Les droits sont ceux de l'exploitation visitée. Seul son propriétaire peut
souscrire, programmer un changement ou résilier ; une consultation admin ne
peut pas le faire. Après expiration, les données restent lisibles et
exportables. Un retour à Essentiel conserve l'historique et les exports des
autres ateliers. Les anciennes factures sont récupérables. Les liens de suivi
des commandes déjà passées restent accessibles à leurs destinataires.

## Configuration Stripe dédiée

Les variables `GLEBA_STRIPE_*` concernent **l'abonnement à Gleba**, jamais la
connexion bancaire Stripe des producteurs. Aucune clé dans Git, ni dans un
export de compte. Renseigner l'environnement privé via l'exploitation habituelle.

1. Créer deux prix EUR récurrents mensuels, quantité 1, respectivement 500 et
   1 200 centimes, `tax_behavior=exclusive`. Renseigner
   `GLEBA_STRIPE_PRICE_ESSENTIEL` et `GLEBA_STRIPE_PRICE_COMPLET`.
2. Configurer `GLEBA_STRIPE_SECRET_KEY`, `GLEBA_PUBLIC_URL` et le régime fiscal
   validé du vendeur : `GLEBA_STRIPE_TAX_MODE=automatic`, ou un taux existant
   `GLEBA_STRIPE_TAX_RATE`, ou `exempt` si ce régime s'applique réellement.
   Renseigner dans Stripe les informations du vendeur, l'URL des conditions et
   les mentions des justificatifs. Valider les conditions du service publié.
3. Créer une configuration de portail autorisant factures et moyen de paiement,
   avec **changement de souscription et résiliation désactivés** : ces commandes
   passent par Gleba pour préserver atelier, date d'effet et consentement.
   Renseigner `GLEBA_STRIPE_PORTAL_CONFIGURATION`.
4. Configurer un webhook `/api/abonnement/webhook`, version
   `2026-10-28.endive`, avec `GLEBA_STRIPE_WEBHOOK_SECRET`. Événements :
   `customer.subscription.created/updated/deleted`, `invoice.paid`,
   `invoice.payment_failed`, `invoice.payment_action_required`,
   `checkout.session.completed/expired`.
5. Tester avec les clés **test** avant activation réelle. Les clés live exigent
   aussi `GLEBA_STRIPE_COMMERCE_VALIDE=true`, après validation des informations
   commerciales et fiscales. L'essai actif ne peut pas être raccourci par un
   paiement anticipé. Il n'existe ni annuel ni promotion implicite.

Checkout collecte l'adresse, l'identification fiscale et l'accord ; la carte
reste chez Stripe. Les prix sont relus côté serveur. Le retour du navigateur
ne donne aucun droit : seul le contrat relu et une facture acquittée donnent
une nouvelle période. Un paiement en attente conserve la période antérieure ;
la grâce d'un renouvellement impayé dure sept jours après cette période.

## Renouvellement et incidents

Le changement de formule **ou d'atelier** est programmé au prochain
renouvellement via un schedule sans prorata. Une modification préparée est
persistée avant les appels distants, puis peut être annulée ; les commandes et
webhooks sont sérialisés par verrou PostgreSQL. La résiliation arrête le
renouvellement, en gardant la période payée. Les justificatifs restent dans le
portail après expiration. Une suppression de compte ferme les sessions de
paiement ouvertes et confirme l'arrêt des contrats avant le cascade ; si
Stripe n'a pas confirmé, le compte n'est pas supprimé.

Les événements signés sont persistés sans corps ni carte. Ils sont rejouables,
indépendamment de leur ordre d'arrivée. Le cron réessaie dix événements et
réconcilie vingt-cinq contrats toutes les quinze minutes. Les événements
toujours en erreur après vingt tentatives requièrent une vérification de
configuration, puis la remise à zéro de leur compteur pour rejouer. Une erreur
de réconciliation n'accorde aucun nouvel accès. Les remboursements et litiges
restent à traiter dans Stripe ; ils ne valent pas à eux seuls résiliation.

## Validation et livraison

Les tests unitaires couvrent frontière historique, mois calendaires, droits,
requêtes directes, rôles, consentement, signature/rejeu et preuve de paiement.
`scripts/qa/essai-abonnements.ts` refuse toute URL hors de la base jetable
`127.0.0.1:55433/gleba_abonnements_qa` et vérifie les droits réels sous PostgreSQL.
Pour vérifier le backfill, appliquer d'abord les migrations précédentes,
insérer deux utilisateurs synthétiques à la borne et à +1 ms, puis appliquer
la nouvelle migration. Aucun compte de production n'est nécessaire.

La zone privée IA/boutique doit accompagner le lot via une archive hors du
Git public ; ses gardes serveur sont indispensables. Appliquer les migrations
additives avant d'activer le drapeau. Aligner le manifeste effectivement servi
par l'hôte sur `public/manifest.json`. La livraison passe par PR et contrôles ;
la fusion et le déploiement relèvent du processus habituel du projet.
