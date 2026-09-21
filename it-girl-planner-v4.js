
(function(){
  'use strict';

  function ensureLifeSystemData(){
    state.lifeSystem = state.lifeSystem || {};
    const ls=state.lifeSystem;
    ls.mentorMessages=Array.isArray(ls.mentorMessages)?ls.mentorMessages:[];
    ls.mentorPreferences=ls.mentorPreferences||{directness:7,autoSuggestions:true};
    ls.maddy=ls.maddy||{};
    const m=ls.maddy;
    m.identity=String(m.identity||'');
    m.rules=Array.isArray(m.rules)?m.rules:[];
    m.behaviors=Array.isArray(m.behaviors)?m.behaviors:[];
    m.values=Array.isArray(m.values)?m.values:[];
    m.always=Array.isArray(m.always)?m.always:[];
    m.never=Array.isArray(m.never)?m.never:[];
    m.notes=Array.isArray(m.notes)?m.notes:[];
    m.moodboard=Array.isArray(m.moodboard)?m.moodboard:[];
    m.savedSituations=Array.isArray(m.savedSituations)?m.savedSituations:[];
    ls.weeklyReviews=Array.isArray(ls.weeklyReviews)?ls.weeklyReviews:[];
    ls.aiStyle=Object.assign({language:'ru',address:'ты',tone:'близкая подруга',directness:'прямо',profanity:true,challenge:'если долго стою на месте — жёсткий пинок',automaticAgreement:false,supportWhenHard:true,concreteActions:true,lively:true,structure:'структурированно, по пунктам и разделам, без воды',length:'средне',emotion:'очень эмоционально и живо',emojis:'иногда',custom:'Разговаривай со мной как близкая подруга, которая меня хорошо знает. На ты. Будь живой и эмоциональной, но не переигрывай. Не используй шаблонные фразы типа «ты справишься». Если я не права — говори прямо. Не бойся материться, если это уместно. Когда я расстроена, сначала помоги мне разобраться, а не начинай давать советы. Когда я прошу совет — говори конкретно, что мне делать. Не повторяй очевидные вещи и не читай мне морали. Отвечай естественно, как человек в переписке.'},ls.aiStyle||{});
    return ls;
  }

  function life(){return ensureLifeSystemData();}
  function maddyData(){return life().maddy;}
  function escV(s){return typeof esc==='function'?esc(s):String(s??'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]})}
  function uid(prefix){return prefix+Date.now()+Math.random().toString(36).slice(2,7)}

  async function plannerDirectAI(kind,message){
    const controller=new AbortController();
    const timer=setTimeout(function(){controller.abort()},120000);
    try{
      const r=await fetch('https://ajrcehwxqgbloixgvcxc.supabase.co/functions/v1/it-girl-ai',{
        method:'POST',
        headers:{'Content-Type':'text/plain;charset=UTF-8','Accept':'application/json'},
        body:JSON.stringify({kind:kind,message:message,context:{
          goals:(state.goals||[]).map(function(g){return {title:g.title,progress:Number(g.progress)||0,current:g.currentValue||'',target:g.targetValue||g.target||'',unit:g.unit||'',deadline:g.deadline||'',actions:g.actions||[],subgoals:g.subgoals||[]}}),
          todayTasks:(state.tasks||[]).filter(function(t){return t.date===(typeof todayISO==='function'?todayISO():new Date().toISOString().slice(0,10))&&!t.done}).map(function(t){return {title:t.title,priority:t.priority||'',area:t.area||'',start:t.start||'',end:t.end||''}}),
          maddy:life().maddy,
          aiStyle:life().aiStyle
        }}),
        signal:controller.signal,cache:'no-store',mode:'cors'
      });
      let data={}; try{data=await r.json()}catch(e){}
      if(!r.ok) throw new Error(data.error||('AI request failed ('+r.status+')'));
      const answer=String(data.text||'').replace(/\\n/g,'\n').trim();
      if(!answer) throw new Error('ИИ не вернул текстовый ответ');
      return answer;
    }catch(e){
      if(e&&e.name==='AbortError') throw new Error('ИИ не ответил за 120 секунд. Попробуй ещё раз.');
      throw e;
    }finally{clearTimeout(timer)}
  }

  function plannerInlineMarkdown(value){
    let s=escV(String(value??''));
    s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    s=s.replace(/__([^_]+)__/g,'<strong>$1</strong>');
    s=s.replace(/~~([^~]+)~~/g,'<del>$1</del>');
    s=s.replace(/\*([^*\n]+)\*/g,'<em>$1</em>');
    s=s.replace(/_([^_\n]+)_/g,'<em>$1</em>');
    return s;
  }

  function plannerMarkdownBlock(value){
    const lines=String(value??'').replace(/\\n/g,'\n').split('\n');
    const out=[]; let paragraph=[]; let list='';
    function flushParagraph(){if(paragraph.length){out.push('<p>'+paragraph.map(plannerInlineMarkdown).join('<br>')+'</p>');paragraph=[];}}
    function flushList(){if(list){out.push('</'+list+'>');list='';}}
    lines.forEach(function(line){
      const t=line.trim();
      if(!t){flushParagraph();flushList();return;}
      let m=line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
      if(m){flushParagraph();flushList();out.push('<h'+m[1].length+'>'+plannerInlineMarkdown(m[2])+'</h'+m[1].length+'>');return;}
      m=line.match(/^\s*[-•*+]\s+(.+)$/);
      if(m){flushParagraph();if(list!=='ul'){flushList();out.push('<ul>');list='ul';}out.push('<li>'+plannerInlineMarkdown(m[1])+'</li>');return;}
      m=line.match(/^\s*\d+[.)]\s+(.+)$/);
      if(m){flushParagraph();if(list!=='ol'){flushList();out.push('<ol>');list='ol';}out.push('<li>'+plannerInlineMarkdown(m[1])+'</li>');return;}
      if(list)flushList();
      paragraph.push(line);
    });
    flushParagraph();flushList();
    return out.join('');
  }

  function addSideNavigation(){ return; }

  function setActivePage(page){
    document.querySelectorAll('[data-page]').forEach(function(b){
      if(!b.closest('.itgirl-v3-system-nav') && !['today','calendar','planner','goals','maddy','cabinet','settings','mentor','progress','weekly','weeks'].includes(b.dataset.page)) return;
      b.classList.toggle('active',b.dataset.page===page || (page==='goals'&&b.dataset.page==='weeks'));
    });
  }

  function goalPct(g){
    const p=Number(g.progress)||0;
    return Math.max(0,Math.min(100,p));
  }

  function openV3GoalModal(id){
    const g=id?state.goals.find(function(x){return x.id==id}):null;
    const x=g||{title:'',target:'',progress:0,deadline:'',currentValue:'',targetValue:'',unit:'',subgoals:[],actions:[]};
    document.getElementById('modal').innerHTML=
      '<div class="modal-head"><div class="modal-title">'+(g?'Редактировать цель':'Новая цель')+'</div><button class="close" onclick="closeModal()">×</button></div>'+
      '<div class="form-grid">'+
        '<div class="field full"><label>Цель</label><input id="v3GoalTitle" class="text-input" value="'+escV(x.title)+'" placeholder="Например, выйти на доход 150 000 ₽"></div>'+
        '<div class="field"><label>Текущее значение</label><input id="v3GoalCurrent" class="text-input" value="'+escV(x.currentValue||'')+'" placeholder="Например, 60 000"></div>'+
        '<div class="field"><label>Целевое значение</label><input id="v3GoalTargetValue" class="text-input" value="'+escV(x.targetValue||'')+'" placeholder="Например, 150 000"></div>'+
        '<div class="field"><label>Единица</label><input id="v3GoalUnit" class="text-input" value="'+escV(x.unit||'')+'" placeholder="₽ / кг / клиентов"></div>'+
        '<div class="field"><label>Дедлайн</label><input id="v3GoalDeadline" class="text-input" type="date" value="'+escV(x.deadline||'')+'"></div>'+
        '<div class="field"><label>Прогресс, %</label><input id="v3GoalProgress" class="text-input" type="number" min="0" max="100" value="'+goalPct(x)+'"></div>'+
        '<div class="field full"><label>Что должно измениться для достижения</label><textarea id="v3GoalSubgoals" class="text-input" rows="4" placeholder="Каждый пункт с новой строки">'+escV((x.subgoals||[]).join('\n'))+'</textarea></div>'+
        '<div class="field full"><label>Ближайшие действия</label><textarea id="v3GoalActions" class="text-input" rows="4" placeholder="Каждое действие с новой строки">'+escV((x.actions||[]).join('\n'))+'</textarea></div>'+
      '</div>'+
      '<div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Отмена</button>'+(g?'<button class="btn danger" onclick="deleteGoal('+g.id+');closeModal()">Удалить</button>':'')+'<button class="btn" onclick="saveV3Goal('+(g?g.id:0)+')">'+(g?'Сохранить':'Создать цель')+'</button></div>';
    openModal();
  }

  function saveV3Goal(id){
    const title=(document.getElementById('v3GoalTitle')?.value||'').trim();
    if(!title){toast('Напиши название цели');return}
    const subgoals=(document.getElementById('v3GoalSubgoals')?.value||'').split('\n').map(function(x){return x.trim()}).filter(Boolean);
    const actions=(document.getElementById('v3GoalActions')?.value||'').split('\n').map(function(x){return x.trim()}).filter(Boolean);
    const obj={
      title:title,
      target:(document.getElementById('v3GoalTargetValue')?.value||'').trim() || (document.getElementById('v3GoalTarget')?.value||'').trim(),
      currentValue:(document.getElementById('v3GoalCurrent')?.value||'').trim(),
      targetValue:(document.getElementById('v3GoalTargetValue')?.value||'').trim(),
      unit:(document.getElementById('v3GoalUnit')?.value||'').trim(),
      deadline:document.getElementById('v3GoalDeadline')?.value||'',
      progress:Math.max(0,Math.min(100,Number(document.getElementById('v3GoalProgress')?.value)||0)),
      subgoals:subgoals,
      actions:actions
    };
    if(id){
      const g=state.goals.find(function(x){return x.id==id});
      if(g) Object.assign(g,obj);
    }else state.goals.push({id:Date.now(),...obj});
    persist();closeModal();go('goals');toast(id?'Цель обновлена':'Цель создана');
  }

  function renderGoalsV3(){
    ensureLifeSystemData();
    const goals=state.goals||[];
    const avg=goals.length?Math.round(goals.reduce(function(a,g){return a+goalPct(g)},0)/goals.length):0;
    let html=
      '<header class="page-head"><div class="eyebrow">Моя система</div><h1 class="title">Цели</h1><div class="date">Большие результаты превращаются в конкретные действия.</div></header>'+
      '<section class="card v3-goals-summary">'+
        '<div><div class="label">Общий прогресс</div><div class="v3-big-number">'+avg+'%</div></div>'+
        '<div class="v3-summary-copy">Приложение использует твои цели, задачи и историю выполнения, чтобы предлагать следующие шаги.</div>'+
        '<button class="btn" onclick="openV3GoalModal()">+ Добавить цель</button>'+
      '</section>'+
      '<section class="section v3-goals-grid">';
    if(!goals.length) html+='<div class="card v3-empty-card"><h2>С чего начнём?</h2><p>Добавь первую цель. Затем мы сможем связать её с ежедневными действиями и рекомендациями ментора.</p><button class="btn" onclick="openV3GoalModal()">Создать первую цель</button></div>';
    else goals.forEach(function(g){
      const p=goalPct(g);
      const current=g.currentValue?'<span>'+escV(g.currentValue)+(g.unit?' '+escV(g.unit):'')+'</span>':'';
      const target=g.targetValue?'<span>'+escV(g.targetValue)+(g.unit?' '+escV(g.unit):'')+'</span>':(g.target?'<span>'+escV(g.target)+'</span>':'');
      const due=g.deadline?'<div class="v3-goal-deadline">Дедлайн: '+escV(fmtDate(g.deadline))+'</div>':'';
      html+=
        '<article class="card v3-goal-card">'+
          '<div class="v3-goal-top"><div><div class="label">Цель</div><h2>'+escV(g.title)+'</h2></div><div class="task-actions"><button class="mini" onclick="openV3GoalModal('+g.id+')">✎</button></div></div>'+
          '<div class="v3-goal-values">'+(current||'<span>—</span>')+'<b>→</b>'+(target||'<span>—</span>')+'</div>'+
          '<div class="bar"><i style="width:'+p+'%"></i></div>'+
          '<div class="v3-goal-progress-row"><span>'+p+'%</span>'+due+'</div>'+
          (g.subgoals?.length?'<div class="v3-goal-block"><div class="label">Что должно измениться</div>'+g.subgoals.map(function(x){return '<div class="v3-bullet">'+escV(x)+'</div>'}).join('')+'</div>':'')+
          (g.actions?.length?'<div class="v3-goal-block"><div class="label">Ближайшие действия</div>'+g.actions.map(function(x){return '<div class="v3-action">'+escV(x)+'</div>'}).join('')+'</div>':'')+
          '<div class="v3-goal-footer"><button class="btn ghost" onclick="go(\'mentor\')">Спросить ментора</button></div>'+
        '</article>';
    });
    html+='</section>';
    document.getElementById('page').innerHTML=html;
  }

  function taskCompletion(){
    const active=state.tasks.filter(function(t){return typeof taskIsActive==='function'?taskIsActive(t):t.status!=='trash'});
    const done=active.filter(function(t){return t.done}).length;
    return {done:done,total:active.length,pct:active.length?Math.round(done/active.length*100):0};
  }

  function weekRange(){
    const now=new Date(),start=monday(now),end=addDays(start,6);
    return {start:isoDate(start),end:isoDate(end)};
  }

  function weekTasks(){
    const r=weekRange();
    return state.tasks.filter(function(t){return t.date>=r.start&&t.date<=r.end&&(typeof taskIsActive!=='function'||taskIsActive(t))});
  }

  function weekStats(){
    const ts=weekTasks(),done=ts.filter(function(t){return t.done}).length;
    let hp=0,ht=0;
    (state.habits||[]).forEach(function(h){
      for(let i=0;i<7;i++){ht++;if(habitDone(h,isoDate(addDays(parseDate(weekRange().start),i))))hp++}
    });
    return {tasks:ts,taskDone:done,taskTotal:ts.length,taskPct:ts.length?Math.round(done/ts.length*100):0,habitDone:hp,habitTotal:ht,habitPct:ht?Math.round(hp/ht*100):0};
  }

  function renderProgressV3(){
    const ls=life(),tc=taskCompletion(),ws=weekStats(),goals=state.goals||[];
    const avg=goals.length?Math.round(goals.reduce(function(a,g){return a+goalPct(g)},0)/goals.length):0;
    const strongest=goals.slice().sort(function(a,b){return goalPct(b)-goalPct(a)})[0];
    const weakest=goals.slice().sort(function(a,b){return goalPct(a)-goalPct(b)})[0];
    document.getElementById('page').innerHTML=
      '<header class="page-head"><div class="eyebrow">Статистика</div><h1 class="title">Прогресс</h1><div class="date">Смотри на изменения, а не только на список выполненных задач.</div></header>'+
      '<section class="v3-stat-grid">'+
        '<section class="card v3-stat-card"><div class="label">Задачи</div><div class="v3-stat-number">'+tc.pct+'%</div><div class="bar"><i style="width:'+tc.pct+'%"></i></div><p>'+tc.done+' из '+tc.total+' выполнено</p></section>'+
        '<section class="card v3-stat-card"><div class="label">Эта неделя</div><div class="v3-stat-number">'+ws.taskPct+'%</div><div class="bar"><i style="width:'+ws.taskPct+'%"></i></div><p>'+ws.taskDone+' из '+ws.taskTotal+' задач</p></section>'+
        '<section class="card v3-stat-card"><div class="label">Привычки</div><div class="v3-stat-number">'+ws.habitPct+'%</div><div class="bar"><i style="width:'+ws.habitPct+'%"></i></div><p>'+ws.habitDone+' из '+ws.habitTotal+' выполнений</p></section>'+
        '<section class="card v3-stat-card"><div class="label">Цели</div><div class="v3-stat-number">'+avg+'%</div><div class="bar"><i style="width:'+avg+'%"></i></div><p>'+goals.length+' целей</p></section>'+
      '</section>'+
      '<section class="card section"><div class="section-head"><h2>Динамика целей</h2></div>'+
      (goals.length?goals.map(function(g){return '<div class="v3-progress-goal"><div><span>'+escV(g.title)+'</span><b>'+goalPct(g)+'%</b></div><div class="bar"><i style="width:'+goalPct(g)+'%"></i></div></div>'}).join(''):'<div class="empty">Добавь цели, чтобы видеть динамику.</div>')+
      '</section>'+
      '<section class="grid2 section">'+
        '<section class="card"><div class="label">Сильнее всего сейчас</div><h2 class="v3-insight-title">'+(strongest?escV(strongest.title):'Пока нет данных')+'</h2><p class="v3-insight-copy">'+(strongest?'Прогресс '+goalPct(strongest)+'%.':'Добавь первую цель.')+'</p></section>'+
        '<section class="card"><div class="label">Больше всего внимания</div><h2 class="v3-insight-title">'+(weakest?escV(weakest.title):'Пока нет данных')+'</h2><p class="v3-insight-copy">'+(weakest?'Сейчас у этой цели самый низкий прогресс — именно её стоит проверить вместе с ментором.':'Добавь первую цель.')+'</p></section>'+
      '</section>';
  }

  function mentorRecommendation(){
    const goals=state.goals||[],ts=weekTasks();
    if(!goals.length) return 'Сначала создай хотя бы одну цель. Тогда я смогу связывать ежедневные действия с тем, куда ты хочешь прийти.';
    const weakest=goals.slice().sort(function(a,b){return goalPct(a)-goalPct(b)})[0];
    const undone=ts.filter(function(t){return !t.done});
    const repeated=undone.slice(0,3).map(function(t){return t.title}).filter(Boolean);
    if(repeated.length>=3) return 'На этой неделе у тебя накопилось несколько незакрытых задач. Я бы не добавляла новые дела поверх них. Сначала выбери одну главную: «'+repeated[0]+'». Остальное можно переставить.';
    return 'Сейчас я бы держала фокус на цели «'+weakest.title+'». Посмотри на её ближайшие действия и добавь одно из них в Сегодня.';
  }

  function mentorContext(){
    const tc=taskCompletion(),ws=weekStats(),goals=state.goals||[];
    return {
      taskPct:tc.pct,
      weekPct:ws.taskPct,
      goals:goals.map(function(g){return {title:g.title,progress:goalPct(g),actions:g.actions||[]}}),
      today:state.tasks.filter(function(t){return t.date===todayISO()&&!t.done&&(typeof taskIsActive!=='function'||taskIsActive(t))}).map(function(t){return t.title})
    };
  }

  function mentorReply(text){
    const q=String(text||'').toLowerCase();
    const ctx=mentorContext();
    if(/сегодня|план|день|задач/.test(q)){
      return 'На сегодня у тебя '+ctx.today.length+' незавершённых задач. '+mentorRecommendation()+' Если хочешь, я могу помочь сократить день до 3 главных действий.';
    }
    if(/цель|куда|достиг|продвин|результат/.test(q)){
      const g=ctx.goals.slice().sort(function(a,b){return a.progress-b.progress})[0];
      return g?'Сейчас наименьший прогресс у цели «'+g.title+'» — '+g.progress+'%. Я бы не добавляла десяток новых задач. Выбери одно ближайшее действие: '+(g.actions[0]||'сформулировать следующий конкретный шаг')+'.':'Сначала добавь цель.';
    }
    if(/не могу|лень|мотивац|отклады|прокраст/.test(q)){
      return 'Не буду отвечать тебе «просто соберись». Давай уменьшим сопротивление: выбери действие, которое можно закончить за 20–30 минут. Если задача огромная, разбей её до результата одного подхода.';
    }
    if(/недел|провал|сорвал|ничего не сделал/.test(q)){
      return buildWeeklyAnalysis();
    }
    return mentorRecommendation()+'\\n\\nКонтекст: '+ctx.taskPct+'% задач выполнено в общей истории, '+ctx.weekPct+'% — за эту неделю.';
  }

  function sendMentorMessage(){
    const input=document.getElementById('v3MentorInput');
    const text=String(input?.value||'').trim();
    if(!text)return;
    const ls=life();
    ls.mentorMessages.push({id:uid('msg:'),role:'user',text:text,createdAt:new Date().toISOString()});
    ls.mentorMessages.push({id:uid('msg:'),role:'mentor',text:mentorReply(text),createdAt:new Date().toISOString()});
    input.value='';
    persist();renderMentorV3();
  }

  function addMentorRecommendation(){
    const goals=state.goals||[];
    if(!goals.length){toast('Сначала добавь цель');return}
    const g=goals.slice().sort(function(a,b){return goalPct(a)-goalPct(b)})[0];
    const action=(g.actions||[])[0]||'Сформулировать один конкретный шаг по цели «'+g.title+'»';
    const t={id:Date.now(),title:action,area:'Планирование',priority:'high',date:todayISO(),start:'',end:'',repeat:'none',repeatDays:[],allDay:false,noTime:true,notes:'Рекомендация ментора для цели: '+g.title,status:'active',done:false,overrides:{},pinned:true,labels:[],reminder:'',attachments:[]};
    state.tasks.push(t);persist();go('today');toast('Рекомендация добавлена в Сегодня');
  }

  let v3MentorSending=false;
  async function v3SubmitMentor(event){
    if(event&&event.preventDefault)event.preventDefault();
    if(v3MentorSending)return false;
    const input=document.getElementById('v3MentorInput');
    const text=String(input?.value||'').trim();
    if(!text)return false;
    v3MentorSending=true;
    const ls=life();
    ls.mentorMessages=Array.isArray(ls.mentorMessages)?ls.mentorMessages:[];
    const b=document.getElementById('v3MentorButton');
    if(b){b.disabled=true;b.textContent='Отправить';}
    ls.mentorMessages.push({id:uid('msg:'),role:'user',text,createdAt:new Date().toISOString()});
    input.value='';
    persist();
    renderMentorV3();
    const box=document.querySelector('.v3-chat-messages');
    const thinking=document.createElement('div');
    thinking.className='v3-chat-message ai-loading';
    thinking.innerHTML='<div class="v3-chat-role">Ментор</div><div class="v3-chat-text">Думаю…</div>';
    box?.appendChild(thinking);
    try{
      const answer=await plannerDirectAI('mentor',text);
      ls.mentorMessages.push({id:uid('msg:'),role:'mentor',text:answer,createdAt:new Date().toISOString()});
      persist();
      thinking.remove();
      renderMentorV3();
    }catch(e){
      thinking.remove();
      ls.mentorMessages.push({id:uid('msg:'),role:'mentor',text:'Не получилось получить ответ ИИ: '+(e?.message||'ошибка соединения'),createdAt:new Date().toISOString()});
      persist();
      renderMentorV3();
    }finally{
      v3MentorSending=false;
      const bb=document.getElementById('v3MentorButton');
      if(bb){bb.disabled=false;bb.textContent='Отправить';}
    }
    return false;
  }

  function renderMentorV3(){
    const ls=life(),msgs=ls.mentorMessages||[];
    document.getElementById('page').innerHTML=
      '<header class="page-head"><div class="eyebrow">Персональный наставник</div><h1 class="title">Ментор</h1><div class="date">Я смотрю на твои цели, задачи и прогресс, а не только на отдельные сообщения.</div></header>'+
      '<section class="card v3-mentor-hero"><div><div class="label">Моя рекомендация сейчас</div><div class="v3-mentor-recommendation">'+escV(mentorRecommendation())+'</div></div><button class="btn" onclick="addMentorRecommendation()">Добавить в Сегодня</button></section>'+
      '<section class="card section v3-chat">'+
        '<div class="section-head"><div><h2>Поговорить с ментором</h2><div class="date">Напиши ситуацию так, как написала бы человеку.</div></div></div>'+
        '<div class="v3-chat-messages">'+(msgs.length?msgs.map(function(m){return '<div class="v3-chat-message '+(m.role==='user'?'user':'mentor')+'"><div class="v3-chat-role">'+(m.role==='user'?'Ты':'Ментор')+'</div><div class="v3-chat-text">'+plannerMarkdownBlock(m.text)+'</div></div>'}).join(''):'<div class="v3-chat-empty">Например: «Я опять перенесла важную задачу. Что мне сейчас делать?»</div>')+'</div>'+
        '<form id="v3MentorForm" class="v3-chat-input-row" autocomplete="off"><textarea id="v3MentorInput" class="text-input" rows="2" placeholder="Что происходит?" autocomplete="off"></textarea><button id="v3MentorButton" type="button" class="btn" onclick="return window.v3SubmitMentor ? window.v3SubmitMentor(event) : false">Отправить</button></form>'+
      '</section>'+
      '<section class="card section"><div class="section-head"><h2>Что ментор учитывает</h2></div><div class="v3-chip-list"><span>цели</span><span>задачи</span><span>прогресс</span><span>историю недели</span><span>твои правила Мэдди</span></div></section>';
  }

  function buildWeeklyAnalysis(){
    const ws=weekStats(),goals=state.goals||[],undone=ws.tasks.filter(function(t){return !t.done});
    if(!goals.length) return 'На этой неделе выполнено '+ws.taskDone+' из '+ws.taskTotal+' задач. Добавь цели, и анализ сможет объяснять не только продуктивность, но и движение к результату.';
    const weak=goals.slice().sort(function(a,b){return goalPct(a)-goalPct(b)})[0];
    let out='За эту неделю выполнено '+ws.taskDone+' из '+ws.taskTotal+' задач ('+ws.taskPct+'%). Привычки: '+ws.habitDone+' из '+ws.habitTotal+' ('+ws.habitPct+'%). ';
    if(undone.length) out+='Осталось '+undone.length+' незавершённых задач. ';
    out+='Самая уязвимая цель сейчас — «'+weak.title+'» ('+goalPct(weak)+'%). На следующую неделю я бы выбрала один измеримый фокус, а не увеличивала количество задач.';
    return out;
  }

  function renderWeeklyV3(){
    const ws=weekStats(),goals=state.goals||[],analysis=buildWeeklyAnalysis();
    const recommendations=[];
    goals.slice().sort(function(a,b){return goalPct(a)-goalPct(b)}).slice(0,3).forEach(function(g){
      recommendations.push((g.actions||[])[0]||'Определи следующий шаг по цели «'+g.title+'»');
    });
    document.getElementById('page').innerHTML=
      '<header class="page-head"><div class="eyebrow">Автоматический разбор</div><h1 class="title">Анализ недели</h1><div class="date">'+fmtDate(weekRange().start)+' — '+fmtDate(weekRange().end)+'</div></header>'+
      '<section class="v3-stat-grid">'+
        '<section class="card v3-stat-card"><div class="label">Задачи</div><div class="v3-stat-number">'+ws.taskPct+'%</div><p>'+ws.taskDone+' / '+ws.taskTotal+'</p></section>'+
        '<section class="card v3-stat-card"><div class="label">Привычки</div><div class="v3-stat-number">'+ws.habitPct+'%</div><p>'+ws.habitDone+' / '+ws.habitTotal+'</p></section>'+
      '</section>'+
      '<section class="card section"><div class="label">Вывод ментора</div><div class="v3-analysis-text">'+escV(analysis)+'</div></section>'+
      '<section class="card section"><div class="section-head"><div><h2>Фокус следующей недели</h2><div class="date">Тебе не нужно самой анализировать цифры.</div></div></div>'+
      (recommendations.length?recommendations.map(function(x,i){return '<div class="v3-next-row"><span>'+String(i+1)+'</span><div>'+escV(x)+'</div></div>'}).join(''):'<div class="empty">Добавь цели и ближайшие действия.</div>')+
      '</section>'+
      '<section class="card section"><div class="modal-actions" style="margin-top:0"><button class="btn ghost" onclick="go(\'mentor\')">Обсудить с ментором</button><button class="btn" onclick="addMentorRecommendation()">Добавить главный шаг в Сегодня</button></div></section>';
  }

  function maddyTabs(active){ return ''; }

  function renderMaddyMainV3(){
    const original=window.__itGirlOriginalRenderMaddy;
    if(!original){renderMaddy();return}
    original();
    const page=document.getElementById('page');
    page.insertAdjacentHTML('afterbegin',maddyTabs('main'));
    page.querySelectorAll('.page-head .eyebrow').forEach(function(x){if(x.textContent==='MY CHARACTER')x.textContent='МОЙ ОБРАЗ'});
    page.querySelectorAll('.page-head .date').forEach(function(x){if(x.textContent.includes('The version of me'))x.textContent='Версия тебя, которую ты создаёшь.'});
    page.querySelectorAll('.maddy-metric-label').forEach(function(x){
      const map={'Overall Progress':'Общий прогресс','Total XP':'Всего XP','XP to next level':'XP до следующего уровня'};
      if(map[x.textContent.trim()])x.textContent=map[x.textContent.trim()];
    });
    page.querySelectorAll('.maddy-traits-title').forEach(function(x){x.textContent='Мои качества'});
    page.querySelectorAll('.maddy-traits-subtitle').forEach(function(x){x.textContent=x.textContent.replace('traits · XP, progress и manifestations','качеств · XP и проявления')});
  }

  function saveMaddyArray(kind){
    const input=document.getElementById('maddyArrayInput'),v=String(input?.value||'').trim();
    if(!v)return;
    maddyData()[kind].push(v);persist();renderMaddyV3(kind==='rules'?'rules':kind==='values'?'values':'behavior');
  }

  function removeMaddyArray(kind,index){
    maddyData()[kind].splice(index,1);persist();renderMaddyV3(kind);
  }

  function renderMaddyListView(kind,title,description){
    const m=maddyData();
    const items=m[kind]||[];
    document.getElementById('page').innerHTML=
      '<header class="page-head"><div class="eyebrow">Мэдди</div><h1 class="title">'+title+'</h1><div class="date">'+description+'</div></header>'+
      maddyTabs(kind)+
      '<section class="card section"><div class="v3-inline-add"><input id="maddyArrayInput" class="text-input" placeholder="Добавить пункт…"><button class="btn" onclick="saveMaddyArray(\''+kind+'\')">Добавить</button></div>'+
      (items.length?'<div class="v3-list-editor">'+items.map(function(x,i){return '<div class="v3-list-row"><span>'+escV(x)+'</span><button class="mini" onclick="removeMaddyArray(\''+kind+'\','+i+')">×</button></div>'}).join(''):'<div class="empty">Здесь пока пусто. Добавь первый пункт.</div>')+
      '</section>';
  }

  
  function restoreMaddyChatPosition(){
    const box=document.querySelector('.v3-chat-messages');
    if(!box)return;
    requestAnimationFrame(function(){box.scrollTop=box.scrollHeight;});
  }

  function renderMaddyAsk(){
    const m=maddyData(),msgs=life().maddyChat||[];
    life().maddyChat=Array.isArray(msgs)?msgs:[];
    const history=life().maddyChat;
    document.getElementById('page').innerHTML=
      '<header class="page-head"><div class="eyebrow">Мэдди</div><h1 class="title">Спросить Мэдди</h1><div class="date">Опиши ситуацию. Ответ строится на твоих правилах, ценностях и образе Мэдди.</div></header>'+
      maddyTabs('ask')+
      '<section class="card section v3-chat">'+
        '<div class="v3-chat-messages">'+(history.length?history.map(function(x){return '<div class="v3-chat-message '+(x.role==='user'?'user':'mentor')+'"><div class="v3-chat-role">'+(x.role==='user'?'Ты':'Мэдди')+'</div><div class="v3-chat-text">'+plannerMarkdownBlock(x.text)+'</div></div>'}).join(''):'<div class="v3-chat-empty">«Я в такой-то ситуации. Что Мэдди сделала бы на моём месте?»</div>')+'</div>'+
        '<form id="maddyAskForm" class="v3-chat-input-row" onsubmit="return askMaddyV3(event)" autocomplete="off"><textarea id="maddyAskInput" class="text-input" rows="3" placeholder="Я в такой-то ситуации…" autocomplete="off" autocorrect="on" autocapitalize="sentences" spellcheck="true"></textarea><button type="button" class="btn" onclick="return window.askMaddyV3 ? window.askMaddyV3(event) : false">Спросить</button></form>'+
      '</section>';
  }

  let v3MaddySending=false;
  async function askMaddyV3(event){
    if(event&&event.preventDefault)event.preventDefault();
    if(v3MaddySending)return false;
    const input=document.getElementById('maddyAskInput');
    const text=String(input?.value||'').trim();
    if(!text)return false;
    v3MaddySending=true;
    const form=document.getElementById('maddyAskForm');
    const button=form?.querySelector('button');
    if(button){button.disabled=true;button.textContent='Спросить';}
    const ls=life();
    ls.maddyChat=Array.isArray(ls.maddyChat)?ls.maddyChat:[];
    ls.maddyChat.push({id:uid('maddy:'),role:'user',text});
    input.value='';
    persist();
    renderMaddyV3('ask');
    const box=document.querySelector('.v3-chat-messages');
    const thinking=document.createElement('div');
    thinking.className='v3-chat-message ai-loading';
    thinking.innerHTML='<div class="v3-chat-role">Мэдди</div><div class="v3-chat-text">Думаю…</div>';
    box?.appendChild(thinking);
    restoreMaddyChatPosition();
    try{
      const answer=await plannerDirectAI('maddy',text);
      ls.maddyChat.push({id:uid('maddy:'),role:'maddy',text:answer});
      persist();
      thinking.remove();
      renderMaddyV3('ask');
      restoreMaddyChatPosition();
    }catch(e){
      thinking.remove();
      ls.maddyChat.push({id:uid('maddy:'),role:'maddy',text:'Не получилось получить ответ ИИ: '+(e?.message||'ошибка соединения')});
      persist();
      renderMaddyV3('ask');
      restoreMaddyChatPosition();
    }finally{
      v3MaddySending=false;
      const b=document.querySelector('#maddyAskForm button');
      if(b){b.disabled=false;b.textContent='Спросить';}
    }
    return false;
  }

  function renderMaddyNotes(){
    const m=maddyData();
    document.getElementById('page').innerHTML=
      '<header class="page-head"><div class="eyebrow">Мэдди</div><h1 class="title">Заметки</h1><div class="date">Свободное пространство для мыслей, принципов и наблюдений о Мэдди.</div></header>'+
      maddyTabs('notes')+
      '<section class="card section"><div class="v3-inline-add"><input id="maddyNoteTitle" class="text-input" placeholder="Название заметки"><button class="btn" onclick="addMaddyNote()">Добавить</button></div>'+
      '<textarea id="maddyNoteBody" class="text-input v3-maddy-note-body" rows="4" placeholder="Текст заметки"></textarea>'+
      (m.notes.length?'<div class="v3-note-grid">'+m.notes.map(function(n,i){return '<article class="v3-note-card"><div class="v3-note-head"><h3>'+escV(n.title)+'</h3><button class="mini" onclick="removeMaddyNote('+i+')">×</button></div><p>'+escV(n.body).replace(/\n/g,'<br>')+'</p></article>'}).join(''):'<div class="empty">Пока нет заметок.</div>')+
      '</section>';
  }

  function addMaddyNote(){
    const title=(document.getElementById('maddyNoteTitle')?.value||'').trim(),body=(document.getElementById('maddyNoteBody')?.value||'').trim();
    if(!title&& !body){toast('Напиши заметку');return}
    maddyData().notes.unshift({id:uid('note:'),title:title||'Без названия',body:body});
    persist();renderMaddyV3('notes');
  }
  function removeMaddyNote(i){maddyData().notes.splice(i,1);persist();renderMaddyV3('notes')}

  function renderMaddyMoodboard(){
    const m=maddyData();
    document.getElementById('page').innerHTML=
      '<header class="page-head"><div class="eyebrow">Мэдди</div><h1 class="title">Moodboard</h1><div class="date">Визуальный образ жизни и личности, к которой ты идёшь.</div></header>'+
      maddyTabs('moodboard')+
      '<section class="card section"><div class="v3-inline-add"><input id="maddyMoodUrl" class="text-input" placeholder="Ссылка на изображение"><input id="maddyMoodCaption" class="text-input" placeholder="Подпись, необязательно"><button class="btn" onclick="addMaddyMood()">Добавить</button></div>'+
      (m.moodboard.length?'<div class="v3-mood-grid">'+m.moodboard.map(function(x,i){return '<article class="v3-mood-card"><img src="'+escV(x.url)+'" alt=""><div class="v3-mood-caption">'+escV(x.caption||'')+'</div><button class="mini" onclick="removeMaddyMood('+i+')">×</button></article>'}).join(''):'<div class="empty">Добавь изображения, которые описывают твою Мэдди и её жизнь.</div>')+
      '</section>';
  }
  function addMaddyMood(){
    const url=(document.getElementById('maddyMoodUrl')?.value||'').trim();if(!url){toast('Добавь ссылку на изображение');return}
    maddyData().moodboard.push({id:uid('mood:'),url:url,caption:(document.getElementById('maddyMoodCaption')?.value||'').trim()});
    persist();renderMaddyV3('moodboard');
  }
  function removeMaddyMood(i){maddyData().moodboard.splice(i,1);persist();renderMaddyV3('moodboard')}

  function renderMaddyV3(view){
    ensureLifeSystemData();
    maddyData().identity=maddyData().identity||'';
    renderMaddyMainV3();
  }

  function injectV3Styles(){
    if(document.getElementById('itgirl-v3-styles'))return;
    const s=document.createElement('style');s.id='itgirl-v3-styles';
    s.textContent=
      '.itgirl-v3-system-nav .side-icon{width:18px;display:inline-grid;place-items:center;font-size:15px;color:var(--accent)}'+
      '.v3-goals-summary{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:24px}'+
      '.v3-big-number,.v3-stat-number{font-family:Georgia,serif;font-size:38px;line-height:1}'+
      '.v3-summary-copy,.v3-insight-copy{font-size:12px;color:var(--muted);line-height:1.5;max-width:650px}'+
      '.v3-goals-grid{display:grid;gap:12px}.v3-goal-card{padding:18px}.v3-goal-top{display:flex;justify-content:space-between;gap:15px}.v3-goal-card h2{font-family:Georgia,serif;font-size:21px;font-weight:400;margin:5px 0 0}.v3-goal-values{display:flex;gap:10px;align-items:center;font-family:Georgia,serif;font-size:18px;margin:18px 0 10px}.v3-goal-values b{font-family:inherit;color:var(--muted);font-weight:400}.v3-goal-progress-row{display:flex;justify-content:space-between;gap:10px;color:var(--muted);font-size:10px;margin-top:5px}.v3-goal-deadline{color:var(--muted)}.v3-goal-block{margin-top:15px;padding-top:13px;border-top:1px solid var(--line)}.v3-bullet,.v3-action{font-size:12px;color:#5f5658;margin-top:8px;padding-left:14px;position:relative}.v3-bullet:before{content:\"\";position:absolute;left:2px;top:6px;width:4px;height:4px;border-radius:50%;background:var(--accent)}.v3-action:before{content:\"→\";position:absolute;left:0;color:var(--accent)}.v3-goal-footer{display:flex;justify-content:flex-end;margin-top:16px}.v3-empty-card{padding:35px;text-align:center}.v3-empty-card p{color:var(--muted);font-size:13px;line-height:1.5}.v3-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.v3-stat-card p{font-size:11px;color:var(--muted);margin:9px 0 0}.v3-progress-goal{margin:14px 0}.v3-progress-goal>div:first-child{display:flex;justify-content:space-between;font-size:12px;margin-bottom:7px}.v3-progress-goal b{font-weight:400;color:var(--accent)}.v3-insight-title{font-family:Georgia,serif;font-size:19px;font-weight:400;margin:9px 0}.v3-mentor-hero{display:grid;grid-template-columns:1fr auto;gap:20px;align-items:center}.v3-mentor-recommendation{font-family:Georgia,serif;font-size:18px;line-height:1.4;margin-top:7px;max-width:780px}.v3-chat-messages{display:grid;gap:10px;max-height:470px;overflow:auto;padding:4px 0 12px}.v3-chat-message{max-width:82%;padding:12px 14px;border-radius:14px;background:#f7f0ee}.v3-chat-message.user{margin-left:auto;background:var(--accent-soft)}.v3-chat-role{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:5px}.v3-chat-text{font-size:13px;line-height:1.5}.v3-chat-empty{padding:25px;text-align:center;color:var(--muted);font-size:12px}.v3-chat-input-row{display:grid;grid-template-columns:1fr auto;gap:10px;border-top:1px solid var(--line);padding-top:12px}.v3-chat-input-row .text-input{resize:vertical}.v3-chip-list{display:flex;gap:7px;flex-wrap:wrap}.v3-chip-list span{padding:7px 10px;border-radius:999px;background:var(--accent-soft);color:var(--accent);font-size:10px}.v3-analysis-text{font-family:Georgia,serif;font-size:18px;line-height:1.5;max-width:900px}.v3-next-row{display:grid;grid-template-columns:28px 1fr;gap:10px;align-items:center;padding:11px 0;border-bottom:1px solid var(--line);font-size:13px}.v3-next-row:last-child{border-bottom:0}.v3-next-row>span{width:25px;height:25px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;font-size:10px}.v3-maddy-tabs{display:flex;gap:4px;flex-wrap:wrap;margin:0 0 14px;padding:3px;background:#eee7e4;border-radius:12px;width:max-content;max-width:100%}.v3-maddy-tabs button{border:0;background:transparent;color:#71686a;border-radius:9px;padding:8px 11px;font-size:11px}.v3-maddy-tabs button.active{background:#fff;color:var(--accent)}.v3-inline-add{display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:12px}.v3-list-editor{display:grid;gap:7px}.v3-list-row{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:11px 12px;border:1px solid var(--line);border-radius:11px;background:#fff;font-size:13px}.v3-list-row span{min-width:0}.v3-note-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.v3-note-card{border:1px solid var(--line);border-radius:13px;padding:14px;background:#fff}.v3-note-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.v3-note-card h3{font-family:Georgia,serif;font-weight:400;font-size:16px;margin:0}.v3-note-card p{font-size:12px;line-height:1.5;color:#5f5658;margin:10px 0 0}.v3-maddy-note-body{margin-bottom:12px;min-height:110px}.v3-mood-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.v3-mood-card{position:relative;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff}.v3-mood-card img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block}.v3-mood-caption{padding:9px 11px;font-size:11px;color:var(--muted)}.v3-mood-card>.mini{position:absolute;right:7px;top:7px;background:rgba(255,255,255,.9)}'+
      '.ai-style-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ai-style-grid .field{min-width:0}.ai-style-checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:14px 0}.ai-style-checks label{display:flex;align-items:center;gap:8px;font-size:12px;color:#5f5658}.ai-style-checks input{width:17px;height:17px;margin:0}@media(max-width:700px){.ai-style-grid,.ai-style-checks{grid-template-columns:1fr}}'+
      '@media(max-width:900px){.v3-stat-grid{grid-template-columns:1fr 1fr}.v3-goals-summary{grid-template-columns:1fr}.v3-mentor-hero{grid-template-columns:1fr}.v3-mood-grid{grid-template-columns:1fr 1fr}}'+
      '@media(max-width:700px){.v3-stat-grid{grid-template-columns:1fr 1fr}.v3-chat-input-row{grid-template-columns:1fr}.v3-chat-message{max-width:92%}.v3-maddy-tabs{width:100%;overflow:auto;flex-wrap:nowrap}.v3-maddy-tabs button{white-space:nowrap}.v3-note-grid,.v3-mood-grid{grid-template-columns:1fr}.v3-goal-values{font-size:16px}.v3-big-number{font-size:34px}}';
    document.head.appendChild(s);
  }

  function install(){
    ensureLifeSystemData();
    injectV3Styles();
    addSideNavigation();

    if(!window.__itGirlOriginalRenderSettingsV3 && window.renderSettings){
      window.__itGirlOriginalRenderSettingsV3=window.renderSettings;
      window.renderSettings=function(){window.__itGirlOriginalRenderSettingsV3();renderAIStyleCard();};
    }

    const originalGo=window.go;
    if(!window.__itGirlOriginalGoV3){
      window.__itGirlOriginalGoV3=originalGo;
      window.go=function(page){
        ensureLifeSystemData();
        if(page==='mentor'||page==='progress'||page==='weekly'||page==='goals'){page='today';}
        const result=window.__itGirlOriginalGoV3(page);
        setActivePage(page);
        return result;
      };
    }

    if(!window.__itGirlOriginalRenderMaddy){
      window.__itGirlOriginalRenderMaddy=window.renderMaddy;
      window.renderMaddy=function(){renderMaddyV3('main')};
    }

    document.addEventListener('keydown',function(e){
      if(e.target && (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') && e.key==='Enter' && (e.metaKey||e.ctrlKey)){
        if(document.getElementById('v3MentorInput')===e.target)sendMentorMessage();
        if(document.getElementById('maddyAskInput')===e.target)askMaddyV3();
      }
    });

    persist();
    if(currentPage==='maddy') renderMaddyV3('main');
    else setActivePage(currentPage||'today');
  }

  window.ensureLifeSystemData=ensureLifeSystemData;
  window.renderGoalsV3=renderGoalsV3;
  window.openV3GoalModal=openV3GoalModal;
  window.saveV3Goal=saveV3Goal;
  window.renderProgressV3=renderProgressV3;
  window.renderMentorV3=renderMentorV3;
  window.sendMentorMessage=sendMentorMessage;
  window.addMentorRecommendation=addMentorRecommendation;
  window.renderWeeklyV3=renderWeeklyV3;
  window.renderMaddyV3=renderMaddyV3;
  window.saveMaddyArray=saveMaddyArray;
  window.removeMaddyArray=removeMaddyArray;
  window.askMaddyV3=askMaddyV3;
  window.addMaddyNote=addMaddyNote;
  window.removeMaddyNote=removeMaddyNote;
  window.addMaddyMood=addMaddyMood;
  window.removeMaddyMood=removeMaddyMood;
  window.saveAIStyle=saveAIStyle;
  window.renderAIStyleCard=renderAIStyleCard;

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
