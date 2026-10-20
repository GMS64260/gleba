import 'leaflet'

declare module 'leaflet' {
  namespace Control {
    class Draw extends Control {
      constructor(options?: DrawConstructorOptions)
    }

    interface DrawConstructorOptions {
      position?: string
      draw?: DrawOptions
      edit?: EditOptions
    }

    /** Options d'un outil de dessin (`false` le désactive). */
    type OutilDessin = object | false

    interface DrawOptions {
      polyline?: OutilDessin
      polygon?: OutilDessin
      rectangle?: OutilDessin
      circle?: OutilDessin
      marker?: OutilDessin
      circlemarker?: OutilDessin
    }

    interface EditOptions {
      featureGroup: FeatureGroup
      remove?: boolean
      edit?: boolean | object
    }
  }

  namespace Draw {
    namespace Event {
      const CREATED: string
      const EDITED: string
      const DELETED: string
    }

    class Polygon {
      constructor(map: Map, options?: object)
      enable(): void
      disable(): void
    }

    class Polyline {
      constructor(map: Map, options?: object)
      enable(): void
      disable(): void
    }

    class Rectangle {
      constructor(map: Map, options?: object)
      enable(): void
      disable(): void
    }

    class Circle {
      constructor(map: Map, options?: object)
      enable(): void
      disable(): void
    }

    class Marker {
      constructor(map: Map, options?: object)
      enable(): void
      disable(): void
    }
  }
}
