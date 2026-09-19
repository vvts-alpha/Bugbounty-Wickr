# Session prompt — the AUDIO leg: is there a content-controlled write in the Opus path?

Paste everything between the rules below.

---

Continue the authorised assessment of **AWS Wickr Desktop 6.72.20.0 (Windows)**.

This session has one surface: **the audio receive leg — `Parser → CryptProxy → PacketMonitor →
PacketBundleDecoder → OpusDecoder` and everything downstream of it.** It is the last surface the
engagement named as RCE-relevant and then deliberately did not finish.

## Read these first, in this order — the order matters

This engagement has overturned its own conclusions between waves. Reading the older documents first
means reasoning from retracted premises.

1. `E:\tmp\wickr\desktop\notes\NEXT-HUNT-BRIEF.md` — the **WAVE 6 and WAVE 5 sections at the top**
   supersede everything below them. **§0 (method rules) is mandatory.**
2. `E:\tmp\wickr\desktop\notes\W6-CRUX-link-a.md` — the current frontier and the RCE verdict.
3. `E:\tmp\wickr\desktop\notes\W4-CRUX-rce-path-assessment.md` — **§5b is your surface**, and the
   closing section *"The one avenue deliberately NOT completed"* is why this session exists.
   Several of its other rows have been overturned; reconcile against (1) and (2), do not take it at
   face value.
4. `E:\tmp\wickr\desktop\notes\W4-COMPLETENESS-CRITIC.md` — **§E1** is the audio leg, never traced.
5. `E:\tmp\wickr\desktop\notes\W4-CRUX-aead-settled.md` — the crypto framing you will need.
6. If it exists by the time you start: `E:\tmp\wickr\desktop\notes\W7-CRUX-rce-surface-sweep.md`
   contains a first automated pass over this surface. **Treat it as a lead list, not as findings** —
   verify anything you lean on.

Tooling lives in `scratch/w3/lead/` and `scratch/w4/fuzz-vp8/` and `scratch/w6/`.
**Look before you rebuild.** `disfunc.py` / `disfunc_pro.py` (per-function disassembly via `.pdata`),
`callers.py` / `callers_pro.py`, `class_vtable.py` (MSVC RTTI), `iatxref.py`, `leaxref.py`, `fstr.py`,
`harness_vp8.py` (ctypes against the **installed** NPL.dll) all already exist and work.

---

## Why this surface, and a correction to how it was priced

The Wave 4 assessment stopped here with: *"Completing it means auditing the wrapper **and** libopus.
That is not a bounded step — it is 'find a 0-day in one of the most continuously fuzzed codecs in
existence', with a correspondingly low prior."*

**That pricing is wrong, and it is why the lead has sat untouched.** It is right about *libopus* and
wrong about the target. The interesting code is:

* `Musigy::AV::PacketBundleDecoder` — Wickr's own bundle format, hand-written, never fuzzed;
* `Musigy::AV::OpusDecoder` — Wickr's own wrapper: buffer sizing, frame-size arithmetic, channel
  handling, the call into `opus_decode`;
* whatever resamples and hands PCM to WASAPI, sized from **peer-controlled `AudioFormat` fields that
  are measured to have no clamp**.

None of that is libopus. It is bespoke integration code on a peer-fed path, and it has had zero
attention in six waves. **Audit the wrapper first. Only go into libopus if the wrapper is clean.**

## Why this surface matters more than its severity suggests

* **The victim needs no video.** F4-1's live carrier was measured to be **audio** — the serializer
  site is gated on `[Packet+0x90]>>1 & 1`, and encoded video is emitted as a single plane so it takes
  the bounds-*checked* sibling branch. Any audio-path defect has the victim precondition
  *"is in a call"*, which is the weakest precondition available on this target.
* **The one thing the whole engagement is missing is a content-controlled write.** F4-2 has content
  control but no reclaim target (`W6-CRUX-link-a.md`). F4-1 has a remote length-controlled write but
  writes only zeros, and its content route is *structurally* dead. A content-controlled write
  anywhere on the audio path would be the missing ingredient, not another incremental finding.
* **The environment is unusually favourable to whatever you find.** Measured: **CFG absent in both
  `NPL.dll` and `WickrPro.exe`**, no CET, default NT heap, and media + UI + crypto state + message
  store all share one unsandboxed process.

---

## What is already CONFIRMED about this surface — do not re-derive it

