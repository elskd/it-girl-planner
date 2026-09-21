/* FINAL AI CHAT FIX — click/capture based, independent from form submit handlers. */
(function(){
  'use strict';
  if(window.__ITGIRL_FINAL_AI_FIX__) return;
  window.__ITGIRL_FINAL_AI_FIX__=true;

  const AI_URL='https://ajrcehwxqgbloixgvcxc.supabase.co/functions/v1/it-girl-ai';
  let busy=false;

  function escText(v){
    if(typeof esc==='function') return esc(String(v??''));
    return String(v??'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]});
  }

  function mdInline(v){
    let s=escText(v);
    s=s.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>');
    s=s.replace(/__([^_\n]+)__/g,'<strong>$1</strong>');
    s=s.replace(/~~([^~\n]+)~~/g,'<del>$1</del>');
    s=s.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,'<em>$1</em>');
    s=s.replace(/(?<!_)_([^_\n]+)_(?!_)/g,'<em>$1</em>');
    return s;
  }

  function md(v){
    const lines=String(v??'').replace(/\\n/g,'\n').split('\n');
    const out=[]; let p=[]; let list='';
    function fp(){if(p.length){out.push('<p>'+p.map(mdInline).join('<br>')+'</p>');p=[];}}
    function fl(){if(list){out.push('</'+list+'>');list='';}}
    lines.forEach(function(line){
      const t=line.trim();
      if(!t){fp();fl();return;}
      let m=line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
      if(m){fp();fl();const level=(line.match(/^\s{0,3}(#+)/)||['','#'])[1].length;out.push('<h'+level+'>'+mdInline(m[1])+'</h'+level+'>');return;}
      m=line.match(/^\s*[-•*+]\s+(.+)$/);
      if(m){fp();if(list!=='ul'){fl();out.push('<ul>');list='ul';}out.push('<li>'+mdInline(m[1])+'</li>');return;}
      m=line.match(/^\s*\d+[.)]\s+(.+)$/);
      if(m){fp();if(list!=='ol'){fl();out.push('<ol>');list='ol';}out.push('<li>'+mdInline(m[1])+'</li>');return;}
      if(list)fl();
      p.push(line);
    });
    fp();fl();return out.join('');
  }

  function context(){
    const s=(typeof state!=='undefined')?state:{};
    const ls=(typeof ensureLifeSystemData==='function')?ensureLifeSystemData():((s.lifeSystem)||{});
    const goals=Array.isArray(s.goals)?s.goals:[];
    const tasks=Array.isArray(s.tasks)?s.tasks:[];
    const today=typeof todayISO==='function'?todayISO():new Date().toISOString().slice(0,10);
    let weekly={};
    try{
      const w=typeof weekStats==='function'?weekStats():{};
      weekly={taskPct:w.taskPct||0,taskDone:w.taskDone||0,taskTotal:w.taskTotal||0,habitPct:w.habitPct||0,habitDone:w.habitDone||0,habitTotal:w.habitTotal||0};
    }catch(e){}
    return {
      goals:goals.map(function(g){return {title:g.title,progress:Number(g.progress)||0,current:g.currentValue||'',target:g.targetValue||g.target||'',unit:g.unit||'',deadline:g.deadline||'',actions:g.actions||[],subgoals:g.subgoals||[]};}),
      todayTasks:tasks.filter(function(t){return t.date===today&&!t.done;}).map(function(t){return {title:t.title,priority:t.priority||'',area:t.area||'',start:t.start||'',end:t.end||''};}),
      weekly:weekly,
      maddy:ls.maddy||{},
      aiStyle:ls.aiStyle||{}
    };
  }

  async function ask(kind,text){
    const controller=new AbortController();
    const timer=setTimeout(function(){controller.abort();},20000);
    try{
      const r=await fetch(AI_URL,{
        method:'POST',
        headers:{'Content-Type':'text/plain;charset=UTF-8','Accept':'application/json'},
        body:JSON.stringify({kind:kind,message:text,context:context()}),
        cache:'no-store',mode:'cors',signal:controller.signal
      });
      let data={};
      try{data=await r.json();}catch(e){}
      if(!r.ok) throw new Error(data.error||('AI request failed ('+r.status+')'));
      const answer=String(data.text||'').replace(/\\n/g,'\n').trim();
      if(!answer) throw new Error('ИИ не вернул текстовый ответ');
      return answer;
    }catch(e){
      if(e&&e.name==='AbortError') throw new Error('ИИ не ответил за 20 секунд.');
      throw e;
    }finally{clearTimeout(timer);}
  }

  function thinking(box,label){
    const el=document.createElement('div');
    el.className='v3-chat-message ai-loading';
    el.innerHTML='<div class="v3-chat-role">'+label+'</div><div class="v3-chat-text md-text">Думаю…</div>';
    box.appendChild(el);
    return el;
  }

  function renderHistory(){
    document.querySelectorAll('.v3-chat-messages .v3-chat-message').forEach(function(n){
      const t=n.querySelector('.v3-chat-text');
      if(!t || n.classList.contains('ai-loading')) return;
      t.innerHTML=md(t.textContent||'');
    });
  }

  async function send(kind){
    if(busy) return;
    const input=document.getElementById(kind==='maddy'?'maddyAskInput':'v3MentorInput');
    if(!input) return;
    const text=String(input.value||'').trim();
    if(!text) return;

    busy=true;
    const ls=ensureLifeSystemData();
    const isMaddy=kind==='maddy';
    const messages=isMaddy?(ls.maddyChat=Array.isArray(ls.maddyChat)?ls.maddyChat:[]):(ls.mentorMessages=Array.isArray(ls.mentorMessages)?ls.mentorMessages:[]);
    messages.push({id:(kind+':'+Date.now()+':u'),role:'user',text:text,createdAt:new Date().toISOString()});
    input.value='';
    persist();

    if(isMaddy) renderMaddyV3('ask'); else renderMentorV3();

    const box=document.querySelector('.v3-chat-messages');
    if(!box){busy=false;return;}
    const loader=thinking(box,isMaddy?'Мэдди':'Ментор');

    try{
      const answer=await ask(kind,text);
      messages.push({id:(kind+':'+Date.now()+':a'),role:isMaddy?'maddy':'mentor',text:answer,createdAt:new Date().toISOString()});
      persist();
      if(loader.parentNode) loader.remove();
      if(isMaddy) renderMaddyV3('ask'); else renderMentorV3();
      renderHistory();
    }catch(e){
      const error='Не получилось получить ответ ИИ: '+(e&&e.message?e.message:'ошибка соединения');
      messages.push({id:(kind+':'+Date.now()+':e'),role:isMaddy?'maddy':'mentor',text:error,createdAt:new Date().toISOString()});
      persist();
      if(loader.parentNode) loader.remove();
      if(isMaddy) renderMaddyV3('ask'); else renderMentorV3();
      renderHistory();
    }finally{
      busy=false;
    }
  }

  function targetKind(form){
    if(!form) return null;
    if(form.id==='maddyAskForm') return 'maddy';
    if(form.id==='v3MentorForm') return 'mentor';
    return null;
  }

  document.addEventListener('click',function(e){
    const button=e.target&&e.target.closest?e.target.closest('#maddyAskForm button[type="submit"],#maddyAskForm button,#v3MentorForm button[type="submit"],#v3MentorForm button'):null;
    if(!button) return;
    const form=button.closest('form');
    const kind=targetKind(form);
    if(!kind) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if(!busy){
      button.disabled=true;
      send(kind).finally(function(){
        const b=document.querySelector(kind==='maddy'?'#maddyAskForm button':'#v3MentorForm button');
        if(b){b.disabled=false;b.textContent=kind==='maddy'?'Спросить':'Отправить';}
      });
    }
  },true);

  document.addEventListener('submit',function(e){
    const kind=targetKind(e.target);
    if(!kind) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  },true);

  document.addEventListener('keydown',function(e){
    if(e.key!=='Enter'||e.shiftKey) return;
    const input=e.target;
    if(input&&input.id==='maddyAskInput'){e.preventDefault();send('maddy');}
    if(input&&input.id==='v3MentorInput'){e.preventDefault();send('mentor');}
  },true);

  const style=document.createElement('style');
  style.textContent='.v3-chat-message.ai-loading{opacity:.65}.v3-chat-message.ai-loading .v3-chat-text{font-style:italic}.md-text p{margin:0 0 9px}.md-text p:last-child{margin-bottom:0}.md-text h1,.md-text h2,.md-text h3,.md-text h4{font-family:Georgia,serif;font-weight:400;margin:10px 0 7px}.md-text ul,.md-text ol{margin:7px 0 9px;padding-left:20px}.md-text li{margin:3px 0}.md-text strong{font-weight:700}.md-text em{font-style:italic}.md-text del{text-decoration:line-through}';
  document.head.appendChild(style);

  window.__itGirlFinalAISend=send;
})();