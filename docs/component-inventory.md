# Component Inventory — Gleba

> Généré le 2026-03-12 | 95 composants TSX | Design system: Shadcn/UI + Radix UI + TailwindCSS

## Design System (`src/components/ui/`) — 28 composants

Base design system utilisant **Shadcn/UI** avec primitives **Radix UI** et **TailwindCSS**.

### Form
| Composant | Description |
|-----------|-------------|
| `button.tsx` | Bouton polymorphique avec variants (default, destructive, outline, secondary, ghost, link) et tailles |
| `input.tsx` | Champ texte avec transitions et gestion fichiers |
| `textarea.tsx` | Zone de texte multi-lignes |
| `label.tsx` | Label de formulaire avec état disabled |
| `form.tsx` | Intégration React Hook Form (FormField, FormControl, FormMessage) |
| `select.tsx` | Dropdown Radix UI (Select, SelectTrigger, SelectValue, SelectContent, SelectItem) |
| `checkbox.tsx` | Case à cocher |
| `switch.tsx` | Interrupteur toggle animé |
| `slider.tsx` | Curseur de plage avec track |
| `combobox.tsx` | Dropdown searchable (Command + Popover) |

### Layout
| Composant | Description |
|-----------|-------------|
| `card.tsx` | Container carte (Card, CardHeader, CardContent, CardTitle) |
| `scroll-area.tsx` | Zone scrollable avec scrollbar custom |
| `separator.tsx` | Séparateur visuel (horizontal/vertical) |

### Navigation
| Composant | Description |
|-----------|-------------|
| `tabs.tsx` | Interface à onglets (Tabs, TabsList, TabsTrigger, TabsContent) |
| `dropdown-menu.tsx` | Menu déroulant avec sous-menus et radio groups |
| `command.tsx` | Palette de commandes/recherche (CommandDialog, CommandInput, CommandList) |

### Display
| Composant | Description |
|-----------|-------------|
| `badge.tsx` | Badge avec variants (default, secondary, destructive, outline) |
| `alert.tsx` | Boîte d'alerte avec icône |
| `tooltip.tsx` | Infobulle popup |
| `skeleton.tsx` | Placeholder animé (loading) |

### Dialog
| Composant | Description |
|-----------|-------------|
| `dialog.tsx` | Dialog modale Radix UI |
| `sheet.tsx` | Panel latéral glissant |
| `popover.tsx` | Popover flottant |

### Spécialisés
| Composant | Description |
|-----------|-------------|
| `table.tsx` | Wrapper table HTML (Table, TableHeader, TableBody, TableRow, TableCell) |
| `chart.tsx` | Configuration de contexte pour Recharts |
| `toast.tsx` | Système de notifications toast |
| `toaster.tsx` | Rendu des toasts |

---

## Composants par domaine fonctionnel

### Admin (`src/components/admin/`) — 3 composants
| Composant | Catégorie | Description |
|-----------|-----------|-------------|
| `AdminTabs.tsx` | Navigation | Onglets admin : Logs de connexion + Métriques (pagination, filtres, stats) |
| `UserTable.tsx` | Table | Liste utilisateurs avec CRUD (éditer, activer, désactiver, supprimer) |
| `UserForm.tsx` | Form | Formulaire création/édition utilisateur |

### Auth (`src/components/auth/`) — 4 composants
| Composant | Catégorie | Description |
|-----------|-----------|-------------|
| `LoginForm.tsx` | Form | Formulaire login glassmorphism avec gestion vérification email |
| `RegisterForm.tsx` | Form | Formulaire inscription avec validation mot de passe |
| `UserMenu.tsx` | Navigation | Menu utilisateur dropdown (nom, rôle, déconnexion, paramètres) |
| `SessionProvider.tsx` | Layout | Wrapper NextAuth SessionProvider |

### Assistant (`src/components/assistant/`) — 6 composants
Wizard de création de culture en 5 étapes.
| Composant | Catégorie | Description |
|-----------|-----------|-------------|
| `AssistantDialog.tsx` | Dialog | Dialog principal orchestrant le wizard |
| `AssistantStepEmplacement.tsx` | Form | Sélection mode + configuration planche |
| `AssistantStepPlante.tsx` | Form | Sélection espèce, ITP et variété en une page |
| `AssistantStepDates.tsx` | Form | Configuration dates et quantités avec estimation rendement |
| `AssistantStepRecap.tsx` | Display | Résumé avec alertes (stock, associations, irrigation) |
| `AssistantStepSuccess.tsx` | Display | Confirmation succès avec liens |

