# RUNBOOK — imgprobe4 (P1 image lead, re-test)

**Target:** AWS Wickr Desktop 6.72.20.0 (Windows x64), the operator's own machines and own accounts.
**Tool:** `E:\tmp\wickr\scratch\w3\lead\imgprobe4.c` → `imgprobe4.exe` (build: `buildimgprobe4.bat`).
**Status:** SAFE TO ARM, subject to the precondition check in §2.1. Twelve hook sites, all
byte-verified against the shipped images; all twelve emitted stubs disassembled offline and
re-checked after the review fixes.

---

## 1. What this answers, and what a result does NOT license

### The question

Wave 3 concluded "remote images are NOT decoded by Qt in the unsandboxed main process" from three
probes that all returned zero. All ten Qt imageformats plugins are resident in `WickrPro.exe` — the
process that holds the crypto state and the message store — and none in `QtWebEngineProcess`. If a
remote image or PDF ever reaches a `format=NULL` sniffing site there, **the sender picks the
decoder**. This tool decides between:

| state | meaning |
|---|---|
| **(i)** | local decodes observed, no remote-sourced decode → the Wave 3 negative holds *for the sites covered* |
| **(ii)** | nothing observed at all → the probe never armed → NO DATA |
| **(iii)** | any remote-sourced decode → the negative is REFUTED |

plus four outcomes that are **not results** (§4).

### What a result does NOT license — read this before quoting any number

**Every hook is in `Qt6Gui.dll` or in `WickrPro.exe` code that calls it. This probe observes Qt
image decoding and nothing else.** These decoders take peer-supplied bytes in the *same unsandboxed
process* without touching `Qt6Gui.dll`, and no result here says anything about them:

* **`NPL.dll`'s vendored libjpeg-turbo decompressor**, driven by `Musigy::AV::ColorspaceConverter`
  on MJPG/JPEG-fourcc media (`LEAD-FINDINGS-jpeg.md` §A–C). `WickrPro.exe` imports `NPL.dll`
  directly — 96 imports, read from the import table.
* **`NPL.dll`'s libvpx 1.9.0 VP8 decoder**, live `dec.decode` @`0x18017d780`
  (`LEAD-FINDINGS-libvpx.md` §A–C). **Peer-supplied VP8 has already been driven to a byte-exact
  controlled memory-corruption write in this process in W5.** So "no remote decode happens in the
  main process" is already known to be false as a general statement, whatever this probe reports.
* **Qt6Pdf / PDFium via `QPdfDocument`**, and **Qt6Svg via `QSvgRenderer`** — both shipped
  alongside, neither constructs a `QImageReader`.
* **QtWebEngine's renderer processes** (different process, out of scope).
* The **protected** `QImageIOHandler` ctor at Qt6Gui `0x058720`, deliberately not hooked: its first
  instruction is a 7-byte rip-relative `lea` that a 5-byte splice would truncate, and it has no
  `.pdata` entry. A plugin whose handler uses it is counted by Q1/Q3 but not *named* by Q7.

A **(i)** from this tool means, in full: *during this window and for the actions actually performed,
no peer-supplied bytes were decoded through the four `format=NULL` `QImage::loadFromData` call sites,
and no Qt image decode in this process chose its decoder from content rather than from an explicit
format.* It does not mean the process is clean. The printed verdict says so itself.

### Why v4 needed a twelfth hook (the defect that reviewer 2 found)

The previous version called `counter(Q1..Q7)` "LIVENESS_LOCAL — the local control" and used a
non-zero value to license verdict (i). That was wrong, and measured here from the shipped
`WickrPro.exe`: IAT slot `0x140d56028` is
`Qt6Gui!??0QImage@@QEAA@AEBVQString@@PEBD@Z` = `QImage(const QString&, const char*)`. It has **ten**
call sites and **nine pass `format = NULL`** (each preceded by `45 33 c0  xor r8d,r8d`):

```
0x14003b852  0x140045bfd  0x1400dc9e9  0x1400dcc9d  0x1400ddbea
0x1400e4fe4  0x1400fa0dd  0x14013bcc3  0x1409f30b5      (0x1400dd962 passes a real format)
```

Two of those live in `WickrImageProvider` (a `QQuickImageProvider` — how QML renders message
content), one is the profile-picture loader (`"Unable to load profile pic with mime type"`), and a
peer's avatar is a peer's bytes. Disassembling the constructor shows where those decodes go:

