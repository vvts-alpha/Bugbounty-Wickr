// CHILD 'self' module — faithfully models the file-preview renderer sinks.
// It is APP code (loaded from 'self'); the ATTACKER controls only `payload` (file bytes).
const root = document.getElementById('preview-root');
const clog = (...a) => console.log('[PREVIEW]', ...a);
const P = new URLSearchParams(location.search);
const mode = P.get('mode') || 'docx';
const payloadName = P.get('payload') || 'baseline_inline_script';

// prove same-origin reach (A8: iframe_can_read_parent_bridge:true)
let reach = false;
try { reach = !!(window.parent && window.parent.qt && window.parent.qt.webChannelTransport); } catch(e){}
clog('iframe_can_read_parent_bridge =', reach);

async function run() {
  if (mode === 'poscontrol') {
    // POSITIVE CONTROL: a legit 'self' script writing top marker — proves the win-detector works.
    try { window.top.__RCE__ = 'POSCONTROL_selfscript_ran'; } catch(e){ clog('poscontrol threw', String(e)); }
    try { window.parent.postMessage({type:'openLink', url:'https://poscontrol.example/attacker'}, '*'); } catch(e){}
    clog('poscontrol executed');
    return;
  }
  let payload = '';
  try { payload = await (await fetch('/payloads/' + payloadName + '.txt')).text(); }
  catch(e){ clog('payload fetch failed', String(e)); return; }
  payload = payload.replace(/\n$/,''); // strip trailing newline

  if (mode === 'docx') {
    // EXACT docx-preview renderSymbol sink: t.innerHTML = `&#x${e.char};`
    // Attacker controls e.char (the whole payload string).
    root.innerHTML = "&#x" + payload + ";";
    clog('docx renderSymbol sink applied; payload len', payload.length);
  } else if (mode === 'docx_raw') {
    root.innerHTML = payload; // worst-case raw innerHTML
    clog('docx raw innerHTML applied');
  } else if (mode === 'altchunk') {
    // EXACT docx-preview renderAltChunk sink: createElement('iframe'); iframe.srcdoc = <attacker part bytes>.
    // NO sandbox attribute (faithful). srcdoc parses as a fresh DOCUMENT (parser-inserted scripts, unlike innerHTML).
    const t = document.createElement('iframe');
    t.width='880'; t.height='90';
    t.srcdoc = payload;          // attacker fully controls the afchunk.html bytes
    root.appendChild(t);
    clog('altChunk srcdoc iframe created (no sandbox); payload len', payload.length);
  } else if (mode === 'pptx') {
    const { default: DOMPurify } = await import('/lib/purify.es.mjs');
    const clean = DOMPurify.sanitize(payload, { USE_PROFILES: { html: true, svg: true } });
    clog('DOMPurify 3.2.5 version', DOMPurify.version, '-> clean len', clean.length);
    clog('CLEAN_HTML ' + JSON.stringify(clean));
    root.innerHTML = clean; // React dangerouslySetInnerHTML analog
  }

  // report post-injection state a bit later (covers async gadget execution)
  setTimeout(() => {
    let topRce;
    try { topRce = window.top.__RCE__; } catch(e){ topRce = 'THREW '+e; }
    clog('post-inject window.top.__RCE__ =', topRce);
    clog('scripts_in_dom', document.querySelectorAll('script').length,
         'imgs', document.querySelectorAll('img').length,
         'iframes', document.querySelectorAll('iframe').length);
  }, 1500);
}
run();
