# W15 — THE PEER'S OWN PLACEMENT PRIMITIVE, AND A LEAK-FREE ROUTE TO PC

**Target:** AWS Wickr Desktop 6.72.20.0 (Windows), `NPL.dll` + `WickrPro.exe` as shipped.
**Goal this wave:** RCE originating from a *call peer or message peer* — not from the hub, not from a
MITM. Everything below is static analysis of the shipped bytes. **Nothing in this file was executed,
and nothing was sent to any client.**

---

# 0. THE FALSIFYING OBSERVATION, WRITTEN BEFORE LOOKING

If the FORMAT path only *reconfigures* existing nodes — no `operator new`, no destructor — then E3 is
a state-machine surface and nothing more, the peer has no placement primitive, and link (a) stays
dead. I would have written that down.

That is not what the bytes say.

---

# 1. WHY THE PREVIOUS FRAMING WAS STUCK

Fourteen waves have held peer-originated *corruption* (F1 content-controlled UAF, W1 chroma OOB, F2
`memset`) and no peer-originated *address knowledge*. Every route was priced as
"corruption + info leak", the leak was ranked #1 for four waves, and W14 finally ran the sweep — and
found the leak **only in F6, which is hub/MITM-positioned, not peer-positioned.**

So the peer-originated question was never actually advanced by W14's leak. This wave asked a
different question and it dissolved the blocker:

> **Who chooses what sits next to the victim buffer?**
> If the *peer* does, the attacker does not need to know any address — only a size class and an
> offset, and both are compile-time constants.

---

# 2. ★★★ E3 IS POSITIVE. A PEER FORMAT PACKET DRIVES AN UNBOUNDED ALLOC→FREE CYCLE OF POLYMORPHIC OBJECTS

W13 listed E3 as "never asked since Wave 4": *does a mid-call `kind==1` FORMAT packet REBUILD the
decode graph, or only reconfigure?* Only the first ~90 instructions of the apply function had ever
been read. Here is the whole chain, read from an instruction boundary.

## 2.1 `Parser`'s FORMAT handler — `0x18011ed00` (620 B)

```
0x18011ed26  mov  rdx, [r8+0x10]          ; the peer's FORMAT payload  (data)
0x18011ed2d  mov  r8d, [r8+0x18]          ;                            (length)
0x18011ed47  call 0x180066910             ; -> std::string of the peer's bytes
0x18011ed4d  lea  rsi, [rdi+0x180]        ; this->currentFormatBytes
0x18011ed76  cmp  r8, [rsi+0x10]          ; same length?
0x18011ed7a  jne  0x18011ed92             ;   no  -> CHANGED
0x18011ed85  call 0x180112e36             ; memcmp
0x18011ed8c  je   0x18011ef0d             ;   identical -> return, do nothing
;   ---- CHANGED ----
0x18011edd3  "Received new format"
0x18011edf1  call 0x18013da20             ; PARSE  -> a NEW heap object in rbx
0x18011edfc  test rax,rax / je            ; -> "Failed to parse the format"
0x18011ee5d  lea  rcx, [rdi+0xd8]         ; the Parser's PacketSender sub-object (mdisp 216, W14)
0x18011ee67  call 0x180132d80             ; APPLY
```

**The dedup is a byte-compare against the immediately-previous format only.** Alternating between two
formats — or flipping any one field — is "changed" every single time. No counter, no rate limit, no
cooldown anywhere in the 620 bytes.

