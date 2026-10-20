"use client"

/**
 * Composant principal de carte georeferencee
 * Utilise Leaflet avec plusieurs fonds de carte (OSM, IGN Satellite, Cadastre, Plan IGN)
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react"
import L from "leaflet"
import {
  MapContainer as LeafletMapContainer,
  TileLayer,
  LayersControl,
  useMap,
} from "react-leaflet"

import {
  CALQUE_CADASTRE,
  CALQUES_CARTE,
  COUCHES_CARTE,
  FONDS_CARTE,
  calqueCarte,
  choixAffiche,
  coucheCarte,
  enregistrerChoixCalques,
  fondCarte,
  lireChoixCalques,
  stockageNavigateur,
  type CalqueCarte,
  type ChoixCalques,
  type CoucheCarte,
  type EtatCalques,
  type FondCarte,
} from "@/lib/jardin/fond-carte"
import { CLASSES_BOUTON_CALQUES_EN_PLACE } from "./controle-calques"

import "leaflet/dist/leaflet.css"
import "leaflet-draw/dist/leaflet.draw.css"

// Fix des icones Leaflet par defaut (incompatibles avec les bundlers webpack/Next.js)
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
})

// Centre par defaut : France metropolitaine
const DEFAULT_CENTER: L.LatLngExpression = [46.6, 2.3]
const DEFAULT_ZOOM = 6

// URLs des fonds de carte (exportées : réutilisées par le sélecteur GPS verger)
export const TILE_URLS = {
  osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  satelliteIgn:
    "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg",
  cadastreIgn:
    "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&STYLE=PCI vecteur&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png",
  planIgn:
    "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png",
} as const

// Attributions
export const ATTRIBUTIONS = {
  osm: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  ign: '&copy; <a href="https://www.ign.fr/">IGN</a>',
} as const

const SOURCES_FONDS: Record<FondCarte, { url: string; attribution: string }> = {
  OpenStreetMap: { url: TILE_URLS.osm, attribution: ATTRIBUTIONS.osm },
  "Satellite IGN": { url: TILE_URLS.satelliteIgn, attribution: ATTRIBUTIONS.ign },
  "Plan IGN": { url: TILE_URLS.planIgn, attribution: ATTRIBUTIONS.ign },
}

interface MapContainerProps {
  center?: L.LatLngExpression
  zoom?: number
  onMapReady?: (map: L.Map) => void
  children?: ReactNode
}

/*
 * Fond et calques choisis : règle de persistance dans
 * `src/lib/jardin/fond-carte.ts` (clés `gleba_carte_fond`,
 * `gleba_carte_overlays`). Ici, seulement la lecture du contrôle Calques et
 * de la carte, et le moment où l'on enregistre.
 *
 * QA cmvflvsk4 (2026-10-19), après huit signalements du même symptôme : les
 * correctifs précédents accrochaient l'écriture à un événement (cmswtxnnb
 * `baselayerchange`, cmul1e6xi `change`, cmulatx23 `click`, cmv5cpu7q
 * `input`). Un bouton radio coché sans aucun de ces événements (coche posée
 * par script, événement arrêté avant la carte) restait affiché sans être
 * enregistré, et Leaflet ne posait pas non plus le fond. Désormais on compare
 * un ÉTAT, pas un événement : ce qui est coché est appliqué à la carte, puis
 * ce que la carte montre (`map.hasLayer`) est comparé au dernier choix connu
 * et écrit s'il diffère. Cette comparaison passe à chaque interaction avec le
 * contrôle et une dernière fois à la sortie de la page (`pagehide`,
 * `visibilitychange`, démontage) : ce qui est coché au rechargement est ce
 * qui est relu.
 */

/** Instances Leaflet des couches du contrôle Calques, par nom. */
type CouchesCarte = Partial<Record<CoucheCarte, L.TileLayer>>

/** Sélecteur du contrôle Calques ; Leaflet y attache `layerId`, le `L.stamp` de sa couche. */
type SelecteurLeaflet = HTMLInputElement & { layerId?: number }

