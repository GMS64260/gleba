# Plan d'implémentation - Module Météo Gleba

## Objectifs
1. Intégrer les données météo en temps réel (Open-Meteo API) basées sur la géolocalisation des parcelles
2. Enrichir les calculs d'irrigation avec des données météo réelles (précipitations, ET₀)
3. Calculer l'ensoleillement par parcelle (heures, radiation, degrés-jours)
4. Supporter les stations météo personnelles (Ecowitt, Weather Underground, Netatmo)

## Architecture technique

### API météo : Open-Meteo (gratuit, sans clé API)
- Prévisions 7 jours : `https://api.open-meteo.com/v1/forecast`
- Historique : `https://archive-api.open-meteo.com/v1/archive`
- Variables : temperature_2m, precipitation, et0_fao_evapotranspiration, sunshine_duration, shortwave_radiation, relative_humidity, wind_speed_10m

### Étapes d'implémentation

#### Étape 1 : Modèle de données (Prisma)
- `MeteoCache` : cache des données météo par coordonnées/date
- `StationMeteo` : configuration des stations perso par utilisateur
- Migration Prisma

#### Étape 2 : Service météo backend (`src/lib/meteo.ts`)
- `fetchOpenMeteoForecast(lat, lng)` → prévisions 7j
- `fetchOpenMeteoHistory(lat, lng, startDate, endDate)` → historique
- `getMeteoForParcelle(parcelleId)` → données météo pour une parcelle
- Cache en base (MeteoCache) pour éviter les appels redondants (TTL: 1h forecast, 24h history)
- Types TypeScript pour toutes les réponses

#### Étape 3 : Calculs agronomiques enrichis (`src/lib/meteo-agro.ts`)
- `calculerBilanHydrique(precipitation, et0, kc, sol)` → mm/jour
- `calculerDegreJours(tempMin, tempMax, tempBase)` → GDD cumulés
- `calculerRecommandationIrrigation(culture, meteo, sol)` → conseil
- `calculerEnsoleillement(meteoData)` → heures cumulées, radiation
- `genererAlertesMeteo(meteo, cultures)` → gel, canicule, vent traitement

#### Étape 4 : API Routes
- `GET /api/meteo?parcelleId=X` → météo actuelle + prévisions 7j pour une parcelle
- `GET /api/meteo/history?parcelleId=X&start=&end=` → historique météo
- `GET /api/meteo/irrigation` → recommandations irrigation enrichies météo pour toutes les cultures actives
- `GET /api/meteo/alerts` → alertes météo actives (gel, sécheresse, vent)
- `GET/POST/DELETE /api/meteo/station` → CRUD station météo perso

#### Étape 5 : Enrichir l'irrigation existante
- Modifier `soil-quality.ts` pour intégrer les précipitations réelles
- Ajouter un champ `precipitationsRecentes` dans le calcul d'urgence
- Modifier l'API `/api/irrigations` pour inclure les données météo dans la réponse

#### Étape 6 : Support stations météo personnelles
- Intégration Ecowitt API (protocole HTTP push)
- Intégration Weather Underground API (lecture données)
- Fallback sur Open-Meteo si station indisponible
- Modèle `StationMeteo` avec provider/stationId/apiKey

#### Étape 7 : Composants frontend
- `MeteoWidget.tsx` : widget météo compact pour le dashboard (température, précipitations, prévisions)
- `MeteoDetail.tsx` : page détaillée avec graphiques (Recharts)
- `IrrigationAdvisor.tsx` : recommandations intelligentes basées sur météo + sol
- `StationMeteoConfig.tsx` : configuration station perso dans paramètres utilisateur
- Intégration dans le dashboard existant

## Fichiers à créer
- `prisma/migrations/XXX_add_meteo/migration.sql` (via prisma migrate)
- `src/lib/meteo.ts` (service météo Open-Meteo)
- `src/lib/meteo-agro.ts` (calculs agronomiques)
- `src/app/api/meteo/route.ts` (API prévisions)
- `src/app/api/meteo/history/route.ts` (API historique)
- `src/app/api/meteo/irrigation/route.ts` (API recommandations)
- `src/app/api/meteo/alerts/route.ts` (API alertes)
- `src/app/api/meteo/station/route.ts` (API station perso)
- `src/components/meteo/MeteoWidget.tsx`
- `src/components/meteo/MeteoDetail.tsx`
- `src/components/meteo/IrrigationAdvisor.tsx`
- `src/components/meteo/StationMeteoConfig.tsx`

## Fichiers à modifier
- `prisma/schema.prisma` (ajout MeteoCache + StationMeteo)
- `src/lib/soil-quality.ts` (enrichir avec précipitations)
- `src/app/page.tsx` ou dashboard (intégrer MeteoWidget)
