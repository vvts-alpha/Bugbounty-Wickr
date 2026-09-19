# RECV-ROUTING GROUND TRUTH — FINAL (lead-verified 2026-07-30)

**Question:** can a malicious call peer drive a stock victim to process an ODD-height RAW chroma
plane at `WickrPro 0x1406e95d0` (the heap OOB write)?
**Answer: YES — remotely reachable by any authenticated participant in the call, with a SINGLE
crafted media packet. No negotiation, no call-setup step, no victim action.**

Every load-bearing instruction below was disassembled by the lead against the shipped binaries
(not taken from a subagent). Two earlier wrong conclusions are recorded at the bottom.

---

## The mechanism: `kind` is a protobuf field re-parsed from EVERY inbound packet

The parser holds a **persistent `Musigy::AV::Proto::PacketHeader` object** (pointer at
`parser+0x158`, allocated once in the ctor `0x18011e1b0`). The **pointer never changes** — but the
**object is `Clear()`ed and re-parsed from the peer's wire bytes on every packet**:

```
AV::Parser::onPacket  NPL 0x18011fce0
  0x18011fd4c  mov r8d,[rsi+0x88]        ; wire length
  0x18011fd53  mov rdx,[rsi+0x80]        ; wire bytes (post-decrypt)
  0x18011fd5a  mov rcx,[rdi+0xe8]        ; == parser+0x158, the PacketHeader object
  0x18011fd61  call 0x1801090d0          ; ParseFromArray:  [vt+0x18]=Clear, [vt+0x48]=MergePartial
  0x18011fd68  jne 0x18011fdca           ; parse ok -> dispatch
  0x18011fdca  mov rdx,[rdi+0xe8]
  0x18011fdd1  mov ecx,[rdx+0x64]        ; kind -- STRAIGHT OFF THE WIRE
  0x18011fdd4  sub ecx,1 ; je -> 0x18011ed00   (kind1 = Format)
  0x18011fddd  sub ecx,1 ; je -> 0x18011ef70   (kind2 = RAW PLANE PASSTHROUGH)  <<<
  0x18011fde6  cmp ecx,1 ; je -> 0x18011ea60   (kind3)
```
Descriptor RTTI = `.?AVPacketHeader@Proto@AV@Musigy@@`; its vtable `0x180442428` has
`+0x18 = 0x18013b350` (Clear), `+0x48 = 0x18013b930` (MergePartialFromCodedStream). CONFIRMED.

**`kind==2` is an explicitly whitelisted wire value** — `PacketHeader::MergePartialFromCodedStream
0x18013b930`, field 1 (tag `0x08`, varint):
```
  0x18013ba51  sub ecx,1 ; je 0x18013ba92     ; accept 1
  0x18013ba59  sub ecx,1 ; je 0x18013ba92     ; accept 2   <<<
  0x18013ba5e  cmp ecx,1 ; je 0x18013ba92     ; accept 3
  0x18013ba92  or  dword [r14+0x10],0x800     ; has-bit
  0x18013ba9a  mov dword [r14+0x64],edi       ; kind := PEER VARINT
```

**Plane geometry is peer-controlled and unvalidated** —
`PacketHeader_Plane::MergePartialFromCodedStream 0x18013a450`:
```
  0x18013a5a1  mov dword [r14+0x18],edx   ; plane field 1 = stride
  0x18013a549  mov dword [r14+0x1c],edx   ; plane field 2 = HEIGHT   (no range/parity/cap check)
```

**The kind==2 handler copies it verbatim into a fresh frame, no decode** — `0x18011ef70`:
```
  0x18011efac  test byte [rdx+0x10],1     ; has-bit 0 (string field 9, tag 0x4a) selects this branch
  0x18011effa  call 0x180135ea0           ; allocate output frame
  0x18011f012  lea r8,[rax+0x70]
  0x18011f016  cmp rdx,0x20 ; jge         ; plane index bound (4 planes) -- the ONLY bound
  0x18011f025  mov eax,[rcx+0x18] ; mov [r8-0x10],eax   ; stride -> Frame+0x60[i]
  0x18011f02c  mov eax,[rcx+0x1c] ; mov [r8],eax        ; HEIGHT -> Frame+0x70[i]   <<<
  0x18011f03d  cmp r9d,[rdi+0x20]         ; plane count, also from wire
```

Downstream (previously CONFIRMED): `NPLAVPacketGetDescriptor` copies `Packet+0x70` → `desc+0x38`;
`WickrPro 0x14013e430` reads it as height (`0x14013e50c mov ebx,[rbp+0x98]`) and forwards it as a
plain dword via `0x14011b6b0` → `0x1406e95d0`, where `alloc=(H>>1)*stride` vs `copy=(stride*H)>>1`
⇒ **heap OOB write of ~stride/2 bytes for odd H**. No even-rounding, no cap, no odd rejection
anywhere on the path.

## What the attacker must send

1. **Be an authenticated participant in an active call** with the victim — the header blob at
   `packet+0x80/+0x88` is only populated after `AV::CryptProxy` decrypts, so the attacker must hold
   the call's media key. **This is the only precondition** (threat model = malicious call peer, P2 —
   NOT an off-path/unauthenticated attacker).
