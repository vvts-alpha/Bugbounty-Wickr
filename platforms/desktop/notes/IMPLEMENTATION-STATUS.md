# Crafting-endpoint PoC — implementation status

Tracks build progress against `DESIGN-crafting-endpoint-poc.md`. Honest checkpoint.

## DONE — Payload (the crafted wire bytes)

The exact wire format was decoded from a live `n2fuzz --self` capture (NPL's own Serializer emitting
an I420 320×240 stream), and the malicious variant crafted. Artifacts frozen in
`scratch/w3/lead/payload/`:

| Artifact | Bytes | Meaning |
|---|---|---|
| `fmt_announce_hdr.bin` | `08 01 20 b2 01 28 00 30 00` | PacketHeader{type=1 = format} |
| `fmt_announce_pay.bin` | `08 02 12 14 08 01 10 c0 02 18 f0 01 …` | Format{video} → VideoFormat{subtype=1 **I420**, w=320, h=240} |
| `data_odd361_hdr.bin` | `08 02 12 06 08 c0 02 **10 e9 02** 12 05 08 a0 01 10 78 12 05 08 a0 01 10 78 …` | PacketHeader{type=2 data} with 3 `PacketHeader_Plane`; **plane-0 height = 361 (odd)** |

**The craft:** flip the plane-0 height varint `10 f0 01` (240) → `10 e9 02` (361); the submessage
length (`12 06`) is unchanged, so no re-framing needed. To send raw I420 the sender announces the
format (subtype=I420) then emits type-2 data packets whose plane-0 height is odd.

**Correctness by composition (proven links, not re-run):**
1. N2 CONFIRMED `PacketHeader_Plane.field2` (height, member `+0x1c`, wire tag `0x10`) → deserialized
   → descriptor `heights[]`. The craft sets exactly that field to 361.
2. `repro.c` / `pcdemo.c` CONFIRMED a descriptor with odd height + chroma stride>0 →
   WickrPro sink `0x1406e95d0` → heap OOB write (executed, exit 0x7B for PC-control variant).
   ⇒ crafted wire bytes → odd descriptor → sink overflow.

**Honesty note (carried from N2):** the overflow must be a *dest over-write* (copy > alloc, which is
the odd-height arithmetic), not a *source over-read*. On the wire the attacker sends chroma planes of
≥ `copy = (stride*height)>>1` bytes (they control payload size), so the source read is valid and the
destination overflows by `stride/2`. This is NOT the format-blob over-read artifact N2 gated against.

**Generator for arbitrary geometry:** `scratch/w3/n2/n2fuzz.c --self` drives
`Source(I420 W×H) → Serializer → Sink` and dumps the exact wire bytes; adjust W/H to regenerate
(use an even H then flip the plane-0 height byte for odd, or push an odd-height frame with chroma
planes sized ≥ copy). n2fuzz's `--one`/parse-scene path currently does not route the data packet to
its sink capture (format-announcement prime errors with "missing required fields" — a harness-scene
wiring quirk, not a payload defect; both even and odd cases behave identically). Not needed given the
composition proof above; fix only if an in-harness descriptor read is wanted.

## NOT STARTED — Delivery (the hard part, R1)

Getting the crafted plaintext protobuf onto the encrypted media channel to the victim. Per design
Option A (in-client payload substitution): patch the attacker's NPL in memory at the
serialize→encrypt boundary to (a) emit the `Format(I420)` announcement, then (b) substitute outgoing
video data packets with the crafted odd-height ones — reusing the real call's keys/transport.

### R1 — hook point: PINNED (DONE). See `HOOK-SPEC.md`.

The `encryptCallback` is invoked **inline** (no thread handoff) from a generic callback media-sink
node. Primary hook **`NPL+0x3d134b`** (data-packet `call rax`, slot1 method `0x1803d12b0`); plaintext
serialized-protobuf pointer at `desc+0x18` (`[rsp+0x38]`), from `frame+0x48`; **no separate length
arg** (buffer self-sizes). Format(I420) announce = tag=1 site `0x1803d130f`, armed via
`sinkobj+0xe8=1`. Splice `48 8B 43 68 FF D0` @ `0x1803d1347` → trampoline. This retires the biggest
delivery risk: a clean plaintext-before-crypto substitution point **exists and is located**.

### Remaining implementation (in order)

