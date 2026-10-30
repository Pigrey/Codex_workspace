import { common } from '@kit.AbilityKit';
import { preferences } from '@kit.ArkData';
import { util } from '@kit.ArkTS';
import { BusinessError } from '@kit.BasicServicesKit';
import { wearEngine } from '@kit.WearEngine';
import { runSyncSelfCheck } from '../sync/SyncCore';

class ProbeTask {
  id: string = util.generateRandomUUID();
  title: string = '';
  done: boolean = false;
}

@Entry
@Component
struct Index {
  @State tasks: ProbeTask[] = [];
  @State title: string = '';
  @State status: string = '正在读取本机数据';
  @State capability: string = '通信能力待检测';
  @State ready: boolean = false;
  private store?: preferences.Preferences;

  aboutToAppear(): void {
    try {
      const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
      this.store = preferences.getPreferencesSync(context, { name: 'siji_harmony_probe' });
      const saved = this.store.getSync('tasks', '[]') as string;
      this.tasks = JSON.parse(saved) as ProbeTask[];
      this.ready = true;
      this.status = `已读取 ${this.tasks.length} 条本机事项`;
    } catch (error) {
      const failure = error as BusinessError;
      this.status = `读取失败 ${failure.code}：${failure.message}`;
    }
  }

  private async save(next: ProbeTask[]): Promise<void> {
    if (!this.store || !this.ready) { return; }
    this.ready = false;
    try {
      await this.store.put('tasks', JSON.stringify(next));
      await this.store.flush();
      this.tasks = next;
      this.status = `已落盘 ${next.length} 条；请退出重开验证`;
    } catch (error) {
      const failure = error as BusinessError;
      this.status = `保存失败 ${failure.code}：${failure.message}`;
    } finally {
      this.ready = true;
    }
  }

  private async add(): Promise<void> {
    const task = new ProbeTask();
    task.title = this.title.trim() || '本机新增事项';
    await this.save(this.tasks.concat([task]));
  }

  private async toggle(id: string): Promise<void> {
    const next = this.tasks.map((task: ProbeTask) => {
      const updated = new ProbeTask();
      updated.id = task.id;
      updated.title = task.title;
      updated.done = task.id === id ? !task.done : task.done;
      return updated;
    });
    await this.save(next);
  }

  private async inspectConnection(): Promise<void> {
    if (!canIUse('SystemCapability.Health.WearEngine')) {
      this.capability = '本机未提供 Wear Engine 系统能力';
      return;
    }
    try {
      const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
      const devices = await wearEngine.getDeviceClient(context).getConnectedDevices();
      this.capability = `Wear Engine 返回 ${devices.length} 台已连接设备；尚未交换数据`;
    } catch (error) {
      const failure = error as BusinessError;
      this.capability = `Wear Engine ${failure.code}：${failure.message}`;
    }
  }

  private inspectProtocol(): void {
    try {
      this.capability = runSyncSelfCheck();
    } catch (error) {
      this.capability = `协议自检失败：${(error as Error).message}`;
    }
  }

  build() {
    Scroll() {
      Column({ space: 12 }) {
        Text('四季待办 · 验证').fontSize(22).fontWeight(FontWeight.Bold)
        Text('本机保存 / 通信能力检测').fontSize(14)
        TextInput({ placeholder: '事项标题（可留空）', text: this.title })
          .onChange((value: string) => { this.title = value; })
        Button('新增并保存').enabled(this.ready).onClick(() => { this.add(); })
        Text(this.status).fontSize(14)
        ForEach(this.tasks, (task: ProbeTask) => {
          Button(`${task.done ? '✓' : '○'} ${task.title}`)
            .enabled(this.ready).onClick(() => { this.toggle(task.id); })
        }, (task: ProbeTask) => task.id)
        Button('检查通信能力').onClick(() => { this.inspectConnection(); })
        Text(this.capability).fontSize(14)
        Button('离线协议自检').onClick(() => { this.inspectProtocol(); })
        Text('此原型尚未实现双端同步和提醒').fontSize(12)
      }.width('100%').padding({ top: 48, bottom: 48, left: 28, right: 28 })
    }.width('100%').height('100%')
  }
}
