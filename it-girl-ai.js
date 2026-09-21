/* Real AI layer for It Girl Planner. The OpenAI key stays server-side in Supabase. */
(function(){
  'use strict';
  const AI_URL='https://ajrcehwxqgbloixgvcxc.supabase.co/functions/v1/it-girl-ai';

  function aiContext(){
    ensureLifeSystemData();
    const goals=Array.isArray(state.goals)?state.goals:[];
    const tasks=Array.isArray(state.tasks)?state.tasks:[];
    const today=typeof todayISO==='function'?todayISO():new Date().toISOString().slice(0,10);
    const mondayFn=typeof monday==='function'?monday:new Date;
    let weekly={};
    try{
      const ws=typeof weekStats==='function'?weekStats():{};
      weekly={taskPct:ws.taskPct||0,taskDone:ws.taskDone||0,taskTotal:ws.taskTotal||0,habitPct:ws.habitPct||0,habitDone:ws.habitDone||0,habitTotal:ws.habitTotal||0};
    }catch(e){}
    return {
      goals:goals.map(g=>({title:g.title,progress:Number(g.progress)||0,current:g.currentValue||'',target:g.targetValue||g.target||'',unit:g.unit||'',deadline:g.deadline||'',actions:g.actions||[],subgoals:g.subgoals||[]})),
      todayTasks:tasks.filter(t=>t.date===today && !t.done).map(t=>({title:t.title,priority:t.priority||'',area:t.area||'',start:t.start||'',end:t.end||''})),
      weekly,
      maddy:state.lifeSystem.maddy,
      aiStyle:state.lifeSystem.aiStyle
    };
  }

  async function askAI(kind,message){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),30000);
    try{
      let r;
      let lastError;
      for(let attempt=0;attempt<2;attempt++){
        try{
          r=await fetch(AI_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8','Accept':'application/json'},body:JSON.stringify({kind,message,context:aiContext()}),signal:controller.signal,cache:'no-store',mode:'cors'});
          lastError=null;
          break;
        }catch(err){
          lastError=err;
          if(attempt===0) await new Promise(resolve=>setTimeout(resolve,700));
        }
      }
      if(lastError) throw lastError;
      let data={}; try{data=await r.json()}catch(e){}
      if(!r.ok) throw new Error(data.error||('AI request failed ('+r.status+')'));
      const answer=normalizeAIText(data.text);
      if(!answer) throw new Error('ИИ не вернул текстовый ответ');
      return answer;
    }catch(e){
      if(e?.name==='AbortError') throw new Error('ИИ не ответил за 30 секунд. Попробуй ещё раз.');
      throw e;
    }finally{clearTimeout(timer)}
  }

  function normalizeAIText(value){
    return String(value||'').replace(/\\n/g,'\n').trim();
  }

  function setButtonLoading(id,loading,label){
    const b=document.getElementById(id); if(!b)return;
    b.disabled=loading; b.textContent=loading?'Думаю…':label;
  }

  async function realSendMentorMessage(){
    const input=document.getElementById('v3MentorInput');
    const text=String(input?.value||'').trim(); if(!text)return;
    const ls=ensureLifeSystemData();
    ls.mentorMessages.push({id:'msg:'+Date.now()+':u',role:'user',text,createdAt:new Date().toISOString()});
    input.value=''; persist(); renderMentorV3();
    try{
      const answer=await askAI('mentor',text);
      ls.mentorMessages.push({id:'msg:'+Date.now()+':a',role:'mentor',text:answer,createdAt:new Date().toISOString()});
      persist(); renderMentorV3();
    }catch(e){
      console.error(e);
      ls.mentorMessages.push({id:'msg:'+Date.now()+':e',role:'mentor',text:'Не получилось получить ответ ИИ: '+(e?.message||'неизвестная ошибка'),createdAt:new Date().toISOString()});
      persist(); renderMentorV3();
    }
  }

  async function realAskMaddy(){
    const input=document.getElementById('maddyAskInput');
    const text=String(input?.value||'').trim(); if(!text)return;
    const ls=ensureLifeSystemData();
    ls.maddyChat=Array.isArray(ls.maddyChat)?ls.maddyChat:[];
    const savedScrollY=window.scrollY||window.pageYOffset||0;
    ls.maddyChat.push({id:'maddy:'+Date.now()+':u',role:'user',text});
    input.value=''; persist(); renderMaddyV3('ask');
    requestAnimationFrame(()=>window.scrollTo(0,savedScrollY));
    try{
      const answer=await askAI('maddy',text);
      ls.maddyChat.push({id:'maddy:'+Date.now()+':a',role:'maddy',text:answer});
      persist();
      const responseScrollY=window.scrollY||window.pageYOffset||savedScrollY;
      renderMaddyV3('ask');
      requestAnimationFrame(()=>window.scrollTo(0,responseScrollY));
    }catch(e){
      console.error(e);
      ls.maddyChat.push({id:'maddy:'+Date.now()+':e',role:'maddy',text:'Не получилось получить ответ ИИ: '+(e?.message||'неизвестная ошибка')});
      persist();
      const errorScrollY=window.scrollY||window.pageYOffset||savedScrollY;
      renderMaddyV3('ask');
      requestAnimationFrame(()=>window.scrollTo(0,errorScrollY));
    }
  }

  async function runAIWeeklyAnalysis(){
    const box=document.getElementById('v3AIWeeklyAnalysis');
    const btn=document.getElementById('v3AIWeeklyButton');
    if(!box)return;
    btn?.setAttribute('disabled','disabled');
    if(btn)btn.textContent='Анализирую…';
    box.innerHTML='<div class="empty">ИИ анализирует твою неделю…</div>';
    try{
      const answer=await askAI('mentor','Сделай глубокий, но практичный анализ моей недели. Покажи: что реально сработало, где я теряю время, какая цель сейчас требует внимания, что убрать из плана и какие 3 действия сделать на следующей неделе. Не придумывай факты, используй только данные приложения.');
      box.innerHTML='<div class="v3-analysis-text">'+esc(answer).replace(/\n/g,'<br>')+'</div>';
      const ls=ensureLifeSystemData();
      ls.weeklyReviews=Array.isArray(ls.weeklyReviews)?ls.weeklyReviews:[];
      ls.weeklyReviews.unshift({id:Date.now(),type:'ai',text:answer,createdAt:new Date().toISOString()});
      ls.weeklyReviews=ls.weeklyReviews.slice(0,12);
      persist();
    }catch(e){
      console.error(e); box.innerHTML='<div class="empty">Не удалось получить AI-анализ. Проверь подключение AI в проекте.</div>';
    }finally{
      if(btn){btn.disabled=false;btn.textContent='Получить AI-анализ';}
    }
  }

  const originalWeekly=window.renderWeeklyV3;
  window.renderWeeklyV3=function(){
    originalWeekly();
    const page=document.getElementById('page');
    if(!page || document.getElementById('v3AIWeeklyCard'))return;
    const card=document.createElement('section');
    card.className='card section'; card.id='v3AIWeeklyCard';
    card.innerHTML='<div class="section-head"><div><div class="label">AI</div><h2>Разбор недели от ИИ</h2></div><button class="btn" id="v3AIWeeklyButton" onclick="runAIWeeklyAnalysis()">Получить AI-анализ</button></div><div id="v3AIWeeklyAnalysis" class="v3-ai-weekly-box"><div class="empty">Нажми кнопку — ИИ разберёт реальные данные твоей недели.</div></div>';
    page.appendChild(card);
  };

  window.sendMentorMessage=realSendMentorMessage;
  window.askMaddyV3=realAskMaddy;
  window.runAIWeeklyAnalysis=runAIWeeklyAnalysis;

  if(!document.getElementById('itgirl-ai-styles')){
    const s=document.createElement('style'); s.id='itgirl-ai-styles';
    s.textContent='.v3-ai-weekly-box{min-height:30px}.v3-ai-weekly-box .v3-analysis-text{margin-top:8px}.v3-chat-message.ai-loading{opacity:.65}';
    document.head.appendChild(s);
  }
})();
