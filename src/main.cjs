const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { empty, validate, due } = require('./model.cjs');
const { recordChanges, markdown } = require('./journal.cjs');
let win, tray, state, dataPath, quitting = false;
app.setAppUserModelId('com.pigrey.siji.todo');
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
  app.whenReady().then(async () => {
    dataPath = path.join(app.getPath('userData'), 'tasks.json');
    try { state = validate(JSON.parse(fs.readFileSync(dataPath, 'utf8'))); }
    catch (e) {
      if (e.code !== 'ENOENT') {
        dialog.showErrorBox('无法读取待办数据', '为避免覆盖原始数据，应用将退出。请备份并检查：' + dataPath + '\n' + e.message);
        app.quit(); return;
      }
      state = empty();
    }
    win = new BrowserWindow({ width: 1220, height: 820, minWidth: 920, minHeight: 620, backgroundColor: '#f7f8fa', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', e => e.preventDefault());
    win.setMenuBarVisibility(false);
    await win.loadFile(path.join(__dirname, 'index.html'));
    win.on('close', e => { if (!quitting && tray) { e.preventDefault(); win.hide(); } });
    const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png')).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip('四季待办 · 双击打开');
    tray.setContextMenu(Menu.buildFromTemplate([{ label: '打开四季待办', click: () => win.show() }, { label: '退出（停止提醒）', click: () => app.quit() }]));
    tray.on('double-click', () => win.show());
    setInterval(checkReminders, 10000);
    checkReminders();
  });
}
function persist(next) {
  validate(next);
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath + '.tmp', JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(dataPath + '.tmp', dataPath);
  state = next;
}
function checkReminders() {
  for (const task of due(state)) {
    if (!Notification.isSupported()) continue;
    const notice = new Notification({ title: '四季待办 · 提醒', body: task.title });
    notice.on('click', () => { win.show(); win.focus(); });
    notice.on('show', () => {
      try {
        const next = structuredClone(state);
        const current = next.tasks.find(t => t.id === task.id);
        if (current && current.remindAt === task.remindAt) current.notified = true;
        persist(next); win.webContents.send('changed', state);
      } catch (e) { dialog.showErrorBox('提醒状态保存失败', e.message); }
    });
    notice.show();
  }
}
ipcMain.handle('load', () => state);
ipcMain.handle('save', (_, next) => { validate(next); persist(recordChanges(state, next)); return state; });
ipcMain.handle('journal', (_, day) => markdown(state, day));
ipcMain.handle('export-markdown', async (_, day) => {
  const content = markdown(state, day);
  const r = await dialog.showSaveDialog(win, { defaultPath: `四季待办-${day || '全部每日记录'}.md`, filters: [{name:'Markdown',extensions:['md']}] });
  if (!r.canceled) fs.writeFileSync(r.filePath, content, 'utf8');
  return !r.canceled;
});
ipcMain.handle('export', async () => {
  const r = await dialog.showSaveDialog(win, { defaultPath: '四季待办备份.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (!r.canceled) fs.writeFileSync(r.filePath, JSON.stringify(state, null, 2));
  return !r.canceled;
});
ipcMain.handle('import', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled) return null;
  const next = validate(JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')));
  const answer = await dialog.showMessageBox(win, { type: 'question', buttons: ['取消', '替换现有数据'], defaultId: 0, cancelId: 0, message: '导入将替换全部待办。建议先导出备份。' });
  if (answer.response !== 1) return null;
  persist(next); return state;
});
app.on('before-quit', () => { quitting = true; });
