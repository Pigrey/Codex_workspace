const {test}=require('node:test');
const assert=require('node:assert/strict');
const planner=require('../src/planner.js');
const {empty,validate}=require('../src/model.cjs');
const {recordChanges}=require('../src/journal.cjs');
const day='2026-10-27';
function fixture(){const s=empty();s.tasks=['a','b','c'].map(id=>({id,title:id,groupId:'inbox',quadrant:2,done:false,remindAt:null,children:[]}));return s;}
test('旧备份可用，计划支持添加去重和独立的每日顺序',()=>{const s=fixture();delete s.plans;validate(s);for(const id of ['a','b','c','a','missing'])planner.add(s,day,id);planner.add(s,'2026-10-28','c');assert.deepEqual(s.plans[day],['a','b','c']);planner.move(s,day,'c',-1);assert.deepEqual(planner.tasks(s,day).map(t=>t.id),['a','c','b']);assert.deepEqual(s.plans['2026-10-28'],['c']);assert.deepEqual(s.tasks.map(t=>t.id),['a','b','c']);assert.deepEqual(validate(JSON.parse(JSON.stringify(s))),s);});
test('上移下移边界、完成后跳过及恢复顺序',()=>{const s=fixture();s.plans[day]=['a','b','c'];planner.move(s,day,'a',-1);planner.move(s,day,'c',1);assert.deepEqual(s.plans[day],['a','b','c']);s.tasks[1].done=true;planner.move(s,day,'c',-1);assert.deepEqual(planner.tasks(s,day).map(t=>t.id),['c','a']);assert.deepEqual(planner.tasks(s,day,true).map(t=>t.id),['b']);s.tasks[1].done=false;assert.deepEqual(planner.tasks(s,day).map(t=>t.id),['c','b','a']);});
test('移出计划不删除任务；删除任务清理所有日期的引用',()=>{const s=fixture();s.plans[day]=['a','b'];s.plans['2026-10-28']=['a'];planner.remove(s,day,'b');assert.equal(s.tasks.length,3);s.tasks=s.tasks.filter(t=>t.id!=='a');planner.prune(s);assert.deepEqual(s.plans,{[day]:[],'2026-10-28':[]});validate(s);});
test('拒绝无效排序数据，排序不伪造每日工作记录',()=>{for(const plans of [null,[],{'2026-02-30':['a']},{[day]:['a','a']},{[day]:['missing']},{[day]:'a'}])assert.throws(()=>validate({...fixture(),plans}));const s=fixture(),next=structuredClone(s);planner.add(next,day,'a');assert.deepEqual(recordChanges(s,next).history,[]);});
