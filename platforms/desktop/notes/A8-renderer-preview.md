# A8 — Renderer file-preview surface (iframe boundary + parsers → native bridge)

**Verdict: NEGATIVE (well-verified).** The renderer→native code-exec chain is **broken at "attacker JS execution in the renderer."** The preview iframe *is* same-origin with the bridged parent (isolation is illusory), **but** the identical CSP `script-src 'self' qrc://*` (no `unsafe-inline`, no `unsafe-eval`) + universal output-escaping/DOMPurify jointly prevent attacker file content from ever executing script. Proven by execution (harness). The only attacker-data→parent channel is a clicked-hyperlink `{type:'openLink',url}` that forwards to native `uiBridge.openLink` — data-only, 2-interaction, bounded by N4's strict native http/https/mailto scheme validation. No WIN.

Scope handled: renderer/preview only. Native `uiBridge.openLink` URL validation belongs to the link-open surface (N4/A5) and is not re-disassembled here.

---

## 1. Architecture (established from embedded sourcemaps + carved qrc)

The React web app ships **embedded (uncompressed) in WickrPro.exe** as `qrc:/…` resources, **with sourcemaps** (`sourcesContent` = original TS). Two Vite entries, **identical CSP**:

| Page | Entry | qwebchannel.js / bridge? |
|---|---|---|
| Main app (`index.html`, carve `blob_00e568b7`) | `wickr-BXqo7ivg.js` | **YES** — `<script src="qrc:///qtwebchannel/qwebchannel.js">`, 58-method bridge |
| **File preview** (`file-preview/index.html`, carve `blob_00e46f48`) | `file-preview-4vkBugtX.js` | **NO** — no bridge script, no direct bridge ref |

**Preview flow:** `openFile` thunk → if `settings.enableFileDownload` → native `uiBridge.openFile`; **else → `pushModal({name:"FilePreviewModal", params:{msgId,vgroupId}})`**. File-Management (pinned/managed) non-image files → `FilePreviewModal` directly. The modal embeds the file-preview page in a **child `<iframe>`** (same-origin qrc; **no `sandbox`/`srcdoc` attribute exists anywhere in the binary**).

**How the iframe gets the file** (`FilePreviewProvider.tsx`, verified source): params come from `location.hash` (`fileExt, vgroupId, msgId, fileId, theme`); `fileUrl = wickrWebEndpoints.fileData(vgroupId,msgId)` (a `wickrweb://` URL the native side serves decrypted bytes from). **Attacker controls: file bytes + file extension** (extension selects the renderer; lowercased, used only as a map key).

**Preview components** — full map (`FILE_PREVIEW_COMPONENT_MAP`, verified): `{pdf:lazyPdf, docx:lazyDoc, xls/xlsx/csv:lazySpreadsheet, pptx:lazyPowerPoint, xml/rss:lazyXml, txt/log/md/markdown:lazyText, rtf:lazyRichText}`, each `withLinkHandler`-wrapped, rendered with `url={fileUrl}`. Libraries: **SheetJS/xlsx** (incl. its SocialCalc-format *writer* `write_socialcalc` — **no** separate SocialCalc renderer), **JSZip 3.10.1**, **docx-preview**, **mammoth**, **DOMPurify**, a **pptx2html Web Worker**, PDF.

## 2. Every renderer's DOM sink (audited)

> **Correction to an earlier draft:** the *exe* is partly zlib-compressed for the main React bundle, so exe-grep UNDERcounts sinks. The authoritative counts come from the **decompressed** carves (`scratchpad/qrc/blob_*`). The main bundle (`blob_0198cdb0`) actually has **17** `dangerouslySetInnerHTML` (16 are react-dom/preact library internals; **1** app usage = an **icon** renderer `jsx("span",{dangerouslySetInnerHTML:{__html: icon.svg}})` fed **app-shipped** SVG assets, not attacker content) and 23 raw `.innerHTML=` (library internals). So the earlier "one sink binary-wide" was an exe-compression artifact — **corrected here.**

