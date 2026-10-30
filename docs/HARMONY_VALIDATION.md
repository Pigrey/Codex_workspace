# 鸿蒙双端验证进度

更新日期：2026-10-29（Asia/Shanghai）。这是实际检查记录与待执行验收，不是已完成的鸿蒙应用。

## 最新进展：2026-10-29

### 无设备连接的继续验证

用户明确暂不方便连接设备，要求先验证。本轮没有再次请求连接、签名或窗口授权。

- 新增 `SyncCore.ets` 实验核心与本机“离线协议自检”入口。14 项主机协议检查全部通过，包含 100 组确定性乱序/重复/重传；桌面默认 17 项测试仍通过。
- 测试直接转译应用所引用的同一 `.ets` 源文件；随后用官方 ArkTS 工具链编译成功（34 个任务，退出码 0，只有未配置签名警告）。未在设备执行自检。最新未签名 HAP SHA-256：`BE7B0CA8D9967013C3F5BFFCFA22D54698BDEF1EE8E16E0BD22D32E9CF87A62E`。
- 模拟交换验证核心字段、子任务、分组、计划顺序和删除状态，未接入实际 UI 数据存储或 Wear Engine；只增加协议自检代码，未宣称实现端到端同步。候选冲突规则和重要限制见 `harmony/validation/README.md`。
- SDK 明确 `sendMessage` 消息长度 **[1,4096) 字节**。实测合法中文任务日志可以超限，不能直接单条发送；分片/重组或文件传输仍待实现与真机验证，不裁剪核心字段规避限制。
- 官方 SDK 的 `BackgroundTasksKit.json` 中 `reminderAgentManager.publishReminder/cancelReminder` 支持 phone API 12、wearable API 18。接口文档要求 PUBLISH_AGENT_REMINDER 和通知授权，并说明系统代理可接管冻结/退出后的已发布提醒。没有调用接口、申请权限或验证锁屏/重启/省电/去重，不能据此宣称真机提醒可靠。
- 复现：`node --test harmony/validation/sync-check.cjs`；使用自定义 IDE 目录时设置 DEVECO_HOME。测试显式执行，不要求桌面 Linux CI 安装华为 SDK。

### 安装与首个原型基线

- 用户已安装并打开 DevEco Studio。读取官方 `product-info.json` 确认 26.0.0.851，build 261.23567.138.36.2600851；SDK `sdk/default/sdk-pkg.json` 标注 HarmonyOS 26.0.0.105 Release / API 26。没有将它等同于用户设备系统版本。
- 配套 Node v24.14.1；ohpm 26.0.0.630（包清单）；hvigor 与 hvigor-ohos-plugin 均 6.26.8（包清单）；hdc `-v` 返回 3.2.0f。编译使用 IDE 自带 Node/JBR，没有全局更换运行时。
- 官方 SDK 的 `hms/ets/api/device-define/api-version/WearEngine.json` 明确 `getConnectedDevices`、`P2pClient.sendMessage/registerMessageReceiver`：phone/tablet 从 5.0.0(12)，wearable 从 5.1.0(18)。`@hms.health.wearEngine.d.ts` 定义 Uint8Array 消息及对端应用信息，通过 `@kit.WearEngine` 引入。这是接口声明证据，不能替代服务开通、签名和真机链路验证。
- 官方 Empty Ability 模板声明 Stage/ArkTS 支持 phone/wearable。基于 IDE 自带完整预览模板创建 `harmony/probe/`，改为 phone/wearable 通用 HAP，最低 API 18、target API 26；两端分别安装和落盘，后续界面仍可分模块。
- 当前原型仅有本机新增/完成/恢复、Preferences flush/重开读取及 Wear Engine 能力/连接数量检查。完整核心字段、同步协议、提醒、历史导出均未实现；不减少最终同步要求。
- 直接构建先因缺少构建插件模块失败，随后用本机 IDE 配套插件链接解决；真实 hvigor 再报告 `00306003`：工程路径不允许中文。`scripts/build-harmony-probe.ps1` 采用唯一英文临时构建目录，保留原仓库路径，未移动或覆盖用户文件。
- 首次 ArkTS 编译因 BusinessError 的 Kit 导入失败，按本机 SDK 改为 `@kit.BasicServicesKit`。最新编译完成 34 个任务、退出码 0，只有未配置签名警告。`pack.info` 确认 deviceType 为 phone/wearable，compatible 18、target 26。
- 未签名产物：`harmony/probe/build/validation/entry-default-unsigned.hap`（已 Git 忽略）。最终清理未引用模板占位文件后复编通过，SHA-256：`7C5B9E316F57134C9A72B985557F45D5EC9FD9D3CF11DC5B96FA1FCB8FC7C492`。这不是已签名或可直接安装的交付包。
- `hdc list targets` 未返回设备；窗口控制等待授权超时，未操作登录/签名界面。已请用户连接手机并在设备确认 USB 调试授权，手表保持全能模式。完整型号/固件/API 需连接后读取。没有签名、安装、启动或运行真机用例。
- 下一步：连接和授权设备 → 读取系统/API → 在英文临时工程中由用户配置 IDE 调试签名 → 分别验证本机保存 → 核实 Wear Engine 服务及签名条件 → 前台双向通信 → 全量字段/离线冲突/提醒。参见 `harmony/probe/README.md` 的复现命令。

