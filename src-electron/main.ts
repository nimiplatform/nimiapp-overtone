import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { app, BrowserWindow, ipcMain, Menu, protocol, session, webContents } from 'electron';
import { configureNimiElectronAppHostProfile } from '@nimiplatform/kit/shell/electron/host-profile';

// @nimi-authority: rule.overtone.kit.r004
try {
  configureNimiElectronAppHostProfile(app);
} catch (error) {
  process.stderr.write(`[nimi-app-host-profile] ${error instanceof Error ? error.message : String(error)}\n`);
  app.exit(78);
  throw error;
}

const {
  createNimiElectronStandardApplicationMenuTemplate,
  isAllowedElectronRendererUrl,
  registerNimiElectronAppAssetProtocolScheme,
  registerNimiElectronAppBridge,
} = await import('@nimiplatform/kit/shell/electron/main');

const APP_ID = 'nimi.overtone';
declare const __NIMI_ELECTRON_PRODUCTION__: boolean;
const IS_PRODUCTION_BUNDLE = typeof __NIMI_ELECTRON_PRODUCTION__ !== 'undefined'
  && __NIMI_ELECTRON_PRODUCTION__;

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(currentDir, '..');
if (process.platform === 'win32') app.setAppUserModelId(`ai.nimi.${app.isPackaged ? '' : 'dev.'}apps.nimi.overtone`);
// Native presentation is separate from metadata.icon artwork shown in Nimi Home.
const nativeAppIconPath = path.join(appRoot, 'assets', 'native', process.platform === 'win32' ? 'windows.ico' : process.platform === 'darwin' ? 'macos.png' : 'app.png');
const preloadPath = path.join(currentDir, 'preload.cjs');
const productionRendererUrl = pathToFileURL(path.join(appRoot, 'dist', 'index.html')).toString();
const developmentRendererUrl = readDevelopmentRendererUrl();
const rendererUrl = developmentRendererUrl || productionRendererUrl;
const allowedRendererUrls = [rendererUrl];
let resettingRenderer = false;
let quitting = false;

app.setName('Nimi Overtone');
app.commandLine.appendSwitch('disable-background-networking');
Menu.setApplicationMenu(Menu.buildFromTemplate(
  createNimiElectronStandardApplicationMenuTemplate({ appName: app.getName() }),
));
registerNimiElectronAppAssetProtocolScheme(protocol);

void app.whenReady().then(async () => {
  if (process.platform === 'darwin' && !app.isPackaged) app.dock?.setIcon(nativeAppIconPath);
  registerNimiElectronAppBridge({
    appId: APP_ID,
    allowedRendererUrls,
    assetMediaPlatform: { protocol, webRequest: session.defaultSession.webRequest, webContents },
    ipcMain,
    onSessionInvalidated: resetAccountScopedRenderer,
  });
  await createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
  });
}).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error || 'Nimi Overtone Electron startup failed')}\n`);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !resettingRenderer && BrowserWindow.getAllWindows().length === 0) app.quit();
});
app.on('before-quit', () => { quitting = true; });

function resetAccountScopedRenderer(): void {
  const windows = BrowserWindow.getAllWindows();
  if (quitting || windows.length === 0) return;
  resettingRenderer = true;
  try {
    for (const window of windows) window.destroy();
    void createMainWindow().catch((error: unknown) => {
      process.stderr.write(`[nimi-app-session-reset] ${error instanceof Error ? error.message : String(error)}\n`);
    });
  } finally { resettingRenderer = false; }
}

async function createMainWindow(): Promise<void> {
  const window = new BrowserWindow({
    icon: nativeAppIconPath,
    width: 1180,
    height: 900,
    minWidth: 360,
    minHeight: 560,
    title: 'Nimi Overtone',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedElectronRendererUrl(url, allowedRendererUrls)) event.preventDefault();
  });
  try {
    await window.loadURL(rendererUrl);
    if (!window.isDestroyed()) { window.show(); window.focus(); }
  }
  catch (error) { if (!window.isDestroyed()) throw error; }
}

function readDevelopmentRendererUrl(): string {
  const prefix = '--nimi-dev-renderer-url=';
  const values = process.argv.filter((value) => value.startsWith(prefix));
  if (IS_PRODUCTION_BUNDLE && values.length > 0) {
    throw new Error("Production App does not accept development renderer arguments.");
  }
  if (values.length === 0) return '';
  if (values.length !== 1) throw new Error('Nimi development renderer URL must be singular.');
  const selected = values[0];
  if (!selected) throw new Error('Nimi development renderer URL is missing.');
  const parsed = new URL(selected.slice(prefix.length));
  if (
    parsed.protocol !== 'http:'
    || !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(parsed.hostname.toLowerCase())
    || !parsed.port
    || parsed.username
    || parsed.password
    || (parsed.pathname !== '/' && parsed.pathname !== '')
    || parsed.search
    || parsed.hash
  ) {
    throw new Error('Nimi development renderer URL must be exact loopback.');
  }
  return parsed.origin;
}
