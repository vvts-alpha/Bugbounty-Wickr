# Same-Origin JavaScript Execution in Wickr Android DOCX Preview via Malicious DOCX (ZIP+JS Polyglot); Preview Also Frames an RCE-able CSP-Allowlisted Origin (CVE-2025-55182)

**Asset:** Wickr Pro/Wickr Me (all related technical components)
**Product:** AWS Wickr for Android — `com.wickr.pro` version **6.72.5** (versionCode **60720511**, minSdk 33 / targetSdk 35)
**Related component:** `https://main.d4zeeqgazhley.amplifyapp.com/` (AWS Amplify-hosted diagnostics page, explicitly allowlisted by the Wickr client)
**Researcher platform:** Physical Android device (dynamic confirmation) + static analysis of the release APK

---

## 1. Summary

**Primary finding (confirmed on a physical device):** the built-in DOCX file
preview in AWS Wickr for Android executes **attacker-controlled JavaScript in the
preview page's own origin** when a victim previews a malicious DOCX attachment.
No inline-script bypass of the CSP is involved — every stage uses only documented
platform behavior:

```
Malicious DOCX (a ZIP+JS polyglot file)
  -> docx-preview sink: w:sym/@w:char -> innerHTML (unsanitized)
  -> injected <iframe srcdoc="<script src='/preview-file/x.js'>">
     (srcdoc documents are parser-created, so the script tag runs;
      srcdoc inherits both the parent origin and script-src 'self')
  -> /preview-file/ serves the SAME DOCX bytes back, same-origin,
     with no X-Content-Type-Options: nosniff
  -> Chromium parses the file as a classic script: the JS prefix executes,
     the ZIP body sits inside a block comment closed by the ZIP comment
     field ("*/")
  -> the script writes into the PARENT preview document (confirmed:
     red banner appended to parent DOM, document title changed)
```

Device result (physical Android, Wickr 6.72.5, built-in preview): a red banner
reading `WICKR SAME-ORIGIN JS EXEC CONFIRMED ... | ZIP+JS polyglot via
/preview-file/` rendered at the top of the preview screen. The banner element is
appended to the **parent** document from inside the injected iframe — possible
only because the srcdoc document inherits the parent's origin
(`location.origin` prints `null` for about:srcdoc URLs, but the effective
document origin is inherited, which the successful cross-frame DOM write proves).

This gives the attacker, from a single DOCX preview: arbitrary JS execution in
the preview origin, full read/write of the preview DOM, DOM-storage access for
that origin, same-origin `fetch`, and top navigation — i.e., a perfect
in-app phishing/defacement capability and a foothold for chaining, triggered by
the routine act of previewing a received document. No external infrastructure is
required.

**Secondary finding (confirmed):** the preview CSP `frame-src` explicitly
allowlists `https://main.d4zeeqgazhley.amplifyapp.com/` (an undocumented
Wickr/AWS diagnostics page) inside an APK-bundled asset, and injected markup can
frame it in-app (confirmed on device). That origin runs **Next.js 15.0.2**, which
is vulnerable to **CVE-2025-55182 ("React2Shell")** unauthenticated RCE. The AWS
edge WAF blocks the public payload, but I bypassed it by placing exploit fields
beyond the WAF body-inspection size limit and confirmed server-side code
execution with a read-only `process.version` marker (Node v18.20.8). An attacker
exercising this RCE controls active content that Wickr deliberately permits to
render framed inside the app.

Even the HTML injection alone (no JS) enables trusted-UI spoofing, and the
preview CSP lacks `form-action`, `base-uri`, and `navigate-to`, while the
native preview client installs no navigation guard — injected `<meta
http-equiv="refresh">` or anchor markup can take over the top-level WebView
(test DOCX attached).

## 2. Why the Amplify origin is in scope

The DOCX preview page is bundled inside the Wickr APK and served in the WebView
via `WebViewAssetLoader` from the virtual origin `https://wickr.android.appassets.net`:

