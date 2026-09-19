# Session prompt — finish the consumer map, then test the ephemerality promise

Paste everything between the rules below.

---

Continue the authorised assessment of **AWS Wickr Desktop 6.72.20.0 (Windows)**.

This session has two scopes, in order. Both are the same shape, and that shape is the one that has
produced every heavy finding in this engagement:

> **Follow a peer-supplied value to its consumer, and ask whether anyone checks it.**

Eleven waves of parser auditing produced a use-after-free that does not reach code execution. The two
heaviest findings came from the sentence above instead — one by reading a branch nobody had read, one
by following a single field out of an enumerated list of nine. **Eight of those nine are still
unfollowed. That is scope 1.**

## Read these first, in this order — the order matters

This engagement has overturned its own conclusions **eleven times**, including three by the lead in
the last four waves. If you read the older documents first you will reason from retracted premises.

1. `E:\tmp\wickr\desktop\notes\NEXT-HUNT-BRIEF.md` — read the **retraction block at the very top**
   first, then the WAVE 10 / WAVE 9 blocks. **§0 (method rules) is mandatory.**
2. `E:\tmp\wickr\desktop\notes\DISCLOSURE-2026-08.md` — the vendor report. §2 and its **§2.10 (F2c)**
   are the worked example of the method you are about to apply. §2 Appendix 2A is the attacker-model
   result that makes these findings relay-reachable, not merely peer-reachable.
3. `E:\tmp\wickr\desktop\notes\W4-COMPLETENESS-CRITIC.md` — **§E2 is scope 1's target list.**
4. As needed: `W6-CRUX-link-a.md`, `W10-CRUX-linkA-triage.md`, `W11-CRUX-backport-and-dump.md`.

Tooling lives in `scratch/w3/lead/`, `scratch/w4/fuzz-vp8/`, `scratch/w6/`, `scratch/w9/`,
`scratch/w10/`. **Look before you rebuild.** `disfunc.py` / `disfunc_pro.py` (per-function
disassembly via `.pdata` extents), `callers.py` / `callers_pro.py`, `class_vtable.py` (MSVC RTTI),
`iatxref.py`, `leaxref.py`, `dataref.py`, `fstr.py` all exist and work. pefile + capstone installed.

---

# SCOPE 1 — finish the `PacketHeader` consumer map

## Why this first

A Wave-4 recon agent enumerated the peer-controlled, unclamped `PacketHeader` metadata int32s and
then wrote, verbatim: *"copied to `Frame+0x8c..+0xa0` … **I did not follow every consumer**."*

Nobody followed them. Last session followed **one** — `+0x98` — and it produced **F2c**: a
peer-supplied value that drives the media key ratchet **before any authentication**, unbounded and
irreversibly, so a single packet permanently wedges the victim's media stream, reachable by a call
peer *or by the relay holding no key material*.

**Eight fields remain.** The method is proven, the targets are enumerated, and the cost per field is
low. This is the highest expected value work available on this target.

## The target list

```
+0x40   +0x44   +0x48   +0x4c   +0x54   +0x58   +0x5c   +0x60      (+0x98 -> DONE, F2c)
```

## What is already CONFIRMED — do not re-derive it

**The descriptor copy.** `NPLAVPacketGetDescriptor` (`NPL 0x1803d0e50`, extent
`0x3d0e50`–`0x3d0f34`, 228 bytes) zeroes the out-descriptor and then copies, verbatim and with no
validation:

```
0x1803d0ee6  418b4218         mov eax, dword ptr [r10 + 0x18]    ; the peer LENGTH  -> desc + 0x00
0x1803d0ef0  498b8280000000   mov rax, qword ptr [r10 + 0x80]    ;                  -> desc + 0x48
0x1803d0efb  418b8288000000   mov eax, dword ptr [r10 + 0x88]    ;                  -> desc + 0x50
0x1803d0f05  418b828c000000   mov eax, dword ptr [r10 + 0x8c]    ;                  -> desc + 0x54
0x1803d0f0f  418b8290000000   mov eax, dword ptr [r10 + 0x90]    ;                  -> desc + 0x58
0x1803d0f19  418b8298000000   mov eax, dword ptr [r10 + 0x98]    ;                  -> desc + 0x5c   <- F2c
0x1803d0f23  418b82a0000000   mov eax, dword ptr [r10 + 0xa0]    ;                  -> desc + 0x60
```
plus a 4-iteration loop copying the plane pointers (`Packet+0x40+8i` → `desc+0x08+8i`), strides
(`+0x60+4i` → `desc+0x28+4i`) and heights (`+0x70+4i` → `desc+0x38+4i`).

