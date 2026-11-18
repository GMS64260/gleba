/**
 * Génère `docs/rgpd-perimetre-effacement.md` depuis `PERIMETRE_EFFACEMENT`.
 * Le document n'est jamais édité à la main : le test
 * `perimetre-effacement.test.ts` échoue s'il diverge de cette sortie.
 * Régénérer : `npx tsx scripts/rgpd/generer-perimetre-effacement.ts`.
 */
import {
  BASES_LEGALES,
  PERIMETRE_EFFACEMENT,
  type CategorieEffacement,
  type ClassementModele,
  type DomaineEffacement,
  type ModeleDmmf,
  estModeleZonePrivee,
  schemaSansZonePrivee,
} from './perimetre-effacement'

const ORDRE_DOMAINES: readonly DomaineEffacement[] = [
  'compte', 'support', 'communaute', 'terrain', 'maraichage', 'verger', 'phyto', 'elevage', 'stocks',
  'commerce', 'comptabilite', 'banque', 'boutique', 'caisse', 'assistant', 'capteurs', 'referentiel', 'systeme',
]

const LIBELLE_DOMAINE: Record<DomaineEffacement, string> = {
  compte: 'Compte',
  support: 'Support et retours',
  communaute: 'Communauté et référentiels contribués',
  terrain: 'Terrain et plan',
  maraichage: 'Maraîchage',
  verger: 'Verger',
  phyto: 'Registre phytopharmaceutique',
  elevage: 'Élevage',
  stocks: 'Stocks',
  commerce: 'Commerce',
  comptabilite: 'Comptabilité',
  banque: 'Banque',
  boutique: 'Boutique',
  caisse: 'Caisse sécurisée',
  assistant: 'Assistant IA',
  capteurs: 'Capteurs et météo',
  referentiel: 'Référentiels partagés',
  systeme: 'Système',
}

const LIBELLE_CATEGORIE: Record<CategorieEffacement, string> = {
  effacer: 'Effacer',
  conserver: 'Conserver',
  anonymiser: 'Anonymiser',
  hors_perimetre: 'Hors périmètre',
}

const cellule = (texte: string | undefined) => (texte ? texte.replace(/\|/g, '\\|').replace(/\n/g, ' ') : '—')

function entrees(): Array<[string, ClassementModele]> {
  const toutes = Object.entries(PERIMETRE_EFFACEMENT) as Array<[string, ClassementModele]>
  return ORDRE_DOMAINES.flatMap((domaine) => toutes.filter(([, c]) => c.domaine === domaine))
}

function basesCitees(classement: ClassementModele): string {
  if (!classement.bases?.length) return '—'
  return classement.bases.map((cle) => {
    const base = BASES_LEGALES[cle]
    return `[${base.texte}, ${base.article}](${base.lien})`
  }).join(' ; ')
}

/**
 * Contraintes absentes du schéma public (modèle ou champ de la zone privée) :
 * figées ici pour que le document soit le même dans les deux dépôts. Avec le
 * schéma complet, `contraintesDeCles` vérifie que chacune existe et que toute
 * contrainte d'un modèle de la zone privée y figure (la génération échoue
 * sinon) ; avec le schéma public, le test du document vérifie qu'il n'en
 * manque aucune.
 */
export const CONTRAINTES_ZONE_PRIVEE: readonly string[] = [
  '| `CaisseLot.fromage` | `LotFromage` | NoAction | l’effacement serait refusé par la base |',
  '| `CaisseLot.ruche` | `ProductionRuche` | NoAction | l’effacement serait refusé par la base |',
  '| `LigneCommandeBoutique.produitUnite` | `ProduitBoutique` | NoAction | l’effacement serait refusé par la base |',
]

/**
 * Relations d'un modèle conservé vers un modèle effacé : ce que la phase 2
 * doit résoudre. Triées par texte, pour un ordre identique sur les deux schémas.
 */
