# Wave 4 — completeness critique (independent pass)

Run 2026-07-31 to close the process gap `FINAL-REPORT-wave4.md` names in its own last line:
*"this report has had no independent completeness review — a gap that should be closed before anything
here is sent to a vendor."*

**Method.** I read `FINAL-REPORT-wave4.md`, both crux files, and then went behind them to the primary
evidence: all 16 structured agent results in `scratch/w4/_journal_dump/` (7 recon dimensions, 9
verdicts). Every gap below is a delta between what an agent actually established and what the report
says — not a re-derivation and not a new hypothesis. Each item cites the journal file it came from so
it can be checked in one command.

**One-line verdict.** The report's *findings* are sound; nothing here refutes F4-1 or F4-2. But the
report is **not complete**, in three distinct ways: it **understates two severities** on evidence that
is already measured and sitting in the journal, it presents **two headline negatives as stronger than
their authors did**, and it **drops two reportable defects** its own agents handed up. Separately, its
provenance note under-declares: it names three findings as un-re-read, but **seven of seventeen
candidates were never independently verified at all**, including both third-party findings and both of
the headline refutations.

---

## A. Verification coverage — what is actually verifier-dependent

The report's honesty note says the lead has not re-read **F4-2, F4-4, F4-6, F4-7**. That is true and
insufficient. The stronger statement is which claims had **no second pair of eyes at all**.

17 candidates were produced across the 7 recon dimensions; 9 verdicts were produced. Mapping them:

| Candidate (recon) | Independent verdict? | Where it lands in the report |
|---|---|---|
| `buffer-size-substitution` | ✅ CONFIRMED | F4-1 |
| `buffer-size-unvalidated-vpx-datasz` | ✅ PLAUSIBLE | F4-1 (second, independent origin) |
| `wire-grammar-parsed-before-decrypt` | ✅ CONFIRMED | F4-1 "Amplifier" section |
| `vp8-mi-uaf-after-alloc-failure` / `vp8-mi-dangling-on-alloc-fail` | ✅ CONFIRMED | F4-2 |
| `vp8-mi-uaf-alloc-fail` | ✅ PLAUSIBLE | F4-2 |
| `vp8-huge-dim-alloc-amplifier` | ✅ CONFIRMED | F4-3 |
| `vp8-commit-amplification-2gib` | ✅ CONFIRMED | F4-3 |
| `vp8-decoded-key-frame-not-reset-on-resize` | ✅ CONFIRMED | F4-4 |
| `raw-plane-bound-check-imul32` | ✅ PLAUSIBLE | F4-5 |
| **`winsparkle-expat-229-unpinned-https`** | ❌ **none** | **F4-6, reported as CONFIRMED** |
| **`sock5-loaded-mbedtls215-dormant`** | ❌ **none** | **F4-7, reported as "CONFIRMED both halves"** |
| **`fence-table-heap-corruption`** | ❌ **none** | **Refuted table — kills 3 heap-corruption crashes** |
| **`f1-odd-height-via-odd-camera-mode`** | ❌ **none** | **Refuted table — kills the wave-3 #2 lead** |
| `arc-aspect-crop-unrounded-division` | ❌ none | folded into the F1 row |
| `ladder-truncating-halve-not-on-f1-path` | ❌ none | folded into the F1 row |
| **`cryptproxy-forwards-on-decrypt-failure`** | ❌ **none** | **absent from the report entirely — see B1** |

**10 verified / 7 not.** Three consequences the report does not state:

**A1 — F4-6 and F4-7 are single-source.** Both come from one recon dimension
(`recon_third_party_transport…`) and were never sent to a verifier. The report labels F4-6 "CONFIRMED"
and F4-7 "CONFIRMED both halves" with no qualifier distinguishing them from F4-1, whose every link was
re-read by the lead, or F4-2, which survived a verifier that "went in to kill this and could not."

