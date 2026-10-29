(() => {
  'use strict';
  const DATA = window.WC3_DATA;
  const BY_ID = Object.fromEntries(DATA.map(d => [d.id, d]));
  const RACES = { human: 'Human', orc: 'Orc', undead: 'Undead', nightelf: 'Night Elf' };
  const RACE_COLOR = { human: '#4a7fd1', orc: '#c0532f', undead: '#8a56c4', nightelf: '#3ea17a' };
  const KINDS = { building: 'Buildings', unit: 'Units', hero: 'Heroes', research: 'Research' };
  const START = { human: 'htow', orc: 'ogre', undead: 'unpl', nightelf: 'etol' };   // starting town hall
  const START_WORKERS = 5;
  const HOTKEY_LABELS = { toggle: 'Start / pause timer', next: 'Step done (stamp time)', reset: 'Reset timer' };
  const DEFAULT_KEYS = { toggle: 'F8', next: 'F9', reset: 'Shift+F8' };

  const $ = s => document.querySelector(s);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('wc3bo.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('wc3bo.' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  const S = {
    race: store.get('race', 'human'),
    kind: store.get('kind', 'building'),
    q: '',
    chain: store.get('chain', []).filter(s => BY_ID[s.id]),      // {id, done, at}
    keys: Object.assign({}, DEFAULT_KEYS, store.get('keys', {})),
    saved: store.get('saved', {}),
    timer: store.get('timer', { running: false, base: 0, since: 0 }),   // base ms + (now - since) if running
  };
  const history = [];
  const persist = () => { store.set('race', S.race); store.set('kind', S.kind); store.set('chain', S.chain); store.set('timer', S.timer); };

  // ---------- timer
  const elapsed = () => S.timer.base + (S.timer.running ? Date.now() - S.timer.since : 0);
  const fmt = ms => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function toggleTimer() {
    if (S.timer.running) { S.timer = { running: false, base: elapsed(), since: 0 }; }
    else S.timer = { running: true, base: S.timer.base, since: Date.now() };
    persist(); renderTimer();
  }
  function resetTimer() { S.timer = { running: false, base: 0, since: 0 }; persist(); renderTimer(); }
  function renderTimer() {
    $('#clock').textContent = fmt(elapsed());
    $('#clock').classList.toggle('running', S.timer.running);
    $('#btnStart').textContent = S.timer.running ? 'Pause' : (S.timer.base ? 'Resume' : 'Start');
  }

  // ---------- icons
  function iconEl(d, cls) {
    const wrap = document.createElement('div');
    wrap.className = cls || '';
    const tile = () => {
      wrap.textContent = '';
      const t = document.createElement('div');
      t.className = 'tile';
      t.style.setProperty('--c', RACE_COLOR[d.race]);
      t.textContent = d.name.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();
      wrap.appendChild(t);
    };
    // bundled icon, else icons/<BTNName>.png if you drop one in, else a text tile
    const srcs = [d.img, d.icon && 'icons/' + d.icon + '.png'].filter(Boolean);
    const tryNext = () => {
      const src = srcs.shift();
      if (!src) return tile();
      const im = new Image();
      im.className = 'ico'; im.alt = d.name; im.draggable = false;
      im.onerror = tryNext;
      im.onload = () => { wrap.textContent = ''; wrap.appendChild(im); };
      im.src = src;
    };
    tile(); tryNext();
    return wrap;
  }

  // ---------- picker
  function renderTabs() {
    const mk = (el, map, cur, cb) => {
      el.textContent = '';
      for (const [k, label] of Object.entries(map)) {
        const b = document.createElement('button');
        b.textContent = label; b.className = k === cur ? 'on' : '';
        b.onclick = () => cb(k);
        el.appendChild(b);
      }
    };
    mk($('#raceTabs'), RACES, S.race, r => {
      if (r === S.race) return;
      if (S.chain.length && !confirm('Switching race clears the current build order. Continue?')) return;
      S.chain = []; S.race = r; persist(); render();
    });
    mk($('#kindTabs'), KINDS, S.kind, k => { S.kind = k; persist(); renderPicker(); renderTabs(); });
  }
  const costText = d => [d.gold && d.gold + 'g', d.lumber && d.lumber + 'l', d.time && d.time + 's'].filter(Boolean).join(' ');
  function renderPicker() {
    const grid = $('#grid'); grid.textContent = '';
    const q = S.q.trim().toLowerCase();
    const items = DATA.filter(d => d.race === S.race && (q ? d.name.toLowerCase().includes(q) : d.kind === S.kind));
    items.sort((a, b) => (a.gold + a.lumber) - (b.gold + b.lumber));
    for (const d of items) {
      const b = document.createElement('button');
      b.className = 'item';
      b.title = `${d.name}\n${costText(d)}${d.food ? ' · ' + d.food + ' food' : ''}${d.upgradeFrom ? '\n(upgrade from ' + BY_ID[d.upgradeFrom].name + ')' : ''}`;
      b.appendChild(iconEl(d));
      const cap = document.createElement('span'); cap.className = 'cap'; cap.textContent = d.name;
      b.appendChild(cap);
      b.onclick = () => add(d.id);
      grid.appendChild(b);
    }
    if (!items.length) grid.innerHTML = '<div class="empty">Nothing found</div>';
  }

  // ---------- chain
  function snapshot() { history.push(JSON.stringify(S.chain)); if (history.length > 50) history.shift(); }
  function add(id) { snapshot(); S.chain.push({ id, done: false, at: null }); persist(); renderChain(); renderNow(); const l = $('#chainList'); l.scrollTop = l.scrollHeight; }
  function remove(i) { snapshot(); S.chain.splice(i, 1); persist(); renderChain(); renderNow(); }
  function move(i, dir) {
    const j = i + dir; if (j < 0 || j >= S.chain.length) return;
    snapshot(); [S.chain[i], S.chain[j]] = [S.chain[j], S.chain[i]]; persist(); renderChain();
  }
  const currentIndex = () => S.chain.findIndex(s => !s.done);
  function nextStep() {
    const i = currentIndex(); if (i < 0) return;
    S.chain[i].done = true; S.chain[i].at = Math.floor(elapsed() / 1000);
    persist(); renderChain(); renderNow();
  }
  function supplyCap(upTo) {      // food cap after the first `upTo` steps (steps that give food count immediately)
    let cap = BY_ID[START[S.race]].fmade, used = START_WORKERS;
    for (let k = 0; k < upTo; k++) { const d = BY_ID[S.chain[k].id]; cap += d.fmade || 0; used += d.food || 0; }
    return [used, Math.min(cap, 100)];
  }
  function renderChain() {
    const ol = $('#chainList'); ol.textContent = '';
    const cur = currentIndex();
    let gold = 0, lumber = 0;
    if (!S.chain.length) ol.innerHTML = '<li class="empty">Click buildings, units and research on the left to build your order.</li>';
    S.chain.forEach((s, i) => {
      const d = BY_ID[s.id]; gold += d.gold; lumber += d.lumber;
      const [used, cap] = supplyCap(i + 1);
      const li = document.createElement('li');
      li.className = 'step' + (i === cur ? ' current' : '') + (s.done ? ' done' : '');
      const num = Object.assign(document.createElement('div'), { className: 'num', textContent: i + 1 });
      const pic = iconEl(d, 'pic');
      const info = document.createElement('div');
      info.innerHTML = `<div class="sname"></div><div class="meta"><span class="g">${d.gold}g</span> <span class="l">${d.lumber}l</span> · ${d.time}s · total <span class="g">${gold}</span>/<span class="l">${lumber}</span> · <span class="${used > cap ? 'over' : ''}">supply ${used}/${cap}</span></div>`;
      info.firstChild.textContent = d.name;
      const btns = document.createElement('div'); btns.className = 'btns';
      const stamp = Object.assign(document.createElement('span'), { className: 'stamp', textContent: s.at == null ? '' : fmt(s.at * 1000) });
      btns.appendChild(stamp);
      for (const [label, fn, t] of [['↑', () => move(i, -1), 'Move up'], ['↓', () => move(i, 1), 'Move down'], ['✕', () => remove(i), 'Remove']]) {
        const b = Object.assign(document.createElement('button'), { textContent: label, title: t }); b.onclick = fn; btns.appendChild(b);
      }
      li.append(num, pic, info, btns);
      li.ondblclick = () => { s.done = !s.done; s.at = s.done ? Math.floor(elapsed() / 1000) : null; persist(); renderChain(); renderNow(); };
      li.title = 'Double-click to toggle done';
      ol.appendChild(li);
    });
    const [used, cap] = supplyCap(S.chain.length);
    $('#totals').innerHTML = `<span><span class="g">${gold}</span> gold</span><span><span class="l">${lumber}</span> lumber</span><span class="${used > cap ? 'over' : ''}">supply ${used}/${cap}</span><span>${S.chain.length} steps</span>`;
  }
  function renderNow() {
    const i = currentIndex(), el = $('#now');
    if (!S.chain.length) { el.innerHTML = ''; return; }
    if (i < 0) { el.innerHTML = '<span class="name">Build order complete</span>'; return; }
    const d = BY_ID[S.chain[i].id], n = S.chain[i + 1] && BY_ID[S.chain[i + 1].id];
    el.textContent = '';
    const text = (cls, t) => el.appendChild(Object.assign(document.createElement('span'), { className: cls, textContent: t }));
    text('lbl', 'Now'); el.appendChild(iconEl(d, 'pic')); el.lastChild.style.cssText = 'width:36px;height:36px;border-radius:5px;overflow:hidden';
    text('name', d.name);
    if (n) text('next', '→ next: ' + n.name);
  }

  // ---------- hotkeys
  function combo(e) {
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return null;
    const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    return [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', k === ' ' ? 'Space' : k].filter(Boolean).join('+');
  }
  const ACTIONS = { toggle: toggleTimer, next: nextStep, reset: resetTimer };
  let rebinding = null;
  document.addEventListener('keydown', e => {
    const c = combo(e); if (!c) return;
    if (rebinding) {
      e.preventDefault();
      if (c !== 'Escape') { S.keys[rebinding.action] = c; store.set('keys', S.keys); }
      rebinding = null; renderHotkeys(); return;
    }
    if (e.target.matches('input, textarea') && c.length === 1) return;     // typing
    const action = Object.keys(S.keys).find(a => S.keys[a] === c);
    if (action && !e.repeat) { e.preventDefault(); ACTIONS[action](); }
  });
  function renderHotkeys() {
    const box = $('#hotkeyRows'); box.textContent = '';
    for (const a of Object.keys(HOTKEY_LABELS)) {
      const row = Object.assign(document.createElement('div'), { className: 'hk-row' });
      row.appendChild(Object.assign(document.createElement('span'), { textContent: HOTKEY_LABELS[a] }));
      const b = Object.assign(document.createElement('button'), { type: 'button', textContent: rebinding && rebinding.action === a ? 'Press a key…' : S.keys[a] });
      b.onclick = () => { rebinding = { action: a }; renderHotkeys(); };
      row.appendChild(b); box.appendChild(row);
    }
    $('#btnStart').title = S.keys.toggle; $('#btnNext').title = S.keys.next; $('#btnReset').title = S.keys.reset;
  }

  // ---------- saved builds
  function renderSaved() {
    const ul = $('#saved'); ul.textContent = '';
    for (const name of Object.keys(S.saved)) {
      const li = document.createElement('li');
      li.appendChild(Object.assign(document.createElement('span'), { textContent: `${name} (${RACES[S.saved[name].race]}, ${S.saved[name].ids.length} steps)` }));
      const load = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Load' });
      load.onclick = () => { const b = S.saved[name]; snapshot(); S.race = b.race; S.chain = b.ids.filter(id => BY_ID[id]).map(id => ({ id, done: false, at: null })); persist(); render(); };
      const del = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Delete' });
      del.onclick = () => { delete S.saved[name]; store.set('saved', S.saved); renderSaved(); };
      const r = document.createElement('span'); r.append(load, ' ', del);
      li.appendChild(r); ul.appendChild(li);
    }
  }
  function exportText() {
    return JSON.stringify({ race: S.race, ids: S.chain.map(s => s.id) });
  }

  // ---------- wiring
  function render() { renderTabs(); renderPicker(); renderChain(); renderNow(); renderTimer(); }
  $('#btnStart').onclick = toggleTimer;
  $('#btnReset').onclick = () => { if (!S.timer.base && !S.timer.running || confirm('Reset the timer?')) resetTimer(); };
  $('#btnNext').onclick = nextStep;
  $('#btnUndo').onclick = () => { const h = history.pop(); if (h) { S.chain = JSON.parse(h); persist(); renderChain(); renderNow(); } };
  $('#btnClear').onclick = () => { if (S.chain.length && confirm('Clear the build order?')) { snapshot(); S.chain = []; persist(); renderChain(); renderNow(); } };
  $('#btnResetProgress').onclick = () => { S.chain.forEach(s => { s.done = false; s.at = null; }); persist(); renderChain(); renderNow(); };
  $('#search').oninput = e => { S.q = e.target.value; renderPicker(); };
  $('#btnSettings').onclick = () => { renderHotkeys(); renderSaved(); $('#settings').showModal(); };
  $('#btnSave').onclick = () => {
    const name = $('#saveName').value.trim(); if (!name) return;
    S.saved[name] = { race: S.race, ids: S.chain.map(s => s.id) }; store.set('saved', S.saved); renderSaved();
  };
  $('#btnExport').onclick = async () => { try { await navigator.clipboard.writeText(exportText()); } catch { prompt('Copy this:', exportText()); } };
  $('#btnImport').onclick = async () => {
    let t; try { t = await navigator.clipboard.readText(); } catch { t = prompt('Paste build JSON:'); }
    try { const b = JSON.parse(t); if (!RACES[b.race] || !Array.isArray(b.ids)) throw 0; snapshot(); S.race = b.race; S.chain = b.ids.filter(id => BY_ID[id]).map(id => ({ id, done: false, at: null })); persist(); render(); }
    catch { alert('That does not look like an exported build.'); }
  };
  setInterval(renderTimer, 100);
  render();
})();
