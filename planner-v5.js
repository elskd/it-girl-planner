(function(){
'use strict';
var S={q:'',list:'all',status:'open',priority:'all',date:'today',custom:'',sort:'time'};
function e(v){return typeof esc==='function'?esc(v):String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]})}
function D(s){return typeof parseDate==='function'?parseDate(s):new Date(s+'T00:00:00')}
function I(d){return typeof isoDate==='function'?isoDate(d):new Date(d).toISOString().slice(0,10)}
function A(d,n){return typeof addDays==='function'?addDays(d,n):new Date(d.getTime()+n*86400000)}
function chosen(){if(S.date==='today')return todayISO();if(S.date==='tomorrow')return I(A(D(todayISO()),1));if(S.date==='custom')return S.custom;return null}
function label(a){return a==='all'?'Все задачи':((AREA_LABEL&&AREA_LABEL[a])||a)}
function activeTasks(){return (state.tasks||[]).filter(function(t){return typeof taskIsActive!=='function'||taskIsActive(t)})}
function rows(){
 var a=activeTasks(),q=S.q.toLowerCase().trim(),ds=chosen();
 if(S.list!=='all')a=a.filter(function(t){return t.area===S.list});
 if(S.status==='open')a=a.filter(function(t){return !t.done});
 if(S.status==='done')a=a.filter(function(t){return t.done});
 if(S.priority!=='all')a=a.filter(function(t){return (t.priority||'none')===S.priority});
 if(ds)a=a.filter(function(t){return t.date===ds||(t.repeat==='daily'&&t.date<=ds)});
 if(q)a=a.filter(function(t){return (t.title+' '+(t.notes||'')+' '+(t.area||'')).toLowerCase().indexOf(q)>=0});
 var rank={high:0,medium:1,low:2,'':3,none:3};
 a.sort(function(x,y){
   if(S.sort==='priority')return (rank[x.priority||'none']||3)-(rank[y.priority||'none']||3)||tm(x)-tm(y);
   if(S.sort==='new')return Number(y.id)-Number(x.id);
   if(x.done!==y.done)return x.done?1:-1;
   return tm(x)-tm(y);
 });
 return a;
}
function tm(t){if(t.allDay||t.noTime)return 99999;if(!t.start)return 99998;var p=t.start.split(':');return Number(p[0])*60+Number(p[1]||0)}
function addQuick(){
 var x=document.getElementById('pv5quick'),raw=(x&&x.value||'').trim();if(!raw)return;
 var title=raw,date=chosen()||todayISO(),start='',end='',priority='';
 var m=title.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?:\s*[-–]\s*([01]?\d|2[0-3]):([0-5]\d))?\b/);
 if(m){start=m[1].padStart(2,'0')+':'+m[2];end=m[3]?m[3].padStart(2,'0')+':'+m[4]:'';title=title.replace(m[0],'').trim()}
 if(/\bзавтра\b/i.test(title)){date=I(A(D(todayISO()),1));title=title.replace(/\bзавтра\b/i,'').trim()}
 if(/\bсегодня\b/i.test(title)){date=todayISO();title=title.replace(/\bсегодня\b/i,'').trim()}
 var p=title.match(/!(high|medium|low)\b/i);if(p){priority=p[1].toLowerCase();title=title.replace(p[0],'').trim()}
 var area=S.list==='all'?'':S.list;if(!title){toast('Напиши название задачи');return}
 state.tasks.push({id:Date.now()+Math.floor(Math.random()*999),done:false,status:'active',overrides:{},title:title,area:area,priority:priority,date:date,repeat:'none',repeatDays:[],start:start,end:end,allDay:false,noTime:!start,color:state.settings.taskColor,notes:'',subtasks:[],pinned:false,labels:[],reminder:'',attachments:[]});
 persist();S.date='custom';S.custom=date;render();toast('Задача добавлена');
}
function row(t){
 var meta='';
 if(t.noTime)meta='Без времени';else if(t.allDay)meta='Весь день';else if(t.start)meta=t.start+(t.end?' – '+t.end:'');
 if(t.repeat&&t.repeat!=='none')meta+=(meta?' · ':'')+(t.repeat==='daily'?'каждый день':'повторяется');
 var sub=Array.isArray(t.subtasks)?t.subtasks:[],sd=sub.filter(function(x){return x.done}).length;if(sub.length)meta+=(meta?' · ':'')+sd+'/'+sub.length;
 var col=typeof taskListColor==='function'?taskListColor(t.area):'var(--accent)';
 return '<div class="pv5-row '+(t.done?'done':'')+'" onclick="openTaskDetail('+t.id+')"><button class="pv5-check '+(t.done?'done':'p-'+(t.priority||'none'))+'" onclick="event.stopPropagation();toggleTask('+t.id+')"></button><div class="pv5-main"><div class="pv5-title">'+e(t.title)+'</div><div class="pv5-meta">'+e(meta)+(t.area?'<i style="background:'+col+'"></i>'+e(label(t.area)):'')+'</div></div><span class="pv5-more">···</span></div>';
}
function render(){
 var page=document.getElementById('page');if(!page)return;currentPage='planner';if(typeof setActivePage==='function')setActivePage('planner');
 var a=rows(),lists=Array.isArray(AREAS)?AREAS:[],open=activeTasks().filter(function(t){return !t.done}).length;
 var html='<header class="page-head"><div class="eyebrow">Организация</div><h1 class="title">Планер</h1><div class="date">Задачи без лишних экранов: быстро добавить, найти и довести до конца.</div></header>';
 html+='<div class="pv5-layout"><aside class="pv5-sidebar"><button class="pv5-add" onclick="document.getElementById(\'pv5quick\').focus()">＋ Добавить задачу</button><div class="pv5-label">СПИСКИ</div>';
 html+='<button class="pv5-list '+(S.list==='all'?'active':'')+'" onclick="pv5List(\'all\')"><i></i><span>Все задачи</span><b>'+open+'</b></button>';
 lists.forEach(function(v){var n=activeTasks().filter(function(t){return t.area===v&&!t.done}).length;html+='<button class="pv5-list '+(S.list===v?'active':'')+'" onclick="pv5List('+JSON.stringify(v)+')"><i style="background:'+(typeof taskListColor==='function'?taskListColor(v):'var(--accent)')+'"></i><span>'+e(label(v))+'</span><b>'+ (n||'')+'</b></button>'});
 html+='<div class="pv5-label">ДАТА</div><button class="pv5-date '+(S.date==='today'?'active':'')+'" onclick="pv5Date(\'today\')">Сегодня</button><button class="pv5-date '+(S.date==='tomorrow'?'active':'')+'" onclick="pv5Date(\'tomorrow\')">Завтра</button><button class="pv5-date '+(S.date==='all'?'active':'')+'" onclick="pv5Date(\'all\')">Все даты</button><button class="pv5-date" onclick="pv5Pick()">Выбрать дату…</button></aside>';
 html+='<main class="pv5-main"><div class="pv5-toolbar"><div class="pv5-tabs"><button class="'+(S.status==='open'?'active':'')+'" onclick="pv5Status(\'open\')">Открытые</button><button class="'+(S.status==='done'?'active':'')+'" onclick="pv5Status(\'done\')">Выполненные</button><button class="'+(S.status==='all'?'active':'')+'" onclick="pv5Status(\'all\')">Все</button></div><div class="pv5-filters"><input id="pv5search" value="'+e(S.q)+'" placeholder="Поиск задач…" oninput="pv5Search(this.value)"><select onchange="pv5Priority(this.value)"><option value="all">Приоритет</option><option value="high" '+(S.priority==='high'?'selected':'')+'>Высокий</option><option value="medium" '+(S.priority==='medium'?'selected':'')+'>Средний</option><option value="low" '+(S.priority==='low'?'selected':'')+'>Низкий</option></select><select onchange="pv5Sort(this.value)"><option value="time" '+(S.sort==='time'?'selected':'')+'>По времени</option><option value="priority" '+(S.sort==='priority'?'selected':'')+'>По приоритету</option><option value="new" '+(S.sort==='new'?'selected':'')+'>Новые</option></select></div></div>';
 html+='<div class="pv5-quick"><input id="pv5quick" placeholder="Что нужно сделать?  Например: Позвонить клиенту 14:00 !high" onkeydown="if(event.key===\'Enter\'){event.preventDefault();pv5QuickAdd()}"><button onclick="pv5QuickAdd()">Добавить</button></div>';
 html+='<div class="pv5-heading"><div><span>'+ (chosen()?'ФОКУС ДНЯ':'ВСЕ ЗАДАЧИ')+'</span><h2>'+e(chosen()?dateLabel(chosen()):'Все задачи')+'</h2></div><small>'+a.length+' задач</small></div>';
 html+=a.length?'<div class="pv5-listbox">'+a.map(row).join('')+'</div>':'<div class="pv5-empty"><strong>'+(S.status==='done'?'Выполненных задач пока нет.':'На этот день задач нет.')+'</strong><span>Добавь задачу сверху — она появится здесь.</span></div>';
 html+='</main></div>';page.innerHTML=html;
}
function dateLabel(s){var t=todayISO();if(s===t)return'Сегодня';var z=I(A(D(t),1));if(s===z)return'Завтра';return typeof fmtDate==='function'?fmtDate(s):s}
function patch(){
 if(window.__pv5patched)return;window.__pv5patched=1;
 var old=window.go;window.__pv5oldGo=old;
 window.go=function(p,u){if(p==='planner'){if(u!==false&&location.hash!=='#planner')history.pushState({page:p},'', '#planner');render();return}return old(p,u)};
}
window.pv5List=function(v){S.list=v;render()};window.pv5Date=function(v){S.date=v;render()};window.pv5Status=function(v){S.status=v;render()};window.pv5Priority=function(v){S.priority=v;render()};window.pv5Sort=function(v){S.sort=v;render()};window.pv5Search=function(v){S.q=v;render()};window.pv5QuickAdd=addQuick;
window.pv5Pick=function(){var v=prompt('Дата в формате ГГГГ-ММ-ДД',chosen()||todayISO());if(v&&/^\d{4}-\d{2}-\d{2}$/.test(v)){S.date='custom';S.custom=v;render()}};
window.renderPlanner=render;window.switchPlanner=render;
function css(){
 if(document.getElementById('pv5css'))return;var s=document.createElement('style');s.id='pv5css';s.textContent='\
.pv5-layout{display:grid;grid-template-columns:210px minmax(0,1fr);gap:16px;align-items:start}.pv5-sidebar{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:10px;position:sticky;top:18px}.pv5-add{width:100%;border:0;background:var(--accent);color:#fff;border-radius:10px;height:40px;font-size:12px}.pv5-label{font-size:9px;letter-spacing:.15em;color:var(--muted);padding:16px 7px 7px}.pv5-list,.pv5-date{width:100%;display:flex;align-items:center;gap:8px;border:0;background:transparent;border-radius:9px;padding:8px;color:#5e5658;text-align:left;font-size:12px}.pv5-list:hover,.pv5-date:hover{background:#f6efed}.pv5-list.active,.pv5-date.active{background:var(--accent-soft);color:var(--accent)}.pv5-list i{width:7px;height:7px;border-radius:50%;background:var(--accent);flex:0 0 7px}.pv5-list span{flex:1}.pv5-list b{font-size:10px;color:var(--muted);font-weight:400}.pv5-main{min-width:0}.pv5-toolbar{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap}.pv5-tabs{display:flex;gap:3px;background:#eee7e4;padding:3px;border-radius:10px}.pv5-tabs button{border:0;background:transparent;border-radius:8px;padding:7px 10px;font-size:11px;color:#71686a}.pv5-tabs button.active{background:#fff;color:var(--accent)}.pv5-filters{display:flex;gap:7px}.pv5-filters input,.pv5-filters select{height:34px;border:1px solid var(--line);border-radius:9px;background:#fff;padding:0 9px;font-size:11px;color:var(--ink)}.pv5-filters input{width:180px}.pv5-filters select{width:105px}.pv5-quick{display:grid;grid-template-columns:1fr auto;gap:7px;margin-bottom:15px}.pv5-quick input{height:44px;border:1px solid var(--line);border-radius:11px;background:#fff;padding:0 13px;font-size:13px;outline:0}.pv5-quick input:focus{border-color:#caa3aa;box-shadow:0 0 0 3px rgba(141,36,57,.07)}.pv5-quick button{border:0;border-radius:11px;background:var(--accent);color:#fff;padding:0 15px;font-size:12px}.pv5-heading{display:flex;justify-content:space-between;align-items:end;margin-bottom:8px}.pv5-heading>div>span{font-size:9px;letter-spacing:.15em;color:var(--muted)}.pv5-heading h2{font-family:Georgia,serif;font-size:23px;font-weight:400;margin:3px 0 0}.pv5-heading small{font-size:10px;color:var(--muted)}.pv5-listbox{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}.pv5-row{min-height:57px;display:grid;grid-template-columns:22px minmax(0,1fr) 25px;gap:9px;align-items:center;padding:9px 12px;border-bottom:1px solid var(--line);cursor:pointer}.pv5-row:last-child{border-bottom:0}.pv5-row:hover{background:#fcf7f5}.pv5-check{width:19px;height:19px;border-radius:50%;border:1.5px solid #b8afb1;background:#fff;padding:0;position:relative}.pv5-check.done{background:var(--accent);border-color:var(--accent)}.pv5-check.done:after{content:"✓";position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-size:11px}.pv5-check.p-high{border-color:var(--accent)}.pv5-check.p-medium{border-color:#c78395}.pv5-check.p-low{border-color:#d7b9c0}.pv5-main{min-width:0}.pv5-title{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pv5-row.done .pv5-title{text-decoration:line-through;color:#9b9294}.pv5-meta{display:flex;align-items:center;gap:5px;margin-top:4px;color:var(--muted);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pv5-meta i{width:5px;height:5px;border-radius:50%;display:inline-block;flex:0 0 5px}.pv5-more{color:#a39a9c;font-size:14px}.pv5-empty{min-height:260px;border:1px dashed var(--line);border-radius:14px;display:grid;place-items:center;align-content:center;gap:6px;color:var(--muted);text-align:center}.pv5-empty strong{font-size:13px;color:#5f5658}.pv5-empty span{font-size:11px}@media(max-width:900px){.pv5-layout{grid-template-columns:1fr}.pv5-sidebar{position:static}.pv5-filters{width:100%}.pv5-filters input{flex:1;width:auto}}@media(max-width:700px){.pv5-sidebar{display:grid;grid-template-columns:1fr 1fr;gap:2px}.pv5-add,.pv5-label{grid-column:1/-1}.pv5-label{padding:11px 6px 5px}.pv5-toolbar{display:block}.pv5-tabs{width:max-content;margin-bottom:8px}.pv5-filters{display:grid;grid-template-columns:1fr 1fr}.pv5-filters input{grid-column:1/-1;width:100%}.pv5-filters select{width:100%}.pv5-quick{grid-template-columns:1fr 42px}.pv5-quick button{font-size:0;padding:0}.pv5-quick button:after{content:"+";font-size:21px}.pv5-row{grid-template-columns:22px minmax(0,1fr) 22px;padding:9px 8px}.pv5-title{font-size:13px}.pv5-meta{font-size:9px}.pv5-heading h2{font-size:21px}}';
 document.head.appendChild(s)
}
function install(){css();patch();if(location.hash==='#planner'||currentPage==='planner')render()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();