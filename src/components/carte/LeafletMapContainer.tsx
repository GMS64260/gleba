"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { Map as LeafletMap } from "leaflet"
import { LeafletProvider, createLeafletContext } from "@react-leaflet/core"
import type { MapContainerProps } from "react-leaflet"

/**
 * Une instance Leaflet par effet, libérée avant chaque rejeu StrictMode.
 * react-leaflet 4 crée la carte dans une ref callback : React 19 peut la
 * rappeler avant que son contexte ait été rendu et initialiser deux fois le
 * même nœud. Le contexte reste celui attendu par les couches react-leaflet.
 */
const LeafletMapContainer = forwardRef<LeafletMap | null, MapContainerProps>(
  function LeafletMapContainer({ children, className, id, style, placeholder, ...props }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [initial] = useState(props)
    const [context, setContext] = useState<ReturnType<typeof createLeafletContext> | null>(null)
    useImperativeHandle<LeafletMap | null, LeafletMap | null>(ref, () => context?.map ?? null, [context])

    useEffect(() => {
      if (!containerRef.current) return
      const { center, zoom, bounds, boundsOptions, whenReady, ...options } = initial
      const map = new LeafletMap(containerRef.current, options)
      if (center != null && zoom != null) map.setView(center, zoom)
      else if (bounds != null) map.fitBounds(bounds, boundsOptions)
      if (whenReady) map.whenReady(whenReady)
      setContext(createLeafletContext(map))
      return () => { map.remove() }
    }, [initial])

    return (
      <div ref={containerRef} className={className} id={id} style={style}>
        {context ? <LeafletProvider value={context}>{children}</LeafletProvider> : placeholder}
      </div>
    )
  }
)

export default LeafletMapContainer
