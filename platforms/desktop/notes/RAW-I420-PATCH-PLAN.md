# RAW-I420 ODD-HEIGHT — SENDER-PATCH FEASIBILITY VERDICT

**Question:** Can a SENDER binary patch (plus the existing `PacketHeader_Plane` height-odd
patch) drive raw-I420 odd-height plane geometry to a victim WickrPro's sink at
`WickrPro 0x1406e95d0` over a real call?

**VERDICT: NO-GO** (for a legitimate WickrPro sender driven by a minimal binary patch).

**Killing blocker: #2 — raw-send is not graph-supported.** The legitimate send video graph is
encoder-only; it never populates or serializes `PacketHeader_Plane` messages, so no binary
"flip" patch on the sender can put odd-height raw plane protobuf on the wire. The existing
`PacketHeader_Plane` height-OR patch is inert on this path (matches the live VP8 null-result).

Blocker #1 (send codec selection) is patchable at a single clean site but is counter-productive —
flipping the codec string aborts transmission. Blocker #3 (receiver) is NOT a blocker: the receiver
imposes no clamp and no negotiation rejection and is fully reachable by any endpoint that can emit
raw plane protobuf.

Confidence: **High** at the NPL layer (three decisive anchors re-verified by the synthesizer, see
§Verification). **Medium-high** overall, because the app-level graph builder above
`NPLHubVideoPublish` in `WickrPro.exe` was not exhaustively traced (residual, documented in §Caveat).

---

## The exploit requires TWO independent things on the wire

Per the receiver analysis (rxclamp), to reach the `0x1406e95d0` overflow the wire must carry:

1. **`AV::Format.subtype = "I420"` (raw)** — so the receiver builds NO decoder and routes packets
   to the raw video handler `NPL 0x18011ef70`, which trusts wire plane geometry verbatim.
2. **A populated `PacketHeader_Plane`** with **odd `height` (field2, +0x1c)** and chroma
   **`stride` (field1, +0x18) > 0**.

Both must originate from the sender. The three blockers map directly to whether a legitimate
sender's graph, once patched, can emit each of these.

---

## Blocker #1 — Send codec selection: patchable site, but the patch breaks the path

- **Site (CONFIRMED, sendsel):** the outgoing codec is the compile-time literal `"vp8"`
  (`WickrPro 0x141d55400`), loaded at `WickrPro 0x14014d59f` (RVA `0x14d59f`, file offset
  `0x14C99F`), single code xref. Mechanically trivial to repoint.
- **Why flipping it fails (CONFIRMED, re-verified §V-1):** the NPL codec factory
  `NPL 0x180121430` gates on **string length == 3** (`cmp rdi,3 / jne`) before `strcmp "vp8"`
  (target `0x18043f6e8`) / `strcmp "vp9"` (`0x18043f6ec`); sibling `0x180122040` accepts len-4
  `"h264"`. `"I420"`/`"NV12"`/`"YUV420P"` match none → factory returns **NULL** → encoder factory
  aborts (`0x1801216a3 test rbx,rbx / je → xor eax,eax`) → `NPLHubVideoPublish` returns non-zero →
  WickrPro error branch → **nothing transmitted**.
- **Namespace note (CONFIRMED):** `"codec"` and the receiver's `"subtype"` are different key
  namespaces. `subtype2code` (`0x180146230`) maps raw names to a pixel code only for the *format
  subtype* field, never for *codec*.

**Result:** the codec string is not the lever. Leave `codec="vp8"` so the encoder is created and
packets flow at all.

## Blocker #2 — Raw-send graph: DECISIVE. No node emits plane geometry on send

This is what kills a minimal sender patch.

- **Send is encoder-centric (CONFIRMED, rawsend + sendsel):** the publish path builds a vp8/h264
  **encoder** (`NPL 0x1800edef0` reads encoder-only keys: `encoderBitrate`, `FPS`,
  `temporalScalability`, …). No raw / pass-through branch is selectable via `"codec"`, and an
  unmatched codec name tears down rather than falling back to raw.
- **The send packet serializer emits a single CODED buffer, never planes (CONFIRMED,
  re-verified §V-2):** NetSink's serialize handler reads a single data pointer `[rdi+0x80]`, size
  `[rdi+0x18]`, and w/h `[rdi+0x98]/[rdi+0x9c]`, then hands off downstream. There is **no plane
  iteration** and **no `PacketHeader_Plane` population**. Multi-plane packets (offsets `+0x60`
  stride / `+0x70` height) are a **receive-side** construct built by the deserializer
  `NPL 0x18011d240` (RX method of the NetSource serializer class).
- **The existing height-OR patch is therefore inert (CONFIRMED datum):** the injector hooks
  `PacketHeader_Plane::_InternalSerialize` at `NPL 0x18013a6cf` (OR emitted height with 1). On a
  real VP8 call it had **no effect**, precisely because that serializer is never invoked on the send
  path — the wire carries the coded encoder output, not plane messages.

**Result:** requirement (2) — odd-height plane protobuf on the wire — **cannot be produced by the
legitimate sender's graph via any flip/repoint patch.** There is no raw-plane serialize node to
enable, redirect, or unmask. Producing it would require *rewriting* the send serialization to
populate+serialize plane messages from a captured frame (a substantial new-code patch with no
existing node to repoint), or injecting/crafting protobuf below the graph at the transport/framing
layer (a malicious/MITM peer that does not use the encoder graph at all). Neither is "a sender
binary patch plus the existing height patch."

