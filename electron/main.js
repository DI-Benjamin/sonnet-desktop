const { app, BrowserWindow, BrowserView, net } = require('electron')
const { ipcMain, nativeTheme, Notification, session, globalShortcut } = require('electron')
const path = require('path')
const { Tray, Menu, nativeImage } = require('electron/main')
const { autoUpdater } = require('electron')
const { updateElectronApp, UpdateSourceType } = require('update-electron-app')

const site = "http://localhost:3000"
let tray
let mainWin
let appView
let splashView
let updateInfo = null

autoUpdater.autoDownload = false; // Changed to false for manual control
autoUpdater.autoInstallOnAppQuit = true;

updateElectronApp({
  updateSource: {
    type: UpdateSourceType.ElectronPublicUpdateService,
    repo: 'DI-Benjamin/sonnet-desktop',
    token: process.env.GH_TOKEN,
    prerelease: false,
    draft: false,
    force: true,
    generateReleaseNotes: true
  },
  updateInterval: '10 minutes',
  logger: console,
  notifyUser: false
})

autoUpdater.on('checking-for-update', () => {
  appView?.webContents.send('update-status', { type: 'checking', message: 'Checking for updates...' })
})

autoUpdater.on('update-available', (info) => {
  // built-in does not include the same fields; include what exists
  appView?.webContents.send('update-status', { 
    type: 'available',
    message: 'Update available. Downloading in background…',
    // releaseName/date are available only later; see docs
  })
})

autoUpdater.on('update-not-available', (_info) => {
  appView?.webContents.send('update-status', { 
    type: 'not-available', 
    message: 'You are running the latest version'
  })
})

autoUpdater.on('error', (err) => {
  appView?.webContents.send('update-status', { 
    type: 'error', 
    message: 'Error checking for updates',
    error: err.message
  })
})

autoUpdater.on('update-downloaded', (_event, releaseNotes, releaseName, releaseDate /*, updateURL */) => {
  // You can cache your own "updateInfo" from these args if you like:
  updateInfo = { version: releaseName, releaseDate }
  appView?.webContents.send('update-status', { 
    type: 'downloaded',
    message: 'Update downloaded and ready to install',
    version: releaseName,
    releaseDate: releaseDate?.toString?.()
  })
  new Notification({
    title: 'Sonnet Studio Update Ready',
    body: `Version ${releaseName} has been downloaded and is ready to install.`
  }).show()
})


// IPC handlers for update management
ipcMain.handle('check-for-updates', async () => {
  try {
    await autoUpdater.checkForUpdates()
    return true
  } catch (error) {
    console.error('Error checking for updates:', error)
    throw error
  }
})

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall()
})

ipcMain.handle('get-update-info', () => {
  return updateInfo
})

// NEW: show offline page in the app BrowserView and start retrying
function showOfflineInAppView() {
  if (!mainWin || mainWin.isDestroyed() || !appView) return
  stopAutoRetry(mainWin)
  appView.webContents.loadFile(path.join(__dirname, 'no-connection.html')).catch(() => {})
  startAutoRetry(mainWin, 3000, async () => {
    try { await appView.webContents.loadURL(site) } catch {}
  })
}

function checkConnection() {
  return new Promise((resolve) => {
    const request = net.request({ url: site, method: 'HEAD' })
    request.on('response', () => resolve(true))
    request.on('error', () => resolve(false))
    request.end()
  })
}

async function loadAppOrOfflineIntoAppView() {
  try {
    const online = await checkConnection()
    if (online) {
      await appView.webContents.loadURL(site)
      stopAutoRetry(mainWin)
    } else {
      showOfflineInAppView()
    }
  } catch (_) {
    showOfflineInAppView()
  }
}

// Per-window retry timer storage
const retryTimers = new WeakMap()

function startAutoRetry(win, intervalMs = 3000, onOnline) {
  stopAutoRetry(win)
  const id = setInterval(async () => {
    if (win.isDestroyed()) { clearInterval(id); return }
    if (await checkConnection()) {
      clearInterval(id)
      retryTimers.delete(win)
      try {
        if (typeof onOnline === 'function') {
          await onOnline()
        } else {
          await win.loadURL(site)
        }
      } catch {}
    }
  }, intervalMs)
  retryTimers.set(win, id)
}

