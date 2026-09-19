# W19b — F9 (CVE-2025-10729) re-measured: it is a UAF reaching a CFG-guarded virtual call

**Two corrections and one new result. The correction has to go out before the finding does.**

Artifacts: `scratch/w19/svguaf.c` (a self-debugging harness: parent debugs a child copy of itself, so
`__fastfail` — which bypasses VEH/SEH by design — is observable), `scratch/w19/reclaim.py`,
`scratch/w19/rc/*.svg`.

---

## §1 ✗ RETRACT W16c's characterisation of F9 — the `0xC0000409` was OUR harness

W16c reported `uaf10729.svg` as *"`0xC0000409` — `__fastfail`, mitigation-detected corruption + hard
abort"* and hedged that the category was undetermined. Determined now, and the hedge was not enough:

```
__fastfail code = 7  (FAST_FAIL_FATAL_APP_EXIT)     at Qt6Core.dll + 0x1A718
[dbgstr] qt.svg: <input>:2:46: Could not add child element to parent element because the types are incorrect.
[dbgstr] QFont::setPixelSize: Pixel size <= 0 (-1)
[dbgstr] QFontDatabase: Must construct a QGuiApplication before accessing QFontDatabase
```

Code 7 is `qFatal`, **not** a memory-safety mitigation (not GS, not CFG, not heap metadata). The
abort was `QFontDatabase`'s own fatal error, because W16c's harness called
`QImage::loadFromData` **without ever constructing a `QGuiApplication`** — so the moment the SVG
touched text, Qt aborted for a reason that has nothing to do with the CVE. **Third instance in this
engagement of a harness artefact read as a finding** (after F4f's guard-failure counting and F12's
inferred call path). The instrumentation lesson is specific and reusable: *if a Qt harness has no
`QGuiApplication`, any result that depends on rendering is void.*

**F8 (CVE-2025-10728) is unaffected and stands** — re-run under the same debugger it faults
`0xC00000FD` first-chance in `ntdll+0x54AAC` with `rsp` at the guard page: genuine stack exhaustion,
no font path involved. The already-fixed control `oss42532991.svg` still exits `0x00000000` with
`qt.svg: Cycles detected in SVG, document discarded.` — so the three inputs still separate cleanly,
now for the right reasons.

## §2 ★ With a `QGuiApplication`, the same 90 bytes fault — on a freed object's vtable

```
FIRST-chance exception  code=0xC0000005  addr=Qt6Svg.dll+0x4D5DF
  info[0] = 0x0 (READ)   info[1] = 0xFFFFFFFFFFFFFFFF (non-canonical)
  rax=FFF8000000000000  rcx=000000800052EE80
```

Disassembled, the fault site is one arm of a loop that walks a style-pointer array (`[rbx+0]`,
`[rbx+8]`, `[rbx+0x10]`, `[rbx+0x18]`, …) and makes a virtual call on each non-null entry:

```asm
0x4d5cd  mov  rcx, [rbx + 8]        ; the style pointer -- the dangling QSvgPatternStyle
0x4d5d1  test rcx, rcx
0x4d5d4  je   skip                  ; NOT taken: the pointer survives the null check
0x4d5d6  mov  rax, [rcx]            ; rax = object->vptr   <-- READ OUT OF FREED MEMORY
0x4d5d9  mov  r8, rdi
0x4d5dc  mov  rdx, rsi
0x4d5df  mov  rax, [rax + 0x10]     ; <<< FAULT: the virtual slot
0x4d5e3  call qword ptr [rip+0x140b7]
```

That call slot is **RVA `0x616a0`, which the load-config names
`GuardCFDispatchFunctionPointer`** (`GuardFlags = 0x10017500`, `GuardCFFunctionCount = 0x404`). So
the sequence is the textbook CFG-guarded virtual dispatch, with the function pointer sourced from a
**vtable pointer read out of freed memory**:

> `vptr = [freed]` → `target = [vptr+0x10]` → `__guard_dispatch_icall(target)`

**⇒ control of the first qword of the freed block is control of the call target, modulo CFG.** This
is the first UAF→vcall primitive this engagement has found **at the message-peer position** — and
Qt6Svg is on the **ordinary CRT heap**, not PDFium's PartitionAlloc (W16).

