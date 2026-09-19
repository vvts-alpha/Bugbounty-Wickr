# W13 — the `PacketHeader` consumer map finished, and the ephemerality promise tested

Target: **AWS Wickr Desktop 6.72.20.0 (Windows x64)**. Binaries: `NPL.dll`, `WickrPro.exe`.
Tools written this wave: `scratch/w13/{fn,rd,strs,xref,offscan,sigscan,phscan,phscan2}.py`.
Everything below is `.pdata`-bounded per-function disassembly with **chained secondary chunks folded
into their primary** (NPL: 8,980 primary functions), never a linear `.text` sweep.

---

# ██ SCOPE 1 — the eight remaining `PacketHeader` fields ██

## 0. FIRST: the target list in the brief is in two different coordinate systems

The Wave-4 recon note enumerated `+0x40 +0x44 +0x48 +0x4c +0x54 +0x58 +0x5c +0x60 +0x98`. **That
list mixes two structures and is off by one entry.** CONFIRMED (disassembled):

* `+0x40 … +0x64` are offsets in the **`Proto::PacketHeader` message object**.
* `+0x98` is an offset in the **`Musigy::AV::Frame`** object (which *is* the `Packet` of the NPL C
  API — proved below).

The message object carries **ten** int32s: nine unclamped metadata fields at
`{0x40,0x44,0x48,0x4c,0x50,0x54,0x58,0x5c,0x60}` plus `kind` at `0x64`. The recon list omits `+0x50`
and substitutes a Frame offset for it.

**Consequence: the field already done as F2c is `PacketHeader+0x58` (protobuf field 10), not
`+0x98`.** The chain is `field 10 → PacketHeader+0x58 → Frame+0x98 → descriptor+0x5c → the ratchet`.

**⇒ The eight remaining fields are protobuf fields 3, 4, 5, 6, 7, 8, 11, 13**, i.e. message offsets
`{0x40, 0x44, 0x48, 0x4c, 0x50, 0x54, 0x5c, 0x60}`.

## 1. Parse sites and clamps — CONFIRMED (disassembled), 9/9 cross-checked

`PacketHeader::_InternalParse` = `NPL 0x18013b930` (vtable slot `+0x48` of vtable `0x180442428`,
class `.?AVPacketHeader@Proto@AV@Musigy@@`), extent `0x18013b930`–`0x18013bfa4`, 1652 bytes.

Dispatch is a jump table: `shr eax,3 / dec eax / cmp eax,0xc / ja` (`0x18013b9de`–`0x18013b9e6`),
table of RVAs at `0x18013bf70`, `r12 = 0x180000000` (`lea r12,[rip-0x13b951]` @ `0x18013b94a`).

| f | tag | handler | store instruction | has-bit | **clamp at parse?** |
|---|---|---|---|---|---|
| **1 `kind`** | 0x08 | `0x18013b9f9` | `41897e64  mov [r14+0x64], edi` @`0x18013ba9a` | 11 | **YES** |
| 2 | 0x12 | `0x18013baa3` | repeated msg → vector at `+0x18`, count `+0x20` | — | count-bounded downstream |
| **3** | 0x18 | `0x18013bb15` | `41895640  mov [r14+0x40], edx` @`0x18013bb5d` | 2 | **NONE** |
| **4** | 0x20 | `0x18013bb6f` | `41895644  mov [r14+0x44], edx` @`0x18013bbb7` | 3 | **NONE** |
| **5** | 0x28 | `0x18013bbc9` | `41895648  mov [r14+0x48], edx` @`0x18013bc11` | 4 | **NONE** |
| **6** | 0x30 | `0x18013bc23` | `4189564c  mov [r14+0x4c], edx` @`0x18013bc6b` | 5 | **NONE** |
| **7** | 0x38 | `0x18013bc7d` | `41895650  mov [r14+0x50], edx` @`0x18013bcc5` | 6 | **NONE** |
| **8** | 0x40 | `0x18013bcd7` | `41895654  mov [r14+0x54], edx` @`0x18013bd20` | 7 | **NONE** |
| 9 | 0x4a | `0x18013bd32` | `Buffer` sub-message → `[r14+0x30]` | 0 | **NONE** — this is Finding 2 |
| **10** | 0x50 | `0x18013bd8e` | `41895658  mov [r14+0x58], edx` @`0x18013bdd7` | 8 | **NONE** — **F2c, done** |
| **11** | 0x58 | `0x18013bde9` | `4189565c  mov [r14+0x5c], edx` @`0x18013be32` | 9 | **NONE** |
| 12 | 0x62 | `0x18013be44` | sub-message → `[r14+0x38]` | 1 | — |
| **13** | 0x68 | `0x18013bea0` | `41895660  mov [r14+0x60], edx` @`0x18013bee5` | 10 | **NONE** |

**§0 rule 5 (asymmetry inside one function) — the validated sibling, quoted.** `kind` is the *only*
field checked, and it is checked by an equality chain immediately after its varint decode:

```
0x18013ba4f  8bcf            mov ecx, edi
0x18013ba51  83e901          sub ecx, 1
0x18013ba54  743c            je  0x18013ba92        ; kind == 1  -> accept
0x18013ba56  83e901          sub ecx, 1
0x18013ba59  7437            je  0x18013ba92        ; kind == 2  -> accept
0x18013ba5b  83f901          cmp ecx, 1
0x18013ba5e  7432            je  0x18013ba92        ; kind == 3  -> accept
0x18013ba60  ...                                    ; else -> unknown-enum-value skipper
0x18013ba92  41814e1000080000 or dword [r14+0x10], 0x800
0x18013ba9a  41897e64        mov dword [r14+0x64], edi
```

