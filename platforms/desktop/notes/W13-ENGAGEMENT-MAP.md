# AWS Wickr Desktop 6.72.20.0 — complete engagement map

**Everything found, everything closed, everything not searched.** Built 2026-08-02 from primary
sources (the findings table, `§1.7`, `W4-COMPLETENESS-CRITIC` §E, `NEXT-HUNT-BRIEF` §1–§2, and the
W13 re-analysis), not from narrative memory. Status of every "never asked" item was **re-checked by
grep against the current disclosure and brief** — several were raised in Wave 4 and have zero
mentions anywhere since, which is recorded below as STILL OPEN rather than assumed closed.

Three status words are used and they mean different things:

* **FOUND** — a defect, with evidence.
* **CLOSED** — searched, negative, with the instruction or measurement that closes it. *Not* the same
  as "not searched".
* **NOT SEARCHED** — nobody has looked, or somebody started and stopped. This is the part that
  matters for planning.

---

# PART 1 — WHAT HAS BEEN FOUND

## 1A. Demonstrated live over a real call (3)

| ID | What | Evidence | Qualifier that travels with it |
|---|---|---|---|
| **F1** | libvpx `vp8_de_alloc_frame_buffers` frees the mode-info array without nulling `mi`/`prev_mi`; the next inter frame writes attacker-chosen `MODE_INFO` records through the dangling pointer | 405 B of VP8 (3 frames) → byte-exact content-controlled UAF write, all four steered macroblocks matched byte for byte, then process death | **(a)** the victim's commit limit must be unable to grow — the live gate was opened with a Job Object cap |
| **F2** | `AV::Parser` `kind==2` binds a peer-declared length onto the real, shorter payload; it becomes a `memset` count in the unsandboxed main process | `n == C` 43/43 with no offset; OOB write measured byte-for-byte 3/3; delayed crash landed inside the zeroed range (`ptr+0xc44`) | **(b)** the malicious sender is the operator's own second client, patched in memory |
| **F3** | 14-bit VP8 keyframe dimensions unclamped from wire to allocator | a 34-byte frame → **+2017.0 MiB** of commit on a 19.5 GiB-free host; crashed/hung a 4 GiB host | two contexts per publisher (bit 14 of `Frame+0x90`) ⇒ ~4 GiB from one peer |

## 1B. Confirmed by disassembly, not demonstrated live (1)

| ID | What | Why it matters |
|---|---|---|
| **F2c** | `PacketHeader` **field 10** (msg `+0x58` → `Frame+0x98` → `desc+0x5c`) drives the media key ratchet **before authentication**, unbounded and irreversibly | one packet permanently wedges the victim's media stream; reachable by a call peer **or the relay holding no key material** |

## 1C. Attack surface / hardening (5)

| ID | What | Note |
|---|---|---|
| **F4a** | **WinSparkle performs no signature verification in this build.** No DSA key configured; the missing-key branch at `0x180028e08` jumps *past* the verify and falls into the same continuation | **Outranks F1/F2/F3 in practical severity.** Survived four waves recorded as "fail-closed" because nobody read the dominator |
| **F4b** | CFG instrumented into 276 of 287 binaries and **inert in all of them** because `WickrPro.exe` never opts in (`DllCharacteristics 0x8160`) | cheapest hardening ask in the engagement |
| **F4c** | Remote content decoded with `format = NULL` (sniffed) in the unsandboxed main process across 18 `QImage` sites; the sniff set includes **PDFium** | the MIME allowlist at `0x140045870` protects nothing — 9 of 10 sites pass `format = NULL` anyway |
| **F4d** | Installs into a user-writable directory; interactive user holds `FullControl` on `WickrPro.exe` | also where the F5a recordings land |
| **F4e** | mbedTLS 2.1.5 (2015) + SQLite 3.19.2 (2017) in `Sock5.dll`, loaded unconditionally; OpenSSL 1.0.x in `WinSparkle.dll`; **PDFium and FreeType unpinned**; four libjpeg-turbo copies, three in the unsandboxed main process | |

## 1D. Plaintext leaving an E2E client (4)

