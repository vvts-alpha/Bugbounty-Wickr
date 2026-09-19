# W17g — a non-docx path to an arbitrary URL in an embedded WebView

> ## ✗ WITHDRAWN 2026-08-04 — the chain does not hold. P1 is unreachable; P2 is not web-triggerable.
>
> A 25-agent verification run (1,290 tool calls) traced every link on the shipped binary. **Links 2–6
> below are all correct — and all unreachable.**
>
> **P1 breaks between step 1 and step 2: the URL arrives and nothing is listening.** The
> `install-config/info` matcher is connected only on the `clientType == 2` branch:
>
> ```
> 0x140046b1c  cmp dword ptr [rip+0x3452451], 2      ; clientType  (global 0x143498f74)
> 0x140046b23  jne 0x140046b7a
> 0x140046b4d    call 0x140ae7d90                    ; the ONLY caller that wires the
>                                                    ; install-config matcher (0x140aea7a0)
> 0x140046b7a  cmp dword ptr [rip+0x34523f3], 1
> 0x140046bab    call 0x140ae4710                    ; clientType==1 connects 0x140ae5290 instead
> ```
>
> `0x140ae5290` (385 bytes, read in full) performs `QUrl` component extraction and then exactly **two**
> `compare_helper` calls — `"register"` (`0x14328a3e0`) and `"bedrock-auth"` (`0x14328a3f0`). There is no
> third comparison and no reference to `"install-config/info"`.
>
> **The decisive argument is self-consistency, and it does not depend on reading a `.data` initialiser.**
> Scheme registration sits behind the *same* switch (`0x140aecb97 cmp [0x143498f74], 2`):
> `clientType == 2` registers `wickrent` / `wickrentbeta` / `wickrentalpha`; `clientType == 1` registers
> the `wickrpro` family. **The operator's own confirmed artefact — `HKCU\Software\Classes\wickrpro` with
> command `WickrPro.exe "%1"` — is therefore positive evidence from the installed system that this build
> runs `clientType == 1`, i.e. exactly the branch where the enterprise flow is not connected.** In the
> only mode where `install-config/info` is honoured, the scheme is not `wickrpro`. **The chain's premise
> and its payload are mutually exclusive.**
>
> **P2 also fails, for a different reason that must not be conflated with a second working route.** Its
> C++ path is clean and drew zero refutations, but the attacker's control point is the **base URL** that
> `/getOpenIdConnectInfo.php` is appended to — and taking that over requires link 3, which requires the
> deep link, which is gated. **P2's precondition is P1's payload.** The typed Company ID is
> `network_identifier` in a POST body, not a hostname, and a web page can cause neither a user to type one
> nor a stored-`ssoNetworkId` reauth.
>
> **What genuinely survives, at its real size:** a Wickr **network administrator** can set `issuer` to any
> host; the client fetches `<issuer>/.well-known/openid-configuration` and loads `authorization_endpoint`
> verbatim in the embedded off-the-record WebEngineView, with validation only
> `issuer.length()>0 && clientId.length()>0` (`0x140abf131`), and the same server chooses embedded-view vs
> system browser via `useExternalBrowser` (workflow `+0x1f1`, branch `0x140ad544f`). **That is
> admin-controlled server-supplied URL loading inside an already-trusted relationship — a trust-boundary
> observation, not a remote attack.**
>
> **The one unresolved route back, and it is cheap and local:** the ctor writes `clientType` *before*
> `0x1408d3cbb call 0x1409d6500` parses argv, so `--clientType wickrEnterprise` on the command line would
> flip the gate — and the matcher is **scheme-blind** (RemoveScheme is set), so a `wickrpro://` URL would
> then still match. It requires smuggling an unencoded quote+space past ShellExecute's quoted `%1`
> substitution. Browsers normally percent-encode `"` and space, and `%1` does not decode percent-escapes,
> so this is **unlikely but not impossible. Untested. Do not assert it either way.**
>
> **New surface this exposed, untraced:** `wickrpro://register…` and `wickrpro://bedrock-auth…` **are**
> web-reachable in the shipped build. `bedrock-auth` is the Cognito OAuth redirect handler, whose
> `handleAuthCallback` reads only `code` with no visible `state` check.
>
> ---
>
> ## Original text, retained to show what was claimed and why it was wrong

**Date:** 2026-08-04 **Target:** AWS Wickr Desktop 6.72.20.0 (Windows x64)
**Goal addressed:** identify an end-to-end path, other than the reported docx HTML injection, that
reaches an **arbitrary-URL iframe or an arbitrary-URL WebView**.

