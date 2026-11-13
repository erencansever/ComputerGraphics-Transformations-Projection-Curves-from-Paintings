// A tiny DOM control kit I wrote instead of pulling in a UI library. Every
// control reads/writes one property of a state object; sync() pushes the
// state back into the inputs (needed after "Reset scene").
export function el(tag, attrs = {}, parent = null) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  if (parent) parent.appendChild(e);
  return e;
}

export class Controls {
  constructor(root) {
    this.root = root;
    this.syncers = [];
  }

  section(title, open = true) {
    const d = el('details', open ? { open: '' } : {}, this.root);
    el('summary', { text: title }, d);
    return el('div', { class: 'sec' }, d);
  }

  slider(parent, label, obj, key, min, max, step, onChange, fmt = (v) => (+v).toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0)) {
    const row = el('label', { class: 'row' }, parent);
    el('span', { class: 'lbl', text: label }, row);
    const input = el('input', { type: 'range', min, max, step }, row);
    const val = el('span', { class: 'val' }, row);
    const sync = () => { input.value = obj()[key]; val.textContent = fmt(obj()[key]); };
    input.addEventListener('input', () => { obj()[key] = parseFloat(input.value); val.textContent = fmt(obj()[key]); onChange?.(); });
    this.syncers.push(sync);
    sync();
    return { sync };
  }

  toggle(parent, label, obj, key, onChange) {
    const row = el('label', { class: 'row chk' }, parent);
    const input = el('input', { type: 'checkbox' }, row);
    el('span', { text: label }, row);
    const sync = () => { input.checked = !!obj()[key]; };
    input.addEventListener('change', () => { obj()[key] = input.checked; onChange?.(); });
    this.syncers.push(sync);
    sync();
    return { input, row, sync };
  }

  select(parent, label, obj, key, options, onChange) {
    const row = el('label', { class: 'row' }, parent);
    el('span', { class: 'lbl', text: label }, row);
    const s = el('select', {}, row);
    for (const [v, t] of options) el('option', { value: v, text: t }, s);
    const sync = () => { s.value = obj()[key]; };
    s.addEventListener('change', () => { obj()[key] = s.value; onChange?.(); });
    this.syncers.push(sync);
    sync();
    return { sync };
  }

  buttons(parent, list) {
    const row = el('div', { class: 'btns' }, parent);
    return list.map(([text, fn, title]) => el('button', { text, onclick: fn, ...(title ? { title } : {}) }, row));
  }

  note(parent, html) {
    return el('p', { class: 'note', html }, parent);
  }

  sync() {
    for (const s of this.syncers) s();
  }
}
