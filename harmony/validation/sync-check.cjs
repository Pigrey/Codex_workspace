// Explicitly run with node --test harmony/validation/sync-check.cjs.
// This checks the SAME .ets source included in the native probe; no copied model.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ide = process.env.DEVECO_HOME || 'C:/Program Files/Huawei/DevEco Studio';
const ts = require(path.join(ide, 'sdk/default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const sourcePath = path.resolve(__dirname, '../probe/entry/src/main/ets/sync/SyncCore.ets');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  fileName: 'SyncCore.ts', compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
});
const loaded = new Module(sourcePath, module);
loaded._compile(compiled.outputText, sourcePath);
const { SyncReplica, runSyncSelfCheck } = loaded.exports;
const envelope = operations => JSON.stringify({ namespace: 'siji-harmony-probe', schema: 1, operations });
const exchange = (a, b) => { const first = a.exportLog(); a.merge(b.exportLog()); b.merge(first); };
const make = actor => new SyncReplica(actor);
const seed = replica => {
  replica.set('group', 'work', 'name', '工作');
  for (const id of ['task1', 'task2']) replica.set('task', id, 'title', id);
};

test('native-callable offline self-check converges', () => {
  assert.match(runSyncSelfCheck(), /自检通过/);
});

test('all core field types survive JSON wire encoding and peer reconstruction', () => {
  const a = make('phone'), b = make('watch'); seed(a);
  const fields = { title: '修复离线同步', groupId: 'work', quadrant: '2', done: 'false',
    remindAt: '2026-10-29T08:30:00.000Z', category: 'issue', reporter: '提出人', tracker: '跟踪人', stage: '回归中' };
  for (const [field, value] of Object.entries(fields)) a.set('task', 'task1', field, value);
  a.set('child', 'child1', 'taskId', 'task1');
  a.set('child', 'child1', 'title', '双端验证'); a.set('child', 'child1', 'done', 'true');
  a.set('plan', '2026-10-29', 'order', '["task2","task1"]');
  b.merge(a.exportLog());
  for (const [field, value] of Object.entries(fields)) assert.equal(b.read('task', 'task1', field), value);
  assert.deepEqual(b.plan('2026-10-29'), ['task2', 'task1']);
  assert.deepEqual(b.childrenForTask('task1'), ['child1']);
  assert.equal(b.read('child', 'child1', 'done'), 'true');
  assert.equal(b.groupForTask('task1'), 'work'); assert.equal(a.exportLog(), b.exportLog());
});

test('disconnected edits to different fields both survive reconnection', () => {
  const a = make('phone'), b = make('watch'); seed(a); b.merge(a.exportLog());
  a.set('task', 'task1', 'done', 'true'); b.set('task', 'task1', 'title', '手表离线标题');
  exchange(a, b);
  assert.equal(a.read('task', 'task1', 'done'), 'true');
  assert.equal(b.read('task', 'task1', 'title'), '手表离线标题'); assert.equal(a.exportLog(), b.exportLog());
});

test('concurrent same-field edits use logical clock then actor order, preserving losing operations', () => {
  const a = make('phone'), b = make('watch'); seed(a); b.merge(a.exportLog());
  a.set('task', 'task1', 'title', '手机标题'); b.set('task', 'task1', 'title', '手表标题');
  exchange(a, b);
  assert.equal(a.read('task', 'task1', 'title'), '手表标题');
  assert.equal(a.exportLog(), b.exportLog()); assert.match(a.exportLog(), /手机标题/);
  a.set('task', 'task1', 'title', '已看见冲突后的明确修改'); b.merge(a.exportLog());
  assert.equal(b.read('task', 'task1', 'title'), '已看见冲突后的明确修改');
});

test('delete wins against concurrent/late edits and cannot silently resurrect IDs', () => {
  const a = make('phone'), b = make('watch'); seed(a); b.merge(a.exportLog());
  a.deleteEntity('task', 'task1'); b.set('task', 'task1', 'title', '迟到的编辑');
  exchange(a, b); assert.equal(a.isDeleted('task', 'task1'), true); assert.equal(b.isDeleted('task', 'task1'), true);
  assert.equal(a.read('task', 'task1', 'title'), '');
  assert.throws(() => b.set('task', 'task1', 'done', 'false'), /cannot be reused/);
  assert.match(a.exportLog(), /迟到的编辑/); assert.equal(a.exportLog(), b.exportLog());
});

test('complete/restore races converge and causal restore wins without changing child state', () => {
  const a = make('phone'), b = make('watch'); seed(a);
  a.set('child', 'child1', 'taskId', 'task1'); a.set('child', 'child1', 'done', 'true'); b.merge(a.exportLog());
  a.set('task', 'task1', 'done', 'true'); b.set('task', 'task1', 'done', 'false'); exchange(a, b);
  assert.equal(a.read('task', 'task1', 'done'), 'false');
  a.set('task', 'task1', 'done', 'true'); b.merge(a.exportLog());
  b.set('task', 'task1', 'done', 'false'); a.merge(b.exportLog());
  assert.equal(a.read('task', 'task1', 'done'), 'false'); assert.equal(a.read('child', 'child1', 'done'), 'true');
});

test('concurrent daily queue orders choose one whole order, while dates remain independent', () => {
  const a = make('phone'), b = make('watch'); seed(a); b.merge(a.exportLog());
  a.set('plan', '2026-10-29', 'order', '["task1","task2"]');
  b.set('plan', '2026-10-29', 'order', '["task2","task1"]');
  b.set('plan', '2026-10-30', 'order', '["task1"]'); exchange(a, b);
  assert.deepEqual(a.plan('2026-10-29'), ['task2', 'task1']);
  assert.deepEqual(a.plan('2026-10-30'), ['task1']);
  a.set('task', 'task2', 'done', 'true'); assert.deepEqual(a.plan('2026-10-29'), ['task2', 'task1']);
  a.deleteEntity('task', 'task1'); assert.deepEqual(a.plan('2026-10-29'), ['task2']);
  assert.deepEqual(a.plan('2026-10-30'), []);
});

