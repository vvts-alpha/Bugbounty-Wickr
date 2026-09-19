# W39 — `--disable-web-security` in WickrPro.exe: **NOT APPLIED**

Date 2026-08-05. Binary `desktop/binaries/WickrPro.exe`, 55,890,344 bytes, version
`4.4.0.0181`, commit `c9c94459`. Every claim below is **[M]** measured unless marked
**[I]** inferred. Static analysis + harness runs only; the running product was never
touched.

## Verdict

**NOT APPLIED.** The same-origin policy is **ON** in the shipped build. The flag block
is real, but it is dead in three independent ways, any one of which alone is sufficient.

Behaviourally confirmed: a page reproducing the product's exact delivery mechanism
**cannot** read cross-origin.

## The string block is real but it is four separate literals

File offset `0x3236aa0` → VA `0x143237ea0`, `.rdata`. Not one blob — six independently
referenced, 8-byte-pooled C literals [M]:

| VA | literal |
|---|---|
| `0x143237ea0` | `QTWEBENGINE_CHROMIUM_FLAGS` |
| `0x143237ec0` | `QTWEBENGINE_REMOTE_DEBUGGING` |
| `0x143237ef8` | `--disable-background-timer-throttling` |
| `0x143237f20` | `--disable-renderer-backgrounding` |
| `0x143237f48` | `--enable-precise-memory-info` |
| `0x143237f68` | `--disable-web-security` |

Complete xref set in `.text` — 9 RIP-relative `lea`, 0 absolute pointers [M].

## The traced chain

```
CRT entry 0x140715f90
 └─ main 0x140012cc0                       (argc, argv)  ecx=1, edx=3, r8d=0
     └─ 0x1408d5730                        singleton creator, alloc 0xC0, sole caller
         └─ 0x1408d3ba0                    app-object ctor  ["fn A"]
             0x1408d3c57  [0x143498f74] = 1   clientType
             0x1408d3c64  [0x143498f70] = 3   environment  <-- THE GATE
             0x1408d3c75  dil = ([0x143498f70]==3)   -> passed as arg6 "isProduction"
             0x1408d3cbb  call 0x1409d6500      QCommandLineParser
             0x1408d3dd8  lea rcx,["QTWEBENGINE_CHROMIUM_FLAGS"]
             0x1408d3ddf  call Qt6Core!qunsetenv      <-- env route CLEARED
             0x1408d3de5  [0x143498f70]==3 -> 0x1408d3eef qunsetenv(REMOTE_DEBUGGING)
             0x1408d3f61  call 0x1408d4810 -> 0x1409d55a0   (gate round-trip, no-op)
             0x1408d3fba  call 0x1408d4a20   ["fn B"]  builds the flag list
```

`fn B` = `0x1408d4a20..0x1408d5545`:

```
  list << "--disable-background-timer-throttling"   0x1408d4a5e   unconditional
  list << "--disable-renderer-backgrounding"        0x1408d4d5e   unconditional
  list << "--enable-precise-memory-info"            0x1408d5054   unconditional
  0x1408d533b  cmp dword ptr [0x143498f70], 3
  0x1408d5342  jne 0x1408d53a7          <-- ONLY when environment != production
      0x1408d53aa  list << "--disable-web-security"
      0x1408d5426  call 0x1408d6600      ["fn C"] appends "--disable-web-security" AGAIN
  ==3 falls through: 0x1408d5371 call 0x1408d6920  (3-flag path), jmp past
```

`fn C` `0x1408d6600` and `fn 0x1408d6920` both flatten `argv[] + list` into a fresh
`char**` (malloc + `strcpy_s` per entry), which reaches
`0x140b2a9de call Qt6Widgets!QApplication::QApplication(int&, char**, int)` [M].

### Reason 1 — the gate is hardcoded to production and cannot be moved

`[0x143498f70]` is the environment enum. Value map in the parser at `0x1409d6500` [M]:
`"production"`→3 (`0x1409d834c`), `"gamma"`→2, `"beta"`→1, `"alpha"`→0, anything else →
`qCritical("Invalid environment value specified. value = ")` + `exit(0)`.

`main` hardcodes **3** [M]. Only three writers exist in the whole image [M]:
`0x1408d3c64` (=3 from main), `0x1409d5601` (reads `[0x143498f70]` into `edi` at
`0x1408d483a` and writes it straight back — a no-op round-trip), and the parser.

The parser's option is `--environment` — an 11-char UTF-16 literal at `0x1432574f8`,
description `"Specify environment (alpha, beta, gamma, or production)"` [M]. **Its
registration is itself gated**:

```
0x1409d6b91  movzx r12d, byte ptr [rbp+0x1a8]     ; r12b = arg6 = isProduction
0x1409d7efa  test  r12b, r12b
0x1409d7efd  jne   0x1409d7ff3                    ; skips --environment + 16 other options
0x1409d7f03  lea   rdx, [rbp-0x18]                ; --environment
0x1409d7f07  call  addOption
```

Production ⇒ `--environment` is never registered ⇒ `process()` rejects it as unknown.
The gate is unreachable from outside the binary. This is consistent with, and extends,
W37's argv-injection verdict.

### Reason 2 — argv-appended switches never reach Chromium at all

QtWebEngine 6.9.2 `WebEngineContext::initCommandLine` at `0x180300a42`
(`Qt6WebEngineCore.dll`) [M]:

