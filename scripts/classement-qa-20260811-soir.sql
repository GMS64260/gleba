-- Classification des 59 tickets QA du 2026-08-11 (campagne du soir).
-- Écrit en SQL (jamais via l'API admin : elle enverrait un mail au compte démo).
-- À exécuter APRÈS vérification post-bascule. 50 RESOLVED, 9 EVOLUTION_PRODUIT.

BEGIN;

-- ── Assistant IA (8 tickets du matin, refonte déployée à midi + lot du soir) ──
UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Refonte assistant (outil get_stocks_valorises 11 catégories) + réponse directe stock élargie à « stock de la ferme » (<1 s). Vérifié en prod.'
WHERE id IN ('cmsoannji00144n8kpr6scsg5','cmsobf8ni00294n8kxs7pmt7f') AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Refonte assistant : get_marges_ateliers (marge = revenus − coûts, mêmes chiffres que Coûts de production) prouvé en prod ; détecteur direct élargi à « atelier le plus rentable » (<1 s).'
WHERE id IN ('cmsoao13s00164n8krupljns8','cmsob8noa00254n8knil0mh1d') AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='get_registre_phyto réaligné sur l''écran traçabilité : 8 traitements, fiche complète (AMM, DAR, ZNT), plus de ligne inventée. Prouvé en prod.'
WHERE id='cmsoavl1j001e4n8k7qgl359u' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='get_observations_sante : dernière observation exacte (arbre, diagnostic, gravité) prouvée en prod avec la récolte totale.'
WHERE id='cmsob06lc001t4n8kx17ktbgw' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Réponses directes sans LLM : CA et retards en 0,1 s prouvés en prod ; rentabilité et stock interceptés aussi depuis le lot du soir.'
WHERE id='cmsobfyh4002b4n8kbwoorl9j' AND status='OPEN';

UPDATE bug_reports SET status='EVOLUTION_PRODUIT', updated_at=now(),
  admin_note='Contenu désormais exact (dernière récolte + total). La latence restante (~60 s) est structurelle (réveils Paperclip) : cluster latence, phase 3 de la refonte. Les questions stock simples passent en réponse directe <1 s.'
WHERE id='cmsoaw05z001g4n8kmts65l7s' AND status='OPEN';

-- ── Élevage production ──
UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Champs Notes + Lieu ajoutés au dialog « Modifier l''abattage » et note affichée dans la table (elle était bien persistée).'
WHERE id='cmsog52qx002c2yevlp4a1vl6' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Sélecteur d''animal (combobox cheptel actif) ajouté au formulaire de vente pour le type « Animal vivant » ; animalId envoyé à l''API.'
WHERE id='cmsog7lrc002k2yevutja1d9x' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Le sélecteur Lactation filtre désormais comme la Collecte (femelles d''espèces laitières uniquement).'
WHERE id='cmsog9reb002s2yeva4klocpx' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Économie : les animaux nominatifs rattachés à un lot ne sont plus comptés deux fois (4/98 au lieu de 8/102).'
WHERE id='cmsoga3zp002u2yevx0ilsdup' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Données de démo : les 3 ventes de fromage du seed n''avaient pas leur sortie de cave. Mouvements créés (160,34 kg sortis), seed corrigé, et l''API refuse désormais une vente liée à un lot de fromage d''un autre type.'
WHERE id='cmsoge7t900362yevxprflyko' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Donnée du référentiel corrigée : chèvre laitière reclassée grand mammifère (ligne héritée, le seed en conflit ne mettait pas à jour).'
WHERE id='cmsoff8j2001r2yev481e3bcq' AND status='OPEN';

UPDATE bug_reports SET status='EVOLUTION_PRODUIT', updated_at=now(),
  admin_note='Le stock boutique est déclaratif (saisi à la main), sans lien avec le stock d''œufs de l''atelier : lier les deux est une décision produit. La donnée démo a été alignée (8 boîtes).'
WHERE id='cmsog7jf6002i2yev2v677w9u' AND status='OPEN';

-- ── Soins / délais vétérinaires ──
UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Le stock d''œufs applique désormais le délai d''attente vétérinaire (statut « Délai véto » exclu des commercialisables, vente refusée avec date de remise en vente) — écran, ventilation des ventes et assistant.'
WHERE id='cmsoeyhs5000r2yevouznm65c' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='La fiche d''un animal affiche désormais les soins de son LOT (délai d''attente et historique) — l''écartement du lait les voyait déjà, pas la fiche.'
WHERE id='cmsoglwee003p2yev965t4a2t' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Non reproduit côté serveur (la date n''a jamais quitté le navigateur QA — champ date rempli sans onChange). En complément, un « Rappel planifié » sur un soin déjà effectué crée maintenant un vrai soin à faire, visible au calendrier.'
WHERE id='cmsof7ccx001h2yevsm9d8c2x' AND status='OPEN';

-- ── Élevage CRUD ──
UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Rejet volontaire de l''API : une filiation absurde (Oslo « fils » de Nala, posée le 07/08) créait un cycle. Donnée nettoyée ; les combobox excluent désormais les descendants et l''API vérifie la vraisemblance des dates parent/enfant.'
WHERE id='cmsoevxrj000k2yev6tz2e79p' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Non reproduit côté serveur (payload vide envoyé par l''agent QA). Robustesse ajoutée : relecture FormData des champs date au submit (dateNaissance/dateArrivee), même motif que le champ identifiant.'
WHERE id='cmsogkqpf003l2yevwkjfnxtk' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Double correctif : la note du dialog de décès est désormais transmise (elle était perdue), et la fiche affiche un événement « Décès » (date + cause) dans la timeline.'
WHERE id='cmsoggk23003c2yev25p95f9n' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Les identifiants du seed démo (FR85001) étaient invalides pour la validation FR+11 chiffres, ce qui bloquait toute édition. Données réparées (FR85000000001…), seed corrigé, et un identifiant préexistant inchangé ne bloque plus la soumission.'
WHERE id='cmsoexauc000p2yevy72ktgqv' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Non reproductible : données et code sains (l''espèce Ruche est sélectionnable, item Radix identique aux autres). Artefact d''automatisation probable (item 59/67, hors viewport sans scroll).'
WHERE id='cmsof2nnp00152yevpxuoj9at' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='L''effectif calculé d''un lot est désormais planchonné par ses animaux nominatifs actifs : l''affectation d''une 5e fiche affiche 5, plus « 4 effectif / 5 nominatifs ».'
WHERE id='cmsogdr7i00342yevrqa6f1ho' AND status='OPEN';

-- ── Verger plantations / arbres / calendrier ──
UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Le nombre de plants est recalculé à chaque changement de densité ou de surface (clic essence inclus) tant qu''il n''a pas été saisi à la main.'
WHERE id='cmsog29er00232yev67t7yjjo' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Le suivi de reprise est refusé (400) tant que la plantation n''est pas réalisée ; formulaire désactivé avec bannière explicative.'
WHERE id='cmsog4sbz002a2yevclpu0cbn' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Cocher l''étape Plantation renseigne la date de plantation réelle et avance le statut de la campagne ; la décocher annule proprement.'
WHERE id='cmsog61e5002e2yevi21789g1' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Les profils d''entretien de production (fruitier…) ne s''appliquent plus aux arbres forestiers/ornement/haie ; le badge de la frise reflète le type de l''arbre.'
WHERE id='cmsofzh0w001y2yevoko2ef7x' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='La répartition par espèce inclut désormais les arbres sans espèce sous « Non renseigné » (18/18).'
WHERE id='cmsofze9p001w2yev3xeyhefx' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Le calendrier verger place les opérations réalisées à leur date de réalisation (et non plus à la date prévue).'
WHERE id='cmsogc0z3002z2yev6cbxzxpn' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='La date d''achat est relue par FormData au submit (name="dateAchat"), même contournement que la date de plantation : plus de perte quand le navigateur remplit le champ sans onChange.'
WHERE id='cmsoeu32c000g2yevqsnlhyej' AND status='OPEN';

-- ── Verger santé / phyto / pollinisation ──
UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='La colonne Cible du registre verger affiche la cible du traitement (cibleTraitement était persisté mais jamais mappé).'
WHERE id='cmsof2b3300132yevfqlj1c48' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='À la suppression d''un arbre, ses traitements phyto (interventions) sont conservés pour la traçabilité : nom de l''arbre snapshoté dans les notes, rattachement détaché. Plus d''orphelin « Arbre #587 ».'
WHERE id='cmsofhlzg001u2yevgpxr0i0c' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Pas de double comptage (deux traitements distincts), mais l''analyse a révélé et corrigé 2 bugs réels du compteur cuivre : arrondi par ligne qui classait « sans dose » un traitement dosé, et opérations d''arbres absentes de l''agrégation.'
WHERE id='cmsogea5w00382yev574kowt1' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Le registre phytosanitaire global agrège désormais les traitements saisis en opérations d''arbres (la ligne Bouillie bordelaise remonte) — même source que l''écran verger et l''assistant.'
WHERE id='cmsoghh2b003g2yevh7mw4wcw' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Un pollinisateur triploïde (pollen stérile) ou de même variété (clone) est refusé par l''API (422) et signalé incompatible côté écran.'
WHERE id='cmsoeyth0000t2yevqwxvzy30' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='L''année du verger est persistée (clé gleba_verger_year, même motif que la comptabilité, avec garde d''hydratation).'
WHERE id='cmsogh2sw003e2yevf7oviwzv' AND status='OPEN';

-- ── Référentiels verger ──
UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='« Fraise » et « Framboise » (ressuscitées par le seed après la fusion de mai) supprimées, seed corrigé vers Fraisier/Framboisier. « Fraise d''altitude » est une entrée DROM légitime (ITP tropicaux dédiés), conservée.'
WHERE id='cmsoeqlnm000b2yevcfl8hivy' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Donnée corrigée : la série OHxF est résistante au feu bactérien (c''est son caractère de sélection) — sensibilité retirée, note explicite, seed aligné.'
WHERE id='cmsog7qjr002m2yevqvhytrtd' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Tavelure scindée : Venturia inaequalis (pommier) / Venturia pyrina (poirier), en base et au seed.'
WHERE id='cmsog8uu4002o2yevq0wy13nf' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Porte-greffes scindés : Sainte-Lucie (Prunus mahaleb, semi-vigoureux) et F12/1 (clone de merisier, très vigoureux), en base et au seed. Les arbres rattachés restent sur Sainte-Lucie.'
WHERE id='cmsog9mys002q2yevic20dd3w' AND status='OPEN';

-- ── Comptabilité ──
UPDATE bug_reports SET status='EVOLUTION_PRODUIT', updated_at=now(),
  admin_note='Écart de 14,30 € = l''avoir AV-2026-0001, déduit du KPI SSOT mais absent de la liste Transactions (qui n''affiche pas les avoirs). Sujet déjà tranché : décision SSOT du CA ouverte (vault Comptabilite).'
WHERE id='cmsoeqc5l00062yevxe72xayf' AND status='OPEN';

UPDATE bug_reports SET status='EVOLUTION_PRODUIT', updated_at=now(),
  admin_note='Comportement voulu depuis le 07/08 : le poste 411 du bilan est signé (l''avoir de 14,30 € réduit la créance). La page Factures liste les documents, l''avoir y est un document séparé.'
WHERE id='cmsog2m0g00252yevfrhmu34h' AND status='OPEN';

UPDATE bug_reports SET status='EVOLUTION_PRODUIT', updated_at=now(),
  admin_note='Trois périmètres différents (SSOT comptable / liste transactions / ventilation analytique des Rapports), pas un double comptage simple. Lisibilité livrée : les Rapports affichent le contrôle de cohérence et la carte est renommée « ventilation analytique ». L''unification SSOT reste la décision ouverte (les achats d''arbres sans miroir sont déjà recensés).'
WHERE id='cmsoevq3q000i2yevub1xtvv0' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Le libellé « aligné sur le dashboard » était mensonger pour les coûts (seuls les revenus sont SSOT). Libellé corrigé et écart affiché explicitement (dépenses comptables vs coûts analytiques).'
WHERE id='cmsoez28o000v2yev7ikdonnp' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Les ventes manuelles rattachées au module Verger entrent désormais dans la carte de rentabilité (même correctif que le potager en mai) : les 450 € de bois de chauffage remontent.'
WHERE id='cmsog2niy00272yev9xi5nr9j' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Seed incohérent (vente marquée payée, facture émise) réparé en base et au seed ; et le passage d''une facture en « payée » propage désormais le règlement aux ventes liées.'
WHERE id='cmsogchrf00312yevqccfqqd4' AND status='OPEN';

UPDATE bug_reports SET status='EVOLUTION_PRODUIT', updated_at=now(),
  admin_note='Même racine que la valorisation « œufs DCR dépassée comptés disponibles », requalifiée le matin : le badge OK vient du seuil de stock bas, pas de la DCR. À traiter avec la décision de valorisation ouverte.'
WHERE id='cmsof5fjn001d2yevfwlozzay' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='La page Transactions lit désormais ?module= dans l''URL : le lien Boutique ouvre filtré.'
WHERE id='cmsog6ddw002g2yev6rohxlnq' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Le filtre de module est reflété dans l''URL (comme l''onglet) : il survit au rechargement.'
WHERE id='cmsogfefz003a2yevn8kzrzpx' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Le tableau de rentabilité par espèce défile dans sa carte à 375 px (motif min-w + conteneur scrollable, min-w-0 sur l''ancêtre).'
WHERE id='cmsof7s3n001j2yev7w8gfak7' AND status='OPEN';

UPDATE bug_reports SET status='EVOLUTION_PRODUIT', updated_at=now(),
  admin_note='Cluster performance déjà requalifié. Amélioration livrée au passage : les 11 agrégats mensuels des stats passent en parallèle (Promise.all).'
WHERE id='cmsof9b6d001l2yev4m31kzns' AND status='OPEN';

-- ── Navigation / année / divers ──
UPDATE bug_reports SET status='EVOLUTION_PRODUIT', updated_at=now(),
  admin_note='Décision implicite : chaque module persiste SA propre année (saison culturale ≠ exercice comptable ≠ année élevage). Un « contexte ferme » global est une évolution à décider explicitement.'
WHERE id='cmsoepefg00032yevxto5hz93' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Non reproductible : aucun chemin de code ne produit 2024 ; les chiffres affichés étaient les vraies données 2024. La clé localStorage a été réécrite par un autre agent QA parallèle sur le même profil navigateur.'
WHERE id='cmsoet96o000e2yevt2t8hvr2' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Le lien « Voir les tâches de la semaine » transmet l''année du dashboard, et /taches ancre sa semaine dans cette année (même règle que le calendrier).'
WHERE id='cmsoeqjmv00082yevgrdc1k92' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Navigation d''onglet fiabilisée sur mobile : l''écran affiche immédiatement l''onglet demandé (état optimiste), l''URL restant la source de vérité — un pushState avalé par la chaîne tactile n''est plus muet.'
WHERE id='cmsofbepa001p2yevn0vqmxwk' AND status='OPEN';

UPDATE bug_reports SET status='EVOLUTION_PRODUIT', updated_at=now(),
  admin_note='Doublon du ticket requalifié le matin même (cmsob8jpv) : convention « en retard = avant le lundi de la semaine courante », invariant écran/KPI respecté (8+4=12 reconstitué). À trancher produit si la convention doit changer.'
WHERE id='cmsoewg6j000m2yevduvkrqct' AND status='OPEN';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Le calendrier lunaire calcule désormais les instants VRAIS des phases (algorithme de Meeus) : la nouvelle lune du 12/08 est affichée le 12/08 (l''ancien cycle moyen dérivait de ±14 h). Dépendance API externe supprimée.'
WHERE id='cmsoglmwb003n2yevmnp1kyhx' AND status='OPEN';

-- ── Ticket auto de l'assistant (signaler_blocage, 13:51) ──
UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Lacune de catalogue réelle détectée par l''assistant lui-même : get_stocks_valorises (stock des récoltes après sorties) ajouté aux catalogues maraîcher, arboriculteur et éleveur.'
WHERE id='cmsopym50000jhwwks0hkwg42' AND status='OPEN';

COMMIT;

-- Contrôle : il ne doit plus rester d'OPEN.
SELECT status, count(*) FROM bug_reports GROUP BY status ORDER BY 2 DESC;
