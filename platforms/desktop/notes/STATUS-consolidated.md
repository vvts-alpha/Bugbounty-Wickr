# AWS Wickr Desktop 6.72.20.0 (Windows) — consolidated status, 2026-07-31

Scope note: **only** the **docx-preview XSS × native bridge** finding is excluded — it has already
been reported by the operator and re-raising it would duplicate. **The image and PDF preview paths
are in scope and are treated as live surfaces** (§5.1a). Where the docx exclusion changes an
argument, that is stated rather than silently dropped (§5.1).

Labels: **CONFIRMED** = disassembled or measured (which one is stated). **INFERRED** = reasoned from
confirmed facts. **REFUTED** = stated plainly. Qualifiers travel with the results they qualify.

---

## 1. Bottom line

**No path to remote code execution is established, and none should be claimed.**

That is not a gap in effort. Six waves have driven the strongest chain end to end and swept six
further surfaces adversarially; the failure is now **structural** and is characterised in §4.

What *is* established is substantial and independently reportable: a remote, authenticated call peer
sends **405 bytes** and obtains a **byte-exact, attacker-chosen write** into the victim's unsandboxed
process, plus a **34-byte remote denial of service**, plus a heap corruption that a **compromised or
malicious relay can drive against every participant of every call with no key material**.

---

## 2. Findings, ranked

### F5-1 — remote content-controlled use-after-free write (CWE-416). **Demonstrated live.**

`vp8_de_alloc_frame_buffers` (`NPL 0x180186320`) frees the mode-info block and NULLs `mip` (`+0xc58`)
but **contains no store to `mi` (`+0xc60`)**. `vp8_alloc_frame_buffers` (`0x180186080`) calls de_alloc
at entry *and* on its failure label; all six failure exits converge there. Every failure therefore
leaves `pc->mi` pointing into just-freed memory, and the next inter frame writes `mb_rows × mb_cols`
MODE_INFO records straight through it — contents (mode, reference frame, partitioning, sixteen motion
vectors) taken from the attacker's bitstream.

**Live, over a real call, one authenticated participant, three frames totalling 405 bytes:**

```
decode len=41   FRAME A   alloc: request 64x64        PRE-FREE mip=0x1accabc2990 mi=0x1accabc30fc
decode len=34   FRAME B   alloc: request 16383x16383  PRE-FREE mip=0x1acc4e5faf0 mi=0x1acc4e5fcb8
*** ALLOCATION FAILED -- GATE OPEN ***  pc->mip=0x0, pc->mi=0x1acc4e5fcb8 DANGLING
    freed block 0x1acc4e5faf0, size 1923 B, mi 456 B in
```

Frame C then wrote four MODE_INFO records at block `+912/+1064/+1672/+1824`, each carrying 64 bytes of
`bmi[16]` **byte-for-byte identical to the request**. The victim process then died.

**Primitive characteristics (CONFIRMED, measured offline against the shipped DLL):**

| property | value |
|---|---|
| content alphabet | each 4 B = two even `int16` in ±2046 ⇒ byte 0 even, byte 1 in `0x00..0x07 ∪ 0xF8..0xFF` |
| density | SPLITMV fills `bmi[16]` ⇒ **68 of every 76 bytes attacker-chosen** |
| placement | attacker picks the freed block's size class and the write offsets via the first frame's resolution |
| partial pointer overwrite | `0x00007ffabcde1234 → 0x00007ffa02460468` — low 32 chosen, ASLR-bearing high 32 bit-for-bit intact, **no information leak required** |
| PC control | demonstrated **with a harness-supplied reclaiming object** — exploitability-if-reachable, not a reachable exploit |

**Qualifiers that travel:**
1. The allocation failure was induced by a **Job Object per-process commit cap**. A default Windows
   install grows its pagefile and satisfies the 2 GiB request (measured). The honest claim is
   *"reachable on a victim whose commit limit cannot grow"* — fixed or disabled pagefile, a full
   pagefile volume, or an already-exhausted limit.
2. The attacker patched **one 6-byte window in its own client** to emit chosen frames. That models a
   malicious peer, which is the threat model; it is not a defect in the victim.
3. Nothing on the victim was modified except a passive probe that restores on exit.

### F5-2 — remote resource exhaustion / denial of service (CWE-400). **Demonstrated live.**

