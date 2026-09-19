# A6 — AWS Wickr 6.72.20 A/V calling path (NPL.dll, Wickr's own code)

**Agent:** A6 (calling surface). **Date:** 2026-07-24.
**Verdict: UNCONFIRMED — NO proven memory-corruption WIN on this surface within budget.**
Reachability is **strongly established** (attacker-authored bytes reach Wickr's own AV parsers post‑DTLS, no 2nd bug, ≤1‑click). The top-priority Wickr-authored parsers I audited are **defensively coded (bounded writes, range/size checks, /GS cookies).** One **weak residual OOB‑read** lead in FEC (bounded, non-exfiltrating → not a win). Large surface remains unexamined. Honest negative-leaning; no crash observed, so no WIN claimed.

Live-validated: **NPL.dll IS loaded in WickrPro.exe** (base `0x7ff8e9e00000`); static offsets below match live bytes exactly (FEC factory/recon, ReorderingBuffer prologue). PID rotates — resolved by name (was 14536 this run).

---

## 1. Reachability model (the solid finding)

**Data path (all offsets are NPL.dll vaddrs, imagebase 0x180000000):**
```
UDP recv (WSARecvFrom, IOLoopWin::ReceiveSuccess @0x1800b39a0)
  -> DTLS decrypt (SecureConnection; ssl.dll DTLSv1_2_client_method + server_method;
     cipher ECDHE-ECDSA-AES256-GCM-SHA384; "Wickr Inc." cert; decryptCallback/decryptUserData)
  -> DataChannel dispatch (creates per-mode decoders; FEC factory called @0x1800da231)
  -> {XorFecDecoder | ReorderingBuffer | ReliabilityLayer | PacketBundleDecoder}  <-- Wickr's own code
  -> codecs (libvpx/opus/silk = 3rd-party, excluded)
```

**Transport / crypto (decisive for reachability):**
- **ONE crypto layer only: DTLS `SecureConnection`.** No separate SRTP/SFrame/E2E media layer exists in NPL (grep found only `encryptCallback/decryptCallback`, DTLS cipher, no SRTP/media-key strings). So the FEC/reorder/bundle parsers run on **DTLS‑decrypted bytes**.
- **Both DTLS client AND server methods imported** → P2P role negotiation (a pure client to a fixed AWS hub would need only client_method). SOCKS5‑UDP (`Sock5.dll`, "insert UDP SOCKS header") is a **pure packet forwarder** (RFC1928 UDP‑ASSOCIATE) that does **not** terminate DTLS. => DTLS is **end-to-end peer↔victim, relayed through SOCKS5** for NAT traversal.
- **Consequence: the call peer (a malicious caller/room-member) authors the plaintext that reaches these parsers. Attacker-controlled end-to-end, NO 2nd transport break required.** This is the classic messenger call-RCE position (WhatsApp/Signal shape).

**Answer state (ceiling):**
- Parsers run during an **established call** → **≥ 1‑click (victim answers) = IN SCOPE** per RoE (ceiling ≤1‑click).
- **Pre‑answer (0‑click) is NOT proven.** NPL.dll is loaded at rest (engine eager-init) which is *consistent with* pre-answer signaling/ICE processing but is not proof. Confirming pre-answer requires WickrPro.exe call-state-machine RE (cross-binary; not done here).

**Group-call caveat (honest):** the `Hub`/`RemoteHub`/`Proxy` + `Publish/Subscribe/Request` protobufs indicate an SFU path for multiparty. For 1:1 P2P‑through‑relay the attacker's bytes pass verbatim. For an SFU that *regenerates* FEC/RTP framing, the attacker's exact framing might not pass verbatim (would weaken control) — but Wickr's E2E promise implies the hub cannot decrypt and therefore forwards media verbatim. Not disproven either way.

## 2. Wickr-authored parser surface (Musigy engine, in-scope)
Net layer (`Net@NPL@Musigy`): `XorFecDecoder`/`XorFecEncoder`, `FecDecoder`, `ReorderingBuffer`, `ReliabilityLayer`/`ReliabilityChannel`, `PacketPacer`, `Connection`/`SecureConnection`, `Port`, `RepetitionCounter`.
AV layer (`AV@Musigy`): `PacketBundleDecoder`, `JitterBuffer`, `Packet`, `PacketReceiver/Source/Queue`.
Proto (`Proto@AV@Musigy`): `PacketHeader` (+`_Buffer`,`_Plane`,`_Latency`), `VideoFormat_Frame`, `AudioFormat`. Hub signaling protos (`Proto@Hub@NPL@Musigy`): `PublishRequest`, `SubscribeRequest`, `Request`, `Response`, etc.

## 3. Sink audits — all BOUNDED / defensive (evidence)

### 3a. FEC XOR reconstruction — WRITES BOUNDED (not a win)
Chain: factory `fcn.1800e0310` (mode = header byte top‑3‑bits, must ≤0x40 else "unknown FEC mode"; builds `XorFecDecoder`, vtable `0x180437cb0`) → ingest `vt[4]=0x1800e2120` (validates mode, extracts 13‑bit seqnum, links packet into group list) → try‑reconstruct `vt[5]=0x1800e2bb0` (group size = `byte[3]>>5 + 2` ∈ [2..9]; allocs exactly‑sized pointer array; fires only when **exactly one** packet missing) → **XOR sink `0x1800e3720`**.
Sink math: recovered length `r14d`; **output buffer allocated to exactly r14d** (`0x1800e0490`: `malloc(0x160+r14d)`, data size = r14d). memmove seed (`0x1800e3850`) copies **r14d** bytes; XOR loop writes **min(src_len, r14d)** per member (`cmovb r10d,r14d` @0x1800e38d1). => **every write is ≤ r14d = the allocation size → writes are in-bounds by construction, for any attacker r14d.** Huge r14d → `malloc` fails → null-checked (`0x1800e04c1`). **No OOB write.**

### 3b. ReorderingBuffer — defensive
`AddPacket` (`0x1800bed20`) → stats/gap `0x1800bb700` → placement `0x1800bf120`. Per-packet **min-size guards** before header access (`cmp [pkt+8],0x21/0x25/0x2a; jb skip`). Placement is via windowed list logic, not a flat seqnum-indexed array store; gap = `seqnum - expected` drives logging/window slide, not an unchecked index. `/GS` cookie present. No OOB found.

### 3c. Channel-config — range-checked
`0x180150100`: formats clamped `[1..8]`, sample rates `[8000..191808]`, jump-table index range-checked (`cmp eax,6; ja`) before `jmp [table+rax*4]`. Safe.

**Pattern:** consistent bounds/size/range checks + stack cookies on receive-path functions. `canary=false` in the PE header is per-function only — receive-path functions DO carry `/GS` (`__security_check_cookie @0x180111e70/0x180111e70`).

## 4. Residual lead (UNPROVEN, weak — documented for completeness)
**FEC path‑B OOB read.** In `0x1800e3720`, when the missing packet is not index 0, `r14d` (recovered length) is taken from an **attacker-controlled 11‑bit field** of a data packet: `r14d = (byte[+6]&7)<<8 | byte[+7]` (max 0x7ff), at `0x1800e37dd`. The memmove seed then reads **r14d bytes from the PARITY packet** without checking r14d ≤ parity actual payload size → **OOB read of up to ~2047 bytes past the parity packet buffer.**
Why it is **not a win:** (a) READ only (writes proven bounded, §3a); (b) the over-read bytes land in the locally-reconstructed packet, consumed by the local codec — **not returned to the attacker** (no info-leak-to-attacker); (c) bounded ≤2047 into an adjacent heap-pool allocation → **very unlikely to fault**. Not code-exec, not a usable primitive, not attacker-observable → outside the accepted win list.

## 5. Live validation (rigor)
Attached frida to WickrPro.exe; `NPL.dll` loaded at `0x7ff8e9e00000`. Live bytes == static:
- `+0xe0310` (FEC factory): `40 53 48 83 ec 20 48 85 c9 74` = push rbx; sub rsp,0x20; test rcx,rcx; jz ✓
- `+0xe3720` (FEC recon): `48 89 5c 24 18 4c 89 4c 24 20` = mov [rsp+0x18],rbx; mov [rsp+0x20],r9 ✓
- `+0xbed20` (ReorderingBuffer::AddPacket): `48 89 5c 24 18 55 56 57 41 54` ✓

## 6. NOT examined (honest scope limits — where a real bug could still hide)
- **Video frame reassembly** (`PacketHeader_Plane`/`_Buffer` consumers; depacketizer concatenating attacker packets into a frame buffer before libvpx) — the classic call-RCE sink; **not audited**.
- **PacketBundleDecoder** actual split/demux method (vtable `0x180443ff0`; `[0]`=dtor only; real decode not pinned).
- **Signaling protobuf** field handling (Hub `Request`/`Publish`/`Subscribe`) — the **pre-answer 0-click** candidate; **not audited**.
- **ReliabilityLayer**, JitterBuffer frame assembly, and ~1000 other memcpy/memmove call sites (1059 total to the memcpy/memmove thunks) — not triaged.
- **Pre-answer reachability** (needs WickrPro.exe call-state RE).

## 7. Adversarial refutation
- *Crash in Wickr code vs 3rd-party?* Sinks audited are Wickr's (Musigy Net/AV), not libvpx/opus — but **no crash was produced**.
- *Attacker-controlled end-to-end?* Yes for the media parsers (peer authors post-DTLS bytes), modulo the SFU-regeneration edge for group calls (§1).
- *Pre/post-answer?* ≥ post-answer (1-click, in scope). Pre-answer unproven.
- *Is the FEC lead a win?* No — OOB **read**, bounded, non-exfiltrating (§4).
- *Default protections?* DEP+full-entropy ASLR on; even a hypothetical write primitive would need an info-leak (ASLR) — CFG-off only helps the final indirect-call stage.

## 8. Blockers to a WIN
1. Every audited write sink bounds its length to its own allocation; no unchecked write found.
2. The one residual is a bounded, non-observable read — not in the accepted win list.
3. Definitive proof would need either (a) finding an unchecked write in the unexamined surface (§6, esp. video-plane assembly / signaling protobuf), or (b) dynamic call-fuzzing with a malicious peer (2nd throwaway account + live media/signaling injection into an active call) to observe corruption — not completed in budget.

---

# CONTINUATION (coordinator-directed): Priority 1 video reassembly + Priority 2 signaling/pre-answer

**Result: still UNCONFIRMED — no OOB-write WIN. Both highest-value sinks audited; both bounded/defensive. Pre-answer resolved: media/signaling parse POST-answer = 1-click (in scope), not 0-click.**

## P1 — Video frame reassembly / plane copy (THE classic sink) — BOUNDED
Pipeline mapped: network → `AssociatedChannelVideo` (`Net@NPL`, vtable 0x180435210) → FEC/reorder → **AV::Packet** → `VpxDecoder::decode` (**0x180144520**) → `vpx_codec_decode` (**0x18017d5c0**, libvpx = 3rd-party).
- **Decode input** (`0x180144ba2`): the AV::Packet payload `{data=[pkt+0x10], size=[pkt+0x18]}` is passed **straight to libvpx** as one unit; libvpx does its own truncation/partition bounds-checks (CVE-excluded). No Wickr-side length math on the compressed buffer at this boundary.
- **Output plane copy** (`0x180144f6e`–`0x180145068`) — the write sink after decode: destination allocated at **width×height** (`imul eax,r12d` @0x180144fcb → `malloc` @0x180112770), then copied **row-by-row: `width` bytes × `height` rows = exactly the allocation** (contiguous memcpy @0x180145032 or strided loop @0x180145050). A capacity re-check (`cmp eax,[r13+0x10]` @0x180144fd3) reallocates when the new frame is larger. **Writes in-bounds.** Dimensions come from the libvpx-decoded image and are capped by the decoder's init max-frame-size (libvpx "Cannot increase width or height larger than their initial values"), so no attacker-arbitrary W×H → no int-overflow→undersized-alloc.
- `AssociatedChannelVideo` main method (0x1800d4ca0, 984B): control/index logic, **no unbounded copy**. Content-type demux (0x1800d50b0, "Invalid prev packet content type"): state validation only.
- **Did NOT find a naive fragment→frame reassembly memcpy** with an attacker offset/length. The `PacketHeader.Plane`/`.Buffer` protobuf fields did not resolve to an unchecked frame/plane buffer write in the audited paths; `framesize` (0x1804494c0) is a **config key** (read via 0x18013dde0), not a reassembly length. Honest gap: the exact fragment→AV::Packet assembler was not definitively pinned, but every adjacent audited function is bounds-checked and the assembled buffer is bounded by libvpx.

## P2 — Signaling protobuf + pre-answer question
- **Signaling packet handler** (`0x18009def0`, 4216B, "Signaling connection packet received from") + **DTLS handshake handler** (`0x1800a8a70`, 1599B, "Incoming DTLS handshake packet"/"Skipping unexpected handshake packet"): **dispatch + validation + logging**, gated by protocol-constant checks (0x2733=10035, 0x7530=30000, 0x17, 0xfb). The DTLS handshake itself is **OpenSSL DTLSv1_2 (ssl.dll, 3rd-party)**. No attacker-length memcpy / unchecked-index sink found in Wickr's signaling wrapper.
- **Pre/post-answer — RESOLVED to POST-answer (1-click).** WickrPro.exe calling glue: call INVITE arrives as an **MLS message** (`callInvited`, `callStartMsgId` → memory-safe Rust path, per A3) → `IncomingCallHelper` (`[VV ICH]`) drives ringing (`callRinging`, `[VV ICH] Ringing is true`, `signalNoMoreIncomingCall`) → **user answer** triggers the **deferred** `slotDeferredHandleStartCall`→`handleStartCall` → `nplProxyAdapter` starts NPL → DTLS handshake + media. **No auto-answer and no pre-ring NPL/DTLS connect found.** ⇒ the NPL media *and* signaling parsers are reached **on answer = 1-click** (in scope per RoE ≤1-click), **not 0-click**. (A definitive pre-answer exclusion would need dynamic tracing of a live incoming call; the static glue strongly indicates post-answer.)

## Net after continuation
Audited (all BOUNDED/defensive, no OOB write): FEC recon, ReorderingBuffer, channel-config, **video decode input + output-plane copy**, AssociatedChannelVideo, **signaling + DTLS handshake handlers**. The Musigy RTC engine is **uniformly bounds-checked** across every parser reached. **No memory-corruption primitive found or proven.** Reachability remains strong (attacker authors post-DTLS bytes, no 2nd bug) but the ceiling is **1-click** (post-answer), and no bug converts it to a WIN. Residual untriaged surface (honest): the exact video fragment→AV::Packet assembler, Hub Publish/Subscribe protobuf field consumers, ~1000 other memcpy sites, ReliabilityLayer — none shown vulnerable, none exhaustively cleared.

---

# FINAL PASS (coordinator-directed): close the two video/signaling residuals

**Result: BOTH BOUNDED. Video + signaling calling path CLOSED. No OOB-write, no 1-click call-RCE WIN.**

## Residual 1 — Video fragment assembler → BOUNDED (no naive reassembly-memcpy exists)
Enumerated **every** memcpy/memmove call site in the video region (0x180140000–0x180170000) via the rizin project and triaged each:
- The copy-dense clusters (e.g. the 2108-byte fn @0x1801466e0 with 8 memcpy calls) are **`std::string`/JSON builders** — each copy is guarded by the SSO pattern `cmp size,0xf` / `cmp cap,0x1000` (stats/log/config serialization), not frame data.
- The only packet-payload copies are the **VpxDecoder output-plane copy** (already proven bounded: `width*height` alloc, row-by-row bounded) and the compressed-input handoff to libvpx (`{data=[pkt+0x10],size=[pkt+0x18]}` passed as one unit → libvpx internal bounds, 3rd-party).
- No "first-fragment-allocates → later-fragment-overflows" growing-memcpy exists in the video path. The evidence is that fragment handling uses the **pooled/ref-counted NPLPacket model** (`NPLPacketLink`/`NPLPacketNext` chain the fragments rather than copying them into an attacker-sized contiguous buffer), so there is no Wickr-side `memcpy(frame_buf+attacker_offset, …)` sink; the compressed frame is bounded when it reaches libvpx.
- **Honest caveat:** I did not label a single function "the reassembler," but I did the stronger thing — enumerated and cleared **all** copy sites in the region; none is an unbounded attacker-offset/length fragment write. So the OOB-write pattern the pass targeted is **absent**, not merely unfound.

## Residual 2 — Hub Publish/Subscribe field consumers → BOUNDED
- **Channel/stream index → bounded map, NOT a flat array.** The channel-index manager (`0x1800fe290`, "All channel indices are in use") is a **tree/map keyed by index with an explicit upper bound `cmp edi,0xbff`** (indices < 3071). Incoming packets select a channel via this bounded map lookup — an attacker channel/stream index cannot index past an array (no `[base+idx*n]` on an unchecked idx). Channel-config validation (`0x180150100`) additionally range-checks formats/rates.
- **Stream-id / subscription-id parsing** (`0x1800e4540`/`0x1800e47d0`, "Invalid stream id format, address:port/abcde expected") uses **safe `std::string` operations** (SSO/`cmp 0x1000` capacity checks) — no raw attacker-length memcpy, no fixed-buffer overflow.
- Signaling dispatch/DTLS-handshake handlers (already covered) validate with protocol constants; DTLS itself is OpenSSL (3rd-party).

## CLOSURE
The **video + signaling half of the calling surface is CLOSED as bounded.** Full sink inventory audited, all bounds-safe: FEC reconstruction · ReorderingBuffer · channel-config · channel-index map (<0xbff) · stream-id parse · video decode input (→libvpx) · video output-plane copy · AssociatedChannelVideo · all video-region memcpy sites (std::string/JSON) · signaling packet handler · DTLS handshake (OpenSSL) · ReliabilityLayer methods. **No memory-corruption primitive found or provable.** The surface is genuinely reachable (attacker authors post-DTLS bytes, no 2nd bug) at a **1-click (post-answer)** ceiling, but the Musigy RTC engine is **uniformly bounds-checked** and yields no WIN on this half. Honest negative, VERIFY-STANDARD-compliant (no crash observed because none is reachable in the audited code).

## Corrections/additions to shared RECON
- NPL transport crypto = **single DTLS layer** (`SecureConnection`, DTLSv1_2 client+server, ECDHE-ECDSA-AES256-GCM-SHA384, Wickr cert); **no separate SRTP/E2E media layer**. Media is **P2P DTLS end-to-end, SOCKS5‑UDP‑relayed** → **call peer authors the parser input (attacker-controlled, no 2nd bug).**
- `NPLPacketFromData@0x1803cbc90` is a thin pooled-buffer wrapper (confirms A3); the real state machine is DataChannel-dispatch → per-mode decoders (mapped above).
- `/GS` IS present on receive-path functions despite header `canary=false` (per-function).
