# Session prompt — decide whether an RCE path actually exists, from the existing corpus

Paste everything between the rules below.

---

Continue the authorised assessment of **AWS Wickr Desktop 6.72.20.0 (Windows)**.

The goal is to decide **whether a path to RCE actually exists**, judged from the work already done.
This is not a request to open new attack surface. It is a request to work out **which links in an
already-measured chain are still open**, and whether they can be closed.

## Read these first, in this order — the order matters

This engagement has overturned its own conclusions between waves. If you read the older documents
first you will reason from premises that have since been retracted.

1. `E:\tmp\wickr\desktop\notes\NEXT-HUNT-BRIEF.md`
   The **WAVE 5 section at the top overturns two Wave-4 conclusions**. §0 (method rules) is mandatory.
2. `E:\tmp\wickr\desktop\notes\W5-CRUX-f4-2-content-control.md`
   **The current frontier.** The table in §9, "Where the chain stands", is the authoritative statement
   of what is open.
3. `E:\tmp\wickr\desktop\notes\W4-CRUX-rce-path-assessment.md`
   The ingredient breakdown for RCE — but **two of its rows were overturned by W5** (content control,
   and the "~5 publishers" figure). Reconcile it against W5 yourself; do not take either at face value.
4. `E:\tmp\wickr\desktop\notes\W4-COMPLETENESS-CRITIC.md`
   What is verifier-dependent and what was never audited.
5. `E:\tmp\wickr\desktop\notes\FINAL-REPORT-wave4.md` (§F4-1 and §F4-2).
6. As needed: `W4-CRUX-buffer-size-chain.md`, `W4-CRUX-aead-settled.md`, `W4-CRUX-vp9-refutation.md`.

Tooling and raw data live in `scratch/w3/lead/` (disassembly helpers and live probes) and
`scratch/w4/fuzz-vp8/` (VP8 encoder, UAF experiments, the W5 evidence logs).
**Look before you rebuild.** `disfunc.py` / `disfunc_pro.py` (per-function disassembly using `.pdata`),
`callers.py` / `callers_pro.py`, `class_vtable.py` (MSVC RTTI), `leaxref.py` and others already exist.

## Where the chain stands (from W5 §9 — this is your starting point)

| link | status |
|---|---|
| gate: one peer can arm it (victim free commit below ~4034 MiB) | MEASURED |
| content control through the dangling pointer | MEASURED (4/4) |
| write density, 68 chosen bytes per 76-byte record | MEASURED |
| aim: offset and size class | MEASURED |
| ASLR-surviving partial pointer overwrite | MEASURED |
| PC control from the primitive | **MEASURED — but the reclaiming object was harness-supplied** |
| **(a) a real reclaiming object in the live WickrPro process** | **OPEN** |
| **(b) live over-the-wire delivery** | **OPEN** |

**RCE is not demonstrated, and must not be claimed while (a) and (b) are open.**

## Primary task

**Close (a), or establish that it cannot be closed.** Stated precisely:

> In the live WickrPro process, what allocation reclaims the freed `mip` block, and does that object
> hold a **code pointer** — or a pointer later used as a **write destination** — at one of the byte
> offsets the primitive can reach?

The constraints you need are all in the W5 crux; confirm them there rather than trusting this summary:

- the freed block's size is **chosen by the attacker** via the first frame's resolution (1923 bytes at
  W=H=64);
- `mi` sits at `raw_block + 16 + (stride+1)*76`;
- reachable byte residues are **68 of 76** (only 16–19 and 24–27 are unreachable);
- clean partial-overwrite slots are **one per row**, at `mi_off + (r·stride + mb_cols−1)·76 + 72`
  for odd `r`;
- alphabet: each 4-byte value is two even `int16` in ±2046 ⇒ low byte even, high byte in
  `0x00..0x07 ∪ 0xF8..0xFF`;
- reclaim must land on the **exact** freed block (`base == mip − 16`) or the placement arithmetic
  breaks;
- the decoder **re-reads** the reclaimed block as neighbouring MODE_INFOs, so the attacker has to model
  the reclaiming object's bytes at +0/+2/+4.

**This host has ~19.5 GiB of free commit and is therefore not in the vulnerable window** (threshold
~4.0 GiB). Live fire for (b) needs a memory-constrained victim VM. **Do (a) first — it can be narrowed
statically, and there is no point building the VM before you know what you are aiming at.**

