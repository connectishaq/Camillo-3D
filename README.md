# Camillo — 3D Website

An immersive, scroll-driven website for Camillo Builders. The home page opens on a bright, generated 3D Melbourne: sky, sun and shadows, the bay and rivers, streets, trees and thousands of buildings. It flies to the Port Melbourne head office for the About section, then to each featured project. Every project is modelled from its reference images and can be opened in a Three.js explorer, where you can peel back its floors and step inside. Each project also has its own page with the explorer built in.

**No map APIs, keys or paid services.** Everything is generated in code or comes from files in this repo, so the site also works offline and in the single-file preview build.

Built with **Vite + vanilla JavaScript** (no framework), Three.js, GSAP and Lenis.

## Quick start

Needs Node.js 20.19 or newer (`.nvmrc` pins 20).

```bash
npm install
npm run dev          # http://localhost:5173
```

| Command                 | What it does                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Local dev server with hot reload (edits to partials and data reload the page)                             |
| `npm run build`         | The website in `dist/`: home page, one page per project, 404, sitemap. **This is what you deploy**        |
| `npm run preview`       | Serves `dist/` at http://localhost:4173 to check the build before deploying                               |
| `npm run build:single`  | One self-contained `dist-single/index.html` (home page only) you can double-click to preview              |
| `npm run build:preview` | One self-contained `dist-preview/index.html` with the generated city. Used for the shareable preview link |
| `npm run lint`          | ESLint                                                                                                    |
| `npm run format`        | Prettier (rewrites files). `npm run format:check` only checks                                             |

## Deploy (Netlify)

The browser can't run the source folder: `src/main.js` imports packages like `three` and CSS files that only Vite understands. Netlify must publish the **built** `dist/` folder. If you upload the project folder itself you get the plain, unstyled HTML.

### A. From Git (recommended)

1. Push this repository to GitHub.
2. In Netlify: **Add new site → Import an existing project → GitHub**, and pick the repository.
3. Netlify reads [`netlify.toml`](netlify.toml), so the settings are filled in for you:

   | Setting           | Value                                   |
   | ----------------- | --------------------------------------- |
   | Base directory    | _(empty)_                               |
   | Build command     | `npm run build`                         |
   | Publish directory | `dist`                                  |
   | Node version      | `20` (`NODE_VERSION` in `netlify.toml`) |

4. Deploy. From then on, every push to the main branch builds and deploys automatically, and pull requests get preview URLs.

### B. Manual (drag and drop)

1. Run `npm run build`.
2. Open Netlify's deploy page (**Sites → Add new site → Deploy manually**) and drag the **`dist` folder** onto it. Not the project folder.

For manual deploys, set your real domain first (see below), because Netlify's `URL` variable only exists in Netlify's own builds.

### What `netlify.toml` sets up

- Long caching for the hashed files in `/assets/*` (`Cache-Control: public, max-age=31536000, immutable`), and always-revalidate for HTML, so a new deploy shows straight away.
- Security headers on every response: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` and a `Permissions-Policy` that turns off camera, microphone, geolocation and similar.
- `dist/404.html` is served for any missing page (Netlify does this automatically).

### Site URL

Canonical links, the sitemap and social sharing cards need the site's full address. The build uses, in order: Netlify's `URL` (set during Netlify builds), `SITE_URL` from `.env.local` (e.g. `SITE_URL=https://www.camillo.com.au`), and finally `https://camillo.com.au`.

## How the pages are built

Every page is **static HTML written at build time**, which is good for search engines and first paint. JavaScript only adds behaviour.

- `index.html` (home), `404.html` and `src/pages/project/project.html` (the project template) are short shells made of `@include` markers.
- [`vite-plugins/html-pages.js`](vite-plugins/html-pages.js) replaces the markers with the section partials and fills them from `src/data/`. The template syntax is in [`vite-plugins/template.js`](vite-plugins/template.js):

  ```text
  <!-- @include sections/hero/hero.html -->                   insert a partial (path from src/)
  <!-- @each projects as project --> … <!-- @end -->          repeat for each item
  <!-- @if page.isHome --> … <!-- @else --> … <!-- @end -->   condition (`!` negates)
  {{ project.name }}                                          a value, HTML-escaped
  ```

  A missing value fails the build with the file name, so typos can't ship as blanks.

