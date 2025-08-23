const { contextBridge, ipcRenderer } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

// Import everything so we can reach RuntimeLoader
const rive = require('@rive-app/canvas');
const { Rive, RuntimeLoader, Fit, Alignment, Layout } = rive;

const isDev = !process.env.ELECTRON_IS_PACKAGED;

// <repo>/resources/animations/bootup.riv
const bootupFsPath = isDev
  ? path.join(__dirname, '..', 'resources', 'animations', 'bootup.riv')
  : path.join(process.resourcesPath, 'animations', 'bootup.riv');

if (!fs.existsSync(bootupFsPath)) {
  console.error('[preload] Missing Rive file at:', bootupFsPath);
}
const bootupUrl = `file://${bootupFsPath.replace(/\\/g, '/')}`;

// <repo>/node_modules/@rive-app/canvas/rive.wasm
const riveWasmFsPath = path.join(__dirname, '..', 'node_modules', '@rive-app', 'canvas', 'rive.wasm');
if (!fs.existsSync(riveWasmFsPath)) {
  console.error('[preload] Missing rive.wasm at:', riveWasmFsPath);
}
const riveWasmUrl = `file://${riveWasmFsPath.replace(/\\/g, '/')}`;

// --- CRUCIAL: tell the runtime to use the local WASM (avoids CSP/remote fetch) ---
RuntimeLoader.setWasmUrl(riveWasmUrl);

contextBridge.exposeInMainWorld('riveAPI', {
  create: (opts) => new Rive({ ...opts }),     // no need for locateFile now
  enums: { Fit, Alignment, Layout },
});
contextBridge.exposeInMainWorld('riveAssets', { bootup: bootupUrl });

// Allow splash page to listen for a fade trigger
contextBridge.exposeInMainWorld('events', {
  onSplashFade: (handler) => {
    try { ipcRenderer.on('splash-fade', () => handler && handler()) } catch {}
  }
});

// (rest of your bridges)
try { window.addEventListener('online', () => ipcRenderer.send('renderer-online-status', { online: true })); window.addEventListener('offline', () => ipcRenderer.send('renderer-online-status', { online: false })); } catch {}
contextBridge.exposeInMainWorld('app', { retryConnection: () => ipcRenderer.send('retry-connection') });
try { if (typeof Notification !== 'undefined' && Notification.requestPermission) Notification.requestPermission() } catch {}
contextBridge.exposeInMainWorld('desktopAPI', { notify: (msg) => ipcRenderer.send('notify', msg) });
contextBridge.exposeInMainWorld('appEnv', { isElectron: true });
console.log('Preload script loaded');
