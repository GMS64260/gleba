import type { Metadata } from "next";
import { GuideArticle } from "@/components/seo/GuideArticle";
import { ogBase } from "@/lib/seo/og";

export const metadata: Metadata = {
  title: "Logiciels de maraîchage libres ou gratuits : comparatif 2026",
  description: "Brinjel, Ouvretaferme, PermaTechnics, Elzeard, CropMaker, farmOS, LiteFarm et Gleba : licence, auto-hébergement, prix et périmètre, relevés le 10 octobre 2026.",
  alternates: { canonical: "https://gleba.fr/comparatif-logiciels-maraichage" },
  openGraph: {
    ...ogBase,
    title: "Logiciels de maraîchage libres ou gratuits : le comparatif",
    description: "Licence, auto-hébergement, prix public et périmètre de huit logiciels de maraîchage, sources des éditeurs à l'appui.",
    url: "https://gleba.fr/comparatif-logiciels-maraichage",
    type: "article",
  },
};

type Ligne = { nom: string; licence: string; hebergement: string; prix: string; perimetre: string };

const LIGNES: Ligne[] = [
  { nom: "Brinjel", licence: "Libre (AGPL-3.0)", hebergement: "Possible, configuration à prévoir", prix: "5, 10 ou 30 €/mois selon la surface ; essai 30 jours, pas de formule gratuite", perimetre: "Planification maraîchère, tâches, planches et rotations, récoltes, semences" },
  { nom: "Ouvretaferme", licence: "Licence propre à l'association, réservée aux fermes en agriculture biologique", hebergement: "Code public annoncé comme non fonctionnel en l'état", prix: "Offre Essentiel gratuite ; offres payantes de 9 à 30 € HT/mois (« Pilotage » à 25 € dès le 1er novembre)", perimetre: "Vente, factures, boutiques, caisse, stocks ; plan de culture et comptabilité dans les offres payantes" },
  { nom: "PermaTechnics", licence: "Propriétaire", hebergement: "Non", prix: "Gratuit jusqu'à 50 ares, puis 19,95 ou 34,95 € HT/mois", perimetre: "Planification, tâches, semences, récoltes, registre réglementaire en PDF" },
  { nom: "Elzeard", licence: "Propriétaire", hebergement: "Non", prix: "30, 60 ou 90 € HT/mois selon la surface ; essai 30 jours", perimetre: "Maraîchage, plein champ, arboriculture, floriculture ; planification, traçabilité, stocks" },
  { nom: "CropMaker", licence: "Non précisée, pas de code public trouvé", hebergement: "Fichier local", prix: "Gratuit, sans compte", perimetre: "Planches, itinéraires, emblavement, calendrier des récoltes, temps de travail, chiffre d'affaires" },
  { nom: "farmOS", licence: "Libre (GPL-2.0)", hebergement: "Oui", prix: "Gratuit ; hébergement Farmier à partir de 75 $/an", perimetre: "Cultures, animaux, journaux d'activité" },
  { nom: "LiteFarm", licence: "Libre (GPL-3.0)", hebergement: "Possible", prix: "Gratuit", perimetre: "Tâches, cartes, récoltes, finances, certifications ; interface en français" },
  { nom: "Gleba", licence: "Libre (AGPL-3.0)", hebergement: "Oui (Docker Compose), sans l'assistant IA", prix: "Gratuit pendant la bêta sur gleba.fr ; auto-hébergement gratuit", perimetre: "Maraîchage, verger, élevage, registre phytosanitaire, stocks, factures, boutique, assistant IA" },
];