```
0x180300a85  QCoreApplication::arguments()
0x180300b36  r15 = QStringList_indexOf(args, QRegularExpression("--webEngineArgs"))
0x180300b5a  qEnvironmentVariableIsSet("QTWEBENGINE_CHROMIUM_FLAGS")
   set   -> args = args.mid(0,1) + parseEnvCommandLine(env)
            if r15 > -1: qWarning("Note 'webEngineArgs' are overridden by QTWEBENGINE_CHROMIUM_FLAGS")
   unset -> 0x180300d04  if (r15 > -1) use the args AFTER the separator
                         else 0x180300d7c  args = args.mid(0,1)   <-- EVERYTHING DROPPED
```

The separator literal is `--webEngineArgs` (UTF-16 at `0x188b55100`, 15 chars) [M].
**`WickrPro.exe` contains no `webEngineArgs` string anywhere — neither ASCII nor
UTF-16** [M]. So its appended flags always land in the `args.mid(0,1)` case and are
discarded. This kills the three "unconditional" flags too — they are inert in every
build, production or not.

### Reason 3 — the one route that does work is explicitly cleared

`qunsetenv("QTWEBENGINE_CHROMIUM_FLAGS")` at `0x1408d3dd8`, unconditional, on the
straight-line path of the app-object constructor [M]. There is no `qputenv` of that
name anywhere in the image — the sole xref is the `qunsetenv` [M].

## Behavioural confirmation

Harness `scratch/w39/sopprobe.c` (built from the W31/W20 pattern: `LoadLibrary` of the
shipped Qt DLLs, `QGuiApplication(int&, char**, int)`, real `WebEngineView`). Page at
`http://127.0.0.1:8595/` runs

```js
fetch('http://127.0.0.2:8581/secret')      // origin B sends NO Access-Control-Allow-*
```

Server `scratch/w39/sopsrv.py`; both origins loopback; nothing left the machine.

| mode | delivery | Qt `arguments()` | SOP | `performance.memory` |
|---|---|---|---|---|
| `bare` | none | 1 | ENFORCED | BUCKETIZED |
| `prod` | **argv + the 3 shipped flags (product form)** | 4 | **ENFORCED** | BUCKETIZED |
| `nonprod` | **argv + 5 flags incl. 2× dws (product non-prod form)** | 6 | **ENFORCED** | BUCKETIZED |
| `realcmdline` | flags on real command line | 1 | ENFORCED | BUCKETIZED |
| `passthru` | real unmodified argv incl. flag | 4 | ENFORCED | BUCKETIZED |
| `env` | `QTWEBENGINE_CHROMIUM_FLAGS=--disable-web-security` | 1 | **DEFEATED** | BUCKETIZED |
| `envmem` | env = the 3 shipped flags | 1 | ENFORCED | **PRECISE** |
| `sep` | argv = `--webEngineArgs --disable-web-security --enable-precise-memory-info` | 4 | **DEFEATED** | **PRECISE** |

Exact results:

- **ENFORCED** — `fetch` rejects with `TypeError: Failed to fetch`; XHR throws
  `NetworkError: Failed to execute 'send' on 'XMLHttpRequest': Failed to load
  'http://127.0.0.2:8581/secret'.`
- **DEFEATED** — `fetch_status 200`, `fetch_type "basic"`,
  `fetch_body "W39_CROSS_ORIGIN_SECRET_5f31a7c2"`, and the request arrives at origin B
  with **no `Origin` header** — the signature of disabled web security.
- Memory oracle validated by `envmem`: bucketized `10000000/10000000/delta 0` vs
  precise `507221 -> 7197273, delta 6690052`.

`prod` and `nonprod` reproduce the product's delivery byte-for-byte and both enforce
SOP. `sep` differs from `nonprod` only by the separator token and flips both flags on —
so the negative is a property of the delivery, not of the harness.

UA in all runs: `QtWebEngine/6.9.2 Chrome/130.0.0.0`.

## Secondary finding: `--enable-precise-memory-info`

Also **NOT APPLIED**, and for reason 2 it never was — measured BUCKETIZED in `prod`,
i.e. in the exact shipped configuration. Not reportable as a live weakness. Worth one
line to the vendor only as "this flag list has never had any effect".

## Impact on the existing report

Nothing changes. W35's cross-origin read via CVE-2026-11645 **remains the only
demonstrated path to cross-origin data** in this product; it is not superseded by a
cheaper configuration defect, because there is no configuration defect. Do not reframe
it.

## What to tell the vendor (low severity, defensive)

The `--disable-web-security` literal ships inside the production binary and is one
build-configuration constant away from being live: flip `main`'s hardcoded environment
argument from 3 and the flag is appended. Today two further accidents (no
`--webEngineArgs` separator, and the `qunsetenv`) prevent it from taking effect — but
the second of those is the same line that would make the flag work if someone ever
"fixed" the delivery. Recommend removing the `--disable-web-security` append entirely
rather than relying on the environment gate, and keeping the `qunsetenv` — the latter is
a genuinely good hardening measure (it also stops an attacker who can set the victim's
environment from turning SOP off, which the `env` row above shows would otherwise work).

## Artifacts

`scratch/w39/` — `sopprobe.c` / `.exe`, `sopsrv.py`, `run.ps1`, `run2.ps1`,
`sop-hits-*.log`, `probe-*.out`, `srv-*.out`; static tooling `peutil.py`, `fn.py`,
`dz.py`, `xref.py`, `gref.py`, `qwec.py`, `peutil2.py`/`fn2.py`/`dz2.py` (for
`Qt6WebEngineCore.dll`); disassembly dumps `fA.txt`, `fB.txt`, `fC.txt`, `setter.txt`,
`q2.txt`.