/** Couche d'un sélecteur, par identifiant de couche ; le libellé seulement en repli. */
function coucheDuSelecteur(input: SelecteurLeaflet, couches: CouchesCarte): CoucheCarte | null {
  if (typeof input.layerId === "number") {
    for (const nom of COUCHES_CARTE) {
      const couche = couches[nom]
      if (couche && L.stamp(couche) === input.layerId) return nom
    }
  }
  return coucheCarte(input.closest("label")?.textContent)
}

/** Ce que coche le contrôle Calques de cette carte ; null s'il n'est pas (ou plus) là. */
function lireSelecteurs(conteneur: HTMLElement, couches: CouchesCarte): EtatCalques | null {
  const controle = conteneur.querySelector(".leaflet-control-layers")
  if (!controle) return null
  let fond: FondCarte | null = null
  const calques: CalqueCarte[] = []
  const selecteurs = Array.from(controle.querySelectorAll<SelecteurLeaflet>("input.leaflet-control-layers-selector"))
  for (const input of selecteurs) {
    if (!input.checked) continue
    const nom = coucheDuSelecteur(input, couches)
    const commeFond = fondCarte(nom)
    if (commeFond) {
      if (!fond) fond = commeFond
      continue
    }
    const commeCalque = calqueCarte(nom)
    if (commeCalque) calques.push(commeCalque)
  }
  return { fond, calques }
}

/** Ce que la carte montre réellement : les couches posées (`map.hasLayer`). */
function lireCarte(map: L.Map, couches: CouchesCarte): EtatCalques {
  const posee = (nom: CoucheCarte) => {
    const couche = couches[nom]
    return !!couche && map.hasLayer(couche)
  }
  return { fond: FONDS_CARTE.find(posee) ?? null, calques: CALQUES_CARTE.filter(posee) }
}

/**
 * Pose sur la carte le fond et les calques voulus. Sans fond voulu, les fonds
 * ne bougent pas (jamais de carte sans fond). Retraits d'abord, comme Leaflet.
 * Leaflet reconstruit alors ses sélecteurs d'après la carte.
 */
function appliquerSurCarte(map: L.Map, voulu: EtatCalques, couches: CouchesCarte) {
  const retraits: L.Layer[] = []
  const ajouts: L.Layer[] = []
  const trier = (nom: CoucheCarte, voulue: boolean) => {
    const couche = couches[nom]
    if (!couche) return
    if (voulue && !map.hasLayer(couche)) ajouts.push(couche)
    if (!voulue && map.hasLayer(couche)) retraits.push(couche)
  }
  if (voulu.fond) {
    for (const nom of FONDS_CARTE) trier(nom, nom === voulu.fond)
  }
  for (const nom of CALQUES_CARTE) trier(nom, voulu.calques.includes(nom))
  for (const couche of retraits) map.removeLayer(couche)
  for (const couche of ajouts) map.addLayer(couche)
}

/**
 * Un clic venu d'un doigt ou d'un stylet, ou d'un navigateur sans
 * `pointerType` sur un écran sans survol : là, la garde de Leaflet contre le
 * tap qui ouvre le contrôle et choisit un calque d'un même geste doit rester.
 */
function estPointeurTactile(event: Event): boolean {
  const pointerType = (event as PointerEvent).pointerType
  if (pointerType === "touch" || pointerType === "pen") return true
  if (pointerType === undefined) {
    // Navigateur sans Pointer Events : tout appareil tactile garde la garde.
    try {
      return (navigator.maxTouchPoints ?? 0) > 0 || window.matchMedia("(hover: none), (any-pointer: coarse)").matches
    } catch {
      return true
    }
  }
  return false
}

/**
 * Sélecteur (bouton radio ou case) visé par un événement du contrôle Calques,
 * que la cible soit l'input lui-même ou son libellé (`<label>` et texte) ;
 * null hors du contrôle.
 */
function selecteurCalques(cible: EventTarget | null): { input: HTMLInputElement; label: HTMLElement | null } | null {
  if (!(cible instanceof Element)) return null
  if (cible instanceof HTMLInputElement && cible.classList.contains("leaflet-control-layers-selector")) {
    return { input: cible, label: cible.closest("label") }
  }
  const label = cible.closest<HTMLElement>(".leaflet-control-layers label")
  const input = label?.querySelector<HTMLInputElement>("input.leaflet-control-layers-selector") ?? null
  return label && input ? { input, label } : null
}

