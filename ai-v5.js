(function(){
'use strict';
function escA(v){return typeof esc==='function'?esc(v):String(v==null?'':v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function chatData(){var ls=state.lifeSystem=state.lifeSystem||{};ls.maddyChat=Array.isArray(ls.maddyChat)?ls.maddyChat:[];return ls.maddyChat}
function md(v){var s=escA(v);s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');return s.split(/\n{2,}/).map(function(x){return '<p>'+x.replace(/\n/g,'<br>')+'</p>'}).join('')}
function render(){
 document.body.classList.add('maddy-chat-mode');
 var page=document.getElementById('page');if(!page)return;
 var msgs=chatData();
 var html='<header class="page-head av5-head"><div class="eyebrow">Мэдди</div><h1 class="title">Спроси Мэдди</h1><div class="date">Твоя личная AI-собеседница. Без отдельного «режима коуча» — просто нормальный живой диалог.</div></header>';
 html+='<section class="av5-chat"><div class="av5-chat-top"><div><b>Maddy AI</b><span>на связи</span></div><button onclick="av5Clear()">Очистить</button></div>';
 if(!msgs.length)html+='<div class="av5-welcome"><div class="av5-avatar">M</div><h2>О чём думаешь?</h2><p>Расскажи ситуацию как есть. Я посмотрю на неё через правила и ценности Мэдди.</p><div class="av5-chips"><button onclick="av5Ask(\\'Что Мэдди сделала бы на моём месте?\\')">Что бы сделала Мэдди?</button><button onclick="av5Ask(\\'Я сейчас застряла. Что мне делать первым шагом?\\')">Я застряла. Что делать?</button><button onclick="av5Ask(\\'Разбери мою ситуацию честно, без попытки меня успокоить.\\')">Разбери честно</button></div></div>';
 else html+='<div class="av5-messages" id="av5messages">'+msgs.map(function(m){return '<div class="av5-msg '+(m.role==='user'?'user':'ai')+'"><div class="av5-bubble">'+md(m.text||'')+'</div></div>'}).join('')+'</div>';
 html+='<form class="av5-composer" id="av5form" onsubmit="return av5Send(event)"><textarea id="maddyAskInput" rows="1" placeholder="Сообщение Мэдди…" autocomplete="off"></textarea><button type="submit" aria-label="Отправить"><svg viewBox="0 0 24 24"><path d="M4 12 20 4l-4 16-4.5-6.5L4 12Z"></path><path d="M11.5 13.5 20 4"></path></svg></button></form></section>';
 page.innerHTML=html;
 var box=document.getElementById('av5messages');if(box)box.scrollTop=box.scrollHeight;
 var inp=document.getElementById('maddyAskInput');if(inp){inp.addEventListener('input',function(){this.style.height='auto';this.style.height=Math.min(this.scrollHeight,150)+'px'});inp.focus()}
}
window.av5Ask=function(v){var x=document.getElementById('maddyAskInput');if(x){x.value=v;x.focus()}};
window.av5Send=async function(ev){
 if(ev)ev.preventDefault();
 var x=document.getElementById('maddyAskInput');if(!x||!x.value.trim())return false;
 if(window.__av5Sending)return false;
 window.__av5Sending=true;
 var old=window.askMaddyV3;
 try{await old({preventDefault:function(){},target:document.getElementById('av5form')});}finally{window.__av5Sending=false;render()}
 return false;
};
window.av5Clear=function(){if(!confirm('Очистить историю диалога?'))return;chatData().length=0;persist();render()};
function patch(){
 if(window.__av5ai)return;window.__av5ai=1;
 var oldRender=window.renderMaddyV3;
 window.renderMaddyV3=function(v){if(v==='ask'){render();return}return oldRender(v)};
 var oldAsk=window.askMaddyV3;
 window.askMaddyV3=async function(ev){var r=await oldAsk(ev);return r};
}
function css(){
 if(document.getElementById('av5css'))return;
 var s=document.createElement('style');s.id='av5css';s.textContent='\
.av5-head{margin-bottom:16px}.av5-chat{max-width:900px;background:var(--card);border:1px solid var(--line);border-radius:18px;overflow:hidden;min-height:560px;display:flex;flex-direction:column}.av5-chat-top{height:54px;padding:0 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}.av5-chat-top div{display:flex;align-items:center;gap:8px}.av5-chat-top b{font-size:13px;font-weight:500}.av5-chat-top span{font-size:10px;color:#5f8a68}.av5-chat-top button{border:0;background:transparent;color:var(--muted);font-size:10px}.av5-messages{flex:1;padding:22px 18px;display:grid;gap:14px;overflow:auto;max-height:620px}.av5-msg{display:flex}.av5-msg.user{justify-content:flex-end}.av5-bubble{max-width:78%;font-size:13px;line-height:1.55;color:#332d2f}.av5-msg.user .av5-bubble{background:var(--accent-soft);padding:10px 13px;border-radius:15px 15px 5px 15px}.av5-msg.ai .av5-bubble{max-width:720px}.av5-bubble p{margin:0 0 9px}.av5-bubble p:last-child{margin-bottom:0}.av5-welcome{flex:1;min-height:420px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px}.av5-avatar{width:46px;height:46px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;font-family:Georgia,serif;font-size:21px;margin-bottom:12px}.av5-welcome h2{font-family:Georgia,serif;font-weight:400;font-size:24px;margin:0 0 7px}.av5-welcome p{font-size:12px;color:var(--muted);max-width:430px;line-height:1.5;margin:0 0 18px}.av5-chips{display:flex;gap:7px;flex-wrap:wrap;justify-content:center}.av5-chips button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:8px 11px;font-size:10px;color:#5f5658}.av5-chips button:hover{border-color:#cdb5ba;color:var(--accent)}.av5-composer{display:grid;grid-template-columns:1fr 42px;gap:8px;padding:12px;border-top:1px solid var(--line);background:#fff}.av5-composer textarea{resize:none;min-height:42px;max-height:150px;border:1px solid var(--line);border-radius:13px;padding:11px 13px;outline:0;font-size:13px;line-height:1.35;background:#faf8f7}.av5-composer textarea:focus{border-color:#caa3aa}.av5-composer button{width:42px;height:42px;border:0;border-radius:12px;background:var(--accent);color:#fff;display:grid;place-items:center}.av5-composer svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}@media(max-width:700px){.av5-chat{min-height:calc(100vh - 150px);border-radius:16px}.av5-bubble{max-width:88%;font-size:13px}.av5-messages{padding:18px 12px}.av5-welcome{padding:20px}.av5-chips{display:grid;width:100%}.av5-chips button{width:100%}}';
 document.head.appendChild(s)
}
function install(){css();patch()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();