test('deleted groups resolve to inbox; dangling child/plan references stay hidden until parent arrives', () => {
  const a = make('phone'), b = make('watch'); seed(a);
  a.set('task', 'task1', 'groupId', 'work'); b.merge(a.exportLog());
  a.deleteEntity('group', 'work'); b.set('task', 'task1', 'groupId', 'work'); exchange(a, b);
  assert.equal(a.groupForTask('task1'), 'inbox'); assert.throws(() => a.deleteEntity('group', 'inbox'));
  const c = make('third'); c.set('plan', '2026-10-29', 'order', '["later"]');
  assert.deepEqual(c.plan('2026-10-29'), []); c.set('task', 'later', 'title', '后来到达');
  assert.deepEqual(c.plan('2026-10-29'), ['later']);
});

test('partial, reversed, duplicated and retried delivery converges for 100 deterministic schedules', () => {
  const a = make('phone'), b = make('watch'); seed(a); b.merge(a.exportLog());
  a.set('task', 'task1', 'title', 'A'); a.set('task', 'task1', 'quadrant', '1');
  b.set('task', 'task1', 'title', 'B'); b.deleteEntity('task', 'task2'); exchange(a, b);
  const operations = JSON.parse(a.exportLog()).operations;
  for (let iteration = 1; iteration <= 100; iteration++) {
    let randomState = iteration;
    const shuffled = operations.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      const j = randomState % (i + 1); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const c = make('receiver');
    for (const op of shuffled) { c.merge(envelope([op])); c.merge(envelope([op, op])); }
    c.merge(a.exportLog()); assert.equal(c.exportLog(), a.exportLog());
  }
});

test('restart restores actor sequence and logical clock; missing early operations are not acknowledged away', () => {
  const a = make('phone'); seed(a); const log = a.exportLog();
  const restored = make('phone'); restored.merge(log); restored.set('task', 'task1', 'done', 'true');
  const ops = JSON.parse(restored.exportLog()).operations;
  assert.equal(ops.at(-1).sequence, 4); assert.equal(ops.at(-1).clock, 4);
  const b = make('watch'); b.merge(envelope([ops.at(-1)])); b.merge(log);
  assert.equal(b.exportLog(), restored.exportLog());
});

test('malformed envelopes, invalid fields and identity collisions reject atomically', () => {
  const a = make('phone'); seed(a); const before = a.exportLog();
  const operation = JSON.parse(before).operations[0];
  for (const bad of [null, {}, { namespace: 'windows', schema: 1, operations: [] },
    { namespace: 'siji-harmony-probe', schema: 2, operations: [] }]) assert.throws(() => a.merge(JSON.stringify(bad)));
  const valid = { ...operation, actor: 'other', sequence: 1, clock: 10 };
  assert.throws(() => a.merge(envelope([valid, { ...valid, field: 'unknown' }])));
  assert.equal(a.exportLog(), before);
  assert.throws(() => a.merge(envelope([{ ...operation, value: 'same ID, different content' }])));
  assert.equal(a.exportLog(), before);
  for (const [kind, id, field, value] of [['task','task1','quadrant','5'], ['task','task1','done','yes'],
    ['task','task1','stage','已完成'], ['plan','2026-02-30','order','[]'], ['plan','2026-10-29','order','["task1","task1"]'],
    ['plan','2026-10-29','order','null'], ['child','child1','groupId','work']]) {
    assert.throws(() => a.set(kind,id,field,value)); assert.equal(a.exportLog(),before);
  }
});

test('receiver owns immutable copies; schema and log limits never silently truncate', () => {
  const a = make('phone'); seed(a); const b = make('watch'); const exported = a.exportLog(); b.merge(exported);
  const parsed = JSON.parse(exported); parsed.operations[0].value = 'tampered';
  assert.equal(b.exportLog(), exported);
  assert.throws(() => b.merge(envelope(new Array(10001).fill(parsed.operations[0]))));
  assert.equal(b.exportLog(), exported); assert.throws(() => b.merge(' '.repeat(4000001)));
});

test('a truncated transfer cannot partially apply or erase an existing local edit', () => {
  const a = make('phone'), b = make('watch'); seed(a); b.merge(a.exportLog());
  b.set('task', 'task1', 'title', '本机未传出的编辑'); const before = b.exportLog();
  a.set('task', 'task2', 'done', 'true');
  assert.throws(() => b.merge(a.exportLog().slice(0, -10)));
  assert.equal(b.exportLog(), before);
  exchange(a, b); assert.equal(a.read('task', 'task1', 'title'), '本机未传出的编辑');
  assert.equal(b.read('task', 'task2', 'done'), 'true');
});

test('UTF-8 payload evidence: valid core data can exceed Wear Engine single-message capacity', () => {
  const a = make('phone'); a.set('task', 'task1', 'title', '待'.repeat(2048));
  // Official SDK declares sendMessage byte range [1,4096). A whole log MUST NOT be
  // passed directly to sendMessage: framing or file transfer is still required.
  assert.ok(Buffer.byteLength(a.exportLog(), 'utf8') > 4095);
  const b = make('watch'); b.merge(a.exportLog());
  assert.equal(b.read('task', 'task1', 'title').length, 2048);
});
