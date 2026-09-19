# Wickr 6.72.20 — Renderer→Bridge CSP-bypass hunt (Profile E, wave 2) — CONSOLIDATED RESULT

**Date:** 2026-07-24 · **Engine:** QtWebEngine 6.9.2 = **Chromium 130.0.6723.192**
**Verdict:** **NEGATIVE — no clean WIN.** No attacker-authored previewed file achieves JS execution
under the shipped CSP that invokes the native bridge. Across a forced-diversity battery (families
A–G), **the CSP `script-src 'self' qrc://*` (no unsafe-inline/eval/nonce) held as a genuine single
boundary.** The wave produced a materially **stronger single-barrier primitive than A8** (docx
altChunk→srcdoc) and two new declarative/hardening findings, each run-proven or instruction-proven,
with exact residual gaps. This corroborates (does not refute) the A8 conclusion.

The exploit chain is otherwise fully present: 1-click preview of an attacker `.docx`/`.pptx` →
HTML injection into a **same-origin, un-sandboxed** preview iframe that reaches the parent's
`qt.webChannelTransport` + 58-method `WebChannelMessageBridge` (parent already forwards `openLink`).
The **only** missing link — running attacker script under the CSP — did not fall.

---

## Corrected ground truth (A8 had an abbreviated CSP)
Full shipped CSP (identical on `qrc:/index.html` and `qrc:/file-preview/index.html`, via `<meta>`):
```
default-src 'self' qrc://* wickrweb://* ; style-src 'self' 'unsafe-inline' ;
script-src 'self' qrc://* ; connect-src 'self' wickrweb://* https://bedrock-*.amazonaws.com(all) ;
img-src 'self' https://tile.googleapis.com wickrweb://* blob: data: ; font-src 'self' data: ;
media-src 'self' wickrweb://* data: blob: ;
frame-src 'self' blob: https://fast.com/ https://main.d4zeeqgazhley.amplifyapp.com/ ;
worker-src 'self' blob: ; child-src 'self' blob: ; object-src 'self'
```
Decisive sub-directives A8 missed: **explicit `frame-src` excludes wickrweb** (can't frame attacker
bytes); **`connect-src`/`img-src`/`media-src` allow `wickrweb://*`** (fetch from script; declarative
GET from `<img>`/CSS); **no Trusted-Types**; `object-src 'self'`; no `base-uri`.

---

## Findings, ranked

### 1. [INTERMEDIATE — new, stronger than A8] docx `altChunk` → `iframe.srcdoc` full-HTML injection
- docx-preview `renderAltChunk`: `t=createElement("iframe"); loadAltChunk(id,part).then(r=>{t.srcdoc=r})`
  — no `sandbox`. `defaultOptions.renderAltChunks = true` (verified); app `renderAsync(…,{...defaultOptions,
  debug:true,experimental:true})` does not override ⇒ **ENABLED**.
- A `.docx` with `<w:altChunk r:id>` + a relationship to an HTML part injects **full attacker HTML into
  `iframe.srcdoc`** on 1-click preview. Unlike the renderSymbol `innerHTML` sink (scripts inert per
  spec), **srcdoc parses as a document → parser-inserted `<script>` executes.** The frame is
  same-origin (qrc, via `about:srcdoc`), non-sandboxed → reaches `window.top` bridge. **This removes
  one of A8's two barriers**, leaving CSP as the *sole* barrier in a script-executing context.
- **Run-proven CSP-bound (3 independent harnesses):** srcdoc inherits the parent's `<meta>` CSP →
  inline `<script>` / `<img onerror>` / `postMessage`-from-srcdoc all inert. (A first-party control
  proved an *external `'self'` script* inside srcdoc DOES run and reach the bridge — so the barrier is
  precisely "no attacker-controllable 'self'/qrc script source," not "srcdoc can't script.")
- **Exact residual gap → clean 1-click RCE if any of:** (a) srcdoc stops inheriting the `<meta>` CSP
  (pre-M90 Chromium / a QtWebEngine regression — NOT the case on 130); (b) CSP gains `unsafe-inline`
  or an attacker-controllable `'self'`/`qrc` script source. **Report as: sanitize/disable altChunk
  (`renderAltChunks:false`) AND sandbox the preview iframe** — this primitive is a higher-severity
  single-barrier than the renderSymbol one A8 filed.

### 2. [INTERMEDIATE — new, declarative/no-JS] `<img src="wickrweb://admin/controls">` opens admin console
- The native `wickrweb` scheme handler does **no initiator/origin check** (`requestInitiator` not
  imported). `runAdminHost` `"controls"` (VA 0x14002344a) reads **no header/body** — only checks
  `isAdmin && !isAWSNetwork`, then opens the admin console UI (0x140023508).
- Injected preview DOM can carry `<img src="wickrweb://admin/controls">` (img-src allows wickrweb) —
  or, in the DOMPurify PPTX path, `style="background:url(wickrweb://admin/controls)"` (DOMPurify does
  **not** sanitize CSS `url()`) — firing the native handler on 1-click preview, **no script**.
- **Why not a win:** opens a console the admin can already open (no mutation); **no-op on AWS-hosted
  Wickr** (the AWS Wickr default network type); requires victim = non-AWS-network admin. Severity ≈
  unsolicited-UI. **Report as hardening:** the wickrweb handler should validate request initiator, and
  the preview iframe should not be able to address `wickrweb://` privileged hosts.
- All **state-changing** wickrweb routes (password, leavenetwork, inviteuser, convertdirectoryuser) are
  **header-gated** — a bare `<img>`/CSS GET can't supply the credential headers → they bail
  ("empty header provided" + fail()). Data-read routes (incl. `awscredentials`) return sensitive bytes
  to the response stream but the response is **opaque** to `<img>`/`<video>` → exfil needs a script
  `fetch()` (the script-exec win, which does not exist). Hard negative for CSRF-style mutation.

