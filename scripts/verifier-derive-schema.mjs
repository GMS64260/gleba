// Garde contre la dérive entre `prisma/schema.prisma` et la base réellement
// produite par `prisma migrate deploy`.
//
// Sur une base migrée de zéro (DATABASE_URL), demande à Prisma le SQL qui
// ferait passer la base au schéma, puis le compare à `prisma/derive-acceptee.sql`.
// Toute instruction nouvelle (ou disparue) fait échouer le contrôle : sans cette
// garde, un `prisma migrate dev` génère des DROP CONSTRAINT / DROP INDEX / DROP
// DEFAULT sur des objets posés en SQL que le schéma ne déclare pas.
//
// Limites (O4) : Prisma 5 ne compare pas les contraintes CHECK, les index
// partiels ni les triggers. Un résultat conforme ne prouve donc pas leur
// présence ni leur définition : ils exigent des contrôles PostgreSQL dédiés.
// Limites (O5) : la CI publique ne rejoue que les migrations présentes dans
// son dépôt ; elle ne voit pas les migrations privées. Rejouer aussi cette
// garde avec le schéma et toutes les migrations privées sur une base jetable.
//
// Usage : DATABASE_URL=… node scripts/verifier-derive-schema.mjs
// Codes de sortie : 0 conforme, 1 dérive, 2 erreur d'exécution.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FICHIER_ACCEPTE = "prisma/derive-acceptee.sql";

/**
 * Instructions SQL d'un script Prisma, sans commentaires ni lignes vides,
 * espaces normalisés. Une instruction peut couvrir plusieurs lignes ; elle se
 * termine par `;`.
 */
export function instructions(sql) {
  const resultat = [];
  let instruction = "";
  const terminer = () => {
    if (instruction.trim()) resultat.push(`${instruction.trim()};`);
    instruction = "";
  };
  const espace = () => {
    if (instruction && !instruction.endsWith(" ")) instruction += " ";
  };

  for (let i = 0; i < sql.length;) {
    if (sql.startsWith("--", i)) {
      const fin = sql.indexOf("\n", i + 2);
      i = fin === -1 ? sql.length : fin + 1;
      espace();
    } else if (sql.startsWith("/*", i)) {
      // PostgreSQL accepte les commentaires de bloc imbriqués.
      let profondeur = 1;
      i += 2;
      while (i < sql.length && profondeur) {
        if (sql.startsWith("/*", i)) { profondeur++; i += 2; }
        else if (sql.startsWith("*/", i)) { profondeur--; i += 2; }
        else i++;
      }
      espace();
    } else if (sql[i] === "'" || sql[i] === '"') {
      // Ne jamais retirer un marqueur de commentaire dans une valeur ou un
      // identifiant SQL ; conserver aussi ses espaces et ses points-virgules.
      const debut = i;
      const guillemet = sql[i++];
      const echappe = guillemet === "'" && /(?:^|[^a-zA-Z0-9_$])[eE]$/.test(sql.slice(0, debut));
      while (i < sql.length) {
        if (echappe && sql[i] === "\\") { i += 2; }
        else if (sql[i++] === guillemet) {
          if (sql[i] === guillemet) i++;
          else break;
        }
      }
      instruction += sql.slice(debut, i);
    } else if (sql[i] === "$" && /^(?:\$[a-zA-Z_][a-zA-Z0-9_]*\$|\$\$)/.test(sql.slice(i))) {
      const balise = sql.slice(i).match(/^\$(?:[a-zA-Z_][a-zA-Z0-9_]*)?\$/)[0];
      const fin = sql.indexOf(balise, i + balise.length);
      const suivant = fin === -1 ? sql.length : fin + balise.length;
      instruction += sql.slice(i, suivant);
      i = suivant;
    } else if (sql[i] === ";") {
      terminer();
      i++;
    } else if (/\s/.test(sql[i])) {
      espace();
      i++;
    } else {
      instruction += sql[i++];
    }
  }
  terminer();
  return resultat;
}

/** Écart entre deux listes d'instructions (comparées comme multiensembles). */
export function comparer(attendues, obtenues) {
  const reste = [...attendues];
  const nouvelles = [];
  for (const s of obtenues) {
    const i = reste.indexOf(s);
    if (i === -1) nouvelles.push(s);
    else reste.splice(i, 1);
  }
  return { nouvelles, disparues: reste };
}

function migrateDiff() {
  const r = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules/prisma/build/index.js"),
      "migrate",
      "diff",
      "--from-schema-datasource",
      "prisma/schema.prisma",
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--script",
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  if (r.status !== 0) {
    process.stderr.write(r.stdout ?? "");
    process.stderr.write(r.stderr ?? "");
    throw new Error(`prisma migrate diff a échoué (code ${r.status ?? r.signal})`);
  }
  return r.stdout;
}

function principal() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL manquant : il faut une base fraîchement migrée par `prisma migrate deploy`.");
    return 2;
  }
  let sortie;
  try {
    sortie = migrateDiff();
  } catch (e) {
    console.error(e.message);
    return 2;
  }
  const acceptees = instructions(readFileSync(path.join(root, FICHIER_ACCEPTE), "utf8"));
  const obtenues = instructions(sortie);
  const { nouvelles, disparues } = comparer(acceptees, obtenues);

  if (!nouvelles.length && !disparues.length) {
    console.log(
      `Schéma Prisma aligné sur la base migrée (${obtenues.length} écart(s) accepté(s), voir ${FICHIER_ACCEPTE}).`,
    );
    return 0;
  }

  console.error("ÉCHEC : prisma/schema.prisma et la base produite par les migrations divergent.\n");
  if (nouvelles.length) {
    console.error("Instructions que `prisma migrate dev` générerait et qui ne sont pas acceptées :");
    for (const s of nouvelles) console.error(`  ${s}`);
    console.error(`
Que faire :
  - un objet existe en base (posé par une migration SQL) mais pas dans le schéma
    (DROP CONSTRAINT / DROP INDEX / DROP DEFAULT / RENAME) : le déclarer dans
    schema.prisma au nom exact, sans toucher la base : relation avec
    \`map: "<contrainte>"\` et les onDelete/onUpdate réels, \`@@index([...], map: "<index>")\`,
    \`@@unique(..., map:)\`, \`@default(...)\`, type natif (\`@db.Timestamptz(6)\`…) ;
  - le schéma déclare un objet que la base n'a pas (ADD / CREATE / SET) :
    écrire la migration SQL qui le crée, ou retirer la déclaration ;
  - en dernier recours seulement, si Prisma ne sait pas l'exprimer ou si
    l'écart est voulu, ajouter l'instruction à ${FICHIER_ACCEPTE} avec un
    commentaire qui le justifie.
Reproduire : base neuve, \`prisma migrate deploy\`, puis
  node scripts/verifier-derive-schema.mjs`);
  }
  if (disparues.length) {
    console.error(`\nInstructions acceptées dans ${FICHIER_ACCEPTE} que Prisma ne produit plus (écart résorbé) :`);
    for (const s of disparues) console.error(`  ${s}`);
    console.error(`Les retirer de ${FICHIER_ACCEPTE}.`);
  }
  console.error("\nSortie complète de `prisma migrate diff --script` :\n");
  console.error(sortie);
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = principal();
}
