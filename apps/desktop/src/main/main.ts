import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import started from 'electron-squirrel-startup';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

function tokenPath(): string {
  return join(app.getPath('userData'), 'refresh-token.bin');
}

function registerIpcHandlers(): void {
  ipcMain.handle('secure:set-refresh-token', async (_event, token: string | null) => {
    if (!token) {
      await unlink(tokenPath()).catch(() => undefined);
      return;
    }
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Không thể truy cập vùng lưu trữ mã hóa của hệ điều hành');
    }
    const encrypted = safeStorage.encryptString(token);
    await writeFile(tokenPath(), encrypted);
  });

  ipcMain.handle('secure:get-refresh-token', async () => {
    try {
      if (!safeStorage.isEncryptionAvailable()) return null;
      const encrypted = await readFile(tokenPath());
      return safeStorage.decryptString(encrypted);
    } catch {
      return null;
    }
  });

  ipcMain.handle('print:current-window', async () => {
    const window = BrowserWindow.getFocusedWindow() ?? mainWindow;
    if (!window) return { success: false, reason: 'Không tìm thấy cửa sổ để in' };
    return new Promise<{ success: boolean; reason?: string }>((resolve) => {
      window.webContents.print({ silent: false, printBackground: true }, (success, reason) =>
        resolve({ success, reason: success ? undefined : reason }),
      );
    });
  });
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#f5f7fb',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  await createWindow();
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