## Blocker #3 — Receiver: NOT a blocker (fully reachable)

- **No clamp anywhere on the raw path (CONFIRMED, rxclamp):** wire plane height flows verbatim
  `proto +0x1c → local heights[] → geomsetter NPL 0x180136080 → packet +0x70 → descriptor +0x10 →
  sink 0x1406e95d0`. The only height arithmetic on the receive path is a payload-length sanity
  check (`imul r10d,eax / cmp` at `0x18011f1ac`), **not** an odd/even test, round, or dimension cap.
  Ctor `0x180135a40` stores height verbatim (`+0x70`, no `& ~1`). Descriptor getter
  `NPLAVPacketGetDescriptor 0x1803d0e50` copies it verbatim.
- **No negotiation rejection (CONFIRMED, rxclamp):** format apply is unconditional; dispatch keys
  purely off the peer-announced `format.type` / `subtype`. `subtype2code 0x180146230` maps
  `"YUV420P"`/`"I420"` → raw code 1 (re-verified §V-3); codec factory builds no decoder for a raw
  subtype, so wire geometry reaches the sink.

**Result:** the victim is reachable **by any endpoint that can place raw odd-height plane protobuf
on the wire.** The constraint proven is solely on the sender's own graph, not on the receiver.

---

## What WOULD reach it (not a minimal sender patch — flagged, out of scope)

The receiver bug is live and endpoint-agnostic. Reaching it requires an attacker that emits the raw
`Format(subtype=I420)` + `PacketHeader_Plane(odd height, stride>0)` protobuf directly, via either:

- **(a) New-code send patch:** build a capture → raw-plane `Serializer` → NetSink path and drive
  `PacketHeader_Plane::_InternalSerialize` (`0x18013a630`) from a captured frame, then keep the
  height-OR patch at `0x18013a6cf`. Substantially larger than a flip; no existing send node to
  repoint. Feasibility unproven.
- **(b) Transport/framing injection (MITM or malicious peer):** craft the protobuf below the NPL
  graph. Independent of the legitimate encoder path; this is the natural PoC vector and is
  consistent with all receiver evidence.

Either delivers the two wire requirements; neither is achievable by patching the enumerated send
serializers + the existing height patch alone.

---

## Verification performed by the synthesizer (not merely trusted)

Binaries: `E:\tmp\wickr\desktop\binaries\NPL.dll` (base `0x180000000`),
`WickrPro.exe` (`0x140000000`). Tool: pefile + capstone.

- **§V-1 CONFIRMED** — codec factory `0x180121430`: `0x180121480 cmp rdi,3 / 0x180121484 jne`;
  `0x180121492 lea rdx,[rip+0x31e24f]` → `0x18043f6e8 = b'vp8'`; second branch
  `0x180121534 cmp rdi,3`, `0x180121542 lea → 0x18043f6ec = b'vp9'`. On no-match, returns
  `rbx` (`xor ebx,ebx` at `0x180121454`) = NULL. `"I420"` (len 4) fails the length gate. ✔
- **§V-2 CONFIRMED** — NetSink serialize handler tail: `0x180133df2 mov rax,[rdi+0x80]` (single
  buffer), `0x180133e12 mov eax,[rdi+0x18]` (size), `0x180133e18 [rdi+0x98]` / `0x180133e27
  [rdi+0x9c]` (w/h). No plane loop, no `PacketHeader_Plane` store. ✔
- **§V-3 CONFIRMED** — `subtype2code 0x180146230`: `0x180146246 lea rdx,[rip+0x2fdbc3]` →
  `0x180443e10 = b'YUV420P'`, match → `0x180146257 mov ecx,1` (raw); the `"I420"` compare shares the
  same `je 0x180146257`. Unknown → `xor eax,eax` (NULL format). ✔

---

## Caveat (residual uncertainty, honest)

The app-level video-graph builder that sits **above** `NPLHubVideoPublish` (`NPL 0x1803e9150`) lives
partly in `WickrPro.exe` and was not exhaustively traced by any of the three RE passes;
`NPLHubVideoPublish` receives a pre-built node. It is therefore *conceivable* an app-layer raw
capture/send path exists that the NPL-layer evidence did not surface. Every convergent datum argues
against it — encoder-only config keys, the single-buffer send serializer, the codec-string length
gate, the live VP8 sink-geometry finding, and the injector null-result — so the NO-GO stands with
Medium-high confidence for the specific claim "no minimal sender patch reaches the sink," and High
confidence for "the receiver is reachable by any peer that can emit raw plane protobuf."

## Bottom line for the lead

- Do **not** build an in-memory injector on the theory that (codec/subtype flip) + (existing
  `0x18013a6cf` height-OR) reaches the sink. It does not: the send graph never emits plane messages,
  so the height patch has nothing to act on, and a codec-string flip aborts the send.
- If a working PoC is required, pursue path (b) — a crafting/MITM peer that puts
  `Format(subtype="I420")` + odd-height `PacketHeader_Plane` protobuf on the wire directly. The
  receiver will accept and overflow with no clamp. Optionally reuse the height-OR logic, but applied
  to the *crafted* protobuf, not to the legitimate sender's (never-invoked) serializer.
