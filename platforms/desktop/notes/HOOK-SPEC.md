# HOOK-SPEC — plaintext-protobuf substitution hook (sender media encrypt path)

Binary: `NPL.dll`  ImageBase `0x180000000`. All disasm below re-verified with
pefile+capstone (`scratchpad/disasm_tool.py`). Labels: **CONFIRMED** = quoted disasm here;
**INFERRED** = reasoned from CONFIRMED facts.

The callback invocation **was pinned.** The primary hook is the per-packet `encryptCallback`
invoke, not the serialize site — but the serialize site remains a valid fallback (§6).

---

## 1. Hook site (module + RVA) — on plaintext protobuf, immediately before encryption

Per-packet encrypt is a raw C `fn(void* descriptor)` invoked **inline** (no queue, no thread
handoff) from a generic "callback media-sink" node (class size `0x1a8`, secondary/media-sink
vtable `NPL+0x4cdc90`, primary vtable `NPL+0x4cdc38`). Three invoke sites, all `call rax` with
`rax = [sinkobj+0xd8]` (the stored callback) and `rcx = &descriptor`:

| Invoke site VA | RVA | Emitting method | Tag @desc+0x08 | Role |
|---|---|---|---|---|
| **`0x1803d134b`** | **`0x3d134b`** | slot1 `0x1803d12b0` | 0 | **main VIDEO data packet** (PRIMARY HOOK) |
| **`0x1803d130f`** | **`0x3d130f`** | slot1 `0x1803d12b0` | 1 | **Format/announce** emit (flag-gated) |
| `0x1803d129a` | `0x3d129a` | slot3 `0x1803d1250` | 2 | alternate packet path |

**Primary hook = `NPL.dll + 0x3d134b`** (the tag=0 data-packet `call rax`). It runs on the
freshly serialized outgoing protobuf, one instruction before the real `encryptCallback` consumes
it. Substituted bytes here are what the live session keys encrypt.

CONFIRMED — slot1 emit method `0x1803d12b0`, both descriptors + both invokes:
```
0x1803d12cf: cmp  byte [rcx+0x78], bpl        ; rcx=iface(sinkobj+0x70); +0x78 => sinkobj+0xe8 announce flag
0x1803d12d3: je   0x1803d1311                 ; flag clear -> skip announce
0x1803d12d5: test byte [r8+0x90], 0x48        ; frame-type gate (video/format-eligible)
0x1803d12dd: je   0x1803d1311
;--- tag=1 ANNOUNCE descriptor (built at r11-0x30 == rsp+0x48..) ---
0x1803d12df: lea  rax,[rcx-0x70]              ; desc+0x00 = context (sinkobj base)
0x1803d12e3: mov  byte [rcx+0x78], bpl        ; CLEARS announce flag (one-shot per arm)
0x1803d12eb: mov  rax,[rdx+0x48]              ; PLAINTEXT <- frame+0x48
0x1803d12ef: mov  [r11-0x18], rax             ; desc+0x18 = plaintext ptr
0x1803d12f3: mov  rax,[rcx+0x70]              ; sinkobj+0xe0 = userData
0x1803d12f7: mov  [r11-0x10], rax             ; desc+0x20 = userData
0x1803d12fb: mov  rax,[rcx+0x68]              ; sinkobj+0xd8 = encryptCallback
0x1803d12ff: lea  rcx,[r11-0x30]              ; rcx = &descriptor
0x1803d1303: mov  qword [r11-0x28], 1         ; desc+0x08 = tag = 1
0x1803d130b: mov  [r11-0x20], r8              ; desc+0x10 = frame-info ptr
0x1803d130f: call rax                         ; <== INVOKE (announce)
;--- tag=0 DATA descriptor (built at rsp+0x20..0x40) ---
0x1803d1311: mov  [rsp+0x28], rbp             ; desc+0x08 = tag = 0
0x1803d1316: lea  rax,[rbx-0x70]              ; desc+0x00 = context (sinkobj base)
0x1803d131a: mov  [rsp+0x20], rax
0x1803d131f: mov  [rsp+0x30], rsi             ; desc+0x10 = frame-info ptr (rsi=r8)
0x1803d1324: test rdi, rdi                    ; rdi=rdx=frame
0x1803d1327: je   0x1803d1334
0x1803d1329: mov  rax,[rdi+0x48]              ; PLAINTEXT <- frame+0x48
0x1803d132d: mov  [rsp+0x38], rax             ; desc+0x18 = plaintext ptr
0x1803d1332: jmp  0x1803d1339
0x1803d1334: mov  [rsp+0x38], rbp             ; (null plaintext)
0x1803d1339: mov  rax,[rbx+0x70]              ; sinkobj+0xe0 = userData
0x1803d133d: lea  rcx,[rsp+0x20]              ; rcx = &descriptor
0x1803d1342: mov  [rsp+0x40], rax             ; desc+0x20 = userData
0x1803d1347: mov  rax,[rbx+0x68]              ; sinkobj+0xd8 = encryptCallback
0x1803d134b: call rax                         ; <== INVOKE (data)  == PRIMARY HOOK
```

