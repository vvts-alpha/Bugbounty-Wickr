# Wickr Desktop — non-DOCX path hunt (filled First Prompt)

Paste below into a new agent session. DOCX → Amplify → `wickrweb://` is **known / out of portfolio** unless you find a *new* bridge into that allowlisted origin.

---

```
0. CONFIG — filled

TARGET         : AWS Wickr Desktop (WickrPro) 6.72.20.0
                 Binary: WickrPro.exe (Qt WebEngine 6.9.2 / Chromium 130)
                 Recovered UI sources: e:\tmp\wickr\wickr\extracted\sources\
                 Notes/CSP: e:\tmp\wickr\desktop\notes\WAVE2-A-CSP-BYPASS-FINAL.md
                 Prior chain (DO NOT rediscover as the win): DOCX docx-preview HTMLi
                   → iframe https://main.d4zeeqgazhley.amplifyapp.com/
                   → fetch wickrweb:// → read contacts/self/messages

TARGET PROFILE : B (thick-client) + A (white-box on recovered sources under
                 wickr/extracted/sources and qrc HTML/CSP). Prefer source taint
                 first; confirm on live WickrPro in a VM when a candidate appears.

ENVIRONMENT    : Stock Wickr Pro Desktop on Windows, logged-in test account,
                 default production build (isProduction=true). Optional second
                 run on non-prod only if a lead requires BetaMenu.

ATTACKER POS   : One of (pick per lead; do not exceed):
                 (P1) "victim opens/previews a non-DOCX attacker-controlled file
                       in built-in preview (PDF/PPTX/image/SVG/HTML/zip/…)"
                 (P2) "victim clicks an in-app link / deep link / custom URL"
                 (P3) "victim receives a message that auto-renders rich content
                       (no file preview click) — only if stock does that"
                 (P4) "unauth remote vs Wickr-related infra the client trusts
                       (already have Amplify RCE; hunt OTHER trusted hosts)"
                 Ceiling for client data win: no more than one intentional
                 user action consistent with normal chat use.

WIN CONDITION  : BINARY — from attacker-controlled code OR a script-free
                 declarative channel, observe one of:
                 (W1) HTTP 200 body read of wickrweb://contacts/contacts OR
                      wickrweb://users/self OR wickrweb://message/<vgroupId>
                      (protobuf/JSON bytes captured in PoC log), OR
                 (W2) same data exfiltrated to an attacker HTTPS endpoint you
                      control (lab), OR
                 (W3) proven arbitrary JS execution in a context that already
                      has connect-src access to wickrweb://* AND can perform
                      external HTTPS (i.e. not stuck under preview CSP that
                      blocks attacker script) — then demonstrate W1 in same PoC.
                 Marker example: log starts with WICKRWEB_READ_OK and length>0.

SCOPE          : IN: WickrPro desktop renderer, QML/WebEngine, qrc assets,
                 webChannel/uiBridge, wickrweb scheme handler, file preview
                 (non-DOCX), calling/location overlays, MCP if exposed,
                 other CSP-allowlisted origins besides the known Amplify host
                 if any, auto-update/Sparkle-adjacent only if it yields W1–W3.
                 EXCLUDED from counting as the win:
                 - Rediscovering DOCX w:sym / altChunk → Amplify iframe chain
                 - MITM / hosts-file spoof as the *only* way to get JS on Amplify
                   (Amplify RCE is already a separate ticket; OK as infra note)
                 - Self-XSS in DevTools
                 - Physical / local DLL hijack requiring write to install dir
                 - Pure phishing UI without wickrweb read
                 - Android-only findings

AGENT BUDGET   : 4     TIME FLOOR : 6h
DIFFING        : ALLOWED against local recovered sources/notes; FORBIDDEN to
                 treat public H1 duplicates / CVE writeups as the exploit map
                 for a "novel path". Known CVE on Amplify may be referenced
                 only as existing infra compromise, not as the new client entry.

KNOWN NEGATIVE SPACE (do not waste budget rediscovering):
- Preview CSP script-src 'self' qrc://* blocks attacker JS on qrc/file-preview
- DOCX renderSymbol innerHTML + altChunk srcdoc → markup only under that CSP
- frame-src allowlist: 'self' blob: https://fast.com/
  https://main.d4zeeqgazhley.amplifyapp.com/  (exact)
- Beta Speed test / CheckSpeedModal only if !isProduction
- Parent postMessage openLink is same-origin gated + confirm dialog
- Android polyglot XSS did not reach message DB (different architecture)


1. TASK
Find a NEW path (not the DOCX→Amplify chain) from ATTACKER POS to WIN
CONDITION on stock Wickr Desktop. Assume at least one alternate bridge
exists OR prove a hard negative with surviving refutations. Success = W1/W2/W3
with a run PoC. Nothing weaker.


2. WHAT DOES NOT COUNT
- "HTMLi in another Office format" that still cannot run JS / cannot leave CSP
  and never demonstrates wickrweb body read
- Theoretical uiBridge gadgets without a live call from attacker-controlled input
- img/src declarative GET to wickrweb:// that does not yield readable response
  body to the attacker (blind fire ≠ W1 unless you show side-effect that equals
  W1/W2, e.g. credential material reflected somewhere attacker can see)
- Re-reporting Amplify React2Shell alone (already filed) unless chained from a
  NEW client entry that is not DOCX
- Status / "should work"


3. HOW TO SEARCH
Up to 4 concurrent agents; early diversity by FAMILY below. Registry key =
(bug class × surface × entry). Cross-pollinate only after each primitive's
real reach is measured. Root loops: synthesize → challenge → redirect.


4. PORTFOLIO OF ATTACK SURFACES
Universal: parsing · injection · authz · files/paths · SSRF · concurrency ·
crypto · cache · business logic.

Wickr Desktop–specific menu (non-DOCX focus):

F1. Other preview renderers (PPTX / PDF / images / SVG / HTML / ZIP / TDF)
    — DOMPurify gaps, srcdoc, object/embed, navigation, CSP divergence vs DOCX
F2. Script-free wickrweb abuse
    — <img>/<video>/CSS url(wickrweb://…) destructive or reflecting GETs;
    — form-action missing → POST leaks only if sensitive data is in the DOM
F3. Alternate ways to load allowlisted https origins with attacker JS
    — fast.com open redirect / UXSS / postMessage (likely dead; verify)
    — ANY other host appearing in frame-src / navigate / webAppLoadUrl
    — bot web-apps / integrated apps WebEngineViews (separate profiles?)
F4. Deep links / custom protocols / argv / Wickr URL handlers
F5. QWebChannel uiBridge action smuggling from attacker-influenced UI state
    (saveLinkToRoom, openLink, uploadFile, …) — need attacker-controlled args
F6. Location / maps tile.googleapis.com and related WebViews
F7. Calling / Chime / meetings surfaces (extra origins? weaker CSP?)
F8. MCP server/client (WickrMcpServer) — local tool RCE or data plane?
F9. File manager / saved file / wickrweb file routes as content injection
F10. Non-prod BetaMenu paths only as SECONDARY (document isProduction gate)
F11. Native scheme handler bugs: CORS/initiator checks, response mixing,
     path normalization on wickrweb://
F12. Auto-update / native parsers (Sparkle, media, protobuf) — only if they
     yield W1–W3 under ATTACKER POS (memory corruption → JS bridge is OK)

For each lead: exact path/line (or offset), attacker input, entry→sink,
missing check — or a dead-end counterexample.


5. ADVERSARIAL VERIFICATION
Verify clause (Profile B+A):
- Dynamic: run WickrPro; trigger entry; capture wickrweb response body or
  exfil in lab proxy/log. Prefer hosts-spoof ONLY if the NEW entry still needs
  a stand-in for an allowlisted host AND you document why production would
  serve attacker JS (separate RCE/host compromise). Prefer proving W3 in a
  context that is already attacker-owned https.
- Static-only chains = UNCONFIRMED / weaker.
Reviewers must try to kill:
  still DOCX-shaped? still needs excluded MITM? CSP blocks script?
  production build lacks the UI? body not actually readable?


6. RETURN CONDITION
Spend ≥ TIME FLOOR. Return either:
(A) Confirmed NEW chain → WIN with PoC + paths + preconditions + build type, or
(B) Strongest verified primitive + EXACT gap, labeled UNCONFIRMED/NEGATIVE.

Priority order if multiple wins:
1) Works on production isProduction=true with one normal user action
2) Works only on !isProduction but still reads wickrweb
3) Infra-only new trusted host RCE without client entry (file separately)


7. RULES OF ENGAGEMENT
Benign PoCs; own accounts; no destructive Amplify persistence; no scanning
unrelated AWS customers. Stay in SCOPE. Do not fabricate positives.
```

---

## 使い方メモ

1. このブロックをそのまま新チャットに貼る  
2. 最初の指示に一文足す: `Start round 1 with four agents on F1, F2, F4, F8`  
3. DOCX 再発見は自動的に §2 で落ちる  
4. 勝ちは **W1/W2/W3 のログ**だけ

## いま特に刺さりそうな家族（ヒント）

| Family | なぜ |
|---|---|
| F1 PPTX/他形式 | DOCX とサニタイズ差がある（DOMPurify 有無） |
| F2 宣言的 GET | JS なしで `wickrweb` を叩けるが **body 読取が難しい** — 破壊的 GET があれば別 Impakt |
| F4 ディープリンク | ファイル不要の 1-click |
| F8 MCP | 新しいローカル面 |
| F3 fast.com 以外 | allowlist が増えてないか再スキャン |