**Attacker position (unchanged from W16c, and it is the good one):** `qsvg.dll` declares
`image/svg+xml` *and* `image/svg+xml-compressed`, the decode is `format = NULL`, so **the sender
picks the parser by content sniffing** — anyone who can send content.

## §3 The block is reused — but the bytes are not mine yet

The vptr value read is **not stable**: across runs and document shapes it came back as
`0x0000000000000000` and `0xFFF8000000000000` (an IEEE quiet-NaN pattern, i.e. some `double`/`QVariant`
allocation landed there). That is the signature of live, contended heap — the block *is* handed out
again between the free and the use.

Both the free and the use happen inside a single `QImage::loadFromData`, so any spray must come from
the same document. Eight shapes were tried (`scratch/w19/reclaim.py` → `rc/*.svg`), each measured
through the debugger harness:

| variant | result |
|---|---|
| `v0_baseline` | AV at `+0x4D5DF`, `rax` = 0 / FFF8000000000000 (varies) |
| `v1_rects200` (200 `<rect>`) | AV at `+0x4D5DF`, faulting address `0x10` ⇒ `rax` was **0** |
| `v2_ids_ascii`, `v3_ids_u4141` (120 long `id=` strings, ASCII and U+4141) | AV, `rax` = FFF8000000000000 — **attacker bytes did not land** |
| `v4_styles` (150 `style=` strings) | AV, `rax` = 0 |
| `v5_groups` (100 nested `<g>`) | fault moves to a **different site**, `Qt6Svg.dll + 0x40B8B` |
| `v6_gradients` | AV at `+0x4D5DF` |
| `v7_patterns` (120 legal sibling `<pattern>`) | **no fault at all** |

**Not achieved: attacker control of the vptr.** The document shape clearly steers which allocation
wins the block (v5 moves the fault, v7 removes it), so the reclaim is *steerable* — but none of these
eight put chosen bytes at offset 0.

## §3b ★ The same input also corrupts the Windows heap — with a control that proves it is the input

`scratch/w19/svgheap.c` hooks Qt6Svg's imported `malloc`/`free` (IAT RVAs `0x615c0` / `0x615b0`) and
ledgers every record. Run against the PoC it dies with **`0xC0000374` = STATUS_HEAP_CORRUPTION**
(raised through `__fastfail`, which is why the VEH never sees it).

**The control is what makes this reportable:** the *same* binary, *same* hooks, on the
already-fixed `oss42532991.svg` exits **`0x00000000`** with 32 ledger records and no fault. So the
corruption is the input's, not the instrumentation's — the mistake §1 retracts is not being repeated
here.

A read AV cannot corrupt heap metadata, so **something writes through the dangling pointer** (or
frees it a second time). That is the ingredient W19b §2 did not yet have.

**And the outcome is exquisitely heap-layout-dependent.** Across three builds of the same harness
differing only in bookkeeping (no change to any allocation size), the same 90 bytes produced:

| harness variant | result |
|---|---|
| plain decode, `QGuiApplication` present | `0xC0000005` read AV at the vcall site |
| + IAT hooks and ledger | `0xC0000374` heap corruption |
| + crash-surviving file ledger (extra I/O) | **clean**, `loadFromData` returns, 28 records |

Clean / AV / heap-corruption from identical input is the signature of a use-after-free whose
consequence is decided by *what reclaims the block* — i.e. exactly the variable an attacker would
groom.

## §3c ✗ The size class was NOT obtained — and the reason is specific

The ledger sees only **28 allocations for an entire SVG parse**, which is far too few: Qt6Svg
imports `malloc`/`free` but **no `operator new`/`operator delete` at all** (checked against
MSVCP140, VCRUNTIME140 and Qt6Core import tables), and most QSvg container memory comes through
**`QArrayData::allocate` / `deallocate`, imported from Qt6Core** (`0x180060a78` / `0x180060a70`).
So the block that matters is not on the path currently hooked.

**Next step, precisely:** hook `QArrayData::allocate`/`deallocate` in Qt6Svg's IAT *as well*, and if
the object still does not appear, inline-hook `ucrtbase!malloc`/`free` so every module is covered.
Then the block's size class falls out and the spray stops being guesswork.

