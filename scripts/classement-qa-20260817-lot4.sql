-- Classement du lot 4 de la campagne QA navigateur du 2026-08-17
-- (18 signalements déposés entre 11:40 et 11:57, soit APRÈS la bascule de
-- 11:20 qui avait soldé le lot 3), plus le signalement de la vigie de 12:30 et
-- les deux tickets d'assistant du 2026-08-18 traités par le lot « fleurs ».
--
-- Correctifs déployés et vérifiés en production le 2026-08-18 (~21:45 UTC).
-- Écrit en SQL et non via l'API admin (qui enverrait un mail au compte démo).

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Vrais défauts, corrigés
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai bug, corrigé. La fiche espèce affichait le code interne de la catégorie (« fruit_legume ») et le proposait tel quel dans sa liste déroulante. Les libellés métier vivent maintenant dans la SSOT du référentiel (ESPECE_CATEGORIE_LABELS + libelleCategorieEspece, à côté de libelleTypeEspece créé le matin même pour le type) : « fruit_legume » se lit « Légume-fruit », « engrais_vert » « Engrais vert », etc. La valeur stockée reste l''identifiant. Le référentiel du verger portait sa propre carte de libellés recopiée en local, dont les valeurs héritées (« fruitier ») : elle est supprimée au profit du helper unique, qui les couvre. Prouvé en prod : Tomate porte bien categorie=fruit_legume en base, et le libellé « Légume-fruit » est présent dans les chunks servis.'
WHERE id = 'cmsx5wjsb000g4wx72hrwkji2' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Constat juste, plus grave que décrit — corrigé. La modale « Corriger l''écriture » envoyait bien la date et la catégorie, mais le PATCH des ventes manuelles les IGNORAIT purement et simplement : le toast annonçait « Écriture corrigée » et rien ne changeait. Le champ `module` (l''imputation), accepté par le schéma zod, était jeté par les deux handlers — donc aucune réimputation possible, alors que c''est ce champ qui décide de la ligne du compte de résultat. Corrigé côté serveur (date, catégorie et module honorés, garde des écritures dérivées inchangée : une ligne auto refuse toujours ces champs) et côté écran : la modale expose désormais l''imputation, le taux de TVA, le mode de règlement, le n° de pièce et le tiers (client ou fournisseur), avec la règle « champ laissé vide = inchangé ». Une erreur de taux ou d''imputation ne demande plus de supprimer puis ressaisir. Prouvé en prod : PATCH module=potager + taux 10 % sur une dépense du compte démo → module et HT/TVA recalculés en base (186,36 / 18,64), puis remise à l''état d''origine.'
WHERE id = 'cmsx5xjhn000k4wx73w3q268y' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Diagnostic faux, défaut réel derrière — corrigé. L''avoir n''est PAS rattaché au mauvais client : AV-2026-0004 pointe la facture 22 (client 67, Épicerie Bio du Bocage) et porte le client 67. Vérifié sur les quatre avoirs du compte démo, la relation et le client concordent. Ce qui était faux, c''est le LIBELLÉ : à la création, le numéro de la facture d''origine est recopié dans le champ `objet`. Or les numéros des deux factures de démonstration ont été ÉCHANGÉS le 2026-08-17 au matin par une reprise de données (fix-qa-20260817.sql) : le texte gelé désignait depuis une facture qui n''était plus la sienne, donc un autre client. Correction : l''API expose la facture d''origine (numéro + client) et l''écran recompose « Avoir sur facture <numéro courant> — motif » à chaque affichage ; l''écart ne peut plus réapparaître. Reprise scripts/fix-objet-avoirs-20260818.sql (dry-run ROLLBACK puis COMMIT) : 4 libellés réalignés, motifs conservés, 0 divergence restante. Règle du brain confirmée : un libellé n''est jamais une clé.'
WHERE id = 'cmsx5zhke000q4wx71ysxunw5' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Constat exact, corrigé. L''onglet qui s''appelle « Rotation » n''affichait que l''état du sol et les conseils de succession : ni la rotation affectée, ni l''année de départ du cycle — celle qui décide de la phase de la planche. Le lot 3 avait rendu l''ancrage lisible dans « Cultures prévues par planches » et renommé le champ sur la fiche, mais pas ici, là où l''utilisateur va chercher l''explication. L''onglet ouvre désormais sur un bloc : rotation affectée, position dans le cycle pour l''année courante (« étape 1/3 »), ITP de l''étape, et départ du cycle — avec l''avertissement en clair quand il manque, plus la consigne pour le renseigner. Le calcul de l''étape est extrait dans un helper unique et testé (src/lib/rotation/etape-cycle.ts, 7 tests) : plus de formule recopiée entre l''écran et le serveur. Prouvé en prod : C1 « étape 1/3 · départ 2026 » contre TEST-MARC-V7 « étape 3/3 · départ non défini », exactement les deux planches du signalement.'
WHERE id = 'cmsx6348h000u4wx7b1a2ng3w' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai bug, corrigé — et il valait plus que l''écart de 9,50 € signalé. Deux défauts distincts. (1) Les interventions culturales n''étaient NULLE PART dans l''écran Transactions : leur miroir comptable (DepenseManuelle auto) est exclu de la liste comme tous les miroirs, mais aucune ligne ne le remplaçait, faute de source « Intervention » dans l''agrégat. L''« Apport compost » de 9,50 € comptait donc dans le KPI et le compte de résultat sans être visible, et le total comptable de l''écran était faux d''autant. La source est ajoutée, avec la même règle « comptable » que le miroir (fait + coût réel). (2) Le compte de résultat rangeait TOUTES les charges manuelles en « Autre » sans lire leur module, d''où « Potager 0,00 € » face à « Maraîchage 3 018,00 € » sur l''écran voisin ; et sur Transactions, les cartes par module ignoraient les valeurs hors des quatre postes (3 690 € imputés à `general` n''étaient dans aucune carte). Un helper unique de ventilation (src/lib/comptabilite/modules.ts, 9 tests) range tout module inconnu en « Autre » : la somme des postes ÉGALE désormais le total, sur les deux écrans. Prouvé en prod : Transactions total comptable 8 778,50 € = somme des cartes (potager 3 029,50 · verger 42 · élevage 1 261 · autre 4 446), et compte de résultat Potager 3 029,50 € pour le même total SSOT 8 778,50 €. L''écart résiduel avec la ventilation analytique (939,95 €) est exactement la valorisation interne des soins, aliments et fertilisations : le bandeau le nomme maintenant au centime au lieu d''en parler en général.'
WHERE id = 'cmsx69cuc00144wx7rveakvfu' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Constat exact, cause différente de celle supposée — corrigé. Le traitement n''a PAS été effacé : la suppression de l''arbre l''a bien matérialisé en intervention détachée (id 85, produit « Produit QA Hélène v7c », AMM-QA-V7C, dose, DAR et ZNT intacts, notes « [Arbre supprimé : QA Hélène v7c Jonagold (Pommier)] »), conformément au correctif du matin, et il figure dans /tracabilite. Le défaut est que le registre phyto du VERGER, l''écran même qui venait de promettre la conservation, écartait toute intervention sans `arbreId` — donc précisément celles qu''on venait de détacher. Son compteur retombait de 5 à 4 et la trace semblait perdue. Le registre garde désormais ces traces, identifiées par le snapshot du nom de l''arbre (« … (supprimé) »), et le lien snapshot est écrit et relu par un helper unique et testé (4 tests). Prouvé en prod : l''API rend l''intervention 85 détachée avec sa note de snapshot, et une trace plus ancienne (id 71) réapparaît au registre.'
WHERE id = 'cmsx6acih00164wx7b6sclnkt' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai bug, corrigé — perte de données silencieuse, la plus sérieuse du lot. Le plan 2D n''a pas de bouton « Enregistrer » : il se sauvegarde 1 s après le dernier changement. Or toute modification survenue PENDANT une sauvegarde en vol était perdue : l''effet sortait sans réarmer de minuteur quand `saving` était vrai, `saving` n''était pas dans ses dépendances (sa retombée ne relançait donc rien), et la sauvegarde qui se terminait remettait `hasChanges` à false, effaçant le témoin des changements qu''elle n''avait pas écrits. Un déplacement long — donc coupé par une sauvegarde intermédiaire — perdait son dernier segment, ce qui donne exactement le « lâché à 8 m, relu à 6 m » du signalement, et le recul de 1 m du premier essai. Corrigé : un compteur de version avance à chaque modification (helper `marquerChangement`, substitué aux 43 appels directs), la sauvegarde ne se déclare propre que si la version n''a pas bougé, et `saving` est en dépendance pour réarmer dès la fin de l''écriture. Aucune modification n''est plus abandonnée sans témoin.'
WHERE id = 'cmsx6ak1500184wx72cfysp2i' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai bug, corrigé — et régression du durcissement de la veille. Leaflet émet `baselayerchange` sur tout ajout de couche, y compris programmatique : pour empêcher un événement de montage de réécrire « OpenStreetMap » par-dessus le choix persisté (QA cmswtxnnb), on n''enregistrait le fond que si un `pointerdown` venait d''avoir lieu sur la carte. Ce filet était trop étroit : le contrôle Calques est fait de vrais boutons radio, et les choisir au CLAVIER (Tab puis flèches/Espace) n''émet aucun pointerdown — le choix ne survivait donc pas au rechargement, pour un utilisateur au clavier comme pour un outil qui clique par script. L''interaction est désormais reconnue sur pointerdown, clic, changement de champ et touche clavier ; un événement de (re)montage, qui n''émet aucun de ces événements DOM, reste ignoré. La protection d''origine est conservée.'
WHERE id = 'cmsx6dvhu001a4wx73upgylug' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Constat exact, corrigé. Sur un écran de 375 px, les deux pastilles flottantes (Feedback en bas à gauche, Assistant IA en bas à droite, 48 px chacune) couvrent la bande basse : tout champ pleine largeur qui s''y trouve est amputé de ses extrémités, et le dégagement `pb-24` déjà en place ne protège que le dernier élément de la page. Les deux bulles s''effacent maintenant le temps de la frappe, uniquement sous 640 px, et reviennent dès que le champ perd le focus (hook partagé `useSaisieEnCours`) : aucun décalage du contenu, et la classe entière du problème est traitée, pas seulement le champ « N° pièce justificative ».'
WHERE id = 'cmsx6epia001d4wx7houzetkm' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai défaut, corrigé : « Soins a planifier » et « soin(s) prevu(s) » sont accentués, ainsi que « aliment(s) à réapprovisionner » de la carte voisine, trouvée au passage dans le même bloc.'
WHERE id = 'cmsx6fiof001f4wx7xlb4du6e' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Constat exact, cause ailleurs que dans le tableau — corrigé. Le tableau des lignes de facturation a bien son conteneur défilant : s''il apparaissait « à -145 px », c''est que la PAGE entière était décalée. Le débordement de 618 px vient de la barre d''onglets (quatre onglets en `inline-flex`, sans repli), qui force le document au-delà des 375 px et fait défiler tout l''écran horizontalement. Les onglets passent à la ligne sur mobile, ici et sur l''écran Rapports qui porte le même défaut avec cinq onglets. La saisie d''une facture à deux taux reste dense sur mobile, mais plus rien n''est hors d''atteinte.'
WHERE id = 'cmsx6g3gq001h4wx7vw6v95cd' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai bug, corrigé. Les quatre raccourcis du dashboard (« + Soin », « + Naissance », « Rechercher (boucle) », « Registres ») sont des liens vers la page COURANTE avec une query différente : en build de production et après un chargement à froid, cette navigation est dédupliquée par l''App Router et le clic ne faisait rien — exactement le piège déjà rencontré sur la barre d''onglets (cmsnoo8mc) et sur le verger (cmsbu12hb). Les quatre passent par l''API History intégrée au routeur, via une liste unique qui interdit au href affiché et à l''URL poussée de divergir ; le href reste, pour l''ouverture dans un nouvel onglet, le clic milieu et l''accessibilité. Le signalement ne portait que « + Soin » : les trois autres étaient muets de la même façon.'
WHERE id = 'cmsx6hqel001k4wx7ztxcffab' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Constat exact à l''écran, donnée pourtant présente — corrigé. Pommier vaut 3 et Figuier 2 en base (les 40 arbres fruitiers du référentiel ont tous un besoin en eau). La valeur n''existait QUE sous forme de cinq barres colorées, sans un seul caractère : illisible pour un lecteur d''écran, pour une recherche de texte dans la page, pour un export — et pour un contrôle qui lit le DOM, d''où « le champ reste vide ». Les barres restent, la valeur est désormais écrite à côté (« 3/5 ») avec une infobulle explicite, dans la colonne comme dans la fiche.'
WHERE id = 'cmsx6iwru001n4wx7y6oaw8wl' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai défaut, corrigé (signalement de la vigie). L''email de vérification partait en « fire and forget » : un refus définitif du serveur SMTP — ici « 550 invalid DNS MX » sur un domaine de destinataire inexistant — n''était que journalisé, et l''écran affichait quand même « Vérifiez votre email ». Le nouvel inscrit attendait un message qui ne partirait jamais, sans savoir que son adresse était en cause ni qu''un renvoi existait. L''envoi est désormais attendu (borné à 8 s pour ne pas suspendre l''inscription), l''échec est qualifié — adresse refusée par le serveur de messagerie, ou panne d''acheminement — et l''écran le dit avec la consigne correspondante : corriger l''adresse, ou relancer. Le bouton « Renvoyer l''email » ne mange plus ses erreurs et confirme le succès. Le compte reste créé, comme avant. Même verdict partagé par les deux routes (inscription et renvoi) via un module unique. Prouvé en prod sur un compte de vérification jetable : POST /api/auth/register → 201 « emailEnvoye: false, emailEchec: adresse_refusee », renvoi → 502 avec le message d''adresse refusée ; compte supprimé après contrôle.'
WHERE id = 'vigie1919cd842ef9f37a217a7c76' AND status = 'OPEN';