**The decrypt callback.** `WickrPro 0x14013f390`–`0x13f4e1`. It fetches the descriptor into a local at
`rbp-0x40` (`0x14013f3ec call qword ptr [rip+0xc1453e]`), so **`[rbp+0x1c]` is `descriptor+0x5c`** —
the frame arithmetic is `rbp = entry_rsp − 0x58`. That value is passed as the **fifth argument** to
the decrypt entry `0x140b250f0` at `0x14013f44e`.

**Other consumers already known, use them as starting points:**
* `Frame+0x18` is the peer-declared length — that is Finding 2.
* **bit 14 of `Frame+0x90`** selects which of exactly two decoder contexts a frame goes to
  (`shr eax,0xe / and al,1` @ `NPL 0x1801447b2`, used as `ctx = [r12 + idx*8 + 0x4a8]` @
  `0x180144b53`). Peer metadata off the wire, and it is what lets one publisher fill both contexts.
* **field 11** is read back inside `VpxDecoder::process` at `NPL 0x180144bc3` and passed to
  `0x180144320` on the decode-failure path. `0x180144320` is a 25-byte flag reset that allocates
  nothing — but the *value* reaching it was never traced.

## What to do, per field

For each of the eight, answer in order and stop early with a documented reason when a constraint
kills it:

1. **Where is it parsed off the wire, and is it clamped there?** The protobuf is protobuf-lite, so
   field *names* are not recoverable — recover field numbers and types from the generated parsers.
   `PacketHeader::_InternalParse` is at `NPL 0x18013b930` (vtable slot `+0x48` of the
   `Proto::PacketHeader` message). Note `kind` **is** validated there — apply §0 rule 5 and read the
   sibling handling of the field next to a validated one.
2. **Where does it land?** `Frame+0x8c..+0xa0`, the descriptor, or somewhere else.
3. **Who reads it?** This is the job. Use `callers.py`, follow indirect dispatch with
   `class_vtable.py`, and do not stop at the first call — the F2c chain was seven hops.
4. **Is it used as a COUNT, INDEX, LENGTH, ALLOCATION SIZE, or as an input to state that persists?**
   The last category is what produced F2c and it is the one people miss. A value that is merely
   *stored* is uninteresting; a value that *advances something irreversible* is a finding.
5. **Does it cross the authentication boundary?** `EVP_DecryptFinal_ex` is at `WickrPro 0x140cb8bb6`
   and its result **is** checked at `0x140cb8bbb`. Anything a peer value drives *before* that point is
   pre-authentication, and — because `PacketHeader` is written after encryption and parsed before
   decryption (§2 Appendix 2A) — also **relay-reachable with no key material**.

## Deliverable for scope 1

A table: field → parse site → clamp or none → every consumer → classification → verdict. A field that
is read and ignored is a perfectly good negative; say so and show the instruction. Any field that
reaches persistent state, an allocation size, or an index gets the full F2c treatment.

---

# SCOPE 2 — does the ephemerality promise hold?

## Why this matters more than it looks

Wickr is sold on ephemeral, end-to-end-encrypted communication. **Nothing in eleven waves has tested
that promise.** And the one instance the engagement stumbled into is a clean failure:

> **F5a — the client writes raw microphone audio to disk, unencrypted, by default, in a shipped
> release build.** `Musigy::AV::WASAPIAudioManager`'s constructor (`NPL 0x18015bb70`) builds
> `aud_in_{before,after}_aec_<pid>_<rate>_<ch>ch.pcm` from the string cluster at
> `0x180446be0`–`0x180446c08`, opens them `"wb"`, and the whole 1363-byte constructor contains **ten
> conditional branches and zero unconditional jumps** — it is ungated. Measured on the operator's own
> machine: 28 files, 477,219,328 bytes, in the application's own install directory, which is
> **user-writable**.

