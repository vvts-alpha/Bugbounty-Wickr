# Did You Account for ASLR? — Definitive Assessment

**Subject:** WickrPro chroma-plane heap OOB write (odd-height bug in `WickrPro.exe` sink `0x1406e95d0`)
**Question:** Does the demonstrated PC-control result hold up under ASLR, or was ASLR quietly sidestepped?
**Short answer:** ASLR was **not** accounted for by the PoC. The pcdemo proves hijack *mechanics* while running in-process with the target's real base handed to it. Under real high-entropy ASLR the write bug is genuine and remotely reachable, but turning it into unassisted RCE requires an additional ingredient (info leak, non-ASLR module, or a partial/data-only corruption route) that has **not** been demonstrated end-to-end. Verdict: **corruption survives ASLR; turnkey RCE does not, given only this bug + this PoC.**

---

## 1. ASLR posture, as measured

**CONFIRMED** (pefile over all 7 on-disk x64 binaries in `E:\tmp\wickr\desktop\binaries`; raw output at `E:\tmp\wickr\scratch\w3\lead\aslr_measure.txt`):

| Property | Result |
|---|---|
| DYNAMIC_BASE (0x0040) | **SET on all 7** (EXE + 6 DLLs) |
| HIGH_ENTROPY_VA (0x0020) | **SET on all 7** |
| NX (0x0100) | SET on all 7 |
| GUARD_CF (0x4000) | **CLEAR on all 7 — CFG OFF** |
| RELOCS_STRIPPED | clear on all 7; BASERELOC directory present on all 7 (loader can and does relocate) |

- Raw `DllCharacteristics`: six DLLs = `0x0160`; `WickrPro.exe` = `0x8160` (the extra `0x8000` is `TERMINAL_SERVER_AWARE`, irrelevant to ASLR).
- **High-entropy ASLR is in force**, not the weak low-entropy/32-bit-style layout. Randomization is full 64-bit (~2^33+ effective), so bulk-guessing an absolute address is not viable.
- **Relocation is observed, not just declared** — pcdemo saw `WickrPro.exe` mapped at `0x7FF76C4E0000` vs preferred `0x140000000`.
- **No non-ASLR core module** among the checkable binaries. Every one of the 7 is DYNAMIC_BASE + HIGH_ENTROPY_VA.