/**
 * Restaure, applique et enregistre le fond et les calques de la carte.
 * Rendu dans la carte APRÈS le contrôle Calques : ses effets passent après
 * ceux des couches et du contrôle (posé sur la carte, sélecteurs construits).
 */
function SynchroCalques({
  couches,
  choixInitial,
}: {
  couches: MutableRefObject<CouchesCarte>
  choixInitial: ChoixCalques
}) {
  const map = useMap()
  // Dernier choix connu de cette page : celui restauré, puis chaque écriture
  // réussie. Une page sans changement n'écrit donc jamais (pas d'écrasement
  // du choix fait entre-temps dans un autre onglet).
  const connuRef = useRef<ChoixCalques>(choixInitial)
  // Vrai pendant le rejeu synchrone d'un clic annulé par Leaflet : un clic
  // rejoué n'est jamais rejoué une seconde fois.
  const rejeuEnCoursRef = useRef(false)

  const synchroniser = useCallback(() => {
    const selecteurs = lireSelecteurs(map.getContainer(), couches.current)
    if (!selecteurs) return
    // Ce qui est coché l'emporte : Leaflet n'applique pas une coche posée
    // sans clic, on le fait ici, puis on enregistre l'état réel de la carte.
    appliquerSurCarte(map, choixAffiche(selecteurs, lireCarte(map, couches.current)), couches.current)
    const resultat = enregistrerChoixCalques(stockageNavigateur(), lireCarte(map, couches.current), connuRef.current)
    connuRef.current = resultat.connu
    if (resultat.echec) {
      console.warn("Carte : choix du fond non enregistré (stockage du navigateur indisponible ou plein).")
    }
  }, [map, couches])

  useEffect(() => {
    const conteneur = map.getContainer()
    // Restauration vérifiée : la carte montre le choix lu au montage, quel
    // que soit le chemin par lequel react-leaflet a posé les couches.
    appliquerSurCarte(map, choixInitial, couches.current)

    const onSelecteur = (event: Event) => {
      // Le clic sur un libellé compte aussi : annulé, il ne transmet jamais
      // de clic au bouton radio (action par défaut du <label>).
      const selecteur = selecteurCalques(event.target)
      if (!selecteur) return
      const estRejeu = rejeuEnCoursRef.current
      // Après Leaflet (qui applique sur `click`) et l'action par défaut.
      window.setTimeout(() => {
        // QA cmv5cpu7q (sonde scripts/qa/sonde-carte-fond-20261013.cjs) : un
        // clic tombé dans la même tâche que l'ouverture du contrôle (bouton
        // ou survol) est annulé par la garde anti-tap `_expandSafely` de
        // Leaflet 1.9.4 (`preventDefault` sur la liste, le radio revient sur
        // l'ancien fond). Hors tactile, où la garde a un sens, on le rejoue
        // une fois, la garde levée (sa temporisation précède la nôtre) ; le
        // clic rejoué repasse ici et synchronise lui-même. Le clic qui OUVRE
        // le contrôle n'arrive jamais ici : il tombe sur le bouton « Layers »,
        // laissé en place (QA cmvgebfkr, ./controle-calques.ts) ; sans cela il
        // tombait sur le libellé OpenStreetMap et ce rejeu le cochait.
        if (!estRejeu && event.type === "click" && event.defaultPrevented && !estPointeurTactile(event)) {
          rejeuEnCoursRef.current = true
          try {
            ;(event.target instanceof HTMLInputElement ? selecteur.input : selecteur.label ?? selecteur.input).click()
          } finally {
            rejeuEnCoursRef.current = false
          }
          return
        }
        synchroniser()
      }, 0)
    }
    // Sortie de la page (rechargement, fermeture, onglet masqué) : dernière
    // vérification « ce qui est coché = ce qui est enregistré ».
    const onSortie = () => synchroniser()
    const onVisibilite = () => {
      if (document.visibilityState === "hidden") synchroniser()
    }

    // Capture : vus avant tout arrêt de propagation dans le contrôle.
    // `click` (Leaflet applique sur ce seul événement), `input` et `change`
    // (clavier, automates) ; un doublon ne réécrit rien.
    conteneur.addEventListener("click", onSelecteur, { capture: true })
    conteneur.addEventListener("input", onSelecteur, { capture: true })
    conteneur.addEventListener("change", onSelecteur, { capture: true })
    window.addEventListener("pagehide", onSortie)
    document.addEventListener("visibilitychange", onVisibilite)
    return () => {
      conteneur.removeEventListener("click", onSelecteur, { capture: true })
      conteneur.removeEventListener("input", onSelecteur, { capture: true })
      conteneur.removeEventListener("change", onSelecteur, { capture: true })
      window.removeEventListener("pagehide", onSortie)
      document.removeEventListener("visibilitychange", onVisibilite)
    }
  }, [map, couches, choixInitial, synchroniser])

  // Démontage (navigation dans l'application, fermeture d'un formulaire) :
  // dernière vérification en phase de layout, tant que le contrôle et les
  // couches sont encore sur la carte (react-leaflet les retire ensuite, dans
  // ses effets passifs).
  useLayoutEffect(() => () => synchroniser(), [synchroniser])

  return null
}