以下为 2026-10-28 的首次检查与原始验收计划，历史安装缺失记录以本节最新结果为准。

## 本地基线

- 完整阅读 `docs/HANDOFF.md`、`NEXT_CODEX_PROMPT.md`、`README.md`，检查 `src/model.cjs`、`src/planner.js`。
- 在本次检查的 Documents、Desktop、Downloads、codex_workspace 范围内未找到已有检出。`C:\Users\WSong\codex_workspace\time-manager` 为空。
- 当前检出位于本文件所在仓库，分支 `main`，基线 `98a7e6703c02ed0075764725cc401149ba10f6c5`。初始工作区干净。没有 reset、clean、worktree、远端写入，也没有访问 Windows 待办数据。
- 直接 GitHub 克隆两次连接重置。发现本机系统 HTTP 代理后，用单次 `git -c http.proxy=http://127.0.0.1:7890 clone --branch main --single-branch https://github.com/Pigrey/Codex_workspace.git repository` 成功；没有关闭 TLS 或修改全局代理。
- 提权创建的仓库在普通终端触发所有权检查。本次仅使用 `git -c safe.directory=<本仓库绝对路径> ...`；没有添加全局通配信任。
- 工作目录旁的 `main-source.zip`、`source-snapshot/` 是克隆成功前取得的临时官方源码快照，后续以本 Git 检出为准。

| 项目 | 实测结果 |
| --- | --- |
| Windows | Windows 11 专业版，10.0.26200，64 位 |
| 内存 | 系统可见 15.8 GiB；官网要求 16 GB 及以上，安装后仍需检查实际运行资源 |
| 可用磁盘 | C: 173.2 GiB；D: 139.4 GiB（检查时） |
| Git | 2.54.0.windows.1 |
| Node / npm | v24.16.0 / 11.13.0 |
| 已有 Java | Microsoft OpenJDK 21.0.6；尚未证明匹配鸿蒙构建，请使用 IDE 配套运行时 |
| DevEco Studio | 常见目录、卸载注册表、开始菜单及桌面快捷方式中未发现；用户亦表示尚未安装 |
| hdc / ohpm / hvigor | PATH 中未发现；没有 SDK 版本或设备列表证据 |
| 开发者实名认证 | 用户确认已完成；未访问账号或签名材料 |
| 手机 | 用户确认 Pura X Max 典藏版，HOP-AL10；完整系统版本待读取 |
| 手表 | 用户确认 HUAWEI WATCH 5；型号标识及完整系统版本待读取 |

## 官方资料与结论边界

以下仅引用官方页面；检索摘要、页面正文是否可读分别注明。