export function contraintesDeCles(modeles: readonly ModeleDmmf[]): string[] {
  const perimetre = PERIMETRE_EFFACEMENT as Readonly<Record<string, ClassementModele>>
  const calculees: string[] = []
  const deZonePrivee: string[] = []
  for (const modele of modeles) {
    if (perimetre[modele.name]?.categorie !== 'conserver') continue
    for (const champ of modele.fields) {
      if (champ.kind !== 'object' || champ.isList || !champ.relationFromFields?.length) continue
      if (perimetre[champ.type]?.categorie !== 'effacer') continue
      const regle = champ.relationOnDelete ?? 'défaut Prisma'
      const effet = regle === 'Cascade'
        ? 'la ligne conservée partirait en cascade'
        : regle === 'SetNull'
          ? 'la référence serait mise à nul'
          : 'l’effacement serait refusé par la base'
      const ligne = `| \`${modele.name}.${champ.name}\` | \`${champ.type}\` | ${regle} | ${effet} |`
      calculees.push(ligne)
      if (estModeleZonePrivee(modele.name) || estModeleZonePrivee(champ.type)) deZonePrivee.push(ligne)
    }
  }
  const tri = (lignes: Iterable<string>) => [...new Set(lignes)].sort((a, b) => a.localeCompare(b))
  // Schéma public : les contraintes de la zone privée viennent de la liste figée.
  if (schemaSansZonePrivee(modeles)) return tri([...calculees, ...CONTRAINTES_ZONE_PRIVEE])
  const absentes = CONTRAINTES_ZONE_PRIVEE.filter((ligne) => !calculees.includes(ligne))
  const nonFigees = deZonePrivee.filter((ligne) => !CONTRAINTES_ZONE_PRIVEE.includes(ligne))
  if (absentes.length || nonFigees.length) {
    throw new Error(`CONTRAINTES_ZONE_PRIVEE ne correspond plus au schéma : absentes ${JSON.stringify(absentes)}, à ajouter ${JSON.stringify(nonFigees)}`)
  }
  return tri(calculees)
}

