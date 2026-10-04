const { contextBridge, ipcRenderer, clipboard, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

contextBridge.exposeInMainWorld('electronAPI', {
  ipcRenderer: {
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(event, ...args)),
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    once: (channel, func) => ipcRenderer.once(channel, (event, ...args) => func(event, ...args)),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
  },
  clipboard: {
    writeImage: (image) => clipboard.writeImage(image)
  },
  nativeImage: {
    createFromDataURL: (dataURL) => nativeImage.createFromDataURL(dataURL)
  },
  fs: {
    writeFileSync: (path, data) => fs.writeFileSync(path, data)
  },
  path: {
    join: (...args) => path.join(...args)
  },
  os: {
    homedir: () => os.homedir()
  }
});