| ID | What | Measured |
|---|---|---|
| **F5a** | Raw microphone audio written to unencrypted headerless PCM, **by default, ungated, in a shipped release build** | 28 files / **477,219,328 B**, byte-identical across two days ⇒ never rotated or deleted. Constructor's complete import set has **no env/registry/config API** |
| **F5b** | Crash reporting on by default with **no consent gate**; uploads enabled by a hardcoded immediate; both handlers run `--no-rate-limit`; F2 lets a peer force a crash on demand | |
| **F5c** | `msgID` / `vGroupID` / UUIDs in cleartext logs that are **never rotated or pruned** and survive the burn | 33 files / 22.2 MB / 3 days; 1,613 / 134 / 2,273 occurrences; **no rotation mechanism exists in the binary** |
| **F5d** | `metricsEventQueue` stores a 20-char account-scoped identifier in cleartext, between two encrypted databases | |

## 1E. Found but downgraded or out of scope (3)

* **WOA `forceOpenAccess` is server-flippable** (`0x1409caebe`) — but the payload is transformed under a
  login-established key, so **a relay cannot forge it**. The attacker is the Wickr service, not
  "whoever compromises the relay". Severity **DOWN**.
* **The docx-preview XSS × native bridge** — already reported by the operator, **out of scope**.
* **A peer-driven Opus PLC amplifier** (`0x180148e3e`, `min(missing,10)` recursive `data=NULL`
  decodes) ⇒ ~11× decode work and ~230 KB of `Frame` churn per packet. INFERRED, never measured.
* **A peer can set the victim's own decoder loss statistics to an arbitrary 32-bit value** (W13:
  `add dword [rdi+0x4c8], eax` @ `0x180144197`, exported by the stats getter `0x180144410`). Whether
  it reaches rate control or the metrics upload is **NOT SEARCHED**.

---

# PART 2 — WHAT HAS BEEN CLOSED WITH EVIDENCE

These are **negatives with instructions attached**, not gaps. Re-opening one requires new evidence,
not new effort. (Bear in mind the F4a lesson: a "closed" entry is only as good as the instruction
somebody actually read. Where a negative is load-bearing, re-read its decisive instruction.)

**Memory safety / the RCE question**

* **Link (a), the reclaiming object** — 37 reachable clean-slot candidates → 0 survivors, two
  adversarial verifiers overturned none. **+1 in W13** (`CreateIoCompletionPort` HANDLE at
  `0x1800b3555`) ⇒ **38/38**. Systematic reason: **constraint 5** — not one real pointer at a
  reachable offset points into sprayable memory.
* **The mip-calloc "sweep" escape** — reach without a reclaimer is real (~290 KB) but **content
  control is 0/128** there. Reach OR content control, never both.
* **libvpx multithreaded row decode is dead code** (`threads = 1` @ `0x180144709`).
* **Route A content control** is structurally impossible: to overflow by `K` the attacker must *know*
  `K+29`. And there is **no information-disclosure path back**, so the partial overwrite is blind
  against a measured **0.07 %** pointer density.
* **The media packet as a reclaim target** — no pointer at any reachable offset.
* **The VP8 core parse** — full static audit plus ~370,000 fuzz iterations with guard pages after the
  input *and* after every libvpx heap block: **zero OOB**.
* **The audio/Opus leg** — H1 (frame-size mismatch) and H2 (peer channels/rate) **REFUTED** by
  disassembly *and* by guard-page measurement; worst case 11520/23040 = 50.0 % of the buffer.
* **`§13b`'s node-block candidate** — all 17 node types share one 1702-byte base block; impossible
  under **every** geometry.

**Crypto**

* **Nonce/IV management is correct** — 12-byte IV per invocation from `RAND_bytes`, return checked.
* **The ratchet gate is monotonic forward-only** — no rewind (its *unbounded forward* jump is F2c).
* **No cipher downgrade** — the wire algorithm byte must equal the key object's.
* **AES-256-GCM, and `EVP_DecryptFinal_ex` IS checked** (`0x140cb8bb6` / `0x140cb8bbb`).

**Protocol / parsing**

* **`PacketHeader` field map — 8 of 9 unclamped fields closed** (W13). Fields 5, 6 and 8 are
  write-only or dead wire fields; 3 and 13 are stored/logged; 4's only consequence is the
  already-reported bit-14 context selector; 11 is non-monotonic and its sink is masked
  (`and r8d, 3`). **WickrPro's total view of a packet is two accessors, and the decrypt callback
  reads the descriptor exactly once.**
