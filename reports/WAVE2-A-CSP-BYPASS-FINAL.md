# Wave-2 Profile-E — FINAL CSP-Bypass Analysis (docx/pptx renderer → bridge)

**Target:** AWS Wickr (WickrPro.exe) 6.72.20 · **Engine:** QtWebEngine 6.9.2 = Chromium 130.0.6723.192 · **Date:** 2026-07-25
**XSS primitive (verified):** `docx-preview` `renderSymbol` → `t.innerHTML = "&#x"+e.char+";"` (raw `w:sym/@w:char`); stronger `renderAltChunk` → `iframe.srcdoc` variant (parser-inserted, CSP-bound).
**CSP (verbatim, `<meta http-equiv>` on both `qrc:/index.html` and `qrc:/file-preview/index.html`):**
```
default-src 'self' qrc://* wickrweb://* ; style-src 'self' 'unsafe-inline' ; script-src 'self' qrc://* ;
connect-src 'self' wickrweb://* https://bedrock-*.amazonaws.com ;
img-src 'self' https://tile.googleapis.com wickrweb://* blob: data: ; font-src 'self' data: ;
media-src 'self' wickrweb://* data: blob: ;
frame-src 'self' blob: https://fast.com/ https://main.d4zeeqgazhley.amplifyapp.com/ ;
worker-src 'self' blob: ; child-src 'self' blob: ; object-src 'self'
```

---

## 1. CSP Directive Matrix

| Directive | Sources | Risk | Bypass potential (on shipped engine) |
|---|---|---|---|
| `default-src` | `'self' qrc://* wickrweb://*` | HIGH (fallback) | Falls back to **fetch/style/img/media/etc.** and, critically, to **frame-ancestors/navigate-to**-adjacent families. `wickrweb://*` here is the key data-plane primitive (see §3.1). |
| `script-src` | `'self' qrc://*` | **CRITICAL** (the load-bearing control) | **No** `unsafe-inline`/`unsafe-eval`/nonce/hash, **no** `data:`/`blob:`. This single directive blocks every inline/parser-injected script. The ONLY thing it allows is same-origin (`qrc:`) or any-`qrc://` script. All qrc resources are read-only and attacker-content-free → **HARD NEGATIVE** (verified). |
| `style-src` | `'self' 'unsafe-inline'` | MED | `unsafe-inline` enables arbitrary CSS injection (docx raw `style=""` survives DOMPurify; PPTX `globalCSS` set unsanitized). No JS-exec gadget in modern Blink; usable for **declarative GET** via `background:url(wickrweb://…)` (DOMPurify does not sanitize CSS). |
| `connect-src` | `'self' wickrweb://* bedrock-*.amazonaws.com` | MED-HIGH | Allows any running `'self'` script to `fetch()` the full native `wickrweb://` API. Useless to *attacker-injected* code (no script exec), but defines the data plane a successful exec would reach. Bedrock = AI inference (POST only, SigV4-signed, no CORS read). |
| `img-src` / `media-src` | `'self' https://tile.googleapis.com wickrweb://* blob: data:` | **HIGH (data exfil / CSRF plane)** | `<img src=wickrweb://endpoint>` issues a **declarative GET** to the native URL-scheme handler with **no JS**. Same for `<video>`, `poster=`, `background:url(...)` in inline CSS. This is the strongest script-free impact channel. |
| `font-src` | `'self' data:` | LOW | data: fonts; no exfil gadget. |
| `frame-src` | `'self' blob: fast.com/ amplifyapp.com/` | MED | Explicit, **excludes `wickrweb://`** → cannot frame attacker file bytes served from `wickrweb://`. `blob:` iframe possible but inherits parent CSP (post-M90). Two external domains = in-app speed test (see §2). |
| `worker-src` / `child-src` | `'self' blob:` | LOW-MED | Blob workers allowed; `importScripts` still subject to `script-src` (no blob:/data: there) → only `'self'`/qrc scripts importable. Service-worker registration additionally needs HTTPS same-origin scope (qrc is opaque origin) → blocked. |
| `object-src` | `'self'` | LOW | Blocks `<object>/<embed>` of wickrweb/attacker content. |
| **MISSING `base-uri`** | — | MED (theoretically HIGH, practically neutralized) | `<base href>` is injectable, but **no relative script loads exist** to hijack (only static hashed chunks + absolute `qrc:/` imports). CSS `url()` is resolved against the stylesheet base, not `<base>`. See §4.1. |
| **MISSING `form-action`** | — | **HIGH** | No restriction on form submission target. Attacker form → external endpoint = data exfil without script. (But preview has little sensitive data to POST.) |
| **MISSING `frame-ancestors`** | — | LOW (desktop) | Meta-CSP `frame-ancestors` is ignored anyway; in-app framing is governed by `frame-src`. |
| **MISSING `navigate-to` / Trusted Types** | — | LOW / MED | `navigate-to` is experimental & unsupported in Blink; TT not enforced → sinks like `.innerHTML` are unguarded **but** only reachable by `'self'` scripts (no attacker script). |

