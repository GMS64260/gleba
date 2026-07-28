import type { Metadata } from "next";
import { BusinessLanding } from "@/components/seo/BusinessLanding";

export const metadata: Metadata = {
  title: "Logiciel d'élevage NAC — Rongeurs, oiseaux et reptiles",
  description: "Suivez furets, lapins nains, rongeurs, oiseaux, reptiles et autres NAC : espèces, variétés, généalogie, reproduction, santé et soins avec Gleba.",
  alternates: { canonical: "https://gleba.fr/logiciel-elevage-nac" },
  openGraph: {
    title: "Logiciel de gestion d'élevage NAC — Gleba",
    description: "Furets, rongeurs, oiseaux, reptiles et amphibiens : fiches, reproduction et soins.",
    url: "https://gleba.fr/logiciel-elevage-nac",
    type: "article",
  },
};

export default function Page() {
  return <BusinessLanding
    breadcrumb="Logiciel de gestion d'élevage NAC"
    currentPath="/logiciel-elevage-nac"
    eyebrow="Rongeurs · Oiseaux · Reptiles · Amphibiens"
    title="Suivez votre élevage de NAC"
    highlightedTitle="espèce par espèce"
    introduction="Le mode NAC étend le suivi aux furets, petits mammifères, oiseaux, reptiles et amphibiens. Chaque animal peut être relié à son espèce, sa variété, sa généalogie, sa reproduction, ses naissances et ses soins."
    proof="le catalogue NAC contient des espèces, variétés et morphs dédiés ; l'interface adapte les tests de santé et masque les productions agricoles, l'abattage et le pâturage lorsqu'ils ne concernent pas les animaux sélectionnés."
    capabilities={[
      { title: "Catalogue multi-espèces", description: "Choisissez parmi les furets, lapins nains, rongeurs, oiseaux d'ornement, reptiles et amphibiens déjà référencés." },
      { title: "Races, variétés et morphs", description: "Rattachez à l'animal le niveau de variété disponible dans le catalogue de son espèce." },
      { title: "Fiches individuelles", description: "Conservez identifiant, sexe, couleur, naissance, poids, statut, provenance et notes pour chaque animal." },
      { title: "Reproduction", description: "Enregistrez reproducteurs, événements de reproduction, dates attendues et naissances." },
      { title: "Détail des petits", description: "Décrivez individuellement les petits d'une naissance et créez leurs fiches lorsqu'ils sont vivants." },
      { title: "Soins et tests", description: "Planifiez et historisez soins, traitements, tests génétiques et bilans vétérinaires saisis." },
      { title: "Généalogie et registre", description: "Consultez l'ascendance, repérez les ancêtres communs et conservez un numéro de registre ou d'élevage lorsqu'il existe." },
    ]}
    workflowTitle="Un suivi adaptable à des espèces très différentes"
    workflow={[
      { title: "Choisir l'espèce", description: "Activez le mode NAC puis sélectionnez l'espèce et la variété correspondant à l'animal." },
      { title: "Suivre", description: "Ajoutez reproduction, naissances, soins et changements de statut au fil du temps." },
      { title: "Conserver l'historique", description: "Retrouvez la fiche, les liens familiaux et les événements réellement enregistrés." },
    ]}
    limits="Le terme NAC couvre des régimes juridiques très différents. Gleba ne vérifie pas les autorisations de détention, ne tient pas automatiquement les registres CITES ou i-FAP et ne produit aucun certificat officiel."
    faqs={[
      { question: "Quels NAC sont proposés ?", answer: "Le catalogue comprend notamment furet, lapin nain, cobaye, hamster, rat, souris, gerbille, chinchilla, octodon, oiseaux d'ornement, tortues, geckos, pogona, serpents et axolotl." },
      { question: "Peut-on ajouter une variété ou un morph ?", answer: "Le catalogue fournit déjà plusieurs races, variétés ou morphs selon l'espèce. Le référentiel de Gleba peut être enrichi lorsque la variété recherchée manque." },
      { question: "La reproduction des ovipares est-elle suivie ?", answer: "Les événements de reproduction et les naissances peuvent être enregistrés. Gleba ne pilote toutefois aucun incubateur et ne calcule pas automatiquement les paramètres d'incubation." },
      { question: "Gleba garantit-il la conformité CITES ou i-FAP ?", answer: "Non. Gleba conserve des données de suivi internes mais ne remplace ni les registres, ni le marquage, ni les déclarations et certificats exigés pour certaines espèces." },
    ]}
  />;
}
