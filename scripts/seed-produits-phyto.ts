/**
 * Seed initial du référentiel ProduitPhyto (PROMPT 11 LOT A).
 *
 * Classification réglementaire :
 *   - Chimique conventionnel
 *   - Substance de base / PNPP
 *   - Biocontrôle (liste DGAL — produits homologués biocontrôle)
 *   - Autorisé AB (annexe II du règlement (UE) 2021/1165)
 *   - Mécanique (piège, filet, confusion : pas de molécule active)
 *
 * Notes :
 *   - "Autorisé AB" peut se combiner avec "Biocontrôle" — ici on choisit la
 *     classification la plus parlante pour le maraîcher. Le flag `autoriseAB`
 *     est source de vérité pour le filtre AB.
 *   - Roténone : autorisation AB retirée par l'UE en 2008 → marquée
 *     "Chimique conventionnel" + autoriseAB=false. Affichée pour bloquer
 *     l'usage historique en lot non-AB.
 *
 * Usage :
 *   npx tsx scripts/seed-produits-phyto.ts
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

type Produit = {
  id: string
  nomCommercial: string
  substanceActive: string
  amm?: string
  classification:
    | "Chimique conventionnel"
    | "Substance de base / PNPP"
    | "Biocontrôle"
    | "Autorisé AB"
    | "Mécanique"
  autoriseAB: boolean
  zntAquatiqueM?: number
  darJours?: number
  doseHomologuee?: string
  plafondAB?: string
  notes?: string
}

const produits: Produit[] = [
  // === FONGICIDES MINÉRAUX (autorisés AB) ===
  {
    id: "phyto-bouillie-bordelaise",
    nomCommercial: "Bouillie bordelaise",
    substanceActive: "Sulfate de cuivre + chaux",
    classification: "Autorisé AB",
    autoriseAB: true,
    zntAquatiqueM: 5,
    darJours: 21,
    doseHomologuee: "0,5-1 kg/hl",
    plafondAB: "Cu : 28 kg/ha sur 7 ans glissants",
    notes: "Classification corrigée — c'est un produit chimique (Cu²⁺) autorisé en AB sous plafond cuivre.",
  },
  {
    id: "phyto-soufre-poudre",
    nomCommercial: "Soufre poudrage",
    substanceActive: "Soufre élémentaire",
    classification: "Autorisé AB",
    autoriseAB: true,
    zntAquatiqueM: 5,
    darJours: 5,
    doseHomologuee: "10-30 kg/ha",
    notes: "Fongicide minéral. Évite traitement > 28°C (phytotoxicité).",
  },
  {
    id: "phyto-soufre-mouillable",
    nomCommercial: "Soufre mouillable",
    substanceActive: "Soufre élémentaire (suspension)",
    classification: "Autorisé AB",
    autoriseAB: true,
    zntAquatiqueM: 5,
    darJours: 5,
    doseHomologuee: "5-10 kg/ha",
  },
  {
    id: "phyto-huile-blanche",
    nomCommercial: "Huile blanche minérale (paraffinique)",
    substanceActive: "Huile de pétrole paraffinique",
    classification: "Autorisé AB",
    autoriseAB: true,
    zntAquatiqueM: 5,
    darJours: 14,
    doseHomologuee: "1-3 % en hiver",
    notes: "Insecticide d'hiver — étouffement cochenilles/pucerons.",
  },
  {
    id: "phyto-kaolinite",
    nomCommercial: "Kaolinite (Surround)",
    substanceActive: "Kaolin calciné",
    classification: "Autorisé AB",
    autoriseAB: true,
    zntAquatiqueM: 5,
    darJours: 0,
    doseHomologuee: "20-50 kg/ha",
    notes: "Barrière physique anti-psylles, carpocapse, mouche cerise.",
  },

  // === BIOCONTRÔLES ===
  {
    id: "phyto-bt-kurstaki",
    nomCommercial: "Bacillus thuringiensis Kurstaki (Dipel, Delfin)",
    substanceActive: "Bacillus thuringiensis var. kurstaki",
    classification: "Biocontrôle",
    autoriseAB: true,
    zntAquatiqueM: 5,
    darJours: 0,
    doseHomologuee: "1-1,5 kg/ha",
    notes: "Insecticide bactérien — chenilles (piéride, carpocapse, noctuelles).",
  },
  {
    id: "phyto-bt-tenebrionis",
    nomCommercial: "Bacillus thuringiensis Tenebrionis (Novodor)",
    substanceActive: "Bacillus thuringiensis var. tenebrionis",
    classification: "Biocontrôle",
    autoriseAB: true,
    zntAquatiqueM: 5,
    darJours: 0,
    notes: "Insecticide bactérien spécifique doryphore (Coleoptera).",
  },
  {
    id: "phyto-spinosad",
    nomCommercial: "Spinosad (Success 4)",
    substanceActive: "Spinosyne (extrait Saccharopolyspora)",
    classification: "Biocontrôle",
    autoriseAB: true,
    zntAquatiqueM: 20,
    darJours: 7,
    doseHomologuee: "0,15-0,2 L/ha",
    plafondAB: "Restreint : max 3 applications/an, toxique pour abeilles (épandre soir).",
  },
  {
    id: "phyto-pyrethre-vegetal",
    nomCommercial: "Pyrévert (pyrèthre végétal)",
    substanceActive: "Pyréthrines naturelles",
    classification: "Biocontrôle",
    autoriseAB: true,
    zntAquatiqueM: 20,
    darJours: 3,
    notes: "Insecticide à large spectre, dégradation rapide UV.",
  },
  {
    id: "phyto-pheromones-cydia",
    nomCommercial: "Phéromones confusion sexuelle carpocapse",
    substanceActive: "(E,E)-8,10-dodécadiényl acétate",
    classification: "Biocontrôle",
    autoriseAB: true,
    notes: "Diffuseurs (Isomate, Rak3) à poser fin avril, 500 diffuseurs/ha.",
  },
  {
    id: "phyto-pheromones-eudemis",
    nomCommercial: "Phéromones confusion sexuelle Eudémis (vigne)",
    substanceActive: "(E,Z)-7,9-dodécadiényl acétate",
    classification: "Biocontrôle",
    autoriseAB: true,
  },
  {
    id: "phyto-trichogramme",
    nomCommercial: "Trichogrammes (Trichogramma brassicae)",
    substanceActive: "Auxiliaire entomophage (lâcher)",
    classification: "Biocontrôle",
    autoriseAB: true,
    notes: "Lâcher inondatif contre pyrale du maïs, noctuelles.",
  },
  {
    id: "phyto-coccinelles",
    nomCommercial: "Coccinelles (Adalia bipunctata)",
    substanceActive: "Auxiliaire prédateur (lâcher)",
    classification: "Biocontrôle",
    autoriseAB: true,
    notes: "Lâcher inondatif anti-pucerons sous serre.",
  },
  {
    id: "phyto-cuivre-hydroxyde",
    nomCommercial: "Hydroxyde de cuivre (Champ flo, Funguran)",
    substanceActive: "Hydroxyde de cuivre",
    classification: "Autorisé AB",
    autoriseAB: true,
    zntAquatiqueM: 20,
    darJours: 14,
    plafondAB: "Cu : 28 kg/ha sur 7 ans glissants (cumulé toutes formes Cu)",
  },

  // === SUBSTANCES DE BASE / PNPP ===
  {
    id: "phyto-purin-ortie",
    nomCommercial: "Purin d'ortie",
    substanceActive: "Extrait d'Urtica dioica",
    classification: "Substance de base / PNPP",
    autoriseAB: true,
    notes: "Préparation Naturelle Peu Préoccupante. Stimulateur, répulsif. Cadre : article L.253-1 du code rural.",
  },
  {
    id: "phyto-purin-fougere",
    nomCommercial: "Purin de fougère",
    substanceActive: "Extrait de Pteridium aquilinum",
    classification: "Substance de base / PNPP",
    autoriseAB: true,
    notes: "Classification corrigée — c'est une PNPP, pas une méthode mécanique. Action insectifuge (taupins, pucerons).",
  },
  {
    id: "phyto-purin-prele",
    nomCommercial: "Décoction de prêle",
    substanceActive: "Extrait d'Equisetum arvense",
    classification: "Substance de base / PNPP",
    autoriseAB: true,
    notes: "Silice — renforcement plante, fongistatique (mildiou).",
  },
  {
    id: "phyto-purin-consoude",
    nomCommercial: "Purin de consoude",
    substanceActive: "Extrait de Symphytum officinale",
    classification: "Substance de base / PNPP",
    autoriseAB: true,
    notes: "Fertilisant foliaire riche en potasse + stimulateur.",
  },
  {
    id: "phyto-savon-noir",
    nomCommercial: "Savon noir",
    substanceActive: "Sels de potassium d'acides gras",
    classification: "Substance de base / PNPP",
    autoriseAB: true,
    darJours: 0,
    doseHomologuee: "20-50 g/L",
    notes: "Insecticide de contact (pucerons, cochenilles).",
  },
  {
    id: "phyto-bicarbonate-soude",
    nomCommercial: "Bicarbonate de soude",
    substanceActive: "Hydrogénocarbonate de sodium",
    classification: "Substance de base / PNPP",
    autoriseAB: true,
    notes: "Fongicide oïdium, action de contact.",
  },
  {
    id: "phyto-lait-de-vache",
    nomCommercial: "Lait de vache",
    substanceActive: "Caséines",
    classification: "Substance de base / PNPP",
    autoriseAB: true,
    notes: "Anti-oïdium courge/cucurbitacées. Dilution 1/10.",
  },
  {
    id: "phyto-vinaigre",
    nomCommercial: "Vinaigre",
    substanceActive: "Acide acétique",
    classification: "Substance de base / PNPP",
    autoriseAB: true,
    notes: "Désinfectant outils + traitement antifongique (post-coupe).",
  },
  {
    id: "phyto-eau-chaux",
    nomCommercial: "Chaux vive (badigeon)",
    substanceActive: "Hydroxyde de calcium",
    classification: "Autorisé AB",
    autoriseAB: true,
    notes: "Badigeon hivernal tronc — protection mousses/insectes hivernants.",
  },

  // === MÉCANIQUES / DISPOSITIFS ===
  {
    id: "phyto-piege-jaune",
    nomCommercial: "Pièges chromatiques jaunes",
    substanceActive: "Surface englue jaune",
    classification: "Mécanique",
    autoriseAB: true,
    notes: "Détection + capture pucerons ailés, mouches.",
  },
  {
    id: "phyto-piege-bleu",
    nomCommercial: "Pièges chromatiques bleus",
    substanceActive: "Surface englue bleue",
    classification: "Mécanique",
    autoriseAB: true,
    notes: "Thrips spécifiquement.",
  },
  {
    id: "phyto-piege-delta",
    nomCommercial: "Pièges Delta + phéromones",
    substanceActive: "Phéromone sexuelle + carton englué",
    classification: "Mécanique",
    autoriseAB: true,
    notes: "Monitoring carpocapse / tordeuses — 1 piège/ha minimum.",
  },
  {
    id: "phyto-filet-anti-insectes",
    nomCommercial: "Filet anti-insectes",
    substanceActive: "Maille polyéthylène",
    classification: "Mécanique",
    autoriseAB: true,
    notes: "Voile maraîcher P17 ou filet insect-proof maille 0.8 mm.",
  },
  {
    id: "phyto-glu-arboricole",
    nomCommercial: "Glu arboricole tronc",
    substanceActive: "Résine + huiles végétales",
    classification: "Mécanique",
    autoriseAB: true,
    notes: "Bague autour du tronc — anti-fourmis, anthonome.",
  },
  {
    id: "phyto-carton-ondule",
    nomCommercial: "Bandes de carton ondulé",
    substanceActive: "Carton",
    classification: "Mécanique",
    autoriseAB: true,
    notes: "Piège de capture larves carpocapse (autour tronc fin été).",
  },

  // === CHIMIQUE CONVENTIONNEL (interdits AB, mais possibles hors-AB) ===
  {
    id: "phyto-rotenone",
    nomCommercial: "Roténone",
    substanceActive: "Roténone",
    classification: "Chimique conventionnel",
    autoriseAB: false,
    notes: "INTERDIT en AB depuis 2008 (UE). Présent ici pour bloquer la saisie sur parcelles AB.",
  },
  {
    id: "phyto-glyphosate",
    nomCommercial: "Glyphosate (Roundup)",
    substanceActive: "Glyphosate",
    classification: "Chimique conventionnel",
    autoriseAB: false,
    zntAquatiqueM: 5,
    notes: "Herbicide systémique non sélectif. Interdit AB.",
  },
  {
    id: "phyto-deltamethrine",
    nomCommercial: "Deltaméthrine (Decis)",
    substanceActive: "Deltaméthrine",
    classification: "Chimique conventionnel",
    autoriseAB: false,
    zntAquatiqueM: 20,
    darJours: 7,
    notes: "Pyréthrinoïde de synthèse — toxique abeilles.",
  },
  {
    id: "phyto-mancozebe",
    nomCommercial: "Mancozèbe",
    substanceActive: "Mancozèbe (dithiocarbamate)",
    classification: "Chimique conventionnel",
    autoriseAB: false,
    notes: "Fongicide retrait UE en 2020 — usage encore résiduel.",
  },
  {
    id: "phyto-fosetyl-al",
    nomCommercial: "Fosétyl-aluminium",
    substanceActive: "Fosétyl-aluminium",
    classification: "Chimique conventionnel",
    autoriseAB: false,
    zntAquatiqueM: 5,
  },
]

async function main() {
  console.log(`[seed-produits-phyto] ${produits.length} produits à seeder`)
  for (const p of produits) {
    await prisma.produitPhyto.upsert({
      where: { id: p.id },
      update: {
        nomCommercial: p.nomCommercial,
        substanceActive: p.substanceActive,
        amm: p.amm ?? null,
        classification: p.classification,
        autoriseAB: p.autoriseAB,
        zntAquatiqueM: p.zntAquatiqueM ?? null,
        darJours: p.darJours ?? null,
        doseHomologuee: p.doseHomologuee ?? null,
        plafondAB: p.plafondAB ?? null,
        notes: p.notes ?? null,
      },
      create: {
        id: p.id,
        nomCommercial: p.nomCommercial,
        substanceActive: p.substanceActive,
        amm: p.amm ?? null,
        classification: p.classification,
        autoriseAB: p.autoriseAB,
        zntAquatiqueM: p.zntAquatiqueM ?? null,
        darJours: p.darJours ?? null,
        doseHomologuee: p.doseHomologuee ?? null,
        plafondAB: p.plafondAB ?? null,
        notes: p.notes ?? null,
      },
    })
  }
  console.log(`[seed-produits-phyto] ✓ ${produits.length} produits seedés`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
