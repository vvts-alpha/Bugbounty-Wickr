# Phase 2B — CSP / CSS / Iframe / Message Boundary Verification

**Subject:** AWS Wickr 6.72.20.0 (`WickrPro.exe`, sha256 `eccafde833d34386c859d6548e922649c2f58cd15f82998c8bd2966219341dbd`)
**Mode:** Static source + RCC-metadata extraction. **Runtime execution of the stock client was NOT authorized in this phase**, and a GUI Qt WebEngine app cannot be driven/observed through the available shell tooling. Runtime-dependent items are therefore delivered as ready-to-run probe specifications alongside the maximum statically-determinable answers.
**No exploit, no malicious document, no JS execution, no native-bridge invocation.**

---

## 1. Terminology (corrected)

These terms are **not** interchangeable and are used precisely below:

| Term | Meaning | Applies here? |
|---|---|---|
| **Sanitizer bypass** | Data passes *through* DOMPurify and then escapes its guarantees (a surviving dangerous construct) | Not established for the slide path (no proof of a survivor) |
| **Sanitizer coverage gap** | Data reaches the DOM **without ever being passed through** the sanitizer | **YES — `globalCSS`** never enters DOMPurify |
| **CSP-permitted CSS injection** | Attacker-derived CSS reaches a stylesheet because CSP allows it (`style-src 'unsafe-inline'`) | **YES — source-proven for `globalCSS`** |
| **CSS-triggered resource loading** | Inserted CSS causes the engine to fetch a resource (`url()`, `@import`) | Runtime-pending (governed by `img-src`/`style-src`) |
| **JavaScript execution** | Active script runs as a result of the above | **NOT established** (CSS cannot execute JS in QtWebEngine/Chromium; React renders `<style>` children as text content) |

**Phase 2A correction:** Phase 2A labelled `globalCSS` a “DOMPurify bypass.” That label was imprecise. Because `globalCSS` is **never processed by DOMPurify**, the correct classification is **SANITIZER COVERAGE GAP** (a scope/coverage issue), not a bypass.

---

## 2. Complete `globalCSS` call graph (source-backed)

```
PPTX text run (a:r) ── a:rPr/a:latin/@_typeface (attacker string, UNESCAPED)
        │             ── color source (attacker-influenced hex)
        ▼
pptx2html.worker.js
  processTextSpan?  -> genTextBlock (caller builds `color` + style fns) :1156-1175
  styleText = 'color:'+color+';font-size:'+getFontSize(...)+';font-family:'+getFontType(...)
              +';font-weight:'+getFontBold(...)+';font-style:'+getFontItalic(...)
              +';text-decoration:'+getFontDecoration(...)+';vertical-align:'+getTextVerticalAlign(...)
              +'; background-color:'+bgColor+';'                       (worker:1158-1175)
      • property NAMES: HARDCODED (fixed set) — NOT attacker-controlled
      • property VALUES:
          - getFontType (worker:1488-1489) = node a:rPr/a:latin/@_typeface  -> RAW ATTACKER STRING, NO escape
          - color                                          -> attacker-influenced hex string, NO escape
          - getFontSize/getFontBold/Italic/Decoration/getTextVerticalAlign -> numeric or fixed strings (safe)
      • NO escaping, NO validation, NO URL normalization on values
  styleTable[styleText] = { name:'_css_N', text:styleText }             (worker:1182-1186)
  ...
  genGlobalCSS(): cssText += 'section .'+name+'{'+text+'}\n'            (worker:1206-1212)
  self.postMessage({type:'globalCSS', data: cssText})                   (worker:80-82)
        ▼
PowerPointPreview/index.tsx
  case 'globalCSS': setCssText(msg.data)                                (:116-118)
  ... <style>{cssText}</style>                                          (:203)  ◄── SINK
      • React renders <style> children as TEXT CONTENT (textContent), NOT innerHTML
      • Inserted BEFORE or AFTER DOMPurify?  DOMPurify (slide path) and <style> are
        SIBLING renders in the same JSX; globalCSS NEVER passes through DOMPurify.
      • No later transformation of cssText (no reparse, no CSSOM rewrite by app code)
        ▼
final representation: a live <style> element in the preview document (CSSStyleSheet)
```

### Source-backed answers (§2 requirements)

