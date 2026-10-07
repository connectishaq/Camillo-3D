/*
 * Home page entry. The markup is static HTML assembled at build time from the section
 * partials (see vite-plugins/html-partials.js); this file adds behaviour.
 */

// Global styles first, then shared components; sections bring their own CSS below.
import './styles/tokens.css';
import './styles/base.css';
import './styles/utilities.css';
import './components/button/button.css';
import './components/card/card.css';
import './components/tag/tag.css';
import './components/chapter/chapter.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import * as header from './sections/header/header.js';
import * as hero from './sections/hero/hero.js';
import * as about from './sections/about/about.js';
import * as projectsSection from './sections/projects/projects.js';
import * as services from './sections/services/services.js';
import * as gallery from './sections/gallery/gallery.js';
import * as contact from './sections/contact/contact.js';
import * as footer from './sections/footer/footer.js';

import { cameras, office } from './data/cameras.js';
import { projects } from './data/projects/index.js';
import { createLoader } from './components/loader/loader.js';
import { createSmoothScroll } from './app/smooth-scroll.js';
import { startStage } from './app/stage.js';
import { initChapters } from './app/chapters.js';
import { initReveal } from './app/reveal.js';
import { createExplorerLauncher } from './app/explorer.js';

// Time-accurate tweens: keeps camera moves in sync even when a frame is slow.
gsap.ticker.lagSmoothing(0);

const loader = createLoader();
const scroll = createSmoothScroll();

const explorer = createExplorerLauncher(document.querySelector('[data-explorer]'), {
  onOpen: () => {
    scroll.stop();
    stage.pause();
  },
  onClose: () => {
    scroll.start();
    stage.resume();
  },
});

const stage = startStage(document.getElementById('map'), {
  cameras,
  office,
  projects,
  loader,
  onPinClick: (project) => explorer.open(project),
});

const context = { projects, explorer, stage, scroll, ready: loader.finished };
[header, hero, about, projectsSection, services, gallery, contact, footer].forEach((section) => section.init(context));

initChapters({ scrollTo: scroll.scrollTo, onChange: (chapter) => stage.go(chapter) });
initReveal();

// re-measure the pinned hero once web fonts and the loader have settled the layout
Promise.all([document.fonts?.ready, loader.finished]).then(() => ScrollTrigger.refresh());
