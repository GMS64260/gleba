# Prompt pour enrichissement des CSV

Copie-colle ce prompt avec les 3 fichiers CSV :

---

**MISSION CRITIQUE : Enrichissement base de données maraîchage**

Tu dois remplir CHAQUE colonne *_AI de ces 3 CSV avec des données VÉRIFIÉES.

**RÈGLES STRICTES :**
1. ✅ Vérifie LIGNE PAR LIGNE - aucune ligne ne doit rester vide dans les colonnes *_AI
2. ✅ Utilise UNIQUEMENT des sources fiables : ITAB, Kokopelli, Germinance, guides techniques maraîchage bio français
3. ✅ Indique OBLIGATOIREMENT ta source dans `sources_AI` (ex: "ITAB 2024, Kokopelli")
4. ❌ Si aucune donnée fiable trouvée : mets "NON_TROUVE" (pas de cellule vide)
5. ✅ Priorise les données pour climat France, agriculture biologique

**UNITÉS EXACTES :**
- Rendement : kg/m² (ex: 8.5)
- Espacements : cm (ex: 50)
- Durées : jours (ex: 70) ou semaines (ex: 12)
- Besoins NPK/Eau : échelle 1-5 (1=faible, 5=très exigeant)
- Prix : €/kg circuit court bio France 2024-2026

**VALIDATION :**
- Compte le nombre de lignes traitées et confirme : "X/X lignes enrichies"
- Vérifie qu'aucune colonne *_AI n'est vide (sauf si NON_TROUVE)

**LIVRABLES :**
Retourne les 3 CSV COMPLETS (pas de résumé, fichiers complets téléchargeables).

---

**Fichiers joints :**
- especes_to_enrich.csv (135 espèces)
- itps_to_enrich.csv (154 ITPs)
- varietes_to_enrich.csv (155 variétés)

COMMENCE MAINTENANT. Confirme d'abord : "Compris, je vais traiter X lignes au total".
