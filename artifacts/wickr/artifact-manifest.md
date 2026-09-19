# AWS Wickr (WickrPro.exe) — Artifact Extraction & Inventory Manifest

**Phase:** 1 (Artifact extraction and inventory only — no vulnerability analysis)
**Analyst tooling:** Static extraction only (Python PE/zlib parsing). Application was NOT executed.
**PROJECT_NOTES_DIR:** `E:\wickr\`
**Date:** 2026-07-24

---

## 1. Original binary metadata

| Field | Value |
|---|---|
| File | `E:\tmp\wickr\main\WickrPro.exe` |
| Size | 55,890,344 bytes |
| **SHA-256** | **`eccafde833d34386c859d6548e922649c2f58cd15f82998c8bd2966219341dbd`** |
| MD5 | `8a373885ee70fc97b493e00a3cb6678e` |
| Product version | 6.72.20.0 (AWS Wickr) |
| PE | x86-64 (PE32+), Subsystem = GUI (2) |
| Sections | `.text .rdata .data .pdata CPADinfo .rsrc .reloc` |
| `.rsrc` | 5,120 bytes — version info / manifest / icons only (no web assets) |
| Overlay | 10,664 bytes — **Authenticode signature** (SECURITY data-directory covers it exactly; `offset+size == filesize`). No appended application data. |
| Framework | **Qt 6 + Qt WebEngine + QtWebChannel** (NOT Electron). Verified via QML `import QtWebEngine` / `import QtWebChannel`, `Qt6Gui.dll`/`Qt6WebChannel.dll` imports, `qt.webChannelTransport`. |

### Qt / WebEngine version indicators (directly observed)
- QML comments reference `https://doc.qt.io/qt-5/...` (Qt 5 docs URL; runtime is Qt 6 per DLL names).
- `Qt Version :`, `Qt WebEngine Version :`, `Qt WebEngine Patch Version :` template strings present at `0x032369C8` (values injected at runtime; not statically resolvable).
- DOMPurify 3.2.5, React 18.3.1, JSZip 3.10.1, docx-preview 0.3.5, pdfjs-dist 4.10.38, @e965/xlsx 0.20.3 (from embedded dependency manifest `0x00E47343`).

---

## 2. Extraction methods actually used