## Do not re-walk these — they are closed with evidence

- **Route A (RCE from F4-1's zero-fill).** Content control is structurally impossible: to overflow by
  `K` bytes the attacker must *know* `K+29` bytes, so the known region can never exceed the allocation,
  and no grooming fixes that (W5 Appendix A). There is also no information leak — the feedback channel
  carries timing only, and CryptProxy's all-zeros scan covers exactly the range the `memset` just
  zeroed, so it is self-defeating.
- **The update channel (WinSparkle).** Fail-closed. No DSA public key is configured (`win_sparkle_set_dsa_pub_pem`
  is not imported; there is no `DSAPub`/`DSAPEM` resource in either module), but signature verification
  is invoked **unconditionally** (`0x180028eec`, straight-line code), and an empty key makes
  `PEM_read_bio_DSA_PUBKEY` return NULL and throw. An attacker-supplied installer does not execute.
  Not an RCE path.
- **The docx-preview XSS × native bridge combination.** Already found and reported by the operator.
- **Attachments, files and links** (`A5-content-attachment.md`) — negative, closed at instruction level.
- **Deep links and QWebChannel** (`A2-deeplink-webchannel.md`) — negative, static RE plus frida.
- **MLS SDK memory safety** (`A3-mls-npl.md`) — Rust (mls-rs 0.54.0); the whole
  ingest → decode → verify path is memory-safe. *(Its authorisation logic is a separate, unaudited
  question — but that is an integrity issue, not RCE, so it is out of scope here.)*
- **A peer-selectable VP9 decoder** — `--disable-vp9`; the factory builds the same `VpxDecoder` for
  both names and discards the distinguishing argument.
- **"libvpx 1.9.0 is dangerously stale"** — the core VP8 bitstream-to-pixel path took zero upstream
  memory-safety fixes. *Caveat, per the completeness critic: the token/coefficient decoder bodies and
  `read_mb_modes` were never disassembled, and the shipped tree is not stock 1.9.0 (it carries a
  `restart_threads` backport), so that negative is narrower than it reads.*

## Method rules this engagement has already paid for (full text in §0 of the brief)

1. **Disassemble the decisive instruction yourself before headlining any reachability claim.**
2. **Check you are testing the right invariant.** True-but-useless observations have cost this
   engagement repeatedly.
3. **A string comparison is not a code path.** Follow an accepted token to the object it constructs and
   check whether the distinguishing argument is ever read.
4. **Before you measure, state which observation would distinguish the hypotheses.** This rule has been
   broken **twice** here, both times producing a confident wrong answer: F4-1's benign capture, and
   Wave 4's all-zero VP8 payload (VP8 modes are arithmetic-coded, so an arbitrary byte string cannot
   select a mode — the experiment could only ever return zeros under either hypothesis).
5. **Asymmetry inside one function is the highest-yield pattern on this target.** When you find a
   validated branch, read the unvalidated one next to it.
6. **Linear `.text` sweeps desync.** Always disassemble per function using `.pdata` extents.
7. **Read the application's own logs before building a probe.** It prints its scene graphs at every
   call start.
8. **A probe must record every sample and detect target death.** If it only logs on the interesting
   branch, "no data" and "negative result" become indistinguishable — that mistake wasted two runs.
   The ring buffer lives in the victim's address space, so anything not drained before it dies is lost.

## Reporting discipline

- Label every claim **CONFIRMED** (you disassembled or measured it — say which) or **INFERRED**.
- Any condition supplied by a harness is a **qualifier that travels with the result**.
- **Do not write "RCE" while (a) or (b) is open.** Fabricating positives violates the rules of
  engagement.
- Negatives are deliverables. If something is closed, say so and show why.

## Rules of engagement

Operator-owned accounts and machines only. No traffic to third parties. No fuzzing against Wickr
production servers — harness the local parsers instead. Benign proofs of concept only; do not build or
run destructive ones.

## What to produce first

After reading, give a status assessment before doing new work:

1. Which rows of the W5 §9 table you were able to corroborate from the primary artefacts (consistency
   between the write-up and the evidence logs is enough; you do not need to re-run the experiments).
2. Three concrete lines of attack on (a), ordered by cost.
3. Your current answer to "does an RCE path exist?" — **if it does not, say so plainly. That is the
   correct result, not a failure.**

---