function stopAutoRetry(win) {
  const id = retryTimers.get(win)
  if (id) {
    clearInterval(id)
    retryTimers.delete(win)
  }
}

ipcMain.handle('get-app-version', () => {
  return app.getVersion(); // Gets version from your package.json
});

const createWindow = () => {
  // Create the single BrowserWindow
  mainWin = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1280,
    minHeight: 800,
    titleBarStyle: 'hidden',
    ...(process.platform !== 'darwin' ? { titleBarOverlay: true } : {}),
    trafficLightPosition: { x: 5, y: 5 },
    frame: false,
    transparent: true,
    show: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webviewTag: true,
      devTools: !app.isPackaged,
    }
  })

  // Create BrowserViews
  appView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      devTools: !app.isPackaged,
    }
  })
  splashView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      devTools: !app.isPackaged,
    }
  })

  // Helper to keep views sized to content area
  function resizeViewsToWindow() {
    if (!mainWin) return
    const [width, height] = mainWin.getContentSize()
    try { appView.setBounds({ x: 0, y: 0, width, height }) } catch {}
    try { splashView.setBounds({ x: 0, y: 0, width, height }) } catch {}
    try { appView.setAutoResize({ width: true, height: true }) } catch {}
    try { splashView.setAutoResize({ width: true, height: true }) } catch {}
  }

  // Attach views (app under, splash on top)
  try { mainWin.addBrowserView(appView) } catch {}
  try { mainWin.addBrowserView(splashView) } catch {}
  resizeViewsToWindow()

  // Load boot animation into splash view
  splashView.webContents.loadFile(path.join(__dirname, 'bootup.html')).catch(() => {})

  // Initial load depending on connectivity for the app view
  loadAppOrOfflineIntoAppView()

  // When the app view has finished loading (site or offline page), fade out splash and remove it
  appView.webContents.on('did-finish-load', () => {
    if (!splashView) return
    try { splashView.webContents.send('splash-fade') } catch {}
    setTimeout(() => {
      if (splashView) {
        try { mainWin.removeBrowserView(splashView) } catch {}
        splashView = null
      }
    }, 400)
  })

  // Keep views sized
  mainWin.on('resize', resizeViewsToWindow)

  // Optional: cache logging
  const filter = { urls: [`${site}/_next/*`] }
  session.defaultSession.webRequest.onCompleted(filter, (details) => {
    console.log('Cached:', details.url)
  })

  // IMPORTANT: if a navigation to the main frame fails, go offline
  appView.webContents.on('did-fail-load', (event, errorCode, errorDesc, validatedURL, isMainFrame) => {
    if (isMainFrame) {
      console.warn('Main-frame load failed:', errorCode, errorDesc)
      showOfflineInAppView()
    } else {
      // For subresources you could ignore or decide to go offline on specific codes
    }
  })

  // Covers renderer crashes or process exits that can happen on lost backend
  appView.webContents.on('render-process-gone', (_event, details) => {
    console.warn('Renderer gone:', details.reason)
    showOfflineInAppView()
  })

  // If the page becomes unresponsive (e.g., waiting on a dead server), switch to offline
  mainWin.on('unresponsive', () => {
    console.warn('Window unresponsive – switching to offline.')
    showOfflineInAppView()
  })
}

// Handle "Retry" from the offline page
ipcMain.on('retry-connection', async (event) => {
  if (!mainWin || mainWin.isDestroyed()) return
  await loadAppOrOfflineIntoAppView()
})

ipcMain.on('renderer-online-status', async (event, { online }) => {
  if (!mainWin || mainWin.isDestroyed()) return
  if (!online) {
    // OS/network says we're offline – show the offline page immediately
    showOfflineInAppView()
  } else {
    // Came back online – try to load the app
    await loadAppOrOfflineIntoAppView()
  }
})