2. **One video media packet** whose serialized `Proto::PacketHeader` carries:
   - **field 1 (varint) = 2** → raw-plane passthrough
   - **field 2 (repeated Plane) ×3**: sub-field 1 = stride (even), **sub-field 2 = ODD height**
   - **field 9 (tag `0x4a`) must be ABSENT** — see the branch correction below
   - **real plane payload**: `Σ stride_i × height_i` bytes (the branch is size-checked)
3. Nothing else — no Format message, no renegotiation, no codec agreement, no victim-side setup.

### ⚠ Branch correction (lead-verified 2026-07-30) — which branch actually WRITES
`0x18011efac test byte [rdx+0x10],1 ; je 0x18011f0a8` selects on **has-bit 0 = string field 9**:
- **has-bit SET (field 9 present) → `0x18011efb6`**: builds a NEW frame via `0x180135ea0` from the
  field-9 string and copies **only geometry** into `Frame+0x60/+0x70` (`0x18011f025..0x18011f02f`).
  It never fills the U/V plane data pointers ⇒ the downstream chroma `memcpy` source is NULL ⇒
  **access violation on READ at `0x1406e9849` before any OOB write. DoS only — NOT the finding.**
- **has-bit CLEAR (field 9 absent) → `0x18011f0a8`** → plane loop at `0x18011f180`: reads stride
  `[rcx+0x18]` and height `[rcx+0x1c]`, computes `imul r10d,eax` (= stride×height) and **bounds-checks
  the running offset against the real payload size** (`0x18011f1c0 cmp r10,[rbp+r14*8-0x78]`, else
  "Incoming packet is broken"), assigning real plane pointers into the payload. **This is the branch
  that produces the OOB write** — so the attacker must ship genuine plane bytes.
⇒ A metadata-only crafted packet yields a read-AV (DoS). **A genuine raw-I420 sender naturally takes
the correct branch**, which is why the sender-patch approach (publish raw I420 + odd chroma height)
is the right E2E vector.

## B2 (sender-side crafting) got much simpler
NPL's **own send serializer already has a kind==2 arm**: `AV::Serializer 0x18011d240` writes
`mov dword [rax+0x64],2` at `0x18011d5ab` when serializing raw planes. A sender-side injector only
needs to force that arm and set an odd plane height at the `+0x1c` field — far smaller than the
encryptCallback Packet-rewrite designs in earlier notes.

## Still NOT demonstrated (honest)
- **No end-to-end remote PoC has been executed.** All of the above is static, from the binaries.
- **INFERRED:** that Wickr's calling infrastructure relays the `PacketHeader` blob verbatim rather
  than re-serializing/normalizing it at a relay/SFU, and that a modified client can emit `kind=2` on
  the video track without a server-side sanity check.
- **Decisive test for the demo:** patch a *sender* to take the `0x18011d240` kind==2 arm with an odd
  plane height, call an instrumented victim, confirm the fault at `WickrPro 0x1406e95d0`.

---

## Errata — two wrong conclusions that were corrected (keep, to avoid repeating them)
1. **First workflow (wf_2915b7cb)** read `0x18011ef07 call [rax]` (edx=1) in the kind==1 Format
   handler as "activate the new descriptor". It is a **scalar deleting destructor** `0x18011c160`
   (`lea rbx,[rcx-0x10]; test dl,1; mov edx,0xC0; call operator delete`) that frees the temporary.
   The "two-stage Format-then-plane negotiation" recipe built on it was fiction.
2. **The lead's own correction** then concluded "mid-call in-band Format cannot switch the track ⇒
   possibly not remotely reachable". The supporting scan was *true but tested the wrong invariant*:
   nothing rewrites the **pointer** at `parser+0x158` — irrelevant, because the pointed-to protobuf
   **object is re-parsed in place from peer bytes every packet**. Scanning for pointer stores can
   never reveal that.
3. **Symbol retraction:** `0x18011ab30` is **NOT** an active-descriptor setter. It is the ctor of
   `.?AVCryptProxy@AV@Musigy@@` (vtables `0x18043e5a8`/`0x18043e600`, `new 0x248`, vbase `-0x190`;
   vs the parser's `0x18043ee88`/`0x18043eee0`, `new 0x260`, `-0x1a8`). Its `+0x158` holds the
   `decryptCallback` pointer from WickrPro's local config; its 4 callers are
   VideoHub(enc)/VideoHub(dec)/AudioHub(enc)/AudioHub(dec) — a dead end for this question.
4. **Also settled:** the peer-supplied-Format-blob-at-call-setup hypothesis is genuinely dead
   (`NPLAVNetSinkGetFormatBlob`/`NetSink`/`NetSource` are **not** in WickrPro's NPL import set;
   publish hardcodes `"vp8"` at `0x14014d59f`; subscribe passes only `destColorSpace=8` + callbacks)
   — it simply was never the mechanism that matters.

**Method lesson:** verify the crux instruction yourself before headlining a reachability verdict —
this question flipped twice on subagent readings before direct disassembly settled it.

## Provenance
Workflows `wf_2915b7cb-4aa` (first pass, partly wrong) and `wf_fcd08e51-cdd` (trace + WickrPro setup
+ adversarial refutation + verdict; refutation returned **NOT-REFUTED**). Final chain independently
re-disassembled by the lead: `0x18011fce0`, `0x1801090d0`, `0x18013b930`, `0x18013a450`,
`0x18011ef70`, vtable `0x180442428`, RTTI `Musigy::AV::Proto::PacketHeader`.
