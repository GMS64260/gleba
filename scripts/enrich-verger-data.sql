-- =============================================================
-- ENRICHISSEMENT DONNÉES VERGER - Espèces & Variétés fruitières
-- Sources : INRAE, CTIFL, Chambres d'agriculture, Wikipedia
-- =============================================================

BEGIN;

-- =============================================================
-- 1. ESPÈCES FRUITIÈRES - Données agronomiques complètes
-- =============================================================

-- Pommier
UPDATE especes SET
  rendement = 30, -- kg/arbre adulte moyen (plein vent)
  besoin_eau = 3,
  besoin_n = 60, besoin_p = 30, besoin_k = 80,
  vivace = true, a_planifier = false,
  description = 'Arbre fruitier majeur des régions tempérées. Hauteur 5-10m, mise à fruit 3-5 ans. Besoin en froid: 800-1200h. Rusticité: -25°C. Sol: profond, frais, bien drainé, pH 6-7. Distance plantation: 4-6m. Durée productive: 30-50 ans. Maladies: tavelure, oïdium, feu bactérien, chancre. Ravageurs: carpocapse, pucerons, acariens. Porte-greffes courants: M9 (nanisant), M26, MM106, MM111 (vigoureux).',
  categorie = 'fruitier'
WHERE espece = 'Pommier';

-- Poirier
UPDATE especes SET
  rendement = 25,
  besoin_eau = 3,
  besoin_n = 50, besoin_p = 25, besoin_k = 70,
  vivace = true, a_planifier = false,
  description = 'Arbre fruitier exigeant en chaleur estivale. Hauteur 6-12m, mise à fruit 4-6 ans. Besoin en froid: 600-1000h. Rusticité: -20°C. Sol: profond, argilo-calcaire, pH 6-7.5. Distance plantation: 4-6m. Durée productive: 40-80 ans. Maladies: tavelure, feu bactérien, rouille grillagée. Ravageurs: psylle, carpocapse, hoplocampe. Porte-greffes: BA29 (cognassier), OHF (franc).',
  categorie = 'fruitier'
WHERE espece = 'Poirier';

-- Cerisier
UPDATE especes SET
  rendement = 30,
  besoin_eau = 2,
  besoin_n = 40, besoin_p = 20, besoin_k = 60,
  vivace = true, a_planifier = false,
  description = 'Arbre fruitier vigoureux à floraison précoce. Hauteur 6-15m, mise à fruit 3-5 ans. Besoin en froid: 700-1000h. Rusticité: -25°C. Sol: léger, bien drainé, calcaire toléré, pH 6-7.5. Distance plantation: 6-10m. Durée productive: 30-50 ans. Très sensible à la taille (gomme). Maladies: moniliose, cylindrosporiose, chancre bactérien. Ravageurs: mouche de la cerise, pucerons noirs, drosophile suzukii.',
  categorie = 'fruitier'
WHERE espece = 'Cerisier';

-- Prunier
UPDATE especes SET
  rendement = 25,
  besoin_eau = 2,
  besoin_n = 40, besoin_p = 20, besoin_k = 60,
  vivace = true, a_planifier = false,
  description = 'Arbre fruitier rustique et peu exigeant. Hauteur 5-8m, mise à fruit 3-5 ans. Besoin en froid: 700-1000h. Rusticité: -25°C. Sol: frais, profond, argilo-calcaire, pH 6-7. Distance plantation: 5-7m. Durée productive: 30-50 ans. Maladies: moniliose, rouille, sharka (PPV). Ravageurs: carpocapse des prunes, pucerons, hoplocampe. Porte-greffes: Myrobolan, Saint-Julien, prunier Mariana.',
  categorie = 'fruitier'
WHERE espece = 'Prunier';

-- Pêcher
UPDATE especes SET
  rendement = 20,
  besoin_eau = 3,
  besoin_n = 60, besoin_p = 30, besoin_k = 80,
  vivace = true, a_planifier = false,
  description = 'Arbre fruitier sensible au froid printanier. Hauteur 3-6m, mise à fruit 2-4 ans. Besoin en froid: 400-800h. Rusticité: -15°C. Sol: léger, bien drainé, non calcaire, pH 5.5-6.5. Distance plantation: 4-6m. Durée productive: 15-25 ans. Maladies: cloque, oïdium, moniliose. Ravageurs: pucerons verts, tordeuse orientale, thrips. Porte-greffes: GF305, Montclar, Cadaman.',
  categorie = 'fruitier'
WHERE espece = 'Pêcher';

-- Abricotier
UPDATE especes SET
  rendement = 25,
  besoin_eau = 2,
  besoin_n = 40, besoin_p = 25, besoin_k = 70,
  vivace = true, a_planifier = false,
  description = 'Arbre fruitier précoce sensible aux gelées tardives. Hauteur 4-8m, mise à fruit 3-5 ans. Besoin en froid: 400-600h. Rusticité: -18°C. Sol: léger, bien drainé, calcaire toléré, pH 6-8. Distance plantation: 5-6m. Durée productive: 25-40 ans. Floraison très précoce (février-mars). Maladies: moniliose, bactériose, ECA. Ravageurs: pucerons, forficules, acariens. Porte-greffes: prunier Myrobolan, GF31.',
  categorie = 'fruitier'
WHERE espece = 'Abricotier';

-- Olivier
UPDATE especes SET
  rendement = 20,
  besoin_eau = 1,
  besoin_n = 30, besoin_p = 15, besoin_k = 50,
  vivace = true, a_planifier = false,
  description = 'Arbre millénaire méditerranéen. Hauteur 5-15m, mise à fruit 5-8 ans. Besoin en froid: 200-400h. Rusticité: -12°C (selon variété). Sol: sec, calcaire, bien drainé, pH 7-8.5. Distance plantation: 6-8m. Durée productive: 100+ ans. Alternance marquée. Maladies: œil de paon (cycloconium), verticilliose, fumagine. Ravageurs: mouche de l''olive (Bactrocera oleae), cochenille noire, teigne.',
  categorie = 'fruitier'
WHERE espece = 'Olivier';