ipcMain.handle('dark-mode:toggle', () => {
    if (nativeTheme.shouldUseDarkColors) {
      nativeTheme.themeSource = 'light'
    } else {
      nativeTheme.themeSource = 'dark'
    }
    return nativeTheme.shouldUseDarkColors
  })
  
  ipcMain.handle('dark-mode:system', () => {
    nativeTheme.themeSource = 'system'
  })

  // Notifications example
function showNotification(title, body) {
  new Notification({ title, body }).show();
}

const dockMenu = Menu.buildFromTemplate([
  {
    label: 'New Window',
    click () { console.log('New Window') }
  }, {
    label: 'New inbox',
    submenu: [
      { label: 'Known User' },
      { label: 'New User' }
    ]
  },
  { label: 'New Command...' }
])

app.whenReady().then(() => {
  app.dock?.setMenu(dockMenu)
  createWindow()

  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAIRlWElmTU0AKgAAAAgABQESAAMAAAABAAEAAAEaAAUAAAABAAAASgEbAAUAAAABAAAAUgEoAAMAAAABAAIAAIdpAAQAAAABAAAAWgAAAAAAAABLAAAAAQAAAEsAAAABAAOgAQADAAAAAQABAACgAgAEAAAAAQAAABCgAwAEAAAAAQAAABAAAAAAGuDUbgAAAAlwSFlzAAALiQAAC4kBN8nLrQAAAVlpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDYuMC4wIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iPgogICAgICAgICA8dGlmZjpPcmllbnRhdGlvbj4xPC90aWZmOk9yaWVudGF0aW9uPgogICAgICA8L3JkZjpEZXNjcmlwdGlvbj4KICAgPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KGV7hBwAAAhdJREFUOBFlkzuLE1EUx+88skQTtFC0c8mD4JpFkNiKjaWFFlvY2fkNbGz0i1jLYmFtFbSwEayCsskkMbjisrAQGHWcnYe//+XO6JID/5xzz/ucnPF6vd6sLMtDY8wfBw8K0Z3y9kADNNGhKjOng5kc3Jbjl/l8fl+aTqez7ft+EcfxSavVupTn+Sm64/F4rMAN6na7b320qmD6/f4NgpcknLbb7edU/NpoNL6vVqt9HF+Q6I78hsPh1mg0sjE8AyWwlGVZ4cRfjhuSCce8nwZB8I5xH08mk3S9XtdxtaAZXWBCUMBbwWu60m6qig8Gg8Hl2WwmnaU6QaWAp1UC5GlRFFeoHqCbg4i9vP7P15xJoKpQAm84+QDel0zwG2z34HfZx1WXxKsT4FSPgLGJo3x+gFvsZ4U9YZybUiJfc/xfAilEGH/DLtCq5gzCMFSRV+ChS4poqmJnRrBKnPQvXASfwS7V1UVJ4h1s4jF7+YZOY5X1CFI4SuDncJzCd/HZR94jyDCCzvH9crlUUtFmApx1dT+t2ZhD3qratd7shSTPnM2yjQ6oEBJwBNcYH8Aj3taZLva4gU+6Rqvgx1cFPcQhiVriEYhAC2yx0JfYri8WC91AyDVW30apj8l2EUXRgpvfTtM0bjabGSiSJDkPf6LzJVAUgPqLpGjoEfQR5QmQkz5hOdmecSgooLdaVnv6hLV9TF4Odv4CsdsDdWSXc3gAAAAASUVORK5CYII=')
  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Item1', type: 'radio' },
    { label: 'Item2', type: 'radio' },
    { label: 'Item3', type: 'radio', checked: true },
    { label: 'Item4', type: 'radio' }
  ])

  tray.setToolTip('This is my application.')
  tray.setContextMenu(contextMenu)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  // Check for updates on startup, but don't auto-download
  setTimeout(() => {
    autoUpdater.checkForUpdates()
  }, 5000) // Wait 5 seconds after startup
})

app.on('ready', () => {
  globalShortcut.register('Control+Shift+I', () => {
    // When the user presses Ctrl + Shift + I, this function will get called
    // You can modify this function to do other things, but if you just want
    // to disable the shortcut, you can just return false
    return false;
  });
  globalShortcut.register('Alt+CommandOrControl+I', () => {
    return false;
  });
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})