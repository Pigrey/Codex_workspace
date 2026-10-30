# 四季待办：Mac 接续说明

整理日期：2026-10-30（Asia/Shanghai）。本说明面向下一台 MacBook Air M5 上的本地开发会话。

## 当前文件在哪里

当前开发发生在 Windows 本地 `C:\Users\WSong\Documents\ChatGPT\日程管理\repository`，不是云端执行环境。

远端仓库为 https://github.com/Pigrey/Codex_workspace ，使用 main。原始基线为 `98a7e6703c02ed0075764725cc401149ba10f6c5`。用户于 2026-10-30 授权将鸿蒙代码、脚本、验证文档和云端提示词一同提交推送；这些源码应与本文件存在于同一提交中。接续时先确认 main 包含 `CLOUD_CODEX_PROMPT.md`、`harmony/probe/` 和 `harmony/validation/`，不要仍停留在旧基线。聊天可见性不能替代 Git 文件检查。

此前另提供了推送前的源码 ZIP 快照，它不含 Git 历史，也不含后续云端提示词更新。main 推送成功后优先从 GitHub 克隆/更新，不需要再叠加旧 ZIP。若使用旧快照恢复本地文件，保留 .git 和用户改动，并先比较版本，避免旧文件覆盖新源码。

## 产品目标与约束

产品名“四季待办”，已有 Electron Windows 离线版 v1.4.0。新的鸿蒙版为独立自用原生应用，手机 Pura X Max 典藏版（用户提供 HOP-AL10）与 HUAWEI WATCH 5 同步全部核心事项，**不与 Windows 版同步数据**。

离线优先：断连可操作，重连补同步，不强制云服务器。全部核心数据包括任务、清单/分组、子任务及勾选、四象限、按日期的今日计划和排序、问题跟踪分类/提出人/跟踪人/阶段、提醒配置、完成/恢复/删除。手表 UI 可分层精简，但不可只同步下一条或通知。完整历史/偏好同步、提醒由哪端触发及去重策略仍待设计，未获用户最终确认。

用户已完成华为开发者实名认证；两台设备完整系统版本尚未读取。用户称“鸿蒙 7”是目标称呼，不是已核实的固件/API。不要推定 SDK 26 就等于两台设备的系统版本。

## 已完成的代码与证据

- `harmony/probe/`：基于 Windows 本机官方 DevEco 模板建立 Stage/ArkTS/ArkUI 原型，一个 entry HAP 声明 phone/wearable，包名 `com.pigrey.siji.harmonyprobe`，compatible API 18、target API 26。
- 页面实现本机新增、完成/恢复、Preferences 保存/读取、Wear Engine 能力/连接数量检测，另有“离线协议自检”。上述页面**未在手机/手表上运行**，只有编译证据。
- `SyncCore.ets`：与实际页面引用相同的候选协议核心，独立命名空间、稳定 ID、actor/sequence 操作标识、Lamport 时钟、按字段寄存器、不可复活删除标记、原子内存合并、每日完整顺序寄存器。规则是实验方案，不是最终产品决定。
- `harmony/validation/sync-check.cjs`：直接转译同一 `.ets` 源码做 14 项主机检查，全部通过；包含 100 组乱序/重复/重传。未启动实际传输链路。
- 同一核心已通过官方 ArkTS 编译，34 个构建任务成功，产物未签名。上次产物 SHA-256：`BE7B0CA8D9967013C3F5BFFCFA22D54698BDEF1EE8E16E0BD22D32E9CF87A62E`。产物没有放入迁移源码 ZIP，Mac 应重新构建。
- 桌面默认 `node --test` 的 17 项测试仍通过。它们与鸿蒙测试分开执行，不把桌面测试称为真机验证。

## 关键尚未完成项

1. 签名、双端安装/启动、真机持久化与完整系统版本读取。
2. Wear Engine 服务开通、签名/指纹匹配、用户授权及真实通信链路。实名认证不等于服务已开通。
3. 把候选核心接入真实本地事项存储和 UI，持久化 actor、操作日志及接收确认；当前仅内存自检，不能宣称断电恢复可靠。
4. 全部核心字段 UI、历史记录/导出、完整同步、首次全量与后续增量、可靠分片/文件传输、重试/确认、冲突提示、日志压缩。
5. 两端系统提醒、锁屏/退出/重启/断连及省电模式的行为和去重。

