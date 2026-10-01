# Camillo — 3D Landing Page

An immersive, scroll-driven landing page for Camillo Builders. The page opens on a bright, generated 3D Melbourne: sky, sun and shadows, the bay and rivers, streets, trees and thousands of buildings. It flies to the Port Melbourne head office for the About section, then to each featured project. Every project is modelled from its reference images and can be opened in a Three.js explorer, where you can peel back its floors and step inside.

**No map APIs, keys or paid services.** Everything is generated in code or comes from files in this repo, so the site also works offline and in the single-file preview build.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

| Command | Output |
|---|---|
| `npm run dev` | Local dev server with hot reload |
| `npm run build` | Production build in `dist/` (upload it to any static host: Netlify, Vercel, cPanel) |
| `npm run build:single` | One self-contained `dist-single/index.html` you can double-click to preview |
| `npm run build:preview` | One self-contained `dist-preview/index.html` (the generated city, no network). Used for the shareable preview link |

## Map modes

`VITE_MAP_MODE` (in `.env.local`) picks the map. Each optional mode falls back automatically if it can't start.

| Mode | What it shows | Needs |
|---|---|---|
| `city` (default) | `CityStory`: the generated daytime Melbourne | nothing |
| `map` | `MapStory`: MapLibre + OpenFreeMap tiles → falls back to `city` | internet |
| `photoreal` | `PhotorealStory`: Google Photorealistic 3D Tiles → `map` → `city` | a Google Maps Platform key (`VITE_GOOGLE_MAPS_API_KEY`), billing, attribution |

All stages share one interface: `constructor(container, { cameras, office, projects, onReady, onFail, onPinClick, onProgress })`, `go(chapter)`, `pause()`, `resume()`, `destroy()`. The Google key is only embedded in a `photoreal` build.

## The generated city (`src/modules/city/`)

Built in steps behind the loader. On a laptop this takes about 1–2 s; `console.debug` prints the timings in dev.

- **Land use** (`land.js`): a 40 m raster of the bay, the Yarra and Maribyrnong, lakes, parks, racecourses and a coastal strip, built from the simplified geography in `geo.js`. Every placement query uses it.
- **Streets** (`layout.js`, `roads.js`): the Hoddle Grid in the CBD (30 m streets, 9 m little streets, rotated 18°). Elsewhere, a one-mile grid of arterials bounds 1.6 km superblocks, each with its own slightly rotated local grid. St Kilda Rd, Beach Rd, Bay Rd, Toorak Rd and Punt Rd follow their real rough paths. Asphalt strips have lane markings on major roads and sit over footpath strips. Roads stop at water and parks, and buildings sit in the blocks between them, so nothing lands on a road.
- **Buildings** (`buildings.js`, all `InstancedMesh`): the CBD and Southbank/Docklands get glass and concrete towers with podiums, setbacks, rooftop plant and occasional crowns or spires. Inner suburbs get terrace rows and 2–6 storey apartments in brick, render and timber tones. Outer suburbs get detached houses with hip or gable roofs in terracotta and Colorbond colours. Façades use one world-space shader (`gfx/facade.js`) with procedural window-grid textures (`gfx/proctex.js`): window mask, a random lit/unlit pattern, glass reflections and roughness variation.
- **Greenery** (`trees.js`): instanced eucalypts and plane trees with size and colour variation. Parks are densely planted, St Kilda Rd has its boulevard rows, and street trees appear near the camera. Parks have a mown-lawn texture, and racecourses get a track ring with rails.
- **Water** (`water.js`): the bay, rivers and Albert Park Lake use a PBR water surface. It has two scrolling, procedurally generated normal layers, reflects the sky environment and catches sun glints, with no extra render pass. A sand strip follows the beaches, and there are piers at Station Pier, St Kilda and Brighton.
- **Close-ups** (`detail.js`): within about 500 m of each project and the HQ, finer houses with fences, driveways and carports (or finer terraces and apartments), dense street trees, parked cars and streetlights.
- **Light and look** (`gfx/sky.js`): Three.js `Sky` with a warm late-afternoon sun in the north-west, a directional sun with soft shadows whose shadow camera follows the camera target (snapped to texels), hemisphere fill, fog tinted to the horizon and scaled with altitude, and a PMREM environment baked from the sky.
- **Post-processing**: desktop gets GTAO at half resolution (only up close), very mild bloom and SMAA; mobile gets FXAA only.
- **LOD and performance**: far away, each street edge of an outer block is one long "house row". Within about 2.2 km of the camera target (1.5 km on mobile), that superblock swaps in individual houses and street trees, built on demand and cached. Park trees are culled by distance, and neighbourhood extras only draw nearby. Mobile uses a lower pixel ratio, no shadows and FXAA only.