**Nine siblings twenty instructions away get no comparison of any kind.** Every one of the nine
handlers has the identical shape — decode varint, set has-bit, `mov [r14+off], edx` — with no `cmp`
between the decode and the store.

**Independent cross-check — the generated serializer.** `PacketHeader::_InternalSerialize` =
`NPL 0x18013bfb0` (vtable slot `+0x58`) reads exactly and only:

```
0x18013c086 [rsi+0x40]  0x18013c0ed [rsi+0x44]  0x18013c14d [rsi+0x48]  0x18013c1ad [rsi+0x4c]
0x18013c20d [rsi+0x50]  0x18013c26c [rsi+0x54]  0x18013c2f4 [rsi+0x58]  0x18013c351 [rsi+0x5c]
0x18013c3d1 [rsi+0x60]                                    (+ 0x18013bfe5 [rsi+0x64] = kind)
```

9/9 agreement with the parse-site table. The field↔offset map is not inferred.

## 2. The complete consumer set of a parsed `PacketHeader` — CONFIRMED (disassembled)

`Musigy::AV::Parser` — RTTI `.?AVParser@AV@Musigy@@`, vtables `0x18043ee88` (primary) and
`0x18043eee0` (secondary base at complete-object offset **112 = 0x70**).

`AV::Parser::onPacket` = **`NPL 0x18011fce0`** (secondary vtable slot `+0x08`). It is the sole
producer of the parsed-header pointer:

```
0x18011fdca  488b97e8000000  mov  rdx, qword ptr [rdi + 0xe8]   ; rdi = Parser complete+0x70
                                                                ; so the message lives at
                                                                ; Parser complete + 0x158
0x18011fdd1  8b4a64          mov  ecx, dword ptr [rdx + 0x64]   ; kind
0x18011fdd4  83e901 / je 0x18011ffbe   -> kind 1
0x18011fddd  83e901 / je 0x18011ffb0   -> kind 2
0x18011fde6  83f901 / je 0x18011ffa2   -> kind 3
                     else -> "Unknown packet payload type: " and drop
```

`rdx` survives to all three call sites (`lea rcx,[rdi-0x70]` / `mov r8,rsi` / `call`), so **the three
handlers each receive the message as their second argument and they are the whole consumer set:**

| kind | handler | log string | reads PacketHeader int32s? |
|---|---|---|---|
| 1 FORMAT | `0x18011ed00` (620 B) | `"Failed to parse the incoming packet"` | **NO — none at all.** It reads `[r8+0x10]`/`[r8+0x18]`, the transport buffer, and parses a `Format` |
| 2 MEDIA | `0x18011ef70` (2343 B) | `"Incoming packet contains too many color planes"` | fields **3, 4, 10, 11, 13** |
| 3 EVENT | `0x18011ea60` (671 B) | `"Received EVENT packet, id: "` | field **7**, twice |

## 3. Field → `Frame` map — CONFIRMED (disassembled)

From the kind==2 handler (`rdi` = PacketHeader, `r14` = the new Frame, `r12d` = 0):

```
0x18011f25b  8b4740          mov eax, [rdi+0x40]        ; field 3
0x18011f25e  4189868c000000  mov [r14+0x8c], eax        ; -> Frame+0x8c      UNCONDITIONAL
0x18011f265  8b4744          mov eax, [rdi+0x44]        ; field 4
0x18011f268  41898690000000  mov [r14+0x90], eax        ; -> Frame+0x90      UNCONDITIONAL
0x18011f26f  4589a694000000  mov [r14+0x94], r12d       ; Frame+0x94 := 0    (see field 5)
0x18011f2aa  8b4758 / 0x18011f2ad mov [r14+0x98], eax   ; field 10 -> Frame+0x98   (has-bit 8)
0x18011f2be  8b475c / 0x18011f2c1 mov [r14+0x9c], eax   ; field 11 -> Frame+0x9c   (has-bit 9)
0x18011f2d2  8b4760 / 0x18011f2d5 mov [r14+0xa0], eax   ; field 13 -> Frame+0xa0   (has-bit 10)
```

**Fields 5 (+0x48), 6 (+0x4c), 7 (+0x50) and 8 (+0x54) are not read anywhere in this handler.**

**`Packet` (NPL C API) == `Musigy::AV::Frame`** — CONFIRMED, two independent checks: the kind==2
handler writes strides at `Frame+0x60+4i` and heights at `Frame+0x70+4i`
(`lea r8,[rax+0x70]` @ `0x18011f012`, `mov [r8-0x10],eax` / `mov [r8],eax`), which is exactly what
`NPLAVPacketGetDescriptor`'s 4-iteration loop reads back out of `r10`; and `Frame+0x18` is the
peer-declared length that `NPLAVPacketGetBuffer` returns verbatim.

## 4. The descriptor is a dead end for six of its seven fields — CONFIRMED (full function read)

`NPLAVPacketGetDescriptor` `0x1803d0e50` copies `Frame+0x18→desc+0x00`, `+0x80→+0x48`,
`+0x88→+0x50`, `+0x8c→+0x54`, `+0x90→+0x58`, `+0x98→+0x5c`, `+0xa0→+0x60`. (`Frame+0x94` and
`Frame+0x9c` are **not** copied.)

The media decrypt callback `WickrPro 0x14013f390`–`0x14013f4e1` is **337 bytes and was read in
full**. The descriptor buffer is at `[rbp-0x40]` (`lea rdx,[rbp-0x40]` @ `0x14013f3e5`). **The only
instruction in the entire function that reads it is:**

```
0x14013f438  8b4d1c    mov ecx, dword ptr [rbp + 0x1c]     ; = descriptor + 0x5c   (F2c)
```

⇒ **`desc+0x48`, `+0x50`, `+0x54`, `+0x58`, `+0x60` are populated and discarded.** Fields 3, 4 and 13
reach WickrPro and are never read there.