CONFIRMED — storage of callback/userData/flag (ctor `0x1803d1370`, allocates `0x1a8`):
```
0x1803d142c: mov  [rdi+0xd8], rsi   ; +0xd8 = encryptCallback (ctor arg rcx)
0x1803d1433: mov  [rdi+0xe0], rbp   ; +0xe0 = encryptUserData (ctor arg rdx)
0x1803d143a: mov  byte [rdi+0xe8],0 ; +0xe8 = announce-pending flag
```
(Only writes to +0xd8/+0xe0 in the whole 0x3d1xxx region → pair set once at construction.)

---

## 2. Register / stack location of the plaintext pointer and its length at the hook

At **`0x1803d134b`** (primary), the descriptor is fully built and `rcx = &descriptor` (= `rsp+0x20`).
Descriptor layout (single arg; the ONLY thing the callback receives):

| Descriptor field | Source | Meaning |
|---|---|---|
| `desc+0x00` | `rbx-0x70` | context = sink object base |
| `desc+0x08` | imm | tag (0 data / 1 announce / 2 alt) |
| `desc+0x0c` | `r8d` (slot3 only) | int frame flags/len |
| `desc+0x10` | `rsi`/`r8` | frame-info ptr |
| **`desc+0x18`** | **`[frame+0x48]`** | **PLAINTEXT serialized-protobuf pointer** |
| `desc+0x20` | `[sinkobj+0xe0]` | userData |

So at the hook:
- **Plaintext pointer** lives at stack slot **`[rsp+0x38]` == `[rcx+0x18]`** (rcx=&desc). It was
  loaded from **`frame+0x48`** — the exact field the send node `0x180107870` fills after the
  NetSink serialize dispatcher `0x180133990` (`[rbx+0x48]`, see §6). `rbx` at the hook = the sink
  object; `rdi`/`rdx` = the frame whose +0x48 held the pointer.
- **Length: there is NO separate scalar length passed at this site.** Only the qword pointer at
  `desc+0x18` crosses to the callback. The serialized-buffer object referenced by that pointer
  **carries its own size internally.** (`desc+0x0c` carries an int only on the slot3 path, not on
  the primary data path.) → changing payload length requires editing the buffer object's internal
  size field, whose offset is a residual unknown (§7).

---

## 3. How to substitute + inject the Format(I420) announce

### 3a. Substitute the video plaintext (primary)
The pointer swap is trivial; the constraint is length (§7). Two options:

- **In-place, same length (lowest risk):** in the detour, follow `[rsp+0x38]` to the buffer,
  overwrite its payload bytes with your crafted protobuf of **identical length**. No layout
  knowledge needed beyond the payload start.
- **Pointer swap, any length:** point `desc+0x18` (`[rsp+0x38]`) at a buffer object **you**
  allocated that mimics the original object's layout (vtable/refcount/data-ptr/size fields), with
  your bytes and correct internal size. Requires the object layout (§7, unknown).

Detour writes `[rsp+0x38] = &crafted_buffer` (or edits in place), then falls through to the real
`mov rax,[rbx+0x68]; call rax`.

### 3b. Inject Format(subtype=I420) announce — SAME node, first packet
The announce is already a first-class emit in the same method (`0x1803d130f`, tag=1), gated by:
1. `sinkobj+0xe8 != 0` (announce-pending flag), AND
2. `[frame+0x90] & 0x48 != 0` (frame-type gate).

To fire it: **arm the flag** — either call slot2 `0x1803d1220` (`mov byte [rcx+0x78],1`, rcx=iface)
or have the injector write `sinkobj+0xe8 = 1` directly. On the next slot1 call, the tag=1 descriptor
is emitted **before** the tag=0 data packet — exactly the "Format announce, then video packet" pair.