**A2 — both headline *negatives* are unverified, and one is a self-refutation.**
`fence-table-heap-corruption` is the fuzzing agent declaring that the three `STATUS_HEAP_CORRUPTION`
crashes **its own harness** produced were **its own harness's fault**. That may well be right — the
measurement (65541 allocations served at the crashing iteration, TBLN=65536) is concrete. But it is
the one claim in the wave where the author had a motive and nobody checked it, and if it is wrong
there are three real heap-corruption crashes in the shipped VP8 decoder being thrown away. The F1
refutation is likewise single-source, and its own author calls it "refuted **by accident**, not by any
guard," notes `WickrPro was not running during this pass`, and leaves the residual (a device
advertising an odd height below the request) live-untested.

**A3 — the most-disputed fact in the engagement is verifier-dependent and is not flagged as such.**
"Parser runs **before** CryptProxy" is the load-bearing premise of F4-1 and the thing two prior
analyses got backwards. The report upgrades it beyond the log line — *"CONFIRMED (re-derived from
`Scene::append 0x180116140` interface queries, not from the log line)"* — but that re-derivation is
the **verifier's** work (`verdict_wire-grammar-parsed-before-decrypt.json`, the only journal file where
`0x180116140` appears). The lead did not re-read it, and the provenance note does not list it. Given
this engagement's history on exactly this question, that is the wrong claim to leave unattributed.

---

## B. Dropped findings — agents handed these up and the report does not contain them

**B1 — `CryptProxy` forwards the packet when decryption fails (fail-open).**
Source: `recon_NPL_dll_bespoke_Serializer…json`, candidate 3 of 3, verbatim: *"Musigy::AV::CryptProxy::onPacket
calls the host-supplied decrypt callback and never tests its result; failure only logs."* The same agent
calls it *"the link that makes buffer-size-substitution reach libvpx."* Confirmed independently in
`verdict_buffer-size-unvalidated-vpx-datasz.json` (*"CryptProxy never drops on decrypt failure —
0x18011b752 only logs"*).

`grep -c "cryptproxy-forwards\|discards the decrypt\|forwards the packet" FINAL-REPORT-wave4.md` → **0**.
It is in neither the findings nor the refuted table nor the negatives. It is a missing fail-closed
control on a peer-fed path, it is *why* a garbage-decrypting frame still reaches a C decoder, and it is
**also missing from the F4-1 remediation**, which lists parser bound-check + callback-length + AAD but
not "drop the packet when decrypt fails."

**B2 — the decoder-reset-on-format-change is dead code.**
Source: `verdict_vp8-decoded-key-frame-not-reset-on-resize.json`, closing paragraph, explicitly
addressed to the lead: *"Also worth handing to the lead as a separate item: the wrapper's
decoder-reset-on-format-change is dead code (`0x18014406a` sets `this+0x4b9 = 1` and then `0x180145b60
-> 0x180122610` overwrites the cached format that `0x180144627/0x180144634/0x180144641` compares
against). That dead reset is what keeps a single `vpx_codec_ctx_t` alive across every resolution change
for the whole call, and it is the precondition for this bug and for any future decoder-state bug in the
same region."*

`grep -c "0x4b9" FINAL-REPORT-wave4.md` → **0**. This is a defect in Wickr's own code (an intended
safety mechanism that does not execute), it is the structural precondition shared by **F4-2 and F4-4**,
and it is exactly what the F4-2 remediation is groping at when it says *"additionally tear down and
re-create the decoder context on any `vpx_codec_decode` failure — currently the context is never
destroyed."* The report describes the symptom and drops the located cause. It should be **F4-8**.

---

## C. Severity understated — measured evidence in the journal, absent from the report

**C1 — F4-2's blast radius is understated by three to five orders of magnitude.**
The report gives one number: *"a fresh same-size allocation that reclaimed the address had **144 bytes**
overwritten starting exactly at `mi`."* That is the `uaf_extent.py 400` run, where the allocation fails
at the **first yv12 buffer** — i.e. *before* `mb_rows`/`mb_cols` are updated, so the stale geometry is
4×4 and the write is tiny.