| Question | Answer | Proven? |
|---|---|---|
| PPTX parts/XML nodes influencing it | `a:r`/`a:rPr`/`a:latin/@_typeface`, color node, `@_sz`, `@_b`, `@_i`, `@_u`, `@_baseline` | yes |
| Property names attacker-controlled? | **No** — fixed set hardcoded (worker:1158-1175) | yes |
| Property values attacker-controlled? | **Yes for `font-family`** (getFontType raw `@_typeface`) **and `color`**; numeric/fixed for the rest | yes |
| URL parsing/normalization | **None** on CSS values | yes |
| Escaping/serialization | **None** — raw concatenation | yes |
| Output type | CSS text string (`section ._css_N{...}\n` per style) | yes |
| Exact DOM insertion method | React JSX `<style>{cssText}</style>` → `style.textContent = cssText` | yes |
| Becomes style element / inline / CSSStyleSheet / CSSOM op | A `<style>` **element** (parsed by the engine into the CSSOM) | yes |
| Inserted before or after DOMPurify? | **Never processed by DOMPurify** (separate sink) — sanitizer-exempt | yes |
| Later transformations | None by app code | yes |

**Conclusion (§2):** `globalCSS` is **SANITIZER-EXEMPT**. Attacker-controlled CSS **values** (font-family, color) reach the final `<style>` element, source-proven. Property **names** are fixed. This is a **sanitizer coverage gap** producing **CSP-permitted CSS injection**. **No JavaScript execution is established** (CSS is not executable; `<style>` is text content).

---

## 3. Recovery of `qrc:///webengine/preloads.js`

**STATUS: RECOVERED** via RCC-data-array positioning (Phase 1 erroneously marked it NOT FOUND).

### Method
Phase 1 used raw-string/zlib scanning and missed `preloads.js` because it is stored **UNCOMPRESSED** in the Qt RCC data array (no zlib header). Phase 2B recovered it by:
1. Parsing the RCC **names blob** (UTF-16LE path components) at `0x31FA1xx` → found the `/webengine/` directory listing order: `favicon.ico, wickr.html, preloads.js, qwebchannel.js, main.qml`.
2. Locating the known `qwebchannel.js` RCC data entry (header `[00 00 10 96][00 00 43 1d]` = comp 4246 / uncomp 17181 at `0x31EE43E`; zlib at `0x31EE446`).
3. Reading the bytes immediately preceding it → the `preloads.js` body sits between the `wickr.html` entry end (`</html>\r\n` at `0x31EE3BA`) and the `qwebchannel.js` header (`0x31EE43E`).

### Recovered artifact
| Field | Value |
|---|---|
| Absolute output path | `E:\wickr\extracted\rcc\preloads.js` |
| qrc path | `qrc:///webengine/preloads.js` |
| Size | 125 bytes (body, file offset `0x31EE3BF`–`0x31EE43E`; a single `~` prefix byte at `0x31EE3BF` is a concatenation artifact) |
| SHA-256 | `093925b2c0ceaef06763fffe4f26bdb1b7fda863bb3a2b2d1ff634e5ca0f2249` |
| Extraction method | RCC names-blob parse + data-array boundary localization (uncompressed entry) |
| Discreteness proof | `window.URL = class QURL` occurs exactly **once** in the binary (`0x31EE3C0`); absent from the debug harness HTML extract |

### Exact content
```js
~window.URL = class QURL extends URL {
  constructor(url, base) {
    super(url, base === 'qrc:' ? 'qrc:/' : base);
  }
}
```
(The leading `~` is a JS expression-prefix artifact; functional behavior = `window.URL = class QURL extends URL {...}`.)

### Behavior inventory (all of it)
- **DOM:** overrides `window.URL` so that `new URL(url, 'qrc:')` treats `'qrc:'` as `'qrc:/'`. **No other DOM access, mutation, or insertion.**
- **Messages:** none (no `postMessage`, no `message` listener).
- **Bridge:** none (no `qt.webChannelTransport`, no `QWebChannel`).
- **URL:** the only URL logic is the `'qrc:'`→`'qrc:/'` base translation shim.
- **Script/resource loading:** none.
- **Scheme registration:** none in JS (the `wickrweb://` scheme is registered native-side; see §7).

**Security relevance:** minimal. The preload does **not** alter the preview trust boundary: it adds no bridge, no message handler, no script loader, no global capability beyond fixing `qrc:` base URL construction. It runs in `MainWorld` at `DocumentCreation` for every page in the main WebEngineView (per QML §7).

