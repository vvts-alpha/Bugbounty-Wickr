# AWS Wickr Desktop — Wave 5 final report

**Target:** AWS Wickr (WickrPro.exe) 6.72.20.0, Windows x64, with `NPL.dll` (Musigy AV/NPL media stack,
bundled libvpx).
**Date:** 2026-07-31.
**Scope / RoE:** operator's own machines and own accounts only; no calls to unwitting parties; no traffic
to Wickr production servers beyond ordinary client use; benign proof-of-concept payloads only.
**Method note:** every claim below is labelled **CONFIRMED** (disassembled or measured), **INFERRED**
(reasoned from confirmed facts), or **REFUTED**. Qualifiers travel with the results they qualify.

---

## 1. Executive summary

Two remotely-triggerable defects were demonstrated **live, over a real Wickr call, from an ordinary
authenticated call participant**. Both live in the bundled libvpx VP8 decoder, which runs in the
**unsandboxed** main WickrPro process.

| ID | Defect | Class | Live status |
|---|---|---|---|
| **F5-1** | Content-controlled use-after-free write via dangling `pc->mi` after an allocation failure | CWE-416 | **Demonstrated end to end over a live call**: 405 bytes of VP8 → attacker-chosen bytes written byte-for-byte into the victim's heap → victim process death |
| **F5-2** | A single small VP8 keyframe forces ~2 GiB of commit | CWE-400 | **Demonstrated over a live call** on two different hosts; hard denial of service on a memory-constrained one |

**Remote code execution is NOT demonstrated and is not claimed.** §4 states exactly why, and what
would have to be true.

F5-1 and F5-2 are the Wave 4 findings F4-2 and F4-3. Wave 4 recorded F4-2's peer-reachability as
**UNKNOWN** and concluded the allocation-failure gate "does not open for a single peer on this host
class". **Both of those are now overturned by measurement.**

---

## 2. Attacker position

The crafted VP8 frames travel **inside** the end-to-end-encrypted media payload. The relay/SFU sees only
ciphertext, so it cannot forge them.

> **The required position is a legitimate participant in a call with the victim** — i.e. anyone the
> victim accepts a call from. No elevated privileges, no prior compromise of the victim, no victim
> interaction beyond being in the call with video.

The attacker must run a modified client to emit chosen frames; in this engagement that was a **6-byte
in-memory patch** at `WickrPro!encryptCallback` (RVA `0x147170`) on the *attacker's own* machine. That
is the modelling of a malicious peer, not a defect in the victim.

**CONFIRMED:** the victim needs video enabled — audio alone never instantiates a VP8 decoder. Measured:
the probe's decode counter stays at 0 for audio-only calls.

---

## 3. F5-1 — remote content-controlled use-after-free write

### 3.1 The defect (CONFIRMED, disassembled)

`vp8_de_alloc_frame_buffers` (`NPL 0x180186320`) frees the mode-info block and stores 0 to `mip`
(`+0xc58`), `prev_mip`, `above_context` and two others — but contains **no store to `mi` (`+0xc60`)**.

`vp8_alloc_frame_buffers` (`0x180186080`) calls de_alloc at entry (`0x1801860a4`) *and* again on its
failure label (`0x180186293`). Six failure exits all converge there. So **every** failure exit leaves
`pc->mi` pointing into memory that has just been freed.

The next inter frame runs `vp8_decode_mode_mvs`, which writes `mb_rows × mb_cols` MODE_INFO records
straight through that dangling pointer. The record contents — mode, reference frame, partitioning and
**sixteen motion vectors** — come from the attacker's bitstream.

### 3.2 The gate

The precondition is an allocation returning NULL inside `vp8_alloc_frame_buffers`. The attacker drives
the request size directly: the VP8 keyframe header carries **14-bit** width and height, and
`vp8_decode` passes them through behind only two `<= 0` checks. A 16383×16383 keyframe requests
~2017 MiB.

**CONFIRMED, measured on two hosts:** a 34-byte keyframe commits **+2017.0 MiB**.

### 3.3 Live demonstration (CONFIRMED)

