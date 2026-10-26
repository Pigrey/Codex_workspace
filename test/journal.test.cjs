const {test}=require('node:test');
const assert=require('node:assert/strict');
const {empty,validate}=require('../src/model.cjs');
const {localDay,validDay,recordChanges,markdown}=require('../src/journal.cjs');
const task=()=>({id:'t',title:'发布 *应用* [离线]',groupId:'inbox',quadrant:2,done:false,remindAt:null,children:[]});
const at=(day)=>new Date(2026,9,day,23,59,0);
function step(s,edit,date=at(26)){const next=structuredClone(s);edit(next);return validate(recordChanges(s,next,date));}
test('兼容旧版备份，不虚构历史；空日报与非法日期',()=>{
 const old={version:1,groups:[{id:'inbox',name:'收件箱'}],tasks:[task()]};
 assert.equal(validate(old),old);
 const s=recordChanges(old,structuredClone(old),at(26));assert.deepEqual(s.history,[]);
 assert.match(markdown(s,'2026-10-26'),/当天没有操作记录/);
 assert.throws(()=>markdown(s,'2026-02-30'));
 assert.equal(validDay('2024-02-29'),true);assert.equal(validDay('2026-02-29'),false);
});
test('事项和子任务新增、完成、恢复、修改、删除均按本地日期归档，旧快照不被改写',()=>{
 let s=step(empty(),n=>n.tasks.push(task()));
 s=step(s,n=>n.tasks[0].children.push({id:'c',title:'检查安装包',done:false}));
 s=step(s,n=>n.tasks[0].children[0].done=true);
 s=step(s,n=>n.tasks[0].done=true);
 s=step(s,n=>n.tasks[0].done=false,at(27));
 s=step(s,n=>n.tasks[0].title='新版标题',at(27));
 s=step(s,n=>n.tasks[0].children[0].done=false,at(27));
 s=step(s,n=>n.tasks[0].children=[],at(27));
 s=step(s,n=>n.tasks=[],at(27));
 assert.deepEqual(s.history.map(e=>e.kind),['task-created','child-created','child-completed','task-completed','task-reopened','task-edited','child-reopened','child-deleted','task-deleted']);
 assert.equal(s.history[0].task.title,'发布 *应用* [离线]');assert.equal(s.history[0].task.children.length,0);
 assert.equal(s.history[3].task.children[0].done,true);
 const day1=markdown(s,'2026-10-26');const day2=markdown(s,'2026-10-27');
 assert.match(day1,/共 4 条操作记录/);assert.match(day1,/发布 \\\*应用\\\* \\\[离线\\\]/);
 assert.match(day1,/- \[x\] 检查安装包/);assert.match(day1,/重要不紧急/);
 assert.doesNotMatch(day1,/新版标题/);assert.match(day2,/删除事项/);assert.match(day2,/新版标题/);
 assert.match(markdown(s),/## 2026-10-27[\s\S]*## 2026-10-26/);
 assert.deepEqual(validate(JSON.parse(JSON.stringify(s))),s);
});
test('提醒状态变化与无操作保存不产生操作记录；忽略渲染端伪造的历史',()=>{
 const s=empty();s.tasks=[task()];
 const n=structuredClone(s);n.tasks[0].notified=true;n.history=[{fake:true}];
 assert.deepEqual(recordChanges(s,n,at(26)).history,[]);
});
test('分组迁移保留当时清单名称；删除事项后仍可导出完整子任务',()=>{
 let s=empty();s.groups.push({id:'work',name:'工作'});
 s=step(s,n=>n.tasks.push({...task(),groupId:'work',children:[{id:'c',title:'检查',done:true}]}));
 s=step(s,n=>{n.tasks[0].groupId='inbox';n.groups=n.groups.filter(g=>g.id!=='work');});
 s=step(s,n=>n.tasks=[]);
 const report=markdown(s,'2026-10-26');assert.match(report,/清单：工作/);assert.match(report,/清单：收件箱/);assert.match(report,/- \[x\] 检查/);
});
test('损坏历史被拒绝，记录日期使用操作发生时本地日期',()=>{
 const s=step(empty(),n=>n.tasks.push(task()));
 assert.equal(s.history[0].day,localDay(at(26)));assert.equal(s.history[0].time,'23:59:00');
 for(const edit of [e=>e.day='2026-02-30',e=>e.time='25:00:00',e=>e.kind='unknown',e=>e.task.title='',e=>e.at='bad']){const n=structuredClone(s);edit(n.history[0]);assert.throws(()=>validate(n));}
 const n=structuredClone(s);n.history.push(structuredClone(n.history[0]));assert.throws(()=>validate(n));
});
test('跨时区午夜使用本地日期而非 UTC 日期',()=>{
 const {execFileSync}=require('node:child_process');
 const script="const {recordChanges}=require('./src/journal.cjs');const p={tasks:[],groups:[{id:'inbox',name:'收件箱'}]};const n={...p,tasks:[{id:'t',groupId:'inbox',children:[]}]};console.log(recordChanges(p,n,new Date('2026-10-26T16:30:00Z')).history[0].day)";
 const day=tz=>execFileSync(process.execPath,['-e',script],{cwd:require('node:path').resolve(__dirname,'..'),env:{...process.env,TZ:tz},encoding:'utf8'}).trim();
 assert.equal(day('Asia/Shanghai'),'2026-10-27');assert.equal(day('America/Los_Angeles'),'2026-10-26');
});
