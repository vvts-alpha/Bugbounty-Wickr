# W17 — F11: a broken hand-rolled sanitizer puts peer-controlled markup into the MAIN app frame

**Date:** 2026-08-04 **Target:** AWS Wickr Desktop 6.72.20.0 (Windows x64)
**Status:** sanitizer bypass **EXECUTED**; sink and data-flow **source-verified**; in-product trigger **NOT tested**

**This is not the docx path.** Different entry point (a display name, not a file), different sink
(Leaflet popup, not `iframe.srcdoc`), different root cause (a broken sanitizer, not a library default),
and — the part that matters — **a different frame**: the docx path lands in the file-preview iframe;
this one lands in the **main application frame**, the one that loads `qrc:///qtwebchannel/qwebchannel.js`.

---

## 0. How the source was obtained (new capability, reusable)

The shipped `WickrPro.exe` embeds **Vite source maps with `sourcesContent`** — i.e. the original
TypeScript of the Wickr web UI. Two carves were needed:

1. `scratch/w16/qrc/` — the zlib-compressed qrc resources (already carved in W16): 11 maps.
2. **`scratchpad/exemaps.py` — the qrc also stores resources UNCOMPRESSED, which the zlib-only carve
   missed.** Scanning `WickrPro.exe` for the literal `{"version":3,"file":"` header and brace-matching
   the JSON recovered **9 more maps**, including every lazy-loaded file-preview chunk.

Combined: **2,195 original source files** at `scratch/w17/src/`. Do this first in any future wave —
it turns binary archaeology into ordinary source review.

---

## 1. The sink census — Wickr's own React code has exactly three HTML sinks

Over the complete recovered `src/` tree:

| site | sink | verdict |
|---|---|---|
| `src/components/Convo/ConvoMessageContextMenuItems.tsx:139` | `const copyHtml = textEl.innerHTML` | **read**, not a write (clipboard) |
| `src/components/CopyHandler/copyTextSelection.tsx:35` | `let copiedHtml = tempEl.outerHTML` | **read**, not a write (clipboard) |
| `src/file-preview/components/PowerPointPreview/index.tsx:201` | `dangerouslySetInnerHTML={{__html: sanitizedHtml}}` | pptx — DOMPurify'd, **already examined** |

Every other preview renderer is **safe**, and each was checked to a conclusion rather than assumed:

| preview | ext | mechanism | verdict |
|---|---|---|---|
| `SpreadsheetPreview` | xls/xlsx/csv | `utils.sheet_to_json` → React children | **safe** (React escapes) |
| `TextPreview` | txt/log/md | `<p>{line}&nbsp;</p>` | **safe** |
| `RichTextPreview` | **rtf** | `rtfToTxt` (text, *not* HTML) → `TextPreview` | **safe** |
| `XmlPreview` | xml/rss | `DOMParser` → `XmlNode` React tree | **safe** (inert doc, React escapes) |
| `PdfPreview` | pdf | PDF.js → canvas | n/a |
| `DocPreview` | docx | docx-preview → `iframe.srcdoc` | **already reported** |

**So the React UI is, on the whole, correctly built.** The defect is not in a renderer — it is in a
utility that one component uses instead of React's escaping.

---

## 2. F11 — the chain

### 2.1 The broken control

`src/utils/dom.ts:341`:

```ts
/** Given an input string, sanitizes any HTML out of it using a DOMParser. */
export const sanitizeHTML = (input: string): string => {
  if (!HAS_DOMPARSER) { logger.warn(...); return input; }
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'text/html');
  return doc.body.textContent ?? '';
};
```

**`textContent` of a parsed document returns the ENTITY-DECODED text.** The function therefore does not
escape — it *decodes*. Feed it `&lt;img …&gt;` and it hands back `<img …>` as live markup. It removes
markup that was already markup, and *creates* markup that was not.

### 2.2 The sink

`src/components/Convo/MessageContent/GeoLocationMap.tsx:188`:

```ts
marker.current.bindPopup(sanitizeHTML(senderName ?? ''));
```

`bindPopup` is Leaflet's. `leaflet-src.js:10034`, `Popup._updateContent`:

```js
if (typeof content === 'string') {
    node.innerHTML = content;          // <- string content goes straight to innerHTML
}
```

### 2.3 The source is peer-controlled, and unvalidated

`src/utils/strings.ts:178`:

```ts
export const getContactDisplayName = (contact?) =>
  contact?.customName ?? contact?.name ?? contact?.id ?? '';
```

No escaping, no length or charset constraint. `src/components/Modals/LocationModal/index.tsx:41,71`:

