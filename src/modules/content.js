/** Renders data-driven content into the static shell (index.html). */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function renderContent({ company, projects, moreProjects }) {
  const slot = (name) => document.querySelector(`[data-slot="${name}"]`);
  const c = company.contact;

  slot('heritage').textContent = company.heritage + '.';
  slot('about').innerHTML = company.about.map((p) => `<p>${esc(p)}</p>`).join('');
  slot('promise').textContent = `“${company.promise}”`;
  slot('address').textContent = c.address;
  Object.assign(slot('phone'), { href: c.phoneHref, textContent: c.phone });

  slot('services').innerHTML = company.services
    .map(
      (s, i) => `
      <article class="service">
        <span class="service__num">0${i + 1}</span>
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.text)}</p>
      </article>`,
    )
    .join('');

  slot('stats').innerHTML = company.stats
    .map(
      (s) => `
      <div class="stat">
        <div class="stat__value">${esc(s.prefix || '')}<span data-count="${s.value}">0</span>${esc(s.suffix || '')}</div>
        <div class="stat__label">${esc(s.label)}</div>
      </div>`,
    )
    .join('');

  slot('more').innerHTML = moreProjects.map((n) => `<li>${esc(n)}</li>`).join('');

  slot('email').textContent = c.email;
  slot('email-link').href = `mailto:${c.email}`;
  slot('phone-text').textContent = c.phone;
  slot('phone-link').href = c.phoneHref;
  slot('address-2').textContent = c.address;
  slot('linkedin').href = c.linkedin;
  slot('instagram').href = c.instagram;
  document.querySelector('[data-year]').textContent = new Date().getFullYear();

  // Project chapters — alternate sides for rhythm
  document.querySelector('[data-project-chapters]').innerHTML = projects
    .map((p, i) => {
      const side = i % 2 === 0 ? 'left' : 'right';
      return `
      <section class="chapter chapter--${side}" data-chapter="project:${p.slug}" data-side="${side}" data-label="${esc(p.name)}">
        <article class="card project-card" data-reveal>
          <div class="project-card__head">
            <p class="eyebrow">${esc(p.suburb)}${p.address ? '' : ', VIC'}</p>
            <span class="project-card__index">${String(i + 1).padStart(2, '0')} / ${String(projects.length).padStart(2, '0')}</span>
          </div>
          <h2 class="project-card__title">${esc(p.name)}</h2>
          <div class="tags">
            <span class="tag">${esc(p.type)}</span>
            <span class="tag tag--status">${esc(p.status)}</span>
          </div>
          <p class="card__body-text">${esc(p.summary)}</p>
          <dl class="facts">
            ${p.address ? `<div><dt>Address</dt><dd>${esc(p.address)}</dd></div>` : ''}
            ${p.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
          </dl>
          <div class="project-card__actions">
            <button class="btn btn--solid" data-explore="${p.slug}">Explore in 3D</button>
            <a class="btn btn--ghost" href="./projects/${p.slug}.html" data-soon>Full project</a>
          </div>
        </article>
      </section>`;
    })
    .join('');

  // the office chapter card sits on the right
  document.querySelector('[data-chapter="office"]').dataset.side = 'right';
}
