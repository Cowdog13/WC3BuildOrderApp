// Electron shell: frameless, always-on-top, see-through window with system-wide hotkeys, so the
// timer can be driven while Warcraft III has focus. Warcraft III must run in Windowed / Borderless
// mode for any overlay to be visible on top of it.
const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let win, clickThrough = false, keys = {}, mode = 'overlay';
const SIZES = { overlay: { width: 310, height: 440 }, full: { width: 1200, height: 800 } };
const posFile = () => path.join(app.getPath('userData'), 'window.json');
let saved = {};
try { saved = JSON.parse(fs.readFileSync(posFile(), 'utf8')); } catch { /* first run */ }

function place(m) {
  const { workArea } = screen.getPrimaryDisplay(), s = SIZES[m];
  const p = saved[m] || (m === 'overlay'
    ? { x: workArea.x + workArea.width - s.width - 8, y: workArea.y + Math.round((workArea.height - s.height) / 2) }   // right edge, vertically centred
    : { x: workArea.x + 40, y: workArea.y + 40 });
  win.setBounds({ x: p.x, y: p.y, width: s.width, height: s.height });
}

function setClickThrough(on) {
  clickThrough = on;
  win.setIgnoreMouseEvents(on, { forward: true });
  win.webContents.send('clickthrough', on);
}

function createWindow() {
  win = new BrowserWindow({
    ...SIZES.overlay, frame: false, transparent: true, alwaysOnTop: true, hasShadow: false, show: false,
    skipTaskbar: false, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.setAlwaysOnTop(true, 'screen-saver');        // stays above borderless-windowed games
  place('overlay');
  win.loadFile(path.join(__dirname, '..', 'index.html'), { query: { desktop: '1' } });
  win.once('ready-to-show', () => win.showInactive());       // do not steal focus from the game
  win.on('moved', () => {                                    // remember where you put it
    const b = win.getBounds(); saved[mode] = { x: b.x, y: b.y };
    try { fs.writeFileSync(posFile(), JSON.stringify(saved)); } catch { /* ignore */ }
  });
}

function tryRegister(accel, fn) {
  // "`" is the backtick key; some Electron builds only know it as Backquote
  const forms = accel === '`' ? ['`', 'Backquote'] : [accel];
  for (const f of forms) {
    try { if (globalShortcut.register(f, fn)) return true; } catch { /* try next form */ }
  }
  console.error('Could not register hotkey', accel);
  return false;
}

function registerKeys(next) {
  keys = next || keys;
  globalShortcut.unregisterAll();
  for (const [action, accel] of Object.entries(keys)) {
    tryRegister(accel, () => {
      if (action === 'click') setClickThrough(!clickThrough);
      else win.webContents.send('hotkey', action);
    });
  }
}

ipcMain.on('set-keys', (_e, k) => registerKeys(k));
ipcMain.on('set-mode', (_e, m) => {
  if (!SIZES[m]) return;
  mode = m; place(m);
  setClickThrough(m === 'overlay');          // overlay lets the mouse through to the game; F10 turns that off to move it
});
ipcMain.on('win', (_e, action) => { if (action === 'minimize') win.minimize(); if (action === 'close') app.quit(); });

app.whenReady().then(createWindow);
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
