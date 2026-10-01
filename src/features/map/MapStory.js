import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { COLORS, FLOOR_H } from '../../config.js';
import { chapterCamera, chapterSide, cardClearance, isNarrow } from './camera.js';
import { createPin } from '../../components/pin/pin.js';
import { supportsWebGL } from '../../utils/dom.js';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const BRASS = COLORS.brass;

/**
 * The fixed background map. Chapters call `go(chapterId)` and the camera flies there.
 * Camillo's projects are drawn as brass floor-by-floor extrusions on top of the
 * OpenStreetMap 3D city.
 */
export class MapStory {
  constructor(container, { cameras, office, projects, reducedMotion = false, onReady, onFail, onPinClick }) {
    this.cameras = cameras;
    this.reducedMotion = reducedMotion;
    this.office = office;
    this.projects = projects;
    this.onPinClick = onPinClick;
    this.pins = new Map();
    this.active = null;
    this.flying = false;
    this.orbit = false;

    if (!supportsWebGL()) {
      onFail?.('webgl');
      return;
    }

    const failTimer = setTimeout(() => onFail?.('timeout'), 15000);
    this.failTimer = failTimer;

    this.map = new maplibregl.Map({
      container,
      style: STYLE_URL,
      ...cameras.hero,
      zoom: cameras.hero.zoom - 1.5,
      interactive: false,
      attributionControl: false,
      fadeDuration: 200,
      maxPitch: 75,
      canvasContextAttributes: { antialias: true },
    });

    this.map.on('error', (e) => {
      console.warn('[map]', e?.error?.message || e);
      if (!this.loaded) {
        clearTimeout(failTimer);
        onFail?.('style');
      }
    });

    this.map.once('load', () => {
      this.loaded = true;
      clearTimeout(failTimer);
      const credit = document.querySelector('.footer__credit');
      if (credit) credit.textContent = 'Map data © OpenStreetMap contributors · OpenFreeMap';
      this.decorate();
      this.addProjects();
      this.addPins();
      onReady?.();
      this.go(this.pending || 'hero', { duration: 3500 });
    });

    this.tick = this.tick.bind(this);
    requestAnimationFrame(this.tick);
  }

