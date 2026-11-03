/**
 * Identité de la ferme : exploitation (mentions légales, EDE), préférences,
 * station météo, aliments propres au compte et carnet de clients.
 */

import { IDENTITE, jour, journal, prisma, Y, type Contexte } from "./contexte"

export async function seedIdentite(ctx: Contexte) {
  const { userId } = ctx
  const data = {
    raisonSociale: IDENTITE.raisonSociale,
    formeJuridique: "EARL",
    territoire: "METROPOLE",
    siret: IDENTITE.siret,
    siren: IDENTITE.siren,
    numeroTvaIntracom: IDENTITE.tvaIntra,
    devise: "EUR",
    regimeFiscal: "reel-simplifie",
    regimeTva: "reel-simplifie",
    adresseSiege: IDENTITE.adresse,
    codePostal: IDENTITE.codePostal,
    ville: IDENTITE.ville,
    pays: "France",
    emailContact: IDENTITE.email,
    telContact: IDENTITE.telephone,
    capitalSocial: 7500,
    banqueNom: IDENTITE.banque,
    rib: IDENTITE.iban,
    bic: IDENTITE.bic,
    certifBioOrganisme: IDENTITE.certificateur,
    numeroEde: IDENTITE.numeroEde,
    veterinaireSanitaire: "Clinique vétérinaire du Bocage, Montaigu-Vendée",
    lieuDetentionPrincipal: "Site du Bois Joli",
    tauxPenalitesRetard: "3 × taux d'intérêt légal",
    tauxEscompte: "néant",
    tauxHoraireFamilial: 15,
    tauxHoraireSalarie: 18.5,
  }
  const exploitation = await prisma.exploitation.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  })
  ctx.exploitationId = exploitation.id

  const prefs: Array<[string, string]> = [
    ["modulesActifs", JSON.stringify(["maraichage", "verger", "elevage", "comptabilite"])],
    ["modesElevage", JSON.stringify(["compagnie", "equin", "nac"])],
    ["onboarding_completed", "true"],
  ]
  for (const [key, value] of prefs) {
    await prisma.userPreference.upsert({
      where: { userId_key: { userId, key } },
      update: { value },
      create: { userId, key, value },
    })
  }

  const stationId = `demo-station-${userId}`
  const station = {
    nom: "La Roche-sur-Yon · Les Ajoncs",
    provider: "open-meteo-reference",
    stationId: "WMO 07306 · MF 85191003",
    lat: 46.705,
    lng: -1.3819,
    active: true,
  }
  await prisma.stationMeteo.upsert({ where: { id: stationId }, update: station, create: { id: stationId, userId, ...station } })

  await seedAliments(ctx)
  await seedClients(ctx)
  journal("Identité, préférences, station météo, aliments et clients")
}

/** Identifiant d'aliment propre au compte (unique même pour un clone). */
export function idAliment(ctx: Contexte, cle: string) {
  return ctx.clone ? `bois-joli-${cle}-${ctx.userId.slice(-8)}` : `bois-joli-${cle}`
}

/**
 * Aliments PROPRES au compte (et non officiels) : l'ancien seed les créait sans
 * propriétaire, si bien qu'ils apparaissaient dans le catalogue de tous les
 * comptes. Valeurs INRA par kg brut pour le calculateur de ration.
 */