```
APK asset: web-assets/dist-file-preview/file-preview.html
```

Its embedded CSP (`<meta http-equiv="Content-Security-Policy" ...>`) contains:

```
default-src 'self' qrc://* wickrweb://* ;
style-src 'self' 'unsafe-inline' ;
script-src 'self' qrc://* ;
connect-src 'self' wickrweb://* ;
img-src 'self' https://tile.googleapis.com wickrweb://* blob: data: ;
font-src 'self' data: ;
media-src 'self' wickrweb://* data: blob: ;
frame-src 'self' blob: https://*.chime.aws:* https://fast.com/ https://main.d4zeeqgazhley.amplifyapp.com/ ;
worker-src 'self' blob: ;
child-src 'self' blob: ;
object-src 'self'
```

`https://main.d4zeeqgazhley.amplifyapp.com/` is listed **exactly (no wildcard)** in
`frame-src`, alongside `https://fast.com/` and `https://*.chime.aws:*`. This is a
deliberate, Wickr-shipped trust decision inside the application itself — the
origin is a Wickr-related technical component (a network speed-test/diagnostics
page, consistent with its neighbors in the directive), not an unrelated
third-party host. It is not publicly indexed or documented; the only public
reference to it is this allowlist inside the Wickr client.

## 3. Component 1 — Unsanitized HTML injection in the DOCX renderer

### Sink

The bundled DOCX renderer (docx-preview) inside the APK:

```
APK asset: web-assets/dist-file-preview/assets/index-ee8ec7f12.js
```

contains (pretty-printed):

```js
renderSymbol(e) {
  var t = this.createElement("span");
  t.style.fontFamily = e.font;
  t.innerHTML = `&#x${e.char};`;   // e.char = w:sym/@w:char attribute, UNSANITIZED
  return t;
}
```

`e.char` is the raw value of the `w:char` attribute of a `<w:sym>` run in
`word/document.xml`. XML entity-decoding turns `&lt;` etc. back into markup, and
the string is concatenated into an `innerHTML` assignment. Any HTML following the
leading `&#x…;` character reference is parsed into the preview document's DOM.

### Conditions to reach the preview

The built-in preview is used when the network policy key `enableFileDownload` is
**false** (`FilePreviewRepository.isFilePreviewEnabled() =
!WickrConfig.isFileDownloadsEnabled()`); otherwise attachments open externally.
Wickr Pro / enterprise networks that disable file downloads — a common hardened
configuration — always take the built-in preview path. The DOCX MIME maps to
`FileWebPreviewFragment`, which enables JavaScript and DOM storage and loads the
page above.

### Device-confirmed results

On a physical Android device with the built-in preview active:

* A benign marker `<img>` injected via `w:char` was rendered in the preview DOM
  (HTML injection confirmed).
* An injected `<iframe src="https://main.d4zeeqgazhley.amplifyapp.com/">` was
  created and **successfully loaded and displayed the live external web
  application inside the Wickr preview WebView** — permitted by the `frame-src`
  allowlist above.

PoC files (benign): `poc-docx-htmli.docx`, `poc-docx-htmli-amplify.docx`
(builder: `build_poc_docx.py`).

### CSP notes relevant to impact

* `script-src 'self' qrc://*`: inline scripts and event handlers are blocked —
  but `/preview-file/` is same-origin and serves the attacker's own DOCX bytes
  back with no `X-Content-Type-Options: nosniff`. A ZIP+JS polyglot DOCX
  (attached) turns this into full same-origin JavaScript execution: the
  injected `<iframe srcdoc>` loads the DOCX itself as a classic script, and the
  script runs in the preview origin with access to the **parent preview DOM**
  (demonstrated payload appends a visible marker to the parent document and
  sets its title). This collapses the "single barrier" noted above: no external
  origin, no second vulnerability, and no CSP bypass are required — every stage
  uses only documented platform behavior.