```
0x1800315e0  QImage::QImage(const QString&, const char*)
   0x18003163b  call 0x180059ba0   QImageReader::QImageReader(QString&, fmt)   [Q4]
   0x180031648  call 0x18005c6e0   QImageReader::read()  -> 0x18005c7a0        [Q1]
```

— i.e. straight into the number that was being called "the local control". A file-backed,
content-sniffed decode of peer bytes would have been scored as the *control that licenses the
negative*. That is now a separate, authoritative counter (`FILESNIFF`) that **blocks** a negative
instead of feeding one.

---

## 2. Residual risk, in plain words

This is not a read-only attach. While armed, **twelve code sites in your live client are overwritten
with jumps into pages this tool allocated**, and a few hundred bytes of our machine code run on your
client's own threads on every hooked call. Two different things can go wrong and you must be able to
tell them apart afterwards.

**A. The point of the exercise.** §3 asks you to send bytes chosen to stress an image decoder. If a
decoder in the unsandboxed main process mishandles them, the client may crash. **That is a finding,
not an accident.** This process holds your crypto state in memory. Do not do this on an account or a
machine where losing the session matters.

**B. The probe's own risk.** A bug in the injected code presents as a crash that looks like a decoder
bug. What has been done about it, stated as mitigation and not as proof:

* **Unwind exposure: structurally removed, not mitigated.** No stub contains a `call`. Verified by
  machine-counting the disassembly of all twelve emitted stubs: `calls=0` in every one. At a spliced
  call site the stub reproduces the original call by its definition —
  `movabs rax,site+6 ; push rax ; movabs rax,&IAT ; jmp qword ptr [rax]` — so the decoder is entered
  with an identical `rsp`, identical shadow space, and a return address **inside `WickrPro.exe`**,
  which has a `RUNTIME_FUNCTION`. All four pushed return addresses were checked to be real
  instruction boundaries inside a registered function
  (`0x1400c2d53`, `0x1409f7551`, `0x140c15180`, `0x140c15341`). A C++ exception thrown out of a
  decode (`std::bad_alloc`, PDFium, …) therefore unwinds on the target's own frames exactly as it
  would with no probe present. **The only remaining exposure is a fault inside the ~250-byte
  recording section itself**, which contains no call, no push, and touches only our own committed
  pages plus the argument container under null and length guards.
* **Argument reads are bounded by the caller's own declared length.** An 8-byte chunk is copied only
  down a path on which the container's size was `>= (k+1)*8`, compared **once** from a register
  (signed), so the stub never reads a byte the callee is not itself about to read. Verified in the
  emitted bytes: `cmp r11,0x20 / 0x18 / 0x10 / 8` with `jge`.
* **Register footprint:** only `rax`, `r10`, `r11` and flags. All volatile, none an argument.
  Confirmed by disassembly of all twelve stubs.
* **No thread is left parked inside a patch window when the bytes are written.** The tool suspends
  the target, reads every thread's `RIP`, and refuses to write if any lands strictly inside a
  window (this matters for Q1, whose 5-byte window holds three instructions with interior
  boundaries at `Qt6Gui+0x5c7a2` and `+0x5c7a3`).
* **Not closed, and stated rather than hidden:** a thread *created* between the thread snapshot and
  the write is never suspended and could instruction-fetch a torn `E9`. This cannot be closed from
  outside the process. It is the standard residual of every hot-patch.
* **Stub pages are never freed** — deliberately. A thread caught mid-stub when the patches are
  removed must still find its page mapped. Each arm/unhook cycle leaves ~768 KB of reserved address
  space behind until the client restarts. Do not "fix" this.

### 2.1 PRECONDITION — check this before arming (read-only, launches nothing)

```powershell
Get-ProcessMitigation -Name WickrPro.exe
```

**`UserShadowStack` must read `OFF` or `NOTSET`.** The spliced-call tail fabricates a call without
executing a `CALL`; with hardware-enforced stack protection on, the callee's `RET` finds no matching
shadow-stack entry, raises `#CP`, and kills the client instantly on **every** hooked remote decode.
Verified for this build: `WickrPro.exe` has no `IMAGE_DEBUG_TYPE_EX_DLLCHARACTERISTICS` entry at all
(debug directory holds only CODEVIEW / VC_FEATURE / POGO), so it is not CETCOMPAT, and
`DllCharacteristics = 0x8160` (no `GUARD_CF`, so the `jmp [rax]` is not guard-checked either).
`Qt6Gui.dll` *is* `CET_COMPAT=0x1`, but the EXE governs the process. **If anyone ever enables
Exploit Protection → "Hardware-enforced stack protection" for this app, do not arm this probe.**

