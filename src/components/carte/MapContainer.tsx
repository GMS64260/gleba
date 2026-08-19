"use client"

/**
 * Composant principal de carte georeferencee
 * Utilise Leaflet avec plusieurs fonds de carte (OSM, IGN Satellite, Cadastre, Plan IGN)
 */

import { useCallback, useRef, useState, type ReactNode } from "react"
import L from "leaflet"
import {
  MapContainer as LeafletMapContainer,
  TileLayer,
  LayersControl,
} from "react-leaflet"

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

interface MapContainerProps {
  center?: L.LatLngExpression
  zoom?: number
  onMapReady?: (map: L.Map) => void
  children?: ReactNode
}

// QA cmsno90km — le fond et les couches choisis repartaient sur OSM à chaque
// reload : le `checked` était codé en dur. On persiste la préférence en
// localStorage (conventions gleba_*). Composant chargé en dynamic({ssr:false})
// partout : la lecture au premier rendu est sans risque d'hydratation.
const FOND_STORAGE_KEY = "gleba_carte_fond"
const OVERLAYS_STORAGE_KEY = "gleba_carte_overlays"
const FONDS_VALIDES = ["OpenStreetMap", "Satellite IGN", "Plan IGN"] as const

function lireFondActif(): string {
  try {
    const stored = window.localStorage.getItem(FOND_STORAGE_KEY)
    if (stored && (FONDS_VALIDES as readonly string[]).includes(stored)) return stored
  } catch {
    // stockage indisponible (navigation privée…) : défaut
  }
  return "OpenStreetMap"
}

