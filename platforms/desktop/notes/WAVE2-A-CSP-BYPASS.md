# Wave-2 Profile-E — CSP-bypass hunt on the docx/pptx renderer→bridge primitive

Status: IN PROGRESS (2026-07-24). Objective: determine whether the shipped CSP is the *actual*
security boundary or a speed bump — find a bypass that runs attacker JS under `script-src 'self'
qrc://*` from a previewed attacker file, PROVEN by run-to-prove, or return the strongest verified
intermediate + exact residual gap (honest negative).

## Settled facts this wave (corrections/additions to A8)

### EXACT full shipped CSP (both qrc:/index.html and qrc:/file-preview/index.html; via <meta http-equiv>)
A8 used an ABBREVIATED CSP that hid decisive sub-directives. The real policy:
```
default-src 'self' qrc://* wickrweb://* ; style-src 'self' 'unsafe-inline' ;
script-src 'self' qrc://* ; connect-src 'self' wickrweb://* https://bedrock-*.amazonaws.com(all regions) ;
img-src 'self' https://tile.googleapis.com wickrweb://* blob: data: ; font-src 'self' data: ;
media-src 'self' wickrweb://* data: blob: ;
frame-src 'self' blob: https://fast.com/ https://main.d4zeeqgazhley.amplifyapp.com/ ;
worker-src 'self' blob: ; child-src 'self' blob: ; object-src 'self'
```
Consequences:
- script-src has NO unsafe-inline / unsafe-eval / nonce / hash. No data: in script-src.
- **frame-src is EXPLICIT and excludes wickrweb://** → cannot frame a wickrweb attacker-HTML doc
  (frame-src does NOT fall back to default-src). Kills the "frame attacker file bytes" idea.
- **object-src 'self'** → cannot <object>/<embed> a wickrweb/attacker doc.
- **connect-src allows wickrweb://\*** → ANY running script may `fetch()` the native API surface.
- **img-src / media-src allow wickrweb://\*** → `<img>/<video src=wickrweb://…>` hit the native
  URL-scheme handler DECLARATIVELY (no JS). (Family-G angle under test.)
- style-src allows 'unsafe-inline' (CSS only; no JS exec vector in modern Blink).
- No base-uri (A8: `<base>` works but unweaponizable). **No require-trusted-types-for/trusted-types
  → Trusted Types NOT enforced** (script.src/.text/innerHTML sinks unguarded IF fed by a 'self' script).

### Architecture confirmed
- App shell origin = `qrc:` (`qrc:/index.html`, set via `wickrSettings.webViewAddress`). The main
  WebEngineView holds `webChannel: channel` + registers `uiBridge`; auto-accepts ALL cert errors;
  auto-grants ALL feature permissions; injects userscript `qrc:///webengine/preloads.js` at
  DocumentCreation/MainWorld into every frame (content under audit).
- `wickrweb://` = native API scheme via `QQuickWebEngineProfile::installUrlSchemeHandler`. Powerful
  routes seen: awscredentials, myaccount/password, admin/controls, message/…, file/…, filemanager/…,
  convo/…, users/…, image/…, audio/…, search, contacts/…, verification/…, chimetoken, leavenetwork,
  inviteuser, convertdirectoryuser.
- Only TWO web HTML pages exist in qrc (index.html, file-preview/index.html); BOTH carry the strict
  CSP. Other HTML-looking carves are QML (native, not web docs). ⇒ no CSP-free qrc web page to
  navigate to (pending final confirm by family-A agent incl. any dev/test page).