-- ─────────────────────────────────────────────────────────────────────────────
-- Constats infirmés par les données, avec le défaut réel trouvé à côté
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Diagnostic infirmé, défaut voisin corrigé. Le client « CLIENT TEST AUDIT-SOPHIE 1708B » a été créé ACTIF : `actif = true` en base, jamais modifié depuis (created_at = updated_at), et il est bien rendu par la liste normale (contrôle en production : 20 clients actifs, la fiche en fait partie). Le POST n''a aucun chemin qui crée un client inactif — le schéma pose `actif: true` par défaut et le formulaire n''envoie pas ce champ. En revanche les cartes de tête mélangeaient deux périmètres : « Total clients » comptait la liste FILTRÉE tandis que la ventilation par type comptait toujours les seuls actifs, quelle que soit la case « Afficher inactifs » — soit un total de 23 face à 20 répartis, sans rien qui l''explique, ce qui suffit à faire croire qu''une fiche a disparu. Les quatre cartes décrivent désormais la même population que le tableau, la carte se nomme selon le filtre actif et le nombre d''inactifs est affiché à part. Prouvé en prod : total 20 = somme des types (13 particuliers + 7 professionnels).'
WHERE id = 'cmsx64vcw000w4wx7075wmvcc' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Cause non reproduite côté application, transparence ajoutée. L''ITP « MARC-V7-Radis-automne-2026 » est bien en base avec ses semaines et sa durée, espèce NULL. Or le serveur REFUSE une espèce inconnue par un 400 explicite : un ITP créé sans espèce signifie donc toujours qu''aucun choix n''est parvenu au serveur, et non qu''il a été perdu en route. Le filet posé le matin même (le Select porte un `name`, le DOM soumis fait foi quand l''état React est vide) est en place et a été prouvé en production à 11:20 ; la sélection par la souris comme par le clavier alimente bien l''état. Ce qui manquait, c''est que l''écran le DISE : la création annonce désormais l''espèce retenue, ou son absence avec sa conséquence (« l''ITP ne sera pas proposé à la création d''une culture »), là où l''utilisateur peut encore agir, au lieu d''un « créé avec succès » identique dans les deux cas. À revérifier au clavier si le cas se reproduit.'
WHERE id = 'cmsx5zgno000o4wx7px41ltro' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Cause non reproduite, fragilité réelle corrigée. Le bouton « Plantation » de l''en-tête du verger n''est pas un lien : il ouvre l''assistant de plantation, et aucun chemin du code ne mène de là à /comptabilite. Le même signalement avait déjà été déposé puis RETIRÉ par le contrôle du matin après recontrôle. Une fragilité explique toutefois qu''un clic sur cette zone puisse atteindre un lien de l''en-tête : la barre d''onglets des modules se collait sous le header avec un décalage codé en dur (61 px), qui suppose un header d''une seule ligne. Le conteneur du header est en `flex-wrap` : dès qu''il passe sur deux lignes (largeur intermédiaire, zoom, police agrandie), il RECOUVRE la barre d''onglets — et comme il est au-dessus dans l''empilement, il intercepte les clics destinés à ses actions au profit de ses propres liens de module, dont « Comptabilité ». Le header publie désormais sa hauteur réelle (mesurée, ResizeObserver) et la barre s''y accroche : le recouvrement n''est plus possible.'
WHERE id = 'cmsx5x1z2000i4wx7nzti69kg' AND status = 'OPEN';

