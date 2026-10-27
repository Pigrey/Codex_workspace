// UI integration test with an in-memory IPC adapter; native Windows notifications
// and Electron filesystem IPC must additionally be checked on Windows.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {recordChanges,markdown,localDay}=require('../src/journal.cjs');
const {validate}=require('../src/model.cjs');
(async()=>{
 const server=http.createServer((req,res)=>{
  const name=req.url.split('?')[0];
  const files={'/':'index.html','/style.css':'style.css','/renderer.js':'renderer.js','/planner.js':'planner.js'};
  if(!files[name]){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',name.endsWith('.css')?'text/css':name.endsWith('.js')?'text/javascript':'text/html');
  res.end(fs.readFileSync(path.resolve(__dirname,'../src',files[name])));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try {
 browser=await chromium.launch({headless:true, ...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1220,height:820}});
 page.setDefaultTimeout(15000);
 await page.exposeFunction('recordSave',(previous,next)=>validate(recordChanges(previous,next)));
 await page.exposeFunction('makeJournal',(state,day)=>markdown(state,day));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const initial={version:1,groups:[{id:'inbox',name:'收件箱'}],tasks:[]};
  window.todo={load:async()=>JSON.parse(localStorage.getItem('smoke')||JSON.stringify(initial)),save:async s=>{const next=await window.recordSave(JSON.parse(localStorage.getItem('smoke')||JSON.stringify(initial)),s);localStorage.setItem('smoke',JSON.stringify(next));return next;},journal:async day=>window.makeJournal(JSON.parse(localStorage.getItem('smoke')||JSON.stringify(initial)),day),exportMarkdown:async day=>{localStorage.setItem('markdown-export',await window.makeJournal(JSON.parse(localStorage.getItem('smoke')||JSON.stringify(initial)),day));return true;},onChange:()=>{},export:async()=>true,import:async()=>null};
 });
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.getByText('一张清爽的清单').waitFor();
 await page.locator('#add-group').click();
 await page.locator('#group-name').fill('工作');
 await page.locator('#group-form .primary').click();
 await page.locator('#groups').getByRole('button',{name:'○　工作',exact:true}).waitFor();
 await page.locator('#groups').getByRole('button',{name:'○　工作',exact:true}).click();
 await page.locator('#title').fill('准备离线发布');
 await page.locator('#quadrant').selectOption('1');
 await page.locator('#reminder').fill('2030-12-01T10:30');
 await page.locator('#add-task button[type=submit]').click();
 await page.locator('.task-title').filter({hasText:'准备离线发布'}).waitFor();
 assert.equal(await page.locator('.sub-form').count(),0);
 const button=await page.locator('.add-child[title="添加子任务"]').boundingBox();
 const group=await page.locator('.meta > span').nth(1).boundingBox();
 assert.ok(Math.abs(button.y-group.y)<8,'子任务按钮应和清单标签同行');
 await page.locator('.add-child[title="添加子任务"]').click();
 await page.locator('.sub-form input').fill('检查安装包');
 await page.locator('.sub-form button').click();
 await page.locator('.child span').filter({hasText:'检查安装包'}).waitFor();
 assert.equal(await page.locator('.sub-form').count(),0);
 await page.locator('.child input').check();
 await page.locator('.child.completed').waitFor();
 await page.locator('.actions').getByText('编辑',{exact:true}).click();
 await page.locator('#edit-title').fill('离线发布已准备');
 await page.locator('#edit-quadrant').selectOption('2');
 await page.locator('#edit-form .primary').click();
 await page.locator('.task-title').filter({hasText:'离线发布已准备'}).waitFor();
 await page.reload();
 await page.locator('.task-title').filter({hasText:'离线发布已准备'}).waitFor();
 assert.equal(await page.locator('.child.completed').count(),1);
 await page.locator('[data-view=matrix]').click();
 assert.equal(await page.locator('.quadrant-panel').nth(1).locator('.task').count(),1);
 await page.locator('#search').fill('没有这个任务');
 assert.equal(await page.locator('.task').count(),0);
 await page.locator('#search').fill('检查安装包');
 assert.equal(await page.locator('.task').count(),1);
 await page.locator('#search').fill('');
 if(process.env.SCREENSHOT_PATH)await page.screenshot({path:process.env.SCREENSHOT_PATH,fullPage:true});
 await page.locator('[data-view=all]').click();
 await page.locator('.plan-add').click();
 await page.locator('[data-view=plan]').click();
 for(const title of ['第二项','第三项']){
  await page.locator('#title').fill(title);
  await page.locator('#add-task button[type=submit]').click();
  await page.locator('.task-title').filter({hasText:title}).waitFor();
 }
 assert.deepEqual(await page.locator('.task-title').allTextContents(),['离线发布已准备','第二项','第三项']);
 await page.getByRole('button',{name:'上移 第三项',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.task-title')[1]?.textContent==='第三项');
 await page.reload();
 await page.locator('[data-view=plan]').click();
 assert.deepEqual(await page.locator('.task-title').allTextContents(),['离线发布已准备','第三项','第二项']);
 await page.getByRole('button',{name:'下移 离线发布已准备',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.task-title')?.textContent==='第三项');
 assert.equal(await page.getByRole('button',{name:'上移 第三项',exact:true}).isDisabled(),true);
 await page.locator('#search').fill('第二项');
 assert.equal(await page.locator('.plan-order').count(),0);
 await page.locator('#search').fill('');
 await page.locator('.task-head > input').first().click();
 await page.locator('.plan-finished').waitFor();
 assert.equal(await page.locator('.task-title').first().innerText(),'离线发布已准备');
 const completed=page.locator('.task.done');await completed.locator('.task-head > input').click();
 await page.waitForFunction(()=>document.querySelector('.task-title')?.textContent==='第三项');
 if(process.env.PLAN_SCREENSHOT_PATH)await page.screenshot({path:process.env.PLAN_SCREENSHOT_PATH});
 for(const title of ['第三项','第二项']){
  const card=page.locator('.task').filter({has:page.locator('.task-title',{hasText:title})});
  await card.locator('.plan-remove').click();
  await page.waitForFunction(title=>![...document.querySelectorAll('.task-title')].some(n=>n.textContent===title),title);
 }
 await page.locator('[data-view=all]').click();
 for(const title of ['第三项','第二项']){
  const card=page.locator('.task').filter({has:page.locator('.task-title',{hasText:title})});
  page.once('dialog',d=>d.accept());await card.locator('.actions').getByText('删除',{exact:true}).click();
  await page.waitForFunction(title=>![...document.querySelectorAll('.task-title')].some(n=>n.textContent===title),title);
 }
 await page.locator('.task-head > input').click();
 await page.locator('[data-view=done]').click();
 await page.locator('.task.done').waitFor();
 await page.locator('.task-head > input').click();
 await page.locator('[data-view=all]').click();
 await page.locator('.task').waitFor();
 page.once('dialog',d=>d.accept());
 await page.locator('.group-row .remove').click();
 await page.waitForFunction(()=>document.querySelectorAll('.group-row').length===1);
 assert.match(await page.locator('.meta').innerText(),/收件箱/);
 page.once('dialog',d=>d.accept());
 await page.locator('.actions').getByText('删除',{exact:true}).click();
 await page.getByText('一张清爽的清单').waitFor();
 await page.locator('[data-view=journal]').click();
 await page.locator('.journal-preview').filter({hasText:'删除事项'}).waitFor();
 assert.match(await page.locator('.journal-preview').innerText(),/检查安装包/);
 await page.locator('#export-day').click();
 await page.waitForFunction(()=>!!localStorage.getItem('markdown-export'));
 const exported=await page.evaluate(()=>localStorage.getItem('markdown-export'));
 assert.match(exported,/完成事项/);assert.match(exported,/完成子任务/);assert.match(exported,/恢复事项/);
 assert.match(exported,/离线发布已准备/);
 await page.locator('#journal-day').fill('2000-01-01');
 await page.locator('.journal-preview').filter({hasText:'当天没有操作记录'}).waitFor();
 await page.locator('#export-history').click();
 await page.waitForFunction(()=>localStorage.getItem('markdown-export')?.startsWith('# 四季待办 · 每日记录'));
 await page.reload();
 await page.locator('[data-view=journal]').click();
 await page.locator('.journal-preview').filter({hasText:'删除事项'}).waitFor();
 if(process.env.SCREENSHOT_PATH)await page.screenshot({path:process.env.SCREENSHOT_PATH,fullPage:true});
 await page.locator('[data-view=issues]').click();
 assert.equal(await page.locator('#category').inputValue(),'issue');
 await page.locator('#title').fill('训练精度异常');
 await page.locator('#reporter').fill('张三');
 await page.locator('#tracker').fill('李四');
 assert.equal(await page.locator('#stage').inputValue(),'分析中');
 assert.deepEqual(await page.locator('#stage option').allTextContents(),['分析中','等待回复','训练中','回归中']);
 await page.locator('#add-task button[type=submit]').click();
 await page.locator('.task-title').filter({hasText:'训练精度异常'}).waitFor();
 assert.match(await page.locator('.meta').innerText(),/提出人：张三/);
 for(const stage of ['等待回复','训练中','回归中']){
  await page.locator('.actions').getByText('编辑',{exact:true}).click();
  await page.locator('#edit-stage').selectOption(stage);
  await page.locator('#edit-form .primary').click();
  await page.locator('.issue-stage').filter({hasText:stage}).waitFor();
 }
 await page.reload();
 await page.locator('[data-view=issues]').click();
 await page.locator('.issue-stage').filter({hasText:'回归中'}).waitFor();
 await page.locator('#issue-filter').selectOption('分析中');
 assert.equal(await page.locator('.task').count(),0);
 await page.locator('#issue-filter').selectOption('回归中');
 assert.equal(await page.locator('.task').count(),1);
 for(const name of ['张三','李四']){await page.locator('#search').fill(name);assert.equal(await page.locator('.task').count(),1);}
 await page.locator('#search').fill('不存在的跟踪人');assert.equal(await page.locator('.task').count(),0);
 await page.locator('#search').fill('');
 if(process.env.ISSUE_SCREENSHOT_PATH)await page.screenshot({path:process.env.ISSUE_SCREENSHOT_PATH});
 await page.locator('[data-view=journal]').click();
 await page.locator('.journal-preview').filter({hasText:'阶段：回归中'}).waitFor();
 await page.locator('#export-day').click();
 await page.waitForFunction(()=>localStorage.getItem('markdown-export')?.includes('阶段：回归中'));
 const issueMarkdown=await page.evaluate(()=>localStorage.getItem('markdown-export'));
 for(const text of ['提出人：张三','跟踪人：李四','阶段：分析中','阶段：等待回复','阶段：训练中','阶段：回归中'])assert.ok(issueMarkdown.includes(text));
 await page.locator('[data-view=all]').click();
 await page.locator('.actions').getByText('编辑',{exact:true}).click();
 await page.locator('#edit-category').selectOption('task');
 await page.locator('#edit-form .primary').click();
 await page.waitForFunction(()=>document.querySelectorAll('.issue-stage').length===0);
 await page.locator('[data-view=issues]').click();
 assert.equal(await page.locator('.task').count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: 分组、任务、子任务、编辑、持久化适配、四象限、搜索、完成、删除与分组迁移、子任务按钮同行与收起、每日记录、删除后历史保留、按日/全部 Markdown 导出、今日计划排序/刷新恢复/完成恢复/移出与搜索、问题分类/阶段编辑筛选/人员搜索/日报字段导出；无浏览器异常');
 } finally { try { await browser?.close(); } finally { server.close(); } }
})().catch(e=>{console.error(e);process.exitCode=1;});
