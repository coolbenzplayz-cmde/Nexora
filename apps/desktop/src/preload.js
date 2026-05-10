const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Store operations
  getStoreValue: (key) => ipcRenderer.invoke('get-store-value', key),
  setStoreValue: (key, value) => ipcRenderer.invoke('set-store-value', key, value),
  
  // Auth operations
  getAuthToken: () => ipcRenderer.invoke('get-auth-token'),
  setAuthToken: (token) => ipcRenderer.invoke('set-auth-token', token),
  clearAuth: () => ipcRenderer.invoke('clear-auth'),
  
  // Device info
  getDeviceInfo: () => ipcRenderer.invoke('get-device-info'),
  
  // Updates
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  // Socket operations
  sendSocketEvent: (eventName, data) => ipcRenderer.invoke('send-socket-event', eventName, data),
  
  // Event listeners
  onNotification: (callback) => ipcRenderer.on('notification', callback),
  onMessage: (callback) => ipcRenderer.on('message', callback),
  onSocketStatus: (callback) => ipcRenderer.on('socket-status', callback),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  onNavigate: (callback) => ipcRenderer.on('navigate', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

window.addEventListener('DOMContentLoaded', () => {
  // Add device info to document
  ipcRenderer.invoke('get-device-info').then((deviceInfo) => {
    document.documentElement.setAttribute('data-device', 'desktop');
    document.documentElement.setAttribute('data-platform', deviceInfo.platform);
  });
});