* **Missing directives:** `form-action`, `base-uri`, `navigate-to`, and
  `frame-ancestors` are not set. Injected `<form>`, `<base>`, `<a>`, and
  `<meta http-equiv="refresh">` markup is therefore unrestricted by policy.
  Additional device tests for top-navigation/form-submission abuse are attached
  (`poc-docx-nav-tests.docx`, `poc-docx-meta-refresh.docx`, all targets are the
  benign IANA-reserved `example.com`).
* `frame-src` allows `blob:` and the three external origins discussed above.
* **No navigation guard on the native side:** `FilePreviewWebViewClient` does
  not override `shouldOverrideUrlLoading`. With the default WebView behavior,
  any anchor click or `<meta http-equiv="refresh">` navigates the **top-level
  WebView** inside the Wickr app. A page reached this way is on the attacker's
  own origin and is **no longer bound by the preview CSP at all** — full,
  unrestricted JavaScript execution inside Wickr's application chrome (ideal
  for a pixel-perfect fake login/"session expired" screen). This requires no
  CSP bypass: the injection alone delivers the navigation markup.
* **Inconsistent sanitization:** the bundle ships DOMPurify
  (`purify.es-*.js`) and at least one other renderer sanitizes via
  `DOMPurify.sanitize(...)` before assigning `innerHTML`
  (`index-ee8ec7f13.js`). The DOCX renderer's `renderSymbol` path does not —
  sanitization was applied selectively and this sink was missed.

## 4. Component 2 — Unauthenticated RCE on the allowlisted origin

### Fingerprint

* `x-powered-by: Next.js`; client bundles contain version string **15.0.2**
  (`/_next/static/chunks/215-*.js`); App Router in use.
* Site build timestamp: **2024-11-14** (predates all CVE-2025-55182 patches;
  Next.js 15.0.x was fixed in 15.0.5).
* Stack: CloudFront → AWS ELB (`Server: awselb/2.0`) → Amplify Hosting compute
  (Node.js).

### Verification (minimal impact)

CVE-2025-55182 is a pre-authentication RCE in React Server Components' Flight
deserialization. The public payload is detected at the AWS edge: posting it
returns `HTTP 403` from `awselb/2.0` (WAF signature on the exploit structure).

However, the inspection is size-limited. Placing the exploit fields **after ~17 KB
of benign form padding** bypasses the WAF body inspection, and the payload reaches
the Next.js server-action handler. I executed **only** a read-only property read
(no shell, no child_process, no file or network access, no persistence):

```js
var res='R2S_CONFIRMED_'+process.version;
throw Object.assign(new Error('NEXT_REDIRECT'),
  {digest:'NEXT_REDIRECT;push;/r2s?m='+res+';307;'});
```

Observed response (full capture: `evidence-r2s-response.txt`):

```
HTTP 303
Content-Type: text/x-component
x-powered-by: Next.js
x-action-redirect: /r2s?m=R2S_CONFIRMED_v18.20.8;push
```