The verifier also ran `uaf_extent.py 1600`, where the failure lands on the **`mip` calloc** — *after*
the attacker's 16383×16383 geometry is committed. Pasted from
`verdict_vp8-mi-uaf-after-alloc-failure.json`, evidence §11:

```
pc.W=16383 pc.H=16383 mb_rows=1024 mb_cols=1024 stride=1025
vp8_decode_mode_mvs would write ~79769600 bytes (76.1 MB) starting at mi
freed block holding mi is 1900 B, mi sits 456 B into it => OOB PAST THE FREED BLOCK
[p3] inter -> FAULTED: av writing 0x8000E1C039 = 34,513 bytes past mi   (~33 KB past a 1,900-byte block)
     second run: 0x50C55 = 330,325 B past mi
```

`grep -c "76.1\|79769600\|34,513\|330,325" FINAL-REPORT-wave4.md` → **0**. Which of the two regimes
occurs is **selected by the attacker**, by choosing a resolution relative to the victim's headroom, and
both PLAUSIBLE-verdict authors said so — *"force the failure to land on the mip calloc rather than the
first yv12 buffer (cap between ~1650 and ~2010 MiB) and confirm the escalated ~76 MB linear overwrite,
since that changes the severity of this candidate by two orders of magnitude."* The report reports the
weak regime as if it were the finding.

Related and also absent: the faulting instruction in that run is `0x1801bef44 mov byte ptr [rdi+9], al`
inside **`0x1801beea0` = `read_mb_modes`** — the function the static-audit agent explicitly says it
never disassembled (see D2). The confirmed crash lands in the unaudited region.

**C2 — ~~F4-1 may be a content-controlled overwrite, not a zero-fill, and nobody checked.~~
SETTLED 2026-07-31 — see `W4-CRUX-aead-settled.md`. The report was RIGHT; this item is withdrawn.**

> The lead disassembled it. The AV media decrypt is **AES-256-GCM**: `[ctx+0x28]` (installed at
> `0x140cb1466`) is `0x140cb89b0`, which selects `EVP_aes_256_gcm`, sets `EVP_CTRL_AEAD_SET_IVLEN`/
> `SET_TAG`, and calls **`EVP_DecryptFinal_ex` @ `0x140cb8bb6` with its return value checked at
> `0x140cb8bbb cmp eax,1 / jne`**. Failure frees the output and returns NULL → empty `QByteArray` →
> `length() <= 0` → the `memset` arm. **F4-1 is a zero-fill, exactly as the report says.** The wire
> framing is `algo(1) || IV(12) || TAG(16) || ciphertext`, and the parameter table at `0x1432e25a0`
> (`00 00 00 00 20 0c 10 01`) gives `1+12+16 = 29` — which *is* `cryptoPadding`, so the 65/65 benign
> measurement independently confirms the suite. "Authentication fails by construction" is now literally
> demonstrated: the tag sits inside the payload the attacker really sent, so inflation cannot damage it
> — it extends the *authenticated ciphertext* with heap bytes the attacker does not control.
>
> **What survives from this item is only the process point** (below): an unread instruction was being
> propagated as a headline property. It happened to be right. Keep the discipline, drop the worry.

The original item, retained because the process lesson is the point:
The report's practical primitive is the `memset` arm: *"over-declaring the length makes the ciphertext
garbage, so the decrypt yields nothing and N zero bytes are written."* `NEXT-HUNT-BRIEF.md` §1 #2
hardens this further into *"inflating the length makes **GCM** authentication fail **by construction**."*

There is **no evidence anywhere in the engagement that the decrypt is an AEAD.**
`grep -i "AEAD\|GCM\|aws_lc" FINAL-REPORT-wave4.md` → 0; across all 16 journal files, the only mention
is the verifier asking for it as an open item, in `verdict_buffer-size-substitution.json`:

