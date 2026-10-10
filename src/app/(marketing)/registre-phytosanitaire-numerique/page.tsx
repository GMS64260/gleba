import type { Metadata } from "next";
import { GuideArticle } from "@/components/seo/GuideArticle";
import { ogBase } from "@/lib/seo/og";

export const metadata: Metadata = {
  title: "Registre phytosanitaire numérique : le calendrier 2026-2030",
  description: "Arrêté du 24 décembre 2025 et règlement européen 2023/564 : informations obligatoires, format électronique, calendrier de conversion et conservation de cinq ans.",
  alternates: { canonical: "https://gleba.fr/registre-phytosanitaire-numerique" },
  openGraph: {
    ...ogBase,
    title: "Registre phytosanitaire numérique : ce qui change, et quand",
    description: "Obligations, informations à enregistrer et calendrier de conversion électronique du registre phyto, sources officielles à l'appui.",
    url: "https://gleba.fr/registre-phytosanitaire-numerique",
    type: "article",
  },
};

const CALENDRIER: [string, string][] = [
  ["Traitements réalisés en 2026", "Dispense de conversion électronique : le registre papier ou l'outil actuel restent admis."],
  ["Traitements de 2027 à 2029", "Papier ou outil actuel admis, à condition de convertir le registre au format électronique avant le 31 janvier de l'année suivante."],
  ["Traitements à partir du 1er janvier 2030", "Conversion au format électronique dans un délai maximal de trente jours."],
];