## §3d ★ The size class IS 928 bytes — and reclaim is already achieved; what is missing is offset 0

The ledger from a clean run settles it without needing a fault at all. 14 allocations, 14 frees, and
**exactly one free during parsing** — everything from seq 15 on is teardown:

```
A  7  0x…508A00  size=928     <- allocated
F 12  0x…508A00               <- freed MID-PARSE (the only one)
A 13  0x…509DC0  size=680     <- not reused in this run => no fault in this run
```

**⇒ the block CVE-2025-10729 frees is 928 bytes (0x3A0).**

That also explains the one variant that behaved differently in §3: `v7_patterns` (120 *legal* sibling
`<pattern>` elements) produced **no fault at all**, and so did `p_mixed_452`. That is not the bug
failing to trigger — it is **the block being reclaimed by a real object of the same class, so the
vptr is valid and the virtual call simply succeeds.** Reclaim is therefore **already demonstrated**;
only the contents are not ours.

**16 further sprays aimed at the measured size class did NOT put attacker bytes at offset 0**
(`scratch/w19/spray928.py` → `sp/*.svg`: `<desc>` text and `id=` attributes of 440/448/452/456/460/
464 UTF-16 chars ≈ 928 bytes, filled with `A` (0x0041) and U+4141, 60 copies each). The vptr read
back as `0`, `0xFFF8000000000000`, or heap-ish pointers — never `0x0041004100410041` or
`0x4141414141414141`.

**The structural reason, which is the useful part:** Qt string/array allocations are **`QArrayData`
blocks — a header (ref count, flags, capacity) sits at offset 0 and the payload starts after it.**
So a `QString`/`QByteArray` can win the block but can *never* supply a chosen first qword; the vptr
slot will always be a refcount. **The reclaiming allocation has to be one whose first 8 bytes are
attacker data** — a raw buffer, not a Qt container. Inside an SVG parse the candidates are the
image/decoder buffers (e.g. a `data:` URI in `<image xlink:href>`), not text or attributes.

## §3e ✗ The raw-buffer route was executed too, and it also fails — for a new reason

