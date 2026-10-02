import './hero.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, prefersReducedMotion } from '../../utils/dom.js';
import { setOnPhoto, setOverMap } from '../header/header.js';

gsap.registerPlugin(ScrollTrigger);

/** Seconds each slide stays on screen (the progress bar's fill time). */
const SLIDE_TIME = 7;

/**
 * Hero showcase: the company slide, then one slide per featured project, advancing on its
 * own. Slides wipe in horizontally (pure transforms) with the text revealing line by line.
 *
 * Autoplay is the active progress bar's CSS animation: when it ends, the next slide comes in,
 * and pausing just pauses that animation. It holds while the pointer is over the text, card
 * or controls, while keyboard focus is inside, when the tab is hidden and when the hero is
 * scrolled away; the pause button stops it for good. Reduced motion: no autoplay, cross-fades.
 */
export function init({ ready, stage }) {
  const root = $('[data-showcase]');
  if (!root) return;
  const slides = $$('.slide', root);
  const tabs = $$('[data-goto]', root);
  const counter = $('[data-count-current]', root);
  const pauseBtn = $('[data-showcase-pause]', root);
  const reduce = prefersReducedMotion();
  const pad = (n) => String(n + 1).padStart(2, '0');

  let current = 0;
  let tl = null;
  let userPaused = reduce; // reduced motion: the visitor moves through slides themselves
  const holds = new Set(['loader']); // reasons autoplay is waiting (hover, focus, offscreen…)

  root.style.setProperty('--slide-time', `${SLIDE_TIME}s`);
  root.classList.toggle('is-static', reduce);

  /* ---------- images: load each slide's photo just before it's needed ---------- */
  const hydrate = (i) => {
    const img = slides[i]?.querySelector('img[data-src]');
    if (!img) return Promise.resolve();
    img.srcset = img.dataset.srcset;
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
    return img.decode().catch(() => {});
  };
  const ensure = (i) => {
    const img = slides[i]?.querySelector('img');
    const wait = img?.dataset.src ? hydrate(i) : img?.complete ? Promise.resolve() : img?.decode().catch(() => {});
    // never hold a transition long for a slow image
    return Promise.race([wait, new Promise((r) => setTimeout(r, 1200))]);
  };

  /* ---------- state ---------- */
  const syncPlayback = () => {
    root.classList.toggle('is-paused', userPaused);
    root.classList.toggle('is-held', holds.size > 0);
    const playing = !userPaused && holds.size === 0;
    $('[data-slides]', root).setAttribute('aria-live', playing ? 'off' : 'polite');
    pauseBtn.setAttribute('aria-label', userPaused ? 'Play the slideshow' : 'Pause the slideshow');
  };
  const hold = (reason, on) => {
    if (on) holds.add(reason);
    else holds.delete(reason);
    syncPlayback();
  };

  const markTabs = (index) => {
    tabs.forEach((t, j) => {
      t.classList.toggle('is-active', j === index);
      t.classList.toggle('is-done', j < index);
      t.setAttribute('aria-selected', String(j === index));
      t.tabIndex = j === index ? 0 : -1;
    });
    counter.textContent = pad(index);
  };

  const parts = (slide) => ({
    media: slide.querySelector('.slide__media'),
    reveals: slide.querySelectorAll('.reveal'),
    extras: slide.querySelectorAll('.slide__actions, .slide__card'),
  });

  async function go(next, dir = next > current ? 1 : -1) {
    next = (next + slides.length) % slides.length;
    if (next === current) return;
    if (tl) tl.progress(1); // finish any wipe in progress first
    const from = slides[current];
    const to = slides[next];
    current = next;
    markTabs(next);
    await ensure(next);
    if (current !== next) return; // a newer go() took over while the image loaded
    hydrate((next + 1) % slides.length);

    const a = parts(from);
    const b = parts(to);
    to.inert = false;
    to.removeAttribute('aria-hidden');
    to.classList.add('is-entering');
    from.classList.add('is-leaving');
    const done = () => {
      from.classList.remove('is-active', 'is-leaving');
      from.inert = true;
      from.setAttribute('aria-hidden', 'true');
      to.classList.replace('is-entering', 'is-active');
      gsap.set([from, to, a.media, b.media, ...a.reveals, ...a.extras], { clearProps: 'all' });
      tl = null;
    };

    tl = gsap.timeline({ onComplete: done });
    if (reduce) {
      tl.fromTo(to, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power1.out' });
      return;
    }
    const wipe = { duration: 1.35, ease: 'expo.inOut' };
    tl.fromTo(to, { xPercent: 100 * dir }, { xPercent: 0, ...wipe }, 0)
      .fromTo(b.media, { xPercent: -78 * dir }, { xPercent: 0, ...wipe }, 0) // parallax inside the wipe
      .to(a.media, { xPercent: -22 * dir, ...wipe }, 0)
      .to(a.reveals, { yPercent: -135, duration: 0.5, ease: 'power2.in', stagger: 0.03 }, 0)
      .to(a.extras, { autoAlpha: 0, y: -12, duration: 0.4, ease: 'power2.in' }, 0)
      .fromTo(b.reveals, { yPercent: 135 }, { yPercent: 0, duration: 1.05, ease: 'expo.out', stagger: 0.075 }, 0.62)
      .fromTo(b.extras, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1 }, 0.85);
  }

  /* ---------- autoplay: the active bar's animation ends → next slide ---------- */
  root.addEventListener('animationend', (e) => {
    if (e.animationName === 'tabfill' && e.target.closest('.tab.is-active')) go(current + 1, 1);
  });

  /* ---------- controls ---------- */
  $$('[data-showcase-next]', root).forEach((b) => b.addEventListener('click', () => go(current + 1, 1)));
  $('[data-showcase-prev]', root).addEventListener('click', () => go(current - 1, -1));
  tabs.forEach((t, i) => t.addEventListener('click', () => go(i)));
  pauseBtn.addEventListener('click', () => {
    userPaused = !userPaused;
    syncPlayback();
  });
  // "See on map": the smooth-scroll link handler flies there; stop the slideshow meanwhile
  $$('[data-see-on-map]', root).forEach((a) => a.addEventListener('click', () => hold('map', true)));

  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(current + 1, 1);
    else if (e.key === 'ArrowLeft') go(current - 1, -1);
    else return;
    if (e.target.closest('[role="tablist"]')) tabs[current].focus();
  });

  // hold while reading or using the text, card and controls (the photo itself doesn't hold)
  $$('.slide__content, .slide__card, .showcase__controls', root).forEach((el) => {
    el.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && hold('hover', true));
    el.addEventListener('pointerleave', () => hold('hover', false));
  });
  root.addEventListener('focusin', () => hold('focus', true));
  root.addEventListener('focusout', (e) => !root.contains(e.relatedTarget) && hold('focus', false));
  document.addEventListener('visibilitychange', () => hold('hidden', document.hidden));

  // swipe on touch screens
  let x0 = null;
  root.addEventListener('pointerdown', (e) => e.pointerType !== 'mouse' && (x0 = e.clientX), { passive: true });
  root.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 50) go(current + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });

  /* ---------- the page around it ---------- */
  slides.forEach((s, i) => {
    s.inert = i !== 0;
    if (i) s.setAttribute('aria-hidden', 'true');
  });
  markTabs(0);
  setOnPhoto(true);
  // the showcase covers the whole screen at the top: the 3D map behind it needn't draw
  stage.setOccluded('hero', true);

  // header style, map drawing and autoplay follow whether the hero is still on screen; worked
  // out from the position on every update (a jump straight past it fires no "toggle")
  let onHero = true;
  const follow = (self) => {
    stage.setOccluded('hero', self.scroll() < 2);
    const on = self.progress < 1;
    if (on === onHero) return;
    onHero = on;
    setOnPhoto(on);
    setOverMap(!on);
    hold('offscreen', !on);
    if (on) hold('map', false); // back at the hero after "See on map": the slideshow carries on
  };
  ScrollTrigger.create({
    trigger: root,
    start: 'top top',
    end: () => `bottom top+=${$('[data-header]')?.offsetHeight || 0}`,
    onUpdate: follow,
    onRefresh: follow,
  });
  ScrollTrigger.create({
    trigger: root,
    start: 'center top',
    // past the hero's middle the map is the page (rail, locator, pins at full strength)
    onEnter: () => document.body.classList.add('is-map-full'),
    onLeaveBack: () => document.body.classList.remove('is-map-full'),
  });

  // first slide's text rises in as the loader fades; autoplay starts then
  const first = parts(slides[0]);
  if (!reduce) gsap.set(first.reveals, { yPercent: 135 });
  if (!reduce) gsap.set(first.extras, { autoAlpha: 0, y: 22 });
  syncPlayback();
  hydrate(1);
  ready.then(() => {
    hold('loader', false);
    if (reduce) return;
    gsap.to(first.reveals, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08 });
    gsap.to(first.extras, { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.1, delay: 0.35 });
  });
}