Victim: stock client, 4 GiB machine, unmodified except a passive read-only probe. Attacker: one call
participant. **Three VP8 frames — 41 + 34 + 330 = 405 bytes.**

```
decode len=41   FRAME A     alloc: request 64x64          PRE-FREE mip=0x1accabc2990 mi=0x1accabc30fc
decode len=34   FRAME B     alloc: request 16383x16383    PRE-FREE mip=0x1acc4e5faf0 mi=0x1acc4e5fcb8

*** ALLOCATION FAILED -- F4-2 GATE OPEN ***
    pc=0x1accaa87260   pc->mip=0x0 (NULLed by de_alloc)   pc->mi=0x1acc4e5fcb8 (DANGLING)
    freed block base = 0x1acc4e5faf0, size 1923 B   mi sits 456 bytes into it
```

Frame C then wrote through the dangling pointer. Four MODE_INFO records — the four steered macroblocks
(1,1) (1,3) (3,1) (3,3), at block **+912, +1064, +1672, +1824**, exactly
`mi_off + (row·stride + col)·76` — each carrying `mode=9 (SPLITMV)`, `ref_frame=1 (LAST)`, `is_4x4=1`,
`partitioning=3`, and 64 bytes of `bmi[16]`:

```
requested  (100,54) (-346,232) (592,-410) (838,588) (-1084,766) (1330,944) (1576,-1122)
           (-1822,1300) (20,1478) (266,1656) (-512,-1834) (758,2012) (1004,144)
           (-1250,322) (1496,-500) (0,256)

want  64003600a6fee800500266fe46034c02c4fbfe023205b00328069efbe2f81405
      1400c6050a01780600fed6f8f602dc07ec0390001efb4201d8050cfe00000001
got   64003600a6fee800500266fe46034c02c4fbfe023205b00328069efbe2f81405
      1400c6050a01780600fed6f8f602dc07ec0390001efb4201d8050cfe00000001
```

**Byte for byte identical.** The victim process then died — the probe's dumps at t+1 s and t+3 s failed
with `ReadProcessMemory` returning "process gone", having succeeded at t+0 ms and t+200 ms.

### 3.4 Write primitive characteristics (CONFIRMED, measured offline against the shipped DLL)

* **Content alphabet.** `read_mv` stores `(short)(component × 2)` with the component bounded by
  `mvlong_width = 10` bits, so each of row/col is an **even int16 in ±2046**. As raw bytes: byte 0 even,
  byte 1 in `0x00..0x07 ∪ 0xF8..0xFF`. The other MODE_INFO fields are small enums.
* **Density.** NEWMV places 4 chosen bytes per 76-byte record; **SPLITMV places 64** (`bmi[16]`), i.e.
  68 of every 76 bytes are attacker-chosen. Verified 16/16 macroblocks offline.
* **Placement.** The attacker chooses the freed block's size class and the write offsets through the
  first frame's resolution. 68 of 76 byte residues are reachable; the first `16 + (stride+1)·76 ≥ 244`
  bytes of the block never are.
* **Partial pointer overwrite.** Demonstrated offline: `0x00007ffabcde1234 → 0x00007ffa02460468` — low
  32 bits set to a chosen value, ASLR-bearing high 32 bits bit-for-bit intact, no information leak
  required. Only one slot per row admits this (the last macroblock's `bmi[15]`, whose following bytes
  fall in the border record the writer skips).

### 3.5 Qualifiers that travel with F5-1

1. **The allocation failure was induced by a Job Object per-process commit cap.** A default Windows
   install with a system-managed pagefile **grows the pagefile** and satisfies the 2 GiB request — this
   was measured, and it corrects an earlier assumption of ours that "free commit" is a bound. The honest
   statement is: **reachable on a victim whose commit limit cannot grow** (fixed-size or disabled
   pagefile, a full pagefile volume, or an already-exhausted limit).
2. The attacker's own client was patched in memory to emit chosen frames (6 bytes at one site). Nothing
   on the victim was modified except the passive probe, which restores on exit.

---

## 4. Why this is not RCE — and what would have to be true