> *"A third, cheaper hardening question worth answering for the writeup: whether `0x140b250f0 ->
> 0x140b24bc0` is an AEAD. **If it is unauthenticated, the success branch at `0x14013f487` memcpy's
> roughly `declared` bytes of attacker-influenced plaintext instead of zeros, which turns a zero-fill
> corruption into a content-controlled heap overwrite.**"

So the single question that decides whether F4-1 is a zero-fill or a **controlled-content** heap
overwrite was asked by the verifier, never answered, dropped from the report, and then re-asserted in
the brief as settled fact with a cipher name attached that no one derived from the bytes. This is the
same failure mode §0 of the brief exists to prevent — an unread instruction turned into a headline
property — running in the direction of *under*-stating rather than over-stating. It is also cheap:
`disfunc_pro.py 0x140b24bc0` plus the IAT.

**C3 — the minimum inflation `K` that actually leaves the allocation is unknown, and the one live
measurement is unreconciled.** The report asserts the memset writes *"past the end of the received
payload allocation."* Three unresolved things sit under that:

* `recon_NPL_dll_bespoke_Serializer…json` describes the backing allocation as
  *"exactly sized (pool alloc `0x1800e0490` = `0x120` header **+ 0x40 headroom** + exactly `size`
  bytes), so an over-read leaves the allocation immediately."* Those two halves contradict each other:
  64 bytes of headroom is not "immediately."
* `recon_recv_field_map…json` lists the same thing as an **open question** — *"an exactly-sized copy of
  the decrypted media payload, or a slot in a pooled MTU-sized buffer? … it sets the minimum inflation
  needed for candidate #1 to leave the allocation"* — and notes the agent never read the socket-read
  code that fills the buffer.
* The only live measurement anyone has is `n == payload_len + 29` (65/65, `cryptoPadding` = `0x1d`).
  The report cites it only to rebut the challenge and never reconciles it with its own claim that
  `Frame+0x18` carries the peer field **verbatim** with no transform. Either the sender declares the
  ciphertext length (so "the real payload" in the report's chain is the ciphertext and the margin
  arithmetic shifts), or something between the protobuf field and the sink adds 29 — and no one has
  identified that instruction.

None of this threatens F4-1's existence. It does mean the report cannot presently say what `K` a PoC
must use, which is the first thing a vendor triage engineer will ask.

---

## D. Negatives presented as stronger than their authors made them

**D1 — the libvpx baseline is provably not stock v1.9.0, and this is never reconciled.**
`recon_independent_static_audit…json`, open question 5, verbatim:

> *"The libvpx in this build is **NOT stock 1.9.0** in `vp8_dx_iface.c`: it contains the
> `ctx->restart_threads` / `pbi->restart_threads` logic (`0x18017d93f`, `0x18017deb0`, `pbi+0x3a28`)
> that upstream added later. **That should be reconciled with the 1.9.0 pin** the iface name string
> advertises, since it changes which upstream commits are in scope for the parallel CVE-diff agent."*

The CVE-diff agent enumerated commits over `v1.9.0..HEAD` on the assumption that v1.9.0 *is* the
shipped tree, and produced the report's headline refutation — *"libvpx 1.9.0 is dangerously stale →
REFUTED; the core VP8 bitstream-to-pixel path received **zero** upstream memory-safety fixes."* Two
agents produced contradictory premises about the same binary and the synthesis reconciled neither;
`grep -c restart_threads FINAL-REPORT-wave4.md` → **0**.

To be precise about the damage: **F4-2 survives**, because its five commits were checked against the
shipped bytes directly, not against a version label. What does not survive as stated is the *scope* of
the negative. A vendor-patched 2020 libvpx means (a) the commit enumeration had the wrong baseline in
both directions, and (b) there may be vendor-local modifications that no upstream diff can see. The
negative should read "zero *upstream* fixes present in the diffed range, baseline uncertain — the tree
contains at least one post-1.9.0 backport," not "the path received zero memory-safety fixes."

**D2 — the VP8 static audit's unaudited region is not disclosed.**
The report's *Evidence-backed negatives* lists eight bullets and the brief compresses them to
*"Full static audit with compare-and-branch quoted for each … zero OOB."* The audit's own author
scoped it out loud (`recon_independent_static_audit…json`, open question 2):

> *"I did **not** audit the token/coefficient decoder bodies to instruction level: `decode_macroblock
> 0x1801acc70`, `vp8_decode_mb_tokens 0x1801b1770`, `decode_coefs 0x1801b1480`,
> `vp8_build_inter_predictors_mb 0x1801b2f30`, `vp8_build_inter16x16_predictors_mb 0x1801b2650`. I
> confirmed the MV-clamp call sites exist at `0x1801b2697`/`0x1801b27a4` but **did not verify the clamp
> bounds** against `mb_to_left/right/top/bottom_edge`. That is the remaining unswept area of the live
> decode path and **it is where the classic VP8 reference-frame OOB reads live**."*

Plus open question 3: *"`read_mb_modes` (`0x1801beea0`) was not disassembled … I argued [its outputs
are] bounded **by construction** rather than by inspection."* `grep -c "read_mb_modes\|decode_coefs\|
decode_macroblock\|build_inter" FINAL-REPORT-wave4.md` → **0**.

