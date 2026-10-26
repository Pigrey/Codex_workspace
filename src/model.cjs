const { validDay, labels } = require('./journal.cjs');
const empty = () => ({ version: 1, groups: [{ id: 'inbox', name: '收件箱' }], tasks: [], history: [] });
function validate(s) {
  if (!s || s.version !== 1 || !Array.isArray(s.groups) || !Array.isArray(s.tasks)) throw Error('不支持的备份格式');
  const ids = new Set();
  for (const g of s.groups) {
    if (!g || typeof g.id !== 'string' || !g.id || ids.has(g.id) || typeof g.name !== 'string' || !g.name.trim()) throw Error('分组数据无效');
    ids.add(g.id);
  }
  if (!ids.has('inbox')) throw Error('缺少收件箱');
  const tasks = new Set();
  for (const t of s.tasks) {
    if (!t || typeof t.id !== 'string' || !t.id || tasks.has(t.id) || typeof t.title !== 'string' || !t.title.trim() || !ids.has(t.groupId) || ![1,2,3,4].includes(t.quadrant) || typeof t.done !== 'boolean' || !Array.isArray(t.children)) throw Error('任务数据无效');
    tasks.add(t.id);
    if (t.remindAt !== null && (typeof t.remindAt !== 'string' || !Number.isFinite(Date.parse(t.remindAt)))) throw Error('提醒时间无效');
    if (t.notified !== undefined && typeof t.notified !== 'boolean') throw Error('提醒状态无效');
    const children = new Set();
    for (const c of t.children) {
      if (!c || typeof c.id !== 'string' || children.has(c.id) || typeof c.title !== 'string' || !c.title.trim() || typeof c.done !== 'boolean') throw Error('子任务数据无效');
      children.add(c.id);
    }
  }
  if (s.history !== undefined) {
    if (!Array.isArray(s.history)) throw Error('每日记录无效');
    const events = new Set();
    for (const e of s.history) {
      if (!e || typeof e.id !== 'string' || !e.id || events.has(e.id) || typeof e.at !== 'string' || !Number.isFinite(Date.parse(e.at)) || !validDay(e.day) || typeof e.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(e.time) || !Object.hasOwn(labels,e.kind) || typeof e.groupName !== 'string' || !e.groupName.trim() || (e.childTitle !== undefined && typeof e.childTitle !== 'string')) throw Error('每日记录条目无效');
      events.add(e.id);
      if (!e.task || typeof e.task.groupId !== 'string') throw Error('每日记录事项无效');
      validate({ version: 1, groups: [{id:'inbox',name:'收件箱'}, ...(e.task.groupId==='inbox'?[]:[{id:e.task.groupId,name:e.groupName}])], tasks: [e.task] });
    }
  }
  return s;
}
function due(s, now = Date.now()) { return s.tasks.filter(t => !t.done && !t.notified && t.remindAt && Date.parse(t.remindAt) <= now); }
module.exports = { empty, validate, due };
