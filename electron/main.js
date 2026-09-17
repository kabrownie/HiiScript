const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Keep the desktop app usable on Linux systems with unstable or legacy GPU drivers.
app.disableHardwareAcceleration();

function createWindow() {
  const window = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 720,
    minHeight: 560,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  const indexPath = path.join(__dirname, '..', 'www', 'index.html');
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`Kabrownie Screen failed to load: ${errorCode} ${errorDescription}`);
  });
  window.loadURL(pathToFileURL(indexPath).toString()).catch(error => {
    console.error('Kabrownie Screen could not open its editor:', error);
  });
}

ipcMain.handle('draft:save', async (_event, content) => {
  const result = await dialog.showSaveDialog({ defaultPath: 'untitled-screenplay.json', filters: [{ name: 'Screenplay draft', extensions: ['json'] }] });
  if (result.canceled || !result.filePath) return { cancelled: true };
  await fs.writeFile(result.filePath, content, 'utf8');
  return { cancelled: false, filePath: result.filePath };
});

ipcMain.handle('draft:open', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Screenplay draft', extensions: ['json'] }] });
  if (result.canceled || result.filePaths.length === 0) return { cancelled: true };
  return { cancelled: false, filePath: result.filePaths[0], content: await fs.readFile(result.filePaths[0], 'utf8') };
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
