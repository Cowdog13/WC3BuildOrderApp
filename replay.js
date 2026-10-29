// Warcraft III replay (.w3g) reader: pulls out each player's build/train/research commands.
// Works in the browser (DecompressionStream) and in Node (for tests). Reads bytes only.
(function (root) {
  'use strict';
  const RACES = { 1: 'human', 2: 'orc', 4: 'nightelf', 8: 'undead', 16: 'demon', 32: 'random' };
  const ABILITY_FLAG_BYTES = 2;

  // Tiny inflate (RFC 1950/1951). WC3 stores its blocks sync-flushed, i.e. without a final
  // block, which DecompressionStream rejects; this one returns whatever was produced.
  const LBASE = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  const LEXT = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  const DBASE = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  const DEXT = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  const CLORDER = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
  function huff(lengths) {
    const count = new Uint16Array(16), offs = new Uint16Array(16), symbols = new Uint16Array(lengths.length);
    for (const l of lengths) count[l]++;
    count[0] = 0;
    for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1];
    for (let i = 0; i < lengths.length; i++) if (lengths[i]) symbols[offs[lengths[i]]++] = i;
    return { count, symbols };
  }
  let FIXED_L = null, FIXED_D = null;
  function inflate(src) {
    let pos = 2, bitBuf = 0, bitCnt = 0;                // skip zlib header
    const out = [];
    const EOF = {};
    const bits = n => {
      while (bitCnt < n) { if (pos >= src.length) throw EOF; bitBuf |= src[pos++] << bitCnt; bitCnt += 8; }
      const v = bitBuf & ((1 << n) - 1); bitBuf >>>= n; bitCnt -= n; return v;
    };
    const sym = h => {
      let code = 0, first = 0, index = 0;
      for (let len = 1; len < 16; len++) {
        code |= bits(1);
        const c = h.count[len];
        if (code - c < first) return h.symbols[index + (code - first)];
        index += c; first += c; first <<= 1; code <<= 1;
      }
      throw new Error('bad code');
    };
    try {
      let last;
      do {
        last = bits(1); const type = bits(2);
        if (type === 0) {
          bitBuf = 0; bitCnt = 0;
          const len = src[pos] | (src[pos + 1] << 8); pos += 4;
          for (let i = 0; i < len; i++) { if (pos >= src.length) throw EOF; out.push(src[pos++]); }
        } else {
          let L, D;
          if (type === 1) {
            if (!FIXED_L) {
              const l = new Uint8Array(288); l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288);
              FIXED_L = huff(l); FIXED_D = huff(new Uint8Array(30).fill(5));
            }
            L = FIXED_L; D = FIXED_D;
          } else if (type === 2) {
            const nl = bits(5) + 257, nd = bits(5) + 1, nc = bits(4) + 4, cl = new Uint8Array(19);
            for (let i = 0; i < nc; i++) cl[CLORDER[i]] = bits(3);
            const ch = huff(cl), lens = new Uint8Array(nl + nd);
            for (let i = 0; i < nl + nd;) {
              const s = sym(ch);
              if (s < 16) lens[i++] = s;
              else {
                let rep, v = 0;
                if (s === 16) { v = lens[i - 1]; rep = 3 + bits(2); } else if (s === 17) rep = 3 + bits(3); else rep = 11 + bits(7);
                while (rep--) lens[i++] = v;
              }
            }
            L = huff(lens.subarray(0, nl)); D = huff(lens.subarray(nl));
          } else throw new Error('bad block');
          for (;;) {
            const s = sym(L);
            if (s < 256) out.push(s);
            else if (s === 256) break;
            else {
              const li = s - 257, len = LBASE[li] + bits(LEXT[li]);
              const di = sym(D), dist = DBASE[di] + bits(DEXT[di]);
              for (let i = 0; i < len; i++) out.push(out[out.length - dist]);
            }
          }
        }
      } while (!last);
    } catch (e) { if (e !== EOF) throw e; }
    return Uint8Array.from(out);
  }

  async function readBlocks(b) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (String.fromCharCode(...b.subarray(0, 26)) !== 'Warcraft III recorded game') throw new Error('Not a Warcraft III replay (.w3g).');
    const headerSize = dv.getUint32(0x1c, true), headerVer = dv.getUint32(0x24, true), nBlocks = dv.getUint32(0x2c, true);
    if (headerVer !== 1) throw new Error('Unsupported replay header (pre-1.07 replay).');
    const version = dv.getUint32(0x34, true), build = dv.getUint16(0x38, true), duration = dv.getUint32(0x3c, true);
    const parts = []; let pos = headerSize, total = 0;
    for (let i = 0; i < nBlocks; i++) {
      let c, hdr;
      if (build >= 6000) { c = dv.getUint32(pos, true); hdr = 12; } else { c = dv.getUint16(pos, true); hdr = 8; }
      if (pos + hdr + c > b.length) break;
      try { const o = inflate(b.subarray(pos + hdr, pos + hdr + c)); parts.push(o); total += o.length; }
      catch (e) { break; }                                     // truncated final block
      pos += hdr + c;
    }
    const out = new Uint8Array(total); let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return { header: { version, build, duration }, data: out };
  }

  const u16 = (d, p) => d[p] | (d[p + 1] << 8);
  const u32 = (d, p) => (d[p] | (d[p + 1] << 8) | (d[p + 2] << 16) | (d[p + 3] << 24)) >>> 0;
  const cstr = (d, p) => { let e = p; while (e < d.length && d[e]) e++; return [new TextDecoder().decode(d.subarray(p, e)), e + 1]; };
  const fourcc = (d, p) => {
    const s = [d[p + 3], d[p + 2], d[p + 1], d[p]];
    return s.every(c => c >= 32 && c < 127) ? String.fromCharCode(...s) : null;
  };

  function parsePlayers(d) {
    const names = {};
    if (d[4] === 0x00 || d[5] !== undefined) { const pid = d[5]; names[pid] = cstr(d, 6)[0]; }   // host record
    for (let i = 0; i < Math.min(d.length, 2500); i++) {
      if (d[i] === 0x16 && d[i + 1] > 0 && d[i + 1] < 25 && d[i + 2] >= 0x20 && d[i + 2] < 0x7f) {
        const [n, e] = cstr(d, i + 2);
        if (/^[\x20-\x7e]{1,30}$/.test(n) && !(d[i + 1] in names)) names[d[i + 1]] = n;
      }
    }
    // game-start record 0x19: len(2) slotCount(1) slots(9 each) seed(4) mode(1) startSpots(1)
    for (let i = 0; i < Math.min(d.length, 4000); i++) {
      if (d[i] !== 0x19) continue;
      const len = u16(d, i + 1), n = d[i + 3];
      if (n < 1 || n > 28 || len !== 1 + n * 9 + 6) continue;
      const players = [];
      for (let k = 0; k < n; k++) {
        const s = i + 4 + k * 9, status = d[s + 2];
        if (status === 2 && d[s]) players.push({ id: d[s], name: names[d[s]] || 'Player ' + d[s], race: RACES[d[s + 6] & 0x3f] || '?', team: d[s + 4], computer: !!d[s + 3] });
        else if (status === 2 && d[s + 3]) players.push({ id: 0x100 + k, name: 'Computer', race: RACES[d[s + 6] & 0x3f] || '?', team: d[s + 4], computer: true });
      }
      return { players, next: i + 3 + len };
    }
    throw new Error('Could not find the game start record.');
  }

  function* actions(a, warn) {
    let p = 0; const F = ABILITY_FLAG_BYTES;
    while (p < a.length) {
      const k = a[p++];
      switch (k) {
        case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: {
          yield { k, id: fourcc(a, p + F) };
          p += F + 4 + 8 + ({ 0x10: 0, 0x11: 8, 0x12: 16, 0x13: 24, 0x14: 8 + 4 + 9 + 8 })[k]; break;
        }
        case 0x16: case 0x17: p += 3 + u16(a, p + 1) * 8; break;
        case 0x18: p += 2; break;
        case 0x19: p += 12; break;
        case 0x1b: p += 9; break;
        case 0x1c: case 0x1d: p += 8; break;
        case 0x1e: yield { k, id: fourcc(a, p + 1) }; p += 5; break;     // removed from queue
        case 0x01: case 0x02: case 0x04: case 0x05: case 0x1a: case 0x61: case 0x66: case 0x67: break;
        case 0x03: p += 1; break;
        case 0x21: p += 8; break;
        case 0x27: case 0x28: case 0x2d: p += 5; break;
        case 0x2e: p += 4; break;
        case 0x50: p += 5; break;
        case 0x51: p += 9; break;
        case 0x60: p += 8; while (p < a.length && a[p]) p++; p++; break;
        case 0x68: p += 12; break;
        case 0x69: case 0x6a: p += 16; break;
        case 0x75: p += 1; break;
        case 0x7a: p += 16; break;                                        // Reforged wrapper, real action follows
        default: warn.desync = (warn.desync || 0) + 1; return;
      }
    }
  }

  async function parseReplay(buf) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const { header, data: d } = await readBlocks(bytes);
    const { players, next } = parsePlayers(d);
    const warn = {}, byPlayer = {}; let t = 0, pos = next;
    while (pos < d.length) {
      const id = d[pos];
      if (id === 0x1a || id === 0x1b || id === 0x1c) pos += 5;
      else if (id === 0x1e || id === 0x1f) {
        const len = u16(d, pos + 1); t += u16(d, pos + 3);
        const end = Math.min(pos + 3 + len, d.length);
        let q = pos + 5;
        while (q + 3 <= end) {
          const pid = d[q], al = u16(d, q + 1), acts = d.subarray(q + 3, q + 3 + al); q += 3 + al;
          for (const x of actions(acts, warn)) (byPlayer[pid] = byPlayer[pid] || []).push({ t, k: x.k, id: x.id });
        }
        pos = end;
      }
      else if (id === 0x20) pos += 4 + u16(d, pos + 2);
      else if (id === 0x22) pos += 2 + d[pos + 1];
      else if (id === 0x23) pos += 11;
      else if (id === 0x2f) pos += 9;
      else if (id === 0x17) pos += 14;
      else break;
    }
    return { header, players, actions: byPlayer, durationMs: t, warnings: warn };
  }

  // Turn one player's raw commands into build-order steps.
  //  byId: id -> item (units/buildings/heroes), byRid: research id -> [items by level]
  //  opts.group: merge identical consecutive items queued within this many ms
  function toBuild(acts, byId, byRid, opts) {
    opts = Object.assign({ group: 4000 }, opts);
    const steps = [], unknown = {}, levels = {};
    for (const a of acts || []) {
      if (!a.id || a.k === 0x1e) continue;
      let item = null;
      if (byId[a.id] && (a.k === 0x10 || a.k === 0x11)) {
        item = byId[a.id];
        if (item.kind === 'building' && a.k === 0x10 && !item.upgradeFrom) continue;     // plain 0x10 on a building id is not a build
        if (item.kind === 'building' && a.k === 0x11 && item.upgradeFrom) continue;
      } else if (byRid[a.id] && a.k === 0x10) {
        const lv = levels[a.id] = (levels[a.id] || 0) + 1;
        const list = byRid[a.id]; item = list[Math.min(lv, list.length) - 1];
      } else if (a.k === 0x10 && /^[RNnH]/.test(a.id) && !/^[A]/.test(a.id)) {
        if (/^R/.test(a.id)) unknown[a.id] = (unknown[a.id] || 0) + 1;                   // research we have no entry for
        else if (!byId[a.id]) unknown[a.id] = (unknown[a.id] || 0) + 1;
        continue;
      } else continue;
      const last = steps[steps.length - 1];
      if (last && last.id === item.id && item.kind !== 'building' && item.kind !== 'research' && a.t - last.lastT <= opts.group) { last.qty++; last.lastT = a.t; continue; }
      steps.push({ id: item.id, qty: 1, t: a.t, lastT: a.t });
    }
    return { steps: steps.map(({ id, qty, t }) => ({ id, qty, plan: Math.round(t / 1000) })), unknown };
  }

  const api = { parseReplay, toBuild };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.W3G = api;
})(typeof window !== 'undefined' ? window : globalThis);
