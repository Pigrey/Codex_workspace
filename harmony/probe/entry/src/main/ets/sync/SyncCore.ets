// Transport-independent protocol experiment. No wall clock, network or OS APIs.
// Keep the complete operation log until a verified compaction protocol exists.
export class SyncOperation {
  actor: string = '';
  sequence: number = 0;
  clock: number = 0;
  kind: string = '';
  entity: string = '';
  field: string = '';
  value: string = '';
}

export class SyncEnvelope {
  namespace: string = 'siji-harmony-probe';
  schema: number = 1;
  operations: SyncOperation[] = [];
}

function identifier(value: string): boolean {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,96}$/.test(value);
}

function validDay(value: string): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) { return false; }
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validValue(op: SyncOperation): boolean {
  if (typeof op.value !== 'string' || op.value.length > 16384) { return false; }
  if (op.field === '$deleted') {
    return op.kind !== 'plan' && !(op.kind === 'group' && op.entity === 'inbox') && op.value === 'true';
  }
  if (op.kind === 'group') { return op.field === 'name' && op.value.trim().length > 0; }
  if (op.kind === 'plan') {
    if (op.field !== 'order') { return false; }
    const ids = JSON.parse(op.value) as string[];
    return Array.isArray(ids) && ids.length <= 500 && ids.every((id: string) => identifier(id)) &&
      new Set(ids).size === ids.length;
  }
  if (op.field === 'title') { return op.value.trim().length > 0 && op.value.length <= 2048; }
  if (op.field === 'done') { return op.value === 'true' || op.value === 'false'; }
  if (op.kind === 'child') { return op.field === 'taskId' && identifier(op.value); }
  if (op.field === 'groupId') { return identifier(op.value); }
  if (op.field === 'quadrant') { return ['1', '2', '3', '4'].includes(op.value); }
  if (op.field === 'category') { return op.value === 'task' || op.value === 'issue'; }
  if (op.field === 'reporter' || op.field === 'tracker') { return op.value.length <= 512; }
  if (op.field === 'stage') { return ['分析中', '等待回复', '训练中', '回归中'].includes(op.value); }
  if (op.field === 'remindAt') {
    return op.value === '' || /^\d{4}-\d{2}-\d{2}T/.test(op.value) && Number.isFinite(Date.parse(op.value));
  }
  return false;
}

function check(op: SyncOperation): void {
  if (!op || !identifier(op.actor) || !Number.isSafeInteger(op.sequence) || op.sequence <= 0 ||
    !Number.isSafeInteger(op.clock) || op.clock <= 0 || op.clock < op.sequence ||
    !['group', 'task', 'child', 'plan'].includes(op.kind) ||
    (op.kind === 'plan' ? !validDay(op.entity) : !identifier(op.entity)) || !validValue(op)) {
    throw new Error('Invalid sync operation');
  }
}

function copy(op: SyncOperation): SyncOperation {
  const result = new SyncOperation();
  result.actor = op.actor;
  result.sequence = op.sequence;
  result.clock = op.clock;
  result.kind = op.kind;
  result.entity = op.entity;
  result.field = op.field;
  result.value = op.value;
  return result;
}

function compare(a: SyncOperation, b: SyncOperation): number {
  if (a.clock !== b.clock) { return a.clock < b.clock ? -1 : 1; }
  if (a.actor !== b.actor) { return a.actor < b.actor ? -1 : 1; }
  return a.sequence === b.sequence ? 0 : a.sequence < b.sequence ? -1 : 1;
}

function same(a: SyncOperation, b: SyncOperation): boolean {
  return a.actor === b.actor && a.sequence === b.sequence && a.clock === b.clock && a.kind === b.kind &&
    a.entity === b.entity && a.field === b.field && a.value === b.value;
}

export class SyncReplica {
  private actor: string;
  private operations: SyncOperation[] = [];

  constructor(actor: string) {
    if (!identifier(actor)) { throw new Error('Invalid replica actor'); }
    this.actor = actor;
  }