---

## 3. Exact steps

Run the console as the same Windows user that runs Wickr. No elevation is needed.

### Step 0 — offline, touches nothing

```
cd E:\tmp\wickr\scratch\w3\lead
buildimgprobe4.bat
imgprobe4.exe --dumpstubs
```

Writes `stub01.bin` … `stub12.bin` and prints each stub's hex. Disassemble them before arming — that
mode exists so that the code that will be injected can be read first. **No stub may contain a
`CALL`.** Expect: `calls=0` everywhere; only `rax`/`r10`/`r11` written; stubs 08–11 ending
`movabs rax,<site+6> / push rax / movabs rax,0x140d56278 / jmp qword ptr [rax]`; stubs 08–11 carrying
the conditional `REMOTE_BYTES` counter and stub 12 the conditional `FILESNIFF` counter.

### Step 1 — verify against the live client, still no patching

```
imgprobe4.exe --verify
```

All twelve lines must end `(ORIGINAL)`. Any `*** MISMATCH ***` means a different build or an already
patched process — **stop**, do not arm.

### Step 2 — arm

```
imgprobe4.exe
```

Expect `[+] ARMED: 12/12 hooks installed and read back byte-for-byte.` If it prints
`a target thread is parked INSIDE the patch window …` it is backing off on purpose; let it retry. If
it refuses, nothing was written — try again in a moment.

### Step 3 — liveness check (purely local, no second account, do this FIRST)

This proves the instrument fires. **It does not license anything else.**

1. Drag a local `.png` into the compose box (do not send it) — the thumbnail is a fresh decode.
2. Open the emoji picker.
3. Switch theme light ↔ dark (forces the icon set to be re-read).
4. Open Settings → your own profile picture.

Watch the heartbeat:

```
... LIVENESS(Q1..Q7,F1)=n  REMOTE(W1..W4)=n  REMOTE_BYTES=n  FILESNIFF=n  ALL=n  [per-site]
```

**If `LIVENESS` is still 0 after all four, stop.** The probe is not firing and nothing you do next
can produce a negative — that is outcome (ii).

### Step 4 — the test, from a SECOND account you control

Re-read §2 first. Leave it armed a few minutes after each action; some decodes are lazy.

| # | From the second account | Expect |
|---|---|---|
| 1 | Send a message containing a URL whose page has an OpenGraph image (a normal news article works). Use a page whose image really exists — an empty or non-image body executes the call site with a zero-length buffer and is explicitly **not** counted as a refutation. | W3/W4 + Q3, `REMOTE_BYTES` moves |
| 2 | Open/scroll the conversation so the preview renders | W1, Q1 |
| 3 | Pin a link in a room you both share | W2 (download completion) |
| 4 | Send an image attachment: PNG, then JPEG | Q1/Q7, and F1 with `format = NULL` when it is rendered from disk |
| 5 | Send a PDF | if Q7's caller resolves to `qpdf.dll`, PDFium is parsing peer bytes in the unsandboxed process |
| 6 | Change the second account's profile picture, then view it | the `'JPG'` sites, and F1 via the profile-pic loader `0x140045870` |

Steps 4–6 are the ones that make `FILESNIFF` move. That is expected and it is *the point* — those
are decodes of peer-supplied files where the bytes choose the decoder, and the tool now refuses to
call the run a negative until you have read the path list it prints.

### Step 5 — finish

`Ctrl+C`. The hooks are restored and the SUMMARY block is printed and appended to `imgprobe4.log`.

---

## 4. The decision rule — one line decides it

In the SUMMARY block, find the **single line beginning `VERDICT`**. That line is self-contained.
Nothing else in the log changes the answer.

