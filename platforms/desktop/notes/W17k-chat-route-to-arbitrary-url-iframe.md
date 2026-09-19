# W17k — a chat-originated route to an arbitrary-URL iframe, with no docx and no HTML injection

**Date:** 2026-08-04 **Target:** AWS Wickr Desktop 6.72.20.0 (Windows x64)
**Status:** every link **MEASURED** except the operator-demonstrated one. **This supersedes the negative
recorded in `W17h-chat-path-negative-and-preview-gate.md` §0.**

**The error in the earlier negative:** I treated the app's `frame-src` allow-list as the frame's reachable
set, full stop. It is not. **CSP `frame-src` binds the document that creates the frame.** Once the preview
frame has been navigated to an allow-listed third-party origin, that document is governed by *its own*
policy — and it can create a frame anywhere.

---

## 1. The route

1. A peer sends a **`.pptx`** in an ordinary conversation. Not docx, no HTML injection, no script.
2. The victim opens the preview. *(Requires `enableFileDownload = false`, i.e. a network where an admin
   disabled file download — see `W17h` §1.)*
3. `src/lib/pptx2html/pptx2html.worker.js:1189-1202` concatenates the attacker's hyperlink relationship
   target into `<a href='…'>` **unescaped**, and `fast-xml-parser` has already decoded entities, so
   entity-encoded markup becomes live markup.
4. It passes `DOMPurify.sanitize(dirty, {USE_PROFILES:{html:true, svg:true}})`. Measured over the shipped
   `purify.es.mjs` (3.2.5): the default profile **allows `form`, `input`, `button`, `action`, `method`,
   `style`** and **strips `iframe`, `base`, `target`, `formaction`**. So the only surviving navigation
   primitive is a **form**, and it necessarily navigates the frame itself. `style` permits
   `position:absolute;inset:0`, so **any click in the preview submits it**. `withLinkHandler` does not
   intercept it — that handler early-returns unless `e.target.closest('a')`.
5. The form submits to `https://main.d4zeeqgazhley.amplifyapp.com/<attacker path/query/body>`. **Permitted,
   because that origin is in Wickr's own `frame-src`.** (Measured: allow-listed target succeeds,
   non-allow-listed target is blocked — the shipped engine does enforce the parent's `frame-src` for the
   *direct* navigation.)
6. That document is **cross-origin and serves its own CSP** — an Amplify default app serves none. The
   operator has demonstrated arbitrary JavaScript at that origin.
7. **That script creates an iframe at any URL it likes.**

## 2. Step 7 — MEASURED on the shipped engine

`scratch/w17/frame/nestsrv.py` + `frameprobe.exe`, three loopback origins:

* **A** = the Wickr-shaped parent, carrying the exact `frame-src` shape with **B** allow-listed
  (standing in for the amplifyapp host) and **C absent**.
* **B** = the allow-listed third party, serving **no CSP of its own**, whose script appends
  `<iframe src="http://127.0.0.3:8792/GRANDCHILD">`.
* **C** = an arbitrary origin, deliberately **not** in A's allow-list.

```
[A] GET /parent
[B] GET /child
[B] GET /beacon/B-script-ran
[C] GET /GRANDCHILD                <- ARBITRARY origin loaded as a frame
[C] GET /beacon/C-script-ran       <- and its script ran
```

**The parent's `frame-src` does not constrain the grandchild.** The allow-list is not a containment
boundary; it is a boundary only for the first hop.

## 3. What this yields, stated at its real size

* **An arbitrary-URL iframe rendered inside the Wickr client, reached from a chat message.** That is the
  claim, and it is measured.
* **It does NOT yield the bridge.** The grandchild is cross-origin to the Wickr app document, and a
  cross-origin subframe receives no `qt.webChannelTransport` (measured in W18). It also does not get the
  app's DOM.
* It **is** co-resident with the app document in one process and **one `v8::Isolate`** (measured, W17j) —
  which matters only if a memory-corruption primitive is added.
* The preview iframe carries no `allow` attribute, so no camera/microphone (W18).

## 4. Gates

| gate | status |
|---|---|
| `enableFileDownload = false` (admin policy; default is **true**) | required — verified in `W17h` §1 |
| the victim opens the pptx preview and **clicks once** anywhere in it | required |
| attacker controls content at `main.d4zeeqgazhley.amplifyapp.com` | **operator-demonstrated**; whether that hostname is still AWS-owned or **dangling/re-registrable** is the open question to put to AWS |
| that origin serves no `frame-src` of its own | true for a default Amplify app; **not verified for the live host** |

## 5. The generalisable finding, and the fix

**Allow-listing a third-party origin in `frame-src` grants that origin the ability to frame anything.**
An allow-list entry is transitive in effect even though the directive is not: whatever policy the
allow-listed document ships becomes the real boundary. Wickr allow-lists an origin it appears not to
control, in the CSP of the document that hosts the WebChannel bridge.

Remediation, in the order that costs least:

1. **Remove `https://main.d4zeeqgazhley.amplifyapp.com/` from `frame-src`** — it exists only for the
   "Custom speed test" toggle in `CheckSpeedModal`. If the hostname is not AWS-owned, this is urgent
   regardless of everything else here.
2. **`sandbox="allow-scripts"` on the preview iframe** (without `allow-same-origin`) — kills this route
   and the reported docx route together, and contains future parser bugs.
3. **Add `form-action 'none'` and `base-uri 'none'`** to both shipped documents' CSP. Neither is present;
   `form-action` does not fall back to `default-src`, so the submission itself is currently unrestricted.
4. **Escape the concatenation** at `pptx2html.worker.js:1189-1202`.

Any one of 1–3 breaks the route. All four are small.

## 6. Relationship to the earlier record

* `W17h` §0 recorded "no chat path"; **that conclusion was wrong for the reason in the header above**, and
  the pptx form primitive it identified as the "nearest miss" is in fact the first hop of a working route.
* `W19` (parallel work) measured hops 3–5 independently.
* No code execution is claimed. No exploitation was performed. Nothing was sent to Wickr infrastructure.
