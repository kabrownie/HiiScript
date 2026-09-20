const { app, BrowserWindow, dialog, ipcMain, shell, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// GPU acceleration policy.
//
// Linux: disabled by default, because a subset of legacy and unstable GPU
// drivers crash the renderer before the first paint. Users on healthy systems
// can opt back in with HIISCRIPT_FORCE_GPU=1.
//
// Windows and macOS: enabled by default. Users who hit graphics problems can
// opt out with HIISCRIPT_DISABLE_GPU=1.
//
// HIISCRIPT_DISABLE_GPU=1 always wins.
const disableGpu =
  process.env.HIISCRIPT_DISABLE_GPU === "1" ||
  (process.platform === "linux" && process.env.HIISCRIPT_FORCE_GPU !== "1");

if(disableGpu){
  app.disableHardwareAcceleration();
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 720,
    minHeight: 560,
    icon: path.join(__dirname, '..', 'images', 'icons', '256x256.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if(/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if(!url.startsWith('file:')) event.preventDefault();
  });
  const indexPath = path.join(__dirname, '..', 'www', 'index.html');
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`Hiiscript failed to load: ${errorCode} ${errorDescription}`);
  });
  window.loadURL(pathToFileURL(indexPath).toString()).catch(error => {
    console.error('Hiiscript could not open its editor:', error);
  });
}

ipcMain.handle('draft:save', async (_event, content, options = {}) => {
  if(typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > 10 * 1024 * 1024){
    throw new Error('Draft is invalid or too large');
  }
  const extension = ['fountain', 'md', 'json'].includes(options.extension) ? options.extension : 'fountain';
  if(extension === 'json') JSON.parse(content);
  const filterName = typeof options.filterName === 'string' ? options.filterName : 'Fountain screenplay';
  const result = await dialog.showSaveDialog({ defaultPath: typeof options.name === 'string' ? options.name : `untitled-screenplay.${extension}`, filters: [{ name: filterName, extensions: [extension] }] });
  if (result.canceled || !result.filePath) return { cancelled: true };
  await fs.writeFile(result.filePath, content, 'utf8');
  return { cancelled: false, filePath: result.filePath };
});

ipcMain.handle('draft:open', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Hiiscript files', extensions: ['json', 'fountain', 'txt', 'md'] }] });
  if (result.canceled || result.filePaths.length === 0) return { cancelled: true };
  const content = await fs.readFile(result.filePaths[0], 'utf8');
  if(Buffer.byteLength(content, 'utf8') > 10 * 1024 * 1024) throw new Error('Draft is too large');
  const extension = path.extname(result.filePaths[0]).slice(1).toLowerCase();
  if(extension === 'json'){
    const draft = JSON.parse(content);
    if(!draft || typeof draft.text !== 'string') throw new Error('Draft is invalid');
  }
  return { cancelled: false, filePath: result.filePaths[0], extension, content };
});

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
