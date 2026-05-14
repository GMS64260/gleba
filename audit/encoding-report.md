# Audit encoding UTF-8 — accents français manquants

Mode : **report**
Fichiers analysés : **420**
Occurrences détectées : **38**
Fichiers impactés : **28**

## Détail par fichier

### `src/app/(auth)/login/page.tsx` (1)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `Gérer une micro-ferme, un écolieu ou un jardin pédagogique d` | `Gérer une micro-ferme, un écolieu ou un jardin pédagogique d` | `[multiline JSX text]` |

### `src/app/api/export/route.ts` (2)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `[])
      if (especes.length) csvFiles['espèces.csv'] = toCS` | `[])
      if (espèces.length) csvFiles['espèces.csv'] = toCS` | `[multiline JSX text]` |
| 0 | `[])
      if (varietes.length) csvFiles['variétés.csv'] = to` | `[])
      if (variétés.length) csvFiles['variétés.csv'] = to` | `[multiline JSX text]` |

### `src/app/api/import/route.ts` (3)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `especes?: Array` | `espèces?: Array` | `[multiline JSX text]` |
| 0 | `varietes?: Array` | `variétés?: Array` | `[multiline JSX text]` |
| 0 | `recoltes?: Array` | `récoltes?: Array` | `[multiline JSX text]` |

### `src/app/comptabilite/couts-production/page.tsx` (1)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `Enregistrez des cultures et des recoltes pour voir l&apos;an` | `Enregistrez des cultures et des récoltes pour voir l&apos;an` | `[multiline JSX text]` |

### `src/app/comptabilite/stocks/page.tsx` (1)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `,
  elevage:` | `,
  élevage:` | `[multiline JSX text]` |

### `src/app/comptabilite/transactions/page.tsx` (2)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `,
  elevage:` | `,
  élevage:` | `[multiline JSX text]` |
| 0 | `Ce total agrège toutes vos ventes, qu'elles proviennent du p` | `Ce total agrège toutes vos ventes, qu'elles proviennent du p` | `[multiline JSX text]` |

### `src/app/cultures/[id]/page.tsx` (1)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `([])
  const [varietes, setVarietes] = React.useState` | `([])
  const [variétés, setVarietes] = React.useState` | `[multiline JSX text]` |

### `src/app/cultures/new/page.tsx` (1)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `([])
  const [varietes, setVarietes] = React.useState` | `([])
  const [variétés, setVarietes] = React.useState` | `[multiline JSX text]` |

### `src/app/elevage/animaux/page.tsx` (1)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `([])
  const [especes, setEspeces] = React.useState` | `([])
  const [espèces, setEspeces] = React.useState` | `[multiline JSX text]` |

### `src/app/itps/page.tsx` (1)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `Un Itinéraire Technique de Plante définit le calendrier cult` | `Un Itinéraire Technique de Plante définit le calendrier cult` | `[multiline JSX text]` |

### `src/app/jardin/page.tsx` (1)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `([])
  const [especes, setEspeces] = React.useState` | `([])
  const [espèces, setEspeces] = React.useState` | `[multiline JSX text]` |

### `src/app/parametres/page.tsx` (1)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `Supprimé toutes vos cultures, planches, recoltes, arbres et ` | `Supprimé toutes vos cultures, planches, récoltes, arbres et ` | `[multiline JSX text]` |

### `src/app/planification/associations/page.tsx` (1)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `Cette page affiche les cultures prevues et leurs voisines.
 ` | `Cette page affiche les cultures prévues et leurs voisines.
 ` | `[multiline JSX text]` |

### `src/app/planification/plants/page.tsx` (1)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `Cette page liste les plants necessaires pour les cultures av` | `Cette page liste les plants nécessaires pour les cultures av` | `[multiline JSX text]` |

### `src/app/recoltes/page.tsx` (1)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `('all')
  const [especes, setEspeces] = React.useState` | `('all')
  const [espèces, setEspeces] = React.useState` | `[multiline JSX text]` |

### `src/app/roadmap/page.tsx` (1)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `Les fonctionnalités en cours de développement et celles prev` | `Les fonctionnalités en cours de développement et celles prév` | `[multiline JSX text]` |

### `src/app/stocks/page.tsx` (1)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `Un stock ne peut pas être négatif dans la réalité. Vérifiez ` | `Un stock ne peut pas être négatif dans la réalité. Vérifiez ` | `[multiline JSX text]` |

### `src/components/assistant/AssistantStepDates.tsx` (1)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `Décalez les dates de quelques semaines si necessaire
       ` | `Décalez les dates de quelques semaines si nécessaire
       ` | `[multiline JSX text]` |

### `src/components/assistant/AssistantStepPlante.tsx` (2)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `) : varietes.length === 0 ? (` | `) : variétés.length === 0 ? (` | `[multiline JSX text]` |
| 0 | `Choisir une variete permet de suivre
                votre s` | `Choisir une variété permet de suivre
                votre s` | `[multiline JSX text]` |

### `src/components/assistant/AssistantStepSuccess.tsx` (1)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `Rendez-vous sur la fiche de la culture
          pour marque` | `Rendez-vous sur la fiche de la culture
          pour marque` | `[multiline JSX text]` |

### `src/components/dashboard/CalendarView.tsx` (1)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `1 && !allDone.recolte && (` | `1 && !allDone.récolte && (` | `[multiline JSX text]` |

### `src/components/elevage/AnimauxTab.tsx` (2)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `([])
  const [especes, setEspeces] = React.useState` | `([])
  const [espèces, setEspeces] = React.useState` | `[multiline JSX text]` |
| 0 | `([])
  const [especes, setEspeces] = React.useState` | `([])
  const [espèces, setEspeces] = React.useState` | `[multiline JSX text]` |

### `src/components/garden/NewCultureDialog.tsx` (1)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `([])
  const [varietes, setVarietes] = React.useState` | `([])
  const [variétés, setVarietes] = React.useState` | `[multiline JSX text]` |

### `src/components/meteo/PluviometriePlanche.tsx` (1)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `Aucune pluie significative (≥ 5 mm) prevue dans les 7 jours` | `Aucune pluie significative (≥ 5 mm) prévue dans les 7 jours` | `[multiline JSX text]` |

### `src/components/onboarding/WelcomeDialog.tsx` (3)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `en choisissant une espece et la planche cible.` | `en choisissant une espèce et la planche cible.` | `[multiline JSX text]` |
| 0 | `Un jardin complet avec 2 annees de données (2023-2024) :
   ` | `Un jardin complet avec 2 annees de données (2023-2024) :
   ` | `[multiline JSX text]` |
| 0 | `Créez vos propres planches, especes et cultures depuis zéro.` | `Créez vos propres planches, espèces et cultures depuis zéro.` | `[multiline JSX text]` |

### `src/components/potager/CalendrierTab.tsx` (2)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `Cumul (en kg) de toutes les recoltes enregistrées entre le 1` | `Cumul (en kg) de toutes les récoltes enregistrées entre le 1` | `[multiline JSX text]` |
| 0 | `Total des semis, plantations, recoltes et arrosages à faire ` | `Total des semis, plantations, récoltes et arrosages à faire ` | `[multiline JSX text]` |

### `src/components/potager/TerrainTab.tsx` (1)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `Les associations définissent quelles especes se beneficient ` | `Les associations définissent quelles espèces se beneficient ` | `[multiline JSX text]` |

### `src/components/verger/AssistantPlantationDialog.tsx` (2)

| Ligne | Avant | Après | Contexte |
|---|---|---|---|
| 0 | `Le calendrier des etapes (préparation sol, plantation, regar` | `Le calendrier des étapes (préparation sol, plantation, regar` | `[multiline JSX text]` |
| 0 | `Votre campagne de plantation est enregistrée. Le calendrier ` | `Votre campagne de plantation est enregistrée. Le calendrier ` | `[multiline JSX text]` |

## Cas non traités automatiquement (ambigus)

Ces formes sont contextuelles (substantif sans accent ≠ participe passé avec accent) :

- `Plante`, `Plantes` → souvent substantif féminin « la plante » (PAS d'accent). Forme participe « planté(e) » → accent.
- `Sauvegarde` → substantif « la sauvegarde » (PAS d'accent). Verbe « sauvegardé » → accent.
- `Conserve` → substantif « les conserves » (PAS d'accent). Verbe « conservé » → accent.
- `Reserve` → substantif « la réserve » (avec accent !) ou participe « réservé ».
- `Termine`, `Semis`, `Seme` (singulier) → ambigu sans contexte.

Examiner manuellement après le run automatique.
