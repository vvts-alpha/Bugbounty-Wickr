# SEND-PATH GROUND TRUTH (live-confirmed 2026-07-30) — supersedes the old NPLSink static model

Established by live inline-detour recon (recon2..recon6, probe_sites, probe_sites2) against the
operator's own WickrPro (PID 13600) during a 2-way video call. This **invalidates** the earlier
static send model (NPLSink::emit / send node `0x180107870` / serialize `0x180133990` — all measured
DEAD: 0 hits during a live call while receive controls fired).

## The real outgoing-media path

```
camera → VP8 encode → Musigy::AV::Packet (rdx) → WickrPro!encryptCallback (0x147170)
      → WickrPro!AEAD (0x13f820) → NPLAVPacketGetBuffer(Packet,0,&ptr,&len)
      → encrypt 0x140718e87(rcx=ptr, rdx=0, r8d=len)  [import thunk → AEAD-GCM]
```

Live rates during the call: getdesc_RECV ~13/s, recvsink_RECV(0x1406e95d0) ~4/s,
**pro_encCb(0x147170) == pro_aead(0x13f820) ~3.5/s** (equal counts ⇒ every encryptCallback forwards
to the AEAD; decrypt does NOT use 0x13f820 ⇒ it is a clean **send-only** encrypt anchor).

## encryptCallback ABI (WickrPro 0x147170), rdx = Packet
`encrypt(rcx=cryptoCtx, rdx=Packet*, r8=aadObj, r9d=flag=0)`. rcx points at a "VGEF"-tagged crypto
context (stable). AEAD extracts plaintext via `NPLAVPacketGetBuffer` then GCM-encrypts.

## NPLAVPacketGetBuffer (NPL export, RVA 0x3d0de0) — the plaintext accessor
`getBuffer(rcx=Packet, edx=index[0..3], r8=&outPtr, r9=&outLen)`:
- `*outPtr = [Packet + index*8 + 0x40]`   (plane pointer)
- `*outLen = [Packet + 0x18]`              (index 0)
- optional extra outs = `[Packet + index*4 + 0x60]` and `[Packet + index*4 + 0x70]`

## Musigy::AV::Packet layout (RTTI-named, live-dumped) — 4-plane model
| Field | VP8 value (live) | Meaning |
|---|---|---|
| `+0x00` | vtable `NPL+0x441f60` | RTTI `Musigy::AV::Packet` |
| `+0x08` | `1` | **plane count** |
| `+0x10` | =plane0 ptr | data ptr (alias of +0x40) |
| `+0x18` | 1069–6993 (varies) | **payload length** (bytes) |
| `+0x3c` | `0x0000000f` (const) | **codec/format type? (candidate)** — always 15 for VP8 |
| `+0x40,+0x48,+0x50,+0x58` | `[ptr,0,0,0]` | **plane pointers[4]** |
| `+0x60,+0x64,+0x68,+0x6c` | `[len,0,0,0]` | **stride[4]** (VP8: stride0 = len) |
| `+0x70,+0x74,+0x78,+0x7c` | `[1,0,0,0]` | **height[4]** (VP8: height0 = 1) |

So VP8 is carried as a **1-plane opaque blob: stride=len, height=1**. The Packet natively supports
multi-plane raw video: I420 would be plane count 3, three plane ptrs, stride=[W,W/2,W/2],
height=[H,H/2,H/2]. **The odd-height overflow field is `height[k]` at `Packet+0x70+k*4`.**

## Why normal VP8 doesn't overflow the receiver (re-confirmed by this model)
VP8's Packet height=1 (odd) never reaches the receiver's chroma-copy sink: the receiver **decodes**
the VP8 blob first, and the sink runs on decoder output (even dims, live h=360). The overflow sink
(`recvsink_RECV` 0x1406e95d0) needs to see an **odd height without decoding** → the raw/passthrough
plane path.

## The B2 pivot question (next, static RE — no live call needed)
Does the receiver route decode-VP8 vs raw-plane-passthrough off a per-packet field (candidate
`Packet+0x3c`=0xf, or a negotiated codec)? If a crafted send Packet with `planes=3`,
`codec=raw/I420`, `height[chroma]=odd` reaches the peer and is routed to the unclamped chroma sink,
the overflow fires. If codec is locked at call setup (SDP-style negotiation), mid-call packet
crafting cannot switch it and B2 needs a different vector (e.g., forcing raw at call setup).

## B2 substitution mechanics (confirmed, independent of the pivot question)
Cleanest substitution point for the *plaintext* is the AEAD locals just before encrypt:
- **Modify the Packet fields at encryptCallback 0x147170** (rdx=Packet live): set plane count, plane
  ptrs (+0x40..), stride[] (+0x60..), height[] (+0x70..), codec (+0x3c?), len (+0x18) → GetBuffer
  then hands the crafted geometry/planes to encrypt+transport. This is the natural injection point
  because the Packet *is* the send unit and its geometry travels to the receiver.
- Alternative (payload bytes only, same length constraint): AEAD 0x13f890 branch overwrites
  `[rsp+0x38]`/`[rsp+0x30]` — but that path was not taken by live packets (isEmpty branch), so
  prefer the Packet-field edit at encryptCallback.

## Tooling built (all in scratch/w3/lead/, capstone-verified, register/flag-safe, suspend-all hot-patch)
`recon2_loader.c` (NPL emit hook), `probe_sites_loader.c` (7 NPL sites), `probe_sites2_loader.c`
(2-module 4 sites — found the anchor), `recon3_loader.c` (encCb args), `recon4_loader.c` (AEAD
0x13f890, missed branch), `recon5_loader.c` (send buffer = VP8), `recon6_loader.c` (Packet dump).
All external WriteProcessMemory loaders; in-target stubs are pure ring-buffer writes; loaders poll
out-of-process; `--unhook` restores. Safe protocol validated live (no crash across ~6 arm/disarm
cycles on a live call).