**Answer: yes — the SSO/OIDC login WebView, which is a real `WebEngineView` and therefore not bound by
the application CSP's `frame-src`.** Two ways to steer it are set out below. Neither involves docx, HTML
injection, or script execution.

> **Verification discipline.** Every line marked VERIFIED is read off shipped code, shipped strings, or
> this machine's registry. Anything I have not traced is marked NOT VERIFIED and nothing is claimed on
> it. This matters after the F12 withdrawal, where an inferred call path was stated as fact.

---

## 1. The sink: a full browser view with an address bar

Shipped QML (uncompressed inside `WickrPro.exe` at `0x0306d5e2`) — **VERIFIED**:

```qml
Rectangle {
    property alias url: webView.url
    property bool showURL: true
    TextField { id: textField; readOnly: true; selectByMouse: true
                text: webviewLoader.item ? webviewLoader.item.url : "" }   // an address bar
    WebEngineView {
        id: webView
        url: webviewUrl                                   // <- set from C++ as a context property
        profile.offTheRecord: true
        profile.persistentCookiesPolicy: WebEngineProfile.NoPersistentCookies
        Component.onCompleted: { settings.focusOnNavigationEnabled = true; settings.webGLEnabled = false }
        onCertificateError: function(error) {
            if (error.type === WebEngineCertificateError.CertificateAuthorityInvalid) {
                error.defer(); sslDialog.enqueue(error);   // NOTE: stricter than the F13 views
            }
        }
        onSelectClientCertificate: …                       // will offer the user's client certificates
        onLoadingChanged: …                                // captures the <scheme>://oidc redirect
    }
}
```

Two things to note. This view **prompts** on a CA-invalid certificate, unlike the two views in F13 —
so the same product contains both the correct and the incorrect handling. And it handles
`onSelectClientCertificate`, i.e. it will offer the machine's **client certificates** to whatever host
it is pointed at.

## 2. What decides the URL: the network's OIDC configuration

**VERIFIED** — the SSO configuration fields, from the config-parsing string pool:

```
issuer | clientId | clientSecret | redirect | scopes | usernameField | useExternalBrowser | extraAuthParams
network_identifier | regtoken | oidc.php/
```

and the discovery step:

```
/.well-known/openid-configuration
: Issuer Discovery Endpoint =
scopes_supported | authorization_endpoint | token_endpoint
Invalid Company ID
```

So the client takes `issuer` from the network's SSO configuration, fetches
`<issuer>/.well-known/openid-configuration`, reads **`authorization_endpoint`**, and that is the URL the
login view is pointed at. `useExternalBrowser` decides whether it goes to the system browser instead —
and it is **a field of the same attacker-supplied configuration**, so an attacker would simply set it
false to keep the page inside the embedded view.

**VERIFIED** — `/getOpenIdConnectInfo.php` is a **relative** path in the client's endpoint table,
alongside `/getNetworkConfig`, `/provisionUser.php`, `/joinNetwork.php` and the rest. It therefore hangs
off the configured base URL, not off a fixed host.

## 3. Path P1 — from a web page, via the registered URL scheme

**VERIFIED (registry on this machine):**

```
HKCU\Software\Classes\wickrpro     URL Protocol = (present)
    shell\open\command = "…\AWS Wickr\WickrPro.exe" "%1"
```

So **any page in the victim's ordinary browser can hand a URL to WickrPro.exe** by navigating to
`wickrpro://…`. `wickrpro` is this build's scheme — **VERIFIED** from the per-variant table
(`wickrproalpha | wickrpro | wickrprobeta | wickrprogamma | wickrentbeta | awswickrgov | …`).

**VERIFIED** — the client has deep-link handlers: `slotDeepLinkHandler(url)` appears on both
`WickrSaasFlow` and `WickrEnterpriseFlow`, with the log line
`*******slotDeepLinkHandler URL:::type … URL: …`. Known actions: `sso-verify`, `oidc`,
`forgotpassword`, plus two `/info` endpoints — **`install-config/info`** and, in the AI feature,
`bedrock-auth/info` (`src/lib/awsAuth/config.ts` has `redirectUri: 'wickrprobeta://bedrock-auth/info'`).

**VERIFIED** — the `install-config` deep link is parsed into a **service host and a token**:

```
DEEP LINK RECEIVED: failed to parse deeplink - serviceHost = …, token = …
token | cert | path | woaV1Config | woaV1CipherConfig | SponsorId
```

