# Intégrations Élevage

Contrat OpenAPI lisible par une machine :

- production : `GET https://gleba.fr/api/public/elevage-openapi`
- développement : `GET /api/public/elevage-openapi`

## Authentification

Les routes `/api/elevage/*` sont isolées par exploitation et exigent une session
web Gleba. Le cookie de session ne doit jamais être communiqué à un prestataire.

Pour une intégration serveur, Gleba expose le point d’entrée MCP `/api/mcp`.
Créez un jeton révocable depuis les paramètres API, puis envoyez
`Authorization: Bearer glb_…`. `GET /api/mcp` liste les outils disponibles ;
`POST /api/mcp` exécute `{ "tool": "get_animaux", "args": {},
"section": "elevage" }`. Le service limite chaque jeton à 200 requêtes par
tranche de 15 minutes.

## Imports disponibles

- animaux : JSON via `POST /api/elevage/animaux`, et CSV depuis l’écran
  **Animaux & Lots** ;
- collectes de lait / compteurs : JSON via
  `POST /api/elevage/collectes-lait` ;
- résultats de laboratoire : JSON via `POST /api/elevage/tests-sante` ;
- statuts sanitaires : lecture et mise à jour via
  `/api/elevage/statuts-sanitaires`.

Chaque import doit utiliser l’identifiant interne de l’animal ou du lot et
contrôler les réponses `400`, `401`, `404` et `422`. Une réponse `422` indique
une incohérence métier à corriger ou à confirmer explicitement, jamais une
erreur à ignorer.

## Exports

- inventaire du cheptel : `/api/elevage/inventaire-cheptel` ;
- déclarations réglementaires : export depuis **Registre & pharmacie** ;
- registres PDF/archives : `/api/elevage/registre-sanitaire` et
  `/api/elevage/registre-elevage-complet`.

Le contrat est versionné par la valeur `info.version` du document OpenAPI.
