const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');
const io = require('socket.io-client');

const store = new Store();
let mainWindow;
let socket;

// API Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true
    },
    icon: path.join(__dirname, '../assets/icon.png')
  });

  // Load web app
  mainWindow.loadURL('http://localhost:5173');

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Message',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('navigate', '/messages/new');
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send('navigate', '/settings');
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://docs.nexora.com');
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/nexora/issues');
          }
        },
        { type: 'separator' },
        { label: 'About Nexora' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function initializeSocket() {
  const token = store.get('authToken');
  
  if (token) {
    socket = io(API_URL, {
      auth: { token },
      transports: ['websocket']
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      mainWindow.webContents.send('socket-status', { connected: true });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      mainWindow.webContents.send('socket-status', { connected: false });
    });

    socket.on('notification', (data) => {
      mainWindow.webContents.send('notification', data);
    });

    socket.on('message', (data) => {
      mainWindow.webContents.send('message', data);
    });
  }
}

// IPC Handlers
ipcMain.handle('get-store-value', (event, key) => {
  return store.get(key);
});

ipcMain.handle('set-store-value', (event, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('get-auth-token', () => {
  return store.get('authToken');
});

ipcMain.handle('set-auth-token', (event, token) => {
  store.set('authToken', token);
  initializeSocket();
  return true;
});

ipcMain.handle('clear-auth', () => {
  store.delete('authToken');
  if (socket) {
    socket.disconnect();
  }
  return true;
});

ipcMain.handle('get-device-info', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    deviceType: 'desktop'
  };
});

ipcMain.handle('check-for-updates', async () => {
  autoUpdater.checkForUpdatesAndNotify();
});

ipcMain.handle('send-socket-event', (event, eventName, data) => {
  if (socket && socket.connected) {
    socket.emit(eventName, data);
    return true;
  }
  return false;
});

// Auto-updater events
autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update-downloaded');
});

app.whenReady().then(() => {
  createWindow();
  createMenu();
  initializeSocket();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle external links
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});