- The project template is rendered once per project into `dist/projects/<slug>.html`, served at `/projects/<slug>`. `sitemap.xml` and `robots.txt` are generated alongside.
- The Three.js code is split out: the map is loaded with the page, but in its own chunk, and the Building Explorer only downloads on the first "Explore in 3D" click (or when you hover or focus that button). Three.js itself is one shared, long-cached `three-*.js` chunk.

## Brand

The look follows Camillo's own site, [camillo.com.au](https://www.camillo.com.au), with values read from its stylesheet (`wp-content/themes/camillo/assets/app.min.css`) and computed styles in October 2026. All of them live in [`src/styles/tokens.css`](src/styles/tokens.css); nothing else in the CSS hard-codes a colour.

| Token           | Value     | Source on camillo.com.au                                                        |
| --------------- | --------- | ------------------------------------------------------------------------------- |
| `--bg`          | `#E6E6E4` | `body` background, `rgb(230, 230, 228)`                                         |
| `--brand`       | `#5D0024` | logo, nav links, `.btn` background, `rgb(93, 0, 36)`                            |
| `--text`        | `#000000` | body and `h1` colour                                                            |
| `--surface-2`   | `#F2F2F1` | light panels                                                                    |
| `--brand-hover` | `#737579` | `.btn:hover` is `#75777B`; one step darker so white text passes WCAG AA (4.6:1) |
| `--line-strong` | `#A8A9AB` | their light grey                                                                |
| `--text-muted`  | `#55575B` | ours: their greys are too light for body copy (5.8:1 on `--bg`)                 |

