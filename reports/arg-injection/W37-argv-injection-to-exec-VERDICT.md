# W37 — does the `wickrpro://` argument injection reach program execution?

**Date:** 2026-08-05 **Target:** AWS Wickr Desktop 6.72.20.0 (Windows x64), Qt 6.9.2,
Qt WebEngine 130.0.6723.192 (declared patch level 139.0.7258.67)
**Verdict: PATH CLOSED.** Every candidate switch is either overwritten by QtWebEngine, inert on
Windows, or has no child process to attach to. Confirmed on two independent endpoints.

**No code execution was achieved. `calc.exe` did not launch. The marker binary never ran.**

---

## Answers

### Q1 — Single-instance forwarding: **REAL, and it suppresses the whole path**

**[M]** With an instance already running, firing the `wickrpro:` URL produces **no new process
at all** — not even a transient one. Polled at 700 ms granularity for 21 s: zero. Repeated at
30 s: zero. The only `WickrPro.exe` remained the original, with its original clean command line.

**[M]** Mechanism is app/shell level, *not* Chromium's `ProcessSingleton`:

| marker | WickrPro.exe |
|---|---|
| `SingleApplication` | **PRESENT** (`0x32b75a4`, `0x32bf2b0`, …) |
| `QLocalServer` / `QLocalSocket` / `QSharedMemory` | **PRESENT** |
| `ProcessSingleton` / `SingletonLock` / `SingletonCookie` | **absent** |
| `user-data-dir` | **absent** (also absent from Qt6WebEngineCore.dll) |
| `DdeInitialize` / `DdeConnect` / `DdeNameService` | **absent** (no DDE server implemented) |
| `ddeexec` | present — the app *writes* this registry key |

Registry **[M]**: `HKCU\Software\Classes\wickrpro\shell\open\ddeexec = %1`,
`…\ddeexec\application = Wickr Pro`, `…\ddeexec\topic = System`.

⇒ **`--user-data-dir` cannot defeat this.** The switch does not exist in this build, and the
suppression happens before Chromium is initialised at all. The singleton is Qt
`SingleApplication` (shared memory + local socket) keyed on the application identity, not on
any data directory.

**Consequence: the injection only works when Wickr is not already running.**

### Q2 — Which process-spawning switch does this build honor? **None that could be reached**

Switch-string presence **[M]** (exact, NUL-terminated): every Chromium switch tested is
**PRESENT in Qt6WebEngineCore.dll** and **absent from WickrPro.exe** (expected — Chromium's
literals live in the WebEngine DLL). `browser-subprocess-path`, `gpu-launcher`,
`renderer-cmd-prefix`, `utility-cmd-prefix`, `js-flags`, `no-sandbox`, `disable-web-security`,
`disable-site-isolation-trials`, `use-angle`, `enable-logging`, `log-file`, `proxy-pac-url`
all present.

**[M] Argv does reach Chromium.** `WickrPro.exe` calls
`qunsetenv("QTWEBENGINE_CHROMIUM_FLAGS")` at `0x1408d3ddf` — so QtWebEngine's
"drop the app's argv and use the env var instead" branch is *not* taken, and
`QCoreApplication::arguments()` is fed verbatim into `base::CommandLine`.

**End-to-end result, measured on a logged-in session [M]:**
fired `wickrpro:x" /browser-subprocess-path=marker.exe /gpu-launcher=marker.exe
/renderer-cmd-prefix=marker.exe`, then logged in. WebEngine initialised (renderer child
appeared). **The marker never executed.** The child was the genuine
`QtWebEngineProcess.exe --type=renderer`, and `marker.exe` appears nowhere in its command line.

Why each one fails:

* **`browser-subprocess-path` — overwritten.** QtWebEngine's `WebEngineContext` ctor computes
  `WebEngineLibraryInfo::getPath(content::CHILD_PROCESS_EXE)` (`edx=0xfa0`=4000) and
  **unconditionally appends** the switch at `0x1802fe862`. Chromium's `switches_` is a map with
  insert-or-assign semantics, so the app's value replaces the injected one. The consumer
  `ChildProcessHost::GetChildPath` at `0x182b5f3e0` then reads the map (`0x182b5f40b`) and gets
  Qt's own path. **[M] confirmed behaviourally** — the real `QtWebEngineProcess.exe` spawned.