  /** Restyle the base map: moodier sky, our own warm 3D building layer. */
  decorate() {
    const map = this.map;
    const style = map.getStyle();
    let firstSymbol;
    style.layers.forEach((l) => {
      if (!firstSymbol && l.type === 'symbol') firstSymbol = l.id;
      if (l['source-layer'] === 'building') map.setLayoutProperty(l.id, 'visibility', 'none');
      // quieter labels
      if (l.type === 'symbol' && /poi|housenumber|transit|aeroway/.test(l.id)) map.setLayoutProperty(l.id, 'visibility', 'none');
    });

    const source = Object.keys(style.sources).find((k) => style.sources[k].type === 'vector') || 'openmaptiles';

    map.addLayer(
      {
        id: 'city-3d',
        type: 'fill-extrusion',
        source,
        'source-layer': 'building',
        minzoom: 12,
        filter: ['!=', ['get', 'hide_3d'], true],
        paint: {
          'fill-extrusion-color': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'render_height'], 8],
            0,
            '#1b1d21',
            40,
            '#262a30',
            120,
            '#343941',
            250,
            '#3f454e',
          ],
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 12, 0, 13.5, ['coalesce', ['get', 'render_height'], 8]],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.92,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      firstSymbol,
    );

    try {
      map.setSky({
        'sky-color': COLORS.ink,
        'horizon-color': '#2b2621',
        'fog-color': COLORS.ink,
        'sky-horizon-blend': 0.6,
        'horizon-fog-blend': 0.7,
        'fog-ground-blend': 0.55,
        'atmosphere-blend': 0,
      });
    } catch {
      /* older engines */
    }
    map.setLight({ anchor: 'viewport', color: '#fff4e6', intensity: 0.35, position: [1.4, 210, 35] });
  }

  /** Each project becomes a stack of brass floor plates at its site. */
  addProjects() {
    const features = [];
    this.projects.forEach((p) => {
      const [lng, lat] = p.coords;
      const mLat = 1 / 111320;
      const mLng = 1 / (111320 * Math.cos((lat * Math.PI) / 180));
      p.model.floors.forEach((f, i) => {
        const sb = f.setback || 0;
        const hw = (p.model.width / 2 - sb) * mLng;
        const hd = (p.model.depth / 2 - sb) * mLat;
        const fh = p.model.floorHeight || FLOOR_H;
        features.push({
          type: 'Feature',
          properties: { slug: p.slug, base: i * fh, top: i * fh + fh - 0.45 },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [lng - hw, lat - hd],
                [lng + hw, lat - hd],
                [lng + hw, lat + hd],
                [lng - hw, lat + hd],
                [lng - hw, lat - hd],
              ],
            ],
          },
        });
      });
    });

    this.map.addSource('camillo-projects', { type: 'geojson', data: { type: 'FeatureCollection', features } });
    this.map.addLayer({
      id: 'camillo-projects-3d',
      type: 'fill-extrusion',
      source: 'camillo-projects',
      paint: {
        'fill-extrusion-color': BRASS,
        'fill-extrusion-base': ['get', 'base'],
        'fill-extrusion-height': ['get', 'top'],
        'fill-extrusion-opacity': 0.95,
      },
    });
  }

  addPins() {
    const make = (label, hq, lngLat, onClick) => {
      const el = createPin({ label, hq, onClick });
      new maplibregl.Marker({ element: el, anchor: 'left', offset: [-9, 0] }).setLngLat(lngLat).addTo(this.map);
      return el;
    };
    this.pins.set(
      'office',
      make('Camillo HQ', true, this.office.coords, () => this.go('office')),
    );
    this.projects.forEach((p) => {
      this.pins.set(
        p.slug,
        make(p.name, false, p.coords, () => this.onPinClick?.(p)),
      );
    });
  }

  /** Fly to a chapter. `chapter` = 'hero' | 'office' | … | 'project:<slug>' */
  go(chapter, { duration } = {}) {
    if (!this.map || this.current === chapter) return;
    if (!this.loaded) {
      this.pending = chapter; // flown to once the style has loaded
      return;
    }
    this.current = chapter;
    const cam = chapterCamera(chapter, this);
    if (!cam) return;
    const focus = chapter.startsWith('project:') ? chapter.split(':')[1] : chapter === 'office' || chapter === 'contact' ? 'office' : null;

    this.orbit = chapter === 'hero' && !this.reducedMotion;
    this.highlight(focus, chapter);
    this.flying = true;
    this.map.flyTo({ ...cam, padding: this.paddingFor(chapter), duration: duration ?? 2800, curve: 1.5, essential: true }, { story: true });
    this.map.once('moveend', () => (this.flying = false));
  }

  /** Keep the subject clear of the text card. */
  paddingFor(chapter) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (isNarrow(w)) return { top: 60, bottom: h * 0.45, left: 0, right: 0 };
    const card = cardClearance(w);
    const side = chapterSide(chapter);
    if (side === 'right') return { top: 0, bottom: 0, left: 0, right: card };
    if (side === 'left') return { top: 0, bottom: 0, left: card, right: 0 };
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  highlight(slug, chapter) {
    const all = ['hero', 'projectsIntro', 'overview'].includes(chapter);
    this.pins.forEach((el, key) => {
      el.classList.toggle('is-active', key === slug);
      el.style.opacity = all || key === slug || !slug ? '1' : '0.35';
    });
    if (this.map.getLayer('camillo-projects-3d')) {
      this.map.setPaintProperty('camillo-projects-3d', 'fill-extrusion-color', [
        'case',
        ['==', ['get', 'slug'], slug || ''],
        COLORS.brassLight,
        BRASS,
      ]);
    }
  }

  destroy() {
    this.stopped = true;
    clearTimeout(this.failTimer);
    try {
      this.map?.remove();
    } catch {
      /* already gone */
    }
    this.map = null;
  }

  tick() {
    if (this.stopped) return;
    if (this.map && this.orbit && !this.flying) {
      this.map.setBearing(this.map.getBearing() + 0.035);
    }
    requestAnimationFrame(this.tick);
  }
}