*(This path is not theoretical: W13 recorded **58 live `Received new format` events** on the
operator's own machines during ordinary two-party calls.)*

## 2.2 The apply — `0x180132d80` (641 B), and the free — `0x180132970` (127 B)

```
0x180132dcb  mov  rdx, [rdi+0x48]         ; the CURRENT format object
0x180132dd2  jne  0x180132e7c             ;   non-NULL -> the replace path
   ...
0x180132fae  call 0x180132970             ; RELEASE the old object
0x180132fb3  mov  rax, [rsi]              ; rsi = the newly parsed format
0x180132fb9  call [rax+0x18]              ; slot 3 = clone()          <== ALLOCATES AGAIN
0x180132fbc  mov  [rdi+0x48], rax         ; install
0x180132fc6  call [rax+0x20]              ; slot 4 = the "format changed" hook on self
```

and the release, `0x180132970`:

```
0x1801329a8  mov  rdx, [rbx+0x48]         ; old format
0x1801329ac  call 0x180117cf0             ; queued release (when a Node is attached)
0x1801329b1  mov  qword [rbx+0x48], 0
   ; ...or, with no Node attached:
0x1801329d7  mov  edx, 1
0x1801329dc  mov  rax, [rcx]
0x1801329df  call [rax]                   ; slot 0 with edx=1 = SCALAR DELETING DESTRUCTOR -> free()
```

**The old object is destroyed through its own vtable. It is polymorphic.**

## 2.3 ★ What gets allocated — three peer-selectable size classes, `0x18013da20` (787 B)

`Format::parse` switches on the declared kind and allocates one of exactly three classes. Sizes are
the literal `operator new` arguments (`0x1801119a8`):

| kind | `operator new` | size | RTTI, and the vtables installed |
|---|---|---|---|
| serializer | `mov ecx, 0xe8`  @ `0x18013da83` | **232 B** | `SerializerFormat` / `FormatBase<SerializerFormat>` / `Format` |
| audio | `mov ecx, 0x100` @ `0x18013dc2b` | **256 B** | `AudioFormat` / `FormatBase<AudioFormat>` / `Format` |
| video | `mov ecx, 0x140` @ `0x18013db3b` | **320 B** | `VideoFormat` / `FormatBase<VideoFormat>` / `Format` |

Each construction installs **three** vtable pointers (one per sub-object), and **the first is at
offset 0** — the standard MSVC primary-base layout, visible as paired
`lea rax,[rip+…VTABLE] / mov [reg+…], rax` at `0x18013dab2`…`0x18013db00` (serializer),
`0x18013db6d`…`0x18013dbbb` (video), `0x18013dc5a`…`0x18013dca8` (audio).

> ## ⇒ CONFIRMED (disassembled, not executed)
> **A call peer, by sending FORMAT packets that differ from the previous one, drives an unbounded,
> on-demand `allocate → free → allocate` cycle of polymorphic heap objects, in three
> attacker-selected size classes (232 / 256 / 320 bytes), each carrying a vtable pointer at offset 0,
> mid-call, with no rate limit and dedup only against the immediately-previous format.**

**This is the reclaiming object that link (a) spent three waves failing to find.** The 38/38 candidate
census died because it was searching for an object the attacker *happened* to be able to place. Here
the attacker *chooses* the placement, the size class, and the timing. That changes the constraint set
— which is exactly what W13's ranked direction said was required before spending more on link (a).

---

# 3. ★★ WHY THIS REMOVES THE INFO-LEAK REQUIREMENT

## 3.1 The overflow lands on offset 0 of the neighbour — i.e. on a vtable pointer

W3/ASLR-ASSESSMENT §2 established for W1 (`WickrPro.exe` sink `0x1406e95d0`), by recomputation:

* the write is **contiguous from `victim+0`** — the first overflow byte lands on the adjacent
  allocation's **offset 0**;
* **every byte is attacker-controlled** (it is the received chroma-plane payload);
* the length is **byte-granular**: `overflow = strideU/2` for even `strideU`;
* the allocation size class is a **decoupled second knob**: `alloc = (height>>1) * strideU`.

A `Format` object's offset 0 **is its vtable pointer**. So the two primitives compose without any
address knowledge: the peer sprays `Format` objects to occupy the bucket, then sends one video frame
whose overflow lands on a sprayed object's vtable pointer.

## 3.2 The geometry that puts the victim in the same bucket — arithmetic, not hope

Both knobs are peer-chosen, so solve for the neighbour's bucket:

| goal | `strideU` | `height` (odd, required) | `alloc = (h>>1)*strideU` | `overflow = strideU/2` |
|---|---|---|---|---|
| full 8-byte vtable overwrite in the **256 B** (`AudioFormat`) bucket | 16 | 33 | 16 × 16 = **256** | **8 bytes** — exactly one pointer |
| **2-byte partial** overwrite in the same bucket | 4 | 129 | 4 × 64 = **256** | **2 bytes** |
| 320 B (`VideoFormat`) bucket, 8-byte overwrite | 16 | 41 | 16 × 20 = **320** | 8 bytes |
| 232 B (`SerializerFormat`) bucket, 2-byte overwrite | 4 | 117 | 4 × 58 = **232** | 2 bytes |

*(Recomputed from the assessment's own worked example: `strideU=320, height=241 → alloc=38400,
copy=38560, overflow=160` — same formulas.)*

**The 2-byte row is the one that matters.** On Win64 the loader places images on 64 KB granularity, so
**bits 0..15 of any address are ASLR-invariant**. Writing only the low 2 bytes of a vtable pointer
retargets it deterministically inside its own 64 KB window **with zero knowledge of the randomized
high bytes** — and every one of these vtables lives in `NPL.dll`'s `.rdata`, alongside the import
address table. With **CFG inert (F4b, confirmed: `GUARD_CF` clear on all 7 binaries and `WickrPro.exe`
never opts in)**, nothing checks the resulting indirect call.

> **⇒ The route needs no information leak, and no defeat of ASLR. It needs a size class, an offset,
> and two bytes.** That is why fifteen waves of leak-hunting were the wrong search.

## 3.3 ★ The heap is shared — checked, because the whole thing rests on it

The `Format` objects are allocated by `NPL.dll`; the chroma-plane victim buffer by `WickrPro.exe`.
If either statically linked its CRT they would be different heaps and §3.1 would be void.

**CONFIRMED (import tables of both shipped binaries):** neither statically links the CRT. Both import
`malloc`/`free`/`calloc`/`realloc` from the *same* forwarder, `api-ms-win-crt-heap-l1-1-0.dll`
(NPL: 5 imports; WickrPro: 7, plus `_set_new_mode`). MSVCP140 / VCRUNTIME140 are shared DLLs in both.
⇒ **one process heap, one set of LFH buckets. The adjacency in §3.1 is between objects from the same
allocator.**

## 3.4 ★ The reachable call set, enumerated — 277 NPL entry points with a peer-controlled `this`

Which pointer does the overflow actually hit, and which call consumes it? Both are settled:

* These classes use **virtual inheritance** (`mov rax,[rdx+8] / movsxd rcx,[rax+4] / add rcx,8` — a
  vbptr at +8 and a vbtable offset), so the object carries several vtable pointers. **Offset 0 is the
  primary vtable**, and it is the one the overflow reaches first.
* **Offset 0 is exactly the pointer the apply path dispatches through:** `0x180132dde` and
  `0x180132fb9` both do `mov rax,[rsi] / call [rax+0x18]` on the format object — **slot 3, `clone()`**.
  So the corrupted pointer is consumed on **the next FORMAT packet**, which the peer sends on demand.

Because the low 16 bits of an image address are ASLR-invariant *and* byte-granular, the fake vtable
`A` may be **any byte offset** in the 64 KB window — not just an aligned one. The callable set is
therefore `{ [A+0x18] : A ∈ window }`. Measured over the shipped `.rdata` (`scratch/w15/window.py`):

| window | contains | A-values yielding a `.text` pointer | of which are `.pdata` function **starts** | **distinct callable functions** | IAT entries in window |
|---|---|---|---|---|---|
| RVA `0x430000–0x43ffff` | `SerializerFormat` vt `0x18043ea00`, `VideoFormat` vt `0x18043fb88` | 1054 / 65536 | 486 | **277** | 0 |
| RVA `0x440000–0x44ffff` | `AudioFormat` vt `0x1804426f0` | 977 / 65536 | 451 | **239** | 0 |

⇒ **a 2-byte write selects one of ~277 real NPL function entry points, called with `rcx` = the
`Format` object — whose fields the peer populates through the FORMAT protobuf that `0x18013da20`
parses.** That is an arbitrary-callee, controlled-`this` position obtained with **no address
knowledge whatsoever**.

**Honest limit:** NPL's IAT lives at RVA `0x424xxx`, in the `0x420000` window — **neither Format
window reaches it**, so a *direct* import call (the shortest path to something like a file write or
a library load) is **not** available from this pointer. Turning "call one of 277 NPL functions with a
controlled `this`" into execution still requires picking a gadget, and that has not been done.

## 3.5 The gadget search — run, and it defines the honest boundary of the leak-free route

With the callable set in hand (499 distinct entry points across both windows), I asked whether any of
them finishes the job on its own.

**(a) Reachability to a dangerous import.** NPL imports `LoadLibraryA/W/ExA`, `GetProcAddress`,
`VirtualProtect`, `WriteFile`, `fopen`/`_wfopen`/`freopen`/`fwrite`. BFS over the direct call graph
(`scratch/w15/reach.py`), depth 5:

| window | callees | reach a key import ≤ depth 5 |
|---|---|---|
| 0x430000 | 277 | **1** — `0x1800f1b20` → depth 2 → `0x18015bb70` `fopen` |
| 0x440000 | 239 | **2** — `0x180169800` → depth 2 → `0x180167470` `fopen`; `0x18015a1c0` → depth 5 → `0x180330c70` `WriteFile` |

**Not one reaches `LoadLibrary`, `GetProcAddress` or `VirtualProtect` at any depth ≤ 5.** The three
file hits are unverified for argument control, and depth 5 with a controlled `this` is optimistic —
intermediate frames will not preserve it. *(A file-write primitive would nevertheless be worth
chasing: F4d already established the install directory is user-writable and the interactive user
holds `FullControl` on `WickrPro.exe`, so a controlled write is a launch-time execution route.)*

**(b) A second-stage indirect call.** Scanning the first 40 instructions of each callee while `rcx`
is still live: **0 gadgets of the form `call [rcx+X]`**, and **35 of the form "load, then
`call [reg+Y]`"** — e.g. `0x1800cd750` @ `0x1800cd766` and `0x180136290` @ `0x1801362a9`
(`call qword ptr [rax]`), plus 33 with displacements 8/0x20/0x30/0x38/0x68/0x70.

> ### ⇒ THE HONEST BOUNDARY
> A second stage **does not help by itself.** The peer controls the `Format` object's contents
> completely (they are parsed from its own protobuf), so it can place *any* 8-byte value at
> `[rcx+X]` — but choosing a *useful* value requires knowing an address, and that is exactly what the
> partial overwrite was designed to avoid. **The leak-free route terminates at "call one of 499 NPL
> functions with a peer-controlled `this`."** Converting that to execution needs either a callee that
> performs a dangerous operation with `this`-derived arguments (the three file candidates above,
> none verified), or an address — which reinstates the leak.

## 3.6 ✗ THE DIRECTION I EXPECTED TO CLOSE IT — TESTED AND REFUTED

The callable set is NPL's own AV-graph methods, and several look like send-path nodes
(`PacketSender::onEvent 0x180132cc0` is the 24-class forwarder W14 censused; `0x18011cf00`,
`0x180127360`, `0x1801274e0` have the same this-off-112/216 shape). So the obvious finish was: drive
one of them with a controlled `this` and make it emit memory to the wire — a **peer-positioned**
information leak obtained from the placement primitive itself, the same shape as F6's leak but on the
peer side. That would solve the address problem, open the full 8-byte overwrite, and close the chain.

**It does not work. BFS from all 499 callees to `sendto` / `send` / `SSL_write` / `BIO_write`
(the complete egress import set — W14 §6, re-confirmed here against the import table):**

| depth | callees reaching the wire |
|---|---|
| 3 | **0 of 499** |
| 5 | **0 of 499** |
| 7 | **0 of 499** |

Six functions in the image reference those imports; **none is reachable from the callable set.** The
send-path *nodes* are in the set, but the egress is several layers below them through indirect
dispatch the static graph does not cross — and a partial-overwrite call enters at the top of a node
method with a `this` that is a `Format` object, not a node, so those virtual dispatches will not
resolve usefully anyway. **NEGATIVE — do not re-chase this.**

## 3.7 ★★★★ CORRECTION TO §3.4 AND §3.5 — THE LEAK IS NOT REQUIRED. WRONG OBJECT, NOT WRONG METHOD.

§3.4 recorded "**No IAT in either window** (IAT is RVA 0x424xxx)" and §3.5 concluded from it that the
leak-free route terminates at "call one of 499 NPL functions". **That inference was wrong.** It is true
of the *`Format`* windows (RVA 0x430000 / 0x440000) and I generalised it to the technique. The window
is a property of **the object you corrupt**, not of the technique — so the fix is to corrupt a
different object.

**Measured over the shipped `NPL.dll`:**

* **All 524 of NPL's imports live in RVA `0x424000`–`0x4250f8` — entirely inside the 64 KB window
  `0x420000`.**
* **65 of NPL's 553 vtables are in that same window.** Distribution: `0x42`:65, `0x43`:147, `0x44`:120,
  `0x4a`:67, `0x4b`:28, `0x4c`:77, `0x4d`:49.

⇒ a 2-byte partial overwrite of the offset-0 vtable pointer of **any object whose vtable is in window
`0x42`** re-aims it anywhere in that window — **including directly onto an IAT entry**, where the
qword is a *resolved imported function pointer*. With CFG inert, the next virtual dispatch calls it.

| import | IAT RVA | low-16 value to write (for a slot-3 `+0x18` dispatch) |
|---|---|---|
| `VirtualProtect` | `0x424080` | **`0x4068`** |
| `LoadLibraryW` | `0x4242a8` | **`0x4290`** |
| `LoadLibraryA` | `0x424138` | `0x4120` |
| `LoadLibraryExA` | `0x424090` | `0x4078` |
| `GetProcAddress` | `0x4242a0` | `0x4288` |
| `WriteFile` | `0x424158` | `0x4140` |
| `fopen` / `_wfopen` / `freopen` / `fwrite` | `0x424de0` / `0x424d90` / `0x424d98` / `0x424d68` | `0x4dc8` / `0x4d78` / `0x4d80` / `0x4d50` |

*(A is byte-granular and IAT entries are 8-aligned, so **every one of the 524 imports is reachable**;
the slot displacement is absorbed by choosing A.)*

**Candidate objects in window `0x42`, and why they matter:** `Musigy::Internal::Command1/Command2/
Command3<…ConnectionImpl…>` (`0x18042e0c0`, `0x18042e0f8`, `0x18042e130`, `0x18042e168`, `0x18042a968`…)
are the **Reactor's inter-thread queue objects — one heap allocation per queued network event**, i.e.
allocated at a rate the peer drives. Also `ConnectionImpl` (`0x18042d630`), `Socket` (`0x18042d4c0`),
`PacketPacerPacketPool` (`0x18042e3a0`), `PacketPacer` (`0x18042e3c0`), `SecureConnection`
(`0x18042ab40`), the four `CongestionStrategy` classes, and `RefCountedBase<1>` (`0x180427000`) — the
base whose vtable is installed *first* by the `Packet` constructor `0x180135a40`.

> ### ⇒ THE ASLR PROBLEM IS SOLVED WITHOUT ANY DISCLOSURE
> **The blocker was never ASLR, and it was never the missing leak.** A 2-byte, ASLR-invariant write
> onto a window-`0x42` vtable pointer yields a **direct call to any of NPL's 524 imports**, including
> `VirtualProtect`, `LoadLibraryW` and `GetProcAddress`. Three sweeps hunted an information leak that
> the technique does not need.

**What genuinely remains (and it is a different, smaller problem):**

1. **Adjacency.** W1's overflow must land on a window-`0x42` object. That is the same grooming
   question as §3.2/§4.1, but re-solved for these classes' size classes rather than the `Format`
   classes'. **Not demonstrated.**
2. **★ Argument setup — now the real last mile.** The callee receives `rcx` = the corrupted object and
   the remaining registers from the dispatch site. `LoadLibraryW(rcx)` needs `rcx` to be a UTF-16
   path, but `rcx` points at an object whose first bytes *are* the vtable pointer — and widening the
   overflow to control those bytes destroys the partial-overwrite property. So a *single* hop does not
   obviously give useful arguments. This is the classic final mile and it is **unsolved here**.
3. Note the tension is not fatal: `Command*` objects are small, peer-rate-allocated, and their
   post-vtable fields are function-pointer/argument slots — worth reading before assuming (2) is hard.

**Status: this REPLACES §3.5's boundary. It does not by itself constitute RCE, and none of it was
executed.**

## 3.8 THE REMAINING OBSTACLE, STATED EXACTLY — and it is no longer "we need a leak"

§3.7 solves the *code address*. What is left is **argument setup**, and reading `Command2::execute`
makes the shape of the problem exact.

**The ideal gadget exists in the binary.** `Musigy::Internal::Command2<ConnectionImpl,…>::execute`
(`0x1800a6580`, the last vtable slot; the vtable proper is at `0x18042e0c8` — note the listing in §3.7
prints the **COL** slot, the vtable starts 8 bytes later) is a pure tail-call dispatcher:

```
0x1800a6580  mov    rdx, rcx
0x1800a6583  movsxd rcx, dword [rcx+0x30]      ; this->thisAdjust
0x1800a6587  add    rcx, [rdx+0x20]            ; rcx = this->target + adjust     <- ARG1
0x1800a658b  mov    rax, [rdx+0x28]            ; rax = this->memberFnPtr        <- CALL TARGET
0x1800a658f  mov    r8,  [rdx+0x40]            ;                                <- ARG3
0x1800a6593  mov    edx, dword [rdx+0x38]      ;                                <- ARG2
0x1800a6596  jmp    rax                        ; tail call, no CFG check
```

Object size **0x48** (`mov edx,0x48` in the deleting destructor `0x1800a4f30`). Control
`+0x20/+0x28/+0x38/+0x40` and you have **an arbitrary call with three chosen arguments** — everything
the last mile needs. `0x1800a6620` is the sibling `Command1` thunk with the same shape.

**Why it cannot (yet) be reached, stated as a falsifiable claim:**

1. **A prefix-contiguous overflow cannot both preserve a pointer and control fields beyond it.** W1
   writes from the neighbour's offset 0 outward. An overflow short enough to leave the vtable pointer's
   high 6 bytes intact (< 8 bytes — the ASLR-invariant partial write) never reaches `+0x20`. An
   overflow long enough to reach `+0x20` has already overwritten `+0x00` in full, and writing a *valid*
   vtable pointer there requires the absolute address the whole technique avoids. **Strictly
   either/or, for one object.**
2. **Two objects does not fix it.** A long overflow that covers object A and stops 2 bytes into
   object B gives A's fields *and* B's partial vtable — but `execute` dispatched on B reads **B's**
   fields, which are untouched.
3. **No reachable dispatcher forwards through `this`.** Re-running the gadget scan **including `jmp`
   tail calls** (the earlier §3.5 scan looked only at `call`, and that was a real gap) over all
   **499** callees reachable from the `Format` windows across dispatch slots `+0x00`…`+0x38`:
   **0 dispatchers of the form "load from `[rcx+X]`, then `jmp`/`call` it".** `Command2::execute`
   itself is not reachable from windows `0x43`/`0x44` — its vtable lives in window `0x42`.

> ### ⇒ THE GAP, PRECISELY
> Not "no information leak" (§3.7 killed that). The gap is: **find an object that is (a) virtually
> dispatched, (b) has its vtable in window `0x42` so the partial overwrite reaches the IAT *or*
> `Command*::execute`, and (c) has its `+0x20…+0x40` fields filled with peer-influenced values
> *legitimately* — so no overflow is needed to control them.**
>
> Condition (c) is the new question and it is a *reading* task, not a search: the `Command*` objects
> are the Reactor's bound-call records, and their bound arguments are exactly the things network
> events carry (`PacketType`, `SocketAddress`, `ConnectionState`). **Nobody has read what a peer can
> actually put in those fields.** That is the next concrete step, and it is small.

**Still not RCE. Nothing executed.**

## 3.9 ★★★ CONFLICT (1) IS BROKEN — SECONDARY VTABLE POINTERS SIT AT NON-ZERO OFFSETS

§3.8's obstacle (1) — "a prefix-contiguous overflow cannot both preserve a pointer and control fields
beyond it" — assumed the pointer to preserve is at **offset 0**. That is only true for
single-inheritance objects. **Under multiple inheritance the secondary vtable pointers sit at non-zero
object offsets, and everything before them is fully controllable while they take the 2-byte
ASLR-invariant write.**

Measured over the shipped `NPL.dll` (COL field `+4` is the vtable's this-offset):

* **163 of 553 vtables are secondary** (this-offset ≠ 0). By window: `0x42`:8, `0x43`:53, `0x44`:51,
  `0x4c`:41, `0x4d`:10.
* **8 of them are in the IAT window `0x42`**, and three are real NPL classes:

| class | vtable | this-offset |
|---|---|---|
| **`Net::NPL::ConnectionImpl`** | `0x18042d780` | **+0x10** |
| **`Net::NPL::ConnectionImpl`** | `0x18042d7b8` | **+0x18** |
| `Net::NPL::IOLoop` | `0x18042d3c0` | +0x10 |
| `Musigy::TimerDispatcherImpl` | `0x1804277e8` | +0x10 |
| (`std::basic_ostringstream` ×2, `basic_ifstream`, `basic_stringstream`) | | +0x88 / +0xb0 / +0x98 |

⇒ **an overflow of exactly `0x1A` bytes into a `ConnectionImpl` writes bytes `0x00`–`0x17` with fully
chosen content and lands its last 2 bytes on the `+0x18` secondary vtable pointer** — whose high 6
bytes survive, whose window is `0x42`, and which therefore re-aims to **any of NPL's 524 IAT entries**.
The primary vtable at `+0x00` and the `+0x10` interface are destroyed, but the dispatch we are using
goes through `+0x18`, so that does not matter provided nothing dispatches through the other two first.

`overflow = strideU/2 = 0x1A` needs `strideU = 0x34 = 52`; `strideU = align4(d_w/2)` ⇒ **`d_w = 104`**
(`align4(52) = 52`). The allocation knob stays free: `alloc = (d_h>>1) × 52`, so `d_h` selects the
size class independently — solve it for `ConnectionImpl`'s size when grooming.

> ### ⇒ WHAT IS LEFT IS ONE QUESTION, AND IT IS SMALLER THAN EVERY PREVIOUS ONE
> The call target is solved (§3.7), the pointer-vs-fields conflict is solved (§3.9). **The argument
> registers still come from the dispatch site, not from the object** — `rcx` will be `object+0x18`,
> and `rdx`/`r8`/`r9` are whatever the caller of that interface method happened to load.
>
> **Next step: find the dispatch site for `ConnectionImpl`'s `+0x18` interface and read what
> `rdx`/`r8`/`r9` hold there.** If any of them is peer-influenced — and this is a *network connection*
> interface, so a length, a buffer pointer or a `SocketAddress*` is exactly what such a method
> receives — then `VirtualProtect(rcx=heap, rdx=size, r8=PAGE_EXECUTE_READWRITE, …)` or a file write
> becomes reachable directly. **This has not been read.**

### 3.9a The two interfaces, named — and the first register-discipline data point

RTTI on `ConnectionImpl` (`hier.py` on `0x18042d7b8`, 7 base descriptors) names both secondary
interfaces:

| object offset | interface | vtable | window |
|---|---|---|---|
| **+0x10** | **`Net::NPL::PacketSender`** | `0x18042d780` | `0x42` ✓ |
| **+0x18** | `ReliabilityLayer::ChannelNotificationListener` | `0x18042d7b8` | `0x42` ✓ |
| +0x08 | `RefCountedContract` | — | — |

**`PacketSender` at +0x10 is the more valuable of the two** — it is the *send* interface, so its
methods receive packet buffers and lengths, i.e. exactly the registers an import wants. Geometry for
it: `overflow = strideU/2 = 0x12` ⇒ `strideU = 36` ⇒ **`d_w = 72`**, `d_h` still free for the size
class.

**First data point on the register discipline, and it is not yet a match.** The meaty slot of the
`PacketSender` vtable is slot 1 (`0x1800a9720`, 1006 B). Its prologue fixes the signature:

```
0x1800a972f  mov dword [rax+0x20], r9d     ; arg4 is a 32-bit int (spilled as dword)
0x1800a9740  mov r12d, r9d
0x1800a9743  mov r15, r8                   ; arg3 is a POINTER
0x1800a9746  mov r13, rcx                  ; arg1 = this
```
⇒ a call site for this slot holds `(rcx=this, rdx=?, r8=pointer, r9d=int32)`. Matched against
`VirtualProtect(lpAddress, dwSize, flNewProtect, lpflOldProtect)` that fails twice: `r8` being a
pointer makes `flNewProtect` a wild value, and `r9d` being a small int makes `lpflOldProtect` a bad
pointer. `fwrite`/`LoadLibraryExA` mismatch similarly. **NEGATIVE for this slot.**

> **⇒ The remaining search is now fully specified and finite:**
> **(interfaces whose vtable is in window `0x42`) × (their vtable slots) × (NPL's 524 imports)**,
> scored by whether the *call site's* register discipline matches the import's signature. The
> candidate interfaces are `PacketSender` (+0x10), `ChannelNotificationListener` (+0x18), `IOLoop`
> (+0x10), `TimerDispatcherImpl` (+0x10), plus the 57 primary window-`0x42` vtables. **What is missing
> is the call sites** — the callee prologue gives the signature, but the caller's actual register
> values need the dispatch site. That is the next task and it is mechanisable.

**Correction to §3.8 conclusion (3):** the "0 dispatchers forward through `this`" result stands, but it
is no longer load-bearing — §3.9 does not need a forwarding dispatcher.

**Still not RCE. Nothing executed.**

## 3.10 ✗ THE DIRECT-IMPORT ENDGAME IS STRUCTURALLY DEAD — and what replaces it

§3.7 showed all 524 imports are *callable*. Scoring them against real dispatch discipline kills the
idea, for a reason that is structural rather than incidental.

**At a C++ virtual dispatch `rcx` is always the object pointer.** Every dangerous import wants
something else as argument 1:

| import | wants `rcx` = | gets | verdict |
|---|---|---|---|
| `LoadLibraryA/W` | `LPCSTR/LPCWSTR` path | a heap object whose first 8 bytes are a (corrupted) vtable pointer | ✗ structural |
| `GetProcAddress` | `HMODULE` | heap object | ✗ |
| `WriteFile` | `HANDLE` | heap object | ✗ |
| `fopen`/`_wfopen`/`fwrite` | path / buffer | heap object | ✗ |
| `VirtualProtect` | `lpAddress` — **a heap pointer is fine** | heap object ✓ | see below |

`VirtualProtect` is the only one whose argument 1 is satisfied, so it got a full scan.
**Measured across every indirect virtual dispatch in `NPL.dll` — 3,035 sites:** 121 set `r8` to a
small immediate, 75 set `r9` with a `lea`, and **8 do both** (the `VirtualProtect(lpAddress, dwSize,
flNewProtect, lpflOldProtect)` shape). Every one of the 8 passes **`r8d = 1` or `2`**:

```
0x18015e819  r8d,1 / lea r9,[rsp+0x50]      0x1801cafea  edx,1 / r8d,1 / lea r9,[rsp+0x68]
0x180162608  r8d,1 / lea r9,[rsp+0x60]      0x1801cb07b  edx,2 / r8d,1 / lea r9,[rsp+0x70]
0x1801caf59  r8d,1 / lea r9,[rsp+0x68]      0x1803dfb88  r8d,1 / lea r9,[rip+0xf3a76]
0x1803f80aa  edx,1 / r8d,2 / lea r9,[rip-0x37860f]       0x1803f8d7e  r8d,1 / lea r9,[rbx+0x40]
```

`flNewProtect = 1` is `PAGE_NOACCESS` and `2` is `PAGE_READONLY`. **Not one site supplies an
executable protection constant** (`0x40` `PAGE_EXECUTE_READWRITE`, `0x20`, `0x10`). **NEGATIVE.**

> ⇒ **Being able to call any import is not enough when the calling convention pins argument 1 to
> `this`.** §3.7's reach is real but by itself it is not an endgame. This is a correction to the
> optimism in §3.7's closing line.

## 3.11 ★ WHAT REPLACES IT — an argument-shifting thunk behind a HIGH-offset secondary vtable

The missing capability is an **argument shifter**, and §3.8 already found the perfect one:
`Command2::execute 0x1800a6580` (`rcx = [this+0x20]+adj`, `rax = [this+0x28]`, `edx = [this+0x38]`,
`r8 = [this+0x40]`, `jmp rax`). §3.8 dismissed it because reaching `+0x20…+0x40` destroys a vtable
pointer at offset 0 — **but §3.9 showed the pointer need not be at offset 0.**

Combine the two: **an object with a secondary vtable at offset K > 0x40, in window `0x42`.** Then an
overflow of `K+2` bytes controls `0x00…K-1` — *including* `+0x20…+0x40` — and lands its last 2 bytes
on that vtable pointer, whose high 6 bytes survive. Aim it at `A` where `[A+slot] = 0x1800a6580`
(reachable: `Command2::execute` sits at `0x18042e0f0`, inside window `0x42`). Result:
**`jmp` to a fully chosen address with three fully chosen arguments — no leak, no ASLR defeat.**

**Such objects exist in window `0x42`, and they are exactly the three I set aside as "std internals":**

| class | secondary vtable | offset K | overflow needed | `strideU = 2·overflow` | `d_w` |
|---|---|---|---|---|---|
| `std::basic_ostringstream<char>` | `0x180426f98` | **+0x88** | 0x8A | 0x114 | **276** |
| `std::basic_stringstream<char>` | `0x180429518` | **+0x98** | 0x9A | 0x134 | **308** |
| `std::basic_ifstream<char>` | `0x180427c48` | **+0xb0** | 0xB2 | 0x164 | **356** |

(`strideU = align4(d_w/2)`, `overflow = strideU/2`; `d_h` stays free to select the size class.)

**Why this is not a stretch:** `basic_ostringstream` is what the **logger** uses, and the log path is
peer-triggerable — every `"Received new format"`, `"dropping out-of-order/duplicate packet"`,
`"Incoming packet is broken"` line the peer can provoke constructs one. That makes it a
**peer-rate-allocated object with a high-offset secondary vtable in the IAT window**, which is exactly
the shape the chain needs.

## 3.12 ✗✗ §3.11 REFUTED ON TEST — AND THE CONFLICT IS SCALE-INVARIANT

Two checks, one confirming and one fatal.

**Confirmed:** `Command2::execute` is reachable at **every** dispatch slot. It sits at `0x18042e0f0`,
so for a dispatch at slot `S` set `A = 0x42e0f0 − S`, which stays inside window `0x42` for all
`S ≤ 0xe0f0`. The low-16 value to write is simply **`0xe0f0 − S`** (`0xe0f0`, `0xe0e8`, `0xe0e0`,
`0xe0d8`, … for `S = 0x00, 0x08, 0x10, 0x18`). That condition is satisfied by construction.

**Fatal:** the thunk reads its fields **relative to the pointer it was dispatched through.**
`Command2::execute` does `[rcx+0x20]`, `[rcx+0x28]`, `[rcx+0x38]`, `[rcx+0x40]` — and at a dispatch
through a secondary interface at offset `K`, `rcx = object + K`. So the fields it reads are at
`object+K+0x20 … object+K+0x40` — **after** the vtable pointer at `object+K`, which the overflow must
stop short of. Concretely for `basic_ostringstream` (`K = 0x88`, and its `+0x88` vtable turns out to
have exactly **one** slot — `0x180426f98` slot 0 = `0x180067ffc`, everything after it is data): the
overflow controls `0x00…0x87`, but the thunk would read `0xa8…0xc8`.

> ### ⇒ THE CONFLICT IS SCALE-INVARIANT, AND THAT IS THE REAL RESULT
> Moving the preserved pointer to a higher offset moves the thunk's read window up by exactly the same
> amount. **Any dispatcher that reads fields at positive offsets from its `this` reads past the very
> pointer that dispatched it.** Three attempts now hit this same wall — offset-0 vtable (§3.8), a
> second object (§3.8), and a high-offset secondary vtable (§3.11). It is not an accident of the
> objects chosen; it is a property of a prefix-contiguous overflow against C++ dispatch.
>
> **The only escape is a dispatcher that reads at NEGATIVE offsets from `rcx`** — a secondary-interface
> method that adjusts `this` downward (`lea rcx,[rcx-K]` / `mov rax,[rcx-X]`) before touching fields.
> Those exist in MI-heavy code and NPL is MI-heavy (163 secondary vtables). **That is the one shape
> not yet searched for, and it is the next thing to try.** Everything else in this section is closed.

## 3.13 ✗ THE LAST ESCAPE IS ALSO NEGATIVE — AND THAT IDENTIFIES THE REAL CONSTRAINT

§3.12's one remaining escape was a dispatcher reading at **negative** offsets from `rcx`. Collected
every virtually-dispatchable function in `NPL.dll` by walking all 553 vtables — **605 distinct
functions** — and scanned each one's first 20 instructions for `mov rXX, [rcx - N]` followed by a
`jmp`/`call` through that register, plus direct `call [rcx - N]`:

**0 of 605.** NEGATIVE.

> ### ⇒ THE CONSTRAINT IS **W1's CONTIGUITY**, NOT ASLR AND NOT THE ABSENCE OF A LEAK
> Every wall in §3.8–§3.13 traces to one property: **W1's overflow is prefix-contiguous from the
> neighbour's offset 0.** That is what forces the either/or between preserving a pointer and
> controlling fields beyond it, and it is why moving the pointer higher (§3.11) does not help — the
> thunk's read window moves with it.
>
> **The engagement already holds a write primitive without that property: F1.** The libvpx
> `vp8_de_alloc_frame_buffers` UAF writes attacker-chosen `MODE_INFO` records through a dangling
> pointer **at scattered macroblock-derived offsets — a lattice, not a prefix.** Three waves priced
> link (a) as "find a reclaiming object with *a pointer* at a lattice-hittable offset" and killed 38
> of 38 candidates against a 3.32 % density. **That was the wrong target specification.** What is
> actually wanted is now exact:
>
> > **a reclaiming object whose lattice-hittable offsets include `Command2::execute`'s field set —
> > `+0x20` (arg1 base), `+0x28` (call target), `+0x38` (arg2), `+0x40` (arg3) — while *sparing* the
> > vtable pointer**, which the lattice does not need to touch because §3.7/§3.12 already give the
> > vtable redirect for free (`write low16 = 0xe0f0 − S`, valid at every slot).
>
> A lattice that must *avoid* one qword and *hit* four specific ones is a very different search from
> "hit any pointer", and it is scored against a completely different object set — the window-`0x42`
> classes, not the 38 previously tried. **Nobody has run that search. It is the single concrete next
> step and it reuses F1, which is already demonstrated live over a real call.**

**Everything in §3 is now either confirmed or closed. Still not RCE. Nothing executed.**

## 3.14 ★★★★ F1 ALREADY HAS THE PARTIAL OVERWRITE — MEASURED — AND THE OLD LINK-(a) SEARCH FAILED FOR A REASON THAT DOES NOT APPLY TO THE NEW SPEC

Reading F1's own write-up (`DISCLOSURE-2026-08.md` §F1) against §3.13's target spec produces three
facts that reframe the whole thing, one of which I had been treating as an open question all session.

**(1) The partial overwrite is not a proposal — it is CONFIRMED AND MEASURED for F1.**
> *"ASLR-surviving partial pointer overwrite — CONFIRMED (measured offline against the unmodified
> shipped DLL). A planted `0x00007ffabcde1234` became `0x00007ffa02460468` — the low 32 bits set to the
> requested value, the ASLR-bearing high 32 bits bit-for-bit intact. **No information leak is
> required.**"*

That is **32 bits** of control with the ASLR-bearing half preserved — strictly stronger than the
2-byte trick §3.2/§3.9 designed for W1, and it is already demonstrated against shipped code.

**(2) The 244-byte unwritable prefix is a FEATURE under the new spec, not the obstacle it was.**
Block size `= (mb_rows+1)(mb_cols+1)·76 + 23`; `mi` sits at `16 + (mb_cols+2)·76` from the raw base, so
**the first 244 bytes (minimum, at `mb_cols = 1`) are never written.** F1's own analysis used this as a
*disqualifier* — *"a plain polymorphic object can never be the target"* — because it puts a small
object's vtable pointer **out of reach**. But §3.13's spec does not want to overwrite the vtable: the
vtable redirect is already free (§3.7/§3.12, `low16 = 0xe0f0 − S`). **What the new spec wants is a
vtable that SURVIVES while later fields are written — which is exactly what a ≥244-byte unwritable
prefix delivers.** The same fact flips sign between the two specs.

**(3) The old search died from a constraint the new spec does not have.** Its stated systematic reason:
> *"not one points into memory an attacker can spray — they point into module images, or are interior
> self-pointers, or target the generic small-block heap — and **a partial overwrite cannot move a
> pointer out of its own 4 GiB window**, while the ~2 GiB of decoder frame buffers the attacker can
> spray receives an independent ASLR draw."*

That kills *redirect-a-pointer-into-sprayed-data*. The new spec never does that. It wants
`Command2::execute`'s field set, where `[this+0x28]` is the **call target** — and a pointer that
already holds a *code* address can be partial-overwritten to **anywhere inside NPL's own 4 GiB window**,
which is where it already points. Inside that window sit **NPL's import thunks** (`jmp qword ptr
[rip+IAT]` stubs in `.text`), so redirecting a code pointer to an import thunk reaches
`LoadLibraryW`/`VirtualProtect`/`GetProcAddress` **without ever leaving the window and without a leak.**

> ### ⇒ THE RE-SPECIFIED TARGET, AND WHY IT IS A GENUINELY NEW SEARCH
> **A reclaiming object, in a block-size class F1 can produce (~15 % of sizes — the 76-step lattice
> against 16-step NT buckets), such that:**
> 1. its dispatched vtable pointer lies **inside the ≥244-byte unwritable prefix** ⇒ survives intact;
> 2. `interface+0x28` holds a **code pointer** ⇒ partial-overwritable to an NPL import thunk;
> 3. `interface+0x20`, `+0x38`, `+0x40` are writable lattice positions (68 of every 76 residues are
>    reachable) ⇒ the three arguments;
> 4. and the object is reachable via `Command2::execute` (`0x1800a6580`), which §3.12 confirmed is
>    reachable at **every** dispatch slot.
>
> The previous census enumerated **pointer stores scored for redirection into sprayed memory**, over a
> candidate set of 38, and its own write-up names three unclosed holes: *the allocator regime (LFH vs
> backend) was never tested and ~20 exclusions assume LFH; the search enumerated pointer stores and a
> **26-function load-side residue was never taken to a verdict**; and the `.pdata` blind spot applies.*
> **None of those 38 was scored against conditions 1–4.** This is a different predicate over a
> different candidate set, and it has never been run.

**Still not RCE, still nothing executed, and conditions 1–4 are a specification, not a result.**

## 3.15 ★★★★★ THE SCORING RAN — 42 CLASSES SATISFY CONDITIONS (1) AND (3), AND THE MODAL HIT IS `PacketSender` AT EXACTLY THE RIGHT OFFSET

Conditions (1) and (3) of §3.14 are a pure arithmetic filter and it has now been run over every vtable
in `NPL.dll`.

**The band.** The unwritable prefix is `P = 16 + (mb_cols+2)·76` ⇒ `P ∈ {244, 320, 396, 472, …}`,
attacker-selected. Preserving the dispatched vtable at object offset `K` while writing
`K+0x20 … K+0x40` requires `K < P ≤ K+0x20`, i.e.

`K ∈ [212,243] ∪ [288,319] ∪ [364,395] ∪ [440,471] ∪ …` (32-wide bands, 76 apart)

**The result.** Of NPL's 553 vtables, 163 are secondary; **42 of those have a this-offset inside a
valid band.** The distribution is not diffuse — it is dominated by one offset:

| K | count | what it is |
|---|---|---|
| **0xd8 (216)** | **26** | **`Net::NPL::PacketSender`** — mdisp 216, the interface W14 identified |
| 0x138 (312) | 5 | `ProxyVideoOutput`, `ProxyAudioOutput`, `FdkAacDecoder`, `OpusDecoder`, `AudioEncoder` |
| 0x180 (384) | 3 | `StatisticNode`, `FdkAacDecoder`, `Puller` |
| 0xe0 / 0x120 / 0x130 / 0x170 / 0x188 / 0x258 / 0x340 / 0x560 | 1 each | `Splitter`, **`NetworkSink`**, `PacketQueue`, `JitterBuffer`, `OpusDecoder`, `AudioSource`, `PacketQueue`, `ColorspaceConverter` |

The `K = 0xd8` family is **`Parser`, `Serializer`, `CryptProxy`, `Muter`, `StatisticNode`,
`VideoEncoder`, `VideoDecoder`, `PacketMonitor`, `ColorspaceConverter`, `NoiseGate`, `VpxEncoder`,
`VpxDecoderBase`, `VpxDecoder`, `AudioDecoder`, `FdkAacDecoder`, `OpusDecoder`, `AudioEncoder`,
`FdkAacEncoder`, `OpusEncoder`, `VideoResizer`, `Crop`, `AspectRatioCrop`, `Rotate`, `Puller`,
`JitterBuffer`, `PacketQueue`** — i.e. **essentially every AV graph node.**

**Why `K = 0xd8` is the sweet spot, arithmetically.** With F1's *minimum* geometry (`mb_cols = 1`,
`P = 244`):

```
vtable at object +216  ->  216 < 244   INSIDE the unwritable prefix   => SURVIVES INTACT
field  at object +248  ->  248 >= 244  writable lattice position      => arg1 base  [K+0x20]
field  at object +256  ->  256 >= 244  writable                       => CALL TARGET [K+0x28]
field  at object +272  ->  272 >= 244  writable                       => arg2       [K+0x38]
field  at object +280  ->  280 >= 244  writable                       => arg3       [K+0x40]
```

**Conditions (1) and (3) are satisfied, at the default geometry, by 26 classes that are exactly the
peer-driven AV nodes.** This is the first time link (a) has produced a non-empty candidate set.

> ### ⇒ WHAT IS STILL OPEN, AND IT IS NOW TWO NARROW CHECKS
> **(2) A code pointer at `K+0x28`.** For the `K=0xd8` family that is object offset **`+0x100`**. My
> census of constructor-stored code pointers (every `lea rXX,[rip+f]` into a `.text` function start
> followed by `mov [obj+N], rXX`) found such stores at `+0x10,0x18,0x20,0x28,0x30,0x38,0x40,0x48,
> 0x50,0x58,0x60,0x68,0x70,0x78,0x80,0x88,0x90,0x98,0xa0,0xa8,0x120,0x140,…` — **`+0x100` is not
> among them.** So no *constructor-planted* code pointer sits there. **NOT REFUTED**, because the
> field may be filled at runtime, and because a *heap* pointer there is also usable if it points into
> a region the attacker can spray — which is precisely the **LFH-vs-backend question F1's own
> write-up lists as never tested** ("~20 exclusions assume LFH"). **Read what actually occupies
> `PacketSender+0x28` (object `+0x100`) in a live node.**
> **(4) Size-class match.** The object's size must fall in an F1-producible block-size class
> (`(mb_rows+1)(mb_cols+1)·76 + 23`, rounded to 16-byte NT buckets — ~15 % of sizes). `CryptProxy` is
> `0x248` = 584 B; the nearest F1 blocks at `mb_cols=1` are 479 and 631, at `mb_cols=2` are 479 and
> 707 — **no match for CryptProxy specifically.** This must be solved **per class** across the 26, and
> it is a small closed-form search.

**Neither check is a search any more — both are single lookups. Still not RCE, nothing executed.**

---

# 4. WHAT IS **NOT** ESTABLISHED — read this before quoting §3

1. **Adjacency is not demonstrated.** §3.2 shows the victim *can be steered into the same bucket* as
   the sprayed objects. It does not show that a sprayed object reliably lands immediately after the
   victim. That is ordinary LFH grooming, and on Win11 the Segment Heap may back these sizes instead
   — **not observed on the live target** (the same caveat the ASLR assessment carries).
2. **No demonstration that the corrupted object is virtually dispatched** before something else
   faults. `Format` has slot 0 = deleting dtor, slot 3 = clone, slot 4 = changed-hook, all reached on
   the *next* FORMAT packet — so a dispatch is peer-triggerable on demand, which is the favourable
   case, but it was not shown end to end.
3. **The partial-overwrite target was not chosen** — but the menu is now **enumerated and bounded**,
   see §3.4. What is missing is a *chosen gadget*, not knowledge of what is reachable.
4. **RESOLVED — see §4a legs 5–7.** The small-stride assumption was the weakest link; it now holds.
   `strideU = align4(d_w/2)` is peer-derived, and the live-measured `strideU=320` matches that formula
   for a 640-wide call while libvpx's 352 does not. *Residual: the mode flag `[+0xc1]`'s writers were
   not identified — the mode is established from the measurement, not from the flag's provenance.*
5. Everything here is **static**. Nothing executed, nothing sent.

## 4a. ★ Pricing the geometry — three legs confirmed, one undetermined, and it is decisive

**Leg 1 — the sink imposes nothing.** `0x1406e95d0` (736 B) re-read from an instruction boundary. The
arithmetic is exactly as W3 stated, and there is **no minimum, maximum or sanity check on any stride
or on height anywhere in the function**:

```
0x1406e9784  shr  ebx, 1                 ; ebx = height >> 1
0x1406e978d  imul eax, ecx               ; alloc(U) = (height>>1) * strideU
0x1406e97cd  call 0x14071625c            ; operator new
0x1406e9838  imul ebx, r14d              ; strideU * height
0x1406e983f  shr  r8, 1                  ; copy(U) = (strideU*height) >> 1
0x1406e9849  call 0x140718e5d            ; memcpy  -> overflow = strideU/2 for odd height
```
*(V plane identical at `0x1406e97e0` / `0x1806e9855`. Y does not overflow: alloc and copy are both
`strideY*height`.)*

**Leg 2 — ★ a capacity-reuse branch, and it is a real precondition nobody has recorded.**
`cmp [rsp+0x20], eax / jae 0x1406e97e0` @ `0x1406e9790` **reuses the existing plane buffer whenever it
is already large enough**, allocating only when the requirement *grows*. ⇒ the overflow lands inside
the old, larger buffer — not on a neighbour — unless the attacker forces a fresh allocation. Peer-side
this is easy (the first frame of a stream, or a monotonically increasing geometry sequence), but **an
attack that simply sends the target geometry will silently do nothing on any later frame.** The old
buffer is released with `call 0x14071606c (edx=1)` and the new one taken from `0x14071625c` — WickrPro's
`operator delete`/`operator new`, i.e. the same shared UCRT heap as §3.3.

**Leg 3 — the forwarder validates nothing.** `0x14011b6b0` (296 B) takes the geometry as incoming
stack arguments 5–11 (`[rsp+0xc0]`…`[rsp+0xf0]` after its 3 pushes + `sub rsp,0x80`) and copies them
straight into the sink's outgoing argument slots @ `0x14011b73d`–`0x14011b78c`. No comparison of any
kind. *(Its `[rip]` calls are `QString` copy/dtor and `QReadWriteLock` — resolved from the import
table, not guessed.)* The descriptor itself comes from `NPLAVPacketGetDescriptor` @ `0x14013e4f9`
inside `0x14013e430`.

**Leg 4 — `NPLAVPacketGetDescriptor` (`NPL 0x1803d0e50`, 228 B) is a pure struct copy and validates
nothing.** Two NULL checks (returns 4 / 5), then it zeroes the descriptor and runs a 4-iteration loop.
Resolving its three base registers (`r11 = packet−desc+0x38`, `rbx = packet−desc+0x48`,
`r8 = desc+8+8i`, `rcx = desc+0x28+4i`) gives the source offsets exactly:

| descriptor field | source in the `Packet` | what it is |
|---|---|---|
| `desc+0x08 + 8i` | **`Packet+0x40 + 8i`** (4 qwords) | the plane pointers |
| `desc+0x28 + 4i` | **`Packet+0x60 + 4i`** (4 int32) | one of the two geometry blocks |
| `desc+0x38 + 4i` | **`Packet+0x70 + 4i`** (4 int32) | the other |

then `desc[0] = [packet+0x18]` and six more scalars from `packet+0x80..0xa0`. **It returns 0
unconditionally.** *(Correction to ASLR-ASSESSMENT §3 Route A, which described this export as copying
"wire-controlled geometry with a truncating 32-bit `imul`": **there is no `imul` in this function at
all** — it is a straight field copy. Whatever truncation exists is upstream of it.)*
*(Also corrected: an earlier draft of this file said the strides live at `Packet+0x38..0x44`. They do
not — `0x38`/`0x48` are the loop's base *displacements*, not member offsets. **Which of the two
int32 blocks at `+0x60` / `+0x70` is the stride block is decided by `0x14013e430`'s mapping of
descriptor fields onto the sink's stack arguments 5–11, and that mapping was not read.**)*

> ### ⇒ ★★★ THE DECIDING QUESTION IS ANSWERED, AND IT IS THE FAVOURABLE ANSWER
> **`strideU` is derived from the peer's frame width, not from libvpx's padded stride.**

**Leg 5 — the writer, found.** `Packet+0x60..0x6c` is written by the `Packet` constructor
`0x180135a40` (403 B), which copies a caller-supplied stride array verbatim and clamps nothing:

```
0x180135ada  mov rdx,[rdi]      / mov [r15+0x40],rdx   ; planes[0]
0x180135ae1  mov r8d,[rsi]      / mov [r15+0x60],r8d   ; strides[0]  -> strideY
0x180135af7  mov eax,[rsi+4]    / mov [r15+0x64],eax   ; strides[1]  -> strideU   <== THE ONE
0x180135b0e  mov eax,[rsi+8]    / mov [r15+0x68],eax   ; strides[2]  -> strideV
0x180135ae8  mov r9d,[r14]      / mov [r15+0x70],r9d   ; heights[0]  -> HEIGHT
```
(`rdi`=planes, `rsi`=strides, `r14`=heights; the `Packet` vtable is installed at `0x180135a7a`.)

**Leg 6 — where the array comes from: `VpxDecoder::process 0x180144520`, and it computes the stride
itself.** `r12` is the `vpx_image_t` (`d_w`@0x18, `d_h`@0x1c, `planes`@0x30–0x48, `stride`@0x50–0x5c —
the layout matches exactly). The function fills local `planes`/`strides`/`heights` arrays and picks
between **two modes** on a byte flag `[r15+0xc1]`:

```
0x1801450e0  movzx edx, byte [r15+0xc1]      ; the mode flag
   ; --- Y plane ---
0x1801450f4  test dl,dl / je 0x180145114
0x1801450f8  mov eax,[r12+0x18]              ; img->d_w         <== THE PEER'S FRAME WIDTH
0x1801450fd  add eax,3 / and eax,0xfffffffc  ; align4(d_w)
0x180145103  mov [rbp+0x150],eax             ; strides[0]
0x180145109  cmp eax,[r12+0x50] / setne r8b  ; != libvpx's stride -> "repack" flag
0x180145114  mov eax,[r12+0x50]              ; (else) libvpx's own stride
   ; --- U plane, identical shape ---
0x180145143  mov eax,[r12+0x18] / shr eax,1  ; d_w / 2
0x18014514a  add eax,3 / and eax,0xfffffffc  ; align4(d_w/2)
0x180145150  mov [rbp+0x154],eax             ; strides[1] = strideU
0x180145162  mov eax,[r12+0x54]              ; (else) img->stride[1]
```

⇒ in the tight-pack mode **`strideY = align4(d_w)`, `strideU = strideV = align4(d_w/2)`**, and `r8b`
(set when the tight stride differs from libvpx's, which it essentially always does) selects the
**repack** factory `0x180136120` @ `0x1801452a2` over the wrap-in-place one `0x180136080` @
`0x180145269`.

**Leg 7 — ★ the live measurement proves the tight-pack mode is the one that runs.** W1 was
demonstrated live at **`strideU = 320`**. For a 640-wide call:

| | value |
|---|---|
| tight-pack `align4(640/2)` | **320 ✓ — exactly the measured value** |
| libvpx `uv_stride` = `((align16(640)+2·32)+31 & ~31)/2` | 352 ✗ |

**The two hypotheses give different numbers and the measured one matches the peer-derived formula.**
*(Qualifier: `[+0xc1]`'s writers were not identified — the only two byte-stores to `+0xc1` in NPL are
`Muter` slots 1/2 at this-off 112, on a sub-object I did not prove is the same field. The mode is
established from the measurement, not from the flag's provenance.)*

> ## ⇒ CONFIRMED — §3.2's geometry is reachable, and the route stays leak-free
> `strideU` is `align4(d_w/2)` where `d_w` is the peer's VP8 frame width (a 14-bit keyframe field), so
> the peer sets it directly and it is **not** bounded below by libvpx's border/alignment:
>
> | `d_w` | `d_h` | `strideU` | `alloc = (h>>1)·strideU` | `copy` | **overflow** |
> |---|---|---|---|---|---|
> | **8** | **129** | **4** | **256** — the `AudioFormat` 0x100 bucket | 258 | **2 bytes — the partial overwrite** |
> | 32 | 33 | 16 | 256 — same bucket | 264 | 8 bytes — a full pointer |
> | 8 | 33 | 4 | 64 | 66 | 2 bytes |
>
> **The pessimistic branch of §4a is refuted. The info-leak requirement does not come back.**

---

# 5. NEGATIVES CLOSED THIS WAVE (each with the instruction that closes it)

The wave began as a peer-reachable information-leak sweep — "does an **uninitialized** byte reach the
peer?", which is a different question from W14's "does a **received** byte reach an output?". It is
recorded here because these are real closes, and because they are what made §2 the right target.

| candidate | verdict | the instruction that closes it |
|---|---|---|
| **`CryptProxy` / the `cryptoPadding` reservation** (`0x18011b3b0`, 1508 B) — the node that calls the host's `encrypt`/`decrypt` callback, sized `payload ± cryptoPadding` | **NEGATIVE** | encode allocates `insize+padding` then **`memset(new,0,padding)` @ `0x18011b61f`** before `memcpy(new+padding,in,insize)` @ `0x18011b637` — the reserved region is zeroed, never shipped raw. The decode shrink is bounds-checked: `cmp eax,edx / jae → "Padding/packet size mismatch"` @ `0x18011b6a3` |
| **The feedback packet's Frame slack** — W14 closed its *content*; its *slack* was never asked, and it is the one packet type measured live going to the peer (×9) | **NEGATIVE** | `0x18011fc76` passes `metaSize = [rsi+0x98]`, which **is** the `std::string`'s own size field (member at `rsi+0x88`, MSVC layout: data 0x88, size 0x98, capacity 0xa0 — confirmed by the SSO test `cmp qword [r15+0x18],0xf` @ `0x18011fc34` reading capacity). Exact, no slack |
| **`XorFecEncoder`'s protection packet** (`0x1800e26b0` → `0x1800e2e30`) — the classic XOR-FEC padding leak | **NEGATIVE** | the buffer is sized `sum(chain sizes) + [pkt0+0xd8] − elem0.len − 1` @ `0x18013…0x1800e2fa4`, and the bytes written are the identical expression — recomputed term by term, no slack. *(Residual, worth its own look: the XOR length for packets **i>0** @ `0x18011…0x1800e30fd` is computed from **packet i's own** fields against a buffer sized from **packet 0's** — a length mismatch there would overflow. Not peer-controlled: these are the victim's own outgoing packets.)* |
| **`PacketPacer::SendPacket`'s SOCKS header insert** (`0x1800b2160`) | **NEGATIVE** | `cmp eax, 0x800 / ja → "Not enough space to insert UDP SOCKS header"` @ `0x1800b2530`, then `memmove`+`memcpy`, then `add [rdi+0x800], ebx`. Correctly bounded |
| **`AssociatedConnection::CreatePacerInternalInteractionPacket`** — the one *constant* wire length in NPL (`mov dword [rdi+0x800], 0x175` @ `0x1800c740e`) | **NEGATIVE** | the 0x175 bytes are `0xa0` plus a full 0x174-byte copy from `[rbx+0xad0]`; length equals fill. It is also a pacer-internal packet |

**Two more closed after §3.6 was refuted — the send-path codecs, which are the highest-risk shape**
(a fixed-size Frame from the non-zeroing allocator, filled by a codec that writes fewer bytes):

| site | allocation | verdict | the instruction that closes it |
|---|---|---|---|
| **`OpusEncoder`** slot 1 `0x18014b9a0`, alloc @ `0x18014baf1` | `mov edx, 0x420` (1056 B), **no fill** | **NEGATIVE** | after `opus_encode 0x1802c8a20` returns the real length in `eax`→`ebx`, `mov [rsi+0x18], ebx` @ `0x18014bbd3` (and `[rsi+0x60]`) sets the Frame size to it. A zero return is caught by `"opus_encode returned empty buffer"` and the Frame released |
| **`FdkAacEncoder`** slot 1 `0x18014a7e0`, allocs @ `0x18014a91d` / `0x18014ab4f` | `mov edx,ebx` / `imul edx,[r12+0x18],0x420`, **no fill** | **NEGATIVE** | identical fixup at **all four** exits: `mov [rsi+0x18], eax` @ `0x18014ab6d` and `0x18014abd5`, `mov [r14+0x18], eax` @ `0x18014a946` and `0x18014a9d1`, each guarded by `test eax,eax / jle` |

*(The other fixed-size sites in this range — `0x180147c30` `mov edx,0x2000` and `0x180148dd0`
`mov edx,0x5a00` — are the **AAC and Opus decoders** (`aacDecoder_DecodeFrame` literals), i.e. the
receive path. Their output never reaches the peer, so slack there is not a peer-reachable leak.)*

**★★ AND THE CENSUS IS ANSWERED FOR THE SUBSET THAT MATTERS — NEGATIVE.** A Frame's slack can only
become a *peer-reachable* leak if that Frame reaches the wire, and the egress is
`Serializer` → `PacketPacer::SendPacket 0x1800b2160`. Every send-path allocation is now hand-read,
and **all six take the payload size from the same object that supplies the payload pointer**:

| send-path site | what it emits | the instruction that closes it |
|---|---|---|
| `0x18011cfe0` `Serializer` PacketSender slot 3, alloc @ `0x18011d05b` | incoming-feedback reply | `rdx=[rbp+0x10]`, `r8d=[rbp+0x18]` — one object |
| `0x18011dc20` **"Sending FORMAT packet"**, alloc @ `0x18011ddb4` | the FORMAT packet | `rbp` is resolved from the *payload string* (`mov rbp,r15` / SSO `mov rbp,[r15]` @ `0x18011dd71`), and `r8d=[r15+0x10]` is **that same string's size**; metaSize `[rsp+0x20]=[rsi+0x178]` is the header string's own size |
| `0x18011de20` **"Sending EVENT packet"**, alloc @ `0x18011e11e` | the EVENT packet | `mov rsi,[r15+0x10]` / `mov eax,[r15+0x18]` @ `0x18011e0df` — pointer and size from one Frame; metaSize `=[r14+0x178]` |
| `0x18011f970` `Parser` feedback, alloc @ `0x18011fc76` | the feedback packet | `metaSize=[rsi+0x98]` **is** the header string's size field |
| `0x18014b9a0` `OpusEncoder`, alloc @ `0x18014baf1` | encoded audio | `mov [rsi+0x18], ebx` @ `0x18014bbd3` — `opus_encode`'s real return |
| `0x18014a7e0` `FdkAacEncoder`, allocs @ `0x18014a91d`/`0x18014ab4f` | encoded audio | `mov [rsi+0x18], eax` @ four exits, each behind `test eax,eax / jle` |
| `0x180140f90` `VpxEncoder`, alloc @ `0x18014177c` | encoded video | `rdx=[rbx+8]`, `r8d=[rbx+0x10]` = `vpx_codec_cx_pkt_t.data.frame.{buf,sz}` — the exact bitstream |

> ### ⇒ NEGATIVE, AND IT CLOSES THE LAST IDENTIFIED CANDIDATE
> **No send-path Frame carries slack. The Frame-slack census cannot supply the missing address
> disclosure.** The remaining unexamined sites are receive-path (`Parser` `0x18011ef70` — a
> peer-declared length bound onto a different buffer, F2's family, but its over-read lands in a
> *decoded* frame) or internal helpers, and W14 established that **no receive-scene Frame can reach a
> `Serializer`** across the 7 observed scene graphs. So slack there is not peer-reachable.
>
> **Qualifier, inherited from W14 and still live:** that disjointness is *measured* over two-party
> audio+video only. Group calls, screen share, `Splitter`, `Puller`, `JitterBuffer`, `PacketQueue` and
> `NetworkSink` were never exercised, and `NetworkSink::ChannelListener 0x180133a20` is the one
> payload-bearing bus originator. **If a group-call scene puts `NetworkSink` in the graph, this
> negative must be re-run.**

**Running total: 11 of 32 sites hand-read. All negative. The 21 unread are all off the send path.**

**One enabling fact came out of it and should be kept:** the `Packet`/Frame allocator
**`0x180135ea0` does not zero the inline payload region.** With `src == NULL` (the `0x180135e80`
entry) it only computes `payload = (base+0xdf) & ~0xf` and stores the pointer; the only memsets are
of header fields. ⇒ **any caller that allocates N and fills fewer than N bytes before the Frame
reaches the wire ships heap memory to the peer.** The full census is **32 call sites**
(12 on `0x180135e80`, 20 on `0x180135ea0`, enumerated in `scratch/w15/`); this wave hand-checked the
four peer-facing ones above. **The remaining 28 are unexamined and this is the honest gap in §5.**

---

# 6. F6 IS NOT PEER-DRIVABLE — asked and answered, in the unfavourable direction

W14's F6 (one crafted frame → `rip`, executed in a harness) is the engagement's only assembled
exploit, so the first question this wave asked was whether a *peer* can drive it. It cannot, and the
reason is worth recording so nobody re-opens it:

The tunnel framing is `[u16 length][payload]` and the **outbound** arm of the same relay is correctly
bounded — `0x18009def0` does

```
0x18009e334  mov  r8d, 0x800
0x18009e33a  sub  r8d, r14d              ; want = 0x800 - accumulated
0x18009e340  add  rdx, 0x2f4             ; into the 0x800-byte staging buffer at obj+0x2f4
0x18009e363  call [recvfrom]
0x18009e71d  mov  word [rsi+0xaf4], ax   ; total
0x18009e73d  mov  word [rsi+0x2f4], ax   ; the u16 LENGTH PREFIX, written by the client
```

⇒ **the client itself can never emit a frame longer than 0x7fe.** The protocol's own implementation
treats 2048 as the frame ceiling on both sides; only the inbound arm forgot to check it. A conforming
hub emits the same ceiling, so a peer's oversized datagram does not become an oversized `FullDataSize`
unless the hub itself is the attacker. **F6's attacker position stays "whoever terminates the TLS side
of the TLS-UDP proxy" — the hub, or a TLS MITM. Not the call peer.** *(Qualifier: this is an inference
about the far end from the near end's code. It is evidence, not proof, about a server nobody has
inspected — and per §0 rule 5 the correct bound already existing in the sibling path is exactly why
the inbound miss is a defect either way.)*

---

# 7. WHAT A NEXT SESSION SHOULD PICK UP, IN ORDER

1. **★ Resolve who writes `Packet+0x38..0x44` (§4a).** One function. It decides whether this whole
   route is leak-free (wire-declared strides) or falls back to needing an address (libvpx strides).
   **Everything else below is worth less than this.**
2. **DONE, and it defines the boundary — §3.5.** 3 of 499 reach a file import (none reach
   `LoadLibrary`/`GetProcAddress`/`VirtualProtect` at depth ≤ 5); 0 `call [rcx+X]` gadgets, 35
   load-then-`call [reg+Y]`. A second stage does not help by itself — a *useful* value needs an
   address. **§3.6's send-path idea was tested and REFUTED: 0 of 499 callees reach
   `sendto`/`send`/`SSL_write`/`BIO_write` at depth ≤ 7.**
3. **DONE for the subset that matters — §5 is NEGATIVE.** All seven send-path Frame allocations take
   the size from the object that supplies the pointer. **The missing address disclosure is not here.**
   The two places it could still be: **(a)** a group-call / screen-share scene that puts `NetworkSink`
   in the graph and re-opens W14's receive→send disjointness negative — needs a third account or the
   scene-graph builder; **(b)** the **messaging** surface (`WickrPro.exe`, `WickrMlsSdkCpp.dll`),
   which has never had a leak sweep of any kind and is the other half of the stated goal
   (メッセージ相手起点).
4. **E4 now has a home.** `Proto::VideoFormat`'s never-swept 4-int crop rect is parsed by
   `0x18013da20` — the exact function this wave read for its allocation sizes. Sweeping it is cheap
   now.
5. Only then: grooming reliability (LFH vs Segment Heap) on a live host, which needs the operator.

---

# 8. COVERAGE AND BLIND SPOTS

* **`fn.py`'s chained-`.pdata` defect (W14) was avoided** — every extent here came from
  `scratch/w15/`'s own `.pdata` lookup or `scratch/w14/lin.py`.
* **A new tooling defect, found and fixed this wave, that would have produced false negatives:** a
  linear disassembly sweep of `.text` **desyncs on data-in-code and silently loses call sites**. My
  first `xref` pass reported **zero** references to `"VideoHub(dec)"` when one exists at
  `0x1800f03de`. `scratch/w15/xref.py` and `callers.py` now disassemble **per `.pdata` record**.
  Any earlier wave that used a linear `.text` sweep for an xref census should be re-run.
* `scratch/w15/refres.py` resolves rip-relative operands to strings / RTTI-named vtables; the vtable
  map is built by walking `.rdata`/`.data` for COL pointers, so a vtable whose COL is not
  8-aligned-adjacent would be missed.
* **Message-peer surfaces remain entirely unentered** (W13 §3.6). Everything above is the *call* peer.
  The messaging path (`WickrPro.exe`, `WickrMlsSdkCpp.dll`) has never had a leak or placement sweep.
* Nothing executed; no client contacted; no Wickr infrastructure touched.


---

# 10. ★★★ A1 — F1's GATE, PRICED AT LAST. THE ANSWER IS UNFAVOURABLE FOR THE TWO-PARTY CASE.

The foundation question, flagged all wave as the thing that voids everything above if it fails, and
never asked in four waves: **can F1's allocation-failure gate open on an ordinary host?**

**The allocator has no internal cap and no integer-overflow gate.** `vp8_alloc_frame_buffers`
(`0x180186080`) calls `vp8_de_alloc_frame_buffers` first (`0x1801860a4`), then four
`vp8_yv12_alloc_frame_buffer` (`0x18019bf90` → realloc `0x18019c050`), branching to the failure path
on `js`. The size math in `0x18019c050` is entirely 32-bit —
`lea eax,[r9+r10*2]` then `movsxd rbp,eax` — so a wrapped negative would become a huge `size_t` and
fail the allocation for free. **It does not wrap:** VP8 dimensions are 14-bit (max 16383), and with
`border = 32` (passed as `r9d = 0x20`):

| geometry | frame_size | int32 overflow |
|---|---|---|
| 640×480 | 0.5 MiB | no |
| 1920×1080 | 3.3 MiB | no |
| 4096×4096 | 24.8 MiB | no |
| **16383×16383 (max legal)** | **387.0 MiB** | **no** (2^31 is 2048 MiB) |

⇒ **the gate only opens on a genuine `vpx_memalign` failure.** There is no geometry that forces it.

**How much commit can one peer force?** 4 yv12 buffers × 387 MiB = **1548 MiB** — which reproduces
F3's measured **"+2017.0 MiB from a 34-byte frame"** — and at two contexts per publisher,
**~3.0 GiB from one peer.**

**Measured on the operator's host:** 24.3 GiB RAM, commit limit 27.9 GiB, **13.4 GiB available**, and
**`AutomaticManagedPagefile = True`** — so the commit limit *grows* under pressure (auto-managed
ceiling is typically ~3× RAM, i.e. tens of GiB more, bounded by free disk).

> ## ⇒ A1 IS ANSWERED: A SINGLE CALL PEER CANNOT OPEN F1's GATE ON A NORMALLY-CONFIGURED HOST
> ~3.0 GiB against 13.4 GiB *and rising* is not close. It needs **≈4.4 concurrent malicious
> publishers just to reach the current limit**, and more once the pagefile grows.
>
> **Consequence for this wave's chain: the entire §3.9–§3.15 construction is void for the two-party
> call — the "malicious contact" scenario the goal names.** It survives only under a narrower threat
> model: **a group call with several colluding publishers**, a constrained host (small RAM / fixed
> small pagefile — which is how the live F1 demo was staged, with a Job Object cap), or E6's
> 1.07 GiB-per-frame BGR32 conversion stacking on top (still unmeasured).
>
> **This is the result that should have been obtained before any of §3.7–§3.15.** The design work is
> not wasted — it is correct and reusable — but it was built on an unpriced foundation, and the
> foundation does not hold for the stated scenario.

*(F3's memory-exhaustion DoS is unaffected and remains a valid finding in its own right.)*


## 10a. E6 — partially priced, and it does not rescue the two-party case

E6 was the only remaining way to open F1's gate from a *single* peer: the claim that after a
successful large decode the receiver converts to BGR32 at ~1.07 GiB per frame, **on top of** the
buffer arena. Two facts found while tracing it both point the wrong way for the attacker:

* **The I420 plane buffers are RECYCLED, not accumulated.** The sink `0x1406e95d0` reuses an existing
  plane buffer whenever it is already large enough — `cmp [rsp+0x20], eax / jae 0x1406e97e0` @
  `0x1406e9790` — allocating only when the requirement *grows*. So per-stream the planes converge to
  the high-water mark; they do not stack per frame. *(This is the same branch recorded in §4a leg 2 as
  an attack precondition; here it also caps the memory-pressure ceiling.)*
* **The frame objects are refcounted and freed.** The reconstructed-frame consumer `0x1406e8e10`
  performs a `shared_ptr`-style release (`lock xadd [rbx]` / `cmp eax,1` @ `0x1406e8e99`, then
  `operator delete` of a 0x78- and a 0x18-byte object @ `0x1406e8ec0`/`0x1406e8ecd`). Frames are
  released as they are consumed, not retained.

**Arithmetic, granting E6 its full claim as a one-shot high-water allocation:**
`3.0 GiB (4 buffers × 387 MiB × 2 contexts) + ~1.07 GiB (BGR32) ≈ 4.1 GiB from one peer`, against a
measured **13.4 GiB free and an auto-growing commit limit**. **Still not close.**

> **⇒ E6 does not rescue the two-party case.** For a single peer to open the gate, the BGR32
> allocation would have to be genuinely per-frame *and* accumulate — and the refcounted release above
> is direct evidence against that.
>
> **RESIDUAL, stated honestly: I did not locate the BGR32 conversion itself.** The two facts above are
> about the I420 planes and the frame objects, not about the conversion E6 names. The conversion may
> live in `Qt6Gui.dll`/`Qt6Quick.dll` (now available — 287 binaries are installed). So this is
> "E6 is very unlikely to rescue it, on two pieces of contrary evidence", **not** "E6 is refuted".

# 11. WHERE THIS LINE ENDS

**F1-based peer-originated RCE is not available against a two-party call on a normally-configured
host.** The gate needs an allocation failure; one peer can force ~3–4 GiB; the host has 13.4 GiB free
and a growing limit. The §3.9–§3.15 chain — placement primitive, peer-derived geometry, shared heap,
42 candidate classes, measured partial overwrite — is **correct and reusable, and conditional on a
threat model the goal does not name**: a group call with several colluding publishers, or a
constrained host (which is how the live F1 demo was staged).

**What remains genuinely open on this theme, in order:** (i) the group-call scene graph — one log
answers whether `NetworkSink` appears, which also decides W14's receive→send negative; (ii) the
`Qt6Gui.dll` image codecs (`qtiff`/`qgif`/`qico`/`qtga`/`qwbmp`/libpng/libwebp), which W16 notes are
on the ordinary CRT heap at the **message-peer** position — a surface that does not need F1's gate at
all; (iii) `Qt6Network.dll` egress for the leak question.


---

# 12. THE MESSAGE-PEER IMAGE SURFACE — inventoried, and the largest codec is clean

The one line that survives §10 (it needs no allocation-failure gate). Reachability was already
established by F4c: remote content is decoded with `format = NULL` (sniffed) across 18 `QImage` sites
in the unsandboxed main process, and the MIME allowlist at `0x140045870` protects nothing.

**Shipped plugins** (`…\AWS Wickr\imageformats\`, all present on the machine):

| plugin | size | library |
|---|---|---|
| `qjpeg.dll` | 578,984 | **libjpeg-turbo 3.0.3** (version string, exact) |
| `qwebp.dll` | 564,136 | libwebp — version not recoverable from strings |
| `qtiff.dll` | 437,672 | libtiff **≥ 4.5.1** (source-derived string "Since libtiff 4.5.1, it is an alias of 'B'") |
| `qgif` / `qico` / `qtga` / `qwbmp` / `qicns` / `qsvg` | 35–55 KB | Qt's own parsers |
| `qpdf.dll` | 40,360 | thin shim onto `Qt6Pdf.dll` — **PartitionAlloc, see W16** |

**libjpeg-turbo 3.0.3 — NEGATIVE against known CVEs.** Every security-relevant entry in the upstream
ChangeLog after 3.0.3 is outside the untrusted-decode path:

* 3.2.1 — integer overflow in `tj3LoadImage12()`/`tj3LoadImage16()`: the TurboJPEG **file-loading**
  helper, not the decompressor Qt drives.
* 3.2.0 — PNG **writer** rescale-array overrun; `jpeg_crop_scanline()` use-after-free guarded as
  "hypothetical applications that may erroneously call" it (API misuse, not attacker-reachable);
  `jpegtran -crop/-trim` overrun — the **command-line tool**, not the library decode path.
* 3.1.0–3.1.4, 3.1.90 — nothing security-relevant.

⇒ **the largest codec on this surface has no known remotely-triggerable decoder bug.**

**Open:** libtiff's exact version (only bounded ≥ 4.5.1) and libwebp's, plus the six small Qt-native
parsers, which are the more interesting target precisely because they are Qt's own code rather than
a hardened upstream library. **Not assessed.**


## 12a. Qt version pinned, and the two CVE leads both fail on verification

**Qt 6.9.2.0** — from the file-version resource of `Qt6Core.dll`, `Qt6Gui.dll` and every image plugin
(`qgif`/`qtga`/`qico`/`qwbmp`/`qicns`), so the whole Qt stack is one build.

Two leads were chased and **both died on verification. Recording them so nobody re-chases:**

* **`QBmpHandler` buffer overflow via BMP data.** A search summary attributed this to a 2026 CVE. It is
  **CVE-2018-19873, fixed in Qt 5.11.3** — seven minor versions before the shipped build. BMP is
  built into `Qt6Gui.dll` (not a plugin) and *is* reachable via F4c's `format = NULL` sniffing, so it
  would have been well-placed; it simply is not present in 6.9.2. **NEGATIVE.**
* **CVE-2025-14576** — *"Insufficient validation of node IDs in Qt SVG module allows arbitrary
  QML/JavaScript code injection when loading malicious SVG files through the VectorImage component in
  Qt Quick."* This would have been ideal: **code injection rather than memory corruption**, so it
  sidesteps ASLR, the heap and F1's gate entirely, at the message-peer position, and `qsvg.dll` +
  `Qt6Quick.dll` + `Qt6Qml.dll` are all shipped. **But NVD lists the affected ranges as Qt 6.8.0–6.8.6
  and 6.10.0–6.10.1 — the 6.9.x branch is not listed** — and the vector is `AV:L / UI:R`, not
  remote-without-interaction. **NEGATIVE for this build.**
  *Residual worth one check by someone: an affected range that spans 6.8 and 6.10 while skipping 6.9
  is unusual. Confirm against Qt's own advisory rather than NVD before treating 6.9.2 as safe.*

> **Method note, stated because it bit twice in one exchange:** matching a shipped version against CVE
> databases is a weak instrument — the summaries conflated two unrelated entries once, and mis-attributed
> a 2018 bug to 2026. **The real work on this surface is diffing the shipped plugin code against
> upstream**, which is now possible (287 binaries on disk) and has not been done.


## 12b. libtiff / libwebp versions — NOT pinned. Method failure, recorded as such.

* **libwebp:** hunted the `WebPGetDecoderVersion`/`WebPGetEncoderVersion` return constant
  (`(MAJ<<16)|(MIN<<8)|REV`) across every `.pdata` function under 40 bytes in `qwebp.dll`. **No
  candidate.** The getter is presumably inlined or folded. **Version unknown.**
* **libtiff:** `qtiff.dll` yields only `4.5.1` — which is the doc string `"Since libtiff 4.5.1, it is
  an alias of 'B'"` already noted, i.e. a lower bound, not the version — and the integer
  **`20260713`**. libtiff's `TIFFLIB_VERSION` *is* a date integer, so this may be a 2026-07-13
  release; **but the shipped binaries are themselves dated 2026-07-13**, so it is equally likely to be
  a build timestamp. **Cannot separate the two. Version unknown.**

> **Both are unresolved, and the honest reading is that string/constant archaeology has run out on this
> surface.** Pinning these needs either the vendor's SBOM or a structural diff of the shipped code
> against candidate upstream builds. **The latter is the real work on this whole surface and it has
> not been started.**

---

# 13. CLOSING STATE OF THIS WAVE

**Goal — RCE originating from a call peer or message peer — NOT ACHIEVED.** Nothing was executed
against a target; every result here is static analysis of shipped binaries.

**What this wave actually settled:**
1. **F6 is hub/MITM-only** — the engagement's one assembled chain does not serve this goal.
2. **E3 is positive** — a call peer has an unbounded, on-demand placement primitive for polymorphic
   objects. New capability.
3. **`strideU` is peer-derived** (`align4(d_w/2)`), corroborated by the engagement's own live 320.
4. **NPL and WickrPro share one heap**; **no non-ASLR module exists** (0 of 287); CFG inert (276/287).
5. **link (a) re-specified → 42 candidate classes**, 26 at `PacketSender` K=0xd8, where three waves had
   38/38 dead.
6. **A1: F1's gate does not open for a single call peer** on a normal host (~3–4 GiB forced vs 13.4 GiB
   free and rising) — **which makes 2, 3, 5 conditional on a group call or a constrained host, i.e.
   not the scenario the goal names.**
7. **The binaries were never deleted** — 287 are installed. Every negative reasoned from "the DLLs are
   gone" needs re-opening.
8. **The message-peer image surface** needs no F1 gate; libjpeg-turbo 3.0.3 is clean against known
   CVEs; two Qt CVE leads failed verification; libtiff/libwebp unpinned.

**What would actually move it, in order:** (i) one group-call log — decides `NetworkSink`, hence W14's
receive→send negative, hence the leak question; (ii) a structural diff of the shipped image plugins
against upstream; (iii) operator approval for live delivery, without which "RCE" cannot be claimed
regardless of how the analysis lands.