* **`renderer-cmd-prefix` — read, but inert on Windows.** Two read sites (`0x1830900c2`,
  `0x183097d33`). Tracing the value at `0x183090146`: it is tested only for emptiness and, if
  non-empty, appends **`"no-zygote"`** (`0x18309014b`) — Linux zygote logic. It never reaches a
  wrapper-prepend. **[M]** a real renderer spawned with no wrapper applied.
* **`gpu-launcher` — live code, but unreachable: there is no GPU process.** This one *does*
  reach a wrapper prepend on Windows:
  ```
  0x182d1c620  lea rbx, ["gpu-launcher"]
  0x182d1c648  call GetSwitchValueNative      ; -> [rbp+0x40]
  ...
  0x182d1cbc7  mov rcx,[rbp+0x50]             ; length
  0x182d1cbce  je  0x182d1cbf5                ; skip if empty
  0x182d1cbf0  call 0x183fc88a0               ; PrependWrapper(gpu cmdline, gpu_launcher)
  ```
  i.e. `if (!gpu_launcher.empty()) cmd_line->PrependWrapper(gpu_launcher)`, compiled into the
  shipped Windows DLL. **But the GPU service runs in-process, so that command line is never
  built.**

  **[M] Two independent endpoints, both logged in, both `--type=renderer` only, no
  `--type=gpu-process` child:**
  - this VM (GPU-blocklisted VMware SVGA), including a run with `/ignore-gpu-blocklist`;
  - the operator's real desktop (`C:\Program Files\…`, `--lang=ja`,
    `--device-scale-factor=1.25`, real GPU).

  **[M] Cause:** QtWebEngine's `WebEngineContext` ctor — the same function that appends
  `browser-subprocess-path` — appends **`--in-process-gpu`** itself at `0x1802ff56a`
  (`AppendSwitch`, no value, on the same `CommandLine*` in `rsi`).

  ⇒ `gpu-launcher` is read, and would wrap a GPU child if one existed. None ever does.
  **CLOSED.**

### Q3 — Parsed as a switch, and reachable? **Yes to argv; the `--` form aborts the app**

**[M]** Registry template: `"…\WickrPro.exe" "%1"` — no `--` separator, URL is a positional
argv[1], so Chromium keeps parsing switches after it.

**[M] The full chain executed against the real handler for the first time.** Firing
`wickrpro:x" --baseURL http://127.0.0.1:8099/` yielded a live process with:
```
"…\WickrPro.exe" "wickrpro:x" --baseURL http://127.0.0.1:8099/"
```
Injected tokens are in argv. W17i's links A/B/C are confirmed end-to-end.

**[M] But `--`-prefixed Chromium switches kill the app.** WickrPro uses
`QCommandLineParser::process()`, which on an unrecognised option shows a modal Win32
MessageBox — measured screenshot: **"Unknown option 'baseURL'."** — and exits. The app never
creates its main window (`Qt692QWindowIcon` absent; only `#32770`). So
`--browser-subprocess-path=…` aborts WickrPro before Chromium sees anything.

**[M] `/`-prefix bypasses the Qt parser — but NOT into Chromium.** QCommandLineParser treats
`/token` as a *positional argument* and does not error: launching with
`/enable-logging /log-file=… /v=1`, `/remote-debugging-port=9333`, and
`/disable-web-security /js-flags=--allow-natives-syntax` all produced a **normal startup, no
dialog, main window present**.

**But Chromium does not parse them as switches.** Measured post-login, Chromium fully
initialised:
* `/remote-debugging-port=9333 /remote-allow-origins=*` — port **never opened** in 5 min.
* `/disable-web-security /js-flags=--allow-natives-syntax` — **neither appears in the renderer
  child's argv**, although Chromium's `PropagateBrowserCommandLineToRenderer` allowlist copies
  `kDisableWebSecurity` and `kJavaScriptFlags` from the browser's `CommandLine` when set.
  Browser argv (verified): `… "wickrpro:x" /remote-debugging-port=9333 /remote-allow-origins=*
  /disable-web-security /js-flags=--allow-natives-syntax`. Renderer argv: no trace of any.

⇒ **Slash tokens are inert.** **CORRECTS an earlier claim in this same note that `/` was "the
only viable payload form" — it passes Qt, but reaches nothing.**

