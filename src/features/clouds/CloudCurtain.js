import { rng } from '../../gfx/noise.js';
import { isMobile } from '../../utils/dom.js';

/*
 * A bank of cloud between the Featured Projects panel and the skyline, in its own layer
 * between the map and the story (it isn't part of the map).
 *
 * Photographic cloud cut-outs (public/images/clouds/, transparent WebP) layered at three
 * depths into a left and a right bank, over a light haze that thickens the full cover.
 * Plain images moved with CSS transforms, so the browser's compositor does all the work
 * (no second WebGL canvas, nothing redrawn per frame). Two values drive it:
 *   cover 0 → 1  the banks drift in and thicken
 *   part  0 → 1  they slide apart, left to the left and right to the right (nearer clouds
 *                faster), thinning as they go, revealing the map
 * A slow CSS drift keeps them alive while the page is still.
 */
const CLOUDS = [1, 2, 3, 4, 5, 6, 7].map((n) => `${import.meta.env.BASE_URL}images/clouds/cloud-${n}.webp`);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const LAYERS = [
  // far → near, per side: count (desktop, mobile), width (× the larger screen side),
  // slide speed, opacity, which cut-outs (big ones up close, small wisps far away)
  { count: [4, 4], size: [0.26, 0.4], speed: 0.9, alpha: [0.7, 0.85], images: [3, 4, 5, 6, 2] },
  { count: [4, 4], size: [0.4, 0.58], speed: 1.3, alpha: [0.8, 0.95], images: [1, 2, 3] },
  { count: [3, 3], size: [0.58, 0.8], speed: 1.8, alpha: [0.9, 1], images: [0, 1, 2, 0] },
];

export class CloudCurtain {
  constructor(container, { reducedMotion = false } = {}) {
    this.container = container;
    this.reducedMotion = reducedMotion;
    this.mobile = isMobile();
    this.state = { cover: 0, part: 0 };
    this.onResize = () => this.resize();
  }

  /** Lays out the banks and waits for every image to decode, so nothing pops in mid-scroll. */
  async build() {
    this.haze = document.createElement('div');
    this.haze.className = 'clouds__haze';
    this.container.append(this.haze);

    const r = rng(2026);
    this.puffs = [];
    const decoding = [];
    LAYERS.forEach((layer, li) => {
      const count = layer.count[this.mobile ? 1 : 0];
      [-1, 1].forEach((side) => {
        for (let i = 0; i < count; i++) {
          const el = document.createElement('div');
          el.className = 'clouds__puff';
          const img = new Image();
          img.alt = '';
          img.decoding = 'async';
          img.src = CLOUDS[layer.images[Math.floor(r() * layer.images.length)]];
          img.className = 'clouds__img';
          // a slow sideways drift, each on its own rhythm
          img.style.setProperty('--drift', `${(1.2 + r() * 1.6).toFixed(2)}%`);
          img.style.animationDuration = `${(18 + r() * 16).toFixed(1)}s`;
          img.style.animationDelay = `${(-r() * 30).toFixed(1)}s`;
          if (r() < 0.5) img.style.scale = '-1 1'; // mirror some for variety
          el.append(img);
          this.container.append(el);
          decoding.push(img.decode().catch(() => {}));
          this.puffs.push({
            el,
            img,
            side,
            // spread across this side of the screen, from the middle to past the edge,
            // and from the top to the bottom (denser low down)
            nx: side * (0.02 + ((i + r() * 0.8) / count) * 0.8),
            // stacked from the top of the screen to the bottom, each layer offset a little
            ny: -0.95 + ((i + 0.5 + (r() - 0.5) * 0.7) / count) * 1.9 + (li - 1) * 0.12,
            size: layer.size[0] + r() * (layer.size[1] - layer.size[0]),
            alpha: layer.alpha[0] + r() * (layer.alpha[1] - layer.alpha[0]),
            speed: layer.speed * (0.85 + r() * 0.3),
            delay: r() * 0.35,
          });
        }
      });
    });
    await Promise.all(decoding);
    window.addEventListener('resize', this.onResize);
    this.resize();
    this.ready = true;
    this.set(this.state);
  }

  /** Scroll state: `cover` brings the banks in, `part` slides them apart. */
  set({ cover = this.state.cover, part = this.state.part }) {
    this.state = { cover, part };
    if (!this.ready) return;
    const visible = cover > 0.001 && part < 0.999;
    if (visible !== this.active) {
      this.active = visible;
      this.container.classList.toggle('is-active', visible);
    }
    if (visible) this.layout();
  }

  layout() {
    const { cover, part } = this.state;
    const { w, h } = this;
    const move = this.reducedMotion ? 0 : 1;
    const slide = Math.pow(part, 1.15);
    const gone = smooth((part - 0.35) / 0.6); // thin out as they part
    for (const pf of this.puffs) {
      const e = smooth((cover - pf.delay) / 0.6);
      const x = pf.left + pf.side * slide * pf.speed * (w / 2 + pf.width / 2) * move;
      const y = pf.top + (1 - e) * 0.08 * h * move; // settle in from slightly below
      const s = 0.94 + 0.06 * e;
      pf.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
      pf.el.style.opacity = (pf.alpha * e * (1 - gone)).toFixed(3);
    }
    // the haze clears first, so the skyline shows through the gap as they part
    this.haze.style.opacity = (smooth(cover) * (1 - smooth(part / 0.45)) * 0.5).toFixed(3);
  }

  resize() {
    this.w = this.container.clientWidth || window.innerWidth;
    this.h = this.container.clientHeight || window.innerHeight;
    const unit = Math.max(this.w, this.h * 0.9);
    for (const pf of this.puffs) {
      const ratio = pf.img.naturalHeight / pf.img.naturalWidth || 0.45;
      pf.width = pf.size * unit;
      pf.el.style.width = `${pf.width.toFixed(0)}px`;
      // top-left corner, so the cloud is centred on (nx, ny)
      pf.left = this.w / 2 + pf.nx * (this.w / 2) - pf.width / 2;
      pf.top = this.h / 2 + pf.ny * (this.h / 2) - (pf.width * ratio) / 2;
    }
    if (this.ready && this.active) this.layout();
  }

  destroy() {
    window.removeEventListener('resize', this.onResize);
    this.container.replaceChildren();
  }
}