-- ─────────────────────────────────────────────────────────────────────────────
-- Faux positif prouvé : la fonction marche, y compris dans la même session
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE bug_reports SET status = 'HORS_PERIMETRE', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Faux positif prouvé par les données, aucun correctif. La date de rappel n''est jamais arrivée au serveur : le soin 116 (Nobivac Rage sur « Bocage Reload A3 1708 », 11:47) porte `date_prevue` NULL, donc rien à matérialiser. La fonction, elle, marche — et l''a fait dans LA MÊME session de contrôle : à 05:59, le soin 110 (Cobactan LC) a produit son rappel 111, daté du 24/08, fait=false, exactement le comportement attendu ; les paires 104/105 et 106/107 du 12/08 le confirment. Le formulaire porte deux filets pour ce champ depuis le lot du matin (`name` + FormData qui prime sur l''état React, et capture au `blur`), et le schéma accepte le format « AAAA-MM-JJ ». Reste le mode d''échec connu d''un champ contrôlé : une valeur posée dans le DOM sans émettre d''événement est effacée par le premier rendu React suivant, et aucun filet de soumission ne peut la retrouver — c''est ce qui distingue les tentatives de 07:31, 07:33, 07:40 et 11:47 (toutes sans date) de celle de 05:59 (avec rappel). À revérifier en saisissant la date au clavier ou par le calendrier.'
WHERE id = 'cmsx67b6s000z4wx7igu8nr8o' AND status = 'OPEN';