So the strongest negative in the report — "the VP8 core parse is clean" — excludes the inter-predictor
and token-decode bodies, and the exclusion is invisible to a reader. And per C1, F4-2's own confirmed
fault lands inside one of the five unread functions.

**D3 — the fuzzing negative is bounded by a cap the fuzzer itself flagged, and its triage rule
discards F4-2's own signature.** Two separate problems:

* Coverage: *"The fuzzing harness is capped at ~9,700 iterations per process by the TBLN=65536
  quarantine table … the current fence corpus **has barely been exercised beyond the point where the
  harness self-destructs**"* (`recon_fuzz…json`, open question 5). The report presents "~370,000
  iterations, zero OOB" without that qualifier.
* Triage: the report dismisses the crash corpus with *"The 13 near-NULL access violations … all are
  writes to `0x0`/`0x4`/`0x20` inside VCRUNTIME memset/memcpy, i.e. post-failure NULL derefs."* The
  confirmed F4-2 chain, at cap 400, terminates as
  `[p3] inter -> FAULTED: access violation writing 0x0000000000000004 … VCRUNTIME140.dll+0x11c64
  (memset(NULL,..))`. **That is the same signature.** So the rule used to discard 13 crashes would have
  discarded the wave's own headline libvpx finding. The rule may still be right for those 13, but the
  report cannot assert it as a clean negative without saying why F4-2's instance is different.

**D4 — F4-5's refutation carries a build-scoped caveat the report drops.** The verifier wrote:
*"Anyone re-testing should re-run the `uniq -c` over `AV.Scene` lines **on the target build** before
assuming this stays true, and should re-check whether `ColorspaceConverter 0x180125680` is ever
instantiated as the Parser's immediate sink."* The report states the impact as flatly "REFUTED."

**D5 — F4-7's attacker model was relabelled during synthesis.** Recon: WOA is *"toggled from
**server-side config** that the client subscribes to (`enableWOA`/`forceWOA`) … **If a malicious or
compromised Wickr server can flip `forceWOA` to true, mbedTLS 2.1.5 becomes reachable without user
action.** I did not verify whether the client accepts that flag unconditionally."* Report: *"a real
TLS-client attack surface **the moment an administrator turns Open Access on**." The report converts a
server-flippable, unverified-gate condition into a deliberate administrator action, which is a
materially weaker attacker model than the evidence supports. Note this is the *same* structural
question as F4-1's: what does the client accept from the server without authentication?

---

## E. Never asked — dimensions with no agent, no negative, no mention