export function genererDocumentPerimetre(modeles: readonly ModeleDmmf[]): string {
  const liste = entrees()
  const compte = (categorie: CategorieEffacement) => liste.filter(([, c]) => c.categorie === categorie).length
  const lignes: string[] = []
  const l = (texte = '') => lignes.push(texte)

  l('# Périmètre de « Effacer toutes mes données » (RGPD MC6, phase 1)')
  l()
  l('> Document généré depuis `src/lib/rgpd/perimetre-effacement.ts` par `npx tsx scripts/rgpd/generer-perimetre-effacement.ts`. Ne pas éditer à la main : le test `src/lib/rgpd/perimetre-effacement.test.ts` échoue si ce fichier diverge du module.')
  l()
  l('## Objet et règles')
  l()
  l('- Geste visé : `DELETE /api/user/delete-data` (Paramètres, zone de danger). Il **garde le compte** et vide les données d’exploitation. La suppression du compte (`DELETE /api/account`) est un autre geste ; ce cadrage la mentionne seulement quand elle diffère.')
  l('- **Effacer** : supprimé par le geste. **Conserver** : gardé malgré le geste, avec une base citée et une durée ; pour les données d’exploitation, l’effacement est différé à la fin de la durée (RGPD, art. 17, 3, b : obligation légale). **Anonymiser** : gardé sans lien avec la personne. **Hors périmètre** : référentiel ou système sans tenant.')
  l('- Règle de prudence : sans texte vérifiable, un modèle n’est pas « conservé » ; il est proposé à l’effacement et la question figure dans la liste « à valider par Guillaume ». Les catégories de cette liste ne sont que des propositions.')
  l('- Rattachement : `proprietaire` (porte le tenant : `userId`, `ownerUserId`… ou une relation vers `User`), `parent` (rattaché par clé à un modèle qui le porte), `instance` (sans tenant), `cle` (table technique sans colonne tenant, dont certaines lignes sont propres au compte par le préfixe de leur clé).')
  l('- Durées de l’élevage : le registre général (arrêté du 5 juin 2000, art. 11 : cinq ans, trois ans pour une bande de volailles hors ordonnances) et les enregistrements médicamenteux (règl. (UE) 2019/6, art. 108 : cinq ans, sans exception volailles) sont distincts ; une donnée soumise aux deux suit la plus longue échéance. « Conservation conditionnelle » : seule la part décrite dans la condition est conservée, le reste est effacé.')
  l('- Phase 1 : rien n’est supprimé ni modifié dans la route ou les écrans. Les conditions décrivent ce que la phase 2 devra mettre en œuvre.')
  l()
  l('## Résumé')
  l()
  l(`${liste.length} modèles Prisma classés : ${compte('effacer')} à effacer, ${compte('conserver')} à conserver, ${compte('anonymiser')} à anonymiser, ${compte('hors_perimetre')} hors périmètre. ${liste.filter(([, c]) => c.aValider).length} modèles portent un point à valider par Guillaume.`)
  l()
  l('Aucune anonymisation n’est proposée pour ce geste, qui garde le compte : la reprise des référentiels partagés par « Communauté Gleba » et la signature « Ancien membre » des versions publiées s’appliquent à la suppression du compte (`reprendreReferentielCommunaute`, `src/lib/account-lifecycle.ts`).')
  l()
  l('## Bases légales citées')
  l()
  l('| Clé | Texte et article | Objet | Vérification |')
  l('|---|---|---|---|')
  for (const [cle, base] of Object.entries(BASES_LEGALES)) {
    l(`| \`${cle}\` | [${cellule(base.texte)}, ${cellule(base.article)}](${base.lien}) | ${cellule(base.objet)} | ${cellule(base.verification)} |`)
  }
  l()
  l('## Classement par modèle')
  for (const domaine of ORDRE_DOMAINES) {
    const duDomaine = liste.filter(([, c]) => c.domaine === domaine)
    if (!duDomaine.length) continue
    l()
    l(`### ${LIBELLE_DOMAINE[domaine]}`)
    l()
    l('| Modèle | Catégorie | Rattachement | Motif et condition | Durée | Base légale | Fichiers | À valider |')
    l('|---|---|---|---|---|---|---|---|')
    for (const [nom, c] of duDomaine) {
      const rattachement = c.rattachement === 'parent' ? `parent : \`${c.parent}\`` : c.rattachement
      const motif = c.condition ? `${c.motif} ${c.condition}` : c.motif
      l(`| \`${nom}\` | ${LIBELLE_CATEGORIE[c.categorie]} | ${rattachement} | ${cellule(motif)} | ${cellule(c.duree)} | ${basesCitees(c)} | ${cellule(c.fichiers)} | ${c.aValider ? 'Oui' : '—'} |`)
    }
  }
  l()
  l('## À valider par Guillaume')
  l()
  // Une question partagée par plusieurs modèles n'apparaît qu'une fois.
  const questions = new Map<string, string[]>()
  for (const [nom, c] of liste) {
    if (!c.aValider) continue
    const cle = `${c.aValider}\u0000${c.categorie}`
    questions.set(cle, [...(questions.get(cle) ?? []), nom])
  }
  ;[...questions].forEach(([cle, noms], i) => {
    const [question, categorie] = cle.split('\u0000') as [string, CategorieEffacement]
    l(`${i + 1}. ${noms.map((n) => `\`${n}\``).join(', ')} (proposé : ${LIBELLE_CATEGORIE[categorie].toLowerCase()}) — ${question}`)
  })
  l()
  l('Questions transverses :')
  l()
  l('- Bases non relues par le développeur (Légifrance et EUR-Lex refusent l’accès automatisé) : C. com. L123-22, LPF L102 B et règl. 2019/6 art. 108 ont été relus par les revues du 2026-11-15 (durées de dix, six et cinq ans confirmées) ; annexe I et art. 7 de l’arrêté du 5 juin 2000 aussi. Restent à relire : CGI 286 et BOI-TVA-DECLA-30-10-30. Confirmer avant la phase 2.')
  l('- Fin de la durée de conservation : effacement automatique des données conservées à l’échéance (tâche planifiée), ou seulement à la demande ?')
  l('- Accès aux données conservées après le geste : lecture seule dans l’application, export seul, ou archive hors application ?')
  l()
  l('## Contraintes de clés étrangères pour la phase 2')
  l()
  l('Relations d’un modèle conservé vers un modèle effacé, lues dans le schéma. Chacune demande soit de garder la ligne référencée, soit de détacher la référence avant l’effacement.')
  l()
  const contraintes = contraintesDeCles(modeles)
  if (contraintes.length) {
    l('| Champ du modèle conservé | Modèle effacé | ON DELETE | Effet si on efface |')
    l('|---|---|---|---|')
    contraintes.forEach((ligne) => l(ligne))
  } else {
    l('Aucune.')
  }
  l()
  l('Autres points techniques : les miroirs comptables (`VenteManuelle`, `DepenseManuelle` avec `auto = true`) sont liés à leur source par `sourceType`/`sourceId` sans clé : la phase 2 ne doit pas passer par les helpers de suppression des sources, qui suppriment aussi le miroir. Les modèles sans clé étrangère vers `users` ne sont emportés par aucune cascade.')
  l()
  l('## Fichiers hors base')
  l()
  liste.filter(([, c]) => c.fichiers).forEach(([nom, c]) => l(`- \`${nom}\` (${LIBELLE_CATEGORIE[c.categorie].toLowerCase()}) : ${c.fichiers}`))
  l()
  return `${lignes.join('\n')}`
}
