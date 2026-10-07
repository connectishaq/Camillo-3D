/*
 * Shared setup for the standalone pages (project pages, 404): global styles, the shared
 * components, header and footer. The home page has its own entry (src/main.js).
 */
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/utilities.css';
import '../components/button/button.css';
import '../components/card/card.css';
import '../components/tag/tag.css';
import './page.css';

import * as header from '../sections/header/header.js';
import * as footer from '../sections/footer/footer.js';

/** `headerOnScroll: false` when the page manages the header itself (a project hero). */
export function initPage({ headerOnScroll = true } = {}) {
  header.init({ overMapOnScroll: headerOnScroll });
  footer.init();
}
