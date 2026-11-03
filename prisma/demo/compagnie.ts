/**
 * Ateliers chiens et chats, équins et NAC (préférence `modesElevage`).
 *
 * Identifiants fictifs mais au format exigé par l'application
 * (src/lib/identification-animal.ts) : puces ISO 15 chiffres, UELN 250 + 12
 * chiffres pour les équidés nés en France. Aucun achat sur l'année : ces
 * ateliers ne pèsent pas sur la comptabilité, sauf les acomptes de la portée.
 */

import { ESPECES_COMPAGNIE } from "../../src/lib/elevage/catalogue-compagnie"
import { upsertVenteFromReservationElevage } from "../../src/lib/auto-compta"
import { ilYa, jour, journal, prisma, Y, type Contexte } from "./contexte"

export async function seedCompagnie(ctx: Contexte) {
  const { userId } = ctx
  const pature = ctx.parcelles.P

  // Espèces du catalogue officiel nécessaires (créées seulement si absentes :
  // on ne touche jamais au référentiel commun).
  const utiles = new Set(["chien", "chat", "cheval", "poney", "furet", "lapin_nain", "calopsitte"])
  for (const e of ESPECES_COMPAGNIE.filter((espece) => utiles.has(espece.id))) {
    const existe = await prisma.especeAnimale.findUnique({ where: { id: e.id }, select: { id: true } })
    if (existe) continue
    await prisma.especeAnimale.create({
      data: {
        id: e.id, nom: e.nom, type: e.type, filiere: e.filiere, production: "compagnie",
        categorieReglementaire: e.categorieReglementaire, productions: [],
        dureeGestation: e.dureeGestation ?? null, dureeCouvaison: e.dureeCouvaison ?? null,
        poidsAdulte: e.poidsAdulte ?? null, couleur: e.couleur ?? null, description: e.description ?? null,
      },
    })
  }

  // ── Chiens et chats ──
  const animal = (data: Record<string, unknown>) => prisma.animal.create({ data: { userId, statut: "actif", ...data } as never })
  const nala = await animal({ especeAnimaleId: "chien", nom: "Nala", race: "Golden retriever", identifiant: "250269610100001", typeIdentifiant: "Puce RFID", sexe: "femelle", dateNaissance: jour(Y - 4, 3, 18), dateArrivee: jour(Y - 4, 5, 20), provenance: "Élevage des Ajoncs", poidsActuel: 29.4, couleur: "Sable doré", notes: "Reproductrice confirmée LOF, caractère familial. Garde le troupeau avec Oslo." })
  const oslo = await animal({ especeAnimaleId: "chien", nom: "Oslo", race: "Golden retriever", identifiant: "250269610100002", typeIdentifiant: "Puce RFID", sexe: "male", dateNaissance: jour(Y - 5, 7, 4), dateArrivee: jour(Y - 4, 1, 15), provenance: "Élevage du Val Fleuri", poidsActuel: 33.1, couleur: "Crème", notes: "Étalon confirmé LOF." })
  const plume = await animal({ especeAnimaleId: "chat", nom: "Plume", race: "Maine coon", identifiant: "250269610200001", typeIdentifiant: "Puce RFID", sexe: "femelle", dateNaissance: jour(Y - 3, 9, 12), dateArrivee: jour(Y - 3, 12, 8), provenance: "Chatterie de l'Orée", poidsActuel: 6.2, couleur: "Brown tabby", notes: "Reproductrice LOOF, chasse les rongeurs du hangar." })
  const moka = await animal({ especeAnimaleId: "chat", nom: "Moka", race: "Maine coon", identifiant: "250269610200002", typeIdentifiant: "Puce RFID", sexe: "male", dateNaissance: jour(Y - 4, 2, 2), dateArrivee: jour(Y - 3, 1, 20), provenance: "Chatterie des Dunes", poidsActuel: 8.4, couleur: "Black silver", notes: "Étalon LOOF." })

  for (const p of [
    { animalId: nala.id, numeroLof: `LOF-DEMO-${Y - 4}-001`, cotation: 4, titres: "Excellent régional" },
    { animalId: oslo.id, numeroLof: `LOF-DEMO-${Y - 5}-002`, cotation: 3, titres: "Très bon national" },
    { animalId: plume.id, numeroLof: `LOOF-DEMO-${Y - 3}-001`, cotation: 3, titres: "Excellent exposition" },
    { animalId: moka.id, numeroLof: `LOOF-DEMO-${Y - 4}-002`, cotation: 2, titres: null },
  ]) {
    await prisma.pedigreeElevage.create({ data: { userId, ...p, confirmationLof: true, dateConfirmation: jour(Y - 2, 6, 15) } })
  }
  for (const t of [
    { animalId: nala.id, type: "dysplasie_hanche", resultat: "A", laboratoire: "Clinique vétérinaire du Bocage", reference: "DEMO-CAN-001", date: ilYa(320) },
    { animalId: nala.id, type: "oeil", resultat: "Indemne", laboratoire: "Clinique vétérinaire du Bocage", reference: "DEMO-CAN-002", date: ilYa(150) },
    { animalId: oslo.id, type: "adn_filiation", resultat: "Compatible", laboratoire: "Laboratoire génétique de l'Ouest", reference: "DEMO-ADN-001", date: ilYa(140) },
    { animalId: plume.id, type: "adn_maladie", resultat: "SMA/PKDef : indemne", laboratoire: "Laboratoire génétique de l'Ouest", reference: "DEMO-FEL-001", date: ilYa(210) },
    { animalId: moka.id, type: "oeil", resultat: "Indemne", laboratoire: "Clinique vétérinaire du Bocage", reference: "DEMO-FEL-002", date: ilYa(95) },
  ]) {
    await prisma.testSanteElevage.create({ data: { userId, ...t, notes: "Résultat fictif pour la démonstration." } })
  }

  // ── Portée de Nala (relative au jour du reseed : toujours « en cours ») ──
  const naissanceChiots = ilYa(45)
  const saillie = await prisma.saillie.create({
    data: { userId, date: ilYa(108), femelleId: nala.id, maleId: oslo.id, type: "Monte naturelle", confirmationGestation: ilYa(80), dateMiseBasAttendue: naissanceChiots, statut: "Mise-bas réalisée", notes: "Portée Golden retriever de démonstration." },
  })
  const portee = await prisma.naissanceAnimale.create({
    data: { userId, mereId: nala.id, pereIdentifiant: oslo.identifiant, date: naissanceChiots, nombreNes: 5, nombreVivants: 5, nombreMales: 2, nombreFemelles: 3, poidsTotal: 2.21, notes: "Cinq chiots en bonne santé, vermifugés à 2, 4 et 6 semaines.", saillieId: saillie.id },
  })
  const chiots = []
  for (const petit of [
    { numero: 1, sexe: "femelle", poids: 0.43, couleur: "Sable", notes: "Collier rose" },
    { numero: 2, sexe: "male", poids: 0.47, couleur: "Crème", notes: "Collier bleu" },
    { numero: 3, sexe: "femelle", poids: 0.41, couleur: "Doré", notes: "Collier jaune" },
    { numero: 4, sexe: "male", poids: 0.47, couleur: "Sable clair", notes: "Collier vert" },
    { numero: 5, sexe: "femelle", poids: 0.43, couleur: "Crème", notes: "Collier violet" },
  ]) {
    chiots.push(await prisma.petitNaissance.create({ data: { userId, naissanceId: portee.id, modeElevage: "sous_mere", vivant: true, ...petit } }))
  }
  for (const r of [
    { acquereurNom: "Famille Martin", acquereurEmail: "famille.martin@example.com", acquereurTel: "06 39 98 00 01", petitNaissanceId: chiots[0].id, statut: "confirmee", acompte: 300, montant: 1400, dateReservation: ilYa(20), dateLivraison: ilYa(-18), notes: "Choix du chiot confirmé après visite." },
    { acquereurNom: "Claire Bernard", acquereurEmail: "claire.bernard@example.com", acquereurTel: "06 39 98 00 02", petitNaissanceId: chiots[1].id, statut: "confirmee", acompte: 300, montant: 1400, dateReservation: ilYa(12), dateLivraison: ilYa(-18), notes: "Départ prévu à 9 semaines." },
    { acquereurNom: "Paul Girard", acquereurEmail: "paul.girard@example.com", acquereurTel: "06 39 98 00 03", petitNaissanceId: chiots[2].id, statut: "attente", acompte: 0, montant: 1400, dateReservation: ilYa(4), dateLivraison: ilYa(-18), notes: "Visite prévue samedi." },
  ]) {
    const saved = await prisma.reservationElevage.create({ data: { userId, naissanceId: portee.id, ...r } })
    await prisma.$transaction((tx) => upsertVenteFromReservationElevage(tx, userId, saved))
  }

  // ── Équins ──
  const etoile = await animal({ especeAnimaleId: "cheval", nom: "Étoile du Bocage", race: "Selle français", identifiant: "250001570123456", typeIdentifiant: "SIRE équin", sexe: "femelle", dateNaissance: jour(Y - 8, 4, 22), dateArrivee: jour(Y - 5, 9, 10), provenance: "Haras du Bocage", poidsActuel: 545, couleur: "Bai", parcelleGeoId: pature, notes: "Jument de loisir et poulinière, attelée pour le débardage du bois du verger." })
  const sirocco = await animal({ especeAnimaleId: "poney", nom: "Sirocco", race: "Connemara", identifiant: "250001580654321", typeIdentifiant: "SIRE équin", sexe: "male", dateNaissance: jour(Y - 10, 5, 6), dateArrivee: jour(Y - 6, 3, 18), provenance: "Poney-club des Prés", poidsActuel: 365, couleur: "Gris", parcelleGeoId: pature, notes: "Hongre de randonnée, très calme avec les enfants des visites à la ferme." })
  for (const p of [
    { animalId: etoile.id, numeroLof: "SIRE-DEMO-SF-001", cotation: 3, titres: "Label loisir sélection" },
    { animalId: sirocco.id, numeroLof: "SIRE-DEMO-CO-002", cotation: 2, titres: "Qualification loisir" },
  ]) {
    await prisma.pedigreeElevage.create({ data: { userId, ...p, confirmationLof: true, dateConfirmation: jour(Y - 4, 8, 20) } })
  }
  await prisma.testSanteElevage.createMany({
    data: [
      { userId, animalId: etoile.id, type: "radio_osteochondrose", resultat: "Absence de lésion", laboratoire: "Clinique équine de la Sèvre", reference: "DEMO-EQ-001", date: ilYa(130), notes: "Examen radiographique fictif." },
      { userId, animalId: sirocco.id, type: "aie", resultat: "Négatif", laboratoire: "Laboratoire départemental de Vendée", reference: "DEMO-EQ-002", date: ilYa(70), notes: "Test AIE fictif." },
    ],
  })

  // ── NAC ──
  const nac = [
    { especeAnimaleId: "furet", nom: "Pixel", race: "Zibeline", identifiant: "250269610300001", typeIdentifiant: "Puce RFID", sexe: "male", poidsActuel: 1.35, couleur: "Zibeline", dateNaissance: jour(Y - 2, 5, 9), notes: "Furet vacciné, identifié I-CAD." },
    { especeAnimaleId: "lapin_nain", nom: "Noisette", race: "Nain bélier", identifiant: "NAC-DEMO-LN-001", typeIdentifiant: "Auxiliaire éleveur", sexe: "femelle", poidsActuel: 1.62, couleur: "Fauve", dateNaissance: jour(Y - 1, 8, 14), notes: "Vaccination myxomatose/VHD à jour." },
    { especeAnimaleId: "calopsitte", nom: "Kiwi", race: "Type sauvage", identifiant: `FR-UOF-${Y - 2}-001`, typeIdentifiant: "Bague volière", sexe: "femelle", poidsActuel: 0.095, couleur: "Gris perlé", dateNaissance: jour(Y - 2, 6, 2), notes: "Bague fermée ; contrôle annuel conseillé." },
  ]
  for (const [i, a] of nac.entries()) {
    const row = await animal({ ...a, dateArrivee: jour(Y - 1, 10, 12), provenance: "Élevage familial" })
    await prisma.testSanteElevage.create({
      data: { userId, animalId: row.id, type: "bilan_sante", resultat: "Aucune anomalie", laboratoire: "Clinique NAC de Cholet", reference: `DEMO-NAC-00${i + 1}`, date: ilYa(40 + i * 12), notes: "Bilan sanitaire fictif." },
    })
  }
  journal("Chiens et chats (portée et réservations), équins, NAC")
}
