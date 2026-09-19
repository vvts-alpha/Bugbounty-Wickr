# AWS Wickr Desktop — Second addendum (W17)

**Date:** 2026-08-04 **Target:** AWS Wickr Desktop 6.72.20.0 (Windows x64)
**Install under test:** `%LOCALAPPDATA%\Programs\Amazon Web Services, Wickr\AWS Wickr`

This addendum adds **four findings**, **withdraws one** carried in a draft of the previous addendum, and
**corrects one triage** in `DISCLOSURE-ADDENDUM-W16.md` §3b.

Everything below was produced by reading the shipped application's own source — recovered from Vite
source maps embedded in `WickrPro.exe` — and by executing the shipped Qt libraries in local harnesses.
**Nothing was sent to Wickr infrastructure, no live account was used, and no Wickr process was
attacked.** All harness traffic was loopback.

**Labels.** MEASURED = executed, with the result quoted. VERIFIED = read directly off shipped code.
NOT VERIFIED = we say so, and claim nothing on it.

---

## 0. Method note — the application's own source is recoverable from the shipped binary

`WickrPro.exe` embeds **Vite source maps including `sourcesContent`**, i.e. the original TypeScript of
the web UI. Note for anyone reproducing this: the Qt resource system stores some entries **uncompressed**,
so a decompression-only carve is incomplete; the remainder are recovered by scanning the executable for
the literal `{"version":3,"file":"` header. Combined, **2,195 original source files**.

The QML layer is likewise shipped as readable JavaScript inside the resource bundle.

This matters for the report because it means the findings below are quotations of Wickr's code, not
inferences about it.

---

## 1. Finding 13 — TLS certificate errors are accepted unconditionally (MEASURED)

The shipped QML installs the same handler on **both** `WebEngineView`s — the main application view (the
one carrying the WebChannel bridge) and the per-conversation "WebApp" view:

```qml
onCertificateError: function(error) {
    error.acceptCertificate();
}
```

No condition, no origin test, no error-class test, no user prompt. Qt's contract is that **not** calling
`acceptCertificate()` aborts the load, so calling it unconditionally disables certificate validation for
everything those views load.