| The line reads | Meaning | Reportable? |
|---|---|---|
| `VERDICT (iii) REFUTED: N remote-sourced decode(s) of non-empty peer bytes.` | Peer bytes were decoded by Qt in the unsandboxed main process, with the sender choosing the decoder. | **YES — state (iii)** |
| `VERDICT (ii) NO DATA: the probe never fired` | `LIVENESS = 0`. Redo step 3. | No — state (ii) |
| `VERDICT: INCOMPLETE -- not a negative. FILESNIFF=N NETDEV=M` | Content-sniffed decodes happened whose provenance cannot be decided from outside the process. Read the printed `CONTENT-SNIFFED FILE DECODES SEEN` list and adjudicate each path by hand. **Expect this to be the common outcome on a real client.** | No — not a negative |
| `VERDICT (i) NEGATIVE, SCOPED: LIVENESS=N, REMOTE_BYTES=0, FILESNIFF=0, NETDEV=0.` | The negative holds for the four `loadFromData` sites and for Qt decoding only, for this window and these actions. | **YES — state (i), with §1's scope attached** |
| `VERDICT: UNDETERMINED` / `INCONSISTENT` / `INSTRUMENT-LEVEL EVENT` | The instrument failed, or the call sites ran with only empty buffers. Re-run. | No |

The numbers behind it, all read out of the target process, not derived from the log:

* **`REMOTE_BYTES`** — executions of W1–W4 (the four `format=NULL` `loadFromData` call sites) at
  which the `QByteArray` had a non-null pointer and size > 0. Remote **by construction**: no filename
  heuristic, no path matching. Incremented by guarded instructions inside the stub, so a torn log
  record cannot manufacture it.
* **`FILESNIFF`** — executions of `QImage(fileName, format)` with `format == NULL`. Blocks (i).
* **`NETDEV`** — Q2/Q5 records whose `QIODevice` vtable is in `Qt6Network.dll` (a `QNetworkReply` was
  handed to `QImageReader`). Drained from the ring, so advisory: it may only **downgrade** to
  INCOMPLETE, never produce a REFUTED.
* **`LIVENESS`** — `counter(Q1..Q7) + counter(F1)`. **Proof of life only.** It is not a "local"
  control; it moves on peer-sourced decodes too.

Ignore the line `advisory path classification of drained records: local=… remote?=… ??=…`. It is a
filename keyword heuristic, it is wrong all the time (a local PNG in your Downloads folder matches
`"download"`), and **no branch reads it**.

On a (iii), then read each event's `magic = …`: TIFF / WEBP / PDF / SVG means libtiff / libwebp /
PDFium / QtSvg parsed attacker-chosen bytes in the unsandboxed main process. `findstr
"REMOTE-SOURCED" imgprobe4.log` lists the events; the counter is the evidence, the log lines are a
convenience (fewer if the ring overflowed, and in principle more if a slot was torn while read).

---

## 5. Unhooking, and what to do if the client dies

### Normal

`Ctrl+C` → `[+] all 12 sites restored: OK`. That is the end of it. The stub pages stay mapped and
unreferenced until the client restarts; that is intended (§2).

### The tool was killed / the console was closed

**The patches are still live in the running client.** Restore them before drawing any conclusion
from the client's later behaviour:

```
imgprobe4.exe --unhook
```

It restores only sites that currently hold one of our `E9` patches, and refuses any site whose bytes
are neither original nor ours. Restarting the Wickr client also clears everything — the patches only
ever existed in memory; **no file on disk is modified by this tool, ever.**

### If restore says `restore deferred: the sites are STILL PATCHED`

A thread was parked inside a patch window and the tool refused to write rather than corrupt it. Run
`imgprobe4.exe --unhook` again; if it keeps refusing, restart the client.

### If the client dies while armed

The probe prints:

```
*** TARGET PROCESS DIED  pid=…  exit code 0x… ***
    … ms after the last recorded decode   <== SUSPICIOUS: a decoder may have crashed it
    … our stub pages this run: 0x… - 0x…  (one line per site)
```

**Before blaming a decoder, decide whose fault it was:**

1. Get the faulting address (Windows Event Viewer → Application → Error / Windows Error Reporting,
   or a `.dmp` under `%LOCALAPPDATA%\CrashDumps`).
2. **If the faulting address is inside one of the stub page ranges the death banner printed, the
   crash is OURS.** Say so in the write-up, do not report it as a Wickr finding, and do not re-arm
   until the stub bug is found.
