# 四季待办

一个无需账号、无需服务器的中文 Windows 离线待办应用。使用 Electron，界面和数据均保存在本机，运行不依赖网络。

## 功能

- 清单：添加、编辑、完成、恢复和删除任务，支持搜索任务与子任务。
- 分组：收件箱和自定义清单。删除清单时，任务会移入收件箱。
- 子任务：独立勾选进度；父任务和子任务的完成状态独立。
- 四象限：重要且紧急、重要不紧急、紧急不重要、不重要不紧急，支持标签和四宫格视图。
- 提醒：单次本地时间提醒、今日提醒视图、Windows 系统通知。修改提醒时间可重新提醒。
- 备份：JSON 导出和导入，导入前校验并确认替换。
- 本地持久化：临时文件写入后替换数据文件；检测到数据损坏时停止启动，避免覆盖原始文件。

## Windows 使用

支持 Windows 10 / 11 x64。

- **ZIP 版本**：解压整个 `四季待办-1.0.0-win.zip` 到普通可写目录，双击 `四季待办.exe`。不要只移动 EXE，其他文件也是运行依赖。
- **ZIP 构建**：推送 `main` 后，GitHub Actions 的 **Windows app** 工作流生成 `siji-todo-windows` 下载产物，包含离线 ZIP。也可从 Actions 手动运行。需仓库启用 Actions。安装版和单文件便携版可在 Windows 本地执行 `npm run dist:win` 尝试构建，目前 CI 的安装程序打包未通过，自动发布仅包含 ZIP。
- **版本下载**：推送 `v*` 标签后，工作流构建并将 `siji-todo-windows-x64.zip` 上传到对应的 GitHub Release。Release 下载地址仅在工作流成功完成后可用。
- 初次安装或下载安装包需要网络，安装后使用无需网络。
- 当前构建没有代码签名证书。

### 提醒行为

关闭主窗口后，应用继续在系统托盘运行。双击托盘图标打开，右键选择“退出”才会停止应用。

提醒每 10 秒检查一次。应用须运行、电脑须处于唤醒状态；完全退出或关机时不会弹出通知。重启应用或恢复唤醒后，会补发未完成且尚未提醒的到期任务。Windows 通知权限、勿扰模式可能影响通知展示。当前没有开机自启、重复提醒或唤醒电脑功能。

### 数据和备份

数据位于 Electron 的 `userData` 目录，Windows 默认路径通常是 `%APPDATA%\siji-todo\tasks.json`。便携版也将数据写入用户配置目录，不写入 EXE 所在目录。数据是未加密 JSON，仅适合本机使用；请定期导出备份。

导入会替换全部现有数据，不会合并。损坏数据导致启动失败时，先备份提示路径中的原文件，再排查或恢复备份。不要直接删除唯一的数据文件。

## 开发

安装 Node.js 24 LTS，在仓库根目录执行：

```sh
npm ci
npm start
```

首次安装需访问 npm 和 Electron 官方 GitHub 下载地址；应用运行无需外部服务、API Key 或账号。

```sh
npm test                         # 数据校验、序列化、到期提醒筛选
npx playwright install chromium # 首次安装界面测试浏览器
npm run test:ui                  # 浏览器界面交互测试
npm run dist:win                 # 在 Windows 生成安装版和便携版
```

Linux 环境可以使用已有 Chromium：

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
```

跨平台生成 ZIP（不需要 Wine）：

```sh
npx electron-builder --win zip --config.win.signAndEditExecutable=false
```

Linux 生成 NSIS / 便携 EXE 需要 Wine，推荐使用仓库自带的 Windows Actions 工作流。Electron 桌面启动需要图形会话。

## 验证范围

本次 Linux 云环境验证包括模型单元测试、真实 Chromium 界面操作（通过内存/浏览器存储适配 IPC）以及 Windows x64 ZIP 打包。界面测试覆盖分组、添加/编辑任务、子任务、刷新恢复、搜索、四象限、完成/恢复、删除和分组迁移。

浏览器适配测试不等于验证 Electron 原生 IPC 或文件系统持久化。Windows 原生通知、托盘、安装程序、Electron 重启后读取本地文件和 Windows 实机运行尚需实测；Linux 无图形会话，原生启动未通过。Windows Actions 工作流已提供，但是否运行及其结果需以 Actions 实际记录为准。

## 文件结构

- `src/main.cjs`：桌面窗口、托盘、通知、文件保存和备份。
- `src/preload.cjs`：最小化 IPC 接口，渲染页面无 Node.js 权限。
- `src/model.cjs`：数据结构校验和提醒筛选。
- `src/renderer.js`、`src/index.html`、`src/style.css`：中文离线界面。
- `test/`、`scripts/smoke-ui.cjs`：单元与交互测试。
