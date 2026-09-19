# A1 — Loopback HTTP server (127.0.0.1) — Findings

**Verdict: NEGATIVE (well-scoped). No win on this surface.**
The loopback server is Qt 6.9.2's stock `QOAuthHttpServerReplyHandler` used by Wickr's
`WickrOIDCWorkFlow` as the OIDC/OAuth **authorization-code loopback redirect receiver**
(RFC 8252 native-app flow). Auth code-injection / CSRF / theft are all blocked by a
per-login **CSPRNG `state`** (strictly validated) + **PKCE** + **random port** + **no
CORS-readable secrets**. Verified statically (disasm) and dynamically (frida on the live
process). Even under the most generous attacker model (local unprivileged process with
full loopback reach + response read), the attack still fails at the `state` gate.

---

## 1. Server identity & host binding (definitive)
- Response fingerprint (live): `HTTP/1.0 200 OK ` (trailing space) / `Content-Type: text/html; charset="utf-8"` / body `<html><head><title>Wickr Pro</title></head><body></body></html>`.
- These exact bytes are the response template of **Qt `QOAuthHttpServerReplyHandler`**, present verbatim in `Qt6NetworkAuth.dll` @ paddr **0x2e560** (`HTTP/1.0 200 OK `), 0x2e572 (`charset="utf-8"`), 0x2e540/0x2e528 (`<html><head><title>` / `</title></head><body>`). Body = `<title>` + `qApp->applicationName()` ("Wickr Pro") + callbackText (empty).
- Qt version: **Qt 6.9.2** (WickrPro.exe @ 0x3cb4f0).
- WickrPro.exe imports confirm usage: `QOAuthHttpServerReplyHandler::ctor(QHostAddress,quint16,QObject*)`, `QOAuth2AuthorizationCodeFlow::{ctor,grant,setPkceMethod,resourceOwnerAuthorization}`, `QAbstractOAuth2::setState`, `QAbstractOAuth::{setReplyHandler,setModifyParametersFunction,authorizeWithBrowser}`, `QAbstractOAuthReplyHandler::callbackReceived`.
- Wickr wrapper: `WickrOIDCWorkFlow`, `WickrOIDCRedirectContext`, debug strings `OIDC CONFIG: reply handler created`, `OIDC PKCE (raw/qt): configuring code challenge/verifier`, `code_challenge`, `code_challenge_method`, `code_verifier`.

**Binding / port** — config site WickrPro.exe @ **0x140ad2e71**:
`QHostAddress(SpecialAddress=2 = LocalHost / 127.0.0.1 IPv4)`, and the port argument
`r8d = 0` (`xor r8d,r8d` @ 0x140ad2e60) → **OS-assigned random ephemeral port** (confirms
"random per launch"; observed 59113 this run). `setCallbackText("")` @ 0x140ad2eb9,
`setReplyHandler` @ 0x140ad2f25.

## 2. Endpoint contract & header validation (live, benign probes)
| Request | Result |
|---|---|
| `GET /` , `POST /` (any method to root) | 200 + stub page |
| `GET /?code=X&state=Y` | 200 + stub (query accepted at **root path**) |
| `GET /callback...`, `/index.html`, any non-`/` path | **connection closed, no response** |
| `OPTIONS /` | no response (no CORS preflight support) |
| `Origin: https://evil.example` on `/` | ignored → 200 (no Origin check) |
| `Host: evil.example` on `/` | ignored → 200 (no Host check → DNS-rebind-relevant) |

- Real callback endpoint = **root `/`** (Wickr leaves `callbackPath` empty), NOT `/callback`.
- **No `Access-Control-Allow-Origin`** on any response → cross-origin JS **cannot read** responses. Responses carry **no secrets** (static stub). ⇒ token/code **theft-by-read is impossible**.

## 3. Entry→sink dataflow
`HTTP GET / ?code&state` → `QOAuthHttpServerReplyHandler` parses query → emits
`QAbstractOAuthReplyHandler::callbackReceived(QMap)` (Qt6NetworkAuth RVA 0x3900) →
`QAbstractOAuth2::authorizationCallbackReceived` signal (RVA 0xb7c0, emits meta-idx 19) →
**state-validation slot** (Qt6NetworkAuth `QOAuth2AuthorizationCodeFlow`, fcn @ vaddr
**0x18001b8d0**) → on success `QOAuth2AuthorizationCodeFlow::requestAccessToken(code)`
(token exchange to IdP w/ PKCE `code_verifier`) → `granted` → Wickr stores
`ssoAccessToken/ssoRefreshToken/ssoIdToken` (WickrPro "OIDC STATUS CHANGED: Authenticated"
@ 0x140ad0809, post-exchange only).