3. If it is inside a module (`qtiff.dll`, `qwebp.dll`, `qpdf.dll`, `Qt6Pdf.dll`, `NPL.dll`, …) and
   it happened within a few seconds of a recorded decode, that is the finding the exercise was
   looking for. Keep `imgprobe4.log` — the last records before the death name the site, the buffer
   length and the magic bytes.
4. Records from the final ~60 ms are lost with the process. That is why every record is written and
   flushed as it is drained rather than summarised at exit, and why the summary marks the counters
   as `LAST GOOD READ` when the target is gone. The counters are never silently printed as zero when
   they are actually unknown — that case prints `UNDETERMINED`.

After a crash and restart, arming again is just re-running the tool.

---

## Appendix — what was verified statically, and how

Re-derived from the shipped images at the hashes below (installed copy and
`E:\tmp\wickr\desktop\binaries` copy of `WickrPro.exe` are byte-identical):

* `Qt6Gui.dll` sha256 `b448ff51589da181edca79aa194ad3ee3c9af8341e18d6ca4128ee8fc9139698`
* `WickrPro.exe` sha256 `eccafde833d34386c859d6548e922649c2f58cd15f82998c8bd2966219341dbd`

| Site | RVA | Bytes | `.pdata` |
|---|---|---|---|
| Q1 `QImageReader::read(QImage*)` | Qt6Gui `0x05c7a0` | `40 55 56 41 56` | `0x5c7a0-0x5c800` |
| Q2 `QImageReader::imageFormat(QIODevice*)` | `0x05ba00` | `48 89 5c 24 08` | `0x5ba00-0x5ba89` |
| Q3 `QImage::loadFromData` | `0x005040` | `48 89 5c 24 08` | `0x5040-0x508f` |
| Q4 `QImageReader(QString&,fmt)` | `0x059ba0` | `48 89 5c 24 08` | `0x59ba0-0x59c0f` |
| Q5 `QImageReader(QIODevice*,fmt)` | `0x059c10` | `48 89 5c 24 08` | `0x59c10-0x59cca` |
| Q6 `QImageReader::setFileName` | `0x05d760` | `48 89 5c 24 08` | `0x5d760-0x5d7ba` |
| Q7 `QImageIOHandler::QImageIOHandler()` | `0x058740` | `48 89 5c 24 08` | `0x58740-0x58796` |
| **F1 `QImage(QString&,fmt)`** | **`0x0315e0`** | **`48 89 5c 24 10`** | **`0x315e0-0x31707`** |
| W1 link-preview `_image_` | WickrPro `0x0c2d4d` | `ff 15 25 35 c9 00` | `0xc29c0-0xc3004` |
| W2 pinned-link download done | `0x9f754b` | `ff 15 27 ed 35 00` | `0x9f7300-0x9f7a3e` |
| W3 network reply handler #1 | `0xc1517a` | `ff 15 f8 10 14 00` | `0xc14f70-0xc158ec` |
| W4 network reply handler #2 | `0xc1533b` | `ff 15 37 0f 14 00` | `0xc14f70-0xc158ec` |

All four W displacements resolve to the same import slot `0x140d56278` =
`Qt6Gui!QImage::loadFromData`, each preceded by `45 33 c0 xor r8d,r8d`. All eight Qt6Gui RVAs came
from the export table by mangled name.

* **Branch-into-window scan, per `.pdata` function** (never a linear sweep): Qt6Gui 29 498 functions
  / 1 580 597 instructions, WickrPro 39 032 functions / 3 161 914 instructions →
  **zero** branches target any byte strictly inside any of the twelve windows. No `RUNTIME_FUNCTION`
  begins inside a window. No window spans a 4 KB page boundary.
* **F1 unwind handoff:** `SizeOfProlog = 19`, unwind codes at `CodeOffset` 11/13/15/19/19/19 — all
  greater than 5, so at `site+5` the unwinder applies nothing and treats `[rsp]` as the return
  address, which is the truth because `mov [rsp+0x10],rbx` does not move `rsp`.
* **Emitted stubs:** twelve, max length 275 bytes of a 1024-byte page, `calls=0` in every one,
  registers written = `rax`/`r10`/`r11`/flags (plus `rsp` for Q1's three displaced pushes and the
  single `push rax` in each W tail). Every rel8 branch fixup is range-checked at assembly time and
  an out-of-range one is refused rather than emitted.

The loader re-verifies every one of these byte strings in the live process before patching and
refuses to touch anything on a mismatch.