```ts
const senderName = getContactDisplayName(sender);      // sender = the peer who shared the location
…
<GeoLocationMap {...location} senderName={senderName} />   // interactive defaults to true
```

### 2.4 EXECUTED — the bypass is real

`scratchpad/sanitest.html`, run headless in Chrome, reproducing `sanitizeHTML` verbatim and then
performing Leaflet's `innerHTML` assignment:

```
--- plain markup ---      <img src=x onerror=…>          -> sanitized to ""        -> 0 elements
--- entity-encoded ---    &lt;img src=x onerror=…&gt;     -> "<img src=x onerror=…>" -> 1 element [IMG]
--- numeric entities ---  &#60;img …&#62;                 -> "<img …>"              -> 1 element [IMG]
--- entity svg/onload --- &lt;svg onload=…&gt;            -> "<svg onload=…>"       -> 1 element [svg]
--- mixed w/ real name -- Alice &lt;img …&gt;             -> "Alice <img …>"        -> 1 element [IMG]
--- benign ---            Alice                          -> "Alice"                -> 0 elements

HANDLERS THAT ACTUALLY EXECUTED: 5,2,3,4
```

**Only the naive case is stopped. Every entity-encoded variant survives, is re-materialised as a live
element by `innerHTML`, and its handler runs.**

> **And the payload contains no `<` and no `>` at all.** A server- or client-side filter that rejects
> angle brackets in display names — the obvious defence, and the one the operator's room-name test showed
> is absent anyway — **would not stop this.**

---

## 3. Where it lands, and what the CSP does

The main application frame is `blob_00e568b7.html`. It loads `/assets/wickr-BXqo7ivg.js` **and
`qrc:///qtwebchannel/qwebchannel.js`** — this is the bridge-bearing frame (58 `Q_INVOKABLE`), not the
sandboxed preview iframe.

Its CSP is identical to the preview's:

```
script-src 'self' qrc://*                     <- no 'unsafe-inline': inline onerror/onload IS blocked
img-src 'self' https://tile.googleapis.com wickrweb://* blob: data:
frame-src 'self' blob: https://fast.com/ https://main.d4zeeqgazhley.amplifyapp.com/
```

So, honestly stated:

* **Inline event handlers do not execute in-product.** The `onerror=` in the harness above fires because
  the harness has no CSP. In Wickr, CSP blocks it.
* **What does land is HTML injection into the main frame**, with `frame-src` allowlisting
  `https://main.d4zeeqgazhley.amplifyapp.com/` — **the origin against which the operator has an already
  verified CSP bypass.** An injected `<iframe src="https://main.d4zeeqgazhley.amplifyapp.com/…">` is
  permitted by this policy.

---

## 4. Trigger sequence, and what is NOT proven

1. Attacker sets their **display name** to `Alice&lt;iframe src="https://…allowlisted…"&gt;`.
2. Attacker **shares a location** with the victim.
3. Victim **clicks the location message** → `ViewLocationModalContent` → `GeoLocationMap` with
   `interactive = true` → `bindPopup(sanitizeHTML(senderName))`.
4. Victim **clicks the map marker** → Leaflet `_updateContent` → `node.innerHTML = <live markup>`.

**NOT PROVEN, and not claimed:**

* **that Wickr accepts a display name carrying `&lt;`** — untested; needs a live account. Note again that
  the payload needs no angle brackets, so the obvious filter does not apply.
* **that the popup opens in the shipped product** — no `openPopup()` exists in `src/`, so it needs the
  marker click (step 4). Two interactions total.
* **anything about code execution.** The executed part is the sanitizer bypass, in a harness.

**Remediation (one line):** `sanitizeHTML` must escape, not decode — or, better, drop it and pass a DOM
node to `bindPopup`, which Leaflet appends instead of `innerHTML`-ing. Every other consumer of a peer
display name in this codebase already relies on React's escaping and is fine.

---

## 5. Duplication check against the reported HTMLi→XSS chain

| | reported docx chain | F11 |
|---|---|---|
| entry | a **.docx file** the peer sends | the peer's **display name** |
| sink | `docx-preview.renderAltChunk` → `iframe.srcdoc` | Leaflet `bindPopup` → `innerHTML` |
| root cause | library default `renderAltChunks: true` | **Wickr's own `sanitizeHTML` decodes instead of escaping** |
| frame | file-preview **iframe** | **main app frame** (holds `qwebchannel.js`) |
| fix | disable `renderAltChunks` | fix `sanitizeHTML` |

The **CSP-bypass step is shared**, but that is the exploitation technique, not the defect. The defect,
its location, its owner (Wickr's code, not a dependency) and its remediation are all distinct.