> Caveat: the precise 8-byte RCC data-entry header for this uncompressed entry was not cleanly isolated (3 null padding bytes precede the body rather than a `[0x00000000][size]` word). The body content and its position between `wickr.html` and `qwebchannel.js` (matching the names-blob order) are unambiguous; only the exact entry-size word alignment is imprecise.

---

## 4. Effective runtime CSP (static maximum; runtime pending)

**Runtime capture NOT performed** (execution not authorized; no GUI tooling). Below is the statically-determinable effective policy plus the inert probe set to run when authorized.

### Static determination
- **Header CSP:** **NOT FOUND.** No source constructs CSP headers; QML sets **no `httpHeaders`** and registers **no URL interceptor** (grep of all decompressed QML: `httpHeaders`/`UrlRequestInterceptor`/`setHttpHeaders` = 0 hits). Therefore the extraction proves a **meta-only** policy.
- **Meta CSP:** present in both entry HTMLs (zlib-compressed in RCC). `frame-ancestors` cannot be enforced via meta (browser-ignored); its runtime status is **INSUFFICIENT EVIDENCE**.
- **Custom-scheme headers:** the `wickrweb://` handler is native-side (not in JS/QML); whether it injects response headers is **not statically resolvable** (native code not in the JS/QML artifact set).

### Exact serialized meta policy (verbatim, entity-encoded) and decoded effective text
- **Serialized HTML attribute (verbatim):**
```
default-src &#39;self&#39; qrc://* wickrweb://* ; style-src &#39;self&#39; &#39;unsafe-inline&#39; ; script-src &#39;self&#39; qrc://* ; connect-src &#39;self&#39; wickrweb://* https://bedrock-runtime.*.amazonaws.com https://bedrock-agent.*.amazonaws.com https://bedrock-agent-runtime.*.amazonaws.com ; img-src &#39;self&#39; https://tile.googleapis.com wickrweb://* blob: data: ; font-src &#39;self&#39; data: ; media-src &#39;self&#39; wickrweb://* data: blob: ; frame-src &#39;self&#39; blob: https://fast.com/ https://main.d4zeeqgazhley.amplifyapp.com/ ; worker-src &#39;self&#39; blob: ; child-src &#39;self&#39; blob: ; object-src &#39;self&#39;
```
- **Decoded effective policy (HTML char references → literals):**
```
default-src 'self' qrc://* wickrweb://* ; style-src 'self' 'unsafe-inline' ; script-src 'self' qrc://* ; connect-src 'self' wickrweb://* https://bedrock-runtime.*.amazonaws.com https://bedrock-agent.*.amazonaws.com https://bedrock-agent-runtime.*.amazonaws.com ; img-src 'self' https://tile.googleapis.com wickrweb://* blob: data: ; font-src 'self' data: ; media-src 'self' wickrweb://* data: blob: ; frame-src 'self' blob: https://fast.com/ https://main.d4zeeqgazhley.amplifyapp.com/ ; worker-src 'self' blob: ; child-src 'self' blob: ; object-src 'self'
```
(`connect-src` enumerates ~120 explicit AWS Bedrock hosts; abbreviated with `.*`.)

### Inert probe set (run when execution authorized)
All probes use inert markers / invalid local URLs; none relies on JS execution.

| Probe | Expected under decoded meta policy | Observation |
|---|---|---|
| Inline `<script>/*marker*/</script>` | **Blocked** (`script-src 'self' qrc://*`, no `'unsafe-inline'`) | `SecurityPolicyViolationEvent`, directive `script-src` |
| External script from invalid origin (`https://invalid-review.invalid/x.js`) | **Blocked** | violation, `script-src`/`connect-src` |
| Inline `style` attribute / `<style>` | **Permitted** (`style-src 'unsafe-inline'`) | no violation |
| Same-origin image (`/assets/...` or `qrc:`) | **Permitted** (`img-src 'self'`) | load ok |
| Image with invalid scheme (`invalid-scheme://marker/x.png`) | **Blocked** | violation, `img-src`/`default-src` |

Captures required at runtime: `document.URL`, `location.origin` (parent + preview), response headers visible to the engine (via DevTools Network or `performance.getEntries()`), every `<meta http-equiv>` element, any `Content-Security-Policy-Report-Only`, and the `SecurityPolicyViolationEvent` fields (`violatedDirective`, `blockedURI`, `effectiveDirective`).

---

## 5. CSS boundary verification (source-proven; runtime fixture specified)

