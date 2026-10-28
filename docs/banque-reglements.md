# Banque et règlements

Dans **Comptabilité → Banque**, le propriétaire peut connecter son compte
Stripe, ajouter un compte de relevés et rapprocher les mouvements avec les
factures, ventes et dépenses. Les versements restent consultables depuis
**Règlements** dans les factures, les transactions et les ventes d’élevage.

## Connexion Stripe

Une clé restreinte `rk_live_…` ou `rk_test_…` suffit : le propriétaire la saisit
dans **Connecter avec une clé restreinte**. Autoriser uniquement les lectures
du compte (`GET /v1/account`), du solde (`GET /v1/balance`) et des opérations de
solde (`GET /v1/balance_transactions`, liste et détail). Gleba vérifie ces accès
avant d’enregistrer la connexion. Les libellés de permissions disponibles sont
décrits dans la [documentation des clés Stripe](https://docs.stripe.com/keys).

Les clés de test produisent des comptes identifiés comme tests. Leurs opérations
ne peuvent régler aucune pièce réelle. Une même identité Stripe et un même mode
ne peuvent appartenir à deux exploitations.

L’alternative **Stripe Connect Standard** apparaît lorsque le serveur définit
`STRIPE_CONNECT_CLIENT_ID` et `STRIPE_SECRET_KEY`. Dans Stripe, déclarer le retour
HTTPS `<NEXTAUTH_URL>/api/comptabilite/banque/stripe/retour`. Le protocole OAuth
Standard demande `read_write` ; Gleba utilise uniquement les lectures de compte,
solde et opérations. Pour un accès strictement limité à la lecture, utiliser une
clé restreinte. Voir la [référence OAuth Stripe](https://docs.stripe.com/connect/oauth-reference).

Les accès sont chiffrés en AES-256-GCM. `STRIPE_TOKEN_ENCRYPTION_KEY` doit rester
stable et contenir au moins 32 caractères ; à défaut, Gleba utilise `AUTH_SECRET`
ou `NEXTAUTH_SECRET`. Ne placer ces valeurs que dans la configuration privée du
serveur. Une rotation de cette clé impose de reconnecter Stripe. Les exports
de compte conservent les opérations et règlements, désactivent la connexion et
retirent son jeton. Aucun jeton n’est renvoyé au navigateur après enregistrement.

Les opérations sont importées par lots d’au plus 500, avec des curseurs persistés
pour l’historique et les nouveaux mouvements. Une interruption se reprend sans
doublon. Les fonds en attente sont actualisés séparément. La synchronisation
planifiée traite une connexion à la fois, vise un intervalle de 15 minutes et
continue les historiques incomplets. `STRIPE_SYNC_ENABLED=false` désactive cette
planification ; le bouton **Synchroniser** reste disponible. Un bail en base
empêche deux synchronisations simultanées du même compte. L’import n’enregistre
aucune vente, dépense ou règlement à lui seul.

Stripe expose les encaissements, frais et virements qui passent par Stripe.
Il ne fournit pas le relevé complet d’une banque française : [Financial
Connections concerne les comptes bancaires américains](https://docs.stripe.com/financial-connections).
Les autres mouvements se suivent par import CSV.

## Relevés et rapprochement

Créer un **Compte de relevés**, le sélectionner puis importer un CSV UTF-8
(maximum 1 Mo et 5 000 lignes). Séparateurs acceptés : point-virgule, virgule,
tabulation. Exemple fictif :

```csv
Date;Libellé;Montant;Référence
27/10/2026;Virement client;150,00;BANQUE-0001
28/10/2026;Facture fournisseur;-50,00;BANQUE-0002
```

Les colonnes **Débit** et **Crédit** peuvent remplacer **Montant**. Les références
bancaires permettent un réimport sans doublon. Sans référence, Gleba identifie
une ligne par sa date, son libellé, son montant et son rang parmi les lignes
identiques : vérifier les doublons possibles entre relevés qui se recouvrent.
Une même référence avec un contenu différent fait refuser l’import entier.

Le rapprochement permet soit de relier un règlement déjà saisi, soit d’en créer
un sur la pièce choisie. Un mouvement peut être réparti entre plusieurs pièces.
Le montant, le sens, la devise et le reste disponible sont vérifiés dans une
transaction. Le brut Stripe et les frais ont deux budgets distincts. Les frais
se rapprochent d’une dépense comptable préalablement saisie, avec sa TVA réelle.

**Virement entre comptes** relie le débit Stripe et le crédit bancaire
correspondant, ou deux mouvements de comptes de relevés. Le montant et la devise
doivent correspondre. Ce virement ne crée ni chiffre d’affaires ni charge.
**Défaire le rapprochement** permet de corriger le choix de la contrepartie :
les deux mouvements redeviennent disponibles, sans supprimer de versement.
La recherche des règlements et contreparties propose les résultats par pages ;
changer la recherche efface la sélection précédente.

Les opérations hors rapprochement commercial peuvent être exclues avec un
motif puis rétablies ; l’historique bancaire reste conservé. Si Stripe révise
un mouvement déjà importé, Gleba le signale à vérifier. La confirmation est
refusée lorsque les règlements ou le virement liés dépassent le montant révisé
ou ne correspondent plus à son sens et sa devise.

## Règlements partiels et comptabilité

Chaque règlement indique son montant, sa date réelle, son mode et sa référence.
Le reste à payer correspond au montant de la pièce, diminué des avoirs émis et
des versements actifs. Un remboursement réellement effectué se saisit sur la
pièce d’origine. Une erreur de saisie s’annule avec un motif : sa trace est
conservée, sans effectuer de remboursement bancaire.

Les anciens statuts payés restent inchangés. Leur journal n’est initialisé que
par une saisie explicite, sans inventer de date ni de mode. En cas d’avoir sur
une pièce historiquement payée, cocher la régularisation historique pour
détailler le montant initial reçu puis le remboursement éventuel.

Une vente automatiquement recopiée en comptabilité conserve son journal lorsque
son miroir est régénéré. Si une facture la remplace, le même journal est rattaché
à cette facture. Une pièce suivie ne peut être supprimée en effaçant sa trace.
Les acomptes de réservation d’élevage restent gérés dans leur réservation.

Le chiffre d’affaires et la TVA restent portés par la vente ou la facture.
Au FEC, un versement détaillé solde le compte client 411 ou fournisseur 401 avec
la banque 512, la caisse 531 ou les encaissements Stripe 5115. Les virements
internes passent par 580, et une annulation de saisie produit une extourne à la
date de correction. Les impayés et créances/dettes utilisent le reste à payer,
y compris à la clôture de l’exercice consulté. Les soldes disponibles Stripe
affichés dans Banque ne constituent pas un bilan bancaire complet : ils
n’initialisent pas les soldes d’ouverture des comptes de relevés.

La devise d’une facture reste celle figée lors de son émission. Le FEC refuse
les versements et mouvements dans une autre devise que celle de l’exploitation,
ainsi que les mouvements signalés à vérifier : Gleba ne les convertit pas
silencieusement et n’invente aucun taux de change.