> **Mechanism pinned by W39 (supersedes my guess here).** I had hypothesised
> `base::CommandLine::set_slash_is_not_a_switch()`. The real reason is broader and stronger:
> QtWebEngine's `initCommandLine` (`0x180300a42`) does **`args.mid(0,1)` at `0x180300d7c`** —
> it discards *every* application argument unless a **`--webEngineArgs` separator** is present,
> and `WickrPro.exe` contains no such string. So **no** argv-appended Chromium switch reaches
> QtWebEngine in any prefix form, not just slash ones. See
> `w39-disable-web-security-not-applied` — harness A/B: product-form delivery → SOP ENFORCED,
> same argv **with** the separator → DEFEATED.

> **Confound, stated honestly:** that `kDisableWebSecurity`/`kJavaScriptFlags` are in this
> Chromium version's propagation allowlist is **[I]**, not verified in the binary. The clean,
> allowlist-independent confirmation is **`/single-process`** (binary oracle: does the renderer
> child still spawn?). **NOT YET RUN.**

**Net effect: no Chromium switch is injectable by either form.** The injection reaches only
WickrPro's own three registered options.

**[M] The `/` payload survives browser URL serialisation** (headless Chrome, `new URL().href`):
opaque-path form keeps quote, space and slash verbatim; the `//` authority form percent-encodes
(matches W17i).

---

## Correction to W17i — the option table is not the registered option set

W17i inferred from binary strings that `--clientType` and `--baseURL` were reachable. **They are
not, in this production build.** Measured by firing each option and reading the resulting
dialog ("Unknown option 'x'" = not registered; "Missing value after '--x'" = registered):

| option | verdict |
|---|---|
| `datalocation` | **REGISTERED** ("Missing value after") — and honored |
| `logging`, `angle` | **REGISTERED** (no dialog, app starts) |
| `baseURL`, `clientType`, `environment`, `env`, `configfile`, `noinstancecheck`, `disablekeychain`, `nocrypt`, `headless`, `headlessport` | **Unknown option** — parser rejects, app exits |

So W17i §5's central impact claim (`--baseURL` lets the attacker set the client's server, and
`--clientType` re-enables the W17g deep-link matcher) **does not hold on the shipped build**.
`--noinstancecheck` is likewise *not* available, so it cannot be used to defeat Q1.

### …but the options are not dead code — they are gated by ONE runtime boolean **[M]**

The full name table (21 entries, `.rdata` 0x3255b90–0x3256158) is:
`angle headless headlessport ignorepath logging nocrypt dbdump vdump debugsyncingconvos
debugcontactbackup auditmsgs cdump user usercaptest datalocation configfile noinstancecheck
disablekeychain baseURL environment clientType`.

**22 `QCommandLineOption` objects are constructed and 22 `addOption` call sites exist** — the
options are built at runtime, not compiled out. The registration is split:

```
0x1409d7ecc  addOption(...)      ; 3 UNCONDITIONAL  -> angle / logging / datalocation
0x1409d7ede  addOption(...)
0x1409d7eed  addOption(...)
0x1409d7efa  test r12b, r12b
0x1409d7efd  jne  0x1409d7ff3    ; r12b set -> SKIP the rest
0x1409d7f07  addOption(...)      ; ~18 more, all inside this branch
   … x18 …
```
plus one *inverted* site at `0x1409d6ba7` (`je 0x1409d6baf`) that is added only when r12b **is** set.

**`r12b` identified [M].** `0x1409d6b91 movzx r12d, byte [rbp+0x1a8]` — an incoming argument.
Frame: prologue pushes 8 registers (0x40) then `lea rbp,[rsp-0x138]`, so `rbp = rsp_entry-0x178`
and `[rbp+0x1a8]` = `rsp_entry+0x30` = **arg6**. At the call site `0x1408d3cbb call 0x1409d6500`:
```
0x1408d3c75  cmp dword [0x143498f70], 3
0x1408d3c7c  sete dil
0x1408d3c9d  mov byte [rsp+0x28], dil      ; arg6
```
⇒ **`r12b == ([0x143498f70] == 3)`**.