> ## ██ 2026-08-03 (W15) — RESOLVED. THE "UNKNOWN" BELOW IS NO LONGER UNKNOWN, AND THE ANSWER IS UNFAVOURABLE. ██
> The install directory was **not** gone — it is at
> `%LOCALAPPDATA%\Programs\Amazon Web Services, Wickr` and holds **287 binaries**, including
> `Qt6Pdf.dll` (5.5 MB) and `Qt6WebEngineCore.dll` (196 MB). The claim that only 7 remained was true
> of `desktop/binaries/`, the working copy — **not of the machine.** Nobody looked.
>
> **Measured over all 287 (pefile, `DllCharacteristics` + `RELOCS_STRIPPED`):**
> * **NO-ASLR modules (missing `DYNAMIC_BASE`, or relocs stripped): 0**
> * ASLR but not `HIGH_ENTROPY_VA`: **0**
> * missing NX/DEP: **0**
> * `GUARD_CF` set: **276 of 287** — reproducing F4b's count exactly, against the real install
>
> ⇒ **Route B (a fixed-address third-party module) is CLOSED, definitively, in the honest direction.**
> There is no free ASLR bypass anywhere in the shipped file set. **Consequence: the partial-pointer
> overwrite is not one option among several — it is the only address-layer route**, which is why
> W15 §3.14/§3.15 (F1's measured 32-bit partial overwrite against the `PacketSender` field set)
> matters more, not less.
>
> *(The original paragraph is kept below for provenance. Its factual premise was wrong.)*

**UNKNOWN (superseded — see the W15 block above):** the ~50 Qt6/WebRTC/plugin DLLs and the install directory were **deleted mid-session**. Only the 7 binaries above remain on disk. A single non-ASLR third-party DLL is the classic ASLR bypass (fixed code/data island), and its presence here **can be neither confirmed nor excluded**. This is the largest open question and it is *unresolvable on disk in this session*. We state it; we do not guess it away.

**Consequence of CFG OFF:** once *any* one valid code address is known, the hijacked virtual call can be aimed anywhere with no forward-edge check. CFG does not stand between the bug and RCE. That makes **address secrecy (ASLR) the only address-layer mitigation actually in play** — which is exactly why the ASLR question is decisive.

---

## 2. What pcdemo proves — and what it does NOT — under ASLR

**What it genuinely proves (CONFIRMED, audit dimension):**

- The **bug arithmetic is real and unmodified**: geometry `strideU=320, height=241` → `alloc=(241>>1)*320=38400` vs `copy=(320*241)>>1=38560` → **160-byte heap OOB write**, first 8 bytes landing on `victim+0`. Overflow *content* is the received chroma-plane payload = attacker bytes (lead-confirmed). This reproduction is faithful.
- **Post-corruption hijack mechanics**: a corrupted vtable pointer, when dereferenced for a virtual call, transfers control to the attacker-chosen slot — and with CFG OFF nothing catches it. This is a legitimate, useful result (call it the **W3 hijack-mechanics primitive**).

**What it does NOT prove — ASLR is never engaged (CONFIRMED, audit dimension):**

- pcdemo runs the vulnerable function **in-process**: `LoadLibraryExW(..., DONT_RESOLVE_DLL_REFERENCES)` then `g_base = h` (lines 134–137) hands the harness `WickrPro.exe`'s real mapped base. **Every** downstream address — patch RVAs, IAT slots, the overwrite *value*, and the redirect target — is derived from that in-process base. ASLR is never confronted.
- The **overwrite value** is `&g_fake_vtable[0]` (line 161): an absolute in-process **data** address. Under high-entropy ASLR the attacker does not know where their own controlled buffer lives. **Unstated, ASLR-denied assumption.**
- The **redirect target** is `pwned` (line 156): an absolute in-process **code** address in an executable page. Under NX+ASLR a remote attacker has no such known code address and cannot inject shellcode (NX). **Assumption denied by both NX and ASLR.**
- **Adjacency is harness-arranged** (single `VirtualAlloc`, victim pinned at block-end; the whole allocator replaced by `my_malloc`). Real path uses CRT `malloc`. Fair as "grooming can achieve adjacency," but it overstates *reliability* to *determinism*.
- The **victim is synthetic** (`struct Victim{void** vtable; char pad[152];}`, sentinel `0xDEAD...`) — not a real WickrPro C++ object, and the deciding **virtual call is performed by the harness itself** (lines 182–187, self-labeled "simulating"). It is not shown that any real WickrPro path issues a virtual dispatch on this object before the corruption faults.
- IAT redirections and two code-byte stubs are **test scaffolding** (isolating the sink), not attacker capabilities.

**Bottom line for §2:** pcdemo is an honest *mechanics* demonstration with a known target address. It is **not** an ASLR defeat. The two address unknowns it silently supplies — a code address (for the redirect target, also gated by NX) and a heap/data address (so the 8 written bytes form a valid pointer) — are precisely what ASLR withholds from a real remote attacker. The vulnerability is **write-only**; it contains no read/leak, so both unknowns must come from elsewhere.

---

## 3. Accurate exploitation model — what an attacker additionally needs

ASLR upgrades the cost from "instant control" to "one grooming step **plus** one of the routes below." Four routes exist; their realism differs sharply. CONFIRMED/INFERRED labeled throughout.

### Route A — Info-leak via the *same* memcpy (strongest lead) — CONDITIONAL
- **CONFIRMED (infoleak dimension):** the same unclamped `memcpy` in `0x1406e95d0` is *also a read primitive*. Source = the descriptor plane pointer (real ~76,800-byte NPL buffer); length = attacker-declared `(stride*height)>>1`, **not clamped to the true source size**. Declaring a length beyond the real buffer over-reads adjacent heap into the reconstructed I420 frame. The over-read needs **no odd-height parity** and is attacker-tunable and non-crashing at modest magnitudes — the classic ASLR-disclosure shape. Adjacent heap holds vtable/code pointers into ASLR'd modules and heap-base pointers.
- **CONFIRMED chain to this sink:** `NPLAVPacketGetDescriptor` (imported, IAT `0x140d53930`) → consumer `0x14013e430` → sink `0x14011b6b0` → bug `0x1406e95d0`; producer `NPL.dll!NPLAVPacketGetDescriptor` copies wire-controlled geometry with a truncating 32-bit `imul` (matches the ~4 GiB wrap). Geometry is attacker-controlled protobuf (`VideoFrame@Proto` RTTI present).
- **THE GAP (INFERRED, unprovable on disk now):** the leaked bytes land in the *decoded* frame. A 1:1 render path does **not** re-encode that frame back to the sender → **no return/exfil channel by default**. Disclosure to the attacker requires (i) conference/group forwarding that re-encodes remote video, (ii) an echo/loopback (PiP/record/thumbnail), or (iii) telemetry/stats that re-serialize frame memory. All of these live in the **deleted** Qt6/WebRTC DLLs and **cannot be confirmed**. So: leak *primitive* CONFIRMED in-process; leak *delivery to the attacker* UNPROVEN.
- **Realism:** high **if** any forwarding/echo/telemetry path exists (cheap, reliable, repeatable per frame); **blocked** if the surface is pure 1:1 render.

### Route B — Non-ASLR third-party module — UNKNOWN
- A single fixed-address Qt/plugin DLL supplies a static code/data island (partial ASLR bypass). **Status UNKNOWN** — those DLLs are deleted and un-inspectable. Cannot be claimed; cannot be excluded.

### Route C — Partial pointer overwrite (no leak needed) — INFERRED, structurally supported
- **INFERRED (geometry dimension), structurally exact:** the overflow is contiguous from `victim+0`, every byte attacker-controlled, and **byte-granular in length** (`floor(stride/2)`; stepping stride by 2 adds exactly 1 byte — CONFIRMED by recomputation). To clobber a pointer P at `victim+K`, overwrite `victim+0..K-1` with reconstructed benign field values and stop mid-pointer, changing only P's **low 1–2 bytes**. On Win64, 64 KB-granular base randomization leaves bits 0..15 of any address ASLR-invariant, so a 2-byte partial overwrite deterministically retargets P within its own 64 KB window **with zero knowledge of the randomized high bytes**. This is a canonical ASLR bypass and the primitive supports it cleanly.
- **Realism:** mechanically sound; **blocked in practice by an unknown** — it requires naming the adjacent object and a useful same-window target, which depends on object layout that lives in the deleted codec/Qt modules.

### Route D — Data-only length/size corruption (no address at all) — INFERRED, most ASLR-immune
- **INFERRED (geometry dimension):** overwrite an adjacent object's size/capacity/count field (e.g. a `QByteArray`/`std::vector`/`std::string` length) with a large controlled value and stop, leaving the object usable. A later legitimate read of that object becomes an OOB **read** → memory disclosure → defeats ASLR for a second stage. Fully ASLR-immune; needs only one groomed adjacency.
- **Note:** this is essentially the *write-primitive* sibling of Route A's leak and converges to the same "get a leak, then stage" model. Same blocking unknown: which adjacent field, which object.

**Common blocker across C and D and the write-side of A:** the **adjacent-object identity is unverified**. The call-video decode object graph above this `malloc` was not reverse-engineered, and the objects most likely live in the **deleted** Qt6/WebRTC DLLs. Grooming *reliability* (NT Heap+LFH vs Win11 Segment Heap) is also **inferred from Windows internals, not observed on the live target** — though note the decoupled 62–500 KB allocation sizes exceed the LFH 16 KB cap, placing the victim in the more-groomable backend under NT Heap (CONFIRMED by recomputation of the two decoupled knobs: overflow=`floor(stride/2)` depends only on stride; alloc=`floor(h/2)*stride` steered independently by h).

---

## 4. Corrected severity

**Proven (CONFIRMED):**
- **W1 — Remote memory corruption.** A remotely reachable, attacker-controlled heap OOB write on the call-video receive path: `floor(stride/2)` bytes past a CRT-`malloc` buffer for odd height, contiguous from `victim+0`, every byte attacker-controlled, byte-granular length, with two decoupled knobs (overflow-length via stride, allocation size-class via height). Full delivery chain from wire protobuf to sink is xref-confirmed. This is a real, high-severity remote corruption bug **on its own**, independent of ASLR.
- **W1-read — Companion OOB read primitive.** The same unclamped `memcpy` over-reads adjacent heap in-process, tunable and non-crashing — a confirmed *disclosure primitive* (its exfil channel is the open question, not the read itself).
- **W3 — Hijack-mechanics primitive.** Given adjacency + a known target address, a corrupted vtable pointer redirects an unguarded (CFG OFF) virtual call to attacker choice. Mechanics are sound and demonstrated.

**NOT proven — what remains for unassisted remote RCE under ASLR:**
1. **An address disclosure that actually reaches the attacker** — i.e. Route A's exfil channel (forwarding/echo/telemetry), **or** a non-ASLR module (Route B), **or** a self-contained partial/data-only corruption (Routes C/D). None is demonstrated end-to-end; each hinges on the **deleted** Qt6/WebRTC/codec DLLs.
2. **A named real adjacent victim object** (offset of a vtable ptr / heap ptr / size field) and proof the app actually *uses* the corrupted pointer/field before faulting. Currently synthetic in pcdemo.
3. **On-target grooming reliability** (allocator model + measured adjacency success rate). Currently inferred.
4. Under NX, a post-leak **code-reuse/ROP** step (no shellcode). Not built.

**Honest one-line severity:** a **confirmed high-severity remote heap-corruption vulnerability (W1) with a confirmed in-process read primitive and confirmed post-leak hijack mechanics (W3)** — but **not, on the current evidence, a demonstrated unassisted remote-RCE under high-entropy ASLR.** ASLR does not neutralize the bug; it moves it from "instant control" to "corruption + one leak/partial/data-only step," where every candidate step is either CONFIRMED-as-primitive-but-missing-a-channel (A) or structurally-sound-but-blocked-by-deleted-module-knowledge (B/C/D).

**Did we account for ASLR?** Yes — and the accounting is: it is real, high-entropy, on every core module, with no known non-ASLR core module and an unknown third-party DLL surface. pcdemo did **not** defeat it; it demonstrated mechanics with a cheat-supplied address. The realistic bypass routes are enumerated above with their confirmed/inferred status, and the single fact that would flip the verdict either way — the media surface's return channel and object graph — lives in binaries that were deleted mid-session and cannot be inspected here.