1. **Manual PE parsing** (Python `struct`) — headers, sections, data directories, overlay identification, Authenticode confirmation.
2. **Plaintext text-run extraction** — maximal runs of printable bytes ≥512 B written to `E:\wickr\extracted\` (captures uncompressed RCC assets: small JS chunks, source maps, QML fragments).
3. **Zlib/RCC decompression sweep** — scanned `.rdata` for zlib headers (`78 9C/DA/01/5E`), inflated with `zlib.decompressobj`, wrote to `E:\wickr\extracted\decompressed\`. This is what recovered the large JS bundles, the 11 source maps, the 2 HTML entries, and the bulk of the QML.
4. **Source-map recovery** — parsed `sources` + `sourcesContent` from each `.map`; reconstructed original TS/TSX/JS source tree under `E:\wickr\extracted\sources\`.
5. **Targeted binary string search** — Phase 4 term index over the raw PE and over recovered sources.

> **Why CSP was not found in the raw binary:** the HTML entry files are **zlib-compressed inside the Qt RCC**, so the literal `Content-Security-Policy` does not appear in the raw `.exe`. It is only visible after decompression. This is a verified fact, not an absence.

---

## 3. Extracted artifacts (size / sha256)

Aggregate counts (see `artifact-manifest.json` for the full list):

| Bucket | Count | Notes |
|---|---|---|
| Decompressed meaningful text assets | **167** | 2 HTML, 6 JS bundles, 11 source maps, 134 QML, 5 CSS, 9 JSON |
| (Decompressed entries total) | 4002 | remainder are image/font/binary data falsely matching zlib headers |
| Plaintext runs (≥512 B) | 124 | uncompressed RCC fragments |
| **Recovered application source files** (`src/**`) | **831** | original TS/TSX/JS from sourcesContent |
| Recovered source files incl. `node_modules` | 2196 | third-party lib sources |

Key decompressed artifacts (sha256 prefix shown):

| Decompressed file | Bytes | Real identity |
|---|---|---|
| `html_0x00E46F48_6926.bin` | 6,926 | **file-preview entry HTML** (`file-preview-4vkBugtX.js`) |
| `html_0x00E568B7_6704.bin` | 6,704 | **main app entry HTML** (`wickr-BXqo7ivg.js`, loads `qwebchannel.js`) |
| `sourcemap_0x014EB483_*.bin` | 12,474,894 | **main app source map** (`app-DOUtVdma.js`, 1414 sources) |
| `sourcemap_0x0175E9E0_*.bin` | 5,349,022 | file-preview source map (mappings) |
| `fetch.worker-CBx8UzdB.js.map` | 4,506,982 | fetch worker source map (180 sources) |
| `app-9Xlf3-NH.js.map` | 1,690,094 | xlsx/SpreadsheetPreview source map |
| `pptx2html.worker-DeYYp-mz.js.map` | 426,012 | pptx worker source map |
| `app-CAX5Wyxr.js.map` | 102,784 | **DOMPurify + PowerPointPreview source map** |
| `css_0x031EE446_17181.bin` | 17,181 | Qt `qwebchannel.js` (misclassified; standard Qt file) |
| `app-DOUtVdma.js.map` (5.76 MB) | 5,762,997 | main app entry **bundle** (JS, not a real .map) |
| `wickr-BXqo7ivg.js.map` (1.26 MB) | 1,257,959 | file-preview entry **bundle** (JS, not a real .map) |

> Naming caveat: two large JS entry *bundles* were auto-named `*.js.map` by the extractor because they contain a `sourceMappingURL=` reference; they are JavaScript, not source maps. Real source maps are the `{"version":3,...}` JSON files.

---

## 4. Recovered source-map files

11 genuine source maps (`version:3`), all with `sourcesContent`:
`app-DOUtVdma.js` (main, 1414 src), file-preview (5.3 MB mappings), `fetch.worker-CBx8UzdB.js` (180 src), `pptx2html.worker-DeYYp-mz.js`, `app-9Xlf3-NH.js`, `app-kF4hQfij.js`, `app-DC6GHwVM.js`, `app-CAX5Wyxr.js`, `app-CSWYqNVr.js`, `app-BLAoUoDS.js`, `app-BO1aIr5l.js`.

Recovered 831 application source files under `src/`, including the complete `src/file-preview/**`, `src/apis/webChannel/**`, `src/apis/webFetch/**`, `src/components/Modals/FilePreviewModal/**`, `src/utils/dom.ts`.

---

## 5. Identified qrc / custom-scheme paths

- `qrc:///webengine/preloads.js` — WebEngineScript injected at `DocumentCreation`, `MainWorld` (referenced in QML `0x030A2317`). **Content NOT recovered** (see §8).
- `qrc:///qtwebchannel/qwebchannel.js` — loaded by main app entry HTML (standard Qt transport).
- `qrc:///images/*.svg|png` — icon/image assets (many, in QML).
- `qrc:/qml/**` — QML UI sources (134 files recovered).
- **`wickrweb://`** custom scheme — `message/`, `convo/`, `convolist/`, `users/`, `image/savedlink/`. Base name defined in `src/apis/webFetch/endpoints.ts:6` (`WICKR_WEB_PROD_BASENAME`). Used in CSP `default-src`/`connect-src`/`img-src`/`media-src`.

---

## 6. Exact CSP strings found

Found in **both** decompressed HTML entry files as:
```html
<meta http-equiv="Content-Security-Policy" content="...">
```

**Verbatim (HTML-entity encoded, as stored):**
```
default-src &#39;self&#39; qrc://* wickrweb://* ; style-src &#39;self&#39; &#39;unsafe-inline&#39; ; script-src &#39;self&#39; qrc://* ; connect-src &#39;self&#39; wickrweb://* https://bedrock-runtime.us-east-1.amazonaws.com https://bedrock-agent.us-east-1.amazonaws.com https://bedrock-agent-runtime.us-east-1.amazonaws.com ... [AWS Bedrock endpoints across all regions] ... ; img-src &#39;self&#39; https://tile.googleapis.com wickrweb://* blob: data: ; font-src &#39;self&#39; data: ; media-src &#39;self&#39; wickrweb://* data: blob: ; frame-src &#39;self&#39; blob: https://fast.com/ https://main.d4zeeqgazhley.amplifyapp.com/ ; worker-src &#39;self&#39; blob: ; child-src &#39;self&#39; blob: ; object-src &#39;self&#39;
```

**Decoded (entities → quotes), not normalized:**
```
default-src 'self' qrc://* wickrweb://* ; style-src 'self' 'unsafe-inline' ; script-src 'self' qrc://* ; connect-src 'self' wickrweb://* https://bedrock-runtime.*.amazonaws.com https://bedrock-agent.*.amazonaws.com https://bedrock-agent-runtime.*.amazonaws.com ; img-src 'self' https://tile.googleapis.com wickrweb://* blob: data: ; font-src 'self' data: ; media-src 'self' wickrweb://* data: blob: ; frame-src 'self' blob: https://fast.com/ https://main.d4zeeqgazhley.amplifyapp.com/ ; worker-src 'self' blob: ; child-src 'self' blob: ; object-src 'self'
```
(`connect-src` enumerates ~120 explicit AWS Bedrock hostnames across all regions — abbreviated above; full list in the HTML files.)

**Notable directives absent:** no `base-uri`, no `form-action`, no `trusted-types` / `require-trusted-types-for`, no `frame-ancestors`.

---

## 7. Candidate files related to preview, messaging, WebChannel, DOM insertion

(exact recovered-source locations)

**File-preview DOM-insertion sinks (highest interest):**
- `src/file-preview/components/PowerPointPreview/index.tsx:201` — `dangerouslySetInnerHTML={{ __html: sanitizedHtml }}`; sanitized via `DOMPurify.sanitize(..., { USE_PROFILES:{html:true, svg:true} })` (:22-29); slide HTML from `pptx2html.worker.js`.
- `src/file-preview/components/DocPreview/index.tsx:1` — imports `docx-preview` (DOCX → HTML rendering).
- `src/file-preview/components/XmlPreview/index.tsx:197` — `new DOMParser()` (XML preview).
- `src/file-preview/components/TextPreview/index.tsx`, `RichTextPreview.tsx`, `rtf_converter.js` — text/RTF path.
- `src/file-preview/components/SpreadsheetPreview/index.tsx:1` — `xlsx` rendering.
- `src/lib/pptx2html/pptx2html.worker.js` — attacker-influenced PPTX → HTML producer (JSZip-based).

**Parent/child messaging & iframe boundary:**
- `src/components/Modals/FilePreviewModal/index.tsx:134` — `<iframe src={previewUrl} />` **no `sandbox` attribute** (same-origin per CSP `frame-src 'self'`).
- `src/components/Modals/FilePreviewModal/index.tsx:99-114` — `message` listener; gate `event.origin === window.parent.origin` (:101); action `openLink` (:104).
- `src/file-preview/components/withLinkHandler.tsx:17` — `window.parent.postMessage({type:'openLink',url:href}, window.parent.origin)`.

**Qt WebChannel / native bridge:**
- `src/apis/webChannel/utils.ts:38` — `openQWebChannel<...>(qt.webChannelTransport)`.
- `src/apis/webChannel/**` — Bridge/UIBridge/EnvironmentMgr/Onboarding/ServerModel/FileManager adapters.
- QML `qml_0x030A2BEC` (decompressed) — `channel.registerObject("uiBridge", uiBridge)`; `new QWebChannel(qt.webChannelTransport,...)`.

**Sanitization utility:**
- `src/utils/dom.ts:341-350` — `sanitizeHTML()` using `DOMParser` (separate from the DOMPurify usage in PowerPointPreview).

**QML WebEngine hardening posture (decompressed `qml_0x030A2BEC`):**
- `onCertificateError: error.ignoreCertificateError()` (cert errors ignored on the main webview).
- `onFeaturePermissionRequested: grantFeaturePermission(securityOrigin, feature, true)` (all features granted to any origin).
- `settings.javascriptCanAccessClipboard: true`, `javascriptCanPaste: true`.

---

## 8. Failed extraction attempts

| Target | Status | Reason |
|---|---|---|
| `qrc:///webengine/preloads.js` content | **NOT FOUND (content)** | Referenced in QML as a `WebEngineScript` (`DocumentCreation`, `MainWorld`), but no discrete JS artifact matching it was recoverable as a zlib stream or plaintext run (likely <512 B or stored in an RCC segment not matching standard zlib headers). Its reference is confirmed; its body is not. |
| `app-CSWYqNVr.js.map`, `app-kF4hQfij.js.map` | **PARTIALLY EXTRACTED** | Decompressed successfully but JSON parse failed — these are JS *bundles* auto-named `.map`, not source maps. Their source maps may be the large unnamed `sourcemap_0x014EB483` / `sourcemap_0x0175E9E0`. |
| Qt WebEngine / Chromium runtime version | **INSUFFICIENT EVIDENCE** | Version template strings exist but values are injected at runtime; static value not resolvable. |
| `mammoth` source | NOT FOUND in src/ | Listed in dependency manifest; no direct import located in recovered sources. |

---

## 9. Unknown / ambiguous resources

- ~3,822 decompressed "text" entries are binary image/font/protobuf data whose byte sequences coincidentally began with zlib-compatible headers; these are NOT application text assets.
- `wickrSettings.webViewAddress` (QML) — the origin the main WebEngineView loads from is a runtime setting; not statically resolvable. The file-preview HTML is served same-origin (`frame-src 'self'`).
- `https://main.d4zeeqgazhley.amplifyapp.com/` — whitelisted in `frame-src`; purpose not determinable from static assets (appears to be an AWS Amplify-hosted page).

---

## 10. Recommended first source file for defensive review

**`src/file-preview/components/PowerPointPreview/index.tsx`**

Rationale: it contains the single `dangerouslySetInnerHTML` sink in the recovered codebase, fed by attacker-influenced PPTX content transformed to HTML by `pptx2html.worker.js`, sanitized through `DOMPurify.sanitize(..., {USE_PROFILES:{html:true, svg:true}})` (SVG profile enabled), and rendered inside the unsandboxed same-origin file-preview iframe. It is the most concentrated trust-transition point spanning DOM insertion, sanitization, worker messaging, and the iframe boundary — and it is fully recovered with original TypeScript.

Follow-up files: `FilePreviewModal/index.tsx` (iframe/message boundary), `withLinkHandler.tsx` (postMessage), `src/utils/dom.ts` (sanitizeHTML), `src/apis/webChannel/utils.ts` (native bridge).

---

*All conclusions above are derived exclusively from static artifacts extracted from `WickrPro.exe`. The application was not executed. No exploit, payload, or malicious document was created.*