The VP8 keyframe header carries **14-bit** width and height and nothing upstream clamps them; the
decoder is created with `cfg.w = cfg.h = 0`, so the negotiated `VideoFormat` does not cap it either.
A sweep of every `.pdata` function in `NPL.dll` for the VP8 sync-code test found exactly two
functions in the whole image, both inside libvpx — everything upstream treats the frame as an opaque
blob.

**CONFIRMED, measured on two hosts: a 34-byte keyframe commits +2017.0 MiB.** Two decoder contexts
per publisher (selector = bit 14 of `Frame+0x90`, peer metadata off the wire) ⇒ ~4 GiB from one peer.
On a 4 GiB victim, WickrPro crashed / became unresponsive. **Not limited to memory-constrained
victims** — any host gives up ~2 GiB per context to a 34-byte frame.

### F4-1 — peer- and relay-reachable heap out-of-bounds write (zero-fill)

`Musigy::AV::Parser`'s kind==2 handler takes the peer's `PacketHeader.Buffer.size`
(`mov r8d,[r14+0x18]` @ `0x18011efef`) together with the *real* payload pointer and stores both into
the Frame with **no compare** — while the sibling branch twenty instructions away
(`0x18011f1c0 cmp r10,[rbp+r14*8-0x78]`) performs exactly the missing check. It lands as
`memset(realPtr, 0, peerSize)` at `WickrPro 0x14013f49a`.

* **Peer control of the length: measured end to end.** With the sender pinned to a constant,
  `n == C` exactly, **43/43**, no offset.
* **The write itself: measured byte-for-byte, 3/3** at C=4096 (64-byte snapshots bracketing the
  memset: before = live heap, after = all zero), corroborated by the app's own log line
  *"All bytes set to zero, decryption failed most likely"*.
* **The carrier is AUDIO, not video** — the serializer site is gated on `[Packet+0x90]>>1 & 1`, and
  encoded video takes the bounds-*checked* plane branch. **The victim needs no video; being in a call
  is enough.**
* Content is zeros by construction: the AEAD is AES-256-GCM (framing `algo(1)||IV(12)||TAG(16)||ct`,
  overhead 29) with `EVP_DecryptFinal_ex` checked, so inflation always takes the memset arm.

### F4-1 is reachable from the relay, not only from a call peer

Four independent legs, all CONFIRMED client-side with no server interaction: the client opens **one**
media port to **one** hub (`Hub::Port::BindToUDP`, then `udp://` and `tls://` as two transport
options to the same hub); the NPL API has **no peer-connect entry point at all** (every export is hub
publish/subscribe); the media transport authenticates a **server** (`NPLSetServerCertificates` parses
PEM into a trust set, `SSL_CTX_set_verify`, `X509_STORE_add_cert`) rather than a per-participant
fingerprint; and there is **no SRTP anywhere**. Combined with the confirmed scene ordering — the send
graph is `…->VpxEncoder->CryptProxy->Serializer`, so the header is written *after* encryption, and on
receive the `Parser` runs *before* `CryptProxy` —

> **the hub terminates the only transport, sees and can rewrite the plaintext `PacketHeader` of every
> participant, and needs no key material.**

That changes the attacker from "a malicious call participant" to "whoever controls or compromises the
relay", the victim set from "one peer" to "every participant of every call", and the property broken
from memory safety to **the core promise of an end-to-end-encrypted product**. It promotes
*"authenticate `PacketHeader` as AAD"* from hardening to critical.

**Residual, stated honestly:** hub-side traffic was never captured (out of scope under the RoE), so
this is a logical consequence of the four legs plus the confirmed ordering, not a direct observation
of a server-side packet.

### New this session — raw microphone audio persisted to disk, unencrypted, by default

**CONFIRMED by measurement and disassembly.** The install directory contained **28 files, 456 MB**:

```
aud_in_before_aec_<pid>_48000_1ch.pcm
aud_in_after_aec_<pid>_48000_1ch.pcm
```

dated on the days test calls were made, against binaries dated on the install day — i.e. **produced at
runtime, not shipped**. The writer is `Musigy`'s `WASAPIAudioManager` constructor in `NPL.dll`: the
string cluster `"aud_in_before_aec_"` / `"aud_in_after_aec_"` / `"ch.pcm"` / `"wb"` sits at
`0x180446be0`–`0x180446c08` and is referenced from `0x18015bddc` and `0x18015bf83`, both on
straight-line paths inside the constructor. INFERRED: unconditional — no gate is visible in that
window, though a guard earlier in the constructor was not excluded.