export default function Page() {
  return (
    <GuideArticle
      breadcrumb="Registre phytosanitaire numérique"
      currentPath="/registre-phytosanitaire-numerique"
      eyebrow="Guide · Réglementation phytosanitaire"
      title="Registre phytosanitaire numérique : ce qui change, et quand"
      chapeau="Le registre des traitements phytopharmaceutiques doit désormais pouvoir être tenu sous forme électronique, dans un format lisible par machine. Le règlement européen 2023/564 en pose le principe ; l'arrêté français du 24 décembre 2025 fixe les informations à enregistrer et un calendrier progressif jusqu'en 2030."
      miseAJour="2026-10-10"
      aRetenir={[
        "Les informations obligatoires s'appliquent depuis le 1er janvier 2026 ; c'est la conversion au format électronique qui est progressive.",
        "Traitements de 2027 : registre électronique à produire avant le 31 janvier 2028. À partir de 2030 : sous trente jours.",
        "Le registre se conserve au moins cinq ans après l'enregistrement.",
        "Aucun format de fichier n'est imposé, mais il doit permettre l'extraction automatique des données : un tableur ou un CSV lève le doute qu'un PDF peut laisser.",
      ]}
      sections={[
        {
          titre: "D'où vient l'obligation",
          contenu: (
            <>
              <p>
                Le registre n&apos;est pas nouveau : l&apos;article 67 du règlement (CE) n° 1107/2009 impose déjà aux utilisateurs professionnels de tenir un registre des produits utilisés (nom du produit, moment, dose, zone et culture) pendant trois ans au moins. En France, il était déjà obligatoire, sur papier ou sur logiciel au choix, et conservé cinq ans.
              </p>
              <p>
                Le <strong>règlement d&apos;exécution (UE) 2023/564</strong> du 10 mars 2023, applicable à partir du 1er janvier 2026, change la forme : le registre est tenu sous forme électronique, dans un format lisible par machine. Chaque utilisation est enregistrée sans délai ; un registre qui n&apos;est pas créé directement sous forme électronique doit être converti au plus tard trente jours après l&apos;utilisation, sauf délai national différent. Il est remis sans délai à l&apos;autorité qui le demande.
              </p>
              <p>
                Le <strong>règlement d&apos;exécution (UE) 2025/2203</strong> du 31 octobre 2025 a ensuite permis aux États membres de dispenser de conversion électronique les registres des utilisations faites avant le 1er janvier 2027. Ce n&apos;est donc pas un report de tout le règlement : c&apos;est la conversion des traitements de 2026 qui peut être évitée.
              </p>
            </>
          ),
        },
        {
          titre: "Le calendrier en France",
          contenu: (
            <>
              <p>
                L&apos;<strong>arrêté du 24 décembre 2025</strong> relatif à la tenue des registres d&apos;utilisation des produits phytopharmaceutiques et de leurs adjuvants, en vigueur au 1er janvier 2026, prévoit un registre par établissement (SIRET) et le calendrier suivant :
              </p>
              <div className="overflow-hidden rounded-xl border border-lin bg-craie">
                <table className="w-full text-left text-[15px]">
                  <thead className="border-b border-lin bg-papier text-sm text-ardoise">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Traitements</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Obligation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-lin">
                    {CALENDRIER.map(([periode, regle]) => (
                      <tr key={periode} className="align-top">
                        <th scope="row" className="px-4 py-3 font-semibold">{periode}</th>
                        <td className="px-4 py-3">{regle}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>Le registre se conserve au moins cinq ans après l&apos;enregistrement, en garantissant sa pérennité et son intégrité.</p>
            </>
          ),
        },
        {
          titre: "Les informations à enregistrer",
          contenu: (
            <>
              <p>Pour chaque utilisation, culture par culture, y compris le semis de semences traitées, l&apos;arrêté demande :</p>
              <ul>
                <li>le numéro SIRET de l&apos;établissement, et celui du bénéficiaire en cas de prestation ;</li>
                <li>le nom commercial du produit et son numéro d&apos;autorisation de mise sur le marché (AMM, sept chiffres) ;</li>
                <li>la substance active, pour les semences traitées ;</li>
                <li>la date, la dose, et la surface, le volume ou la quantité traités ;</li>
                <li>la culture ou l&apos;affectation de la zone, et sa localisation ;</li>
                <li>la mention agriculture biologique ;</li>
                <li>le numéro de lot des semences ou plants traités.</li>
              </ul>
              <p>
                Selon le cas s&apos;y ajoutent les heures de début et de fin (quand l&apos;autorisation ou la réglementation l&apos;exige), le délai de rentrée et le stade phénologique ; la cible et le mode d&apos;application sont facultatifs. L&apos;arrêté précise aussi les formats : dates au format JJ/MM/AAAA, cultures en codes OEPP, stade BBCH sur deux chiffres, localisation par le registre parcellaire graphique (îlot, parcelle, code INSEE de la commune) ou par coordonnées GPS.
              </p>
            </>
          ),
        },
        {
          titre: "Quel format de fichier ?",
          contenu: (
            <>
              <p>
                Aucun format de fichier n&apos;est imposé et aucun modèle de tableur officiel n&apos;a été publié à ce jour. L&apos;exigence est un format lisible par machine, dont les données peuvent être extraites automatiquement.
              </p>
              <p>
                Les avis divergent sur le PDF : la presse agricole cite comme acceptables les PDF issus de logiciels de traçabilité, quand d&apos;autres rappellent qu&apos;un cahier papier scanné ne suffira plus. Un export en tableur ou en CSV, une ligne par traitement, répond sans ambiguïté à l&apos;exigence d&apos;extraction automatique.
              </p>
            </>
          ),
        },
        {
          titre: "Ce que Gleba exporte aujourd'hui",
          contenu: (
            <>
              <p>
                Le registre phytosanitaire de Gleba s&apos;exporte en PDF et en CSV (une ligne par traitement). Il contient le SIRET de l&apos;exploitation en en-tête, puis pour chaque traitement : date, parcelle ou planche, espèce et variété, surface traitée en hectares, cible, produit, numéro d&apos;AMM, substance active, autorisation du produit en agriculture biologique, dose, volume de bouillie, délai avant récolte, conditions météo, zone non traitée, opérateur et numéro Certiphyto.
              </p>
              <p>
                Ne figurent pas encore dans l&apos;export : la localisation au format du registre parcellaire graphique ou en coordonnées GPS, les codes OEPP des cultures, le stade BBCH, les heures de début et de fin, le numéro de lot des semences ou plants traités, et la date au format JJ/MM/AAAA (l&apos;export l&apos;écrit en AAAA-MM-JJ). Vérifiez ces points avant votre première conversion obligatoire, au 31 janvier 2028 pour les traitements de 2027.
              </p>
            </>
          ),
        },
        {
          titre: "Les points à vérifier sur votre exploitation",
          contenu: (
            <ul>
              <li>Le numéro d&apos;AMM de chaque produit, sur sept chiffres.</li>
              <li>La localisation de chaque traitement, rapprochée de votre déclaration PAC (îlot et parcelle) ou en coordonnées GPS.</li>
              <li>Les traitements réalisés par un prestataire (entreprise de travaux, Cuma) : leur registre doit vous être remis ou rendu accessible.</li>
              <li>La conservation des registres pendant cinq ans au moins, sur un support qui garantit leur intégrité.</li>
              <li>Le registre fait partie des points contrôlés au titre de la conditionnalité des aides de la PAC.</li>
            </ul>
          ),
        },
      ]}
      appel={{
        titre: "Tenir son registre phyto au fil des traitements",
        texte: "Dans Gleba, un traitement saisi alimente le registre phytosanitaire et le carnet de culture, avec un contrôle des champs manquants et un export CSV.",
        href: "/registre-phytosanitaire",
        libelle: "Voir le registre phytosanitaire de Gleba",
      }}
      sources={[
        { titre: "Règlement d'exécution (UE) 2023/564 du 10 mars 2023", url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32023R0564", editeur: "EUR-Lex" },
        { titre: "Règlement d'exécution (UE) 2025/2203 du 31 octobre 2025", url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32025R2203", editeur: "EUR-Lex" },
        { titre: "Règlement (CE) n° 1107/2009, article 67", url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32009R1107", editeur: "EUR-Lex" },
        { titre: "Arrêté du 24 décembre 2025 relatif à la tenue des registres d'utilisation des produits phytopharmaceutiques", url: "https://aida.ineris.fr/reglementation/arrete-241225-relatif-a-tenue-registres-dutilisation-produits-phytopharmaceutiques", editeur: "AIDA (Ineris)" },
        { titre: "Guide phyto national, édition février 2024", url: "https://agri82.chambre-agriculture.fr/fileadmin/user_upload/Occitanie/075_Inst-Tarn-et-Garonne/6-PDF_PAGES_STATIQUES/4-Agroenvironnement/Reduire_ses_phytos_ecophyto/Guide_Phyto_National_Edition_Fevrier_2024.pdf", editeur: "Chambre d'agriculture de Tarn-et-Garonne" },
        { titre: "Contrôle de la conditionnalité : utilisation des produits phytosanitaires", url: "https://draaf.centre-val-de-loire.agriculture.gouv.fr/IMG/odt/PHYTO_03_TOsimplifie_2020_cle03d4f1.odt", editeur: "DRAAF Centre-Val de Loire" },
        { titre: "Registre phytosanitaire numérique : Annie Genevard fixe les règles pour 2027", url: "https://www.reussir.fr/grandes-cultures/registre-phytosanitaire-numerique-annie-genevard-fixe-les-regles-pour-2027", editeur: "Réussir, 6 janvier 2026" },
        { titre: "L'application du registre phytosanitaire numérique reportée au 1er janvier 2027", url: "https://www.pleinchamp.com/actualite/l-application-du-registre-phytosanitaire-numerique-reportee-au-1er-janvier-2027", editeur: "Pleinchamp, 16 octobre 2025" },
        { titre: "Registre phyto numérique : ce que change vraiment le report", url: "https://www.corteva.com/fr/cultures/toutes-cultures/registre-phyto-numerique-ce-que-change-vraiment-le-report.html", editeur: "Corteva, 14 janvier 2026" },
      ]}
      faqs={[
        { question: "Le registre phytosanitaire numérique est-il obligatoire en 2026 ?", answer: "Les informations à enregistrer s'appliquent depuis le 1er janvier 2026, mais les traitements réalisés en 2026 sont dispensés de conversion au format électronique. Pour les traitements de 2027 à 2029, la conversion doit être faite avant le 31 janvier de l'année suivante ; à partir de 2030, sous trente jours." },
        { question: "Combien de temps conserver le registre phytosanitaire ?", answer: "Au moins cinq ans après l'enregistrement, selon l'arrêté du 24 décembre 2025, en garantissant la pérennité et l'intégrité des données." },
        { question: "Un PDF suffit-il pour le registre numérique ?", answer: "Aucun format n'est imposé, mais le registre doit être lisible par machine, c'est-à-dire permettre l'extraction automatique des données. Les avis divergent sur le PDF ; un tableur ou un CSV, une ligne par traitement, répond sans ambiguïté à cette exigence." },
        { question: "Faut-il un logiciel payant ?", answer: "Non. Aucun logiciel particulier n'est imposé : ce qui compte est le contenu du registre et son format électronique lisible par machine." },
        { question: "Gleba produit-il un registre conforme à l'arrêté ?", answer: "Gleba exporte le registre en CSV et en PDF avec la plupart des informations demandées. La localisation au format RPG ou GPS, les codes OEPP, le stade BBCH, les heures, le numéro de lot des semences traitées et le format de date JJ/MM/AAAA n'y figurent pas encore : vérifiez ces points avant votre première conversion obligatoire." },
      ]}
    />
  );
}