  set(kind: string, entity: string, field: string, value: string): void {
    if (this.isDeleted(kind, entity)) { throw new Error('Deleted IDs cannot be reused'); }
    const op = new SyncOperation();
    op.actor = this.actor;
    op.sequence = this.operations.filter((item: SyncOperation) => item.actor === this.actor)
      .reduce((maximum: number, item: SyncOperation) => Math.max(maximum, item.sequence), 0) + 1;
    op.clock = this.operations.reduce((maximum: number, item: SyncOperation) => Math.max(maximum, item.clock), 0) + 1;
    op.kind = kind;
    op.entity = entity;
    op.field = field;
    op.value = value;
    check(op);
    if (this.operations.length >= 10000) { throw new Error('Prototype log limit reached'); }
    this.operations.push(op);
  }

  deleteEntity(kind: string, entity: string): void {
    if (!this.isDeleted(kind, entity)) { this.set(kind, entity, '$deleted', 'true'); }
  }

  isDeleted(kind: string, entity: string): boolean {
    return this.operations.some((op: SyncOperation) => op.kind === kind && op.entity === entity && op.field === '$deleted');
  }

  read(kind: string, entity: string, field: string, fallback: string = ''): string {
    if (this.isDeleted(kind, entity)) { return fallback; }
    const candidates = this.operations.filter((op: SyncOperation) =>
      op.kind === kind && op.entity === entity && op.field === field);
    candidates.sort(compare);
    return candidates.length === 0 ? fallback : candidates[candidates.length - 1].value;
  }

  entityIds(kind: string): string[] {
    const ids = new Set<string>();
    this.operations.forEach((op: SyncOperation) => {
      if (op.kind === kind && !this.isDeleted(kind, op.entity)) { ids.add(op.entity); }
    });
    return Array.from(ids).sort();
  }

  groupForTask(task: string): string {
    const group = this.read('task', task, 'groupId', 'inbox');
    return group === 'inbox' || this.entityIds('group').includes(group) ? group : 'inbox';
  }

  childrenForTask(task: string): string[] {
    if (this.isDeleted('task', task)) { return []; }
    return this.entityIds('child').filter((id: string) => this.read('child', id, 'taskId') === task);
  }

  plan(day: string): string[] {
    const ids = JSON.parse(this.read('plan', day, 'order', '[]')) as string[];
    const tasks = this.entityIds('task');
    return ids.filter((id: string) => tasks.includes(id));
  }

  exportLog(): string {
    const envelope = new SyncEnvelope();
    envelope.operations = this.operations.map(copy).sort(compare);
    return JSON.stringify(envelope);
  }

  merge(serialized: string): void {
    if (typeof serialized !== 'string' || serialized.length > 4000000) { throw new Error('Invalid sync envelope'); }
    const envelope = JSON.parse(serialized) as SyncEnvelope;
    if (!envelope || envelope.namespace !== 'siji-harmony-probe' || envelope.schema !== 1 ||
      !Array.isArray(envelope.operations) || envelope.operations.length > 10000) {
      throw new Error('Unsupported sync envelope');
    }
    // Validate into a temporary log: malformed or equivocal batches never partly apply.
    const next = this.operations.map(copy);
    envelope.operations.forEach((op: SyncOperation) => {
      check(op);
      const previous = next.find((item: SyncOperation) => item.actor === op.actor && item.sequence === op.sequence);
      if (previous) {
        if (!same(previous, op)) { throw new Error('Operation identity collision'); }
      } else { next.push(copy(op)); }
    });
    if (next.length > 10000) { throw new Error('Prototype log limit reached'); }
    this.operations = next;
  }
}

export function runSyncSelfCheck(): string {
  const phone = new SyncReplica('phone');
  const watch = new SyncReplica('watch');
  phone.set('task', 'sample', 'title', '断连前');
  watch.merge(phone.exportLog());
  phone.set('task', 'sample', 'done', 'true');
  watch.set('task', 'sample', 'title', '手表离线修改');
  const phoneLog = phone.exportLog();
  const watchLog = watch.exportLog();
  phone.merge(watchLog);
  watch.merge(phoneLog);
  phone.merge(watchLog);
  if (phone.exportLog() !== watch.exportLog() || phone.read('task', 'sample', 'done') !== 'true' ||
    phone.read('task', 'sample', 'title') !== '手表离线修改') { throw new Error('Sync convergence failed'); }
  return '协议自检通过：离线修改合并、重复传输去重（非真机通信）';
}