A WebRTC audio-processing debug dump left enabled in a shipped release build. The file lives under
`%LOCALAPPDATA%\Programs\...`, readable by any process running as that user with no elevation, with
no rotation and no bound. For a product sold on ephemeral end-to-end-encrypted communication this
defeats the core promise independently of any memory-safety issue, and it is also an unbounded local
disk-fill.

### Reported by the W7 surface sweep — **not independently verified here**

Carried because they are material, flagged because I did not check them:

* a **server-pushed `kNewSettings` frame force-enabling Wickr Open Access unconditionally**
  (`mov byte ptr [rsi+0x195],1`). If correct this answers a question the Wave 4 report weakened: the
  server, not an administrator, can flip WOA — which makes **mbedTLS 2.1.5 (2015)** remotely
  reachable without user action.
* **SQLite 3.19.2** (2017) in a March-2025 build.
* a **pre-decrypt, hub-reachable key-ratchet DoS** that permanently wedges a stream (loop
  `0x140cb64f0`..`0x140cb65c4`, gate `0x140cb682c` is `jbe`).
* `CryptProxy` has **two fail-opens**, including forwarding the packet when decryption fails
  (`0x18011b752` only logs).
* peer/hub-chosen **AV event injection** in `[0x20,0xa1]`.
* a **CFG-absent writable `pred[]` table** at `0x18054C480`.

### Stale bundled components

| component | version | note |
|---|---|---|
| QtWebEngine / Qt | **6.9.2**, Chromium base **130.0.6723.192** | Chromium 130 is Oct 2024; Qt 6.9 is a **non-LTS** series |
| libvpx | advertises 1.9.0 | **not stock** — carries a `restart_threads` backport, so upstream diffs are mis-scoped |
| mbedTLS (Sock5.dll) | **2.1.5** | 2015 |
| SQLite | **3.19.2** | 2017 (sweep-reported, unverified here) |

### Mitigations measured absent

**CFG absent in both `NPL.dll` and `WickrPro.exe`**, no CET, default NT heap, high-entropy ASLR
present. Media decode, the UI, the crypto state and the message store all share **one unsandboxed
process**.

---

## 3. Evidence-backed negatives (deliverables in their own right)

| closed | why |
|---|---|
| ~~WinSparkle update channel~~ | **RETRACTED 2026-08-01 — THIS NEGATIVE WAS WRONG AND IT WAS THE MOST EXPENSIVE ERROR IN THE ENGAGEMENT.** See the correction immediately below the table. |
| a peer-selectable VP9 decoder | `--disable-vp9`; the factory builds the identical `VpxDecoder` for both names and discards the distinguishing argument |
| the audio / Opus leg | **W7**: `frame_size = 2880` (60 ms), written once DLL-wide; PCM buffer a constant 23040 B ⇒ max write 11520 B, **50 %**, measured against a guard page; `opus_decoder_create` whitelists Fs and channels, the wrapper checks the error out-param, and the packet path is gated on `st != NULL` |
| MLS SDK memory safety | Rust (`mls-rs 0.54.0`); ingest → decode → verify is memory-safe. **The C++ FFI shim was not audited** |
| attachments, files, links; deep links / QWebChannel | negative at instruction level, plus static RE and frida |
| route A content control | **structural**: to overflow by `K` bytes the attacker must *know* `K+29`, so the known region can never exceed the allocation without a leak. No grooming fixes it |
| the mip-calloc "sweep" escape from link (a) | reach without a reclaimer is real (~290 KB, fault at mi+293,673) but **content control is lost**: 0/128, because `vp8_find_near_mvs` reads 78 KB of unknown heap as the above row (515/1025 records read as inter). **Reach OR content control, never both** |
| threaded row decode, postproc/EC/input-fragment CVE family | `threads=1`, init `flags=0` |

---

## 4. Why RCE is not reached — the structural statement

The primitive is strong and its exploit-side questions are closed. What is missing is a **target**,
and the constraints on it now compound:

1. **It must be array-like.** The first `16+(mbc+2)·76` bytes of the block are unreachable under every
   geometry, minimum **244** — so a C++ object's vtable at offset 0 can never be hit.
2. **For the leak-free variant it must be ≥ 704 bytes.** The minimum 8-aligned *clean* slot is
   **696** (`88+76·[2mbc+1+r(mbc+1)]`, `mbc` even and `r` odd, at `mbc=2,mbr=2,r=1`) — a different and
   much higher floor than 244.