* **`kind` is genuinely validated** to 1/2/3.
* **The plane count is bounded** to four.
* **A peer-selectable VP9 decoder does not exist** — the factory `strncmp`s `"vp9"` and then builds
  the identical VP8 object and throws the flag away.
* **The format blob is protobuf-lite, all three deserializers clean.**
* **`NPLPacketSetSize` and `NPLHubAudioReadData`** — unvalidated and **dead** (not imported).

**Application surface**

* **`--disable-web-security` does not reach the renderer**; remote debugging off; `QTWEBENGINE_CHROMIUM_FLAGS` is `qunsetenv`'d.
* **Certificate pinning off ≠ bypass** — all four `ignoreSslErrors` call sites are guarded; the
  validator fails closed.
* **CVE-2023-4863 is fixed in both libwebp copies**, verified by disassembly.
* **NPL's vendored libjpeg-turbo is camera-fed only**, gated at `0x180125964`/`0x180125967`.
* **`wickr_db.sqlite` and `metrics/metrics.sqlite` are encrypted at rest** (measured: 7.999 / 7.992 bits/byte, no magic).
* **`temp\attachments\` is encrypted** (7.716–8.000, no format magic on any of 15 files); `temp\preview\`, `temp\crl\`, `cache\` empty.
* **No message content, attachment name or user handle in any log** (0 occurrences, 33 files, 22.2 MB).
* **The crash-upload and log-upload endpoints are hard-coded** — not attacker-redirectable.
* **Attachments / files / links, deep links, QWebChannel** — negative at instruction level in earlier waves.

---

# PART 3 — WHAT HAS **NOT** BEEN SEARCHED

Ordered by expected value, not by category. Each carries why it matters and what it would cost.

## 3.1 ★ THE INFORMATION LEAK — never searched, and it is the only multiplier

**Nobody has ever run this search.** Wave 4 proposed it verbatim — *"sweep the send paths for anything
that echoes bytes derived from received packets"* — and eleven waves later it has not been run.

Why it dominates everything else, quantified in W13:

```
pointer-store corpus                              3,831  stores at offsets >= 244
  ... at offset >= 696 (clean-slot floor)         1,944   50.7%
  ... and 8-aligned                               1,720   44.9%
  ... and ON the clean-slot lattice                  52    1.4%   <-- the search that was run
