const { randomUUID } = require('node:crypto');
const quadrants = ['', '重要且紧急', '重要不紧急', '紧急不重要', '不重要不紧急'];
const labels = {
  'task-created': '新增事项', 'task-completed': '完成事项', 'task-reopened': '恢复事项',
  'task-edited': '编辑事项', 'task-deleted': '删除事项', 'child-created': '新增子任务',
  'child-completed': '完成子任务', 'child-reopened': '恢复子任务', 'child-deleted': '删除子任务',
  'child-edited': '编辑子任务'
};
function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function validDay(day) {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0,10) === day;
}
function recordChanges(previous, next, date = new Date()) {
  // History is derived from persisted data, not from the renderer's copy.
  const history = structuredClone(previous.history || []);
  const before = new Map(previous.tasks.map(t => [t.id, t]));
  const after = new Map(next.tasks.map(t => [t.id, t]));
  const add = (kind, task, groups, childTitle) => {
    history.push({ id: randomUUID(), at: date.toISOString(), day: localDay(date),
      time: [date.getHours(),date.getMinutes(),date.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':'),
      kind, task: structuredClone(task), groupName: groups.find(g=>g.id===task.groupId)?.name || '收件箱',
      ...(childTitle ? {childTitle} : {}) });
  };
  for (const t of next.tasks) {
    const old = before.get(t.id);
    if (!old) { add('task-created', t, next.groups); continue; }
    if (old.done !== t.done) add(t.done ? 'task-completed' : 'task-reopened', t, next.groups);
    if (['title','groupId','quadrant','remindAt'].some(key=>old[key]!==t[key]) || (old.category || 'task') !== (t.category || 'task') || JSON.stringify(old.issue) !== JSON.stringify(t.issue)) add('task-edited', t, next.groups);
    const children = new Map(old.children.map(c=>[c.id,c]));
    for (const c of t.children) {
      const prior = children.get(c.id);
      if (!prior) add('child-created', t, next.groups, c.title);
      else {
        if (prior.done !== c.done) add(c.done ? 'child-completed' : 'child-reopened', t, next.groups, c.title);
        if (prior.title !== c.title) add('child-edited', t, next.groups, c.title);
      }
    }
    for (const c of old.children) if (!t.children.some(n=>n.id===c.id)) add('child-deleted', old, previous.groups, c.title);
  }
  for (const t of previous.tasks) if (!after.has(t.id)) add('task-deleted', t, previous.groups);
  return { ...next, history };
}
const escape = value => String(value).replace(/[\r\n]+/g, ' ').replace(/([\\`*_{}\[\]()#+.!|>~<])/g,'\\$1');
function markdown(state, day = null) {
  if (day !== null && !validDay(day)) throw Error('请选择有效日期');
  const history = state.history || [];
  const days = day ? [day] : [...new Set(history.map(e=>e.day))].sort().reverse();
  const lines = [day ? `# 四季待办 · ${day}` : '# 四季待办 · 每日记录', '',
    '> 按操作发生时的本地日期归档，保留当时的事项和子任务快照。旧版数据没有历史日期，升级后开始记录。', ''];
  if (!days.length) lines.push('暂无操作记录。', '');
  for (const date of days) {
    const entries = history.filter(e=>e.day===date).sort((a,b)=>a.at.localeCompare(b.at));
    lines.push(`## ${date}`, '', `共 ${entries.length} 条操作记录。`, '');
    if (!entries.length) lines.push('当天没有操作记录。', '');
    for (const e of entries) {
      const t = e.task;
      lines.push(`### ${e.time} · ${labels[e.kind]}`, '', `- [${t.done?'x':' '}] ${escape(t.title)}`,
        `  - 清单：${escape(e.groupName)}`, `  - 四象限：${quadrants[t.quadrant]}`);
      if (t.category === 'issue') lines.push('  - 分类：问题跟踪', `  - 提出人：${escape(t.issue.reporter || '未填写')}`, `  - 跟踪人：${escape(t.issue.tracker || '未填写')}`, `  - 阶段：${escape(t.issue.stage)}`);
      if (t.remindAt) lines.push(`  - 提醒：${escape(t.remindAt)}（ISO 时间）`);
      if (e.childTitle) lines.push(`  - 本次子任务：${escape(e.childTitle)}`);
      for (const c of t.children) lines.push(`  - [${c.done?'x':' '}] ${escape(c.title)}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}
module.exports = { localDay, validDay, labels, recordChanges, markdown };