function lireOverlaysActifs(): string[] {
  try {
    const stored = window.localStorage.getItem(OVERLAYS_STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
  } catch {
    return []
  }
}

/** Événements qui prouvent une interaction humaine sur la carte (cf. cmsx6dvhu). */
const EVENEMENTS_INTERACTION = ["pointerdown", "click", "change", "keydown"] as const

export default function MapContainer({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  onMapReady,
  children,
}: MapContainerProps) {
  // QA cmsoaabhl — lecture GELÉE au montage (initializer useState), jamais au
  // render : relue à chaque render, la préférence retombait sur le défaut
  // « OpenStreetMap » à la moindre oscillation, react-leaflet ré-appliquait
  // alors ce `checked` sur une couche déjà enregistrée dans le contrôle, ce
  // qui émettait un vrai `baselayerchange` OSM… dont l'écoute ci-dessous
  // réécrivait le défaut par-dessus le choix de l'utilisateur. L'overlay
  // Cadastre survivait, lui, car son écriture est un Set idempotent.
  const [fondActif] = useState(lireFondActif)
  const [overlaysActifs] = useState(lireOverlaysActifs)

  // Écouteurs posés lors de l'attache courante, pour pouvoir les retirer :
  // React rappelle le ref avec null au démontage/ré-attache, et sans map.off
  // les handlers s'accumulaient (fuite + écritures localStorage dupliquées).
  const detachListenersRef = useRef<(() => void) | null>(null)
  // QA cmswtxnnb — Leaflet émet `baselayerchange` sur TOUT addLayer d'un fond
  // enregistré, pas seulement au clic (diff react-leaflet au montage ou au
  // remontage du contrôle) : un événement programmatique réécrivait
  // « OpenStreetMap » par-dessus le choix persisté. On n'écrit donc le slot que
  // si l'événement suit une INTERACTION RÉELLE sur cette carte.
  //
  // Ticket cmsx6dvhu (QA 2026-08-17) — ce garde-fou ne reconnaissait que
  // `pointerdown`. Or le contrôle Calques de Leaflet est fait de vrais boutons
  // radio : les choisir au CLAVIER (Tab puis flèches/Espace) n'émet aucun
  // pointerdown, et le choix ne survivait pas au rechargement. Un clic émis par
  // un outil d'automatisation ou une aide à la saisie vocale était dans le même
  // cas. On marque donc l'interaction sur pointerdown, clic, changement de
  // champ et touche clavier — tous absents d'un événement programmatique de
  // (re)montage, qui reste ignoré.
  const dernierPointerRef = useRef(0)

  // Callback quand la carte est initialisee
  const handleMapRef = useCallback(
    (map: L.Map | null) => {
      if (detachListenersRef.current) {
        detachListenersRef.current()
        detachListenersRef.current = null
      }
      if (map) {
        const marquerInteraction = () => { dernierPointerRef.current = Date.now() }
        for (const type of EVENEMENTS_INTERACTION) {
          map.getContainer().addEventListener(type, marquerInteraction, { capture: true })
        }
        const onBaseLayerChange = (e: L.LayersControlEvent) => {
          try {
            // QA cmswtxnnb — pas d'interaction récente = événement
            // programmatique (montage, re-render) : ne jamais écrire.
            if (Date.now() - dernierPointerRef.current > 1500) return
            // Symétrique de la whitelist de lecture : un événement parasite
            // (nom inconnu) ne doit pas empoisonner le slot unique.
            if ((FONDS_VALIDES as readonly string[]).includes(e.name)) {
              window.localStorage.setItem(FOND_STORAGE_KEY, e.name)
            }
          } catch { /* stockage indisponible */ }
        }
        const majOverlays = (nom: string, actif: boolean) => {
          try {
            const courants = new Set(lireOverlaysActifs())
            if (actif) courants.add(nom)
            else courants.delete(nom)
            window.localStorage.setItem(OVERLAYS_STORAGE_KEY, JSON.stringify([...courants]))
          } catch { /* stockage indisponible */ }
        }
        const onOverlayAdd = (e: L.LayersControlEvent) => majOverlays(e.name, true)
        const onOverlayRemove = (e: L.LayersControlEvent) => majOverlays(e.name, false)
        map.on("baselayerchange", onBaseLayerChange)
        map.on("overlayadd", onOverlayAdd)
        map.on("overlayremove", onOverlayRemove)
        detachListenersRef.current = () => {
          map.off("baselayerchange", onBaseLayerChange)
          map.off("overlayadd", onOverlayAdd)
          map.off("overlayremove", onOverlayRemove)
          for (const type of EVENEMENTS_INTERACTION) {
            map.getContainer().removeEventListener(type, marquerInteraction, { capture: true })
          }
        }
      }
      if (map && onMapReady) {
        onMapReady(map)
      }
    },
    [onMapReady]
  )

  return (
    <div className="relative h-full w-full z-0">
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
          <LayersControl.BaseLayer checked={fondActif === "OpenStreetMap"} name="OpenStreetMap">
            <TileLayer
              url={TILE_URLS.osm}
              attribution={ATTRIBUTIONS.osm}
              maxZoom={19}
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer checked={fondActif === "Satellite IGN"} name="Satellite IGN">
            <TileLayer
              url={TILE_URLS.satelliteIgn}
              attribution={ATTRIBUTIONS.ign}
              maxZoom={19}
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer checked={fondActif === "Plan IGN"} name="Plan IGN">
            <TileLayer
              url={TILE_URLS.planIgn}
              attribution={ATTRIBUTIONS.ign}
              maxZoom={19}
            />
          </LayersControl.BaseLayer>

          {/* Couches superposables (overlays) */}
          <LayersControl.Overlay checked={overlaysActifs.includes("Cadastre IGN")} name="Cadastre IGN">
            <TileLayer
              url={TILE_URLS.cadastreIgn}
              attribution={ATTRIBUTIONS.ign}
              maxZoom={19}
              opacity={0.7}
            />
          </LayersControl.Overlay>
        </LayersControl>

        {/* Contenu additionnel (marqueurs, polygones, controles...) */}
        {children}
      </LeafletMapContainer>
    </div>
  )
}