**E1 — the audio leg was never traced, yet the report's scope line claims it.** F4-1's opening sentence
says *"on the video/audio receive path."* There is no audio evidence in the wave. Two agents flagged
it and both were dropped:

* `verdict_buffer-size-unvalidated-vpx-datasz.json`: *"Also worth one grep I did not run: whether the
  audio leg (`Parser->CryptProxy->PacketMonitor->OpusDecoder`) reaches the same `decryptCallback` —
  audio uses the identical kind==2 path, so **the same primitive is probably reachable without the
  victim ever enabling video**."* If true, F4-1's victim precondition collapses to "is in a call,"
  which raises its severity and simplifies the PoC.
* `recon_recv_field_map…json`: *"`AudioFormat` fields 1..6 (defaults 1,1,48000,16,16 installed at
  `0x18013dcda`..`0x18013dcf6`) are **fully peer-controlled with no clamp**. Nobody has followed sample
  rate / channel count / bit depth into the audio resampler or the WASAPI render buffer sizing.
  `NPLHubAudioReadData 0x1803e7510` … **was not examined at all this session**."*

**E2 — most peer-controlled `PacketHeader` fields have no consumer map.** `recon_NPL_dll_bespoke…json`:
*"PacketHeader carries several other unclamped int32 metadata fields (`+0x40`, `+0x44`, `+0x48`,
`+0x4c`, `+0x54`, `+0x58`, `+0x5c`, `+0x60`, `+0x98`) … copied to `Frame+0x8c..+0xa0` … **I did not
follow every consumer**."* `recon_recv_field_map…json` adds that field 11 *is* read back inside
`VpxDecoder::process` at `0x180144bc3` and passed to `0x180144320` on the decode-failure path, and that
its naming of field 3 is INFERRED. The report's field-map bullets ("kind is enum-clamped… plane count
bounded to 4… Latency exactly 5 ints") read as a complete map of what is and is not constrained. It is
a map of the *three constrained* fields plus two traced ones.

**E3 — mid-call `kind==1` FORMAT re-parse: does it rebuild the decode graph?**
`recon_recv_field_map…json`: *"Does a peer's mid-call kind==1 FORMAT packet actually **REBUILD** the
decode graph (re-enter the node builder `0x1800ef820` and re-run codec selection with the peer's codec
id), or only reconfigure an existing node? `0x180132d80` is the apply function and I only read its
first ~90 instructions. **58 live 'Received new format' events say the path runs.**"* Absent from the
report. A peer-driven graph rebuild mid-call is a state-machine surface in its own right, and it is
the one place the (otherwise refuted) codec-name selection could still matter.

**E4 — `Proto::VideoFormat` crop rect never swept.** The report refutes *"peer `Format` width/height
reaching the converter's allocation arithmetic"* because `VpxDecoder::process` re-publishes the real
`d_w/d_h`. That closes **w/h**. The same message carries a **4-int crop rect (field 5)** and
`recon_recv_field_map…json` says *"Nobody has swept the peer-controlled `VideoFormat` width/height and
the 4-int crop rect against the converter and renderer with adversarial values (odd, 1xN, near 2^31,
negative)."* The re-publish argument does not cover the crop rect, and the report does not say so.

**E5 — two decoder contexts per publisher, and the group-call multiplier is asserted without evidence.**
F4-2's gate discussion says *"a group call instantiates one `VpxDecoder` per remote publisher, so N
attackers multiply demand."* No journal entry establishes that; it is an untested lever in three
different agents' open questions. Meanwhile a *measured* multiplier is dropped:
`recon_libvpx…json` — *"**Two decoder instances** are created by the loop at
`0x180144685-0x180144785` (r14 walks `0x518..0x528`)"* — and
`verdict_vp8-commit-amplification-2gib.json` — *"whether **bit 14 of `Frame+0x90`** is peer-settable so
**both contexts of one publisher** can be filled"* (≈4 GiB rather than 2 GiB from a **single** peer).
The report keeps the speculative lever and drops the concrete one.

