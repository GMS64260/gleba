/**
 * Disposition du contrôle Calques de Leaflet (bouton « Layers ») sur les cartes
 * de l'application (`MapContainer`, qui enregistre le fond choisi, et
 * `GpsMapPickerMap`).
 *
 * QA cmvgebfkr (2026-10-20, recontrôle de cmvflvsk4) : « Satellite IGN perdu
 * au rechargement ». Le choix était bien enregistré puis restauré ; il était
 * perdu à la RÉOUVERTURE du menu. Leaflet 1.9.4 ouvre le contrôle au survol
 * et masque alors son bouton (`.leaflet-control-layers-expanded
 * .leaflet-control-layers-toggle { display: none }`) : le clic qui visait
 * « Layers » tombait sur ce qui prend sa place, la première ligne du menu,
 * le libellé « OpenStreetMap ». Clic rapide : annulé par la garde
 * `_expandSafely` de Leaflet puis rejoué par `MapContainer` (cmv5cpu7q) ; clic
 * humain : appliqué directement par Leaflet. Dans les deux cas OpenStreetMap
 * était coché et enregistré. Un double clic sur « Layers » faisait de même.
 *
 * Correctif : le bouton reste affiché, exactement à sa place, quand le menu
 * est ouvert (marges négatives = rembourrage du conteneur ouvert de Leaflet,
 * `padding: 6px 10px 6px 6px`), et la liste s'ouvre dessous. Tout clic sur
 * « Layers », qu'il ouvre le menu ou non, atteint le bouton, jamais une ligne.
 * Sonde : `scripts/qa/sonde-carte-fond-20261020.cjs`.
 *
 * Ne vaut que pour un contrôle Calques placé en `topright` : le conteneur
 * ouvert s'élargit alors vers la gauche et `margin-left: auto` garde le
 * bouton contre son bord droit, là où il était menu fermé. En coin gauche
 * (`topleft`, `bottomleft`) ou en bas, le conteneur grandit dans l'autre sens,
 * la marge déplace le bouton et le piège revient : adapter les marges avant
 * de poser ces classes. Les deux cartes qui les posent, `MapContainer`
 * (`/jardin/carte`, formulaire de parcelle) et `GpsMapPickerMap` (sélecteur
 * GPS), ont leur contrôle en `topright`.
 */
export const CLASSES_BOUTON_CALQUES_EN_PLACE = [
  "[&_.leaflet-control-layers-expanded_.leaflet-control-layers-toggle]:block",
  "[&_.leaflet-control-layers-expanded_.leaflet-control-layers-toggle]:[margin:-6px_-10px_0_auto]",
].join(" ")