### Dashboard (`src/components/dashboard/`) — 4 composants
| Composant | Catégorie | Description |
|-----------|-----------|-------------|
| `CalendarView.tsx` | Display | Calendrier mensuel (semis, plantations, récoltes, irrigation) |
| `EventDialog.tsx` | Dialog | Dialog détail événement avec action "marquer fait" |
| `YearView.tsx` | Display | Vue annuelle 12 mois avec densité d'événements |
| `ItpCalendarView.tsx` | Chart | Gantt embarqué pour ITPs |

### Potager (`src/components/potager/`) — 5 composants
| Composant | Catégorie | Description |
|-----------|-----------|-------------|
| `CulturesTab.tsx` | Table | Liste cultures avec filtres état + données pluviométrie |
| `CalendrierTab.tsx` | Display | Vue semaine avec tâches, météo, alertes irrigation |
| `PlanificationTab.tsx` | Navigation | Hub planification (cultures prévues, rotations, associations, stocks) |
| `ReferentielTab.tsx` | Table | Base espèces avec filtres type |
| `TerrainTab.tsx` | Table | Gestion planches avec sous-onglets |

### Verger (`src/components/verger/`) — 9 composants
| Composant | Catégorie | Description |
|-----------|-----------|-------------|
| `ArbresTab.tsx` | Table | Liste arbres avec filtres type + dialog ajout |
| `CalendrierTab.tsx` | Chart | Calendrier verger avec stats opérations et graphiques |
| `ReferentielTab.tsx` | Table | Base espèces arbres avec sheet détail |
| `OperationsTab.tsx` | Table | Opérations entretien/phytosanitaire |
| `ProductionsTab.tsx` | Table | Productions (récoltes fruits + bois) |
| `SanteTab.tsx` | Table | Registre sanitaire + pollinisation |
| `PlanificationTab.tsx` | Navigation | Hub planification zones, stocks, interventions |
| `VergerCalendarView.tsx` | Display | Grille mensuelle opérations (planifié/fait) |
| `TreeCareGantt.tsx` | Chart | Gantt 12 mois soins par espèce |

### Élevage (`src/components/elevage/`) — 8 composants
| Composant | Catégorie | Description |
|-----------|-----------|-------------|
| `AnimauxTab.tsx` | Table | Animaux individuels + Lots (sous-onglets) |
| `AlimentationTab.tsx` | Table | Stocks alimentaires + Consommation + Soins |
| `EspecesTab.tsx` | Table | Référentiel espèces animales |
| `DashboardTab.tsx` | Chart | Tableau de bord stats, alertes, graphiques |
| `ProductionTab.tsx` | Table | Oeufs + Ventes + Abattages |
| `ReproductionTab.tsx` | Table | Naissances + Calculateur gestation |
| `CalendrierTab.tsx` | Display | Vue semaine tâches soins |
| `GenealogyTree.tsx` | Display | Arbre généalogique 3 générations |

### ITPs (`src/components/itps/`) — 2 composants
| Composant | Catégorie | Description |
|-----------|-----------|-------------|
| `GanttRow.tsx` | Chart | Ligne Gantt avec barres phases colorées |
| `ItpEditDialog.tsx` | Dialog | Dialog édition rapide semaines ITP |

### Planches (`src/components/planches/`) — 3 composants
| Composant | Catégorie | Description |
|-----------|-----------|-------------|
| `InlineEditField.tsx` | Form | Champ click-to-edit (texte, nombre, select, combobox) avec auto-save |
| `EditableSelectCell.tsx` | Form | Cellule table éditable dropdown avec API auto-update |
| `PlancheInfoTable.tsx` | Table | Table info planche avec édition inline |

### Planche (`src/components/planche/`) — 3 composants
| Composant | Catégorie | Description |
|-----------|-----------|-------------|
| `PlancheHistory.tsx` | Display | Timeline historique cultures + fertilisations |
| `RotationAdvice.tsx` | Display | Recommandations rotation avec évaluation risque |
| `RotationBadge.tsx` | Display | Badge statut risque rotation (safe/warning/blocked) |