**And that bound is complete for the whole application.** The NPL export table (230 named exports,
enumerated) contains exactly **two** packet accessors: `NPLAVPacketGetBuffer` and
`NPLAVPacketGetDescriptor`. WickrPro's total visibility into a received packet is `[Packet+0x18]`
plus the 0x68-byte descriptor. There is no third accessor.

## 5. Verdict table

| f | PH off | Frame off | clamp | every consumer found | classification | **verdict** |
|---|---|---|---|---|---|---|
| **3** | +0x40 | +0x8c → desc+0x54 | none | Serializer `0x18011d5b2` (send); Frame copy-ctor `0x180135d20`; field-by-field log dumper `0x1800ca140` @`0x1800ca64d`; **`VpxDecoder::process` never reads `Frame+0x8c`**; `OpusDecoder` *writes* it to 0 (`0x1801490c2`); WickrPro never reads `desc+0x54` | stored, copied, logged | **NEGATIVE** |
| **4** | +0x44 | +0x90 → desc+0x58 | none | a flags word. Bits tested on the video path: 2 (`0x1801448d0`,`0x180144e80`), 3+6 (`0x1801445c8 test byte [rbx+0x90],0x48`), 10/11 (`0x18014424b and ebp,0xc00`), **14** (`0x1801447b2 shr eax,0xe / and al,1`), 17 (`0x180144583 shr edx,0x11`→`0x180122400`, a 52-byte state-change notifier). Local code ORs in bits 3/9 from the transport packet and bit 7 on the EVENT path (`0x18011ec83`) | bit 14 selects one of exactly two decoder contexts — **already reported** (the F3 "one publisher fills both contexts" doubler). The rest are booleans selecting branches | **PARTIAL — no new finding** |
| **5** | +0x48 | — | none | **none on the receive path.** The *sender* writes it from `Frame+0x94` (`0x18011d5e8`); the *receiver* zeroes `Frame+0x94` (`0x18011f26f`) and never reads field 5 | write-only wire field | **NEGATIVE** |
| **6** | +0x4c | — | none | **none.** Sender writes a constant (`0x18011d60b mov [rax+0x4c], r12d`) | write-only wire field | **NEGATIVE** |
| **7** | +0x50 | — (EVENT id) | none | `0x18011eaf6` → log; `0x18011ec8d` → `0x18011ecb9 mov r8d,r14d` → **`0x18011ecc3 call qword ptr [rax+0x18]`** | 3rd argument to a virtual dispatch | **UNDETERMINED — see §6** |
| **8** | +0x54 | — | none | **none — and no application serializer writes it either.** Only the generated `_InternalSerialize` touches it | dead wire field | **NEGATIVE** |
| 10 | +0x58 | +0x98 → desc+0x5c | none | the ratchet | — | **DONE (F2c)** |
| **11** | +0x5c | +0x9c | none | see §7 | persistent-but-resettable state + two poisonable counters; decode-failure sink **clamped** | **NEGATIVE for memory safety; one reportable sub-item** |
| **13** | +0x60 | +0xa0 → desc+0x60 | none | `OpusDecoder::decodeSubPacket 0x180148dd0`: `0x180148e85 cmp eax,[rdi+0x158] / 0x180148e8b jbe / 0x180148e8d mov [rdi+0x158],eax` — a monotonic **max**. Read at `0x180148ef1` into a log line emitted **every 64th packet** (`0x180148e96 and eax,0x3f / cmp al,0x3f / jne`) and then **reset**: `0x180148f6a mov qword ptr [rdi+0x158], rsi` (rsi = 0, clears `+0x158` and `+0x15c`). WickrPro never reads `desc+0x60` | monotonic max over a 64-packet window, logged, reset | **NEGATIVE** |

## 6. Field 7 — the one UNDETERMINED item, stated exactly

`kind==3` is an **EVENT** packet and field 7 is its **id** — confirmed symmetrically from both ends:

* receive: `NPL 0x18011eaf6  418b5e50  mov ebx, dword ptr [r14 + 0x50]` feeding the UTF-16 log format
  `"Received EVENT packet, id: "` at `NPL 0x18043f1d8`.
* send: the EVENT serializers `0x18011de20` (`0x18011dedb 44896850 mov [rax+0x50], r13d`) and the
  Parser's own `0x18011f970` (`0x18011fa20 44896050 mov [rax+0x50], r12d`), both of which also set
  `kind=3` and field 4 = `0x80` — matching the receive side's `0x18011ec83 or dword [rax+0x90], 0x80`.

The live consumer:

```
0x18011ec8d  458b7650        mov  r14d, dword ptr [r14 + 0x50]   ; field 7, unclamped, off the wire
0x18011eca7  488b8e18010000  mov  rcx, qword ptr [rsi + 0x118]   ; rsi = Parser complete object
0x18011ecae  4885c9          test rcx, rcx
0x18011ecb1  7414            je   0x18011ecc7                    ; null -> silently skipped
0x18011ecb3  488b01          mov  rax, qword ptr [rcx]           ; vtable
0x18011ecb6  4c8bcf          mov  r9, rdi                        ; arg4 = the new Frame
0x18011ecb9  458bc6          mov  r8d, r14d                      ; arg3 = THE PEER EVENT ID
0x18011ecbc  488d96d8000000  lea  rdx, [rsi + 0xd8]              ; arg2
0x18011ecc3  ff5018          call qword ptr [rax + 0x18]         ; vtable slot 3
```

