-- Classement de la campagne QA navigateur du 2026-08-17 (27 signalements :
-- 1 vigie du 16/08 soir + 26 tickets QA de 05:59 à 06:30).
-- Écrit en SQL et non via l'API admin (qui enverrait un mail au compte démo).
-- Recompter les restants après COMMIT (piège des cuid qui se ressemblent).

BEGIN;

-- ── RESOLVED : corrigés dans le lot du 2026-08-17 ─────────────────────────

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Requalifié : sondes /api/auth/{credentials,google,provider,foo/bar} sans parcours UI (vérifié : signIn() passe par les routes NextAuth canoniques). Les 400 UnknownAction/InvalidProvider sont le comportement attendu de NextAuth face à des URLs sondées. Aucun correctif nécessaire.'
WHERE id = 'vigie8d8ac2ed799315f5dc9eaa9a' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai bug de données : la migration 20260514200000 a inséré l''en-tête « Ail × Carotte (favorable) » sans ses détails (seule association sur 162 à 0 détail, invisible des alertes de cohabitation/adjacence et des fiches espèces). Corrigé par la migration 20260817070000_fix_asso_ail_carotte_details (idempotente), appliquée en production.'
WHERE id = 'cmswtqnty000bh51mw9bip81k' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Corrigé : les deep-links action=nouveau-soin et animalId sont consommés une seule fois (retirés de l''URL sitôt l''état posé, AlimentationTab). F5 revient au registre sans rouvrir un formulaire vierge.'
WHERE id = 'cmswtrpr5000eh51mb6tnp710' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai bug (motif cmsogkqpf) : input[type=date] contrôlé sans filet — 100 % des 4 lots de la base avaient date_peremption NULL. Corrigé : filet DOM (ref + onBlur + badInput) sur le mini-formulaire lot du soin ET le formulaire pharmacie, plus garde serveur (l''upsert ne réécrit plus une péremption connue par null). Reprise : COB-A3-1708 restitué au 17/08/2027 + snapshot des soins 110/111. Les 3 lots antérieurs (DXM-A3, NB-RAGE, LOTJUL0812) restent à ressaisir (valeur d''origine inconnue).'
WHERE id = 'cmswtt0ee000jh51mxric491b' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Le fix du 11/08 existait mais l''écriture était fragile : Leaflet émet baselayerchange sur TOUT addLayer d''un fond enregistré (diff react-leaflet au montage/remontage), ce qui réécrivait « OpenStreetMap » par-dessus le choix persisté. Corrigé : l''écriture du slot gleba_carte_fond n''est acceptée que dans la foulée immédiate (<1,5 s) d''un pointerdown sur la carte.'
WHERE id = 'cmswtxnnb000ph51mjjzu661m' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Écart 33,10 € = 36,30 € d''avoirs (convention du 08/10, non-bug) − 3,20 € de VRAI bug : la VenteManuelle auto commande_boutique (CMD-2026-0015) entrait dans la SSOT mais n''était ventilée dans aucun module, ce qui cassait l''égalité stricte du bandeau (« Incohérence détectée » en rouge). Corrigé : les ventes boutique auto suivent la ventilation des ventes manuelles (annuel + série mensuelle). L''écart résiduel = Σ avoirs, nommé par le bandeau de convention.'
WHERE id = 'cmswtznh2000sh51my79q2ijy' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Corrigé : le texte du dialogue annonçait le type de sol sans champ. Sélecteur « Type de sol » ajouté au formulaire /parcelles (options partagées avec le panneau de la carte, valeur héritée hors liste préservée) ; modèle et API l''acceptaient déjà.'
WHERE id = 'cmswu0bql000uh51m2n36fpx1' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Corrigé : accents restitués sur /maraichage/cultures/irriguer (Priorité, prévus 48h/5j, à venir, planifiée(s)).'
WHERE id = 'cmswu1btx000wh51mmbcybakd' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Fondé, mais la logique n''était pas inversée : la décision venait d''un forfait « 5 mm sur 3 jours couvrent 3 jours » (5,8 mm tombés les 14-16/08, ET0 ~5 mm/j) et l''écran affichait la mauvaise grandeur (« 0mm de pluie prévue »). Corrigé : règle partagée irrigation-meteo-decision.ts (seuil 8 mm aligné sur irrigation-conseil + couverture par ET0 réelle, jour civil LOCAL du passage, cause remontée à l''écran — « X mm tombés ces 3 derniers jours » vs « X mm prévus » — plus d''arrondi à 0mm, garde null au dashboard). Avec les données du ticket, plus aucun des 12 passages n''est annulé ni auto-validé. 10 tests ajoutés.'
WHERE id = 'cmswu32600012h51md3gntpd2' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai bug : l''arbre 574 « Pommier » (sans espèce ni variété, créé le 07/08 avant l''obligation d''espèce) court-circuitait le filtre client (espèce NULL = « on ne bloque pas ») ET la garde serveur (NULL && … = false), et une association invérifiable pouvait éteindre l''alerte « sans pollinisateur ». Corrigé : candidat sans espèce exclu quand la cible en a une, incomplets triés en dernier avec mention « données incomplètes, à vérifier », compatibilité « partielle » (plus jamais « bonne ») sans groupe connu, et 422 serveur quand un seul des deux arbres a une espèce. 13 arbres de vrais comptes sont dans ce cas : le 422 les invite à compléter la fiche.'
WHERE id = 'cmswu5y820014h51mxrty0mk9' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Artefact du seed de démonstration, pas un bug de code : les deux factures ont été créées à 13 ms d''écart par le seed, qui numérotait dans l''ordre du code (fromage à date glissante avant fruits au 20/06 fixe). Le vrai moteur numérote chronologiquement À L''ÉMISSION (art. 242 nonies A) et l''amorçage des séquences (12/08) est sain (prochaine = F-2026-0003). Corrigé : seed réordonné par date + échange des numéros des deux factures démo.'
WHERE id = 'cmswu8roo001ah51mp17k54l3' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Corrigé : « BBCH 81 — Véraison » (terme viticole) remplacé par « BBCH 81 — Début de maturation » dans le sélecteur d''observations verger ; la valeur stockée existante a été réalignée.'
WHERE id = 'cmswu8thr001ch51m9qxm5p63' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Corrigé à la source : calculerStocksNet passe par l''arrondi métier partagé (arrondiQuantiteStock, 3 décimales) — la ligne Tomate affiche 10,8 kg.'
WHERE id = 'cmswu8uva001eh51mf9oal4po' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Corrigé : la séparation n''était qu''une marge CSS (ml-2), invisible du texte lu. Séparateur « · » réel ajouté entre « X complets » et « Y incomplets ».'
WHERE id = 'cmswu9mg2001ih51m8beuu8dm' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'L''inclusion des commandes boutique dans les impayés est VOULUE (créances clients, helper construireImpayees). Deux défauts réels corrigés : libellés renommés « Créances » (carte dashboard + écran Factures) et colonne N° ajoutée au tableau des impayées (le numéro était calculé mais jamais affiché ; les commandes affichent « — »).'
WHERE id = 'cmswu9r5x001kh51mxpw8uxa8' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Corrigé : quand deux cultures produisent le même libellé (même espèce/variété/planche), le sélecteur de /interventions suffixe l''identifiant (« … — #1050 »). Le rattachement reste par id.'
WHERE id = 'cmswubyce001nh51moalh7gkf' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Non reproductible sur les données : znt_respectee = true en base pour les deux interventions QA (81 jamais modifiée), la valeur est écrite, renvoyée par le GET et rechargée à l''édition (prouvé jusqu''au chunk servi). Le contrôle était deux <button role=radio> illisibles pour un contrôle DOM (aucun radio:checked). Corrigé quand même : de vrais <input type=radio> masqués portent l''état — le ticket devient impossible à re-signaler et l''accessibilité clavier revient.'
WHERE id = 'cmswue479001rh51mjnnivpt5' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Les données réglementaires sont affichées dans la sous-ligne dépliable de chaque intervention (clic sur la ligne) et le registre complet en colonnes vit sur /tracabilite. Deux correctifs : la garde qui masquait TOUT le bloc réglementaire quand le produit était vide (alors qu''AMM/dose/DAR/ZNT étaient renseignés) est élargie, et un lien « Registre phyto complet » est ajouté en tête de liste.'
WHERE id = 'cmswueqe1001th51mp53o1rbx' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai bug (piège SelectBubbleInput Radix) : un Select contrôlé à "" n''émet aucune <option value=""> dans son select natif caché — le navigateur retombe sur la première option et la relecture FormData du submit soumettait le premier lot alphabétique alors que l''écran affichait le placeholder. Corrigé par valeur sentinelle (saisie d''œufs ET abattages, seules occurrences de <Select name=>) ; la garde « Sélectionnez un lot » bloque désormais. Reprise : collecte fantôme production_oeufs 1507 supprimée.'
WHERE id = 'cmswug6di001wh51m7hmvh3ot' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai bug : la carte du dashboard n''a jamais reçu le correctif impayés du 12/08 — elle agrégeait les tables sources brutes (avoir AV-2026-0002 structurellement invisible, facture manuelle sans source invisible aussi). Corrigé : la carte et sa liste détaillée passent par le même helper que l''écran Factures (construireImpayees) → 1 097,94 € partout. Le bilan (créances 411) est aligné dans la foulée : un avoir sur facture déjà payée n''est plus déduit des créances (écart latent de 20,90 € soldé, invariant impayées == créances 411 restauré).'
WHERE id = 'cmswunx5s0023h51m4knij7p0' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Corrigé avec cmswunx5s : les sources des impayés de la carte sont bornées à l''exercice sélectionné (2027 et 2024 affichent 0). Les créances antérieures restent visibles sur leur exercice.'
WHERE id = 'cmswuotxj0027h51m5qbqo1kj' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Corrigé : « À créer » accentué sur les trois écrans de planification (liste, par îlots, par planches).'
WHERE id = 'cmswutut60029h51mpm46vvce' AND status = 'OPEN';

-- ── EVOLUTION_PRODUIT : écarts produit qualifiés, décision à prendre ──────

UPDATE bug_reports SET status = 'EVOLUTION_PRODUIT', updated_at = NOW(), admin_note =
  'Décision produit, pas un bug : le modèle actuel (16/08) crée une VENTE à la livraison d''une commande boutique (paye=false), la facture restant émise à la demande. Générer automatiquement une facture par commande livrée engage la numérotation légale et le workflow (avoirs, annulations) : à trancher explicitement. La recette 3,20 € existe bien (Transactions + créances).'
WHERE id = 'cmswucmku001ph51mu9lu7vyo' AND status = 'OPEN';

UPDATE bug_reports SET status = 'EVOLUTION_PRODUIT', updated_at = NOW(), admin_note =
  'Valorisation du temps de travail jamais écrite : les colonnes tauxHoraireFamilial/Salarie existent (DEV2 #7) mais NULL sur 21/21 exploitations, aucune UI de saisie, aucun calcul ne les lit. Le « 1,4 h » affiché est juste (fix du 14/08) mais volontairement non valorisé en €. Chantier proposé : exposer les 2 taux dans /parametres/exploitation + coutMainOeuvre ?? (minutes×personnes/60)×taux dans couts-production, avec la base de calcul affichée. Corrigé au passage : le guide de l''assistant n''annonce plus des « taux horaires » inexistants. NB : l''attendu du QA (0,25 h) ignore nb_personnes.'
WHERE id = 'cmswugakh001yh51mlrq1chnu' AND status = 'OPEN';

UPDATE bug_reports SET status = 'EVOLUTION_PRODUIT', updated_at = NOW(), admin_note =
  'Module de clôture / à-nouveaux inexistant (aucun compte 110/129, pas de journal AN au FEC, pas de notion d''exercice clôturé) et bilan assumé « MVP » à l''écran ; le site annonce explicitement ne pas produire de bilan comptable. La valeur attendue par le QA (report de 2 992,04 €) est elle-même fausse : ce chiffre est tronqué par un défaut réel et distinct — les comptes de STOCK (immobilisations 215x, créances 411, dettes 401) sont bornés à l''année civile au lieu d''être cumulés au 31/12 de l''exercice (en cumul, clôture 2026 = 15 892,04 €). Correctif étroit possible (retirer la borne basse sur ces 4 postes + ligne « Report à nouveau ») mais il expose l''absence d''amortissements et de trésorerie : décision produit à prendre avant.'
WHERE id = 'cmswumvb80021h51mxgvkqa6g' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai bug : l''écran de saisie de récolte multipliait le rendement par la surface de la PLANCHE entière au lieu de la longueur cultivée (culture #1050 : 5 m sur une planche de 10 m → 12 kg au lieu de 6, et pré-remplissait la quantité avec ce chiffre faux). Corrigé via le SSOT existant surfaceCultureM2 (longueur cultivée prioritaire), même correction portée au stock prévisionnel (stocks-unifies). Occurrences restantes du motif documentées au vault (couts-production, dashboard prévisionnel, registre-culture, partageFactor des Semences).'
WHERE id = 'cmswu7zfb0018h51mxkhnuq6i' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Le moteur de rotation est sain (l''API renvoie 13 cultures pour 2028, vérifié contre la base) : l''écran « Créer les cultures » retombait SILENCIEUSEMENT sur l''année courante (annee absente de l''URL — le lien de la sous-nav ne la transporte pas — et history.replaceState au lieu d''une navigation routeur), et un échec de fetch affichait « Total prévues 0 ». Corrigé : URL source de vérité (resolveDashboardYear + router.replace, même motif que cultures-prevues cmsp5p3v4), l''année propagée sur les liens de la sous-nav Planification, et état d''erreur visible avec bouton Réessayer. Restriction connue : le sélecteur d''année du hub Maraîchage plafonne à N+1 — les écrans Planification, eux, vont jusqu''à N+5.'
WHERE id = 'cmswunyun0025h51mbcrwa4g2' AND status = 'OPEN';

SELECT status, COUNT(*) FROM bug_reports GROUP BY status ORDER BY 2 DESC;

COMMIT;
