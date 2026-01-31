/**
 * API Import des données
 * POST /api/import
 * Importe les données pour l'utilisateur connecté
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'

interface ImportData {
  version?: string
  exportDate?: string
  familles?: Array<{
    id: string
    intervalle?: number | null
    couleur?: string | null
    description?: string | null
  }>
  fournisseurs?: Array<{
    id: string
    contact?: string | null
    adresse?: string | null
    email?: string | null
    telephone?: string | null
    siteWeb?: string | null
    notes?: string | null
  }>
  especes?: Array<{
    id: string
    type?: string
    familleId?: string | null
    nomLatin?: string | null
    rendement?: number | null
    vivace?: boolean
    besoinN?: number | null
    besoinP?: number | null
    besoinK?: number | null
    besoinEau?: number | null
    aPlanifier?: boolean
    couleur?: string | null
    description?: string | null
    categorie?: string | null
    niveau?: string | null
    densite?: number | null
    doseSemis?: number | null
    tauxGermination?: number | null
    temperatureGerm?: string | null
    joursLevee?: number | null
    irrigation?: string | null
    conservation?: boolean | null
    effet?: string | null
    usages?: string | null
    objectifAnnuel?: number | null
    prixKg?: number | null
    semaineTaille?: number | null
  }>
  varietes?: Array<{
    id: string
    especeId: string
    fournisseurId?: string | null
    semaineRecolte?: number | null
    dureeRecolte?: number | null
    nbGrainesG?: number | null
    prixGraine?: number | null
    stockGraines?: number | null
    stockPlants?: number | null
    dateStock?: string | null
    bio?: boolean
    description?: string | null
  }>
  itps?: Array<{
    id: string
    especeId?: string | null
    semaineSemis?: number | null
    semainePlantation?: number | null
    semaineRecolte?: number | null
    dureeRecolte?: number | null
    dureePepiniere?: number | null
    dureeCulture?: number | null
    nbRangs?: number | null
    espacement?: number | null
    notes?: string | null
    typePlanche?: string | null
    decalageMax?: number | null
    espacementRangs?: number | null
    nbGrainesPlant?: number | null
    doseSemis?: number | null
  }>
  rotations?: Array<{
    id: string
    active?: boolean
    nbAnnees?: number | null
    notes?: string | null
  }>
  rotationDetails?: Array<{
    id: number
    rotationId: string
    itpId?: string | null
    annee: number
  }>
  fertilisants?: Array<{
    id: string
    type?: string | null
    n?: number | null
    p?: number | null
    k?: number | null
    ca?: number | null
    mg?: number | null
    s?: number | null
    densite?: number | null
    prix?: number | null
    stock?: number | null
    dateStock?: string | null
    description?: string | null
  }>
  planches?: Array<{
    id: string
    rotationId?: string | null
    ilot?: string | null
    surface?: number | null
    largeur?: number | null
    longueur?: number | null
    posX?: number | null
    posY?: number | null
    rotation2D?: number | null
    planchesInfluencees?: string | null
    notes?: string | null
    type?: string | null
    irrigation?: string | null
    annee?: number | null
  }>
  cultures?: Array<{
    id: number
    especeId: string
    varieteId?: string | null
    itpId?: string | null
    plancheId?: string | null
    annee?: number | null
    dateSemis?: string | null
    datePlantation?: string | null
    dateRecolte?: string | null
    semisFait?: boolean
    plantationFaite?: boolean
    recolteFaite?: boolean
    terminee?: string | null
    quantite?: number | null
    nbRangs?: number | null
    longueur?: number | null
    espacement?: number | null
    finRecolte?: string | null
    aFaire?: string | null
    dPlanif?: string | null
    aIrriguer?: boolean | null
    derniereIrrigation?: string | null
    notes?: string | null
  }>
  recoltes?: Array<{
    id: number
    especeId: string
    cultureId: number
    date: string
    quantite: number
    notes?: string | null
  }>
  fertilisations?: Array<{
    id: number
    plancheId: string
    fertilisantId: string
    date: string
    quantite: number
    notes?: string | null
  }>
  objetsJardin?: Array<{
    id: number
    nom?: string | null
    type: string
    largeur: number
    longueur: number
    posX: number
    posY: number
    rotation2D?: number
    couleur?: string | null
    notes?: string | null
  }>
  arbres?: Array<{
    id: number
    nom: string
    type: string
    especeId?: string | null
    espece?: string | null
    variete?: string | null
    portGreffe?: string | null
    fournisseur?: string | null
    dateAchat?: string | null
    datePlantation?: string | null
    age?: number | null
    posX: number
    posY: number
    envergure?: number
    hauteur?: number | null
    etat?: string | null
    pollinisateur?: string | null
    couleur?: string | null
    notes?: string | null
  }>
  associations?: Array<{
    id: string
    nom: string
    description?: string | null
    notes?: string | null
    details?: Array<{
      id: number
      associationId: string
      especeId?: string | null
      familleId?: string | null
      groupe?: string | null
      requise?: boolean
      notes?: string | null
    }>
  }>
  associationDetails?: Array<{
    id: number
    associationId: string
    especeId?: string | null
    familleId?: string | null
    groupe?: string | null
    requise?: boolean
    notes?: string | null
  }>
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    const text = await file.text()
    let data: ImportData

    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Format JSON invalide' }, { status: 400 })
    }

    const userId = session!.user.id

    // Statistiques d'import
    const stats = {
      familles: 0,
      fournisseurs: 0,
      especes: 0,
      varietes: 0,
      itps: 0,
      rotations: 0,
      rotationDetails: 0,
      fertilisants: 0,
      planches: 0,
      cultures: 0,
      recoltes: 0,
      fertilisations: 0,
      objetsJardin: 0,
      arbres: 0,
      associations: 0,
      associationDetails: 0,
    }

    // Mapping des anciens IDs vers les nouveaux (pour les entités avec ID auto-généré)
    const cultureIdMap = new Map<number, number>()
    const rotationDetailIdMap = new Map<number, number>()

    // ========================================
    // RÉFÉRENTIELS GLOBAUX (upsert par ID string)
    // ========================================

    // 1. Familles
    if (data.familles?.length) {
      for (const item of data.familles) {
        await prisma.famille.upsert({
          where: { id: item.id },
          update: {
            intervalle: item.intervalle ?? 4,
            couleur: item.couleur,
            description: item.description,
          },
          create: {
            id: item.id,
            intervalle: item.intervalle ?? 4,
            couleur: item.couleur,
            description: item.description,
          },
        })
        stats.familles++
      }
    }

    // 2. Fournisseurs
    if (data.fournisseurs?.length) {
      for (const item of data.fournisseurs) {
        await prisma.fournisseur.upsert({
          where: { id: item.id },
          update: {
            contact: item.contact,
            adresse: item.adresse,
            email: item.email,
            telephone: item.telephone,
            siteWeb: item.siteWeb,
            notes: item.notes,
          },
          create: {
            id: item.id,
            contact: item.contact,
            adresse: item.adresse,
            email: item.email,
            telephone: item.telephone,
            siteWeb: item.siteWeb,
            notes: item.notes,
          },
        })
        stats.fournisseurs++
      }
    }

    // 3. Espèces
    if (data.especes?.length) {
      for (const item of data.especes) {
        await prisma.espece.upsert({
          where: { id: item.id },
          update: {
            type: item.type ?? 'legume',
            familleId: item.familleId,
            nomLatin: item.nomLatin,
            rendement: item.rendement,
            vivace: item.vivace,
            besoinN: item.besoinN,
            besoinP: item.besoinP,
            besoinK: item.besoinK,
            besoinEau: item.besoinEau,
            aPlanifier: item.aPlanifier,
            couleur: item.couleur,
            description: item.description,
            categorie: item.categorie,
            niveau: item.niveau,
            densite: item.densite,
            doseSemis: item.doseSemis,
            tauxGermination: item.tauxGermination,
            temperatureGerm: item.temperatureGerm,
            joursLevee: item.joursLevee,
            irrigation: item.irrigation,
            conservation: item.conservation,
            effet: item.effet,
            usages: item.usages,
            objectifAnnuel: item.objectifAnnuel,
            prixKg: item.prixKg,
            semaineTaille: item.semaineTaille,
          },
          create: {
            id: item.id,
            type: item.type ?? 'legume',
            familleId: item.familleId,
            nomLatin: item.nomLatin,
            rendement: item.rendement,
            vivace: item.vivace ?? false,
            besoinN: item.besoinN,
            besoinP: item.besoinP,
            besoinK: item.besoinK,
            besoinEau: item.besoinEau,
            aPlanifier: item.aPlanifier ?? true,
            couleur: item.couleur,
            description: item.description,
            categorie: item.categorie,
            niveau: item.niveau,
            densite: item.densite,
            doseSemis: item.doseSemis,
            tauxGermination: item.tauxGermination,
            temperatureGerm: item.temperatureGerm,
            joursLevee: item.joursLevee,
            irrigation: item.irrigation,
            conservation: item.conservation,
            effet: item.effet,
            usages: item.usages,
            objectifAnnuel: item.objectifAnnuel,
            prixKg: item.prixKg,
            semaineTaille: item.semaineTaille,
          },
        })
        stats.especes++
      }
    }

    // 4. Variétés
    if (data.varietes?.length) {
      for (const item of data.varietes) {
        const especeExists = await prisma.espece.findUnique({ where: { id: item.especeId } })
        if (!especeExists) continue

        await prisma.variete.upsert({
          where: { id: item.id },
          update: {
            especeId: item.especeId,
            fournisseurId: item.fournisseurId,
            semaineRecolte: item.semaineRecolte,
            dureeRecolte: item.dureeRecolte,
            nbGrainesG: item.nbGrainesG,
            prixGraine: item.prixGraine,
            stockGraines: item.stockGraines,
            stockPlants: item.stockPlants,
            dateStock: item.dateStock ? new Date(item.dateStock) : null,
            bio: item.bio,
            description: item.description,
          },
          create: {
            id: item.id,
            especeId: item.especeId,
            fournisseurId: item.fournisseurId,
            semaineRecolte: item.semaineRecolte,
            dureeRecolte: item.dureeRecolte,
            nbGrainesG: item.nbGrainesG,
            prixGraine: item.prixGraine,
            stockGraines: item.stockGraines,
            stockPlants: item.stockPlants,
            dateStock: item.dateStock ? new Date(item.dateStock) : null,
            bio: item.bio ?? false,
            description: item.description,
          },
        })
        stats.varietes++
      }
    }

    // 5. ITPs
    if (data.itps?.length) {
      for (const item of data.itps) {
        // Vérifier que l'espèce existe si fournie
        if (item.especeId) {
          const especeExists = await prisma.espece.findUnique({ where: { id: item.especeId } })
          if (!especeExists) continue
        }

        await prisma.iTP.upsert({
          where: { id: item.id },
          update: {
            especeId: item.especeId,
            semaineSemis: item.semaineSemis,
            semainePlantation: item.semainePlantation,
            semaineRecolte: item.semaineRecolte,
            dureeRecolte: item.dureeRecolte,
            dureePepiniere: item.dureePepiniere,
            dureeCulture: item.dureeCulture,
            nbRangs: item.nbRangs,
            espacement: item.espacement,
            notes: item.notes,
            typePlanche: item.typePlanche,
            decalageMax: item.decalageMax,
            espacementRangs: item.espacementRangs,
            nbGrainesPlant: item.nbGrainesPlant,
            doseSemis: item.doseSemis,
          },
          create: {
            id: item.id,
            especeId: item.especeId,
            semaineSemis: item.semaineSemis,
            semainePlantation: item.semainePlantation,
            semaineRecolte: item.semaineRecolte,
            dureeRecolte: item.dureeRecolte,
            dureePepiniere: item.dureePepiniere,
            dureeCulture: item.dureeCulture,
            nbRangs: item.nbRangs,
            espacement: item.espacement,
            notes: item.notes,
            typePlanche: item.typePlanche,
            decalageMax: item.decalageMax,
            espacementRangs: item.espacementRangs,
            nbGrainesPlant: item.nbGrainesPlant,
            doseSemis: item.doseSemis,
          },
        })
        stats.itps++
      }
    }

    // 6. Rotations
    if (data.rotations?.length) {
      for (const item of data.rotations) {
        await prisma.rotation.upsert({
          where: { id: item.id },
          update: {
            active: item.active ?? true,
            nbAnnees: item.nbAnnees,
            notes: item.notes,
          },
          create: {
            id: item.id,
            active: item.active ?? true,
            nbAnnees: item.nbAnnees,
            notes: item.notes,
          },
        })
        stats.rotations++
      }
    }

    // 7. Rotation Details (ID auto-généré - créer de nouveaux)
    if (data.rotationDetails?.length) {
      for (const item of data.rotationDetails) {
        const rotationExists = await prisma.rotation.findUnique({ where: { id: item.rotationId } })
        if (!rotationExists) continue

        // Vérifier si l'ITP existe si fourni
        if (item.itpId) {
          const itpExists = await prisma.iTP.findUnique({ where: { id: item.itpId } })
          if (!itpExists) continue
        }

        // Vérifier si un détail existe déjà pour cette rotation et cette année
        const existing = await prisma.rotationDetail.findFirst({
          where: { rotationId: item.rotationId, annee: item.annee },
        })

        if (existing) {
          await prisma.rotationDetail.update({
            where: { id: existing.id },
            data: { itpId: item.itpId },
          })
          rotationDetailIdMap.set(item.id, existing.id)
        } else {
          const created = await prisma.rotationDetail.create({
            data: {
              rotationId: item.rotationId,
              itpId: item.itpId,
              annee: item.annee,
            },
          })
          rotationDetailIdMap.set(item.id, created.id)
        }
        stats.rotationDetails++
      }
    }

    // 8. Fertilisants
    if (data.fertilisants?.length) {
      for (const item of data.fertilisants) {
        await prisma.fertilisant.upsert({
          where: { id: item.id },
          update: {
            type: item.type,
            n: item.n,
            p: item.p,
            k: item.k,
            ca: item.ca,
            mg: item.mg,
            s: item.s,
            densite: item.densite,
            prix: item.prix,
            stock: item.stock,
            dateStock: item.dateStock ? new Date(item.dateStock) : null,
            description: item.description,
          },
          create: {
            id: item.id,
            type: item.type,
            n: item.n,
            p: item.p,
            k: item.k,
            ca: item.ca,
            mg: item.mg,
            s: item.s,
            densite: item.densite,
            prix: item.prix,
            stock: item.stock,
            dateStock: item.dateStock ? new Date(item.dateStock) : null,
            description: item.description,
          },
        })
        stats.fertilisants++
      }
    }

    // 9. Associations
    if (data.associations?.length) {
      for (const item of data.associations) {
        await prisma.association.upsert({
          where: { id: item.id },
          update: {
            nom: item.nom,
            description: item.description,
            notes: item.notes,
          },
          create: {
            id: item.id,
            nom: item.nom,
            description: item.description,
            notes: item.notes,
          },
        })
        stats.associations++

        // 9b. Importer les détails imbriqués si présents
        if (item.details && Array.isArray(item.details)) {
          for (const detail of item.details) {
            const existing = await prisma.associationDetail.findFirst({
              where: {
                associationId: item.id,
                especeId: detail.especeId,
                familleId: detail.familleId,
                groupe: detail.groupe,
              },
            })

            if (!existing) {
              await prisma.associationDetail.create({
                data: {
                  associationId: item.id,
                  especeId: detail.especeId,
                  familleId: detail.familleId,
                  groupe: detail.groupe,
                  requise: detail.requise ?? false,
                  notes: detail.notes,
                },
              })
              stats.associationDetails++
            }
          }
        }
      }
    }

    // 10. Association Details (format alternatif si fourni séparément)
    if (data.associationDetails?.length) {
      for (const item of data.associationDetails) {
        const associationExists = await prisma.association.findUnique({ where: { id: item.associationId } })
        if (!associationExists) continue

        // Vérifier si un détail similaire existe
        const existing = await prisma.associationDetail.findFirst({
          where: {
            associationId: item.associationId,
            especeId: item.especeId,
            familleId: item.familleId,
            groupe: item.groupe,
          },
        })

        if (!existing) {
          await prisma.associationDetail.create({
            data: {
              associationId: item.associationId,
              especeId: item.especeId,
              familleId: item.familleId,
              groupe: item.groupe,
              requise: item.requise ?? false,
              notes: item.notes,
            },
          })
          stats.associationDetails++
        }
      }
    }

    // ========================================
    // DONNÉES UTILISATEUR
    // ========================================

    // 11. Planches (ID string - upsert par utilisateur)
    if (data.planches?.length) {
      for (const item of data.planches) {
        // Vérifier si la planche existe déjà pour cet utilisateur
        const existing = await prisma.planche.findFirst({
          where: { id: item.id, userId },
        })

        if (existing) {
          await prisma.planche.update({
            where: { id: item.id },
            data: {
              rotationId: item.rotationId,
              ilot: item.ilot,
              surface: item.surface,
              largeur: item.largeur,
              longueur: item.longueur,
              posX: item.posX,
              posY: item.posY,
              rotation2D: item.rotation2D,
              planchesInfluencees: item.planchesInfluencees,
              notes: item.notes,
              type: item.type,
              irrigation: item.irrigation,
              annee: item.annee,
            },
          })
        } else {
          await prisma.planche.create({
            data: {
              id: item.id,
              userId,
              rotationId: item.rotationId,
              ilot: item.ilot,
              surface: item.surface,
              largeur: item.largeur,
              longueur: item.longueur,
              posX: item.posX,
              posY: item.posY,
              rotation2D: item.rotation2D,
              planchesInfluencees: item.planchesInfluencees,
              notes: item.notes,
              type: item.type,
              irrigation: item.irrigation,
              annee: item.annee,
            },
          })
        }
        stats.planches++
      }
    }

    // 12. Cultures (ID auto-généré - toujours créer de nouvelles)
    if (data.cultures?.length) {
      for (const item of data.cultures) {
        const especeExists = await prisma.espece.findUnique({ where: { id: item.especeId } })
        if (!especeExists) continue

        // Vérifier si la planche existe pour cet utilisateur
        if (item.plancheId) {
          const plancheExists = await prisma.planche.findFirst({
            where: { id: item.plancheId, userId },
          })
          if (!plancheExists) {
            item.plancheId = null // Ignorer la planche si elle n'existe pas
          }
        }

        // Créer une nouvelle culture (ne pas écraser les existantes)
        const created = await prisma.culture.create({
          data: {
            userId,
            especeId: item.especeId,
            varieteId: item.varieteId,
            itpId: item.itpId,
            plancheId: item.plancheId,
            annee: item.annee,
            dateSemis: item.dateSemis ? new Date(item.dateSemis) : null,
            datePlantation: item.datePlantation ? new Date(item.datePlantation) : null,
            dateRecolte: item.dateRecolte ? new Date(item.dateRecolte) : null,
            semisFait: item.semisFait ?? false,
            plantationFaite: item.plantationFaite ?? false,
            recolteFaite: item.recolteFaite ?? false,
            terminee: item.terminee,
            quantite: item.quantite,
            nbRangs: item.nbRangs,
            longueur: item.longueur,
            espacement: item.espacement,
            finRecolte: item.finRecolte ? new Date(item.finRecolte) : null,
            aFaire: item.aFaire,
            dPlanif: item.dPlanif,
            aIrriguer: item.aIrriguer,
            derniereIrrigation: item.derniereIrrigation ? new Date(item.derniereIrrigation) : null,
            notes: item.notes,
          },
        })
        // Garder le mapping ancien ID -> nouveau ID pour les récoltes
        cultureIdMap.set(item.id, created.id)
        stats.cultures++
      }
    }

    // 13. Récoltes (ID auto-généré - créer de nouvelles avec le bon cultureId)
    if (data.recoltes?.length) {
      for (const item of data.recoltes) {
        // Trouver le nouvel ID de la culture
        const newCultureId = cultureIdMap.get(item.cultureId)
        if (!newCultureId) continue // Skip si la culture n'a pas été importée

        const especeExists = await prisma.espece.findUnique({ where: { id: item.especeId } })
        if (!especeExists) continue

        await prisma.recolte.create({
          data: {
            userId,
            especeId: item.especeId,
            cultureId: newCultureId,
            date: new Date(item.date),
            quantite: item.quantite,
            notes: item.notes,
          },
        })
        stats.recoltes++
      }
    }

    // 14. Fertilisations
    if (data.fertilisations?.length) {
      for (const item of data.fertilisations) {
        const plancheExists = await prisma.planche.findFirst({
          where: { id: item.plancheId, userId },
        })
        const fertilisantExists = await prisma.fertilisant.findUnique({ where: { id: item.fertilisantId } })
        if (!plancheExists || !fertilisantExists) continue

        await prisma.fertilisation.create({
          data: {
            userId,
            plancheId: item.plancheId,
            fertilisantId: item.fertilisantId,
            date: new Date(item.date),
            quantite: item.quantite,
            notes: item.notes,
          },
        })
        stats.fertilisations++
      }
    }

    // 15. Objets jardin
    if (data.objetsJardin?.length) {
      for (const item of data.objetsJardin) {
        await prisma.objetJardin.create({
          data: {
            userId,
            nom: item.nom,
            type: item.type,
            largeur: item.largeur,
            longueur: item.longueur,
            posX: item.posX,
            posY: item.posY,
            rotation2D: item.rotation2D ?? 0,
            couleur: item.couleur,
            notes: item.notes,
          },
        })
        stats.objetsJardin++
      }
    }

    // 16. Arbres
    if (data.arbres?.length) {
      for (const item of data.arbres) {
        await prisma.arbre.create({
          data: {
            userId,
            nom: item.nom,
            type: item.type,
            especeId: item.especeId,
            espece: item.espece,
            variete: item.variete,
            portGreffe: item.portGreffe,
            fournisseur: item.fournisseur,
            dateAchat: item.dateAchat ? new Date(item.dateAchat) : null,
            datePlantation: item.datePlantation ? new Date(item.datePlantation) : null,
            age: item.age,
            posX: item.posX,
            posY: item.posY,
            envergure: item.envergure ?? 2,
            hauteur: item.hauteur,
            etat: item.etat,
            pollinisateur: item.pollinisateur,
            couleur: item.couleur,
            notes: item.notes,
          },
        })
        stats.arbres++
      }
    }

    const totalImported = Object.values(stats).reduce((a, b) => a + b, 0)

    // Générer automatiquement les irrigations planifiées pour les cultures importées
    let irrigationsCreated = 0
    const currentYear = new Date().getFullYear()

    // Récupérer les cultures avec irrigation de l'année en cours et suivante
    const culturesAIrriguer = await prisma.culture.findMany({
      where: {
        userId,
        aIrriguer: true,
        terminee: null,
        annee: { in: [currentYear, currentYear + 1] },
      },
      include: {
        espece: { select: { besoinEau: true } },
      },
    })

    for (const culture of culturesAIrriguer) {
      const dateDebut = culture.datePlantation || culture.dateSemis
      const dateFin = culture.finRecolte || culture.dateRecolte

      if (!dateDebut) continue

      const besoinEau = culture.espece.besoinEau || 3
      const frequenceJours = besoinEau >= 4 ? 2 : 3

      const irrigations: Date[] = []
      let currentDate = new Date(dateDebut)
      currentDate.setDate(currentDate.getDate() + frequenceJours)

      const finDate = dateFin ? new Date(dateFin) : new Date(dateDebut.getFullYear(), 11, 31)

      while (currentDate <= finDate) {
        irrigations.push(new Date(currentDate))
        currentDate.setDate(currentDate.getDate() + frequenceJours)
      }

      if (irrigations.length > 0) {
        await prisma.irrigationPlanifiee.createMany({
          data: irrigations.map(date => ({
            userId,
            cultureId: culture.id,
            datePrevue: date,
            fait: false,
          })),
        })
        irrigationsCreated += irrigations.length
      }
    }

    return NextResponse.json({
      success: true,
      message: `${totalImported} enregistrements importés + ${irrigationsCreated} irrigations générées`,
      stats: {
        ...stats,
        irrigations: irrigationsCreated,
      },
    })
  } catch (error) {
    console.error('Erreur import:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur lors de l'import" },
      { status: 500 }
    )
  }
}
