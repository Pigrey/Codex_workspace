const empty = () => ({ version: 1, groups: [{ id: 'inbox', name: '收件箱' }], tasks: [] });
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
  return s;
}
function due(s, now = Date.now()) { return s.tasks.filter(t => !t.done && !t.notified && t.remindAt && Date.parse(t.remindAt) <= now); }
module.exports = { empty, validate, due };
