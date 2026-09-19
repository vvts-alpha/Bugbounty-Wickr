# Coordinated-disclosure writeup — AWS Wickr Desktop: heap overflow via unclamped peer video-plane geometry

**Product:** AWS Wickr Desktop (WickrPro) 6.72.20.0, Windows x64
**Class:** Heap out-of-bounds write (CWE-787) from attacker-influenced dimensions (CWE-131 / CWE-190-adjacent)
**Attacker position:** a participant in a call with the victim (P2), using a modified/custom client
**Status of analysis:** receiver-side vulnerability and remote reachability CONFIRMED by RE + a local
direct-call harness. A weaponized remote-delivery PoC was deliberately **not** built.

---

## 1. Root cause

`WickrPro.exe 0x1406e95d0` (the video-plane buffer setup reached from the "VV CM" video-event
handler) sizes and fills the chroma plane buffers with two **inconsistent** computations:

```
alloc = (height >> 1) * stride        ; rounds height DOWN, then multiplies
copy  = (stride * height) >> 1        ; multiplies, then halves
```

For an **odd** height `h = 2k+1` and chroma `stride = S`:
```
alloc = k*S ,  copy = k*S + floor(S/2)   ->  heap OOB write of floor(S/2) bytes
```
This occurs on **both chroma planes (U and V)**. The luma plane is computed consistently and is not
affected. The overflow length (`stride/2`) and content (the copied plane bytes) are attacker-
influenced.

## 2. Why the dimensions are attacker-controlled (reachability)

The plane `stride`/`height` reaching `0x1406e95d0` originate from the **peer's wire data** and are
propagated **verbatim, with no validation**, on the raw-video (I420) receive path:

- `AV::Parser::onPacket` (`NPL 0x18011fce0`) dispatches on `PacketHeader.type` (`[ctx+0x64]`):
  type-1 = format announcement, type-2 = data.
- A type-1 `Format` with `subtype = "I420"`/`"YUV420P"` selects the **raw** path
  (`subtype2code NPL 0x180146230`) — **no decoder is built**, so the codec's even-dimension
  constraint never applies.
- The type-2 data handler (`NPL 0x18011ef70`) takes the raw branch when the header codec bit is
  clear (`test byte [ctx+0x10],1 / je`). Its plane loop copies the wire descriptor's
  `stride (+0x18)` and `height (+0x1c)` **verbatim** into the geometry arrays:
  ```
  0x18011f196  mov  eax,[rcx+0x18]        ; wire stride
  0x18011f199  mov  [rbp+rbx+0x3e0],eax   ; strides[] — UNCLAMPED
  0x18011f1a0  mov  r10d,[rcx+0x1c]       ; wire height
  0x18011f1a4  mov  [rbp+rbx+0x3d0],r10d  ; heights[] — UNCLAMPED
  ```
- The packet constructor (`NPL 0x180135a40`) stores them to `packet+0x60`/`+0x70` with **no mask**;
  `NPLAVPacketGetDescriptor` (`NPL 0x1803d0e50`) copies them to the descriptor verbatim; the
  descriptor drives the sink at `0x1406e95d0`.

**No clamp, no round-to-even, no dimension cap, and no format-negotiation rejection exists on this
path** (confirmed by disassembly). The only arithmetic is a payload-length sanity `imul`
(`0x18011f1ac`), which is not a dimension check. Therefore a peer that announces raw I420 with an
**odd height** and a **nonzero chroma stride**, then sends a type-2 plane packet, drives the
overflow. (A normal VP8 call cannot: decoded video geometry is codec-forced even — verified live,
`h=360`.)

## 3. Impact

- Confirmed **memory-corruption primitive**: a local harness driving the real `0x1406e95d0` with odd
  height produced a reproducible heap OOB **write** (guard-page verified), and — with a controlled
  adjacent object — an overwrite of a C++ vtable pointer redirecting a virtual call (control-of-PC
  primitive).
- **Mitigation posture worsens impact:** the shipping DLLs are **CFG-OFF** (no forward-edge CFI on
  the hijacked indirect call). ASLR is fully on (high-entropy, no non-ASLR module among 214 loaded),
  so practical arbitrary-code execution would additionally require an information leak or the
  ASLR-independent partial-overwrite technique (the overflow length is byte-tunable via stride).
- **Trigger requires a malicious/custom client** (a stock WickrPro sender's graph is encoder-only and
  never emits raw plane packets). This is standard for a "malicious call participant" threat model.

## 4. Recommended fix (receive-side validation)

Validate peer-supplied geometry before it is used to size/copy plane buffers. Minimal, sufficient:

1. In the raw-plane receive path (`NPL 0x18011ef70` plane loop → geometry setter `0x180136080`):
   - **reject or clamp odd chroma height** (I420 requires even height); reject `height <= 0`.
   - bound `stride` against a sane maximum and against the negotiated/frame width.
2. In the sink `WickrPro 0x1406e95d0`: compute `alloc` and `copy` with the **same** expression, and
   assert `copy <= alloc` (defense in depth against the alloc/copy mismatch itself).
3. Enforce a consistency check: `sum(stride_i * plane_height_i)` must equal the received payload
   length before copying.
4. General hardening: enable **Control Flow Guard** on the shipped native DLLs.

## 5. Scope note

This document is for coordinated disclosure to AWS/Wickr. It intentionally omits the offensive
delivery mechanism (send-path hook, plaintext-substitution primitive, ready-to-inject crafted
payload); those were not developed. The receiver-side defect, its reachability, and the fix are
fully specified above for remediation and independent verification.
