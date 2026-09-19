# Session prompt — find the leak. It is the only thing left that unlocks everything else.

Paste everything between the rules below.

---

Continue the authorised assessment of **AWS Wickr Desktop 6.72.20.0 (Windows)**.

Fourteen waves have produced **six distinct memory-corruption write primitives** against this product.
Two were demonstrated live. **Not one has produced control of the instruction pointer, and the reason has
been the same every single time.**

| primitive | write | why it stops |
|---|---|---|
| F1 libvpx UAF | byte-exact, **content-controlled**, demonstrated over a live call | no reclaiming object (38/38 killed); and it does not fire on a stock host |
| F2 `memset` OOB | reachable with no preconditions, demonstrated | writes **zeros** by construction |
| **F4f / CVE-2026-2648** | **256 OOB stores executed on the shipped PDFium**, offsets to +6128 | values are **zero-extended 32-bit** — a pointer cannot be placed |
| CVE-2026-4455 | **byte-granular content control** (0x00/0xFF per bit) — the best found | precondition `FT_PIXEL_MODE_MONO` never reached |
| lcms / libtiff / PS renderer | — | not reachable in this build configuration |
| F4a update channel | actual code execution | needs AWS's own S3 bucket or a rogue CA |

**The write side is solved, repeatedly. The wall is that the attacker is blind:** high-entropy ASLR, and
a delivery model — send a file or a packet, observe nothing — with no channel back. Every closed negative
in this engagement has "no leak" in its death certificate:

* link (a): an info leak takes the candidate set from **52 to 1,720–3,831 (33–74×)** — measured in W13,
  because the clean-slot lattice exists *only* to preserve the high 32 bits of a pointer you cannot read.
* Route A: dies on blind targeting against a **measured 0.07 %** pointer density.
* The mip-calloc escape: reach without content control, 0/128.
* F4f: offsets are choosable but the value cannot be a pointer.

**Wave 4 proposed the sweep that would change all of this at once — "sweep the send paths for anything
that echoes bytes derived from received packets" — and fourteen waves later it has still never been run.**
That is scope 1. It is the highest-expected-value work available on this target, and it is the only work
that improves every other route simultaneously.

## Read these first, in this order — the order matters

This engagement has overturned its own conclusions **twelve times**, including four self-corrections in
the last wave alone. If you read the older documents first you will reason from retracted premises.

1. `E:\tmp\wickr\desktop\notes\NEXT-HUNT-BRIEF.md` — the **retraction block at the very top** first, then
   the **WAVE 13 block including its F4f section**, then WAVE 10. **§0 (method rules) is mandatory.**
2. `E:\tmp\wickr\desktop\notes\W13-CRUX-consumer-map-and-ephemerality.md` — **both addenda**, and in
   particular its closing "Corrections made during this work" list. Every one of those was nearly
   published as a finding.
3. `E:\tmp\wickr\desktop\notes\W13-ENGAGEMENT-MAP.md` — the complete found / closed-with-evidence /
   never-searched inventory. **§3.1 is scope 1's brief and §3.6 lists the surfaces nobody has entered.**
4. `E:\tmp\wickr\desktop\notes\DISCLOSURE-2026-08.md` — the vendor report. §2.10 (F2c) and §4.5's F4f
   subsection are the two worked examples of the method that has produced everything.

