# Unauthenticated RCE on Wickr-related Amplify origin `main.d4zeeqgazhley.amplifyapp.com` (CVE-2025-55182 / React2Shell) with edge WAF bypass

**Program:** AWS Wickr (related technical components)  
**Asset:** `https://main.d4zeeqgazhley.amplifyapp.com/`  
**Type:** Remote Code Execution (pre-auth)  
**Severity (researcher):** Critical / High (server-side arbitrary JS on Wickr-operated Amplify Hosting)  
**Researcher:** vvts-bugbounty  
**Note:** Separate from the previously closed Desktop/Android DOCX → `wickrweb://` report. This ticket is **only** about RCE on the Amplify host.

---

## 1. Why this host is in scope

This hostname is not a random third party:

- Shipped verbatim in Wickr client CSP `frame-src` (Desktop preview + main HTML; Android WebView CSP similarly).
- Loaded by Desktop **Speed test → Custom speed test** (`CheckSpeedModal`).
- Therefore it is a **Wickr-related technical component** under the program’s related-components language.

### Speed test path (why RCE on this host matters to Wickr users)

Desktop source (`CheckSpeedModal`):

```tsx
<iframe
  title="Fast.com"
  src={customTest
    ? 'https://main.d4zeeqgazhley.amplifyapp.com/'
    : 'https://fast.com'}
/>
```

Entry in UI: **Beta menu → Speed test**, then toggle **Custom speed test**.

So: if an attacker has RCE on this Amplify origin and can change what that URL serves, **any Wickr Desktop user who opens Speed test → Custom speed test loads attacker-controlled content inside Wickr’s WebEngine iframe** (same allowlisted origin the client deliberately frames). No DOCX required for that entry path.

UI note: Speed test sits under the Beta menu, so not all production users see it — but for anyone who does, RCE on this host directly poisons that in-app feature.

This report does **not** re-claim client-side message/`wickrweb://` exfiltration (already handled as duplicate elsewhere). Primary impact here remains **server RCE**; the Speed test framing is the Wickr-specific reason the host is sensitive.

---

## 2. Summary

`main.d4zeeqgazhley.amplifyapp.com` runs **Next.js 15.0.2** (App Router) on Amplify Hosting compute, behind CloudFront / ELB.

It is vulnerable to **CVE-2025-55182** (React Server Components Flight deserialization → pre-auth RCE, aka React2Shell).

- Naive public PoC shape is blocked at the edge (`HTTP 403` from `awselb/2.0`).
- Placing Flight exploit fields **after ~17KB of benign multipart padding** bypasses WAF body inspection.
- I executed **read-only** server-side JS only: read `process.version`, reflect it via Next redirect digest. **No shell, no `child_process`, no file write, no persistence, no deploy modification.**

Observed proof marker in live response:

```text
x-action-redirect: /r2s?m=R2S_CONFIRMED_v18.20.8;push
```

Server embedded `R2S_CONFIRMED_v18.20.8` → **arbitrary JS execution** as the Node process (`v18.20.8`).

---

## 3. Fingerprint

| Signal | Value |
|---|---|
| `x-powered-by` | `Next.js` |
| Client bundle version string | **15.0.2** (`/_next/static/chunks/215-*.js`) |
| Fixed line for 15.0.x | **15.0.5+** (this host is unpatched) |
| Build age | Site assets dated **2024-11-14** (pre-patch) |
| Fronting | CloudFront → `Server: awselb/2.0` → Amplify compute |

Public scanner (Assetnote react2shell-scanner) also flags:

```text
[VULNERABLE] https://main.d4zeeqgazhley.amplifyapp.com/ - Status: 303
Content-Type: text/x-component
```

(UA used in tests: `wickrvrpresearcher_vvts-bugbounty`)

---

## 4. Steps to reproduce (minimal, read-only)

1. Target: `https://main.d4zeeqgazhley.amplifyapp.com/`
2. Send crafted `POST` with `Next-Action` / Flight multipart fields for CVE-2025-55182.
3. If raw PoC returns **403** from ELB/WAF, retry with **≥ ~17KB benign padding** before exploit fields (edge body inspection bypass).
4. Use a **read-only** gadget only, e.g. reflect `process.version` through Next’s redirect/`digest` mechanism (no shell).
5. Confirm response includes attacker-controlled marker derived from server state, e.g.  
   `x-action-redirect: …R2S_CONFIRMED_v18.20.8…`  
   and `Content-Type: text/x-component`.

Attachments (from prior research package):

- `evidence-r2s-response.txt` — full HTTP capture
- `evidence_r2s.py` — single-request repro (padding + read-only marker)
- Optional screenshots: `evidence2-r2s-check-wickr.png`

---

## 5. Impact (this ticket only)

Unauthenticated attackers can run arbitrary JavaScript in the Amplify/Next server process for this Wickr-related host, which typically implies:

- Full host compromise / secret access / supply-chain risk for anything this origin serves
- Ability to change responses served to browsers (and to any Wickr WebView/WebEngine that frames this exact origin)

I did **not** escalate to an interactive shell or modify production content.

---

## 6. Remediation

1. Upgrade Next.js (and React / RSC deps) to a **CVE-2025-55182-patched** release (for 15.0.x: **≥ 15.0.5**, or current supported patched line).
2. Redeploy Amplify app; verify scanner no longer reports VULNERABLE.
3. Review WAF: padding bypass shows signature-only body checks are insufficient; patch is mandatory.
4. (Defense in depth, out of this ticket’s primary ask) Reconsider shipping this origin in client `frame-src` if the speed-test UI is unused for most users.

---

## 7. Relationship to closed DOCX report

| Topic | Status |
|---|---|
| Desktop/Android DOCX → privileged client APIs | Closed as duplicate of another researcher |
| **This Amplify pre-auth RCE + WAF bypass** | **Submitted here as standalone server RCE** |

Please treat this as a distinct asset/issue unless an existing report already covers **RCE on this exact Amplify hostname**.

---

## 8. Timeline (short)

- Fingerprinted Next 15.0.2 on allowlisted Wickr origin
- Confirmed WAF 403 on naive PoC; confirmed padding bypass
- Read-only `process.version` marker → `R2S_CONFIRMED_v18.20.8`
- No destructive follow-up on production