The marker `R2S_CONFIRMED_v18.20.8` (the server's Node.js version, v18.20.8) was
embedded into the response by the server itself, proving **arbitrary server-side
JavaScript execution** on `main.d4zeeqgazhley.amplifyapp.com`. The
`Content-Type: text/x-component` response confirms the request reached the RSC
action pipeline.

Reproduction: `evidence_r2s.py` (single request; the multipart body places the
three Flight fields after 17 KB of padding; requires only the `Next-Action: x`
header).

### Consequence for the Wickr trust relationship

The iframe injected via Component 1 loads exactly this origin inside Wickr's
WebView, by Wickr's own allowlist. Unauthenticated RCE on the origin means an
attacker can control the content it serves (e.g., by altering SSR responses or
deployed assets), and that content — including active JavaScript — is rendered
inside the Wickr application UI when a victim previews a malicious DOCX. I did
**not** modify the deployment or establish persistence (out of bounds for this
test), so "attacker JS rendered in the Wickr iframe" is stated as the direct
consequence of the demonstrated RCE rather than separately demonstrated.

## 5. What is confirmed vs. not demonstrated

| Claim | Status |
|---|---|
| Arbitrary HTML injection from DOCX into the preview DOM | **Confirmed on physical device** |
| **Same-origin JavaScript execution via the ZIP+JS polyglot** (script loaded from `/preview-file/`, writes into parent document) | **Confirmed on physical device** — red banner rendered in the parent preview DOM; `document.title` changed to `WICKR-XSS-CONFIRMED` |
| Injected `<iframe>` renders the allowlisted external origin in Wickr's WebView | **Confirmed on physical device** |
| Allowlist lives in Wickr's own shipped asset (APK) | Confirmed (static, quoted above) |
| Unauthenticated RCE (read-only marker) on the allowlisted origin, incl. WAF bypass | **Confirmed against live origin** |
| Inline/event-handler JS from the injection itself | Blocked by `script-src 'self'` (no bypass claimed) |
| Top-navigation/form abuse via missing `form-action`/`base-uri`/`navigate-to` (no native navigation guard exists; default WebView behavior applies) | Test DOCX attached; device run pending |
| Persistent modification of the origin's content | **Not performed** (deliberately out of PoC bounds) |
| Access from the injected iframe to the parent Wickr page (DOM, storage, credentials) | Not possible: cross-origin iframe, **no JS bridge exists** (all 7 DEXes contain no `addJavascriptInterface`/`@JavascriptInterface`; no Wickr class registers a `WebMessageListener`), and the preview page registers **no window `message` event listener** (all `message` listeners in the bundle are Worker-internal RPC or random-token-guarded `setImmediate` polyfills), so `postMessage` from the iframe has no receiver |
| Same-origin script execution via `/preview-file/` served under `script-src 'self'` | **Confirmed on physical device** (see above). PoC: `poc-docx-polyglot-xss.docx` (+ v2 printing `document.domain`/parent URL/storage count), generator `build_polyglot_poc.py`. Construction: a ~460-byte classic-script prefix prepended to a hand-built ZIP with all `*/` byte pairs eliminated; the ZIP comment field is the closing `*/`. The bundled JSZip auto-detects the prepended prefix via its `reader.zero` logic (`v = EOCDpos - (cdOffset+cdSize) > 0`). The injection uses `<iframe srcdoc>` because srcdoc documents are parser-created (the script tag is not innerHTML-suppressed) and inherit the parent origin and CSP. Chromium executed the script despite the DOCX MIME because the `/preview-file/` response lacks `X-Content-Type-Options: nosniff` |

## 6. Impact

* **JavaScript execution from a received document (confirmed):** previewing an
  attacker-sent DOCX runs attacker JS in the preview origin — full control of
  the preview DOM, DOM storage for `https://wickr.android.appassets.net`,
  same-origin `fetch`, and top navigation. This is a drive-by script-execution
  primitive inside a security-focused E2EE messenger, requiring only the
  ordinary user action of opening a document preview.
* **High-fidelity phishing:** with JS and DOM control, the attacker can replace
  the preview with a pixel-perfect Wickr login/"session expired" screen, or
  navigate the top-level WebView to an attacker page — inside the app's own
  chrome, which Wickr users are trained to trust.
* **Enterprise exposure:** the vulnerable code path is specifically the one used
  by hardened Wickr Pro/enterprise networks that disable external file downloads
  (`enableFileDownload=false`).
* **Trusted-frame compromise (secondary):** the CSP-allowlisted diagnostics
  origin is unauthenticated-RCE-able; whoever exercises it controls active
  content the Wickr client deliberately permits to render framed in-app.
* **WAF bypass:** the AWS edge protection against CVE-2025-55182 is defeated by
  body-inspection size limits, so a "mitigated by WAF" assumption does not hold.

Honest ceiling, verified by enumeration: the preview origin holds no message
data and exposes **no native bridge** (no `addJavascriptInterface` /
`WebMessageListener` in Wickr classes), and the preview page registers no window
`message` listener — so this finding by itself does not read messages or invoke
native functionality. `/preview-file/` serves only the currently previewed
(attacker's own) file, so other attachments are not reachable. The origin's DOM
storage contains only UI feature flags (e.g. `NoConvoHeader`); no cookies,
`sessionStorage`, or IndexedDB are used by the preview bundle.

Note on exfiltration: although `connect-src` blocks `fetch`/XHR to external
hosts, the CSP sets no `navigate-to`/`form-action`, so anything the script can
read *can* leave the device (top-level navigation with data in the URL, form
submission, or DNS-prefetch side channels — none of which `connect-src`
governs). The practical data impact is therefore not theft of app data (the
origin holds none) but **harvesting whatever the victim types into
attacker-controlled in-app UI** — e.g., credentials entered into a fake Wickr
login screen.

## 7. Remediation

Wickr client:

1. Sanitize/escape renderer output — never assign DOCX-derived strings to
   `innerHTML` (use `textContent`); update or patch the bundled DOCX renderer.
2. Add a restrictive `sandbox` (no `allow-scripts`/`allow-same-origin`) to any
   preview iframe.
3. Tighten the preview CSP: add `form-action 'none'`, `base-uri 'none'`,
   `object-src 'none'`; consider `navigate-to`; remove `blob:` from `frame-src`
   if unused.
4. Re-review the `frame-src` allowlist — remove the Amplify origin until it is
   patched and its ownership documented; prefer not framing remote origins at all.

Amplify origin (related component):

5. Upgrade Next.js to a fixed release (≥ 15.0.5 for the 15.0 line; ideally the
   latest 15.x/16.x patched for the full CVE-2025-55182/-66478 series).
6. WAF: enable oversize-body inspection handling (block/inspect beyond the size
   limit) so padding does not defeat the managed React2Shell rules.
7. Consider decommissioning or access-restricting this undocumented diagnostics
   page.

## 8. Testing conduct

* All payloads were benign: marker elements only, and a read-only
  `process.version` reflection for the RCE check. No shell was spawned, no data
  read, no persistence, no service modification, no other users affected.
* The DOCX PoCs render marker content only; navigation tests target
  `https://example.com/` (IANA reserved).

## 9. Evidence index

| File | Contents |
|---|---|
| `poc-docx-htmli.docx`, `poc-docx-htmli-amplify.docx` | Device-confirmed HTML/iframe injection PoCs |
| `build_poc_docx.py` | PoC generator (shows the `w:char` → `innerHTML` mechanism) |
| `poc-docx-nav-tests.docx`, `poc-docx-meta-refresh.docx` | form/base/meta-refresh navigation tests (pending device run) |
| `build_nav_poc.py` | Generator for the navigation tests |
| `poc-docx-polyglot-xss.docx`, `build_polyglot_poc.py` | ZIP+JS polyglot PoC for same-origin script execution (statically verified; pending device run) |
| `evidence-r2s-response.txt` | Full HTTP exchange of the RCE verification (303 + marker) |
| `evidence_r2s.py` | RCE verification script (read-only) |
| `probe_r2s_variants.py` | WAF block/bypass differentiation probe |
| `wickr-android-preview-analysis.md`, `preview-route-analysis.md` | Static analysis: preview routing, WebView config, CSP, bridge scan |
| CSP source | APK asset `web-assets/dist-file-preview/file-preview.html` (line 4) |
| Sink source | APK asset `web-assets/dist-file-preview/assets/index-ee8ec7f12.js` (`renderSymbol`) |