async function seedAliments(ctx: Contexte) {
  const aliments = [
    { cle: "foin", nom: "Foin de prairie (autoproduit)", type: "foin", especesCibles: "caprin,ovin,equin", proteines: 9, ufl: 0.55, pdin: 50, pdie: 70, uel: 1.05, prix: 0.15, stock: 9200, stockMin: 1500 },
    { cle: "luzerne", nom: "Luzerne déshydratée bio", type: "fourrage", especesCibles: "caprin,ovin", proteines: 18, ufl: 0.65, pdin: 105, pdie: 85, uel: 1.0, prix: 0.38, stock: 1400, stockMin: 300 },
    { cle: "granules-chevre", nom: "Granulés chèvre laitière bio", type: "granules", especesCibles: "caprin", proteines: 17, ufl: 1.0, pdin: 115, pdie: 108, uel: 0.45, prix: 0.52, stock: 680, stockMin: 200 },
    { cle: "orge", nom: "Orge aplatie (voisin, bio)", type: "cereales", especesCibles: "caprin,ovin,porcin", proteines: 10, ufl: 1.07, pdin: 72, pdie: 92, uel: 0.4, prix: 0.34, stock: 850, stockMin: 200 },
    { cle: "pondeuses", nom: "Aliment pondeuses bio (farine)", type: "complet", especesCibles: "volaille", proteines: 16.5, energie: 2700, prix: 0.62, stock: 260, stockMin: 100 },
    { cle: "porc", nom: "Aliment croissance porc bio", type: "complet", especesCibles: "porcin", proteines: 15, energie: 3100, prix: 0.58, stock: 320, stockMin: 120 },
    { cle: "lapin", nom: "Granulés lapin bio", type: "granules", especesCibles: "lapin", proteines: 16, energie: 2400, prix: 0.71, stock: 75, stockMin: 25 },
  ]
  for (const a of aliments) {
    const id = idAliment(ctx, a.cle)
    const { cle: _cle, stock, stockMin, ...valeurs } = a
    void _cle
    await prisma.aliment.upsert({
      where: { id },
      update: { ...valeurs, ownerUserId: ctx.userId },
      create: { id, ...valeurs, ownerUserId: ctx.userId },
    })
    await prisma.userStockAliment.upsert({
      where: { userId_alimentId: { userId: ctx.userId, alimentId: id } },
      update: { stock, stockMin, dateStock: jour(Y, 1, 1), prix: a.prix, coutUnitaire: a.prix },
      create: { userId: ctx.userId, alimentId: id, stock, stockMin, dateStock: jour(Y, 1, 1), prix: a.prix, coutUnitaire: a.prix },
    })
  }
}

/** Clients professionnels (SIRET et TVA valides) et quelques fidèles de l'AMAP. */
async function seedClients(ctx: Contexte) {
  const pros = [
    { cle: "restaurant", nom: "Restaurant La Table du Bocage", email: "cuisine.tabledubocage@example.com", telephone: "02 61 91 00 21", adresse: "12 place du Marché", ville: "Montaigu-Vendée", codePostal: "85600", siret: "02084881800017", siren: "020848818", tvaIntra: "FR90020848818", conditionsPaiement: 30 },
    { cle: "epicerie", nom: "Épicerie Bio du Bocage", email: "commandes.biodubocage@example.com", telephone: "02 61 91 00 32", adresse: "3 rue des Halles", ville: "La Roche-sur-Yon", codePostal: "85000", siret: "02735825800013", siren: "027358258", tvaIntra: "FR79027358258", conditionsPaiement: 30 },
    { cle: "cantine", nom: "Cantine scolaire du SIVU du Bocage", email: "cantine.sivu-bocage@example.org", telephone: "02 61 91 00 43", adresse: "5 rue des Écoles", ville: "La Boissière-de-Montaigu", codePostal: "85600", siret: "05757338800014", siren: "057573388", tvaIntra: "FR36057573388", conditionsPaiement: 45 },
  ]
  for (const c of pros) {
    const { cle, ...data } = c
    const row = await prisma.client.create({ data: { userId: ctx.userId, type: "professionnel", pays: "France", exonererTVA: false, actif: true, ...data } })
    ctx.clients[cle] = { id: row.id, nom: row.nom }
  }
  // L'AMAP est un client à part entière (type `amap` reconnu par l'app) :
  // les récoltes distribuées dans les paniers lui sont vendues au kilo.
  const amap = await prisma.client.create({
    data: { userId: ctx.userId, nom: "AMAP du Bois Joli", type: "amap", email: "amap.boisjoli@example.org", ville: "La Boissière-de-Montaigu", codePostal: "85600", pays: "France", exonererTVA: false, actif: true, conditionsPaiement: 0, notes: "22 paniers chaque mercredi d'avril à décembre, contrats réglés par chèque." },
  })
  ctx.clients.amap = { id: amap.id, nom: amap.nom }
  const particuliers = [
    { cle: "dubois", nom: "Marie Dubois", ville: "La Boissière-de-Montaigu", notes: "AMAP depuis 2021, panier familial." },
    { cle: "bertin", nom: "Jean Bertin", ville: "Montaigu-Vendée", notes: "Commande des fromages pour le marché de Noël." },
    { cle: "renard", nom: "Famille Renard", ville: "Treize-Septiers", notes: "AMAP, demi-panier." },
    { cle: "nguyen", nom: "Linh Nguyen", ville: "Montaigu-Vendée", notes: "Boutique en ligne, retrait le mercredi." },
  ]
  for (const p of particuliers) {
    const { cle, ...data } = p
    const row = await prisma.client.create({ data: { userId: ctx.userId, type: "particulier", pays: "France", exonererTVA: false, actif: true, ...data } })
    ctx.clients[cle] = { id: row.id, nom: row.nom }
  }
}