**The block frame C wrote into was still free.** The probe's dump shows a heap free-list pointer
(`0x1acc4e5fae0`, into the block's own header region) at `block−8`, with the rest zeros and filler.
Nothing had reclaimed it. So the write corrupted **free** memory: there was no object, no vtable, and no
virtual call to redirect. The process died from heap damage, not from attacker control of the
instruction pointer.

**PC control from this primitive is demonstrated, not hypothesised.** Offline, one crafted inter frame
partially overwrote an object pointer (`0x00007ffabcde1234 → 0x00007ffa02460468` — low 32 bits chosen,
ASLR-bearing high 32 bits bit-for-bit intact, **no information leak required**), the vtable was loaded
from the redirected object, slot 0 was called, and attacker-chosen code executed.

The qualifier applies to **one link only**: the reclaiming object was supplied by the harness rather
than found in the live process. Everything else in that chain — the write, its content, its placement,
the partial overwrite, the redirected virtual call — ran against the unmodified shipped `NPL.dll` on the
real NT heap.

> **This is not "a crash of unknown exploitability".** Given an object in the freed block holding a
> pointer at a reachable offset, this primitive reaches code execution — measured. What is unresolved
> is whether such an object exists and can be placed, which is a question about the victim's heap, not
> about the strength of the primitive.

That said, §4.1 states plainly why we do not expect it to be placeable, because the constraints have
since been measured and they compound.

The single remaining link is therefore: **a real object that reclaims the freed block and holds a
pointer at a reachable offset.** Constraints already established:

* it cannot be a plain polymorphic object — the first 244 bytes are unreachable under every legal
  geometry, and a vtable sits at offset 0. It must be **array-like**, or a large struct with a pointer
  deep inside it;
* it must sit in a size class the attacker can reproduce (the attacker picks this via the first frame's
  resolution);
* for the leak-free partial overwrite, the pointer must **already point into memory the attacker can
  spray** — a partial overwrite cannot leave the pointer's own 4 GiB window, and the victim's process
  heap and the decoder's large buffers get independent ASLR draws.

Real candidates exist: standing the NPL media graph up locally showed `PacketQueue`, `PacketMonitor` and
`Puller` each allocate a 1702-byte block holding pointers at offsets the write can reach. None of them
reclaimed the block in the live run.

**Assessment, stated without optimism:** the third constraint is the one most likely to block this. If
the reclaiming object's pointer does not already point into sprayable memory, a partial overwrite cannot
reach anything useful, and a full 8-byte pointer write needs an address matching a ~2^-20 alphabet —
i.e. an information leak. No information-disclosure path back to the attacker has been found in this
engagement.

---

## 5. F5-2 — remote resource exhaustion / denial of service

**CONFIRMED, live, on two different hosts.** The 14-bit dimension fields let a peer request an arbitrary
decoder geometry; nothing upstream clamps it. A sweep of every `.pdata` function in `NPL.dll` for the
VP8 sync-code test found exactly two functions in the whole image, both inside libvpx — everything
upstream treats the frame as an opaque blob. The decoder is created with `cfg.w = cfg.h = 0`, so the
announced `VideoFormat` geometry does not cap it either.

| Victim | Free commit | Result |
|---|---|---|
| 24 GiB host | 19.5 GiB | allocation **succeeds**, **+2017.0 MiB** of commit taken by a 34-byte frame |
| 4 GiB host | 1.5 GiB (snapshot) | pagefile grows to satisfy it; **WickrPro crashed / became unresponsive** |

So this is **not** limited to memory-constrained victims: *any* host gives up ~2 GiB per decoder context
to a 34-byte frame. Wave 4 CONFIRMED **two decoder contexts per publisher**, selected by bit 14 of
`Frame+0x90` (peer metadata off the wire), so one peer can drive roughly **4 GiB**. On a constrained
host the result is a hard denial of service against an unsandboxed process.

This is reportable on its own, independent of F5-1.

---

## 6. Remediation

**Primary — fixes both findings:**

1. **Clamp the decoded dimensions before allocating.** The 14-bit fields permit 16383×16383; no
   conferencing client needs anything near that. Reject frames whose geometry exceeds the negotiated
   format, or a hard ceiling (e.g. 4096×4096), *before* `vp8_alloc_frame_buffers`. This alone removes
   F5-2 and closes F5-1's gate.

**Also required, because they are defence in depth for F5-1:**

2. **Update libvpx.** Five upstream fixes are absent from the shipped bytes, each checked individually:
   `44a5eaa3b`, `0226b9516`, `a5e2e6528`, `263ddc9e3`, `572f663c8`. A version bump is the right fix; the
   five commits are the minimum.
3. **NULL `pc->mi` (and `pc->prev_mi`) in `vp8_de_alloc_frame_buffers`,** alongside the `mip` /
   `prev_mip` stores it already performs. This is a two-line change that turns the UAF into a NULL
   dereference.
4. **Tear the decoder down on allocation failure.** `vp8_decode`'s setjmp landing pad only zeroes
   `ctx->si.w/h` and returns; the decoder object is never destroyed and keeps serving frames from a
   half-freed state. Note `vpx_codec_destroy` is not linked into either binary and the iface `destroy`
   entry has no callers.

**Hardening, not a fix:**

5. Enable **CFG** on `WickrPro.exe` and `NPL.dll` — measured absent in both, along with CET. Media
   decoding in an unsandboxed process with CFG off is what makes a corrupted code pointer directly
   valuable.
6. Consider sandboxing or isolating media decode. Today the VP8 decoder shares the address space with
   the UI, the crypto state and the message store.

---

## 7. Corrections to our own earlier work

Recorded because each one cost a round trip and the failure mode repeats.

* **"F4-2 content steerability is unproven" — REFUTED.** Wave 4 fired inter frames whose partition 0 was
  `b"\x00"*64`. Mode and MV data is arithmetic-coded, so an arbitrary byte string cannot *select* a
  mode; it decodes to the intra/zero-MV corner. "9 zero bytes per MODE_INFO" is what you observe under
  *both* hypotheses, so the experiment could never have discriminated.
* **"~5 malicious publishers needed" — REFUTED.** One peer suffices.
* **"Free commit below ~4034 MiB" — REFUTED, by us, twice over.** `commit free` is a snapshot, not a
  bound: Windows grows the pagefile. The correct precondition is a commit *limit* that cannot grow.
* **Three delivery bugs in our own tooling**, each found by measurement rather than argument: firing on
  the call's first packets (they precede the peer's subscribe and are dropped); firing into one
  simulcast layer when the two alternate almost every packet; and staging the frame at `ptr+0` when
  every real packet reserves exactly **29 zero bytes** at `ptr` for the AEAD header, with
  `[Packet+0x18]` counting them (477/477 packets, audio and video alike).