export default function Page() {
  return (
    <GuideArticle
      breadcrumb="Comparatif des logiciels de maraîchage"
      currentPath="/comparatif-logiciels-maraichage"
      eyebrow="Comparatif · Logiciels de maraîchage"
      title="Logiciels de maraîchage libres ou gratuits : le comparatif"
      chapeau="Libre ne veut pas dire gratuit, et gratuit ne veut pas dire libre. Ce comparatif relève, pour chaque outil, la licence, la possibilité d'héberger le logiciel soi-même, le prix public et le périmètre couvert, à partir des pages des éditeurs consultées le 10 octobre 2026. Il est publié par Gleba, l'un des logiciels comparés."
      miseAJour="2026-10-10"
      aRetenir={[
        "Brinjel, farmOS, LiteFarm et Gleba sont publiés sous licence libre ; Brinjel n'a pas de formule gratuite.",
        "PermaTechnics est gratuit jusqu'à 50 ares, Ouvretaferme garde une offre Essentiel gratuite, CropMaker est gratuit sans compte.",
        "Qrop est remplacé par Brinjel ; La Pépinière a cessé de fonctionner le 1er juillet 2026.",
        "Pour une ferme diversifiée, vérifiez si le verger et l'élevage sont couverts : peu d'outils de maraîchage vont au-delà du potager.",
      ]}
      sections={[
        {
          titre: "Libre, gratuit, auto-hébergé : trois questions différentes",
          contenu: (
            <>
              <p>
                Un <strong>logiciel libre</strong> est publié sous une licence qui autorise à l&apos;utiliser, à étudier son code, à le modifier et à le redistribuer, sans restriction d&apos;usage. Il peut être payant à l&apos;usage, notamment quand l&apos;éditeur l&apos;héberge pour vous.
              </p>
              <p>
                Un <strong>logiciel gratuit</strong> ne coûte rien, sans dire si son code est ouvert ni si l&apos;offre gratuite durera. Un <strong>logiciel auto-hébergeable</strong> peut tourner sur votre propre serveur : vos données restent chez vous, au prix d&apos;un peu d&apos;administration.
              </p>
            </>
          ),
        },
        {
          titre: "Le tableau comparatif",
          contenu: (
            <>
              <div className="overflow-x-auto rounded-xl border border-lin bg-craie" role="region" aria-label="Tableau comparatif, défilable horizontalement" tabIndex={0}>
                <table className="w-full min-w-[720px] text-left text-sm">
                  <caption className="sr-only">Licence, auto-hébergement, prix public et périmètre des logiciels de maraîchage, relevés le 10 octobre 2026</caption>
                  <thead className="border-b border-lin bg-papier text-ardoise">
                    <tr>
                      <th scope="col" className="px-3 py-3 font-semibold">Logiciel</th>
                      <th scope="col" className="px-3 py-3 font-semibold">Licence</th>
                      <th scope="col" className="px-3 py-3 font-semibold">Auto-hébergement</th>
                      <th scope="col" className="px-3 py-3 font-semibold">Prix public</th>
                      <th scope="col" className="px-3 py-3 font-semibold">Périmètre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-lin">
                    {LIGNES.map((l) => (
                      <tr key={l.nom} className="align-top">
                        <th scope="row" className="px-3 py-3 font-semibold text-encre">{l.nom}</th>
                        <td className="px-3 py-3">{l.licence}</td>
                        <td className="px-3 py-3">{l.hebergement}</td>
                        <td className="px-3 py-3">{l.prix}</td>
                        <td className="px-3 py-3">{l.perimetre}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-ardoise">Prix hors taxes quand l&apos;éditeur le précise, relevés sur les pages tarifaires le 10 octobre 2026 ; ils peuvent avoir changé depuis.</p>
            </>
          ),
        },
        {
          titre: "Outil par outil",
          contenu: (
            <>
              <p>
                <strong>Brinjel</strong>, développé par un maraîcher et successeur de Qrop, est un logiciel libre de planification maraîchère. Son code est public sous AGPL-3.0 ; l&apos;offre hébergée est payante selon la surface (de 1 à plus de 3 hectares), avec un essai de trente jours.
              </p>
              <p>
                <strong>Ouvretaferme</strong> organise surtout la vente : factures, boutiques, caisse et stocks, avec plus de 5 000 producteurs annoncés. Sa licence est propre à l&apos;association et réservée aux fermes en agriculture biologique. L&apos;association annonce des offres payantes à partir du 1er novembre ; les fonctions essentielles restent gratuites.
              </p>
              <p>
                <strong>PermaTechnics</strong> et <strong>Elzeard</strong> sont des logiciels propriétaires hébergés par leur éditeur. PermaTechnics est gratuit jusqu&apos;à 50 ares et génère un registre réglementaire en PDF ; Elzeard couvre aussi le plein champ, l&apos;arboriculture et la floriculture.
              </p>
              <p>
                <strong>CropMaker</strong> est gratuit et fonctionne sans compte, avec un fichier local ; sa licence et son état de maintenance ne sont pas indiqués.
              </p>
              <p>
                <strong>farmOS</strong> et <strong>LiteFarm</strong> sont des logiciels libres généralistes développés hors de France : farmOS couvre cultures et animaux ; LiteFarm, porté par l&apos;Université de Colombie-Britannique, est disponible en français.
              </p>
              <p>
                <strong>Gleba</strong>, publié sous AGPL-3.0, relie maraîchage, verger suivi arbre par arbre, ateliers d&apos;élevage, registre phytosanitaire, stocks, factures et boutique. Le service hébergé sur gleba.fr est gratuit pendant la bêta et deviendra payant ; l&apos;auto-hébergement reste gratuit, sans l&apos;assistant IA, qui n&apos;est pas publié dans le code.
              </p>
            </>
          ),
        },
        {
          titre: "Ce qui a disparu ou changé",
          contenu: (
            <ul>
              <li><strong>Qrop</strong> : remplacé par Brinjel, présenté comme son successeur.</li>
              <li><strong>La Pépinière</strong> (projet Mesclun) : outils arrêtés le 1er juillet 2026 ; sa base de 75 légumes reste publiée en données ouvertes.</li>
              <li><strong>Tania</strong> : projet archivé, sans évolution depuis 2021.</li>
              <li><strong>Ouvretaferme</strong> : passage à des offres payantes au 1er novembre, l&apos;offre Essentiel restant gratuite.</li>
            </ul>
          ),
        },
        {
          titre: "Comment choisir",
          contenu: (
            <ul>
              <li><strong>Vous ne faites que du maraîchage et planifiez finement</strong> : comparez Brinjel, PermaTechnics et Elzeard sur votre surface.</li>
              <li><strong>La vente directe est votre priorité</strong> : Ouvretaferme est conçu autour de la vente, si votre ferme est en bio.</li>
              <li><strong>Vous voulez un logiciel libre et garder vos données</strong> : Brinjel, farmOS, LiteFarm et Gleba publient leur code.</li>
              <li><strong>Votre ferme est diversifiée</strong> (verger, élevage, vente) : vérifiez que ces ateliers sont couverts, et pas seulement le potager.</li>
              <li><strong>Vous êtes en installation</strong> : privilégiez un outil qui permet de préparer la ferme avant la première saison, et testez-le pendant l&apos;hiver, période du plan de culture.</li>
            </ul>
          ),
        },
      ]}
      appel={{
        titre: "Essayer Gleba sur une ferme de démonstration",
        texte: "Plan de la ferme, cultures, verger, élevage et registres : la ferme de démonstration se visite sans inscription.",
        href: "/login?demo=1",
        libelle: "Visiter la ferme de démonstration",
      }}
      sources={[
        { titre: "Tarifs de Brinjel", url: "https://brinjel.com/fr/tarifs", editeur: "Brinjel" },
        { titre: "Dépôt du code de Brinjel", url: "https://framagit.org/brinjel/brinjel", editeur: "Framagit" },
        { titre: "Qrop, successeur annoncé : Brinjel", url: "https://qrop.frama.io/", editeur: "Qrop" },
        { titre: "Offres d'Ouvretaferme", url: "https://www.ouvretaferme.org/presentation/offres", editeur: "Ouvretaferme" },
        { titre: "Foire aux questions d'Ouvretaferme", url: "https://www.ouvretaferme.org/presentation/faq", editeur: "Ouvretaferme" },
        { titre: "Blog d'Ouvretaferme", url: "https://blog.ouvretaferme.org/", editeur: "Ouvretaferme" },
        { titre: "Dépôt public et licence d'Ouvretaferme", url: "https://github.com/ouvretaferme/ouvretaferme-public", editeur: "GitHub" },
        { titre: "Offre de PermaTechnics", url: "https://www.permatechnics.com/notre-offre/", editeur: "PermaTechnics" },
        { titre: "Tarifs d'Elzeard", url: "https://www.elzeard.co/tarifs/", editeur: "Elzeard" },
        { titre: "CropMaker", url: "https://roquette-labs.fr/", editeur: "Roquette Labs" },
        { titre: "Dépôt du code de farmOS", url: "https://github.com/farmOS/farmOS", editeur: "GitHub" },
        { titre: "Tarifs de l'hébergement Farmier", url: "https://farmier.com/pricing", editeur: "Farmier" },
        { titre: "LiteFarm", url: "https://www.litefarm.org/", editeur: "Université de Colombie-Britannique" },
        { titre: "Dépôt du code de LiteFarm", url: "https://github.com/LiteFarmOrg/LiteFarm", editeur: "GitHub" },
        { titre: "Outils du projet Mesclun (La Pépinière)", url: "https://outils-mesclun.fr", editeur: "Projet Mesclun" },
        { titre: "Tania, collectif archivé", url: "https://opencollective.com/tania", editeur: "Open Collective" },
        { titre: "Code de Gleba", url: "https://github.com/GMS64260/gleba", editeur: "GitHub" },
      ]}
      faqs={[
        { question: "Quel logiciel de maraîchage est gratuit ?", answer: "Au 10 octobre 2026 : PermaTechnics jusqu'à 50 ares, l'offre Essentiel d'Ouvretaferme, CropMaker, LiteFarm, farmOS en auto-hébergement, ainsi que Gleba pendant sa bêta hébergée. Brinjel propose un essai de trente jours mais pas de formule gratuite." },
        { question: "Quel logiciel de maraîchage est open source ?", answer: "Brinjel (AGPL-3.0), farmOS (GPL-2.0), LiteFarm (GPL-3.0) et Gleba (AGPL-3.0) publient leur code sous licence libre. Ouvretaferme a une licence propre, réservée aux fermes en agriculture biologique." },
        { question: "Qrop existe-t-il encore ?", answer: "Qrop est remplacé par Brinjel, que son site présente comme son successeur." },
        { question: "Quel logiciel pour une ferme avec maraîchage, verger et élevage ?", answer: "Peu d'outils de maraîchage couvrent aussi le verger et l'élevage. Gleba relie les trois ; farmOS gère cultures et animaux ; Elzeard couvre l'arboriculture mais pas l'élevage." },
        { question: "Ce comparatif est-il neutre ?", answer: "Il est publié par Gleba, l'un des logiciels comparés. Chaque information vient de la page de l'éditeur citée en source et a été relevée le 10 octobre 2026 ; signalez toute erreur à contact@gleba.fr." },
      ]}
    />
  );
}
