const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('todo', {
  load: () => ipcRenderer.invoke('load'), save: s => ipcRenderer.invoke('save', s),
  export: () => ipcRenderer.invoke('export'), import: () => ipcRenderer.invoke('import'),
  journal: day => ipcRenderer.invoke('journal', day),
  exportMarkdown: day => ipcRenderer.invoke('export-markdown', day),
  onChange: fn => ipcRenderer.on('changed', (_, s) => fn(s))
});
