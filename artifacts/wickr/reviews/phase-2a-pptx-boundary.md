# Phase 2A — PPTX Preview Trust Boundary (Evidence-Backed Defensive Review)

**Subject:** AWS Wickr 6.72.20.0 (`WickrPro.exe`, sha256 `eccafde833d34386c859d6548e922649c2f58cd15f82998c8bd2966219341dbd`)
**Scope:** Reconstruct the PPTX → DOM data flow; classify security properties. **No exploit, no CSP-bypass search, no JavaScript-execution claim.**
**Mode:** Static source review only. Application not executed.
**All source files below are recovered from `sourcesContent` of shipped source maps (Phase 1).**

---

## 1. Extraction evidence for every reviewed file

| # | Resolved absolute path | Bytes | SHA-256 | Lines | Origin | Source-map path |
|---|---|---|---|---|---|---|
| 1 | `E:\wickr\extracted\sources\src\file-preview\components\PowerPointPreview\index.tsx` | 8,615 | `b5b79318c9e0de74562345e64b7be620ea5ce7c9b01509657f81c0d73c14a9b9` | 286 | sourcesContent | `app-CAX5Wyxr.js.map` |
| 2 | `E:\wickr\extracted\sources\src\lib\pptx2html\pptx2html.worker.js` | 61,021 | `e94c4c53194118da9ee7d0bdb03f5925ac72c3961636e7f43f604a7c479bb2d0` | 2,079 | sourcesContent | `pptx2html.worker-DeYYp-mz.js.map` |
| 3 | `E:\wickr\extracted\sources\src\components\Modals\FilePreviewModal\index.tsx` | 4,961 | `71e5588a04c86245883a37122c6b4b5b6a0d6f8fb37937f56f3370d7190d899c` | 141 | sourcesContent | `app-DOUtVdma.js` (main) map |
| 4 | `E:\wickr\extracted\sources\src\file-preview\components\withLinkHandler.tsx` | 841 | `829e00588354ebef462c9f8f516a8bcb817dad84f4d543ed54c775b417388fbe` | 29 | sourcesContent | `file-preview-4vkBugtX.js.map` |
| 5 | `E:\wickr\extracted\sources\src\apis\webChannel\utils.ts` | 1,244 | `fdcf59825e25649cde76a2b6b554e1faf932c9f819c859391dc977281933063b` | 41 | sourcesContent | `app-DOUtVdma.js` (main) map |

Supporting direct imports reviewed (also sourcesContent):

| Path | Role |
|---|---|
| `src/hooks/useEventListener.ts` | addEventListener wrapper (FilePreviewModal message listener; withLinkHandler click) |
| `src/utils/url.ts` | `fixLocalUrl` (no-op in production `!__DEV__`) |
| `src/utils/platform.ts` | `getQt()` → returns `qt` global only if defined |
| `src/store/thunks/ui.ts:146-168` | `openLink` thunk (final destination of preview link) |
| `src/file-preview/FilePreviewProvider.tsx` | builds `fileUrl` from `location.hash` |
| `src/apis/webFetch/endpoints.ts` | `WICKR_WEB_PROD_BASENAME='wickrweb://'`; `fileData` route `/file/message/:convoId/:msgId` |

### DOMPurify version evidence (exact)
- Shipped dependency manifest (`extracted/text_0x00E47343_5412.txt`, byte offset `0x00E47EF8`): **`dompurify,3.2.5`**
- Bundled library banner (`extracted/text_0x01C7F2E9_24646.txt`): `/*! @license DOMPurify 3.2.5 | (c) Cure53 ... github.com/cure53/DOMPurify/blob/3.2.5/LICENSE */`
- Import site: `PowerPointPreview/index.tsx:2` → `import DOMPurify from 'dompurify';` (default export; no custom instance).

---

## 2. Verified architecture (facts directly supported by inspected code)

