const {test}=require('node:test');
const assert=require('node:assert/strict');
const {empty,validate,due}=require('../src/model.cjs');
function task(extra={}) {return {id:'t1',title:'提交报告',groupId:'inbox',quadrant:1,done:false,remindAt:'2026-01-01T08:00:00Z',notified:false,children:[{id:'c1',title:'核对数据',done:false}],...extra};}
test('初始状态可通过备份校验',()=>assert.equal(validate(empty()).groups[0].id,'inbox'));
test('完整任务、四象限与子任务能够无损序列化',()=>{for(let q=1;q<=4;q++){const s=empty();s.tasks.push(task({quadrant:q}));assert.deepEqual(validate(JSON.parse(JSON.stringify(s))),s);}});
test('拒绝损坏的备份，避免覆盖本地数据',()=>{for(const bad of [{version:2}, {...empty(),groups:[]}, {...empty(),tasks:[task({groupId:'missing'})]}, {...empty(),tasks:[task({remindAt:'bad'})]}, {...empty(),tasks:[task({quadrant:5})]}, {...empty(),tasks:[task(),task()]}, {...empty(),tasks:[task({children:[{id:'x',title:'',done:false}]})]}])assert.throws(()=>validate(bad));});
test('到期提醒只选择未完成、未提醒且到期的任务，包含休眠错过的提醒',()=>{const s=empty();s.tasks=[task(),task({id:'done',done:true}),task({id:'sent',notified:true}),task({id:'future',remindAt:'2028-01-01T00:00:00Z'}),task({id:'none',remindAt:null})];assert.deepEqual(due(s,Date.parse('2026-10-26T00:00:00Z')).map(t=>t.id),['t1']);});