**What I could not establish:** the class of `[Parser+0x118]`, and therefore what slot 3 does with
the id. A `.pdata`-bounded sweep for `mov qword ptr [reg+0x118], reg` over the whole AV node range
`0x180118000`–`0x180140000` returned **zero** stores, so the delegate is installed from outside that
range (or through a helper that takes the member's address), and I did not chase it further. The
broader whole-image `+0x118` scan returns 184 sites and is base-agnostic, so it does not discriminate.

**Why this is the right one to chase next**, if anyone does: it is the only one of the eight where a
raw, unclamped, peer-supplied int32 is passed *as an argument* into an indirect call rather than
being stored, logged or masked. If slot 3 uses it as an index or a map key, that is the F2c shape
again. If it compares it against an enum, it is a negative like the other seven. **Cost: one function
identification.**

## 7. Field 11 — closes an open item in the brief, with the clamping instruction

`Frame+0x9c` is the **per-context video frame sequence number**. `VpxDecoder::process` is
`NPL 0x180144520` (4317 bytes). Register identities, CONFIRMED: `r12` = the node's secondary base,
`r13 = r12 - 0x70` = the **complete object** (proved twice — `[r12+0x4a8]` is the decoder-context
array the brief records at complete-object `+0x518`, and `0x18014483d`'s clears of
`[r12+0x470..0x475]` are the same bytes that `0x180144130` addresses as `[rdi+3·ctx+0x4e0]`).

```
0x180144874  448b8b90000000  mov r9d, dword ptr [rbx + 0x90]     ; field 4
0x18014487b  448b839c000000  mov r8d, dword ptr [rbx + 0x9c]     ; field 11
0x180144882  418bd6          mov edx, r14d                       ; the bit-14 context index
0x180144888  e8a3f8ffff      call 0x180144130
```

Inside `0x180144130` (`esi` = field 11, `r14d` = ctx ∈ {0,1}):

* `0x180144174 cmp esi,ecx / jae` — **if field 11 < `last_seq[ctx]`, `0x180144178` resets
  `last_seq[ctx] := 0`.** So this state is **not** monotonic. Unlike F2c there is no permanent wedge:
  one small value resets it and the next legitimate frame re-seeds it.
* `0x180144197 0187c8040000 add dword ptr [rdi+0x4c8], eax` with `eax = field11 − last_seq − 1`, and
  `0x180144239 0187bc040000 add dword ptr [rdi+0x4bc], eax` — **two 32-bit counters take an
  attacker-chosen addend of up to ~2³² from a single packet.**
* `0x18014423f 4289b4b7d8040000 mov dword ptr [rdi+r14*4+0x4d8], esi` — `last_seq[ctx] := field 11`.
* **The loop that looks unbounded is not.** `0x1801441b0`–`0x1801441fa` iterates `ecx` from
  `last_seq+1` to `esi`, i.e. an apparently peer-chosen trip count. It self-terminates in **≤5
  iterations**: the loop guard is `0x1801441b0 cmp byte ptr [r8+r14+0x4e0], 0 / je exit`, and the
  body zeroes that very byte on the first iteration where `ecx ≡ 1 (mod 4)`
  (`0x1801441d4 mov byte ptr [r8+r14+0x4e0], 0`). Since `ecx` increments by one, that happens within
  four iterations and the fifth check exits. **Not a CPU DoS.**

**The decode-failure sink is clamped — this closes the brief's standing question.** On decode
failure `VpxDecoder::process` does `0x180144bed mov r8d, r14d` (field 11) →
`0x180144bfc call 0x180144320`, and the first thing that callee does is mask it:

```
0x180144320  448bca      mov r9d, edx          ; ctx index, 0 or 1
0x180144323  4183e003    and r8d, 3            ; <== THE CLAMP: field 11 masked to 2 bits
0x180144327  4a8d1449    lea rdx, [rcx + r9*2]
             ... writes only [rcx + 3*ctx + {0x4e0,0x4e1,0x4e2}] ...
0x180144362  c3
```

Write target: `rcx + 3·ctx + {0x4e0,0x4e1,0x4e2}` with `ctx ∈ {0,1}` ⇒ **six possible bytes.** No
index, no allocation, no unbounded state.

> Two corrections to the brief while here: `0x180144320` is **43 bytes** (`0x180144320`–`0x180144362`),
> not 25; and it sits in a **`.pdata` blind spot** — no RUNTIME_FUNCTION covers it.

**The one reportable sub-item.** The counters `[obj+0x4bc]` and `[obj+0x4c8]` are exported by the
stats getter `0x180144410`, which copies `+0x498…+0x4c7` with three `movups`, `+0x4c8` with a
`movsd` and `+0x4d0` with a `mov`, into a 0x3c-byte output struct. ⇒ **one packet sets the victim's
own decoder loss statistics to an arbitrary 32-bit value.** Whether that reaches rate control or the
metrics upload is **UNDETERMINED** — I did not identify `0x180144410`'s caller.

## 8. Coverage and blind spots for scope 1 — stated per §0 rule 7

* `.pdata` covers **89.83 %** of NPL's `.text`. `0x180144320` is itself in the 10.17 % blind spot.
* All sweeps fold chained secondary chunks into their primary (NPL: 8,980 primaries).
* The "field 5/6/8 have no consumer" claim rests on: reading **all three** kind handlers in full,
  reading both generated codec methods, and the complete two-accessor bound on the NPL C API. It
  does **not** rest on an exhaustive proof that no other code obtains a `PacketHeader*`. A
  base-agnostic offset sweep for that signature was attempted and abandoned as non-discriminating
  (offset `+0x10`/`+0x48` are far too common); the structural argument is the stronger one and it is
  what I am relying on. If someone wants to harden it, the check is: enumerate every writer of
  `Parser complete+0x158`.

---

# ██ SCOPE 2 — does the ephemerality promise hold? ██

## 1. Who decides a message's TTL / burn-on-read

**The storage model — CONFIRMED (schema strings read out of the image).**
`WickrPro 0x14323d800`:
`CREATE TABLE Wickr_Message (… destructTime INTEGER, … ttl INTEGER, … bor INTEGER DEFAULT -1, …
skipCleanup INTEGER DEFAULT 0, …)`. `Wickr_Convo` (`0x14323d370`) carries its own `destructTime` and
`bor`. `Wickr_Files` (`0x14323e4b0`) is `(fileName TEXT UNIQUE, state INTEGER, destructTime INTEGER
DEFAULT 0)`.

**Enforcement is a real DELETE, not a UI hide — CONFIRMED (disassembled).**
`queryDeleteExpiredMessages` = `WickrPro 0x1408f3e40`; its SQL literal is at `0x14323bff0`:

```
DELETE FROM Wickr_Message
 WHERE destructTime > 0 AND destructTime <= ?
   AND (state = 1 OR state = 4 OR state = 5)
   AND skipCleanup = 0
```

It has **exactly two callers**, and they answer "on a timer, at next launch, or only in the UI?":

* `0x140917120` — `"CACHE MAINTENANCE (cache expirations): "`, `" messages expired (cached), "`,
  `" messages expired (non-cached)."` → a periodic maintenance pass.
* `0x1409de790` — `": deleted "` / `" expired messages."` alongside `": loading contacts …"` and
  `": loading convos. (ON-DEMAND MESSAGE CACHING ENABLED)"` → the database load at session start.

⇒ **both**: a periodic sweep *and* a launch-time sweep, both deleting rows.

**Three ways a row escapes the reaper, visible in the query itself:** `destructTime = 0`,
`skipCleanup = 1`, or `state ∉ {1,4,5}`.

**The policy ceiling is SERVER-supplied — CONFIRMED (measured, string-block adjacency).**
`maxTTL`, `maxBOR`, `availableEnvelopeTTL`, `destructOnRead` (block at `0x143255688`) and
`maxMessageTTL`, `maxMessageBOR`, `availableEnvelopeBOR` (block at `0x14326a889`) sit in the **same
contiguous network-settings key blocks** as `forceOpenAccess`, `censorshipProxyConfig`,
`woaVendorId`, `maxUploadSize`, `canStartCall`, `enableScreenCapture`. Wave 9 established that this
blob's `forceOpenAccess` is server-flippable (`0x1409caebe mov byte ptr [rsi+0x195], 1`).
⇒ **the maximum TTL a client will accept from its own user is set by the network operator.**

**A default document is embedded in the binary** (readable at `WickrPro 0x142dc0a2a`):

```json
"availableEnvelopeTTL": [ 0, 600, 3600, 86400, 604800, 2592000 ],
"destructOnRead":       [ 0, 45, 600, 3600, 86400 ]
```

**`0` is a first-class option in both lists, and the reaper only deletes `destructTime > 0`.**
"Never expire" is therefore a supported, offered value — a product decision, not a defect, but it
means the floor of the ephemerality guarantee is "none" and the ceiling is server-controlled.

**The client-side check that exists is the SENDER's — CONFIRMED (disassembled).**
`WebChannelMessageBridge::verifyTTLAndBOR` = `WickrPro 0x140112030` (496 bytes). It fetches the
network settings, reads maxTTL via `0x1409cc3e0` (→`ebp`) and maxBOR via `0x1409cc3c0` (→`edi`):

```
0x140112076  8b0e     mov ecx, dword ptr [rsi]     ; the proposed ttl (in/out)
0x140112078  3bcd     cmp ecx, ebp                 ; ttl vs maxTTL
0x14011207a  7f04     jg  0x140112080              ; too big -> clamp
0x14011207c  85c9     test ecx, ecx
0x14011207e  7f66     jg  0x1401120e6              ; 0 < ttl <= max -> accept
             ... log "invalid ttl provided: <ttl>  max ttl is: <max>" ...
0x1401120e4  892e     mov dword ptr [rsi], ebp     ; CLAMP: ttl := maxTTL
0x1401120e6  85ff     test edi, edi                ; then the bor checks vs maxBOR and vs ttl
```

Note it **clamps rather than rejects**, and a ttl of 0 or negative is clamped *up* to maxTTL — so
this path cannot be used to make an outgoing message immortal.

**UNDETERMINED, and exactly what I could not establish.** I did **not** find where the *receiving*
client computes `Wickr_Message.destructTime` for an inbound message, and therefore cannot say whether
a receiver re-validates an incoming TTL against its own `maxMessageTTL`. Where I looked:

* the `Wickr_Message` INSERT/UPDATE statements (`0x143246c70`, `0x143246e20`) are `%1…%37`
  placeholder templates with column names bound at runtime, so the mapping is not readable from the
  string; the single builder is `0x14093e1d0`.
* the `destructTime` column-name literal `0x143238798` has exactly two references
  (`0x140005960`, `0x140006530`), both static QString initialisers.
* the TTL is a **conversation** attribute changed by a control path — `WickrSecureRoomMgr::changeTTL`
  (log string `0x143260e50`), signal/slot pair `2changeTTL(QString, int)` / `1slotChangeTTL(QString,int)`
  at `0x140e3c468` / `0x140e3c448`, and `ENVIRONMENT MANAGER: Changing TTL for VGROUPID: `
  (`0x14329a948`, used once, in `0x140b2ec50`).

⇒ the sharp question is **"who is authorised to change a room's TTL, and does the receiving client
verify that authorisation?"** That is a room/MLS authorization question, which this engagement
deprioritised deliberately. It is the right next step for anyone continuing scope 2.

## 2. What survives deletion

| artefact | measured | verdict |
|---|---|---|
| `temp\attachments\` | **15 files, 5,762,769 B, dated 2026-07-30 16:51–17:10, still present 2026-08-02.** Shannon entropy **7.716 – 8.000** bits/byte; **no format magic on any file** (no JPEG/PNG/PDF/ZIP/MP4/…); every file begins with a `00` byte, consistent with a versioned AEAD container | **ENCRYPTED — clean negative.** Attachments are *not* written to temp in the clear. But they are retained for days |
| `temp\preview\`, `temp\crl\` | **empty** | **clean negative** — no decrypted previews or thumbnails on disk |
| `cache\` | one empty `qtpipelinecache-…` directory | nothing |
| `metrics\metrics.sqlite` | 20,480 B, entropy **7.992**, **no `SQLite format 3` magic** | **ENCRYPTED — clean negative** |
| **SQLite WAL retention** | `wickr_db.sqlite` 179,200 B with a **790,224 B** `-wal` (4.4×); `metrics.sqlite` 20,480 B with a **4,120,032 B** `-wal` (201×) | **Superseded and deleted page images persist on disk until checkpoint.** Both DBs are encrypted, so this is defence-in-depth, not a plaintext exposure — but a `DELETE` does not remove the row's ciphertext from the volume |
| `metricsEventQueue` | **PLAINTEXT** — see §4 | **inconsistent with the two encrypted DBs beside it** |
| `logs\` | see §3 | **message and conversation identifiers survive the burn** |

## 3. What the logs contain — MEASURED

33 files, **22,213,342 bytes**, spanning 2026-07-29 23:27 → 2026-07-31 12:13. Largest single file
**15,975,228 bytes**. **Nothing is rotated or pruned:** no `maxLogFile`, `logRotat`, `rotateLog`,
`maxLogSize`, `logRetention`, `removeOldLog`, `cleanupLog`, `pruneLog` or `LOG_MAX` string exists
anywhere in `WickrPro.exe`.

Content scan over all 33 files — **occurrence counts only, values deliberately not recorded**:

| pattern | occurrences | files |
|---|---|---|
| message body tag (`bodyText`/`bodyData`) | **0** | 0/33 |
| attachment `filename` | **0** | 0/33 |
| `user@host`-shaped handle | **0** | 0/33 |
| room/convo *name* label | 2 | 1/33 |
| **`msgID`** | **1,613** | 15/33 |
| **`vGroupID`** (conversation id) | **134** | 15/33 |
| **UUIDs** | **2,273** | **33/33** |
| base64 blob ≥ 64 chars | 188 | 13/33 |

⇒ **No message content, no attachment names, no user handles — a genuinely good result.** But
**message identifiers, conversation identifiers and per-object UUIDs are written to disk in the
clear, in files that are never rotated or pruned, and the expiry reaper only deletes rows from the
encrypted database.** After a message burns, the fact of it — its `msgID` and the `vGroupID` it
belonged to, with a timestamp — remains readable on disk indefinitely.

## 4. `metricsEventQueue` — format characterised

168 bytes. A plaintext header line followed by base64-encoded protobuf records, CRLF-delimited:

```
metricsEventQueue|MetricsEvents|4.0.31
<base64 protobuf>
<base64 protobuf>
```

Decoded structure (values withheld except where structural):

```
field 1   varint  (0)
field 2   varint  epoch-milliseconds        e.g. 1785467280000 -> matches the file mtime
field 3   varint  (a count or duration)
field 4/5/6 varint
field <N> len-delimited   <-- N IS THE EVENT ID (110 and 111 observed)
    .1 varint
    .2 { .1 = epoch-milliseconds }
    .3 { .1 = a 20-character ASCII identifier   <-- VALUE WITHHELD
         .2 = varint }
```

**A 20-character ASCII identifier is stored here in the clear**, in the same directory as
`wickr_db.sqlite` and `metrics/metrics.sqlite`, **both of which are encrypted**. That inconsistency
is the finding; the identifier's meaning was not investigated further and is not recorded.

**Destination — UNDETERMINED.** `https://beta.astryb.people.aws.dev/api/RequestLogUpload` sits at
`WickrPro 0x143299340` with **exactly one code reference**, `0x14000ef60 @0x14000ef64`, a static
QString initialiser — so it is a hard-coded constant and not attacker-redirectable. **I did not
connect the metricsEventQueue drain to that URL or to any other.** Independently worth reporting:
`*.people.aws.dev` is an Amazon internal-developer domain and a `beta.` host of one is present in a
shipped release build.

## 5. The mic-PCM writer, re-audited — no gate exists, and the files are immortal

**Measured today: 28 files, 477,219,328 bytes**, all in
`C:\Users\mwgn-\AppData\Local\Programs\Amazon Web Services, Wickr\AWS Wickr` (the install directory,
which §4.4 of the disclosure already reports as user-writable). **Byte-identical totals to the Wave-9
measurement two days earlier ⇒ never rotated, never truncated, never deleted.**

**"Is there a gate an earlier pass missed?" — NO, and this is a second, independent method.** Wave 9
argued it from the branch count (ten conditional branches, zero unconditional jumps). Here is the
complete resolved import set of the 1,363-byte constructor `NPL 0x18015bb70`:

```
KERNEL32.dll!InitializeCriticalSectionAndSpinCount
api-ms-win-crt-stdio-l1-1-0.dll!fopen
api-ms-win-crt-stdio-l1-1-0.dll!fclose
api-ms-win-crt-runtime-l1-1-0.dll!_invalid_parameter_noinfo_noreturn
MSVCP140.dll!basic_ios<char>::basic_ios
MSVCP140.dll!basic_ostream<char>::basic_ostream
MSVCP140.dll!basic_streambuf<char>::basic_streambuf
MSVCP140.dll!basic_ostream<char>::operator<<(int)
MSVCP140.dll!basic_ostream<char>::~basic_ostream
MSVCP140.dll!basic_ios<char>::~basic_ios
```

**There is no environment-variable, registry, `GetPrivateProfile*`, command-line or configuration API
in the function at all.** There is no debug flag to find. There is also no `remove`/`DeleteFile` —
consistent with the measured non-deletion.

**Crash-report attachment — bounded negative (measured).** The string `aud_in` occurs **zero times**
in `WickrPro.exe`, in both ASCII and UTF-16. The only two `.pcm` references in `WickrPro.exe` are
`:/etc/test-48k-16-mono.pcm`, a Qt-resource test tone. The `--attachment=` literal
(`WickrPro 0x140e3fe80`) is referenced twice, both in `initBugTrackers` `0x14004c770`
(`@0x14004d22e`, `@0x14004d29d`), with a runtime-computed path and no `.pcm`/`aud_in` literal
anywhere in that 4,339-byte function. ⇒ **WickrPro cannot name those files, so they cannot be
attached by name.** **UNDETERMINED:** whether the runtime-computed attachment path could be a
directory that contains them — I did not resolve it. The other strings in that function
(`crashpaddb`, `crashpad_handler`, `.exe`, `--no-rate-limit`, `Pruned`, `crash reports`,
`client.state`, `session.id`) are consistent with the attachment being crashpad's own state, not
audio.

---

# What a next session should pick up

1. **Field 7's sink** — identify the class at `Parser complete+0x118` and read vtable slot `+0x18`.
   One function identification decides the last open field. Everything else in scope 1 is closed.
2. **Receive-side `destructTime`** — find where an inbound message's `destructTime` is computed and
   whether it is re-validated against the receiver's `maxMessageTTL`. Then the room-TTL
   authorization question behind `WickrSecureRoomMgr::changeTTL`.
3. `0x180144410`'s caller — does the peer-poisonable decoder loss statistic reach rate control or the
   metrics upload?

---

# ██ ADDENDUM — F4c: the PDF preview path, taken from inventory to execution ██

Added after the scope-1/scope-2 work above, at the operator's direction. Tooling in `scratch/w13/`:
`codecver.py`, `imgbatch.c` + `buildimgbatch.bat`, `getcorpus.py`, `sweep.py`.

## 1. The harness — it makes WickrPro's exact call, and cannot drift from the shipped build

`imgbatch.exe` resolves six entry points **by exported mangled name out of the shipped DLLs** (no Qt
headers, no import libraries) and issues:

```c
QImage img;                                     /* ??0QImage@@QEAA@XZ                 */
img.loadFromData(QByteArray(bytes, len), NULL); /* ?loadFromData@QImage@@QEAA_N...    */
```

which is the call at `WickrPro 0x140c1517a`, with `format = NULL`. Because the format is sniffed,
one harness exercises the entire attacker-selectable menu at once.

It is **resumable**: the index and path are written to a progress file *before* each decode, so a
crash identifies its own input and `sweep.py` restarts at index+1. A crash is a data point, not the
end of the run.

## 2. ★ The delivery chain is now EXECUTED, not inferred

```
[+] shipped Qt6Core/Qt6Gui loaded, 6 entry points resolved
  corpus\t.pdf     448 B  loadFromData=true isNull=false
```

Raw bytes beginning `%PDF-`, handed to `QImage::loadFromData` with `format = NULL`, produced a
non-null `QImage`. That means the sniffer → `imageformats\qpdf.dll` → `Qt6Pdf.dll` → **PDFium** →
raster chain **ran on the shipped binaries**. This was previously the weakest link in §4.3's
argument and it is now demonstrated rather than reasoned.

15 real PDFium regression PDFs (`bug_440132`, `bug_481_*`, `bug_493126*`, `bug_583804`, `bug_651304`,
`bug_668762`, `bug_691967`, `bug_86459`, `bug_880920`, `bug_883026`, `bug_898443`) also decoded
cleanly — expected, since all of those predate the shipped build's own fix level.

## 3. The build date, which is what makes the n-day case arithmetic rather than inference

```
Qt6Pdf.dll             PE TimeDateStamp 2025-09-17 13:01:40 UTC
imageformats\qpdf.dll                    2025-09-17 13:01:56 UTC
Qt6WebEngineCore.dll                     2025-09-17 12:45:48 UTC
qtiff.dll                                2025-09-17 06:52:46 UTC
Qt6Gui.dll                               2025-09-17 01:44:47 UTC
WickrPro.exe                             2026-07-13 21:52:58 UTC   <- the app is 10 months newer
```

Six distinct, monotonically ordered values across one working day ⇒ genuine timestamps, not
`/Brepro` content hashes. **A binary linked 2025-09-17 cannot contain a fix written in 2026.**

## 4. A named post-build defect with the exact diff — `eaf8e95e6`, JBIG2, 2025-11-17

```cpp
   pGRRD->GRW = ri.width;
   pGRRD->GRH = ri.height;            /* reference bitmap declared as the REGION's size */
   ...
-  pGRRD->GRREFERENCE = page_.get();                                    /* SHIPPED BUILD */
+  page_subimage = page_->SubImage(ri.x, ri.y, ri.width, ri.height);
+  pGRRD->GRREFERENCE = page_subimage.get();                            /* fixed 2025-11-17 */
```

Bug 461414279. **Deliberately not overclaimed:** the commit message frames this as spec conformance
("Preview.app, Acrobat Reader, poppler all agree"), and `CJBig2_Image::getPixel` carries internal
bounds checks, so this may be render-incorrect rather than memory-unsafe. Establishing which needs
the corpus test (the commit says "The test will be in the corpus repo") or a hand-built PoC.

JBIG2 took a burst of fixes in the two months after the shipped build date — `eaf8e95e6`,
`2a230b8e7`, `dbfa29d16`, `a4c4d0ad1`, `193e11268` ("Undo incorrect arithmetic decoder change"),
`42de689c9` — and JBIG2 is one of the two filters with the worst memory-safety history in the format.

## 5. Corpus sweep — status

`getcorpus.py` walks `pdfium_tests` and `pdfium/testing/resources` (gitiles blocks history for
anonymous users, so the whole corpus is taken rather than date-filtered) and `sweep.py` runs it.
Result to be recorded here when the sweep completes.

**Coverage caveat to carry:** a regression corpus contains reproducers for *fixed* bugs, and most of
this corpus predates 2025-09-17, so most of it cannot crash this build. The yield comes from the
subset added after that date, which cannot be isolated without history access.

---

# ██ ADDENDUM 2 — F4f: an out-of-bounds write, executed against the shipped PDFium ██

Tooling: `scratch/w13/{imgbatch,jpxprobe,aaprobe,pmprobe,pdffuzz}.c`, `walkfix.py`, `pdfiumsurface.py`,
`findglyph.py`, corpus in `corpus_all/` (620 PDFs) and `jpx3/` (the PoC).

## The method that worked, stated so it can be reused

Gitiles blocks anonymous **history** pages, but serves **per-commit metadata** (`+/<sha>?format=JSON`,
which carries the message, the parents AND the `tree_diff`) and **raw file content at any SHA**. That is
enough to reconstruct history by walking parents by hand. Combined with Chromium's `DEPS` at a release
tag (which pins `pdfium_revision`), the chain is:

```
CVE -> Chrome fixing version -> chromium/src DEPS at that tag -> pdfium_revision
    -> gitiles per-commit JSON -> walk parents for the [Mxxx] cherry-picks
    -> fetch the changed file at the fix and at its parent -> diff
    -> verify presence/absence of the added check in the shipped DLL
```

**The `chromium/pdfium` GitHub mirror stopped syncing 2025-11-19** and is useless for 2026 fixes. An
earlier note in this file citing "32 commits to core/fxcodec since 2025-09-17" was bounded by that mirror,
not by the present day; corrected here.

## Per-CVE verdicts

| CVE | upstream fix | component | verdict |
|---|---|---|---|
| **CVE-2026-2648** | `004b476195` `[M145] Redo: Fix indexing in opj_j2k_read_sod()`, `Bug: 477033835` | OpenJPEG | **REACHABLE, OOB WRITE EXECUTED** |
| CVE-2026-4455 | `bccc616f83` `[M146] …k8bppmask and 3 byte constant` | FreeType glyph copy | code present; precondition `FT_PIXEL_MODE_MONO` never reached (0 of 18,521 glyphs) |
| CVE-2026-6306 | `da11aad230` libtiff / `b34626f5fd` Little CMS | libtiff / lcms | **NOT REACHABLE** — libtiff absent; lcms present but no `/ICCBased` handler; and 255⁴ < 2³² so the lcms overflow needs ≥5 channels, which `/ICCBased` cannot express |
| CVE-2026-6361 | `e5bafd3be5` `CFX_PSRenderer::DrawDIBits` | `core/fxge/win32` PostScript | **NOT REACHABLE from a preview** — print path; matches NVD's "specific UI gestures" and `AC:H` |

## The demonstration

`opj_j2k_read_sod` = `Qt6Pdf 0x18025c540`. No bound on `current_tpsno`, no NULL test on `tp_index`:
`0x18025c6d6 mov [rcx+rdx*8+8], r9` and `0x18025c6f5 mov [rcx+rdx*8+0x10], r8`.

Trigger: a **valid TLM marker** puts `read_sot` on the `if (!m_tlm.m_is_invalid) { /* do nothing */ }`
branch, where `current_tpsno = TPsot` is assigned but `tp_index` is never grown. `TNsot = 0` keeps the TLM
valid and keeps `m_nb_tile_parts` zero so the "TPSot not valid" guard is skipped; TPsot walks 0,1,2,… to
satisfy ISO 15444-1 A.4.2.

Measured on the shipped DLLs through WickrPro's own `QImage::loadFromData(bytes, NULL)`:

```
tp_index allocation : 1 entry = 24 bytes
stores executed     : 256 / 256
offsets             : +8, +32, +56, ... +6128     (>= +32 is out of bounds)
values              : 0x67 .. 0x1651              (codestream offsets)
no crash: loadFromData = true, exit 0
```

**Limit on severity, stated honestly.** Both values are 64-bit stores of **zero-extended 32-bit**
quantities, so a pointer cannot be placed; the direct vtable/function-pointer routes are closed. What
remains is a length/capacity overwrite, and **what lies at those offsets was not surveyed.** No crash, no
IP control, and the PoC was never sent over a live Wickr message.

## Corrections made during this work — all mine

* An in-process fuzzer ran 130,031 iterations with **0 crashes**; the real coverage was **3,428**. Its
  `__except` handler skipped both destructors, leaking the input buffer on every exception, so after the
  first genuine OOM every later iteration failed at its first allocation and exercised no codec. It also
  wrote one artefact per exception and filled the volume. Nearly reported as a negative. Fixed.
* "The CLUT table data is written in bulk with full attacker content control" — **wrong**. The copy is
  bounded by `n`; the risk is the interp params/table size mismatch, most plausibly a read.
* "`acsp` is absent from Qt6Pdf, so lcms profile parsing is dead" — **wrong**, it is an *immediate*
  (`cmp edx, 0x61637370`), not a string. The correct negative is the missing `/ICCBased` handler.
* "CVE-2026-2648 gives a 32-bit-wide offset" — **wrong**, TPsot is a **1-byte** SOT field, so the reach is
  255 × 24 + 16 = 6,136 bytes, not 2³² × 24.