**The same global gates QtWebEngine remote debugging** (`0x1408d3de5`–`0x1408d3eed`): `== 3`
→ `qunsetenv("QTWEBENGINE_REMOTE_DEBUGGING")`; `0`/`1`/`2` → `qputenv` to port
**3001/3002/3003**.

⇒ `0x143498f70` is the **master production/environment flag**. In this build it is 3, which is
why only 3 options register *and* why no DevTools port opens. In any build or state where it is
not 3, the very same `wickrpro://` injection immediately yields `--baseURL`, `--clientType`,
`--configfile`, `--dbdump`, `--cdump`, `--nocrypt`, `--disablekeychain`, `--noinstancecheck`
**and** an open DevTools port.

**What the global means [M]** — the `environment` option's own handler decodes it
(`0x1409d84c8`–`0x1409d8560`): `"alpha"`→0, `"beta"`→1, `"gamma"`→2, else
*"Invalid environment value specified."*; production is 3.

**Not attacker-reachable, and not runtime-settable at all [M].** Two independent reasons:

1. *Chicken-and-egg:* the global is written at `0x1408d3c64`, **before** argv is parsed at
   `0x1408d3cbb`, and the only option that writes it (`environment`) is itself inside the gated
   set — the same shape as W17g.
2. *It is a compile-time constant.* Traced the value to its origin through the single call chain
   (function bounds from `.pdata`, callers by E8 rel32 — each level has exactly **one** caller):
   ```
   0x140012d70  mov edx, 3           ; <-- environment, an IMMEDIATE
   0x140012d75  mov ecx, 1           ; <-- clientType (independently matches W17g's value)
   0x140012d7a  call 0x1408d5730
     0x1408d574a  mov esi, edx       ; esi = 3
     0x1408d57ce  mov r8d, esi       ; arg3 = 3
   0x1408d3ba0:
     0x1408d3bc2  mov esi, r8d
     0x1408d3c64  mov dword [0x143498f70], esi
   ```
   **Every argument at that top-level site is an immediate** (`mov ecx,1`, `mov edx,3`,
   `xor r8d,r8d`, `mov r9d,0x39e8b51`) — no file, registry or environment-variable read anywhere
   in the chain.

⇒ The ~18 options and the DevTools port are shut by a **hardcoded constant**. Report as a
build-configuration observation ("these ship in the binary and are one constant away"), **not**
as an exploitable step on this build.

## What the injection *can* still do — measured

**[M]** `wickrpro:x" --datalocation <attacker path>` — fired through the real protocol handler,
with no instance running — starts the client against an **attacker-chosen data directory**,
which it populates (`…\Wickr\Wickr Pro\{logs,mls,preferences,settings,crashpaddb,…}`).
Requires the directory to already exist (otherwise the app exits). This is a genuine
reachable primitive: it forces the client to a blank profile (re-login phishing surface) and,
per the operator's note, a UNC target would drag SMB/NTLM authentication out at startup —
**not tested here**, as no consented SMB listener was available.

## Also observed

**[M]** `WickrPro.exe` sets `QTWEBENGINE_REMOTE_DEBUGGING` to `3001`/`3002`/`3003` depending on
`dword [0x143498f70]` (values 0/1/2), unsetting it only when that global is 3
(`0x1408d3de5`–`0x1408d3eed`). The static initialiser is 4, and argv is parsed at `0x1408d3cbb`
*before* this block — but the option that would set it (`env`/`environment`) is **not registered**
in this build, so it is not attacker-reachable. Worth a look in builds where it is.

## Remediation (unchanged in substance from W17i)

Do not pass the raw URL as a bare command-line argument. Validate that argv[1] parses as a
`wickrpro:` URL and **ignore everything after it**; or reject any command line where a URL
argument is followed by further tokens. Note that filtering only `-`/`--` is insufficient —
**`/`-prefixed tokens are Chromium switches on Windows** and pass QCommandLineParser silently.

## Next

Per the brief, the next path is **B2 — CVE-2026-12012 (`SpdyBuffer::ConsumeHelper` UAF)**. The
network service runs in-process in `WickrPro.exe` (confirmed again here: the renderer child
carries `--enable-features=NetworkServiceInProcess2`), which is IL=MEDIUM with no CFG, so no
sandbox escape is needed and guarded-call mitigations are inert. **Known wall: it still requires
an info-leak in that process to defeat ASLR.**