3. **Its size class must be one of 15.1 %** of NT block sizes: `76k+23` steps by 76 while buckets step
   by 16. An object whose size the attacker does not choose has ~1-in-6.7 odds of being addressable.
4. **Its pointer must already point into memory the attacker can spray**, in that pointer's own 4 GiB
   window — a partial overwrite cannot leave it, and the process heap and the decoder's large buffers
   draw independently.
5. **It must be allocated inside a millisecond-scale window** on the decode thread. Measured live:
   nothing reclaimed the block for 3 s, and the wrapper's decode-failure handler (`0x180144320`) is a
   25-byte flag reset that allocates nothing — so a reclaim must be *engineered*, not awaited.
6. **There is still no information-disclosure path back to the attacker.** Every over-read found is
   consumed locally; the send graph encodes the microphone. So every attempt is **blind and
   unverifiable**, against a target set now measured to be sparse.

Six surfaces were swept adversarially — audio/Opus, the VP8 token and inter-predictor core, Sock5,
the unmapped peer-controlled wire fields, the mid-call format state machine, and the reclaim corpus —
and **none produced a second primitive**. Three came back dead with the killing instruction quoted.

---

## 5. What is open, and what excluding the docx path costs

**Open, in order of expected value:**

1. **QtWebEngine / Chromium 130.** Never version-audited in six waves and **not covered by the W7
   sweep** (a scoping error on my part). The renderer is ~21 months behind its Chromium base, in a
   non-LTS Qt series. **But with the docx path excluded, its reachability is now an open question in
   its own right**, not a settled one: the surface's value depends entirely on *what else* reaches
   that renderer. The candidates already on record are the two native
   `QImage::loadFromData(..., format = nullptr)` sites — `MessageModel::loadLinkPreviewImages`
   (`0x1400c29c0`) and `PinnedFileHelper::…PinnedLinkImagesCompletedSlot` (`0x1409f7300`) — plus
   whatever renders message content itself. **Answer reachability first; the version delta is only
   worth pricing if something remote gets in.**
   Fairness note: Qt backports Chromium security fixes into patch releases, so "Chromium 130" does not
   mean every post-130 CVE applies. The exposure is the delta between what 6.9.2 backported and what
   has been fixed since — and a non-LTS series stops receiving those backports.
### 5.1a — the image and PDF preview decoders (IN SCOPE, and the Wave 3 negative needs re-pricing)

Measured this session, and never looked at in six waves:

* **Wickr builds Qt from source themselves.** `qtiff.dll` carries
  `D:\WickrDesktopQt\qt6\qtimageformats\src\3rdparty\libtiff\libtiff\tif_dir.c`, and
  `Qt6WebEngineCore.dll` carries a `3rdparty\chromium` path. **CONFIRMED by string extraction.**
  Two consequences: (a) build paths are left in shipped release binaries — a minor information leak;
  (b) more importantly, **the third-party pinning is Wickr's, not stock Qt's**, so the fairness note
  in §5.1 ("Qt backports Chromium security fixes") must be checked against *their* tree, not against
  Qt's release notes. Nobody has done that.
* **Versions measured:** `qjpeg.dll` = **libjpeg-turbo 3.0.3** (2024, current enough);
  `qtiff.dll` = **libtiff ≥ 4.5.1** (from its own deprecation string). **`qwebp.dll` (libwebp, 564 KB
  statically linked) and `Qt6Pdf.dll` (PDFium, 5.5 MB) carry no version string and are UNPINNED** —
  those two are the ones worth pinning, libwebp especially given CVE-2023-4863's history.
* **All ten `imageformats` plugins are resident in `WickrPro.exe` — the unsandboxed main process —
  and none in `QtWebEngineProcess`** (Wave 3 observation). So if a remote image ever is decoded by
  Qt, it is decoded in the process that also holds the crypto state and the message store.

**Re-price the Wave 3 negative before trusting it.** Wave 3 recorded *"P1 image lead CLOSED by 3 live
probes, all ZERO hits"* — `imgprobe` (the two `format = NULL` call sites), `imgprobe2` (WickrPro's IAT
for `loadFromData` / `QImage(QString)` / `QPixmap::load`) and `imgprobe3` (inside Qt6Gui, on
`QImageReader::read` and `QImageReader::imageFormat`). **But this engagement's own §0 rule 8 says a
probe without a liveness counter cannot distinguish "the path was not taken" from "the probe never
armed"** — the exact mistake `allocgate` was later redesigned to avoid ("0 invocations / 0 failures"
= no data, not a negative). The notes do not record a liveness counter on any of the three.