### Carte (`src/components/carte/`) — 9 composants
| Composant | Catégorie | Description |
|-----------|-----------|-------------|
| `MapContainer.tsx` | Map | Carte Leaflet avec couches IGN/OSM/Cadastre/Satellite |
| `MapToolbar.tsx` | Navigation | Barre outils dessin, cadastre, édition |
| `ParcellePanel.tsx` | Form | Panel détail parcelle (géométrie, surface, usage, sol) |
| `ParcelleLayer.tsx` | Map | Couche GeoJSON parcelles colorées |
| `ParcelleList.tsx` | Navigation | Liste parcelles avec flyTo |
| `GeolocateControl.tsx` | Navigation | Bouton géolocalisation GPS |
| `CadastreSearch.tsx` | Form | Recherche cadastrale (commune/section/numéro) |
| `DrawingTools.tsx` | Form | Outils dessin polygone Leaflet Draw |
| `EditingTools.tsx` | Form | Édition géométries existantes |

### Météo (`src/components/meteo/`) — 5 composants
| Composant | Catégorie | Description |
|-----------|-----------|-------------|
| `MeteoWidget.tsx` | Display | Widget météo (temp, humidité, vent, précipitations) |
| `HeaderMeteoWidget.tsx` | Display | Bouton compact header avec Popover météo |
| `IrrigationAdvisor.tsx` | Display | Recommandations irrigation (urgence critique/haute/moyenne/faible) |
| `StationMeteoConfig.tsx` | Form | Configuration stations météo personnelles |
| `PluviometriePlanche.tsx` | Chart | Visualisation pluviométrie SVG (historique 30j + prévision 7j) |

### Lunaire (`src/components/lunaire/`) — 1 composant
| Composant | Catégorie | Description |
|-----------|-----------|-------------|
| `LunaireWidget.tsx` | Display | Widget calendrier lunaire (phase, illumination, type jour) |

### Tables (`src/components/tables/`) — 1 composant
| Composant | Catégorie | Description |
|-----------|-----------|-------------|
| `DataTable.tsx` | Table | Composant DataTable générique TanStack (tri, filtres, pagination, export, bulk actions) |

### Stocks (`src/components/stocks/`) — 1 composant
| Composant | Catégorie | Description |
|-----------|-----------|-------------|
| `ConsommationsTab.tsx` | Table | Onglet consommations de stock |

### Garden (`src/components/garden/`) — 1 composant
| Composant | Catégorie | Description |
|-----------|-----------|-------------|
| `NewCultureDialog.tsx` | Form | Dialog création culture rapide depuis plan jardin |

### Chat (`src/components/chat/`) — 2 composants
| Composant | Catégorie | Description |
|-----------|-----------|-------------|
| `ChatPanel.tsx` | Display | Interface chat IA avec markdown, historique, streaming |
| `ChatBubble.tsx` | Navigation | Bulle chat flottante avec détection contexte section |

### Onboarding (`src/components/onboarding/`) — 1 composant
| Composant | Catégorie | Description |
|-----------|-----------|-------------|
| `WelcomeDialog.tsx` | Dialog | Dialog bienvenue avec import données test |

### Root (`src/components/`) — 1 composant
| Composant | Catégorie | Description |
|-----------|-----------|-------------|
| `Footer.tsx` | Layout | Footer global (copyright AGPL-3.0, lien GitHub) |

---

## Patterns architecturaux clés

1. **Design System** : Shadcn/UI + Radix UI primitives + TailwindCSS avec variables CSS
2. **Organisation par onglets** : Les modules majeurs utilisent des onglets imbriqués
3. **Tables éditables** : TanStack Table avec édition inline (InlineEditField, EditableSelectCell)
4. **Workflows en dialog** : L'assistant utilise un wizard 5 étapes ; CRUD via modales
5. **Auto-save** : Édition inline avec appels API automatiques
6. **Carte interactive** : Leaflet avec API Cadastre, outils de dessin, géolocalisation
7. **Détection de contexte** : Le chat IA détecte automatiquement la section (potager/verger/élevage/compta)
8. **Popovers compacts** : Widgets header (Météo, Lunaire) qui s'expandent en vues détaillées
