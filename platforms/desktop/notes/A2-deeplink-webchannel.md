# A2 — `wickrpro://` deep links + QWebChannel `WebChannelMessageBridge`

**Verdict: NEGATIVE (no win) on both vectors, with precise blockers.** Established via static RE
(rizin/capstone + qrc carve) **and** runtime observation (frida on live PID + app logs). Honest
negative — nothing here reaches victim code-exec / navigation-to-attacker-content / forced-auth /
injection from the stated attacker position on this stock install. Residual hardening gaps + one
weak/UNCONFIRMED lead documented at the end.

Binary: `E:\tmp\wickr\main\WickrPro.exe` (preferred base `0x140000000`). Runtime confirmations against
live WickrPro (auto-unlocked, logged in as `vvtsbugbounry1337@gmail.com`).

---

## Architecture recovered (the decisive facts)

The chat UI is a bundled **React/Vite SPA** ("WickrWeb"), plus an embedded **SocialCalc/SheetJS**
spreadsheet engine and per-filetype **file-preview** apps (incl. `PowerPointPreview` = pptx2html).
All are shipped as `qrc:/` resources inside the exe (carved: `index.html`, `preloads.js`, 174 zlib
JS/QML chunks → `…/scratchpad/qrc/`).

**Exactly one** WebEngineView carries the native channel. Grep of the whole binary finds a **single**
`webChannel:` assignment (chat view, QML at file `0x30a1000` / carved `blob_030a2bec`). The bridge set
(from production `index.html`, file `0x31d664d`, and QML `channel.registerObject(...)`):
`bridge` (`WebChannelMessageBridge`, 58 Q_INVOKABLE methods), `uiBridge`, `onboardingBridge`,
`wickrSettings`, `serverModel`, `environmentMgr`, `fileManager`. Transport = **in-process
`qt.webChannelTransport`** (NOT a network socket — the `QWebSocketServer`/`ws://127.0.0.1:` in the
binary is the switchboard/calling layer, not the channel).

The bridged chat view loads:
```
url = wickrSettings.webViewAddress      // QML, Component.onCompleted
```
`webViewAddress` **default = `qrc:/index.html`** (QSettings default, file `0x3259a80`). **Runtime-
confirmed** in the live log: `[WickrSettingsSubscriptions] webViewAddressChanged qrc:/index.html` and
`[Preebootstap] App Path: /index.html`. → The bridge is exposed only to **local, trusted** content.

---

## Vector (ii) renderer→native — NEGATIVE

For attacker content to drive the bridge it must obtain JS execution in the chat view's origin, or the
view must navigate to attacker content. All routes are blocked:

1. **CSP on `qrc:/index.html`** (carved `blob_00e46f48`): `script-src 'self' qrc://*` — no
   `unsafe-inline`, no remote. Injected/inline scripts and inline event handlers cannot execute.
2. **DOMPurify 3.2.5** (bundled) sanitizes any HTML; message bodies otherwise render as React-escaped
   elements. Only React `dangerouslySetInnerHTML` sinks are `icon.svg` (trusted) and `sanitizedHtml`
   (= `PowerPointPreview` file-preview output).
3. **No attacker-reachable navigation of the bridged view.** The chat view has **no**
   `onNavigationRequested`/`acceptNavigationRequest` (navigation is unrestricted), BUT: attacker can't
   run JS (CSP) to set `location`; there is no attacker-controlled `location`/`webview.url` assignment
   in the bundle; message "links" render as React `<div>/<span>` with `onClick → dispatch(openLink)`
   (no `href`, no default navigation); file previews run in a **postMessage-isolated child iframe**
   wrapped by `withLinkHandler` which `preventDefault`s anchor clicks and forwards the href to the
   parent via `postMessage({type:'openLink',url},parent.origin)`.
4. **`openLink` → native scheme allowlist (verified in machine code).** Function `0x1409c7950` is a
   prefix allowlist: returns 0 only if the URL starts with `mailto:` / `http://` / `https://`; callers
   (`0x14006f691`, `0x1400f9088`) **skip `QDesktopServices::openUrl` when it returns nonzero**. So
   `file:`, `ms-*`, `javascript:`, UNC, `wickrpro:` etc. are dropped before the openUrl sink
   (`QDesktopServices::openUrl` IAT `0x140d56018`, call sites `0x140072779`, `0x1408d62c2`). Message
   links additionally gate on a Continue confirmation modal (`showConfirmation:true`).
