# W17c — three defects in the QML WebEngineView configuration

**Date:** 2026-08-04 **Target:** AWS Wickr Desktop 6.72.20.0 (Windows x64)
**Source:** `scratch/w16/qrc/blob_030a2bec.js` — the shipped QML that creates both WebEngine views.
This file is **QML source, shipped in the qrc**, so these three items are read directly off the
product's own code. No call-path inference is involved in F13 or F14.

> **Verification discipline after the F12 withdrawal:** for each item below, "VERIFIED" means the
> statement is read off shipped source or measured. Anything I have not traced end to end is marked
> **NOT VERIFIED** and no impact is claimed on it.

---

## F13 — TLS certificate errors are accepted unconditionally, on both WebEngine views

**VERIFIED (shipped QML source).** Both views carry the same handler:

```qml
WebEngineView {                      // id: webview -- the main UI view, has the bridge
    onCertificateError: function(error) {
        error.acceptCertificate();
    }
```

```qml
Component { id: webAppComponent
    WebEngineView {                  // the per-conversation "WebApp" view
        onCertificateError: function(error) {
            error.acceptCertificate();
        }
```

**No condition, no origin test, no error-class test, no logging, no user prompt.** In Qt's own
`certificateError` contract, not calling `acceptCertificate()` aborts the load; calling it
unconditionally is equivalent to disabling certificate validation for everything that view loads.

**Why it has reach even though the main document is local.** `wickrSettings.webViewAddress` defaults to
**`qrc:/index.html`** (recovered from the settings string pool in `WickrPro.exe`), so the main document
is bundled. But that document's own CSP shows what it then loads over the network:

```
connect-src 'self' wickrweb://* https://bedrock-runtime.<region>.amazonaws.com
                                https://bedrock-agent.<region>.amazonaws.com
                                https://bedrock-agent-runtime.<region>.amazonaws.com   (× ~35 regions)
img-src     'self' https://tile.googleapis.com wickrweb://* blob: data:
frame-src   'self' blob: https://fast.com/ https://main.d4zeeqgazhley.amplifyapp.com/
```

So the AI/Bedrock API traffic, the Google Maps tile requests (which carry the API key retrieved via
`bridge.getGoogleMapsApiInfo()`), and the two allow-listed iframes all traverse this view.

### MEASURED against the shipped Qt — the handler covers subresources and other origins

`scratch/w17/certprobe.c` builds a `WebEngineView` with the shipped `Qt6WebEngineQuick`, in two
variants: **`accept`** installs Wickr's handler verbatim, **`control`** installs none. It loads
`https://127.0.0.1:8443` (self-signed cert A). That document pulls an image, an iframe and a
cross-origin `fetch()` from **`https://127.0.0.2:8444` — a different origin with a different
self-signed certificate**, which the view never navigates to. Splitting the origins matters because
Chromium caches a certificate exception per host. Both servers log every request (`scratch/w17/tls/`).

```
control  (no handler)                       requests reaching either server:  NONE
accept   (Wickr's handler, verbatim)
    [A] GET /main                      <- document over an invalid certificate: LOADED
    [A] GET /beacon/document-loaded    <- its script RAN
    [B] GET /beacon/cross-origin-fetch <- cross-origin fetch() to the 2nd bad cert: SUCCEEDED
    [B] GET /sub-img.png               <- subresource image from the 2nd bad cert: LOADED
    [B] GET /sub-frame
    [B] GET /beacon/subframe-loaded    <- iframe from the 2nd bad cert: LOADED AND EXECUTED SCRIPT
```

**So the earlier "NOT VERIFIED" is now settled, and in the worse direction:** the handler is not limited
to the navigated document. Navigations, images, subframes and cross-origin `fetch()` all proceed, for an
origin the user never visited, carrying a certificate signed by nobody. **No warning is shown, because
the application suppresses the one Qt would have raised.**

**Consequence, stated to the measurement:** anyone able to intercept the client's network traffic can
transparently substitute content for every HTTPS endpoint the WebEngine views talk to. Per the main
view's own CSP that includes the **AWS Bedrock API endpoints** the AI features call and the
**`tile.googleapis.com`** requests, which carry the Maps API key obtained from
`bridge.getGoogleMapsApiInfo()`. It also includes the two external origins in `frame-src`
(`fast.com`, `main.d4zeeqgazhley.amplifyapp.com`), whose content an interceptor could therefore choose.

**Still not determined:** whether Qt marks any error class non-overridable in this build such that
`acceptCertificate()` would be refused. The two error classes exercised here — unknown issuer and name
mismatch — were both accepted.

**Remediation:** accept only the specific, expected pinned error cases, or drop the handler entirely so
Qt's default (abort) applies.

---

## F14 — every WebEngine feature permission is granted to every origin, without a prompt

**VERIFIED (shipped QML source).** On the **main** view — the one with `webChannel: channel`, i.e. the
frame that holds the bridge:

