# 无真机验证：同步核心实验

本目录的测试显式执行，不加入桌面默认测试发现范围，避免 Linux CI 没有华为 SDK 时误失败。

```powershell
# 仓库根目录；默认从官方 DevEco 安装目录加载配套 TypeScript
node --test harmony/validation/sync-check.cjs
# 自定义 IDE 目录时先设置本次会话的 DEVECO_HOME
```

测试将实际应用引用的 `SyncCore.ets` 用本机 SDK 附带 TypeScript 转译后在 Windows Node 中执行，没有复制第二份算法。真实 ArkTS 编译由 `scripts/build-harmony-probe.ps1` 另行验证；Node 成功不代表手表运行成功。

## 已验证范围

14 项检查：核心字段 Unicode JSON 交换、分组/子任务、按日期顺序、断连后不同字段修改、同字段竞争、删除对编辑、完成/恢复独立于子任务、并发排序、删除分组回收件箱、乱序引用、100 组乱序/重复/重传、恢复日志后继续计数、原子拒绝畸形/截断/身份碰撞报文、日志限制与字节长度证据。

此处模拟两端交换字符串，不启动网络、蓝牙或 Wear Engine，不运行系统提醒，不证明后台同步或落盘事务。应用新增的“离线协议自检”按钮只是本机运行两副本的短自检，未接通两个物理设备。

## 候选规则（实验实现，尚未作为最终产品决定）

- 独立鸿蒙命名空间与 schema，稳定实体 ID；安装实例 actor + 本地 sequence 唯一标识操作。actor 要在设备本机持久化，重装/克隆数据需新的 actor，避免两个写入者共用同一身份。
- Lamport 逻辑时钟，不读取墙钟决定冲突。先比较逻辑时钟，同值按 actor ASCII 顺序，再按 sequence。看到远端更新后的本地操作始终递增。这是确定性的寄存器规则，不是自动识别用户意图的冲突解决。
- 字段分别写入，异字段的离线修改均保留。同字段竞争有一个确定胜者，败方操作保留在日志，但尚无冲突提示/人工恢复界面。
- 删除标记永久压过同 ID 的编辑；不清理删除标记，也不复用被删 ID。“完成后恢复”通过 done=false；“撤销删除”尚未实现，未来若提供须重新设计或创建新 ID。
- 每日顺序使用整个 ID 数组作为单一寄存器；并发排序选择完整的胜出数组，败方排序仍在日志。这可能舍弃另一端的并发移位效果，不声称已经合并每次移动。不同日期互不覆盖；完成保留位置，删除过滤引用。
- 分组删除后，读取视图将孤立分组引用解析到 inbox；父任务删除时隐藏子任务，迟到父引用/计划引用在父任务到达后可解析。历史日志保留原操作，不就地改写它们。
- 重放以 actor+sequence 去重，同 ID 不同内容整批拒绝。先检查整个批次再更新内存；原子内存合并不等于已实现磁盘事务。未来必须先持久化本地操作/接收日志，再发送确认。
- 为最小实验设置 10,000 操作和 4,000,000 字符的接收上限；超限拒绝，不截断。日志压缩、增量确认、垃圾回收、身份恢复、配对认证、传输分片和磁盘适配器均未实现，不能直接用此全量日志协议交付生产版本。

## 核心字段映射

group：name；task：title/groupId/quadrant/done/remindAt/category/reporter/tracker/stage；child：taskId/title/done；plan：日期和 order 数组；删除标记：group/task/child。这些验证类型覆盖当前约定的核心事项范围，不等于 UI 已提供全部编辑入口。remindAt 空字符串表示无提醒；发送过的通知状态不在此原型里。

完整操作快照历史、Markdown 导出和偏好同步尚未实现，其最终双端范围仍待设计。本实验的协议日志不能冒充用户可阅读的每日记录。

## 官方 SDK 核查的新约束

- `@hms.health.wearEngine.d.ts` 对 `P2pClient.sendMessage` 明确消息大小为 **[1, 4096) 字节**，不是字符数。合法 2048 个中文字符的单条标题即可使日志超限。当前 `exportLog()` 是本地/测试交换格式，**不可直接作为一次 sendMessage 参数**。完整事项同步需要可靠分片/重组，或经真机验证的文件传输，不能为凑大小丢字段。
- 同文件声明 phone/wearable 的 `transferFile`；文件回调、签名、权限及真实能力仍待设备验证，没有预设一定可用。
- 官方 `BackgroundTasksKit.json` 的 `api/@ohos.reminderAgentManager.d.ts` 项：publishReminder/cancelReminder 支持 phone（API 12）与 wearable（API 18）。不要混用同表中已废弃的 `reminderAgent`。
- 官方 `@ohos.reminderAgentManager.d.ts` 注释说明后台系统代理可在应用冻结/退出后接管已发布提醒；需 `ohos.permission.PUBLISH_AGENT_REMINDER` 和用户通知授权。此声明不证明本机固件、重启后、勿扰/省电模式或双端去重行为；这些都保持未验证。原型没有请求通知权限或安排提醒，也没有移植 Electron 轮询。