Output-escaping is the FIRST layer but is **NOT airtight** — a few genuine HTML-injection vectors from attacker file content exist:
- **TextPreview / RichTextPreview (rtf):** text → `<p>{line}&nbsp;</p>` (React-escaped); RTF→plain-text first. **Safe.**
- **XmlPreview:** `DOMParser.parseFromString` (inert document, scripts never run) → **escaped** React tree (`&lt;{nodeName}&gt;`, `textContent`). **Safe.**
- **Spreadsheet (SheetJS):** no `sheet_to_html` → React table of escaped cell values. **Safe.**
- **PPTX:** JSZip in a Worker → slide HTML → **`DOMPurify.sanitize(html,{USE_PROFILES:{html,svg}})`** → `dangerouslySetInnerHTML`; globalCSS → `<style>` (CSS only).
- **DOCX (docx-preview):** DOM-node building, BUT has **`renderSymbol(){ t.innerHTML = \`&#x${e.char};\` }`** where `e.char` (docx `w:sym/@w:char`) is attacker-controlled and interpolated **unsanitized** → a docx with a crafted symbol char yields **HTML injection** into the preview DOM. Also `createElement("style",{innerHTML: css})` (docx-derived CSS). PDF/others not fully sink-audited.

→ i.e. **attacker HTML CAN reach the preview DOM** in at least the DOCX path. That is exactly why the CSP (§4), not escaping, is the load-bearing control — and why the harness injects *raw* `innerHTML` worst-case payloads.

## 3. The one parent channel: `withLinkHandler` → `openLink`

`withLinkHandler.tsx` (wraps *every* preview): on click of any `<a>`, `window.parent.postMessage({type:'openLink', url: href}, window.parent.origin)`. (Reading `window.parent.origin` **only works same-origin** — this is the proof the iframe is same-origin.) Parent thunk `ui/openLink`: optional "You are leaving Wickr" confirm modal → `uiBridge.openLink({link, showConfirmation:false})` → native `sendAction({action:"openLink"})`. This is **data-only** (a URL string) and needs a **second interaction** (click a rendered hyperlink). Native scheme validation = N4's strict `http/https/mailto` allowlist (`@0x1409c7950`; mailto builder at `0x140072620`). PPTX hrefs are additionally DOMPurify-filtered (drops `javascript:`). Not a code-exec/RCE path.

## 4. CSP verdict — the load-bearing control (PROVEN by execution)

Both pages: `default-src 'self' qrc://* wickrweb://*; script-src 'self' qrc://*; object-src 'self'; …` — **no `unsafe-inline`, no `unsafe-eval`, no `nonce`.** `base-uri` unset but not abusable (attacker cannot host at `'self'`/qrc).

**Harness** (`scratchpad/harness/`, served over http, loaded in Chromium — same Blink CSP engine as QtWebEngine): a same-origin, **un-sandboxed** iframe carrying the exact CSP, with a parent exposing a stub `window.__BRIDGE__` + `qt.webChannelTransport` and a `message`→`openLink` forwarder. `preview_app.js` (a `'self'` script) injects, via `innerHTML`, the worst-case parser/DOMPurify-bypass output — 7 attacker vectors — plus `eval`/`Function` gadgets.

**Observed:**
```
PREVIEW REPORT  {"pwned":[], "evalWorked":false, "sameOriginReachFromSelfScript":true}
eval  blocked: 'unsafe-eval' is not an allowed source …
Function blocked: 'unsafe-eval' is not an allowed source …
iframe__pwned: []                      // 0 of 7 vectors executed
injected_script_tags: 3, injected_img_tags: 1   // present in DOM as INERT nodes
iframe_can_read_parent_bridge: true    // same-origin reach IS open …
parent __RCE__ = undefined             // … but never reached — no attacker code ran
parentBridgeCalls: [openLink {benign url}]   // only the legit 'self' postMessage
```
Vectors all blocked: inline `<script>`, `<img onerror>`, `<svg><script>`, `javascript:` URI (anchor + iframe), `<body onload>`, `<math><mtext>` mXSS, `eval`, `Function`, and `createElement('script')+textContent`.

**Interpretation:** the same-origin iframe is genuinely **not** an isolation boundary — a `'self'` script trivially reaches `parent.__BRIDGE__` / `qt.webChannelTransport`. The **only** reason there is no exploit is that the **CSP prevents attacker file content from ever running as `'self'` code**, and every renderer escapes/sanitizes its output so no attacker HTML even reaches an executing context. The "postMessage-isolated child iframe" description is inaccurate (it is a same-origin iframe + a postMessage convention); the real, load-bearing control is the CSP.

## 5. Adversarial refutation (why each escalation fails)