- The PPTX preview renders in an **unsandboxed same-origin iframe** (`FilePreviewModal/index.tsx:134`, `<iframe src={previewUrl} />`).
- The file-preview entry HTML loads `file-preview-4vkBugtX.js` and does **not** load `qrc:///qtwebchannel/qwebchannel.js` (only the main-app HTML does). Therefore `window.qt` is undefined in the preview; `getQt()` (`platform.ts:11`) returns `undefined`, and `getOrOpenWickrQWebChannels` (`webChannel/utils.ts:32-36`) would throw `"Qt not defined"`. **The preview has no direct WebChannel access in the supplied call graph.**
- PPTX bytes are fetched through the custom scheme `wickrweb:///file/message/:convoId/:msgId` (`endpoints.ts:6,29,98`).
- The worker is a Vite `?worker&url` module (`PowerPointPreview/index.tsx:11,73`), `type:'module'`.
- Slide HTML is the **only** worker output that reaches `dangerouslySetInnerHTML`, and it always passes through `DOMPurify.sanitize` first (`PowerPointPreview:93,22-29`).
- The worker's `globalCSS` output (`pptx2html.worker.js:1206-1212`) reaches the DOM via `<style>{cssText}</style>` (`PowerPointPreview:116-118,203`) and **does not** pass through DOMPurify.
- No DOMPurify hooks (`addHook`/`setConfig`) and no Trusted Types (`trustedTypes`/`createPolicy`) exist anywhere in the recovered `src/` (grep returned no matches).
- No React DOM mutation of the sanitized subtree is performed after insertion beyond attaching `img.onerror` handlers (`PowerPointPreview:170-178`).

---

## 3. Data-flow graph (file bytes → final DOM; messages → destination)

```
                            MAIN APP CONTEXT (has qwebchannel.js; qt defined)
                            ┌──────────────────────────────────────────────────────────────┐
FilePreviewModal/index.tsx  │ params{fileExt,fileId,theme,vgroupId,msgId} (:53-59)        │
   :30  FILE_PREVIEW_URL='file-preview.html'                                              │
   :95-97 previewUrl = 'file-preview.html#' + URLSearchParams(params)                     │
   :134 <iframe src={previewUrl} />   ◄── NO sandbox attribute; same-origin (frame-src 'self')
   :99-114 window 'message' listener ◄── from iframe                                       │
   :101  gate: event.data is object && event.origin === window.parent.origin              │
   :104  dispatch(openLink({link:event.data.url, showConfirmation:true}))                  │
                            │                                       │
                            │ (iframe, same-origin)                ▼
                            ▼                          store/thunks/ui.ts:146-168 openLink
FILE-PREVIEW CONTEXT (NO qwebchannel.js; qt undefined)     :151 showConfirmation→ConfirmModal
FilePreviewProvider.tsx                                     :163/166 extra.uiBridge.openLink({link,...})
   :40  read location.hash  ◄── NATIVE bridge (uiBridge) ← published via QtWebChannel
   :50  fileUrl = wickrweb:///file/message/:vgroupId/:msgId
   :90  useFilePreview() → { fileUrl }
                │
                ▼
PowerPointPreview/index.tsx  ({ url = fileUrl })
   :73  new Worker(WORKER_URL,{type:'module'})
   :75  fetch(url)  ──► wickrweb:// (native-intercepted) ──► PPTX bytes
   :76  file = await res.arrayBuffer()
   :148 worker.postMessage({type:'processPPTX', data:file})
                │
                ▼
pptx2html.worker.js
   :19  self.onmessage → :23 processPPTX(e.data.data)
   :44  JSZip.loadAsync(data)                    ◄── attacker-influenced PPTX archive
   :56  getContentTypes → slide list
   :66  for each slide: processSingleSlide → slideHtml
   :188  hyperlink target = @_Target.replace('../','ppt/')   ◄── attacker URL (unescaped)
   :483  "<svg _id/_idx/_type/_name=...>"                     (unescaped shape fields)
   :969  "<img src='data:{mime};base64,...'>"
   :1195 "<a href='{linkURL}' target='_blank'>{text}</a>"     (linkURL unescaped; text not HTML-escaped)
   :1209 genGlobalCSS() → styleTable → CSS text
   :69  postMessage({type:'slide', data:slideHtml})   ──► back to PowerPointPreview
   :80  postMessage({type:'globalCSS', data:CSS})      ──► back to PowerPointPreview
                │
                ▼
PowerPointPreview/index.tsx
   :91-94  'slide' → setSanitizedHtml(h => h + sanitizeHtml(msg.data))
   :22-29  sanitizeHtml = DOMPurify.sanitize(dirty,{USE_PROFILES:{html:true,svg:true}})
   :201    <div ... dangerouslySetInnerHTML={{__html: sanitizedHtml}} />   ◄── SINK (DOMPurify-gated)
   :116-118 'globalCSS' → setCssText(msg.data)
   :203    <style>{cssText}</style>                                        ◄── SINK (NOT DOMPurify-gated)
                │
                ▼  (link clicks)
withLinkHandler.tsx  (wraps preview component)
   :10-19 click on <a> → preventDefault(); href=a.href;
   :17    window.parent.postMessage({type:'openLink',url:href}, window.parent.origin)
                │
                ▼  (received by FilePreviewModal :114 → openLink thunk → uiBridge.openLink)
```