-- ─────────────────────────────────────────────────────────────────────────────
-- Tickets d'assistant du 2026-08-18 : livrés par le lot « fleurs » de 13:58
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Livré le 2026-08-18 à 13:58. Le type « fleur » existe au référentiel des espèces, avec sa SSOT de types de maraîchage branchée sur les filtres et les stocks, et un catalogue de 10 familles / 23 espèces de fleurs coupées portant chacune un ITP. La demande d''import d''ITP depuis internet n''en était que le symptôme : le catalogue floral manquait, d''où le besoin d''aller chercher des itinéraires ailleurs. L''import automatique depuis le web reste hors périmètre de l''assistant.'
WHERE id = 'cmsyo7mcp002hu9byzc2dx9qi' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Livré le 2026-08-18 à 13:58 : le type/catégorie « fleur » est au référentiel, une espèce florale se crée, se filtre et apparaît aux stocks comme les autres. La liste des types reste fermée — elle décide de l''écran qui liste l''espèce, de l''unité de rendement et de la présence aux stocks — mais l''écran de création explique désormais ce que chaque type implique, au lieu de refuser en silence.'
WHERE id = 'cmsyojc6f002pu9byg8pmwx8o' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Traité par le lot « fleurs » du 2026-08-18 (13:58) : type « fleur » ajouté au référentiel, contrainte SQL et énumération zod basculées ensemble, 23 espèces de fleurs coupées versées avec ITP.'
WHERE id = 'vigie7db3c0d0130c0a4310e33faa' AND status IN ('OPEN', 'IN_PROGRESS');