- **DOMPurify bypass (PPTX)** → still only yields HTML; inline script/handlers/`javascript:` are CSP-blocked (proven). Double backstop.
- **Prototype pollution** → the `__proto__` cluster @29.26M is Rollup `{__proto__:null}` **ES-module namespace objects**, not a merge sink. Even real pollution can't exec (no `eval`/`Function` under CSP) and can't materialize a `'self'` script.
- **Worker** → worker code is app-origin (`blob:`, worker-src allows it); attacker controls only the *data* posted in, which comes back escaped/sanitized.
- **"Parent trusts iframe" postMessage** → the receiver's `event.origin` check could not be confirmed in the minified parent (latent hardening gap), **but is not exploitable**: the only frames that can postMessage the parent are same-origin (attacker can't run code there — CSP) or the app's own `frame-src` allow-list (`fast.com`, `*.amplifyapp.com` — not attacker-controlled); bot web-apps load in separate WebEngineViews with no shared window.
- **`openLink` data-path** → bounded by native `http/https/mailto` allowlist + confirm modal; opening those schemes is not RCE (file:// has MOTW/SmartScreen per N4). 2-interaction. = N4 link-open NEGATIVE.
- **Reachability** is NOT the blocker — the preview *is* attacker-file-reachable and ≤1-click (esp. when `enableFileDownload` is off, or via File-Management). The chain fails on code-exec, not reach.

## Residuals (non-wins, for completeness)
1. Parent `message` receiver origin-check unconfirmed (latent; not exploitable as above).
2. Same-origin un-sandboxed preview iframe is defense-in-depth-weak: a *future* CSP regression or a `'self'`-executing gadget would immediately reach the full native bridge. Recommend `sandbox` (drop `allow-same-origin`) on the preview iframe. Reportable as hardening, not a vuln.

## Key artifacts
- Extracted source: `scratchpad/src_extract/` & `scratchpad/src_all/` (FilePreviewProvider/App, TextPreview, XmlPreview, withLinkHandler, main).
- CSP proof harness: `scratchpad/harness/{parent.html,preview.html,preview_app.js}` (v1) + `{parent2.html,preview2.html,preview_app2.js}` (v2, bypass classes).
- CSP strings: carves `blob_00e46f48` (file-preview), `blob_00e568b7` (main).

---

## 6. CSP-bypass hunt for the docx HTML-injection primitive — DEFINITIVE close-out

Given the verified primitive (attacker `.docx` → docx-preview `renderSymbol` `innerHTML=\`&#x${e.char};\`` → raw HTML into the **same-origin, un-sandboxed** preview iframe that can reach `parent`'s bridge), I systematically hunted the CSP-bypass class built specifically for "raw HTML injection under `script-src 'self'` (no `unsafe-inline`/`unsafe-eval`)". **All 5 categories fail; surface DEFINITIVELY CLOSED — the CSP is the sole barrier.**

**Injection-primitive constraint:** every sink is `innerHTML`-class (docx `renderSymbol`, docx `<style>` innerHTML, PPTX `dangerouslySetInnerHTML`). Per HTML spec, `<script>` inserted via `innerHTML` is flagged non-executable, and appending that node later does **not** revive it. So an inline or `src=qrc:/…` `<script>` in my payload is **inert**; a bypass needs a **'self' gadget** that turns my inert DOM into execution.

**Category 1 — script gadgets in the app's own 'self' bundles (searched `blob_0198cdb0`, `blob_01ad4d87`, exe file-preview region 25.5–30.5M):**
- Only exec-class sinks in the *file-preview* graph are **JSZip's `setImmediate` polyfill** `new Function(""+A)` and its empty timing-`createElement("script")` — the `new Function` is reached only via `setImmediate(string)` (JSZip only ever passes functions) **and** is CSP-blocked regardless; the timing-script carries no attacker src/text.
- `currentScript`@29.89M = **DOMPurify 3.2.5** internal (a native accessor — not clobberable). `Function(`@29.12M = the spreadsheet component's `function jd(` (col-name gen), which uses SheetJS **`sheet_to_json`** (array→escaped React table), **not** `sheet_to_html`.
- `MutationObserver` hits = JSZip polyfill (no DOM-content→exec transform). No `document.write`/`insertAdjacentHTML`/`eval`/`import(attacker)`; no hydration that binds raw DOM attributes to handlers (React only hydrates React-managed props).
- **docx `renderAltChunk` → `iframe.srcdoc=r`** is the only srcdoc sink — gated by `options.renderAltChunks` (docx-preview default **false**; app sets no docx options string in the binary). Even if enabled, a `srcdoc` iframe **inherits the parent CSP** → inline script blocked (proven below).

**Category 2 — DOM clobbering:** injection lives in the **child** iframe, so it can only clobber globals read by the *file-preview* bundle (no bridge there). Harness **confirms clobbering works** (`window.__loaderCfg` resolved to my injected `<a>`), **but there is no weaponizable target**: the bundle's only exec sinks are `eval`/`Function` (CSP-blocked) and script-element `src` (CSP-blocked for non-'self'). A clobber→real-`<script>` gadget was built in the harness and **CSP-blocked at load**.

**Category 3 — qrc:/'self' script re-use:** `innerHTML` scripts are inert; loading a real `<script src=…>` needs a Cat-1 gadget (none attacker-fed). A `'self'`-origin script that *does* load runs **app code, not attacker code**. No path to attacker execution.

**Category 4 — `<base>`/`<meta>` injection:** harness shows `<base href="http://attacker.test/">` **does** change `baseURI`, and a `<meta http-equiv=refresh url=javascript:…>` and `<meta http-equiv=CSP script-src * 'unsafe-inline'>` were injected — result: meta-refresh-js **did not execute**, injected CSP **cannot relax** (`meta_csp_relaxed_inline_works:false` — additional policies combine with AND), and a base-redirected relative script resolves to **attacker origin → CSP-blocked**. Navigating the child to attacker http would make it cross-origin (loses bridge). No bypass.

**Category 5 — non-script bridge reach:** enumerated *every* child→parent message: the **only** `window.parent.postMessage` calls are `withLinkHandler`'s `{type:'openLink',url}` (all other `postMessage` are PPTX-worker-internal, staying in the child). Injected DOM cannot postMessage without script. So the sole bridge-reaching path is `openLink` → `uiBridge.openLink({link})` → native `sendAction("openLink")` → `QDesktopServices::openUrl` (`0x140072620`), gated by N4's instruction-verified strict `http/https/mailto` allowlist (`@0x1409c7950`) + a "You are leaving Wickr" confirm modal. Data-only, 2-interaction, not RCE.

**Harness v2 proof (executed, Chromium = QtWebEngine's Blink CSP engine):**
```
PREVIEW2 REPORT {"pwned":[],
  "base_href_took_effect":"http://attacker.test/",       // <base> injection works…
  "meta_csp_relaxed_inline_works":false,                 // …but CSP can't be relaxed
  "notes":["clobber:window.__loaderCfg=A",               // …DOM clobbering works…
           "eval blocked","Function blocked",
           "attacker-origin script BLOCKED (load failed)",// …clobber→<script> still CSP-blocked
           "self-script blocked"]}
PARENT2 SUMMARY __RCE__=undefined                        // bridge never reached
```
Working clobbering + working `<base>` injection + a real clobber-fed `<script>` element **still** yield zero execution and zero bridge calls, because `script-src 'self'` blocks the attacker-origin/base-redirected script load and `eval`/`Function`.

### VERDICT: renderer/preview surface **DEFINITIVELY CLOSED** (NEGATIVE)
No renderer→native code-exec chain survives the CSP. The finding stands as **hardening, not a vuln**, and is genuinely notable:

> **Chained latent weakness (single-barrier):** attacker `.docx` (1-click preview) → **unsanitized HTML injection** (docx-preview `renderSymbol`) → into a **same-origin, un-sandboxed** preview `<iframe>` whose `'self'` context can reach the full native `WebChannelMessageBridge` / `qt.webChannelTransport` → parent already **forwards iframe data to the bridge** (`openLink`). **The one and only thing preventing 1-click renderer→bridge→RCE is the CSP `script-src 'self' qrc://*` (no `unsafe-inline`/`unsafe-eval`).** Recommend defense-in-depth: (1) `sandbox` the preview iframe dropping `allow-same-origin`; (2) fix the `renderSymbol` innerHTML injection (hex-validate `w:sym/@w:char`); (3) validate `event.origin`/`event.source` in the parent `message` receiver. Any single CSP regression (adding `unsafe-inline`/`unsafe-eval`, a `qrc:` JSONP/eval gadget, or a `'self'` script-gadget) instantly promotes this to a clean 1-click RCE.