Legend: solid arrows are directly proven from the inspected code. Each stage's input/output is listed in §4.

---

## 4. Stage-by-stage data flow

| Stage | Function/Component | File:lines | Input type | Attacker-controlled fields | Transformation | Output | Validation/sanitization | Next consumer | Proven? |
|---|---|---|---|---|---|---|---|---|---|
| A | `getFilePreviewDataFromUrl` | FilePreviewProvider:38-63 | `location.hash` | (none directly; hash set by parent) | URLSearchParams parse | `fileUrl` (wickrweb://) | none | `useFilePreview` | yes |
| B | `PowerPointPreview` fetch | PowerPointPreview:75-76 | `url` (wickrweb://) | — | `fetch`+`arrayBuffer` | PPTX bytes (`ArrayBuffer`) | none (native scheme) | worker postMessage | yes |
| C | `processPPTX` | worker:41-89 | PPTX bytes | entire archive | `JSZip.loadAsync` | zip object | none | processSingleSlide | yes |
| D | `processSingleSlide`/emitters | worker:157-258, 483-497, 962-974, 1189-1203 | PPTX XML parts | text, shape name/id/type, hyperlink target, styles | string-concatenated HTML | HTML string (`slideHtml`) | **none — values interpolated unescaped** | postMessage `slide` | yes |
| E | worker→main `slide` | worker:69-72 / PowerPointPreview:77-94 | `msg.data` = HTML | (the HTML above) | accumulate | `sanitizedHtml` state | **DOMPurify.sanitize(html+svg)** | dangerouslySetInnerHTML | yes |
| F | `sanitizeHtml` | PowerPointPreview:22-29 | dirty HTML | all worker output | DOMPurify sanitize | sanitized HTML | DOMPurify 3.2.5 default + html/svg profiles | setSanitizedHtml | yes |
| G | sink (slide) | PowerPointPreview:201 | sanitizedHtml | — | React render | live DOM subtree | DOMPurify (stage F) | img.onerror attach (H) | yes |
| H | post-insert mutation | PowerPointPreview:170-178 | DOM | — | set `img.onerror` per `<img>` | — | none | — | yes |
| I | worker→main `globalCSS` | worker:80-82,1206-1212 / PowerPointPreview:116-118 | CSS text | PPTX style-table values | accumulate | `cssText` state | **NONE (bypasses DOMPurify)** | `<style>` sink (J) | yes |
| J | sink (css) | PowerPointPreview:203 | cssText | — | React `<style>` text child | stylesheet | none | — | yes |
| K | link click | withLinkHandler:10-19 | `<a>` href | href value (DOMPurify-surviving) | read attribute | `{type,url}` | none | postMessage to parent | yes |
| L | message receive | FilePreviewModal:99-114 | MessageEvent | event.data, event.origin | origin+object gate | dispatch openLink | origin === window.parent.origin (:101); object check | openLink thunk | yes |
| M | openLink thunk | ui.ts:146-168 | `{link,showConfirmation}` | link | ConfirmModal → native | — | **user confirmation (showConfirmation=true from preview)** | uiBridge.openLink (native) | yes |

Answers to required resolutions:
1. **Bytes enter worker:** PowerPointPreview:148 `worker.postMessage({type:'processPPTX', data: file})` where `file` = `arrayBuffer()` of the wickrweb fetch. **Proven.**
2. **Archive parsing:** worker:44 `JSZip.loadAsync`; `[Content_Types].xml` via `XMLParser` (worker:91-95). **Proven.**
3. **What worker can emit:** `<section>`, `<div class>`, `<svg _id _idx _type _name style>`, `<img src="data:">`, `<a href target>`, `<span class style>`, `<table><td colspan>`, plus a global CSS sheet from the style table. Inline `style=` everywhere; no `<script>`/`on*` emitted directly, **but** unescaped interpolation of `text`, `name`, `linkURL`, shape ids means arbitrary markup can be injected into the *pre-sanitization* string. **Proven (emitters); the reachable dangerous subset after DOMPurify is the open question.**
4. **Output return:** `postMessage({type:'slide'|'globalCSS'|'slideSize'|'complete'|...})`. **Proven.**
5. **DOMPurify instance:** default export `import DOMPurify from 'dompurify'` (PowerPointPreview:2). No separate instance. **Proven.**
6. **Exact sanitize call:** `DOMPurify.sanitize(dirtyHtml, { USE_PROFILES: { html: true, svg: true } })` (PowerPointPreview:22-29), applied per slide at :93. **Proven.**
7. **Hooks/global config/custom elements/URI policies:** none found anywhere in `src/` (grep for `addHook|setConfig|ALLOWED_URI|FORBID_TAGS|ADD_TAGS|trustedTypes|createPolicy` → 0 matches). **Proven (absent).**
8. **Post-sanitization modification:** sanitized per slide then **concatenated** (`html + sanitizeHtml(msg.data)` :93). No reparse/decode/serialize of the sanitized string before insertion; the concatenated whole is inserted once. **Proven.** (Concatenation of independently-sanitized fragments is the only post-sanitization transformation.)
9. **Sink:** `dangerouslySetInnerHTML={{__html: sanitizedHtml}}` (PowerPointPreview:201). **Proven.**
10. **Later DOM mutation:** only `img.onerror` assignment (:170-178). No re-`.innerHTML`, no clone/reparse. **Proven.**
11. **Link clicks → withLinkHandler:** delegation via `useEventListener(containerRef,'click')` (withLinkHandler:10), reads `a[href]`, posts to parent. **Proven.**
12. **Messages received/validated:** FilePreviewModal:99-114; see §5. **Proven.**
13. **Preview data → WebChannel:** in the preview context `qt` is undefined, so `getOrOpenWickrQWebChannels` (webChannel/utils.ts:32-36) throws before any channel call. **No preview-controlled data reaches WebChannel code in the supplied call graph.** The only preview→native path is `openLink` via parent `postMessage` + user confirmation. **Proven (unreachable directly); the `openLink`→`uiBridge.openLink` path is the sole, user-mediated bridge reach.**

---

## 5. Message-handler review

Only one `message` handler is involved in preview communication.

| Item | Finding |
|---|---|
| Registration | `FilePreviewModal/index.tsx:114` — `useEventListener(window, 'message', handleIframeMessage)` |
| Expected schema | `event.data` must be an **object** with `type` string; only `type:'openLink'` is acted on (others logged, `:107`) |
| `event.origin` validation | `:101` — `event.origin === window.parent.origin` |
| `event.source` validation | **NONE** — `event.source` is never inspected |
| Instance validation | **NONE** — no token/id ties the message to a specific preview iframe |
| Schema/type validation | only `typeof event.data === 'object'` (`:101`); no shape validation of `.url` |
| URL validation | **NONE** in the handler — `event.data.url` is forwarded verbatim to `openLink` |
| Forwarded destination | `dispatch(openLink({link: event.data.url, showConfirmation:true}))` (`:104`) → `ui.ts:163/166` `extra.uiBridge.openLink(...)` (native) after a ConfirmModal |
| Malformed input | `event.data` not an object → condition false → silently ignored |
| Unexpected origin | origin mismatch → silently ignored |
| Sibling / unrelated same-origin frame | **origin matches → ACCEPTED** (no source/instance discrimination) |

Exact condition (`FilePreviewModal/index.tsx:101`):
```ts
if (event.data && typeof event.data === 'object' && event.origin === window.parent.origin) {
```

**Determination on the “origin gate at line 101”:** it verifies **origin only**. It does **not** verify the source window, nor a specific preview instance. Because the preview iframe is same-origin (`frame-src 'self'`, same `file-preview.html` origin), its `event.origin` equals `window.parent.origin` (the main app is loaded top-level in the WebEngineView, so `window.parent === window`). The check is therefore satisfied by any same-origin sender; it rejects cross-origin senders. It is **not** a mistaken extraction reference — the line is accurate — but its discrimination power is limited to origin.

---

## 6. Sanitizer-boundary review (exact shipped config only)

Config: `DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true, svg: true } })`, no hooks, no ADD/FORBID/ALLOWED overrides.

| Item | Classification | Basis |
|---|---|---|
| Allowed HTML namespace | `ESTABLISHED SAFE BY CODE` | html profile = standard allow-list; no custom additions |
| Allowed SVG behavior | `REQUIRES BENIGN RUNTIME TEST` | svg profile enabled (PowerPointPreview:25); SVG/`foreignObject` namespace handling is version/engine-specific — cannot be proven safe by inspection alone |
| URI-bearing attributes (`href`,`src`,`xlink:href`) | `REQUIRES BENIGN RUNTIME TEST` | DOMPurify default URI scheme filtering applies; effective scheme set under this Chromium build not statically provable |
| Style handling (inline `style=`) | `REQUIRES BENIGN RUNTIME TEST` | DOMPurify parses inline styles; whether any CSS-function/property survives is engine-specific |
| Template handling (`<template>`) | `ESTABLISHED SAFE BY CODE` | template content is inert on insertion; no custom handling that would activate it |
| Custom-element handling | `ESTABLISHED SAFE BY CODE` | no `ADD_TAGS`/`CUSTOM_ELEMENT_HANDLING` configured → custom/unknown elements are stripped by default |
| DOM-clobbering protections | `REQUIRES BENIGN RUNTIME TEST` | DOMPurify has clobbering mitigations, but name/id collisions affecting same-origin script globals need runtime confirmation in this document |
| Post-sanitization mutation (concatenation) | `REQUIRES BENIGN RUNTIME TEST` | each fragment sanitized independently then concatenated (:93); per-fragment safety is by DOMPurify, but concatenation across fragments is not a re-sanitization — needs runtime confirmation that no inter-fragment mutation occurs |
| Document-context difference (sanitize vs insert) | `REQUIRES BENIGN RUNTIME TEST` | DOMPurify sanitizes against the preview document; the same document is the insertion context (same origin) — but exact parser quirks need runtime confirmation |
| **globalCSS bypasses DOMPurify** (`<style>{cssText}` :203) | `SECURITY-RELEVANT DESIGN WEAKNESS` | `genGlobalCSS()` output is inserted as a stylesheet without any sanitization; React renders `<style>` children as text content (no HTML parsing → no JS), but attacker-influenced CSS reaches the document. Impact is limited to CSS (e.g., property injection); resource loads (`url()`, `@import`) are governed by CSP `style-src 'unsafe-inline'` / `img-src`. **No JavaScript execution is established.** |

> A broad “DOMPurify 3.2.5 has known bypasses” concern is **not** a finding without an application-reachable data flow proving a surviving construct under this exact config and engine. All DOMPurify-dependent rows are therefore `REQUIRES BENIGN RUNTIME TEST`, not weaknesses.

---

## 7. CSP & iframe evidence (static only)

- **iframe element/component:** `FilePreviewModal/index.tsx:134` → `<iframe src={previewUrl} />`
- **Assigned attributes:** `src` only.
- **`sandbox`:** **absent** (grep for `sandbox` across `src/` = 0 matches).
- **iframe URL construction:** `previewUrl = \`${FILE_PREVIEW_URL}#${urlParams.toString()}\`` (`:97`), `FILE_PREVIEW_URL = 'file-preview.html'` (`:30`). Relative → resolved against the main-app origin → **same-origin**.
- **Expected parent URL:** the main app loaded at `wickrSettings.webViewAddress` (runtime setting; **not statically resolvable**).
- **Expected preview URL:** `file-preview.html` at the same origin (served from RCC).
- **CSP meta elements:** one `<meta http-equiv="Content-Security-Policy">` in **both** entry HTML files (`extracted/decompressed/html_0x00E46F48_*.bin`, `html_0x00E568B7_*.bin`).
- **Response-header CSP in source:** **none.** No source code constructs CSP headers (grep for `setHttpHeaders`/header construction = 0 matches in sources; `setHttpHeaders` not present in the binary).
- **Header-delivered CSP proven?** **No.** Extraction proves a **meta-only** policy. The QML sets no `httpHeaders`. Absence of a header CSP in the inspected artifacts is reported as such; it is **not** claimed that no header policy could exist at runtime (e.g., a native URL interceptor could in principle add one — not evidenced).

**HTML character references decode before CSP interpretation.** The meta `content` attribute is serialized with `&#39;` for single quotes; the HTML parser decodes character references when the attribute is read, so the **effective** CSP text seen by the browser has literal `'`. Both forms:

- Exact serialized HTML attribute value (verbatim, entity-encoded):
```
default-src &#39;self&#39; qrc://* wickrweb://* ; style-src &#39;self&#39; &#39;unsafe-inline&#39; ; script-src &#39;self&#39; qrc://* ; connect-src &#39;self&#39; wickrweb://* https://bedrock-runtime.*.amazonaws.com https://bedrock-agent.*.amazonaws.com https://bedrock-agent-runtime.*.amazonaws.com ; img-src &#39;self&#39; https://tile.googleapis.com wickrweb://* blob: data: ; font-src &#39;self&#39; data: ; media-src &#39;self&#39; wickrweb://* data: blob: ; frame-src &#39;self&#39; blob: https://fast.com/ https://main.d4zeeqgazhley.amplifyapp.com/ ; worker-src &#39;self&#39; blob: ; child-src &#39;self&#39; blob: ; object-src &#39;self&#39;
```
- Decoded effective policy text:
```
default-src 'self' qrc://* wickrweb://* ; style-src 'self' 'unsafe-inline' ; script-src 'self' qrc://* ; connect-src 'self' wickrweb://* https://bedrock-runtime.*.amazonaws.com https://bedrock-agent.*.amazonaws.com https://bedrock-agent-runtime.*.amazonaws.com ; img-src 'self' https://tile.googleapis.com wickrweb://* blob: data: ; font-src 'self' data: ; media-src 'self' wickrweb://* data: blob: ; frame-src 'self' blob: https://fast.com/ https://main.d4zeeqgazhley.amplifyapp.com/ ; worker-src 'self' blob: ; child-src 'self' blob: ; object-src 'self'
```
(`connect-src` enumerates ~120 explicit AWS Bedrock hosts; abbreviated with `.*` here — full list in the HTML files.)

> **Correction of framing vs Phase 1:** Phase 1 listed `frame-ancestors` under “directives absent.” This review corrects that: a meta `<meta>` CSP **cannot** carry an enforceable `frame-ancestors` (browsers ignore `frame-ancestors` in meta tags), and no header CSP was found. The status of `frame-ancestors` at runtime is therefore **INSUFFICIENT EVIDENCE**, not “absent.” This review does **not** assert a header+meta AND-combination (no header policy is evidenced).

---

## 8. Candidate table

| ID | Source location | Attacker-controlled input | Transformation | Sensitive boundary | Existing validation | Classification | Missing evidence | Benign verification test |
|---|---|---|---|---|---|---|---|---|
| **C1** | `PowerPointPreview:201` (`dangerouslySetInnerHTML`) fed by worker slide HTML (worker:483,969,1195,1198) | PPTX text runs, shape name/id/type, hyperlink target, styles | worker string-concatenates unescaped values → DOMPurify.sanitize(html+svg) → React render | DOM insertion (HTML) | DOMPurify 3.2.5, html+svg profiles; per-fragment sanitize then concatenate | `REQUIRES BENIGN RUNTIME TEST` | Whether any construct (SVG/foreignObject, namespace switch, attribute, URI scheme) survives DOMPurify 3.2.5 in this QtWebEngine build | T1, T2, T3 below |
| **C2** | `PowerPointPreview:203` `<style>{cssText}</style>`; cssText from `genGlobalCSS()` (worker:1206-1212) | PPTX style-table CSS values | worker builds CSS string → React `<style>` text child (no DOMPurify) | DOM insertion (CSS) | **none** | `SECURITY-RELEVANT DESIGN WEAKNESS` (sanitization-scope gap; CSS-only, no JS exec established) | Whether injected CSS can cause resource loads that CSP permits (e.g., `url()` under img-src) | T4 below |
| **C3** | `FilePreviewModal:134` `<iframe src={previewUrl} />` | — (architectural) | same-origin frame, no `sandbox` | frame isolation | CSP `frame-src 'self'` | `SECURITY-RELEVANT DESIGN WEAKNESS` (missing sandbox; preview shares full app origin) | Whether the preview origin equals the app origin at runtime | T5 below |
| **C4** | `FilePreviewModal:101` message gate | MessageEvent (any same-origin sender) | origin-only check → openLink dispatch | messaging trust | `event.origin === window.parent.origin`; object check; user ConfirmModal downstream | `REQUIRES BENIGN RUNTIME TEST` | Behavior for spoofed/stray same-origin messages; whether `event.source` discrimination matters | T6 below |
| **C5** | `PowerPointPreview:25` SVG profile enabled | PPTX shape SVG | DOMPurify svg profile | sanitizer namespace surface | DOMPurify default SVG handling | `REQUIRES BENIGN RUNTIME TEST` | SVG/foreignObject mutation behavior under DOMPurify 3.2.5 + this engine | T2 below |
| **C6** | `ui.ts:163,166` `uiBridge.openLink` (native) reached from `FilePreviewModal:104` | preview link URL | openLink thunk with `showConfirmation:true` → ConfirmModal → native | native bridge invocation | **user confirmation dialog** (`ui.ts:151-164`) | `ESTABLISHED SAFE BY CODE` | none (user-mediated) | T7 below |
| **C7** | worker:1195 `<a href='{linkURL}'>` unescaped; linkURL from worker:188 `@_Target` | PPTX hyperlink target URL | emitted into slide HTML → DOMPurify → DOM → click | URI in DOM | DOMPurify URI scheme filtering; withLinkHandler re-reads rendered `a.href`; user ConfirmModal | `REQUIRES BENIGN RUNTIME TEST` | Effective `href` scheme after DOMPurify + browser attribute serialization | T8 below |

---

## 9. Benign runtime test plan (no attacker JS; no native invocation)

Observations permitted: element/attribute presence, DOM namespace/tree, resolved URLs, parent/preview origins, CSP violation events, message-handler rejection, post-insertion markup stability. Markers are inert (`data-review-marker`); URLs are invalid local URLs.

| Test | Property | Source motivation | Controlled input (abstract PPTX fixture / action) | Expected safe result | Concerning result | Required observation | Harness |
|---|---|---|---|---|---|---|---|
| **T1** | Sanitizer strips inert dangerous markup | C1 / PowerPointPreview:22-29,201 | Smallest PPTX text run carrying inert marker string `<img src=x data-review-marker="1">` in a slide text element | `<img>` removed or marker retained but no `src`-as-script; `data-review-marker` may remain | any surviving event-handler attr or `<script>` | Inspect rendered DOM under `.pptx2htmlWrapper` for handler/script elements; assert none | unit (worker+DOMPurify in jsdom/Chromium) |
| **T2** | SVG namespace handling | C5 / PowerPointPreview:25 | PPTX shape that yields `<svg>` containing a `<foreignObject>` with inert `<div data-review-marker="1">` | foreignObject content sanitized; namespace correct | namespace-switch mutation changing tree after insertion | Compare DOM tree immediately vs after a microtask; assert stable | unit + stock client |
| **T3** | URI scheme filtering | C1/C7 / PowerPointPreview:22-29 | Slide hyperlink whose `@_Target` is an invalid local URL `local-invalid://review-marker` and a `javascript:alert(0)`-style inert string | dangerous scheme stripped from `href`; local-invalid retained as text/no navigation | `javascript:` survives in rendered `a.href` | Read rendered `a.href` for each link; assert no `javascript:`/`vbscript:` | unit (worker+DOMPurify) |
| **T4** | CSS-bypass scope | C2 / PowerPointPreview:203; worker:1209 | PPTX style-table entry producing CSS `selector{background:url(local-invalid://cssmarker)}` | CSP blocks the resource load (violation event) under img-src | resource fetch to an external host succeeds | Capture `SecurityPolicyViolationEvent` for the CSS `url()`; assert blocked | stock client (needs CSP + network observer) |
| **T5** | Iframe origin & isolation | C3 / FilePreviewModal:134 | Open preview; read `window.location.origin` in both parent and iframe | preview origin === app origin (same-origin) AND `sandbox` absent | — | Record `iframe.contentWindow.location.origin` and parent origin; note `sandbox` null | stock client |
| **T6** | Message-handler discrimination | C4 / FilePreviewModal:101 | Send `postMessage({type:'openLink',url:'local-invalid://m'}, targetOrigin=app-origin)` from (a) the real preview, (b) a synthetic same-origin `window.open`/iframe, (c) a cross-origin frame | (c) rejected; (a) accepted; (b) **accepted** (documents origin-only behavior) | cross-origin accepted, OR ConfirmModal bypassed | Observe whether ConfirmModal appears / openLink dispatch fires for each | stock client |
| **T7** | User-mediated native reach | C6 / ui.ts:151-164 | Click a preview link (inert `local-invalid://review`) | ConfirmModal shown before any native call | native openLink invoked without confirmation | Observe ConfirmModal presence; assert `uiBridge.openLink` not called before confirm | stock client |
| **T8** | Rendered href serialization | C7 / withLinkHandler:17 | Preview link with complex target; read `a.getAttribute('href')` vs `a.href` (property) | DOMPurify-neutralized URL reflected verbatim | property re-serializes a stripped `javascript:` back to executable form | Compare attribute vs property; assert neither yields `javascript:` | unit |

(T1–T3, T8 can run in a unit harness importing the worker module + DOMPurify against Chromium/jsdom. T4–T7 require the stock client because they depend on CSP enforcement, real origins, and the native bridge.)

---

## 10. Contradictions and corrections vs Phase 1 extraction summary

| Topic | Phase 1 statement | Phase 2A corrected position | Reason |
|---|---|---|---|
| CSP delivery | implied meta-only | Confirmed **meta-only** in inspected artifacts; **no header CSP found** (no `setHttpHeaders` in QML/sources) | explicit grep; QML review |
| Encoded vs effective CSP | gave both forms | Same; add explicit note: HTML char references (`&#39;`) are decoded before CSP interpretation, so the effective policy uses literal `'` | HTML parsing rule |
| `frame-ancestors` | listed under “absent directives” | **INSUFFICIENT EVIDENCE**: meta tags cannot enforce `frame-ancestors`; no header policy found; cannot assert absence at runtime | CSP spec + no header evidence |
| Same-origin behavior | “same-origin preview iframe” | Confirmed: `frame-src 'self'`, `file-preview.html` relative → same origin; runtime equality still requires T5 | code + needs runtime |
| Origin gate | “origin gate at line 101” | Accurate line, but it checks **origin only** (not `event.source`, not instance); same-origin senders all pass | source quote |
| DOMPurify version | “3.2.5” | Confirmed: `dompurify,3.2.5` in manifest + bundled banner | manifest evidence |
| DOMPurify config | “svg+html” | Exact: `DOMPurify.sanitize(dirty,{USE_PROFILES:{html:true,svg:true}})`, no hooks, no overrides | source quote |
| Worker output | “attacker-influenced HTML” | Expanded: unescaped interpolation of text/name/linkURL/shape-attrs; emits section/div/svg/img(data:)/a/table + separate globalCSS that **bypasses** DOMPurify | worker review |
| Preview→WebChannel | (not addressed) | **Unreachable** in preview context (`qt` undefined → `getOrOpenWickrQWebChannels` throws) | platform.ts + utils.ts |

---

## 11. Files required next (to close remaining gaps)

1. `E:\wickr\extracted\sources\src\lib\pptx2html\pptx2html.worker.js` deeper emitters (lines 260-480, 506-960, 1214-1370) — to enumerate every attribute/element the worker can produce (for complete C1/C7 input characterization). Already partially covered; remaining ranges needed for exhaustive sink inventory.
2. `E:\wickr\extracted\decompressed\qml_0x030A2BEC_7847.bin` full QML — to confirm whether any `WebEngineProfile.httpHeaders` / URL interceptor injects a **header** CSP (resolves the meta-vs-header question definitively).
3. `qrc:///webengine/preloads.js` body (still NOT FOUND) — to determine whether any document-global script/bridge/scheme setup alters the preview trust boundary before the React app runs.
4. Runtime observations (not files): the resolved value of `wickrSettings.webViewAddress` (parent origin), the preview `window.location.origin`, and whether a CSP `report-only`/header policy is delivered (T4/T5). These cannot be obtained statically.

---

*No DOMPurify bypass, CSP bypass, JavaScript execution, bridge invocation, native impact, or RCE is claimed. All classifications are bounded to the supplied artifacts. The application was not executed.*