Tooling lives in `scratch/w3/lead/`, `scratch/w4/fuzz-vp8/`, `scratch/w6/`, `scratch/w9/`, `scratch/w10/`,
`scratch/w13/`. **Look before you rebuild.** In `scratch/w13/` specifically: `fn.py` (per-function
disassembly that resolves a function START from any address inside it **and folds chained `.pdata`
secondary chunks**), `offscan.py` / `sigscan.py` (struct-offset access census), `xref.py`, `strs.py`,
`rd.py`, `walkfix.py` (walks a pdfium release branch through gitiles' per-commit JSON), plus working
harnesses `imgbatch.c`, `jpxprobe.c`, `pmprobe.c`, `aaprobe.c`. pefile + capstone installed; MSVC
BuildTools at `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\`.

---

# SCOPE 1 — find an information-disclosure channel

## The question, stated precisely

**Does any byte derived from attacker-supplied input reach an output the attacker can observe?**

Not "does the victim's process read out of bounds" — W4 already found over-reads and they were all
consumed locally. The question is about the **return path**. A leak of one heap pointer converts four
separate dead ends into live ones.

## What counts as observable

Rank candidates by whether the *attacker* sees the result, not the victim:

* **media the victim transmits** — audio and video the victim sends back on the call
* **any control or feedback packet on the media transport** — the relay and the peer both see these
* **retransmission / FEC** — `Musigy::NPL::Net::XorFecDecoder` **retains peer packets**, and FEC recovery
  XORs them; anything it emits is attacker-visible
* **timing and liveness oracles** — slow, but a one-bit oracle repeated is still a leak
* **NOT** the rendered preview, the victim's screen, the local logs, or the crash-report upload — those
  go to the victim or to a hardcoded endpoint, not to the attacker. Say so and move on.

## What W13 already established — start here, do not redo it

* **NPL's 16 statistics exports are host-facing only.** `NPLConnectionStatistics{GetBytesReceived,
  GetBytesSent,GetTotalBytesLost,GetTotalBytesInTheAir,…}`, `NPLConnectionStatGet{Current,Global}`,
  `NPLHubVideoStat{EnterScopeWithCallback,EnterScopeWithFile,IsActive,LeaveScope}` — WickrPro reads them;
  they do not go to the network. **Partial negative, recorded.**
* **`0x180144410` — the `VpxDecoder` statistics-block getter — has NO direct callers.** It is a vtable
  slot (the vtable is at `0x180443aa8`; `VpxDecoder::process 0x180144520` sits +24 from it). It copies
  `+0x498…+0x4c7` with three `movups`, `+0x4c8` with a `movsd` and `+0x4d0` with a `mov`, into a 0x3c-byte
  output struct. **Its consumer is unidentified — find it.** The block includes the two counters that
  `0x180144130` poisons with an attacker-chosen 32-bit delta (`add [rdi+0x4c8], eax` @ `0x180144197`,
  `add [rdi+0x4bc], eax` @ `0x180144239`), so if this reaches the wire it is a leak *and* a poisoning
  channel.
* **★ `Musigy::AV::Parser` — a receive-side component — emits `kind == 3` EVENT packets.**
  `0x18011f970` (a Parser vtable method) builds a `PacketHeader` with `kind = 3`, field 4 = `0x80`,
  fields 5/6 = 0, **field 7 = the event id (an argument)**, and then attaches a sub-message sourced from
  **`Parser+0x88`** (`lea r15,[rsi+0x88]` @ `0x18011fa24`, `call 0x180109560` @ `0x18011fa35`).
  Most of that 877-byte function (`0x18011faa2`–`0x18011fc19`) is **logging**, not network — do not be
  misled by it as I nearly was. **What fills `Parser+0x88` is the open question, and it is the single most
  promising lead in this scope.** There is a second emitter at `0x18011de20`.

## How to run the sweep

1. **Enumerate the send path's data sources.** The send scene ends `… → VpxEncoder → CryptProxy →
   Serializer`. The kind==2 serializer is `NPL 0x18011d240` and it reads a `Frame`'s fields —
   `Frame+0x8c/0x90/0x94/0x98/0x9c/0xa0` and `Frame+0x18`. **Ask, for each: can a Frame on the SEND path
   ever hold a value copied from a RECEIVED Frame?** The `Frame` field copy is `0x180135d20`; find every
   caller and classify source and destination. `OpusDecoder` already calls it at `0x1801490ac` (received →
   decoded-PCM frame), which is a receive→local path; the question is whether any call is receive→send.
2. **Chase `Parser+0x88`** to whatever fills it.
3. **Identify `0x180144410`'s caller** through its vtable slot, then follow it to a sink.
4. **Read `XorFecDecoder`'s emit path.** It retains peer packets by design; the packet pool
   (`0x1800e0490`) allocates `[0x120 hdr][0x40 headroom][payload]` as one block. Anything it re-emits
   carries whatever is in that block.
5. **Only then** consider the harder question of whether an over-read's *product* can be steered into any
   of the above.

## Deliverable for scope 1

A table: candidate channel → what fills it → is it attacker-observable → verdict, with the instruction
that closes each negative. **A well-closed negative is a first-class result here** — "the send path cannot
carry received bytes, and here is the copy-site census that proves it" would let the next person stop
looking and would settle the exploitability question for F1, F4f and Route A at once.

---

# SCOPE 2 — two bounded items, only if scope 1 stalls

**(a) `PacketHeader` field 7 — the last unfollowed field.** The kind==3 EVENT id reaches an indirect call
unclamped as argument 3: `0x18011ec8d mov r14d,[r14+0x50]` → `0x18011eca7 mov rcx,[rsi+0x118]` →
`0x18011ecb9 mov r8d,r14d` → **`0x18011ecc3 call qword [rax+0x18]`**. The class at `Parser+0x118` was not
identified; a sweep for `mov qword [reg+0x118], reg` over `0x180118000`–`0x180140000` found **zero**
stores, so it is installed from outside that range. **One function identification decides it.** Note this
overlaps scope 1 — the same EVENT machinery is on both sides.

**(b) CVE-2026-4455's precondition.** This has the **best content control of any primitive found** — the
written bytes are 0x00 or 0xFF chosen per bit by an embedded font's glyph bitmap. The defective code is
present (`Qt6Pdf 0x1801a686f cmove r13d, eax`), the destination is an 8bpp mask, and `anti_alias == kLcd`
was **measured at 18,513 of 18,521** glyph renders. The only missing condition is
`bitmap.pixel_mode == FT_PIXEL_MODE_MONO`, observed **0 times in 18,521 renders**, with
`FT_LOAD_NO_BITMAP | FT_LOAD_PEDANTIC` in the load flags closing the obvious route. **The question is a
FreeType one: under LCD rendering with NO_BITMAP set, can any font make `FT_Render_Glyph` leave a MONO
bitmap in the slot?** If yes, you have a controlled-content overflow on the preview path.
`scratch/w13/pmprobe.c` already measures this — point it at new inputs.

---

# What is already CONFIRMED — do not re-derive any of it

**F4f (new, and the strongest demonstrated result).** One 6,397-byte PDF holding a single `/JPXDecode`
image drove **256 out-of-bounds heap stores** in the shipped `Qt6Pdf.dll` — offsets +8 … **+6128 past a
24-byte allocation** — through WickrPro's exact call `QImage::loadFromData(bytes, format = NULL)`.
**No crash: it corrupts and returns success.** This is CVE-2026-2648 (`Bug: 477033835`), missing bounds
and NULL checks in `opj_j2k_read_sod` (`Qt6Pdf 0x18025c540`; stores at `0x18025c6d6` / `0x18025c6f5`).
PoC and generator in `scratch/w13/jpx3/`. **Severity limit that travels with it: both stores write
zero-extended 32-bit values, so no pointer can be placed — what lies at those offsets was never surveyed.**

**Qt6Pdf is a *stripped* PDFium, and that is a structural ceiling on the n-day strategy.** Measured with
`Qt6WebEngineCore.dll` as the control: **no V8, no XFA, no form-fill, no `/ICCBased`, no `DeviceN`, no
`OutputIntent`, no libtiff.** Three of the four heap-overflow CVEs die on build configuration, not on
effort. **Do not go hunting more PDFium CVEs expecting them to land.**

**The delivery chain, executed:** `%PDF-` bytes → Qt's content sniffer → `imageformats\qpdf.dll` →
`Qt6Pdf.dll` → PDFium → a `QImage`, on the shipped binaries. `Qt6Pdf.dll` and `qpdf.dll` are dated
**2025-09-17** while `WickrPro.exe` is dated 2026-07-13.

**The `PacketHeader` map is finished.** Ten int32s; **`kind` is the only field validated at the parse
site** (`0x18013ba51`–`0x18013ba5e`); nine siblings get no comparison at all. Eight of nine taken to a
verdict — fields 5, 6 and 8 are write-only or dead wire fields; 3 and 13 are stored and logged; 4's only
consequence is the already-reported bit-14 decoder-context selector; 11 is non-monotonic and its
decode-failure sink is masked (`0x180144323 and r8d, 3`). **Only field 7 is open.** `Packet` (the NPL C
API) **is** `Musigy::AV::Frame`. **F2c's field is `PacketHeader+0x58` = protobuf field 10, not `+0x98`.**

**WickrPro's total view of a received packet is bounded.** 230 NPL exports contain exactly two packet
accessors, and the 337-byte decrypt callback `WickrPro 0x14013f390` reads the descriptor **once**, at
`0x14013f438` (`desc+0x5c`). Descriptor offsets `+0x48/0x50/0x54/0x58/0x60` are populated and never read.

**Ephemerality (scope 2 of W13).** Attachments in `temp\`, both SQLite databases and their previews are
**encrypted**; no message content, attachment name or user handle appears in any log. But **logs keep
1,613 `msgID` / 134 `vGroupID` / 2,273 UUIDs in cleartext and are never rotated** (F5c), and
`metricsEventQueue` is **plaintext protobuf holding a 20-character identifier** (F5d). The expiry reaper
is `queryDeleteExpiredMessages 0x1408f3e40` with exactly two callers. **UNSETTLED:** where the *receiver*
computes `Wickr_Message.destructTime`, and therefore whether an inbound or room-changed TTL is
re-validated — start at `WickrSecureRoomMgr::changeTTL` (`0x143260610`).

---

# Do NOT re-walk these — closed with evidence

* **Link (a), the reclaiming object** — 38 candidates to a definite verdict, zero survivors, two
  adversarial verifiers overturned none. **But note W13's re-analysis: the binding constraint is the
  clean-slot lattice (3.32 % density), not the absence of pointers, and the 38 are a 1.4 % sample of the
  pointer stores in the right offset range. The negative is real but it is an extrapolation.**
* The mip-calloc escape (reach **or** content control, never both); libvpx MT decode (dead code);
  Route A content control (structurally impossible); the media packet as a reclaim target.
* **The audio/Opus leg** — H1 and H2 refuted by disassembly *and* guard-page measurement.
* **Crypto** — AES-256-GCM with `EVP_DecryptFinal_ex` checked; per-invocation `RAND_bytes` IV; ratchet
  monotonic; no cipher downgrade.
* **`--disable-web-security` does not reach the renderer**; certificate pinning off is not a bypass;
  CVE-2023-4863 fixed in both libwebp copies; NPL's libjpeg-turbo is camera-fed only.
* **The three PDFium CVEs listed above as unreachable**, each with a measured reason.
* The docx-preview XSS is **out of scope** (already reported by the operator).

---

# Method rules this engagement has paid for

1. **Disassemble the decisive instruction yourself.** Quote the address *and* the bytes. The most
   expensive error here was reading a `call` as unconditional without reading its dominator.
2. **Check you are testing the right invariant.**
3. **A string comparison is not a code path**, and a string's presence is not a fix's presence.
4. **State which observation would distinguish the hypotheses before you measure.**
5. **Asymmetry inside one function is the highest-yield pattern on this target.**
6. **`.pdata`-bounded per-function disassembly, never a linear sweep** — and state your blind spot:
   `.pdata` covers **89.83 %** of NPL's `.text`, 93.66 % of WickrPro's. **33.5 % of NPL's `.pdata`
   records are chained secondary chunks whose `BeginAddress` is not a function start**; `fn.py` folds
   them, `disfunc.py` does not.
7. **Measure and report your own coverage. Assume your tooling is lying to you until you check.**
   Four separate confident negatives in this engagement were traced to bugs in the reporter's own tools.
   **W13's own worst example: an in-process fuzzer logged 130,031 iterations and 0 crashes; its real
   coverage was 3,428, because its exception handler skipped the destructors and leaked the input buffer
   on every exception — after the first genuine OOM every later iteration failed at its first allocation
   and exercised no codec at all.** If a rate suddenly goes to ~100 %, that is your bug, not a result.
8. **Do not screen where the answer matters.** A keyword grep over your own notes is not a substitute for
   reading them.
9. **NEW — an absent string is not an absent feature.** W13 concluded lcms profile parsing was compiled
   out because `acsp` did not appear as a string; it is an **immediate** (`cmp edx, 0x61637370`). Search
   for constants as instruction operands as well as bytes.
10. **NEW — measure reachability before you build the payload.** W13 nearly hand-built a 5-channel ICC
    profile before checking whether `/ICCBased` is handled at all. It is not. One `grep` with a control
    binary saved the whole effort. **Ask "can this input even arrive?" first.**
11. **NEW — use a control.** An absence only means something if the same probe finds the thing somewhere
    it should be. `Qt6WebEngineCore.dll` is the control for anything PDFium.

---

# Reporting discipline

* Label every claim **CONFIRMED** (disassembled or measured — say which), **INFERRED**, **REFUTED** or
  **UNDETERMINED**. "UNDETERMINED, and here is exactly what I could not establish" is a first-class result.
* Any condition supplied by a harness is a **qualifier that travels with the result**.
* **Do not write "RCE."** Fourteen waves and six write primitives have not produced control of the
  instruction pointer from a remotely deliverable input. If you find the leak, that changes the *odds*,
  not the claim — the claim still needs IP control.
* **Negatives are deliverables**, and in this scope a well-closed negative is worth more than a weak
  positive: it settles the exploitability question for four separate findings at once.
* Anything you confirm that belongs in the vendor report goes into `DISCLOSURE-2026-08.md` in the house
  style — labels next to claims, qualifiers repeated, remediation naming the function and field.

---

# Rules of engagement

Operator-owned accounts and machines only. No calls to unwitting parties. No traffic to Wickr production
infrastructure or any third party. **Public information — CVE databases, vendor advisories, upstream source
and git history — is in scope**, and an n-day at least 60 days past public disclosure may be worked on.
No fuzzing against Wickr servers — harness the local parsers instead. Benign proofs of concept only.
**Do not launch `WickrPro.exe`** unless you have explicitly agreed it with the operator first, and never
place a call from it.

---

# What to produce first

Before any new reverse engineering:

1. **A one-paragraph statement of what observation would distinguish "a received byte reaches an
   attacker-visible output" from "every over-read is consumed locally"** — for the specific channel you
   intend to check first. Write it down before you look.
2. **The census of `0x180135d20`'s callers** (the `Frame` field copy), classified source → destination.
   That is one pass and it either finds a receive→send edge or produces the strongest negative available
   in this scope.
3. **What fills `Parser+0x88`.** This is the payload of an EVENT packet that a receive-side component
   transmits, and it is the single most promising lead. State the answer as a chain of addresses, or an
   honest "I could not find it and here is where I looked."