**E6 — the strongest lever on F4-2's gate is missing.** `verdict_vp8-mi-uaf-alloc-fail.json` names it:
*"after a SUCCESSFUL 16383×16383 decode the receiver must convert a 16383×16383 image to BGR32
(**~1.07 GiB per frame**) in WickrPro's `storeFrame` path."* That is a peer-driven, per-frame
allocation on top of the 2 GiB decode arena — much stronger than "downstream accumulation elsewhere in
the process may do the rest," which is what the report says. Same verdict also gives the live oracle
the report omits: `"Failed to allocate frame buffers"` (string at `0x180461e50`) is *"the single
unambiguous live indicator that the bug has armed."*

**E7 — CVE-2026-1861 was left open and then dropped.** `recon_libvpx…json`: *"CVE-2026-1861 (heap
buffer overflow in libvpx, Chrome 144.0.7559.132, Chromium issue 478942410, Feb 2026) could not be
attributed to a specific upstream commit — the tracker entry is not public … **I did not confirm this,
so it remains an open question rather than a cleared negative**."* The report's refuted table handles
CVE-2026-2447 and never mentions 1861. An unattributed libvpx heap overflow that could not be ruled
out should not vanish between the journal and the artifact.

**E8 — no integrity check below `NetworkSource` was ever looked for.** The verifier that established
the parse-before-decrypt property closed with: *"I did **not** audit the DTLS/transport layer below
`NetworkSource` for a second, application-level MAC."* That is a live refutation route for F4-1's
attacker model and it is not recorded anywhere in the report. The same verdict offers an exhaustive
falsification the report also omits: *"find a build/config where the `decryptCallback` property is
bound to a different function than `WickrPro!0x140147150` — the key string `0x141d556d0` has exactly
two xrefs (funcs `0x14014f480` and `0x1401510a0`) so this is checkable exhaustively."*