That is one instance of a class nobody has swept. The class is: *what does this product persist, or
fail to destroy, that it promises not to?*

## The questions

1. **Who decides a message's TTL / burn-on-read, and does the receiver verify it?** Is the value
   sender-supplied, receiver-policy, or server-supplied? If a peer or the server can set it, can they
   set it to "never"? Is expiry enforced by the client on a timer, on next launch, or only in the UI?
   **A message that does not burn is a failure of the product's core promise, and it needs no memory
   corruption.**
2. **What survives deletion?** The data directory is
   `C:\Users\mwgn-\AppData\Local\Wickr, LLC\Wickr Pro\`. Known contents: `wickr_db.sqlite` (+`-wal`,
   `-shm`, and a `.wic` sibling), `mls\`, `logs\`, `metrics`, `metricsEventQueue`, `crashpaddb\`,
   `minidump\`, `cache\`, `temp\`, `WOAVendor\`, and the key files `dkc.wic dkd.wic ds.wic skc.wic
   skd.wic`. **The main database IS encrypted at rest** — no SQLite magic, header entropy measured at
   7.999 bits/byte, WAL page payloads carry no schema. Do not re-derive that. But: are decrypted
   attachments, previews, thumbnails or transcoded media written to `cache\` or `temp\` in the clear,
   and are they removed? Does the WAL retain deleted rows?
3. **What do the logs contain?** `%LOCALAPPDATA%\Wickr, LLC\Wickr Pro\logs\*.txt` and `*_npl.txt`.
   The NPL log is known to print the full scene graph at every call start. Does anything log message
   content, attachment names, room names, or participant identifiers? Are logs rotated or bounded?
4. **What does `metricsEventQueue` hold, and where does it go?** It is small and it is a queue, so
   something drains it. Characterise its format and its destination. Note the binary also carries
   `https://beta.astryb.people.aws.dev/api/RequestLogUpload` — an internal-looking endpoint in a
   shipped release build.
5. **Does the mic-PCM writer have any gate at all that an earlier pass missed** — a debug flag, a
   registry value, an environment variable — and are the files ever rotated or deleted? Could they be
   picked up as a crash-report attachment? (`initBugTrackers` at `WickrPro 0x14004c770` passes
   `--attachment=` to `crashpad_handler.exe`.)

**Handle the operator's own data carefully.** Characterise formats, sizes and structure. Do not dump
message content, account identifiers or key material into your notes or into any artifact.

---

## Do NOT re-walk these — closed with evidence

**Memory safety / the RCE question**
* **Link (a), the reclaiming object for the use-after-free.** 37 of 37 reachable clean-slot pointer
  stores taken to a definite verdict, zero survivors, and two adversarial verifiers overturned none.
  The wall is that **not one real pointer at a reachable offset points into memory an attacker can
  spray**. See `W10-CRUX-linkA-triage.md`.
* **The mip-calloc "sweep" escape.** Reach without a reclaimer is real (~290 KB) but **content
  control is lost there** — 0/128, because `vp8_find_near_mvs` reads 78 KB of unknown heap as the
  above row. Reach *or* content control, never both.
* **libvpx multithreaded row decode** is dead code (`threads = 1` at `NPL 0x180144709`).
* **Route A content control** is structurally impossible: to overflow by `K` bytes the attacker must
  *know* `K+29`.
* **The media packet as a reclaim target** — no pointer at any reachable offset.

**Crypto**
* **Nonce/IV management is correct.** The 12-byte IV is generated per invocation by `RAND_bytes`
  (length from the parameter table byte 5 = `0x0c`) with the return value checked. It is not a
  counter, so there is no reset-on-reconnect hazard.
* **The ratchet gate is monotonic forward-only** — `cmp r9,[rcx+0xc8] / jbe` at
  `WickrPro 0x140cb6825`/`0x140cb682c`. No rewind. (Its *unbounded forward* jump is F2c — that part is
  open only as a fix, not as a question.)
* **No cipher downgrade** — the wire algorithm byte must equal the algorithm in the key object.
* **The AEAD is AES-256-GCM** and `EVP_DecryptFinal_ex` **is** checked.

**Everything else**
* **MLS authorization** — MLS does membership authorization by protocol design and the ingest →
  decode → verify path is Rust. Deprioritised deliberately.