-- Journal de statut
INSERT INTO bug_status_logs (id, bug_report_id, from_status, to_status, note, changed_at)
SELECT gen_random_uuid()::text, id, 'OPEN', status,
       'Campagne QA navigateur du 2026-08-17 (lot 4, tickets 11:40-11:57) + vigie 12:30 + tickets assistant du 18/08 : classement après correctifs déployés et vérifiés en production le 2026-08-18.',
       NOW()
FROM bug_reports
WHERE id IN (
  'cmsx5wjsb000g4wx72hrwkji2','cmsx5x1z2000i4wx7nzti69kg','cmsx5xjhn000k4wx73w3q268y',
  'cmsx5zgno000o4wx7px41ltro','cmsx5zhke000q4wx71ysxunw5','cmsx6348h000u4wx7b1a2ng3w',
  'cmsx64vcw000w4wx7075wmvcc','cmsx67b6s000z4wx7igu8nr8o','cmsx69cuc00144wx7rveakvfu',
  'cmsx6acih00164wx7b6sclnkt','cmsx6ak1500184wx72cfysp2i','cmsx6dvhu001a4wx73upgylug',
  'cmsx6epia001d4wx7houzetkm','cmsx6fiof001f4wx7xlb4du6e','cmsx6g3gq001h4wx7vw6v95cd',
  'cmsx6hqel001k4wx7ztxcffab','cmsx6iwru001n4wx7y6oaw8wl','vigie1919cd842ef9f37a217a7c76',
  'cmsyo7mcp002hu9byzc2dx9qi','cmsyojc6f002pu9byg8pmwx8o','vigie7db3c0d0130c0a4310e33faa'
);

-- Contrôles avant COMMIT
SELECT status, count(*) FROM bug_reports GROUP BY status ORDER BY 2 DESC;
SELECT count(*) AS restants_open_ou_encours FROM bug_reports WHERE status IN ('OPEN','IN_PROGRESS');
SELECT count(*) AS notes_vides FROM bug_reports
  WHERE created_at > '2026-08-17 11:39:00' AND (admin_note IS NULL OR admin_note = '');

COMMIT;
