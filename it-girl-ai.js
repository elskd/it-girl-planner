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

  function inlineMarkdown(value){
    let s=String(value??'');
    // AI sometimes escapes Markdown markers. Turn those back into real markers first.
    s=s.replace(/\\\\([*_[\\]{}()#+.!~-])/g,'$1');
    s=escV(s);
    s=s.replace(/\\`([^\\`\\n]+)\\`/g,'<code>$1</code>');
    s=s.replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>');
    s=s.replace(/__([^_\\n]+?)__/g,'<strong>$1</strong>');
    s=s.replace(/~~([^~\\n]+?)~~/g,'<del>$1</del>');
    s=s.replace(/(?<!\\*)\\*([^*\\n]+?)\\*(?!\\*)/g,'<em>$1</em>');
    s=s.replace(/(?<!_)_([^_\\n]+?)_(?!_)/g,'<em>$1</em>');
    return s;
  }

  function markdownToHTML(value){
    const lines=normalizeAIText(value).split('\\n');
    const out=[];
    let paragraph=[];
    let listType=null;
    let quote=[];
    function flushParagraph(){
      if(!paragraph.length)return;
      out.push('<p>'+paragraph.map(inlineMarkdown).join('<br>')+'</p>');
      paragraph=[];
    }
    function flushList(){
      if(!listType)return;
      out.push('</'+listType+'>');
      listType=null;
    }
    function flushQuote(){
      if(!quote.length)return;
      out.push('<blockquote>'+quote.map(inlineMarkdown).join('<br>')+'</blockquote>');
      quote=[];
    }
    function closeBlocks(){
      flushParagraph();
      flushList();
      flushQuote();
    }

    for(let i=0;i<lines.length;i++){
      const line=String(lines[i]??'');
      const trimmed=line.trim();

      if(!trimmed){ closeBlocks(); continue; }

      let m=line.match(/^\\s{0,3}(#{1,6})\\s+(.+?)\\s*#*\\s*$/);
      if(m){ closeBlocks(); const level=m[1].length; out.push('<h'+level+'>'+inlineMarkdown(m[2])+'</h'+level+'>'); continue; }

      if(/^\\s{0,3}([-*_])(?:\\s*\\1){2,}\\s*$/.test(line)){ closeBlocks(); out.push('<hr>'); continue; }

      m=line.match(/^\\s{0,3}>\\s?(.*)$/);
      if(m){ flushParagraph(); flushList(); quote.push(m[1]); continue; }
      if(quote.length) flushQuote();

      m=line.match(/^\\s*[-•*+]\\s+(.+)$/);
      if(m){
        flushParagraph();
        if(listType!=='ul'){ flushList(); out.push('<ul>'); listType='ul'; }
        out.push('<li>'+inlineMarkdown(m[1])+'</li>');
        continue;
      }

      m=line.match(/^\\s*\\d+[.)]\\s+(.+)$/);
      if(m){
        flushParagraph();
        if(listType!=='ol'){ flushList(); out.push('<ol>'); listType='ol'; }
        out.push('<li>'+inlineMarkdown(m[1])+'</li>');
        continue;
      }

      if(listType) flushList();
      paragraph.push(line);
    }

    closeBlocks();
    return out.join('');
  }

  function rememberChatScroll(){
    return {x:window.scrollX||window.pageXOffset||0,y:window.scrollY||window.pageYOffset||0};
  }

  function restoreChatScroll(pos){
    if(!pos)return;
    const restore=()=>{
      try{window.scrollTo(pos.x,pos.y)}catch(e){}
      try{document.documentElement.scrollTop=pos.y;document.body.scrollTop=pos.y}catch(e){}
    };
    restore();
    [16,50,120,250,500].forEach(ms=>setTimeout(restore,ms));
  }

  function appendMaddyChatMessage(role,text){
    const box=document.querySelector('.v3-chat-messages');
    if(!box)return null;
    const empty=box.querySelector('.v3-chat-empty');
    if(empty)empty.remove();
    const el=document.createElement('div');
    el.className='v3-chat-message '+(role==='user'?'user':'mentor');
    el.innerHTML='<div class="v3-chat-role">'+(role==='user'?'Ты':'Мэдди')+'</div><div class="v3-chat-text md-text">'+markdownToHTML(text)+'</div>';
    box.appendChild(el);
    return el;
  }

  function formatRenderedMaddyHistory(){
    const ls=ensureLifeSystemData();
    const history=Array.isArray(ls.maddyChat)?ls.maddyChat:[];
    const nodes=document.querySelectorAll('.v3-chat-messages .v3-chat-message');
    nodes.forEach((node,i)=>{
      const msg=history[i];
      const textNode=node.querySelector('.v3-chat-text');
      if(msg&&textNode) textNode.innerHTML=markdownToHTML(msg.text);
    });
  }

  async function realAskMaddy(){
    const input=document.getElementById('maddyAskInput');
    const text=String(input?.value||'').trim(); if(!text)return;
    const scrollBefore=rememberChatScroll();
    const ls=ensureLifeSystemData();
    ls.maddyChat=Array.isArray(ls.maddyChat)?ls.maddyChat:[];
    ls.maddyChat.push({id:'maddy:'+Date.now()+':u',role:'user',text});
    input.value='';
    persist();
    const userEl=appendMaddyChatMessage('user',text);
    restoreChatScroll(scrollBefore);
    try{
      const answer=await askAI('maddy',text);
      ls.maddyChat.push({id:'maddy:'+Date.now()+':a',role:'maddy',text:answer});
      persist();
      const answerEl=appendMaddyChatMessage('maddy',answer);
      // iOS Safari can reposition the document when the keyboard closes after a DOM update.
      if(Math.abs((window.scrollY||0)-scrollBefore.y)>80) restoreChatScroll(scrollBefore);
    }catch(e){
      console.error(e);
      const errorText='Не получилось получить ответ ИИ: '+(e?.message||'неизвестная ошибка');
      ls.maddyChat.push({id:'maddy:'+Date.now()+':e',role:'maddy',text:errorText});
      persist();
      const errorEl=appendMaddyChatMessage('maddy',errorText);
      if(Math.abs((window.scrollY||0)-scrollBefore.y)>80) restoreChatScroll(scrollBefore);
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

  const originalMaddyRender=window.renderMaddyV3;
  if(typeof originalMaddyRender==='function'){
    window.renderMaddyV3=function(view){
      const pos=rememberChatScroll();
      const result=originalMaddyRender(view);
      if(view==='ask'){
        formatRenderedMaddyHistory();
        restoreChatScroll(pos);
      }
      return result;
    };
  }

  window.sendMentorMessage=realSendMentorMessage;
  window.askMaddyV3=realAskMaddy;
  window.runAIWeeklyAnalysis=runAIWeeklyAnalysis;

  if(!document.getElementById('itgirl-ai-styles')){
    const s=document.createElement('style'); s.id='itgirl-ai-styles';
    s.textContent='.v3-ai-weekly-box{min-height:30px}.v3-ai-weekly-box .v3-analysis-text{margin-top:8px}.v3-chat-message.ai-loading{opacity:.65}';
    document.head.appendChild(s);
  }
})();