-- Figuier
UPDATE especes SET
  rendement = 20,
  besoin_eau = 2,
  besoin_n = 30, besoin_p = 15, besoin_k = 50,
  vivace = true, a_planifier = false,
  description = 'Arbre fruitier méditerranéen thermophile. Hauteur 3-10m, mise à fruit 2-4 ans. Besoin en froid: 100-300h. Rusticité: -15°C (parties aériennes). Sol: léger, sec, calcaire toléré, pH 6-8. Distance plantation: 4-6m. Durée productive: 50-100 ans. Variétés bifères (2 récoltes) ou unifères. Maladies: mosaïque du figuier, botrytis. Ravageurs: mouche noire du figuier, psylle, cochenille.',
  categorie = 'fruitier'
WHERE espece = 'Figuier';

-- Noyer
UPDATE especes SET
  rendement = 30,
  besoin_eau = 3,
  besoin_n = 50, besoin_p = 25, besoin_k = 60,
  vivace = true, a_planifier = false,
  description = 'Grand arbre fruitier à noix. Hauteur 15-25m, mise à fruit 5-8 ans. Besoin en froid: 700-1000h. Rusticité: -25°C. Sol: profond, frais, riche, pH 6-7.5. Distance plantation: 10-12m. Durée productive: 50-100 ans. Allélopathie (juglone). Maladies: bactériose, anthracnose. Ravageurs: carpocapse des noix, mouche du brou, pucerons. Porte-greffes: Juglans regia, J. nigra.',
  categorie = 'fruitier'
WHERE espece = 'Noyer';

-- Châtaignier
UPDATE especes SET
  rendement = 40,
  besoin_eau = 3,
  besoin_n = 30, besoin_p = 15, besoin_k = 50,
  vivace = true, a_planifier = false,
  description = 'Grand arbre forestier et fruitier. Hauteur 15-25m, mise à fruit 5-10 ans. Besoin en froid: 600-800h. Rusticité: -20°C. Sol: acide à neutre, bien drainé, siliceux, pH 5-6.5. Distance plantation: 8-12m. Durée productive: 50-100+ ans. Craint le calcaire. Maladies: chancre de l''écorce, encre du châtaignier. Ravageurs: cynips du châtaignier, carpocapse, balanin.',
  categorie = 'fruitier'
WHERE espece = 'Châtaignier';

-- Vigne
UPDATE especes SET
  rendement = 5, -- kg/m² en treille
  besoin_eau = 2,
  besoin_n = 40, besoin_p = 20, besoin_k = 70,
  vivace = true, a_planifier = false,
  description = 'Liane fruitière et viticole. Hauteur palissée 1.5-3m, mise à fruit 3-4 ans. Besoin en froid: 200-400h. Rusticité: -15 à -20°C (selon cépage). Sol: varié, bien drainé, pauvre toléré, pH 5.5-7.5. Distance plantation: 1-2m (rang), 2-3m (inter-rang). Durée productive: 30-50+ ans. Maladies: mildiou, oïdium, botrytis, esca, black-rot. Ravageurs: phylloxera (racines), eudémis, cochylis, cicadelle.',
  categorie = 'fruitier'
WHERE espece = 'Vigne';

-- Citronnier
UPDATE especes SET
  rendement = 25,
  besoin_eau = 4,
  besoin_n = 80, besoin_p = 30, besoin_k = 60,
  vivace = true, a_planifier = false,
  description = 'Agrume remontant, fructifie quasi toute l''année. Hauteur 3-5m, mise à fruit 3-5 ans. Besoin en froid: 0h. Rusticité: -5°C. Sol: riche, bien drainé, légèrement acide, pH 5.5-6.5. Distance plantation: 4-5m. Durée productive: 30-50 ans. En pot au nord de la Loire. Maladies: gommose, mal secco, fumagine. Ravageurs: cochenilles, pucerons, mineuse des agrumes, aleurode.',
  categorie = 'fruitier'
WHERE espece = 'Citronnier';

-- Oranger
UPDATE especes SET
  rendement = 40,
  besoin_eau = 4,
  besoin_n = 80, besoin_p = 30, besoin_k = 70,
  vivace = true, a_planifier = false,
  description = 'Agrume majeur à récolte hivernale. Hauteur 5-10m, mise à fruit 4-6 ans. Besoin en froid: 0h. Rusticité: -5°C. Sol: riche, frais, bien drainé, pH 5.5-7. Distance plantation: 5-6m. Durée productive: 40-80 ans. Culture en pleine terre uniquement zone méditerranéenne/tropicale. Maladies: gommose, tristeza, fumagine. Ravageurs: cochenilles, pucerons, cératite, mineuse.',
  categorie = 'fruitier'
WHERE espece = 'Oranger';

-- Cognassier
UPDATE especes SET
  rendement = 15,
  besoin_eau = 2,
  besoin_n = 30, besoin_p = 15, besoin_k = 50,
  vivace = true, a_planifier = false,
  description = 'Arbre fruitier rustique à fruits parfumés (coings). Hauteur 3-6m, mise à fruit 3-5 ans. Besoin en froid: 400-600h. Rusticité: -20°C. Sol: frais, argileux toléré, pH 6-7.5. Distance plantation: 4-5m. Durée productive: 30-50 ans. Fruits non comestibles crus, excellents en confiture/gelée. Maladies: entomosporiose, moniliose, feu bactérien. Ravageurs: pucerons, carpocapse.',
  categorie = 'fruitier'
WHERE espece = 'Cognassier';

-- Néflier
UPDATE especes SET
  rendement = 10,
  besoin_eau = 2,
  besoin_n = 20, besoin_p = 10, besoin_k = 30,
  vivace = true, a_planifier = false,
  description = 'Petit arbre fruitier rustique à fruits blettis. Hauteur 4-6m, mise à fruit 3-5 ans. Besoin en froid: 500-800h. Rusticité: -25°C. Sol: frais, riche en humus, pH 5.5-7. Distance plantation: 4-5m. Durée productive: 30-50 ans. Récolte après les premières gelées, consommation après blettissement. Maladies: entomosporiose, moniliose. Ravageurs: peu de ravageurs.',
  categorie = 'fruitier'
