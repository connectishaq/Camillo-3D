import './footer.css';
import { $, prefersReducedMotion } from '../../utils/dom.js';

/**
 * Footer: the enquiry form sends in place (to Netlify Forms, which records it) and thanks the
 * visitor without leaving the page. Without JavaScript it posts normally and Netlify shows its
 * own confirmation page. The year is written at build time.
 * `scroll` is the home page's smooth scroller (app/smooth-scroll.js); other pages scroll natively.
 */
export function init({ scroll } = {}) {
  initBackToTop(scroll);
  const form = $('[data-enquiry]');
  if (!form) return;
  const status = $('[data-enquiry-status]', form);
  const submit = form.querySelector('[type="submit"]');
  const email = form.closest('.site-footer')?.querySelector('a[href^="mailto:"]')?.textContent || 'us';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    submit.disabled = true;
    status.textContent = 'Sending…';
    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString(),
      });
      if (!res.ok) throw new Error(res.status);
      const first = form.elements['first-name'].value.trim();
      form.classList.add('is-sent');
      status.textContent = `Thanks${first ? `, ${first}` : ''}. We’ve got your enquiry and will be in touch within two business days.`;
      form.reset();
    } catch {
      status.textContent = `Sorry, that didn’t send. Please try again, or email ${email}.`;
    } finally {
      submit.disabled = false;
    }
  });
}

/** "Back to top": a smooth scroll to the top, then keyboard focus to the logo. */
function initBackToTop(scroll) {
  const link = $('[data-back-to-top]');
  if (!link) return;
  link.addEventListener('click', (e) => {
    e.preventDefault();
    if (scroll) scroll.scrollTo(0, { duration: 2.2, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) });
    else window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    $('.brand')?.focus({ preventScroll: true });
  });
}