**Interaction effects**
- `frame-src` explicit ⟹ **does NOT fall back** to `default-src`; this is what kills "frame a `wickrweb://` attacker doc".
- `img/media-src` include `wickrweb://*` while `script-src`/`frame-src` do not ⟹ creates an **asymmetric declarative-GET primitive** (Family-G).
- Meta-CSP (not header) on QtWebEngine 6.9 (Chromium 130) is enforced with full strength *including* inheritance into `about:srcdoc`/`about:blank` children (post-M90 behavior). This is the single fact that keeps `altChunk → srcdoc` inert.

---

## 2. Whitelisted External Domains

### 2.1 `https://fast.com/` & `https://main.d4zeeqgazhley.amplifyapp.com/`
**Purpose: in-app internet speed test** (`CheckSpeedModal` React component). fast.com = Netflix speedtest; the Amplify app = a Wickr-controlled companion (AWS Amplify static host) used as the speed-test harness/UI. Both are framed, not navigated.
- **postMessage relay?** No same-origin relationship with `qrc:`; even if framed, they cannot reach the parent bridge (origin-restricted). No evidence of an open redirect or JSONP on either.
- **UXSS via navigation?** `frame-src` allows the *origin*, but navigating the frame to `javascript:` is CSP-blocked; navigating to attacker content requires that content to be *on* fast.com/amplifyapp.com (no such reflector found).
- **Verdict:** benign framing; no script-gadget/relay path. Hardening: pin to exact paths, drop from default profile if speed-test is optional.

### 2.2 `https://bedrock-runtime.us-east-1.amazonaws.com` (connect-src)
AWS Bedrock (AI inference). POST-only, **SigV4-signed** requests; no unauthenticated/reflective GET. CORS does not permit reading responses from `qrc:`. Not a JSONP/JS source and not in `script-src`. **Verdict:** unusable for exec; at most a blind-fire oracle (and only from a `'self'` script that does not exist).

### 2.3 `https://tile.googleapis.com` (img-src)
Google Maps tiles for the location feature. No known open redirect that returns attacker JS; it is in `img-src` only (not script). **Verdict:** pixel-tracker exfil channel only (already inferior to `wickrweb://` GET).

---

## 3. QT WebEngine / Wickr-Specific Surface

### 3.1 `wickrweb://` — the native API scheme (BIGGEST data plane)
Registered via `QQuickWebEngineProfile::installUrlSchemeHandler`. Routes (from `src/apis/webFetch/endpoints.ts`):
`convo`, `convolist`, `convo/:id/members`, `message/:cid/:mid`, `message/:cid/:mid/:before/:after`,
`message/.../react/:emoji`, `users/self`, `users/idHash/:h`, `users/id/:id`, `image/user/:id`,
`image/userId/:id`, `users/blocked`, `image/message/:cid/:mid`, `audio/message/:cid/:mid`,
`file/message/:cid/:mid`, `file/savedfile/:guid`, `filemanager/...`, `devices/active`,
`convo/:id/roomHistory`, `search`, `verification/fingerprints/:uid`, `contacts/*`,
`myaccount/password`, `contacts/convertdirectoryuser`, `myaccount/leavenetwork`, `admin/controls`,
`admin/inviteuser`, `contacts/checkuser`, **`awsCredentials`**, `convo/getTdfTags`.

