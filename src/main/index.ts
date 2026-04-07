import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import * as path from 'path';
import { setupFileHandlers } from './ipc/fileHandlers';
import { setupChecksumHandlers } from './ipc/checksumHandlers';
import { setupAiHandlers } from './ipc/aiHandlers';
import { createApplicationMenu } from './menu';
import { IpcChannels } from '../shared/types/ipc';
import type { TuningLogEntry } from '../shared/types/ipc';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow(): void {
  const iconPath = path.join(app.getAppPath(), 'assets', 'app-icon.png');

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    title: 'ECU Tuning Software',
    backgroundColor: '#1a1a2e',
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('file://')) {
      event.preventDefault();
    }
  });
}

// Setup IPC handlers
function setupIpcHandlers(): void {
  setupFileHandlers(ipcMain);
  setupChecksumHandlers(ipcMain);
  setupAiHandlers(ipcMain);

  // App handlers
  ipcMain.handle('app:get-version', () => app.getVersion());

  ipcMain.handle('app:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('app:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('app:quit', () => {
    app.quit();
  });

  ipcMain.handle(IpcChannels.LOG_ACTION, (_, entry: TuningLogEntry) => {
    console.info('[renderer action]', entry.action, entry);
  });

  ipcMain.handle(
    IpcChannels.LOG_ERROR,
    (_, message: string, details?: Record<string, unknown>) => {
      console.error('[renderer error]', message, details ?? {});
    }
  );
}

// App ready
app.whenReady().then(() => {
  createWindow();
  setupIpcHandlers();

  // Set application menu
  const menu = createApplicationMenu(mainWindow);
  Menu.setApplicationMenu(menu);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (Windows & Linux)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});
