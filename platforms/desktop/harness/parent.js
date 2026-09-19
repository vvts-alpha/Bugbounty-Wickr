// PARENT: models the bridge-holding main window (qrc origin). A 'self' module (script-src 'self' OK).
// Self-driving test battery: reads /tests.json, runs each case in its own same-origin un-sandboxed
// iframe, resets the win-marker between cases, records per-case outcome.
const logEl = document.getElementById('log');
const log = (...a) => { const s = a.map(x => typeof x==='string'?x:JSON.stringify(x)).join(' '); logEl.textContent += s + "\n"; console.log('[PARENT]', s); };

// ---- Bridge shim: mimic Qt WebChannel injection + WebChannelMessageBridge ----
window.__bridgeCalls = [];
function bridgeCall(method, args){ window.__bridgeCalls.push({method, args}); log('   BRIDGE CALL <<', method, JSON.stringify(args)); }
const bridge = new Proxy({}, { get:(_,m)=> (...args)=>bridgeCall(String(m), args) });
window.__BRIDGE__ = bridge;
window.qt = { webChannelTransport: { send: (json)=>bridgeCall('qt.webChannelTransport.send', [json]), onmessage:null } };

// ---- Win marker ----
window.__RCE__ = undefined;

// ---- Parent message forwarder (models app openLink forward; no origin check = worst-case-realistic) ----
window.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d && d.type === 'openLink' && typeof d.url === 'string') bridgeCall('uiBridge.openLink', [{link:d.url, showConfirmation:false}]);
});

const sleep = ms => new Promise(r=>setTimeout(r,ms));

async function runCase(tc){
  window.__RCE__ = undefined;           // reset marker
  const before = window.__bridgeCalls.length;
  const iframe = document.createElement('iframe');
  iframe.width='900'; iframe.height='150';
  iframe.src = `/preview.html?mode=${encodeURIComponent(tc.mode)}&payload=${encodeURIComponent(tc.payload)}`;
  document.body.appendChild(iframe);
  await sleep(2500);                     // allow async gadget/exec
  const rce = window.__RCE__;
  const newCalls = window.__bridgeCalls.slice(before);
  const attackerBridge = newCalls.filter(c => JSON.stringify(c.args).includes('attacker') || (tc.mode!=='poscontrol' && true));
  const won = (rce !== undefined) || newCalls.length>0;
  const verdict = won ? 'EXECUTED/REACHED' : 'inert (no attacker JS, no bridge call)';
  log(`CASE "${tc.name}" [${tc.mode}/${tc.payload}] expect=${tc.expect} => ${verdict}` + (rce!==undefined?`  __RCE__=${JSON.stringify(rce)}`:'') + (newCalls.length?`  bridge=${JSON.stringify(newCalls)}`:''));
  iframe.remove();
  return { name:tc.name, mode:tc.mode, payload:tc.payload, expect:tc.expect, rce:rce??null, bridgeCalls:newCalls, won };
}

async function main(){
  log('=== Wickr CSP run-to-prove harness ===');
  let tests;
  try { tests = await (await fetch('/tests.json')).json(); }
  catch(e){ log('tests.json fetch failed', String(e)); return; }
  const results = [];
  for (const tc of tests){ results.push(await runCase(tc)); }
  window.__RESULTS__ = results;
  log('=== SUMMARY ===');
  for (const r of results){
    const ok = (r.expect==='WIN') === r.won;
    log(` ${ok?'OK ':'!! '} ${r.name}: ${r.won?'WON':'inert'} (expected ${r.expect})`);
  }
  log('RESULTS_JSON ' + JSON.stringify(results));
  log('=== DONE ===');
}
main();
