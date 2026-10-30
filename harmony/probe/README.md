# 四季待办原生双端能力原型

这是最小能力验证工程，尚未实现完整同步或提醒，不是可正式使用的待办应用。

## 来源和设备声明

结构、资源与 Ability 基于本机官方 DevEco Studio 26.0.0.851 的 `plugins/codegenie-plugin/previewProjectTemplate`，设备支持与应用模型同时核对 `plugins/openharmony/lib/templates/ability/Empty Ability/template.json`。已修改包名、名称、页面路由、设备声明、SDK 配置和验证页面。没有从记忆拼接未验证的 IDE 模板。

单个 Stage/ArkTS HAP 声明 `phone`、`wearable`，在两台设备上分别独立安装和落盘。当前只有一个通用验证页面；后续正式手机/手表界面与共享模型的模块划分待真机链路验证。

- 包名：`com.pigrey.siji.harmonyprobe`，不读取或同步 Windows 数据。
- 本机 SDK：HarmonyOS 26.0.0.105 / API 26；target 26，compatible 18。
- Hvigor / 构建插件：6.26.8；Node：使用 IDE 配套 24.14.1。
- 完整系统版本和 HAP 安装兼容性仍待手机/Watch 5 实测。SDK 能编译不等于真机可用。

## 当前功能

新增、完成/恢复本机验证事项，使用 Preferences 保存并 flush；重开读取。读失败时禁用修改并显示错误。提供 Wear Engine 系统能力检查及已连接设备数量/错误码；不展示设备序列号。

本机数据仅有 ID、标题、完成状态，用于验证基本存储路径，不能当成完整核心事项同步模型。尚未实现双端数据交换、分组/子任务等完整核心字段、断连重放、冲突收敛、提醒和历史导出。最终核心同步范围仍以 `docs/HANDOFF.md` 为准，没有缩减。

另已加入独立的 `SyncCore.ets` 候选协议实验和“离线协议自检”按钮。它在内存中验证两副本的核心字段交换与确定性冲突规则，14 项主机测试通过，并随本工程通过 ArkTS 编译。尚未接入上面的本机事项存储、设备通信或完整 UI；不等同于真实断连补同步。规则、测试命令和字节限制详见 `../validation/README.md`。

Wear Engine SDK 的接口还可能要求服务开通、账号和用户授权。SDK 对 `getConnectedDevices` 列出 `1008500004`（未申请服务）、`1008500006`（隐私未同意）、`1008500008`（未登录）等错误；开发者实名认证不等于服务已开通。

## 已实测构建方式

从仓库根目录的 PowerShell 执行：

```powershell
.\scripts\build-harmony-probe.ps1 -StageRoot C:\Users\WSong\AppData\Local\Temp
```

脚本使用实际安装的官方工具，将源码复制到唯一英文临时目录，避免 hvigor 对中文工程路径的限制。仅在临时 `node_modules` 创建到 IDE 配套构建插件的 Junction；不修改安装目录、全局 Node/Java 设置或 Git 配置，不联网安装额外构建包。临时目录保留，便于检查日志。

实际执行的构建任务为：

```text
<IDE tools/node/node.exe> <IDE tools/hvigor/hvigor/bin/hvigor.js> assembleHap --mode module -p product=default -p module=entry@default -p buildMode=debug --no-daemon
```

需要标准 Windows 临时目录读写权限和创建本地 Junction 的权限。受限沙箱可能需要授权执行。IDE 自身使用正常项目导入/同步流程，无需沿用此命令行插件链接方式。

成功后未签名 HAP 和 `pack.info` 回传到本工程 `build/validation/`（已忽略），并输出 SHA-256。**没有签名的 HAP 不能直接当作已可安装包。** 不自动签名、不自动安装。

## 真机下一步

1. 手机 USB 调试与电脑授权，手表全能模式下按官方智能穿戴指导连接调试。读取完整系统与 API，核对最低支持。
2. DevEco 打开脚本输出的英文临时工程目录。用户在 IDE 登录华为开发者账号，配置目标设备的调试签名。账号、验证码、设备信任和私钥只在本机处理。
3. 分别安装到两端：新增、勾选、结束应用、重开，验证数据；点击通信检测并记录脱敏错误码。
4. 核实原生 Wear Engine 服务开通、权限和签名匹配条件后实现前台双向报文，再推进全部字段、断连/冲突/提醒矩阵。

签名配置可能包含本机敏感路径。请勿将签名材料或包含敏感配置的临时工程提交到 Git；源码工程保持空签名。
