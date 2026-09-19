# W19 — the .pptx → form-navigation → third-party-origin chain, verified

**Operator's proposed chain, put to measurement:**

> peer sends a `.pptx` → victim opens the preview (`enableFileDownload=false`) → one click
> anywhere in the preview (a submit button covering the area via `position:absolute;inset:0`)
> → the preview frame navigates

**Verdict: the chain holds, and the third-party origin is what makes it hold.** Every link below is
either read out of the shipped source or measured against the shipped Qt WebEngine. Artifacts:
`scratch/w19/` (`formsrv.py`, `formprobe.c`, `dpcheck.py`, `form-hits.log`).

---

## §1 The injection point is real and is an attribute break-out, not a tag injection

`src/lib/pptx2html/pptx2html.worker.js:1189-1200`:

```js
var linkID = getTextByPathList(node, ['a:rPr', 'a:hlinkClick', '@_r:id']);
if (linkID !== undefined) {
  var linkURL = warpObj['slideResObj'][linkID]['target'];
  return "<span class='text-block " + cssName + "'><a href='" + linkURL + "' target='_blank'>" + …
```

`linkURL` is the **relationship target out of the attacker's .pptx**, interpolated into a
single-quoted `href` with **no escaping of any kind**. One `'` ends the attribute and the rest of the
value is parsed as markup.

## §2 What survives the sanitiser — measured against the SHIPPED DOMPurify, not from memory

`src/file-preview/components/PowerPointPreview/index.tsx:22` sanitises with
`DOMPurify.sanitize(dirtyHtml, { USE_PROFILES: { html: true, svg: true } })` — no `ALLOWED_*`, no
`FORBID_*`, so the library defaults decide. Reading the recovered
`node_modules/dompurify/dist/purify.es.mjs` (`scratch/w19/dpcheck.py`):

| | in the default profile? |
|---|---|
| tags `form`, `button`, `input`, `select`, `textarea`, `style`, `a` | **allowed** (`html$1`, 117 entries) |
| attrs `action`, `method`, `enctype`, `type`, `value`, `name`, **`style`**, `class`, `id` | **allowed** (`html`, 113 entries) |
| **`iframe`**, **`base`** | **absent ⇒ stripped** |
| **`target`**, **`formaction`** | **absent ⇒ stripped** |

Two consequences, and they are the whole shape of this finding:

* **`iframe` is stripped, so the pptx preview cannot use the iframe-injection route at all.** A form
  is the *only* way out of that document.
* **`target` is stripped, so the submission cannot open a new context — it navigates the frame
  itself.** That is precisely the operator's step 4, and it is forced by the sanitiser rather than
  chosen by the attacker.
* `style` is allowed, so `position:absolute;inset:0` on the submit button is available — one click
  anywhere in the preview area submits. (Attacker CSS is available a second way too: the renderer
  emits a `<style>` block built from the pptx's own `styleTable` — W16.)

No script is needed anywhere in this chain, so `script-src 'self' qrc://*` is irrelevant to it.

## §3 ★ The measurement: the navigation happens, and `frame-src` is the only thing deciding it

Wickr's CSP (both qrc documents) has **no `form-action`, no `base-uri`, no `sandbox`** — so the
submission itself is unrestricted. The open question was whether the *parent's* `frame-src`
constrains a navigation that the child frame initiates on itself.

`formsrv.py` raises three loopback origins and reproduces the exact shape: origin **A** serves the
main document *and* a same-origin "preview" child (as `FILE_PREVIEW_URL = 'file-preview.html'` is
same-origin), both carrying `frame-src 'self' http://127.0.0.2:8481/`; the child contains only what
§2 says survives — `<form action=…>` plus a covering `<button type=submit style="position:absolute;
inset:0">`. Origin **B** is the allow-listed third party (models the amplify origin), origin **C** is
not allow-listed. `formprobe.exe` drives the shipped Qt6WebEngineQuick.

```
[A] GET /csp-main
[A] GET /preview?to=B        [A] GET /preview?to=C
[A] REPORT about-to-click  action=http://127.0.0.2:8481/LANDED_FROM_FORM_B
[B] GET /LANDED_FROM_FORM_B?            <<< navigation SUCCEEDED
[A] REPORT about-to-click  action=http://127.0.0.3:8482/LANDED_FROM_FORM_C
                                        <<< no request to C: navigation BLOCKED
```

**⇒ `frame-src` does govern a self-initiated form navigation of a child frame — and the allow-listed
origin passes it.** W17h's "stopped only by `frame-src`" is confirmed *and* is exactly why the chain
works: `frame-src` contains `https://main.d4zeeqgazhley.amplifyapp.com/`, so
`<form action="https://main.d4zeeqgazhley.amplifyapp.com/…">` is an allowed destination.

## §4 What the chain delivers, stated precisely

**peer .pptx → auto/opened preview → one click anywhere → the preview frame is now a document of the
attacker-controlled third-party origin, running the attacker's JS inside the Wickr window.**

Preconditions, all of them:
1. **`enableFileDownload = false`** on the network — otherwise `FilePreviewModal` is never reached at
   all and there is no preview to click (W17h; the setting is native admin policy, default **true**).
2. **One human click** anywhere over the preview area. No script is available to auto-submit, so the
   covering-button trick is load-bearing, not decorative.
3. The `action` must be an origin in `frame-src` — i.e. the amplify origin (or `fast.com`).

What it does **not** give, measured:
* **No bridge.** After navigation the frame is cross-origin to the app, so `qt.webChannelTransport`
  is absent and `parent.qt` is unreachable (W18 F19).
* **No `openLink` via postMessage.** `FilePreviewModal/index.tsx:100` gates on
  `event.origin === window.parent.origin`; the navigated frame's origin no longer matches.
* **No camera/mic.** The preview `<iframe src={previewUrl} />` is created with **no `allow`
  attribute**, so Permissions Policy denies the now-cross-origin document before Wickr's
  `grantFeaturePermission` is consulted — the same negative the W18 `/child` control measured
  (`NotAllowedError`).

So its value is **delivery**: it is a second, independent way to put attacker JS on screen inside the
app, and unlike the display-name/iframe route it survives a sanitiser that explicitly strips
`iframe`. For code execution it still depends on the same open item as every other web-side route —
a Chromium bug, with the network-stack subset needing no sandbox escape (W18 §6d).

## §5 The one-line fixes, in order of cost

1. **Escape `linkURL`** in `pptx2html.worker.js` (or build the anchor with `createElement`) — kills
   the injection at the source.
2. **Add `form-action 'none'`** (and `base-uri 'none'`) to both CSP documents — kills this chain even
   with the injection present, and costs nothing: the app has no cross-origin forms.
3. **`sandbox="allow-scripts"` on the preview iframe** (F17) — no `allow-same-origin`, which also
   removes the same-origin footing the reported docx chain depends on.
4. Drop the third-party origins from `frame-src`; `CheckSpeedModal` is `!isProduction`-only anyway.