## 4. The security gate — `state` validation (Qt 6.9.2, disasm @ 0x18001b8d0)
```
0x18001b8fc  cmp qword [rbp-0x60], 0        ; received state empty/absent?
0x18001b901  jne 0x18001b948               ;   no  -> compare
             ; yes -> warn "Authorization stage: State not received" (0x18002e4f0)
             ;        -> QAbstractOAuth::requestFailed(Error=2)  [REJECT]
0x18001b96d  cmp rcx,r15                    ; expected.len vs received.len ([rdi+0x198])
0x18001b970  jne 0x18001ba50               ; mismatch -> REJECT
0x18001b994  call QtPrivate::equalStrings   ; expected([rdi+0x188]) == received ?
0x18001b99c  je  0x18001ba50               ; not equal -> warn "State mismatch"
                                            ;   (0x18002e518) -> requestFailed  [REJECT]
0x18001ba3f  call QOAuth2ACF::requestAccessToken   ; ONLY on exact match [ACCEPT]
```
- **Empty received state → REJECT.** Non-empty but ≠ expected → REJECT. Only exact match → token exchange.
- Expected `state` origin: WickrPro calls `setState("")` (@0x140ad4398, arg = empty string @0x140e35cd5) *by design* — Qt's `QOAuth2AuthorizationCodeFlow::buildAuthenticateUrl` (@0x18001bb20) sees empty state (`cmp [rsi+0x198],0` @0x18001bb57) and **auto-generates a fresh random state** (`fcn.18000d180` → `QAbstractOAuth::generateRandomString` → `QRandomGenerator64::system`, a **CSPRNG**) then `setState`s it, per login.
- ⇒ Expected state is a **per-login CSPRNG value** known only to client+IdP. Attacker cannot supply it. `modifyParameters` lambda adds only PKCE params (no attacker-influenced state/nonce).

## 5. PKCE (second layer)
`setPkceMethod(...)` @ 0x140ad3f37 (len=0x2b=43). Wickr adds `code_challenge`,
`code_challenge_method`, `code_verifier` (RequestAuthorization/RequestAccessToken stages;
"raw" = Wickr-computed, "qt" = Qt-computed). An injected *foreign* code fails the IdP token
exchange because it was bound to a different `code_challenge` than the victim client's
per-login `code_verifier`.

## 6. Dynamic verification (frida, live PID 20804)
- Hooked `callbackReceived` (RVA 0x3900), `authorizationCallbackReceived` (RVA 0xb7c0), and outbound `connect`/`WSAConnect`.
- Fired `GET /?code=INJECT123&state=INJSTATE` at the **idle** handler:
  - `callbackReceived` FIRED → `authorizationCallbackReceived` FIRED (handler forwards into the flow), **but NO outbound connection** → code was **rejected before any token exchange** (state gate). Backtrace confirmed the Qt reply-handler→flow chain (no Wickr slot bypassing validation).
- A bare `GET /` also fires the chain and no-ops. ⇒ **idle injection is inert.**
- Observed lifecycle: after the session ended, a fresh WickrPro (PID 19268) had **no loopback listener** — the reply handler is **on-demand** (tied to the active OIDC workflow), not a permanent process-lifetime service. Narrows the attack window to active SSO logins.

## 7. Attacker-model analysis (per accepted win class)
- **(a) token/code theft or injection** — THEFT: response has no secrets, no CORS read, code is in the *inbound* request (can't be read by another origin); a local process can't steal Wickr's already-bound socket (Qt QTcpServer exclusive bind, random port). INJECTION: blocked at CSPRNG `state`; even past state, blocked by PKCE at the IdP. **Blocked.**
- **(b) loopback→RCE/file-read/SSRF/path-traversal** — handler serves only `/`→fixed stub; non-`/` paths return nothing; no filesystem/exec sink; the only sink is the OAuth code→token exchange (gated). Token endpoint is Wickr-config, not attacker-set → no SSRF. **Blocked.**
- **(c) cross-origin CSRF state change** — only state-changing effect is completing a login, which needs the unforgeable CSPRNG `state`. Plus browser Private-Network-Access restrictions on public→localhost + random port (defense-in-depth). **Blocked.**

## 8. Adversarial refutation (survives)
- Reachable pre-auth/default? Handler only exists during an SSO window; when present it is reachable, but every code path is inert without the CSPRNG state.
- Input attacker-controlled end-to-end? `code`/`state`/method/path/Origin/Host are fully attacker-controlled — yet `state` must equal a value the attacker cannot observe or predict.
- Default protection? Yes and load-bearing: CSPRNG state (Qt, strict validate) + PKCE + port 0 + no-CORS. State alone is sufficient; confirmed empty and mismatched states are both rejected.
- Observed == win? No — observed the opposite: injected code produces **no** token exchange (frida).

## 9. Minor observations (not wins)
- **No `Host` validation** → DNS-rebinding could let a web page make *same-origin* requests to the loopback (bypassing CORS to read responses), but responses contain no secrets and `state` still can't be forged → yields nothing.
- **No CORS / no Origin check** → CSRF-reachable but not response-readable (as above).
- `OIDC_REDIRECT_POISONED` / `OIDC_REDIRECT_SUCCESS` / `_UNSPECIFIED` are protobuf **telemetry** enum labels (metric reporting of redirect outcomes), i.e., a detection/reporting aid — not a bypassable security gate.

## 10. Honest limitations
- I could not drive a *full real SSO login end-to-end* (no SSO-enabled Wickr network / IdP available on this box) to watch a *successful* state match live. The validation logic (empty-reject, mismatch-reject, exact-match-only) and CSPRNG state auto-generation are unambiguous in Qt 6.9.2 disassembly, and the idle-injection negative is observed. The negative rests on stock Qt behavior + Wickr config, both verified.
- The old live PID exited during frida testing (crash or external close; a new instance is running). Non-destructive per RoE (revertible).

## Tools / artifacts
- `E:/tmp/wickr/scratch_hook.py` (frida callbackReceived/outbound observer), `scratch_state.py` (state-read hook; blocked by transient attach failure after process exit).
- Key offsets: Qt6NetworkAuth.dll state-validation fcn `0x18001b8d0`, buildAuthenticateUrl+state-gen `0x18001bb20`/`0x18000d180`; WickrPro.exe OIDC config `0x140ace000–0x140ad5900` (replyhandler ctor 0x140ad2e71, setPkceMethod 0x140ad3f37, setState 0x140ad4398).
