import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  DUREE_MEDICAMENTS_ELEVAGE,
  MODELES_ZONE_PRIVEE,
  PERIMETRE_EFFACEMENT,
  controlerPerimetre,
  estModeleZonePrivee,
  portePropriete,
  type ClassementModele,
  type ModeleDmmf,
} from './perimetre-effacement'
import { CONTRAINTES_ZONE_PRIVEE, contraintesDeCles, genererDocumentPerimetre } from './perimetre-effacement-doc'

// Seul le schéma réel prouve l'exhaustivité : un nouveau modèle portant le
// tenant, non classé, doit faire échouer ce test avant d'atteindre la route.
// Ce test tourne sur les deux schémas : complet (avec zone privée) et
// public (sans les modèles de `MODELES_ZONE_PRIVEE`).
const DMMF: readonly ModeleDmmf[] = Prisma.dmmf.datamodel.models
const DMMF_PUBLIC: readonly ModeleDmmf[] = DMMF.filter((m) => !estModeleZonePrivee(m.name))
const CHEMIN_DOC = path.resolve(__dirname, '../../../docs/rgpd-perimetre-effacement.md')

const champ = (name: string, kind = 'scalar', type = 'String') => ({ name, kind, type })

describe('périmètre de « Effacer toutes mes données »', () => {
  it('classe chaque modèle du schéma actuel, sans anomalie', () => {
    expect(DMMF.length).toBeGreaterThan(100)
    expect(controlerPerimetre(DMMF)).toEqual([])
  })

  it('schéma public : l’absence de tous les modèles de la zone privée n’est pas une anomalie', () => {
    expect(DMMF_PUBLIC.length).toBeGreaterThan(100)
    expect(controlerPerimetre(DMMF_PUBLIC)).toEqual([])
  })

  it('classe l’historique SAFRAN partagé hors périmètre, sans y inclure les localisations du compte', () => {
    const noms = ['ClimatMaille', 'ClimatMailleAnnee'] as const
    for (const nom of noms) {
      const modele = DMMF_PUBLIC.find((m) => m.name === nom)
      expect(modele, nom).toBeDefined()
      expect(portePropriete(modele!), nom).toBe(false)
      // Toute relation vers une parcelle ou un autre modèle impose de revoir ce classement.
      const relations = modele!.fields.filter((f) => f.kind === 'object').map((f) => f.type)
      expect(relations, nom).toEqual([nom === 'ClimatMaille' ? 'ClimatMailleAnnee' : 'ClimatMaille'])
      expect(PERIMETRE_EFFACEMENT[nom], nom).toMatchObject({ categorie: 'hors_perimetre', rattachement: 'instance' })
    }
    expect(PERIMETRE_EFFACEMENT.ParcelleGeo.categorie).toBe('effacer')
  })

  it('zone privée partielle : chaque modèle privé manquant est signalé', () => {
    const simule = [...DMMF_PUBLIC, { name: 'CaisseSession', fields: [champ('id'), champ('userId')] }]
    const anomalies = controlerPerimetre(simule)
    expect(anomalies.every((a) => a.probleme === 'classé mais absent du schéma')).toBe(true)
    expect(anomalies.map((a) => a.modele).sort()).toEqual(MODELES_ZONE_PRIVEE.filter((n) => n !== 'CaisseSession').sort())
  })

  it('chaque modèle de la zone privée reste classé, même absent du schéma', () => {
    const perimetre: Record<string, ClassementModele> = { ...PERIMETRE_EFFACEMENT }
    delete perimetre.CaisseCle
    expect(controlerPerimetre(DMMF_PUBLIC, perimetre)).toEqual([{ modele: 'CaisseCle', probleme: 'modèle de la zone privée non classé' }])
  })

  it('les contraintes de clés figées de la zone privée sont contrôlées contre le schéma complet', () => {
    // Un CaisseLot sans ses relations : la liste figée ne correspond plus, la génération échoue.
    const simule = [...DMMF_PUBLIC, { name: 'CaisseLot', fields: [champ('id'), champ('userId')] }]
    expect(() => contraintesDeCles(simule)).toThrow(/CONTRAINTES_ZONE_PRIVEE/)
    for (const ligne of CONTRAINTES_ZONE_PRIVEE) expect(contraintesDeCles(DMMF_PUBLIC)).toContain(ligne)
  })

  it('le document est le même avec le schéma complet et avec le schéma public', () => {
    expect(genererDocumentPerimetre(DMMF)).toBe(genererDocumentPerimetre(DMMF_PUBLIC))
  })

  it('échoue si un modèle portant userId est ajouté au schéma sans être classé', () => {
    const simule = [...DMMF, { name: 'ModeleFactice', fields: [champ('id'), champ('userId')] }]
    expect(controlerPerimetre(simule)).toEqual([{ modele: 'ModeleFactice', probleme: 'porte un propriétaire et n’est pas classé' }])
  })

  it('échoue aussi pour un propriétaire porté par ownerId ou par une seule relation vers User', () => {
    const simule = [
      ...DMMF,
      { name: 'FactOwnerId', fields: [champ('id'), champ('ownerId')] },
      { name: 'FactRelation', fields: [champ('id'), champ('auteur', 'object', 'User')] },
    ]
    expect(controlerPerimetre(simule).map((a) => a.modele)).toEqual(['FactOwnerId', 'FactRelation'])
  })

  it('échoue si un modèle classé disparaît du schéma', () => {
    const simule = DMMF.filter((m) => m.name !== 'Facture')
    expect(controlerPerimetre(simule)).toEqual([{ modele: 'Facture', probleme: 'classé mais absent du schéma' }])
  })

  it('refuse un modèle portant le tenant déclaré hors périmètre, et une conservation sans base ni durée', () => {
    const perimetre: Record<string, ClassementModele> = {
      ...PERIMETRE_EFFACEMENT,
      Pesee: { domaine: 'elevage', categorie: 'hors_perimetre', rattachement: 'instance', motif: 'test' },
      Note: { domaine: 'terrain', categorie: 'conserver', rattachement: 'proprietaire', motif: 'test' },
    }
    expect(controlerPerimetre(DMMF, perimetre)).toEqual([
      { modele: 'Pesee', probleme: 'porte un propriétaire mais est déclaré hors périmètre' },
      { modele: 'Note', probleme: 'conservation sans base légale ou sans durée' },
    ])
  })

  it('refuse une conservation dont la durée annonce son absence (« Non fixée. »)', () => {
    const perimetre: Record<string, ClassementModele> = {
      ...PERIMETRE_EFFACEMENT,
      ImpersonationGrant: { ...PERIMETRE_EFFACEMENT.ImpersonationGrant, duree: 'Non fixée.' },
      LoginLog: { ...PERIMETRE_EFFACEMENT.LoginLog, duree: 'À définir' },
    }
    expect(controlerPerimetre(DMMF, perimetre)).toEqual([
      { modele: 'LoginLog', probleme: 'conservation sans base légale ou sans durée' },
      { modele: 'ImpersonationGrant', probleme: 'conservation sans base légale ou sans durée' },
    ])
  })

  // Revues QA/ADV du 2026-11-15 sur 27972aba : trois majeurs de cadrage élevage.
  it('garde les mesures des bandes de volailles (annexe I, points 6 et 8) en conservation conditionnelle', () => {
    for (const nom of ['ProductionOeuf', 'ConsommationAliment', 'Pesee'] as const) {
      const c: ClassementModele = PERIMETRE_EFFACEMENT[nom]
      expect(c.categorie, nom).toBe('conserver')
      expect(c.bases, nom).toContain('ARRETE_REGISTRE_ELEVAGE_ANNEXE_I')
      expect(c.condition, nom).toMatch(/^Conservation conditionnelle : seules les mesures d’une bande de volailles/)
      expect(c.condition, nom).toMatch(/Espèce inconnue.*conservée par prudence/)
    }
  })

  it('garde les analyses diagnostiques ou sanitaires (art. 7, 1°) sans supposer de copie ailleurs, avec la maladie citée', () => {
    for (const nom of ['StatutSanitaireElevage', 'TestSanteElevage'] as const) {
      const c: ClassementModele = PERIMETRE_EFFACEMENT[nom]
      expect(c.categorie, nom).toBe('conserver')
      expect(c.condition, nom).toMatch(/^Conservation conditionnelle/)
      expect(c.condition, nom).toContain('Aucune copie réglementaire n’est supposée exister ailleurs')
    }
    expect(PERIMETRE_EFFACEMENT.MaladieElevage.condition).toContain('StatutSanitaireElevage')
  })

  it('n’applique jamais l’exception volailles de trois ans aux enregistrements médicamenteux ni aux archives', () => {
    const perimetre = PERIMETRE_EFFACEMENT as Readonly<Record<string, ClassementModele>>
    const medicamenteux = Object.entries(perimetre).filter(([, c]) => c.bases?.includes('UE_2019_6_ART108')).map(([nom]) => nom)
    expect(medicamenteux).toEqual(expect.arrayContaining([
      'SoinAnimal', 'InjectionSoin', 'AnnulationSoinAnimal', 'StockMedicamentElevage', 'ProphylaxieElevage', 'ArchiveRegistreElevage', 'HistoriqueLotAnimal',
    ]))
    for (const nom of medicamenteux) {
      expect(perimetre[nom].duree, nom).toBe(DUREE_MEDICAMENTS_ELEVAGE)
      expect(perimetre[nom].duree, nom).not.toMatch(/trois ans/)
    }
  })

  it('cache mixte : seules les clés de notification propres au compte sont dans le périmètre', () => {
    const c: ClassementModele = PERIMETRE_EFFACEMENT.GenericCache
    expect(c.rattachement).toBe('cle')
    expect(c.categorie).toBe('effacer')
    expect(c.condition).toContain('`notif:envoyee:<userId>:…`')
  })

  it('chaque modèle portant un propriétaire est effacé, conservé ou anonymisé', () => {
    const perimetre = PERIMETRE_EFFACEMENT as Readonly<Record<string, ClassementModele>>
    const proprietaires = DMMF.filter(portePropriete)
    expect(proprietaires.length).toBeGreaterThan(100)
    for (const m of proprietaires) expect(['effacer', 'conserver', 'anonymiser'], m.name).toContain(perimetre[m.name]?.categorie)
  })

  it('le document est à jour et liste chaque modèle du schéma exactement une fois', () => {
    const doc = readFileSync(CHEMIN_DOC, 'utf8')
    expect(doc, 'régénérer : npx tsx scripts/rgpd/generer-perimetre-effacement.ts').toBe(genererDocumentPerimetre(DMMF))
    const classement = doc.slice(doc.indexOf('## Classement par modèle'), doc.indexOf('## À valider par Guillaume'))
    const lignes = [...classement.matchAll(/^\| `(\w+)` \|/gm)].map((m) => m[1])
    // Schéma complet : exactement ses modèles ; schéma public : ses modèles et ceux de la zone privée.
    expect([...lignes].sort()).toEqual([...new Set([...DMMF.map((m) => m.name), ...MODELES_ZONE_PRIVEE])].sort())
    expect(new Set(lignes).size).toBe(lignes.length)
  })
})
