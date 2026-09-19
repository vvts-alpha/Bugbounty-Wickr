# W8 CRUX — QtWebEngine command line, the image-decode probe, and the component version pin

Date 2026-07-31. Target: **AWS Wickr Desktop 6.72.20.0 (Windows x64)**.
Binaries: `E:\tmp\wickr\desktop\binaries\` and the installed tree
`C:\Users\mwgn-\AppData\Local\Programs\Amazon Web Services, Wickr\AWS Wickr\`.

Three threads ran in parallel, each with an independent adversarial verifier that re-derived the
decisive bytes with its own tooling rather than re-reading the first agent's:

* **A — websec**: does `--disable-web-security` reach the renderer in a default install?
* **B — imgprobe**: rebuild the image-decode probe with a liveness counter (`imgprobe4`).
* **C — versions**: pin libwebp / PDFium, characterise the Qt build, audit the crypto.

**RoE respected throughout.** Everything below is static disassembly, string/byte extraction over the
on-disk tree, or offline stub generation. `WickrPro.exe` was never launched, no call was placed, no
network traffic was generated, nothing in the installed tree was modified. `imgprobe4.exe` was run
twice with no target present (`find_target()` returned nothing, `OpenProcess` never reached) and once
in `--dumpstubs` mode, which returns before any process handle is opened.

**Labels.** CONFIRMED = disassembled or measured (which one is stated). INFERRED = reasoned from
CONFIRMED facts plus outside knowledge. REFUTED = shown false. Harness-supplied conditions travel
with the result as qualifiers.

**Re-verified by this note's author, from the shipped bytes, before writing** (`pefile`, raw section
read; every one matched what the thread claimed):

```
WickrPro.exe        0x1408d533b  833d2e3cbc0203 7563          cmp [rip+0x2bc3c2e],3 / jne
WickrPro.exe        0x140012d70  ba03000000 b901000000        mov edx,3 / mov ecx,1
WickrPro.exe        0x1408d3c64  89350653bc02                 mov [rip+0x2bc5306],esi
Qt6WebEngineCore    0x180300ae5  beffffffff                   mov esi,0xffffffff
Qt6WebEngineCore    0x180300d04  443bfe 7e73                  cmp r15d,esi / jle 0x180300d7c
Qt6WebEngineCore    0x1803031a0  488d0555218508 c3            -> "6.9.2"
Qt6WebEngineCore    0x180303180  488d0599218508 c3            -> "130.0.6723.192"
Qt6WebEngineCore    0x180303170  488d05b9218508 c3            -> "139.0.7258.67"
qwebp.dll           0x18006bc06  33c9 4d8be0 448bfa e82dfbffff   xor ecx,ecx (root_table=NULL) / call
qwebp.dll           0x18006b84e  4885db 740d 413bd1 0f8d3f030000 66890c53
WickrPro.exe        0x140c1516f  4533c0 488d55c7 488d4daf ff15f8101400
WickrPro.exe        0x140c15330  4533c0 488d55c7 488d4daf ff15370f1400
```

---

## 1. `--disable-web-security` — NO. It does not reach the renderer.

**One-line answer: NO — in a default shipped install the flag is never appended, and even when it is
appended it is discarded by Qt before `base::CommandLine` exists.** CONFIRMED by disassembly, twice
independently.

**The deciding instruction, Wickr side:**

```
0x1408d533b:  83 3d 2e 3c bc 02 03      cmp dword ptr [rip+0x2bc3c2e], 3     ; -> 0x143498F70
0x1408d5342:  75 63                     jne 0x1408d53a7                      ; NOT taken when env==3
```

`0x143498F70` is a four-valued *environment* enum (alpha=0, beta=1, gamma=2, production=3). `jne`
taken ⇒ `--disable-web-security` (`0x143237f68`) is constructed and appended at `0x1408d53a7`–
`0x1408d53c8`. In a default launch it is **not** taken. — CONFIRMED (disassembled; polarity
re-derived independently by the verifier and by me).

Default = 3 is planted by `main`:
`0x140012d70 ba03000000 mov edx,3` → `0x1408d574a mov esi,edx` → `0x1408d3bc2 mov esi,r8d` →
`0x1408d3c64 89350653bc02 mov dword ptr [rip+0x2bc5306], esi` → `0x143498F70 = 3`, which executes
*before* the option parser at `0x1409d6500`. — CONFIRMED (disassembled).

**Nothing remote can move that global.** A full `.pdata`-bounded scan of `WickrPro.exe` (rule 6 — no
linear sweeps) finds exactly six writes: the one above, the four `--environment` immediates
(`0x1409d834c`=3, `0x1409d84ed`=2, `0x1409d8526`=1, `0x1409d8556`=0), and `0x1409d5601`, which the
verifier proved by frame arithmetic is a write-back of the value already read at `0x1408d483a`.
Zero address-taken (`lea`) references; a raw image-wide search for the 8-byte pointer `0x143498f70`
returns 0 hits, so there is no data-driven writer either. The `.data` initialiser is `04 00 00 00`
and is dead. — CONFIRMED (measured, verifier's own scanner).

**The deciding instruction, Qt side** — this one holds *even if* the operator passes
`--environment alpha`:

```
0x180300d04:  44 3b fe                  cmp r15d, esi            ; r15 = indexOf("--webEngineArgs"), esi = -1
0x180300d07:  7e 73                     jle 0x180300d7c          ; taken
0x180300d7c-0x180300d9b:                appArgs = appArgs.mid(0, 1)     ; program name only
```

in `Qt6WebEngineCore!initializeCommandLine`. `esi` is `-1` from the function's only write to it
(`0x180300ae5 beffffffff`, non-volatile, verified across all 268 instructions of the function), and
`r15` is the `QtPrivate::QStringList_indexOf` result for UTF-16 `"--webEngineArgs"` (`0x188b55100`).
The reduced one-element list is what is converted with `QString::toStdWString` at `0x1803010e4` and
handed to `base::CommandLine`. — CONFIRMED (disassembled, both agents, byte-exact).

`"--webEngineArgs"` occurs in **exactly one file in the entire 1.34 GB installed tree** — 
`Qt6WebEngineCore.dll` itself (1 ASCII + 1 UTF-16). `WickrPro.exe`: zero, both encodings.
— CONFIRMED (measured, whole-tree byte scan run twice by two agents).

**Route (a), the environment variable, is separately dead.** `"QTWEBENGINE_CHROMIUM_FLAGS"`
(`0x143237ea0`) has exactly one code reference in the binary, `0x1408d3dd8 lea rcx,[rip+0x29640c1]`,
and the very next instruction is `0x1408d3ddf call qword ptr [rip+0x47fd43]` →
`Qt6Core!qunsetenv`. Straight-line, no inbound branch. This also scrubs any attacker-planted value
out of the process environment. — CONFIRMED (disassembled; import resolved from the import
directory, not guessed).

**Route (c), an operator-supplied `--webEngineArgs`, is closed by a mechanism the first agent never
examined.** In non-production the argv builder `0x1408d6600` *prepends the real argv*, so a
user-supplied `--webEngineArgs` **would** appear in `QCoreApplication::arguments()`, `r15` would be
≥ 0, and Qt would take the *erase* arm at `0x180300d09` instead of `mid(0,1)` — delivering the flag.
What actually forecloses it: `WickrPro` calls `QCommandLineParser::process` at
`0x1409d8025 ff15b5bd3700` with the real argv; `Qt6Core!process` (`0x18024efb0`) does
`0x18024efe0 test al,al` / `0x18024efe2 je 0x18024f265`, and that arm is compiler-proved noreturn
(`0x18024f2f9 call 0x18024faf0` then `0x18024f2fe cc`), with `api-ms-win-crt-runtime!exit` reached at
`0x18024fa91`/`0x18024fae9`. An unrecognised `--webEngineArgs` **kills WickrPro before QtWebEngine
initialises**. — CONFIRMED (disassembled by the verifier). *The negative is stronger than the thread
argued, but the argument as first written had a hole.*

### 1.1 Corrections that ride with this answer

* **REFUTED**: "RTTI on the vtable at `0x140b2a9ec` resolves to `.?AVWickrApplication@@`". It resolves
  to `.?AVSingleApplication@@` (COL `0x1432fa3a0` → TypeDescriptor `0x1434b91b0`). `WickrApplication`'s
  vtable is `0x143299640`, installed later by the derived ctor at `0x140b2b0a9`. The *conclusion*
  (the long-lived instance is a `WickrApplication`) stands; the quoted instruction did not support it.
  This is exactly the rule-1 error this engagement keeps paying for.
* **REFUTED (scope)**: "same-origin policy is ON" over-reaches. What is established is that
  **the `--disable-web-security` switch is not present in `base::CommandLine`**. Per-profile/per-view
  state (`LocalContentCanAccessRemoteUrls`, `LocalContentCanAccessFileUrls`,
  `AllowRunningInsecureContent`, custom `QWebEngineUrlScheme` registrations without
  `SecureScheme`/`CorsEnabled`) was **not audited**. Supporting-but-not-conclusive datum: none of
  those names occurs anywhere in `WickrPro.exe` in either encoding — but QML compiled into
  `.qmlc`/`.rcc` could carry property assignments that do not survive as plain strings.
* **REFUTED (reason, not conclusion)**: the residual claiming Qt accepts `-environment` "by default".
  Qt's default is `ParseAsCompactedShortOptions`; Wickr explicitly sets `ParseAsLongOptions`
  (`0x1409d6844 edi=1` → `0x1409d690b call [rip+0x37d4a7]` = `setSingleDashWordOptionMode`).
  Spelling is stable; the stated reason was wrong.
* Polarity note: `0x1408d3f66 cmp [rip+0x2bc5003],3` / `0x1408d3f6d jne 0x1408d3fb1` guards the
  *transient* error-dialog `QApplication` for **production only** — the opposite of the natural
  reading of "gated by".

### 1.2 Two by-products worth a numbered line in the vendor report

1. **Hardening, local precondition.** `--environment alpha|beta|gamma` makes WickrPro `qputenv`
   `QTWEBENGINE_REMOTE_DEBUGGING` = 3001/3002/3003 (or the `--headlessport` value) at
   `0x1408d3e50`/`0x1408d3ee7`, and Qt then appends `--remote-allow-origins=*` (`0x188b55240`) at
   `0x180300fc8` when no allow-origins switch was supplied. A DevTools endpoint with wildcard
   origins. Requires local command-line control, so it is a hardening finding, not a remote one.
   — CONFIRMED (disassembled). Production explicitly `qunsetenv`s it at `0x1408d3ef6`.
2. **Functional defect in the vendor's favour.** `--disable-background-timer-throttling`
   (`0x143237ef8`), `--disable-renderer-backgrounding` (`0x143237f20`) and
   `--enable-precise-memory-info` (`0x143237f48`) are appended *unconditionally* at
   `0x1408d4a5e`/`0x1408d4d5e`/`0x1408d5054` with no inbound branches — and are discarded by the
   same `mid(0,1)`. Their intended behaviour is not in effect. — CONFIRMED (disassembled).
   Report the whole scheme as **"currently inert, one line of code away from live"**, not as
   "safe by design": adding `--webEngineArgs` to the injected argv would revive the three throttling
   flags immediately; `--disable-web-security` would additionally still need `env != 3`.

**This is a good result, not a disappointment.** It closes a live worry at its root: the stale
Chromium 130 base is *not* running with the same-origin policy switched off, and remote debugging is
off by default. The web-engine exposure is the ordinary one for a browser engine rendering
remote-influenced content — which is precisely what §4 re-prioritises around.

---

## 2. The image probe: what it now makes decidable, and the three-way rule

### 2.1 Why Wave 3's "P1 image lead CLOSED, three probes, zero hits" does not stand

**REFUTED, on one measured ground and one weakened ground.**

* **Measured, survives adversarial review — the coverage gap.** `WickrPro.exe` has **nine** call
  sites to `Qt6Gui!QImage::loadFromData(const QByteArray&, const char*)` (IAT slot `0x140d56278`,
  the only `loadFromData` symbol WickrPro imports). **Four** pass `format = NULL`, i.e. the decoder
  is chosen by content sniffing on attacker-supplied bytes:
  `0x1400c2d4d`, `0x1409f754b`, `0x140c1517a`, `0x140c1533b` (each preceded by its own
  `4533c0 xor r8d,r8d`). The other five `lea r8,[rip+…]` → `"PNG"` (`0x140e3edf8`, ×2) or `"JPG"`
  (`0x14324b0a0`, ×3). `imgprobe.c`'s `SITES[]` table (lines 45–48) contains **two** entries,
  RVA `0x0c2d4d` and `0x9f754b`. The two it never hooked, `0x140c1517a` and `0x140c1533b`, both sit
  inside `0x140c14f70` — a `QNetworkReply` completion handler (calls `QNetworkReply::attribute`
  `0x140c15004`, `QNetworkReply::error` `0x140c1508e`/`0x140c150b5`, an HTTP 200–299 gate at
  `0x140c1512a lea eax,[rsi-0xc8]` / `cmp eax,0x63`) that parses OpenGraph tags (`"site_name"`
  `0x1432bcfc8`, `"image:url"` `0x1432bcfd8`) and hands the freshly downloaded member `QByteArray`
  at `[rdi+0x188]` straight into a content-sniffed decode, then `scaledToWidth` + re-encode as PNG.
  **This is the first-fetch link-preview path, in the unsandboxed main process, and no Wave 3 probe
  covered it.** — CONFIRMED (disassembled and IAT-xref'd by both agents independently).
* **Weakened — the liveness claim as originally written is wrong.** The thread asserted that none of
  `imgprobe.c` / `imgprobe2.c` / `imgprobe3.c` contains a liveness counter. They all do: an
  unconditional `F0 44 0F C1 18 lock xadd dword [rax], r11d` at the *top* of every stub
  (`imgprobe.c:105`, `imgprobe2.c:79`, `imgprobe3.c:115`). — **REFUTED** (read the sources).
  `imgprobe3`'s counter sits on `QImageReader::read`, which fires on purely local decodes, so it
  functionally *is* a liveness control — which is why the "imgprobe3 never armed" argument is
  coherent at all. What Wave 3 actually lacked is a **forced local control event**, a **pre-stated
  decision rule**, and **per-site granularity**. Rule 7 still bites, but for a narrower reason than
  claimed.

`QImage::loadFromData` does funnel through `QImageReader::read(QImage*)` — chain disassembled:
`0x18000507a call 0x180042690` → `0x18004270d call 0x180059c10` (`QImageReader` ctor) →
`0x180042719 call 0x18005c6e0` → `0x18005c702 call 0x18005c7a0`. So `imgprobe3`'s funnel hook
*would* in principle have covered the network path; the missing call sites are a gap in
`imgprobe.c` only. — CONFIRMED (disassembled).

One label correction: calling the two hooked sites "the cache re-load path, would not fire for a
fresh link" is **REFUTED for `0x1409f754b`**. Its enclosing function `0x1409f7300` contains
`QByteArray::fromStdString`/`toStdString` (bytes handed up from the C++ SDK download layer) and
`"PINNED LINK IMAGES DOWNLOAD: could not load images, hash mismatch."` (`0x14325b4e0`) — a
download-completed slot doing hash verification, i.e. a first-fetch path for pinned-link images.
Only `0x1400c2d4d` (in `0x1400c29c0`, whose imports contain no network or SDK-download call) is
plausibly the re-load path. The *gap* finding survives; the stronger framing does not.

### 2.2 What `imgprobe4` makes decidable

`E:\tmp\wickr\scratch\w3\lead\imgprobe4.c` — 11 byte-verified detours (7 in `Qt6Gui.dll`, 4 in
`WickrPro.exe`), each carrying an **unconditional per-site `F0 48 FF 00 lock inc qword [rax]` in
target memory as the first instruction of the stub**, ahead of everything skippable. That is the one
thing Wave 3 could not do: **a zero is now interpretable.**

Instrument quality — CONFIRMED, and re-verified adversarially:

* All 11 windows byte-checked against the shipped images; RVAs pulled from `Qt6Gui`'s **export table
  by mangled name**, not guessed. Prologues: `0x5c7a0 4055564156`; `0x5ba00 / 0x5040 / 0x59ba0 /
  0x59c10 / 0x5d760 / 0x58740` all `48895c2408`.
* Independent per-`.pdata` branch-into-window scan over **both whole images** (rule 6; Qt6Gui 29 498
  functions / 1 580 597 instructions, WickrPro 39 032 / 3 161 914): **zero** branches target a byte
  strictly inside any of the 11 windows. The only hits land on a function's first byte, where the
  `E9` goes. The 5/6-byte splice is safe.
* Emitted machine code disassembled offline via `--dumpstubs`: `lock inc` genuinely first and
  unconditional; the two `je` (0x5d, 0x48) and four `jl` (0x3e, 0x2c, 0x1a, 0x08) displacements all
  converge on one join address; only `rax`/`r10`/`r11` written; nothing pushed; back-targets
  `site+6` (W) / `site+5` (Q). Flags are clobbered but dead at both site kinds. Argument registers
  correct for the MSVC x64 ABI, **including** the non-obvious sret case at Q2
  (`QImageReader::imageFormat` returns `QByteArray` by value ⇒ `RCX` is the hidden return pointer and
  the `QIODevice*` is in `RDX`; the probe reads `RDX`, verified against `0x18005ba00 mov rbx,rdx`).
* Reads every site out of the **live** process and `memcmp`s against `orig` before patching, refuses
  on mismatch, reads the patch back after arming, `--unhook` refuses anything that is neither
  original nor an `0xE9` patch, and `L()` flushes stdout and the log on every line.
* `sha256 eccafde833d34386c859d6548e922649c2f58cd15f82998c8bd2966219341dbd` — the binaries-dir
  `WickrPro.exe` and the installed one are the same image, so the statically verified bytes apply.
* Deliberate, documented blind spot: the *protected* `QImageIOHandler` ctor at Qt6Gui RVA `0x58720`
  begins `48 8d 05 11 bc 5f 00` (7-byte rip-relative `lea`) and has no `.pdata` entry — unhookable
  with a 5-byte `E9`. Handlers using it are still counted by Q1/Q2 but not *named* by Q7.

### 2.3 MUST FIX BEFORE THE OPERATOR RUNS IT TO A VERDICT

Four defects in the decision logic and one undisclosed hazard. The instrument is safe to *arm*; the
printed verdict is not yet trustworthy.

1. **The verdict branch is fed by the `classify_path` keyword heuristic.** `imgprobe4.c:1002`
   `else if(remote==0 && cls[K_REMOTE]==0)` → VERDICT (i), else → VERDICT (iii). `classify_path`
   (line 651) returns `K_REMOTE` on any lowercase substring in
   `{attach, cache, preview, avatar, appdata, temp, download, thumb}`. **One local file under
   `C:\Users\…\Downloads` flips the whole run to REFUTED** — and the runbook's own liveness step
   ("drag a local .png into the compose box") is very likely to stage under such a path, i.e. the
   liveness check can self-trigger the verdict. Additionally, `id == ID_Q3` with a *known* caller
   sets `k = K_REMOTE` regardless of `sniff` (line 859), so a plain `format="PNG"` favicon decode
   reaches (iii), whose printed text then asserts the sender chooses the decoder even when
   `sniffhits == 0`. **Rule 2 failure: the verdict is not gated on the invariant under test.**
2. **The headline remote count triple-counts.** Lines 1013–1014 print `remote + cls[K_REMOTE]`. One
   W-site decode increments `remote` (per-site counter), `cls[K_REMOTE]` for the W record, and
   `cls[K_REMOTE]` **again** for the Q3-via-trampoline record (line 866 sets `k = K_REMOTE`, line 901
   does `cls[k]++` unconditionally). A single decode is reported as 3.
3. **`LIVENESS` is the sum of all eleven counters, including the four remote-by-construction W
   sites**, so the printed aggregate is not itself a local control. The honest statistic is a
   separate `LIVENESS_LOCAL = Q1..Q7`. The per-site array *is* printed in the heartbeat, so an alert
   operator can compute it by hand — see the rule below, which does exactly that.
4. **UNDISCLOSED HAZARD — tell the operator before they send anything designed to crash a decoder.**
   The four W stubs execute `call [rax]`, so the **entire Qt decode runs with a return address in a
   `VirtualAllocEx`'d page that has no `RUNTIME_FUNCTION` and no `RtlAddFunctionTable`
   registration**. If a C++ exception unwinds out of `QImage::loadFromData` — `std::bad_alloc` on an
   oversized image, or anything PDFium raises, i.e. *exactly* the inputs the runbook's step 3(5)
   tells the operator to send — `RtlLookupFunctionEntry` returns NULL, the unwinder applies the leaf
   rule, pops 8 bytes off WickrPro's live frame and yields a bogus RIP. That can kill or corrupt the
   operator's client, **and the tool's own death banner would misattribute it to "a decoder may have
   crashed it."** Wave 3's `imgprobe.c` has the same flaw, so it is not a regression — but the
   "READ-ONLY, nothing is altered" framing does not cover it.
5. Latent bound: `uint8_t sb[512]` (lines 669, 770) with an `if(n > 0x400)` guard (lines 677, 773),
   and at 773 the guard runs *after* `build_stub` has already written into `sb`. Measured max stub is
   255 bytes, so no overflow with the current table — but the guard cannot catch what it purports to.

### 2.4 THE EXACT THREE-WAY RULE — fixed before measuring, applied to the raw per-site counters

The operator reads the **per-site liveness array from the heartbeat**, not the tool's printed verdict
banner (see §2.3.1–2.3.3), and computes two numbers:

```
LIVENESS_LOCAL  = Q1 + Q2 + Q3 + Q4 + Q5 + Q6 + Q7      (Qt6Gui funnel sites)
REMOTE          = W1 + W2 + W3 + W4                      (the four format=NULL loadFromData
                                                          call sites — remote by construction)