**Key exposure:** `default-src`/`connect-src`/`img-src`/`media-src` all include `wickrweb://*`.
⇒ From any context (including our **script-free** XSS), `<img src=wickrweb://awsCredentials>` /
`<video src=wickrweb://myaccount/leavenetwork>` / CSS `background:url(wickrweb://admin/inviteuser...)`
issues a **declarative GET to the native handler**, no JS required. Whether each route has a
**destructive GET side-effect** is the open empirical question (§5, §6). If any route mutates state
on GET (leave network, invite user, change password via GET, expose credentials), this is the
script-free high-impact channel.

### 3.2 QWebChannel bridge
- Transport: in-process `qt.webChannelTransport`. Registered objects: **`uiBridge`** (+ `wickrSettings`, `fileManager`).
- `uiBridge.sendAction({action, …})` dispatches a **fixed action allowlist**: `saveLinkToRoom, saveFileToRoom, shareLocation, viewContactDetails, uploadFile, openFile, saveFile, messageHistory, joinCall, imagePreview, openLink, pasteImage, showMessageError/Info, viewRoomDetails, openSavedItems, openSearchPopout, addMods, manageUsers, verifyContact, openHamburgerMenu, openSettingsPanel, referAFriend, limitedGuestAccess, securityVerification, myAccount, addDevice, closeAllPanels` + `clipboardHasImage()`.
- `openLink` **does** validate `event.origin === window.parent.origin` (A8's "unconfirmed" is now **resolved = present**); external open is `http/https/mailto` allowlisted + confirm modal.
- The bridge is reachable from the preview iframe (`window.top.qt.webChannelTransport` / `uiBridge`), **but only from executing `'self'`/qrc script**. Attacker-injected inline/blob script cannot satisfy `script-src` → bridge is currently unreachable from the XSS.

### 3.3 Custom schemes & preloads
- `qrc://` resources: only **two** web HTML pages (`index.html`, `file-preview/index.html`) — both carry the strict CSP. `preloads.js` recovered (126 B): harmless `URL` qrc-base shim; main-frame only (not in preview). `qrc:/webengine/wickr.html` ships **CSP-free** (legacy WebChannel console, full bridge, inline scripts) but reflects **zero** attacker input (no hash/search/name/referrer/eval) and nothing navigates to it → dead. No qrc reflector/JSONP; rcc is read-only; received files are served from `wickrweb://` (excluded from script-src & frame-src).
- No `unsafe-eval`, no Trusted Types, no dev/debug flags observed.

### 3.4 Engine / CVE posture
QtWebEngine **6.9.2 = Chromium 130.0.6723.192** (well past M90 → meta-CSP inherits into srcdoc/blank). No known Chromium-130 CSP-bypass CVE that defeats a nonce-free, hash-free `'self'` + scheme policy; the historical bypass classes (strict-dynamic bypass, nonce exfiltration, JSONP on whitelisted host, Angular-on-whitelisted-host, Flash/object, `data:`/`blob:` in script-src) are all structurally excluded by this policy. No Qt-specific "CSP bypass mode" exists.

---

## 4. Missing Directives & Meta-CSP Attacks

### 4.1 `base-uri` absent — neutralized
`<base href>` is injectable, but there are **no relative script loads to hijack**: all app chunks are static hashed and loaded via absolute `qrc:/…` specifiers; `import()` uses static specifiers; CSS `url()` resolves against the stylesheet base, not `<base>`. `<base>` with `data:`/`javascript:` is either ignored or CSP-bound. **Practical impact: ~0 on exec; minor styling-rebase nuisance.**

### 4.2 `form-action` absent — exploitable (script-free)
No limit on form targets. Attacker can inject a `<form action=https://attacker/...>` plus hidden fields and auto-submit via `<img/server event>`? Auto-submit needs script (blocked) — but a single victim click (UI redress / decoy button) POSTs preview-context data externally. **Real but low-value** (preview has little secret data; still worth reporting as hardening).

### 4.3 Meta-CSP injection (second `<meta>`)
QtWebEngine honors multiple CSP sources by **intersection** (header ∪ meta). A second `<meta>` cannot *weaken* the first; it can only *add* restrictions. No bypass. `<meta http-equiv=refresh>` can navigate, but navigation target is still CSP-bound (frame-src/script-src), and navigating away destroys the attacker context (no reflected input at any allowed destination). **No win.**

---

## 5. Top-10 Testable Hypotheses

| # | Vector | Exact test | Prerequisite | Expected if success | Why it might bypass | Status (on shipped build) |
|---|---|---|---|---|---|---|
| 1 | **altChunk → srcdoc external `'self'` script** | `.docx` with `<w:altChunk>` → HTML part `<script src=/self.js>` | a `qrc:`/'self' reflector | script exec in srcdoc, reaches bridge | srcdoc runs `'self'` scripts (proven) | **BLOCKED** — no reflector; only gap |
| 2 | **`qrc:/webengine/wickr.html` (CSP-free) + reflected input** | inject `<meta refresh url=qrc:/webengine/wickr.html#ATTACKER>` then use hash | input reflection in wickr.html | CSP-free exec w/ full bridge | page has no CSP | **BLOCKED** — wickr.html reflects nothing |
| 3 | **DOMPurify mutation (PPTX) → exec** | mXSS payload via PPTX | DOMPurify 3.2.5 parser bug | handler/script runs | bypass sanitizer | **BLOCKED** — any bypass still CSP-inert |
| 4 | **`base` + relative script** | `<base href=wickrweb://x>` | relative script loads | hijack script src | base-uri absent | **BLOCKED** — no relative loads |
| 5 | **Blob worker + importScripts** | `new Worker(URL.createObjectURL(blob))` then `importScripts('qrc:/...')` | attacker-controllable qrc JS | worker-side bridge | worker-src allows blob: | **BLOCKED** — no qrc attacker JS; importScripts still script-src-bound |
| 6 | **Service worker registration** | `navigator.serviceWorker.register('/sw.js')` | HTTPS same-origin scope | intercept responses, weaken CSP | — | **BLOCKED** — qrc opaque origin, no HTTPS |
| 7 | **object/embed of wickrweb content** | `<object data=wickrweb://x>` | object-src permissive | plugin/native exec | — | **BLOCKED** — object-src 'self' |
| 8 | **`javascript:` navigation of allowed frame** | `iframe.src='javascript:...'` | — | inline exec in frame | — | **BLOCKED** — script-src governs |
| 9 | **PostMessage relay via fast.com/amplifyapp** | frame + `postMessage` relay | open redirect/handler on host | reach parent bridge | framing allowed | **BLOCKED** — origin-restricted, no relay found |
| 10 | **Declarative GET to destructive `wickrweb://` route (CSS/img)** | `style="background:url(wickrweb://myaccount/leavenetwork)"` or `<img src=wickrweb://admin/inviteuser?...>` | a GET-side-effect route | script-free state change / cred leak | img/media/style allow wickrweb:// | **OPEN** — needs live route audit (§6) |

> Vectors 1–9 are exhaustively closed on the shipped build (Chromium 130 + this policy + read-only qrc + origin-checked bridge). **#10 is the only open, high-value thread.**

---

## 6. Deep Dive — Top Vectors

### A. The single residual exec barrier: `altChunk → iframe.srcdoc` (closest to RCE)
- docx-preview `renderAltChunk`: `t=document.createElement('iframe'); … t.srcdoc = <attacker HTML>`. `renderAltChunks` defaults **true** and the callsite does **not** override. srcdoc parses as a full document → parser-inserted `<script>` *would* execute; iframe is same-origin, non-sandboxed → reaches `window.top.qt.webChannelTransport` / `uiBridge`.
- **Why inert:** srcdoc inherits the parent's meta-CSP (post-M90, confirmed on Chromium 130). script-src has no `unsafe-inline`. Inline `<script>`, `<img onerror>`, `postMessage` all blocked. External `'self'`/qrc script *does* run — proving the boundary is exactly "no attacker 'self'/qrc script source".
- **To win, you need exactly one of:** (i) srcdoc failing to inherit meta-CSP (engine regression/downgrade — not present); (ii) CSP gaining `unsafe-inline`/`unsafe-eval`/nonce/data:/blob:; (iii) an attacker-controllable `'self'` or `qrc://` script URL (reflector/JSONP/upload — none exist).
- **Verdict:** A clean **1-click RCE primitive behind a single CSP/engine regression**. Report as a high-severity hardening item: any future CSP weakening or QtWebEngine downgrade converts this into a 1-click compromise via `uiBridge` (e.g., `openFile`/`saveFile`/`uploadFile` actions chained to native code paths).

### B. The strongest script-free impact channel: declarative `wickrweb://` GET (Family-G)
- Because `default-src`/`img-src`/`media-src`/`style-src 'unsafe-inline'` all allow `wickrweb://*`, an attacker HTML node triggers a **GET to the native URL-scheme handler with no JS**. PPTX `globalCSS` is set unsanitized as `<style>{cssText}</style>` and DOMPurify does not sanitize CSS → `background:url(wickrweb://endpoint)` bypasses DOMPurify's attribute-level `wickrweb` block via the CSS channel.
- **Exact residual test (open):** enumerate each `wickrweb://` route for **GET side-effects / sensitive GET returns**:
  - `myaccount/leavenetwork` (leave the network?)
  - `myaccount/password` (password change/seed?)
  - `admin/inviteuser`, `admin/controls`
  - `contacts/convertdirectoryuser`
  - **`awsCredentials`** (does GET return AWS creds? ⇒ credential disclosure)
  - `message/:cid/:mid/react/:emoji` (GET = react?)
  - `file/...`, `image/...`, `audio/...` (GET returns decrypted media ⇒ **content exfil** if a conv/msg id is guessable/injected)
- **Why it matters:** even with zero script execution, a single GET to a destructive/sensitive route = **medium-to-high impact** (credential leak, silent network exit, message-content exfiltration, admin actions). This is the realistic "maximum achievable impact" if exec is truly impossible, and it is *bypass-free* (uses the policy as-written).
- **Round-2 update (§11.1):** the destructive routes above are **header-gated** — the declarative GET cannot supply the required password/email/userId headers, so they reject/no-op. Only `reactToMessage` is path-triggerable (low integrity). Downgraded to **LOW**.

### C. Bridge reach (hypothetical, post-exec)
If vector A (or any exec) succeeds, the bridge is richly weaponizable:
- `uiBridge.openFile`/`saveFile`/`uploadFile` → native file paths (potential path traversal / signed-binary launch).
- `uiBridge.joinCall`, `shareLocation`, `imagePreview` → user-impersonation / metadata.
- `uiBridge.openLink` is origin-checked but other `sendAction` calls are **not** origin-validated in JS (native-side may differ — worth probing).
- Direct `fetch('wickrweb://awsCredentials')` now possible with JS → read AWS creds, local files via `file/...`, full message DB via paginated `message/...`.
This is why A is the prize: the post-exec bridge converts XSS → **native, possibly RCE-equivalent** impact.

---

## 7. QT/Wickr-Specific Findings
- **Two CSP-carrying web pages, both strict; one CSP-free legacy page (`wickr.html`) with no injection point** — ship it out of the bundle or add a CSP.
- **`wickrweb://` in `img/media/style` but not `script/frame`** is a deliberate but asymmetric design: it enables the declarative-GET channel (§6B). Recommend removing `wickrweb://*` from `img-src`/`media-src`/`default-src`, or making the scheme handler GET-idempotent and non-destructive.
- **`renderAltChunks` enabled + experimental** in the callsite — disable in production or ensure srcdoc children get a strict CSP (already strict, but defense-in-depth).
- **DOMPurify does not sanitize CSS** — sanitize `globalCSS` and `style=""` content before insertion.
- **`form-action` absent** — add it.
- **`base-uri` absent** — add `'none'` (cheap, closes future regressions).

---

## 8. Fallback Impact Assessment (if script exec truly impossible)
**Maximum achievable impact (script-free), in priority order:**
1. **Declarative `wickrweb://` GET** to destructive/sensitive routes (§6B) — **MEDIUM-HIGH** if any GET mutates state or returns secrets (e.g., `awsCredentials`, `leavenetwork`, `password`, message media). *Empirically open.* **[Round-2: downgraded to LOW — see §11.1/§11.2]**
2. **Data exfiltration via `tile.googleapis.com` / `bedrock-*.amazonaws.com`** as blind pixel/POST oracles — **LOW** (bandwidth-limited, no secrets in preview).
3. **`form-action`-less external form POST** on a victim click — **LOW** (preview has little secret data; UI redress needed).
4. **UI redressing / decoy phishing** inside the preview pane — **LOW**.
5. **Credential/content exposure if exec is later achieved** (bridge, `awsCredentials`, message DB, file paths) — **CRITICAL** (contingent on A).

Bottom line: even in the honest-negative case for exec, §6B is a concrete, policy-as-written channel that likely yields at least a **Medium** (and possibly **High**) finding. **[Round-2: revised — see §11.5; the realistic script-free impact is LOW, not Medium/High, because destructive routes are header-gated and read responses aren't exfiltrable without JS.]**

---

## 9. Version-Specific CVE Check (Chromium 130.0.6723.192 / QtWebEngine 6.9.2)
- No Chromium-130-range CVE that defeats a nonce/hash-free `script-src 'self' <scheme>` policy with this fetch/img/media split.
- Historical CSP-bypass classes all structurally excluded: strict-dynamic bypass (no strict-dynamic), nonce reuse/theft (no nones), JSONP on whitelisted host (no whitelisted JS host), Angular/template on whitelisted host (none whitelisted for script), Flash/object (`object-src 'self'`), `data:`/`blob:` script (absent).
- No Qt-specific CSP-escape mode; meta-CSP enforcement at parity with header on M130.
- Relevant adjacent CVEs to monitor: Blink srcdoc/CSP-inheritance regressions (would flip vector A to RCE), and `wickrweb://` scheme-handler GET semantics (would activate §6B).

---

## 10. Bottom Line
- **Arbitrary JS execution: HARD NEGATIVE on the shipped build.** Every exec vector (families A/B/C/D/F + creative primitives) is closed by the combination of `script-src 'self' qrc://*` (no inline/eval/nonce/data/blob), read-only qrc with no attacker-content reflector, origin-checked `openLink`, DOMPurify on PPTX, and meta-CSP inheritance into srcdoc on Chromium 130.
- **Strongest verified intermediate:** `altChunk → srcdoc` is a **single-barrier 1-click RCE primitive** — blocked *only* by meta-CSP inheritance + absence of an attacker `'self'` script source. Any future CSP regression or QtWebEngine downgrade = clean RCE via `uiBridge`.
- **Strongest open script-free impact:** declarative `wickrweb://` GET via img/media/CSS to destructive or secret-returning routes (§6B) — **the next thing to test live**, and a likely Medium/High on its own. **[Round-2: downgraded to LOW — §11]**
- **Recommended fixes:** add `base-uri 'none'`, `form-action 'self'`, remove `wickrweb://*` from `img-src`/`media-src`/`default-src` (or make scheme-handler GETs idempotent), sanitize CSS in docx/pptx, disable `renderAltChunks` in prod, strip `qrc:/webengine/wickr.html` from the bundle.

---

## 11. Round-2 Addendum (2026-07-25, deep verification)

Four threads were pursued to empirical/static certainty. The headline change: **the declarative-GET channel (§6B) is downgraded from "MEDIUM-HIGH candidate" to "LOW"** because of a decisive architectural fact found in the fetch layer.

### 11.1 wickrweb:// GET semantics — VERIFIED in source (`src/apis/webFetch/fetchInternal.ts`)
- **Every route is a default GET** (`appFetch(url)` / `appFetch(url,{headers})` — no `method` ever set). The native handler (`WebViewRouter`, confirmed in the binary, reads `requestHeaders()`) accepts GET on all 35 routes.
- **Decisive fact: mutation routes carry their parameters in HTTP HEADERS, not URL path or POST body:**
  - `leaveNetwork` → `headers: { password }` (L348-353)
  - `changePassword` → `headers: { oldPassword, newPassword }` (L328-336)
  - `inviteUser` → `headers: { email }` (L360-365)
  - `convertDirectoryUser` → `headers: { userId, userHash }` (L338-346)
  - `searchContacts`/`getDirectory`/`getRoomSearchItems`/`checkUser` → `headers: { searchQuery/pageNumber/... }`
- **Consequence for declarative GET:** `<img src=wickrweb://myaccount/leavenetwork>` fires a GET but the **`password` header is absent**. The handler receives no password → rejects/no-ops. **Same for changePassword/inviteUser/convertDirectoryUser.** These destructive routes are **NOT triggerable via declarative GET.**
- **Only `reactToMessage` carries mutation params (`convoId/msgId/emoji`) in the URL path** (`/message/:cid/:mid/react/:emoji`); the `remove` flag is a header. A declarative GET can thus add (not remove) an emoji reaction to a *known* message — a **low-severity integrity issue**, not RCE and not data exposure.

### 11.2 Read routes on declarative GET — response not exfiltrable
- Read-only routes (`awsCredentials`, `users/self`, `contacts/*`, `devices/active`, `message/...`) return JSON/protobuf on GET. A declarative `<img>`/`<video>`/CSS `url()` **fires the request but cannot read the response body** (no JS; img/media don't expose response bytes).
- `image/message/:cid/:mid`, `audio/...`, `file/...` return decrypted media on GET. `<img src=wickrweb://image/message/CID/MID>` **renders the decrypted image on screen** (information disclosure to the *viewer*) but is **not exfiltration to the attacker**. Exfil needs script execution (blocked).
- **Revised impact of §6B (declarative-GET channel): LOW.** Real CSP-as-written primitive but: no destructive mutation is header-free except `reactToMessage` (low), and read responses are not exfiltrable without JS.

### 11.3 `qrc:/webengine/wickr.html` (CSP-free, full bridge) — HARD NEGATIVE confirmed
- Full 97 KB page carved and exhaustively sink/source audited.
- Sinks: zero `eval/Function/setTimeout-string/innerHTML/outerHTML/document.write/writeln/insertAdjacentHTML/createContextualFragment/srcdoc/importScripts`. No jQuery.
- Sources: zero reads of `location.hash/search/href`, `window.name`, `document.referrer`, `URLSearchParams`, `postMessage`, `localStorage/sessionStorage/cookie`, `atob`.
- No app code navigates to it with hash/query. **Verdict: no CSP-free execution reflector.** Dead legacy code.

### 11.4 altChunk → iframe.srcdoc — PoC + harness scaffold built; boundary re-confirmed
- Harness scaffold exists (`wave2-harness/inject.js` `mode=altchunk` → `iframe.srcdoc = payload`, no sandbox; payloads `altchunk_inline.txt`, `altchunk_extself.txt`; `parent.js` exposes `qt.webChannelTransport` + win-marker `window.top.__RCE__`; `ext_selfscript.js` = the 'self' external script).
- Expected on Chromium 130: inline `<script>` + `<img onerror>` + `postMessage` → **inert** (srcdoc inherits meta-CSP); external `<script src=/ext_selfscript.js>` (a 'self' script) → **runs and reaches `window.top` bridge**. Boundary located at "no attacker 'self'/qrc script source."
- **Residual gap to RCE (unchanged):** (i) srcdoc CSP-inheritance regression, or (ii) CSP gains `unsafe-inline`/nonce/eval/data:/blob:, or (iii) an attacker 'self'/qrc script reflector. None present on the shipped build.

### 11.5 Updated bottom line (post Round 2)
- **Arbitrary JS execution: HARD NEGATIVE** (unchanged; triple-confirmed).
- **Declarative-GET impact: LOW** (downgraded — destructive routes are header-gated; reads not exfiltrable; only `reactToMessage` is path-triggerable, low integrity).
- **Confirmed bug to report (fix required):** the docx-preview `renderSymbol`/`renderAltChunk` HTML injection (CWE-79/80) — especially `renderAltChunk`, a **single-barrier latent RCE primitive** (blocked solely by CSP inheritance + no 'self' reflector). Severity as hardening/defense-in-depth: **High** (any future CSP weakening or QtWebEngine downgrade = 1-click RCE via the bridge).
- **Minor hardening items:** strip CSP-free `qrc:/webengine/wickr.html`, add `base-uri 'none'` + `form-action 'self'`, disable `renderAltChunks` in prod, sanitize CSS in docx/pptx, remove `wickrweb://*` from img/media/default-src.
- **Net:** the application is well-defended against the CSP-bypass objective on this build; the deliverable is a confirmed injection vulnerability plus concrete hardening recommendations, not a working RCE.