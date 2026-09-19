# W37b — `--datalocation` profile hijack: the client's API server is a plantable setting

**Date:** 2026-08-05 **Target:** AWS Wickr Desktop 6.72.20.0 (Windows x64)
**Status: MEASURED end-to-end (local).** This is the live half of W37, after
`W37-argv-injection-to-exec-VERDICT.md` closed the program-execution route.

> ## ⚠ CORRECTED 2026-08-05 — the headline below was OVERSTATED. Read this box first.
>
> Follow-up testing **refuted the impact**, though not the mechanism:
>
> 1. **Authentication does not use `regionBaseURL` [M].** The client resolves its region itself
>    via `WickrMultiRegionRequest()` and sent `getSalt`/login to the **real** backend
>    (`RegisterCheckGetSalt: Request succeeded`, then the genuine
>    *"Either the username or password you entered was invalid."*). A dummy-password login attempt
>    produced **zero** requests to the hijacked base URL. ⇒ **No credential capture, no
>    attacker-chosen salt, no login transcript.** Those three claims are withdrawn.
> 2. **The plant is transient [M].** After the client's own region discovery ran, `settings` was
>    **rewritten back** to the real `https://api.messaging.wickr.us-east-1.amazonaws.com/117/src` —
>    even though the login failed.
> 3. **The redirected traffic is empty [M].** All 7 captured `POST /HIJACK/heartbeat.php` bodies
>    were **53 bytes**: a multipart closing boundary and nothing else. No identifiers, no tokens.
>
> **Residual, and this is all of it:** `--datalocation` exposes the settings as a plaintext,
> attacker-named, attacker-writable INI (config-tampering surface + `last_successful_user`
> disclosure), and the client demonstrably *reads* `regionBaseURL` from it for heartbeat traffic.
> That is a **configuration-hardening finding, not an interception one.** Do not report it as
> "the client's API server is attacker-controlled".

## What the directory actually exposes — measured inventory [M]

The severity of this finding is entirely "what can be read out of that directory". Answered:

| artifact | content | verdict |
|---|---|---|
| `settings` (INI, plaintext) | `last_successful_user` (**account e-mail**), `regionName`/`regionBaseURL`, `userMetricsID`, `deviceMetricsID`, `forceDeviceLockout`, `failedLoginAttempts`, `certPinningEnabled`, `userVerificationFlow` | **identity + config-tampering surface** |
| `logs/*.txt` (plaintext) | `[JS]` bridge/Redux dumps carrying **raw** `vGroupID`, `msgId`, `serverMessageId`, `senderUserName`, `senderHash`, `targetUsers`, plus attachment `name`/`size`/`mimetype`/`fileHash`/`guid`, a `location` field, `timeStamp`, `destructTime`/`ttl` | **social graph + message metadata, including real attachment filenames** (`F12-link-poc.docx`, a Japanese-named PDF, …) |
| `logs` — `downloadUrl` | present as a **key only**; no `"downloadUrl": "http…"` value anywhere, and **0 hits** for `X-Amz-Signature`/`X-Amz-Credential`/`X-Amz-Date`/`X-Amz-Expires`/`AWSAccessKeyId`/`Signature=`/`Expires=` | **NOT pre-signed** — log access alone does not let an attacker fetch the ciphertext; retrieval needs an authenticated call to `api.messaging.wickr.us-east-1.amazonaws.com` with the `guid` |
| `logs` — message bodies | `text` / `textContent` appear as **keys only**; regex sweep for a non-empty value across every app log ⇒ **0 hits** | **no content** |
| `logs` — key material | `key` / `fileKey` / `secret` / `nonce` / `iv` ⇒ **0 hits** | **no keys** |
| `wickr_db.sqlite` | header `a8af 6936 0453 df32…` — **not** `SQLite format 3` | **encrypted** |
| `*.wic` (33–130 B) | wrapped key containers | useless without the Credential Manager secret (`CredReadW`/`CredWriteW`) |
| `temp/attachments` | 19 files sampled mid-file: **entropy 7.913–7.9994 bits/byte**, no PNG/JPEG/PDF/ZIP magic | **encrypted at rest** |
| `temp/shredder/aftemp*` | 10 MB, all-zero | overwrite buffer, not content |
| `mls/` | empty | — |
| `crashpaddb/` | sentry breadcrumbs / session.json | minor |

⇒ **Ceiling: metadata + identity disclosure and a config-tampering surface. No message content,
no attachment plaintext, no key material.** For a secure-messenger that is still meaningful —
who talked to whom, when, with which attachment filenames and whether a location was attached —
but it must not be written up as content compromise.

*Method note:* the first temp/ watch returned 0 events and was **void** — Wickr was not running
during the window. The inventory above comes from the re-run with the client live and the user
opening an attachment.