**The bundle length check** (`NPL 0x1801650b0`, function entry):

```
0x1801650ba  mov  edi, [rdx+0x18]      ; edi = the PEER-DECLARED length, already minus cryptoPadding
0x1801650c3  lea  eax, [rdi-2]
0x1801650c6  cmp  eax, 0x3fe
0x1801650cb  ja   0x18016522e          ; -> "Illegal size (%d bytes), skipping"
```

⇒ accepted iff **2 ≤ len ≤ 1024**. Confirmed live from the app's own log: at an inflated declared
length of 4096 the log shows `Illegal size (4067 bytes), skipping` ×3, and at 1024 the message **does
not appear at all** — 995 was accepted while the real payload was ~300 bytes.

**The walk** (`0x1801650d1`..`0x180165209`):

```
0x1801650d6  mov   r12, [rdx+0x10]            ; payload pointer
0x1801650df  movzx eax, byte ptr [r12]        ; count := buffer[0]        (<= 31, checked)
0x1801650e9  add   r15, rax                   ; payloads start after the length table
0x1801650f8  sub   edi, r8d                   ; remaining budget := PEER length - (count+1)
loop:
0x180165190  movzx esi, byte ptr [r12+rbp+1]  ; sub-packet length := a table byte
0x180165196  inc   esi
0x180165198  sub   edi, esi                   ; spend the budget
0x1801651ac  mov   r9d, esi                   ; len = table byte + 1
0x1801651af  mov   r8,  r15                   ; ptr = walking pointer
0x1801651bc  call  qword ptr [rax+8]          ; VIRTUAL sink -- the Opus feed
0x1801651ce  add   r15, rax                   ; advance
```

> **The loop's budget comes from the PEER-DECLARED length, not from the bytes actually received.**
> Once the walk passes the real payload, `count`, the length table and the sub-packet bytes are all
> read out of **adjacent heap**, and each resulting `(ptr, len)` is handed to the audio decoder
> through a virtual call.

That is CONFIRMED and is a peer-controlled heap **over-read** bounded to ≤1024 B. It is **not** a
write. The open question is what the consumer of those `(ptr,len)` pairs does.

**Other confirmed context you will need:**

* `Musigy::AV::OpusDecoder` — RTTI string `0x18053ddc9`; implementation cluster
  `0x180148810`–`0x180149240`; logger tag `0x1804444f0`. Two prior passes over the 1108-byte
  `0x180148dd0` reached container bookkeeping (`mov ecx, 0x28` red-black-tree nodes) and stopped
  before the decode buffer.
* **`AudioFormat` fields 1..6 are peer-controlled with no clamp.** Defaults `1, 1, 48000, 16, 16`
  are installed at `0x18013dcda`..`0x18013dcf6`. Nobody has followed sample rate / channel count /
  bit depth into the resampler or into WASAPI render-buffer sizing.
* **`NPLHubAudioReadData 0x1803e7510` has never been examined at all.**
* Receive scene order is `NetworkSource->Muter->Parser->CryptProxy->...` — the app prints it in the
  NPL log at every call start, and the printed order is source→sink (proved by the send scenes, which
  end `...->CryptProxy->Serializer`). **The Parser runs BEFORE decryption.** Two prior analyses got
  this backwards; check the log before reasoning about ordering.
* **`CryptProxy` is fail-open**: it forwards the packet when decryption fails and only logs
  (`0x18011b752`). So a garbage-decrypting frame still reaches the decoder.
* The AEAD is **AES-256-GCM**, framing `algo(1) || IV(12) || TAG(16) || ciphertext`, so
  `cryptoPadding = 29`. `EVP_DecryptFinal_ex` at `0x140cb8bb6` **is** checked at `0x140cb8bbb`.
  Every real packet reserves exactly **29 zero bytes** at `ptr` with `[Packet+0x18]` counting them
  (measured 477/477, audio and video alike).
* **The node factory has no audio nodes.** `NPLNodeCreate`'s `{name, factory}` table at RVA
  `0x539540` lists exactly 17 names — Puller, Serializer, Parser, Splitter, Muter, PacketQueue,
  PacketMonitor, ScreenCapture, JitterBuffer, VideoEncoder, VideoDecoder, VideoConverter,
  VideoResizer, Camera, Crop, AspectRatioCrop, Rotate — and **no `OpusDecoder`, no `OpusEncoder`, no
  `NoiseGate`**, yet the logged scenes contain all three. **So audio nodes are built by a different
  path. Finding that path is a good first task** — it tells you who owns the decoder's lifetime and
  its buffers.