## Run-to-prove harness (VALIDATED, faithful) — scratchpad/serve/
Chromium (Blink = QtWebEngine engine), served http; exact full CSP via <meta> on parent+child;
same-origin UN-sandboxed preview iframe; parent exposes qt.webChannelTransport + 58-method bridge
Proxy + a message→openLink forwarder; win-marker `window.top.__RCE__` cross-read; self-driving
battery from tests.json + payloads/*.txt. Faithfulness proven:
- POSITIVE CONTROL (a 'self' script) → set __RCE__ AND fired uiBridge.openLink bridge call. Detector works.
- docx renderSymbol sink (`root.innerHTML = "&#x"+char+";"`) with inline <script> → node present, INERT.
- docx <img onerror>, <svg><script> → INERT.
- pptx path DOMPurify 3.2.5 (confirmed v3.2.5 running) `USE_PROFILES{html,svg}` → stripped onerror &
  <script> to `<img src="x"><svg></svg><p>hi</p>` → INERT.
All attacker vectors blocked; positive control fires. ⇒ a candidate that WINS here is a real bypass.

## In-flight (forced-diversity agents A / B+D / C+F / G) — results pending.

## RESULTS (agents A / B+D / C+F returned; G pending) — 2026-07-24

### Engine: **QtWebEngine 6.9.2 = Chromium 130.0.6723.192** (install: %LOCALAPPDATA%\Programs\Amazon Web Services, Wickr\AWS Wickr\). Well past Chromium M90 → the policy container inherits <meta>-delivered CSP into about:srcdoc / about:blank children.

### STRONGEST NEW INTERMEDIATE — docx `altChunk` → `iframe.srcdoc` (NOT a win on shipped engine)
- docx-preview `renderAltChunk`: `t=createElement("iframe"); loadAltChunk(...).then(r=>{t.srcdoc=r})`; iframe has NO sandbox. `defaultOptions.renderAltChunks` = **true** (verified bytes: `renderAltChunks: true` / minified `renderAltChunks:!0`); app callsite `renderAsync(buf,ref,ref,{...defaultOptions,debug:true,experimental:true})` does NOT override → **altChunk rendering is ENABLED**.
- A `.docx` with `<w:altChunk r:id>` + a relationship to an HTML part delivers FULL attacker HTML into `iframe.srcdoc`. Unlike the renderSymbol innerHTML sink, srcdoc parses as a DOCUMENT → parser-inserted `<script>` would execute. Removes A8's "innerHTML script inert" barrier. Same-origin (qrc via about:srcdoc), non-sandboxed → reaches window.top bridge.
- **RUN-PROVEN CSP-BOUND (three independent harnesses: mine + both agents).** My validated battery (scratchpad/serve, Chromium 148 — same post-M90 behavior class as Wickr's 130):
  - altChunk srcdoc inline `<script>` + `<img onerror>` + `postMessage` → ALL inert (srcdoc inherits the <meta> CSP; script-src 'self', no unsafe-inline).
  - altChunk srcdoc EXTERNAL `'self'` script → RUNS and reaches the bridge. ⇒ boundary is precisely "attacker has no 'self'/qrc script source", NOT "srcdoc can't run scripts".
- **Residual gap (exact):** win requires either (a) srcdoc failing to inherit the meta-CSP (pre-M90 / a QtWebEngine regression — NOT the case on Chromium 130), or (b) the CSP gaining `unsafe-inline` or an attacker-controllable `'self'`/`qrc` script source. On the shipped build: BLOCKED. This is a cleaner, stronger single-barrier primitive than renderSymbol and should be reported as such (any future CSP regression OR engine downgrade = clean 1-click RCE).

### FAMILY A (source abuse) — HARD NEGATIVE
- `preloads.js` FULLY RECOVERED (rcc data @ exe 0x31ee3c0, 126 bytes): `window.URL = class QURL extends URL { constructor(u,b){ super(u, b==='qrc:'?'qrc:/':b) } }` — a qrc URL-base shim. No gadget, no bridge ref, no attacker-state read. Injected **main-frame only** (no injectAllFrames) → not even in the preview iframe. DEAD.
- **NEW: `qrc:/webengine/wickr.html` ships with NO CSP** (raw @ exe 0x31d664d, 97,647 B) — a dev WebChannel console that grabs the FULL bridge (`new QWebChannel(qt.webChannelTransport,...)`) and has inline scripts. Reachable in principle via injected `<meta http-equiv=refresh url=qrc:/webengine/wickr.html>` (frame-src 'self' allows qrc). BUT: (1) navigation destroys the attacker's injected context; (2) wickr.html reflects ZERO attacker input (verified 0 refs to hash/search/name/referrer/URLSearchParams/postMessage/eval/innerHTML) — its bridge calls use hardcoded args; (3) nothing in the app navigates to it (dead/legacy). ⇒ CSP-free page but no attacker-content injection point. Intermediate (hardening: ship it out of the bundle / add CSP), not a win.
- Attacker bytes never occupy a qrc/'self' URL (rcc read-only; received files served from wickrweb, excluded from script-src AND frame-src). No qrc reflector/JSONP. Dynamic import() only resolves static hashed app chunks. `createElement('script')`+blob loader is CSP-blocked (blob: ∉ script-src) and unreachable.

### FAMILY B (script gadgets) + D (clobbering) — HARD NEGATIVE (corpus-wide census)
- NO document.write/writeln, insertAdjacentHTML, createContextualFragment anywhere in the web JS.
- createElement('script'): only setImmediate polyfill (empty, IE timing) + audio-worklet blob-script (blob: ∉ script-src → blocked, and unreachable from preview). Dynamic import(): only PDF.js app-set specifier. Workers: only wrap app code. eval/new Function: CSP-blocked. No jQuery. Script resurrection: clones keep already-started=true → inert.
- React uses `createRoot` (client render), NOT hydrateRoot → attacker raw attributes never hydrated to handlers.
- Clobbering survives (docx raw + DOMPurify default allows id/name) but NO child-reachable code reads a clobberable global into an exec sink; DOMPurify reads built-ins (win over named-prop clobbering); parent never reads child DOM.
- withLinkHandler receiver **DOES** validate `event.origin === window.parent.origin` (A8's "unconfirmed origin check" now RESOLVED = present). openLink path = data-only, native http/https/mailto allowlist + confirm modal.

### FAMILY C (DOMPurify 3.2.5 / PPTX) + F (mutation) — HARD NEGATIVE for exec
- Config `USE_PROFILES:{html,svg}` default: strips foreignObject/use/iframe/object/embed/all MathML/script; 3.2.5 removed the post-serialize reparse loop; per-slide sanitize+concat introduces no differential. Any bypass yields inert DOM (script/handler/js-uri all CSP-blocked); PPTX render subtree only re-processed by an inert img.onerror hider; DOMPurify strips <iframe> so PPTX can't even reach the altChunk/srcdoc gadget. Residual: a bypass is still inert under CSP.
- **Flag for Family G:** DOMPurify does NOT sanitize CSS; PPTX globalCSS set unsanitized as `<style>{cssText}</style>`, and `style=""` survives DOMPurify → `background:url("wickrweb://<endpoint>")` issues a DECLARATIVE GET to a native endpoint (img-src allows wickrweb; DOMPurify's wickrweb-in-attribute block bypassed via the CSS channel). GET-only; value depends on wickrweb GET side effects (Family G).