Because the worker’s npm deps (jszip, fast-xml-parser, colz, highlight.js) cannot be fetched (no external hosts), the worker cannot be executed in an isolated unit harness here. The boundary is instead **source-proven**, and a precise fixture + expected observations are specified for authorized execution.

### Source-proven facts
- Attacker-derived CSS **does** reach the final document: the data flow PPTX `@_typeface` → `getFontType` (raw) → `styleText` → `genGlobalCSS` → `<style>{cssText}</style>` is fully source-backed with **no escaping/validation** (§2).
- The **smallest** fixture to surface it: a PPTX with one text run whose `a:latin/@_typeface` = an inert marker string such as `reviewMarkerFont` and, to test property/rule injection, a value containing CSS metacharacters such as `revMarker;}section{--review:1` (inert custom property; no script, no handler, no active URL).

### Fixture + observation matrix (inert only)

| Test | Controlled input (abstract PPTX) | Generated worker output (expected) | Pre-insertion CSS | Final CSSOM/serialized | CSP event | Network | Classification |
|---|---|---|---|---|---|---|---|
| C-1 | text run, `@_typeface`=`reviewMarkerFont` | `section ._css_N{...;font-family:reviewMarkerFont;...}` | contains marker | marker present in `document.styleSheets[...]` | none (style permitted) | none | CSP-PERMITTED CSS INJECTION (proven by source; runtime confirms reach) |
| C-2 | text run, `@_typeface`=`a;}section{--review:1` | rule broken: `...font-family:a;}section{--review:1;...}` wrapped → extra rule with `--review` | injected `--review` | custom property `--review` present on `section` | none | none | CSS INJECTION of extra declarations (inert; no JS) |
| C-3 | text run, `@_typeface`=`a;background:url(invalid-local://cssmarker)` | `font-family:a;background:url(invalid-local://cssmarker);...` | url() present | resource fetch attempted | **violation expected** (`img-src`/`default-src` block invalid scheme) | blocked request | CSS-TRIGGERED RESOURCE LOAD (governed by CSP) |
| C-4 | compare `<style>` textContent before vs after a microtask | — | — | unchanged | — | — | NO post-insertion rewrite by app code (proven: no mutation code) |

None of C-1..C-4 uses script, handler attribute, javascript:/data:active URL, external service, or native call.

---

## 6. Iframe & message-source boundary (source-proven; runtime probes specified)

### Source-proven (static)
- **Iframe:** `<iframe src={previewUrl} />` (`FilePreviewModal/index.tsx:134`). Only attribute: `src`. **No `sandbox`.** `previewUrl` = `file-preview.html#${params}` (relative → same-origin).
- **Message handler:** `FilePreviewModal/index.tsx:99-114`, gate `:101` `event.data && typeof event.data==='object' && event.origin===window.parent.origin`.
  - **`event.origin`:** validated (=== `window.parent.origin`).
  - **`event.source`:** **NOT validated.**
  - **schema:** only `typeof object`; `.type` matched only on `'openLink'` (default logs).
  - **URL validation:** none in handler; forwarded to `openLink` thunk which shows a **ConfirmModal** before `uiBridge.openLink` (native) — the user-confirmation boundary.
- Same-origin sender (any) is **accepted**; cross-origin is rejected. The handler does **not** verify the specific preview instance or the source window.

### Runtime probes (inert; do not trigger native `openLink` — substitute an instrumented dispatch or breakpoint before `ui.ts:163`)
Record: iframe `src`, all effective iframe attributes (DOM), resolved preview URL, parent/preview `location.origin`, and reference equality `event.source === iframe.contentWindow`.

| Sender | Origin | Schema | Expected accept? |
|---|---|---|---|
| intended preview iframe | same | `{type:'marker'}` (not openLink) | origin passes; no native op (type unknown → logged) |
| unrelated same-origin iframe | same | `{type:'marker'}` | **accepted** (documents origin-only behavior) |
| top-level window | same | `{type:'marker'}` | **accepted** |
| same-origin popup (if reproducible) | same | `{type:'marker'}` | **accepted** |
| cross-origin frame | different | `{type:'marker'}` | **rejected** |
| malformed (string data) | any | non-object | rejected (object check fails) |

Classifications (separate): **origin validation = present; source-window validation = absent; schema validation = minimal (object only); URL validation = absent in handler (downstream user-confirmation boundary present).**

---

## 7. QML & custom-scheme review (source-backed)