* `NPLNodeCreate` tail-jumps `factory(a2, a3)`. `VideoDecoder`/`VideoEncoder` take a **codec-name
  string** as arg1 with the scene as arg2; the other 15 take the scene as arg1. (W5 §13a had this
  wrong and wrongly concluded those factories "need a format".)

---

## The hypotheses to test, in priority order

State, before each measurement, which observation would distinguish the hypotheses. This engagement
has broken that rule twice and produced a confident wrong answer both times.

### H1 — the frame-size mismatch. **Highest prior. Check this first.**

`opus_decode(dec, data, len, pcm, frame_size, decode_fec)` — `frame_size` is the **capacity of the
output buffer in samples per channel**, and libopus writes up to that many. An Opus packet's own
duration is chosen by the sender: **2.5, 5, 10, 20, 40, 60 ms, and up to 120 ms via code-3 packets**
— a **6× range** over a 20 ms assumption. `opus_packet_get_nb_samples()` exists precisely so an
integrator can size the buffer correctly.

> **If the wrapper allocates its PCM buffer for an assumed duration (20 ms) and passes a constant
> `frame_size` while the peer sends a 120 ms packet, that is a clean content-controlled heap
> overflow — and it is a WRAPPER bug, not a libopus bug.**

This is the single most common defect shape in Opus integrations. Find the `opus_decode` call site,
recover its five arguments, and find where the PCM buffer is allocated and with what size. **Does
anything call `opus_packet_get_nb_samples` / `opus_packet_get_samples_per_frame` /
`opus_decoder_ctl` before the decode?** If not, say so with the disassembly.

### H2 — channel count and sample rate from the peer

`AudioFormat` fields are unclamped (above). Two shapes:
* the decoder is created with `opus_decoder_create(Fs, channels, &err)` using peer values, or
* the PCM buffer is sized with one channel count and written with another.

Follow channels and sample rate from the protobuf field to every arithmetic site. Note libopus only
accepts `Fs ∈ {8000,12000,16000,24000,48000}` and `channels ∈ {1,2}` and returns an error otherwise —
**so check whether the wrapper checks the return value**, and what it does with the buffer if it does
not.

### H3 — the bundle walk's `(ptr, len)` is not just an over-read

Resolve `0x1801651bc call qword ptr [rax+8]` through MSVC RTTI to the concrete class and method on
the **receive** scene. Rule: an RTTI name is not a code path — follow the object that is actually
constructed. Then ask whether that `len` (a peer table byte + 1, so 1..256) is ever compared against
anything before it reaches a copy or a decode. Apply the asymmetry rule: if one branch validates,
read the one beside it.

### H4 — the jitter buffer and the resampler

`JitterBuffer` is in the node factory but returned NULL under the old (wrong) calling convention, so
nobody has stood it up. Its depth is peer-driven. The resampler and the WASAPI render path take
peer-controlled rates. Look for a computed-size allocation whose size and whose write length come
from different expressions — that is the shape F1 and F4-1 both had.

### H5 — `NPLHubAudioReadData 0x1803e7510`

Never examined. It is the boundary between NPL and the host's audio output. Read it.

---

## Do not re-walk these — closed with evidence

* **Route A (F4-1) content control.** Structurally impossible: to overflow by `K` bytes the attacker
  must *know* `K+29` bytes, so the known region can never exceed the allocation without a leak.
  (`W5-CRUX` Appendix A.) The `memset` arm writes zeros by construction; the `memcpy` arm is
  GCM-bounded to the real ciphertext.
* **F4-2 / F5-1's remaining link.** See `W6-CRUX-link-a.md`. Do not restart the reclaim hunt here.
* **The update channel (WinSparkle)** — fail-closed; signature verification is invoked
  unconditionally at `0x180028eec` (straight-line code) with no DSA key configured, so it throws.
* **Attachments, files and links** (`A5-content-attachment.md`), **deep links / QWebChannel**
  (`A2-deeplink-webchannel.md`), **MLS SDK memory safety** (`A3-mls-npl.md`, Rust) — all negative.