```qml
onFeaturePermissionRequested: function(securityOrigin, feature) {
    console.log("granting permissions", securityOrigin, feature)
    grantFeaturePermission(securityOrigin, feature, true);
}
```

`securityOrigin` and `feature` are **logged and then ignored**. In Qt 6 the `WebEngineView.Feature`
enumeration covers `Geolocation`, `MediaAudioCapture`, `MediaVideoCapture`, `MediaAudioVideoCapture`,
`DesktopVideoCapture`, `DesktopAudioVideoCapture` and `Notifications`. **All of them are granted to any
origin that asks, silently.**

The same view also sets:

```qml
settings.javascriptCanAccessClipboard: true
settings.javascriptCanPaste: true
```

**Why this matters, stated carefully.** On its own this is a hardening defect: the client has removed the
consent step that Qt provides. It becomes materially worse in combination with **script execution in that
view**, which the operator has already demonstrated and reported (the HTML-injection → XSS chain). Script
in the main view can call `getUserMedia({video:true,audio:true})` or `getDisplayMedia()` and be **granted
without any prompt**, and can read the clipboard. That is a **severity multiplier on the existing
report**, not an independent exploit, and should be offered as such.

Note also that `frame-src` allow-lists two external origins (`fast.com`,
`main.d4zeeqgazhley.amplifyapp.com`) which are loaded by the `CheckSpeedModal`
(`src/components/Modals/CheckSpeed/index.tsx:27`). Frames from those origins inherit this same
permission handler.

**The `webAppComponent` view does NOT install this handler**, so it keeps Qt's default behaviour.

**Remediation:** grant only the features the application actually needs, only to its own origin, and let
Qt deny everything else.

---

## ✗ F15 — DROPPED, not reportable

**`isBeta` is a build-channel flag the user cannot turn on**, so this path does not exist in any build a
victim could be running. Recorded below only as a code observation; **do not report it, and do not count
it among the findings.** The certificate defect (F13) applies to this view too, but F13 stands on the
main view regardless.

### (code observation only) a peer-supplied link URL reaches `WebEngineView.url` unvalidated

`src/components/Convo/ConvoMessageLinkContent.tsx:126-152` — a menu item on a received link card:

```tsx
{isBeta && link.url && (
  <PopOverItem onClick={() => {
      navigate(generateChatRoute.convo(vgroupId, 'webApp'));
      dispatch(configureWebApp({ id: vgroupId, visible: false, x: 0, y: 0, width: 0, height: 0 }));
      dispatch(webAppLoadUrl({ id: vgroupId, url: link.url }));   // link.url is the peer's
      dispatch(setConvoWebAppLoaded({ vgroupId, loaded: true }));
  }}>Open Link in WebApp (Beta)</PopOverItem>
)}
```

**VERIFIED — both QML layers are pure pass-throughs, no validation:**

```qml
// blob_031ef4e0.js:2123
function webAppLoadUrl(id, url) { webViewLoader.item.externalWebView.webAppLoadUrl(id, url) }

// blob_030a2bec.js:205
function webAppLoadUrl(id, url) {
    var webView = webApps[id]
    if (webView) { webView.url = url }
}
```

**NOT VERIFIED:** `WebChannelMessageBridge::webAppLoadUrl` — the C++ method between the web layer and the
QML (it is in the moc method table of `WebChannelMessageBridge`, alongside `configureWebApp` and
`removeWebApp`). **It was not disassembled, so it is not established that no validation happens there.**
This is exactly the link whose equivalent I got wrong in F12, and I am not repeating that.

**Gating, stated plainly:** `isBeta` is a **build-channel setting** read from native
(`WickrSettingsWebChannelAdapter.ts:21`), not something a peer can set, so this menu item does not exist
in production builds. The victim must also open the link card's menu and choose the item. **Severity is
correspondingly low; the value of the item is that the code path exists and validates nothing.**

**What the view is, and is not:** `webAppComponent` sets `profile.offTheRecord: true` and
`persistentCookiesPolicy: NoPersistentCookies`, and — importantly — **does not set `webChannel`**, so the
attacker's page does **not** get the bridge. It is a browser tab, not a bridge exposure. It does,
however, inherit **F13** (any certificate accepted).

---

## Summary

| # | claim | evidence | status |
|---|---|---|---|
| **F13** | certificate errors accepted unconditionally on both views | shipped QML read directly | **VERIFIED**; subresource scope NOT verified |
| **F14** | all feature permissions granted to all origins, silently, in the bridge-bearing view | shipped QML read directly | **VERIFIED**; impact framed as a multiplier on the reported XSS |
| ~~F15~~ | ~~peer link URL → `WebEngineView.url`~~ | — | **DROPPED — `isBeta` is a build channel the user cannot enable; not reportable** |

**No code execution is claimed by any of these.**
