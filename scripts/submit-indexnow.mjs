const host = "gleba.fr";
const key = "1c943f7c7006d54211c7143b25a23aa8";
const defaultPaths = [
  "/",
  "/logiciel-maraichage",
  "/planification-maraichage",
  "/rotation-cultures-maraichage",
  "/itineraire-technique-maraichage",
  "/calendrier-semis",
  "/logiciel-arboriculture",
  "/logiciel-verger",
  "/logiciel-elevage",
  "/logiciel-elevage-volailles",
  "/logiciel-elevage-ovin",
  "/logiciel-elevage-caprin",
  "/logiciel-permaculture",
  "/logiciel-micro-ferme",
  "/logiciel-jardin",
  "/logiciel-potager",
  "/registre-phytosanitaire",
  "/assistant-ia-agricole",
  "/referentiel",
];

const paths = process.argv.slice(2);
const urlList = (paths.length ? paths : defaultPaths).map((path) =>
  new URL(path, `https://${host}`).toString(),
);

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host,
    key,
    keyLocation: `https://${host}/${key}.txt`,
    urlList,
  }),
});

if (!response.ok) {
  throw new Error(`IndexNow a répondu ${response.status}: ${await response.text()}`);
}

console.log(`IndexNow: ${response.status}, ${urlList.length} URL soumises.`);