Note the announce path reuses **the same `frame+0x48` plaintext** as the data packet. So the crafted
Format(I420) bytes must be injected at the **tag=1 invoke `0x1803d130f`** specifically (write
`[r11-0x18]`/`desc+0x18` there), independently of the tag=0 substitution at `0x1803d134b`. The flag
is auto-cleared at `0x1803d12e3` after one emit → re-arm per frame for a repeating announce, or arm
once for a single announcement.

**Recommended shape:** one shared cave reached from **both** `call rax` sites; it reads `tag` at
`[rcx+0x08]`; tag==1 → write I420-Format buffer to `[rcx+0x18]`; tag==0 → write crafted-video buffer
to `[rcx+0x18]`; then execute the displaced `mov rax,[reg+0x68]; call rax` and return. Arm the flag
from the injector (write `sinkobj+0xe8=1`) so the tag=1 site is reached.

---

## 4. Original bytes + detour plan

### Splice point (primary): `0x1803d1347` — `mov rax,[rbx+0x68]; call rax`
Original 6 bytes at `0x1803d1347` (RVA `0x3d1347`):
```
48 8B 43 68 FF D0        ; mov rax,[rbx+0x68] ; call rax
```
Replace with a 5-byte rel32 jmp + 1-byte pad:
```
E9 <rel32>  90           ; jmp detour ; nop
```
`rel32 = detour - 0x1803d134c`. The detour: (1) `mov rax,[rbx+0x68]` reload (rbx = sink obj, intact);
(2) optionally rewrite `[rsp+0x38]` for tag-based substitution; (3) `call rax`; (4) `jmp 0x1803d134d`
(back after the original `call rax`). rbx/rsp/rcx are all live and correct at this point.

For the announce site, splice `0x1803d130b` region analogously, or (cleaner) hook only the two
`call rax` bytes. Both invokes are `FF D0` (`call rax`), but a 2-byte site is too short for a rel32
jmp — so splice the 6-byte `mov rax,[reg+0x68]; call rax` window at each: `0x1803d1347` (rbx) for
data and `0x1803d12fb` (`mov rax,[rcx+0x68]`, 4B) + build for announce. Simplest robust variant:
**detour the whole method at its entry `0x1803d12b0`** (prologue `mov r11,rsp; mov [r11+8],rbx…`,
overwrite ≥5 bytes) and reimplement emit with your buffers — heavier but avoids the shared-frame
aliasing between announce and data.

### Code caves
Scan of `.text` int3 padding: **exactly one ≥26-byte cave — `0x180025806` (26 bytes, run of `0xCC`
preceded by `0xC3`).** Everything else is ≤21 bytes (23×21B, 25×20B, …). 26 bytes is **too small**
for the full tag-dispatch + buffer-write + displaced-call + return logic.

Recommended: the injector **`VirtualAlloc`s an RX trampoline page** and jmps there. If a 5-byte
rel32 can't reach it (±2GB), either (a) allocate near the module image, or (b) two-stage: rel32 jmp
to `0x180025806`, and from the 26-byte cave a 14-byte absolute indirect `FF 25 00 00 00 00 <qword abs>`
to the allocated page. Keep the original 6 displaced bytes executed in the trampoline before
returning to `0x1803d134d`.

RVAs to patch/reference (add ImageBase for VAs):
`0x3d134b` data invoke · `0x3d130f` announce invoke · `0x3d129a` slot3 invoke · `0x3d1220` slot2 arm
· `0x3d1370` ctor · callback `+0xd8` · userData `+0xe0` · announce-flag `+0xe8` · plaintext source
`frame+0x48` · desc plaintext `+0x18` · desc tag `+0x08` · media-sink vtable `0x4cdc90` · primary
vtable `0x4cdc38`.

---

## 5. Encrypt-vs-decrypt instance (INFERRED)
This sink class is **generic**: identical code encrypts on send and decrypts on receive; only the
instance differs (its `+0xd8` holds `encryptCallback` on the send/encode instance vs
`decryptCallback` on the receive instance). Evidence it is the send/encrypt path: plaintext is
pulled from `frame+0x48`, the freshly serialized outgoing protobuf (same field `0x180107870` fills
post-serialize), i.e. plaintext flowing **into** the callback. The parsed VideoConfig feeding the
sink holds `encryptCallback`/`encryptUserData` adjacently at cfg`+0x68`/`+0x70` (move-ctor
`0x1803d44a0` copies `[+0x68]`,`[+0x70]`), which the sink ctor maps to `+0xd8`/`+0xe0`.

---