Source: decompressed `qml_0x030A2BEC_7847.bin` (main WebEngine setup) + grep of all 134 decompressed QML files.

| Setting | Finding | Location |
|---|---|---|
| Request interception (`UrlRequestInterceptor`/`setUrlRequestInterceptor`) | **Not present** in any QML | grep: 0 hits |
| Response-header modification (`httpHeaders`/`setHttpHeaders`) | **Not present** in any QML → no header CSP injected via QML | grep: 0 hits |
| Custom URL scheme registration in QML (`registerUrlScheme`/`QWebEngineUrlScheme`) | **Not present** in QML — `wickrweb://` is registered **native-side (C++)**, outside the JS/QML artifact set | grep: 0 hits in QML |
| Local-content access (`localContentCanAccessRemote`/`localContentCanAccessFileUrls`) | **Not set** in QML (engine defaults apply) | — |
| JavaScript enablement (`javascriptEnabled`) | Not overridden (default enabled) | — |
| WebChannel registration | `channel.registerObject("uiBridge", uiBridge)`; `webChannel: channel` | qml_0x030A2BEC |
| User scripts / preload injection | `userScripts.collection=[{sourceUrl:"qrc:///webengine/preloads.js", injectionPoint:WebEngineScript.DocumentCreation, worldId:MainWorld}]` | qml_0x030A2BEC |
| Certificate-error handling | main webview: `onCertificateError: error.ignoreCertificateError()` (errors ignored); OIDC webview defers CA-invalid to a dialog | qml_0x030A2BEC / qml_0x0306CFAE |
| Feature-permission grants | `grantFeaturePermission(securityOrigin, feature, true)` for any origin | qml_0x030A2BEC |
| Other | `profile.offTheRecord:true`; `NoPersistentCookies`; `javascriptCanAccessClipboard:true`; `javascriptCanPaste:true` | qml_0x030A2BEC |

**Implication:** the only CSP in effect for the web content is the **meta policy** (§4). Whether the native `wickrweb://` scheme handler injects response headers is **not statically resolvable** from JS/QML and remains a runtime observation (§8).

---

## 8. Candidate / test classification summary

| ID | Item | Classification |
|---|---|---|
| G-1 | `globalCSS` sanitizer relationship | **SANITIZER EXEMPT** (coverage gap; never through DOMPurify) |
| G-2 | Attacker-derived inert CSS reaches final document | **SOURCE-PROVEN YES** (runtime confirmation = probe C-1) |
| G-3 | CSS-triggered resource loading | **REQUIRES RUNTIME TEST** (C-3; governed by CSP) |
| P-1 | `preloads.js` body | **RECOVERED** (125-byte `window.URL`/`qrc:` shim; no bridge/msg/script behavior) |
| C-CSP | Effective runtime CSP | **REQUIRES RUNTIME TEST** (meta-only proven statically; header CSP not found) |
| C-ORIG | Parent/preview runtime origins | **REQUIRES RUNTIME TEST** (expected same-origin; static = relative `file-preview.html`) |
| C-HDR | Header CSP existence | **NOT FOUND statically** (no httpHeaders/interceptor in QML or sources) |
| M-1 | Message handler `event.source` validation | **ABSENT** (origin only) — source-proven |
| M-2 | openLink native invocation | **ESTABLISHED SAFE BY CODE** (user ConfirmModal before `uiBridge.openLink`) |

---

## 9. Unresolved evidence gaps

1. **Effective runtime CSP** (header vs meta-only, report-only): requires authorized execution with DevTools/Network observation. Statically, only the meta policy is proven; no header policy is evidenced.
2. **`wickrweb://` native scheme handler headers**: native C++ code is outside the JS/QML artifact set — cannot determine statically whether it injects response headers.
3. **CSS-triggered resource loading (C-3)**: requires running the worker fixture or the stock client to observe whether an inserted `url()` is blocked by CSP.
4. **Parent/preview runtime origin equality**: requires runtime capture (expected same-origin from relative `file-preview.html` + `frame-src 'self'`).
5. **Message `event.source` discrimination at runtime**: requires synthetic-message probes (§6) to confirm same-origin senders are accepted (source already proves the check is origin-only).
6. **QtWebEngine/Chromium exact version**: still runtime-injected; affects DOMPurify SVG-handling conclusions from Phase 2A.

---

*No CSP bypass, JavaScript execution, bridge invocation, native impact, or RCE is claimed. The stock client was not executed. All source-proven conclusions are bounded to the recovered artifacts.*