* **`--disable-web-security` does not reach the renderer** — `initializeCommandLine` reduces the
  argument list to the program name at `Qt6WebEngineCore 0x180300d7c`; `--webEngineArgs` exists in
  exactly one file tree-wide; `QTWEBENGINE_CHROMIUM_FLAGS` is `qunsetenv`'d. Remote debugging is off.
* **CVE-2023-4863** is fixed in **both** libwebp copies, verified by disassembly.
* **NPL's vendored libjpeg-turbo is fed by the local camera only**, gated at
  `NPL 0x180125964`/`0x180125967`.
* **The message database is encrypted at rest.**
* **The crash-upload endpoint is hardcoded** — an attacker cannot redirect it.
* **A peer-selectable VP9 decoder does not exist** (`--disable-vp9`; the factory discards the flag).
* Attachments/files/links, deep links and QWebChannel — negative at instruction level in earlier waves.
* **The docx-preview XSS × native bridge is OUT OF SCOPE** — already reported by the operator. The
  image and PDF preview paths ARE in scope, and remote bytes are CONFIRMED to reach a `format = NULL`
  decode in the unsandboxed main process.

---

## Method rules this engagement has paid for

1. **Disassemble the decisive instruction yourself.** Quote the address *and* the bytes. The most
   expensive error in this engagement was reading a `call` as unconditional without reading the branch
   that dominates it — the update channel was recorded as fail-closed for four waves and it is not.
2. **Check you are testing the right invariant.**
3. **A string comparison is not a code path**, and a string's *presence* is not a fix's presence.
4. **State which observation would distinguish the hypotheses before you measure.**
5. **Asymmetry inside one function is the highest-yield pattern on this target.** When you find a
   validated field, read the unvalidated one beside it.
6. **`.pdata`-bounded per-function disassembly, never a linear `.text` sweep** — but state your blind
   spot: `.pdata` covers **89.83 %** of NPL's `.text`, **93.66 %** of WickrPro's, 93.82 % of Sock5's.
   Note also that **33.5 % of NPL's `.pdata` records are chained secondary chunks** whose
   `BeginAddress` is not a function start; two separate sweeps in this engagement produced false
   negatives by treating records as functions.
7. **Measure and report your own coverage.** Three agents here reported confident negatives that a
   verifier traced to a bug in their own tooling. Publish your intermediate data so the next person
   can find *your* bug in ten minutes.
8. **Do not screen where the answer matters.** A keyword grep over your own notes is not a substitute
   for reading them; the lead did this four times and it produced a false negative every time.

## Reporting discipline

* Label every claim **CONFIRMED** (disassembled or measured — say which), **INFERRED**, **REFUTED**,
  or **UNDETERMINED**. "UNDETERMINED, and here is exactly what I could not establish" is a first-class
  result.
* Any condition supplied by a harness is a **qualifier that travels with the result**.
* **Do not write "RCE."** Eleven waves have not produced control of the instruction pointer from a
  remotely deliverable input.
* **Negatives are deliverables.** A field that is parsed and ignored, closed with the instruction that
  ignores it, is worth as much here as a finding.
* Anything you confirm that belongs in the vendor report goes into `DISCLOSURE-2026-08.md` in the
  house style — labels next to claims, qualifiers repeated, remediation naming the function and field.

## Rules of engagement

Operator-owned accounts and machines only. No calls to unwitting parties. No traffic to Wickr
production infrastructure or any third party. No fuzzing against Wickr servers — harness the local
parsers instead. Benign proofs of concept only. **Do not launch `WickrPro.exe`** unless you have
explicitly agreed it with the operator first, and never place a call from it.

## What to produce first

Before any new reverse engineering:

1. **The parse sites for all eight remaining fields**, with the clamp or its absence quoted — that is
   one pass over `PacketHeader::_InternalParse` at `NPL 0x18013b930` and tells you immediately which
   fields are worth chasing.
2. **A one-paragraph statement, for the field you intend to chase first, of what observation would
   distinguish "reaches persistent state" from "read and discarded"** — before you go looking.
3. For scope 2: **where the TTL / burn-on-read value comes from**, stated as a chain of addresses, or
   an honest "I could not find it and here is where I looked."
