// UI integration test with an in-memory IPC adapter; native Windows notifications
// and Electron filesystem IPC must additionally be checked on Windows.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{
  const name=req.url.split('?')[0];
  const files={'/':'index.html','/style.css':'style.css','/renderer.js':'renderer.js'};
  if(!files[name]){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',name.endsWith('.css')?'text/css':name.endsWith('.js')?'text/javascript':'text/html');
  res.end(fs.readFileSync(path.resolve(__dirname,'../src',files[name])));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true, ...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 try {
 const page=await browser.newPage({viewport:{width:1220,height:820}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const initial={version:1,groups:[{id:'inbox',name:'收件箱'}],tasks:[]};
  window.todo={load:async()=>JSON.parse(localStorage.getItem('smoke')||JSON.stringify(initial)),save:async s=>{localStorage.setItem('smoke',JSON.stringify(s));return structuredClone(s);},onChange:()=>{},export:async()=>true,import:async()=>null};
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
 await page.locator('.sub-form input').fill('检查安装包');
 await page.locator('.sub-form button').click();
 await page.locator('.child span').filter({hasText:'检查安装包'}).waitFor();
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
 assert.deepEqual(errors,[]);
 console.log('PASS: 分组、任务、子任务、编辑、持久化适配、四象限、搜索、完成、删除与分组迁移；无浏览器异常');
 } finally { await browser.close(); server.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
