# AWS Wickr Desktop 6.72.20.0 (Windows x64) — security assessment

**Date:** 2026-08-01
**Scope:** the shipped Windows client, assessed by static analysis of the shipped binaries plus
instrumented runs on the operator's own machines and own accounts.
**Rules of engagement observed:** no traffic was directed at Wickr production infrastructure or any third
party; no fuzzing of Wickr servers; no destructive proof-of-concept against anyone else's account; the two
live call demonstrations used two operator-owned accounts on two operator-owned machines.

## Artifacts

All addresses in this document are preferred-base virtual addresses. `NPL.dll` `ImageBase = 0x180000000`;
`WickrPro.exe` `ImageBase = 0x140000000`.

```
NPL.dll               a031e7aae15fb2a80b51522c0dd211bca393d9ba98cc267e65ff6e938a1d78d5   5,692,840 B
WickrPro.exe          eccafde833d34386c859d6548e922649c2f58cd15f82998c8bd2966219341dbd  55,890,344 B
WinSparkle.dll        19c5acf9093ea5bbaaf77844524b4caa3e9c429b6527089d60c326f20ff08a7f   2,802,600 B
Sock5.dll             9eab23d687a4cde8920fb54dfb03544de50f1c9ca814dedda86e2f3764c06bbf   9,423,784 B
crashpad_handler.exe  c22877bf9e9e48d3ba93897bd5bd7617694cc075dc44e6e44443f156d2abbb34     634,792 B
sentry.dll            592844b5aae346f61741023d05c35bdd704b29d242c5a65cdf5591a9157d400f     299,944 B
```

The shipped installer copies and the installed copies under
`%LOCALAPPDATA%\Programs\Amazon Web Services, Wickr\AWS Wickr\` are byte-identical (both hashed, both
match).

## How to read this document

Every load-bearing statement carries one of four labels, and the label sits next to the claim, not in a
footnote:

* **CONFIRMED (disassembled)** — the bytes were read out of the shipped file and are quoted.
* **CONFIRMED (measured)** — an experiment produced the number, and the experiment is named.
* **INFERRED** — reasoned from confirmed facts, or carried from an earlier phase and not re-derived here.
* **UNDETERMINED** — not established.

Three qualifiers matter more than any other and appear beside every result they touch. They are repeated
deliberately; do not read any single result without them.

> **QUALIFIER (a) — the allocation failure was induced, not naturally occurring.**
> The libvpx allocation failure that opens Finding 1's gate was produced with a **Job Object per-process
> commit cap** (`JOB_OBJECT_LIMIT_PROCESS_MEMORY`) applied to `WickrPro.exe` by our own probe. We first
> tried without it: on a stock 4 GiB host with a system-managed pagefile the 2 GiB request **succeeded**,
> because Windows grew the pagefile. `commit free` is a snapshot, not a bound. The honest reachability
> statement is **"a victim whose commit limit cannot grow"** — a fixed-size or disabled pagefile, a
> pagefile volume with no free space, or an already-exhausted limit — **not "any 4 GiB host"**.

> **QUALIFIER (b) — the attacker's own client was patched; the victim's was not.**
> Both live demonstrations used an in-memory patch on the **attacker's own** machine so that the attacker's
> client emitted chosen bytes: 6 bytes at `WickrPro!encryptCallback` (RVA `0x147170`) for Findings 1 and 3,
> and 11 bytes inside `Musigy::AV::Serializer::onPacket` (`NPL 0x18011d592`) for Finding 2. That is how one
> models a malicious peer, which is the threat model. **It is not a defect in the victim and the victim
> needs no modification.** The victim ran shipped, unmodified binaries; the only change to the victim
> process was read-only probe detours that restore on exit.

> **QUALIFIER (c) — the instruction-pointer-control demonstration used a harness-supplied object.**
> We showed offline that Finding 1's write primitive is sufficient for instruction-pointer control. **The
> object that reclaimed the freed block in that experiment was supplied by our harness.** It shows
> exploitability *if* a reclaiming object is reachable; it is not a reachable exploit.

**We do not claim remote code execution anywhere in this document.** Eleven phases of work have not
produced control of the instruction pointer from a remotely deliverable input. §1.7 characterises exactly
what is missing rather than hand-waving it.

---

# ONE-PAGE SUMMARY

## The two findings demonstrated live over a real Wickr call

**Finding 1 — a call peer can write attacker-chosen bytes through a dangling pointer (CWE-416 → CWE-787).**
One authenticated participant in a call sent **three VP8 frames totalling 405 bytes** over a normal Wickr
call. The victim's bundled libvpx VP8 decoder was left with a dangling `pc->mi`; the third frame wrote four
76-byte `MODE_INFO` records through it whose 64 attacker-chosen bytes came back **byte-for-byte identical
to the request**; the victim process then died. The attacker also supplies the allocation failure that
opens the gate, with a 34-byte keyframe. **Precondition, and it is load-bearing: qualifier (a)** — the
allocation failure was induced with a Job Object commit cap, and on an unconstrained host the 2 GiB request
simply succeeds. **Qualifier (b)** applies: the attacker's own client was patched to emit chosen frames.

**Finding 2 — a call peer, or the media relay, can drive an attacker-length-controlled heap write
(CWE-787, with CWE-125 on the same packet).** `Musigy::AV::Parser` binds a **peer-declared length** onto
the **actually received, shorter** payload and never compares them. That length reaches WickrPro's media
decrypt callback and becomes the count argument of `memset` on the real, shorter buffer. Measured live: a
sender pinned to a constant declared length produced that exact length at the victim's sink in **43 of 44**
`Buffer`-branch packets, against **0 of 243** in the benign baseline. A 4096-byte zero-fill was then
observed byte-for-byte, before and after, 64 bytes at `ptr+1024`, on three separate packets. The victim
died seconds later in an unrelated subsystem on a NULLed object pointer 3,140 bytes past that same pointer.
**This one has no memory-configuration precondition and needs no video** — the live carrier was the audio
leg. **Qualifier (b)** applies.

## What an attacker can do, from what position

| Position | Capability |
|---|---|
| One authenticated participant in a call with the victim, video flowing, **and** a victim whose commit limit cannot grow | Content-controlled write of chosen bytes into a freed heap block (Finding 1) |
| One authenticated participant in a call with the victim — **no video needed, no memory precondition** | Attacker-length-controlled zero-fill of adjacent heap; demonstrated to reach live objects and kill the process (Finding 2) |
| One authenticated participant in a call with the victim, video flowing | ~2 GiB of commit per decoder context, ~4 GiB per peer, for 34 bytes on the wire (Finding 3) |
| Whoever controls or compromises the media hub, holding **no key material** | Finding 2 against every participant of every call — the `PacketHeader` is written after encryption and parsed before decryption, so it is outside the end-to-end envelope (§2 Appendix A; rests on one inference, stated) |
| Whoever can control the bytes returned for the update appcast or installer URL | The client downloads and runs an installer it never authenticated — **no signature verification runs in this build** (Finding 4a) |
| Any process running as the signed-in user, no elevation | Reads verbatim raw microphone audio of past calls from unencrypted files the product writes by default (Finding 5a) |
| Nobody — this is the default configuration | Crash reporting is on with no consent gate, uploading thread stacks, the full process environment and the session log, including call-participant identity (Finding 5b) |

## What an attacker cannot do

Stated because it bounds the above, and each of these is backed by a named instruction or measurement in
the body:

* **Reach code execution through Findings 1, 2 or 3.** No path was established; §1.7 names the missing link.
* **Turn Finding 2 into a content-controlled write.** The content-carrying `memcpy` arm is unreachable
  under length inflation, because GCM bounds its count to the real plaintext.
* **Read anything back.** No information-disclosure path from any of these defects to the attacker was
  found. Every attempt is blind.
* **Redirect crash uploads off `*.ingest.sentry.io`.** The URL is built from a compile-time template with
  exactly one reference in `.text`.
* **Downgrade the media cipher.** The wire algorithm byte must equal the algorithm in the key object.
* **Forge media as the relay.** The VP8 payload is encrypted before the header is written; the relay holds
  no key for it.
* **Reach `NPL.dll`'s vendored libjpeg-turbo from peer bytes.** The only route is gated on a destination
  pixel format the receive graph does not request; that copy is fed by the local camera.
* **Read the message database at rest.** `wickr_db.sqlite` is SQLCipher-encrypted; measured 7.999
  bits/byte, no SQLite magic, and its WAL page payloads carry no schema.
* **Push code through TLS interception of the messaging transport.** The client's pin validator fails
  closed and all four `ignoreSslErrors` sites are guarded.

## The three changes that matter most

1. **Clamp the decoded VP8 frame dimensions before allocating.** One change closes Finding 3 outright and
   closes Finding 1's gate.
2. **Null `pc->mi` and `pc->prev_mi` in `vp8_de_alloc_frame_buffers`.** Two lines; removes Finding 1's
   primitive entirely, on both routes that reach it.
3. **Configure the update signing key and make the missing-key case fail closed.** One call before
   `win_sparkle_init`, one branch inverted.

The cheapest hardening in the report is a link flag: `WickrPro.exe` ships without `/guard:cf`, so the CFG
instrumentation that 276 of the 287 shipped binaries already carry is inert process-wide.

---

# FINDINGS TABLE

| ID | Description | CWE | Attacker position | Preconditions | Status |
|---|---|---|---|---|---|
| **F1** | Bundled libvpx `vp8_de_alloc_frame_buffers` frees the mode-info array without nulling `mi`/`prev_mi`; the next inter frame writes attacker-chosen `MODE_INFO` records through the dangling pointer | CWE-416 → CWE-787 | Authenticated call participant | Victim in a call with video; **victim's commit limit cannot grow** (qualifier a) | Demonstrated live, byte-exact, followed by victim process death. Code execution not demonstrated, not claimed |
| **F2** | `Musigy::AV::Parser` `kind==2` binds a peer-declared length onto the real, shorter payload; the length becomes a `memset` count in the unsandboxed main process | CWE-787 (+CWE-125) | Authenticated call participant; **also the media hub** (§2 Appendix A) | Victim in a call. No video, no interaction, no memory precondition | Defect confirmed at every link by disassembly; length control and the out-of-bounds write both measured live |
| **F3** | 14-bit VP8 keyframe dimensions are unclamped from wire to allocator; a 34-byte keyframe forces ~2 GiB of commit per decoder context, two contexts per publisher | CWE-400 via CWE-789 | Authenticated call participant | Victim in a call with video | Mechanism confirmed by disassembly; cost measured (+2017.0 MiB); delivery demonstrated live on two hosts |
| **F2c** | `PacketHeader` **field 10** (message offset `+0x58` → `Frame+0x98` → `descriptor+0x5c`), peer-supplied and unclamped at the parse site, drives the media key ratchet **before authentication**, unbounded and irreversibly; one packet permanently wedges the victim's media stream | CWE-400 (+CWE-345) | Authenticated call participant; **also the media hub**, holding no key material | Victim in a call. No video, no interaction, no memory precondition | Chain CONFIRMED end to end by disassembly, 9/9 addresses verified, parse site now identified. Not demonstrated live |
| **F4a** | WinSparkle update channel performs **no** signature verification: no DSA key is configured, and the missing-key branch logs and continues. **Defence-in-depth, not directly exploitable** — the appcast URL is hard-coded HTTPS to `s3.amazonaws.com`, so the attacker must already control that bucket or hold a rogue CA | CWE-347 | Whoever controls AWS's own `wickr-desktop-clients` S3 bucket, or a CA for `s3.amazonaws.com` | Update check runs; attacker already positioned on that channel | Confirmed by disassembly, resource-directory and import-table measurement. Static determination only — no update was fetched |
| **F6** | **The TLS-UDP proxy transport trusts a peer-supplied 16-bit frame-length prefix as a read length into a fixed 2,048-byte buffer embedded in the connection object.** `Musigy::NPL::Net` `0x18009d570` reads `FullDataSize` out of the frame's own first two bytes (`0x18009d95a`), stores it with no comparison of any kind (`0x18009d962`), and passes `FullDataSize − accumulated` to `recv` (`0x18009d9ae`) and to the `SSL_read` wrapper (`0x18009db27`) writing at `buffer + accumulated`. Overflow up to **~63.5 KB with fully attacker-chosen content and no precondition**. Because the buffer's overrun lands first on the connection's own length counters at `+0x12f8`/`+0x12fa`, which are re-read to drive `sendto` (`0x18009ddce`), it also yields an out-of-bounds **read** that the relay transmits | CWE-787 (+CWE-125, via CWE-130) | Whoever terminates the TLS-UDP proxy connection — **the media hub**, per §2 Appendix 2A. *(An on-path attacker would additionally qualify if the plain-TCP arm at `byte [obj+0x80] == 0` is ever used without TLS; not established)* | Victim in a call. The transport is established on every observed call (`TLS-UDP proxy connection … established`). No video, no interaction, no memory precondition | **CONFIRMED — and now EXECUTED against the shipped `NPL.dll`** (§6.8): a frame declaring 0xffff wrote **63,447 bytes past the 0x1320-byte connection object**, with controls at 0x7ff and 0x800 leaving the next object untouched. Absence of any bound confirmed over the whole 2,422-byte function; buffer capacity of 0x800 bounded from both sides by the adjacent fields the reset routine `0x18009b2e0` writes. **★ The write also yields an information DISCLOSURE (§6.11, EXECUTED):** the overflow reaches the *next* connection object's `sendto` destination, length and socket, so one 6,948-byte frame makes that object transmit up to ~60 KB read from a 2 KB buffer **to an address of the attacker's choosing** — no prior leak needed. Measured: 16,384 bytes delivered, 14,336 of them adjacent heap, pointer-shaped values recovered. **★ And instruction-pointer control (§6.12, EXECUTED in a harness):** the overflow controls the sibling connection's `SSL*` (+0x88); AWS-LC `SSL_read`→`BIO_read` calls `bio->method->bread`, and one crafted frame drove the shipped relay handler to `rip = attacker value` (CFG inert). Not sent to a live client; live delivery = MITM of the proxy. **Live confirmation (§6.10):** with Settings -> Calling -> "Enable TCP Calling" on, the relay read handler executed **17,134 times in ~30 s**, and two connection objects were observed **0x1320 bytes apart and contiguous** at `0x800f7b6150` / `0x800f7b7470`, each holding a live `SSL*`. With that setting off the handler ran **zero** times, so **reachability is gated on the client using the TCP transport**. **No instruction-pointer control is claimed and no crafted frame was ever sent to a live client.** The `sendto` destination is now established as the client's own media socket (§6.4), so the over-read is delivered **locally** and is not a disclosure to a remote party. What makes the write serious is §6.4a: the connection objects are **0x1320 bytes and eight of them are contiguous**, so the overflow runs through seven siblings at fixed offsets, reaching each one's `SSL*`, both socket handles and its own `sendto` destination |
| **F4b** | CFG instrumented into 276 of 287 shipped binaries but inert, because `WickrPro.exe` never opts in; no CET | CWE-1188 | n/a (hardening) | none | Confirmed, measured from PE headers |
| **F4c** | Remote content is decoded with the format sniffed (`format = NULL`), in the unsandboxed **CFG-free** main process. The sender picks the parser from **14 formats across 10 plugins plus Qt6Gui's built-ins**, including SVG/SVGZ and PDF→PDFium. Versions pinned from the shipped bytes: **libtiff 4.5.1** (Sep 2023), **libpng 1.6.50** in Qt6Gui but **1.6.43** in Qt6Pdf | CWE-434 (adjacent), CWE-1104 | Sender of remote content — **needs no server compromise and no network position** | Content reaches a decode site | Call-site census confirmed; sniff set and every component version **measured** |
| **F4f** | **~~A received PDF drives an out-of-bounds heap write in the shipped PDFium.~~ RETRACTED BY US — see §4.5a.** What survives: the preview path reaches a PDFium built **2025-09-17**, ten months behind the application, and `opj_j2k_read_sod()` is missing the bounds/NULL test added upstream for **CVE-2026-2648** (`Bug: 477033835`). **The out-of-bounds claim does not hold in this build:** re-measured with the same PoC, **0 of 512 stores leave the allocation** — `opj_j2k_read_sot` grows the array to `(TPsot+1)*24` before every write, and the initial allocation is `opj_calloc(10,24)` = 240 B, not 24 B. Reported as **stale-dependency hardening only** | CWE-1395 (stale bundled component) | Anyone who can send the user content — but with **no demonstrated memory-safety consequence** | none | Missing bounds/NULL test **CONFIRMED (disassembled)**; **the out-of-bounds write is REFUTED (measured, §4.5a)**. The other three heap-overflow CVEs are **not reachable in this build** — stated per defect in §4.5. **No crash, no instruction-pointer control, no severity claimed** |
| **F4d** | Application installs into a user-writable directory; the interactive user holds `FullControl` on `WickrPro.exe` | CWE-732 | Any process running as the user | none | Confirmed by ACL inspection and a write test |
| **F4e** | Stale components: mbedTLS 2.1.5 (2015) and SQLite 3.19.2 (2017) in `Sock5.dll`, loaded unconditionally; OpenSSL 1.0.x (EOL 2019) statically linked into `WinSparkle.dll` | CWE-1104 | n/a | none | Version strings and structural fingerprints confirmed |
| **F5a** | Raw microphone audio is written to two unencrypted headerless PCM files per process, by default, in a shipped release build, with no rotation and no cap | CWE-312 (+CWE-532) | Any process running as the user | none | Confirmed by disassembly and measured on disk: 28 files, 455 MiB, 41.4 minutes per stream |
| **F5b** | Crash reporting is on by default with **no** consent mechanism; uploads enabled by a hardcoded immediate; both handlers run `--no-rate-limit`; F2 lets a peer force a crash on demand | CWE-359, CWE-200 | None for the default; a call peer for the forced case | none | Confirmed by disassembly and by on-disk state |
| **F5c** | Message and conversation identifiers (`msgID`, `vGroupID`, per-object UUIDs) are written to cleartext logs that are never rotated or pruned, and are untouched by the expiry sweep — so the index of a burned message outlives the message | CWE-532 (+CWE-212) | Any process running as the user; any holder of a backup or disk image | none | Confirmed by measurement (33 files, 22.2 MB, 1,613 `msgID` / 134 `vGroupID` / 2,273 UUIDs) and by a negative string sweep for any rotation mechanism |
| **F5d** | `metricsEventQueue` stores a 20-character account-scoped identifier in cleartext protobuf, in the same directory as two databases that *are* encrypted at rest | CWE-312 | Any process running as the user; any holder of a backup or disk image | none | Confirmed by parsing the file on the operator's own machine |

**Ordering.** §1–§3 are the three findings demonstrated live over a real call, ordered by attacker
capability. §4 opens with the update channel — the most severe single item outside §1–§3, but from a
heavier attacker position. §5 needs no attacker at all.

**On §5 specifically:** most of what we checked on that theme was *sound* — attachments, previews and both
SQLite databases are encrypted at rest, and no message content, attachment name or user handle appears in
any log. Those negatives are recorded with evidence in §5.5 and should be read alongside F5a–F5d.
---

# SECTION 1 — F1: a call peer can write attacker-chosen bytes through a dangling pointer in the bundled libvpx VP8 decoder

**Class:** CWE-416 (use-after-free write), realised as CWE-787
**Component:** libvpx VP8 decoder, statically linked into `NPL.dll`. The interface string self-reports
`WebM Project VP8 Decoder v1.9.0` (`NPL 0x180462000`, referenced from the codec interface at `0x180461f70`).
**Process:** the main `WickrPro.exe` process — unsandboxed, hosting the UI, the message store and the
crypto state. CFG is off in both modules (measured: `NPL.dll` `DllCharacteristics = 0x0160`,
`WickrPro.exe` `= 0x8160`; `IMAGE_DLLCHARACTERISTICS_GUARD_CF` (`0x4000`) clear in both).
**Attacker position:** one authenticated participant in a call with the victim, with video flowing. No
elevated privileges, no prior compromise, no victim interaction beyond being in the call.

**Status: demonstrated end to end over a live Wickr call between two operator-owned accounts, byte-for-byte,
followed by victim process death — with the victim's commit limit pinned by a Job Object cap and the
attacker's own client patched to emit chosen frames. See qualifiers (a) and (b), restated in §1.4 and §1.5.
Remote code execution is not demonstrated and is not claimed** — §1.7 states exactly what is missing and why.

**Methods note, and it applies to every image-wide sweep in this section.** All sweeps iterate `.pdata`
records. `NPL.dll` has **13,498 `.pdata` records** with 13,498 distinct start RVAs, of which **4,518 carry
`UNW_FLAG_CHAININFO`** — they are chained-unwind continuations — so there are **8,980 distinct functions**
(CONFIRMED, measured this pass). `.pdata` covers **89.83 %** of `.text`: 3,894,262 of 4,335,102 bytes, with
**440,840 bytes uncovered** (CONFIRMED, measured). Regions outside `.pdata` were not swept; one such region
is `0x180144320`, the `VpxDecoder` decode-failure handler, which is covered by no `.pdata` record at all.
Every exhaustiveness claim below is exhaustive **over `.pdata`-covered code**.

## 1.1 Summary

`vp8_de_alloc_frame_buffers` frees the mode-info array and nulls `mip` and `prev_mip`, but has no store to
`mi` or `prev_mi`. Two independent routes reach it after a failed allocation:

* `vp8_alloc_frame_buffers` calls the de-allocator on entry *and* on its failure label, and all six of its
  failure branches converge on that label — so **every** allocation failure inside `vp8_alloc_frame_buffers`
  leaves `pc->mi` pointing into memory just returned to the heap;
* `vp8_decode` itself calls the same de-allocator at `0x18017ddce` when its own `prev_mip` allocation
  returns NULL (§1.3.4). This second route is outside `vp8_alloc_frame_buffers` entirely.

The failure is not destructive to the decoder: `vp8_decode`'s `setjmp` landing pad clears two fields and
returns `-1`, and the decoder object is never destroyed. The next inter frame therefore runs
`vp8_decode_mode_mvs`, which writes one 76-byte `MODE_INFO` record per macroblock straight through the
dangling pointer. The record contents — mode, reference frame, partitioning and sixteen motion vectors —
are taken from the attacker's bitstream.

The attacker also supplies the allocation failure itself: the VP8 keyframe header carries 14-bit width and
height, nothing between the parse and the allocator clamps them, and a **34-byte** keyframe requests about
**2 GiB** of commit.

**Demonstrated live:** one authenticated call participant sent **three VP8 frames totalling 405 bytes**
(41 + 34 + 330) over a normal Wickr call; the victim's decoder was left with `pc->mip == 0` and `pc->mi`
dangling 456 bytes into a freed 1923-byte block; the third frame wrote four `MODE_INFO` records into that
block whose 64 `bmi[16]` bytes are **byte-for-byte identical to the request**; the victim process then died.
**Qualifiers (a) and (b) both apply to that sentence and are load-bearing** — the allocation failure was
induced with a Job Object per-process commit cap (§1.4), and the attacker's own client was patched in memory
to emit chosen frames (§1.5). Neither is a modification of the victim.

## 1.2 Relationship to the earlier draft

This supersedes **REPORT 2** of our internal `DISCLOSURE-DRAFT-h1.md`, which was written before live
delivery. Where they differ, this section governs.

| Earlier statement | Now |
|---|---|
| "Live over-the-wire delivery … has not been delivered over a call" | **Overturned.** Delivery, gate opening and a byte-exact write are all CONFIRMED live (§1.5). |
| "The precondition is any victim whose free commit is below ~4 GiB" (and the "gate closed at 4100 MiB / ARMED at 4000 MiB" table) | **Retracted by us.** `commit free` is a snapshot, not a bound: with a system-managed pagefile Windows grows the pagefile and satisfies the 2 GiB request. Measured on a 4 GiB host — the allocation **succeeded**. The correct precondition is a commit limit that *cannot* grow (qualifier (a)). |
| "There are two decoder contexts per publisher, so the peer parks memory in context 0 and aims context 1" | Still CONFIRMED as a fact about the code, but **not needed**: the gate was opened live with a single context and three frames. |
| "PC control from the primitive — measured" | Still true, still qualified, and the qualifier is now load-bearing: the reclaiming object was **supplied by our harness** (§1.7, qualifier (c)). |
| "The write … runs past the end of the freed block" (working notes) | **Corrected by us.** In this regime the write is *exactly array-bounded* — it fills the freed array to its final byte and stops, with no spare record. See §1.8. |
| "Six failure exits, all inside `vp8_alloc_frame_buffers`" | **Narrower than the defect.** A seventh route exists at `0x18017ddce`, inside `vp8_decode` (§1.3.4). Remediation item 1 closes both; item 3 alone would not. |
| **(F4f) "A received PDF drives an out-of-bounds heap write … 256 out-of-bounds stores, up to 6,104 bytes past a 24-byte heap allocation"** | **RETRACTED BY US — see §4.5a.** Re-measured on the shipped `Qt6Pdf.dll` with the same PoC and WickrPro's own decode call: **0 of the 512 stores leave the allocation.** The earlier harness counted failures of the *upstream guard* (`current_tpsno < nb_tps`); on the `TNsot = 0` path `nb_tps` stays 0 **while `opj_j2k_read_sot` grows the array with `opj_realloc` to `(TPsot+1)*24` before every write**, and the first allocation is `opj_calloc(10, 24)` = 240 B, not 24 B. The alternative path is closed too: `TPsot >= TNsot` is rejected and `read_sot` returns FALSE. The missing bounds/NULL test is real and worth reporting as hardening, but **it is not an out-of-bounds write in this build and no severity should be claimed for it.** |

## 1.3 The defect — CONFIRMED (disassembled)

### 1.3.1 `vp8_de_alloc_frame_buffers` — `NPL 0x180186320`

`.pdata` extent RVA `0x186320`–`0x1863f2`, 210 bytes, read complete. `rbx` is zeroed at `0x180186394`
(`33db xor ebx, ebx`) and is the source of every null-out:

```
0x1801863b5  488b8f580c0000  mov  rcx, qword ptr [rdi + 0xc58]   ; mip
0x1801863bc  e81f90ffff      call 0x18017f3e0                    ; vpx_free(mip)   <== the free
0x1801863c1  488b8f680c0000  mov  rcx, qword ptr [rdi + 0xc68]   ; prev_mip
0x1801863c8  e81390ffff      call 0x18017f3e0                    ; vpx_free(prev_mip)
0x1801863cd  488b742438      mov  rsi, qword ptr [rsp + 0x38]    ; (epilogue restore)
0x1801863d2  48899f680c0000  mov  qword ptr [rdi + 0xc68], rbx   ; prev_mip = NULL
0x1801863d9  48899fd8190000  mov  qword ptr [rdi + 0x19d8], rbx
0x1801863e0  48899f580c0000  mov  qword ptr [rdi + 0xc58], rbx   ; mip      = NULL
```

Five pointers are freed and five are nulled: `+0xc08` (at `0x180186396`), `+0x22c8` (at `0x1801863a9`),
`+0x19d8`, `+0xc68` (`prev_mip`) and `+0xc58` (`mip`). **There is no store to `+0xc60` (`mi`) and none to
`+0xc70` (`prev_mi`).**

Verified two ways. A census of the **structure-relative (non-stack) displacements** over the whole 210 bytes
returns `{0x780, 0xa20, 0xac0, 0xb60, 0xc00, 0xc08, 0xc58, 0xc68, 0x19d8, 0x22c8}` — `0xc60` and `0xc70` do
not appear at all, in any addressing mode, as source or destination. (A census that does *not* exclude the
stack also returns `rsp`-relative `0x8`, `0x10`, `0x30`, `0x38` — the prologue and epilogue spills at
`0x180186320`, `0x180186325`, `0x1801863cd`, `0x1801863e7`. Those are noise; the conclusion is unchanged.)

The `VP8_COMMON` field offsets are pinned independently: `vp8_alloc_frame_buffers` writes `mip` at `+0xc58`
and computes `mi` at `+0xc60` from it (§1.3.2); and `VP8_COMMON` sits at `VP8D_COMP+0x1440`, so `cm+0xc60`
is the `pbi+0x20a0` that the function at `0x180187fe0` loads at `0x180187ff8`
(`mov rdx, qword ptr [rcx + 0x20a0]`).

### 1.3.2 `vp8_alloc_frame_buffers` — `NPL 0x180186080`

`.pdata` extent RVA `0x186080`–`0x1862ba`, 570 bytes, read complete.

* De-allocates on entry: `0x1801860a4  e877020000  call 0x180186320`.
* De-allocates again on its single failure label: `0x180186290  mov rcx, rbx` /
  `0x180186293  e888000000  call 0x180186320`, then `eax = 1`. **On the success path only the entry call
  runs**; a successful allocation never reaches `0x180186293`.
* **Six** failure branches converge on `0x180186290`: `0x18018610a` (`js`), `0x18018618b` (`js`),
  `0x1801861d8` (`je`), `0x180186215` (`je`), `0x180186230` (`js`), `0x18018628a` (`je`).
* The mode-info array is allocated at `0x1801861c9  call 0x18017f350` —
  `vpx_calloc(count = (mb_rows+1)·(mb_cols+1), size = 0x4c)`; the count arithmetic is at
  `0x1801861bb`–`0x1801861c6` and `mov edx, 0x4c` at `0x1801861c1` fixes `sizeof(MODE_INFO) = 76`.
* `mip` is stored at `0x1801861ce  mov qword ptr [rbx + 0xc58], rax`.
* `mi` is derived and stored **only here, only on success**:

```
0x1801861de  48638b2c0c0000  movsxd rcx, dword ptr [rbx + 0xc2c]   ; mode_info_stride
0x1801861e5  48ffc1          inc    rcx                            ; stride + 1
0x1801861e8  486bd14c        imul   rdx, rcx, 0x4c                 ; * 76
0x1801861ec  4803d0          add    rdx, rax                       ; + mip
0x1801861ef  486383280c0000  movsxd rax, dword ptr [rbx + 0xc28]   ; (mb_cols, reloaded)
0x1801861f6  488993600c0000  mov    qword ptr [rbx + 0xc60], rdx   ; pc->mi
```

So **`mi − mip = (mode_info_stride + 1) · 76 = (mb_cols + 2) · 76`**, exactly. A census over all 13,498
`.pdata` records finds four stores at displacement `+0xc60`; `0x1801861f6` is the only 8-byte store on the
libvpx `VP8_COMMON` layout (two are 16-bit stores to unrelated structures at `0x1800d2df4` / `0x1800d561c`,
and `0x18020c084` is in an unrelated function `0x18020c060`).

**Which allocation fails decides the shape of the corruption — CONFIRMED by instruction order.** The
geometry is committed to `VP8_COMMON` at `0x18018619e` (`mb_cols` → `+0xc28`), `0x1801861a9` (`mb_rows` →
`+0xc24`), `0x1801861af` (`stride` → `+0xc2c`) and `0x1801861b5` (`+0xc20`) — that is **after** the five
frame-buffer allocations (`0x180186103` ×4 and `0x180186184`) and **before** the `mip` calloc at
`0x1801861c9`. Consequently:

* failure at one of the first five allocations (the live case, §1.5) leaves the **old** geometry in force,
  and the write is confined to the freed array;
* failure at or after the `mip` calloc leaves the **new** geometry in force with `mi` still pointing into
  the old, much smaller freed block — an uncontrolled march through live heap (§1.8, and Remediation 2).

### 1.3.3 The decoder survives the failure — CONFIRMED (disassembled)

`vp8_alloc_frame_buffers` has exactly two direct callers. One, `0x180182487` inside `0x180182450`, is the
**encoder** (`lea rdi, [rcx + 0x1a920]` — `VP8_COMMON` embedded in `VP8_COMP`), i.e. the send path. The
decode path has one: `0x18017dbb7` inside `vp8_decode` (`0x18017d780`, **`.pdata` extent RVA
`0x17d780`–`0x17dfea`, 2154 bytes** — re-measured this pass; an earlier internal note gave `0x17dc00`, which
is wrong and caused us to miss the second de-alloc route in §1.3.4).

```
0x18017dbb7  e8c4840000  call 0x180186080          ; vp8_alloc_frame_buffers(cm, cm->Width, cm->Height)
0x18017dbbc  85c0        test eax, eax
0x18017dbbe  7414        je   0x18017dbd4
0x18017dbc0  4c8d0589422e00 lea r8, [rip+0x2e4289] ; -> 0x180461e50 "Failed to allocate frame buffers"
0x18017dbc7  ba02000000  mov  edx, 2               ; VPX_CODEC_MEM_ERROR
0x18017dbcf  e89cd2ffff  call 0x18017ae70          ; vpx_internal_error
```

`vpx_internal_error` (`0x18017ae70`) tests `error->setjmp` at `0x18017aee9` and, when set, tail-calls
`longjmp` at `0x18017af00  e8cefb2200  call 0x1803aaad3`. (Those two addresses lie in chained-unwind
continuation records of the same function; `0x18017ae70`'s own primary `.pdata` record is 15 bytes,
`0x17ae70`–`0x17ae7f`. The error struct's `setjmp` is at `cm+0x58` and its `jmp_buf` at `cm+0x60`, which —
with `cm = pbi+0x1440` — are `pbi+0x1498` and `pbi+0x14a0`.) The landing pad is `0x18017db24`, the non-zero
return of the `setjmp` at `0x18017db1b`:

```
0x18017db24  488b4dd7      mov  rcx, qword ptr [rbp - 0x29]
0x18017db28  4489b198140000 mov dword ptr [rcx + 0x1498], r14d  ; cm->error.setjmp = 0
0x18017db2f  488b4ddf      mov  rcx, qword ptr [rbp - 0x21]
0x18017db33  4c89b1e8000000 mov qword ptr [rcx + 0xe8], r14     ; ctx->si.w = ctx->si.h = 0
0x18017db3a  e8f134e8ff    call 0x180001030                     ; vpx_clear_system_state
0x18017db3f  b8ffffffff    mov  eax, 0xffffffff                 ; return -1
```

**Two stores, a state clear, and a return.** No destructor, no re-init, no invalidation of `pc->mi`.

The load-bearing evidence that the decoder object persists is this: **`vpx_codec_dec_init_ver`
(`0x18017d4a0`) has exactly one call site in the whole image, `0x180144731`** (CONFIRMED, direct-caller
sweep). The decoder is constructed once per context and kept, and there is no matching teardown call. The
codec interface's `destroy` slot (`iface 0x180461f70 + 0x18` → `0x18017d710`) additionally has no direct
callers anywhere in `NPL.dll`, and we found no indirect dispatch to it — **INFERRED**, since an indirect
call through the interface table would not appear in a direct-reference sweep, and "no direct callers" is
close to vacuous for a function whose only intended call path *is* the table.

### 1.3.4 A second route to the same dangling state — CONFIRMED (disassembled)

A sweep of all direct references to `vp8_de_alloc_frame_buffers` returns **four** call sites, not the two
inside `vp8_alloc_frame_buffers`: `0x1801860a4` and `0x180186293` (both described above), `0x1801850b2`
(encoder teardown, `&cpi->common`, irrelevant), and `0x18017ddce` — **inside `vp8_decode` itself**:

```
0x18017ddba  e891150000      call 0x18017f350                  ; vpx_calloc for prev_mip
0x18017ddbf  488983680c0000  mov  qword ptr [rbx + 0xc68], rax ; pc->prev_mip
0x18017ddc6  4885c0          test rax, rax
0x18017ddc9  751c            jne  0x18017dde7
0x18017ddcb  488bcb          mov  rcx, rbx
0x18017ddce  e84d850000      call 0x180186320                  ; <== same de_alloc, same missing null-outs
0x18017ddd3  4c8d059e402e00  lea  r8, [rip + 0x2e409e]
0x18017ddda  ba02000000      mov  edx, 2
0x18017dde2  e889d0ffff      call 0x18017ae70                  ; vpx_internal_error -> same landing pad
```

A `prev_mip` allocation failure **outside** `vp8_alloc_frame_buffers` therefore reaches the same
de-allocator that fails to null `mi` and `prev_mi`, then longjmps to the same landing pad. This matters for
remediation: a fix that only hardens `vp8_alloc_frame_buffers`' internal failure handling leaves this route
open. Remediation item 1 — nulling `mi` and `prev_mi` in the de-allocator — closes both.

## 1.4 The gate — a 34-byte keyframe

**CONFIRMED (disassembled): the peer sets the allocation size, and nothing clamps it.**

`vp8_peek_si` (`0x18017e4f0`, extent RVA `0x17e4f0`–`0x17e5d6`, 230 bytes, read complete) applies five
validations — a `ptr+size` overflow test (`0x18017e51c`/`0x18017e520`, error 8), a 10-byte minimum length
(`0x18017e551  cmp esi, 0xa` / `jb`, error 5), the keyframe bit (`0x18017e556  test byte ptr [rdx], 1`), the
start code, and a rejection of zero width or height (`0x18017e5a5` / `0x18017e5a7`, error 7). **It applies
no upper bound of any kind.**

```
0x18017e562  807a039d        cmp byte ptr [rdx+3], 0x9d
0x18017e568  807a0401        cmp byte ptr [rdx+4], 1
0x18017e56e  807a052a        cmp byte ptr [rdx+5], 0x2a   ; the VP8 keyframe sync code
0x18017e584  4181e0ff3f0000  and r8d, 0x3fff              ; width  = 14 bits
0x18017e58b  44894704        mov dword ptr [rdi + 4], r8d
0x18017e59c  81e1ff3f0000    and ecx, 0x3fff              ; height = 14 bits
0x18017e5a2  894f08          mov dword ptr [rdi + 8], ecx
```

`vp8_decode_frame` (`0x1801ae010`) re-parses the same fields into `VP8_COMMON` with the same absence of a
bound: `0x1801ae1f1 and ecx, 0x3fff` immediately followed by `0x1801ae1f7 mov [rbp+0x760], ecx`
(`cm->Width`), and `0x1801ae217` / `0x1801ae21d` for `cm->Height`. **No clamp between the mask and the
store, in either function.**

A sweep of **all 13,498 `.pdata` records** in `NPL.dll` for the VP8 sync-code test finds exactly two
functions in the entire image — `0x18017e4f0` and `0x1801ae010`, both inside libvpx. *(Methodological
caveat: the sweep matches `cmp`-immediate forms, so a start-code test written as a 3-byte `memcmp` or a
masked 32-bit load would not be found. The conclusion is corroborated independently by the transport
handing the frame to libvpx as an opaque `{pointer, length}` pair — §3.)*

**The negotiated format does not cap it either — CONFIRMED (disassembled).** The decoder is constructed in
`Musigy::AV::VpxDecoder` (`NPL 0x180144520`) with a zeroed `vpx_codec_dec_cfg_t`:

```
0x1801446fe  48c7854401000000000000  mov qword ptr [rbp + 0x144], 0   ; cfg.w = cfg.h = 0
0x180144709  c7854001000001000000    mov dword ptr [rbp + 0x140], 1   ; cfg.threads = 1
0x180144713  e8c89e0300              call 0x18017e5e0                 ; vpx_codec_vp8_dx()
0x180144723  4c8d8540010000          lea  r8, [rbp + 0x140]           ; &cfg
0x180144731  e86a8d0300              call 0x18017d4a0                 ; vpx_codec_dec_init_ver
```

`cfg.w = cfg.h = 0` means libvpx applies no frame-size limit at all.

**CONFIRMED (measured, operator harness, two hosts): a 34-byte 16383×16383 keyframe takes +2017.0 MiB of
commit.** `NUM_YV12_BUFFERS` is 4 (the allocation loop at `0x1801860e0`–`0x180186120` and the matching free
loop at `0x180186340`–`0x180186353` both run four times). Section 3 derives the figure from the code.

Also CONFIRMED (disassembled): the same construction loop builds **exactly two** decoder contexts per
publisher (`0x180144685  mov r14d, 0x518` … `0x180144777  cmp r14, 0x528`, step 8 at `0x180144773`, stored
at `+0x4a8` and `+0x4b0` by `0x18014476e`), indexed by **bit 14 of the incoming packet's `+0x90` metadata
word** (`0x1801447ac mov eax,[rbx+0x90]` / `0x1801447b2 shr eax,0xe` / `0x1801447b5 and al,1` /
`0x1801447b7 movzx r14d, al`). One peer therefore drives roughly 4 GiB in ordinary operation. That is not
needed for the attack below; it is what makes Section 3's denial of service a single-peer result.

> ### QUALIFIER (a), and it travels with every reachability claim in this section
> In the live run the allocation failure was induced by a **Job Object per-process commit cap**
> (`JOB_OBJECT_LIMIT_PROCESS_MEMORY`, `victim_probe --cap 400`) applied to `WickrPro.exe` by our own probe.
> We first tried it without: on a stock 4 GiB host with a system-managed pagefile, **the 2 GiB request
> succeeded** — Windows grew the pagefile to satisfy it. `commit free` is a snapshot, not a bound.
> **No allocation failure in this engagement was produced by natural memory exhaustion.** The honest
> statement is therefore: **F1 is reachable on a victim whose commit limit cannot grow** — a fixed-size or
> disabled pagefile, a pagefile volume with no free space, or an already-exhausted limit — **not on any
> 4 GiB host.** The gate mechanics downstream of the failure are identical either way: `malloc` returns NULL
> inside `vp8_alloc_frame_buffers` and the six failure branches take over.
## 1.5 The live demonstration — CONFIRMED (measured)

> **QUALIFIER (b), restated here because this is the subsection a reader will quote.** The attacker's
> **own** client was patched — one 6-byte instruction window at `WickrPro!encryptCallback`
> (RVA `0x147170`) on the attacker's own machine — so that it emits chosen VP8 frames instead of camera
> output. That models a malicious peer, which is the threat model this finding is scoped to. **It is not a
> defect in the victim, and the victim needs no modification of any kind.** `encryptCallback` is a 28-byte
> leaf thunk (no `.pdata` record; `mov rax,r8` … `jmp 0x14013f820` at `0x140147186`, `ret` at
> `0x14014718b`, then `int3` padding to `0x14014718f`), and the six bytes replaced are its first six,
> `49 8b c0 4d 85 c0`. **Qualifier (a) also applies to this subsection**: the allocation failure was
> induced by a Job Object commit cap.

Two operator-owned machines, two operator-owned accounts, one real Wickr call. Victim: stock client,
unmodified except for a probe that installs three inline detours (at `vp8_alloc_frame_buffers` entry, its
failure tail, and `vpx_codec_decode` entry), records, and restores on exit — the detours are non-perturbing
in the sense that they record and return, and each original byte sequence was verified against the shipped
DLL before patching, but they are writes to the victim process and we do not describe them as read-only.
Codec negotiation was untouched; the frames travelled inside the ordinary end-to-end-encrypted media
payload, so the relay/SFU could not have forged them.

Three VP8 frames on the wire: **41 + 34 + 330 = 405 bytes.**

```
decode len=41   FRAME A   alloc: request 64x64        PRE-FREE mip=0x1accabc2990  mi=0x1accabc30fc
decode len=34   FRAME B   alloc: request 16383x16383  PRE-FREE mip=0x1acc4e5faf0  mi=0x1acc4e5fcb8

*** ALLOCATION FAILED -- GATE OPEN ***
    pc=0x1accaa87260   pc->mip=0x0 (NULLed by de_alloc)   pc->mi=0x1acc4e5fcb8 (DANGLING)
    freed block base = 0x1acc4e5faf0, size 1923 B   mi sits 456 bytes into it
```

**The arming geometry reproduces the disassembly exactly** (re-derived independently from §1.3.2):

| quantity | measured live | predicted from `0x180186080` |
|---|---|---|
| `mi − mip` after frame A's 64×64 (4×4 macroblocks) | `0x1acc4e5fcb8 − 0x1acc4e5faf0 = 456` | `(mb_cols+2)·76 = 6·76 = 456` |
| `mi − mip` in the pre-existing 360×360 stream (23×23) | `0x1accabc30fc − 0x1accabc2990 = 1900` | `(23+2)·76 = 1900` |
| freed block size | 1923 B | `(mb_rows+1)(mb_cols+1)·76 + 23 = 25·76 + 23 = 1923` |

The `+23` is `vpx_calloc`'s over-allocation (`0x18017f386  lea rcx, [rdi + 0x17]`), and the user pointer is
the raw block plus 16 on a 16-aligned heap (`0x18017f3a6 lea rbx,[rax+0x17]` /
`0x18017f3aa and rbx, 0xfffffffffffffff0`).

Frame C then wrote **through the dangling pointer**. Four `MODE_INFO` records — the four steered macroblocks
(1,1), (1,3), (3,1), (3,3) — appeared in the dump at offsets **+912, +1064, +1672, +1824** measured from the
freed **user** pointer (`mip`), each carrying `mode = 9 (SPLITMV)`, `ref_frame = 1 (LAST)`, `is_4x4 = 1`,
`partitioning = 3`:

```
requested (100,54) (-346,232) (592,-410) (838,588) (-1084,766) (1330,944) (1576,-1122)
          (-1822,1300) (20,1478) (266,1656) (-512,-1834) (758,2012) (1004,144)
          (-1250,322) (1496,-500) (0,256)

want  64003600a6fee800500266fe46034c02c4fbfe023205b00328069efbe2f81405
      1400c6050a01780600fed6f8f602dc07ec0390001efb4201d8050cfe00000001
got   64003600a6fee800500266fe46034c02c4fbfe023205b00328069efbe2f81405
      1400c6050a01780600fed6f8f602dc07ec0390001efb4201d8050cfe00000001
```

**Byte for byte identical.** The four offsets reproduce the disassembled placement rule exactly:
`(mi − mip) + (row·stride + col)·76` with `stride = mb_cols + 1 = 5` gives `456 + 6·76 = 912`,
`456 + 8·76 = 1064`, `456 + 16·76 = 1672`, `456 + 18·76 = 1824` — all four exact. (We recomputed these
ourselves; note the offsets are relative to `mip`, which is 16 bytes above the raw allocation base. Working
notes that quote the same placements against the *raw* base differ by that 16.)

**The victim process then died.** The probe's memory dumps at t+0 ms and t+200 ms succeeded; at t+1 s and
t+3 s `ReadProcessMemory` failed because the process was gone.

Three earlier delivery attempts failed for reasons worth recording, because each is a property of the
product rather than of our tooling: frames fired on the call's first packets are dropped (they precede the
peer's subscribe); the two simulcast layers alternate almost every packet, so a single counter scatters
A/B/C across both decoder contexts; and every real media packet — 477 of 477, audio and video alike —
reserves exactly **29 zero bytes** at the payload pointer for the AEAD header, with the peer-declared length
counting them.

## 1.6 Write-primitive characteristics

These are the numbers that let you judge severity without re-deriving them. Each carries its own label.

* **Alphabet — parity is CONFIRMED (disassembled); the magnitude bound is not what an earlier draft of ours
  said.** `read_mvcomponent` is `NPL 0x1801c0180` (primary `.pdata` record `0x1c0180`–`0x1c018c`, chaining
  through `0x1c018c → 0x1c01aa → 0x1c01c4 → 0x1c0268 → 0x1c0490 → 0x1c04ea → 0x1c051e`, ending `0x1c053c`).
  Its unrolled magnitude accumulation has a highest bit contribution of bit 9
  (`0x1801c029e  41c1e409  shl r12d, 9`), i.e. `mvlong_width = 10`, so **the per-frame delta is bounded to
  ±1023 before doubling**; the tail applies the `+8` correction (`0x1801c04e2 test esi, 0xfff0` →
  `0x1801c04fb add esi, 8`) and the sign (`0x1801c052f neg esi`).

  **Both callers then add a neighbour predictor after the doubling.** In `decode_split_mv`
  (`NPL 0x1801bfc60`, chaining to `0x1c00b5`): `0x1801c0003 66 03 c0 add ax, ax` /
  `0x1801c0010 mov word ptr [rbx+4], ax`, then `0x1801c0024 movzx eax, word ptr [rbp+rcx+7]` /
  `0x1801c0029 66 01 43 04 add word ptr [rbx+4], ax`, and the matching pair for the column at `0x1801c001d`
  / `0x1801c0020` / `0x1801c002d` / `0x1801c0032`. The whole-macroblock caller (`NPL 0x1801bf0f0`) does the
  same: `0x1801bf3b6 add ax, ax` / `0x1801bf3bd add ax, si`, and `0x1801bf3d0 add ax, ax` /
  `0x1801bf3da add ax, word ptr [rsp+0xba]`.

  So **stored = 2·delta + predictor**. What survives as a hard constraint is **parity: every written
  motion-vector component is an even `int16`** (the doubling is unconditional and the predictor is itself
  even by induction) — **CONFIRMED (disassembled)**. The **magnitude** of the stored value is bounded not by
  ±2046 but by libvpx's motion-vector clamp, which scales with the *first* frame's geometry — and the
  attacker chooses that geometry too. We measured components in ±2046 over a 64-macroblock run at 64×64,
  where the predictor is zero at every position, which is also why the live run's sixteen requested vectors
  came back byte-exact. **We have not established the bound for larger arming geometries — UNDETERMINED.**
  An earlier internal draft stated "even `int16` in ±2046" as a hard alphabet and derived a `2^-20` figure
  for the fraction of addresses a full 8-byte pointer could be written to. **That derivation is withdrawn**;
  with only the parity constraint established, four even `int16`s is `2^-4` of 8-byte values, not `2^-20`.
* **Density — CONFIRMED (measured offline against the shipped DLL).** `SPLITMV` with `partitioning = 3`
  fills `bmi[16]` — 64 contiguous chosen bytes at `MODE_INFO + 12`. With the surrounding enum fields that is
  **68 of every 76 bytes attacker-chosen**. Verified 16/16 macroblocks offline; verified 4/4 records and
  64/64 `bmi` bytes live.
* **Placement — CONFIRMED (disassembled).** The attacker chooses the freed block's size class *and* the
  write offsets through the **first** frame's resolution: block size = `(mb_rows+1)(mb_cols+1)·76 + 23`,
  `mi` at `16 + (mb_cols+2)·76` from the raw base. The unwritable prefix is therefore
  `16 + (mb_cols+2)·76`, **minimum 244 bytes** (at `mb_cols = 1`) over every legal geometry. 68 of the 76
  byte residues within a record are reachable.
* **ASLR-surviving partial pointer overwrite — CONFIRMED (measured offline against the unmodified shipped
  DLL).** A planted `0x00007ffabcde1234` became `0x00007ffa02460468` — the low 32 bits set to the requested
  value, the ASLR-bearing high 32 bits **bit-for-bit intact**. **No information leak is required.**
  *The mechanism is **INFERRED**, not measured:* we attribute it to `vp8_decode_mode_mvs` performing an
  extra pointer advance at the end of every row, leaving the record after each row's last macroblock
  untouched, so the last written record's `bmi[15]` has an unwritten 8-aligned neighbour. That row-loop
  shape was inferred from the placement rule (confirmed 4/4 live) and from the allocation-side arithmetic;
  **the loop's containing function was not disassembled in this pass and we do not give an address for it.**
  Note the mechanism as stated holds for rows `0 … mb_rows−2`; for the array's genuinely final record there
  is no untouched neighbour inside the array at all (§1.8) — only the 7 bytes of `vpx_calloc` slack.

## 1.7 What is NOT established — and why

**This is not remote code execution, and we do not claim it.** Eleven phases of work have not produced
control of the instruction pointer from a remotely deliverable input. The missing link is specific:

**The block frame C wrote into was still free.** Nothing had reclaimed it, so there was no live object to
corrupt, no vtable, and no virtual call to redirect. The process died from heap damage — the NT heap keeps
its free-list bookkeeping inside the user area of a free block, and the write lands squarely on it — not
from attacker control of the instruction pointer.

> ### QUALIFIER (c), and it travels with the PC-control result
> We *did* demonstrate, offline, that this primitive is sufficient for instruction-pointer control: one
> crafted 108-byte inter frame partially overwrote an object pointer, the vtable was loaded from the
> redirected object, slot 0 was called, and attacker-chosen code ran. **The reclaiming object in that
> experiment was supplied by our harness.** Everything else in the chain ran against the unmodified shipped
> `NPL.dll` on the real NT heap with no hooks and no debugger — but the demonstration shows
> *exploitability if a reclaiming object is reachable*, not a reachable exploit.

**The search for a real reclaiming object has been exhaustive over `.pdata`-covered code, and negative, and
the reason is structural.** The corpus of pointer stores in `NPL.dll` at offsets the write can reach was
enumerated and triaged: **37 of 37 reachable clean-slot pointer stores were taken to a definite verdict, and
every one was excluded.** The systematic reason is worth stating because it is unlikely to be fixed by more
searching: of the rows that are genuine pointer stores, **not one points into memory an attacker can
spray.** They point into module images (`.text` dispatch slots, `.rdata` descriptor tables, a callback in a
loaded module), or they are interior self-pointers inside the same allocation, or they target the generic
small-block heap — and a partial overwrite cannot move a pointer out of its own 4 GiB window, while the
~2 GiB of decoder frame buffers the attacker can spray receives an independent ASLR draw.

Two further constraints compound: a plain polymorphic object can never be the target, because the first 244
bytes of the block are unreachable under every geometry and a vtable sits at offset 0 (so the target must be
array-like or a large struct with a pointer deep inside it); and the attacker's block-size lattice steps by
76 while NT heap buckets step by 16, so only about **15 %** of block sizes are addressable at all.

**Honest status:** *no target found by a search that reached a definite verdict on every reachable
candidate.* That is not the same as "structurally impossible", and we do not claim it is. It is also not
"a crash of unknown exploitability" — the primitive's strength is measured, and what is unresolved is a
question about the victim's heap. Three specific holes remain in that search and we name them rather than
let them pass:

* **The allocator regime is UNDETERMINED.** Whether the freed `mip` block is served by the NT heap's
  low-fragmentation allocator (exact-size buckets) or by the backend (which splits a larger free block) was
  never tested. Roughly twenty of the exclusions are equalities of NT bucket sizes and assume the former. If
  the backend serves it, the constraint weakens from an equality to an inequality and a much larger
  candidate set reopens.
* **The search enumerated pointer *store* sites.** A pointer field populated by `memcpy`, by struct
  assignment, or by a store form the scanner did not match would be invisible to it. A load-side census
  found 138 eight-byte loads at reachable displacements, 26 of them in functions with no corresponding store
  in the triaged list. That corpus has not been taken to a verdict.
* **The `.pdata` blind spot applies here too** — 440,840 bytes of `.text` were not swept.

## 1.8 Bounding negatives — what an attacker cannot do

Each names the instruction or the measurement that stops the attacker, and each carries a label.

* **In this regime the write does not leave the freed block — CONFIRMED (disassembled, re-derived
  algebraically for every geometry).** The array holds `(mb_rows+1)(mb_cols+1)` records. `mi` is record
  `stride+1` counted from `mip`. Counting from `mi`, the row loop's last written record is index
  `mb_rows·stride − 2`, which is **exactly the last record of the array** — the write fills the array to its
  final byte and stops. **There is no spare record: the write is exactly array-bounded, not array-bounded
  with margin.** For the live 4×4 case the last byte written is `mip + 1899`; the 7 bytes from `mip + 1900`
  to `mip + 1906` are `vpx_calloc`'s alignment slack inside the 1923-byte raw block. **This corrects our own
  working note that claimed a 69-byte overrun; that note double-counted a row and compared against the raw
  request.** The corruption is a *use-after-free within the freed block*, which is precisely why a
  reclaiming object is required. (The separate regime where the failure lands on the `mip` calloc instead —
  §1.3.2 — *does* march through live heap, but content control is lost there; see Remediation item 2.)
* **The peer cannot reach a vtable — CONFIRMED (disassembled).** The first `16 + (mb_cols+2)·76 ≥ 244` bytes
  of the freed block are never written under any legal geometry, and a C++ object's vtable pointer sits at
  offset 0.
* **The peer cannot write arbitrary bytes — CONFIRMED (disassembled) for parity; UNDETERMINED for
  magnitude.** Every written motion-vector component is an even `int16` (the doubling at `0x1801c0003` /
  `0x1801c001d` / `0x1801bf3b6` / `0x1801bf3d0`, and the predictor added at `0x1801c0029` / `0x1801c0032` /
  `0x1801bf3bd` / `0x1801bf3da` is itself even). Parity alone constrains a full 8-byte pointer write to
  `2^-4` of 8-byte values. The magnitude bound is the motion-vector clamp and scales with the attacker-chosen
  first-frame geometry; see §1.6.
* **The peer cannot read anything back — UNDETERMINED in the strict sense, but nothing was found.** No
  information-disclosure path from this defect back to the attacker was found in this engagement, so every
  attempt is blind and unverifiable.
* **Audio alone is not enough — INFERRED.** An audio-only call never instantiates a VP8 decoder: the
  `VpxDecoder` node is only built on the video receive graph. We did not retain a probe log for an
  audio-only call, so we label this INFERRED from the graph construction rather than measured. The victim
  must have video enabled. *(Note this bounding negative does **not** apply to Section 2, whose live carrier
  was the audio leg.)*
* **The media relay cannot forge these frames — CONFIRMED (disassembled) for the ordering; INFERRED for the
  conclusion.** The VP8 payload is encrypted before the `Serializer` writes `PacketHeader` (send order
  `VpxEncoder → CryptProxy → Serializer`, CONFIRMED), so the relay/SFU holds no key for it and cannot
  produce a payload the victim will accept; it can drop or corrupt one, which the AEAD rejects. Hub-side
  traffic was never captured — the rules of engagement excluded it — so this is a consequence of the
  client-side ordering rather than a direct observation. (A separate observation about the *unauthenticated
  packet header* is reported in Section 2 and does not apply here.)
* **`NPL.dll`'s vendored libjpeg-turbo is not reachable from peer bytes — CONFIRMED (disassembled) for the
  gates; INFERRED for the closure.** The only route into it is `Musigy::AV::ColorspaceConverter`
  source-format 17 (MJPEG), and the jump table that selects it is gated on the **destination** format being
  YUV420P (`0x180125964  cmp eax, 1` / `0x180125967  jne 0x180125e25`). No construction site we found can
  produce that destination: the converter's constructor refuses to build for destination 1
  (`0x1800f0570  cmp eax, 1` / `0x1800f0573  je 0x1800f0615`), and otherwise subtracts two
  (`0x1800f0579  83c0fe  add eax, -2` — quoted because without it the next compare looks like the wrong
  arithmetic) before bounding to `[2,13]` (`0x1800f057c  cmp eax, 0xb` / `ja`). That this is the only
  construction site is **INFERRED**. That what feeds this copy is the **local DirectShow webcam** negotiating
  MJPEG is **INFERRED**, carried from an earlier phase and not re-derived here. (The separate libjpeg-turbo
  copies inside `Qt6Pdf.dll` and `Qt6WebEngineCore.dll` **are** reachable from remote content and are
  reported in §4.3.)
* **The client's TLS pin validator fails closed — CONFIRMED (disassembled) for the control flow; INFERRED
  for the identification.** `0x1409c7024  4883b95803000000  cmp qword ptr [rcx+0x358], 0` /
  `0x1409c702c  7418  je 0x1409c7046` / `0x1409c7046  32c0  xor al, al` means "no pin configured ⇒ reject",
  not "⇒ accept". Re-read from the shipped file this pass. **That this 45-byte function is the
  certificate-pin validator is INFERRED** — nothing in those 45 bytes identifies it as such; the
  identification is inherited from an earlier phase. All four `ignoreSslErrors` call sites in
  `WickrPro.exe` are guarded.
* **The message database is encrypted at rest — CONFIRMED (measured).** `wickr_db.sqlite` does not begin
  with the `SQLite format 3` magic and measures 7.999 bits/byte whole-file; its write-ahead log parses
  exactly and no frame contains `CREATE TABLE` or `SQLite` (§5.1). *We do **not** carry forward the further
  claim that "the MLS ingest/decode/verify path is memory-safe Rust": what is supportable is that
  `WickrMlsSdkCpp.dll` is built from `mls-rs 0.54.0` and companions with Rust panic machinery present
  (CONFIRMED, strings). A whole-path memory-safety claim is not something we measured.*
* **The crash-report destination is not attacker-redirectable — CONFIRMED (disassembled).** The Sentry
  minidump URL is built from a compile-time template at `WickrPro 0x14328ba08`,
  `https://%1.ingest.sentry.io/api/%2/minidump/?sentry_key=%3`, referenced exactly once in `.text`; a second
  template at `0x14328ba48` (`https://%1@%2.ingest.sentry.io/%3`) supplies the DSN. Both pin the registrable
  domain to `sentry.io`. The handler's only destination is its own `--url=` argument. Nothing on the
  peer-reachable path lets a remote party choose where the bytes go. *(That the crash **can** be forced on
  demand, and that the dump leaves the device with no consent gate, is Finding 5b.)*

## 1.9 Remediation

Concrete, in the order we would apply them.

1. **Null `pc->mi` and `pc->prev_mi` in `vp8_de_alloc_frame_buffers` (`NPL 0x180186320`), alongside the
   `mip` / `prev_mip` stores it already performs.** Two lines. `mip` (`+0xc58`) is nulled at `0x1801863e0`
   and `prev_mip` (`+0xc68`) at `0x1801863d2`; add the matching stores to `+0xc60` and `+0xc70`. This turns
   the use-after-free into a NULL dereference and removes the exploitable primitive entirely. **It is the
   only single change that closes both routes** — the six failure exits inside `vp8_alloc_frame_buffers`
   *and* the `prev_mip` route at `0x18017ddce` (§1.3.4).

2. **Clamp the decoded frame dimensions before allocating.** The 14-bit fields permit 16383×16383; no
   conferencing client needs anything near it. Reject a frame whose geometry exceeds the negotiated
   `VideoFormat` (or a hard ceiling such as 4096×4096) *before* `vp8_alloc_frame_buffers` runs — either at
   `vp8_peek_si` (`0x18017e584` / `0x18017e59c`, immediately after the `and …, 0x3fff`) or at the
   `Musigy::AV::VpxDecoder` boundary. Alternatively, stop passing `cfg.w = cfg.h = 0` at `NPL 0x1801446fe`
   and let libvpx enforce the negotiated geometry itself. **This one change closes the gate for this defect
   and removes the denial of service in Section 3.** It also removes the second, worse corruption regime:
   if the failure is steered onto the `mip` calloc at `0x1801861c9` instead of onto a frame buffer, the new
   geometry is already committed (`0x18018619e`–`0x1801861b5`) and the subsequent write marches hundreds of
   kilobytes through live heap.

3. **Tear the decoder down on any allocation failure.** `vp8_decode`'s `setjmp` landing pad (`0x18017db24`)
   clears `cm->error.setjmp` and `ctx->si.w/h` and returns `-1`; the decoder object is never destroyed —
   `vpx_codec_dec_init_ver` (`0x18017d4a0`) is called exactly once, at `0x180144731`, and the interface's
   `destroy` slot (`0x180461f70 + 0x18` → `0x18017d710`) has no direct callers. Destroy and re-create the
   codec instance on a `VPX_CODEC_MEM_ERROR` rather than continuing to feed a half-freed context. **Note
   this item alone is not sufficient** — item 1 is what closes both routes.

4. **Update the bundled libvpx.** The shipped copy self-reports v1.9.0 (`NPL 0x180462000`, reached from
   `iface 0x180461f70 + 0x00`; the interface's `init` is `0x18017d660` and `destroy` is `0x18017d710` —
   all CONFIRMED this pass). Our earlier draft named `0226b9516` as the upstream commit that adds the
   `mi = NULL` store and `44a5eaa3b` as its companion. **Those two hashes are INFERRED** — carried from an
   earlier source review and **not re-verified in this pass**, because the rules of engagement here are
   static analysis and local file inspection with no network access. A version bump is the right fix
   regardless; the maintainer should confirm the exact commits before citing them.

5. **Turn CFG on at the main image.** `WickrPro.exe` ships with `DllCharacteristics = 0x8160` — no
   `GUARD_CF` — and `NPL.dll` with `0x0160`. CFG is opt-in at the main image, so instrumentation that other
   loaded DLLs already carry is inert for the whole process (§4.2). Link-flag change, not a code change.

6. **Consider isolating media decode.** Today the VP8 decoder shares an address space with the UI, the key
   material and the message store.

### Evidence index for this section

| Claim | Where to re-check it |
|---|---|
| `mi` / `prev_mi` never nulled | `NPL 0x180186320`, 210 bytes; structure-relative displacement census returns `{0x780, 0xa20, 0xac0, 0xb60, 0xc00, 0xc08, 0xc58, 0xc68, 0x19d8, 0x22c8}` |
| de-alloc on entry and on failure; six failure exits | `0x1801860a4`, `0x180186293`; branches `0x18018610a`, `0x18018618b`, `0x1801861d8`, `0x180186215`, `0x180186230`, `0x18018628a` |
| the seventh route, outside `vp8_alloc_frame_buffers` | `0x18017ddba` → `0x18017ddc9` → `0x18017ddce` → `0x18017dde2` |
| `mi = mip + (mb_cols+2)·76`, `sizeof(MODE_INFO) = 76` | `0x1801861c1`, `0x1801861de`–`0x1801861f6` |
| geometry committed before the `mip` calloc | `0x18018619e`–`0x1801861b5` vs `0x1801861c9` |
| block size `= 76k + 23`, user pointer `= raw + 16` | `vpx_calloc 0x18017f386`, `0x18017f3a6`, `0x18017f3aa` |
| decoder survives the failure | `0x18017dbb7`, `0x18017dbcf`, `0x18017ae70` → `0x18017af00`, landing pad `0x18017db24` |
| decoder constructed once, never destroyed | `vpx_codec_dec_init_ver 0x18017d4a0`, single call site `0x180144731` |
| 14-bit dimensions, no clamp | `0x18017e584`, `0x18017e59c`, `0x1801ae1f1`, `0x1801ae21d`; two sync-code testers in the whole image |
| `cfg.w = cfg.h = 0`, `threads = 1` | `0x1801446fe`, `0x180144709`, `0x180144731` |
| two decoder contexts, bit-14 index | `0x180144685`, `0x180144773`, `0x180144777`, `0x1801447ac`–`0x1801447bb` |
| motion-vector parity and predictor | `read_mvcomponent 0x1801c0180`; `0x1801c029e`; doubling `0x1801c0003` / `0x1801bf3b6`; predictor `0x1801c0029` / `0x1801bf3bd` |
| CFG absent | `NPL.dll` `0x0160`, `WickrPro.exe` `0x8160` |
---

# SECTION 2 — F2: peer- and relay-reachable heap out-of-bounds write driven by a peer-declared length

**Class:** CWE-787 (out-of-bounds write), with a CWE-125 out-of-bounds read on the same packet
**Component:** `NPL.dll` `Musigy::AV::Parser` (packet header parse) → `WickrPro.exe` media decrypt callback
**Attacker position:** (a) any authenticated participant in a call with the victim; (b) whoever controls or
compromises the media hub — see Appendix 2A
**Victim precondition:** being in a call. **No video, no user interaction, no accepted file, no click, and
no memory configuration.**

**Status: defect CONFIRMED by disassembly at every link; remote control of the length operand and the
out-of-bounds write itself CONFIRMED by measurement over a live call — with the attacker's own client
patched in memory (11 bytes at `NPL 0x18011d592`) so that it declares a chosen `Buffer.size`. That models a
malicious peer, which is the threat model, and is not a defect in the victim. The victim ran shipped,
unmodified binaries; the only change to the victim process was two 5-byte read-only probe detours (§2.6).
Qualifier (b) applies throughout this section. Qualifiers (a) and (c) do not arise: this finding asserts no
allocation failure and no instruction-pointer control, and §2.5 and §2.8 close off the content-control
direction explicitly.**

This supersedes REPORT 1 of our internal `DISCLOSURE-DRAFT-h1.md`. The mechanism there was right; three of
its statements were not, and each correction is called out where it belongs (§2.3, §2.6.1, Appendix 2A).

Every address below was re-disassembled from the shipped files during the writing of this section. Where a
claim rests on a measurement rather than on the bytes, it says so and names the log.

## 2.1 Summary

`Musigy::AV::Parser`'s `kind == 2` handler binds a **peer-declared length** onto the **actually received,
shorter** payload buffer and never compares the two. That length travels unchanged into WickrPro's media
decrypt callback, where it is used first as the length of a `QByteArray` deep copy (an out-of-bounds read)
and then as the count argument to `memset` (an out-of-bounds write of attacker-chosen length) in the
unsandboxed main process.

Two things make this a defect rather than a design decision, and both are visible in the shipped bytes:

* **The sibling branch of the same function performs exactly the check the vulnerable branch omits**
  (§2.3). One `je` selects between them.
* **The parser does not treat the field as needing validation, and the code that *does* validate is
  hand-written and applied only to the sibling branch.** `kind` is validated to exactly 1, 2 or 3 in
  `PacketHeader::_InternalParse` (`0x18013b930`, checks at `0x18013ba51`–`0x18013ba5e`) because protoc
  emits closed-enum validation; `Buffer.size` is a `uint32` in a *different* generated parser,
  `PacketHeader_Buffer::_InternalParse` (`0x18013a940`), and is stored verbatim at `0x18013aa2c` because
  protoc never range-checks scalars. **Neither generated parser is where the check belongs** — the
  hand-written code that does perform it applies it only to the plane branch.

A second, independent control is also absent: `CryptProxy` never tests the crypt callback's result. A frame
whose authentication failed is forwarded to the decoders anyway (§2.7).

## 2.2 The substitution — `NPL.dll`

### 2.2.1 The field is off the wire and is not clamped anywhere

**CONFIRMED — disassembled.** `PacketHeader.kind` is re-parsed from every inbound packet and dispatched:

```
0x18011fdca: 488b97e8000000  mov  rdx, [rdi + 0xe8]      ; the parsed PacketHeader
0x18011fdd1: 8b4a64          mov  ecx, [rdx + 0x64]      ; kind -- straight off the wire
0x18011fdd4: 83e901          sub  ecx, 1
0x18011fdd7: 0f84e1010000    je   0x18011ffbe            ; kind 1
0x18011fddd: 83e901          sub  ecx, 1
0x18011fde0: 0f84ca010000    je   0x18011ffb0            ; kind 2  ->
0x18011fde6: 83f901          cmp  ecx, 1
0x18011fde9: 0f84b3010000    je   0x18011ffa2            ; kind 3

0x18011ffb0: 488d4f90        lea  rcx, [rdi - 0x70]
0x18011ffb4: 4c8bc6          mov  r8, rsi
0x18011ffb7: e8b4efffff      call 0x18011ef70            ; <== the kind==2 handler
```

`Buffer.size` — field 1, wiretype 0, of the nested `Musigy::AV::Proto::PacketHeader_Buffer` — is decoded by
the generated parser at `0x18013a940` (`.pdata` extent RVA `0x13a940`–`0x13aab0`, 368 bytes), which matches
the tag (`shr eax,3 / cmp eax,1` at `0x18013a9de`, `cmp dil, 8` at `0x18013a9e6`) and stores it verbatim:

```
0x18013aa2c: 895518          mov dword ptr [rbp + 0x18], edx   ; Buffer.size := peer varint, NO CLAMP
```

There is no comparison, no clamp and no `min` at this site, at the Frame constructor (§2.2.3), or at the
accessor `NPLAVPacketGetBuffer` (§2.4.1). The value is finally consumed **zero-extended into a 64-bit
register** as the `size_t` count argument of `memset` (§2.4.2), so **the field's range at the sink is
`0 … 0xFFFFFFFF`. The practically usable range is smaller and is bounded by the over-read that runs first
(§2.6.2); its upper bound was not measured and depends on the backing allocation (§2.9).** Values of 300 and
4096 were driven end to end and observed at the sink (§2.6).

### 2.2.2 The handler takes the peer's length and the real pointer

**CONFIRMED — disassembled.** `Musigy::AV::Parser` `kind==2` handler, `NPL 0x18011ef70` (`.pdata` extent RVA
`0x11ef70`–`0x11f897`, 2,343 bytes):

```
0x18011efac: f6421001        test  byte ptr [rdx+0x10], 1  ; has-bit: is PacketHeader.buffer present?
0x18011efb0: 0f84f2000000    je    0x18011f0a8             ;   absent -> the PLANE branch (checked!)
0x18011efb6: 488b4230        mov   rax, [rdx + 0x30]       ; the Buffer sub-message
0x18011efba: 4c8d35971b4100  lea   r14, [rip + 0x411b97]   ; = 0x180530b58, the default instance
0x18011efc1: 4885c0          test  rax, rax
0x18011efc4: 4c0f45f0        cmovne r14, rax               ; protobuf _internal_buffer()
...
0x18011efef: 458b4618        mov   r8d, dword ptr [r14+0x18]  ; arg3 size := PEER-DECLARED Buffer.size
0x18011eff3: 488b5610        mov   rdx, qword ptr [rsi+0x10]  ; arg2 data := the REAL payload pointer
0x18011eff7: 498bcf          mov   rcx, r15
0x18011effa: e8a16e0100      call  0x180135ea0                ; Frame constructor
```

`r8d` comes out of the **protobuf message**; `rdx` comes out of the **received packet object**. Between the
two loads and the call there is no `cmp`, no clamp, no `min`.

Note the selection rule at `0x18011efac`: the Buffer branch is taken **whenever the has-bit is set**, before
anything about the media type is considered. Setting `PacketHeader.Buffer` is by itself sufficient to route
a packet down the unchecked branch.

### 2.2.3 The Frame constructor neither copies nor clamps

**CONFIRMED — disassembled.** `0x180135ea0` (`.pdata` extent RVA `0x135ea0`–`0x136080`, 480 bytes),
arguments `(rcx=this, rdx=data, r8d=size, …)`:

```
0x180135eb4: 458bf0          mov    r14d, r8d          ; keep the PEER-DECLARED size
0x180135ebe: 4585c0          test   r8d, r8d
0x180135ec1: 480f45ea        cmovne rbp, rdx           ; rbp = the real data pointer iff size != 0
0x180135ed6: b8d0000000      mov    eax, 0xd0          ; base object size
0x180135edb: 4885ed          test   rbp, rbp
0x180135ede: 750c            jne    0x180135eec        ; pointer supplied -> do NOT size the allocation
0x180135ee0: 4585c0          test   r8d, r8d
0x180135ee3: 7407            je     0x180135eec
0x180135ee5: 418d86df000000  lea    eax, [r14 + 0xdf]  ; only the no-pointer case allocates size bytes
```

With a pointer supplied — which is this case — the allocation stays `0xd0` bytes and the object merely
stores the `(pointer, length)` pair. We enumerated every call in the 480-byte function: `0x180135f06`,
`0x180135f0e`, `0x180135fc4` — **no `memcpy` and no `rep movs`**, so no copy happens here and nothing bounds
it here either.

```
0x180135ff9: 48896e40      mov qword ptr [rsi+0x40], rbp   ; plane[0] base = the real payload pointer
0x18013603e: 48896e10      mov qword ptr [rsi+0x10], rbp   ; and again at +0x10
0x180136049: 44897618      mov dword ptr [rsi+0x18], r14d  ; +0x18 = the PEER-DECLARED size
```

`+0x40`/`+0x18` is the pair `NPLAVPacketGetBuffer` hands to WickrPro; `+0x10`/`+0x18` is the pair
`VpxDecoder` reads (`mov r8d,[rbx+0x18]` @ `0x180144ba7`, `mov rdx,[rbx+0x10]` @ `0x180144bab`,
`call 0x18017d5c0` @ `0x180144bb3` — the callee's identity as `vpx_codec_decode` is **INFERRED**: there is
no symbol, but the function reproduces `vpx_codec_decode`'s argument validation, rejecting `(!ctx)`,
`(!data && data_sz)` and `(data && !data_sz)` with error 8 = `VPX_CODEC_INVALID_PARAM`). One object, one
length field, and that field's value came off the wire.

## 2.3 Why this is a defect and not a design choice — the sibling branch does the check

**CONFIRMED — disassembled.** When `PacketHeader.buffer` is absent, the `je` at `0x18011efb0` sends control
to `0x18011f0a8`. That branch first precomputes, for each received buffer, its **real** end address as
`base + stride·height`:

```
0x18011f0c4: 498b5040      mov   rdx, qword ptr [r8+0x40]   ; buffer base
0x18011f0d2: 418b4070      mov   eax, dword ptr [r8+0x70]   ; real height of the RECEIVED buffer
0x18011f0d6: 410faf4060    imul  eax, dword ptr [r8+0x60]   ; x real stride
0x18011f0db: 4863c8        movsxd rcx, eax
0x18011f0de: 4803ca        add   rcx, rdx
0x18011f0e1: 48894d88      mov   qword ptr [rbp-0x78], rcx  ; end[0]  (end[1..3] at -0x70,-0x68,-0x60)
```

and then, per peer-declared plane, refuses the pointer if the declared extent does not fit:

```
0x18011f196: 8b4118        mov   eax,  dword ptr [rcx+0x18]      ; peer-declared plane stride
0x18011f1a0: 448b511c      mov   r10d, dword ptr [rcx+0x1c]      ; peer-declared plane height
0x18011f1ac: 440fafd0      imul  r10d, eax                       ; declared extent
0x18011f1bd: 4c03d2        add   r10, rdx                        ; base + declared extent
0x18011f1c0: 4e3b54f588    cmp   r10, qword ptr [rbp+r14*8-0x78] ; <== vs the REAL buffer end
0x18011f1c5: 7608          jbe   0x18011f1cf                     ; fits -> keep the pointer
0x18011f1c7: 498bd4        mov   rdx, r12                        ; does not fit -> NULL it out (r12 = 0)
0x18011f1ca: 498bcc        mov   rcx, r12
```

One function, one conditional branch, two behaviours: the plane branch compares a peer-declared extent
against the real received extent and rejects on mismatch; the Buffer branch does not compare at all.

> **Correction to our earlier draft.** It described the two as "twenty instructions apart". They are not.
> The unchecked construction is at `0x18011effa`; the check on the other side of the same `je` is at
> `0x18011f1c0`, 76 instructions further along the sibling path by linear decode from `0x18011f0a8`. The
> structural point stands unchanged and does not need the number: both branches are inside one 2,343-byte
> function and are selected by the single `je` at `0x18011efb0`.

The two branches also line up on the send side, which is worth stating because it shows the check was
written against a real serialiser field. `Musigy::AV::Serializer` emits, per non-null plane, exactly the two
fields the plane branch validates — `[r8+0x18]` at `0x18011d534` and `[r8+0x1c]` at `0x18011d542` (the
`or edx,2` at `0x18011d53b` and the has-bit store at `0x18011d53e` sit between them) — inside the loop that
falls through to the Buffer arm at `0x18011d557`.

## 2.4 Where it lands — `WickrPro.exe`

### 2.4.1 The accessor passes the peer's number through untouched

**CONFIRMED — disassembled.** `NPLAVPacketGetBuffer` (`NPL 0x1803d0de0`) is a **leaf function with no
`.pdata` record** (the exception table skips from `0x3d0ba0`–`0x3d0dd4` to `0x3d0e50`–`0x3d0f34`); it runs
102 bytes, from `0x1803d0de0` to the `ret` at `0x1803d0e45`, read complete:

```
0x1803d0dff: 4a8b44d140    mov   rax, qword ptr [rcx + r10*8 + 0x40] ; *outPtr = Packet+0x40+idx*8
0x1803d0e04: 498900        mov   qword ptr [r8], rax
0x1803d0e10: 8b4118        mov   eax, dword ptr [rcx + 0x18]         ; *outLen = Packet+0x18, verbatim
0x1803d0e13: 418901        mov   dword ptr [r9], eax
0x1803d0e18: 41c70100000000 mov  dword ptr [r9], 0                   ; (plane index != 0 -> 0)
```

No arithmetic. This closes an old open question in our own notes: there is no `+29` and no `-29` in the
accessor. The `29` is a *downstream subtraction* and is discussed in §2.7.

### 2.4.2 The read and the write

**CONFIRMED — disassembled; the full 337-byte function was read.** The consumer is WickrPro's media decrypt
callback at `0x14013f390` (`.pdata` extent RVA `0x13f390`–`0x13f4e1`).

*How it is bound, stated precisely because a vendor engineer will grep for it:* nothing in `WickrPro.exe`
references `0x14013f390` as data — we searched the mapped image and the raw file for both a qword VA and any
rip-relative `lea` and found zero. What is registered next to the `"decryptCallback"` literal at
`0x141d556d0` (referenced at `0x14014faf7` and `0x1401514e4`) is the four-instruction adapter at
`0x140147150`, which shuffles `(rcx,rdx,r8) → (r8,rcx,rdx)` and tail-jumps `0x14013f390` at `0x140147166`.
That shuffle is what makes `rbx` the Packet at `0x14013f3b2`, and it is gated on `r8 != 0` and `r9d == 0` —
both satisfied on this path, since `CryptProxy` zeroes `r9d` at `0x18011b67f` before `call rax`.

```
0x14013f3df: ff154345c100  call [rip+0xc14543]  ; = [0x140d53928] NPL!NPLAVPacketGetBuffer(pkt,0,&ptr,&n)
                                                ;   n   -> [rsp+0x30]  = PEER-DECLARED Buffer.size
                                                ;   ptr -> [rsp+0x38]  = the REAL payload
0x14013f3ec: ff153e45c100  call [rip+0xc1453e]  ; = [0x140d53930] NPL!NPLAVPacketGetDescriptor
0x14013f3f2: 448b442430    mov  r8d, dword ptr [rsp+0x30]  ; n   = PEER-DECLARED size
0x14013f3f7: 488b542438    mov  rdx, qword ptr [rsp+0x38]  ; src = the REAL (shorter) payload
0x14013f401: ff15914cc100  call [rip+0xc14c91]  ; = [0x140d54098] QByteArray(const char*, qsizetype)
                                                ;   <== heap OOB READ: deep-copies n bytes
0x14013f44e: e89d5c9e00    call 0x140b250f0                ; decrypt
0x14013f458: ff15a24cc100  call [rip+0xc14ca2]  ; = [0x140d54100] QByteArray::length()
0x14013f45e: 4885c0        test rax, rax
0x14013f461: 7e2b          jle  0x14013f48e                ; empty plaintext -> the memset arm
0x14013f482: 488b4c2438    mov  rcx, qword ptr [rsp+0x38]  ; dst = the REAL payload
0x14013f487: e8d1995d00    call 0x140718e5d                ; memcpy(real, plaintext, plaintext_len)
0x14013f48e: 448b442430    mov  r8d, dword ptr [rsp+0x30]  ; n   = PEER-DECLARED size
0x14013f493: 33d2          xor  edx, edx                   ; c   = 0
0x14013f495: 488b4c2438    mov  rcx, qword ptr [rsp+0x38]  ; dst = the REAL payload
0x14013f49a: e8e8995d00    call 0x140718e87                ; <== heap OOB WRITE: memset(real, 0, n)
```

Identities resolved through WickrPro's import table, not assumed from context:

| slot | import |
|---|---|
| `0x140d53928` | `NPL.dll!NPLAVPacketGetBuffer` |
| `0x140d53930` | `NPL.dll!NPLAVPacketGetDescriptor` |
| `0x140d54098` | `Qt6Core.dll!??0QByteArray@@QEAA@PEBD_J@Z` — `QByteArray(const char*, qsizetype)` |
| `0x140d54100` | `Qt6Core.dll!?length@QByteArray@@QEBA_JXZ` |
| `0x140718e5d` → `jmp [0x140d57fe8]` | `VCRUNTIME140.dll!memcpy` |
| `0x140718e87` → `jmp [0x140d58030]` | `VCRUNTIME140.dll!memset` |

## 2.5 Why the over-write is the guaranteed outcome, not an edge case

**CONFIRMED — disassembled.** The media AEAD is **AES-256-GCM**, the tag is verified, and the result of that
verification is checked.

The wire blob is parsed at `0x140cb1190` (`.pdata` extent RVA `0xcb1190`–`0xcb1311`, 385 bytes). Its first
byte selects one of two parameter records, read out of the mapped image:

```
0x1432e25a0:  00 00 00 00 20 0c 10 01    algo 0  keylen 32  ivlen 12  taglen 16  has_tag 1
0x1432e25a8:  01 00 00 00 20 10 00 00    algo 1  keylen 32  ivlen 16  taglen  0  has_tag 0
```

```
0x140cb11b6: 0fb608      movzx ecx, byte ptr [rax]     ; algorithm selector = first wire byte
0x140cb11d2: 440fb64305  movzx r8d, byte ptr [rbx+5]   ; ivlen
0x140cb11d7: 0fb64306    movzx eax, byte ptr [rbx+6]   ; taglen
0x140cb11db: 4d8d6001    lea   r12, [r8+1]
0x140cb11df: 4c03e0      add   r12, rax                ; overhead = 1 + ivlen + taglen
0x140cb11e2: 4d3926      cmp   qword ptr [r14], r12
0x140cb11e5: 7258        jb    0x140cb123f             ; shorter than the overhead -> reject
```

For algo 0 the overhead is `1 + 12 + 16 = 29`, and the layout is
`algorithm(1) || IV(12) || TAG(16) || ciphertext`. The algorithm byte is off the wire but a downgrade to the
untagged algo 1 is blocked one level down: the parsed algorithm must equal the algorithm carried in the key
object.

```
0x140cb8a06: 8b09          mov  ecx, dword ptr [rcx]   ; parsed algorithm
0x140cb8a15: e87b3b0000    call 0x140cbc595            ;   algo 1 -> crypto.dll!EVP_aes_256_ctr
0x140cb8a1c: e8983b0000    call 0x140cbc5b9            ;   algo 0 -> crypto.dll!EVP_aes_256_gcm
0x140cb8a2f: 394500        cmp  dword ptr [rbp], eax   ; key object's algorithm must MATCH the wire's
0x140cb8a32: 0f85c5010000  jne  0x140cb8bfd            ;   <== no peer downgrade
...
0x140cb8bb6: e8f2390000    call 0x140cbc5ad            ; crypto.dll!EVP_DecryptFinal_ex — TAG CHECK
0x140cb8bbb: 83f801        cmp  eax, 1
0x140cb8bbe: 751c          jne  0x140cb8bdc            ; <== CHECKED: failure frees the output and
                                                       ;     returns 0 -> empty QByteArray -> memset arm
```

(The dispatch reaches `0x140cb8a1c` for algo 0 via `je` at `0x140cb8a0a` and falls through to
`0x140cb8a15` for algo 1. All three `EVP_*` thunk identities were resolved through the import directory this
pass.)

**The tag sits inside the payload the attacker really sent** — at bytes `[13, 29)` of the blob, a fixed
offset the length inflation does not move. Inflating `Buffer.size` therefore cannot damage the tag, the IV
or the algorithm byte. What it does is extend the **ciphertext** slice with adjacent heap bytes, which GCM
authenticates and which the attacker does not control. Authentication fails by construction, the decrypt
returns an empty `QByteArray`, `jle` at `0x14013f461` is taken, and the zero-fill runs.

Two consequences the vendor should read together:

* **The out-of-bounds write is the default result of the attack, not a probabilistic one.**
* **The `memcpy` arm at `0x14013f487` is unreachable under inflation**, and it copies only
  `plaintext.length()` bytes, which GCM bounds to the real ciphertext. So this sink gives an attacker
  *length* control but not *content* control. That is a real limit, and §2.8 does not claim past it.
## 2.6 What was measured

Two operator-owned machines, two operator-owned accounts.

> **QUALIFIER (b) — carry this with every number below.** The attacker's **own** client was patched in
> memory, an 11-byte window inside `Musigy::AV::Serializer::onPacket` at `NPL 0x18011d592`, so that its
> declared `Buffer.size` becomes a constant `C` instead of the real payload length. That models a malicious
> peer, which is precisely the threat model for an end-to-end-encrypted product, and it is **not** a defect
> in the victim. (This is a different modification from the 6-byte `encryptCallback` patch used in Sections
> 1 and 3; do not conflate them.)
>
> **The victim runs shipped, unmodified binaries.** The only change to the victim *process* is two 5-byte
> read-only probe detours installed in memory at `0x14013f495` and `0x14013f49f`, which do not alter the
> packet, the length, or the `memset` arguments (§2.6.2). Only the sender's *behaviour* is modified.

The patched window, verified against the shipped bytes:

```
0x18011d557: 418b8690000000  mov eax, [r14+0x90]      ; gate: only packets carrying a Buffer submessage
0x18011d55e: d1e8            shr eax, 1
0x18011d560: a801            test al, 1
0x18011d562: 7439            je  0x18011d59d
...
original @0x18011d592 (11 bytes):
  41 8b 4e 18     mov ecx, [r14+0x18]      ; the REAL payload length
  83 48 10 01     or  dword [rax+0x10], 1  ; Buffer field-1 has-bit
  89 48 18        mov [rax+0x18], ecx      ; Buffer.size = real
patched:
  83 48 10 01     or  dword [rax+0x10], 1  ; has-bit preserved
  c7 40 18 <imm32>                         ; mov dword [rax+0x18], C
```

`ecx` is dead across the window (its next reference is a fresh write at `0x18011d5b2`); a capstone scan of
every `.pdata` function in `NPL.dll` found no branch target inside `[0x18011d593, 0x18011d59d)`;
`rax`/`r14`/`rdi`/`rsi` are untouched; both the original and the replacement leave flags from the same `or`.
Applied with **no call active** — the send graph is built once per call — then a fresh call is placed.

### 2.6.1 The peer controls the length end to end — MEASURED

Sender pinned to `C = 300`; victim unmodified, instrumented at the decrypt callback.

Raw data: `lenprobe-baseline.log`, `lenprobe-patched-C300.log`, `E2E-F4-1-RESULT.txt`. **Note on the second
file: it is one cumulative capture.** Records 1–243 are the baseline phase and are byte-identical to
`lenprobe-baseline.log` (same md5). The patched column below is records 244–1773. Counting the whole file
yields 1,773 records and 113 `Buffer`-branch packets, not the column totals.

| | baseline (unpatched) | patched, C = 300 |
|---|---|---|
| decrypt-callback records | 243 | 1,530 |
| `Buffer`-branch packets | 69 | 44 |
| **distinct `n` values among those** | **21** | **2** |
| **`n == 300`** | **0** | **43** |
| `n == 301` (baseline's dominant value) | 43 | 0 |
| plane-branch packets | 174 (165 distinct) | 1,486 (836 distinct) — untouched |

Baseline `Buffer`-branch values: 181, 183, 184, 185, 186, 187, 188, 192, 195, 198, 207, 214, 228, 243, 281,
293, 294, 301, 303, 309, 319. Patched: {230, 300}.

**43 of the 44 `Buffer`-branch packets carried `n == C` exactly, with no offset.** A value that occurs zero
times in 243 benign records becomes the entire class, and the previously dominant value disappears. No
benign sender can produce a constant `n` across frames whose real sizes vary.

> **Correction to our earlier draft**, which recorded this as "43/43". The measurement is **43 of 44**. The
> 44th packet carried 230; whether it was emitted before the patch took effect or originated somewhere other
> than the patched site is **UNDETERMINED**. The conclusion is unaffected — a single non-conforming sample
> does not weaken a class that a benign sender cannot produce at all — but the number should be quoted
> correctly.

### 2.6.2 The write goes out of bounds — MEASURED byte-for-byte

The obvious experiment is impossible, and it is worth saying why so the vendor does not repeat it: the
over-read at `0x14013f401` and the `memset` at `0x14013f49a` cover the **same** byte range and **the read
runs first**. Any `n` large enough to leave mapped memory faults on the read, so an access violation
*inside* the `memset` is unobservable by range extension, and Full Page Heap does not help — the guard page
is hit by the read.

Instead: keep the whole range mapped, and read the adjacent heap **before and after** the `memset`,
in-process, on the same packet. Two 5-byte detours bracketing the call:

```
0x14013f495  48 8b 4c 24 38  mov rcx,[rsp+0x38]   <- SITE A, immediately BEFORE
0x14013f49a  e8 e8 99 5d 00  call 0x140718e87     ;  memset(ptr, 0, n)
0x14013f49f  48 8d 4c 24 48  lea rcx,[rsp+0x48]   <- SITE B, immediately AFTER
```

A branch-into-range scan over every `.pdata` function in `WickrPro.exe` found no target strictly inside
either window (window B has exactly one target, at its first byte: the `jmp` at `0x14013f48c` from the
memcpy arm, so B records are only scored when paired with an immediately preceding A record carrying the
same `ptr`). The stubs read only; they touch `rax`/`r10`/`r11`, push nothing, and leave `rcx`/`rdx`/`r8`
alone.

**Result at `C = 4096`, sampling 64 bytes at `ptr + 1024` — 3 of 3 conclusive samples confirm the write**
(`oobprobe-C4096.log`). Benign payloads measured 181–319 bytes, so `+1024` is certainly outside the received
payload and certainly inside the 4,096-byte `memset` range.

```
packet ptr=0x801128afcc  n=4096  window=ptr+1024..+1087
   before: 5a e5 b1 ac d1 18 cc f2 35 e5 49 49 08 ca 56 c9 3d fb 0f 18 7d 8b 3b c1 ...
   after : 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ...
   zero bytes: before 0/64   after 64/64
packet ptr=0x801128976c  n=4096  before 21/64 zero   after 64/64 zero
packet ptr=0x801128cc3c  n=4096  before  0/64 zero   after 64/64 zero
```

Three further samples were logged `INCONCLUSIVE (window was already zero before)` and are **not** scored as
confirmations. One of them is `ptr=0x801128976c` seen a second time — already zeroed by its own earlier
`memset`, which is a useful internal consistency check. `n == 4096 == C` again.

**Density of live data in the overwritten region — MEASURED.** Two further runs at `C = 640` and `C = 768`
sampled 8-byte slots across the band `+304 … +752` (`groomingmap-C640-C768-band304.log`,
`groomingmap-C768-band640.log`): **402 of 1,392 sampled slots (28.9 %) held live non-zero values that the
`memset` zeroed.** `+304` is the only sampled offset that could still fall inside a maximal 319-byte
payload; from `+336` upward every sample is unambiguously past the end of the received payload, and there
the figure is 346 of 1,284 (26.9 %).

**Scope of that statement, stated exactly:** these measure distance past the **received payload**, not past
the **backing allocation**. Whether the payload sits in an exactly-sized block or a fixed MTU-class pool
slab is **UNDETERMINED** (§2.9). What is measured is that live non-zero data past the received payload was
zeroed.

The same runs bound the *other* direction usefully: exactly **1 of those 1,392 slots held a pointer-valued
qword**, and it was zeroed. Pointer density in the reachable adjacency is low without grooming.

### 2.6.3 The application's own log corroborates the failure arm

Captured on the victim during the `C = 4096` run, in `*_npl.txt`; this string had not appeared in any
previous capture:

```
[W AV.CryptProxy.<id>] All bytes set to zero, decryption failed most likely   x3
[E PacketBundleDecoder] Illegal size (4067 bytes), skipping                   x3
```

Both lines are traceable to the shipped bytes. The first is assembled in `CryptProxy::onPacket` from
`'All bytes set to zero, '` (UTF-16 @ `NPL 0x18043e800`), the direction word — `'decryption'` @
`0x18043e830` or `'encryption'` @ `0x18043e848`, selected by `cmp dword [rsi+0x118], 0 / cmovl rdx, rcx` at
`0x18011b7ba`/`0x18011b7c1` — and `' failed most likely'` @ `0x18043e860`.

The second is arithmetic on the attacker's own constant: `4067 = 4096 − 29`, and 29 is exactly algo 0's AEAD
overhead from the parameter table in §2.5. §2.7 shows the instruction that performs that subtraction. This
is the peer-declared value being carried, intact, all the way to a downstream decoder — **and it is the
evidence that the inflated packet reached the *audio* decoder**, because `PacketBundleDecoder` is an
embedded member of `Musigy::AV::OpusDecoder`, not a scene node. That is why this finding needs no video.

### 2.6.4 The corruption reaches live objects and kills the process

The victim died seconds later. Not in `memset`, and not on the media path — which is the *predicted*
signature, since a crash at the `memset` itself is impossible for the reason given in §2.6.2. No WER record
exists because WickrPro ships Crashpad; the minidump is under
`%LOCALAPPDATA%\Wickr, LLC\Wickr Pro\crashpaddb\reports\`.

```
ExceptionCode: c0000005 (Access violation), reading 0x0000000000000473
d3d11!CResource<ID3D11Resource>::Map+0x50
  00007ff823b73491  mov rax, qword ptr [rdx+0A0h]     ; rax := *(rdx+0xA0)
  00007ff823b73498  mov dl,  byte ptr [rax+473h]      ; <== FAULT, rax = 0
rdx = 0x801128bb70          thread: Qt6Quick QSGBatchRenderer::Renderer::render -> RHI -> d3d11 Map
```

| | |
|---|---|
| measured `memset` range for `ptr = 0x801128afcc` | `[0x801128afcc, 0x801128bfcc)` |
| faulting pointer field | `0x801128bb70 + 0xA0` = `0x801128bc10` |
| offset past `ptr` | `0xc44` = 3,140 bytes |
| inside the `memset` range? | yes |
| beyond the end of the received payload (≤ 319 B) | ~2,821 bytes |

**CONFIRMED:** the range was zeroed (measured at `ptr+1024` on the same run); the faulting field lies 3,140
bytes past that same `ptr`, inside the same range; it read as 0; the fault is a zeroed-object-pointer
dereference in an unrelated subsystem.
**INFERRED (strongly, not measured):** that this particular NULL was written by this particular `memset`.
The minidump carries no heap pages, so that specific qword was not observed before and after. The inference
rests on the address arithmetic, the timing and the register state.

Attribution of the *write* needs no such inference: the probe only reads, the over-read allocates but does
not corrupt, and the before/after pair brackets the `memset` call directly. The `memset` is the only writer
in the window.

## 2.7 The second dropped control — `CryptProxy` forwards packets whose decryption failed

**CONFIRMED — disassembled.** This is an independent defect on the same path and it is why a
garbage-decrypting frame still reaches a C decoder.

`Musigy::AV::CryptProxy::onPacket` (`NPL 0x18011b3b0`) invokes the app's crypt callback through a function
pointer and **never examines its result**:

```
0x18011b678: 488b86e8000000  mov  rax, qword ptr [rsi+0xe8]  ; the crypt callback
0x18011b682: 4c8b8610010000  mov  r8,  qword ptr [rsi+0x110] ; user pointer
0x18011b689: 498bd6          mov  rdx, r14                   ; the Packet
0x18011b68c: ffd0            call rax                        ; <== decrypt
0x18011b68e: 8b8e18010000    mov  ecx, dword ptr [rsi+0x118] ; <== next instruction reads a FIELD,
0x18011b694: 4533ff          xor  r15d, r15d                 ;     not eax. The result is discarded.
0x18011b697: 85c9            test ecx, ecx
0x18011b699: 7970            jns  0x18011b70b
```

`eax` is dead at `0x18011b68e`. What follows is the padding adjustment and a heuristic, and then the packet
continues to the next node in the scene:

```
0x18011b69b: 418b5618      mov  edx, dword ptr [r14+0x18]  ; the packet's size field
0x18011b69f: 8bc1          mov  eax, ecx
0x18011b6a1: f7d8          neg  eax                        ; |cryptoPadding|  (= 29 for AES-256-GCM)
0x18011b6a3: 3bc2          cmp  eax, edx
0x18011b6a5: 7309          jae  0x18011b6b0                ; -> log 'Padding/packet size mismatch'
0x18011b6a7: 8d040a        lea  eax, [rdx + rcx]           ; size - 29
0x18011b6aa: 41894618      mov  dword ptr [r14+0x18], eax  ; <== rewrite the size field
```

That is the instruction that turns the attacker's 4,096 into the 4,067 the `PacketBundleDecoder` then
complained about (§2.6.3). Note the ordering: the callback — and therefore the `memset` with the **full**
peer-declared `n` — has already run by the time the size is reduced.

The only inspection of the decrypt result is a heuristic scan for an all-zero output buffer
(`0x18011b70b`–`0x18011b750`), whose sole effect is the warning at `0x18011b752` onward. Nothing drops the
packet. The application detects the exact condition an attacker creates, writes it to the log, and forwards
the frame anyway.

**Remediation for this is separate from, and cheaper than, the main fix**: give the callback a status
return, test it at `0x18011b68c`, and drop the packet on failure.

## 2.8 Impact, and what is not claimed

Remote, repeatable, attacker-length-controlled zero-fill of adjacent heap in a process that hosts both the
media stack and the UI, reachable by being in a call — with no video and no memory precondition.

Mitigation state of that process, **measured from the PE headers** (listed for completeness; this sink
writes zeros only and no code-execution path is claimed):

* **CFG is absent in both modules.** `NPL.dll` `DllCharacteristics = 0x160` and `WickrPro.exe`
  `DllCharacteristics = 0x8160` — the `IMAGE_DLLCHARACTERISTICS_GUARD_CF` bit (`0x4000`) is clear in both,
  and `GuardCFFunctionCount` is 0 in both load-config directories. Because the **EXE** does not opt in, CFG
  is inert process-wide, including for DLLs that are themselves instrumented (§4.2).
* **No CET shadow-stack opt-in.** Neither module carries an `IMAGE_DEBUG_TYPE_EX_DLLCHARACTERISTICS` debug
  directory entry.
* ASLR, high-entropy VA and DEP are present in both.
* The allocator is the default NT heap — no segment-heap opt-in and no third-party allocator in either
  import table. **INFERRED** (this one is not a PE-header property and does not share the label above).

Demonstrated effect: memory corruption that reaches live objects and terminates the client (§2.6.4).

**We did not achieve code execution through this defect and we do not claim it.** We established the limits
by reading and by measurement rather than by assumption:

* This sink writes **zeros only**. The content-carrying arm (`memcpy` @ `0x14013f487`) is unreachable under
  length inflation, because GCM bounds its count to the real plaintext (§2.5).
* There is **no information-disclosure path back to the attacker** from the over-read. The `QByteArray`
  built at `0x14013f401` is consumed only by the decrypt, which fails, and is destructed at `0x14013f4b7`;
  the full 337-byte function was read and no path returns any part of it to the network.
* Pointer density in the reachable adjacency was measured at 1 pointer-valued slot in 1,392 (§2.6.2), and
  nothing has been done on steering heap layout.

These are properties of *this* sink, not guarantees about the product.

## 2.9 Remediation

Ordered by what each change actually removes.

1. **Apply, in the `kind == 2` handler at `NPL 0x18011ef70`, the bound its own sibling branch already
   applies.** Before calling the Frame constructor at `0x18011effa`, compare `PacketHeader.Buffer.size`
   (loaded at `0x18011efef`) against the real received payload length carried on the packet object, and
   reject the packet on mismatch — the same disposition the plane branch takes at `0x18011f1c7`. This is the
   minimal fix and it closes the demonstrated attack.

2. **Take the length from the buffer, not from the header.** This needs an NPL API change, and the report
   should say so rather than leave the vendor asking "from where?": `NPLAVPacketGetBuffer`
   (`NPL 0x1803d0de0`) currently returns exactly one length, `Packet+0x18` at `0x1803d0e10`, which **is** the
   peer-declared value — WickrPro has no second source for the true payload size. Add an out-parameter
   carrying the *received* payload length, distinct from `Packet+0x18`; then in `WickrPro!0x14013f390` use
   that value for both the `QByteArray` construction at `0x14013f401` and the `memset` at `0x14013f49a`.
   Defence in depth: it makes the callback safe even if a future parser change reintroduces the substitution.

3. **Give the crypt callback a status and honour it.** `CryptProxy::onPacket` discards `eax` at
   `NPL 0x18011b68e`. Test the callback's return at `0x18011b68c` and drop the packet on failure instead of
   emitting the "All bytes set to zero" warning and forwarding it (§2.7).

4. **Authenticate `PacketHeader` — carry it as AAD in the end-to-end layer.** The header is written by the
   `Serializer` *after* `CryptProxy` encrypts and is parsed *before* `CryptProxy` decrypts, so it is outside
   the end-to-end envelope. Because the media transport terminates at the hub (Appendix 2A), this is not
   hardening: **it is the one change that removes the relay from the trust boundary for call integrity.** It
   also closes the whole class of header-driven defects, not just this one.

5. **Range-check the remaining `PacketHeader` scalars at the parse site.** Treat every peer-supplied length
   and offset the way `kind` is treated, and put the check in hand-written code rather than expecting the
   generated parser to do it.

**Open questions we could not close, stated so the vendor does not assume they are closed:**

* What is the backing allocation of the received payload — an exactly-sized block or a fixed MTU-class pool
  slab? This decides how far the `memset` runs before it leaves the allocation, and therefore how much of
  the field's `0 … 0xFFFFFFFF` range is usable before the preceding over-read faults. **UNDETERMINED.**
* Can heap layout be steered so the zero-fill lands on a chosen object? Nothing has been done on grooming;
  the one observed casualty was incidental. **UNDETERMINED.**
* ~~Is `descriptor+0x5c` peer-settable?~~ **CLOSED — it is. Promoted to Finding 2c below.**

### 2.10 (F2c) A peer-supplied 32-bit field drives the key ratchet before authentication — CONFIRMED

An earlier revision carried this as an open question because the field had never been traced to its
source. It has been. Every address below was disassembled from the shipped binaries and the byte
string is quoted; the nine-step chain verified 9/9.

**The field is peer-supplied.** `NPLAVPacketGetDescriptor` (`NPL 0x1803d0e50`) copies it verbatim out
of the received packet into the descriptor:

```
0x1803d0f19  418b8298000000   mov eax, dword ptr [r10 + 0x98]   ; r10 = the received Packet
0x1803d0f20  89425c           mov dword ptr [rdx + 0x5c], eax   ; rdx = the descriptor
```

`Packet + 0x98` is one of the unclamped `PacketHeader` metadata int32s that reach `Frame + 0x8c … +0xa0`
— the same wire-metadata block §2 is about. The neighbouring copies in the same tail
(`+0x88 → desc+0x50`, `+0x8c → +0x54`, `+0x90 → +0x58`, `+0x98 → +0x5c`, `+0xa0 → +0x60`) map onto that
range exactly.

> **The field now has a number and a parse site — CONFIRMED (disassembled), added after the field map
> was completed.** It is **`Proto::PacketHeader` field 10** (wire tag `0x50`, varint). Full chain:
>
> | step | address | instruction |
> |---|---|---|
> | parsed off the wire, **no clamp** | `NPL 0x18013bdd7` | `41895658  mov dword ptr [r14 + 0x58], edx` |
> | copied into the `Frame` | `NPL 0x18011f2ad` | `41898698000000  mov dword ptr [r14 + 0x98], eax` |
> | copied into the descriptor | `NPL 0x1803d0f20` | `89425c  mov dword ptr [rdx + 0x5c], eax` |
> | read by the decrypt callback | `WickrPro 0x14013f438` | `8b4d1c  mov ecx, dword ptr [rbp + 0x1c]` |
> | passed as the 5th argument | `WickrPro 0x14013f43b` | `48894c2420  mov qword ptr [rsp + 0x20], rcx` |
> | the unbounded ratchet gate | `WickrPro 0x140cb682c` | `7637  jbe 0x140cb6865` |
>
> This makes remediation item 1 below concrete: the range check belongs at `NPL 0x18013bdd7`, in the
> field-10 arm of `PacketHeader::_InternalParse` (`0x18013b930`), beside the `kind` arm that already
> validates at `0x18013ba51`–`0x18013ba5e`.
>
> *(Correction to an earlier internal note, which recorded this as "`PacketHeader +0x98`". `+0x98` is
> a `Frame` offset, not a message-object offset; the message-object offset is `+0x58`.)*

**It reaches the key schedule.** WickrPro's media decrypt callback fetches the descriptor into a local
at `rbp-0x40` and reads offset `0x5c` of it — `rbp+0x1c` — passing it as the **fifth argument** to the
decrypt entry:

```
0x14013f3ec  ff153e45c100     call qword ptr [rip + 0xc1453e]   ; NPLAVPacketGetDescriptor -> [rbp-0x40]
0x14013f438  8b4d1c           mov ecx, dword ptr [rbp + 0x1c]   ; = descriptor + 0x5c
0x14013f43b  48894c2420       mov qword ptr [rsp + 0x20], rcx   ; 5th argument
0x14013f44e  e89d5c9e00       call 0x140b250f0                  ; the decrypt entry
```

**It advances a monotonic ratchet, before any authentication, with no upper bound.** The gate:

```
0x140cb6825  4c3b89c8000000   cmp r9, qword ptr [rcx + 0xc8]    ; peer value vs highest seen
0x140cb682c  7637             jbe 0x140cb6865                   ; not greater -> do nothing
0x140cb683a  e841fcffff       call 0x140cb6480                  ; else ratchet forward, one
                                                                ; iteration per epoch
```

**Two properties follow, and the second is the serious one.**

1. **CPU.** One packet with a large value forces the media thread through the ratchet loop
   (`0x140cb6480`–`0x140cb6647`) once per epoch of the jump. Nothing bounds the jump.
2. **The state does not come back.** The gate advances only on a strictly greater value, which is the
   correct shape for a ratchet but means the advance is **irreversible**. After it, legitimate media
   from the real peer is at an epoch the receiver has already passed, and **the stream is permanently
   wedged for the remainder of the session.**

**Attacker position — CONFIRMED, and it is not only the peer.** The value is a `PacketHeader` field,
and §2 Appendix 2A establishes that the header is written *after* encryption and parsed *before*
decryption, so it is outside the end-to-end envelope and the relay can rewrite it holding no key
material. The ratchet also runs **before** authentication, so no valid key is needed to reach it.
**A call peer, or whoever controls the media relay, can silently and permanently disable another
participant's media with a single packet.**

**Remediation.** Range-check the field at the parse site, bound the per-packet epoch advance to a small
constant, and — the general fix — **do not let unauthenticated header material drive key-schedule
state at all**: move the ratchet advance to after `EVP_DecryptFinal_ex` succeeds. Remediation item 4 of
§2.9 (authenticate `PacketHeader` as AAD) also covers this, which is a further reason to prioritise it.

## Appendix 2A — The hub is inside the trust boundary for call integrity

This is an appendix because it rests on one inference, and §2.1–§2.9 do not depend on it.

**The claim.** Whoever controls or compromises the media hub can drive this defect against every participant
of every call, holding no key material.

**Leg 1 — the client opens one media port to one hub. MEASURED (earlier phase, from the client's own log;
not re-run under the present rules of engagement).** Once per call:

```
[D Hub::Port::BindToUDP] Opening IPv4 port 0, GetAddress(): 0.0.0.0:0
[I PortImpl] Starting signaling connection to <redacted>
[D PortImpl] Connection option (1/2) udp://<redacted>
[D PortImpl] Connection option (2/2) tls://<redacted>
```

Two *transport options to the same hub*, not one connection per participant. The RTTI class is
`Musigy::NPL::Hub::HubPort` (`.?AVHubPort@Hub@NPL@Musigy@@`); the log tag `Hub::Port::BindToUDP` is a
composed prefix rather than a single literal — only `BindToUDP` appears in the image, UTF-16 at
`NPL 0x1804387d8`, and `Connection option (` at `NPL 0x18042a230`. *(An earlier note claimed the class is
"literally `Hub::Port`". There is no such literal in the image; corrected here.)*

**Leg 2 — the call surface of the NPL API is entirely hub publish/subscribe. CONFIRMED — export table
enumerated (230 named exports).** Thirty-one `NPLHub*` entries: `NPLHubInitialize`, `NPLHubGetPort`,
`NPLHubGetStreamCount`, `NPLHubAudioPublish` / `Subscribe` / `Unpublish` / `Unsubscribe`,
`NPLHubVideoPublish` / `Subscribe` / `Unpublish` / `Unsubscribe`, `NPLHubPinStream`,
`NPLHubMuteStreamLocal`, … You publish *to* the hub and subscribe *from* the hub.

> **Correction to our earlier draft**, which stated that "NPL exposes no peer-connect API — every export is
> hub publish/subscribe". That is too strong and is withdrawn. NPL does export generic transport primitives:
> `NPLPortConnect` (`0x1803cc110`), `NPLPortConnectDual` (`0x1803cc2a0`) and a **29**-entry `NPLConnection*`
> family (an earlier draft said 31; that was the `NPLHub*` count copied onto the wrong family). What
> survives, and is what the argument actually needs, is narrower and checkable: **there is no
> participant-addressed entry point anywhere in the API.** `NPLPortConnectDual` connects one Port to two
> transport options — which is exactly the `(1/2) udp:// (2/2) tls://` pair in Leg 1, and is the opposite of
> one connection per participant.

**Leg 3 — the media transport authenticates a server against an application-supplied certificate set, not a
per-participant fingerprint. CONFIRMED — disassembled and import-resolved.** The DTLS context is built at
`NPL 0x180091f70`:

```
0x180091ff8: call 0x18010e76f  -> ssl.dll!DTLSv1_2_client_method   (role-selected;
0x180092483: call 0x18010e769  -> ssl.dll!DTLSv1_2_server_method    the other arm)
0x180092214: call 0x18010e745  -> ssl.dll!SSL_CTX_set_cipher_list
0x180092219: mov  edx, 0xfefd                                       ; DTLS 1.2
0x180092222: call 0x18010e727  -> ssl.dll!SSL_CTX_set_min_proto_version
0x180092227: lea  r8, [rip+0x1272]                                  ; = 0x1800934a0, the verify callback
0x18009222e: mov  edx, 1                                            ; SSL_VERIFY_PEER
0x180092237: call 0x18010e757  -> ssl.dll!SSL_CTX_set_verify
0x18009223c: call 0x18010e86b  -> crypto.dll!X509_VERIFY_PARAM_new
0x180092244: mov  edx, 0x80000                                      ; X509_V_FLAG_PARTIAL_CHAIN
0x18009224c: call 0x18010e877  -> crypto.dll!X509_VERIFY_PARAM_set_flags
0x180092258: call 0x18010e75d  -> ssl.dll!SSL_CTX_set1_param
0x180092265: call 0x18010e853  -> crypto.dll!X509_STORE_new
0x180092272: mov  rcx, [rip+0x4b407f]     ; = [0x1805462f8], the PROCESS-GLOBAL NPL context
0x180092279: call 0x180092970             ; enumerate its certificate vector
0x1800922a6: call 0x18010e859  -> crypto.dll!X509_STORE_add_cert   (loop over that vector)
```

The trust material is installed once, process-wide, through the exported `NPLSetServerCertificates`
(`0x1803cdcc0`), which PEM-parses its argument list — it scans for `-----BEGIN CERTIFICATE-----` at
`0x1804cd9a0` (reached by `lea rdx,[rip+0xffbf4]` at `0x1803cdda5`) and `crypto.dll!PEM_read_bio_X509` is
called from `0x1800846e4` — and reads the same global at `0x1803cdcfd`. The verify callback `0x1800934a0`
compares with `crypto.dll!X509_cmp` (`0x180093b06`).

`X509_V_FLAG_PARTIAL_CHAIN` plus a static, call-independent, application-installed certificate set is a
**server** trust anchor. A peer-to-peer design pins a per-participant fingerprint delivered through
signalling; nothing here does.

*(Two honest notes on this leg. NPL links both the DTLS client and server methods and exports
`NPLSetServerPrivateKey`, so the same library can serve the hub side — consistent with this picture but
**INFERRED**, not shown. And our earlier draft's addresses `0x5284c2` / `0x5284dc` for the DTLS method-name
strings and `0x429bb8` for `'DTLS handshake failed'` are wrong — the correct addresses in the shipped
`NPL.dll` are `0x180529adc`, `0x180529ac2` and `0x18042b1b8`.)*

**Leg 4 — there is no SRTP. CONFIRMED — measured.** Regex `SRTP` and `srtp_`, both ASCII and UTF-16, over
the mapped images of `NPL.dll` and `WickrPro.exe`: **zero matches in all four combinations.** No
SRTP-related import appears in NPL's `ssl.dll` import list either.

**The ordering, which is what makes the legs matter. CONFIRMED.** The send graph ends
`… → VpxEncoder → CryptProxy → Serializer`, so the `Serializer` writes `PacketHeader` (site `0x18011d592`)
*after* end-to-end encryption. On receive, `Parser` runs *before* `CryptProxy`. The header is therefore never
covered by the end-to-end layer and is not carried as AAD. The `4067 = 4096 − 29` observation in §2.6.3 is
independent arithmetic evidence of that ordering on the receive side.

**⇒ The hub sees and can rewrite the plaintext `PacketHeader` of every participant, with no key material.**
The attacker set becomes the infrastructure, anyone who compromises it, and a malicious insider; the victim
set becomes every participant of every call; the required key material becomes none.

This is not the generic "if the server is compromised you lose". The end-to-end layer is working — the hub
cannot read the media, and §2.5 shows the AEAD is genuine and enforced. The gap is specifically that the
header sits outside that envelope. Remediation item 4 closes it without changing the server's trust model.

> **RESIDUAL, stated plainly.** Hub-side traffic was never captured; that is outside the rules of engagement
> for this assessment. The conclusion is a consequence of the four client-side legs plus the confirmed scene
> ordering, **not a direct observation of a server-side packet.** Nothing in the client contradicts it, and
> no alternative topology we can construct is consistent with a single `HubPort` plus static
> server-certificate validation. **If AWS can show the relay re-serialises `PacketHeader` from validated
> fields, this appendix is refuted and items 1–3 remain the whole fix.**

## Appendix 2B — Bounding negatives

What an attacker **cannot** do here, with the instruction or the measurement that stops them.

* **An off-path network attacker cannot inject these packets. CONFIRMED (disassembled).** Media rides inside
  DTLS 1.2 with `SSL_VERIFY_PEER` and a certificate store (Appendix 2A, Leg 3). The attacker positions are a
  call participant and the hub, not "anyone on the network".
* **A peer cannot downgrade the media cipher to an unauthenticated one. CONFIRMED (disassembled).** The
  parsed algorithm byte must equal the algorithm in the key object: `cmp dword ptr [rbp], eax / jne` at
  `0x140cb8a2f`.
* **A peer cannot turn this sink into a content-controlled write. CONFIRMED (disassembled).** The `memcpy`
  arm at `0x14013f487` copies only `plaintext.length()` bytes, which GCM bounds to the real ciphertext, and
  inflation makes authentication fail by construction (§2.5).
* **A peer learns nothing from the over-read. CONFIRMED (full function read).** Its product is consumed by a
  decrypt that fails and is then destructed at `0x14013f4b7`; no path in the 337-byte callback returns it to
  the network.
* **The plane count is bounded. CONFIRMED (disassembled).** `0x18011f183  cmp r9d, 4` / `jge` caps the
  per-packet plane loop at four. The parser is not uniformly unchecked; the missing check on `Buffer.size`
  is a specific omission.
* **`kind` is genuinely validated. CONFIRMED (disassembled)**, to exactly 1/2/3 at
  `0x18013ba51`–`0x18013ba5e` in `PacketHeader::_InternalParse` (`0x18013b930`).

### The rest of the `PacketHeader` metadata block — the map is now complete

An earlier revision described the constrained fields only. The nine unclamped metadata int32s have since
been followed to every consumer. **Eight of the nine are negatives**, and we state them because they bound
the finding: this section is about `Buffer.size` and §2.10 is about field 10, and *those two are the whole
of it*.

`Proto::PacketHeader` carries ten int32s at message-object offsets `+0x40 … +0x64`. Only `kind` (`+0x64`)
is validated at the parse site; the other nine are stored with no comparison between the varint decode and
the `mov`. Cross-checked 9/9 against the generated `PacketHeader::_InternalSerialize` (`NPL 0x18013bfb0`),
which reads exactly those nine offsets at `0x18013c086`, `0c0ed`, `0c14d`, `0c1ad`, `0c20d`, `0c26c`,
`0c2f4`, `0c351`, `0c3d1`.

The parsed message is reachable on the receive path from exactly one place — `AV::Parser::onPacket`
(`NPL 0x18011fce0`) loads it from `Parser + 0x158` at `0x18011fdca` and dispatches on `kind` to three
handlers, which are therefore the complete consumer set: `0x18011ed00` (kind 1, FORMAT),
`0x18011ef70` (kind 2, MEDIA), `0x18011ea60` (kind 3, EVENT).

| field | offset | verdict | the instruction that closes it |
|---|---|---|---|
| 3 | +0x40 | **read and not acted on.** Copied to `Frame+0x8c` → `descriptor+0x54`; `VpxDecoder::process` never reads `Frame+0x8c`; `WickrPro` never reads `descriptor+0x54` | `NPL 0x18011f25e` stores it; the only other readers are the send-path serializer `0x18011d5b2`, the `Frame` copy-constructor `0x180135d20` and the field-by-field log formatter `0x1800ca140` |
| 4 | +0x44 | a **flags word**. Bit 14 selects one of exactly two decoder contexts — that is the multiplier already reported in §3.5. Bits 2, 3, 6, 10, 11 and 17 select branches only | `NPL 0x1801447b2  c1e80e  shr eax, 0xe` / `and al, 1` |
| 5 | +0x48 | **write-only wire field.** The sender writes it (`0x18011d5e8`); the receiver never reads it and zeroes the corresponding `Frame` slot | `NPL 0x18011f26f  4589a694000000  mov dword ptr [r14 + 0x94], r12d`  (r12d = 0) |
| 6 | +0x4c | **write-only wire field.** Sender writes a constant; no receive-path reader | `NPL 0x18011d60b  4489604c  mov dword ptr [rax + 0x4c], r12d` |
| 7 | +0x50 | the **EVENT id** on `kind == 3`. **The one field we did not take to a verdict** — see the note below | `NPL 0x18011ecc3  ff5018  call qword ptr [rax + 0x18]` |
| 8 | +0x54 | **dead wire field.** No receive-path reader, and no application serializer writes it either — only the generated `_InternalSerialize` touches it | (absence; established by reading all three handlers in full) |
| 10 | +0x58 | **§2.10 (F2c)** | — |
| 11 | +0x5c | a per-context video sequence number. Drives a loss accountant (`NPL 0x180144130`). Not monotonic — a smaller value **resets** the stored sequence, so unlike field 10 there is no permanent wedge. The loop that appears peer-bounded self-terminates in ≤5 iterations because its guard byte is cleared inside the body. The decode-failure sink is **masked to two bits** | reset: `NPL 0x180144178`; clamp: `NPL 0x180144323  4183e003  and r8d, 3` |
| 13 | +0x60 | **read and logged.** `OpusDecoder` keeps a monotonic max of it, prints it every 64th packet and then resets it to zero | `NPL 0x180148f6a  4889b758010000  mov qword ptr [rdi + 0x158], rsi`  (rsi = 0) |

**The application's total visibility into a received packet is bounded, and the bound is complete.** The
`NPL.dll` export table (230 named exports, enumerated) contains exactly two packet accessors —
`NPLAVPacketGetBuffer` and `NPLAVPacketGetDescriptor`. The decrypt callback `WickrPro 0x14013f390` is 337
bytes and was read in full: the **only** instruction in it that reads the descriptor is
`0x14013f438 mov ecx, dword ptr [rbp+0x1c]`, i.e. `descriptor + 0x5c`. Descriptor offsets `+0x48`, `+0x50`,
`+0x54`, `+0x58` and `+0x60` are populated by `NPLAVPacketGetDescriptor` and never read by anything.

> **One item is UNDETERMINED and we would rather say so than round it to a negative.** Field 7 is passed
> unclamped as the third argument of a virtual dispatch on the EVENT path:
> ```
> 0x18011ec8d  458b7650        mov  r14d, dword ptr [r14 + 0x50]   ; field 7, off the wire
> 0x18011eca7  488b8e18010000  mov  rcx, qword ptr [rsi + 0x118]   ; a delegate on the Parser
> 0x18011ecb9  458bc6          mov  r8d, r14d                      ; 3rd argument
> 0x18011ecc3  ff5018          call qword ptr [rax + 0x18]         ; vtable slot 3
> ```
> We did not identify the class of `Parser + 0x118` and therefore cannot say what slot 3 does with the
> value. A sweep for `mov qword ptr [reg + 0x118], reg` across the whole `Musigy::AV` node range
> (`0x180118000`–`0x180140000`) found no store, so the delegate is installed from outside it. **If AWS can
> say what that delegate is, this closes in minutes at your end.** It is the only one of the nine where a
> raw peer int32 reaches an indirect call as an argument rather than being stored, masked or logged.

**Not a bounding negative — a severity note we moved out of this list.** An earlier draft listed "encoded
video does not carry this defect" among the things an attacker cannot do. That is wrong as a *limit*: it
describes **default sender** behaviour, and §2.2.2 shows that setting `PacketHeader.Buffer` is by itself
sufficient to route any packet down the unchecked branch. What is true and useful is: **CONFIRMED
(measured)** — pinning `C` moved only the small-packet class and left 1,486 plane-branch records untouched,
so the live carrier was the audio leg; and **INFERRED** — that the `VpxEncoder` emits VP8 as a single plane
(`stride = len`, `height = 1`) taking the bounds-checked branch. **This raises severity rather than lowering
it: the victim needs no video at all**, and the `PacketBundleDecoder` log line in §2.6.3 is the direct
evidence, since that class is an embedded member of `Musigy::AV::OpusDecoder`.

## Appendix 2C — Reproduction

Two owned accounts, two machines. The sender's behaviour is patched in memory on the sender's own machine;
the victim runs shipped binaries and carries only two read-only probe detours.

**1. Sender — 11 bytes at `NPL` RVA `0x11d592`**, inside `Musigy::AV::Serializer::onPacket`, so the declared
size becomes a constant `C` (bytes and safety checks in §2.6). **Apply with no call active** — the send
graph is built once per call — then place a fresh call.

**2. Victim — two 5-byte passive detours** bracketing the `memset`, snapshotting adjacent heap before and
after (§2.6.2). Read-only; they do not alter the packet, the length, or the `memset` arguments.

**3. Discriminator, fixed in advance.** H1 → the victim's `n` collapses onto `C`; H0 → `n` keeps varying per
frame. A constant `n` across frames of differing real size is not producible by any benign sender.

**4. Escalation note.** Keep `C` in the low thousands so the whole range stays mapped. A large `C` faults on
the *read* at `0x14013f401` before the `memset` runs and tells you nothing about the write. The expected
success signature is a delayed crash somewhere unrelated — not an access violation in `memset`, which is
impossible by construction.

Raw data referenced above: `lenprobe-baseline.log`, `lenprobe-patched-C300.log` (cumulative — see §2.6.1),
`E2E-F4-1-RESULT.txt`, `oobprobe-C4096.log`, `groomingmap-C640-C768-band304.log`,
`groomingmap-C768-band640.log`, and the Crashpad minidump analysis.
---

# SECTION 3 — F3: remote denial of service — a 34-byte VP8 keyframe forces ~2 GiB of commit

**Class:** CWE-400 (uncontrolled resource consumption), reached through CWE-789 (memory allocation with an
excessive size value)
**Component:** the libvpx VP8 decoder statically linked into `NPL.dll`
**Attacker:** any authenticated participant in a call with the victim, publishing video
**Victim interaction:** none beyond being in the call with video enabled
**Status:** mechanism CONFIRMED by disassembly; cost CONFIRMED by measurement; delivery demonstrated live
over a real call, on two hosts — see qualifier (b) at §3.6, which applies to every live number below
**Dependency:** none. This finding stands on its own and does not rest on Section 1. Section 1 rests on it.

## 3.1 Summary

The VP8 keyframe header carries **14-bit** width and height. A call peer can therefore name any decoder
geometry up to 16383×16383, and libvpx will allocate for it. Between the wire and the allocation there is no
clamp of any kind: the media stack hands the frame to libvpx as an opaque `{pointer, length}` pair, the
decoder is created with `cfg.w = cfg.h = 0` so the negotiated `VideoFormat` never reaches it, and inside
libvpx the only guards on the dimensions before the allocation are two `> 0` tests.

The measured cost is **+2017.0 MiB of private commit per decoder context**. There are **exactly two decoder
contexts per publisher**, and an ordinary publisher populates both, so a single peer is worth roughly
**4 GiB**.

The input is one VP8 keyframe of **34 bytes**.

## 3.2 The path from the wire to the allocation — CONFIRMED (disassembled)

**(a) The media stack does not look at the frame.** `Musigy::AV::VpxDecoder`, vtable slot `+0x08`
(`NPL 0x180144520`, `.pdata` extent `0x144520`–`0x1455fd`, 4,317 bytes) passes the packet payload straight
through. The class is identified from RTTI — `.?AVVpxDecoder@AV@Musigy@@`, at the complete-object locator
for the vtable at `0x180443ab8`, whose slot `+0x08` at `0x180443ac0` is the only `.rdata` pointer to
`0x180144520`. The *method* name is our convention, not a symbol.

```
0x180144ba2  mov  rbx, qword ptr [rsp + 0x40]   ; reload arg3 (the Packet), spilled at 0x180144553
0x180144ba7  mov  r8d, dword ptr [rbx + 0x18]   ; size  — taken verbatim from the Packet
0x180144bab  mov  rdx, qword ptr [rbx + 0x10]   ; data  — the payload pointer
0x180144baf  lea  rcx, [rdi + 0x10]             ; the codec context
0x180144bb3  call 0x18017d5c0                   ; vpx_codec_decode
```

(The `0x180144ba2` reload is quoted because without it the excerpt looks like it confuses two registers:
`rbx` was last assigned at `0x180144b53` as the codec context. We call arg3 the **Packet** throughout —
`Musigy::AV::Packet` — and not "the Frame", which an earlier note used inconsistently for the same object.)

**(b) `vpx_codec_decode` (`0x18017d5c0`, 104-byte extent) dispatches through the codec interface:**

```
0x18017d5f0  mov  r10, qword ptr [rcx + 8]      ; ctx->iface
0x18017d606  mov  r10, qword ptr [r10 + 0x38]   ; iface->dec.decode
0x18017d60e  call r10
```

The VP8 decoder interface lives at `0x180461f70`. Slot for slot: `name → 0x180462000`
(`"WebM Project VP8 Decoder v1.9.0"`), `abi_version = 5`, `caps = 0x1c0001`, `init = 0x18017d660`,
`destroy = 0x18017d710`, `ctrl_maps = 0x180461ee0`, `dec.peek_si = 0x18017d740`, `dec.get_si = 0x18017d760`,
`dec.decode = 0x18017d780`, `dec.get_frame = 0x18017dff0`, `dec.set_fb_fn = 0`. So `iface->dec.decode` is
`vp8_decode` at `0x18017d780` (`.pdata` extent `0x17d780`–`0x17dfea`, 2,154 bytes).

**(c) `vp8_decode` peeks the stream info,** calling the function the interface also publishes as `peek_si`
(`0x18017d740` is a 26-byte thunk whose only call is `0x18017e4f0`): `0x18017d8e7  call 0x18017e4f0`.

**(d) `vp8_peek_si` (`0x18017e4f0`) validates a 10-byte minimum length, the keyframe bit, the sync code, and
rejects zero width or height — and applies no upper bound of any kind.** Five validations in total,
enumerated at §1.4; the two that matter here:

```
0x18017e584  and  r8d, 0x3fff                   ; si.w  := 14 bits, no upper bound
0x18017e59c  and  ecx, 0x3fff                   ; si.h  := 14 bits, no upper bound
```

**(e) Any change of geometry arms a reallocation,** and the peeked values become the decoder's:

```
0x18017d91d  cmp  dword ptr [rbx + 0xec], esi   ; new si.h vs the current one
0x18017d925  cmp  dword ptr [rbx + 0xe8], edi   ; new si.w vs the current one
0x18017d92d  mov  dword ptr [rbp - 0x2d], 1     ; resolution_change = 1
...
0x18017daf5  mov  dword ptr [rdi + 0x1ba0], eax ; pc->Width  := ctx->si.w
0x18017db01  mov  dword ptr [rdi + 0x1ba4], eax ; pc->Height := ctx->si.h
```

(`rdi` is the decoder instance and `VP8_COMMON` sits at `+0x1440`, so `+0x1ba0` and `+0x1ba4` are
`pc->Width` at `pc+0x760` and `pc->Height` at `pc+0x764` — the same two fields `vp8_decode_frame` writes at
`0x1801ae1f7` and `0x1801ae21d`.)

**(f) The only two guards, then the allocation:**

```
0x18017d7ad  xor  r14d, r14d                       ; r14d stays 0 for the whole function
...
0x18017db5b  cmp  dword ptr [rbx + 0x760], r14d    ; Width  vs 0
0x18017db62  jg   0x18017db81                      ;   > 0 -> proceed
0x18017db67  lea  r8,  [rip + 0x2e42b2]            ;   -> 0x180461e20 "Invalid frame width"
0x18017db81  cmp  dword ptr [rbx + 0x764], r14d    ; Height vs 0
0x18017db88  jg   0x18017dba7
0x18017db8d  lea  r8,  [rip + 0x2e42a4]            ;   -> 0x180461e38 "Invalid frame height"
0x18017dba7  mov  r8d, dword ptr [rbx + 0x764]     ; height
0x18017dbb1  mov  edx, dword ptr [rbx + 0x760]     ; width
0x18017dbb7  call 0x180186080                      ; vp8_alloc_frame_buffers
```

Two tests for "greater than zero". There is no upper bound anywhere on this path. (`r14d` really does stay
zero: inside `vp8_decode`'s 2,154-byte extent `r14` is written at exactly two instructions,
`xor r14d,r14d` @ `0x18017d7ad` and `pop r14` @ `0x18017dfe5`.)

## 3.3 Nothing upstream clamps it — established by sweep over the whole `.text`

We ran both sweeps over the **entire `.text` section** (`0x180001000`, `0x4225fe` bytes), not only the
89.83 % covered by `.pdata`, because leaf functions carry no unwind data and would otherwise be missed.

* `cmp` against immediate `0x9d`: **exactly 2 sites in the whole image** — `0x18017e562` (in `vp8_peek_si`)
  and `0x1801ae1b5` (in `vp8_decode_frame` `0x1801ae010`).
* `and reg, 0x3fff`: **exactly 6 sites in 3 functions** — `0x18017e584`, `0x18017e59c`, `0x1801ae1f1`,
  `0x1801ae217`, and `0x1802fdf08` / `0x1802fdf12` in a 69-byte motion-vector scaling helper
  (`0x1802fdee0`, `neg` / `sar 0xe`) with no sync-code test, which is not on this path.

**CONFIRMED: no code anywhere in `NPL.dll` outside libvpx tests the VP8 sync code or applies the 14-bit
dimension mask.** That bounds header parsing to the two canonical forms; combined with the call site at
`0x180144bb3`, which passes `{pointer, length}` through unread, we found no upstream clamp on this path.
*(Methodological caveat: an upstream check that read bytes 6–9 and rejected oversized geometry without
either byte pattern would not appear in these sweeps.)*

## 3.4 The negotiated `VideoFormat` is not a cap either — CONFIRMED (disassembled)

The decoder is created with an empty geometry:

```
0x1801446fe  mov  qword ptr [rbp + 0x144], 0     ; cfg.w = 0 and cfg.h = 0 (one 8-byte store)
0x180144709  mov  dword ptr [rbp + 0x140], 1     ; cfg.threads = 1
0x180144723  lea  r8,  [rbp + 0x140]             ; &cfg
0x180144731  call 0x18017d4a0                    ; vpx_codec_dec_init_ver
```

libvpx is never told what geometry the call negotiated, so it has nothing to clamp against. The dependency
in fact runs the other way: after each decode, the decoder node compares the *published* format against the
*decoded image's* dimensions and republishes the format when they differ:

```
0x1801453db  cmp  dword ptr [r15 + 0x21c], r8d   ; published width  vs decoded d_w
0x1801453e9  cmp  dword ptr [r15 + 0x220], eax   ; published height vs decoded d_h
0x180145402  call 0x180145b60                    ; republish the format from the decoded values
```

A peer's frame therefore redefines the geometry rather than being checked against it.

## 3.5 Two decoder contexts per publisher, both driven in ordinary operation

**CONFIRMED (disassembled): exactly two contexts exist.** The creation loop has an immediate trip count:

```
0x180144685  mov  r14d, 0x518                        ; loop init
0x180144731  call 0x18017d4a0                        ;   vpx_codec_dec_init_ver, once per iteration
0x18014476e  mov  qword ptr [r14 + r12 - 0x70], rbx  ;   stored at r12+0x4a8 and r12+0x4b0
0x180144773  add  r14, 8                             ;   step 8
0x180144777  cmp  r14, 0x528
0x180144785  jl   0x180144692
```

`0x518` and `0x520` — **exactly two iterations, therefore exactly two decoder contexts.** The two slots
`r12+0x4a8` and `r12+0x4b0` are the same two the teardown path releases at `0x18014464a` and `0x180144665`.

**CONFIRMED (disassembled): the context index is bit 14 of the incoming packet's `+0x90` metadata word.**

```
0x1801447ac  mov    eax, dword ptr [rbx + 0x90]           ; rbx = the Packet
0x1801447b2  shr    eax, 0xe                              ; bit 14
0x1801447b5  and    al, 1
0x1801447b7  movzx  r14d, al
0x1801447bb  mov    dword ptr [rsp + 0x38], r14d          ; the selector
0x180144b4e  movsxd r14, dword ptr [rsp + 0x38]
0x180144b53  mov    rbx, qword ptr [r12 + r14*8 + 0x4a8]  ; ctx = contexts[bit14]
```

**MEASURED, on the attacker's own outbound stream:** that word carries the simulcast layer id, and the two
layers alternate almost every packet (run lengths `{1:574, 2:161, 3:1}`). So a single **ordinary** publisher
populates both contexts and the per-peer cost is two allocations, not one.

> **UNDETERMINED: whether a peer can set that bit at will.** We did not establish it. The run-length figure
> above was taken by our recon build on the **attacker's own outbound** packets at `encryptCallback`, not on
> the victim's receive path. The live sequence was subsequently rebuilt so that it does not depend on the
> bit being settable. An earlier draft of ours titled this subsection "both peer-selectable"; that is
> withdrawn.

## 3.6 The frame

The whole input is 34 bytes:

```
10 01 00                    frame tag: key frame, version 0, show_frame, first_partition_size = 8
9d 01 2a                    sync code                       <- the only thing validated
ff 3f                       width  = 0x3fff = 16383, horiz_scale = 0
ff 3f                       height = 0x3fff = 16383, vert_scale  = 0
00 00 00 08 00 18 65 a0     first partition (8 bytes, as declared above)
00 00 00 00 00 00 00 00     residual partition
00 00 00 00 00 00 00 00
```

Full bytes: `1001009d012aff3fff3f00000008001865a000000000000000000000000000000000`

This is the file used in the live runs (`B_huge_keyframe.vp8`, 34 bytes) and its first 16 bytes appear
verbatim in the victim probe's log line for the frame that reached the decoder.

## 3.7 Evidence

### The cost — CONFIRMED (measured)

Both figures below are **harness measurements against the unmodified installed `NPL.dll`**, driven through
the public `vpx_codec_decode` entry with argument-identical values to the live call site:

| measurement | result |
|---|---|
| 16383×16383 keyframe, private commit before/after (Wave 4, 111-byte input) — no patched binary, no debugger, no allocator hooks | 9.0 MiB → 2026.0 MiB, i.e. **Δ +2017.0 MiB** |
| 16383×16383 keyframe as the 34-byte frame above, per decoder context, at six modelled commit caps (`gate2ctx.py`) | **+2017.0 MiB for every allocation that succeeded**: context 0 at all six caps, context 1 at 5000 / 4200 / 4100 MiB. **At 4000 / 3900 / 3000 MiB the second context's allocation returned NULL and took 0 MiB** — that is Section 1's gate opening, not a different cost. |

> **QUALIFIER (a), attached to the second row because that is where it is used.** The commit caps in that
> row are **modelled with a Job Object per-process commit limit** (`JOB_OBJECT_LIMIT_PROCESS_MEMORY`), not
> produced by natural exhaustion. A default Windows install with a system-managed pagefile grows the
> pagefile and satisfies the 2 GiB request — see Host B below, where it did exactly that. An earlier draft
> of ours reported "+2017.0 MiB each time" for all six caps; that is wrong and is corrected above.

The arithmetic is consistent with the code, which is worth stating because it means the number is a property
of the geometry and not of the host. `vp8_alloc_frame_buffers` (`0x180186080`) allocates, at 16384×16384
aligned with `VP8BORDERINPIXELS = 32`:

* four reference frame buffers (loop at `0x1801860e0`, `cmp edi,4` at `0x18018611d`, allocator at
  `0x18019bf90` → `0x18019c050`) and one post-processing buffer (`0x180186229`) — five at
  `yplane + 2·uvplane = 16448² + 2·8224² = 405,805,056 B = 387.0 MiB` each. The stride and plane-size
  arithmetic is at `0x18019c0ae` / `0x18019c0b9` (`y_stride = (aligned_w + 2·border + 31) & ~31` = 16448)
  and `0x18019c0de` (`frame_size = yplane + 2·uvplane`);
* the mode-info array, `vpx_calloc((mb_cols+1)·(mb_rows+1), 0x4c)` at `0x1801861c9` — `1025 × 1025 × 76 =
  79,847,500 B = 76.1 MiB`;
* a 16-row scaling buffer (`0x180186184`, 1.88 MiB) and the above-context array (`0x180186206`, 9 KiB).

Total **2,110,855,756 B = 2013.07 MiB**, against **2017.0 MiB** measured. *(Derivation INFERRED; the 2017.0
figure is MEASURED.)* Note `0x18019bf90` frees any existing buffer, memsets the `0xa0`-byte descriptor, and
then **calls** `0x18019c050` at `0x18019bfdf` — it is a normal call followed by `jmp` into the epilogue, not
a tail call, contrary to an earlier note.

**Amplification:** 2017.0 MiB = 2,114,977,792 B; divided by 34 that is **62,205,229 — roughly
62-million-to-one** from input bytes to committed bytes.

### Live, over a real call — CONFIRMED (measured)

> **QUALIFIER (b), and it opens this subsection because this is where a reviewer looks for the live claim.**
> The attacker's client was patched in memory **on the attacker's own machine** (6 bytes at
> `WickrPro!encryptCallback`, RVA `0x147170`, a 28-byte leaf thunk with no `.pdata` record that tail-jumps
> `0x14013f820`) to emit chosen frames. That models a malicious peer, which is the threat model; **nothing
> in the victim's client was changed.** Frames are staged as `[29 zero bytes][frame]` with
> `len = 29 + frame_len`, because every real media packet reserves exactly 29 bytes at the payload pointer
> for the AEAD header (measured: 477/477 packets, audio and video alike).

The victim in each case ran a **non-perturbing** probe: three inline detours that record and return, at
`vp8_alloc_frame_buffers` entry (RVA `0x186080`, original `48895c2408`), its failure tail (RVA `0x186298`,
original `b801000000`) and `vpx_codec_decode` entry (RVA `0x17d5c0`, original `40534883ec30`) — each byte
sequence verified against the shipped DLL before patching, and restored on exit. They write to the victim
process, so we do not call them read-only; they do not alter any packet, length or allocation argument.

**Host A — 24 GiB machine, ~19.5 GiB of free commit.**

```
decode#844 len=34  first16=1001009d012aff3fff3f...
alloc: request 16383x16383   PRE-FREE mip=0x800ed26070 mi=0x800ed26238   old geom 4x4
invocations=5  FAILURES=0  decodes=845   (max geometry 16383x16383)
```

**Host B — 4 GiB machine.** Measured beforehand: commit limit 6953 MiB, commit free 1524 MiB, physical
4031 MiB.

```
decode#28 len=34   alloc: request 16383x16383   PRE-FREE mip=0x1f16d1235a0 mi=0x1f16d123768
invocations=3  FAILURES=0  (max geometry 16383x16383)
```

*(Both are excerpts: each run delivered a three-frame sequence built for Section 1 — Host A `#843 len=41` /
`#844 len=34` / `#845 len=108`, Host B `#27` / `#28` / `#29` — and only the 34-byte line is shown.)*

`FAILURES=0` in both: **the 2 GiB request succeeded on a machine with 1524 MiB of free commit**, because
Windows grew the pagefile. The operator observed **WickrPro crash / become unresponsive** after the Host B
run. The allocation and its success are instrumented; **the crash is an operator observation in the same run
and is attributed to it (INFERRED). We did not instrument commit or paging inside WickrPro on Host B, and
the run has not been repeated without the probe attached.**

**What was and was not instrumented, stated precisely:** the live runs instrumented the request, its
geometry and its success/failure. The `+2017.0 MiB` commit delta is the harness figure. We did not
instrument commit inside WickrPro over the wire.

### Reproduction

1. **Attacker side.** The 6-byte patch described above, on the attacker's own machine.
2. **Victim side.** Stock client, unmodified, plus the three-detour probe.
3. **One frame is the payload.** The live runs delivered a three-frame sequence (41 + 34 + 108 bytes) built
   for Section 1; the 34-byte keyframe is the only one that forces the allocation. **That a single frame
   suffices is INFERRED from the mechanism** — the resolution-change test at `0x18017d91d` / `0x18017d925`
   arms the reallocation on any geometry delta, and the observed stream is 360×360 — **not separately
   demonstrated.**

## 3.8 Impact

A single authenticated call peer, with no victim interaction beyond being in the call, causes an
unsandboxed process — one that hosts the UI, the crypto state and the message store in the same address
space — to commit ~2 GiB per decoder context, ~4 GiB per peer, in response to 34 bytes.

("Commit" throughout means Windows private commit charge — backed memory the system must find, in RAM or
pagefile — not working set.)

**This is not limited to memory-constrained victims.** On a host with headroom the allocation succeeds and
the memory is simply taken; that is roughly a 62-million-to-one amplification, available to anyone the
victim accepts a call from. On a host whose commit limit cannot grow, the same frame is a hard denial of
service against the client — **and here qualifier (a) is load-bearing: no allocation failure in this
engagement was produced by natural exhaustion; both live failures were induced with a Job Object cap.** On a
host in between — the common case, a laptop with a system-managed pagefile — Windows grows the pagefile and
the machine pays in paging, which is what we believe killed the client on Host B.

Two further consequences worth naming:

* **The allocation is retained.** `vp8_alloc_frame_buffers` releases the previous buffers at its own entry
  (`0x1801860a4` → `vp8_de_alloc_frame_buffers` at `0x180186320`) and again on its failure label
  (`0x180186293`); on the success path only the entry call runs, and it runs only when the geometry changes
  (`0x18017d92d`). The peer feeding that decoder context is the one who decides when the geometry next
  changes, so the memory stays committed for as long as the attacker wants it to (mechanism CONFIRMED by
  disassembly; "for the life of the call" INFERRED).
* **It is the gate for Section 1.** The use-after-free in Section 1 is reachable only when an allocation
  inside `vp8_alloc_frame_buffers` returns NULL — subject to qualifier (a). This is the only way we found
  for a peer to drive an allocation large enough to fail.

## 3.9 Bounding negatives — what this does *not* give an attacker

* **Video is required. INFERRED.** An audio-only call never instantiates a VP8 decoder — the `VpxDecoder`
  node is only built on the video receive graph. We did not retain a probe log for an audio-only call, so
  this is inferred from the graph construction rather than measured.
* **It is not pre-authentication. CONFIRMED (disassembled).** It requires an accepted, established call with
  the victim. There is no path to this from a message, an attachment or an unaccepted call.
* **The relay cannot forge the frame. CONFIRMED (disassembled) for the ordering; INFERRED for the
  conclusion.** The VP8 payload is encrypted before the `Serializer` writes `PacketHeader` (send order
  `VpxEncoder → CryptProxy → Serializer`), so the relay/SFU holds no key for it and cannot produce a payload
  the victim will accept; it can drop or corrupt one, which the AEAD rejects. Hub-side traffic was never
  captured — the rules of engagement excluded it. This contrasts with the plaintext `PacketHeader` in
  Section 2, which the relay *can* rewrite.
* **It is bounded. CONFIRMED (disassembled).** The 14-bit fields cap one request at 16383×16383, and there
  are exactly two decoder contexts per publisher. One peer is bounded to roughly 4 GiB — meaningful, but not
  unbounded, and not a per-frame accumulation.
* **Nothing is disclosed. CONFIRMED (disassembled).** The path either allocates or returns NULL. No memory
  contents travel back to the attacker on this path, and no attacker-chosen bytes are written by this
  finding alone. (Content control is a property of Section 1, not of this one.)
* **It is not persistent, as far as we traced.** The buffers are released at the next geometry change
  (CONFIRMED: `0x1801860a4` → `0x180186320`). The two decoder contexts are released on graph teardown
  through the virtual calls at `0x18014465a` and `0x180144675` — **INFERRED**: these are `call [rax+0x10]`
  and we did not resolve the targets to `vp8_de_alloc_frame_buffers`.

## 3.10 Suggested remediation

**1. Clamp the decoded dimensions before allocating. This is the same first item as Section 1's item 2, and
it is the whole fix for this finding.** Concretely, either or both of:

* *Outside the vendored library, which is where we would put it:* in the `VpxDecoder` node
  (`NPL 0x180144520`), call the codec's own `peek_si` (`iface+0x28` = `0x18017d740`) before the
  `vpx_codec_decode` at `0x180144bb3`, and drop the frame if `si.w` or `si.h` exceeds the negotiated
  `VideoFormat` geometry or a hard ceiling. A conferencing client has a known maximum useful resolution;
  4096×4096 is already far more than the observed 360×360 stream needs.
* *Inside libvpx:* in `vp8_decode` (`NPL 0x18017d780`), extend the two `> 0` guards at `0x18017db5b` and
  `0x18017db81` with upper bounds, before the `vp8_alloc_frame_buffers` call at `0x18017dbb7`.

**2. Give libvpx the geometry the call actually negotiated.** The decoder is currently initialised with
`cfg.w = cfg.h = 0` (`0x1801446fe`, immediately before the `vpx_codec_dec_init_ver` at `0x180144731`).
Filling those fields in from the announced `VideoFormat` costs nothing, documents the intent, and gives any
future libvpx a value to validate against.

**3. Bound retained decoder memory per publisher.** Two contexts × ~2 GiB is a policy nobody chose. A cap on
total retained decoder allocation per remote participant would contain this class of problem independently
of the codec.

### This fix pays twice

Item 1 removes this finding outright, and it closes Section 1's gate: with the geometry clamped, a peer
cannot drive an allocation inside `vp8_alloc_frame_buffers` that is large enough to fail, and the
use-after-free that follows an allocation failure becomes unreachable from the network. One change, two
findings. Section 1's other remediation items — null `pc->mi` and `pc->prev_mi` in
`vp8_de_alloc_frame_buffers`, tear the decoder down on allocation failure, update the bundled libvpx —
remain worth doing as defence in depth, because the dangling `pc->mi` is a real defect regardless of whether
a peer can still reach it, and because §1.3.4 shows a second route to it that does not pass through
`vp8_alloc_frame_buffers` at all.

### Relation to the earlier draft, and one correction

`DISCLOSURE-DRAFT-h1.md` carried this only as remediation item 3 of its Report 2 ("*34 wire bytes →
2017 MiB*"), i.e. as a beneficial side effect of the use-after-free fix. That understates it. It is
independently reportable, it was subsequently demonstrated live over a real call, and it affects hosts with
ample memory as well as constrained ones.

**One claim in that draft is overturned and must not be carried forward.** Its Report 2 stated the
precondition as "*any victim whose free commit is below ~4 GiB*", derived from a threshold measured at
2 × 2017 = 4034 MiB. Free commit is a snapshot, not a bound: **a default Windows install with a
system-managed pagefile grows the pagefile and satisfies the 2 GiB request** — measured directly on Host B,
where the allocation succeeded with 1524 MiB free. The correct statement of the *use-after-free's*
precondition is a commit **limit** that cannot grow, and it is stated that way in Section 1 as qualifier (a).

That correction narrows Section 1. It does **not** narrow this section: the ~2 GiB is taken from the victim
either way.

### Open questions

* **Group-call scaling is arithmetic, not measurement.** Only two operator accounts were available, so the
  N-publisher multiplier (N × 2 contexts × ~2 GiB) was never exercised. The vendor should confirm whether
  the client caps the number of simultaneously instantiated remote decoders.
* **Whether libvpx error concealment is enabled at runtime is not established.** If it is, `vp8_decode`
  allocates `prev_mip` at `0x18017ddba` — another ~76 MiB per context at 16383×16383, and the seventh
  allocation-failure exit described in §1.3.4.
* **Recovery behaviour was not instrumented.** After a 16383×16383 geometry is accepted for a publisher, we
  do not know whether the victim's client recovers that publisher's video within the same call. This
  determines whether the effect is a hitch or a session kill on hosts with headroom.
* **Whether the same unclamped 14-bit path exists in the iOS, Android and web clients** sharing this
  NPL/libvpx build is out of scope for this Windows assessment; the vendor should assume it does until
  checked, since the defect is in the vendored library and in the absence of an upstream clamp.
---

# SECTION 4 — Attack surface and hardening

None of these is a memory-safety defect. The first is the most severe single item in this document outside
Findings 1–3, and it overturns a claim carried in our own earlier notes. The rest are hardening, inventory
and one file-permission finding.

Additional artifacts for this section, beyond those listed at the head of the document: all other paths are
relative to the installed tree at `%LOCALAPPDATA%\Programs\Amazon Web Services, Wickr\AWS Wickr\`.

Everything labelled CONFIRMED in this section was re-measured against the shipped binaries during the
writing of this section, not carried forward.

## 4.1 (F4a) The WinSparkle update channel performs no signature verification in this build

**CONFIRMED by disassembly and by PE-resource and import-table measurement. Static analysis only — the
application was not launched and no update was fetched.**

> **RETRACTION, and it is the most important line in this section.** Our earlier working notes recorded the
> WinSparkle update channel as *fail-closed*, on the basis that signature verification is invoked
> unconditionally at `WinSparkle 0x180028eec` in straight-line code. **That is wrong.** There is a
> conditional branch eight instructions earlier that skips the verification call entirely, and on this build
> it is the branch that is taken. **The update channel is fail-open.**

WinSparkle verifies a downloaded installer only if a DSA public key is configured. The check is conditional:

```
0x180028e01  e85af8ffff   call 0x180028660       ; "is a DSA public key configured?"
0x180028e06  84c0         test al,al
0x180028e08  0f8428010000 je   0x180028f36       ; no key  -> skip verification
...
0x180028eec  e87b130000   call 0x18002a26c       ; VerifyDSASignature  (NOT REACHED)
...
0x180028f36  488d0df34c1a00 lea rcx,[0x1801cdc30] ; "Using unsigned updates!"
0x180028f3d  e86eebfeff   call 0x180017ab0        ; log it, then fall through to 0x180028f42
```

`0x180028f36` logs and **falls through** to `0x180028f42`, which is the same convergence point the
post-verification path reaches via `0x180028f34 jmp 0x180028f42`. The update proceeds either way.

The predicate at `0x180028660` fetches the configured key and tests the `std::string` length field:

```
0x180028660  4883ec38     sub  rsp,0x38
0x180028664  e837ffffff   call 0x1800285a0        ; returns &g_dsa_pub_pem  (0x18024e220)
0x180028669  4883781000   cmp  qword [rax+0x10],0 ; size == 0 ?
0x18002866e  0f95c0       setne al
0x180028671  eb02         jmp  0x180028675
0x180028673  32c0         xor  al,al              ; <- unreachable in linear flow: the catch handler
0x180028675  4883c438     add  rsp,0x38
0x180028679  c3           ret
```

**That key is empty in this build. Two independent measurements, and there is no third source.**

1. **The resource is absent.** `0x1800285a0` populates the global by resource lookup:
   `0x1800285d5 lea r8,[0x1801cdb70]` = `"DSAPEM"` (type), `0x1800285dc lea rdx,[0x1801cdb78]` = `"DSAPub"`
   (name), `0x1800285e8 call 0x18001820c`. Inside that helper, `0x180018234 xor ecx,ecx` sets
   `hModule = NULL` immediately before `0x180018236 call [KERNEL32!FindResourceA]`, and `hModule = NULL`
   means **the process executable**, i.e. `WickrPro.exe`. `WickrPro.exe`'s resource directory contains
   exactly four entries — `RT_ICON`, `RT_GROUP_ICON`, `RT_VERSION`, `RT_MANIFEST`. **There is no
   `DSAPEM`/`DSAPub` resource.**

   **On failure the helper throws, and the predicate swallows it.** All four failure branches
   (`0x180018242`, `0x180018252`, `0x180018270`, `0x180018274`) reach `0x1800182ba`, which is **not** an
   empty-string return — an earlier note of ours described it that way and was wrong. It builds a message
   from three literals (`0x1801c22d0` `'Failed to get resource "'`, `0x1801c22f0` `'" (type "'`,
   `0x1801c22fc` `'")'`) and ends at `0x180018335  call 0x1801426b4` = `_CxxThrowException` (MSVC EH magic
   `0x19930520` loaded at `0x1801426c9`), followed by `int3`. The throw is caught by the predicate: the
   `UNWIND_INFO` at `0x180230568` carries flags = 3 with `__CxxFrameHandler4` at `0x1801415e0`; its FH4
   `FuncInfo` at `0x180230578` has header byte `0x38` and a `TryBlockMap` at RVA `0x230585` whose count
   varint is 1 — exactly one try block — and the `xor al,al` at `0x180028673` above is otherwise
   unreachable. In other words: `catch(...) { return false; }`. **This is a stronger finding than the one we
   originally wrote: a key resource that is present but malformed or unreadable degrades to "no key" exactly
   as silently as an absent one.**

2. **The API is not called.** The only other writer of `0x18024e220` is the export
   `win_sparkle_set_dsa_pub_pem` at `0x18000cd10`. `WickrPro.exe` imports **15** WinSparkle symbols
   (`win_sparkle_init`, `…_set_app_details`, `…_set_appcast_url`, `…_set_app_build_version`,
   `…_set_update_check_interval`, `…_set_automatic_check_for_updates`, `…_check_update_with_ui`,
   `…_check_update_with_ui_and_install`, `…_cleanup`, and six callback setters) and
   `win_sparkle_set_dsa_pub_pem` is **not among them**. A tree-wide byte search over all 287 PE files finds
   the string `win_sparkle_set_dsa_pub_pem` in exactly one file — `WinSparkle.dll`'s own export table — so
   there is no `GetProcAddress` route either. Likewise `DSAPEM` occurs exactly once, in `WinSparkle.dll`'s
   own literal.

**There is no fallback check.** `WinSparkle.dll` imports no `WINTRUST` functions, so it performs no
Authenticode verification of the downloaded installer — and the byte strings `wintrust`, `WINTRUST`,
`WinVerifyTrust`, `CryptQueryObject` and `CertGetNameString` occur **zero times** in the file, which closes
the `GetProcAddress` route as well. Its only cryptographic imports are
`ADVAPI32!CryptAcquireContextW/CryptCreateHash/CryptHashData/CryptGetHashParam/CryptDestroyHash/CryptReleaseContext`
and `CRYPT32!CryptStringToBinaryA` — the SHA-1 + base64 machinery used by the DSA path that never runs. The
installer is launched through `SHELL32!ShellExecuteExW` (`0x1800202e8`). *(The verify function itself is not
the problem: `0x18002a293 cmp qword [rdx+0x10],0 / je` → `"Missing DSA signature!"` (`0x1801cde50`) does
reject an empty signature — but only if it is called at all.)*

**What remains as protection, and what is not established.** Transport security only. The appcast URL is not
a compile-time literal: `WickrPro 0x1400a12c2` calls `win_sparkle_set_appcast_url` with the UTF-8 of a
`QString` member of `WickrWinSparkleWorker` (`[r12+0x18]`), which is runtime-configured. **Whether that URL
is `https://` on every deployment, and whether the download URL in the appcast XML is constrained to HTTPS,
is UNDETERMINED from static analysis.**

WinSparkle does not disable certificate validation, and it explicitly asks for TLS. The `dwFlags`
argument to `InternetOpenUrlA` at `0x180016e7c` is the 5th parameter, `[rsp+0x20] = ebx`, and `ebx` is
**computed**, not a constant — CONFIRMED (disassembled):

```
0x180016de6  8b9d00350000   mov ebx, dword ptr [rbp + 0x3500]
0x180016dec  83e301         and ebx, 1
0x180016def  c1e308         shl ebx, 8
0x180016df2  81eb0000007c   sub ebx, 0x7c000000
0x180016dfe  0fbadf17       bts ebx, 0x17            ; set bit 23 = INTERNET_FLAG_SECURE
```

so `dwFlags = 0x84800000` — `INTERNET_FLAG_RELOAD` (`0x80000000`) | `INTERNET_FLAG_NO_CACHE_WRITE`
(`0x04000000`) | **`INTERNET_FLAG_SECURE` (`0x00800000`)** — plus `INTERNET_FLAG_PRAGMA_NOCACHE`
(`0x100`) when `[rbp+0x3500] & 1`. Neither `INTERNET_FLAG_IGNORE_CERT_CN_INVALID` (`0x1000`) nor
`INTERNET_FLAG_IGNORE_CERT_DATE_INVALID` (`0x2000`) is set. **Certificate validation is enforced, so a
plain network attacker cannot substitute the appcast.**

**But `INTERNET_FLAG_IGNORE_REDIRECT_TO_HTTP` (`0x8000`) is not set and `INTERNET_FLAG_NO_AUTO_REDIRECT`
(`0x200000`) is not set, so an HTTPS→HTTP redirect is followed silently.** That is harmless when
signatures are checked. It is not harmless here.

> **Correction to an earlier revision of this section.** It stated that the flag word was the constant
> `0x10000000` loaded at `0x180016d64`. That is wrong twice: `0x10000000` is not
> `INTERNET_FLAG_RELOAD` (which is `0x80000000`), and the `mov ebx, 0x10000000` at `0x180016d64` is the
> `ICU_DECODE` argument for the **`InternetCrackUrlA`** call at `0x180016d6e`, a different API earlier in
> the same function. `ebx` is reloaded at `0x180016de6` before the fetch. The conclusions above are
> unchanged in direction, but the protection is *stronger* than that revision described, because
> `INTERNET_FLAG_SECURE` is set explicitly.

**Impact, stated conservatively.** Anyone who can control the bytes returned for the appcast or the
installer URL — a TLS-terminating middlebox on a `http://` deployment, a compromised or mis-configured
update host, or a DNS/BGP position against a non-HTTPS endpoint — can cause `WickrPro.exe` to download and
execute an arbitrary program on the user's machine, with the user's privileges, through the application's
own update flow. **This is independent of Findings 1, 2 and 3 — it involves no memory corruption and no
control of the instruction pointer; it is the update flow running an installer the product never
authenticated. We did not attempt it. No network traffic was directed at Wickr or any third party, and no
update was fetched. This is a static determination about which code path is reachable in the shipped
binaries.**

**Remediation, concretely.**

1. Call `win_sparkle_set_dsa_pub_pem()` from `WickrWinSparkleWorker` before `win_sparkle_init()`, with the
   Wickr release-signing public key — **or** embed the key as a `DSAPEM`-typed resource named `DSAPub` in
   `WickrPro.exe`, which is what `0x1800285a0` already looks for. Either one makes `0x180028660` return true
   and puts `0x180028eec` back on the path.
2. Independently, make the "no key configured" case **fail closed** rather than log and continue: the branch
   at `0x180028e08` should abort the update, not skip the check. This also covers the near-miss case:
   because `0x18001820c` throws on any resource-lookup failure and `0x180028660` catches it and returns
   false, a `DSAPub` resource that is present but malformed or unreadable degrades to "no key" exactly as
   silently as an absent one. Failing closed at `0x180028e08` is what catches that. WinSparkle's upstream
   behaviour here is a deliberate developer convenience; a shipping end-to-end-encrypted messenger should not
   inherit it. Consider carrying a local patch, or upgrading to a WinSparkle release with EdDSA support and
   setting that key instead.
3. Verify Authenticode on the downloaded installer as defence in depth (`WinVerifyTrust` plus a
   publisher-name check), so that a signature-config regression cannot silently reopen this.
4. Pin the appcast and download URLs to `https://` and reject non-HTTPS redirects by adding
   `INTERNET_FLAG_IGNORE_REDIRECT_TO_HTTP` (`0x8000`) to the computed flag word — the `bts ebx, 0x17`
   at `WinSparkle 0x180016de6`–`0x180016dfe`, whose result reaches `InternetOpenUrlA` at
   `0x180016e7c`. (Not `0x180016d64`; that constant belongs to the `InternetCrackUrlA` call.)
5. While that ships: OpenSSL 1.0.x (§4.5) is statically linked into `WinSparkle.dll` and has been end-of-life
   since 2019-12-31. The DSA verification path that item 1 turns on runs through it. Update WinSparkle to a
   build with a supported crypto library at the same time.

**Live confirmation the vendor can do in one run, which we could not:** observe the `"Using unsigned
updates!"` log line on an update check.

## 4.2 (F4b) Control Flow Guard is instrumented into 276 of 287 shipped binaries and is inert in all of them

**CONFIRMED (measured from the PE headers of the installed tree).**

Windows enables CFG for a process from the **main executable's** `DllCharacteristics`. `WickrPro.exe` does
not set the bit:

| Module | `DllCharacteristics` | `GUARD_CF` | `GuardFlags` | Guard CF function table |
|---|---|---|---|---|
| **`WickrPro.exe`** | **`0x8160`** | **CLEAR** | `0x100` | **none, count 0** |
| `QtWebEngineProcess.exe` | `0xc160` | SET | `0x10017500` | 1,624 entries |
| `Qt6WebEngineCore.dll` | `0x4160` | SET | `0x10017500` | 401,422 entries |
| `Qt6Pdf.dll` | `0x4160` | SET | `0x10017500` | 7,542 entries |
| `imageformats\qpdf.dll` | `0x4160` | SET | `0x10017500` | 52 entries |
| `NPL.dll`, `Sock5.dll` | `0x0160` | CLEAR | `0x100` | none |

Across the whole installed tree: **287 PE files, 276 with `GUARD_CF` set, 11 without.** The 11 are
`WickrPro.exe`, `crashpad_handler.exe`, `NPL.dll`, `Sock5.dll`, `WickrMlsSdkCpp.dll`, `WinSparkle.dll`,
`QZXing3.dll`, `crypto.dll`, `ssl.dll`, `aws_lc_fips_0_13_14_crypto.dll`, `sentry.dll`.

The consequence is the point. `Qt6Pdf.dll` and `Qt6WebEngineCore.dll` already **pay** for CFG — the compiler
emitted a `__guard_check_icall` call before every indirect branch, and the images carry the valid-target
bitmaps. **Documented Windows loader behaviour** (stated as such, not measured by us): when the process is
not CFG-enabled the loader points `__guard_check_icall_fptr` at a stub that returns immediately, so every
one of those checks is a no-op. The mitigation is bought and not switched on.

`WickrPro.exe` sets `GuardFlags = 0x100` (`IMAGE_GUARD_CF_INSTRUMENTED`) but ships
`GuardCFFunctionCount = 0` and no function table, which is the signature of `/guard:cf` having been dropped
at link time rather than never requested. (It does carry a `GuardCFDispatchFunctionPointer` — the **data
slot** at `0x140d58d28`, holding `0x140cc55c0` — which is why vtable dispatches in the image go through it;
the guard is instrumented and inert.)

**CET / shadow stack — CONFIRMED absent from the main process.** `WickrPro.exe` has no
`IMAGE_DEBUG_TYPE_EX_DLLCHARACTERISTICS` debug directory entry at all, so
`IMAGE_DLLCHARACTERISTICS_EX_CET_COMPAT` is not asserted. `QtWebEngineProcess.exe` and `Qt6Pdf.dll` **do**
carry that entry with the bit set — again, the sandboxed helper is hardened and the process that holds the
crypto state and the message store is not.

**Why it matters here specifically.** `WickrPro.exe` is the process that decodes peer media (Findings 1–3),
decodes remote images with the format sniffed (§4.3), and holds the account keys. It runs with the default
NT heap, CFG off and CET off. That is the environment in which **any** corrupted code pointer would be worth
the most. *(Findings 1–3 do not demonstrate one: none establishes control of the instruction pointer from a
remotely deliverable input — see qualifier (c) and §1.7.)*

**Remediation.** Link `WickrPro.exe` with `/guard:cf` and `/CETCOMPAT`. This is a link-flag change to one
binary; no source change is required for the 276 DLLs that are already instrumented. Adding `/guard:cf` to
`NPL.dll` is a second, larger step and is worth doing separately.

## 4.3 (F4c) Remote content is decoded with the format sniffed, in the unsandboxed main process

**CONFIRMED at instruction level.** `QImage::loadFromData(const QByteArray&, const char *format)` is called
at `0x140c1517a` with `format = nullptr`, on a buffer that is provably the body of a `QNetworkReply`.

The buffer's provenance, closed end to end:

```
; accumulation — function 0x140c14080
0x140c14089  488b4110    mov  rax,[rcx+0x10]      ; QPointer guard on the reply
0x140c140a6  ff15f4061400 call [0x140d547a0]      ; Qt6Core!QIODevice::readAll
0x140c140ad  488d8b88010000 lea rcx,[rbx+0x188]   ; the member buffer
0x140c140b4  488bd0      mov  rdx,rax             ; <- the bytes readAll() returned
0x140c140b7  ff15eb131400 call [0x140d554a8]      ; Qt6Core!QByteArray::append

; decode — function 0x140c14f70
0x140c15004  call Qt6Network!QNetworkReply::attribute ; and 0x140c15010 QVariant::toInt -> esi
0x140c1512a  8d8638ffffff lea eax,[rsi-0xc8]
0x140c15130  83f863       cmp eax,0x63            ; HTTP 200..299 gate
0x140c15139  488d9f88010000 lea rbx,[rdi+0x188]   ; the same member buffer
0x140c15154  ff1546ef1300 call [0x140d540a0]      ; QByteArray copy ctor -> local
0x140c1516f  4533c0       xor r8d,r8d             ; format = NULL
0x140c15172  488d55c7     lea rdx,[rbp-0x39]      ; the bytes
0x140c15176  488d4daf     lea rcx,[rbp-0x51]      ; a default-constructed QImage
0x140c1517a  ff15f8101400 call [0x140d56278]      ; Qt6Gui!QImage::loadFromData
```

`0x140c1533b` is another arm of the type dispatch at `0x140c15143`; **it also sniffs.** (The dispatch has
three arms; the third, at `0x140c15304`, does not decode. `0x140c1517a` and `0x140c1533b` are the only
`loadFromData` sites in that function.)

**The census, and its limits — CONFIRMED by mechanised sweep.** `WickrPro.exe` imports three image-decode
entry points from `Qt6Gui.dll`:

| import | sites | of which `format = NULL` |
|---|---|---|
| `0x140d56278` `QImage::loadFromData(const QByteArray&, const char*)` | 9 (`0x1400c2d4d`, `0x1400c2edd`, `0x140968525`, `0x1409797a5`, `0x1409a422a`, `0x1409f754b`, `0x1409f777d`, `0x140c1517a`, `0x140c1533b`), zero register-indirect | all 9 |
| `0x140d56028` `QImage::QImage(const QString&, const char*)` | 10 | 9 (`0x14003b852`, `0x140045bfd`, `0x1400dc9e9`, `0x1400dcc9d`, `0x1400ddbea`, `0x1400e4fe4`, `0x1400fa0dd`, `0x14013bcc3`, `0x1409f30b5`); the tenth, `0x1400dd962`, passes `"PNG"` loaded at `0x1400dd953` |
| `0x140d56538` `QPixmap::load(const QString&, const char*, Qt::ImageConversionFlags)` | 13 | all 13 |

There is no `QImageReader`, no `QPixmap::loadFromData` and no `QMovie` in the import table.

*The 13 `QPixmap::load` sites are a bounding negative, not part of the finding:* they are all inside one
function (`0x1408d5820`–`0x1408d5b0a`) and every one loads a compiled-in Qt resource path
(`:/products/AWSWickrGov/AWSWickrGov.png`, `:/products/WickrProAlpha/WickrProAlpha.png`, …). They are listed
because a vendor engineer running `dumpbin /imports | findstr QPixmap` will find them and should not
conclude the census missed a path.

**PDFium is in the sniffing set — CONFIRMED by disassembly.** `imageformats\qpdf.dll` registers a
`QImageIOHandler` plugin whose format sniff at `0x1800014f0` — called from the plugin's `capabilities()` at
`0x18000113f`, its only caller; nothing in the binary names the function, so any name for it is ours — peeks
six bytes and `strncmp`s two magics:

```
0x180001503  41b806000000 mov  r8d,6
0x18000150e  ff15042c0000 call [0x180004118]      ; Qt6Core!QIODevice::peek
0x180001520  488d1505330000 lea rdx,[0x18000482c] ; "%PDF-"
0x18000152c  ff152e2f0000 call [0x180004460]      ; strncmp
0x18000153c  488d15f1320000 lea rdx,[0x180004834] ; "\n%PDF-"
0x180001548  ff15122f0000 call [0x180004460]      ; strncmp
```

**The plugin set is resident in the main process.** Ten `QImageIOHandler` plugins ship in `imageformats\`:
`qgif qicns qico qjpeg qpdf qsvg qtga qtiff qwbmp qwebp`. A tree-wide import census confirms `Qt6Pdf.dll` is
imported by exactly two modules, `Qt6PdfQuick.dll` and `imageformats\qpdf.dll`. `Qt6Quick.dll` imports
`QImage::loadFromData` and the full `QImageReader` API and lives in the same process, so the QML
image-provider path sniffs as well.

*(An earlier draft of ours argued that the plugin machinery cannot run in the sandboxed helper because
`QtWebEngineProcess.exe` does not import `Qt6Gui.dll`. The premise is right — it imports 22 DLLs, the only
Qt modules being `Qt6Core.dll` and `Qt6WebEngineCore.dll` — but the inference is wrong and is withdrawn:
`Qt6WebEngineCore.dll` itself imports `Qt6Gui.dll` and `Qt6Quick.dll`, so `Qt6Gui` **is** mapped there. The
finding does not need it: every `loadFromData` call site enumerated above is in `WickrPro.exe`.)*

### The MIME allowlist that protects nothing

Worth calling out separately because it shows the pattern is not an oversight in one place. Function
`0x140045870` (the profile-picture loader — identified by the reject-arm string
`"Unable to load profile pic with mime type"` at `0x140e3f100`, referenced at `0x140045b1e`) resolves the
file's MIME type with `QMimeDatabase::mimeTypeForFile` (`0x1400458c5`) and compares it against a four-item
allowlist — `"image/png"` (`0x140e3ed40`), `"image/jpeg"` (`0x140e3ed50`), `"image/bmp"` (`0x140e3ed60`),
`"image/gif"` (`0x140e3ed70`). On a match it jumps to `0x140045bf2` and does this:

```
0x140045bf2  4533c0       xor  r8d,r8d            ; format = NULL
0x140045bf5  498bd6       mov  rdx,r14            ; the same path it just classified
0x140045bfd  ff152504d100 call [0x140d56028]      ; Qt6Gui!QImage::QImage(const QString&, const char*)
```

The classification result is discarded. `QImage` re-sniffs from scratch and may select any of the ten
plugins.

**Scope note, and it is a real one.** What is CONFIRMED is that **network-reply-supplied** bytes reach
`format = NULL` — specifically at `0x140c1517a` and `0x140c1533b`, whose provenance is closed above. Whether
a *peer* controls those bytes at the other sites (attachment fetch vs link preview vs server-side asset)
rests on a sender-side trace that is not re-verified here. **Treat "network-reply-supplied" as CONFIRMED and
"peer-supplied" as INFERRED.** Site `0x1400c2d4d` in particular decodes field `+0x90` of a `0x130`-byte
record whose writer was never identified; do not record it as closed in either direction.

**Remediation.**

1. At `0x140c1517a` / `0x140c1533b`, pass the format negotiated from the HTTP `Content-Type` (or sniffed
   exactly once and then pinned) instead of `nullptr`.
2. At `0x140045bfd` and the other eight `QImage(QString)` NULL sites, pass the format the caller already
   determined — `0x140045870` literally has the answer in a local and throws it away.
3. Restrict the plugin set used for remote content. `QImageReader::setAllowedFormats()`, or shipping a
   reduced `imageformats\` set for the code path that handles peer content, removes PDFium, TIFF, TGA, ICNS
   and WBMP from a sender's menu without any functional loss on paths that only ever carry
   PNG/JPEG/GIF/WebP.

### Bounding negatives for this item

**libwebp carries the CVE-2023-4863 fix, in both copies, verified by structure rather than by version
label.** `imageformats\qwebp.dll` contains `VP8LHuffmanTablesAllocate` at `0x18006bd40` — an 83-byte
function writing the post-fix struct layout literally (`0x18006bd50 mov [rdx+0x20],rdx` =
`curr_segment = &root`; `0x18006bd57 mov qword [rdx+0x10],0` = `next = NULL`; `0x18006bd85 mov [rbx+0x18],edi`
= `size`). `VP8LBuildHuffmanTable` at `0x18006bbd0` performs the added sizing dry run before anything is
written — `0x18006bbfd mov qword [rsp+0x20],0` (`sorted = NULL`), `0x18006bc06 xor ecx,ecx`
(`root_table = NULL`), `0x18006bc0e call 0x18006b740`, then `test eax,eax` / `je` — followed by the capacity
test `0x18006bc3e cmp r8,rcx` / `0x18006bc41 jb`. The second copy, inside `Qt6WebEngineCore.dll`, is the
same code: `VP8LHuffmanTablesAllocate` at `0x18515a720` is instruction-for-instruction identical to
`0x18006bd40` (88 of 88 bytes match except offsets 37–40, a call displacement). The pre-fix shape — one
unvalidated `BuildHuffmanTable` writing into a fixed `kTableSize` block — is not present in either image.
**The post-fix structure is CONFIRMED (disassembled) in both copies; that this structure first appears in
libwebp 1.3.2, and therefore that the floor is ≥ 1.3.2, is INFERRED from upstream** — no version literal
survives, and the rules of engagement forbid fetching the upstream tree to check.

**`NPL.dll` vendors its own libjpeg-turbo and peer bytes cannot reach it** — see §1.8, where the two gates
(`0x180125964`/`0x180125967` and `0x1800f0570`/`0x1800f0579`/`0x1800f057c`) and the INFERRED closure are
stated in full. Note this negative is specific to *NPL's* copy: the product ships four copies of
libjpeg-turbo, three of them in the unsandboxed main process, and the sniffed image-decode surface above is
the route to two of them.

**XFA is disabled — CONFIRMED, and it is a genuine negative.** `Qt6Pdf.dll` contains no `v8::` symbols and
no `fxjs` strings, and has no V8 in its import table. That removes PDFium's XML-forms and JavaScript engine
from the `%PDF-` path described above. *(The byte strings `originalXFAVersion` and `XFAWidget` do occur —
they are PDF dictionary key names in the parser's vocabulary, not engine code. The claim is "no XFA/JS
engine", not "no XFA tokens".)*
## 4.4 (F4d) The application installs into a user-writable directory

**CONFIRMED — by ACL inspection and by an actual write test on this host.**

The install root is `%LOCALAPPDATA%\Programs\Amazon Web Services, Wickr\AWS Wickr\`. The interactive user
account holds `FullControl` on the directory **and on `WickrPro.exe` itself**, and owns the directory. Two
tests, run without elevation:

* **Plant:** created a new file inside the install directory and removed it again — allowed.
* **Replace:** opened `WickrPro.exe` (55,890,344 bytes) with `FileAccess.Write` — allowed. No bytes were
  written.

Any process running as that user — a browser download, a script, a second application, malware with no
privileges beyond the user's own — can replace `WickrPro.exe`, replace any of the 286 other PE files, or
plant a DLL that the loader will pick up, with **no UAC prompt and no elevation**. The change survives
reboot and is indistinguishable from the shipped product to a user.

This compounds with §4.2 in one specific way. Because `WickrPro.exe` is the module that decides whether the
process gets CFG, an attacker who replaces or patches that one file also decides the mitigation policy for
every DLL in the process. Whichever way that file is modified, the modification is same-privilege, so it is
not a privilege-escalation finding; it is a **persistence and integrity** finding for a product whose whole
value is the integrity of one client binary.

**Remediation.** Install to `%ProgramFiles%` with the standard machine-wide ACL (`Users` = read and execute
only), the way per-machine MSI/EXE installers do, and offer the per-user location only as an explicit
fallback with the trade-off stated. If per-user install must remain the default, at minimum tighten the ACL
on the install directory so that the installing user does not hold write access to the installed binaries
after installation completes.

## 4.5 (F4e) Component inventory and staleness

Every row states how it was established. "CONFIRMED (string)" means a version literal is physically present
and was read out of the shipped file; "CONFIRMED (disassembled)" means a version constant or a structural
fingerprint was read out of instructions.

| Component | Where | Version | Label / basis |
|---|---|---|---|
| Qt / QtWebEngine | `Qt6WebEngineCore.dll` | **6.9.2** | CONFIRMED (disassembled). Export `?qWebEngineVersion@@YAPEBDXZ` @ `0x1803031a0` is `lea rax,[0x188b552fc]` / `ret`; `0x188b552fc` = `"6.9.2"` |
| Chromium base | `Qt6WebEngineCore.dll` | **130.0.6723.192** (Oct 2024) | CONFIRMED (disassembled). Export `?qWebEngineChromiumVersion@@` @ `0x180303180` → `0x188b55320` = `"130.0.6723.192"` |
| Chromium "security patch version" | `Qt6WebEngineCore.dll` | **139.0.7258.67** | CONFIRMED **as a string**; **UNDETERMINED as a patch state**. See below |
| PDFium | `Qt6Pdf.dll` | Chromium-130 snapshot; **no upstream version exists to pin** | CONFIRMED. Shares `icu_74`/`icudt74l`, `libpng 1.6.43`, `zlib 1.3.0.1-motley` with `Qt6WebEngineCore.dll` |
| FreeType | `Qt6Pdf.dll` | **2.13.3** | CONFIRMED (disassembled). Three immediates in `FT_New_Library`: `0x180054833 mov [rbx+8],2` / `0x18005483a mov [rbx+0xc],0xd` / `0x180054841 mov [rbx+0x10],3` |
| OpenJPEG | `Qt6Pdf.dll` | present, **unversioned** | UNDETERMINED. `opj_*` diagnostic strings present; no version literal. Reachable from a `%PDF-` blob via JPXDecode |
| JBIG2 | `Qt6Pdf.dll` | PDFium in-tree | CONFIRMED (string `CJBig2_GRDProc`) |
| libjpeg-turbo #1 | `imageformats\qjpeg.dll` | **3.0.3** | CONFIRMED (string) `"libjpeg-turbo version 3.0.3 (build )"`, `(C) 1991-2024` |
| libjpeg-turbo #2 | `Qt6WebEngineCore.dll` | **2.1.5.1** | CONFIRMED (string), `(C) 1991-2022` |
| libjpeg-turbo #3 | `Qt6Pdf.dll` | **2.1.5.1** | CONFIRMED (disassembled, by identity). `jpeg_CreateDecompress` @ `0x180276a40` is 380 bytes / 88 instructions; the version-bearing copy @ `0x184c91430` is also 380 bytes / 88 instructions; **88 of 88 mnemonics match and 10 of 380 bytes differ, every one inside a `call`/`jcc` displacement field** |
| libjpeg-turbo #4 | `NPL.dll` | **2.x, ≥ 2.0, < 3.0, older than 2.1.5.1** | CONFIRMED as a bracket; exact point release **UNDETERMINED**. The banner reads `(C) 1991-2021` against 2.1.5.1's `(C) 1991-2022` and 3.0.3's `(C) 1991-2024` |
| libwebp | `imageformats\qwebp.dll`, `Qt6WebEngineCore.dll` | **≥ 1.3.2** | Post-fix structure CONFIRMED (disassembled) in both copies (§4.3); the mapping to release 1.3.2 is INFERRED |
| mbedTLS | `Sock5.dll` | **2.1.5** (2015) | CONFIRMED (string) `"mbed TLS 2.1.5"` |
| SQLite | `Sock5.dll` | **3.19.2** (2017-05-25) | CONFIRMED (string). Both the literal `3.19.2` and the SQLite source-id `2017-05-25 16:50:27 edb4e819…` are present |
| SQLite (message store, via SQLCipher) | `WickrPro.exe`, `WickrMlsSdkCpp.dll` | source-id **2024-08-13** | CONFIRMED (string). This copy is current; the 2017 one is not this one |
| SQLite (Qt driver) | `sqldrivers\qsqlite.dll` | source-id **2025-07-30** | CONFIRMED (string) |
| SQLite (Chromium) | `Qt6WebEngineCore.dll` | source-id **2024-05-23** | CONFIRMED (string) |
| WinSparkle | `WinSparkle.dll` | **0.8.0**, built **2023-03-29 13:34:04 UTC** | CONFIRMED. VS_VERSIONINFO `FileVersion`/`ProductVersion` = 0.8.0; PE `TimeDateStamp` = `0x64243e4c` |
| OpenSSL (static, inside WinSparkle) | `WinSparkle.dll` | **1.0.x** | CONFIRMED (structural) — **1.0.2 INFERRED**. 107 distinct `…\3rdparty\openssl\crypto\…` source paths, including `crypto\cryptlib.c`, `crypto\mem_dbg.c`, `crypto\ex_data.c` and `crypto\rand\md_rand.c`, all of which were relocated or deleted in OpenSSL 1.1.0. No version banner survives. The whole 1.0.x line has been end-of-life since 2019-12-31 |
| MLS SDK | `WickrMlsSdkCpp.dll` | `mls-rs 0.54.0` + `mls-rs-codec 0.7.0`, `mls-rs-crypto-hpke 0.20.0`, `mls-rs-provider-sqlite 0.22.0` | CONFIRMED (strings), Rust panic machinery present |
| Crypto | `crypto.dll` / `ssl.dll`, `aws_lc_fips_0_13_14_crypto.dll` | AWS-LC FIPS | CONFIRMED (strings) |

`Sock5.dll` is a **non-delay** import of `WickrPro.exe` (4 symbols: `DispersiveTunnelStart` / `Stop` /
`CheckStatus` / `SetLogCallback`), so its mbedTLS 2.1.5 and SQLite 3.19.2 are mapped at process start
unconditionally.

### ★ (F4f) A received PDF drives an out-of-bounds heap write in the shipped PDFium — demonstrated

This is the most serious item in Section 4 and we have separated it out. It needs **no server compromise,
no network position, no user interaction beyond receiving content, and no memory precondition.**

**The chain, end to end — CONFIRMED (disassembled and measured).**

| step | evidence |
|---|---|
| remote bytes reach a **format-sniffed** decode | §4.3: the buffer at `[rdi+0x188]` handed to `QImage::loadFromData` at `WickrPro 0x140c1517a` is provably `reply->readAll()` (`0x140c140a6`/`0x140c140b7`), with `format = NULL` |
| the sniffer offers PDF | `imageformats\qpdf.dll` ships, declares `application/pdf` in its plugin metadata, and contains the `%PDF-` magic test |
| `qpdf.dll` is a thin shim onto PDFium | it imports **12 symbols from `Qt6Pdf.dll`**, including `QPdfDocument::QPdfDocument()` |
| `Qt6Pdf.dll` **is** PDFium | `JBig2`, `OpenJpeg`/`opj_`, `FaxDecode`, `RunLengthDecode`, `AESV2`/`AESV3`, and a full bundled FreeType (`truetype`, `cff`, `type1`, `type42`, `t1cid`, `psaux`, `pshinter`) handling `FontFile`/`FontFile2`/`FontFile3`/`CIDFontType0`/`CIDFontType2` |
| the process is unsandboxed, and **CFG is inert** | §4.2 (F4b); the same address space holds the key material and the message store |

**The build date is the proof, and it is arithmetic rather than inference — CONFIRMED (measured).**
PE `TimeDateStamp`, read from the shipped files:

```
Qt6Pdf.dll              2025-09-17 13:01:40 UTC    sha256 d0966d14081034dac8bd067870b26afba5a102982713aba746d24d2893ce0d46
imageformats\qpdf.dll   2025-09-17 13:01:56 UTC    sha256 8242f12cf5c5292a65eb1196b86a578f9f4f06dcca23d3a31cc5855e6ce90fb8
Qt6WebEngineCore.dll    2025-09-17 12:45:48 UTC    sha256 6617c6642d414852298626a2ae5f31bd0eea309d6b504befc379c6fc259cf0b0
qtiff.dll               2025-09-17 06:52:46 UTC    sha256 e31de7126612f0b5e459c43f146e3547516bbfe48adaf401c6c9da5eec405ee6
Qt6Gui.dll              2025-09-17 01:44:47 UTC    sha256 b448ff51589da181edca79aa194ad3ee3c9af8341e18d6ca4128ee8fc9139698
WickrPro.exe            2026-07-13 21:52:58 UTC
```

These are genuine timestamps, not `/Brepro` reproducible-build hashes: the six values are **plausible,
distinct and monotonically ordered across a single working day** (01:44 → 13:01), which a content hash
would not be. **The application itself was rebuilt on 2026-07-13; the Qt libraries it ships are ten months
older.**

**⇒ A binary linked on 2025-09-17 cannot contain a fix that was written in 2026.** The following PDFium
fixes all post-date it. Descriptions are quoted verbatim from the CVE records; the Chrome versions are
Google's own.

| CVE | Google's description (verbatim) | fixed in |
|---|---|---|
| **CVE-2026-2648** | "Heap buffer overflow in PDFium … allowed a remote attacker to perform an out of bounds memory write via a crafted PDF file." **High** | Chrome 145.0.7632.109 (2026-02-18) |
| **CVE-2026-4455** | "Heap buffer overflow in PDFium … allowed a remote attacker to potentially exploit heap corruption via a crafted PDF file." **High, CVSS 8.8** | Chrome 146.0.7680.153 |
| **CVE-2026-6306** | "Heap buffer overflow in PDFium … allowed a remote attacker to **execute arbitrary code inside a sandbox** via a crafted PDF file." | Chrome 147.0.7727.101 |
| **CVE-2026-6361** | Heap buffer overflow in PDFium, Windows. **High** | Chrome 147.0.7727.101 (2026-04-15) |
| **CVE-2026-11303 / 11305 / 11307** | Use-after-free in PDFium. **High, CVSS 8.8** | Chrome ~148–150 (2026-06) |
| CVE-2025-1918 | Out-of-bounds **read** in PDFium | Chrome 134.0.6998.35 |

**This does not depend on defeating Qt's backport claim.** `Qt6WebEngineCore.dll` self-reports a security
patch level of `139.0.7258.67` (§ below). **Every entry in the table above was fixed after 139**, so it is
outside that claim even if the claim is taken entirely at face value. Independently, the bundled
third-party stack measures at the 130 baseline (ICU 74, libpng 1.6.43, zlib 1.3.0.1-motley,
libjpeg-turbo 2.x).

**The context is worse here than in the browser the advisories describe.** CVE-2026-6306's own wording is
"execute arbitrary code **inside a sandbox**" — in Chrome, PDFium runs in a sandboxed renderer with CFG
enabled. In Wickr Desktop it runs **in the main process, unsandboxed, with CFG inert (§4.2)**, alongside the
message database and the key material.

### Which part of PDFium is actually in this build — MEASURED, with a control

Per-CVE component attribution is **not possible from public sources**: Chromium security bugs stay
restricted, and the `chromium/pdfium` GitHub mirror stopped syncing on **2025-11-19**, so none of the 2026
fixes is visible there. Rather than guess which function each CVE touches, we measured the surface — if a
subsystem is compiled in, a defect in it is reachable; if it is absent, it is not. **`Qt6WebEngineCore.dll`
(a full PDFium build in the same product) is the control**, which is what makes an absence meaningful
rather than a failure of the probe.

| PDFium subsystem | shipped `Qt6Pdf.dll` | control | |
|---|---|---|---|
| parser / object model, xref, object streams | present | present | |
| Flate, LZW, ASCIIHex/85, RunLength | present | present | |
| CCITT fax | present | present | |
| DCT (libjpeg) | present | present | |
| **JPX (OpenJPEG)** | **present** | present | ★ |
| **JBIG2** | **present** | present | ★ |
| **embedded font programs** (`FontFile`/`2`/`3`) | **present** | present | ★ |
| TrueType / CFF / Type1 / Type42 / CID | present | present | |
| colour spaces, shading, patterns | present | present | |
| transparency groups, soft masks | present | present | |
| image XObjects | present | present | |
| document encryption (AESV2/V3) | present | present | |
| annotations / appearance streams | present | present | |
| — JavaScript (V8) | **ABSENT** | present | |
| — PDF JS API (FXJS / CJS_) | **ABSENT** | present | |
| — XFA | **ABSENT** | present | |
| — form fill (CPDFSDK_) | **ABSENT** | present | |

**18 of 18 parsing and decoding subsystems are present. All four scripting/forms subsystems are absent, and
all four are present in the control** — so the absence is a real build configuration difference, not a
limitation of the measurement.

⇒ **The entire parsing and decoding surface of PDFium is reachable from a sent file; only the
scripting-driven surface is not.** The three filters with the worst memory-safety history in the format —
JBIG2, JPX and embedded font programs — are all present.

### Each of the four heap overflows, attributed to its upstream fix and tested against this build

We did not stop at version arithmetic. Each CVE was traced to the pdfium revision Chrome pins for the
fixing release (from Chromium's `DEPS` at the release tag), then to the cherry-pick on that release branch,
then to the source diff, and finally checked against the shipped `Qt6Pdf.dll`. Gitiles blocks anonymous
*history* pages but serves per-commit metadata and raw file content at an arbitrary SHA, which is enough.

**Three of the four are NOT reachable in this build, and we say so.** That is the most useful part of this
subsection for AWS: it is not "your PDFium is old so everything applies", it is a per-defect verdict.

| CVE | upstream fix (pdfium) | component | verdict for the preview path |
|---|---|---|---|
| **CVE-2026-2648** | `004b476195` `[M145] Redo: Fix indexing in opj_j2k_read_sod()`, **`Bug: 477033835`** — the same bug ID Google's release note gives for this CVE | **OpenJPEG** (JPX image filter) | **REACHABLE — and we executed the out-of-bounds write. See below.** |
| **CVE-2026-4455** | `bccc616f83` `[M146] Manually patch logic for k8bppmask and 3 byte constant` (trunk original `ee83ca8ef7`) | FreeType glyph bitmap copy in `CFX_Face::RenderGlyph` | **code present, precondition NOT reached** — see below |
| **CVE-2026-6306** | candidates on the M147 branch: `da11aad230` "Patch an overflow in libtiff" and `b34626f5fd` "Patch an overflow in Little CMS" | libtiff / Little CMS | **NOT REACHABLE — both entry points are absent from this build** |
| **CVE-2026-6361** | `e5bafd3be5` `[M147] Use safe arithmetic in CFX_PSRenderer::DrawDIBits()` | `core/fxge/win32/` PostScript renderer | **NOT REACHABLE from a preview** — that is the print path, consistent with NVD's "convinced a user to engage in specific UI gestures" and `AC:H` |

**Why the two CVE-2026-6306 candidates cannot fire here — CONFIRMED (measured, with a control).**

* **libtiff is not linked into `Qt6Pdf.dll`.** `LIBTIFF`, `TIFFReadDirectory` and `JPEGSetupEncode` are all
  absent from it and all present in `Qt6WebEngineCore.dll`, so the probe works and the absence is real.
* **Little CMS *is* linked** (its error strings and the ICC magic test `cmp edx, 0x61637370` at
  `Qt6Pdf 0x18009e258` / `0x180227791` are present) **but nothing in a PDF can feed it.** The colour-space
  name `ICCBased` occurs **0** times in `Qt6Pdf.dll` and **1** time in the control; `DeviceN`,
  `OutputIntent` and `DestOutputProfile` are likewise 0 / 8 / 2 / 1. There is no `/ICCBased` handler, so an
  attacker-supplied ICC profile never reaches lcms.
* Independently, the lcms defect needs **≥ 5 CLUT input channels**: the grid points are single bytes, and
  255⁴ = 4,228,250,625 **< 2³²**, so four or fewer channels cannot overflow `CubeSize()` at all. PDF's
  `/ICCBased` permits `/N` of 1, 3 or 4 only. Two independent reasons, either sufficient.

*(For completeness: the shipped `Qt6Pdf.dll` **does** carry the pre-fix `CubeSize()` — `imul` at
`0x18022bfb6` precedes the `div`/`cmp` at `0x18022bfbe`/`0x18022bfc0`, whereas the fix reorders them. The
defect is in the binary; the delivery path is not.)*

**CVE-2026-4455 — the code is present, the precondition was not reached.** The pre-fix constant selection
survives in `CFX_Face::RenderGlyph` (`Qt6Pdf 0x1801a6440`, the only function in the DLL that compares
against `kMaxGlyphDimension` = 0x800 twice):

```
0x1801a6865  b803000000   mov   eax, 3
0x1801a686d  3bd8         cmp   ebx, eax        ; anti_alias == kLcd (3)?
0x1801a686f  440f44e8     cmove r13d, eax       ; bytes := 3, else 1   <-- the line the fix deleted
0x1801a68c9  410fafcd     imul  ecx, r13d       ; n * bytes            <-- 3x a row of an 8bpp mask
```

Two of its three preconditions hold: the destination is created as `k8bppMask` (1 byte/pixel,
`0x1801a67f6` / `0x1801a6806`), and `anti_alias` is `kLcd` — **measured at 18,513 of 18,521 glyph renders
across 620 documents**. The third, `bitmap.pixel_mode == FT_PIXEL_MODE_MONO`, **was never observed** (0 of
18,521; every sample was `FT_PIXEL_MODE_LCD` or `GRAY`), and `FT_LOAD_NO_BITMAP` in the load flags closes
the obvious route to it. **We could not reach the vulnerable branch and do not claim it is reachable.**

**We deliberately do not count the three use-after-free entries (CVE-2026-11303 / -11305 / -11307).**
PDFium use-after-frees are disproportionately in the form-fill and JS-interaction layer, and that layer is
**absent** from this build; NVD records Google's own Chromium severity for CVE-2026-11305 as **Low**; and
all three were fixed within 60 days of this assessment. **Listed for completeness, excluded from the
finding.**

### §4.5a ✗✗ RETRACTION — the CVE-2026-2648 "out-of-bounds write" does not hold in this build

**Everything in the subsection below is superseded by this one.** We re-measured it with the same PoC,
the same shipped `Qt6Pdf.dll` and the same `QImage::loadFromData(bytes, format = NULL)` call, this time
reading the bound the code actually uses. Harness: `scratch/w16/jpxwatch.c`.

```
read_sod=256   storeA=256   storeB=256
stores failing the UPSTREAM GUARD (current_tpsno < nb_tps) : 512     <- what we counted before
stores past the ACTUAL ALLOCATION (current_nb_tps * 24)    :   0     <- the correct question
cur_nb_tps == TPsot+1 at 494/512 stores, greater at the rest;  max TPsot 255, max cur_nb_tps 256
destroyed values: zero=423 scalar=89 module-ptr=0 heap-ptr=0
```

`opj_j2k_read_sot` is **`0x1802570b0`** (via the marker-handler table at `0x1803fb490`, `id=0xff90`).
With `TNsot = 0` — the recipe our PoC uses — it allocates **`opj_calloc(10, 24)` = 240 bytes**, not 24,
and then grows the array before every write:

```
0x1802575cb  cmp  eax, dword [rdx+8]         ; TPsot < current_nb_tps ?
0x1802575ce  jb   0x18025767a                ; yes -> nothing to do
0x1802575d6  mov  dword [rdx+8], eax         ; current_nb_tps = TPsot+1
0x1802575f8  lea  rdx,[rax+rax*2]; shl rdx,3 ; (TPsot+1)*24
0x180257600  call 0x180260fe0                ; opj_realloc -> the array now covers the index
```

`nb_tps` (offset `+4`) is written **only** on the `TNsot != 0` path, which is why it stays 0 and the
upstream guard rejects all 512 stores — but the array is correctly sized throughout. The other path is
closed as well: `TPsot >= TNsot` is rejected at `0x1802572ed` ("In SOT marker, TPSot (%d) is not valid
regards to the current number of tile-part (header)") and `read_sot` returns FALSE, so the premise that
TPsot and TNsot can be chosen independently is **refuted**.

**What we still report, and at what strength.** The missing `tp_index && current_tpsno < nb_tps` test is
genuinely absent (disassembled), and the shipped PDFium is ten months behind the application that bundles
it. We report that as **stale-dependency hardening (CWE-1395)**. We **withdraw** the out-of-bounds write,
the offsets, the "6,104 bytes past a 24-byte allocation" figure and any severity attached to them.
The one unguarded case we could not construct is `tp_index == NULL` at SOD (`0x18025c6d2` has no NULL
test); it would be a near-NULL write, i.e. a crash.

*(Recommendation 21 — remove `qpdf.dll` from `imageformats\`, or pass an explicit format to
`loadFromData` — still stands, now on the stale-parser argument alone.)*

### ~~★★ CVE-2026-2648 — the out-of-bounds write, executed against the shipped binaries~~ (SUPERSEDED by §4.5a)

**The defect.** The upstream fix (`004b476195`, `Bug: 477033835`) adds a bound and a NULL test that the
shipped build does not have, in `opj_j2k_read_sod()`:

```c
   OPJ_UINT32 l_current_tile_part = ...tile_index[n].current_tpsno;   /* TPsot, off the wire */
+  if (...tile_index[n].tp_index &&
+      l_current_tile_part < ...tile_index[n].nb_tps) {
      ...tp_index[l_current_tile_part].end_header = l_current_pos;
      ...tp_index[l_current_tile_part].end_pos    = l_current_pos + m_sot_length + 2;
+  }
```

**In `Qt6Pdf.dll` neither test exists — CONFIRMED (disassembled).** `opj_j2k_read_sod` is at
`0x18025c540`, identified by its `opj_j2k_add_tlmarker(..., J2K_MS_SOD, ...)` call
(`mov r8d, 0xff93` @ `0x18025c6fa`):

```
0x18025c6a0  488b9f20010000  mov  rbx, [rdi+0x120]   ; cstr_index
0x18025c6a7  4885db          test rbx, rbx           ; <- the ONLY null test present
0x18025c6b8  8b8f28010000    mov  ecx, [rdi+0x128]   ; m_current_tile_number
0x18025c6ca  418b480c        mov  ecx, [r8+0xc]      ; current_tpsno  <- attacker's TPsot
0x18025c6ce  488d1449        lea  rdx, [rcx+rcx*2]   ; index * 3  (-> *24 bytes)
0x18025c6d2  498b4810        mov  rcx, [r8+0x10]     ; tp_index       <- NO null test
0x18025c6d6  4c894cd108      mov  qword [rcx+rdx*8+8],  r9   ; *** OOB WRITE ***
0x18025c6f5  4c8944d110      mov  qword [rcx+rdx*8+0x10], r8 ; *** OOB WRITE ***
```

**Reaching it.** `tp_index` is sized by whichever branch of `opj_j2k_read_sot` runs. With a **valid TLM
marker** the branch is `if (!m_tlm.m_is_invalid) { /* do nothing */ }` — `current_tpsno` is assigned
unconditionally just above it, but the array is never grown. `TNsot = 0` in each SOT keeps the TLM valid
and keeps `m_nb_tile_parts` at zero so the "TPSot not valid" guard is skipped, while the ISO 15444-1 A.4.2
sequencing rule (tile-parts in increasing order) is satisfied by walking TPsot 0, 1, 2, ….

**Result — MEASURED, on the shipped `Qt6Pdf.dll`, through WickrPro's own call.** A 6,397-byte PDF holding
one `/JPXDecode` image, handed to `QImage::loadFromData(bytes, format = NULL)`:

```
tp_index allocation      : 1 entry = 24 bytes            (from a TLM declaring one tile-part)
unguarded stores executed: 256 / 256
write offsets            : +8, +32, +56, +80, ... +6128
values written           : 0x67 … 0x1651   (codestream offsets; attacker-influenced by file layout)
```

**Every offset from +32 upward is outside the allocation** — up to **6,104 bytes past a 24-byte heap
block**, 256 times, from a single received file. Without instrumentation the decoder does **not** crash: it
corrupts the heap and returns success (`loadFromData = true`, process exit 0), which is why this is not
visible in normal operation.

**What is and is not claimed.** CONFIRMED (disassembled): the missing checks. CONFIRMED (executed): the
delivery chain and all 256 out-of-bounds stores. **NOT claimed:** any crash (none occurred), any control
of the instruction pointer, and any execution inside `WickrPro.exe` itself — the harness issues WickrPro's
exact call against the shipped Qt DLLs, and §4.3 establishes that remote bytes reach that call in
`WickrPro.exe`, but we did not send this file over a live Wickr message.

**One honest limit on severity.** The two written values are `l_current_pos` and
`l_current_pos + m_sot_length + 2` — 64-bit stores of **zero-extended 32-bit quantities**. An attacker can
choose them but cannot place a pointer, so the direct routes (vtable, function pointer) are closed; what
remains is overwriting a length or capacity field, and we did not survey what lies at those offsets.
**This is a serious heap corruption; we do not claim it reaches code execution.**

**Reproduction.** `scratch/w13/` contains the generator (`jpx3/` builder), the PoC
`jpx3/tlm1_parts256.pdf`, the decode harness `imgbatch.c` (six Qt entry points resolved by exported
mangled name, so it cannot drift from the shipped build) and the instrumented probe `jpxprobe.c`.

**What is CONFIRMED and what is not.** CONFIRMED: the delivery chain, the build date, the Chromium
baseline, the process context, and the absence of V8/XFA. **INFERRED (strongly, not demonstrated):** that
these specific defects are present in and reachable through this build. **We did not attempt to exploit any
of them and we do not claim a working exploit.** Turning this into a demonstration is a bounded next step —
obtain or construct a reproducer for one of the heap overflows and run it against the shipped
`Qt6Pdf.dll`.

**Remediation.** Rebuild against a current Qt/QtPdf, and — independently, because it removes the exposure
without waiting on an upstream bump — **remove `qpdf.dll` from `imageformats\`**, or pass an explicit format
to `QImage::loadFromData` instead of `NULL`. A messenger's inline preview does not need to render PDF
through a browser engine's PDF stack.

### The decode surface an attacker actually picks from — CONFIRMED (measured), and every version is pinned

§4.3 establishes that remote bytes reach a `format = NULL` decode. This subsection answers the question that
makes that matter: **which decoders can the sender select, and what version is each?** Every number below is
read out of the shipped bytes.

**The selectable set.** Ten image-format plugins ship in `imageformats\`, and their plugin metadata declares
what each claims — so a sender choosing the file's magic bytes chooses the parser:

| plugin | formats offered | third-party parser, **pinned from the shipped bytes** |
|---|---|---|
| *(built into `Qt6Gui.dll`)* | PNG, BMP, XPM, PPM/PGM/PBM | **libpng 1.6.50** |
| `qjpeg.dll` | `image/jpeg` | **libjpeg-turbo, `Copyright (C) 1991-2024`** |
| `qtiff.dll` | `image/tiff` | **libtiff 4.5.1** — with LZW, JBIG and LERC codecs present |
| `qwebp.dll` | `image/webp` | libwebp (CVE-2023-4863 verified fixed by disassembly) |
| `qsvg.dll` | `image/svg+xml`, **`image/svg+xml-compressed`** | Qt SVG renderer; the compressed variant is gzip-wrapped XML |
| **`qpdf.dll` → `Qt6Pdf.dll`** | `application/pdf` | **PDFium, with libpng 1.6.43, zlib 1.3.0.1-motley, ICU 74, OpenJPEG** |
| `qgif` / `qico` / `qicns` / `qtga` / `qwbmp` | GIF, ICO, ICNS, TGA, WBMP | Qt's own handlers |

**A bounding negative first, because it materially narrows this finding — CONFIRMED (measured).**
`Qt6Pdf.dll` is built **without PDFium's JavaScript engine, without XFA and without the form-fill layer.**
Symbol/string probes over the whole module return **zero** matches for `v8::` / `V8_` / `Ignition` /
`TurboFan`, **zero** for `FXJS` / `CJS_` / `IJS_Runtime` / `app.alert`, and no `CXFA_` / `fxfa` /
`CPDFSDK_` / `FormFillEnvironment` class names — only the bare words `"XFA"` and `"AcroForm"`, consistent
with a name in a table rather than an implementation. The contrast is the control: the *same* probes over
`Qt6WebEngineCore.dll` return `Ignition`, `TurboFan`, `v8::`, `FXJS`, `xfa.`, `CPDFSDK_` and
`FormFillEnvironment`. **The historically dominant PDFium bug classes — use-after-free driven by document
JavaScript, and XFA — are therefore not reachable through the image-preview path.**

What *is* reachable in `Qt6Pdf.dll` is the core parser and the filter chain, and the probes confirm these
are compiled in: **`JBig2`, `OpenJpeg` / `opj_`, `FaxDecode`, `RunLengthDecode`**, plus `AESV2`/`AESV3`
document decryption and `sfnt`/`truetype` font parsing. **JBIG2 and JPX (OpenJPEG) are the two filters with
the worst memory-safety history in the format**, and they are reachable from a sent file with no scripting
involved.

**Two further things in that table are defects in their own right.**

**(1) The same process holds two libpng copies at different versions, and the sender chooses which one
runs.** `Qt6Gui.dll` carries **libpng 1.6.50**; `Qt6Pdf.dll` carries **libpng 1.6.43** (February 2024). A PNG
sent as a PNG is decoded by the current one; **the same PNG embedded in a PDF is decoded by the older one.**
Whatever is fixed between those two releases is reachable by changing the container.

**(2) `libtiff 4.5.1` (September 2023) is peer-reachable in the unsandboxed main process.** TIFF is in the
sniff set, `qtiff.dll` ships, and libtiff's parser has a continuous stream of published memory-safety fixes.
We name **no CVE** — attribution against 4.5.1 was not performed — but a two-year-old libtiff reachable by
anyone who can message the user, in a CFG-free unsandboxed process, is a component-currency defect on its
face.

**What limits it.** `WickrPro.exe` imports **no `QImageReader` symbol at all** and never calls
`QImageReader::setAllocationLimit`, so Qt 6's **default 128 MiB** decode allocation limit is in force. It is
neither lowered (which would be the hardening) nor raised (which would be worse). Stated as a fair negative:
a single image cannot drive an unbounded allocation.

**Remediation for this subsection.** Refresh `qtiff`/libtiff and align the two libpng copies; and either
drop the plugins the product does not need (ICNS, TGA, WBMP, TIFF and PDF-as-an-image are unlikely to be
required for a messenger's inline previews) or pass an explicit format to `QImage::loadFromData` instead of
`NULL`. Removing a plugin removes its parser from the attacker's menu entirely, which is the cheapest fix
available here.

### The `139.0.7258.67` claim, stated exactly

`Qt6WebEngineCore.dll` self-reports a Chromium **security patch version of 139.0.7258.67** on a
**130.0.6723.192** base. Two things are worth the vendor's attention, and neither is a vulnerability claim.

**(1) The constant is load-bearing on nothing.** A sweep of `.text` for rip-relative references finds
`"139.0.7258.67"` (`0x188b55330`) referenced **exactly once**, by its own getter export at `0x180303170`. By
contrast the base version string `"130.0.6723.192"` (`0x188b55320`) has **ten** references — it is used to
build user-agent strings and the like. The security-patch constant is consumed only by the internal version
page. **CONFIRMED (measured).** It is a label, not a mechanism, and it cannot be used as evidence that
anything was backported.

**(2) One in-the-wild-exploited fix was tested and the remediation is present — but the test does not
substantiate the backport claim.** CVE-2025-2783 is the Mojo-on-Windows sandbox escape. The `__FILE__`
anchor for `mojo/core/platform_handle_in_transit.cc` (at `0x188ba8f30`) resolves to exactly one 383-byte
function, `0x1804f9460`–`0x1804f95df`. The pseudo-handle rejection is in the shipped bytes:

```
0x1804f949c  8d410c           lea  eax,[rcx+0xc]      ; rcx = the handle
0x1804f949f  83f80b           cmp  eax,0xb
0x1804f94a2  7701             ja   0x1804f94a5        ; handle NOT in [-12,-1] -> continue
0x1804f94a4  cc               int3                    ; CHECK failure
0x1804f94a5  c744243003000000 mov  dword [rsp+0x30],3
...  five further argument-setup instructions ...
0x1804f94c8  ff156a784408     call [0x188940d38]      ; KERNEL32!DuplicateHandle, rdx = the same rcx
```

The `LOG(FATAL)` source line is 71 (`0x1804f954f 41b847000000 mov r8d,0x47`), and the failure string is
`"DuplicateHandle failed from "` (`0x188ba8f08`). **CONFIRMED (disassembled).**

**The qualifier travels with the result.** A comparison build of Chromium 106.0.5249.181 has the same
function with **no** conditional branch before `DuplicateHandle` and a `LOG(FATAL)` line of 65. That brackets
the introduction of the check to somewhere in **(106, 130]**, which includes the shipped base itself. **So
the guard may simply be part of Chromium 130 and its presence does not show that any post-130 backport
landed. Provenance: UNDETERMINED.** *(The 106-build measurement is **INFERRED** here — it was taken in an
earlier phase against a Chromium build on the operator's machine and was not re-run for this section; the
shipped-build half was re-measured. A further **INFERRED, load-bearing, unverified** step: that the
CVE-2025-2783 remediation is this pseudo-handle CHECK at all. If the real fix is in `node_channel.cc`,
`broker_win.cc` or `base/win`, every measurement on `0x1804f9460` is a true observation about the wrong
function and the CVE reverts to unassessed.)*

Two further candidate fixes were examined and **rejected before measurement for lack of discriminating
power** rather than found present or absent (FreeType CVE-2025-27363, whose code fix predates the M130 base;
CVE-2025-4664, whose remediation is the removal of a policy application and leaves no structural signature).
One apparent absence — a broker-side validation string missing from the shipped build — was traced to an
addition made seven milestones *after* the claimed 139 window and is **REFUTED as evidence**.

**What we are asking the vendor, not asserting:** which Chromium security backports are in this Qt 6.9.2
build, and how is that verifiable from the shipped artefact? The single artefact that would settle it from
our side is a stock Qt 6.9.2 QtWebEngine reference build (or any Chromium in `[130.0, 134.0)`) byte-diffed
against the shipped one. Fetching one is outside our rules of engagement.

**The question splits in two, and one half is no longer UNDETERMINED — CONFIRMED (measured).** Chromium's
own source is one thing; the **bundled third-party libraries** it carries are another, and those can be
version-pinned directly out of the shipped bytes. Four independent fingerprints, all agreeing:

| bundled component | measured in the shipped build | consistent with |
|---|---|---|
| ICU data | **`icudt74`** — in `Qt6WebEngineCore.dll` *and* `Qt6Pdf.dll` | the 130 base |
| libpng (PDFium's copy) | **1.6.43** (February 2024) | the 130 base |
| zlib (PDFium's copy) | **1.3.0.1-motley** | the 130 base |
| libjpeg-turbo | `Copyright (C) 1991-`**`2022`**, and a **127-entry 2.x** message table | the 130 base |

Both modules also carry the explicit `Chrome/130.0.6723.192` string, and `Qt6Pdf.dll` shares
`Qt6WebEngineCore.dll`'s ICU data file — so **PDFium is built from the same snapshot, not separately
maintained**.

⇒ **The bundled third-party codec stack was not refreshed above the 130 baseline.** That does not show that
no Chromium *source* patches were cherry-picked — that half remains **UNDETERMINED**, exactly as stated
above — but it is decisive for the surface §4.3 is about, because a malicious PDF or image is parsed by
**these libraries**, not by Chromium's own code. For F4c's purposes the answer is: **the parsers reachable
from a sent file are 130-vintage.**

The sharpest illustration is inside one process: `Qt6Gui.dll` carries **libpng 1.6.50** while `Qt6Pdf.dll`
carries **libpng 1.6.43**, and the sender picks which one runs by choosing whether to send a PNG or a PDF
containing one.

### One post-2.x libjpeg validation is measurably absent — CONFIRMED, no CVE claimed

`imageformats\qjpeg.dll` (3.0.3) carries message-table entry 128, *"Invalid restart interval …; must be an
integer multiple of the number of MCUs in an MCU row"*. That message has **no counterpart anywhere in the
127-entry 2.x table** used by both `Qt6Pdf.dll` and `Qt6WebEngineCore.dll`, so the corresponding check cannot
be present in the copy that PDFium uses. **No CVE number is claimed** — our rules of engagement forbid
fetching the diffs that would justify one. Report it as a version-currency observation about the copy behind
the `%PDF-` sniff.

### Build-path leakage — CONFIRMED (measured), minor on its own

Wickr builds Qt from source and ships the release binaries with build paths intact:

* `D:\WickrDesktopQt\qt6\…` — **184 occurrences across 9 shipped DLLs** (`Qt6Quick.dll`, `Qt6Quick3D.dll`,
  `Qt6Quick3DRuntimeRender.dll`, `Qt6Quick3DUtils.dll`, `Qt6QuickTest.dll`, `Qt6Test.dll`,
  `Qt6WebEngineCore.dll`, `Qt6Widgets.dll`, `imageformats\qtiff.dll`).
* `C:\cdat2\…\libnpl\Win64DesktopSDK\…` — 410 occurrences in `NPL.dll`, `crypto.dll`, `ssl.dll`.
* `D:\a\winsparkle\…` — 248 occurrences in `WinSparkle.dll` (upstream CI paths); of these, 246 carry the
  longer `…\winsparkle\3rdparty` prefix.

This is a small information leak in its own right (build-machine layout, internal project names). It also has
a substantive consequence: **the third-party pinning of the whole Qt/Chromium stack is Wickr's own**, not an
upstream vendor's, so questions like "which backports are in this build" are Wickr's to answer.

## 4.6 Bounding negatives for this section

* **The client's own TLS-pinning logic fails closed — CONFIRMED (disassembled) for the control flow;
  INFERRED for the identification.** With `certPinningEnabled=false`, the validator at `0x1409c7020` returns
  false when no pin is set (`0x1409c7024 cmp qword [rcx+0x358],0` / `0x1409c702c je → 0x1409c7046 xor al,al`),
  so the "ignore SSL errors" path is never reached and ordinary system-trust validation applies. All four
  `ignoreSslErrors` call sites are guarded. **That this 45-byte function is the certificate-pin validator is
  inherited from an earlier phase; nothing in those 45 bytes identifies it as such.**
* **`--disable-web-security` does not reach the renderer — CONFIRMED (disassembled), with a fragility note.**
  `WickrPro.exe` does append `--disable-web-security` (literal `0x143237f68`) to an argument vector, but only
  when the environment enum at `0x143498f70` is not 3 (`0x1408d533b cmp dword [0x143498f70],3` /
  `0x1408d5342 jne 0x1408d53a7`). That vector never reaches Chromium:
  `Qt6WebEngineCore!initializeCommandLine` (`0x180300a42`–`0x180300e94`, 1,106 bytes) only honours arguments
  that follow the `--webEngineArgs` marker (`0x188b55100`, UTF-16, 15 characters). With the marker absent —
  and **`--webEngineArgs` occurs zero times in `WickrPro.exe` in both encodings** — `0x180300d04 cmp r15d,esi`
  / `0x180300d07 jle 0x180300d7c` truncates the list to the program name via `mid(0,1)`
  (`0x180300d7c mov r9d,1` / `call 0x1803028b0`). Independently, `WickrPro.exe` calls
  `qunsetenv("QTWEBENGINE_CHROMIUM_FLAGS")` at `0x1408d3ddf`, closing the environment route that
  `0x180300b5a` would otherwise honour.
  *Fragility worth fixing anyway:* the `.data` initialiser of `0x143498f70` is **4**, not 3 — the default is
  the *non*-production value, i.e. the branch that adds the flag. It is safe only because `main` stores 3
  before the argument vector is built (`0x140012d70 mov edx,3`, reaching the global through
  `0x1408d57ce` → `0x1408d3bc2` → `0x1408d3c64`). **Remediation: initialise that global to the production
  value and make `--disable-web-security` conditional on a debug-only compile flag rather than on a runtime
  enum.** The enum's values are fixed by the `--environment` parser at `0x1409d6500`: `"production"` stores 3
  at `0x1409d834c`, `"gamma"` 2, `"beta"` 1, `"alpha"` 0. **UNDETERMINED:** the ordering between `main`'s
  store and that parser. If the parser runs later, `--environment alpha` would store 0 and defeat the
  `cmp …,3` — which matters for §5.2's crash-reporting gate as well.
* **The crash-upload destination is not attacker-redirectable — CONFIRMED (disassembled), narrowed to what
  was measured.** The scheme and host suffix are compiled in: the minidump URL is built from a single format
  literal at `0x14328ba08` referenced exactly once in `.text` (`lea rdx` at `0x140aebfd3`, inside
  `0x140aebfb0`–`0x140aec03a`), and the DSN from a second at `0x14328ba48`. A remote party therefore cannot
  point crash uploads at an arbitrary host. **Where the three substituted fields come from is traced in
  §5.2; that they cannot be influenced remotely is CONFIRMED there by a superset scan of the three globals.**
* **The message database is encrypted at rest — CONFIRMED (measured).** See §5.1's evidence block.
* **The MLS SDK is Rust — CONFIRMED (strings), and that is all we claim.** `WickrMlsSdkCpp.dll` is built
  from `mls-rs 0.54.0` and companions with Rust panic machinery present. We did not measure the
  memory-safety properties of any particular path through it, and we do not assert them.
---

# SECTION 5 — Four defects where plaintext leaves an end-to-end-encrypted client

None is a memory-safety issue and none depends on the others. They are reported together only because
they share a theme: material the product's own proposition says should not exist outside the encrypted
envelope is written to disk, or sent to a third party, without the user being asked. They are independently
reportable and independently fixable.

They are ordered by severity: **§5.1** writes raw microphone audio; **§5.2** uploads process memory;
**§5.3** retains message and conversation identifiers in cleartext logs that outlive the messages;
**§5.4** stores an account-scoped identifier in a plaintext queue file sitting between two encrypted
databases. §5.5 records what we checked and found *clean*, which on this theme is most of what we checked.

Testing was on operator-owned machines and operator-owned accounts. No account identifier, message content,
key material or recording content appears in this document.

## 5.1 (F5a) Raw microphone audio is written to disk unencrypted, by default, in a shipped release build

**Class:** CWE-312 (cleartext storage of sensitive information), with CWE-532 (sensitive information in a
debug artefact)
**Component:** `NPL.dll`, Musigy `WASAPIAudioManager`
**Attacker:** any process running as the signed-in user. No elevation, no microphone permission, no presence
during the call.
**Status:** CONFIRMED by disassembly and by measurement on the operator's own machine.

### Summary

The Windows client opens two files at audio-device start-up and writes the microphone signal to them for the
life of the process: one copy **before** acoustic echo cancellation and one **after**. The files are
headerless raw PCM, unencrypted, in a directory the user's own processes can read, with no rotation and no
size cap. Nothing in the product tells the user they exist.

This is a WebRTC-style audio-processing debug dump left enabled in a signed release build. It is not a crash
artefact and it is not opt-in: both `fopen` calls sit on the straight-line path of the `WASAPIAudioManager`
constructor.

### The filename templates — CONFIRMED (bytes read out of the mapped image)

| Address | Content |
|---|---|
| `0x180446be0` | `ch.pcm` |
| `0x180446be8` | `_` |
| `0x180446bf0` | `aud_in_before_aec_` |
| `0x180446c04` | `wb` |
| `0x180446c08` | `aud_in_after_aec_` |

### The constructor builds the name and opens the file — CONFIRMED (disassembled)

`WASAPIAudioManager`'s constructor is at **`0x18015bb70`**, `.pdata` extent RVA `0x15bb70`–`0x15c0c3`
(**1,363 bytes**). The name is assembled with an `ostringstream` chain and handed straight to `fopen`:

```
0x18015bdd5  call 0x1800754b0            ; -> jmp [0x180424310] = KERNEL32!GetCurrentProcessId
0x18015bddc  lea  rdx, [rip+0x2eae0d]    ; -> 0x180446bf0  "aud_in_before_aec_"
0x18015bde8  call 0x180082e90            ; operator<<(ostream&, const char*)
0x18015bdf2  call [rip+0x2c8670]         ; -> MSVCP140!basic_ostream<char>::operator<<(int)   [pid]
0x18015bdfb  lea  rdx, [rip+0x2eade6]    ; -> 0x180446be8  "_"
0x18015be0c  call [rip+0x2c8656]         ;   operator<<(int)   [edi = obj+0x40, the sample rate]
0x18015be15  lea  rdx, [rip+0x2eadcc]    ; -> 0x180446be8  "_"
0x18015be26  call [rip+0x2c863c]         ;   operator<<(int)   [esi = obj+0x3c, the channel count]
0x18015be2f  lea  rdx, [rip+0x2eadaa]    ; -> 0x180446be0  "ch.pcm"
0x18015be53  lea  rdx, [rip+0x2eadaa]    ; -> 0x180446c04  "wb"
0x18015be5d  call [rip+0x2c8f7d]         ; -> 0x180424de0 = api-ms-win-crt-stdio-l1-1-0.dll!fopen
0x18015be63  mov  [r14+0x460], rax       ; FILE* for the BEFORE-AEC stream
```

The `after`-AEC copy is the same shape **`0x1a7` bytes later** at each anchor: `0x18015bf83` references
`aud_in_after_aec_`, `0x18015bffa` references the same `"wb"`, `0x18015c004` calls the **same import slot**
`0x180424de0`, and the handle is stored at `[r14+0x468]` by `0x18015c00a`.

**There is no directory component anywhere in the chain (CONFIRMED).** The name is opened as a bare relative
path, so it lands in the process's working directory — which, for every session observed on this host, was
the application's own install directory.

### Both sites are ungated — CONFIRMED (full-function disassembly)

The constructor contains **exactly ten conditional branches and zero unconditional jumps**:

```
0x18015bd3e je  ->0x18015bd4d   0x18015be4e jbe ->0x18015be53   0x18015be72 jbe ->0x18015bea9
0x18015be85 jb  ->0x18015bea3   0x18015be9a jbe ->0x18015bea3   0x18015bef3 je  ->0x18015bf02
0x18015bff5 jbe ->0x18015bffa   0x18015c019 jbe ->0x18015c050   0x18015c02c jb  ->0x18015c04a
0x18015c041 jbe ->0x18015c04a
```

No target of any of the ten skips `0x18015be5d` or `0x18015c004`. `0x18015be4e` and `0x18015bff5` are the
`std::string` small-buffer checks immediately before the respective `fopen` — they select which pointer to
pass, not whether to call.

The constructor's single caller is the audio-backend factory at `0x18012a750` (extent RVA
`0x12a750`–`0x12a867`, 279 bytes). The selector is a comparison against the six-character literal
**`"WASAPI"`** at `0x180440a70`, and the only branch that can bypass the constructor is the `operator new`
NULL check:

```
0x18012a7ff  test sil, sil
0x18012a802  jne  0x18012a825        ; matched "WASAPI" -> the WASAPI backend
0x18012a804  mov  ecx, 0x490         ; else a different manager class (0x180151b80)
0x18012a825  mov  ecx, 0x520
0x18012a82a  call operator new
0x18012a834  test rax, rax
0x18012a837  je   0x18012a844        ; <== the only branch that skips the constructor
0x18012a83c  call 0x18015bb70
```

### The handles are used — this is a live write path, not a dead artefact — CONFIRMED (disassembled)

The audio callback at `0x1801610b0` (`.pdata` extent RVA `0x1610b0`–`0x161452`, 930 bytes) loads exactly
those two fields and writes through them:

```
0x18016115b  mov  rsi, [r13+0x460]     ; BEFORE-AEC FILE*
0x180161162  test rsi, rsi
0x180161165  je   0x180161194          ; the only guard: did fopen succeed?
0x18016116e  mov  eax, [rcx+0x18]      ; frame count
0x180161171  imul eax, [r13+0x3c]      ; x channels
0x180161176  add  eax, eax             ; x 2  -> two bytes per sample
0x18016118e  call [rip+0x2c3bd4]       ; -> 0x180424d68 = fwrite
...
0x18016122f  call qword ptr [r14+0x80] ; the audio-processing dispatch (result checked at 0x180161238)
...
0x1801612e5  mov  rdi, [r13+0x468]     ; AFTER-AEC FILE*
0x18016130f  call [rip+0x2c3a53]       ; -> fwrite
```

*(An earlier note of ours annotated `0x1801612e0 call 0x180112e1e` as "the processing step". That is wrong:
`0x180112e1e` is an import thunk, `ff25841b3100 jmp qword ptr [rip+0x311b84]` → IAT `0x1804249a8` =
`VCRUNTIME140!memcpy`, and it sits inside an arm skipped entirely when `byte [r13+0x38] != 0`
(`0x1801612b6 jne 0x1801612e5`). The real processing dispatch is the virtual call at `0x18016122f`.)*

The `× 2` at `0x180161176` establishes two bytes per sample. `NPL.dll` contains exactly three `fopen` call
sites in total (`0x18015be5d`, `0x18015c004`, `0x1801674be`) — two of them are these (CONFIRMED, exhaustive
scan of `.text` for indirect calls resolving to the import slot).

### Evidence — measured on the operator's own machine

**Volume.** Directory `%LOCALAPPDATA%\Programs\Amazon Web Services, Wickr\AWS Wickr\`:

| | |
|---|---|
| files | **28** (14 distinct PIDs × 2 streams) |
| total | **477,219,328 bytes** (455 MiB) |
| before-AEC subtotal | 238,644,480 B = **41.4 minutes** at 48 kHz / 16-bit / mono |
| after-AEC subtotal | 238,574,848 B = **41.4 minutes** |
| largest single file | **203,624,448 B = 35.4 minutes** of one call, per stream |

Every observed session produced a file pair. There is no rotation, no cap and no cleanup on exit.

**Produced at runtime, not shipped.** Every `.pcm` file's mtime falls on 2026-07-30 or 2026-07-31, the days
calls were made. `NPL.dll` and `WickrPro.exe` in the same directory both carry mtime **2026-07-13T21:55** —
the vendor's build timestamp, preserved by the installer; their creation time on this host is
2026-07-29T23:25.

**The content is audio, in the clear.** Whole-file signed-16-bit statistics, which any engineer can
reproduce in one pass, plus Shannon entropy over the first 64 KiB:

| file | min sample | max sample | entropy (first 64 KiB) |
|---|---|---|---|
| `aud_in_before_aec_7564_…` | −13,742 | +13,768 | 5.85 bits/byte |
| `aud_in_after_aec_7564_…` | −31,978 | **+32,682** | 6.28 bits/byte |
| `aud_in_before_aec_6916_…` | 0 | 0 | 0.00 bits/byte |
| `aud_in_after_aec_6916_…` | −5 | +5 | — |

The minima are negative and roughly symmetric with the maxima, which is what establishes the samples are
**signed** 16-bit; the `add eax,eax` at `0x180161176` establishes only two bytes per sample. Ordinary speech
levels, with the after-AEC stream peaking near full scale, and entropy far below the ~8.0 bits/byte of
ciphertext. The third and fourth rows are a session that was effectively silent — 360,448 samples were still
written per stream, which is the point: **the recording is unconditional, not signal-triggered.**

*(Correction to our own earlier draft: an internal version reported a peak sample of `32768` for several
files, which is out of range for a signed 16-bit sample, and later a sampled-window peak of `12,814` /
`14,724`, which does not reproduce because it depends on the sampling grid. The whole-file min/max above are
deterministic and are the figures to rely on. The conclusion is unchanged.)*

**The contrast that makes the severity plain.** On the same machine, in the same product,
`%LOCALAPPDATA%\Wickr, LLC\Wickr Pro\wickr_db.sqlite` does **not** begin with the `SQLite format 3` magic —
its first bytes are the SQLCipher random salt — and measures **7.999 bits/byte** whole-file. Its
write-ahead log parses exactly: 754 frames at the declared 1024-byte page size,
`32 + 754 × (24 + 1024) = 790,224` bytes, matching the file length to the byte; the page payloads measure
**7.809 bits/byte mean** (min 7.747, max 7.857; 8.000 over the concatenation of all 772,096 bytes); and
**zero of the 754 frames contain the byte string `CREATE TABLE` or `SQLite`.** The message store is
protected. The call audio next to it is not.

*(The recordings are the reporter's own voice from the reporter's own test calls. They were measured
statistically and were not transcribed. No third party's audio was captured. No plaintext, key material or
message content was extracted from the database; these are entropy statistics and structural counts only.)*

### Impact

No exploitation is required. The attack is `copy *.pcm`.

1. **Retroactive access with no microphone permission.** A same-user process can of course record the
   microphone live — but only while the call is happening, and on Windows that raises the in-use indicator.
   These files give silent access to calls that have already ended, to any process that can read the user's
   own files. An infostealer that globs `*.pcm` obtains conversations it was never resident for.
2. **It defeats the property the product is sold on.** A device that is imaged, seized, backed up or handed
   on yields verbatim call audio the user has every reason to believe does not exist.
3. **It leaves the endpoint without anyone deciding to send it.** `%LOCALAPPDATA%\Programs\…` is routinely
   collected by backup agents, EDR/DLP tooling, forensic imaging, roaming profiles and VDI persistence
   layers.
4. **Unbounded disk consumption** — 194 MiB per stream per 35-minute session, even when the microphone is
   silent.

### Re-audit: there is no gate to find, and the files are never removed

We went back over this with two independent methods, because "an earlier pass missed a debug flag" is the
obvious way this finding could be wrong.

**1. The constructor's complete import set contains no configuration API of any kind — CONFIRMED
(disassembled, imports resolved).** Every indirect call in the 1,363-byte constructor `NPL 0x18015bb70`
resolves to exactly these:

```
KERNEL32.dll!InitializeCriticalSectionAndSpinCount
api-ms-win-crt-stdio-l1-1-0.dll!fopen          api-ms-win-crt-stdio-l1-1-0.dll!fclose
api-ms-win-crt-runtime-l1-1-0.dll!_invalid_parameter_noinfo_noreturn
MSVCP140.dll!basic_ios<char>::{ctor,dtor}      MSVCP140.dll!basic_ostream<char>::{ctor,dtor}
MSVCP140.dll!basic_streambuf<char>::ctor       MSVCP140.dll!basic_ostream<char>::operator<<(int)
```

**No environment-variable read, no registry access, no `GetPrivateProfile*`, no command-line access.** This
is a different argument from the branch-count argument above and it reaches the same place: there is no
debug flag, no registry value and no environment variable that turns this off, because the constructor
never asks. There is also no `remove` or `DeleteFile` — consistent with (2).

**2. The files are never rotated, truncated or deleted — MEASURED.** Re-measured on the operator's machine
two days after the figures above, with the application having been run and having placed calls in between:
**28 files, 477,219,328 bytes** — byte-identical totals. Nothing prunes them. Every user who has ever placed
a call on an affected build is carrying every second of it.

**3. They cannot be swept into a crash report by name — CONFIRMED (measured), a bounding negative.** The
string `aud_in` occurs **zero times** in `WickrPro.exe` in both ASCII and UTF-16; the only two `.pcm`
references there are `:/etc/test-48k-16-mono.pcm`, a Qt-resource test tone. The `--attachment=` literal
(`0x140e3fe80`) is referenced twice, both inside `initBugTrackers` (`0x14004c770`, at `0x14004d22e` and
`0x14004d29d`), with a runtime-computed path and no `.pcm` or `aud_in` literal anywhere in that 4,339-byte
function. **UNDETERMINED:** whether that runtime path could name a *directory* containing them — we did not
resolve it, and it is cheap for you to check.

### What is not established

* **What sets the backend selector.** The `"WASAPI"` comparison at `0x18012a7ff` is a backend choice, not a
  recording flag, and the WASAPI path was taken in all 14 observed sessions — but we did not trace the
  producer of that value and cannot prove no configuration selects the other manager class (`0x180151b80`).
  **UNDETERMINED.**
* **Whether `before_aec` captures the far end.** By definition it is the microphone signal prior to echo
  cancellation, so on loudspeakers the remote party's voice is acoustically present in it — that is why AEC
  exists. **We did not verify this and make no claim about it.** It is cheap for you to check and it would
  change the impact materially. **UNDETERMINED.**

### Suggested remediation

1. **Compile the dump out of release builds.** In `Musigy::WASAPIAudioManager`'s constructor
   (`NPL 0x18015bb70`) remove the two `fopen` sites at `0x18015be5d` and `0x18015c004` and the two `fwrite`
   sites at `0x18016118e` and `0x18016130f` from the shipping configuration. Nothing in the product needs
   them.
2. **If it must survive for field diagnostics:** gate it on an explicit per-session user action with a
   visible indicator, write to a temporary directory rather than the install directory, cap the size, and
   delete on session end.
3. **Delete existing files on upgrade.** Every user who has run an affected build is carrying recordings
   now. A fix that only stops new writes leaves the exposure in place.
4. **Audit the neighbours.** Check whether other WebRTC-style debug facilities (`aecdump`, event logs) are
   similarly enabled in release.

---

## 5.2 (F5b) Crash reporting is enabled by default with no consent mechanism, and a remote peer can force a crash on demand

**Class:** CWE-359 (exposure of private information), CWE-200
**Component:** `WickrPro.exe` `initBugTrackers`, bundled Crashpad + sentry-native
**Attacker:** for the *forced* case, any authenticated participant in a call with the victim, via Finding 2
— *and qualifier (b) applies to that: the frames in our demonstration came from our own second client,
patched in memory at the send path; that models a malicious peer and is not a defect in the victim.* For the
*consent* case, no attacker at all — it is the default configuration.
**Status:** CONFIRMED by disassembly and by measurement. Dump scope is **narrower** than an earlier draft of
ours stated; the correction is in §5.2.2 and it matters.

### Summary

Crash reporting is on by default. There is no consent gate to fail open or closed — **there is no consent
gate**. Uploads are enabled by a hardcoded immediate, both handler processes are started with
`--no-rate-limit`, and the consent API that the bundled sentry-native library exports is not imported by the
client at all.

Finding 2 establishes that a call peer can kill the victim's process at will — *subject to qualifier (b)*.
This report establishes what leaves the victim's machine when that happens.

### 5.2.1 It is on, and nothing asks — CONFIRMED (disassembled)

**The initialiser.** `initBugTrackers` is `WickrPro.exe` **`0x14004c770`**, `.pdata` extent RVA
`0x4c770`–`0x4d863` (4,339 bytes). It names itself: the log literal
`initBugTrackers SENTRY got m_crashpad_client` at `0x140e3fed0` is materialised at `0x14004d5cf`.

**How it is reached.** The only absolute pointer to `0x14004c770` anywhere in the image is at `0x140e39860`,
which is **slot `+0x158`** of the vtable based at `0x140e39708` (the RTTI locator sits at `0x140e39700`).
`mov rax,[rax+0x158]` occurs exactly **once** in `.text`, at `0x140b3e50e`, inside the `slotFinishInit`
handler at `0x140b3e190`:

```
0x140b3e50e  mov  rax, [rax+0x158]
0x140b3e515  call [rip+0x21a80d]      ; indirect call through the CFG dispatch pointer at 0x140d58d28
```

**The gate, and which way it points.** In `0x140b3e190` (extent RVA `0xb3e190`–`0xb3e5e2`):

```
0x140b3e4cf  call 0x1409e5680         ; predicate A
0x140b3e4d6  jne  0x140b3e4fe         ; A true -> go check the environment
0x140b3e4f5  call 0x1409e4cb0         ; predicate B
0x140b3e4fc  je   0x140b3e507         ; B false -> RUN initBugTrackers
0x140b3e4fe  cmp  dword [rip+0x295aa6b], 3     ; 0x143498f70 = environment enum
0x140b3e505  je   0x140b3e51f         ; == production -> SKIP
0x140b3e507  <vtable slot 0x158 dispatch>
```

Reporting is skipped only when a predicate is true **and** the environment is production. **That `3` is
production is CONFIRMED (disassembled)**, from the `--environment` parser at `0x1409d6500`: `"production"`
stores 3 at `0x1409d834c`, `"gamma"` 2, `"beta"` 1, `"alpha"` 0. The two predicates are configuration
getters; their identification as `enableProxy` and `forceWOA` is **INFERRED**, carried from an earlier phase
which itself corrected a mis-attribution. Neither function has a `.pdata` entry, so our disassembly of them
ran on a fallback extent. What is **measured** on this host is that both keys exist under
`HKCU\Software\Wickr Pro` and both read `false`. The function's own log literals confirm the two outcomes:
`Crash reporting started` (`0x14329cf08`) and `Crash reporting disabled` (`0x14329cf20`).

**Uploads are enabled by a hardcoded immediate.**

```
0x14004d3b7  b2 01     mov  dl, 1
0x14004d3bc  e8 …      call 0x1407bb2a0
```

`0x1407bb2a0` is `crashpad::Settings::SetUploadsEnabled`, **CONFIRMED by structure rather than by symbol**:
it materialises the settings-file magic `0x43506473` at `0x1407bb2be` — byte-identical to the first four
bytes of `crashpaddb\settings.dat` on disk — writes `0x28` bytes at `0x1407bb339` (matching the 40-byte
file), and on the boolean argument either `or dword [rsp+0x30], 1` (`0x1407bb305`) or
`and dword [rsp+0x30], 0xfffffffe` (`0x1407bb30c`), i.e. sets or clears bit 0 of the options word at file
offset 8.

**Corroborated on disk.** `%LOCALAPPDATA%\Wickr, LLC\Wickr Pro\crashpaddb\settings.dat` is 40 bytes: magic
`0x43506473`, version `1`, **options `0x00000001` = `kUploadsEnabled`**, and a non-zero
`last_upload_attempt_time`.

**The consent API is exported and not imported.** `sentry.dll` exports 221 symbols including all six consent
entry points:

```
sentry_options_set_require_user_consent  0x180008710      sentry_user_consent_give   0x180003e20
sentry_options_get_require_user_consent  0x180007c50      sentry_user_consent_revoke 0x180003f00
sentry_user_consent_get                  0x180003d90      sentry_user_consent_reset  0x180003ef0
```

`WickrPro.exe` imports **exactly 17** symbols from `sentry.dll` and **none of those six**. The absence is a
deliberate omission, not an unavailable API. The field they control is `options+0x7a` (setter
`0x180008710 mov byte [rcx+0x7a], al`; getter `0x180007c50 movzx eax, byte [rcx+0x7a]`), and
`sentry_options_new` at `0x180007cd0` allocates `0xe8` bytes, `memset`s all `0xe8` of them, and contains
**zero** references to offset `0x7a` — so `require_user_consent` keeps its zeroed default of *false*. None of
the six functions has a single internal caller inside `sentry.dll` either (zero direct calls, zero
address-taken references).

**Nor does anything scrub.** `sentry_options_set_before_send` (`0x180007ed0`), `sentry_options_set_on_crash`
(`0x1800085f0`), `sentry_options_set_transport` (`0x180008950`) and `sentry_options_set_logger`
(`0x1800085c0`) are all exported and none is imported.

**Rate limiting is switched off.** `initBugTrackers` materialises the literal `--no-rate-limit`
(`0x140e3fe70`) at `0x14004d139` before launching `crashpad_handler.exe` (`crashpaddb` `0x140e3fe20` at
`0x14004cf23`; `crashpad_handler` `0x140e3fe30` at `0x14004d058`; `.exe` `0x140e3fe44` at `0x14004d08c`).
`sentry.dll` carries the same literal at `0x180032120` for the second handler it starts.

### 5.2.2 What actually leaves the machine — and what does not

> **CORRECTION, STATED PLAINLY.** An earlier draft of ours reported that the dump captures a 512-byte window
> around every register on every thread. **That is wrong for this configuration**, and the correction narrows
> the finding. The earlier analysis stopped one function short of the consumer. We are correcting it here
> rather than quietly dropping it.

The recording of register-pointed memory happens in `CaptureMemoryDelegateWin`'s vtable slot 4, and that
function returns before recording anything (**CONFIRMED**, disassembled this pass):

```
crashpad_handler.exe
0x140030be0  lea  rax, [rip+0x40439]   ; -> vtable 0x140071020, installed at [rcx]
0x140030bff  mov  [rcx+0x28], rax      ; the 5th ctor argument = the gather budget pointer
0x140071040  (vtable slot 4, +0x20)  = 0x140030c40
0x1400307e9  ff 50 20  call [rax+0x20] ; dispatched here, in the delegate-driving loop at 0x140030760
0x140030c7d  mov  rax, [rdi+0x28]      ; the budget pointer
0x140030c81  test rax, rax
0x140030c84  je   0x140030d80          ; -> epilogue, ret at 0x140030d8d. Records nothing.
```

The check is inside the callee, so it fires no matter who dispatches it. And that pointer is NULLed unless
the client opted in:

```
0x140022885  mov  rax, [rsp+0x30]      ; 8 bytes of CrashpadInfo at +0x14
0x140022891  shr  rax, 0x10            ; al = gather_indirectly_referenced_memory_ (+0x16)
0x140022895  lea  r13, [rsi+0x29c]
0x14002289c  cmp  al, 1                ; kEnabled?
0x14002289e  mov  edi, 0
0x1400228a3  cmovne r13, rdi           ; not kEnabled -> budget = NULL
```

All four `CPADinfo` sections in the product read byte-identically, with that field **zero (`kUnset`)**:
`WickrPro.exe 0x143570000`, `crashpad_handler.exe 0x140099000`, `sentry.dll 0x180049000`,
`Qt6WebEngineCore.dll 0x18bc2e000` (signature `0x43506164`, size 56, version 1, cap 0).

**Nothing writes that byte.** A superset scan of `WickrPro.exe` over `[0x143570000, 0x143570038)` — every
4-byte window in every executable section treated as a rip-relative displacement, plus complete enumeration
of the DIR64 base-relocation table (53,031 entries) — finds **one** reference and **zero** absolute pointers.
That one reference is `0x1407bab00  lea rax, [rip+0x2db54f9]; ret` — the `CrashpadInfo` accessor, a leaf
function with no `.pdata` record. *(An earlier draft of ours gave `0x1407baaff`; that byte is the `ret` of
the preceding function, whose `.pdata` extent is `0x7baad2`–`0x7bab00`. Corrected here.)*

**The accessor has exactly one caller, and that caller writes the structure** — a fact the earlier draft
asserted the opposite of, and which a vendor engineer finds with one cross-reference:

```
0x14004c1ec  e80fe97600  call 0x1407bab00       ; inside the function at 0x14004c1a0
0x14004c1f1  mov  rbx, rax
0x14004c1f4  test rax, rax
0x14004c1fd  mov  r13, qword ptr [rax + 0x20]   ; CrashpadInfo+0x20 = simple annotations
0x14004c20b  mov  ecx, 0x8000                   ; allocate
0x14004c210  call 0x140716218
0x14004c232  4c896b20  mov  qword ptr [rbx + 0x20], r13   ; <== the only write into the structure
```

That is the **only** write into `CrashpadInfo` anywhere in the image, and it targets `+0x20`, not `+0x16`.
So `gather_indirectly_referenced_memory_` keeps its `kUnset` value. **CONFIRMED.** *(The `0x8000` allocation
is `TSimpleStringDictionary<256,256,64>` = `64 × (256 + 256)` — it independently fixes the annotation ceiling
at 64 key/value pairs.)*

#### So the dump contains

* **per thread:** the full stack region, the TEB and the CPU context — each readability-probed first
  (`0x140029b31 call 0x140043000 / test al,al / je`), so "captured if fully readable", not unconditionally;
* **the PEB**, `PEB_LDR_DATA`, `RTL_USER_PROCESS_PARAMETERS` and its `UNICODE_STRING`s including the
  **command line** (`0x140020ae0`, `0x140020afb`), and **the entire process environment block** — located by
  pointer at `0x140020b16`, sized by the scan at `0x140020b20` → `0x1400221c0`, and added to the dump's
  memory list at `0x140020b36`;
* **not the heap**, and **not the register-pointed windows**.

**Consequence (INFERRED, not measured).** Key material or message plaintext that happens to be *on a thread
stack* at crash time is captured and uploaded. Heap-resident secrets are not. This is INFERRED because our
rules of engagement did not permit producing a live minidump and searching it for key material — nothing
here measures what is actually on `WickrPro.exe`'s stacks when it dies.

### 5.2.3 What is attached, and what identity travels with it

**Three attachment sites exist and all three take the same path.** The literal `--attachment=`
(`0x140e3fe80`) has exactly two materialisation sites, `0x14004d22e` and `0x14004d29d`, both inside
`initBugTrackers`; and `sentry.dll!sentry_options_add_attachmentw` is called once, at `0x14004dc41`, inside
the sentry-native initialiser at `0x14004d870`. All three consume the log-path accessor `0x140a75a00`
(called at `0x14004d1b7`, `0x14004d1df`, `0x14004dc1e`), which returns a copy of the global `QString` at
`0x1434f8b60`. **The attachment set is therefore closed at one file:** the current session's log,
`%LOCALAPPDATA%\Wickr, LLC\Wickr Pro\logs\<YYYY-MM-DD>_<hh-mm-ss>.txt`. **CONFIRMED.** *(An earlier draft
omitted `sentry_options_add_attachmentw`; a vendor engineer greping for attachment APIs would have found it
and concluded the section missed a path. It does not change the conclusion.)*

**Separately from the log, an account identifier is bound to every event by API.** `sentry_set_user` is
called exactly once, at `0x14004dd8d`, inside the same initialiser: it builds an object
(`sentry_value_new_object` at `0x14004dcc0`), converts a `QString` to `std::string` (`0x14004dcf7`), wraps it
(`sentry_value_new_string` at `0x14004dd0a`), sets it under the key `"id"` (literal at `0x140e36b88`,
referenced at `0x14004dd13`, `sentry_value_set_by_key` at `0x14004dd1d`), and attaches it. So the negative
below about the *logs* says nothing about the Sentry user object.

Crashpad annotations materialised in `initBugTrackers`: `version` (`0x140e3fdf8`), `product` (`0x140e3fe00`),
`appname` (`0x140e3fe08`), `platform` (`0x140e39f10`), `session.id` (`0x140e3fe10` — the literal is
`"session.id "`, eleven characters **with a trailing space**, raw `73 65 73 73 69 6f 6e 2e 69 64 20 00`,
which is plausibly a bug of its own), `client.state` (`0x140e3ff30`, at `0x14004d66f`) and the sentry tag
`clientState` (`0x140e3ff40`, at `0x14004d6c6`). **This list is a lower bound:** `sentry_set_tag` has seven
call sites (`0x14003b057`, `0x14003b0fb`, `0x14003b186`, `0x14003b1b9`, `0x14003b23e`, `0x14004c07a`,
`0x14004d6cd`) and we read the keys of only one; the dictionary ceiling is 64 pairs.

**What the attached log carries — measured by counting, not by reading.** Across the 33 application logs on
this host: **0** lines matching an email-address pattern and **0** bearer/authorization tokens **in the
attached logs**. What *is* there, per call, is participant identity and call metadata: 39
`VV_POPCORN_CONNECTION_REQUEST` and 148 `VV_POPCORN_USER_STATUS` records, carrying usernames, 64-hex user
IDs, display names, roles, device counts and mute/screenshare/host flags. No message plaintext and no key
material was found. That is precisely the social-graph and call-timing metadata an end-to-end-encrypted
messenger is supposed to withhold.

### 5.2.4 The trigger: a peer can force it

Finding 2's defect kills the victim's process from one authenticated call participant, repeatably. With
`--no-rate-limit` on both handlers and uploads enabled unconditionally, each kill produces one upload
attempt. There is no cap and no user-visible step.

> **QUALIFIER (b), and it travels with this claim.** The frames that drove Finding 2's crash came from the
> operator's *own second client*, patched in memory at the send path so that it emitted a chosen declared
> length. That models a malicious peer — which is the threat model — and is **not** a defect in the victim
> client. Nothing was modified on the victim beyond two read-only probe detours.

### 5.2.5 The whole chain, measured on this host in one session

| time (UTC) | artefact | what it shows |
|---|---|---|
| `2026-07-30T23:13:41.246Z` | `logs\…_npl.txt`, last line | **33** occurrences of `All bytes set to zero, decryption failed most likely` — Finding 2's marker for the vulnerable `memset` arm — the last of them here, from process **6916** |
| `2026-07-30T23:13:41.342Z` | `aud_in_{before,after}_aec_6916_48000_1ch.pcm` | the same process was writing microphone audio to disk (§5.1) at that instant |
| `2026-07-30T23:13:41.354Z` | `crashpaddb\last_crash` (ASCII, verbatim) | the process died **108 ms** after its last log line |
| `2026-07-30T23:13:43Z` | `crashpaddb\settings.dat` offset 16, `last_upload_attempt_time` = `a7 da 6b 6a 00 00 00 00` = **1785453223** | an upload was attempted **1.6 seconds** later |

This is the complete sequence — peer-driven corruption, process death, crash captured, upload attempted —
observed end to end on operator-owned hardware, and every row re-measured while writing this document.
`settings.dat`'s field records an *attempt*, not a confirmed successful POST; we did not observe the network
exchange, which is outside our rules of engagement.

### 5.2.6 Bounding negatives — what an attacker **cannot** do here

**1. The destination is not attacker-redirectable. CONFIRMED, and this closes a question our own earlier
notes had left open.** The Sentry endpoint is built entirely from build-time literals. Three static
initialisers construct global `QString`s via `Qt6Core!QString::QString(const char*)`:

| initialiser | literal at | global at |
|---|---|---|
| `0x14000c550` | `0x14328b880` (an organisation identifier) | `0x1434f93b0` |
| `0x14000c580` | `0x14328b840` (a project identifier) | `0x1434f9368` |
| `0x14000c5b0` | `0x14328b858` (a 32-hex-digit public key) | `0x1434f93c8` |

*(The literals themselves are deliberately not reproduced here.)* Those three globals are consumed by
exactly two builders: `0x140aebf20`, which formats the DSN template at `0x14328ba48`
(`https://%1@%2.ingest.sentry.io/%3`), and `0x140aebfb0`, which formats the minidump-upload template at
`0x14328ba08` (`https://%1.ingest.sentry.io/api/%2/minidump/?sentry_key=%3`). Each builder has exactly one
caller: `0x140aebfb0 ← 0x14004d0be` inside `initBugTrackers`, and `0x140aebf20 ← 0x14004d8fc` inside the
sentry-native initialiser at `0x14004d870`, whose result is passed straight to
`sentry.dll!sentry_options_set_dsn` at `0x14004d91f`.

A superset scan over `[0x1434f9368, 0x1434f93e0)` — the same two-mechanism scan described above — returns,
for the three DSN globals, exactly **three** constructor sites, **six** argument loads (the two builders'
`lea`s at `0x140aebf56` / `0x140aebf62` / `0x140aebf69` and `0x140aebfe6` / `0x140aebff2` / `0x140aebff9` —
these are the real instruction boundaries; an earlier draft of ours printed each of them three bytes late),
and **three** exit-time `QString::~QString` thunks (`0x140d4ff10`, `0x140d4ff20`, `0x140d4ff30`). Zero
absolute pointers into the range across all 53,031 DIR64 relocations. One further candidate at `0x140425a66`
is a scan artefact and not an instruction boundary — the real instructions there are
`0x140425a64 mov ecx,[rcx+rax]` and `0x140425a67 cmp dword [rip+0x30b3503], ecx`, whose target is
`0x1434d8f70`, outside the range. **There is no runtime writer. A peer cannot point the upload anywhere.**

**2. The dump is not full process memory.** Per §5.2.2 — no heap, no register-pointed windows. Stacks, TEBs,
contexts, PEB, process parameters, environment.

**3. The high-value files are not attached.** The attachment set is provably closed at one file (§5.2.3): the
`.wic` key files, `wickr_db.sqlite`, `mls/`, the metrics files and the raw `.pcm` recordings of §5.1 are
**not** attached. §5.1 and §5.2 do not compound.

**4. The message store is encrypted at rest** (measured in §5.1's evidence). Whatever else leaves the
machine, it is not the message database.

**5. The renderer processes produce no separate dumps.** None of `crashpad-handler`, `enable-crashpad`,
`crash-dumps-dir`, `CrashpadHandlerMain` or `crash-reporter` occurs in `Qt6WebEngineCore.dll` or
`QtWebEngineProcess.exe`, in either ASCII or UTF-16. **INFERRED** from string absence — absence of a string
is not absence of a feature — and note that `Qt6WebEngineCore.dll` is loaded *into* `WickrPro.exe`, so the
main process's dump does cover the browser-process side.

**This is a privacy and data-governance defect, not an attacker-controlled exfiltration channel. Any
write-up implying otherwise would be wrong.**

### 5.2.7 What is not established

* **Whether a real Wickr minidump contains key material.** Narrowed by §5.2.2 to the specific question "is
  key material on a thread stack at crash time?". Answering it needs a live crash captured before upload and
  searched — operator-authorised, on a scratch account. **UNDETERMINED.**
* **Whether the crash-reporting gate can be flipped by a command-line override.** The ordering between
  `main`'s `environment = production` store and the `--environment` parser (`0x1409d6500`) was never
  established. The parser demonstrably writes `0x143498f70`, so if it runs later, `--environment alpha`
  stores 0 and forces reporting on even where the two settings would suppress it. **UNDETERMINED.**
* **Who calls the two gate-predicate setters.** If a server-side lever can drive them, it can silently turn
  a target's crash telemetry *off*. The direction of that lever is untraced and it is not an escalation.
  **UNDETERMINED.**
* **The complete crash annotation inventory.** Only `client.state` was established by reading; six further
  `sentry_set_tag` sites were not read, and the dictionary holds up to 64 key/value pairs of 255 characters.
  **UNDETERMINED, bounded ceiling.**

### Suggested remediation

1. **Gate crash reporting on explicit user consent.** `sentry.dll` already exports
   `sentry_options_set_require_user_consent` (`0x180008710`) and the four `sentry_user_consent_*` calls.
   Import them, set `require_user_consent` to true in the initialiser at `0x14004d870`, and do not call
   `crashpad::Settings::SetUploadsEnabled(true)` at `0x14004d3bc` until consent is recorded. Replace the
   hardcoded `mov dl, 1` at `0x14004d3b7` with the stored preference.
2. **Scrub or omit the process environment block and `RTL_USER_PROCESS_PARAMETERS`.** They are the
   highest-yield, lowest-value part of the dump: they carry the full environment and command line and
   contribute nothing to a stack trace. If Crashpad's capture policy cannot be narrowed, set
   `sentry_options_set_before_send` (`0x180007ed0`) or `sentry_options_set_on_crash` (`0x1800085f0`) — both
   already exported, neither imported — and strip them there.
3. **Restore rate limiting.** Drop `--no-rate-limit` from both handler launches, so a peer who can force
   repeated crashes cannot force unbounded uploads.
4. **Reconsider whether a messenger of this class should upload process memory at all**, and whether the
   attached application log should carry call-participant identity, and whether `sentry_set_user` should
   carry an account identifier. Reducing the attachment to a redacted log would remove the metadata exposure
   without losing diagnostic value.
5. **Fix Finding 2**, which removes the on-demand trigger.

---

## 5.3 (F5c) Message and conversation identifiers persist in cleartext logs that are never pruned, and outlive the messages they name

**Class:** CWE-532 (insertion of sensitive information into a log file), CWE-212 (improper removal of
sensitive information before storage or transfer)
**Component:** `WickrPro.exe` logging, `%LOCALAPPDATA%\Wickr, LLC\Wickr Pro\logs\`
**Attacker:** any process running as the signed-in user; anyone with access to a backup, a forensic image or
a recovered disk. No elevation.
**Status:** CONFIRMED by measurement on the operator's own machine, plus a negative result established by
string sweep over the shipped binary.

### Summary

The product deletes expired messages from an encrypted database. It does not touch the logs. The logs name
messages and conversations by identifier, in cleartext, and are never rotated or pruned — so after a message
burns, the record that it existed, in which conversation, at what time, remains readable on disk
indefinitely.

This is not a claim that message *content* leaks. We checked for that and it does not — see §5.5. It is a
claim about the metadata that survives the erasure.

### The expiry mechanism only reaches the database — CONFIRMED (disassembled)

`queryDeleteExpiredMessages` (`WickrPro 0x1408f3e40`) issues one statement, the literal at `0x14323bff0`:

```sql
DELETE FROM Wickr_Message
 WHERE destructTime > 0 AND destructTime <= ?
   AND (state = 1 OR state = 4 OR state = 5)
   AND skipCleanup = 0
```

It has exactly two callers, and together they are the whole enforcement model:

* `0x140917120` — the periodic maintenance pass (`"CACHE MAINTENANCE (cache expirations): "`,
  `" messages expired (cached), "`, `" messages expired (non-cached)."`).
* `0x1409de790` — the database load at session start (`": deleted "`, `" expired messages."`).

So expiry is enforced both on a timer and at launch, and it is a real `DELETE` rather than a UI-level hide.
That part is sound. **Nothing in either caller touches the log directory.**

### What the logs actually contain — MEASURED

Operator's machine, 33 files, **22,213,342 bytes**, spanning 2026-07-29 23:27 to 2026-07-31 12:13. Largest
single file **15,975,228 bytes**. Occurrence counts only; no value from the operator's data is reproduced
here or was recorded anywhere.

| pattern | occurrences | files containing |
|---|---|---|
| message body tag (`bodyText` / `bodyData`) | **0** | 0 / 33 |
| attachment filename | **0** | 0 / 33 |
| `user@host`-shaped handle | **0** | 0 / 33 |
| room / conversation *name* label | 2 | 1 / 33 |
| **`msgID`** | **1,613** | 15 / 33 |
| **`vGroupID`** (conversation identifier) | **134** | 15 / 33 |
| **UUIDs** | **2,273** | **33 / 33** |
| base64 blob ≥ 64 characters | 188 | 13 / 33 |

### Nothing rotates or prunes them — CONFIRMED (string sweep, negative)

No `maxLogFile`, `logRotat`, `rotateLog`, `maxLogSize`, `logRetention`, `removeOldLog`, `cleanupLog`,
`pruneLog` or `LOG_MAX` string exists anywhere in `WickrPro.exe`, in either ASCII or UTF-16. The measured
directory is consistent: three days of continuous use, nothing removed, one file at 16 MB.

### Impact

An adversary with filesystem access — malware running as the user, a shared or recovered machine, an
unencrypted backup — recovers a timeline of *which* conversations a user participated in and *how many*
messages passed through each, with timestamps, for the entire life of the installation, regardless of what
TTL was set. For a product whose proposition is that the messages are gone, the surviving index is the
sensitive part.

### Suggested remediation

1. **Do not log `msgID` or `vGroupID` at default verbosity.** If they are needed for support, hash them with
   a per-installation salt held in the same keystore as the database key, so a log is only correlatable by
   someone who already has the database key.
2. **Bound and rotate.** A size cap and a file count, with deletion of the oldest — there is currently no
   mechanism at all.
3. **Tie log retention to the shortest active TTL in the account**, or at minimum purge logs on logout and
   on account removal, so the surviving index cannot outlive the messages by more than the TTL.
4. **Encrypt the log at rest with the existing database key.** The two SQLite databases in the same
   directory already are (§5.5); the logs are the outlier.

---

## 5.4 (F5d) An account-scoped identifier is stored in cleartext in `metricsEventQueue`, between two encrypted databases

**Class:** CWE-312 (cleartext storage of sensitive information)
**Component:** `WickrPro.exe` metrics pipeline, `%LOCALAPPDATA%\Wickr, LLC\Wickr Pro\metricsEventQueue`
**Attacker:** any process running as the signed-in user; any holder of a backup or disk image.
**Status:** CONFIRMED by measurement (file parsed on the operator's own machine).

### Summary

`metricsEventQueue` is a plaintext, line-framed file of base64-encoded protobuf records. One of its nested
fields is a 20-character ASCII identifier. It sits in the same directory as `wickr_db.sqlite` and
`metrics/metrics.sqlite`, **both of which are encrypted at rest** (§5.5). The queue is the only member of
that trio that is not.

### Format — MEASURED

168 bytes on the operator's machine. A plaintext header line, then CRLF-delimited base64 records:

```
metricsEventQueue|MetricsEvents|4.0.31
<base64 protobuf>
<base64 protobuf>
```

Each record decodes to:

```
field 1     varint
field 2     varint    epoch-milliseconds        (matched the file's mtime on decode)
field 3     varint
field 4,5,6 varint
field <N>   message   <-- the field NUMBER is the event id; 110 and 111 observed
              .1  varint
              .2  { .1 = epoch-milliseconds }
              .3  { .1 = a 20-character ASCII identifier    <-- NOT REPRODUCED HERE
                    .2 = varint }
```

We did not investigate what the identifier denotes and did not record its value anywhere. The point is
structural: it is an opaque, stable, account-scoped string, and it is on disk in the clear.

### Destination — UNDETERMINED, and one observation worth passing on regardless

We **did not** connect the queue's drain to a URL. Separately, `WickrPro.exe` carries the literal
`https://beta.astryb.people.aws.dev/api/RequestLogUpload` at `0x143299340` with **exactly one** code
reference (`0x14000ef60 @0x14000ef64`, a static `QString` initialiser) — so it is a hard-coded constant and
an attacker cannot redirect it. `*.people.aws.dev` is an Amazon internal-developer domain, and a `beta.`
host of one appearing in a shipped release build is worth a look at your end independently of this finding.

### Suggested remediation

1. **Encrypt the queue with the same key as `metrics.sqlite`**, or write the pending events into
   `metrics.sqlite` itself rather than a sidecar file. The encryption machinery is already present and
   already applied to both neighbours.
2. **Drop the plaintext header line**, which currently identifies the file's purpose, schema and version to
   anyone browsing the directory.
3. **Delete the queue on logout and on account removal.**

---

## 5.5 Bounding negatives for this section — what we checked and found clean

These are stated with the same weight as the findings. On this theme, most of what we checked was sound, and
a report that only lists failures misrepresents the product.

* **Attachments are NOT written to `temp\` in the clear. CONFIRMED (measured).**
  `temp\attachments\` held 15 files, 5,762,769 bytes, on the operator's machine. Shannon entropy per file
  **7.716 – 8.000 bits/byte**; **no format magic on any file** (no JPEG, PNG, GIF, PDF, ZIP/OOXML, RIFF,
  MP4, MKV, BMP, MP3, OGG or SQLite header); every file begins with a `00` byte, consistent with a versioned
  AEAD container. The decrypted bytes are not landing on disk.
* **No decrypted previews or thumbnails are written. CONFIRMED (measured).** `temp\preview\` and `temp\crl\`
  were **empty**; `cache\` contained only an empty Qt pipeline-cache directory.
* **`metrics/metrics.sqlite` is encrypted at rest. CONFIRMED (measured).** 20,480 bytes, entropy **7.992
  bits/byte**, no `SQLite format 3` magic — the same result previously established for `wickr_db.sqlite`.
* **No message content, attachment name or user handle appears in the logs. CONFIRMED (measured).**
  Zero occurrences across all 33 files and 22.2 MB — see the table in §5.3.
* **The outgoing TTL *is* validated against the network policy, on the path we read. CONFIRMED
  (disassembled).** `WebChannelMessageBridge::verifyTTLAndBOR` (`WickrPro 0x140112030`) fetches the network
  settings, reads `maxTTL` via `0x1409cc3e0` and `maxBOR` via `0x1409cc3c0`, then:
  ```
  0x140112076  8b0e   mov  ecx, dword ptr [rsi]   ; the proposed TTL (in/out parameter)
  0x140112078  3bcd   cmp  ecx, ebp               ; vs maxTTL
  0x14011207a  7f04   jg   0x140112080            ;   too large -> clamp
  0x14011207c  85c9   test ecx, ecx
  0x14011207e  7f66   jg   0x1401120e6            ;   0 < ttl <= maxTTL -> accept unchanged
  0x1401120e4  892e   mov  dword ptr [rsi], ebp   ; otherwise CLAMP: ttl := maxTTL
  ```
  It **clamps rather than rejects**, and a zero or negative value is clamped *upward* to `maxTTL`. `bor` is
  then checked against `maxBOR` and against the TTL.
  **Deliberately not claimed:** that "never expires" is therefore unreachable. It is not — `0` is a listed
  value in `availableEnvelopeTTL` and the reaper only deletes rows with `destructTime > 0`, so a zero TTL
  must be carried to `destructTime` by some path other than this one (most plausibly a
  conversation-level default rather than a per-message value). We did not identify that path. All that is
  CONFIRMED here is the behaviour of this function.
* **The crash-upload endpoint and the log-upload endpoint are hard-coded and not redirectable. CONFIRMED
  (measured).** One code reference each, both static initialisers.

### Two residuals on this theme, stated plainly

* **The SQLite write-ahead logs are not being checkpointed, so superseded page images persist after a
  `DELETE`.** Measured: `wickr_db.sqlite` 179,200 B with a **790,224 B** `-wal` (4.4×); `metrics.sqlite`
  20,480 B with a **4,120,032 B** `-wal` (201×). Both databases are encrypted, so this is **defence in
  depth, not a plaintext exposure** — but a message's ciphertext is not removed from the volume when its row
  is deleted, only when the WAL is checkpointed and reused. Consider an explicit `wal_checkpoint(TRUNCATE)`
  after the expiry sweep in `0x1408f3e40`'s callers.
* **The TTL ceiling is network-operator-controlled, and "no expiry" is a supported value.** `maxTTL`,
  `maxBOR`, `availableEnvelopeTTL`, `destructOnRead`, `maxMessageTTL` and `maxMessageBOR` are keys in the
  same server-supplied network-settings object as `forceOpenAccess`, `censorshipProxyConfig` and
  `maxUploadSize` (string blocks at `0x143255688` and `0x14326a889`). The default document embedded in the
  binary at `0x142dc0a2a` reads `"availableEnvelopeTTL": [0, 600, 3600, 86400, 604800, 2592000]` and
  `"destructOnRead": [0, 45, 600, 3600, 86400]` — **`0` is a first-class option in both**, and the reaper
  only deletes rows with `destructTime > 0`. That is a product decision rather than a defect, and we report
  it only so the trust model is explicit: the ceiling is set by the network operator and the floor is "never
  expires".
  **UNDETERMINED, and it is the one thing on this theme we could not settle:** where the *receiving* client
  computes `Wickr_Message.destructTime` for an inbound message, and therefore whether a receiver
  re-validates an incoming or room-changed TTL against its own `maxMessageTTL`. The `INSERT`/`UPDATE`
  statements (`0x143246c70`, `0x143246e20`, builder `0x14093e1d0`) are `%1…%37` placeholder templates with
  the column names bound at runtime, so the mapping is not recoverable from the strings; the `destructTime`
  column literal (`0x143238798`) has only two references, both static `QString` initialisers. The TTL is a
  *conversation* attribute changed through a control path — `WickrSecureRoomMgr::changeTTL` (`0x143260610`),
  the signal/slot pair at `0x140e3c468` / `0x140e3c448`, and `ENVIRONMENT MANAGER: Changing TTL for
  VGROUPID: ` (`0x14329a948`, used once, in `0x140b2ec50`). **The sharp question we are leaving open is who
  is authorised to change a conversation's TTL and whether the receiving client verifies that
  authorisation.**

---

# CONSOLIDATED REMEDIATION

Ordered by impact divided by effort. Every item names the function, the field or the flag.

| # | Change | Where | Effort | What it removes |
|---|---|---|---|---|
| **1** | **Clamp the decoded VP8 frame dimensions before allocating.** Reject a frame whose geometry exceeds the negotiated `VideoFormat` or a hard ceiling (4096×4096) *before* `vp8_alloc_frame_buffers` runs — at `vp8_peek_si` (`NPL 0x18017e584` / `0x18017e59c`, immediately after the `and …, 0x3fff`), or at the `VpxDecoder` boundary by calling `peek_si` (`iface+0x28` = `0x18017d740`) before `vpx_codec_decode` at `0x180144bb3` | `NPL.dll` | one check | **Finding 3 outright, and Finding 1's gate.** Also removes the second, worse corruption regime where the failure lands on the `mip` calloc with the new geometry already committed |
| **2** | **Null `pc->mi` (`+0xc60`) and `pc->prev_mi` (`+0xc70`) in `vp8_de_alloc_frame_buffers`**, alongside the `mip` (`+0xc58`, nulled at `0x1801863e0`) and `prev_mip` (`+0xc68`, at `0x1801863d2`) stores it already performs | `NPL 0x180186320` | **two lines** | **Finding 1's primitive entirely**, on both routes — the six failure exits inside `vp8_alloc_frame_buffers` and the `prev_mip` route at `0x18017ddce`. Turns the use-after-free into a NULL dereference |
| **3** | **Link `WickrPro.exe` with `/guard:cf` and `/CETCOMPAT`** | build config | **one link flag** | Activates CFG instrumentation that 276 of 287 shipped binaries already carry and that is inert today. **Cheapest item in this report** |
| **4** | **Configure the update signing key, and fail closed without one.** Call `win_sparkle_set_dsa_pub_pem()` before `win_sparkle_init()`, or embed a `DSAPEM`-typed `DSAPub` resource in `WickrPro.exe`; and make the branch at `WinSparkle 0x180028e08` abort rather than skip | `WickrPro.exe` + a WinSparkle patch | one call, one branch | **Finding 4a.** Also covers the malformed-resource case, which currently degrades to "no key" silently via the throw at `0x1800182ba` |
| **5** | **Bound `Buffer.size` against the real received payload length** in the `kind==2` handler, before the Frame constructor at `NPL 0x18011effa` — the same disposition the sibling plane branch takes at `0x18011f1c7` | `NPL 0x18011ef70` | one comparison | **Finding 2's demonstrated attack** |
| **6** | **Compile the microphone dump out of release builds:** remove the `fopen` sites at `NPL 0x18015be5d` and `0x18015c004` and the `fwrite` sites at `0x18016118e` and `0x18016130f`. **Delete existing `.pcm` files on upgrade** | `NPL.dll` + installer | small | **Finding 5a.** The deletion step matters: every user of an affected build is carrying recordings now |
| **7** | **Gate crash reporting on explicit consent.** Import `sentry_options_set_require_user_consent` (`sentry.dll 0x180008710`) and the four `sentry_user_consent_*` calls; set it true in the initialiser at `WickrPro 0x14004d870`; replace the hardcoded `mov dl, 1` at `0x14004d3b7` with the stored preference; drop `--no-rate-limit` from both handler launches | `WickrPro.exe` | small | **Finding 5b's consent gap** and the unbounded-upload amplifier |
| **8** | **Give the crypt callback a status and honour it.** `CryptProxy::onPacket` discards `eax` at `NPL 0x18011b68e`; test the callback's return at `0x18011b68c` and drop the packet on failure | `NPL 0x18011b3b0` | small | A frame whose authentication failed currently reaches the C decoders anyway |
| **9** | **Stop sniffing remote content.** Pass the format at 18 call sites — 9 `QImage::loadFromData` (`0x140d56278`) and 9 `QImage(QString, const char*)` (`0x140d56028`); restrict the plugin set for peer content via `QImageReader::setAllowedFormats()` or a reduced `imageformats\` set | `WickrPro.exe` | medium | Removes PDFium, TIFF, TGA, ICNS and WBMP from a sender's menu (Finding 4c) |
| **10** | **Give libvpx the negotiated geometry.** Stop passing `cfg.w = cfg.h = 0` at `NPL 0x1801446fe` | `NPL.dll` | trivial | Defence in depth for item 1; documents intent |
| **11** | **Tear the decoder down on any allocation failure.** `vp8_decode`'s landing pad at `0x18017db24` returns `-1` without destroying the codec; `vpx_codec_dec_init_ver` (`0x18017d4a0`) is called exactly once, at `0x180144731`, and there is no matching teardown | `NPL.dll` | medium | Defence in depth. **Not sufficient alone** — item 2 is what closes both routes |
| **12** | **Update the bundled libvpx** (self-reports v1.9.0), **`Sock5.dll`** (mbedTLS 2.1.5 from 2015, SQLite 3.19.2 from 2017, both mapped at process start), **and WinSparkle's statically linked OpenSSL 1.0.x** (EOL since 2019-12-31, and the DSA path item 4 turns on runs through it) | dependencies | medium | Finding 4e |
| **13** | **Authenticate `PacketHeader` — carry it as AAD in the end-to-end layer.** It is written by the `Serializer` after `CryptProxy` encrypts and parsed before `CryptProxy` decrypts | `NPL.dll`, protocol | **large** | **Removes the relay from the trust boundary for call integrity** (§2 Appendix 2A) and closes the whole class of header-driven defects, not just Finding 2 |
| **14** | **Install to `%ProgramFiles%`** with the standard machine-wide ACL, or at minimum drop the installing user's write access to the installed binaries after installation | installer | medium | Finding 4d |
| **15** | **Consider isolating media decode.** Today the VP8 and Opus decoders share an address space with the UI, the key material and the message store | architecture | large | Blast radius for Findings 1–3 |
| **16** | **Stop logging `msgID` and `vGroupID` at default verbosity** — hash them under a per-installation salt held with the database key — and give the log directory a size cap, a file count and deletion on logout | `WickrPro.exe` logging | small | **F5c.** Today the index of a burned message outlives the message indefinitely |
| **17** | **Encrypt `metricsEventQueue`**, or fold pending events into `metrics.sqlite`, which is already encrypted. Drop its plaintext header line and delete it on logout | `WickrPro.exe` metrics | small | **F5d** |
| **18** | **Checkpoint the write-ahead log after the expiry sweep** — `wal_checkpoint(TRUNCATE)` in the callers of `queryDeleteExpiredMessages` (`0x140917120`, `0x1409de790`) | `WickrPro.exe` storage | small | Defence in depth: today a deleted message's ciphertext stays in a WAL measured at 4.4× and 201× the size of its database |
| **19** | **Range-check `PacketHeader` field 10 at the parse site** (`NPL 0x18013bdd7`) and bound the per-packet epoch advance, beside the `kind` arm that already validates at `0x18013ba51`–`0x18013ba5e` | `NPL.dll` | one check | **F2c**, at the cheapest point in the chain. Item 13 also covers it |
| **20** | **Rebuild against a current Qt/QtPdf.** The shipped `Qt6Pdf.dll` and `qpdf.dll` are dated **2025-09-17** while `WickrPro.exe` is dated 2026-07-13 — the Qt libraries are ten months behind the application that ships them, and that gap is what admits **F4f** | build/release | medium | **F4f**, and the whole class behind it |
| **21** | **Remove `qpdf.dll` from `imageformats\`, or pass an explicit format to `QImage::loadFromData` instead of `NULL`.** Either removes the demonstrated write path immediately, without waiting on an upstream bump. A messenger's inline preview does not need to render PDF through a browser engine's PDF stack; the same argument retires ICNS, TGA, WBMP and TIFF | `WickrPro.exe` | **small** | **F4f outright**, and it shrinks F4c's parser menu from 14 formats to the few actually used |

**If you do only two things, do items 1 and 2.** Item 1 is one check and closes Finding 3 outright and
Finding 1's reachability. Item 2 is two lines and removes Finding 1's primitive whether or not item 1 lands.
Item 3 is a link flag and costs nothing.

---

# SCOPE AND LIMITS

## What was searched

* **`NPL.dll` and `WickrPro.exe`, in depth.** The media receive path from the transport to the decoders; the
  libvpx VP8 decoder; the protobuf `PacketHeader` parse and both branches of the `kind==2` handler; the
  media crypt proxy and WickrPro's decrypt callback; the AEAD primitive and its parameter tables; the
  audio-device manager; `initBugTrackers` and the crash-reporting chain; the DTLS context builder and the
  certificate trust path.
* **Image-wide sweeps over `NPL.dll`**: VP8 sync-code testers, the 14-bit dimension mask, stores at
  `+0xc60`, direct callers of `vp8_alloc_frame_buffers` / `vp8_de_alloc_frame_buffers` /
  `vpx_codec_dec_init_ver`, and the `fopen`/`fwrite` import call sites.
* **Every field of `Proto::PacketHeader`, to every consumer.** All ten int32s located at their parse sites
  in `_InternalParse` and cross-checked against `_InternalSerialize`; all three `kind` handlers read in
  full; the `Frame` and descriptor copies enumerated; the 337-byte decrypt callback read in full; the NPL
  export table enumerated (230 symbols) to bound what the application can see of a received packet. Eight of
  the nine unclamped fields taken to a verdict — see §2 Appendix 2B.
* **The on-disk footprint of an installed, used client**: the data directory in full (both SQLite databases
  and their write-ahead logs, `temp\attachments`, `temp\preview`, `temp\crl`, `cache\`, `logs\`,
  `metricsEventQueue`, `metrics\`), characterised by magic bytes, Shannon entropy and — for the logs and the
  metrics queue — by parsing. No message content, account identifier or key material was recorded.
* **The message-expiry mechanism**: the schema strings, `queryDeleteExpiredMessages` and both of its
  callers, and the sender-side TTL validator.
* **The whole installed tree** for PE mitigation flags, plugin inventory, component versions and build
  paths: 287 PE files.
* **`WinSparkle.dll`** end to end on the signature-verification path, plus its import table and resource
  lookups.
* **On-disk artefacts** on the operator's own machine: the PCM recordings, the encrypted message database
  and its WAL, the Crashpad database and settings, and the application logs.

## What was NOT searched

* **Any platform other than Windows.** The iOS, Android, macOS, Linux and web clients were never assessed.
  Findings 1 and 3 are defects in a vendored library plus the absence of a clamp above it, so **the vendor
  should assume they are present wherever that NPL/libvpx build ships, until checked.** We make no claim
  either way.
* **Server-side and hub-side anything.** No traffic was captured at the relay; §2 Appendix 2A's conclusion
  is a consequence of four client-side legs plus the confirmed scene ordering, not a direct observation. AWS
  can settle it from the server side in minutes, and it decides whether Finding 2's attacker set is "a call
  peer" or "the infrastructure".
* **The 10.17 % of `NPL.dll`'s `.text` outside `.pdata`** — 440,840 bytes. Every "exactly N in the whole
  image" claim about `NPL.dll` is exhaustive over `.pdata`-covered code only, except the two Section 3
  sweeps, which were re-run over the whole `.text` and returned the same answers. One known function inside
  the blind spot is `0x180144320`, the `VpxDecoder` decode-failure handler.
* **Group calls.** Only two operator accounts were available, so the N-publisher multiplier in Finding 3 is
  arithmetic, not measurement.
* **The Qt WebEngine renderer's own attack surface**, beyond version inventory and the two command-line
  questions in §4.6.
* **The receive-side computation of `Wickr_Message.destructTime`**, and therefore whether a receiving client
  re-validates an incoming or room-changed TTL against its own `maxMessageTTL`. The `INSERT`/`UPDATE`
  statements are runtime-bound placeholder templates, so the column mapping is not recoverable from the
  strings; the path we would follow next is `WickrSecureRoomMgr::changeTTL` and the authorisation check
  behind it. See §5.5. **This is the largest single gap on the ephemerality theme and we flag it rather than
  round it to a negative.**
* **The identity of `AV::Parser + 0x118`**, the delegate that receives `PacketHeader` field 7 (the EVENT id)
  as an unclamped argument to a virtual call at `NPL 0x18011ecc3`. Eight of the nine unclamped header fields
  were taken to a verdict; this is the ninth. See §2 Appendix 2B.
* **Fuzzing of any kind against Wickr infrastructure**, and any network interaction with Wickr or a third
  party beyond the two authorised calls between operator-owned accounts.

## What is explicitly not claimed

* **No path to remote code execution was established, and none is claimed.** Eleven phases of work have not
  produced control of the instruction pointer from a remotely deliverable input. Finding 4a's update-channel
  defect can cause an unauthenticated program to run, but that is the update flow doing what it is told, not
  memory corruption, and it needs an attacker positioned on that channel.
* **The missing link for Finding 1 is a reclaiming object, and the search for one failed for a stated
  reason.** The freed block that frame C wrote into was still free — nothing had reclaimed it, so there was
  no live object, no vtable and no virtual call to redirect. The corpus of pointer stores in `NPL.dll` at
  reachable offsets was enumerated and every one of 37 reachable clean-slot candidates was taken to a
  definite verdict and excluded. The systematic reason: **not one points into memory an attacker can spray**
  — they point into module images, or are interior self-pointers, or target the generic small-block heap —
  and a partial overwrite cannot move a pointer out of its own 4 GiB window, while the ~2 GiB of decoder
  frame buffers the attacker can spray receives an independent ASLR draw. Two constraints compound: the
  first 244 bytes of the block are unreachable under every geometry, so a plain polymorphic object can never
  be the target; and the attacker's block-size lattice steps by 76 while NT heap buckets step by 16, so only
  about 15 % of block sizes are addressable. **That is "no target found by a search that reached a definite
  verdict on every reachable candidate", not "structurally impossible", and we do not claim the latter.**
  Three specific holes remain and are named in §1.7: the allocator regime (LFH vs backend) was never tested
  and roughly twenty exclusions assume LFH; the search enumerated pointer *stores* and a 26-function
  load-side residue was never taken to a verdict; and the `.pdata` blind spot applies.
* **Finding 1 is not claimed to be reachable on an ordinary host.** Qualifier (a) is not a caveat, it is the
  precondition: on a stock 4 GiB machine with a system-managed pagefile the 2 GiB request succeeded and no
  gate opened.
* **The instruction-pointer-control demonstration is not claimed to be a reachable exploit.** Qualifier (c):
  the reclaiming object was supplied by our harness.
* **Nothing about the victim client is claimed to be modified.** Qualifier (b): the patched client in both
  live demonstrations is the attacker's own.
* **No CVE numbers are asserted for third-party components** beyond CVE-2023-4863 (where we verified the fix
  is present by structure) and CVE-2025-2783 (where the remediation is present but its provenance is
  UNDETERMINED, and the identification of *which* upstream change is the remediation is itself INFERRED and
  load-bearing). The libjpeg restart-interval observation in §4.5 deliberately carries no CVE number.
* **We did not observe any network exchange**, so `settings.dat`'s `last_upload_attempt_time` records an
  *attempt*, not a confirmed successful POST.

---

# A NOTE ON RESPONSIBLE-DISCLOSURE HYGIENE

Three things happened during this assessment that AWS should know about plainly, because they concern AWS's
own data rather than ours.

**1. This testing crashed the researcher's own clients, repeatedly and deliberately.** Findings 1 and 2 were
demonstrated by killing operator-owned `WickrPro.exe` processes on operator-owned machines, in calls between
two operator-owned accounts. No third party's client was ever targeted and no third party was in any of
these calls.

**2. Crash reporting is on by default, with no consent mechanism** (§5.2.1). There is no gate to fail open
or closed — there is no gate. Uploads are enabled by a hardcoded `mov dl, 1` at `WickrPro 0x14004d3b7`; the
sentry-native consent API is exported by the bundled `sentry.dll` and is not among the 17 symbols
`WickrPro.exe` imports; and both handler processes are launched with `--no-rate-limit`.

**3. `settings.dat` records an upload attempt two seconds after a real crash.** On this host,
`crashpaddb\last_crash` reads `2026-07-30T23:13:41.354Z`, and `settings.dat`'s `last_upload_attempt_time`
(int64 at file offset 16, bytes `a7 da 6b 6a 00 00 00 00` = 1785453223) is `2026-07-30T23:13:43Z` — 1.6
seconds later, with the options word reading `0x00000001 = kUploadsEnabled`. Both figures were re-measured
while writing this document.

**Therefore: AWS may already hold minidumps from this assessment.** We did not observe the network exchange
— that is outside our rules of engagement — so we cannot confirm any upload completed. But the mechanism is
enabled, the attempt timestamp is on disk, and there were multiple crashes.

What those dumps would contain, per §5.2.2 and §5.2.3: full thread stacks, TEBs and CPU contexts; the PEB,
`RTL_USER_PROCESS_PARAMETERS` and the entire process environment block including the command line; one
attachment, the current session's application log — which carries call-participant usernames, 64-hex user
IDs, display names and call metadata; and a Sentry user object whose `id` key is filled from a client
`QString`. Not the heap, and not register-pointed memory. The `.pcm` recordings of §5.1 and
`wickr_db.sqlite` are **not** attached.

We are telling you rather than asking you to do anything. If AWS wishes to identify and purge those reports,
the operator will supply the exact crash timestamps and the Crashpad client UUID on request through the
disclosure channel. We have not published, shared or retained anything beyond what is needed to support this
document, and no operator account identifier, message content, key material or recording content appears
anywhere in it.

It is also worth stating the obvious consequence of §5.2.4 in the other direction: **Finding 2 lets a remote
call peer force this pipeline on demand, without rate limiting.** Fixing Finding 2 removes the trigger;
adding a consent gate removes the exposure; doing both is the right answer.

---

# SECTION 6 — F6: the TLS-UDP proxy transport uses a peer-supplied 16-bit length prefix as a read length into a fixed 2,048-byte buffer

## 6.1 Summary

`NPL.dll`'s TCP/TLS→UDP relay reads a two-byte length prefix off the wire and then uses that value,
**without comparing it against anything**, as the amount to read into a **2,048-byte buffer embedded
inside the connection object**. A frame declaring more than 2,048 bytes overflows the object linearly
with attacker-chosen bytes, up to roughly 63.5 KB.

This differs from Findings 1, 2 and 3 in the ways that matter for severity:

* it needs **no allocation failure** (unlike F1) and therefore no memory precondition;
* the written bytes are **fully attacker-chosen** — not zeros (unlike F2), not zero-extended 32-bit
  quantities (unlike the PDFium defect in §4.5);
* the length is attacker-chosen over the full 16-bit range;
* the transport carrying it is **established on every call we observed**.

**Status, stated plainly: CONFIRMED (disassembled) and EXECUTED against the shipped `NPL.dll` in a
local harness (§6.8).** No instruction-pointer control is demonstrated or claimed, and nothing was sent
to Wickr infrastructure.

## 6.2 The component, and that it runs

The containing function is `NPL 0x18009d570` (2,422 bytes, `.pdata` extent `0x18009d570`–`0x18009dee6`).
Its own UTF-16 log literals identify it:

```
0x18042d040  'TCP socket is gracefully closed'
0x18042d080  'Cannot read from TCP socket, error: '
0x18042d0d0  'TCP_TLS socket is closed, error: '
0x18042d120  'Cannot read from TCP_TLS socket, error: '
0x18042d180  "RecvDataSize doesn't match FullDataSize. RecvDataSize: "
0x18042d1f0  ', FullDataSize: '
0x18042d220  'Cannot write to UDP socket, error: '
```

It receives on the socket at `[obj+0x2e4]` and sends on a different socket at `[obj+0x2ec]` — a relay.
The client's own log tag for this component is `Net.TcpProxyConnection`, and it is not a dormant code
path. MEASURED, from the client's logs on the operator's own machine:

```
[I ... Net.TcpProxyConnection] SSL connection to <redacted> established
[I ... Net.TcpProxyConnection] TLS-UDP connection to <redacted> is established
 77 x  (TLS-UDP proxy) Starting to establish connection to tls://<redacted>
  7 x  TLS-UDP proxy connection to tls://<redacted> established
```

## 6.3 The defect — CONFIRMED (disassembled)

The wire framing is `[uint16 length][length bytes]`. The prefix size is a compile-time immediate:

```
0x18009d5b2  41be02000000     mov  r14d, 2
```

Phase 1 reads the two prefix bytes into the head of the buffer (`recv` at `0x18009d5ec`). Once at least
two bytes have arrived, the length is taken from the buffer's own first two bytes and stored:

```
0x18009d950  66453bfe         cmp   r15w, r14w                    ; >= 2 prefix bytes received?
0x18009d954  0f8262050000     jb    0x18009debc                   ; no -> wait for more
0x18009d95a  440fb7bff80a0000 movzx r15d, word ptr [rdi + 0xaf8]  ; FullDataSize := the peer's uint16
0x18009d962  664489bff8120000 mov   word ptr [rdi + 0x12f8], r15w ; stored -- NO COMPARISON AT ALL
0x18009d96a  664489a7fa120000 mov   word ptr [rdi + 0x12fa], r12w ; accumulated := 0
```

Both read paths then use it directly as a length, writing at `buffer + accumulated`:

```
plain TCP  (byte ptr [rdi + 0x80] == 0):
0x18009d997  450fb7c7         movzx r8d, r15w                     ; FullDataSize
0x18009d99b  452bc4           sub   r8d, r12d                     ;   - accumulated
0x18009d99e  488d97f80a0000   lea   rdx, [rdi + 0xaf8]
0x18009d9a5  4903d4           add   rdx, r12                      ; dst = buffer + accumulated
0x18009d9ae  ff1524713800     call  qword ptr [rip + 0x387124]    ; WS2_32!recv

TLS        (byte ptr [rdi + 0x80] != 0):
0x18009db04  0fb787fa120000   movzx eax, word ptr [rdi + 0x12fa]  ; accumulated
0x18009db0b  440fb787f8120000 movzx r8d, word ptr [rdi + 0x12f8]  ; FullDataSize
0x18009db13  442bc0           sub   r8d, eax
0x18009db16  488d90f80a0000   lea   rdx, [rax + 0xaf8]
0x18009db1d  4803d7           add   rdx, rdi                      ; dst = buffer + accumulated
0x18009db20  488b8f88000000   mov   rcx, qword ptr [rdi + 0x88]   ; the SSL*
0x18009db27  e8e30b0700       call  0x18010e70f                   ; SSL_read wrapper
```

**There is no comparison of `FullDataSize` against any capacity anywhere in the function.** We
disassembled all 2,422 bytes and enumerated every `cmp`/`test`/`sub`/`and` touching the registers and
offsets involved; the only comparisons are `accumulated` against `FullDataSize` and the prefix-size
check quoted above.

**The buffer's capacity is 0x800 = 2,048 bytes, and that bound is established from both sides rather
than assumed from field adjacency.** The reset routine `0x18009b2e0` writes a field immediately below
the buffer and the fill counter immediately above it:

```
0x18009b42f  89b7f40a0000     mov dword ptr [rdi + 0xaf4], esi    ; field below the buffer
0x18009b435  89b7f8120000     mov dword ptr [rdi + 0x12f8], esi   ; fill counter above it
```

and a sweep over every function of this class found **no field accessed anywhere in the open interval
(0xaf8, 0x12f8)**. Object fields resume at `+0x12f8`, `+0x12fa`, `+0x1300`, `+0x1308`, `+0x130c`,
`+0x1314`.

⇒ `0xaf8 + 65535 = 0x10af7`, roughly 61 KB past the end of an object about 0x1320 bytes long.

## 6.4 The same defect also produces an out-of-bounds read that the relay transmits

The first two things the overflow overwrites are the connection's own length counters — `+0x12f8` sits
at `buffer + 0x800` and `+0x12fa` at `buffer + 0x802`. Both are re-read after the read completes, and
they drive the outbound `sendto`:

```
0x18009dcf2  664403b7fa120000 add   r14w, word ptr [rdi + 0x12fa] ; accumulated += bytes read (16-bit)
0x18009dcfa  664489b7fa120000 mov   word ptr [rdi + 0x12fa], r14w
0x18009dd02  440fb7bff8120000 movzx r15d, word ptr [rdi + 0x12f8] ; FullDataSize, re-read
0x18009dd0e  66453bf7         cmp   r14w, r15w
0x18009dd12  0f82a4010000     jb    0x18009debc                   ; short -> wait
0x18009dd18  66453bf7         cmp   r14w, r15w
0x18009dd1c  0f849c000000     je    0x18009ddbe                   ; exact -> send
...
0x18009ddce  440fb787f8120000 movzx r8d, word ptr [rdi + 0x12f8]  ; sendto length
0x18009ddd6  488d97f80a0000   lea   rdx, [rdi + 0xaf8]            ; sendto buffer
0x18009ddf0  ff15ca6c3800     call  qword ptr [rip + 0x386cca]    ; WS2_32!sendto
```

A frame declaring `0x804` bytes writes 2,048 buffer bytes plus four attacker-chosen bytes landing on
`[+0x12f8]` and `[+0x12fa]`. Setting `[+0x12f8] = L` and `[+0x12fa] = L - 0x804 (mod 2^16)` makes
`r14w == r15w == L`, so the `je` is taken and `sendto` transmits **`L` bytes from a 2,048-byte buffer**
— up to roughly 63.5 KB of adjacent heap.

**Note the correct scoping of this.** Absent the overflow there is no over-read here: the `jb` at
`0x18009dd12` guarantees `accumulated >= FullDataSize`, so the send length is always covered by bytes
that were actually received. The over-read exists **only** as a consequence of the overflow clobbering
the counters. We record it because it is the same defect and the same frame, not as a separate finding.

**RESOLVED — and in the direction that limits the finding. CONFIRMED (disassembled).** The writer of
`[obj+0x1d0]` is in the *other* direction of the relay, `0x18009def0`, and its source is not the
datagram's sender but a configured address held in the same object:

```
0x18009e5e4  lea rdx, [rsi + 0x1a0]      ; a configured sockaddr, family at obj+0xc8
0x18009e5ef  call 0x180112e1e            ;   (2 = AF_INET / 0x17 = AF_INET6, checked @0x18009e832)
0x18009e619  mov dword ptr [rbx + 0x80], ecx   ; obj+0x250 := its length
0x18009e6a8  mov rcx, rbx                ; dst = obj+0x1d0
0x18009e6ab  call 0x180112e1e            ; copy it in
```

The two directions of the relay fix its role: `0x18009def0` does `recvfrom` on the UDP socket
`[obj+0x2ec]` and `send` on the TCP socket `[obj+0x2e4]` (media stack -> hub), while `0x18009d570` does
`recv`/`SSL_read` on the TCP socket and `sendto` on the UDP socket to `obj+0x1d0` (hub -> media stack).
**So `obj+0x1d0` is the client's own media socket, and the out-of-bounds read is delivered locally
rather than to the attacker.**

**This is now MEASURED, not inferred.** A live dump of two connection objects during a call (§6.10)
reads `+0x1d0` = `AF_INET 127.0.0.1:49320` and `127.0.0.1:49318`, with `+0x250` = 16
(`sizeof(sockaddr_in)`). The destination is loopback. We record this because it bounds the finding: **§6.4 is not an
information disclosure to a remote party.** The out-of-bounds write in §6.3 is unaffected.

*(Qualifier: `obj+0x1a0`'s own provenance was not traced further back. It is a configured sockaddr and
the relay direction fixes its role, but we did not find the code that populates it.)*

## 6.4a The overflow lands on an array of seven sibling connection objects — CONFIRMED (disassembled)

The relay handler has **eight call sites, all in one function**, each on a different sub-object of a
single parent, at a constant stride of **0x1320**:

```
0x18009c010  lea rcx, [rbx + 0x60]     0x18009c109  lea rcx, [rbx + 0x4ce0]
0x18009c04c  lea rcx, [rbx + 0x1380]   0x18009c148  lea rcx, [rbx + 0x6000]
0x18009c08b  lea rcx, [rbx + 0x26a0]   0x18009c187  lea rcx, [rbx + 0x7320]
0x18009c0ca  lea rcx, [rbx + 0x39c0]   0x18009c1c7  lea rcx, [rbx + 0x8640]
```

so the connection object is exactly 0x1320 bytes and **eight of them are contiguous in memory**. The
overflow therefore does not run into unknown heap: it runs through seven further connection objects at
fixed, known offsets. Sibling[i+1]'s base sits `0x1320 - 0xaf8 = 0x828` bytes into the write:

| sibling field | what it is | offset into the write |
|---|---|---|
| `+0x58` | a `CRITICAL_SECTION` | 0x880 (2,176) |
| `+0x88` | the `SSL*` | 0x8b0 (2,224) |
| `+0x1d0` | the `sendto` destination `sockaddr_storage` | 0x9f8 (2,552) |
| `+0x250` | its length | 0xa78 (2,680) |
| `+0x2e4` / `+0x2ec` | the TCP and UDP socket handles | 0xb0c / 0xb14 |
| `+0x12f8` / `+0x12fa` | that connection's own length counters | 0x1b20 / 0x1b22 |

**A single frame declaring roughly 0xb20 bytes overwrites the next connection's SSL pointer, both of
its socket handles, and its `sendto` destination and length.** The information-disclosure question
therefore returns by a different route than §6.4: an attacker cannot read through *this* connection's
`sendto`, but can set a *sibling* connection's `sendto` destination to an address of their choosing.

**NOT established:** whether more than one of the eight connections is simultaneously active. If only
one is, the sibling corruption is real but produces no traffic. **Nothing in this subsection was
executed.**

## 6.4b The correct bound already exists in this class, in the sibling read path

The same object holds **two** 0x800-byte buffers, and the other one is bounded by a compile-time
constant:

```
0x18009e334  41b800080000    mov  r8d, 0x800      ; the capacity, as a literal
0x18009e33a  452bc6          sub  r8d, r14d       ;   minus accumulated
0x18009e340  4881c2f4020000  add  rdx, 0x2f4      ;   into obj+0x2f4
0x18009e363  call            WS2_32!recvfrom
```

`obj+0x2f4 + 0x800 = obj+0xaf4`, which is exactly the field the reset routine writes immediately below
the second buffer. **The UDP read path caps at 0x800 with a literal; the TCP/TLS read path takes its
length off the wire with no cap at all.** This both confirms the 2,048-byte capacity independently and
shows the fix is already written elsewhere in the same class.


## 6.5 Attacker position

The peer is whatever terminates the TCP/TLS side of the TLS-UDP proxy connection. The sessions we
observed are TLS (`SSL connection ... established`), and `NPL.dll` validates a configured server
certificate set (`NPLSetServerCertificates`, `NPL 0x1803cdcc0`), so an off-path attacker is excluded on
that arm. That places the attacker in the same position §2 Appendix 2A already establishes for
Findings 2 and 2c: **the media hub, or whoever controls or compromises it.**

The plain-TCP arm (`byte ptr [rdi + 0x80] == 0`, reached at `0x18009d991`) exists in the same function
and carries the identical defect. **We did not establish whether it is reachable without TLS.** Until
that is priced, we are *not* claiming "any network attacker".

## 6.6 Remediation

1. **Bound the frame length at the point it is parsed.** At `NPL 0x18009d95a`, immediately after
   `movzx r15d, word ptr [rdi + 0xaf8]` and before the store at `0x18009d962`, reject or close the
   connection when the value exceeds the buffer capacity. The capacity is a compile-time property of
   the connection object (`0x12f8 - 0xaf8`); it should be a named constant and the check should use it
   rather than a literal.
2. **Clamp at both consumers as defence in depth** — the length operand at `0x18009d99b` (plain TCP)
   and at `0x18009db13` (TLS) should each be `min(FullDataSize - accumulated, capacity - accumulated)`.
   The two arms are twenty instructions apart and neither checks; a fix applied to one only would leave
   the other exploitable.
3. **Do not re-read the length counters from the object after the read.** `0x18009dd02` and
   `0x18009ddce` re-load `[obj+0x12f8]`, which is the field the overflow lands on. Hold the length in a
   register across the read, or place the counters *before* the buffer in the object so an overrun
   cannot reach them.
4. **Validate the send length against the receive accounting**, not against a field that shares an
   object with an attacker-filled buffer: `sendto` at `0x18009ddf0` should use the byte count the read
   path actually accumulated.
5. **General:** the framing parser and the buffer should not share a structure such that a length field
   is addressable by an overrun of the buffer it bounds.

## 6.7 What is NOT established

* **The proof of concept in §6.8 constructs the connection object itself.** The function and the DLL
  are the shipped ones, called by address, and every field displacement is taken from the shipped
  code — but we did not observe a live `WickrPro.exe` object. What is demonstrated is the missing
  bound and the reach of the write, not that the live layout is identical.
* **The §6.4 counter-clobber arithmetic is now observed** (`fill` reads back as payload bytes), but the
  onward consequence — a `sendto` of attacker-chosen length — was not driven to completion.
* **Whether more than one of the eight sibling connections is simultaneously active** — see §6.4a. If
  only one is, the sibling corruption is real but produces no traffic.
* **`obj+0x1a0`'s provenance** — it is the configured sockaddr that becomes the `sendto` destination;
  we fixed its *role* from the relay direction but did not find the code that populates it.
* **Whether the plain-TCP arm is reachable without TLS** — see §6.5. This decides the attacker position.
* **No instruction-pointer control is claimed.** What is established is an out-of-bounds write with
  attacker-chosen content and attacker-chosen length into a live heap adjacent to a connection object.

## 6.8 Proof of concept — executed against the shipped `NPL.dll`

`relayprobe.c` builds the minimum connection object the function requires — two `CRITICAL_SECTION`s at
`+0x30` and `+0x58` (the displacements the shipped code uses, exactly 40 bytes apart), the plain-TCP
flag at `+0x80`, a loopback TCP socket at `+0x2e4`, a UDP socket at `+0x2ec`, both length counters
zeroed — preloads one crafted frame on the socket, and calls `NPL.dll + 0x9d570` by address. The
payload is a position counter (`0x41 + (i & 0xf)`) so every landed byte is attributable to its source
offset. **Nothing contacts Wickr infrastructure and `WickrPro.exe` is not started.**

```
declared 0x7ff   -> fill 0x07ff  accumulated 0x07ff   next object: UNTOUCHED        <-- control
declared 0x800   -> fill 0x0800  accumulated 0x0800   next object: UNTOUCHED        <-- control
declared 0x1000  -> fill 0x4241  accumulated 0x5443   next object modified +0x0..+0x7d7 (2,008 B)
declared 0xffff  -> fill 0x4241  accumulated 0x4442   reach: obj+0x1320 .. obj+0x10af6
                                                             = 63,447 bytes past the object
```

The two controls matter as much as the positive: at exactly the capacity and one byte below it the next
object is untouched **and** the counters hold their legitimate values, so the boundary is observed
precisely where the disassembly places it. At `0xffff` the write passes through all seven sibling
connection objects (7 x 0x1320 = 34,320 bytes) and roughly 29 KB beyond the array. **The function
returned normally in every run; nothing crashed.**

Every field predicted in §6.4a received attacker-chosen bytes:

```
sibling +0x058 CRITICAL_SECTION : 41 42 43 44
sibling +0x088 SSL*             : 4847464544434241
sibling +0x1d0 sendto dest      : 504f4e4d4c4b4a49
sibling +0x250 dest length      : 4c4b4a49
sibling +0x2e4 TCP socket       : 504f4e4d
sibling +0x2ec UDP socket       : 48474645
```

## 6.9 How many connections are live at once — partial

Each of the eight slots is polled and gated on its own TCP socket (`mov edi,[rbx+0x344]`,
`[rbx+0x1664]`, ... then `test edi,edi / jle`), so the array is a pool and the sibling corruption only
produces traffic if a second slot is up. The client's logs show proxy connections coming up **in pairs
seconds apart with no teardown between** (e.g. `08:08:10.478` and `08:08:12.467` in one process, each
followed by its own `SSL connection ... established`). **INFERRED, not measured:** at least two slots
are occupied concurrently during a call.

## 6.10 Live confirmation against a running client — the layout, and the reachability gate

The operator placed a call between their own two accounts with a passive probe attached
(`scratch/w14/relaywatch.c`: two 5-byte detours, stubs that clobber only `rax`/`r10`/`r11`, push
nothing, do two stores into a ring in the target's own memory, and run the displaced instruction
unchanged; the loader polls the ring from outside the process). We did not start the client and did
not place the call; no crafted frame was sent.

**The reachability gate.** With the default configuration the relay read handler `0x18009d570`
executed **zero** times across a full call, even though the client's log showed two TLS-UDP proxy
connections established — because the log also showed `Connection to udp://...: peer replied`, i.e.
UDP won and the proxy sat idle. With **Settings -> Calling -> "Enable TCP Calling" ("Always use TCP
for calls")** turned on, the same handler executed **17,134 times in about 30 seconds**.

> **So F6's vulnerable read path runs only when the client actually uses the TCP transport.** That is
> a one-click user-facing setting, and `forceTcpCall` in the server-supplied network-settings block
> (`0x143255760`, beside `forceOpenAccess` and `censorshipProxyConfig`) appears to be the operator-side
> equivalent. Users on restrictive or censored networks are precisely the population that turns it on.

**The layout, measured against real objects built by the real constructor.** Two connection objects
were live simultaneously:

```
obj0 = 0x800f7b6150      obj1 = 0x800f7b7470      obj1 - obj0 = 0x1320   (exactly the size)
obj0 + 0x1320 == obj1        both dumps are 4,896 = 0x1320 bytes
```

| offset | obj0 | obj1 |
|---|---|---|
| `+0x80` TLS/plain arm | 1 = TLS | 1 = TLS |
| `+0x88` `SSL*` | `0x800d68a898` | `0x800f4305e8` |
| `+0x1d0` sockaddr | AF_INET 127.0.0.1:49320 | AF_INET 127.0.0.1:49318 |
| `+0x250` tolen | 16 | 16 |
| `+0x2e4` / `+0x2ec` sockets | 8564 / 10176 | 11296 / 11272 |
| `+0x2f4 .. +0xaf4` UDP buffer | 1,990 non-zero bytes | 1,987 |
| `+0xaf8 .. +0x12f8` TCP buffer | 2,029 non-zero bytes | 1,943 |

This confirms, in the shipped process: the object size (0x1320), both 0x800 buffers, the length
counters, and above all **that connection objects are allocated contiguously** — so the overflow
described in section 6.4a runs from obj0's TCP buffer into obj1 at a fixed offset, and obj1 really
does hold a live `SSL*` heap pointer at write-offset `0x8b0`. The proof-of-concept's harness
qualifier is removed.

**What this run does NOT establish.** `+0x80` reads 1 on both objects, so the **TLS arm** is what
runs here; the plain-TCP arm was not observed, and the attacker position therefore remains **whoever
terminates the TLS connection (the media hub)**, not any on-path attacker. The buffers adjacent to
the overflow hold cryptographic handshake state (obj0's begins with DER `ecPublicKey` OIDs, obj1's
with a DTLS 1.2 handshake record `16 fe fd`), but no attempt was made to read or exfiltrate it.

## 6.11 The overflow yields an information disclosure to an attacker-chosen address — EXECUTED

The out-of-bounds write of 6.3 reaches four fields of the *next* connection object, and those four
fields are exactly the ones that drive that object's own `sendto`. The sibling then transmits on the
attacker's behalf. **No prior information disclosure is required**, because the destination address is
supplied wholesale by the attacker rather than discovered.

Sibling base offset into the write is `0x1320 - 0xaf8 = 0x828` (the contiguity is measured live,
6.10):

| obj1 field | role in obj1's own `sendto` | offset into the write |
|---|---|---|
| `+0x1d0` | destination `sockaddr` | 0x09f8 |
| `+0x250` | its length | 0x0a78 |
| `+0x2ec` | the UDP socket | 0x0b14 |
| `+0x12f8` | **the `sendto` length** | 0x1b20 |
| `+0x12fa` | accumulated | 0x1b22 |

All of them fit inside one **6,948-byte** frame. The resumed-frame path then reaches `sendto` with no
`recv` and no re-validation -- the flags tested at `0x18009dd1c` are still those set at
`0x18009d980`:

```
0x18009d5a0  movzx r15d, word ptr [rcx+0x12f8]   ; fill      <- attacker-set
0x18009d5bc  jne   0x18009d974                   ; fill != 0 -> resume, no recv on this path
0x18009d978  movzx r12d, word ptr [rdi+0x12fa]   ; acc       <- attacker-set
0x18009d980  cmp   r12w, r15w
0x18009d984  jae   0x18009dd1c                   ; acc >= fill
0x18009dd1c  je    0x18009ddbe                   ; flags still from 0x18009d980
0x18009ddc1  lea   r9,  [rdi+0x1d0]              ; to     <- attacker-set
0x18009ddc8  mov   eax, [rdi+0x250]              ; tolen  <- attacker-set
0x18009ddce  movzx r8d, word ptr [rdi+0x12f8]    ; LENGTH <- attacker-set
0x18009ddd6  lea   rdx, [rdi+0xaf8]              ; from a 0x800 buffer
0x18009ddf0  call  WS2_32!sendto
```

**Executed** (`scratch/w14/leakproof.c`, two objects laid out as the live process lays them out, one
crafted frame over a loopback TCP pair):

```
obj0 0000029B5B800000   obj1 0000029B5B801320   obj1-obj0 = 0x1320
frame: declared 0x1b24 (6948) into a 0x800 buffer
after the overflow, obj1: dest=127.0.0.1:60937  tolen=16  fill=0x4000  acc=0x4000

*** 16384 BYTES ARRIVED AT THE ATTACKER-CHOSEN ADDRESS ***
obj1's buffer is only 2048 bytes -> 14336 bytes are adjacent heap
heap marker found 894 times past the buffer
pointer-shaped value recovered: 0x0000008041416781
```

**What it returns in the live layout.** Using the two object addresses dumped from the running client
(6.10), obj1's buffer starts at `0x800f7b7f68`; a 16 KB read reaches `0x800f7bbf68`, which spans the
next three slots, whose `SSL*` fields sit at `0x800f7b8818`, `0x800f7b9b38` and `0x800f7bae58`. The
live dumps show those fields holding real heap pointers (`0x800d68a898`, `0x800f4305e8`). A larger
length -- up to the UDP datagram ceiling -- reaches past the eight-slot array into general heap.

**Impact.** A client's heap, including live pointers and (per 6.10) TLS/DTLS handshake material
adjacent to the buffer, can be read out to an address of the attacker's choosing, one frame at a
time, from a client that holds the user's key material and message store.

**The same frame also places an attacker-chosen pointer that OpenSSL dereferences -- EXECUTED.** The
overflow reaches obj1's `SSL*` at write offset `0x8b0` with full 8-byte content control, and on the TLS
arm the relay loads and uses it:

```
0x18009d991  jne 0x18009daf2                 ; [obj+0x80] != 0 -> TLS arm
0x18009db20  mov rcx, qword ptr [rdi+0x88]   ; the SSL*  <- attacker-set
0x18009db27  call 0x18010e70f                ; SSL_read wrapper
```

Placing a `PAGE_NOACCESS` address there in the same 6,948-byte frame:

```
obj1 SSL* := 0000008000180000 (guard page)
ACCESS VIOLATION at 00007FF81BDEC13F  (ssl.dll + 0x2c13f)  dereferencing 0000008000180098
                                                            = the chosen pointer + 0x98
```

so the chosen value is used as a structure base inside `ssl.dll`, whose field `+0x98` it then reads.

**What is NOT claimed.** No instruction-pointer control is demonstrated. What is executed is (i) a
disclosure that returns heap pointers and (ii) a fully chosen pointer dereferenced as a structure base
in OpenSSL. **No indirect call was reached, no method table was forged and no fake `SSL` object was
built**; getting from "OpenSSL reads a field of my structure" to "OpenSSL calls a function pointer from
my structure" is a further step that was not attempted. The proof of concept is a local harness using displacements confirmed against
live objects; **the chain has not been run against a live client and no crafted frame has ever been
sent to one.** The attacker position is unchanged from 6.5 -- whoever terminates the TLS side of the
proxy -- and reachability is gated on the TCP transport being in use (6.10).

**Remediation.** The bound in 6.6 item 1 removes this along with the write. Independently, item 3
(do not re-read the length counters from a structure an overrun can reach) and item 4 (validate the
send length against the receive accounting) each break this chain on their own, and the destination
`sockaddr` should likewise not be re-read from a field that shares a structure with an
attacker-filled buffer.

## 6.12 The overflow yields instruction-pointer control via the AWS-LC BIO method table — EXECUTED (harness)

Beyond the write and the disclosure, the overflow reaches a controlled indirect call, demonstrated
end-to-end in a local harness against the shipped `NPL.dll` / `ssl.dll` / `crypto.dll`.

**The sink.** The connection object is not polymorphic (no vptr), and no field of it is used as a call
target. But its `SSL*` at `+0x88` (which the overflow controls) is dereferenced by the relay's TLS
read arm: `0x18009db20 mov rcx,[obj+0x88]; call SSL_read`. AWS-LC's `SSL_read`, when it reads the
transport, calls `BIO_read(ssl->rbio, ...)`, and `crypto.dll!BIO_read` (`0x1800408d0`) makes the
classic method-pointer call:

```
0x18004096c  mov rax, qword ptr [rbx]        ; rax = bio->method
0x180040978  mov r9,  qword ptr [rax + 0x18]  ; r9  = method->bread
0x18004097c  call r9                          ; PC = bio->method->bread
```

**Executed, in stages, each against shipped code:**

* `bioproof.c` — a forged `BIO` makes `BIO_read` transfer control to a marker (the sink).
* `sslconnect.c` — a **real, handshaked** AWS-LC `SSL` with only its `rbio` overwritten drives
  `SSL_read` → `BIO_read` → marker (the SSL genuinely reaches the BIO read).
* `relaydrive.c` — the **shipped relay handler** `0x18009d570`, run on a connection object whose
  `+0x88` is a clone-with-forged-rbio, drives its own TLS arm to that call → marker.
* `oneframe.c` — **one crafted frame**, delivered over TCP to obj0, overflows into the contiguous
  sibling obj1, sets obj1's `+0x88` (the `SSL*`), TLS-arm byte, socket and length fields, and restores
  obj1's `CRITICAL_SECTION` (the leak-and-reuse a real attacker performs); the relay's next run on obj1
  drives to the marker. Result: `rip = 0x0000464646464640`, an instruction fetch at the attacker value.

**CFG is inert (§4.2 / F4b), so the forged indirect call is not blocked** — confirmed by the transfer
completing to a non-code address rather than being rejected.

**What is and is not claimed.** Instruction-pointer control from a single remotely-shaped frame is
executed end-to-end **in a local harness**: the connection objects, the SSL clone and the forged BIO
are placed at harness-local addresses. Live, those addresses come from the disclosure of §6.11 (which
returns heap pointers) and the measured contiguity of §6.10; the code that runs is the shipped relay
and AWS-LC. **No frame has been sent to a live client, and the exploit has not been run against a live
heap. This is therefore not asserted as a demonstrated over-the-wire remote code execution** — the
remaining step is delivery over a live call (a MITM of the TLS-UDP proxy, since the attacker is the
TLS terminator). It is reported as *instruction-pointer control demonstrated in a harness, pending live
delivery*, with every intermediate mechanism executed against the shipped binaries.

**Remediation.** The bound of §6.6 item 1 removes the overflow and with it this entire chain. As
defence in depth, enabling CFG on `WickrPro.exe` (§4.2) would block the forged indirect call even if a
write primitive survived.

---

# SECTION 7 — Bounding negatives: the information-disclosure sweep

We ran a sweep for the return path — *does any byte derived from attacker-supplied input reach an
output the attacker can observe?* — across the media stack. Most of it is negative, and the negatives
are recorded here because they bound the severity of Findings 1, 2 and 4f: each of those is a write
primitive whose escalation would need an address disclosure, and these are the channels where one
would most plausibly have been found.

| Channel | What fills it | Verdict | The instruction or measurement that closes it |
|---|---|---|---|
| `Musigy::AV::Parser` feedback packet — **header**. The `Parser` is a receive-side component that also inherits `PacketSender` (RTTI mdisp 216) and genuinely transmits: `AV.Parser ... Sending feedback packet, event id is 140` appears in the client's logs | It reuses the *same* `Proto::PacketHeader` object the receive path re-parses from the wire (`Parser complete+0x158`) | **NEGATIVE** | `PacketHeader::Clear 0x18013b350` is complete: `movups [rdi+0x40], xmm0` (fields 3–6), `mov [rdi+0x50]` (7, 8), `mov [rdi+0x58]` (10, 11), `mov [rdi+0x60]` (13), `mov [rdi+0x64], 1` (kind), `mov [rdi+0x10], 0` (has-bits). Only `kind`, field 4, 5, 6 and the event id are then set. No received byte survives |
| `Musigy::AV::Parser` feedback packet — **payload** | The packet's payload is the `Frame*` argument handed in by whichever node raised the feedback event | **NEGATIVE** | Census of all 24 emit sites: **18 pass a NULL payload** (`xor r8d, r8d`), 4 are pure forwarders (`PacketSender::onEvent 0x180132cc0`, shared by 24 node classes, and `Muter::onEvent 0x18011a670`), 1 is the terminal itself. The only originator carrying a payload is `NetworkSink::ChannelListener` (`0x180133a20`), a class that appears in **none** of the seven scene graphs the client prints |
| Peer packet metadata echoed back onto the send path. This would matter: `Serializer::onPacket 0x18011d240` writes the outgoing header directly from its input `Frame` (`mov ecx,[r14+0x8c]` @ `0x18011d5b2`) | `Frame::copyMetadata 0x180135d20` copies exactly the peer-metadata block — `+0x8c`, `+0x90`, `+0x98`, `+0x9c`, `+0xa0`, i.e. `PacketHeader` fields 3, 4, 10, 11, 13 | **NEGATIVE** | All **15** call sites have the same shape: destination is a `Frame` created moments earlier in the same function, source is the node's own input `Frame`. Metadata propagates along a scene, never between scenes. The client prints its scene graph at every call start; across 33 logs there are **seven distinct shapes and their node sets are disjoint** — `Parser` only under `NetworkSource`, `Serializer` only under `AudioSource`/`DShowCamCapture`/`NPLSource` |
| The decoder statistics block, which is relevant because a peer can set two of its counters to arbitrary 32-bit values (`add dword [rdi+0x4c8], eax` @ `0x180144197`) | `0x180144410` copies `+0x498…+0x4d3` (0x3c bytes) into a caller-supplied out-parameter | **NEGATIVE** within `NPL.dll` | `0x180144410` is `VpxDecoder` primary vtable slot 15 (`0x180443a30+0x78`). The decoder's own event handler `VpxDecoder::onEvent 0x180144490` dispatches only ids 34/35/36/37 and **never** calls slot 15. The two id-gated `call [rax+0x78]` sites (`0x18012174a`, `0x1801217b3`) belong to `VideoEncoder`/`VpxEncoder`, whose slot 15 is a different function |
| `PacketHeader` **field 7** — the last unclamped field, which reaches an indirect call as an argument (`0x18011ecc3 call qword ptr [rax+0x18]`) | The peer's EVENT id, unclamped at the parse site | **NEGATIVE — this closes the field map at 9 of 9** | The delegate at `Parser+0x118` is `PacketSender+0x40`, zeroed by the `PacketSender` constructor `0x180131fc0`; the call's argument shape `(this, PacketSender* replyTo, int eventId, Frame*)` with `this` at this-offset 112 identifies it as `PacketReceiver::onEvent`. Every implementation — `0x180119cd0` (generic), `0x180121710` (`VideoEncoder`), `0x180144490` (`VpxDecoder`), `0x18012e790` (`SplitterOutputNode`) — compares the id against compile-time constants and otherwise forwards. It is never an index, a map key, an allocation size or a length |

**Coverage, stated so the negatives can be weighed.** The censuses above are `.pdata`-bounded, and
`.pdata` covers 89.83 % of `NPL.dll`'s `.text`. The egress enumeration behind §6 is complete for
`sendto` and `send` (8 call sites, all read) but **incomplete for TLS writes**: `SSL_write` and
`BIO_write` have zero rip-relative references in `NPL.dll` and are reached through OpenSSL's BIO method
tables. The scene-graph disjointness is **measured** over two-party audio and video calls on the
operator's own machines; group calls, screen share and the `Splitter`/`Puller`/`JitterBuffer`/
`PacketQueue`/`NetworkSink` node types were never exercised.
