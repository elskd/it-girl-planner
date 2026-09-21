(function(){
'use strict';

function escP(v){
  return typeof esc==='function'?esc(v):String(v==null?'':v).replace(/[&<>\"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]
  });
}

var pv5State={query:'',status:'all',priority:'all'};

function addCss(){
  if(document.getElementById('planner-v5-css'))return;
  var s=document.createElement('style');
  s.id='planner-v5-css';
  s.textContent=`
.pv5-toolbar{display:grid;gap:9px;margin:0 0 12px}
.pv5-search-row{display:flex;gap:8px;align-items:center}
.pv5-search{flex:1;min-width:0;height:42px;border:1px solid var(--line);border-radius:12px;background:var(--card);padding:0 13px;font:inherit;color:var(--ink);outline:0}
.pv5-search:focus{border-color:#cba7ae;box-shadow:0 0 0 3px rgba(201,130,153,.08)}
.pv5-add{height:42px;padding:0 15px;border:0;border-radius:12px;background:var(--accent);color:#fff;font:inherit;cursor:pointer;white-space:nowrap}
.pv5-filters{display:flex;gap:6px;overflow:auto;padding:1px 1px 2px;scrollbar-width:none}
.pv5-filters::-webkit-scrollbar{display:none}
.pv5-filter{height:31px;border:1px solid var(--line);background:var(--card);color:var(--muted);border-radius:999px;padding:0 11px;font-size:10px;white-space:nowrap}
.pv5-filter.active{background:var(--accent-soft);border-color:#dfc3c9;color:var(--accent)}
.pv5-meta{font-size:10px;color:var(--muted);padding:0 2px}
.pv5-empty-filter{padding:26px 14px;text-align:center;color:var(--muted);font-size:12px;border:1px dashed var(--line);border-radius:12px;background:rgba(255,255,255,.35)}
@media(max-width:700px){
  .pv5-toolbar{position:sticky;top:0;z-index:5;background:var(--bg,#fff);padding:2px 0 8px}
  .pv5-add{padding:0 13px}
  .pv5-search-row{gap:7px}
}
`;
  document.head.appendChild(s);
}

function quickAdd(){
  var i=document.getElementById('pv5AddInput');
  if(!i)return;
  var title=i.value.trim();
  if(!title)return;
  var date=window.selectedPlannerDate||new Date().toISOString().slice(0,10);
  state.tasks=Array.isArray(state.tasks)?state.tasks:[];
  state.tasks.push({
    id:Date.now()+Math.floor(Math.random()*1000),
    title:title,area:'',priority:'',date:date,endDate:date,start:'',end:'',
    allDay:false,noTime:true,repeat:'none',repeatDays:[],notes:'',done:false,
    status:'active',overrides:{},pinned:false
  });
  persist();
  i.value='';
  if(typeof renderPlanner==='function')renderPlanner();
  if(typeof toast==='function')toast('Задача добавлена');
  setTimeout(function(){var n=document.getElementById('pv5QuickInput');if(n)n.focus()},0);
}

function setFilter(type,value){
  if(type==='status')pv5State.status=value;
  if(type==='priority')pv5State.priority=value;
  applyFilters();
  renderFilterState();
}

function matchesTask(task){
  var q=pv5State.query.toLowerCase().trim();
  if(q){
    var hay=[task.title,task.notes,task.area,task.priority].join(' ').toLowerCase();
    if(hay.indexOf(q)===-1)return false;
  }
  if(pv5State.status==='open' && task.done)return false;
  if(pv5State.status==='done' && !task.done)return false;
  if(pv5State.priority!=='all' && (task.priority||'none')!==pv5State.priority)return false;
  return true;
}

function applyFilters(){
  var root=document.querySelector('.planner-tasks-card');
  if(!root)return;
  var tasks=root.querySelectorAll('.task');
  var visible=0;
  tasks.forEach(function(el){
    var id=(el.getAttribute('onclick')||'').match(/openTaskDetail\((\d+)\)/);
    var task=id&&state.tasks?state.tasks.find(function(t){return String(t.id)===id[1]}):null;
    var show=!!task&&matchesTask(task);
    el.style.display=show?'':'none';
    if(show)visible++;
  });
  var empty=root.querySelector('.pv5-empty-filter');
  if(!visible && tasks.length){
    if(!empty){
      empty=document.createElement('div');
      empty.className='pv5-empty-filter';
      empty.textContent='По этому фильтру задач нет.';
      root.appendChild(empty);
    }
    empty.style.display='';
  }else if(empty)empty.style.display='none';
}

function renderFilterState(){
  document.querySelectorAll('.pv5-filter[data-pv5-type]').forEach(function(b){
    var type=b.dataset.pv5Type,value=b.dataset.pv5Value;
    var active=type==='status'?pv5State.status===value:pv5State.priority===value;
    b.classList.toggle('active',active);
  });
}

function buildToolbar(root){
  if(document.getElementById('pv5Toolbar'))return;
  var wrap=document.createElement('div');
  wrap.id='pv5Toolbar';
  wrap.className='pv5-toolbar';
  wrap.innerHTML=
    '<div class="pv5-search-row"><input id="pv5AddInput" class="pv5-search" placeholder="Быстро добавить задачу…" autocomplete="off">'+
      '<button class="pv5-add" type="button" onclick="pv5QuickAdd()">Добавить</button>'+
    '</div>'+
    '<div class="pv5-search-row"><input id="pv5SearchInput" class="pv5-search" placeholder="Поиск по задачам…" autocomplete="off"></div>'+
    '<div class="pv5-filters">'+
      '<button class="pv5-filter active" data-pv5-type="status" data-pv5-value="all" type="button">Все</button>'+
      '<button class="pv5-filter" data-pv5-type="status" data-pv5-value="open" type="button">Открытые</button>'+
      '<button class="pv5-filter" data-pv5-type="status" data-pv5-value="done" type="button">Выполненные</button>'+
      '<button class="pv5-filter" data-pv5-type="priority" data-pv5-value="high" type="button">Высокий приоритет</button>'+
      '<button class="pv5-filter" data-pv5-type="priority" data-pv5-value="medium" type="button">Средний</button>'+
      '<button class="pv5-filter" data-pv5-type="priority" data-pv5-value="low" type="button">Низкий</button>'+
    '</div>'+
    '<div class="pv5-meta">Enter — добавить · поиск фильтрует текущий список</div>';
  root.parentNode.insertBefore(wrap,root);
  wrap.querySelectorAll('.pv5-filter').forEach(function(btn){
    btn.addEventListener('click',function(){
      var type=this.dataset.pv5Type,value=this.dataset.pv5Value;
      if(type==='priority' && pv5State.priority===value)pv5State.priority='all';
      else setFilter(type,value);
    });
  });
  var input=wrap.querySelector('#pv5AddInput');
  input.addEventListener('keydown',function(e){
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(this.value.trim())quickAdd();}
  });
  var search=wrap.querySelector('#pv5SearchInput');
  search.addEventListener('input',function(){
    pv5State.query=this.value;
    applyFilters();
  });
}

function inject(){
  if(!window.renderPlanner||window.__pv5Wrapped)return;
  window.__pv5Wrapped=true;
  var old=window.renderPlanner;
  window.renderPlanner=function(){
    old();
    if(window.plannerMode!=='tasks'&&window.plannerMode!==undefined)return;
    var root=document.querySelector('.planner-tasks-card');
    if(!root)return;
    buildToolbar(root);
    applyFilters();
    renderFilterState();
  };
}

window.pv5QuickAdd=quickAdd;
window.pv5ResetFilters=function(){
  pv5State={query:'',status:'all',priority:'all'};
  var i=document.getElementById('pv5AddInput');if(i)i.value='';
  applyFilters();renderFilterState();
};

addCss();
inject();
if(window.currentPage==='planner'&&typeof window.renderPlanner==='function')window.renderPlanner();

})();