clean-slot lattice density                                 3.32%
```

The lattice exists **solely because there is no leak** — without one you can only do a partial
overwrite preserving the high 32 bits, which forces `mbc` even and `r` odd. Remove that requirement:

* **52 → 1,720 candidates (33×)** if the write may land on any 8-aligned offset;
* **52 → 3,831 (74×)** if the "clean" requirement disappears entirely.

And a leak simultaneously repairs the *other* two closed negatives: Route A dies on blind targeting
against 0.07 % pointer density, and the mip-calloc escape dies on 0/128 content control. **Every
closed negative in this engagement has "no leak" in its death certificate.**

**Cost:** one sweep of the send graph and the QoS/stats reporting paths for anything carrying bytes
derived from received packets. Note W13 found a candidate shape already: `0x180144410` copies a
0x3c-byte stats block out of the decoder, and **who calls it was not determined**.

## 3.2 The three named holes in the link-(a) negative (§1.7)

1. **The allocator regime is UNDETERMINED.** Whether the freed `mip` block is served by the NT heap's
   LFH or the backend was never tested — and **roughly twenty exclusions assume LFH**.
2. **The search enumerated pointer *stores* only.** A pointer field populated by `memcpy`, by struct
   assignment, or by a store form the scanner did not match is invisible. A load-side census found
   **138 eight-byte loads at reachable displacements, 26 of them in functions with no corresponding
   store** — **never taken to a verdict**.
3. **The `.pdata` blind spot** — 440,840 bytes of NPL `.text` (10.17 %) never swept. One known
   function inside it is `0x180144320`.

Add W13's finding: the 38/38 kills are a **1.4 % sample selected by an unrelated constraint**. From
38 trials with 0 successes the 95 % upper bound on the survival rate is ~7.5 %; over 1,720 candidates
that is up to ~130 expected survivors. The kill *reasons* are systematic and over-determined, so this
is not a refutation — but "constraint 5 is a hard wall" is an **extrapolation from 38 data points, not
a measurement**. The falsifying test: triage a few hundred of the 1,668 lattice-missing stores and see
whether they die the same way.

## 3.3 The image / document decode surface (F4c) — found, but never *tested*

This is the one place where the difficulty is inverted: the exploitation side is well understood and
only bug existence is unknown, and bug existence is a **bounded version-diff**, not a search.

* **PDFium is an unpinned Chromium-130 snapshot** (ICU 74 / libpng 1.6.43 / zlib 1.3.0.1-motley).
  Five security guards are present but **all pre-M130, so they have zero discriminating power** —
  whether Qt's claimed `139.0.7258.67` backports reached PDFium is **UNDETERMINED**.
* **FreeType unpinned.**
* **Qt6Pdf's libjpeg copy is unpinned AND peer-reachable** (NPL's is camera-only; that negative does
  not transfer).
* **`Qt6Quick.dll` imports `QImage::loadFromData` and lives in the same process** — the QML
  image-provider path is further sniffing surface **outside the four-site census**.
* **CVE-2025-2783** (in-the-wild-exploited Chrome sandbox escape): the file anchor is present, its
  earlier rejection is **retracted**, and provenance is UNDETERMINED.

Target: an unsandboxed, **CFG-free** main process holding the key material and the message store.

## 3.4 Never asked since Wave 4 — verified zero mentions in the disclosure or the brief

Each of these was raised by a Wave-4 recon agent, recorded in `W4-COMPLETENESS-CRITIC` §E, and **has
not been touched since**. Status re-checked by grep, 2026-08-02.

| | What | Why it matters |
|---|---|---|
| **E3** | **Does a mid-call `kind==1` FORMAT packet REBUILD the decode graph** (re-enter the node builder `0x1800ef820`, re-run codec selection) or only reconfigure? `0x180132d80` is the apply function and **only its first ~90 instructions were ever read**. **58 live "Received new format" events say the path runs** | a peer-driven graph rebuild mid-call is a state machine surface in its own right, and it is the one place the otherwise-refuted codec-name selection could still matter. It also allocates polymorphic objects on demand — i.e. **a placement primitive** |
| **E4** | **`Proto::VideoFormat`'s 4-int crop rect (field 5) was never swept.** The report closes peer w/h because `VpxDecoder::process` re-publishes the real `d_w/d_h` — **that argument does not cover the crop rect** | never tested with adversarial values (odd, 1×N, near 2³¹, negative) against the converter and renderer |
| **E6** | **The strongest lever on F1's gate is missing from the report:** after a *successful* 16383×16383 decode the receiver must convert to BGR32, **~1.07 GiB per frame**, in WickrPro's `storeFrame` path — a peer-driven per-frame allocation *on top of* the 2 GiB arena. The live oracle `"Failed to allocate frame buffers"` (`0x180461e50`) is also unused | this is the cheapest way to open F1's gate on an ordinary host, which is exactly qualifier (a) |
| **E7** | **CVE-2026-1861** — a libvpx heap buffer overflow (Chrome 144.0.7559.132, Chromium issue 478942410, Feb 2026) **could not be attributed to an upstream commit and was then dropped**. The refuted table handles CVE-2026-2447 and never mentions 1861 | an unattributed libvpx heap overflow that could not be ruled out should not vanish |
| **E8** | **No integrity check below `NetworkSource` was ever looked for.** The verifier that established parse-before-decrypt closed with *"I did **not** audit the DTLS/transport layer below `NetworkSource` for a second, application-level MAC"* | this is a **live refutation route for F2's and F2c's attacker model** — if such a MAC exists, the relay-reachability appendix weakens |

## 3.5 W13's own residuals

* **`PacketHeader` field 7 — the EVENT id.** Unclamped, passed as argument 3 to
  `0x18011ecc3 call qword [rax+0x18]` on a delegate at `Parser+0x118` whose class was **not
  identified** (zero `mov qword [reg+0x118], reg` stores in `0x180118000`–`0x180140000`). The only one
  of the nine header fields where a raw peer int32 reaches an indirect call as an argument. **Cost:
  one function identification.**
* **Receive-side `destructTime`.** Where an inbound message's expiry is computed, and whether the
  receiver re-validates an incoming or room-changed TTL against its own `maxMessageTTL`. Next step is
  the authorisation behind `WickrSecureRoomMgr::changeTTL` (`0x143260610`). **This is the largest gap
  on the ephemerality theme.**
* **`0x180144410`'s caller** — does the peer-poisonable decoder loss statistic reach rate control or
  the metrics upload?
* **The `metricsEventQueue` drain** — never connected to a URL.
* **The crashpad `--attachment=` runtime path** — could it be a *directory* containing the F5a
  recordings? (They cannot be named: `aud_in` occurs zero times in `WickrPro.exe`.)

## 3.6 Whole surfaces nobody has entered

* **★ Every platform other than Windows.** iOS, Android, macOS, Linux and web were never assessed.
  F1 and F3 are defects in a vendored library plus a missing clamp, so they should be **assumed
  present wherever that NPL/libvpx build ships**. **This is the single largest unpriced impact
  multiplier in the engagement** and it costs one question to AWS.
* **MLS / `WickrMlsSdkCpp.dll`.** Deliberately deprioritised — MLS does membership authorization by
  protocol design and the ingest→decode→verify path is Rust. **But §3.5's room-TTL authorization
  question lands squarely here**, which is a new reason to enter it.
* **Server-side and hub-side anything.** No traffic captured at the relay; Appendix 2A is a
  consequence of four client-side legs, not a direct observation.
* **`Sock5.dll`'s two noticed-and-never-chased surfaces** (brief §1 #5): it statically imports 11
  `SETUPAPI` functions plus `newdev.dll` — **the signature of installing a virtual network adapter
  driver, and nobody determined whether that runs at load** — and it builds SQL by string
  concatenation (`"SELECT VALUE FROM VtcData WHERE KEY = '"` @ `0x1807724b0`).
* **The Qt WebEngine renderer's own attack surface**, beyond version inventory and two command-line
  questions.
* **Group calls.** Only two operator accounts exist, so F3's N-publisher multiplier is arithmetic.
* **The residual on `QNetworkReply::ignoreSslErrors` @ `0x140c2e893`** — its acceptance criterion is a
  per-error flag at `[r12+0x4a]` rather than the pin validator, and **what sets that flag was never
  determined**.
* **F4a's residual:** the appcast URL is a runtime-configured `QString` at
  `[WickrWinSparkleWorker+0x18]`, so whether it is HTTPS and whether certificate validation holds is
  **UNDETERMINED from static analysis** — and that decides whether the attacker position is "controls
  the update server" or "any network attacker".

---

# PART 4 — RANKED DIRECTION

| # | Work | Cost | Why |
|---|---|---|---|
| **1** | **Search for an information leak** (§3.1) | one sweep | The only multiplier. 33–74× on link (a), and it repairs the other two closed negatives simultaneously. Never run |
| **2** | **Version-diff PDFium / FreeType / Qt6Pdf-libjpeg against Chromium-130** (§3.3) | bounded | Exploitation side already solved; only bug existence unknown; target is unsandboxed and CFG-free |
| **3** | **Ask AWS which platforms ship `Musigy::AV`** (§3.6) | one question | Largest unpriced impact multiplier in the engagement |
| **4** | **E6: the 1.07 GiB `storeFrame` conversion** (§3.4) | small | The cheapest way to open F1's gate on an ordinary host — removes qualifier (a), the thing that most weakens F1 |
| **5** | **E8: look for a second application-level MAC below `NetworkSource`** (§3.4) | small | Could *refute* F2/F2c's relay-reachability. Worth knowing before the vendor finds it |
| **6** | **E3: does a mid-call FORMAT rebuild the decode graph?** (§3.4) | medium | A state machine surface *and* a placement primitive |
| **7** | **Field 7's delegate** (§3.5) | one function | Closes the last header field |
| **8** | **Receive-side `destructTime` / room-TTL authorization** (§3.5) | medium | The ephemerality promise's remaining gap |
| — | *More link-(a) candidates without changing the constraint set* | — | **Do not.** 38/38 died with over-determined reasons; raising the count without widening the lattice is low yield |