* **Frame C initially wrote a pattern that was invisible** — 15 zero sub-vectors into an all-zero freed
  block, so "did not write" and "wrote zeros" produced the identical observation. The same
  non-discriminating-experiment error as the first bullet.

---

## 8. Evidence and tooling

| | |
|---|---|
| Live probe (victim) | `scratch/w3/lead/victim_probe.c/.exe` — 3 passive detours: `vp8_alloc_frame_buffers` entry, its failure tail, `vpx_codec_decode` entry; optional Job Object commit cap; restores on exit |
| Frame injector (attacker) | `scratch/w3/lead/sender_inject.c/.exe` — one 6-byte patch at `encryptCallback`; `--recon` / `--fire`; operator-armed trigger |
| Payload generator | `scratch/w4/fuzz-vp8/gen_e2e_payload.py` — refuses to write a frame it has not first decoded through the shipped DLL |
| VP8 mode/MV encoder | `scratch/w4/fuzz-vp8/vp8modes.py`; probability tables extracted from the shipped DLL by `findtables.py` |
| Offline reproductions | `uaf_steer.py` (content control), `uaf_partial.py` (partial pointer overwrite), `uaf_pc.py` (PC control, harness-supplied reclaimer), `gate2ctx.py`, `nplgraph.py` |
| Detailed working notes | `W5-CRUX-f4-2-content-control.md` (§15 delivery, §17 gate, §18 end-to-end) |
| Runbooks | `RUNBOOK-victim.md`, `RUNBOOK-attacker.md`, `USAGE-W5-tools.md` |