```

Then, in this order:

* **(ii) `LIVENESS_LOCAL == 0` → NO DATA.** The probe never fired. This is **not** a negative and
  must not be written down as one. Redo the run, doing the deterministic local decode first
  (runbook step 2: drag a local PNG into the compose box). If that still yields zero, the arming
  failed — investigate the loader, not the target.
* **(i) `LIVENESS_LOCAL > 0` **and** `REMOTE == 0` **and** no record whose buffer provenance is
  remote **by inspection of the record itself** (source path, `QIODevice` vtable, caller id) →
  **the Wave 3 negative is REAL, and for the first time supported**, because the hooks demonstrably
  fired. Qualifier that travels: *for the observation window and the actions performed*; Qt Quick
  caches decoded pixmaps, so a short window opened after startup can legitimately miss decodes.
* **(iii) `REMOTE > 0` → REFUTED.** Remote bytes are decoded in the unsandboxed main process. If the
  record shows `format = NULL`, **the sender, not the app, chooses which decoder parses the bytes.**
  Count decodes as the **W-site counter sum**, never as the record count (§2.3.2). A `classify_path`
  `K_REMOTE` hit **alone** is advisory only and must **not** flip the verdict — it exists to draw the
  operator's eye, and it fires on ordinary local paths.

**The single highest-value action is runbook step 3(1): send a URL with an OpenGraph image from a
second account and watch for W3/W4.** Those are `0x140c1517a` and `0x140c1533b` — the two sites no
Wave 3 probe's call-site table ever covered, inside the live `QNetworkReply` handler.

**A W3/W4 hit whose Q7 record names `qpdf` or `qwebp` as the selected plugin is the finding.** See
§4.2 — that is content-sniffed remote bytes reaching PDFium or libwebp inside the unsandboxed main
process.

**Status: NOBODY HAS RUN IT AGAINST A TARGET.** The three-way verdict is unresolved. What Wave 8
delivers here is a measuring instrument plus a refutation of the old negative's soundness — not a new
positive. `P1 image surface is live in the unsandboxed main process` remains **INFERRED**, and is
deliberately not claimed.

---

## 3. Component versions, and CVE-2023-4863 stated plainly

### 3.1 CVE-2023-4863 (`BuildHuffmanTable` heap overflow) — **NOT VULNERABLE. The fix is present.**

CONFIRMED by disassembly, not by version inference, in **both** copies of libwebp in the tree.

`imageformats\qwebp.dll` (found by locating libwebp's constant tables — `kTableSize` @ `0x180072658`,
`kAlphabetSize` @ `0x1800725b0`, `kCodeLengthCodeOrder` @ `0x1800725c8` — and following the
rip-relative xrefs):

* `VP8LHuffmanTablesAllocate` **exists** at `0x18006bd40` — a function that does not exist in
  libwebp ≤ 1.3.1. Struct layout matches
  `HuffmanTablesSegment{start+0, curr_table+8, next+0x10, size+0x18}` / `HuffmanTables{root+0,
  curr_segment+0x20}` exactly (`0x18006bd50 mov [rdx+0x20],rdx`, `0x18006bd57 mov qword [rdx+0x10],0`,
  `0x18006bd85 mov [rbx+0x18],edi`). `ReadHuffmanCodes` @ `0x18000f520` calls **it**, not
  `WebPSafeMalloc` directly (`0x18006bd40` reached from `0x18000f5d8`).
* `VP8LBuildHuffmanTable` @ `0x18006bbd0` performs **the added sizing dry run** before anything is
  written:
  `0x18006bbfd mov qword [rsp+0x20],0` (`sorted = NULL` — the *outgoing* 5th-arg slot, shadow space
  is `[rsp..rsp+0x20]`) / `0x18006bc06 33c9 xor ecx,ecx` (`root_table = NULL`) /
  `0x18006bc0e call 0x18006b740`; then `test eax,eax` / `je` → return 0 on invalid input.
  Capacity test `0x18006bc3e 4c3bc1 cmp r8,rcx` / `0x18006bc41 725a jb` (**jb = fits, skip the
  allocation** — polarity re-derived) and the `0x200` `SORTED_SIZE_CUTOFF` at `0x18006bc9d`.
* `BuildHuffmanTable` @ `0x18006b740` takes the 5th `sorted` argument at `[rsp+0x130]`
  (`0x18006b769 mov rbx,[rsp+0x130]`; arithmetic: entry offset `0x28` + 7 pushes `0x38` + frame
  `0xd0` = `0x130` — **derived, not assumed**) and handles `sorted == NULL`:
  `0x18006b84e 4885db test rbx,rbx` / `740d je 0x18006b860` (the `je` still runs `offset[len]++`).
* The pre-fix path — a single unvalidated `BuildHuffmanTable` writing straight into a fixed
  `kTableSize`-sized block — is **not present anywhere in the image**.

**A second libwebp lives inside `Qt6WebEngineCore.dll`** and the first agent never noticed it; the
product-level verdict was therefore asserted past the evidence. The verifier chased it (constant
tables @ file offsets `0x9cbdd58`/`0x9cbdcb0`/`0x9cbdcc8`) and it is **patched identically**:
`VP8LHuffmanTablesAllocate` @ `0x18515a720`, dry run @ `0x18515a5ed`/`0x18515a5f6`,
`sorted != NULL` split @ `0x18515a23e`. **The verdict stands — but by the verifier's method, not the
thread's.** Carry that forward as a method lesson: *the Chromium blob shadows a copy of nearly every
codec in the tree, so a per-directory enumeration will always miss one.*

**The exact libwebp version could not be established from the bytes.** `qwebp.dll` carries no version
string at all and `WebPGetDecoderVersion` was dead-code-eliminated (a sweep for `B8 imm32 C3` found
18 hits, imm ∈ {1, 2, 9} — no version-shaped constant). **Floor ≥ 1.3.2 CONFIRMED; 1.5.0 INFERRED**
from libwebp's own AVX2 DSP modules being present and CPU-dispatched — `0x18002a07d xor ecx,ecx`
(kSSE2=0) / `mov ecx,3` (kSSE4_1) / `mov ecx,5` (kAVX2) around `VP8GetCPUInfo`, which rules out MSVC
autovectorisation. The mapping "*_avx2.c arrived in 1.5.0" comes from release history, not from
these bytes. A byte-level corroboration the verifier added: the AVX2 cascade is present in
`qwebp.dll` and **absent** from `Qt6WebEngineCore.dll`'s copy, so Qt's qtimageformats libwebp is a
*newer snapshot* than Chromium 130's DEPS pin.

Two attribution caveats, neither affecting the verdict:
* The extra bound in `BuildHuffmanTable` — `0x18006b853 413bd1 cmp edx,r9d` / `0f8d3f030000 jge`
  → return 0, guarding the `sorted[]` write — is **not** in upstream 1.3.2, whose `sorted` write is
  unguarded. Whether it is later upstream hardening or a Qt/Chromium patch **could not be established
  from the bytes**. Calling all four components "the complete upstream 1.3.2 remediation" is a
  slight overstatement; the *description* of what each instruction does is accurate.
* "No other known-exploited libwebp CVE is outstanding" is **INFERRED** — it rests on advisory
  knowledge, not on these bytes.

### 3.2 Version table

| Component | Version | Label | Basis |
|---|---|---|---|
| WickrPro.exe | 6.72.20 | CONFIRMED | VS_VERSIONINFO ProductVersion; PDB path `…\clients\enterprise-app\WickrPro.pdb` |
| Qt / QtWebEngine | **6.9.2** | CONFIRMED | `?qWebEngineVersion@@YAPEBDXZ` @ `0x1803031a0` = `488d0555218508 c3` → `"6.9.2"`; also `r9d = 0x60902` at the `QApplication` ctor |
| Chromium base | **130.0.6723.192** | CONFIRMED | `?qWebEngineChromiumVersion@@` @ `0x180303180` → `"130.0.6723.192"` |
| Chromium security-patch ceiling | **139.0.7258.67** | CONFIRMED **as a string**; **INFERRED / unverified as a patch state** | `?qWebEngineChromiumSecurityPatchVersion@@` @ `0x180303170`. **This is Qt's own claim about their tree. No individual post-130 CVE fix was tested.** |
| PDFium (`Qt6Pdf.dll`) | **no version exists upstream — cannot be pinned from the bytes** | CONFIRMED (the absence); provenance CONFIRMED | Only source path in the whole DLL: `../../../../../../qt6/qtwebengine/src/3rdparty/chromium/third_party/abseil-cpp/absl/types/bad_variant_access.cc`. Same Chromium snapshot as `Qt6WebEngineCore.dll` — shared `icu_74`, libpng `1.6.43`, zlib `1.3.0.1-motley`. PDFium is DEPS-pinned by Chromium; mapping to a git revision needs Chromium's DEPS, which is not in the tree. RTTI `.P8CJBig2_GRDProc@@…` confirms PDFium presence even though the token "pdfium" appears 0 times. |
| libwebp — `imageformats\qwebp.dll` | **≥ 1.3.2** | CONFIRMED (floor, by disassembly); 1.5.0 INFERRED | §3.1. No version string; version constant DCE'd. |
| libwebp — 2nd copy inside `Qt6WebEngineCore.dll` | ≥ 1.3.2, older snapshot than qwebp's | CONFIRMED | §3.1; found by tree-wide constant-array sweep |
| libjpeg-turbo (`qjpeg.dll`) | 3.0.3 | CONFIRMED | literal `"libjpeg-turbo version 3.0.3 (build )"` @ `0x6e168` |
| libtiff (`qtiff.dll`) | **≥ 4.7.0** (floor; no ceiling) | string CONFIRMED, mapping INFERRED | 4.7.0-only `TIFFOpenOptionsSetMaxCumulatedMemAlloc` diagnostics @ `0x5d080`/`0x5d190`/`0x3aec8`. Sharpens the previously recorded "≥ 4.5.1". `TIFFGetVersion` DCE'd, so no exact literal. A `LIBTIFF` token exists but is the env var `LIBTIFF_STRILE_ARRAY_MAX_RESIZE_COUNT`, not a version. |
| zlib (`qtiff.dll`) | `1.3.1 (Qt)` | CONFIRMED | string |
| zlib (Chromium fork, `Qt6Pdf` + `Qt6WebEngineCore`) | `1.3.0.1-motley` | CONFIRMED | string, one hit each |
| libpng (`Qt6Pdf` + `Qt6WebEngineCore`) | 1.6.43 | CONFIRMED | string, one hit each |
| ICU | 74 (`icu_74`, `icudt74l`) | CONFIRMED | 460+11 hits |
| OpenJPEG + JBIG2 (in `Qt6Pdf.dll`) | present, **unversioned** | CONFIRMED | `opj_*` diagnostics; `JBIG2Decode` / `JBIG2Globals` / `.P8CJBig2_GRDProc@@` |
| `qgif` `qicns` `qico` `qtga` `qwbmp` `qsvg` `qpdf` | Qt's own handlers, no 3rd-party decoder | CONFIRMED | 35–65 KB each, Qt 6.9.2 resource only, absent from the build-path and 3rdparty sweeps. `qpdf.dll` is a 40 KB shim — its import table lists `Qt6Pdf.dll`. |
| `crypto.dll` / `ssl.dll` | **AWS-LC FIPS 2.0.17** (not OpenSSL) | CONFIRMED | literal @ `0x11ecb0`, adjacent `"OPENSSLDIR: n/a"`; 176 paths under `…\aws-lc\openssl-prefix\…`; `ssl/*.cc` (C++ ⇒ BoringSSL lineage) |
| `aws_lc_fips_0_13_14_crypto.dll` | **AWS-LC FIPS 3.3.0** | CONFIRMED | literal @ `0x135498`; 185 paths under `WickrMlsSdk\0.30.8\…\aws-lc-fips-sys-0.13.14\`; export prefix `aws_lc_fips_0_13_14_` |
| `WinSparkle.dll` (auto-updater) | **0.8.0**, built 2023-03-29, static **OpenSSL 1.0.2** | CONFIRMED | VS_VERSIONINFO 0.8.0 + "Copyright (C) 2009-2023 Vaclav Slavik"; 107 paths `D:\a\winsparkle\winsparkle\3rdparty\openssl\crypto\…` |

**WinSparkle's OpenSSL branch is 1.0.2, not merely "pre-3.0"** — CONFIRMED by file-set differential.
PRESENT: `crypto\rand\md_rand.c`, `crypto\mem_dbg.c`, `crypto\asn1\x_long.c`, `crypto\evp\pmeth_fn.c`,
`crypto\x509v3\` (19). ABSENT, zero occurrences each, all 1.1.x-era: `rand_lib.c`, `drbg_lib.c`,
`threads_win.c`, `async.c`, `curve25519.c`, `ecx_meth.c`, `poly1305\`, `chacha\`, `siphash\`,
`blake2\`, `aria\`, `sm2\`, `store\`. `md_rand.c` exists only in ≤ 1.0.2 (deleted in 1.1.0), and no
1.1-era file is present. **EOL 2019-12-31 — roughly 6.5 years past EOL at ship, not 3.** (The
"3-year-old" figure in the thread dated the DLL, not the crypto inside it.) Mitigating qualifier,
measured: WinSparkle imports `WININET.DLL` and `CRYPT32.DLL` and **no** OpenSSL transport surface, so
the network leg runs on Schannel — the stale OpenSSL sits on the **appcast signature-verification
path** (`sparkle#dsaSignature`, `crypto\dsa\{dsa_asn1,dsa_lib,dsa_sign,dsa_ossl}.c`; zero
25519/Ed25519 tokens in any casing, consistent with 1.0.2), parsing attacker-influenced update
metadata. Narrower than it first looks, still an update-integrity concern.

### 3.3 Build stamps — the shape of the dependency tree is the real finding

CONFIRMED by measurement (PE COFF `TimeDateStamp`, UTC; all 15 reproduce):

```
WickrPro.exe                    0x6a555e3a   2026-07-13T21:52:58Z   <- 18 days old
NPL.dll                         0x69011774   2025-10-28T19:20:20Z
Qt6WebEngineCore.dll            0x68caad7c   2025-09-17T12:45:48Z   <- frozen
Qt6Pdf.dll                      0x68cab134   2025-09-17T13:01:40Z   <- frozen
imageformats/qwebp.dll          0x68ca5ac0   2025-09-17T06:52:48Z   <- frozen
crypto.dll                      0x681a4302   2025-05-06T17:12:34Z
aws_lc_fips_0_13_14_crypto.dll  0x69efcdba   2026-04-27T20:57:30Z   <- freshest
WinSparkle.dll                  0x64243e4c   2023-03-29T13:34:04Z   <- oldest
```

Filesystem mtimes are uniformly 2026-07-13T12:55Z (installer-set), so the COFF stamps are the real
build dates. **The application binary is 18 days old; the entire Qt / Chromium / PDFium / image-codec
layer beneath it is a frozen 2025-09-17 build on a Chromium 130 base (M130 ≈ Oct 2024) with a
self-declared backport ceiling of M139 ≈ Aug 2025.** Roughly **eleven months of Chrome security
releases are missing at ship time** unless Wickr backported them, for which no evidence was found.

Wickr builds Qt **from their own tree** — `D:\WickrDesktopQt\qt6\…` appears in `Qt6WebEngineCore.dll`
(73 qtwebengine paths), `Qt6Quick*`, `Qt6Widgets`, `imageformats\qtiff.dll`, and `Qt6Pdf.dll` by
relative path. So *"Qt backports Chromium security fixes into patch releases"* must be checked
against **that 2025-09-17 snapshot**, not against Qt's current release notes.

---

## 4. What this changes about the QtWebEngine / Chromium 130 priority

### 4.1 Scope, stated once

* **The docx-preview XSS finding is OUT OF SCOPE for this note.** It is already reported by the
  operator (`AWS-Wickr-disclosure-docx-preview.md`). Do not re-litigate it, do not re-derive it, and
  do not let it colour the priority calls below.
* **IN SCOPE here: the image and PDF *preview* paths** — content-sniffed `QImage::loadFromData`,
  the `imageformats\` plugin set, and `Qt6Pdf.dll`/PDFium reached through them.

### 4.2 The priority moves in two directions at once

**DOWN — the "renderer is de-anchored" worry.** §1 closes it. The `--disable-web-security` switch is
absent from `base::CommandLine` in a default install, `QTWEBENGINE_CHROMIUM_FLAGS` is `qunsetenv`'d,
and remote debugging is off in production. The Chromium 130 renderer's exposure is **the ordinary
one for a browser engine rendering remote-influenced content**: sandboxed (`QtWebEngineProcess.exe`),
same-origin-policy switch not disabled, and full compromise requires a renderer bug *plus* a sandbox
escape. Stale-Chromium-130 findings against the *renderer* should be written up at that severity —
real, but not "universal XSS by configuration". **Qualifier that must travel: this is a statement
about the switch, not about `QWebEngineSettings` / `QWebEngineUrlScheme` state, which was not
audited (§1.1).**

**UP — the image and PDF preview paths, because they are NOT in that sandbox.** This is the
asymmetry (rule 5, applied at the process level rather than inside one function):

| | Renderer content | Image / PDF preview |
|---|---|---|
| Process | `QtWebEngineProcess.exe`, sandboxed | **`WickrPro.exe`, unsandboxed main process** |
| Decoder chosen by | the app | **the sender**, at the 4 `format = NULL` sites |
| Code age | Chromium 130 + Qt's claimed M139 backports | same frozen 2025-09-17 tree |
| Post-corruption reach | needs a sandbox escape | **none needed — already at app privilege, holding the user's keys** |

`QImage`/`Qt6Gui` decoding runs in `WickrPro.exe`. `qpdf.dll` is an `imageformats` plugin that
forwards to `Qt6Pdf.dll`, i.e. **PDFium — plus OpenJPEG and a JBIG2 decoder, both historically
high-yield PDF attack surfaces — is a library in the unsandboxed main process, not behind the
renderer sandbox.** *(Plugin residency in `WickrPro.exe` is a Wave 3 runtime measurement not
re-verified this wave — INFERRED.)* If a content-sniffed decode can select the PDF handler on a
`%PDF-` buffer, a link-preview fetch reaches PDFium with attacker bytes at app privilege.
**That chain is INFERRED — it follows from Qt's sniffing design, not from these bytes — and it is
exactly what `imgprobe4` exists to settle.** A W3/W4 hit with `format = NULL` and Q7 naming `qpdf`
converts it to CONFIRMED in a single observation.

**Net ordering for the next wave:**

1. **Run `imgprobe4` to a verdict** (after the §2.3 fixes), starting with runbook step 3(1), the
   OpenGraph link-preview send. It is the cheapest way to turn the largest INFERRED claim in this
   note into a measurement, and it targets the two call sites Wave 3 never covered.
2. **Verify one or two specific post-130 PDFium/Blink CVE fixes** against `Qt6Pdf.dll` /
   `Qt6WebEngineCore.dll` the way CVE-2023-4863 was verified here. That is the honest way to
   substantiate or refute Qt's `139.0.7258.67` self-report, and PDFium is the right place to spend it
   because PDFium is the unsandboxed half. `riprefs.py` + `fnat.py` (§6) make this tractable inside
   the 196 MB blob, which was previously the blocker.
3. **libwebp: leave it alone.** Both copies are patched. It is clean.
4. Vendor-report lines that need no further work: the inert flag-injection scheme (§1.2.2), the
   non-production DevTools port with `--remote-allow-origins=*` (§1.2.1), and WinSparkle 0.8.0 with
   OpenSSL 1.0.2 on the update-signature path (§3.2).

---

## 5. Residuals and what was not covered

**Thread A — websec**

* All static. No runtime confirmation. The cheap operator check: attach and dump `base::CommandLine`,
  or simply observe that `--disable-background-timer-throttling` has no effect on background timers.
* The second lock is a property of **this** build (Qt 6.9.2 / Chromium 130.0.6723.192). Earlier Qt
  WebEngine forwarded the whole application command line by default. Report as *"currently inert, one
  line of code away from live."*
* `QtWebEngineProcess.exe` was **not disassembled** by either agent. The helper receives switches
  from the browser process's `base::CommandLine`, which contains only the program name — but that is
  **INFERRED**, not measured. Supporting: whole-tree scan shows `"disable-web-security"` does not
  occur in it at all.
* `QWebEngineSettings` / `QWebEngineUrlScheme` surface **not audited**. Only negative-by-name evidence
  (none of those property names anywhere in `WickrPro.exe`, either encoding); QML compiled to
  `.qmlc`/`.rcc` could hide property assignments.
* The sibling global `0x143498F74` (`clientType`: wickr=1, wickrGov=1 + flags `0x18`, wickrGovADC=1 +
  `0x28`, wickrEnterprise=2, default 1) is compared in many places; **whether it gates anything
  security-relevant was not audited.** Separate question.
* The `-h` / `--v` identification of `r13b`/`r12b` at `0x1409d6895`/`0x1409d689a` is plausible but the
  full option-matching logic was not followed.

**Thread B — imgprobe**

* **Nobody has run it against a target.** The three-way verdict is unresolved.
* The §2.3 defects must be fixed first: `classify_path` feeding the verdict branch, the 3× remote
  count, `LIVENESS_LOCAL`, the `sb[512]`/`0x400` guard — and the operator must be told about the
  **unwind hazard** before sending anything designed to crash a decoder.
* Soft spot in the liveness argument: if Qt Quick has already cached every icon, a short window can
  show `LIVENESS_LOCAL == 0` legitimately. The forced local decode (runbook step 2) exists to
  eliminate this; if it does not move the counter, the run is NO DATA.
* The five explicit-format sites (`"PNG"` ×2, `"JPG"` ×3) also decode remote bytes but with a fixed
  decoder — the sender cannot pick the plugin. They are not separately hooked; they surface only as
  Q3 records.
* Q7 names the selected plugin only for handlers using the **public** `QImageIOHandler` ctor
  (`0x58720`, the protected one, is unhookable — §2.2). A handler using it is counted but unnamed.
* Records produced in the final ~60 ms before a target death are unrecoverable.
* `--unhook` restores site bytes but never `VirtualFreeEx`s the 11 stub allocations (freeing them
  *would* be dangerous), so each arm/unhook cycle leaves 11 RWX regions in the target.
* The **nine call sites** number is scoped: `iatxref` finds direct rip-relative refs inside
  `.pdata`-covered functions of `WickrPro.exe` for slot `0x140d56278`. WickrPro imports exactly one
  `loadFromData` symbol, and `Sock5.dll`/`NPL.dll` import none, so the enumeration is complete **for
  that slot** — it is **not** an enumeration of all routes to a sniffed decode (`QPixmap::loadFromData`,
  direct `QImageReader` use, QML `Image` elements). The Q funnel is the answer to those.
* `imgprobe4`'s `PLUGINS[]` lists 12 (10 in `imageformats\` plus `Qt6Svg.dll` and `Qt6Pdf.dll`);
  "resident in the unsandboxed process" is a Wave 3 runtime measurement **not re-verified** this wave.
* On a failed `read_cstr` of a non-NULL format, `fmtbuf` stays empty and the format line is omitted,
  which reads as "no format info" rather than "format present but unreadable".

**Thread C — versions**

* **Exact libwebp patch level is NOT pinned.** ≥ 1.3.2 is solid; 1.5.0 is a reasoned inference from
  release history. If an exact pin is required: byte-diff `qwebp.dll` `.text` against reference builds
  of 1.3.2/1.4.0/1.5.0/1.6.0 on the same MSVC toolchain, or ask the vendor.
* **PDFium cannot be pinned to a revision from the bytes** — it has no version constant upstream.
  Provenance is established; revision mapping needs Chromium's DEPS, absent from the shipped tree.
* **Qt's `139.0.7258.67` is a self-reported string, not a verified state.** No individual post-130
  Chromium or PDFium CVE fix was tested. This is the single highest-value follow-up (§4.2 item 2).
* libtiff has a floor (≥ 4.7.0) but **no ceiling**.
* Two AWS-LC FIPS modules at different versions (2.0.17 and 3.3.0) load into the same process.
  Symbol collision and which module services which call path were **not checked**; the 3.3.0 module
  namespaces its exports, so a clash is unlikely but unverified.
* **The tree-wide constant-array sweep must be run for the other bundled decoders** (libjpeg-turbo,
  libtiff, libpng, OpenJPEG) before trusting any per-DLL *"the surface is exactly X"* claim. The
  Chromium blob shadows a copy of nearly every codec in the tree; the second libwebp was found this
  way and a per-directory enumeration missed it.
* Attribution of the extra `sorted[]` bound (§3.1) — later upstream hardening vs. a Qt/Chromium patch
  — **could not be established from the bytes**.
* Corrected residual: the second AVX2 init in `qwebp.dll` is at **`0x18002f030`, not `0x18002f03e`**,
  and it **is** called, from `0x18002d6d1 e85a190000` inside a second dispatch cascade at
  `0x18002d697`. The `.pdata`-bounded scan missed it because both AVX2 inits are leaves with no
  unwind entry. This strengthens the ≥ 1.5.0 inference.

**Not covered by any thread this wave:** `QtWebEngineProcess.exe` internals; the `QWebEngineSettings`
/ custom-URL-scheme surface; the `clientType` global's gates; PDF preview reachability *as a
measurement* (only as an inference); any runtime observation of anything.

---

## 6. Artifacts

**Deliverables**

* `E:\tmp\wickr\scratch\w3\lead\imgprobe4.c` — 11 sites, per-site liveness counters, full sample
  logging with flush, target-death detection, ring-overflow reporting, offline `--dumpstubs`,
  `--verify`, `--unhook`. Runbook is section 6 of the source header so it travels with the tool.
  Verdict logic lines 973–1019, `classify_path` 644–656, `build_stub` 513–563, `cap_container`
  472–491 — see §2.3 for the four required edits.
* `E:\tmp\wickr\scratch\w3\lead\buildimgprobe4.bat`, `imgprobe4.exe`.
* `…\scratchpad\paths.txt` (962 lines — every embedded build path in the installed tree),
  `…\scratchpad\trees.txt` (43 lines — 3rd-party trees per binary).

**Tooling worth promoting into `E:\tmp\wickr\scratch\w3\lead\`** (previous tools were hardcoded to
`NPL.dll` / `WickrPro.exe`; these are generic over any PE):

* `riprefs.py` — numpy rip-relative xref finder; scans a 144 MB `.text` in seconds by solving
  `disp + 4j = const` across all four byte alignments. **This is the piece that made chasing libwebp
  inside the 196 MB `Qt6WebEngineCore.dll` tractable, and it unblocks the post-130 CVE verification
  in §4.2 item 2.**
* `vx.py` / `gx.py` — `.pdata`-bounded per-function disassembly with rip-target annotation, data
  xrefs, call xrefs, extent listing (rule 6 baked in).
* `fnat.py` (`.pdata` extent lookup), `webpsweep.py` / `locarr.py` (tree-wide constant-array sweep —
  this found the second libwebp), `avx2scan*.py` (wildcard opcode-pattern search over rip
  displacements), `strdump2.py`, `verscan.py`, `findarr.py`, `pathsweep.py`, `treesweep.py`,
  `stamps.py`, `vsweep.py`, `ws.py`, `tiff.py`, `pdf.py`.
* Verification-pass tools (written independently so a shared bug could not produce a shared error):
  `gdis.py`, `rawb.py`, `gxref.py`, `iatname.py`, `exp.py`, `ver.py`, `vrfy.py`, `iat.py`,
  `gui_exports.py`, `funcinfo.py`, `branchscan.py`.

All in
`C:\Users\mwgn-\AppData\Local\Temp\claude\E--tmp-wickr\9e9a870c-54c0-4941-836d-66155fe98837\scratchpad\`.