R1a. **Buffer length-field offset — RESOLVED (static RE, 2026-07-30).**
     `frame+0x48` is an **embedded MSVC `std::string`** (`std::basic_string<char>`, 0x20 bytes), NOT
     a pointer to a separate buffer object. Layout:

     | Field | Offset (abs) | Offset (in string) | Meaning |
     |---|---|---|---|
     | data union | `frame+0x48` | `+0x00` | inline SSO buf[16] if cap≤15, else `char*` heap ptr |
     | **size** | **`frame+0x58`** | **`+0x10`** | **byte length ← THE LENGTH FIELD** |
     | capacity | `frame+0x60` | `+0x18` | `_Myres` |

     **How it was proven:** send node `0x180107870` serializes via `0x180133990` into a local
     `std::string` (its free logic reads cap at `local+0x18`), then calls the assign helper
     **`0x18007fb20`** with `rcx=&[node+0x48]`, `rdx=&local`. That helper is textbook
     `std::string::assign(char*,size_t)`: `cmp [rdx+0x18],0xf` (src cap SSO test) → `mov rax,[rdx]`
     (heap data ptr) → `mov r8,[rdx+0x10]` (src size) → `0x1800683c0(dest,data,len)`. So `frame+0x48`
     is an in-place `std::string`; for a serialized video packet (>15 B) it is always **heap-mode**,
     so `[frame+0x48]` (= the qword copied to `desc+0x18` at the hook) is the **raw `char*` data
     pointer**. There is no scalar length in the descriptor; the length is the string's own
     `size` at `frame+0x58`.

     **Consumer ABI (settled):** `[sinkobj+0xd8]` is invoked at `0x3d134b` with a **single**
     `rcx=&descriptor`. The WickrPro `encryptCallback` `0x140147170` is a **4-arg** C function
     (`encrypt(a,b,c,flag)` → real AEAD `0x14013f820`), so `[sinkobj+0xd8]` is an **NPL adapter**
     that unpacks the descriptor and calls it with explicit `(ptr,len)`. The adapter's `len` comes
     from the `std::string` size (no other length exists post-serialize). sink class RTTI =
     `Musigy::AV::NPLSink` (vtable `NPL+0x4cdc90`, slot1 emit = `0x3d12b0`).

     **Registers live at the hook `0x3d134b`:** `rcx=&desc (rsp+0x20)`, **`rdi=rdx=arg2=frame`**
     (the string holder, nonvolatile → still valid in the detour), `rsi=r8=arg3` (frame-info,
     `desc+0x10`), `rbx=iface` (`sinkobj+0x70`; `mov rax,[rbx+0x68]` = callback).

     **Substitution recipe (any length, allocation-free) — detour around the splice `0x3d1347`:**
     1. `save = { [rdi+0x48], [rdi+0x58], [rdi+0x60] }`  (orig data/size/cap)
     2. `[rdi+0x48] = &crafted; [rdi+0x58] = crafted_len; [rdi+0x60] = crafted_len`
     3. `[rsp+0x38] = &crafted`  (desc+0x18 — belt-and-suspenders; covers adapter reading the raw ptr)
     4. execute displaced `mov rax,[rbx+0x68]; call rax`  (encrypt consumes crafted ptr+len)
     5. restore `[rdi+0x48..0x60] = save`  → the real `std::string` dtor later frees the **original**
        heap buffer (no bad free); `crafted` is a static buffer, never freed.
     6. `jmp 0x3d134d`
     Updating the whole string triple **and** `desc+0x18` makes the substitution immune to whichever
     field the runtime adapter reads (string.size vs raw ptr vs `desc+0x10`-as-&frame).

     **One residual runtime check (cheap, decisive):** confirm object identity between the serialize
     hook and the encrypt hook — the recon injector logs `[node+0x48]` at `0x1801079f2` and
     `desc+0x18` at `0x3d134b`; a pointer match proves the emit's `frame` is the same object the send
     node filled (the only INFERRED link in the chain). Fallback if they differ: use the
     serialize-output hook (§6) editing `[node+0x48]`'s string triple directly (single source of
     truth, pre-forward).
R1b. **Runtime send-vs-receive instance selection** — match `sinkobj+0xd8` against WickrPro's
     `encryptCallback`, or pick the encode/publish-graph sink. Injector runtime step.
     → **Observed by B1 recon (below):** logs `sinkobj`, `cb`(callback), `udata`, and 24 plaintext
     bytes per hit, so send-vs-recv instances are distinguished by callback/userData value and by
     whether the plaintext is a valid outgoing AV protobuf (`08 02 12 …`). B2 can content-gate on the
     outgoing-video signature instead of hard-selecting an instance.