## 已查明的官方能力边界

- Windows 安装的官方 DevEco Studio：26.0.0.851；SDK：HarmonyOS 26.0.0.105 Release / API 26；配套 Node：24.14.1；hvigor/插件：6.26.8；ohpm：26.0.0.630；hdc：3.2.0f。**这些是 Windows 实测版本，不能当作 Mac 安装记录。**
- 官方 SDK WearEngine 设备表：消息发送/接收等支持 phone API 12、wearable API 18，仍需目标固件和服务验证。
- `sendMessage` 长度为 [1,4096) **字节**。中文事项就可能使全量日志超限，不能直接整份发送，也不能丢字段凑大小。SDK 有 transferFile 声明，实际使用条件尚待验证。
- 官方 SDK reminderAgentManager 的 publishReminder/cancelReminder 支持 phone API 12、wearable API 18；需 PUBLISH_AGENT_REMINDER 和通知授权。系统代理的文档声明不等于已验证锁屏或重启提醒。
- 华为官方对 Watch 5 省电模式答复为仅系统应用可运行；不能承诺第三方待办在省电模式常驻，切回后的补同步另测。
- 本地 Windows hvigor 拒绝中文工程路径，使用英文临时目录构建成功。Mac 建议先选英文工作路径，是否存在同样限制以实际工具输出为准。

## Mac 接续顺序

1. 先完整读取 `docs/HANDOFF.md`、`docs/MAC_HANDOFF.md`、`docs/HARMONY_VALIDATION.md`、`harmony/probe/README.md`、`harmony/validation/README.md`；检查 Git 状态，保留所有用户文件，不新建 worktree，不 reset/clean。
2. 确认 main 已包含 SyncCore.ets、验证脚本和云端提示词；若仍只有旧基线，先检查远端同步状态。不要用旧 ZIP 覆盖更新后的检出。
3. 检查 Mac 的 macOS/芯片、实际 DevEco 安装、SDK/API、Node/JBR、ohpm/hvigor/hdc；使用官方匹配工具。不要复制 Windows SDK、node_modules、Junction 或缓存到 Mac。
4. 当前 `.ps1` 环境/构建脚本专为 Windows；**不要在 Mac 照抄 Windows 盘符、.exe/.bat 或临时目录**。先用 Mac DevEco 导入 `harmony/probe`，根据实际工具帮助恢复可复现命令。测试脚本可通过 DEVECO_HOME 指向包含 `sdk/default/openharmony/ets/build-tools/ets-loader/node_modules/typescript` 的实际工具目录；如布局不同，检查后适配，不猜路径。
5. 用户届时计划连接华为手机。通过实际 hdc 读取已授权目标与系统版本。设备信任、账号登录、验证码和签名由用户在本机操作；不索要聊天中的私钥/密码，设备 ID 不写入仓库。
6. 先跑通手机签名安装、本机保存/重开及能力检测；再接 Watch 5 做同样测试，然后打通前台双向报文，最后扩展完整数据同步、离线冲突和提醒。模拟器或主机测试不能替代 Watch 5 真机验收。

## 可直接交给 Mac 会话的指令

> 接续“四季待办”独立鸿蒙版，GitHub 为 Pigrey/Codex_workspace，使用 main，保留本地改动。先完整读取 docs/MAC_HANDOFF.md 及它列出的接续文档，确认已取得包含鸿蒙原型、验证代码及 CLOUD_CODEX_PROMPT.md 的 main。我现在在 MacBook Air M5 上，将连接 Pura X Max 典藏版 HOP-AL10，另有 HUAWEI WATCH 5，开发者实名认证已完成。先检查 Mac 实际 DevEco/SDK/工具链并适配 Windows 专用脚本，再读取授权设备版本、完成手机签名安装与持久化验证，随后推进手表通信。全部核心事项必须双端同步，离线可用，不与 Windows 数据同步。既有证据为 14 项主机协议检查、17 项桌面测试和未签名 HAP 编译通过，尚未真机验证；还需阅读云端后续提交记录，不能把旧验证结果当作最新实测。请准确区分，不重复询问已明确的信息，不在聊天中索要凭据。
