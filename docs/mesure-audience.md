# Mesure d’audience des pages publiques

Matomo est désactivé tant que les deux variables publiques suivantes ne sont pas
renseignées dans l’environnement de compilation Next.js :

- `NEXT_PUBLIC_MATOMO_URL` : URL HTTPS de l’installation Matomo, avec son éventuel
  sous-répertoire, sans identifiants, paramètres ni fragment.
- `NEXT_PUBLIC_MATOMO_SITE_ID` : identifiant numérique positif du site.

Ces valeurs sont publiques ; aucune clé d’API ni aucun secret n’est nécessaire.
Les changements nécessitent une nouvelle compilation pour être servis au client.

Le client attend une session explicitement absente et ne mesure que les chemins
publics autorisés. Les pages à jeton et le suivi de commande sont exclus. L’API
HTTP Matomo reçoit une requête POST par page vue, sans cookies (envoi et réception
interdits par `credentials: "omit"`), sans identifiant visiteur, sans titre
personnalisé, paramètres d’URL ou fragment. Seule l’origine d’un référent externe
peut être transmise. Aucun script Matomo, suivi de liens ou battement périodique
n’est chargé. Le refus dans le bandeau ou dans `/confidentialite`, le réglage
« Ne pas me pister » et Global Privacy Control empêchent les appels suivants.
Un refus local n’attend pas la réponse du serveur de consentement.

L’instance Matomo doit être configurée par son administrateur pour raccourcir les
IP avant enregistrement et supprimer les données détaillées après 13 mois,
conformément au texte de confidentialité. Ces réglages serveur ne sont pas
vérifiables par les tests du dépôt. Le déploiement et leur contrôle restent à
faire par Guillaume ; ce lot ne configure aucun service réel.

Référence : [API HTTP de suivi Matomo](https://developer.matomo.org/api-reference/tracking-api).