WHERE espece = 'Néflier';

-- Kiwi
UPDATE especes SET
  rendement = 30,
  besoin_eau = 4,
  besoin_n = 60, besoin_p = 30, besoin_k = 80,
  vivace = true, a_planifier = false,
  description = 'Liane vigoureuse à fruits riches en vitamine C. Hauteur palissée 4-8m, mise à fruit 3-5 ans. Besoin en froid: 600-800h. Rusticité: -15°C (bois) mais sensible aux gelées tardives. Sol: riche, frais, bien drainé, acide à neutre, pH 5.5-6.5. Distance plantation: 4-6m. Durée productive: 30-50 ans. Dioïque: 1 mâle pour 5-8 femelles. Maladies: Pseudomonas syringae (PSA), botrytis. Ravageurs: cochenilles, chenilles.',
  categorie = 'fruitier'
WHERE espece = 'Kiwi';

-- Grenadier
UPDATE especes SET
  rendement = 15,
  besoin_eau = 1,
  besoin_n = 30, besoin_p = 15, besoin_k = 40,
  vivace = true, a_planifier = false,
  description = 'Arbuste/petit arbre méditerranéen à grenades. Hauteur 3-6m, mise à fruit 3-5 ans. Besoin en froid: 100-200h. Rusticité: -12°C. Sol: sec, calcaire toléré, bien drainé, pH 5.5-8. Distance plantation: 3-5m. Durée productive: 30-50 ans. Très résistant à la sécheresse. Maladies: botrytis (pourriture des fruits). Ravageurs: pucerons, mouche méditerranéenne.',
  categorie = 'fruitier'
WHERE espece = 'Grenadier';

-- Plaqueminier (Kaki)
UPDATE especes SET
  rendement = 20,
  besoin_eau = 2,
  besoin_n = 30, besoin_p = 15, besoin_k = 50,
  vivace = true, a_planifier = false,
  description = 'Arbre fruitier asiatique à fruits sucrés. Hauteur 5-10m, mise à fruit 4-6 ans. Besoin en froid: 200-400h. Rusticité: -15°C. Sol: profond, bien drainé, pH 6-7.5. Distance plantation: 5-6m. Durée productive: 40-60 ans. Variétés astringentes (blettissement) ou non-astringentes (PCNA). Maladies: cercosporiose, anthracnose. Ravageurs: cochenille, mouche méditerranéenne.',
  categorie = 'fruitier'
WHERE espece = 'Plaqueminier';

-- Framboisier
UPDATE especes SET
  rendement = 1.5, -- kg/mètre linéaire
  besoin_eau = 3,
  besoin_n = 50, besoin_p = 20, besoin_k = 60,
  vivace = true, a_planifier = false,
  description = 'Arbuste à petits fruits drageonnant. Hauteur 1.2-2m, mise à fruit 1-2 ans. Besoin en froid: 800-1200h. Rusticité: -30°C. Sol: frais, humifère, bien drainé, acide à neutre, pH 5.5-6.5. Distance plantation: 0.4-0.6m (rang), 1.5-2m (inter-rang). Durée productive: 8-12 ans. Remontants (2 récoltes) ou non-remontants (1 récolte). Maladies: botrytis, rouille, dépérissement des rameaux. Ravageurs: ver des framboises (byturus), pucerons, drosophile suzukii.',
  categorie = 'petit_fruit'
WHERE espece = 'Framboisier';

-- Groseillier
UPDATE especes SET
  rendement = 3, -- kg/pied
  besoin_eau = 3,
  besoin_n = 40, besoin_p = 15, besoin_k = 50,
  vivace = true, a_planifier = false,
  description = 'Arbuste à fruits en grappes. Hauteur 1-1.5m, mise à fruit 2-3 ans. Besoin en froid: 800-1000h. Rusticité: -30°C. Sol: frais, riche, bien drainé, pH 6-7. Distance plantation: 1-1.5m (rang), 2m (inter-rang). Durée productive: 10-15 ans. Autofertile mais meilleur avec pollinisation croisée. Maladies: oïdium américain, anthracnose, rouille. Ravageurs: pucerons, tenthrède du groseillier, acariens.',
  categorie = 'petit_fruit'
WHERE espece = 'Groseillier';

-- Cassissier
UPDATE especes SET
  rendement = 3, -- kg/pied
  besoin_eau = 3,
  besoin_n = 40, besoin_p = 15, besoin_k = 50,
  vivace = true, a_planifier = false,
  description = 'Arbuste à baies noires riches en vitamine C. Hauteur 1-1.5m, mise à fruit 2-3 ans. Besoin en froid: 800-1200h. Rusticité: -35°C. Sol: frais, riche, argileux toléré, pH 6-7. Distance plantation: 1-1.5m (rang), 2m (inter-rang). Durée productive: 10-15 ans. Certaines variétés autofertiles. Maladies: oïdium, anthracnose, rouille vésiculeuse. Ravageurs: cécidomyie, pucerons, acarien du cassis.',
  categorie = 'petit_fruit'
WHERE espece = 'Cassissier';

-- Mûrier sans épine
UPDATE especes SET
  rendement = 5, -- kg/pied
  besoin_eau = 3,
  besoin_n = 40, besoin_p = 15, besoin_k = 50,
  vivace = true, a_planifier = false,
  description = 'Ronce cultivée sans épines à gros fruits. Hauteur palissée 2-3m, mise à fruit 2-3 ans. Besoin en froid: 300-600h. Rusticité: -15°C. Sol: riche, frais, bien drainé, pH 5.5-6.5. Distance plantation: 2-3m (rang), 2-3m (inter-rang). Durée productive: 10-20 ans. Maladies: rouille, botrytis. Ravageurs: drosophile suzukii, pucerons.',
  categorie = 'petit_fruit'
WHERE espece = 'Mûrier sans épine';

