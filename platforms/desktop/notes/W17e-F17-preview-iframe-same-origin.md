# W17e — F17: the untrusted-document preview runs same-origin and unsandboxed, next to a privileged local API

**Date:** 2026-08-04 **Target:** AWS Wickr Desktop 6.72.20.0 (Windows x64)
**Evidence:** application source recovered from the shipped source maps (`scratch/w17/src/`).
**No inference about native call paths is involved.**

This is **not** the HTML-injection issue already reported. It is the reason that issue is severe, and it
has its own one-line remediation. It would be reported as an architectural finding: *the boundary that
should contain a document-parser compromise does not exist.*

---

## 1. The preview iframe is same-origin and carries no `sandbox` attribute

`src/components/Modals/FilePreviewModal/index.tsx`:

```tsx
const FILE_PREVIEW_URL = 'file-preview.html';          // line 30 -- RELATIVE, therefore same-origin
…
const previewUrl = `${FILE_PREVIEW_URL}#${urlParams.toString()}`;
…
<iframe src={previewUrl} />                            // line 134 -- no sandbox attribute
```

**`grep -rn "sandbox" src/` over the entire recovered application source returns nothing.** The attribute
is not used anywhere in the product.

Inside that iframe the client runs third-party parsers over attacker-supplied bytes: `docx-preview`,
`pptx2html` + `fast-xml-parser`, `pdfjs-dist`, `@e965/xlsx`, `DOMPurify`, plus the XML/text/RTF
renderers. Any of them yielding script execution — which the operator has already demonstrated and
reported through the docx path — yields it **in the application's own origin**.

## 2. What that origin can reach: the complete internal API

`src/apis/webFetch/endpoints.ts` defines the client's private API, served over the custom
`wickrweb://` scheme, and the app's CSP explicitly permits it: `connect-src 'self' wickrweb://*`.

The full route table (verbatim from `fetchRoutes`), grouped by what it exposes:

| exposure | routes |
|---|---|
| **credentials** | `/awsCredentials` |
| **account control** | `/myaccount/password`, `/myaccount/leavenetwork` |
| **network administration** | `/admin/controls`, `/admin/inviteuser` |
| **all conversation content** | `/message/:convoId`, `/message/:convoId/:msgId`, `/message/:convoId/:msgId/:before/:after`, `/convo/:convoId`, `/convo/:convoId/roomHistory`, `/search` |
| **files** | `/file/message/:convoId/:msgId`, `/file/savedfile/:guid`, `/filemanager/:convoId`, `/filemanager/:convoId/savedlinks`, … |
| **identity / directory** | `/contacts/contacts`, `/contacts/directory`, `/contacts/search`, `/users/self`, `/users/id/:userId`, `/users/idHash/:userHash`, `/users/blocked` |
| **security state** | `/devices/active`, `/verification/fingerprints/:userId` |
| media | `/image/message/:convoId/:msgId`, `/audio/message/:convoId/:msgId`, `/image/user/:userId` |

**So a parser compromise inside the preview is not confined to the preview.** It can read the message
archive, the contact directory, stored files, the active-device list and the verification fingerprints,
and it can reach the administrative and credential endpoints — because it shares the origin that is
authorised to call them.

## 2a. The inventory is corroborated by Wickr's own shipped code — and by a shipped debug console (F18)

Two independent confirmations, so §2 does not rest on the JavaScript route table alone.

**The native router's own segment table** (`WickrPro.exe` @ `0xe35600`, alongside the class's log strings
`WebViewRouter: …` / `WebViewRouter::runMessageHost - …`):

```
image | audio | file | message | users | convo | convolist | filemanager | search |
devices | contacts | chimetoken | verification | myaccount | admin | awscredentials
```

Note **`chimetoken`**, which does **not** appear in the web route table — an additional token endpoint on
the same origin-authorised surface.

**F18 — a developer API console is compiled into the shipped production binary.** The qrc contains
exactly three HTML resources — `index.html`, `file-preview.html` and **`wickr.html`** — and the binary
carries exactly one embedded HTML document that is neither of the first two: **97,645 bytes at
`0x031d664d`**, extracted to `scratch/w17/shipped-debug-console.html`. It exercises **37 distinct
`wickrweb://` endpoints** and **36 `uiAction` actions**, in Wickr's own words:

```html
<button onclick="runJson(`wickrweb://awscredentials`, {})">AWS Credentials</button>
<button onclick="run(`wickrweb://file/savedfile/d110b16f-5e56-4b02-bbbd-877c25bf7ca8`)">Download Saved File Data</button>
<button onclick="runJson(`wickrweb://convo/getTdfTags`, {'description' : 'SECRET relto FAKE'})">TDF Tags</button>
```

Among the 37: `awscredentials`, `chimetoken`, `admin/controls`, `admin/inviteuser`, `myaccount/password`,
`myaccount/leavenetwork`, `devices/active`, `verification/fingerprints/…`, `contacts/directory`,
`search`, `file/savedfile/…`. The presence of **`runJson(url, {...})`** shows the scheme also serves
**request-body-carrying (write) operations**, not just reads.

The page additionally contains test-account addresses (`nemo@mailinator.com`, `nightwing@mailinator.com`)
and real-shaped vgroup / message / file / user-hash identifiers.

**Reportable as hardening on its own** (a debug console and test identifiers left in a production build),
and it is the cleanest possible evidence for §2, since it is the vendor's own enumeration of the surface.
It lives in the same `qrc` origin as the app, so it is addressable from any script in that origin, and
the main view's URL is a setting (`webViewAddress`, default `qrc:/index.html`).

## 3. Why this is a finding in its own right

The application already treats the preview as a separate surface: it is a separate HTML document, a
separate Vite entry point, its own bundle, and it communicates with the parent by `postMessage` rather
than direct DOM access. **Every part of the isolation design is present except the part that enforces
it.** Serving it from a relative URL puts it in the same origin, and omitting `sandbox` leaves it with
full same-origin privileges — so the `postMessage` channel is decoration, not a boundary.

The `postMessage` receiver reflects the same misunderstanding
(`FilePreviewModal/index.tsx:100`): `event.origin === window.parent.origin` — a test the preview frame
passes **by construction**, and which would be the correct test only if the preview had a different
origin.

## 4. Remediation

Either is sufficient and both are small:

* add `sandbox="allow-scripts"` to the preview iframe — deliberately **without** `allow-same-origin`, so
  the frame gets an opaque origin, loses access to `wickrweb://` and to the parent DOM, and the existing
  `postMessage` channel keeps working (with `event.origin === 'null'` as the correct check); or
* serve `file-preview.html` from a distinct scheme/host so it is cross-origin, and keep the CSP for that
  origin free of `wickrweb://`.

## 5. Verification status

**VERIFIED, source read directly:** the relative `FILE_PREVIEW_URL`; the absence of `sandbox` anywhere
in the application; the route table; the `connect-src 'self' wickrweb://*` directive in both shipped
HTML entry points; the vacuous origin test.

**NOT VERIFIED:** that every route above is reachable without an additional native-side authorisation
check, and the HTTP methods each accepts. The route table proves the URL space the origin is permitted
to address, not that each returns data to any caller. **Before reporting, either measure a couple of
representative endpoints from the preview origin, or state the finding as "the preview shares the origin
authorised for `wickrweb://`" rather than enumerating what each endpoint returns.**

**Relationship to the reported HTML-injection chain:** this is the container defect, not the injection.
It should be offered as *"and here is why that injection reaches everything"*, with the sandbox
attribute as the fix that limits it regardless of future parser bugs.