### 3. [HARDENING] CSP-free dev page shipped in production: `qrc:/webengine/wickr.html`
- 97 KB WebChannel dev console with **no CSP meta**, inline scripts, grabs the **full bridge**
  (`new QWebChannel(qt.webChannelTransport,…)`). Reachable in principle via injected
  `<meta http-equiv=refresh url=qrc:/webengine/wickr.html>` (frame-src 'self' allows qrc). **Not a win**
  — it reflects **zero** attacker input (no hash/search/name/postMessage/eval), so there is no
  attacker-content injection point; navigation also destroys the attacker's foothold; nothing in the
  app routes to it. **Report as hardening:** strip dev pages from the shipped rcc (a CSP-free,
  bridge-grabbing, same-origin page is a latent liability if any reflection is ever added).

### 4. [HARDENING — confirms A8] core single-barrier condition + ambient weaknesses
- Preview iframe: `src` only, **no `sandbox`** (confirmed in FilePreviewModal source) → same-origin,
  bridge-reachable. Parent message receiver: exactly one type `openLink`, **origin-validated**
  (`E.origin===window.parent.origin`), **forced `showConfirmation:true`** → 1 of 58 bridge methods,
  data-only, native http/https/mailto allowlist. `preloads.js` = benign 126-byte qrc URL shim,
  main-frame-only. Ambient (A8): WebEngineView auto-accepts ALL cert errors; auto-grants ALL feature
  permissions (cam/mic/geo).

---

## What was refuted (families A–G, so the negative is trustworthy)
- **A (source abuse):** attacker bytes never occupy a qrc/'self' URL (rcc read-only; received files
  served from wickrweb = excluded from script-src AND frame-src); no qrc reflector/JSONP; dynamic
  `import()` resolves only static hashed app chunks; the one `createElement('script')`+blob loader is
  CSP-blocked (blob: ∉ script-src) & unreachable; `preloads.js` benign & main-frame-only; the CSP-free
  `wickr.html` reflects no input.
- **B (script gadgets):** no `document.write`/`insertAdjacentHTML`/`createContextualFragment` in the
  corpus; no attacker-fed `script.src/.text`; eval/Function CSP-blocked; script-resurrection dead
  (already-started flag); React `createRoot` (not hydrateRoot) → no attribute-hydration handler bind;
  no jQuery.
- **C (DOMPurify 3.2.5):** `USE_PROFILES{html,svg}` default strips foreignObject/use/iframe/object/
  MathML/script; 3.2.5 removed the post-serialize reparse loop; per-slide sanitize+concat = no
  differential; any bypass yields inert DOM under CSP; PPTX subtree only re-processed by an inert
  img.onerror hider; DOMPurify strips `<iframe>` so PPTX can't reach the altChunk/srcdoc gadget.
- **D (DOM clobbering):** survives both paths but no child-reachable code reads a clobberable global
  into an exec sink; DOMPurify reads built-ins; parent never reads child DOM.
- **F (parser/mutation):** renderSymbol raw `innerHTML` still inert (2 independent barriers); no
  reparse differential converts it to parser-inserted script.
- **G (declarative bridge):** wickrweb state-changing routes header-gated; parent message surface =
  single origin-validated confirmation-gated `openLink`.

## Run-to-prove harness
`scratchpad/serve/` — exact full CSP via `<meta>` on both frames, same-origin un-sandboxed preview
iframe, real DOMPurify 3.2.5, bridge shim + origin-checked forwarder, self-driving battery. Validated:
positive control fires; all attacker vectors (renderSymbol inline, pptx-DOMPurify, altChunk srcdoc
inline/onerror/postMessage) inert; external-'self'-script-in-srcdoc runs (boundary characterization).

---
## Addendum — upload/compose (send-side) surface audited (answer to "upload-file origin?")
Distinct from the received-file→preview direction; audited separately. **Same boundary — no new script source.**
- **Single render origin:** on desktop, ALL preview renderers get their URL from `wickrweb://` only —
  `wickrWebEndpoints.fileData(vgroupId,msgId)` (received) or `.fileDataFromFileManager(fileId)`
  (uploaded/saved/File-Management). Grep for any renderer receiving a `blob:`/`data:`/`file:`/local
  document URL = EMPTY. wickrweb is excluded from `script-src` AND `frame-src` ⇒ same wall.
- **Compose/drop path does not render HTML locally:** dropped/selected files → `UploadFileModal({file})`
  confirm → **protobuf `MessageBody.File` encode** → upload. No local HTML/doc render of the outgoing
  file. Thumbnails = canvas `drawImage` (raster, inert). `readAsDataURL`/`blobToBase64` → base64 STRING
  for protobuf/thumbnail (data: ∉ script-src/frame-src anyway).
- **`frame-src blob:` is permitted but UNEXERCISED** — no `iframe.src=blob:` / `data:text/html`
  document framing exists in any web chunk. (Even if a future feature framed a qrc-created blob, it
  inherits the qrc CSP like srcdoc ⇒ still bounded.)
- **Genuinely-different residual surfaces (out of THIS renderer→bridge chain):** (1) `file://`
  victim-opens-local-file (cross-origin to qrc, cannot reach the bridge; = the N4 openFile/MOTW/
  SmartScreen surface, separate negative); (2) **native upload/S3 SSRF** `uploadToS3WithUrl: Target
  host:` (WAVE2-LEADS) — a native-network bug class, NOT the CSP chain; unexplored, separate hunt.