-- Argousier
UPDATE especes SET
  rendement = 5, -- kg/pied
  besoin_eau = 1,
  besoin_n = 10, besoin_p = 10, besoin_k = 20,
  vivace = true, a_planifier = false,
  description = 'Arbuste épineux à baies très riches en vitamine C. Hauteur 2-5m, mise à fruit 3-4 ans. Besoin en froid: 500-800h. Rusticité: -35°C. Sol: pauvre, sableux, drainant, pH 6-8. Distance plantation: 1-2m. Durée productive: 15-20 ans. Dioïque: 1 mâle pour 5-6 femelles. Fixateur d''azote (Frankia). Maladies: verticilliose (rare). Ravageurs: très peu.',
  categorie = 'petit_fruit'
WHERE espece = 'Argousier';


-- =============================================================
-- 2. VARIÉTÉS FRUITIÈRES
-- =============================================================

-- ─── POMMIER ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Golden Delicious', 'Pommier', 38, 6, 'Variété la plus cultivée au monde. Fruit jaune doré, chair fine, sucrée, juteuse. Très bonne conservation (4-5 mois). Pollinisation croisée nécessaire. Groupe floraison: moyen. Sensible tavelure et oïdium. Vigueur moyenne. 30-50 kg/arbre adulte.', false),
('Granny Smith', 'Pommier', 42, 8, 'Pomme verte acidulée, ferme et croquante. Excellente conservation (5-6 mois). Besoin de chaleur pour mûrir. Pollinisation croisée nécessaire. Groupe floraison: tardif. Résistante aux maladies. Vigueur forte. 25-40 kg/arbre.', false),
('Gala', 'Pommier', 35, 4, 'Fruit rouge-orangé sur fond jaune, sucré, peu acide, croquant. Bonne conservation (3-4 mois). Pollinisation croisée. Groupe floraison: moyen. Sensible tavelure. Vigueur moyenne. 30-50 kg/arbre.', false),
('Fuji', 'Pommier', 42, 6, 'Fruit rouge sur fond jaune-vert, très sucré, croquant, juteux. Excellente conservation (5-6 mois). Pollinisation croisée. Groupe floraison: tardif. Sensible tavelure et feu bactérien. Vigueur forte. 30-50 kg/arbre.', false),
('Reine des Reinettes', 'Pommier', 35, 4, 'Variété ancienne française. Fruit jaune strié rouge, chair ferme, parfumée, sucrée-acidulée. Conservation moyenne (2-3 mois). Bon pollinisateur. Groupe floraison: moyen. Moyennement résistante. Vigueur moyenne. 25-40 kg/arbre.', false),
('Belle de Boskoop', 'Pommier', 40, 6, 'Grande pomme verte/rouge, acidulée, excellente en cuisine. Bonne conservation (4-5 mois). Triploïde: mauvais pollinisateur. Groupe floraison: moyen. Résistante tavelure. Vigueur très forte. 40-60 kg/arbre.', false),
('Elstar', 'Pommier', 36, 4, 'Fruit rouge-orangé, juteuse, acidulée-sucrée. Conservation moyenne (2-3 mois). Pollinisation croisée. Groupe floraison: moyen. Sensible tavelure. Vigueur moyenne. 25-40 kg/arbre.', false),
('Jonagold', 'Pommier', 39, 6, 'Grosse pomme rouge-jaune, sucrée, juteuse. Bonne conservation (4-5 mois). Triploïde. Groupe floraison: moyen. Sensible oïdium. Vigueur forte. 35-50 kg/arbre.', false),
('Braeburn', 'Pommier', 40, 6, 'Fruit rouge-vert, croquant, acidulé-sucré, aromatique. Excellente conservation (5 mois). Pollinisation croisée. Groupe floraison: tardif. Sensible tavelure. Vigueur moyenne. 30-45 kg/arbre.', false),
('Cox Orange Pippin', 'Pommier', 38, 3, 'Pomme anglaise de référence, très aromatique, chair fine. Conservation limitée (2 mois). Pollinisation croisée. Groupe floraison: moyen. Sensible tavelure et chancre. Vigueur faible à moyenne. 20-30 kg/arbre.', false),
('Reinette Clochard', 'Pommier', 41, 6, 'Variété ancienne du Poitou. Fruit jaune-vert, rustique, acidulé. Excellente conservation. Pollinisation croisée. Résistante. Vigueur forte. 30-40 kg/arbre.', false),
('Chantecler (Belchard)', 'Pommier', 39, 5, 'Fruit jaune, très parfumé, sucré-acidulé. Bonne conservation (4 mois). Pollinisation croisée. Assez résistante tavelure. Vigueur moyenne. 25-40 kg/arbre.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── POIRIER ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Williams (Bon Chrétien)', 'Poirier', 33, 3, 'Variété de référence mondiale. Fruit jaune doré, chair fine, juteuse, très parfumée, sucrée. Conservation: 1 mois (frigo: 3 mois). Pollinisation croisée. Groupe floraison: moyen. Sensible feu bactérien. Vigueur moyenne-forte. 20-40 kg/arbre.', false),
('Conférence', 'Poirier', 39, 6, 'Fruit allongé, peau bronze-vert, chair fondante, sucrée. Excellente conservation (3-5 mois). Partiellement autofertile. Groupe floraison: moyen. Assez résistante. Vigueur moyenne. 25-40 kg/arbre.', false),
('Comice (Doyenné du Comice)', 'Poirier', 40, 4, 'Considérée la meilleure poire au monde. Grosse, juteuse, très sucrée, fondante. Conservation: 2-3 mois. Pollinisation croisée. Groupe floraison: tardif. Sensible tavelure. Vigueur moyenne. 15-30 kg/arbre.', false),
('Louise Bonne d''Avranches', 'Poirier', 38, 3, 'Variété ancienne française. Fruit moyen, rouge sur fond vert, chair fine, juteuse. Conservation: 1-2 mois. Pollinisation croisée. Groupe floraison: moyen. Résistante. Vigueur forte. 25-35 kg/arbre.', false),
('Beurré Hardy', 'Poirier', 37, 3, 'Fruit bronzé, gros, chair fine, fondante, sucrée, parfum de rose. Conservation: 1-2 mois. Pollinisation croisée. Groupe floraison: précoce. Résistante tavelure. Vigueur forte. 25-40 kg/arbre.', false),
('Guyot (Dr Jules Guyot)', 'Poirier', 30, 2, 'Poire d''été précoce. Fruit jaune, chair fine, juteuse, sucrée. Conservation très courte (1-2 semaines). Pollinisation croisée. Groupe floraison: précoce. Sensible feu bactérien. Vigueur moyenne. 20-30 kg/arbre.', false),
('Harrow Sweet', 'Poirier', 37, 3, 'Variété canadienne résistante au feu bactérien. Fruit jaune, sucré, juteux. Conservation: 2-3 mois. Pollinisation croisée. Vigueur moyenne. 20-35 kg/arbre.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── CERISIER ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Burlat', 'Cerisier', 21, 2, 'Cerise précoce de référence. Gros fruit rouge foncé, chair ferme, sucrée, juteuse. Pollinisation croisée nécessaire (Napoléon, Summit). Groupe floraison: précoce. Sensible moniliose et éclatement. Vigueur forte. 30-50 kg/arbre.', false),
('Napoléon (Royal Ann)', 'Cerisier', 24, 2, 'Bigarreau rose-jaune, chair ferme, sucrée-acidulée. Bon pollinisateur universel. Groupe floraison: moyen. Assez résistante. Vigueur forte. 30-50 kg/arbre.', false),
('Summit', 'Cerisier', 25, 2, 'Très gros fruit rouge, chair ferme, sucrée. Pollinisation croisée. Groupe floraison: moyen. Résistante éclatement. Vigueur forte. 25-40 kg/arbre.', false),
('Reverchon', 'Cerisier', 25, 2, 'Gros bigarreau rouge foncé, chair ferme, sucrée. Pollinisation croisée. Groupe floraison: moyen-tardif. Résistante éclatement. Vigueur forte. 25-40 kg/arbre.', false),
('Moreau', 'Cerisier', 23, 2, 'Fruit rouge-noir, chair ferme, sucrée. Pollinisation croisée. Groupe floraison: moyen. Vigueur forte. 25-40 kg/arbre.', false),
('Griotte de Montmorency', 'Cerisier', 26, 2, 'Cerise acide de référence. Fruit rouge clair, chair tendre, acidulée. Autofertile. Idéale confitures, clafoutis. Vigueur moyenne. 15-25 kg/arbre.', false),
('Hedelfingen', 'Cerisier', 25, 2, 'Bigarreau rouge-noir, chair ferme, sucrée. Pollinisation croisée. Groupe floraison: tardif. Résistante éclatement et moniliose. Vigueur forte. 30-50 kg/arbre.', false),
('Kordia', 'Cerisier', 25, 2, 'Gros fruit rouge foncé, chair ferme, sucrée, peu sensible éclatement. Pollinisation croisée. Groupe floraison: tardif. Résistante. Vigueur moyenne. 25-40 kg/arbre.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── PRUNIER ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Reine Claude Dorée', 'Prunier', 31, 3, 'Prune ronde vert-doré de référence française. Chair fondante, très sucrée, parfumée. Pollinisation croisée. Groupe floraison: moyen. Sensible moniliose. Vigueur forte. 25-40 kg/arbre.', false),
('Mirabelle de Nancy', 'Prunier', 33, 2, 'Petite prune jaune-doré, très sucrée, parfumée. AOC Lorraine. Partiellement autofertile. Groupe floraison: moyen. Assez résistante. Vigueur forte. 30-50 kg/arbre.', false),
('Quetsche d''Alsace', 'Prunier', 36, 3, 'Prune oblongue violette, chair jaune ferme. Excellente en tarte et séchée. Autofertile. Groupe floraison: tardif. Résistante. Vigueur moyenne. 25-40 kg/arbre.', false),
('Reine Claude d''Oullins', 'Prunier', 30, 2, 'Grosse prune jaune-vert, sucrée, juteuse. Bon pollinisateur. Autofertile. Groupe floraison: moyen. Vigueur forte. 30-50 kg/arbre.', false),
('Stanley', 'Prunier', 36, 3, 'Prune violette oblongue, chair jaune, ferme. Bonne pour séchage (pruneau). Autofertile. Groupe floraison: tardif. Vigueur moyenne. 25-40 kg/arbre.', false),
('Mirabelle de Metz', 'Prunier', 33, 2, 'Plus petite que Nancy, très parfumée, très sucrée. Autofertile. Vigueur moyenne. 20-35 kg/arbre.', false),
('Reine Claude de Bavay', 'Prunier', 37, 3, 'Prune verte tardive, sucrée, fondante. Partiellement autofertile. Vigueur forte. 25-40 kg/arbre.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── PÊCHER ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Redhaven', 'Pêcher', 30, 2, 'Référence mondiale. Fruit rouge/jaune, chair jaune, ferme, sucrée. Autofertile. Floraison: moyenne. Bonne résistance cloque. Vigueur moyenne. 15-25 kg/arbre.', false),
('Suncrest', 'Pêcher', 33, 2, 'Gros fruit jaune-rouge, chair jaune, juteuse, très sucrée. Autofertile. Sensible cloque. Vigueur forte. 20-30 kg/arbre.', false),
('Amsden', 'Pêcher', 26, 2, 'Pêche précoce. Fruit moyen, rouge, chair blanche, fondante, parfumée. Autofertile. Floraison: précoce. Sensible cloque. Vigueur moyenne. 15-20 kg/arbre.', false),
('Dixired', 'Pêcher', 28, 2, 'Fruit rouge vif, chair jaune, ferme, sucrée. Autofertile. Floraison: précoce. Vigueur moyenne. 15-25 kg/arbre.', false),
('Reine des Vergers', 'Pêcher', 34, 2, 'Variété tardive. Gros fruit jaune strié rouge, chair blanche, vineuse. Autofertile. Bonne résistance. Vigueur forte. 20-30 kg/arbre.', false),
('Nectarine Morton', 'Pêcher', 31, 2, 'Nectarine à chair jaune, ferme, sucrée. Peau lisse rouge. Autofertile. Vigueur moyenne. 15-25 kg/arbre.', false),
('Plate de Chine (Saturn)', 'Pêcher', 30, 2, 'Pêche plate originale. Chair blanche, sucrée, peu acide. Autofertile. Vigueur moyenne. 15-20 kg/arbre.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── ABRICOTIER ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Bergeron', 'Abricotier', 30, 3, 'Variété française de référence. Gros fruit orange, chair ferme, sucrée-acidulée. Bonne conservation. Autofertile. Floraison: tardive. Assez résistante moniliose. Vigueur forte. 25-40 kg/arbre.', false),
('Polonais (Orangé de Provence)', 'Abricotier', 27, 2, 'Fruit moyen, orange vif, chair fine, juteuse, parfumée. Autofertile. Floraison: moyenne. Sensible moniliose. Vigueur moyenne. 20-30 kg/arbre.', false),
('Rouge du Roussillon', 'Abricotier', 26, 2, 'Fruit petit-moyen, orange-rouge, chair fondante, très parfumée. Autofertile. Floraison: précoce. Sensible gel. Vigueur forte. 20-35 kg/arbre.', false),
('Goldrich', 'Abricotier', 28, 2, 'Gros fruit orange, chair ferme, peu fibreuse, sucrée. Pollinisation croisée. Floraison: précoce. Vigueur forte. 25-35 kg/arbre.', false),
('Luizet', 'Abricotier', 28, 2, 'Variété ancienne rustique. Fruit moyen orange, chair ferme, acidulée. Autofertile. Bonne résistance au froid. Vigueur forte. 20-30 kg/arbre.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── OLIVIER ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Aglandau (Verdale de Carpentras)', 'Olivier', 44, 4, 'Variété provençale à huile de référence. Petit fruit ovoïde. Rendement huile: 18-22%. Rustique (-15°C). Pollinisation croisée. Vigueur forte. 15-25 kg olives/arbre.', false),
('Picholine', 'Olivier', 40, 4, 'Olive verte de table et huile. Fruit allongé. Fruité vert intense. Pollinisation croisée. Vigueur forte. Résistante au froid. 15-25 kg/arbre.', false),
('Lucques', 'Olivier', 40, 4, 'Olive verte de table haut de gamme (AOC). Fruit en croissant, chair fine, fondante. Pollinisation croisée (Verdale). Vigueur moyenne. 10-20 kg/arbre.', false),
('Tanche', 'Olivier', 44, 4, 'Olive noire de Nyons (AOC). Double usage table/huile. Huile douce fruitée. Rustique (-15°C). Partiellement autofertile. Vigueur forte. 15-25 kg/arbre.', false),
('Bouteillan', 'Olivier', 42, 4, 'Variété provençale à huile. Fruité mûr. Pollinisation croisée. Bon pollinisateur. Vigueur forte. 15-20 kg/arbre.', false),
('Arbequina', 'Olivier', 42, 4, 'Variété catalane très productive. Petit fruit. Huile douce fruitée. Partiellement autofertile. Adaptée culture intensive. Vigueur faible. 20-30 kg/arbre.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── FIGUIER ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Violette de Sollies', 'Figuier', 35, 4, 'AOP Figue de Sollies. Fruit violet-noir, chair rouge, très sucrée. Unifère. Récolte août-novembre. Vigueur moyenne. Rustique (-12°C). 20-30 kg/arbre.', false),
('Goutte d''Or', 'Figuier', 30, 6, 'Figue jaune dorée, chair rose, très sucrée, mielleuse. Bifère. Rustique (-15°C). Autofertile. Vigueur forte. 15-25 kg/arbre.', false),
('Ronde de Bordeaux', 'Figuier', 28, 6, 'Petite figue violette précoce, très sucrée. Unifère. Très rustique (-18°C). Autofertile. Vigueur moyenne. 15-20 kg/arbre.', false),
('Dauphine', 'Figuier', 28, 6, 'Grosse figue violette, chair rose, sucrée. Bifère. Rustique (-12°C). Autofertile. Vigueur forte. 20-30 kg/arbre.', false),
('Brown Turkey', 'Figuier', 28, 8, 'Figue brun-violet, chair rose-rouge, sucrée. Bifère. Très rustique (-18°C). Autofertile. La plus adaptée au nord. Vigueur moyenne. 15-25 kg/arbre.', false),
('Pastilière (Rouge de Bordeaux)', 'Figuier', 35, 4, 'Figue allongée, violet-noir, chair rouge, très sucrée. Unifère, tardive. Autofertile. Vigueur forte. 15-25 kg/arbre.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── NOYER ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Franquette', 'Noyer', 39, 3, 'Variété française de référence (AOC Grenoble). Noix grosse, savoureuse. Débourrement tardif (résiste aux gelées). Pollinisation croisée. Vigueur forte. 30-50 kg/arbre adulte.', false),
('Lara', 'Noyer', 38, 3, 'Variété précoce et productive. Noix grosse, facile à cerner. Débourrement précoce. Pollinisation: Franquette. Vigueur forte. 25-40 kg/arbre.', false),
('Fernor', 'Noyer', 40, 3, 'Variété tardive INRAE. Noix moyenne, bon cerneaux. Résistante bactériose. Pollinisation croisée. Vigueur moyenne. 25-40 kg/arbre.', false),
('Parisienne', 'Noyer', 39, 3, 'Grosse noix, cerneaux clairs. Débourrement tardif. Pollinisation: Franquette ou Mayette. Vigueur forte. 25-40 kg/arbre.', false),
('Mayette', 'Noyer', 39, 3, 'Variété ancienne, noix ronde, cerneaux fins. Débourrement tardif. Pollinisation: Franquette. Vigueur forte. 20-35 kg/arbre.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── CHÂTAIGNIER ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Marigoule', 'Châtaignier', 40, 3, 'Hybride euro-japonais. Gros fruit, peu cloisonné, savoureux. Résistant chancre et encre. Pollinisation croisée. Vigueur forte. 30-50 kg/arbre.', false),
('Bouche de Bétizac', 'Châtaignier', 39, 3, 'Hybride très productif. Très gros fruits (marrons). Résistant cynips. Pollinisation croisée (Marigoule). Vigueur forte. 30-50 kg/arbre.', false),
('Comballe', 'Châtaignier', 41, 3, 'Variété traditionnelle. Fruit moyen, très savoureux, bonne conservation. Résistante. Pollinisation croisée. Vigueur forte. 25-40 kg/arbre.', false),
('Belle Épine', 'Châtaignier', 41, 3, 'Variété ancienne rustique. Gros fruit, bonne qualité. Pollinisation croisée. Vigueur forte. 20-35 kg/arbre.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── VIGNE DE TABLE ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Chasselas', 'Vigne', 35, 3, 'Cépage de table de référence suisse/français. Raisin blanc doré, sucré, fondant. Autofertile. Précoce. Sensible mildiou et oïdium. Vigueur moyenne. 5-8 kg/pied.', false),
('Muscat de Hambourg', 'Vigne', 37, 3, 'Raisin noir musqué de référence. Grains moyens, très parfumé. Autofertile. Moyen-tardif. Sensible oïdium. Vigueur forte. 5-8 kg/pied.', false),
('Italia (Ideal)', 'Vigne', 39, 3, 'Gros raisins blancs musqués, croquants. Tardif, besoin de chaleur. Autofertile. Vigueur forte. 6-10 kg/pied.', false),
('Alphonse Lavallée', 'Vigne', 38, 3, 'Gros raisins noirs, chair ferme, peu sucré. Tardif. Autofertile. Résistant. Vigueur forte. 5-8 kg/pied.', false),
('Muscat Bleu', 'Vigne', 36, 3, 'Raisin bleu-noir, musqué, résistant au mildiou et oïdium. Autofertile. Vigueur forte. Idéal pour culture bio. 4-7 kg/pied.', false),
('Lival', 'Vigne', 37, 2, 'Raisin noir, gros grains, sucré. Moyen. Autofertile. Résistant. Vigueur forte. 5-8 kg/pied.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── FRAMBOISIER ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Meeker', 'Framboisier', 26, 4, 'Non-remontant. Fruit rouge foncé, ferme, savoureux. Très productif. Rustique. 2-3 kg/mètre linéaire. Récolte juin-juillet.', false),
('Heritage', 'Framboisier', 32, 8, 'Remontant. Fruit rouge moyen, ferme, acidulé. Très productif. Rustique (-25°C). 1.5-2.5 kg/ml. Récolte août-octobre.', false),
('Tulameen', 'Framboisier', 26, 4, 'Non-remontant. Très gros fruit rouge vif, saveur excellente. Référence qualité. Moyennement rustique. 2-3 kg/ml.', false),
('Autumn Bliss', 'Framboisier', 30, 6, 'Remontant précoce. Fruit rouge, sucré. Résistant pucerons. Rustique. 1.5-2.5 kg/ml. Récolte août-septembre.', false),
('Maravilla', 'Framboisier', 25, 10, 'Remontant très productif. Gros fruit rouge clair, ferme, sucré. Longue période récolte. 2-3.5 kg/ml.', false),
('Glen Ample', 'Framboisier', 26, 4, 'Non-remontant sans épines. Gros fruit rouge, ferme. Très productif. Résistant. 2.5-3.5 kg/ml.', false),
('Zeva', 'Framboisier', 28, 8, 'Remontant. Fruit rouge moyen, très parfumé. Rustique. 1.5-2 kg/ml.', false),
('Fallgold', 'Framboisier', 32, 6, 'Remontant à fruits jaunes. Fruit sucré, doux. Original. Rustique. 1-2 kg/ml.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── GROSEILLIER ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Jonkheer van Tets', 'Groseillier', 26, 2, 'Groseille rouge précoce. Grappes longues, gros grains, acidulés. Très productif. Autofertile. Résistant oïdium. 3-5 kg/pied.', false),
('Rovada', 'Groseillier', 28, 3, 'Groseille rouge tardive. Très longues grappes, gros grains. Excellente qualité. Autofertile. 3-5 kg/pied.', false),
('Versaillaise Rouge', 'Groseillier', 27, 2, 'Classique française. Grappes moyennes, grains rouges acidulés. Autofertile. Productif. 3-4 kg/pied.', false),
('Blanka', 'Groseillier', 28, 2, 'Groseille blanche (rare). Grains translucides, moins acides. Autofertile. Productif. 3-4 kg/pied.', false),
('Hinnomäki Rouge', 'Groseillier', 27, 2, 'Groseille à maquereau rouge. Gros fruit sucré. Résistant oïdium. Autofertile. 3-5 kg/pied.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── CASSISSIER ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Noir de Bourgogne', 'Cassissier', 27, 2, 'Variété traditionnelle française de référence. Petit fruit très parfumé, aromatique. Autofertile. Sensible oïdium. 2-3 kg/pied.', false),
('Andega', 'Cassissier', 27, 2, 'Variété productive. Gros grains. Bon pour jus et confitures. Autofertile. Assez résistant. 3-4 kg/pied.', false),
('Titania', 'Cassissier', 28, 2, 'Très gros grains, très productif. Résistant oïdium et rouille. Autofertile. Vigueur forte. 4-5 kg/pied.', false),
('Big Ben', 'Cassissier', 26, 2, 'Très gros fruits sucrés (2x taille normale). Récolte facile. Autofertile. Résistant. 3-5 kg/pied.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── MÛRIER SANS ÉPINE ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Thornfree', 'Mûrier sans épine', 33, 4, 'Variété classique sans épines. Gros fruits noirs, acides puis sucrés à maturité. Très productif. Semi-érigé. 5-8 kg/pied.', false),
('Loch Ness', 'Mûrier sans épine', 32, 4, 'Gros fruits noirs, fermes, sucrés. Port érigé. Très productif. Résistant. 5-10 kg/pied.', false),
('Triple Crown', 'Mûrier sans épine', 34, 4, 'Gros fruits noirs, excellente saveur. Semi-érigé. Très productif. Résistant. Rustique. 8-12 kg/pied.', false),
('Dirksen Thornless', 'Mûrier sans épine', 31, 3, 'Fruits moyens, sucrés. Port rampant, facile à palisser. Productif. Rustique. 4-6 kg/pied.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── KIWI ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Hayward', 'Kiwi', 43, 3, 'Variété femelle de référence mondiale. Gros fruit ovoïde, chair verte, acidulée-sucrée. Pollinisation par mâle (Tomuri). Excellente conservation (3-5 mois). 30-50 kg/pied. Vigueur très forte.', false),
('Solissimo (Renact)', 'Kiwi', 42, 3, 'Variété autofertile. Fruit moyen, bonne qualité. Pas besoin de plant mâle. 15-25 kg/pied. Vigueur forte.', false),
('Jenny', 'Kiwi', 42, 3, 'Autofertile. Fruit plus petit que Hayward, bonne saveur. 10-20 kg/pied. Vigueur moyenne.', false),
('Issai (Actinidia arguta)', 'Kiwi', 39, 2, 'Kiwaï (mini-kiwi). Petit fruit lisse, peau comestible, très sucré. Autofertile. Très rustique (-25°C). 5-10 kg/pied.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── GRENADIER ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Wonderful', 'Grenadier', 42, 3, 'Variété la plus cultivée au monde. Gros fruit rouge, grains rouge foncé, acidulé-sucré. Autofertile. Bonne conservation. 15-25 kg/arbre.', false),
('Mollar de Elche', 'Grenadier', 40, 3, 'Variété espagnole. Gros fruit, grains roses, très doux, peu acide. Autofertile. 15-25 kg/arbre.', false),
('Fina Tendral', 'Grenadier', 42, 3, 'Variété espagnole tardive. Fruit moyen, grains rouge foncé, sucré. Bonne conservation. Autofertile. 15-20 kg/arbre.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── PLAQUEMINIER (KAKI) ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Fuyu', 'Plaqueminier', 42, 3, 'Non-astringent (PCNA). Fruit aplati, orange, consommable ferme. Le plus cultivé au monde. Autofertile. 20-30 kg/arbre.', false),
('Hachiya', 'Plaqueminier', 43, 3, 'Astringent. Gros fruit conique orange-rouge. Consommable après blettissement. Autofertile. Chair fondante, très sucrée. 20-30 kg/arbre.', false),
('Muscat (Cioccolatino)', 'Plaqueminier', 41, 3, 'Astringent à chair foncée si pollinisé. Saveur musquée unique. Partiellement autofertile. 15-25 kg/arbre.', false),
('Rojo Brillante', 'Plaqueminier', 43, 3, 'Astringent. Gros fruit rouge-orangé, chair ferme après traitement CO2 (Persimon). Vigueur forte. 20-30 kg/arbre.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── COGNASSIER ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Champion', 'Cognassier', 40, 3, 'Gros coing piriforme, très parfumé. Très productif. Autofertile. Résistant. Vigueur moyenne. 15-25 kg/arbre.', false),
('Vranja', 'Cognassier', 40, 3, 'Très gros coing (300-500g), piriforme, parfumé. Autofertile. Vigueur forte. 15-25 kg/arbre.', false),
('Géant de Leskovac', 'Cognassier', 41, 3, 'Coing géant (500g+), pomiforme. Très productif. Autofertile. Vigueur forte. 20-30 kg/arbre.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── NÉFLIER ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Nottingham', 'Néflier', 43, 3, 'Petits fruits très parfumés et savoureux après blettissement. Autofertile. Rustique. Vigueur moyenne. 8-15 kg/arbre.', false),
('Royal', 'Néflier', 43, 3, 'Gros fruits, bonne qualité. Autofertile. Vigueur moyenne. 10-15 kg/arbre.', false),
('Dutch (Monstrueuse d''Evreinoff)', 'Néflier', 43, 3, 'Très gros fruits. Autofertile. Le plus planté. Vigueur forte. 10-20 kg/arbre.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── CITRONNIER ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Quatre Saisons (Eureka)', 'Citronnier', 1, 52, 'Remontant, fructifie toute l''année. Fruit jaune classique, juteux, acide. Vigueur moyenne. 20-30 kg/arbre. Le plus cultivé en France.', false),
('Meyer', 'Citronnier', 1, 52, 'Hybride citron-mandarine. Fruit orange-jaune, moins acide, peau fine. Très ornemental. Rustique (-7°C). Vigueur faible. 10-20 kg/arbre.', false),
('Yuzu', 'Citronnier', 44, 6, 'Agrume japonais très parfumé. Fruit petit, jaune, très aromatique. Le plus rustique des agrumes (-12°C). Vigueur forte. 5-15 kg/arbre.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── ORANGER ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Washington Navel', 'Oranger', 48, 8, 'Orange à nombril, sans pépins. Chair juteuse, sucrée. Récolte décembre-mars. Vigueur forte. 40-60 kg/arbre.', false),
('Valencia Late', 'Oranger', 12, 10, 'Orange à jus de référence. Tardive (mars-juin). Très juteuse. Vigueur forte. 40-60 kg/arbre.', false),
('Sanguinelli', 'Oranger', 4, 8, 'Orange sanguine. Chair rouge, saveur originale. Récolte janvier-mars. Vigueur moyenne. 30-50 kg/arbre.', false),
('Maltaise', 'Oranger', 4, 8, 'Orange demi-sanguine tunisienne. Très juteuse, parfumée. Récolte janvier-mars. Vigueur moyenne. 30-50 kg/arbre.', false)
ON CONFLICT (variete) DO NOTHING;

-- ─── ARGOUSIER ───
INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description, bio) VALUES
('Leikora', 'Argousier', 35, 3, 'Variété femelle très productive. Gros fruits orange. Pollinisation par mâle (Pollmix). 5-8 kg/pied.', false),
('Hergo', 'Argousier', 34, 3, 'Femelle précoce. Fruits orange vif, moins acides. Récolte facile. 4-6 kg/pied.', false),
('Pollmix', 'Argousier', 0, 0, 'Variété mâle pollinisatrice. 1 mâle pour 5-6 femelles. Pas de fruits.', false)
ON CONFLICT (variete) DO NOTHING;

COMMIT;