export default function MapContainer({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  onMapReady,
  children,
}: MapContainerProps) {
  // QA cmsoaabhl — lecture GELÉE au montage (initializer useState), jamais au
  // render : relue à chaque render, une oscillation faisait ré-appliquer par
  // react-leaflet un `checked` sur une couche déjà enregistrée dans le
  // contrôle, ce qui reposait OSM par-dessus le choix de l'utilisateur.
  const [choixInitial] = useState(() => lireChoixCalques(stockageNavigateur()))

  const couchesRef = useRef<CouchesCarte>({})
  // Une fonction stable par couche (react-leaflet rappelle ces refs à chaque
  // rendu). Le rappel avec null au démontage est ignoré : l'instance reste
  // lisible pour la dernière vérification de SynchroCalques.
  const [refsCouches] = useState(() => {
    const refs = {} as Record<CoucheCarte, (couche: L.TileLayer | null) => void>
    for (const nom of COUCHES_CARTE) {
      refs[nom] = (couche) => {
        if (couche) couchesRef.current[nom] = couche
      }
    }
    return refs
  })

  const handleMapRef = useCallback(
    (map: L.Map | null) => {
      if (map && onMapReady) {
        onMapReady(map)
      }
    },
    [onMapReady]
  )

  // QA cmvgebfkr (2026-10-20) : le bouton « Layers » reste à sa place menu
  // ouvert ; sinon le clic qui le vise coche OpenStreetMap (voir
  // ./controle-calques.ts).
  return (
    <div className={`relative h-full w-full z-0 ${CLASSES_BOUTON_CALQUES_EN_PLACE}`}>
      <LeafletMapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full"
        ref={handleMapRef}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        {/* Selecteur de fonds de carte */}
        <LayersControl position="topright">
          {/* Fonds de carte (base layers) - un seul actif a la fois */}
          {FONDS_CARTE.map((nom) => (
            <LayersControl.BaseLayer key={nom} checked={choixInitial.fond === nom} name={nom}>
              <TileLayer
                ref={refsCouches[nom]}
                url={SOURCES_FONDS[nom].url}
                attribution={SOURCES_FONDS[nom].attribution}
                maxZoom={19}
              />
            </LayersControl.BaseLayer>
          ))}

          {/* Couches superposables (overlays) */}
          <LayersControl.Overlay checked={choixInitial.calques.includes(CALQUE_CADASTRE)} name={CALQUE_CADASTRE}>
            <TileLayer
              ref={refsCouches[CALQUE_CADASTRE]}
              url={TILE_URLS.cadastreIgn}
              attribution={ATTRIBUTIONS.ign}
              maxZoom={19}
              opacity={0.7}
            />
          </LayersControl.Overlay>
        </LayersControl>

        {/* Après le contrôle : voir SynchroCalques */}
        <SynchroCalques couches={couchesRef} choixInitial={choixInitial} />

        {/* Contenu additionnel (marqueurs, polygones, controles...) */}
        {children}
      </LeafletMapContainer>
    </div>
  )
}