* **A peer-selectable VP9 decoder** — `--disable-vp9`; the factory builds the same `VpxDecoder` for
  both names and discards the distinguishing argument.
* **The docx-preview XSS × native bridge** — already found and reported by the operator.

## Method rules this engagement has already paid for

1. **Disassemble the decisive instruction yourself before headlining any reachability claim.** A
   subagent once read a `call [rax]` (edx=1) as "activate the descriptor"; it was a scalar deleting
   destructor.
2. **Check you are testing the right invariant.** "Nothing rewrites the pointer at `parser+0x158`"
   was *true* and *useless* — the pointed-to object is re-parsed in place from the wire every packet.
3. **A string comparison is not a code path.** Follow an accepted token to the object it constructs
   and check whether the distinguishing argument is ever read.
4. **Before you measure, state which observation would distinguish the hypotheses.** Broken twice
   here, both times producing a confident wrong answer.
5. **Asymmetry inside one function is the highest-yield pattern on this target.** F4-1 was found
   because the sibling branch twenty instructions away performs exactly the check the vulnerable
   branch omits.
6. **Linear `.text` sweeps desync.** Always disassemble per function using `.pdata` extents.
7. **Read the application's own logs before building a probe.**
   `%LOCALAPPDATA%\Wickr, LLC\Wickr Pro\logs\*.txt` and `*_npl.txt` — component tags, error reasons,
   and the full scene graph at every call start.
8. **A probe must record every sample and detect target death.** If it only logs on the interesting
   branch, "no data" and "negative result" become indistinguishable — that mistake wasted two runs.

Also: **cdb is not usable on the media path** — an invasive attach drops the real-time call before
anything can be observed (measured: zero media threads under cdb). Use the passive native detour
pattern in `scratch/w3/lead/`.

## If you get to live fire

The vehicles already exist and audio is *easier* to reach than video:

* `scratch/w3/lead/sender_inject.c/.exe` — one 6-byte patch at `WickrPro!encryptCallback` (RVA
  `0x147170`), `--recon` / `--fire`, operator-armed trigger. Stage each payload as
  `[29 zero bytes][payload]` with `len = 29 + payload_len`.
* `scratch/w3/lead/victim_probe.c/.exe` — passive detours, restores on exit, detects target death.
* `scratch/w3/lead/lenprobe.c` — two-site live argument capture across NPL **and** WickrPro.
* Local harnessing: NPL exports the whole graph API (`NPLSceneCreate/AppendNode/ConnectNodes/Start`,
  `NPLNodeCreate`, `NPLAVSourceCreate/SetFormat/PushPacket`, `NPLAVPacketCreate`). Standing nodes up
  in-process makes `HeapWalk` work, which it does not cross-process. See `scratch/w6/reclaim_scan.py`
  for a working example. NPL spawns threads so the process will not exit — kill it, that is expected.

**Sender-side patches must be applied with NO CALL ACTIVE**, then place a fresh call: the graph is
built once per call and toggling audio/video inside a call does not re-publish.

## Reporting discipline

* Label every claim **CONFIRMED** (you disassembled or measured it — say which), **INFERRED**, or
  **REFUTED**.
* Any condition supplied by a harness is a **qualifier that travels with the result**. A harness that
  supplies arguments the live path does not supply proves *exploitability-if-reachable*, not a
  reachable vulnerability.
* **Do not write "RCE" unless you have demonstrated control of the instruction pointer from a
  remotely deliverable input.** Fabricating positives violates the rules of engagement.
* **Negatives are deliverables.** If the wrapper is clean, say so and show the instructions that make
  it clean — that is a real result and it closes the last named RCE-relevant surface.

## Rules of engagement

Operator-owned accounts and machines only. No calls to unwitting parties. No traffic to third
parties. No fuzzing against Wickr production servers — harness the local parsers instead. Benign
proofs of concept only; do not build or run destructive ones.

## What to produce first

Before any new reverse engineering:

1. **Where is `OpusDecoder` constructed, and who owns its buffers?** The node factory does not build
   it (see above), so find the path that does.
2. **The `opus_decode` call site with all five arguments recovered**, and the allocation site of the
   PCM buffer with its size expression. That pair answers H1, which is the highest-prior hypothesis
   on this surface.
3. A one-paragraph statement of **which observation would distinguish "the wrapper sizes the PCM
   buffer from the packet" from "the wrapper assumes a fixed duration"** — before you go and measure
   it.
