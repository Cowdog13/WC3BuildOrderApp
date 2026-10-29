// Prints a player's build order from a replay: node tools/check_replay.js game.w3g [playerId]
const fs = require('fs'), path = require('path');
global.window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8').replace('window.WC3_DATA', 'global.D'));
const W = require('../replay.js');
(async () => {
  const r = await W.parseReplay(new Uint8Array(fs.readFileSync(process.argv[2])));
  console.log(r.header, r.players, r.warnings);
  const pl = r.players.find(p => String(p.id) === process.argv[3]) || r.players.find(p => !p.computer && r.actions[p.id]);
  const items = D.filter(d => d.race === pl.race), byId = {}, byRid = {};
  for (const d of items) { byId[d.id] = d; if (d.rid) (byRid[d.rid] = byRid[d.rid] || []).push(d); }
  const b = W.toBuild(r.actions[pl.id], byId, byRid), f = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  console.log(b.steps.map(s => f(s.plan) + ' ' + byId[s.id].name + (s.qty > 1 ? ' x' + s.qty : '')).join('\n'), '\nunknown ids:', b.unknown);
})();
