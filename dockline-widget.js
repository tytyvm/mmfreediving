/* ────────────────────────────────────────────────────────────────
   MM Freediving — chat widget
   Self-contained. Configure via window.DocklineConfig before this loads:
     window.DocklineConfig = {
       apiUrl:  'https://your-backend/chat',   // required
       brand:   'MM Freediving',               // header title
       accent:  '#3a8fa8',                     // accent color
       greeting:'Hi! Ask me anything...'       // first bot message
     };
   ──────────────────────────────────────────────────────────────── */
(function () {
  var CFG = window.DocklineConfig || {};
  var API = CFG.apiUrl;
  if (!API) { console.error('[chat] Missing DocklineConfig.apiUrl'); return; }
  var BRAND    = CFG.brand    || 'Chat';
  var ACCENT   = CFG.accent   || '#3a8fa8';
  var ACCENT_D = CFG.accentDeep || '#276e85';
  var GREETING = CFG.greeting || 'Hi! How can I help?';

  // Stable session id for the visit (persists across page navigations)
  var sid;
  try {
    sid = sessionStorage.getItem('dl_sid');
    if (!sid) {
      sid = (crypto.randomUUID && crypto.randomUUID()) ||
            ('s-' + Date.now() + '-' + Math.random().toString(36).slice(2));
      sessionStorage.setItem('dl_sid', sid);
    }
  } catch (e) { sid = 's-' + Date.now(); }

  // ---- styles ----
  var css = `
  .dl-fab{position:fixed;bottom:1.5rem;right:1.5rem;z-index:9998;width:60px;height:60px;border-radius:50%;
    background:${ACCENT};color:#fff;border:none;cursor:pointer;box-shadow:0 8px 24px rgba(28,43,50,.32);
    display:flex;align-items:center;justify-content:center;transition:transform .25s,background .25s}
  .dl-fab:hover{background:${ACCENT_D};transform:translateY(-2px)}
  .dl-fab svg{width:26px;height:26px}
  .dl-fab.dl-open{transform:scale(.9);opacity:0}
  .dl-panel{position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;width:370px;max-width:calc(100vw - 2rem);
    height:540px;max-height:calc(100vh - 3rem);background:#faf7f2;border-radius:18px;overflow:hidden;
    display:none;flex-direction:column;box-shadow:0 18px 50px rgba(28,43,50,.34);
    font-family:'DM Sans',system-ui,sans-serif}
  .dl-panel.dl-show{display:flex;animation:dlUp .28s ease}
  @keyframes dlUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  .dl-head{background:linear-gradient(135deg,${ACCENT},${ACCENT_D});color:#fff;padding:1rem 1.2rem;
    display:flex;align-items:center;justify-content:space-between;flex:none}
  .dl-head b{font-family:'Cormorant Garamond',Georgia,serif;font-weight:500;font-size:1.3rem;letter-spacing:.02em}
  .dl-head small{display:block;font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;opacity:.8;margin-top:2px}
  .dl-x{background:none;border:none;color:#fff;cursor:pointer;font-size:1.4rem;line-height:1;opacity:.85;padding:0 .2rem}
  .dl-x:hover{opacity:1}
  .dl-body{flex:1;overflow-y:auto;padding:1.1rem;display:flex;flex-direction:column;gap:.7rem;background:#faf7f2}
  .dl-msg{max-width:80%;padding:.65rem .9rem;border-radius:14px;font-size:.9rem;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}
  .dl-bot{align-self:flex-start;background:#fff;color:#1c2b32;border:1px solid #e8ddd0;border-bottom-left-radius:4px}
  .dl-user{align-self:flex-end;background:${ACCENT};color:#fff;border-bottom-right-radius:4px}
  .dl-typing{align-self:flex-start;background:#fff;border:1px solid #e8ddd0;border-radius:14px;padding:.7rem 1rem;display:flex;gap:4px}
  .dl-typing i{width:7px;height:7px;border-radius:50%;background:#9e9488;display:inline-block;animation:dlBlink 1.2s infinite}
  .dl-typing i:nth-child(2){animation-delay:.2s}.dl-typing i:nth-child(3){animation-delay:.4s}
  @keyframes dlBlink{0%,60%,100%{opacity:.25}30%{opacity:1}}
  .dl-foot{flex:none;padding:.75rem;border-top:1px solid #e8ddd0;background:#fff;display:flex;gap:.5rem}
  .dl-foot input{flex:1;border:1px solid #e8ddd0;border-radius:999px;padding:.7rem 1rem;font-size:.9rem;
    font-family:inherit;outline:none;background:#faf7f2;color:#1c2b32}
  .dl-foot input:focus{border-color:${ACCENT}}
  .dl-send{background:${ACCENT};border:none;color:#fff;width:42px;height:42px;border-radius:50%;cursor:pointer;
    flex:none;display:flex;align-items:center;justify-content:center;transition:background .25s}
  .dl-send:hover{background:${ACCENT_D}}
  .dl-send:disabled{opacity:.5;cursor:default}
  @media (max-width:480px){.dl-panel{bottom:0;right:0;width:100vw;max-width:100vw;height:100vh;max-height:100vh;border-radius:0}}
  `;
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // ---- markup ----
  var fab = document.createElement('button');
  fab.className = 'dl-fab'; fab.setAttribute('aria-label', 'Open chat');
  fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

  var panel = document.createElement('div');
  panel.className = 'dl-panel';
  panel.innerHTML =
    '<div class="dl-head"><div><b>' + esc(BRAND) + '</b><small>Ask us anything</small></div>' +
    '<button class="dl-x" aria-label="Close">&times;</button></div>' +
    '<div class="dl-body"></div>' +
    '<div class="dl-foot"><input type="text" placeholder="Type your question..." autocomplete="off"/>' +
    '<button class="dl-send" aria-label="Send"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button></div>';

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  var body  = panel.querySelector('.dl-body');
  var input = panel.querySelector('.dl-foot input');
  var send  = panel.querySelector('.dl-send');
  var greeted = false;

  function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
  function add(text, who){
    var m = document.createElement('div');
    m.className = 'dl-msg ' + (who === 'user' ? 'dl-user' : 'dl-bot');
    m.textContent = text; body.appendChild(m); body.scrollTop = body.scrollHeight;
  }
  function open(){
    panel.classList.add('dl-show'); fab.classList.add('dl-open');
    if (!greeted){ add(GREETING, 'bot'); greeted = true; }
    setTimeout(function(){ input.focus(); }, 100);
  }
  function close(){ panel.classList.remove('dl-show'); fab.classList.remove('dl-open'); }

  fab.addEventListener('click', open);
  panel.querySelector('.dl-x').addEventListener('click', close);

  function ask(){
    var text = input.value.trim();
    if (!text) return;
    add(text, 'user'); input.value = ''; input.disabled = send.disabled = true;

    var typing = document.createElement('div');
    typing.className = 'dl-typing'; typing.innerHTML = '<i></i><i></i><i></i>';
    body.appendChild(typing); body.scrollTop = body.scrollHeight;

    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sid, message: text })
    })
    .then(function(r){ return r.json(); })
    .then(function(d){
      typing.remove();
      add((d && d.reply) ? d.reply : "Sorry, I didn't catch that. Try again?", 'bot');
    })
    .catch(function(){
      typing.remove();
      add("I'm having trouble connecting. Please email mmfreediving@gmail.com and we'll help you out.", 'bot');
    })
    .finally(function(){
      input.disabled = send.disabled = false; input.focus();
    });
  }

  send.addEventListener('click', ask);
  input.addEventListener('keydown', function(e){ if (e.key === 'Enter') ask(); });
})();