**MEASURED** (`scratch/w17/certprobe.c`, two self-signed HTTPS servers on distinct loopback origins with
**different** certificates, so that Chromium's per-host exception cache cannot mask the result):

```
control  -- no handler installed              requests reaching either server:  NONE

accept   -- Wickr's handler, verbatim
   [A] GET /main                       document over an invalid certificate      LOADED
   [A] GET /beacon/document-loaded     its script                                RAN
   [B] GET /beacon/cross-origin-fetch  cross-origin fetch() to a 2nd bad cert    SUCCEEDED
   [B] GET /sub-img.png                subresource image from the 2nd bad cert   LOADED
   [B] GET /sub-frame
   [B] GET /beacon/subframe-loaded     iframe from the 2nd bad cert   LOADED AND EXECUTED SCRIPT
```

**The handler is not limited to the navigated document.** Navigations, images, subframes and cross-origin
`fetch()` all proceed, for an origin the user never visited, carrying a certificate signed by nobody, and
**no warning is shown** because the application suppresses the one Qt would have raised.

**Impact.** Anyone able to intercept the client's network traffic can substitute content for every HTTPS
endpoint these views use. By the application's own CSP that includes the **AWS Bedrock endpoints** the AI
features call, the **`tile.googleapis.com`** requests (which carry the Maps API key obtained from
`bridge.getGoogleMapsApiInfo()`), and the two external origins in `frame-src`.

**Not determined:** whether Qt marks any error class non-overridable in this build. The two exercised —
unknown issuer and name mismatch — were both accepted.

**Remediation:** remove the handler so Qt's default applies, or accept only a specific pinned case.

---

## 2. Finding 14 — every WebEngine feature permission is granted to every origin, silently (VERIFIED)

On the **main** view — `webChannel: channel`, i.e. the frame that holds the bridge:

```qml
onFeaturePermissionRequested: function(securityOrigin, feature) {
    console.log("granting permissions", securityOrigin, feature)
    grantFeaturePermission(securityOrigin, feature, true);
}
```

`securityOrigin` and `feature` are logged and then ignored. In Qt 6 the feature enumeration covers
`Geolocation`, `MediaAudioCapture`, `MediaVideoCapture`, `MediaAudioVideoCapture`, **`DesktopVideoCapture`**,
**`DesktopAudioVideoCapture`** and `Notifications`. The same view also sets
`settings.javascriptCanAccessClipboard: true` and `settings.javascriptCanPaste: true`.

**On its own this is a hardening defect** — the client has removed the consent step Qt provides. **In
combination with script execution in that view** — which the reported HTML-injection chain achieves — it
means `getUserMedia({video:true,audio:true})` and `getDisplayMedia()` succeed **with no prompt**, and the
clipboard is readable. We offer this as a **severity multiplier on the existing report**, not as an
independent exploit.

The `frame-src` allow-list (`fast.com`, `main.d4zeeqgazhley.amplifyapp.com`, loaded by the speed-test
modal) inherits the same handler.

**Remediation:** grant only the features the product needs, only to its own origin.

---

## 3. Finding 17 — the untrusted-document preview is same-origin and unsandboxed, beside a privileged local API (VERIFIED)

**This is not the HTML-injection issue already reported. It is the reason that issue reaches everything,
and it has its own remediation.**

```tsx
const FILE_PREVIEW_URL = 'file-preview.html';   // relative  =>  same origin
…
<iframe src={previewUrl} />                     // no sandbox attribute
```

**`grep -rn "sandbox" src/` over the whole recovered application returns nothing** — the attribute is
used nowhere in the product. Inside that iframe the client runs `docx-preview`, `pptx2html` +
`fast-xml-parser`, `pdfjs-dist`, `@e965/xlsx`, `DOMPurify` and the XML/text/RTF renderers over
attacker-supplied bytes.

The origin those parsers share is the one authorised to call the client's private API over the
`wickrweb://` scheme — the CSP says so explicitly (`connect-src 'self' wickrweb://*`). The route table
(`src/apis/webFetch/endpoints.ts`) includes:

| exposure | routes |
|---|---|
| credentials | `/awsCredentials` |
| account control | `/myaccount/password`, `/myaccount/leavenetwork` |
| network administration | `/admin/controls`, `/admin/inviteuser` |
| all conversation content | `/message/:convoId[/…]`, `/convo/:convoId/roomHistory`, `/search` |
| files | `/file/message/:convoId/:msgId`, `/file/savedfile/:guid`, `/filemanager/…` |
| identity | `/contacts/contacts`, `/contacts/directory`, `/users/self`, `/users/id/:userId` |
| security state | `/devices/active`, `/verification/fingerprints/:userId` |

The native router's own segment table corroborates it, and adds one the web table does not list:

```
image | audio | file | message | users | convo | convolist | filemanager | search |
devices | contacts | chimetoken | verification | myaccount | admin | awscredentials
```

**Every part of an isolation design is present except the part that enforces it** — separate document,
separate bundle, `postMessage` rather than direct DOM access. The receiver's origin test
(`event.origin === window.parent.origin`) is one the preview frame passes *by construction*, and would
be the correct test only if the preview were cross-origin.

**Remediation, one attribute:** `sandbox="allow-scripts"` on the preview iframe — deliberately **without**
`allow-same-origin`, giving the frame an opaque origin. It loses `wickrweb://` and parent-DOM access, the
existing `postMessage` channel keeps working, and the containment holds for future parser bugs too.

**NOT VERIFIED:** which routes return data to any caller without a further native authorisation check, and
which HTTP methods each accepts. The table proves the URL space the origin is permitted to address.

---

## 4. Finding 18 — a developer API console is compiled into the production binary (VERIFIED)

The resource bundle contains exactly three HTML resources — `index.html`, `file-preview.html` and
**`wickr.html`** — and the executable embeds exactly one HTML document that is neither of the first two:
**97,645 bytes** at file offset `0x031d664d`. It is a developer console that exercises **37 distinct
`wickrweb://` endpoints** and **36 `uiAction` bridge actions**, e.g.:

```html
<button onclick="runJson(`wickrweb://awscredentials`, {})">AWS Credentials</button>
<button onclick="run(`wickrweb://file/savedfile/d110b16f-…`)">Download Saved File Data</button>
<button onclick="runJson(`wickrweb://convo/getTdfTags`, {'description' : 'SECRET relto FAKE'})">TDF Tags</button>
```

It also carries test-account addresses (`nemo@mailinator.com`, `nightwing@mailinator.com`) and
real-shaped conversation, message, file and user-hash identifiers. The presence of `runJson(url, {...})`
shows the scheme also serves **request-body-carrying operations**, not only reads.

**Reported as hardening** (debug artefact and test identifiers in a production build). It is also the
cleanest corroboration of §3, being the vendor's own enumeration of that surface.

---

## 5. Upgrade to Finding 10 — the delivery path for the script-free subset is "send an image" (MEASURED)

F10 established that the bundled Chromium was frozen on 2025-08-12 and is missing 77 CVE backports Qt has
since landed on the same branch. Its weakest point was that no delivery path had been shown for the
subset that needs no attacker script. **That path is the ordinary image attachment.**

1. The client gates on the **declared** mimetype (`image/png|jpeg|jpg|bmp|gif|webp`).
2. `ConvoMessageImageContent` renders it as `<img src="wickrweb://image/message/:convoId/:msgId">` with
   `loading="lazy"` — **in the main, bridge-bearing frame**, not the preview iframe.
3. Decoding therefore happens **when the message scrolls into view**: no click, no "open", no preview.
4. Blink selects the decoder by **content sniffing**, not by the declared type, so the **sender chooses
   the decoder**.

Measured decoder inventory and versions in the shipped `Qt6WebEngineCore.dll`:

| registered | implementation |
|---|---|
| `image/png`, `image/apng` | **libpng 1.6.43** — the version string sits inside libpng's own string block, adjacent to `Potential overflow in png_zalloc()` and `Application built with libpng-` |
| `image/jpeg` | **libjpeg-turbo 2.1.5.1** |
| `image/webp` | present (`RIFF`/`WEBP`/`VP8L`/`VP8X`) |
| **`image/avif`** | **present** (`av01` ×21) |
| `image/gif`, `image/bmp`, `image/x-icon` | present |

**The concrete statement for the report:** the PNG decoder any peer's image reaches with no user
interaction is **libpng 1.6.43**, while the vendor's own `130-based` branch has since moved it to
**1.6.55**.

---

## 6. ✗ Corrections

### 6.1 Withdrawn — the "unvalidated URI to the Windows shell" item

A draft of this work claimed that a hyperlink in a received document reaches `ShellExecuteW` unvalidated.
**It is withdrawn.** The application does validate: `EnvironmentMgr::isURLDenied()` is called from the QML
action dispatcher before the native open, and in an in-product test it denied `file:`, a loopback UNC path
and `search-ms:` while allowing `https:`.

Two mistakes produced it, and both are worth stating because they are procedural: **(a)** a call path was
**inferred** ("only two `QDesktopServices::openUrl` call sites exist and the other is the `mailto:`
builder") rather than traced — in fact that action is not a `Q_INVOKABLE` at all but travels as
`sendAction({action:'openLink'})` into compiled QML; **(b)** "a grep of the whole web source for a scheme
allow-list returns nothing" was true and irrelevant, because the check is not in the web source.

What survives is only a defence-in-depth remark: the JavaScript layer validates nothing of its own, and a
single QML branch is the entire defence.

### 6.2 Corrected — §3b of the W16 addendum over-stated reachability

§3b named `CVE-2025-48174`, `CVE-2025-48175` (libavif) and the libpng bumps as reachable without attacker
script. **Checked against what the code actually does on the image path of §5:**

| CVE | where the defect lives | reachable from an `<img>` decode? |
|---|---|---|
| CVE-2025-48174 | `makeRoom`, `stream.c` — `avifRWStream`, the read-write/mux stream | **No** — encode/mux side |
| CVE-2025-48175 | `avifImageRGBToYUV`, `reformat.c` — RGB→YUV | **No** — encode direction |
| CVE-2025-65018 | `png_image_finish_read` — libpng's **simplified API** | **Very likely no** — Blink drives the low-level progressive API |
| CVE-2025-66293 | `png_image_read_composite` — simplified API | **Very likely no**, same reason |
| CVE-2025-64720 | introduced in libpng 1.6.51 | **N/A** — shipped build predates it |

§3b classified by *which files a backport touched*, without checking whether the touched function lies on
the path a browser decode takes. **We claim no exploitable CVE on this surface.** The remaining backports
in components the renderer does exercise were not examined for decode-path reachability.

---

## 7. Summary

| # | finding | evidence | impact |
|---|---|---|---|
| **F13** | TLS certificate errors accepted unconditionally on both WebEngine views, covering subresources and other origins | **MEASURED**, A/B against the shipped Qt | network interception of all HTTPS the views perform, without warning |
| **F14** | all WebEngine feature permissions granted to any origin silently, in the bridge-bearing frame | VERIFIED (shipped QML) | hardening; multiplier on the reported XSS (camera/mic/screen/clipboard without prompt) |
| **F17** | untrusted-document preview is same-origin and unsandboxed, sharing the origin authorised for the private `wickrweb://` API | VERIFIED (application source + native router table) | a parser compromise is not contained; one-attribute fix |
| **F18** | 97,645-byte developer API console and test identifiers compiled into the production binary | VERIFIED (extracted) | hardening |
| **F10+** | the script-free renderer surface is reached by an ordinary image attachment, decoded in the main frame with no interaction; decoders at libpng 1.6.43 / libjpeg-turbo 2.1.5.1 | MEASURED | delivery path for the dependency-currency finding |
| — | *withdrawn:* URI to the Windows shell | — | the client does validate (§6.1) |

**No code execution is claimed anywhere in this addendum.**