5. **Remote/attacker-content webviews have NO bridge:** the SSO/OIDC `WickrWebEngine` view (loads the
   remote IdP page, off-the-record) has no `webChannel:`; the `webAppComponent` "Wickr apps"/bot views
   (`webAppLoadUrl(id,url)`, arbitrary URL, off-the-record) have no `webChannel:`.

→ Attacker-influenceable content **never** loads while the bridge is registered. Bridge is unreachable
from untrusted content.

## Vector (i) `wickrpro://` deep links (1-click) — NEGATIVE

Handler `"…\WickrPro.exe" "%1"` (HKCU\…\wickrpro, URL Protocol present — verified). Single-instance
forwarding is the **`SingleApplication`** lib (QLocalSocket/QLocalServer named pipe) — local-only, not
web-reachable. Native router = string classifier `0x140ad2b50` mapping the host to
`sso-verify→2`, `forgotpassword→3`, `register`/WOA, else ignored.

Guards (server-secret / state gated), corroborated statically and at runtime:
- **sso-verify**: only acts inside an active SSO flow (`internalGrantRedirectUrl` set) and requires
  `redirect_uuid == grantRedirectUuid` (per-session secret from `getOpenIdConnectInfo.php`); mismatch →
  "Unable to sign in". Deep-link-path `openUrl` calls (`0x140ad548b`, `0x140ae241c`) use server/OIDC-
  derived URLs, not raw deep-link fields.
- **forgotpassword**: same-user check + server `transId`. **Runtime-confirmed block** — firing
  `wickrpro://forgotpassword?...` logged: `Password reset deeplink blocked: different user (last user:
  "vvtsbugbounry1337@gmail.com", deeplink user: "")`.
- **register/WOA**: `DEEP LINK IGNORED: user already registered and/or logged in` when logged in;
  provisions `serviceHost`+`token` only in the logged-out onboarding state (cert-pinned config).

**Runtime (frida on live PID, hooks on classifier `0x140ad2b50` + `openUrlExternally` `0x1408d62a0` +
URL-builder `0x140072620`):** benign probes `wickrpro://sso-verify?redirect_uuid=…`,
`…/forgotpassword?…`, `…/benign-unknown-probe` were classified (ret 2 / 3 / 0) but produced **zero**
calls to any openUrl / navigation / URL-build sink. Forged links with invalid fields go nowhere.

---

## Adversarial refutation
Attacker-reachable pre-auth/default? No — bridge only on `qrc:/index.html`; deep-link guards need
server secrets or the logged-out state. Input attacker-controlled end-to-end? No path from attacker
content to bridge JS-exec (CSP) or to a bridged-view navigation. Default protection blocks it? Yes —
CSP + DOMPurify + scheme allowlist + isolated preview iframe + bridgeless remote views + server-secret
deep-link guards. Observed == WIN? No sink/effect observed. Dup/excluded/2nd-bug? The only full-RCE
scenario (below) needs a local config write = excluded.

## Residual / hardening notes (NOT wins)
- **`webViewAddress` is a mutable QSetting** (`setWebViewAddress`; dev "popcorn override address"). If
  anything an attacker can reach writes it (config/registry/a bridge path — none found), the chat view
  would load remote attacker content **with the full bridge**, and that view also
  `error.ignoreCertificateError()` (ignores TLS errors) and `grantFeaturePermission(...,true)` (auto-
  grants camera/mic/geo). Requires local write ⇒ **excluded** (non-default/local-admin). Defense-in-
  depth: lock `webViewAddress` to `qrc:` in production; add an `onNavigationRequested` allowlist.
- **webApp/bot views** (`webAppLoadUrl`) load arbitrary remote URLs with `error.acceptCertificate()`
  (cert errors ignored) ⇒ trivial **MITM of bot content** (MITM = excluded from wins); no bridge, so no
  escalation.
- **UNCONFIRMED / likely-intended:** a `wickrpro://` register/WOA deep link on a **logged-out** client
  can point it at an attacker `serviceHost` (on-prem onboarding). Only pre-account, victim must
  complete registration against the attacker server, config is cert-pinned — this is the designed
  enterprise-provisioning path. Not executed (would need a fake server; out of RoE). Labeled weak.

## Artifacts
Carved resources: `…/scratchpad/qrc/` (`blob_00e46f48`=prod index.html+CSP, `blob_0198cdb0`=React
bundle+DOMPurify, `blob_030a2bec`=chat/webApp view QML). Frida script + runner:
`…/scratchpad/hook.js`, `…/scratchpad/run_hook.py`. Key offsets: chat-view QML `0x30a1000`; index.html
`0x31d664d`; classifier `0x140ad2b50`; scheme allowlist `0x1409c7950`; openUrl IAT `0x140d56018`.