**Original (overstated) headline:** the one command-line option that IS reachable through the
`wickrpro://` argument injection — `--datalocation` — moves the client's settings out of the
registry and into a **plaintext INI file inside the attacker-named directory**. That file contains
**`regionBaseURL`** and **`certPinningEnabled`**. Planting `regionBaseURL` makes the client send
its API traffic to the attacker, **over cleartext HTTP, before any login, ~16 s after launch.**

---

## The measured chain

| step | evidence | mark |
|---|---|---|
| `wickrpro:` URL → `--datalocation <attacker path>` | real handler fired; process cmdline carried the token (see W37) | **[M]** |
| default install keeps settings in the **registry**; `--datalocation` materialises them as an INI **inside that directory** | real profile has no `settings` file (`CredReadW`/`CredWriteW` imported); `--datalocation` profile has `settings`, `servers`, `preferences` as INI | **[M]** |
| the INI carries the API base URL and the pinning flag | see below | **[M]** |
| planting `regionBaseURL` redirects live API traffic | `POST /HIJACKED-API/heartbeat.php` received on 127.0.0.1:8099, **pre-login**, plaintext HTTP | **[M]** |

Post-login `settings` from the test profile (secrets elided):

```ini
regionName=us-east-1
regionBaseURL=https://api.messaging.wickr.us-east-1.amazonaws.com/117/src   <-- plantable
certPinningEnabled=false                                                    <-- plantable
forceDeviceLockout=9                                                        <-- plantable
failedLoginAttempts=0                                                       <-- plantable
last_successful_user=<account e-mail>                                       <-- identity disclosure
userVerificationFlow=0 / first_login=false
userMetricsID=… / deviceMetricsID=…
```

**Proof run:** set `regionBaseURL=http://127.0.0.1:8099/HIJACKED-API`, launched with
`--datalocation <profile>`, no login performed:

```
12:54:31  POST /HIJACKED-API/heartbeat.php
```

Two things that matter about that line: it is **`http://`** (the client did not require TLS, so the
attacker needs no certificate at all), and it happened **without a login**.

## Why this is the W17i impact by another route

W17i wanted `--baseURL` to point the client at an attacker's server; W37 measured that
`--baseURL` is **not registered** on the shipped build. `regionBaseURL` reaches the same place
through the *registered* `--datalocation` option. `certPinningEnabled` sitting in the same
attacker-writable file removes the pinning defence too.

## What it does NOT give

* **Not RCE.** No code execution anywhere in this chain.
* **Not message plaintext.** Wickr is E2EE; being the API server yields auth flows, metadata and
  server-driven config, not message bodies.
* **Not the local key material.** The DB/`.wic` unlock secret lives in the Windows Credential
  Manager (`CredReadW`/`CredWriteW` imported), outside the profile directory — a remote attacker
  cannot decrypt what they exfiltrate.

## Gates (do not report this without them)

1. **Wickr must not already be running** — otherwise the shell suppresses the new process entirely
   (W37 Q1, measured twice).
2. The victim must accept the browser's **external-protocol dialog**.
3. The victim sees a **blank profile** and must complete a full new-device login. This is the
   biggest practical limitation and makes the realistic framing *phishing / re-provisioning*, not
   silent compromise.
4. **WebDAV delivery is UNTESTED [I].** `\\host@SSL@443\dav\…` would make the directory remote and
   attacker-controlled; the WebClient service is present but `Manual`/trigger-start. SQLite over
   WebDAV may not work at all.

## Refuted this wave

**`webViewAddress` does NOT drive the main app WebView [M].** The getter (`0x1409ed810`) is
unvalidated (`QSettings::value("webViewAddress").toString().trimmed()`, empty →
`qrc:/index.html`), and the compiled-QML string table puts it next to `wickrSettings`, `url`,
`channel`, `registerObject` — which *looked* like `url: wickrSettings.webViewAddress` on a
bridge-bearing view. It is not: the planted value **survived** into the post-login settings file
and the app **never fetched it** (logged in, renderer running, 6 min). It likely belongs to the
separate `bAppWebview`/`configureWebApp` embedded-web-app surface.
**Caveat:** the test profile had `showWebViewImmediately` removed during setup, so that flag as a
possible gate is **not excluded**. Retest before writing this off completely.

## Remediation

* Do not pass the raw URL as a bare argv element (CWE-88) — validate argv[1] parses as a
  `wickrpro:` URL and ignore everything after it.
* Do not honour `--datalocation` in production builds.
* Never take `regionBaseURL` / `certPinningEnabled` from a user-writable file; pin the base URL to
  a compiled-in allow-list and refuse non-HTTPS schemes.
* `last_successful_user` in cleartext is an unnecessary identity disclosure.