1. [Pura X Max 官方产品页](https://consumer.huawei.com/cn/phones/pura-x-max/)：检索可读，当前介绍 HarmonyOS 7。不能据此推定用户设备已升级，也不能将产品系统名称直接等同 SDK API 级别。
2. [穿戴设备开发入口](https://developer.huawei.com/consumer/cn/multidevice/wearables/)：可读，明确区分智能穿戴和 Lite Wearable，提供 HarmonyOS 5.0 及以上智能穿戴开发入口。下一步按实际 SDK 模板与能力表核对 ArkTS/ArkUI、Stage 及设备类型。
3. [智能穿戴应用开发](https://developer.huawei.com/consumer/cn/doc/best-practices/bpta-smartwatch)：已访问，但正文未被网页工具提取。不能把第三方镜像的接口片段当成已核实的官方 API。
4. [WATCH 5 开发者模式](https://consumer.huawei.com/cn/support/content/zh-cn16114595/)：检索可读。设置 → 设备名称 → 关于手表，软件版本连续点击 7 次；开发者选项位于设置 → 系统。调试开关和电脑信任授权由用户本人操作。
5. [华为开发者官方答复：Watch 5 Lite Mode](https://forums.developer.huawei.com/forumPortal/en/topic/0201202320807616132)：可读，官方答复说明省电模式仅运行系统应用，并指向智能穿戴文档及 IP 调试。双端验收必须区分全能/省电模式；第三方待办不可承诺省电模式常驻。需在用户固件上再次核实。
6. [Wear Engine 业务简介](https://developer.huawei.com/consumer/cn/doc/connectivity-guides/service-introduction-0000000000018585)：官方检索摘要说明双向消息和文件。此页不能单独证明原生鸿蒙手机与 WATCH 5 的具体接口兼容。
7. [原生鸿蒙手机侧开发](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/wearengine_phonedev)、[穿戴侧开发](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/wearengine_watchdev)：已尝试访问，前者超时，后者未提取正文。原生 Kit 的最低 API、权限、签名关联、报文大小、回调与后台限制尚未核实。旧 HMS Android/iOS 接入流程不能代替原生 Kit 流程。
8. [DevEco Studio](https://developer.huawei.com/consumer/cn/deveco-studio/)：官网内容给出 Windows 10/11 64 位、16 GB 内存、100 GB 磁盘要求，支持多设备开发。其公开下载入口为 [下载中心](https://developer.huawei.com/consumer/cn/download/)。未取得并校验安装包，未安装。浏览器自动化不可用/超时；下载中心为动态页面，静态读取没有得到可核实的 Windows 包地址。没有改用第三方包。
9. [WATCH 5 功能兼容清单](https://consumer.huawei.com/cn/support/content/zh-cn16053052/)：可读，说明与 HarmonyOS 5.0 及以上手机的产品功能兼容；不能将其解释为任意第三方跨设备 API 均可用。

结论：原生手机 + 完整智能手表是优先核实的路线，Wear Engine Kit 是通信候选。具体 API/工程结构尚未通过匹配 SDK 和真机验证，不冻结选型，不编造工程配置或通用构建命令。调试证书、Profile 有效期及设备限制须依据本机 IDE/AGC 实际签名配置与官方说明确认。

## 下一步操作

本次本机验证：`node --test`，17 项通过、0 失败；只验证现有桌面纯逻辑。环境脚本在允许 CIM 访问的执行上下文成功输出，`InspectionErrors: []`。受限执行上下文无法读取 CIM 时会输出未知值和错误列表并以非零状态结束，不把无权限误报为零内存。`git diff --check` 通过。没有运行 Electron UI，也没有运行任何鸿蒙编译或真机用例。

1. 从官方下载中心取得 Windows DevEco Studio 安装包，核对版本、官方校验信息和数字签名；完成安装与首次配置。账号登录、协议接受、实名认证及设备信任由用户本人完成。
2. 在 SDK Manager 核实目标设备支持的 API 和模板，记录 IDE、SDK、ohpm、hvigor、hdc 的实际版本，使用配套运行时。通过 `scripts/check-harmony-environment.ps1 -DevEcoHome <目录>` 复查。
3. 手机 USB 调试，手表按官方智能穿戴指导配置 IP 调试。用户完成设备授权后，工具读取型号与系统；设备序列号/UDID 只保留本机，不写入仓库。
4. 确认官方 Kit 原生双端能力及签名条件后，由实际 IDE 模板创建 `harmony/` 内的手机与手表最小工程，记录模板、设备类型和构建命令。共享逻辑位置根据真实模板决定。
5. 先打通签名安装、持久化和前台 P2P，再测试重连/冲突，最后测后台与提醒。只有真实通过才填写通过状态。

## 最小双端验收矩阵（真机部分全部未运行）

每次记录 IDE/SDK、双端系统、构建提交、执行步骤、预期/实际、脱敏日志和结果。原始设备标识和签名文件不要提交。

| 用例 | 执行与通过条件 | 状态 |
| --- | --- | --- |
| A：构建安装 | 手机/手表分别编译、签名、安装、启动；保存实际命令及退出码 | 通用未签名 HAP 编译通过；签名/双端安装启动未运行 |
| B：离线持久化 | 两端各新增不同事项，结束应用后重开，内容仍在；断网仍可编辑 | 未运行 |
| C：完整字段 | 双向交换任务、分组、子任务及勾选、四象限、按日期计划及排序、category/issue 人员阶段、提醒配置、完成/恢复/删除 | 未运行 |
| D：断连补传 | 两端断连分别修改，重启后仍保留待发送操作；重连最终一致，无静默丢数据 | 未运行 |
| E：重复与乱序 | 同一操作重复发送至少 3 次；延迟/乱序/中断后重传，实体和操作记录不重复 | 未运行 |
| F：并发冲突 | 编辑对编辑、编辑对删除、完成对恢复、并发排序、删除分组对任务移动；调换接收顺序仍收敛；不以墙钟决定胜者 | 未运行 |
| G：引用一致性 | 删任务清理计划引用，恢复完成保留计划位置，父子勾选独立；分组删除处理孤立引用 | 未运行 |
| H：提醒 | 双端前台/锁屏/切后台/应用退出/重启/断连重连逐项测；记录系统授权、是否触发、延迟和重复次数 | 未运行 |
| I：手表模式 | 全能模式执行全部核心功能；切省电模式与恢复后的可用性/补同步/提醒行为单独记录 | 未运行 |

同步候选设计：持久化操作日志、稳定实体 ID、操作 ID、因果版本与删除标记；接收确认须在落盘之后。并发编辑保留可检查证据，删除不得因迟到编辑自动复活；同字段、排序和完成/恢复的胜出规则在原型前写清并测试。这些是设计约束，尚未实现，也未将历史/偏好同步范围或提醒主设备定为产品决定。

Windows 原有 `tasks.json` 不参与初始化或同步。鸿蒙两端持有全部核心数据；手表界面分层不会减少同步字段。