> **Cheapest decisive check on this whole surface:** re-run `imgprobe3` with a counter that logs
> **every** `QImageReader::read`, including local ones (avatars, emoji, UI assets). If that counter is
> non-zero while remote-image reads stay at zero, the Wave 3 negative is real and this surface closes.
> If the counter is also zero, the probe never armed and the negative is **no data** — and a
> `format = nullptr` sniffing site in an unsandboxed process, where the attacker picks the decoder
> from ten resident plugins, is back on the table.

2. **`--disable-web-security` is referenced by code in `WickrPro.exe`**, twice (`0x1408d53aa` in
   `0x1408d4a20`; `0x1408d6633` in `0x1408d6600`), in the same switch-assembly function as
   `--disable-renderer-backgrounding` and `--enable-precise-memory-info`; the app also reads
   `QTWEBENGINE_CHROMIUM_FLAGS` and `QTWEBENGINE_REMOTE_DEBUGGING` (`0x1408d3ba0`). **CONFIRMED that
   it is not an unused constant. NOT established whether it reaches the renderer command line, or
   under what condition.** A few hundred instructions settle it, and it gates item 1's severity.
3. **`kNewSettings` → Open Access → mbedTLS 2.1.5.** One disassembly; converts Sock5 from "off by
   default" to "server-reachable".
4. **Link (a): the computed-size / array-like allocation corpus.** The W7 finder called it dead; its
   own verifier downgraded that to *"unlikely, not closed"* after measuring a **median of 7
   instructions** of coverage per allocation site. Still the last residual of F5-1.
5. VP8 **postproc** (compiled in, buffer allocated, gate byte only ever read at `0x18014473a`); the
   **fdk-aac leg** behind the same peer-reachable walk; **CVE-2026-1861**, still unattributed.
6. The **C++ FFI shim** in `WickrMlsSdkCpp.dll` — the Rust core is safe, the boundary is not Rust.
7. The **signalling / control-plane parsers**, now that the hub is known to sit outside the trust
   boundary.

**Coverage limits, stated so "no RCE found" is not read as "no RCE exists":**

* only **2 of ~214** heap-sharing modules have been swept;
* virtual dispatch was followed nowhere in the automated sweeps;
* `.pdata` covers **89.8 %** of `.text`, so ~10 % is invisible to every per-function sweep this
  engagement has run — the price of the (correct) rule never to sweep `.text` linearly;
* no fuzzing of the audio path, the bundle format, or the signalling parsers;
* platform question never asked: whether `Musigy::AV` ships in the macOS / iOS / Android clients. If
  it does, F5-1 and F5-2 are cross-platform, and that is the largest unpriced multiplier here.

---

## 6. Remediation

**Primary — closes F5-1's gate and F5-2 outright:**

1. **Clamp the decoded dimensions before allocating.** The 14-bit fields permit 16383×16383; reject
   geometry exceeding the negotiated format, or a hard ceiling (e.g. 4096×4096), *before*
   `vp8_alloc_frame_buffers`.

**Also required:**

2. **`NULL pc->mi` and `pc->prev_mi` in `vp8_de_alloc_frame_buffers`**, alongside the `mip` /
   `prev_mip` stores it already performs. Two lines; turns the UAF into a NULL dereference.
3. **Tear the decoder down on allocation failure.** The setjmp landing pad only zeroes `ctx->si.w/h`;
   the decoder object is never destroyed and keeps serving frames from a half-freed state.
4. **Bounds-check `PacketHeader.Buffer.size` against the received payload length** in the kind==2
   handler — the sibling branch already shows the shape — and **drop the packet when decryption
   fails** instead of forwarding it.
5. **Authenticate `PacketHeader` as AAD.** This is the single change that removes the relay from the
   trust boundary for call integrity, and it is critical rather than hardening.
6. **Update libvpx**, and reconcile the shipped tree against a real upstream baseline rather than the
   advertised version string.
7. **Remove the AEC PCM dumping from release builds**, and delete any files already written.

**Hardening:**

8. Enable **CFG** on `WickrPro.exe` and `NPL.dll` — measured absent in both, along with CET. Media
   decoding in an unsandboxed process with CFG off is what makes a corrupted code pointer directly
   valuable.
9. Sandbox or isolate media decode.
10. Refresh the bundled component set: QtWebEngine, mbedTLS, SQLite.