**E9 — vendor-artifact hygiene.** Not analysis gaps, but they block the stated purpose ("before
anything goes to a vendor"):
* `WickrPro.exe` has no hash; only `NPL.dll` is pinned. Half of F4-1 lives in `WickrPro.exe`.
* **No affected-version or affected-platform statement.** Nobody asked whether the `Musigy::AV` stack
  ships in Wickr's macOS / iOS / Android clients. If it does, F4-1 is cross-platform, and that is the
  single biggest unknown multiplier on the whole engagement's impact.
* **No victim-side precondition for F4-1.** Must the victim accept the call? Subscribe to the
  attacker's stream? One verdict hints the header is acted on *before* subscribe completes (*"before
  the first subscribe completes, N should read back as real+K"*), which if true means no user
  interaction — a material severity input, currently unstated in either direction.
* No severity scoring, and no vendor-runnable reproduction for F4-1 (F4-2 has one; F4-1 has none).

---

## F. Precision defects — statements that will not survive vendor scrutiny as written

**F1 — "Five upstream fixes are absent from the shipped bytes, each checked individually."**
Only **three** have byte-level evidence anywhere in the journal:
`44a5eaa3b` (seam at `0x18017d916`/`0x18017d91d`, quoted), `0226b9516`
(`disfunc.py 0x180186320 | grep -c 0xc60` → 0, quoted), and `572f663c8` (F4-4's dimension).
`a5e2e6528` and `263ddc9e3` appear in exactly one place across all 16 files — the recon candidate
sentence *"without upstream fix 44a5eaa3b … **or its companions** `263ddc9e3` / `0226b9516` /
`a5e2e6528`"* — with no individual check. The recon's own summary says **"Two** upstream memory-safety
fixes … are ABSENT from the shipped bytes, both confirmed by disassembly." "Each checked individually"
overstates by two, and the remediation instructs the vendor to cherry-pick specific commits.

**F2 — F4-2's "Reproduced 3/3" and "144 bytes" come from two different experiments.** The 3/3 is
`uaf_reclaim.py` (recon, seeds 0/1337/424242); the 144 bytes is `uaf_extent.py 400` (verdict,
paint-and-diff: *"painted 1444 bytes … overwritten by the decoder: 144 / 1444"*). Both numbers are
real; presenting them as one result is not. And per C1 the 144 is the *small* regime.

**F3 — F4-4's disclosure value is stated without the hedge its verifier attached.** *"My measured leak
was the decoder's own recycled grey planes, and a 64 × 0x11000 heap-poison did not land in the new
buffers … **If fresh regions are always zero pages from the OS, the finding degrades to a pure
correctness/garbled-video defect**."* The report files it as CWE-908 uninitialised-heap use with no
mention that the attempt to demonstrate a cross-boundary leak failed.

---

## G. What to do, ranked by how much it changes the artifact

1. ~~**Answer the AEAD question**~~ **DONE 2026-07-31 → `W4-CRUX-aead-settled.md`.** AES-256-GCM,
   `EVP_DecryptFinal_ex` checked. F4-1 is a zero-fill; the report and the brief were both right.
   Two things to *carry forward* into the artifact instead: state the suite and the framing
   (`algo(1)||IV(12)||TAG(16)||ct`, overhead 29) so a vendor can see why inflation cannot be repaired;
   and file the **new lead** from that pass — a peer-supplied 32-bit sequence at descriptor+`0x5c`
   drives an unbounded ratchet **loop** (`0x140cb64f0`..`0x140cb65c4`) **before** decryption, and the
   `jbe` gate at `0x140cb682c` means one large value permanently wedges the stream. **(C2, §6 of the
   crux)**
2. **Re-state F4-2's blast radius using the mip-calloc regime** — 76 MB computed, 33 KB–330 KB measured
   past a 1,900-byte block — and say that the attacker selects the regime. **(C1)**
3. **Reconcile the libvpx baseline** (`restart_threads` backport) and rescope the "zero fixes" negative
   accordingly; verify `a5e2e6528` and `263ddc9e3` individually or drop them from the remediation.
   **(D1, F1)**
4. **File the two dropped defects**: CryptProxy fail-open (and add it to F4-1's remediation), and the
   dead decoder-reset-on-format-change as F4-8. **(B1, B2)**
5. **Disclose the unaudited VP8 region** in the negatives (token/coeff decoder, inter predictors, MV
   clamp bounds, `read_mb_modes`), note that F4-2's own fault lands inside it, and add the TBLN cap and
   the near-NULL triage-rule collision to the fuzzing negative. **(D2, D3)**
6. **Run the audio grep.** Does `OpusDecoder` reach the same `decryptCallback`? If yes, F4-1 needs no
   video on the victim — cheapest severity change available. **(E1)**
7. **Add the provenance table from §A verbatim**, so F4-6/F4-7 and the two headline refutations are
   visibly single-source, and add the receive-graph ordering to the un-re-read list. **(A1–A3)**
8. **Get an independent look at the fence-table refutation** before three heap-corruption crashes stay
   buried. **(A2)**
9. **Ask the platform question**: does `Musigy::AV` ship on Wickr mobile/macOS? Largest unpriced
   multiplier in the engagement. **(E9)**
10. Fold E2–E8 into the open-questions list so they survive into Wave 5 instead of dying in the journal.

---

## H. What this pass did *not* do

* No new reverse engineering. Every quoted address and measurement is re-cited from the journal or the
  existing artifacts; I disassembled nothing myself, so nothing here carries a CONFIRMED label of my
  own.
* No re-verification of F4-1's or F4-2's core chains. I read them for completeness, not for
  correctness, and I found no reason to doubt either.
* No assessment of Waves 1–3 beyond what Wave 4 re-opened.
* The `_journal_dump` is the *survivor* set from a workflow that died twice. If any agent produced
  output that never reached the journal, this critique cannot see it — and that possibility is itself a
  gap that only the workflow transcript can close.
