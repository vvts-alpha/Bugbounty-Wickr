# A9 — NPL.dll audio-depacketization / ReliabilityLayer / PacketBundleDecoder / DataChannel demux

**Agent:** A9 (calling — audio + reliability sinks; the ones A6 left unaudited).
**Date:** 2026-07-24. Target: `E:\tmp\wickr\main\NPL.dll` (AWS Wickr 6.72.20, Windows).
**Verdict: NEGATIVE — no OOB-write and no UAF/double-free WIN on the assigned sinks.**
Every attacker-reachable write/index I traced is bounded to its allocation; the demuxers are hash-map / mod-capacity indexed (not raw array-indexed); the free/retransmit paths are refcounted with null-after-release. Honest negative-leaning, precise bounds per sink below. No crash produced ⇒ no WIN claimed. Reachability (peer authors post-DTLS bytes, ≥1-click) is inherited from A6 and re-confirmed; my sinks sit strictly **post-connection-established ⇒ ≥1-click (victim answers), not 0-click**.

Method: own capstone/pefile xref map of the whole `.text` (1,141,753 insns, 32,848 xref targets) + RTTI→vtable resolver (my own; did NOT touch the other agent's `npl_proj.rzdb`). Live-validated key sites against the running WickrPro.exe.

---

## Scope (audited) vs A6
A6 covered FEC XOR / `ReorderingBuffer`(list) / channel-config and found them bounded (1 residual bounded OOB-**read** in FEC, non-win). I covered the sinks A6 explicitly left open:
1. Audio depacketization / jitter (`PacketBundleDecoder` per-codec, feeding Opus/AAC).
2. `ReliabilityLayer` retransmit/reorder — UAF/double-free + sequence/window index OOB.
3. `PacketBundleDecoder` sub-packet offset/length/count.
4. `DataChannel` dispatch / demux.
(Video reassembly + signaling protobuf = other agent, untouched. Opus/AAC codec internals = 3rd-party, excluded — I target Wickr's framing feeding them.)

## RTTI map recovered (my sinks)
- `PacketBundleDecoder@AV@Musigy` vtable `0x180443ff0` — **per-codec factory** `0x180128b30` keyed by fourcc string: **"Opus"→ctor `0x180148810`** (obj 0x238), **"AAC"/"AAC_LD"/"AAC_ELD"→ctor `0x180147020`** (obj 0x230). The decoder is a composite object embedding the PBD sub-object at +0x168.
- `ReliabilityLayerImpl@Net@NPL@Musigy` vtable `0x1804310d8` (22) + reorder-listener vtable `0x180431190`[4]=`0x1800bed20` (A6's AddPacket).
- `ReorderBuffer<WrapAroundIndex,Packet,0xEL>@Musigy` vtable `0x180430bc0` — **template ring, distinct from A6's list-based `ReorderingBuffer`**; both constructed in `0x1800ba0b0`.
- `DataChannel@Net@NPL@Musigy` vtable `0x180437120`; `JitterBuffer@AV@Musigy` vtables `0x1804cf050/0a8/0e0/110`; `PacketQueue`/`PacketReceiver@AV@Musigy`.

---

## Sink-by-sink evidence (all BOUNDED)

### 1. Audio depacketizer (Opus/AAC sub-frame split) — `0x1801650b0`  BOUNDED
Reached: composite-decoder `ProcessData` = Opus vtable[+0x70][1] `0x1801494e0` (validates buf `[r8+0x10]!=0`, count `[r8+0x18]>=1`) → tail-calls `0x1801650b0(this+0xf8, buf)`.
Splits one buffer into ≤31 sub-frames using a leading length table:
```
edi = buf.len ([rdx+0x18]);  lea eax,[edi-2]; cmp eax,0x3fe; ja bail   ; len in [2..1024]
K   = byte[data]           ; sub-frame count
r8d = K+1;  cmp r8d,0x20; ja bail                                       ; K <= 31
edi = len-(K+1); test edi; jle bail                                     ; header fits, payload>0
r15 = data+1+K             ; payload cursor
loop rbp=0..K-1:
   esi = byte[data+rbp+1]+1        ; declared sub-len (+1)
   edi -= esi; test edi; jle break ; <-- per-subframe remaining-bytes guard
   emit(ptr=r15, len=esi); r15 += esi
```
`r15` is provably confined to `[data, data+len)` (Σ(sub-len+1) < len-K-1 enforced each step); the length table read `data+1..data+K` is inside the ≥K+2-byte buffer. **No OOB.** The `emit` sink `[codec_vt+8]` is the 3rd-party codec (excluded). This is the "sub-packet offset/length/count" parser the mandate flagged — and it carries the exact bound check that would be missing in a vulnerable one.

### 2. DataChannel dispatch / demux — `0x1800da050` (+ FEC getter `0x1800da210`)  BOUNDED
Collects sub-packets into a **fixed 32-entry stack array** with an explicit cap before FEC/reorder:
```
inner: cmp ecx,0x20; je done          ; <-- hard cap = array capacity (0x140 frame = 32*8 slots)
       call 0x1800bcd50 (process one) ; store [localarr + counter*8] = result
```
Refcounted (`lock inc [pkt+0xcc]`). `0x1800da210` lazily creates the per-mode FEC decoder via A6's factory `0x1800e0310`, releasing the old one via refcount (`[vt] edx=1`) — no type-confusion store, no unchecked index. **No stack overflow, no OOB.**

### 3. ReorderBuffer<WrapAroundIndex> store — `0x1800bc3e0` / `0x1800bd490`  BOUNDED (closes the index-OOB thesis)
This is the template ring A6 did **not** examine (A6 looked at the list-based `ReorderingBuffer`). Every store path reduces the attacker sequence index modulo capacity **before** the write:
```
xor edx,edx; mov eax, seq; div [rbx+0x14]   ; rdx = seq mod capacity
mov [ [rbx] + rdx*8 ], packet                ; store in-bounds by construction
```
Grow path doubles capacity up to max `[rbx+0x18]`, `malloc`+`memset(0)`+rehash(`div newcap`), then `free(old)` **once**, `[rbx]=new`. WrapAroundIndex comparisons use the signed-0x7fffffff half-range test. **No index OOB** (modulo-bounded), **no double-free** (single free of superseded buffer). Divisor (capacity) is construction-set & only grows ⇒ no attacker div-by-0.

### 4. Reliability channel demux (by 16-bit id) — `0x1800be290`  BOUNDED
Get-or-create channel keyed by attacker 16-bit id via **FNV-1a hash** (`0xcbf29ce484222325` basis × `0x100000001b3`) then `& [rbx+0x370]` (power-of-2 mask) → bucket. Chained compare of stored id `[node+0x10]`. Create is gated (`(0x100+id) as u16 <= 0xfc`) and produces a refcounted channel. **Id never indexes a raw array** ⇒ no id-driven OOB.

### 5. Reliability in-order block parser (TLV) — `0x1800bef10`  BOUNDED
Skips a 0x21-byte header then loops `(id:u16, len:u16, payload[len])` with a per-block bound at every step:
```
lea rax,[cursor+len]; cmp rax, end; ja bail   ; declared sub-len can't exceed datagram
```
id!=0xffff → per-stream lookup `0x1800be290` (map, §4). **No OOB** — this is the "declared sub-length exceeds remaining datagram" case, and it is checked.

### 6. Hot-path packet clone (reorder receive) — `0x1800bcd50`  BOUNDED
Deep-copies a received packet: `alloc = 0x160 + [src+0xd8] + [src+8]`, advances dest by `[src+0xd8]`(+0x40), then `memcpy(dest, [src], [src+8])`. Allocation is sized to `offset+len+header` ⇒ copy fits by construction (same "alloc==content" pattern A6 saw in FEC). Refcount fast-path `lock inc [pkt+0xcc]`.

### 7. Reliability reset/teardown — `0x1800bd270`  anti-UAF discipline
Release sequence is `call [vt+0x30]` (cancel) → `call [vt+0x10]` (refcount release) → **`ptr = 0`** (null-after-release), guarded by null checks. List drain `[obj+0x338]` releases each node via vtable. This refcount+null-after-free pattern is exactly what defeats the naive retransmit/out-of-order UAF the mandate targeted.

---

## Adversarial refutation
- **Truly OOB or bounded to alloc?** Bounded. §1 confines the cursor by an enforced running-remainder check; §3/§4 reduce attacker indices modulo capacity / hash-mask before any store; §6 allocates to content size.
- **Integer-overflow opening?** Only candidate is the 32-bit add `[src+0xd8]+[src+8]+0x160` in §6. Both are transport-bounded Packet fields (post-DTLS datagram ≤ ~64KB; `NPLPacketFromData` rejects negative len, A3), nowhere near 2³² ⇒ no wrap ⇒ no undersized alloc. Refuted for the default P2P-relay path.
- **UAF/double-free on retransmit/reorder?** Not found: packets are refcounted; ring resize frees the superseded buffer once; teardown nulls after release. No path re-frees or re-uses a freed Packet from a duplicate/out-of-order/duplicate-ack input that I could reach statically.
- **Wickr code vs 3rd-party?** All §1–§7 are Musigy `AV`/`Net` (Wickr's own). The codec `emit` (§1) and the eventual Opus/AAC/SILK decode are 3rd-party (excluded). No crash was produced in Wickr code.
- **0-click?** No. All these parsers require an established DataChannel (post-DTLS-handshake) ⇒ ≥1-click. The 0-click pre-answer candidate is the signaling protobuf = other agent's surface.

## Live validation (rigor)
Attached frida to running **WickrPro.exe pid 20892**; NPL.dll base `0x7ff8e6b00000` (rotates). Live 16-byte reads at my four decisive sites **match the static file byte-for-byte**:
`0x1801650b0`=`4057415541564883ec408b7a184c8bf2`, `0x1800bc3e0`=`48895c240848896c2410488974241848`, `0x1800be290`=`48895c242055565741564157488d6c24`, `0x1800da050`=`4c8bdc534881ec4001000049897b1848`. ⇒ my disassembly reflects the shipped, executing module.

## Blockers to a WIN / honest scope limits
1. Every attacker-reachable write/index on these sinks is bounded (allocation-sized copies; mod-capacity ring; hash-map demux; explicit 32-cap; per-block TLV bound).
2. Refcount + null-after-release defeats the naive retransmit/reorder UAF/double-free.
3. Not done (would be needed to escalate): dynamic call-fuzz with a **live malicious peer** (2nd throwaway account injecting crafted media/reliability frames into an active call) to exercise duplicate-ack / adversarial-reorder state transitions I could only reason about statically; and the **AAC_LD/AAC_ELD** ctor-`0x180147020` decode path was inferred to share the bounded §1 splitter but not independently disassembled to instruction level. These are the only residual openings; nothing rises to the VERIFY STANDARD, so no WIN is claimed.

**Bottom line:** the audio/reliability/bundle/datachannel half of NPL is defensively coded (mod-capacity indexing, hash-map demux, alloc==content copies, refcount+null-after-free, per-block bounds, /GS on receive fns). Consistent with and extends A6's negative. **NEGATIVE — no OOB-write/UAF WIN on this surface.**
