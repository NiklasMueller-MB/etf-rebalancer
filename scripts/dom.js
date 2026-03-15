export function qs(selector) {
  return document.querySelector(selector);
}

export function qsa(selector) {
  return Array.from(document.querySelectorAll(selector));
}

export function byId(id) {
  return document.getElementById(id);
}

export function setText(id, value) {
  const el = byId(id);
  if (el) el.textContent = value;
}

export function setHTML(id, html) {
  const el = byId(id);
  if (el) el.innerHTML = html;
}

export function showPage(n) {
  qsa('.page').forEach(p => p.classList.remove('active'));
  const page = byId(`p${n}`);
  if (page) page.classList.add('active');

  [1, 2, 3].forEach(i => {
    const el = byId(`s${i}`);
    if (!el) return;
    el.className = 'step' + (i === n ? ' active' : i < n ? ' done' : '');
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

