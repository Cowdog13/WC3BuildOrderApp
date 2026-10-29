// Electron shell: frameless, always-on-top window with system-wide hotkeys, so the timer can be
// driven while Warcraft III has focus. Warcraft III must run in Windowed / Borderless mode for any
// overlay to be visible on top of it.
const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('path');

let win, clickThrough = false, keys = {};
const SIZES = { overlay: { width: 360, height: 460 }, full: { width: 1200, height: 800 } };

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    ...SIZES.full, x: workArea.x + 40, y: workArea.y + 40,
    frame: false, transparent: true, alwaysOnTop: true, hasShadow: false, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.setAlwaysOnTop(true, 'screen-saver');        // stays above borderless-windowed games
  win.loadFile(path.join(__dirname, '..', 'index.html'), { query: { desktop: '1' } });
  win.once('ready-to-show', () => win.show());
}

function registerKeys(next) {
  keys = next || keys;
  globalShortcut.unregisterAll();
  for (const [action, accel] of Object.entries(keys)) {
    try {
      globalShortcut.register(accel, () => {
        if (action === 'click') {
          clickThrough = !clickThrough;
          win.setIgnoreMouseEvents(clickThrough, { forward: true });
          win.webContents.send('clickthrough', clickThrough);
        } else win.webContents.send('hotkey', action);
      });
    } catch (e) { console.error('Could not register', accel, e.message); }
  }
}

ipcMain.on('set-keys', (_e, k) => registerKeys(k));
ipcMain.on('set-mode', (_e, mode) => {
  const s = SIZES[mode]; if (!s) return;
  if (mode === 'full' && clickThrough) { clickThrough = false; win.setIgnoreMouseEvents(false); win.webContents.send('clickthrough', false); }
  win.setSize(s.width, s.height);
});
ipcMain.on('win', (_e, action) => { if (action === 'minimize') win.minimize(); if (action === 'close') app.quit(); });

app.whenReady().then(createWindow);
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