**VERIFIED** — the configuration it then retrieves defines the client's base URL *and its own transport
security*:

```
loadBootStrapJson::  usernameMode | requireEmailVerification | userManagedCredentials |
                     serviceHost -> "*** BASE URL" | serviceSSLKeys -> "CERTS:" |
                     "LOAD NETWORK CONFIG (bootstrap): SSL certificate pinning is ENABLED|DISABLED" |
                     serviceRegKeys | regToken | "SSO CONFIG: disabled from config." |
                     baseURL | certs | networkToken | emailAsUserId | DefaultBaseURL
```

**The chain:**

1. Victim opens any web page, which navigates to `wickrpro://install-config/info?…`.
2. Windows launches/activates WickrPro.exe with that URL.
3. The client retrieves a network configuration from the **host named in the deep link**.
4. That configuration sets the client's **base URL** — and carries its own certificate-pinning material,
   so the pinning that would otherwise protect the fetch is defined by the same party.
5. SSO then queries `/getOpenIdConnectInfo.php` **against that base URL**, i.e. the attacker's server,
   which returns an `issuer` of the attacker's choosing.
6. The client discovers `<issuer>/.well-known/openid-configuration`, reads `authorization_endpoint`, and
   **loads it in the WebEngineView of §1**.

**VERIFIED precondition, and it is a real limit:** the deep link is refused once the client is
provisioned —

```
DEEP LINK IGNORED: registration already in progress.
DEEP LINK IGNORED: user already registered and/or logged in.
```

so P1 applies to a **fresh install, a logged-out client, or a re-provisioning device**, not to a
signed-in user.

## 4. Path P2 — no deep link, no logged-out state

The same sink is reachable through the ordinary SSO login: the victim enters a **Company ID**
(`network_identifier`), the client asks Wickr's own server for that network's OIDC information, and
whatever `issuer` that network's administrator configured is discovered and loaded in the WebView.

**Anyone who controls a Wickr network's SSO configuration therefore controls a URL that a victim's
client will load in an embedded WebView** — one that also offers client certificates (§1). The victim
interaction is entering a Company ID, which is exactly what a phishing page or email asks for.

P2 needs no deep link and no unprovisioned state; P1 needs no user typing. They are complementary.

## 5. NOT VERIFIED — state these as open when reporting

* **The deep-link URL grammar — now partly closed.** `install-config/info` occurs exactly once in the
  binary, inside `WickrEnterpriseFlow`'s string pool immediately after its enterprise-config slots
  (`slotGetEnterpriseConfigWithPassword`, `slotResetEnterpriseConfig`,
  `slotEnterpriseComplianceAgreement`) and immediately before the bootstrap-file strings. Together with
  the AI feature's `redirectUri: 'wickrprobeta://bedrock-auth/info'`, the action grammar is
  **`<scheme>://<action>/info`**, so the enterprise-config deep link is
  **`wickrpro://install-config/info…`**. **Still not traced:** whether `serviceHost`, `token`, `cert`
  and `path` arrive as query parameters or as path segments, so a literal PoC URL cannot yet be written.
* **That `webviewUrl` is assigned the discovered `authorization_endpoint`.** The QML binds
  `url: webviewUrl` and the OIDC flow discovers `authorization_endpoint`; the C++ that sets the context
  property was **not** read. This is the same shape of gap that produced the F12 withdrawal and must not
  be asserted.
* **Whether an attacker-supplied configuration may set `serviceSSLKeys`/pinning to a value of its
  choosing**, as opposed to the client rejecting unpinned configs.
* **Whether P1 requires user confirmation** anywhere between the deep link and the config fetch —
  `showEnterpriseNetworkConfigScreen` exists, so a screen may be shown.

## 6. Why this answers the goal, and how it differs from what is already reported

* It is **not** the docx path: no document, no HTML injection, no script.
* The sink is a **native `WebEngineView`**, so the application CSP's
  `frame-src 'self' blob: fast.com main.d4zeeqgazhley.amplifyapp.com` — which confines every in-page
  iframe — **does not apply**. That is precisely why this is the way to an *arbitrary* URL.
* The entry point for P1 is a **registered OS URL scheme**, i.e. reachable from an ordinary web page.

**Nothing here was executed against the product, and no code execution is claimed.** The next step to
make P1 concrete is to determine the deep-link grammar and confirm the `webviewUrl` assignment — both
static work on `WickrPro.exe`.