R1c. **Announce frame-gate** `[frame+0x90] & 0x48` — confirm it fires for the crafted frames, or
     drive the tag=1 descriptor directly.
     → **Observed by B1 recon:** logs `aflag` (`sinkobj+0xe8`) and `gate` (`arg3+0x90`) per hit.

### B1 — recon injector: BUILT + statically verified (2026-07-30). `scratch/w3/lead/recon2_loader.c`

Passive, log-only inline detour on the data-packet encrypt invoke `NPL+0x3d134b`. External loader
(WriteProcessMemory, same family as `oddheight_inject.c`); the in-target stub is **pure memory
writes** (no API/no I/O) into a 512-slot ring buffer; the loader polls the ring **out-of-process**
via ReadProcessMemory and decodes. The stub clobbers only rax/r10/r11/flags (all provably safe: rax
is reloaded by the displaced `mov rax,[rbx+0x68]`, r10/r11 are volatile non-inputs to the call, flags
unused) and **pushes nothing**, so `rcx=&desc=rsp+0x20` stays valid for the real `call rax`. Null
guards on `rdi` (framelen) and `rsi` (gate) — both can be null on the empty-frame data path.
Per-hit record captures: tag, sinkobj, callback, userData, frame(rdi), arg3, plaintext ptr,
**framelen `[rdi+0x58]`** (the R1a size field, observed live), announce flag, gate byte, and 24
plaintext bytes. Stub (244 B) disassembled with capstone: all branch targets aligned, tail =
displaced `mov rax,[rbx+0x68]; call rax; jmp 0x3d134d`. Loader verifies the 6 splice bytes
(`48 8B 43 68 FF D0`) before patching and refuses on mismatch (wrong version / already-hooked /
stale int3). Safe protocol: **inject while no call is active** (patch the cold path → zero
torn-instruction risk), then start a video call. Runbook: `RUNBOOK-recon2.md`.
**NOT YET RUN** (WickrPro was not running at build time) — awaits a live sender-side video call.

Superseded (kept for reference) — original R1 sub-steps:
1. **R1 — locate the hook point: DONE (above).** Send pipeline traced:
   - **Media encryption is a callback** — `NPLHubVideoPublish` config carries `encryptCallback`
     (WickrPro `0x140147170`) + `encryptUserData`, parsed/validated in `NPL 0x1803e69f0` and
     `0x1803e7f20`. NPL serializes each packet, then (downstream/async) calls this callback to
     encrypt before transmit. ⇒ substituting plaintext protobuf **before** that callback yields
     crafted bytes encrypted with the real session keys.
   - **Serialize points located (substitution-hook candidates):**
     - **Data:** send fn `NPL 0x180107870` → `call 0x180133990` (serialize) @ `0x1801079e5`; the
       serialized buffer is then handed downstream (`0x18007fb20` = std::string helper, not crypto).
     - **Format announcement:** `NPLAVNetSinkGetFormatBlob 0x1803d0760` → serialize @ `0x1803d07ce`.
   - **NOT yet pinned:** the exact `encryptCallback` invocation site (async, on the reactor/network
     thread) — i.e. confirmation that substituting at `0x180107870`'s serialize output reaches the
     peer through encrypt+transmit, and whether the cleanest hook is the serialize output or the
     callback input. The encrypt-callback design means a clean plaintext substitution point almost
     certainly exists (blocker-#1 "no clean point" risk is largely retired), but the precise site
     and buffer/length mechanics are unfinished.
2. Build the in-memory injector (template: `oddheight_inject.c`): emit announcement + substitute data
   packets, updating the send API's length parameter to the crafted length.
3. **R3/R4:** ensure the receiver accepts the mid-call format switch to I420 / announce I420 from the
   stream's first frame (the sink runs on the fresh-alloc branch).
4. Live 2-endpoint test with the passive AV catcher (`probe_passive_av.txt`) — no hot-path
   breakpoints (they hang the media threads; learned).

## Realistic scope assessment (honest)

- **Payload: complete.** Concrete bytes, correctness by composition of proven links.
- **Delivery: substantial and uncertain.** R1 (the hook) is genuine RE with a real chance of no
  clean substitution point; a live 2-device call test is required; R3/R4 (receiver accepting a
  peer-forced raw format mid-call) is unverified end-to-end. This is multi-session work.

The vulnerability itself is already fully established regardless of delivery: a confirmed,
unclamped, remotely-reachable heap overflow (W1) with a demonstrated PC-control primitive (W3),
triggerable by a malicious call participant that can place raw I420 odd-height protobuf on the wire.
The remaining delivery work only affects whether a *turnkey end-to-end PoC* against a stock victim
over a live call is produced.