§3d's own prescription ("the reclaimer must be a raw buffer, not a Qt container") was carried out.
`scratch/w19/rawspray.py` → `raw/*.svg`: uncompressed 32bpp BMPs embedded as `data:image/bmp;base64`
in `<image>` elements between the free and the use, pixel arrays sized 912/920/924/928/932/936/944/
960 B (a QImage pixel buffer is a plain allocation, so byte 0 of the block *is* byte 0 of the
attacker's pixels), filled with `0x41`, 40 copies each plus a mixed-size document.

| variant | result |
|---|---|
| `img_912` | AV in **Qt6Gui.dll + 0x63C220**, `rax=3FF0000000000000` (the double 1.0) |
| `img_920` | AV in **Qt6Core.dll + 0x212D**, `rax=00000000FFFFFFFF` |
| `img_924`, `img_928`, `img_932`, `img_mixed` | **no fault** |
| `img_936`, `img_944`, `img_960` | ntdll heap-validation breakpoint |

**No variant reached `Qt6Svg+0x4D5DF` with attacker bytes in `rax`.** The failure mode is new and
worth recording: a base64 `<image>` payload is ~55 KB of document per 40 copies, and that workload
perturbs the allocation landscape so heavily that **the fault relocates out of Qt6Svg entirely**
(into Qt6Gui/Qt6Core) or disappears. The spray is too loud for a window that is only two allocations
wide (`F#12` → `A#13` → `A#14` → use).

**Cumulative: 33 spray shapes across the three structurally distinct allocation families** — Qt
containers (`QArrayData`, header at offset 0), same-class C++ objects (valid vptr ⇒ call succeeds,
no fault), and raw image buffers (too heavy) — **reclaim is repeatedly demonstrated and steerable,
offset-0 control is not achieved.**

What that leaves for a future attempt, concretely: a reclaiming allocation that is (a) raw, (b)
928 B, and (c) *cheap enough not to disturb the two-allocation window*. Inside an SVG parse those
conditions are in tension, which is itself the honest obstacle — the more promising direction is to
widen the window (make more allocations happen between `F#12` and the use) rather than to make the
spray heavier.

## §3f ✗ And the "widen the window / quieter spray" idea was executed too

§3e's own prescription was carried out: a BMP allocates from its **header dimensions**, not from how
many pixel bytes the file carries, so a ~70-byte BMP can declare 232×1 32bpp and make Qt allocate
exactly 928 B while adding almost nothing to the document. 20 variants
(`scratch/w19/thinspray.py` → `thin/*.svg`; declared 920–936 B, 16 or 64 pixel bytes actually
present, 40 or 200 copies, documents 7–48 KB).

**Still no `rax = 4141414141414141`.** The faults scattered further — ntdll heap validation
(`+0x3D34C`, `+0x710F2`), `Qt6Core+0x212D`, `Qt6Gui+0x63C220`, and a *new* Qt6Svg site `+0x3AA35` —
i.e. the landscape keeps moving without ever handing us offset 0.

**Final tally: 53 spray shapes** (8 structural + 16 sized-string + 9 raw-image + 20 thin-image)
across every allocation family reachable from inside an SVG document. **Reclaim is demonstrated,
repeatable and steerable; control of the freed block's first qword is not achieved.** This line is
not refuted — but it is not close either, and further blind sprays are not the way to close it. The
next serious attempt needs allocator-level visibility of *which* allocation wins the block (hook
`QArrayData::allocate`/`deallocate` from Qt6Core plus `ucrtbase!malloc` inline, so every family is
ledgered), not more guesses.

## §3g ★★ THE RECLAIM IS DETERMINISTIC — and that reframes the whole problem

Running the ledger over `rc/v7_patterns.svg` (the variant that reclaims, and therefore does not
fault) gives the fact that all 53 sprays were missing:

```
389 allocations / 389 frees, 4 free->realloc events in the whole parse
000000C4FDE22600: freed@12 -> retaken@13   origsize=928  newsize=928
```

**The block freed at seq 12 is retaken by the very next allocation, seq 13, at the identical address
and the identical size class.** With 121 allocations of exactly 928 B in that document, only one
mattered: the *first* one after the free. This is ordinary Windows-heap LIFO behaviour for the size
class — it is not probabilistic, and no grooming is required.

**⇒ the problem is not "spray until you win the block". It is "make the FIRST 928-byte allocation
after the free be yours".** That single sentence explains every failure in §3–§3f: the text and
attribute sprays never produce a 928-byte allocation at all (they produce 680/96/…), and the image
sprays produce one only after the decoder has already made several other allocations, by which time
a legitimate `QSvgPattern` has taken the slot.

**What that makes the next experiment:** the element immediately following `</text>` decides seq 13.
So the question narrows to *which single construct, placed immediately after the misplaced pattern,
issues a 928-byte allocation whose first 8 bytes are attacker data* — a one-allocation problem, not a
spray. This is a materially better position than §3f left it in, and it is where the next session
should start.

*(Honest limit: the deterministic retake is measured on `v7_patterns`, where the retaker is a
legitimate `QSvgPattern`. That the same slot would be handed to an attacker-shaped 928-byte
allocation is the natural inference, but it is an inference — it has not been observed.)*

## §4 Where this stands, stated exactly

* **Report F9 as a use-after-free with a virtual call on freed memory (CWE-416), not as a crash.**
  W16c's "remote DoS, no exploitability claimed" understated it; "RCE" overstates it. The defensible
  sentence is: *a peer-supplied 90-byte SVG causes a freed object's vtable pointer to be read and
  dereferenced for a CFG-guarded indirect call; the freed block is demonstrably reallocated, but
  attacker control of its contents was not achieved.*
* **The missing step is one experiment, not a new idea:** instrument the CRT allocator around the
  parse (W16's `jpxsurvey.c` ledger technique applies directly) to learn the freed block's **size
  class**, then spray that exact class from within the document. Everything after that — a fake
  vtable whose `+0x10` slot is a CFG-valid entry — is the standard problem, and W15's peer-driven
  placement work is the other half.
* **CFG is present in Qt6Svg** (1028 guarded targets), so even with vptr control the final target
  must be a valid function entry — unless the *host* process turns CFG off, which was not measured
  here.