**Type.** Their typeface is **PP Telegraf** (Pangram Pangram, a commercial font self-hosted on their server), so it isn't copied here. The site uses **Manrope** from Google Fonts (`font-display: swap`, fallback `"Helvetica Neue", Helvetica, Arial, sans-serif`). Compared with Hanken Grotesk, Instrument Sans and Plus Jakarta Sans, Manrope's x-height is the closest (0.750 vs Telegraf's 0.746), its width is within 1%, and it shares the double-storey `a`, single-storey open-tail `g` and round geometric `e`. Manrope's caps are ~7% taller, so the hero heading is 56px where theirs is 60px. Weights follow theirs: 300 body, 400 headings and nav, 500 for small labels. If Camillo can license Telegraf for this domain, swap `--font-display` / `--font-body` and the font link in `src/layouts/head.html`.

**Logo.** `public/brand/camillo-logo.svg` (and `-burgundy.svg`) is their wordmark from `assets/app.svg#logo-camillo`; the header and loader inline it via `src/components/logo/logo.html` so it takes `currentColor`.

**3D colours.** The generated city keeps its realistic material colours (brick, terracotta and Colorbond roofs, render, timber, gardens, deep blue water, a warm late-afternoon sky), defined in the city modules. The brand shows in the site highlights: project rings, pins and floor outlines are burgundy. The Building Explorer's light studio scene, map mode and those highlights read the `--map-*` tokens through [`src/gfx/palette.js`](src/gfx/palette.js). Façade and interior colours inside each project model stay with the model specs, because they describe the real buildings.

## About → Featured Projects → clouds

One scroll scene ([`src/sections/about/`](src/sections/about/); every timing is in [`scene.js`](src/sections/about/scene.js)). Its stage is CSS-sticky, so it holds on screen while you scroll through it:

1. The **head office map** arrives full screen, the head office in the middle. On the next scroll the **About panel slides in from the right** over half the screen (over the lower part on a phone) while the map glides to keep the head office in the middle of the rest; then the About screen holds (see below).
2. A white panel **grows out of the About panel to fill the screen** (a `clip-path` from the panel's own rectangle), covering the map, while the panel's content fades.
3. **Featured Projects** rises in on the panel, in large type.
4. At the end of the scene the panel **slides up and away**, revealing a full bank of cloud ([`src/features/clouds/CloudCurtain.js`](src/features/clouds/CloudCurtain.js)), which had already thickened behind it.
5. On the next scroll the clouds **slide apart** to the left and right (nearer clouds faster) onto the **Melbourne skyline**. While the panel covered the map, the camera had already moved there (`projectsIntro` and `skyline` share a view in `src/data/cameras.js`). Then the projects.

Two empty markers in the scene are the story chapters (`office`, then `projectsIntro`, with `#about` and `#projects` for the nav), so the rail, nav, camera and the screen-reader location announcement work as before. The map doesn't draw while the panel fills the screen. Everything is scrubbed by scroll, so it reverses on the way back up. With reduced motion the panel fades in instead of growing, and the clouds fade instead of sliding.

### About: the head office map

In the reference's manner (the "Transit & connectivity" section of [dviga.marketing/masters-en](https://dviga.marketing/masters-en)): a flat map of Port Melbourne fills the screen, centred on the head office (zoomed in a little, `--zoom`, so it can glide aside without showing an edge), and the About panel slides in over its right half; with the Camillo mark on the head office, our project The London nearby (any project inside the map gets a pin), the suburbs, piers and parks, and street names; the right is the About panel: a big title, the About copy at reading size, the company figures and straight-line distances from the head office (`hqMap.distances`, worked out from the coordinates at build time, rounded to 0.1 km). **See HQ in 3D** fades the flat map away to show the 3D map behind it, which the story has already flown to the head office; **Back to the map** brings it back. While the flat map is up, the 3D map doesn't draw (`stage.setOccluded('about', …)`). On a phone the map sits on top, without the street and water names, and the panel shows one paragraph and no address.

The map is drawn from [OpenStreetMap](https://www.openstreetmap.org/copyright) by `npm run map` ([`scripts/hq-map.mjs`](scripts/hq-map.mjs)): land, the bay (closed from OSM's coastline), rivers and lakes, parks (dotted), beaches, piers, streets in three weights, rail and tram lines, in the site's quiet palette. It has no text: the labels are HTML set over it in the page's own fonts, at positions the script writes to `src/data/hq-map.json` (street names go on each street's longest straight stretch, clear of the head office pin). The area, labels and distances are in [`src/data/hq-map.js`](src/data/hq-map.js). The OSM download is cached in `.cache/` (not committed); `npm run map -- --fresh` downloads it again. The script draws it as an SVG and saves it as WebP pictures (1500 and 3000 px wide, 93 and 236 kB, loaded lazily): a detailed SVG is redrawn on the browser's main thread as the page scrolls, which made the About section stutter, while a picture is decoded once, off it. The page credits "Map data © OpenStreetMap contributors" under the map on larger screens and in the home page footer's small print on every screen (phones leave it off the map), as the ODbL requires.

The hero's **Explore in 3D** link goes into the 3D city through the clouds with no visible cut (`initEnter` in [`intro-clouds.js`](src/sections/projects/intro-clouds.js)): the screen fades into a cloud mist (0.7 s); behind it the page moves to the full bank of cloud, just before it parts (the camera heads for the skyline); the mist thins to show the clouds all round; then the page glides on (3.4 s) as they part onto the skyline. Without JavaScript it's a plain link to the skyline chapter (`#explore`); with reduced motion it cuts straight to the skyline.

The clouds are photographic cut-outs (`public/images/clouds/cloud-1…7.webp`, transparent WebP; see [Credits and licences](#credits-and-licences)): about 22 layered at three depths, each drifting slowly, over a light haze. They're plain images moved with CSS transforms, so the browser's compositor does the work (no extra canvas, nothing redrawn while scrolling). Colours: the `--cloud-*` tokens.

### What we build

In the manner of the "Three pillars" section of [dviga.marketing/masters-en](https://dviga.marketing/masters-en), in Camillo maroon ruled with faint columns: a big title, the three disciplines (`company.services`) as tall tinted cards with a faint number and the name low down, then the "Also in the portfolio" names. The company figures are in About, so they aren't repeated here. The panel works like Featured Projects ([`src/sections/services/services.js`](src/sections/services/services.js)): its maroon is drawn by a full-screen layer clipped to the panel's shape, which grows to fill the screen as the panel arrives, holds while the content scrolls through, and leaves with the end of the section. The map doesn't draw while it's covered. With reduced motion the full-screen maroon fades in instead.

## Gallery

[`src/sections/gallery/`](src/sections/gallery/), after What we build: a giant pale "Gallery" holds at the top of the screen while the photos, two to a row and staggered, drift up past it at slightly different speeds (transforms only). Any photo opens a full-screen lightbox (native `<dialog>`: arrow keys, swipe, Esc, focus returns to the photo) with the project's name and a link to its page.

The photos are listed in [`src/data/gallery.js`](src/data/gallery.js) (project, original file in `project-assets/<project>/`, alt text). Add one there, then run `npm run images` to make its optimised copies and commit them. `footer: true` also puts that photo beside the footer's enquiry form.

## Footer and enquiry form

[`src/sections/footer/`](src/sections/footer/), in Camillo maroon (`--brand`, the logo's `#5D0024`), on every page; on the home page it's the Contact chapter. It has a big **Start a conversation** heading, an enquiry form with underlined fields beside a project photo, four link columns (Connect, Explore, Follow, Head office), the legal line and a giant Camillo wordmark cropped at the bottom edge.

The form is a [Netlify form](https://docs.netlify.com/forms/setup/) (`name="enquiry"`, with a honeypot field). Netlify finds it in the built HTML on deploy, and entries appear under **Forms** in the Netlify dashboard. Turn on **Form notifications → Email** there to have them sent to `enquiries@camillo.com.au`. It sends in place and thanks the visitor by name. Without JavaScript it posts normally and Netlify shows its own confirmation page. It can only send on Netlify: the local dev and preview servers answer with the "didn't send, please email us" message.

## Project page hero

Every project has `hero` in its data, so every project page opens with a full-screen hero ([`src/pages/project/hero.html`](src/pages/project/hero.html), `hero.css`, `hero.js`). The project photo (`hero.image` when the card photo, `image`, isn't big or wide enough for a full screen) holds still while you scroll. First the project's name rises over it in one giant line that runs sideways like a marquee (a compositor animation, so it keeps its pace however busy the page is; scrolling either way speeds it up for a moment, and it pauses off screen), then the key figures scroll up over the photo in staggered white boxes (`hero.stats`: a big `value`, a maroon `label`, a line of `text`). The small type on the first screen (back link, suburb, "Scroll", type · status) fades as soon as the page moves, and the header, white over the photo at the very top, switches to its light bar on the first scroll, so the name and boxes pass under it cleanly. A project without `hero` would keep the plain page header. All figures and copy come from the published facts in each data file and Camillo's project pages; photos are the full-size originals from camillo.com.au, in `project-assets/<slug>/`.

A project with `about` in its data gets an **About the project** section after it ([`about.html`](src/pages/project/about.html), `about.css`, `about.js`): a tall photo on the left, a big `about.title` with the `about.text` paragraphs on the right, and a small second photo low in the right corner (`about.images`, two photos from `project-assets/<slug>/`; run `npm run images` after adding them). The copy rises in once and the photos drift slightly on scroll. Then come the facts, in a row, and the 3D explorer. To give another project the hero, add a `hero.stats` list to its data file (keep the figures to published facts). With reduced motion the name and boxes don't move.

Every project page ends with the **3D model** ([`explorer-inline.html`](src/features/explorer/explorer-inline.html)). It starts as a preview, like [likova.space](https://likova.space/)'s master plan: the building turns slowly in the middle (not interactive, so the page scrolls straight past), behind a maroon box with **See in 3D**, and a big "Explore in 3D" heading low on the left. The button brings in the explorer as before (levels panel, orbit and zoom, explode, step inside); **Close 3D** or Esc goes back to the preview, as does scrolling the model off screen. After "About the project" it fills the screen edge to edge; on other pages it stays in the page column. The preview is `Explorer`'s `preview` option (`setPreview(on)`); the modal explorer on the home page doesn't use it.

After it, before the footer, **More projects** ([`more.html`](src/pages/project/more.html), `more.css`) shows the next three projects in the story's order, wrapping round (`more` in the page data), as photo cards linking to their pages, with **All projects** back to the home page. On a phone the cards scroll sideways.

## The hero: project showcase

[`src/sections/hero/`](src/sections/hero/) is a full-screen, auto-playing showcase in front of the map:

- **Slide 1** is the company line, "Residential & Commercial Builders", over a background film (`public/videos/`). It plays only while that slide is showing and the hero is on screen; with reduced motion or data saver the poster frame shows instead and nothing is downloaded.
- **Then one slide per featured project**, built from `src/data/projects/*.js`: name, summary, a frosted facts card, **View full project** (the project page) and **See on map** (scrolls to that project's chapter; the 3D map flies there as before).
- Slides wipe in horizontally with a parallax drift, and the text reveals line by line. Everything moves with transforms only, so it never forces layout or repaints.
- The autoplay timer _is_ the active progress bar's CSS animation: when it ends, the next slide comes in (7 s each, `SLIDE_TIME` in `hero.js`). It holds while the pointer is over the text, card or controls, while keyboard focus is inside, when the tab is hidden and when the hero is scrolled away. The pause button stops it for good, arrow keys and swipes move between slides, and with `prefers-reduced-motion` it doesn't autoplay and slides cross-fade.
- While the hero covers the whole screen, the 3D map behind it doesn't draw (`stage.setOccluded('hero', …)`). Scrolling down reveals the map story, and the header turns from white-on-photo to the light glass bar.

### Photos

Originals stay in `project-assets/<slug>/`. `npm run images` (with [sharp](https://sharp.pixelplumbing.com/)) writes optimised WebP copies at 640/1280/1920/2560/3840 px (never wider than the photo itself; the big ones are for full-screen heroes on large or high-density screens), upright from the camera's orientation, to `public/images/projects/`, and records the widths in `src/data/images.json` for the templates' `srcset`. Run it after changing a project's `image` or `about.images`, and commit the results (Netlify doesn't run it).

### Hero film

The original is `project-assets/high.mp4`. `npm run video` (needs [ffmpeg](https://ffmpeg.org/): on `PATH`, or set `FFMPEG` to its path) writes `public/videos/hero-1920.mp4` (desktop), `hero-1280.mp4` (screens up to 1024 px) and `hero-poster.webp` (the first frame): H.264, 30 fps, no audio, fast start. To use a different film, replace `high.mp4` and run it again.

## Structure

```
index.html  404.html           Page shells (sections are @included at build time)
netlify.toml  .nvmrc           Deploy settings
vite.config.js                 Build modes, multi-page inputs, chunking
vite-plugins/                  html-pages (pages, sitemap), template (include/each/if), site-data (reads src/data)
public/                        Copied as-is: favicon, site.webmanifest, images/ (icons, og-image), draco/, brand/, models/
project-assets/<slug>/         Reference images per project (not deployed)
src/
  main.js                      Home page entry: imports styles, mounts sections, starts the app
  config.js                    Shared constants: breakpoint, colours used in JS, card width, floor height
  app/                         Wiring: smooth-scroll (Lenis), stage (map mode + fallback), chapters (scroll story),
                               reveal (fade-ins), explorer (lazy explorer launcher)
  sections/                    One folder per page section: <name>.html + <name>.css + <name>.js (exports init())
    header/ hero/ about/ projects/ services/ contact/ footer/
  components/                  Reusable UI: logo, button, card, tag, chapter, pin, toast, loader, rail, locator (screen readers only)
  features/
    map/                       CityStory (generated city), MapStory (MapLibre), photoreal/, geo, camera helpers,
                               city/ (land, layout, roads, buildings, trees, water, detail, projects, markers, instances)
    explorer/                  Explorer, building (parametric generator), glb (Path A), interior, materials, textures
  gfx/                         Shared offline graphics: palette (3D colours from tokens), proctex, sky, facade, merge
  data/
    company.js                 Copy, services, stats, contact details, other portfolio names
    cameras.js                 Map camera per chapter, head office location
    projects/<slug>.js         One file per featured project (+ index.js, which collects them)
    models/<slug>.json         Building specs written from the reference images (+ index.js normaliser)
  layouts/head.html            Shared <head>: title, description, canonical, Open Graph, icons, fonts
  pages/                       Standalone pages: page.js/css (shared), project/ (template + entry), not-found.js
  styles/                      tokens.css (design tokens) · base.css (reset, type) · utilities.css
  utils/                       dom, escape, math, focus-trap
```

Rules of thumb: each file has one job, there are no globals, and section JS only touches its own section. CSS is plain CSS using the tokens in `styles/tokens.css`. The `860px` breakpoint lives in `config.js` for JS and in each file's `@media (max-width: 860px)`.

## Adding a section

1. Create `src/sections/<name>/` with `<name>.html`, `<name>.css` and `<name>.js`:

   ```js
   // src/sections/<name>/<name>.js
   import './<name>.css';

   export function init({ projects, explorer, ready }) {
     // behaviour for this section only (or leave empty)
   }
   ```

2. Write the markup in `<name>.html`. To make it a chapter of the map story, use `<section class="chapter chapter--center" id="<name>" data-chapter="<camera key>" data-label="Rail label">`. Add `data-nav="<name>"` to underline a header link, and `data-side="left|right"` if a card sits on one side (the map shifts the subject clear of it).
3. Add a camera for the chapter key in `src/data/cameras.js`.
4. Include it in `index.html` where it should appear: `<!-- @include sections/<name>/<name>.html -->`.
5. Import it in `src/main.js` and add it to the list of sections that get `init()` called.
6. Text that comes from data goes in `src/data/` and into the template as `{{ … }}`, not in JavaScript.

## Adding a project

1. Add **`src/data/projects/<slug>.js`** (including `image: { file, position }`, a photo from `project-assets/<slug>/`, then run `npm run images`). The file name must match its `slug`. Copy an existing project: `order` (position in the story), `slug`, `name`, `suburb`, optional `address`, `type`, `status`, `coords: [lng, lat]`, `facts`, `summary`, `materials`, `camera` (zoom/pitch/bearing), and optionally `publishedFacts: { levels, units }` to check the model in dev.

   That one file is enough: the build adds the story chapter, the map pin and city model, the project page `/projects/<slug>`, the sitemap entry and the 404 page link. Until it has a spec, the building is a plain three-level placeholder.

2. For the real building, drop reference images into **`project-assets/<slug>/`** (a straight-on street elevation, a 3/4 or aerial view, floor plans) and write **`src/data/models/<slug>.json`** from them (schema below; copy one of the six existing specs). Mark anything the images don't show with `"assumed": true`, or list it under `assumptions`.
3. Optional: generate a model with an image-to-3D tool and save it as **`public/models/<slug>.glb`**. Restart `npm run dev` afterwards, because the list of models is read at startup.

## Map modes

`VITE_MAP_MODE` (in `.env.local`) picks the map. Each optional mode falls back automatically if it can't start.

| Mode             | What it shows                                                     | Needs                                                                         |
| ---------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `city` (default) | `CityStory`: the generated daytime Melbourne                      | nothing                                                                       |
| `map`            | `MapStory`: MapLibre + OpenFreeMap tiles → falls back to `city`   | internet                                                                      |
| `photoreal`      | `PhotorealStory`: Google Photorealistic 3D Tiles → `map` → `city` | a Google Maps Platform key (`VITE_GOOGLE_MAPS_API_KEY`), billing, attribution |

All stages share one interface: `constructor(container, { cameras, office, projects, reducedMotion, onReady, onFail, onPinClick, onProgress })`, `go(chapter, { duration })`, `pause()`, `resume()`, `destroy()`. `src/app/stage.js` picks one and handles the fallback. The Google key is only embedded in a `photoreal` build.

## Accessibility

- One `h1` per page and a logical heading order. A "Skip to content" link appears on keyboard focus, and focus is always visible (brass outline).
- The 3D map is decorative (`aria-hidden`); every action on it (map pins) is also a button in the story cards.
- The explorer is a modal dialog: focus moves into it, Tab stays inside it, and Esc steps back (inside → floor → closed). Focus then returns to the button that opened it.
- With `prefers-reduced-motion`, smooth scrolling, fade-ins, count-ups and the hero orbit are off, the hero swaps to the full map with a short cross-fade instead of the scrubbed expand, and the map cuts between chapters instead of flying.
- Colour contrast meets WCAG AA: body copy 5.8:1 or more, burgundy on the background 11.3:1, white on burgundy 14.1:1. Text placed straight on the map sits on a light scrim.

## The generated city (`src/features/map/city/`)

Built in steps behind the loader. On a laptop this takes about 1–2 s; `console.debug` prints the timings in dev.

- **Land use** (`land.js`): a 40 m raster of the bay, the Yarra and Maribyrnong, lakes, parks, racecourses and a coastal strip, built from the simplified geography in `features/map/geo.js`. Every placement query uses it.
- **Streets** (`layout.js`, `roads.js`): the Hoddle Grid in the CBD (30 m streets, 9 m little streets, rotated 18°). Elsewhere, a one-mile grid of arterials bounds 1.6 km superblocks, each with its own slightly rotated local grid. St Kilda Rd, Beach Rd, Bay Rd, Toorak Rd and Punt Rd follow their real rough paths. Asphalt strips have lane markings on major roads and sit over footpath strips. Roads stop at water and parks, and buildings sit in the blocks between them, so nothing lands on a road.
- **Buildings** (`buildings.js`, all `InstancedMesh`): the CBD and Southbank/Docklands get glass and concrete towers with podiums, setbacks, rooftop plant and occasional crowns or spires. Inner suburbs get terrace rows and 2–6 storey apartments in brick, render and timber tones. Outer suburbs get detached houses with hip or gable roofs in terracotta and Colorbond colours. Façades use one world-space shader (`gfx/facade.js`) with procedural window-grid textures (`gfx/proctex.js`): window mask, a random lit/unlit pattern, glass reflections and roughness variation.
- **Greenery** (`trees.js`): instanced eucalypts and plane trees with size and colour variation. Parks are densely planted, St Kilda Rd has its boulevard rows, and street trees appear near the camera. Parks have a mown-lawn texture, and racecourses get a track ring with rails.
- **Water** (`water.js`): the bay, rivers and Albert Park Lake use a PBR water surface. It has two scrolling, procedurally generated normal layers, reflects the sky environment and catches sun glints, with no extra render pass. A sand strip follows the beaches, and there are piers at Station Pier, St Kilda and Brighton.
- **Close-ups** (`detail.js`): within about 500 m of each project and the HQ, finer houses with fences, driveways and carports (or finer terraces and apartments), dense street trees, parked cars and streetlights.
- **Light and look** (`gfx/sky.js`): Three.js `Sky` with a warm late-afternoon sun in the north-west, a directional sun with soft shadows whose shadow camera follows the camera target (snapped to texels), hemisphere fill, fog tinted to the horizon and scaled with altitude, and a PMREM environment baked from the sky.
- **Post-processing**: desktop gets GTAO at half resolution (only up close, and only once the camera has settled; it fades in), very mild bloom and SMAA; mobile gets FXAA only.
- **LOD and performance**: far away, each street edge of an outer block is one long "house row". Within about 2.2 km of the camera target (1.5 km on mobile), that superblock swaps in individual houses and street trees, cached once built. Those around every chapter's destination are built ahead of time while the browser is idle (`prebuild`), and none are built mid-flight (the rows stand in), so flights never stall. Park trees are culled by distance, and neighbourhood extras only draw nearby. Mobile uses a lower pixel ratio, no shadows and FXAA only.
- **Smooth scrolling** (`CityStory.js`): the sun's shadow map is a second draw of the city, so it's only redrawn when its area moves (in coarse steps), every few frames while flying and once when the camera stops. While the camera flies, the render resolution adapts: if frames average over 22 ms it steps down (to 0.85× on desktop, 0.75× on mobile; at the lowest step AO and bloom switch off too), and it steps back up with headroom. At rest, with only the water and marker pulse moving, it draws at half rate. Every shader, and the AO pass, is compiled behind the loader. Map labels only touch the DOM when they move.

## Project models

### Path B: parametric model (default)

`src/data/models/<slug>.json` is normalised by `src/data/models/index.js` and built by `src/features/explorer/building.js`:

| Field                                         | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `footprint` `{ width, depth }`, `floorHeight` | metres (floor-to-floor)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `levels[]`                                    | `label`, `program` (interior layout: `lobby`, `apartments`, `penthouse`, `whole-floor`, `rumpus`, `living`, `bedrooms`), `units`, `setback` m, `band`, optional `height`                                                                                                                                                                                                                                                                                                                                                                                                           |
| `bands{}`                                     | per level band: `system` (`brick`, `precast`, `concrete`, `board-concrete`, `render`, `timber`, `travertine`, `tile`, `metal`, `glass-curtain`), `colors` (`wall`, `slab`, `frame`, `glass`, `accent`, `balustrade`) sampled from the images, `windows` (`bay`, `wwr`, `mullions`, `frameDepth`, `sill`, `head`, `proud`, `panelBelow`), `balcony` (`type`: `full-width`, `wraparound`, `inset`, `projecting`; `depth`, `balustrade`: `glass`/`solid`/`metal`, `sides`, `bays`), `frames` (two-storey precast grids: `every`, `span`, `width`, `depth`, `bevel`), `fins`, `recess` |
| `roof`                                        | `type` (`flat-parapet`, `blade`), `parapet`, `overhang`, `plant`, `garden`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `features[]`                                  | `wing` (e.g. The London's restaurant pavilion), `vColumns`, `canopy`, `wall`, `slot`, `columns`, `greenColumns`, `pool`                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

The generator builds real window openings with recessed, framed glass and mullions, slab edges, balcony slabs and balustrades, precast frames, fins, terraces at setbacks, parapets, plant and roof gardens. Materials are PBR with procedural canvas textures (brick, precast, board-formed concrete, render, timber, travertine, tile, metal), so they react to the sky light and need no downloads. Each level is its own group, merged by material. Published facts (`publishedFacts` in the project file) are checked in dev: The London has 7 levels and 13 apartments, and Sea & Sky has 6 levels and 64 residences.

### Path A: GLB model

If `public/models/<slug>.glb` exists (the list is baked in at build time by `vite.config.js`, so missing files are never requested), `features/explorer/glb.js`:

- loads it with `GLTFLoader` + `DRACOLoader` (decoder in `public/draco/`)
- centres it, turns the long side to match the spec's width (or uses `"glb": { "rotate": 90 }` in the JSON), and scales it to the spec's footprint and total height
- for the Explorer, clones it once per level. Each clone is limited to its level's height band by two world-space clipping planes that follow the level as it explodes or lifts, so no manual splitting is needed. Hover and click raycast against invisible box volumes per level, and the procedural interiors appear inside the opened floor.

Both paths use **the same model** on the city map (merged into a few draw calls), with a brass ring, pulse and soft light column on the active project. The Explorer's _indicative_ note stays on every model that is an interpretation.

## Tech

- **Three.js** (r186) for the city and the explorer, using `Sky`, PMREM, GTAO, UnrealBloom, SMAA/FXAA and CSS2D labels.
- **GSAP** for camera and floor animation. **Lenis** for smooth scrolling. **Vite 8** for bundling and the static multi-page build.
- **ESLint** (flat config, `eslint.config.js`) and **Prettier** (`.prettierrc.json`); `.editorconfig` for editor defaults.
- Optional: **MapLibre GL** + OpenFreeMap, and **3d-tiles-renderer** + Google Photorealistic 3D Tiles.

## Credits and licences

| Asset                                   | Source                                                                                                                | Licence                                                       |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| All city and building textures          | generated at runtime (`gfx/proctex.js`)                                                                               | —                                                             |
| `images/og-image.jpg`                   | screenshot of the generated city (this project)                                                                       | —                                                             |
| `draco/*`                               | Draco glTF decoder, copied from `three/examples/jsm/libs/draco/gltf`                                                  | Apache-2.0                                                    |
| `brand/google-maps-logo.svg`            | [Google Maps attribution assets](https://developers.google.com/maps/documentation/tile/policies), photoreal mode only | Google brand asset, for attribution only                      |
| `project-assets/*`, `images/projects/*` | Project renders and photos supplied by Camillo (optimised copies are bundled for the hero and cards)                  | © their owners; used with Camillo's permission                |
| `images/map/hq-map-*.webp`              | Drawn from [OpenStreetMap](https://www.openstreetmap.org/copyright) data by `scripts/hq-map.mjs`                      | ODbL; credited under the map (desktop) and in the home footer |
| `images/clouds/*`                       | Cut out from iStock **preview** images supplied for this project (checkerboard removed, split into single clouds)     | iStock; **licence before launch** (see below)                 |

## Before launch — to confirm with Camillo

1. **Exact site coordinates.** The pins are approximate. Geocoded suggestions (Sept 2026, to confirm):

   | Site                        | Now                    | Suggested `[lng, lat]`  | Basis                                                       |
   | --------------------------- | ---------------------- | ----------------------- | ----------------------------------------------------------- |
   | The London (92 Beach St)    | `[144.9369, -37.8434]` | `[144.9350, -37.8412]`  | OSM building match                                          |
   | La Storia (88 Pelham St)    | `[144.9656, -37.8027]` | `[144.9648, -37.8025]`  | OSM house match                                             |
   | The Lansell (16 Lansell Rd) | `[145.0107, -37.8434]` | `[145.0164, -37.8395]`  | OSM house match; confirm 16 Lansell Rd is Camillo's project |
   | Sea & Sky (212 Bay Rd)      | `[145.0071, -37.9509]` | `[145.0240, -37.9550]`  | Photon house-number match                                   |
   | The Righi (Eaglemont)       | `[145.0655, -37.7636]` | `[145.0572, -37.7631]`  | Street only                                                 |
   | MVRC – Thomas St            | `[144.9335, -37.7632]` | ~`[144.9294, -37.7640]` | Street only                                                 |
   | HQ (262 Salmon St)          | `[144.9246, -37.8309]` | keep                    | Street only                                                 |

2. **Building data** that isn't published: level counts and unit splits for La Storia, The Lansell, The Righi and MVRC, and real footprints for all projects. Each spec's `assumptions` and `improveWith` lists say what's missing.
3. **Real floor plans**, so the procedural interiors can follow the actual layouts.
4. **The production domain**, for canonical links and the sitemap (see [Site URL](#site-url)).
5. **Cloud images.** `public/images/clouds/` was cut from iStock preview (comp) images, which aren't licensed for a live site. Buy the licences for the two source images (or swap in other licensed or free transparent cloud PNGs), then replace `cloud-1…7.webp`: any transparent cloud images work, largest first. The licensed files are larger and cleaner, so they'll look better too.

## Next steps

- Richer project pages: galleries from `project-assets/`, floor plans, next/previous project links.
- An enquiry form in the Contact section (Netlify Forms would need no backend).