## Project models

### Adding a project

1. Add the project to `projects` in `src/data/site.js`: `slug`, `coords: [lng, lat]`, `camera` (zoom/pitch/bearing), copy, and `facts`.
2. Drop reference images into **`project-assets/<slug>/`**. The most useful are a straight-on street elevation, a 3/4 or aerial view, and floor plans.
3. Write **`src/data/models/<slug>.json`** from the images (see the schema below and the six existing specs). Mark anything the images don't show with `"assumed": true`, or list it under `assumptions`.
4. Optional: generate a model with an image-to-3D tool and save it as **`public/models/<slug>.glb`**.
5. Run `npm run build`. Restart `npm run dev` after adding a GLB, because the list of models is read at startup.

The project's map pin, city model, chapter and 3D explorer are all generated from this.

### Path B: parametric model (default)

`src/data/models/<slug>.json` is normalised by `src/data/models/index.js` and built by `src/modules/explorer/building.js`:

| Field | Meaning |
|---|---|
| `footprint` `{ width, depth }`, `floorHeight` | metres (floor-to-floor) |
| `levels[]` | `label`, `program` (interior layout: `lobby`, `apartments`, `penthouse`, `whole-floor`, `rumpus`, `living`, `bedrooms`), `units`, `setback` m, `band`, optional `height` |
| `bands{}` | per level band: `system` (`brick`, `precast`, `concrete`, `board-concrete`, `render`, `timber`, `travertine`, `tile`, `metal`, `glass-curtain`), `colors` (`wall`, `slab`, `frame`, `glass`, `accent`, `balustrade`) sampled from the images, `windows` (`bay`, `wwr`, `mullions`, `frameDepth`, `sill`, `head`, `proud`, `panelBelow`), `balcony` (`type`: `full-width`, `wraparound`, `inset`, `projecting`; `depth`, `balustrade`: `glass`/`solid`/`metal`, `sides`, `bays`), `frames` (two-storey precast grids: `every`, `span`, `width`, `depth`, `bevel`), `fins`, `recess` |
| `roof` | `type` (`flat-parapet`, `blade`), `parapet`, `overhang`, `plant`, `garden` |
| `features[]` | `wing` (e.g. The London's restaurant pavilion), `vColumns`, `canopy`, `wall`, `slot`, `columns`, `greenColumns`, `pool` |

The generator builds real window openings with recessed, framed glass and mullions, slab edges, balcony slabs and balustrades, precast frames, fins, terraces at setbacks, parapets, plant and roof gardens. Materials are PBR with procedural canvas textures (brick, precast, board-formed concrete, render, timber, travertine, tile, metal), so they react to the sky light and need no downloads. Each level is its own group, merged by material. Published facts are checked in dev: The London has 7 levels and 13 apartments, and Sea & Sky has 6 levels and 64 residences.

### Path A: GLB model

If `public/models/<slug>.glb` exists (the list is baked in at build time by `vite.config.js`, so missing files are never requested), `explorer/glb.js`:
- loads it with `GLTFLoader` + `DRACOLoader` (decoder in `public/draco/`)
- centres it, turns the long side to match the spec's width (or uses `"glb": { "rotate": 90 }` in the JSON), and scales it to the spec's footprint and total height
- for the Explorer, clones it once per level. Each clone is limited to its level's height band by two world-space clipping planes that follow the level as it explodes or lifts, so no manual splitting is needed. Hover and click raycast against invisible box volumes per level, and the procedural interiors appear inside the opened floor.

Both paths use **the same model** on the city map (merged into a few draw calls), with a brass ring, pulse and soft light column on the active project. The Explorer's *indicative* note stays on every model that is an interpretation.

## Structure

```
index.html                  Page shell and semantic sections
project-assets/<slug>/      Reference images per project (not bundled)
src/
  main.js                   Entry: content, smooth scroll, map stage, chapters, explorer
  data/site.js              ALL content: copy, contact, cameras, projects
  data/models/<slug>.json   Building specs written from the reference images (+ index.js loader)
  modules/
    gfx/                    Shared, offline graphics: proctex (canvas textures), sky, facade shader, merge
    city/                   Generated Melbourne: CityStory, geo, land, layout, roads, buildings, trees,
                            water, detail, projects, markers, instances
    explorer/               Explorer, building (parametric generator), glb (Path A), interior, materials, textures
    map-story.js            Optional MapLibre mode
    photoreal/              Optional Google Photorealistic 3D Tiles mode
    chapters.js · content.js · ui.js
  styles/                   tokens · base · layout · components · explorer
public/
  draco/                    Draco glTF decoder (GLB models)
  models/                   Optional <slug>.glb models (Path A)
  brand/                    Google Maps logo (photoreal mode only)
```

## Tech

- **Three.js** (r186) for the city and the explorer, using `Sky`, PMREM, GTAO, UnrealBloom, SMAA/FXAA and CSS2D labels.
- **GSAP** for camera and floor animation. **Lenis** for smooth scrolling. **Vite** for bundling.
- Optional: **MapLibre GL v5** + OpenFreeMap, and **3d-tiles-renderer** + Google Photorealistic 3D Tiles.

## Credits and licences

| Asset | Source | Licence |
|---|---|---|
| All city and building textures | generated at runtime (`gfx/proctex.js`) | — |
| `draco/*` | Draco glTF decoder, copied from `three/examples/jsm/libs/draco/gltf` | Apache-2.0 |
| `brand/google-maps-logo.svg` | [Google Maps attribution assets](https://developers.google.com/maps/documentation/tile/policies), photoreal mode only | Google brand asset, for attribution only |
| `project-assets/*` | Project renders and photos supplied by Camillo | © their owners; reference only, not bundled |

## Before launch — to confirm with Camillo

1. **Exact site coordinates.** The pins are approximate. Geocoded suggestions (Sept 2026, to confirm):

   | Site | Now | Suggested `[lng, lat]` | Basis |
   |---|---|---|---|
   | The London (92 Beach St) | `[144.9369, -37.8434]` | `[144.9350, -37.8412]` | OSM building match |
   | La Storia (88 Pelham St) | `[144.9656, -37.8027]` | `[144.9648, -37.8025]` | OSM house match |
   | The Lansell (16 Lansell Rd) | `[145.0107, -37.8434]` | `[145.0164, -37.8395]` | OSM house match; confirm 16 Lansell Rd is Camillo's project |
   | Sea & Sky (212 Bay Rd) | `[145.0071, -37.9509]` | `[145.0240, -37.9550]` | Photon house-number match |
   | The Righi (Eaglemont) | `[145.0655, -37.7636]` | `[145.0572, -37.7631]` | Street only |
   | MVRC – Thomas St | `[144.9335, -37.7632]` | ~`[144.9294, -37.7640]` | Street only |
   | HQ (262 Salmon St) | `[144.9246, -37.8309]` | keep | Street only |
2. **Building data** that isn't published: level counts and unit splits for La Storia, The Lansell, The Righi and MVRC, and real footprints for all projects. Each spec's `assumptions` and `improveWith` lists say what's missing.
3. **Real floor plans**, so the procedural interiors can follow the actual layouts.

## Next steps

- Individual project pages (`/projects/<slug>.html`), reusing `Explorer`.
- An enquiry form in the Contact section.