## 6. Fallback hook — serialize-output substitution (CONFIRMED prior trace)
If instance disambiguation (§7.3) proves unreliable at runtime, hook upstream at the NetSink
serialize/forward site: send-graph node process fn **`0x180107870`** serializes via dispatcher
**`0x180133990`** at call site **`0x1801079e5`**, storing the plaintext protobuf buffer to
**`[rbx+0x48]`** (the very field later read as `frame+0x48` at the encrypt hook), then forwards
downstream via `[rax+0x10]`. Substituting the buffer here (post-serialize, pre-forward) reaches the
same plaintext before it ever gets to the encrypt callback.

Caveats vs the primary hook:
- Runs earlier in the graph; must confirm this node feeds the **encrypt** sink and not a tee/other
  consumer. Less selective than pinning the actual `encryptCallback` invoke.
- The Format(I420) announce mechanism (`+0xe8` flag, tag=1 emit) lives at the **sink**, not here —
  announce injection still needs the §3b sink-side arming. Serialize-site substitution alone cannot
  synthesize the announce packet.
- Same length constraint applies (§7.1).

---

## 7. Residual unknowns (honest)
1. ~~**Buffer object internal length field.**~~ **RESOLVED (2026-07-30, static RE — see
   IMPLEMENTATION-STATUS.md R1a).** `desc+0x18` is NOT a pointer to a wrapper object — it is the raw
   `char*` data pointer of an **embedded MSVC `std::string`** at `frame+0x48`
   (`data@frame+0x48 / size@frame+0x58 / cap@frame+0x60`). Proven from the send path: assign helper
   `0x18007fb20` is `std::string::assign(char*,size_t)` writing in place to `[node+0x48]`. The
   encrypt callback is an NPL **adapter** (the WickrPro `encryptCallback 0x140147170` is a 4-arg
   `encrypt(a,b,c,flag)`, not `fn(desc*)`); its length is the string's `size`. Different-length
   substitution: in the detour (rdi=frame live) rewrite the whole string triple
   `{[rdi+0x48]=&crafted, [rdi+0x58]=len, [rdi+0x60]=len}` **and** `[rsp+0x38]=&crafted`, with
   save/restore around the `call rax` so the real dtor frees the original buffer. Sink class RTTI =
   `Musigy::AV::NPLSink`. One cheap runtime check remains: object-identity between the serialize hook
   and the encrypt hook (log-and-compare the two pointers).
2. **Frame-type gate `[frame+0x90] & 0x48`.** The announce fires only when these bits are set.
   `0x48` is presumed to mark video keyframe / format-eligible frames — **semantics INFERRED,** not
   byte-confirmed. If it never matches for your frames the announce won't emit; may need to also set
   those bits, or drive the announce by directly invoking the callback with a tag=1 descriptor you
   build.
3. **Which live instance is the send/encrypt sink.** Static analysis cannot distinguish the
   encrypt vs decrypt instance (shared class). The injector must select at runtime — e.g. match
   `sinkobj+0xd8` against the WickrPro `encryptCallback` resolved from the config map, or pick the
   sink on the publish/encode graph. **Runtime step, unresolved statically.**
4. **Crafted protobuf wire correctness.** The substituted VIDEO packet and the Format(subtype=I420)
   announce must match the exact wire format the downstream/decoder expects (frame headers, field
   tags). Out of scope of the hook mechanics but required for an end-to-end PoC.
5. **Cave size.** Only one ≥26-byte in-module cave; the working injector should VirtualAlloc its
   trampoline rather than rely on int3 padding (§4).

---

## Bottom line
- Pin: **`NPL.dll + 0x3d134b`** (data) and **`NPL.dll + 0x3d130f`** (announce), inside slot1
  `0x1803d12b0`.
- Plaintext ptr: **`[rsp+0x38]` = `[rcx+0x18]` = desc+0x18**, from `frame+0x48`; **no separate
  length** (buffer self-sizes).
- Substitute by editing in place (same length) or swapping the pointer (needs buffer layout);
  inject I420 by arming `sinkobj+0xe8` and writing the tag=1 descriptor's `+0x18`.
- Detour: overwrite the 6-byte `48 8B 43 68 FF D0` at `0x1803d1347` with `E9 <rel32> 90` to a
  VirtualAlloc'd trampoline (or two-stage via the 26-byte cave at `0x180025806`).
- Blocking unknowns: buffer length-field offset (only if changing length), the `&0x48` frame gate
  semantics, and runtime send-vs-recv instance selection.
