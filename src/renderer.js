const $ = s => document.querySelector(s);
const names = ['','重要且紧急','重要不紧急','紧急不重要','不重要不紧急'];
let state, view = 'all', editId, journalRequest = 0;
const expandedSubtasks = new Set();
const el = (tag, cls, text) => { const n = document.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=text; return n; };
const uid = () => crypto.randomUUID();
function message(s) { $('#status').textContent=s; }
async function change(fn) {
  const previous = structuredClone(state);
  try { fn(); state = await window.todo.save(state); render(); message(''); }
  catch(e) { state=previous; render(); message('保存失败：'+e.message); }
}
function options(select, value) { select.replaceChildren(...state.groups.map(g => { const o=el('option','',g.name); o.value=g.id; return o; })); if(state.groups.some(g=>g.id===value))select.value=value; }
function render() {
  const journal = view === 'journal';
  $('.composer').hidden = journal;
  $('#search').hidden = journal;
  $('#journal-controls').hidden = !journal;
  $('#issue-controls').hidden = view !== 'issues';
  updateIssueFields();
  const selected=$('#group').value;
  options($('#group'),view.startsWith('group:')?view.slice(6):selected);
  $('#total').textContent=state.tasks.filter(t=>!t.done).length;
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  $('#groups').replaceChildren(...state.groups.map(g=>{
    const row=el('div','group-row'+(view==='group:'+g.id?' active':''));
    const b=el('button','','○　'+g.name); b.onclick=()=>{view='group:'+g.id;render();};row.append(b);
    if(g.id!=='inbox') { const d=el('button','remove','×');d.title='删除清单（任务移至收件箱）';d.onclick=()=>{if(confirm('删除“'+g.name+'”？其中任务将移至收件箱。'))change(()=>{state.tasks.forEach(t=>{if(t.groupId===g.id)t.groupId='inbox';});state.groups=state.groups.filter(x=>x.id!==g.id);if(view==='group:'+g.id)view='all';});};row.append(d); }return row;
  }));
  $('#heading').textContent=({all:'全部待办',plan:'今日计划',today:'今日提醒',matrix:'四象限',done:'已完成',issues:'问题跟踪',journal:'每日记录'})[view] || state.groups.find(g=>'group:'+g.id===view)?.name || '全部待办';
  if (journal) { renderJournal(); return; }
  const query=$('#search').value.trim().toLocaleLowerCase();
  const today=new Date().toLocaleDateString();
  const source = view==='plan' ? planner.tasks(state,planner.day()) : state.tasks;
  const filtered=source.filter(t=>{
    if(view==='done'?!t.done:t.done)return false;
    if(view==='issues' && (t.category!=='issue' || ($('#issue-filter').value && t.issue.stage!==$('#issue-filter').value)))return false;
    if(view.startsWith('group:')&&t.groupId!==view.slice(6))return false;
    if(view==='today'&&(!t.remindAt||new Date(t.remindAt).toLocaleDateString()!==today))return false;
    return !query||[t.title,...t.children.map(c=>c.title),...(t.category==='issue'?[t.issue.reporter,t.issue.tracker,t.issue.stage]:[])].some(s=>s.toLocaleLowerCase().includes(query));
  });
  $('#summary').textContent=`${filtered.length} 项${view==='done'?'已完成':'待办'} · 今天也可以从一件小事开始`;
  const root=$('#tasks');root.replaceChildren();
  if(view==='plan'){
    $('#summary').textContent=`${planner.day()} · 按从上到下的顺序逐项处理`;
    root.append(el('p','plan-help',query?'搜索时暂不调整顺序，清空搜索后可排序。':'从其他清单点击「加入今日」，或在此添加任务。用 ↑ ↓ 安排先后，第一项就是接下来要做的事。'));
  }
  if(view==='matrix') { const grid=el('div','matrix');for(let q=1;q<=4;q++){const p=el('section','quadrant-panel');p.append(el('h2','',names[q]));const items=filtered.filter(t=>t.quadrant===q);items.forEach(t=>p.append(card(t)));if(!items.length)p.append(el('div','empty','暂无任务'));grid.append(p);}root.append(grid); }
  else if(!filtered.length){const n=el('div','empty');n.append(el('strong','','一张清爽的清单'),el('span','',query?'没有找到匹配的任务':'添加一件待办，开始今天的节奏。'));root.append(n);}
  else filtered.forEach(t=>root.append(card(t)));
  if(view==='plan' && !query){const completed=planner.tasks(state,planner.day(),true);if(completed.length){root.append(el('h2','plan-finished','已完成 · '+completed.length));completed.forEach(t=>root.append(card(t)));}}
}
function card(t) {
  const box=el('article','task'+(t.done?' done':''));const head=el('div','task-head');
  const check=el('input','check');check.type='checkbox';check.checked=t.done;check.setAttribute('aria-label','完成 '+t.title);check.onchange=()=>change(()=>{t.done=check.checked;});
  const body=el('div','task-content');body.append(el('div','task-title',t.title));const meta=el('div','meta');
  meta.append(el('span','tag q'+t.quadrant,names[t.quadrant]),el('span','',state.groups.find(g=>g.id===t.groupId)?.name));
  if(!t.done){const addChild=el('button','add-child','＋ 子任务');addChild.title='添加子任务';addChild.setAttribute('aria-expanded',String(expandedSubtasks.has(t.id)));addChild.onclick=()=>{if(expandedSubtasks.has(t.id))expandedSubtasks.delete(t.id);else expandedSubtasks.add(t.id);render();if(expandedSubtasks.has(t.id))document.getElementById('sub-'+t.id)?.focus();};meta.append(addChild);}
  if(t.category==='issue'){meta.append(el('span','tag issue-stage',t.issue.stage),el('span','issue-person','提出人：'+(t.issue.reporter||'未填写')),el('span','issue-person','跟踪人：'+(t.issue.tracker||'未填写')));}
  if(t.remindAt)meta.append(el('span','', '◷ '+new Date(t.remindAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})+(t.notified?' · 已提醒':'')));
  if(t.children.length)meta.append(el('span','',`${t.children.filter(c=>c.done).length}/${t.children.length} 子任务`));body.append(meta);
  if(!t.done && view!=='plan'){
    const included=state.plans?.[planner.day()]?.includes(t.id);
    const plan=el('button','add-child plan-add',included?'已加入今日':'＋ 加入今日');plan.disabled=!!included;
    plan.onclick=()=>change(()=>planner.add(state,planner.day(),t.id));meta.append(plan);
  }
  if(view==='plan'){
    const active=planner.tasks(state,planner.day());const index=active.findIndex(x=>x.id===t.id);
    box.classList.add('planned');if(!t.done){const rank=el('span','plan-rank',String(index+1));head.append(rank);if(index===0){box.classList.add('plan-next');meta.prepend(el('span','tag q2','接下来做'));}}
    if(!t.done && !$('#search').value.trim()){
      const controls=el('div','plan-order');
      for(const [label,direction] of [['↑',-1],['↓',1]]){const b=el('button','',label);b.setAttribute('aria-label',(direction===-1?'上移 ':'下移 ')+t.title);b.disabled=direction===-1?index===0:index===active.length-1;b.onclick=()=>change(()=>planner.move(state,planner.day(),t.id,direction));controls.append(b);}body.append(controls);
    }
    const remove=el('button','add-child plan-remove','移出今日');remove.onclick=()=>change(()=>planner.remove(state,planner.day(),t.id));meta.append(remove);
  }
  const actions=el('div','actions');const edit=el('button','','编辑');edit.onclick=()=>openEdit(t);const del=el('button','','删除');del.onclick=()=>{if(confirm('删除任务“'+t.title+'”及其子任务？'))change(()=>{state.tasks=state.tasks.filter(x=>x.id!==t.id);planner.prune(state);});};actions.append(edit,del);head.append(check,body,actions);box.append(head);
  const children=el('div','children');t.children.forEach(c=>{const row=el('div','child'+(c.done?' completed':''));const cb=el('input');cb.type='checkbox';cb.checked=c.done;cb.setAttribute('aria-label','完成子任务 '+c.title);cb.onchange=()=>change(()=>{c.done=cb.checked;});const d=el('button','','×');d.setAttribute('aria-label','删除子任务 '+c.title);d.onclick=()=>change(()=>{t.children=t.children.filter(x=>x.id!==c.id);});row.append(cb,el('span','',c.title),d);children.append(row);});
  if(!t.done && expandedSubtasks.has(t.id)){const form=el('form','sub-form');const input=el('input');input.id='sub-'+t.id;input.placeholder='输入子任务名称';input.setAttribute('aria-label','子任务名称');input.maxLength=200;input.required=true;const add=el('button','','添加');form.append(input,add);form.onsubmit=e=>{e.preventDefault();const title=input.value.trim();if(title)change(()=>{t.children.push({id:uid(),title,done:false});expandedSubtasks.delete(t.id);});};children.append(form);}if(children.childNodes.length)box.append(children);return box;
}
function localDate(iso){if(!iso)return '';const d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
function openEdit(t){editId=t.id;$('#edit-title').value=t.title;options($('#edit-group'),t.groupId);$('#edit-quadrant').value=t.quadrant;$('#edit-reminder').value=localDate(t.remindAt);$('#edit-category').value=t.category||'task';$('#edit-reporter').value=t.issue?.reporter||'';$('#edit-tracker').value=t.issue?.tracker||'';$('#edit-stage').value=t.issue?.stage||'分析中';updateIssueFields();$('#edit-dialog').showModal();}
$('#edit-form').onsubmit=e=>{e.preventDefault();const title=$('#edit-title').value.trim();if(!title)return;change(()=>{const t=state.tasks.find(x=>x.id===editId);const reminder=$('#edit-reminder').value?new Date($('#edit-reminder').value).toISOString():null;if(t.remindAt!==reminder)t.notified=false;t.category=$('#edit-category').value;if(t.category==='issue'||t.issue)t.issue=readIssue('edit-');Object.assign(t,{title,groupId:$('#edit-group').value,quadrant:Number($('#edit-quadrant').value),remindAt:reminder});});$('#edit-dialog').close();};
$('#cancel-edit').onclick=()=>$('#edit-dialog').close();
$('#add-task').onsubmit=e=>{e.preventDefault();const title=$('#title').value.trim();if(!title)return;change(()=>{const taskId=uid();const category=$('#category').value;state.tasks.unshift({id:taskId,title,category,...(category==='issue'?{issue:readIssue('')} : {}),groupId:$('#group').value,quadrant:Number($('#quadrant').value),remindAt:$('#reminder').value?new Date($('#reminder').value).toISOString():null,notified:false,done:false,children:[]});if(view==='plan')planner.add(state,planner.day(),taskId);});$('#title').value='';$('#reminder').value='';$('#reporter').value='';$('#tracker').value='';$('#stage').value='分析中';};
$('#add-group').onclick=()=>{$('#group-name').value='';$('#group-dialog').showModal();};
$('#cancel-group').onclick=()=>$('#group-dialog').close();
$('#group-form').onsubmit=e=>{e.preventDefault();const name=$('#group-name').value.trim();if(!name)return;change(()=>state.groups.push({id:uid(),name}));$('#group-dialog').close();};
$('[data-view="all"]').parentElement.querySelectorAll('button').forEach(b=>b.onclick=()=>{view=b.dataset.view;if(view==='issues')$('#category').value='issue';else $('#category').value='task';render();});
$('#search').oninput=()=>render();
$('#export').onclick=async()=>{try{if(await window.todo.export())message('备份已导出');}catch(e){message('导出失败：'+e.message);}};
$('#import').onclick=async()=>{try{const s=await window.todo.import();if(s){state=s;view='all';render();message('备份已导入');}}catch(e){message('导入失败：'+e.message);}};
$('#date').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
window.todo.onChange(s=>{state=s;render();});
window.todo.load().then(s=>{state=s;render();}).catch(e=>message('读取失败：'+e.message));

async function renderJournal() {
  const request = ++journalRequest;
  const day = $('#journal-day').value;
  $('#summary').textContent = `${day} · 每天做过的事，都留有记录`;
  const root = $('#tasks');
  root.replaceChildren(el('div','empty','正在读取每日记录…'));
  try {
    const content = await window.todo.journal(day);
    if (view !== 'journal' || request !== journalRequest) return;
    root.replaceChildren(el('pre','journal-preview',content));
  } catch(e) {
    if(view === 'journal' && request === journalRequest)root.replaceChildren(el('div','empty','读取失败：'+e.message));
  }
}
$('#journal-day').value = localDate(new Date().toISOString()).slice(0,10);
$('#journal-day').onchange=()=>{if($('#journal-day').value)renderJournal();};
$('#journal-today').onclick=()=>{$('#journal-day').value=localDate(new Date().toISOString()).slice(0,10);renderJournal();};
async function exportJournal(day) {
  try { if(await window.todo.exportMarkdown(day))message('Markdown 已导出'); }
  catch(e) { message('导出失败：'+e.message); }
}
$('#export-day').onclick=()=>exportJournal($('#journal-day').value);
$('#export-history').onclick=()=>exportJournal(null);

let visibleDay=planner.day();
function refreshDay(){const day=planner.day();if(day!==visibleDay){visibleDay=day;$('#date').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});if(state)render();}}
setInterval(refreshDay,30000);window.addEventListener('focus',refreshDay);

function updateIssueFields(){
  $('#issue-fields').hidden=$('#category').value!=='issue';
  $('#edit-issue-fields').hidden=$('#edit-category').value!=='issue';
}
function readIssue(prefix){return {reporter:$('#'+prefix+'reporter').value.trim(),tracker:$('#'+prefix+'tracker').value.trim(),stage:$('#'+prefix+'stage').value};}
$('#category').onchange=updateIssueFields;
$('#edit-category').onchange=updateIssueFields;
$('#issue-filter').onchange=()=>render();
