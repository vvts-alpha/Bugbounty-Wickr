# W7-CRUX — RCE surface sweep, final verdict

**Target:** AWS Wickr Desktop 6.72.20.0 (Windows x64) — `NPL.dll`, `WickrPro.exe`, `Sock5.dll`.
**Scope of this document:** synthesis of six independently produced and independently
adversarially-verified surface reports (`opus`, `vp8core`, `sock5`, `wirefields`, `fmtstate`,
`reclaim`), written against the standing question:

> *Could this surface yield remote code execution against a Wickr client, reachable by a call peer
> or by the relay/hub? Not "is there a bug" — is there a path to CODE EXECUTION, and what is the
> cheapest single check that would settle it?*

Every claim below is labelled **CONFIRMED** (someone disassembled or measured it — the instruction
or the measurement is quoted), **INFERRED** (reasoned from confirmed facts), or **REFUTED**.
Qualifiers travel with results. Negatives are deliverables.

---

## 1. Direct answer

### A path to remote code execution is **NOT ESTABLISHED**.

That is the honest result and it is not a failure. Stated precisely:

* **CONFIRMED (live, W5):** one authenticated call peer sends **405 bytes of VP8 (3 frames)** over a
  real Wickr call and obtains a **byte-exact, content-controlled use-after-free write** in the
  victim's unsandboxed main process, followed by process death. Gate observed open live
  (`pc->mip = 0`, `pc->mi` dangling 456 B into a freed 1923 B block); frame C's 64 bytes of
  `bmi[16]` matched the request byte-for-byte at all four steered macroblocks.
  (`W5-CRUX-f4-2-content-control.md` §18; `W6-CRUX-link-a.md`.)
* **CONFIRMED (live, W5):** it is **not RCE**. The dump shows the freed block was **still on the
  free list** (free-list pointer at `block−8`). The write corrupted unowned memory. There was no
  object, therefore no vtable, therefore no control transfer.
* **The single missing link is unchanged:** *(a)* a **reclaiming allocation** that (i) lands in a
  size class reachable on the `76k+23` lattice, (ii) exposes a **pointer at an offset the write can
  reach**, and (iii) already points into sprayable memory.
* **W6 (CONFIRMED):** the alternative "sweep" regime — choosing the victim's headroom so the
  allocation failure lands on the `mip` calloc — reaches **~290 KB with no reclaimer needed** but
  **loses content control (0/128 measured)**: `vp8_find_near_mvs` reads the above row at
  `mi − stride·76 = mi − 77,900`, 78 KB of unknown heap, of which 515/1025 records read as inter, so
  the arithmetic decoder desyncs at macroblock 0. **Reach OR content control, never both.**

**This wave did not find link (a), and it did not close it either.** The `reclaim` surface report
claimed to close it (`rce_verdict: dead`); its adversarial verifier **measurably refuted the
method** and downgraded it to *unlikely*. See §2 row 1 and §5. So the correct global statement is:

> **No RCE path is demonstrated. One necessary link remains open, narrowed but not eliminated, and
> the corpus that would settle it has been enumerated only over 2 of the ~214 modules that share
> the heap in question, with a tool that was structurally blind to the one allocation shape that
> matters.**

Nothing in this sweep produced a second, independent candidate primitive. Five of the six surfaces
resolved negative or dead; the sixth is the reclaim residual itself.

---

## 2. Ranked surface table

Rank is by *remaining probability of yielding code execution*, highest first. "Verifier verdict" is
the adversarial re-verification result, which overrides the finder where they disagree.

| # | Surface | Finder | Verifier | Status | The instruction / measurement that decides it |
|---|---------|--------|----------|--------|-----------------------------------------------|
| 1 | **F4-2 link (a): computed-size / array-like allocations as reclaimers** | dead | unlikely | **OPEN — highest value** | *Not killed.* Clean-slot floor **696 B** CONFIRMED by closed-form derivation + exhaustive search (`off = 88 + 76·(2·mbc+1+r·(mbc+1))`; 8-aligned ⟺ `mbc` even, `r` odd; min 696 at mbc=2,mbr=2,r=1; self-test reproduces the live 1936-block's 1152/1912 slots). But the sweep that claimed "0 hits" **broke at the first `call`** — measured median coverage **7 instructions** after each of 673 alloc sites, 70 % of sites ≤10 instructions. Array-fill and constructor-deposited pointers were structurally invisible. |
| 2 | **VP8 post-processing (`vp8/common/postproc.c`)** | residual | flagged OPEN | **OPEN** | Compiled in (`--enable-postproc` in the configure string @ `0x1804610d0`), buffer really allocated (`0x180186217`–`0x180186229`, border `0x20`, memset 128 @ `0x18018624f`), and gated by a byte read at **exactly one site in the whole binary** — `0x18014473a 41388424ba040000 cmp byte ptr [r12+0x4ba], al` — that **NPL.dll never writes**. Externally set ⇒ *not* statically dead the way EC and threading are. Runs `vp8_deblock`/`vp8_de_mblock`/`vp8_plane_add_noise` over peer-supplied decoded frames. **Completely unaudited.** |
| 3 | **fdk-aac decoder leg (`0x180148550` → walk `0x1801650b0`)** | residual | residual | **OPEN** | CONFIRMED to share the identical peer-reachable bundle walk (`0x1801487d9 lea rcx,[rdi+0xf0]` / `0x1801487e3 e8c8c80100 call 0x1801650b0`) and the identical declared-length over-read, with an **entirely different decoder** behind it. Neither analyst opened it. This is the engagement's Rule 5 pattern pointing at an unread sibling. |
| 4 | **Sock5 / Dispersive tunnel data path + mbedTLS 2.1.5 pre-auth handshake** | unlikely | unlikely | **OPEN (narrow)** | mbedTLS **2.1.5 (Jan 2016)** CONFIRMED (`0x180770d68`) inside a component built **Mar 10 2025** (`0x180770ce0`). Cert verification IS enforced — authmode = 2 from `0x1800573f3 and dword [rbx+0x158],0xfffffff8` + `0x1800573fa or dword [rbx+0x158],0x5c48`, re-asserted `0x180057a1e or dword [rdx+0x158],8`, no verify callback installed (no write to `conf+0x68`) — **but all ServerHello / extension / X.509 chain parsing runs BEFORE `verify_result` is consulted** (`0x180057b88 test ebx,ebx`). Separately, the **tunnel data path that `DispersiveTunnelStart 0x1801fc000` actually drives was examined by neither analyst** (finder's forward BFS explored 1304 functions and never reached the code analysed). |
| 5 | **CVE-2026-1861 / Chromium issue 478942410** | unresolved | unresolved | **OPEN (one lookup)** | ROE forbids the network fetch. Shipped decoder is libvpx **1.9.0** (`0x180462000`) with `--disable-vp9`, plus **at least** the `restart_threads` backport (CONFIRMED at `0x18017deb0`, `0x18017df83`, `0x1801affbb`). The finder's "very likely present" was REFUTED as an unsupported positive — its own evidence shows the vendor does carry post-1.9.0 backports. Correct label: **UNKNOWN**. |
| 6 | **VP8 SIMD predictor kernels (`xd+0xfc0/0xfc8/0xfd0/0xfd8`)** | residual | residual | **UNLIKELY** | The whole ±20-vs-±32 margin argument assumes **upstream tap geometry** (`x0−2 .. x0+w+3`). Not verified in the shipped bytes. If a kernel reads wider than upstream, the 12-pixel slack narrows. |
| 7 | **VP8 stale `MODE_INFO` divergence (CONFIG_ERROR_CONCEALMENT early return)** | INFERRED benign | not attacked | **UNLIKELY** | The early return in `vp8_decode_mode_mvs` at `0x1801c0a0b` is **not** gated on `ec_enabled`/`ec_active`, so a truncated first partition leaves MODE_INFO unwritten this frame — a real divergence from stock. Argued benign (MODE_INFO written atomically per MB; `mb_to_*_edge` depend only on position; dimension change forces keyframe + re-alloc). **Reasoned, not measured.** |
| 8 | **Audio decode leg: PacketBundleDecoder → libopus → resampler → PlayoutBufferWrapper** | unlikely | **dead** | **DEAD** | `PlayoutBufferWrapper`'s ring `memcpy` at `0x18016c9b9` really is unclamped and really does scale by channel count while the slot size does not — but channels is pinned to 1 by **`0x180129097 c787e000000001000000 mov dword ptr [rdi+0xe0], 1`** in the `AudioOutputStream` ctor, written **nowhere else in the module** (whole-binary scan: 67 4-byte writes at disp 0xe0, none in an AudioOutputStream method; zero writes at disp 0x70/0x74 across every method in its vtable). Ratio 1 ⇒ slot and copy are both `2·N`. **Exact fit.** |
| 9 | **VP8 wire fields (`PacketHeader` +0x40..+0x60, `Packet` +0x8c..+0xa0, VideoFormat crop rect)** | unlikely | **dead** | **DEAD** | Two kills. (i) The decoder-context selector is masked to one bit: `0x1801447b2 c1e80e shr eax,0xe` / `0x1801447b5 2401 and al,1`, and the raw peer value loaded at `0x180144bc3` is **overwritten** at `0x180144bf0 448b742438 mov r14d,[rsp+0x38]` before the index site `0x180144f6e movsxd rax,r14d`. (ii) The last unmapped live field (field 7 → `PacketSender::onEvent` slot +0x18) is an **EventID**, clamped to `[0x20,0xa1]` by `lea eax,[r8-0x20]` / `cmp eax,0x81` / `ja` at `0x1801269d7`, `0x18012375d`, `0x18012a59b`; every other one of 34 receivers uses exact-equality compares. |
| 10 | **Mid-call FORMAT re-parse + VpxDecoder rebuild as a reclaim primitive** | open | **dead** | **DEAD (two independent kills)** | (i) **Size/offset:** the rebuilt object is `Musigy::AV::VpxDecoderContext`, **0x48 = 72 bytes** (`0x1801446ba b948000000 mov ecx,0x48`), vtable at offset 0. F4-2's freed block is 1923 B and the write provably never touches the first **244** bytes (W5 §11b) — a 72-byte object lies entirely inside the unwritable prefix, and offset-0 vtables are the one shape already excluded. (ii) **Reachability:** the mid-call rebuild **never fires**, killed by `0x18012271d e9fef2ffff jmp 0x180121a20` → `0x180121b60/0x180121b6a/0x180121b70 mov [rdi+0x10/0x14/0x18], eax` with `rdi = this_vpx+0xc8`, which syncs the geometry cache at `+0xd8/+0xdc/+0xe0` **between** the two gates, so gate 2 (`0x180144644 je 0x1801447ac`) always skips the destroy/realloc. |
| 11 | **VP8 MV clamp / inter predictors / token-coefficient decoder / mode-MV parse** | unlikely | unlikely→dead in substance | **DEAD** | Clamps are upstream-exact and present: `0x1801b26ae lea eax,[rsi-0x98]`, `0x1801b26cc lea eax,[rsi+0x90]`, `sub/add dx,r8w` with `r8d=0x80`; `vp8_clamp_mv2 0x1801b3680` hard-clamps to edge±0x80. Border is 32 px luma (`0x1801860e3`/`0x18018613a`/`0x18018621e mov r9d,0x20` in the **decoder** allocator `0x180186080`, and `mb_cols·16 == aligned_width` by construction from `0x1801860ab`–`0x1801860c8` + `0x180186196`–`0x1801861a9`). Worst reach `[−21, dim+20]` vs window `[−32, dim+31]`. The int16 truncation lead is self-REFUTED by the 32-bit compare `0x1801b25ea 443bc8 cmp r9d,eax`. No unbounded index in `decode_coefs 0x1801b1480` (loop hard-stop `0x1801170e 4983ff10 cmp r15,0x10`). |
| 12 | **VP8 error concealment, multithreaded decoder, input fragments** | dead | dead | **DEAD** | All three killed by the **single** `vpx_codec_dec_init_ver` call site: `0x180144720 4533c9 xor r9d,r9d` (flags = 0 ⇒ no `VPX_CODEC_USE_ERROR_CONCEALMENT 0x20000`, no `USE_POSTPROC 0x10000`, no `USE_INPUT_FRAGMENTS 0x40000`) and `0x180144709 c7854001000001000000 mov dword ptr [rbp+0x140], 1` (threads = 1). `pbi->ec_enabled` (+0x3a04) has **exactly one writer** in the whole binary (`0x180186574`). |
| 13 | **Sock5 driver-install path (SETUPAPI / newdev)** | dead | dead | **DEAD (three ways)** | Zero TLS callbacks (`AddressOfCallBacks 0x18069d420`, first qword 0); `DllMain 0x18064dea0` is the 61-byte stock CRT stub; **no `.inf`/`.sys`/`.cat` ships anywhere in the install tree** (the target `..\tap\OemVista.inf` @ `0x180775078` is absent), Sock5's resource directory holds exactly one `RT_MANIFEST` and no payload; and the install root is non-elevated per-user `%LOCALAPPDATA%`. |
| 14 | **mbedTLS truncated-HMAC CVE class (CVE-2018-0488 shape)** | claimed precondition met | **REFUTED** | **DEAD** | Feature bit 13 (`0x2000`) is **clear**: `0x1800573fa 818b58010000485c0000 or dword ptr [rbx+0x158], 0x5c48`. `ssl_write_truncated_hmac_ext` takes the `je` at `0x1801dba96 test dword ptr [rax+0x158],0x2000`, and the mirror check at `0x1801dd7a0` rejects a server that echoes it. Precondition unsatisfiable. (Session tickets bit14, encrypt-then-MAC bit10, extended master secret bit11 and the full X.509 parser DO survive as preconditions.) |
| 15 | **VideoFormat crop rect (Proto field 5)** | dead | dead | **DEAD** | Parsed with zero validation into `AV::VideoFormat+0x40..+0x4c` (`0x180146139`–`0x18014614e`) and then read by nothing that does geometry, allocation or pointer arithmetic; not exported by `NPLAVFormatGetVideoFormatInfo 0x1803d0670`. |
| 16 | **Opus PCM destination / AudioFormat clamps / `NPLHubAudioReadData`** | dead | dead | **DEAD** | `frame_size` is the compile-time `0xb40 = 2880` written **once** in the DLL (`0x180148956`) into a `0x5a00 = 23040` B pool block (`0x180148fa0`) ⇒ max write 11520/23040. `opus_decoder_create 0x1802c6c69` whitelists Fs and channels; on failure `[+0x150]` stays NULL and `0x1801494f3` makes the packet path a no-op. `NPLHubAudioReadData 0x1803e7510` takes a **host**-supplied capacity and WickrPro does not import it. |
| 17 | Prior-wave closures (restated, do not reopen) | — | — | **DEAD** | WinSparkle (signature verification unconditional @ `0x180028eec`, no DSA key configured — fail-closed); attachments; deep links / QWebChannel; MLS SDK memory safety (Rust, mls-rs 0.54.0); peer-selectable VP9 (`--disable-vp9`, factory discards the flag); route A content control (structurally impossible — to overflow by K the attacker must know K+29 bytes). |

**Nothing in this sweep rates PROMISING.** Row 1 is the only surface where a positive result would
directly convert an existing demonstrated primitive into code execution; rows 2–4 are surfaces with
real unaudited parser/decoder area behind a peer- or hub-reachable input, which is a different and
weaker kind of promise.

---

## 3. Cheapest next experiment per non-dead surface

Each entry states the experiment **and the observation that distinguishes the hypotheses**, per
Rule 4. Where both hypotheses predict the same observation, the experiment is not listed.

### 3.1 Link (a) — the reclaim corpus (rank 1)

**Experiment (one run, module-agnostic, dispatch-agnostic, shape-agnostic):** passive detour on
`ucrtbase!malloc` / `RtlAllocateHeap` in the live victim with the Job-Object commit cap armed
(`victim_probe.c` already detects the gate and dumps the block). Log `(size, return address,
thread)` for the interval **between the `mip` free and the UAF write**, filtered to requests whose
NT block class lies on the `76k+23` lattice **and** is ≥ 704 bytes.

* **H-reclaimer-exists** predicts: ≥1 logged allocation in the window on the lattice at ≥704 B,
  from a module/return address, whose object layout can then be read.
* **H-no-reclaimer** predicts: an empty window, or only sub-704 B / off-lattice requests.

**Why this and not another static sweep.** The static approach has now failed for a measurable
reason, not a judgement call. The `reclaim` finder's tool contained `if k.mnemonic == "call":
break`; measured distance from allocator call to next call over its own 673 sites is **min 0,
median 7, mean 11.4, max 88**, with 469/673 sites getting ≤10 instructions of coverage and 6
getting zero. For a ≥704-byte block, essentially no C++ object is initialised inside a
7-instruction prologue — the pointers go in via a constructor call or a fill loop, both after the
break. A verifier re-run with correct ABI clobbering, stack spill/reload tracking and a
600-instruction window still found **0 constant-offset stores at ≥696** (that shape is genuinely
closed for NPL.dll) but found **11 vs 6** constant-offset stores at the older 248 floor, **23 vs 13**
wide/xmm stores, and **58 vs 10** alloc sites with an indexed (array-fill) store — a **6× undercount
on exactly the shape the exercise existed to enumerate**.

**Two model corrections to carry (both CONFIRMED, with qualifiers):**

1. **The clean-slot floor is 696 B, not 244/248.** 244 is the floor for *any* writable slot
   (requires `mbc = 1`), which cannot be **clean** (leak-free, 8-aligned). A clean slot needs `mbc`
   even and ≥ 2, which forces `mi_off ≥ 320` and puts the slot a further ≥ 376 beyond.
   *Refinement (CONFIRMED by the verifier):* pool-allocated objects sit at `malloc_block+8`
   (`0x1801145d5 4983c608 add r14,8`), so the object-relative floor is **688**, not 696.
   Consequence: any reclaimer smaller than ~704 B, or whose pointers all sit below +688, is
   excluded under **every** geometry. This retroactively confirms W6 §6's five clean-capable
   fixed-size classes were assessed above the floor (slots +696/+1152/+1912/+2064).
2. **The 4 GiB-window premise is half wrong.** MEASURED: 700,000 × `HeapAlloc(GetProcessHeap(),
   1923)` = 1.25 GiB touches **one** 4 GiB window, covering 1.3–2.0 GiB of it contiguously across
   three runs. So a **small-heap** pointer on a clean slot *is* aimable at roughly 1-in-3 blind —
   the 4 GiB window is **not** what kills the chain. The other half survives: allocations ≥1 MiB
   land in a window independent of the small-block heap (3/3 runs, hi32 0x85 vs 0x199, 0x80 vs
   0x18b, 0xcd vs 0x1d7), so a frame-buffer pointer and a small-heap pointer are in different
   windows. **QUALIFIER: measured in `python.exe` on this host, not inside WickrPro under the Job
   Object commit cap, and the peer's ability to place 1.25 GiB of small blocks in WickrPro is not
   established.**
3. **Reclaim size tolerance is exactly 16 bytes wide** = `((req+23)//16)*16` — MEASURED (4096
   pinned neighbours, one slot recycled per probe, requests swept 1500..2399: exactly one
   contiguous run, 1913..1928). This **confirms** W6's lattice model. *Caveat carried:* the stated
   refutation of "H-LFH" is weak, because Windows LFH granularity in the 1–2 KiB range is 32 B, not
   the 64/128 the hypothesis assumed; the observation indicates the block came from the backend
   heap, which is the useful part.

**Secondary experiment if the detour is unavailable:** re-run the array-shape sweep with the
verifier's `verify_slotstore.py` semantics **over Qt6Core/Qt6Gui/Qt6Quick/Qt6Multimedia and
MSVCP140**, not just NPL and WickrPro. `QList`/`QVector<T*>` reallocate is the canonical
computed-size pointer array with a non-power-of-two growth policy, and in a pointer array **every**
8-aligned offset is a live pointer field, so the 688/696 floor is satisfied automatically at index
≥ 86.

### 3.2 VP8 post-processing (rank 2)

**Experiment (two static steps, no call needed):** run `dataref.py` / `callers_pro.py` in
`WickrPro.exe` for the writer of the flag byte read at `0x18014473a` (`[r12+0x4ba]`), i.e. resolve
which class holds `+0x4ba` and who sets it; **then** disassemble `vp8_post_proc_frame` /
`vp8_deblock` / `vp8_de_mblock` / `vp8_plane_add_noise`.

* **H-postproc-live** predicts: a writer exists in WickrPro (a settings/quality/CPU-tier decision),
  and `VP8_SET_POSTPROC` at `0x180144744`–`0x180144769` is issued in some shipped configuration.
* **H-postproc-dead** predicts: no writer anywhere ⇒ the byte is always 0 ⇒ the control is never
  issued and the surface closes with one instruction, exactly like error concealment did.

This is the cheapest OPEN item in the whole sweep and it has a clean binary outcome.

### 3.3 fdk-aac decoder leg (rank 3)

**Experiment:** `disfunc.py 180148550`, then the AAC `Listener` sub-object's `onSubPacket`, then the
fdk-aac entry it calls — auditing the same four things that came out clean on the Opus leg: the
declared-vs-delivered length budget, the PCM destination capacity, the channel/rate clamp, and the
frame-size argument's provenance.

* **H-symmetric** predicts: fdk-aac's entry checks its own `(ptr,len)` and a constant-capacity
  destination, mirroring Opus ⇒ dead.
* **H-asymmetric** predicts: the destination capacity or the frame-size argument derives from a
  peer-influenced field rather than a ctor immediate ⇒ live. **The distinguishing single
  observation is whether the AAC decoder's output-capacity argument traces to a `mov [X], imm`
  in a constructor (as Opus's `0x180148956 mov dword [rsi+0x144],0xb40` does) or to a format
  field.**

Note the tooling trap CONFIRMED on this leg: `callers.py` reports **only** the AAC call site for
`0x1801650b0` because the Opus path arrives by `jmp` from `0x180149507`, a function with **no
`.pdata` entry**; and `0x1801650b0`'s own `.pdata` extent is **33 bytes** (RVA 0x1650b0–0x1650d1),
so `disfunc.py` silently truncates it at the first `ja`. Use a raw-range disassembler here.

### 3.4 Sock5 / Dispersive (rank 4)

**Experiment 1 (cheapest, static, kills or keeps the whole mbedTLS surface):** determine whether
**anything** in the install writes `certificates/ca-cert.pem`. The trust anchor is loaded by
`0x1800575d8 call 0x18019cc20` = `mbedtls_x509_crt_parse_file` (`0x18019cc2f lea rdx,[rip+0x5d0472]`
→ `"rb"`; `0x18019cc36 call [rip+0x5001dc]` → `fopen`; NULL ⇒ `0x18019cc41 b800c2ffff mov
eax,0xffffc200` = `MBEDTLS_ERR_X509_FILE_IO_ERROR`), and failure tears down at `0x180057747`.
**No `.pem` ships in the install tree** (CONFIRMED by two independent recursive scans).

* **H-provisioned** predicts: some path builder (`0x18035fb10`, `0x1802fec40`, `0x1803022d0`,
  `0x1804f8a80`, `0x18060b590`) or the eight embedded PEM blobs (`0x180766050`, `0x180766d70`,
  `0x18076728a`, `0x180767610`, `0x180767ae0`, `0x1807685d0`, `0x180768a60`, `0x180769690`) is
  written out with an `fopen` write mode.
* **H-fails-closed** predicts: no writer ⇒ `parse_file` always returns `−0x3E00` ⇒ the DPS TLS
  client is **unreachable on a stock install** and the whole mbedTLS surface dies with **no fuzzing
  at all**.

**Experiment 2 (only if H-provisioned):** harness `SSLClient_Polar::init`/`connect` (vtable
`0x180771440`, slot 0 = `0x180057220`) against a **loopback** TLS server with a locally generated
CA, and fuzz the **pre-verification** handshake — ServerHello, extensions, Certificate chain. ROE-
clean, no external traffic.

**Experiment 3 (separate, and the real scope gap):** audit what `DispersiveTunnelStart 0x1801fc000`
actually drives — the tunnel data path. That is the only part of `Sock5.dll` a **relay** could feed,
and neither analyst examined it. Note the gate is far weaker than the Wave-4 model assumed (§6.2).

### 3.5 CVE-2026-1861 (rank 5)

**Experiment:** one lookup of Chromium issue 478942410 / the libvpx commit range between Chrome
144.0.7559.131 and .132 by an analyst whose ROE permits the network fetch, then `disfunc.py` on the
named function against the shipped bytes.

* **H-VP9-or-encoder** predicts: structurally inapplicable (`--disable-vp9`; no VP9 decoder present;
  only `"WebM Project VP8 Decoder v1.9.0"` @ `0x180462000` and `"…VP8 Encoder v1.9.0"` @
  `0x180461e00`).
* **H-VP8-decoder** predicts: a named function whose shipped bytes lack the fix.

### 3.6 SIMD kernels (rank 6)

**Experiment:** disassemble **one** RTCD-selected sixtap kernel plus `copy_mem16x16` (`0x180019bf0`)
and read the actual tap span.

* **H-upstream-geometry** predicts reads within `x0−2 .. x0+w+3` ⇒ the +20/+32 margin holds.
* **H-wider** predicts a wider span ⇒ the 12-pixel slack narrows and the whole predictor bound needs
  re-deriving.

An empirical seal is also available and ROE-clean: `harness_vp8.py` with a page-guarded reference
plane and an inter frame whose every MB is NEWMV with `mv.row/col = 0x7fff/0x8000`. A fault refutes
the arithmetic in one run.

### 3.7 Stale-MODE_INFO divergence (rank 7)

**Experiment:** feed frame A (all SPLITMV or all B_PRED), then frame B whose first partition is
truncated after macroblock k, then frame C, under a page-guarded frame buffer, and diff the
reconstruction against a stock `CONFIG_ERROR_CONCEALMENT=0` libvpx 1.9.0.

* **H-benign-stale** predicts identical fetch bounds in both builds.
* **H-escapes-invariants** predicts a fetch outside the border in the shipped build only,
  localising the divergence in one run.

---

## 4. What *would* have to be true for RCE — the standing shape

Recording this so a future wave does not re-derive it.

To convert F4-2 into code execution, **all** of the following must hold simultaneously
(CONFIRMED constraints unless noted):

1. **Array-like reclaimer.** A vtable at offset 0 can *never* be the target — the write never
   touches the first 244 B under any geometry (W5 §11b), and 688/696 for a clean slot. So the
   reclaiming object must be array-like or have pointers deep in its layout.
2. **Lattice-reachable size.** Only **15.1 %** of NT block sizes are reachable as a freed `mip`
   block (`76k+23`, bucketed by 16); of reachable ones 98.1 % are clean-capable — the sparse
   lattice is the binding constraint, not slot alignment.
3. **A pointer that already points into sprayable memory.** A partial overwrite cannot move a
   pointer out of its own 4 GiB window. **Amended this wave:** small-heap pointers are aimable
   (§3.1 correction 2), large-allocation pointers are in a different window from the small heap.
4. **Timing.** The reclaim must happen between the `mip` free and the write, in the same
   millisecond-scale window, driven by peer-controllable traffic.
5. **No information leak is available.** F4-2 gives a write, not a read. Every leak candidate
   examined so far returns audio to the victim's speakers, not data to the attacker
   (the speaker→mic→AEC→Opus round trip was closed in W7's audio work).

Mitigation state that makes step (1) cheap *if* it is ever satisfied — all CONFIRMED, prior waves:
**CFG absent in both `NPL.dll` and `WickrPro.exe`** (DllCharacteristics `0x160`,
`GuardCFFunctionCount = 0`), **no CET**, **default NT heap**, **media and UI unsandboxed in the main
process**.

And one control-flow primitive worth composing with any future write, CONFIRMED this wave:
`vp8_intra4x4_predict 0x1801b1b70` performs an **unchecked** indirect call through a **writable,
CFG-free** `.data` function-pointer table — `0x1801b1b9b 4963f9 movsxd rdi,r9d` (sign-extended, no
`cmp`/`ja` anywhere in the 164-byte function), `0x1801b1baf lea r10,[rip+0x39a8ca]` → **`0x18054C480`**
(10 qwords, inside `.data` 0x18052e000–0x1805551f8, characteristics `0xc0000040`), `0x1801b1bb6
mov r10,[r10+rdi*8]`, `0x1801b1bf9 41ffd2 call r10`. The index is bounded 0..9 by the shipped
`vp8_bmode_tree` bytes at `0x180466048` and by a cross-field invariant (`mbmi.mode == B_PRED` ⟹
`bmi[]` holds modes, not MVs — the two are emitted together, `0x1801c0112 cmp al,4 / jne`), **not**
by a bounds check. **Any** future write primitive reaching `0x18054C480` or a `MODE_INFO` `bmi`
entry while `is_4x4` is set converts directly to PC control with `rcx` = a heap pointer into the
frame buffer. The two findings compose; carry this into the link-(a) hunt.

---

## 5. COVERAGE — what this sweep did **not** look at

**Read "no RCE found" as "no RCE found in the following, with the following holes", never as "no RCE
exists".**

### 5.1 Structural holes in the method

* **Virtual dispatch is not followed anywhere in this sweep.** `NPL.dll` contains **11,855 indirect
  call sites**; the media forward closure used by the `reclaim` surface reached **138 of 13,498**
  functions via direct call/jmp edges only. That filter demonstrably **excludes** the packet
  constructors (`0x1800e0490`, `0x1800e0714`), the packet-chain coalescer (`0x1800e0ce0`) and the
  packet pointer-array (`0x1800e1370`) — functions the *same report* places on the packet path
  elsewhere — and classifies `AudioHub(dec)` (`0x1800f1b20`) as non-media. Any conclusion of the
  form "X is not on the media path" in this corpus should be treated as unproven.
* **`.pdata`-only sweeps cover 89.8 % of `.text`.** MEASURED: `.text` is `0x4225fe` bytes; the union
  of `.pdata` function extents covers `0x3b6bf6`. ~10 % of `.text` is invisible to every
  "whole-binary scan" in these reports. "Complete set" claims are complete over 89.8 %.
* **`callers.py` under-reports on this binary** — the Opus decoder reaches the bundle walk by `jmp`
  from a function with no `.pdata` entry (`0x180149507 e9a4bb0100 jmp 0x1801650b0`). Any
  `.pdata`-based caller enumeration will miss tail-jump edges.
* **Displacement-only scans are blind to base-shifted aliases.** The `fmtstate` finder's negative
  ("nothing writes `+0xd8/+0xdc/+0xe0`") was REFUTED precisely this way: the writer reaches the same
  bytes through a base shifted by `−0x70+0x138`, so its displacements are `0x10/0x14/0x18`. Two
  further over-broad negatives were flagged in `wirefields` for the same reason (a raw-displacement
  sweep at `0x40/0x44/0x48/0x4c` returns **450** distinct functions in NPL and cannot know which base
  register holds the object of interest; it missed `0x18013b4f0`).
* **Alias-tracking sweeps stop at calls / miss `memcpy`-of-struct.** See §3.1. Also unmodelled:
  pointers deposited through a base spilled to stack and reloaded, via `xchg`, or by copying a
  pointer-bearing struct into the block.
* **Element-size classification is 20 % complete.** In the array-shape scan, **541 of 673** NPL
  computed-size sites have **no** element-size determination in either direction (268 tagged PHI —
  size never resolved; 260 tagged LEA_ADD — the scaled multiply is further back than the recorded
  context). The "49 pointer-array-shaped sites" figure is a floor of unknown tightness.

### 5.2 Modules and components not examined at all

* **212 of the ~214 modules in the live process.** Only `NPL.dll` and `WickrPro.exe` were swept for
  allocations. `Qt6Core.dll`, `Qt6Gui.dll`, `Qt6Quick.dll`, `Qt6Multimedia.dll`, `MSVCP140.dll`,
  `VCRUNTIME140.dll` and the rest all allocate from the **same process default heap** (both binaries
  import `malloc` from `api-ms-win-crt-heap-l1-1-0.dll`), and several sit on the decoded-frame
  delivery path. Qt container reallocation is the canonical computed-size pointer array.
* **Statically-linked allocators inside `WickrPro.exe`.** Any bundled arena/pool (Qt, Chromium, a
  vendored allocator) inside that 55 MB binary is invisible to an IAT/thunk-based allocator
  enumeration.
* **`Sock5.dll`'s tunnel data path** — the code `DispersiveTunnelStart` actually drives. The only
  part of that DLL a relay could feed; examined by nobody.
* **`WickrMlsSdkCpp.dll`, `crypto.dll`, `aws_lc_fips_0_13_14_crypto.dll`** were touched only for
  version identification this wave (AWS-LC FIPS 2.0.17 @ `0x1801224b0` and AWS-LC FIPS 3.3.0 @
  `0x18013aa98` respectively; neither carries a `VS_VERSIONINFO`). No code audit.

### 5.3 Code paths flagged by the surface reports as their own residuals

* **libopus CELT/SILK internals.** `celt_decode_with_ec`, `silk_Decode`, the SILK resampler and
  `kiss_fft` were never read. Entry guards of `opus_decode` / `opus_decode_native` /
  `opus_decode_frame` / `opus_packet_parse_impl` were verified byte-level, and 250+ `celt_fatal`
  sites exist (build has `ENABLE_ASSERTIONS`, so many invariant violations abort rather than
  corrupt) — but a defect inside those bodies would be invisible to what was done.
* **The opus version cannot be pinned to a release label offline.** Exact upstream commit
  `72a3a6c13329869000b34a12ba27d8bfdfbc22b3` is CONFIRMED from 22 embedded `__FILE__` strings; the
  ROE forbids the lookup. **No claim is made about any specific opus CVE identifier.**
* **mbedTLS: no defect audit was performed.** What was done is version pinning, confirmation that
  the `0x02010500` version immediate is absent (so the string is the only pin), and byte-level
  confirmation of compile-time feature bits. The finder's summary sentence *"I found no
  memory-safety defect in the shipped bytes"* is **over-broad and should be read as "I did not look
  for one"** across a ~9.4 MB image containing a full TLS + X.509 + SQLite bundle. **No CVE mapping
  above the feature-precondition level is CONFIRMED.**
* **VP8 header/partition setup** (`setup_token_decoder`, partition sizing, fragment handling) —
  taken as given from Wave 4, not re-derived.
* **The error-concealment bodies** (`vp8_estimate_missing_mvs`, `0x180187f50`/`0x180187fb0`/
  `0x180187fe0`/`0x180188020`, allocator `0x1801864a0`) — compiled in, proven unreachable for the
  one decoder instance NPL creates. **Not** proven for any other decoder instance any other module
  might create.
* **The playout/jitter insert `0x18016c7c0`** beyond the memcpy and slot arithmetic: its statistics,
  resize (`0x18016c520`), wrap-around and ring-growth (`0x18016b549+`) paths.
* **The audio leg's WickrPro-side decrypt callback `0x14013f820`** (which also reads
  `descriptor+0x5c` at `0x14013f8f4` and strips a `0x1d`-byte prefix at `0x14013f8ab`).
* **`Proto::PacketHeader` fields 9 (string, +0x30) and 12 (nested message, +0x38)** — outside the
  assigned field list, consumers unmapped.
* **The mid-call kind==1 FORMAT apply (`0x180132d80`) as an allocation source** — reached but not
  enumerated for what it allocates.
* **The rebuild path's other callees** — `0x18017d4a0`, `0x18017e5e0`, `0x18017ac90`,
  `0x180143bb0`, `0x180144130`, `0x180144320`, `0x180145a20` — so the destroyed/allocated inventory
  may be incomplete beyond the two `0x48` objects.
* **`ReorderingBuffer` (`0x1800bc3e0` / `0x1800bd490`)** — a sequence-number-indexed circular array
  of packet **pointers** (`0x1800bc461 div dword ptr [rbx+0x14]`, `0x1800bc471 mov [rax+rdx*8],r15`)
  whose growth is doubling **clamped to a max capacity field**, i.e. **not** on the pure 2^k ladder
  the disjointness argument covered. The one located construction site sets maxcap `0x40`
  (`0x1800bf9de mov dword ptr [rbp+0x18],0x40`) ⇒ 512 B ceiling, below the floor ⇒ probably dead.
  **Not every constructor was enumerated.**
* **Whether a >512 KB coalesced media packet is constructible over the wire** (chain-length / total-
  size caps in the depacketiser). Moot for the current floor, unverified as a general fact.
* **Wave-4's "declared length exceeds delivered bytes" property** rests on a live experiment with a
  patched sender. Instruction-level, only the fact that the walk's budget is `[rdx+0x18]` and not
  the delivered byte count was re-confirmed; where that descriptor field is written on the receive
  path was not traced. So it is **not** established whether the over-read reaches truly adjacent
  heap or only uninitialised bytes inside the same allocation.

### 5.4 Measurement qualifiers

* **All heap-window and reclaim-tolerance numbers were measured in `python.exe` on this host**, not
  inside `WickrPro.exe` under the Job-Object commit cap that arms F4-2. The mechanisms are
  heap-manager-generic; the numbers are not WickrPro's.
* **No live traffic was generated this wave.** Static analysis and local harnessing only, per ROE.
  No calls, no network traffic to Wickr or third parties, `WickrPro` not launched. The remote-DoS
  finding (§6.4) is static-only. The ratchet-loop role gate (`[ctx+0xd0]`) was not resolved at
  runtime, and the deployed ratchet divisor was never established — see §6.4's qualifier.
* **W6 §9 line 1's local running-graph enumeration remains unrun.**

---

## 6. Reportable to the vendor on its own merits, regardless of RCE

Ordered by severity. Each is independently CONFIRMED at the instruction level or measured live.

### 6.1 Remote use-after-free write, authenticated call peer → victim process death (CRITICAL)

**CONFIRMED LIVE (W5).** 405 bytes of VP8 in 3 frames from one authenticated call peer produce a
byte-exact, content-controlled UAF write in the victim's **unsandboxed** main process, followed by
process death. Combined with **CFG absent, no CET, default NT heap and media+UI unsandboxed**, this
is a remote memory-corruption primitive with attacker-chosen content and no exploit mitigation
between it and the rest of the process. RCE is **not** demonstrated — the freed block was never
reclaimed — but the defect is complete on its own terms and should be reported as such.

### 6.2 A server-pushed message alone force-enables Wickr Open Access, with no user action (HIGH)

**CONFIRMED.** A switchboard `kNewSettings` frame carrying `"forceOpenAccess": true` executes
`0x1409caebe c6869501000001 mov byte ptr [rsi+0x195], 1` **unconditionally**, then
`0x1409caed8 mov byte ptr [rsi+0x196], 1`. The decisive store is dominated only by
`0x1409caeb5 test r12b,r12b`, with `r12b` sourced from `QJsonValue::toBool` on the key
`"forceOpenAccess"` (QString `0x1434f7910`, literal `0x1432557c0` — the key↔register binding was
verified, a swap would have inverted the finding). Path: dispatcher `0x140b8c490`
(`lea eax,[r9-2]` bias ⇒ jump-table slot 5 = protobuf oneof case 7) → `0x140b878d0`
(`QByteArray::fromBase64` → `QJsonDocument::fromJson`) → `0x1409c9550`.

**Impact:** the Wave-4 attacker model ("the moment an administrator turns Open Access on") is
materially weaker than the evidence supports. The correct model is **"the moment the Wickr server
says so"**. Enabling WOA activates the Dispersive tunnel component and, with it, a **2016-vintage
TLS stack** (§6.3). *Qualifier:* the auto-start of the proxy is **INFERRED**, not confirmed — three
guards in `slotForceWOAChanged 0x14006f0a0` (`cmp byte ptr [rax+0x33],0`, and the returns of
`0x1409e5680` and `0x1409c67e0`) were not resolved; one could still be a user opt-in. A state gate
also applies: the action table is reached only when `[rsi+0x20]` ∈ {4, 8}. The **authentication
properties of the switchboard channel itself were not examined**, so it is not established how hard
frame injection is for a network attacker versus requiring server compromise.

### 6.3 Stale bundled dependencies in a 2025 build (HIGH, hygiene)

**CONFIRMED.** `Sock5.dll` ships **mbed TLS 2.1.5 (Jan 2016)** — string at `0x180770d68` — inside a
Dispersive component versioned `4.4.0.00143` and built **`Mar 10 2025 14:38:55`** (`0x180770cd0`,
`0x180770ce0`). The same DLL carries **SQLite 3.19.2 (May 2017)** (`0x18075c5d4`). `NPL.dll` ships
**libvpx 1.9.0 (2020)** with a demonstrably selective backport policy (`restart_threads` present at
`0x18017deb0`/`0x18017df83`/`0x1801affbb`; nothing else identified). **No specific CVE is claimed** —
the truncated-HMAC class is refuted (§2 row 14) and no defect audit was performed — but a ten-year-old
TLS client that terminates a live network connection is a finding on its own, and the selective
backport policy means each post-1.9.0 libvpx VP8 fix has to be checked individually rather than
assumed present.

### 6.4 Remote denial of service: peer/hub-driven key-ratchet loop (HIGH)

**CONFIRMED (static).** `Proto::PacketHeader` field 10 (wire tag `0x50`, varint, no range check) →
`PacketHeader+0x58` (`0x18013bdd7`) → `Packet+0x98` → `descriptor+0x5c` (`0x1803d0f19`/`0x1803d0f20`)
→ WickrPro's decrypt callback `0x14013f390` (`0x14013f438 8b4d1c mov ecx,[rbp+0x1c]`) → the ratchet
at `0x140cb6800`. Gate `0x140cb6825 cmp r9,[rcx+0xc8]` / `jbe`; loop trip count =
`(peer_uint32 / divisor) − (state / divisor)` (`0x140cb64b5`/`0x140cb64c0 div r8`), each iteration
performing a KDF call (`0x140cb651c call rax`) and ~five heap allocations; then
`0x140cb685c 4889bbc8000000 mov qword ptr [rbx+0xc8], rdi` **permanently** installs the peer's value
as the stream's high-water mark, after which every legitimate lower sequence fails the `jbe` and the
function returns NULL — **the stream is wedged**.

**Critically, the header that supplies this field is parsed BEFORE the media decrypt**, by
`Musigy::AV::NetworkSource::ChannelListener` (`0x180134cd0`, slot +0x28 of vtable `0x180441ce8`; the
parse is `0x180135325 call 0x1801090d0` on a local whose vtable is the `PacketHeader` vtable
`0x180442428`; the stamp is `0x180135337`/`0x18013533e`). It is therefore **unauthenticated with
respect to the E2E media layer and reachable by the relay/hub as well as by a call peer.**

*Qualifier (important):* the headline "4,294,967,295 iterations from one packet" is **INFERRED
worst-case, not CONFIRMED** — it requires `divisor == 1`, and only the ctor's acceptance range
`[1, 32768]` (`0x140cb61d2 lea eax,[r8-1]` / `0x140cb61d6 cmp eax,0x7fff` / `ja`) was established,
never the deployed value. Even at the maximum divisor, **one packet forces ≥131,072 iterations**.
The role gate (`[rcx+0xd0] == 1` vs `== 0`) was not resolved at runtime, though both arms take the
peer sequence and call the same loop. **Not verified dynamically — no packets were sent, per ROE.**

*Secondary note for the F4-2 work:* that loop is a **peer-driven heap-grooming primitive** — ~5
allocations per iteration under a peer-chosen trip count. It is memory-safe itself, but it is the
kind of thing a reclaim attempt would use.

### 6.5 `CryptProxy` fails open on decryption failure (MEDIUM–HIGH)

**CONFIRMED.** In `Musigy::AV::CryptProxy` (`0x18011b3b0`) the registered `decryptCallback`
(fn ptr at `[rsi+0xe8]`, config key string `0x180438628`) is invoked at `0x18011b68c ffd0 call rax`
and its **return value is never tested** — the very next instruction `0x18011b68e 8b8e18010000 mov
ecx,[rsi+0x118]` overwrites `EAX`'s consumer, and the subsequent `test ecx,ecx` is on a static
padding config that was already read at `0x18011b5bf`. There is also **no null check** on
`[rsi+0xe8]` on the `0x18011b5c6 jle` path. A **second** fail-open sits at
`0x18011b6a3 3bc2 cmp eax,edx` / `0x18011b6a5 7309 jae` — if the padding magnitude ≥ packet length,
the length is left **unshrunk** and the code only logs `"Padding/packet size mismatch"`
(`0x18043e7c0`). The packet is transformed **in place** (`rdx = r14`, buffer `[r14+0x10]`, length
`[r14+0x18]`), so whatever bytes the callback left are inserted into the reorder buffer
(`0x18011b8a3 mov ecx,0x28` / `call 0x1801119a8`; tree insert `0x18011b8d9`) and reach the decoder.

**Impact:** a relay/hub that lacks the media key can inject arbitrary undecryptable bytes into the
victim's reorder buffer and codec — an unauthenticated fuzz-injection and DoS vector. It is **not**
a content-control primitive (the hub cannot steer post-transform bytes) and carries **no RCE
relevance** on the evidence; the earlier "plausible" rating was refuted as inflated. Note the
brief's old anchor `0x18011b752` is **mis-attributed** — that address is the fall-through of an
all-zeroes payload scan that only logs `"All bytes set to zero, "` / `" failed most likely"`
(`0x18043e800`, `0x18043e860`).

### 6.6 Peer/hub-chosen AV pipeline event injection (MEDIUM, logic)

**CONFIRMED.** `PacketHeader` field 7 (`+0x50`) is read on the event path
(`0x18011eaf6`, `0x18011ec8d 458b7650 mov r14d,[r14+0x50]`) and forwarded as the **EventID** argument
of `PacketReceiver::onEvent` (`0x18011ecc3 ff5018 call qword ptr [rax+0x18]`, receiver at
`Parser`'s `PacketSender+0x40`), together with an attacker-chosen payload `Packet`. It is
**memory-safe** — all 34 receiver implementations either compare it for exact equality or clamp it
with `lea eax,[r8-0x20]` / `cmp eax,0x81` / `ja` before any table lookup — but an authenticated peer,
**or the relay/hub** (the header is parsed pre-decrypt, §6.4), can drive arbitrary AV-pipeline events
in `[0x20, 0xa1]` into the media state machine. **The state-machine consequences of arbitrary event
injection were not audited — only its memory safety.**

### 6.7 Adjacent-heap over-read decoded to audio (MEDIUM, info-exposure-shaped)

**CONFIRMED (instruction level) / INHERITED (live).** The `PacketBundleDecoder` walk
(`0x1801650b0`) budgets against the **peer-declared** length `[rdx+0x18]`, not the delivered byte
count. An inflated declared length causes stale/adjacent heap to be handed to `opus_decode` as
`(ptr, len)`. The walk itself is otherwise provably safe — `2 ≤ len ≤ 1024`
(`0x1801650c6 cmp eax,0x3fe / ja`), `N ≤ 31` (`0x1801650fb cmp r8d,0x20 / ja`), and the running
budget `0x180165198 sub edi,esi` / `0x18016519a test edi,edi` / `jle` breaks **before** emitting, so
every `(ptr,len)` stays inside `[data, data+declared_len)`. The product is **audio played to the
victim**, not data returned to the attacker; the speaker→mic→AEC→Opus round trip was closed in W7's
audio work, so this is **not** an information-disclosure channel to the peer. Report it as an
over-read. *Qualifier:* the "exceeds the delivered bytes" half is inherited from W4 §5b's live
experiment with a patched sender; it is **not** established whether the read reaches truly adjacent
heap or only uninitialised bytes inside the same allocation.

### 6.8 Defence-in-depth / hardening items (LOW, but cheap to fix)

* **CFG is absent from both `NPL.dll` and `WickrPro.exe`** (`DllCharacteristics = 0x160`,
  `GuardCFFunctionCount = 0`); **no CET**; **default NT heap**; **media and UI unsandboxed in the
  main process**. Enabling CFG alone would neutralise the `vp8_intra4x4_predict` indirect-call shape
  below and raise the cost of any future write primitive substantially.
* **`vp8_intra4x4_predict` calls through a writable, unguarded `.data` table.** `0x18054C480`,
  10 qwords, `.data` R/W, indexed by a **sign-extended 32-bit** value with no bounds instruction
  (`0x1801b1b9b movsxd rdi,r9d` … `0x1801b1bf9 call r10`). Safe today only by a cross-field data
  invariant, not by a check. Making the table read-only after
  `vp8_init_intra4x4_predictors_internal`, or adding an explicit range check, removes a ready-made
  PC-control gadget.
* **`SETUPAPI.dll` and `newdev.dll` are force-loaded into `WickrPro`** by `Sock5.dll`'s static
  imports (11 `SetupDi*` + `UpdateDriverForPlugAndPlayDevicesW`) although **no driver ships and the
  install is non-elevated per-user** — the install path targets `..\tap\OemVista.inf`
  (`0x180775078`) which is absent from the tree. Unnecessary attack surface; the imports should be
  dropped or delay-loaded.
* **`VtcData` SQL is built by raw string concatenation with no binds** (builders `0x180063940`,
  `0x180063ba0`, `0x180063e30`, `0x180064150`). Every key observed at a call site is a compile-time
  constant (`httpProxy_*`, `secureProxy_*`), so no injection is demonstrated — **but four callers
  (`0x180065c30`, `0x180064430`, `0x1805fc810`, `0x1802f14e0`) were not enumerated**, so it is not
  excluded that a server-supplied WOA proxy **value** reaches the concatenation. Local-DB SQL
  injection at worst, not memory corruption.
* **Two AWS-LC FIPS modules ship side by side** — `crypto.dll` = AWS-LC FIPS 2.0.17
  (`0x1801224b0`), `aws_lc_fips_0_13_14_crypto.dll` = AWS-LC FIPS 3.3.0 (`0x18013aa98`). Neither
  carries a `VS_VERSIONINFO`. Hygiene note only; no defect claimed.
* **A rejected audio format permanently mutes that stream** — `opus_decoder_destroy` runs **before**
  validation (`0x180149288`), so a peer that offers an unsupported `AudioFormat` silences its own
  stream irrecoverably. Robustness, not security.
* **Peer-driven PLC amplifier** (`0x180148e3e`: `min(missing, 10)` recursive `data = NULL` decodes,
  sequence from `Frame+0x98`) ⇒ ~11× decode work and ~230 KB of `Frame` churn per packet. Resource
  exhaustion. **INFERRED, not measured.**

---

## 7. Method notes worth carrying to the next wave

Recorded because each of these produced a **wrong confident answer** somewhere in this corpus and
each will recur.

1. **A `.pdata`-scoped or displacement-scoped sweep cannot support "the only X is Y".** Three
   over-broad negatives were caught this wave (`fmtstate`'s `+0xd8` writer — REFUTED by a
   base-shifted alias; `wirefields`' `+0x48/+0x4c/+0x54` reader set — incomplete; `opus`' IAT-only
   "no local gate" — right answer, wrong evidence). Type-directed enumeration (RTTI → vtable →
   holders) reproduced all three conclusions on sound evidence. Prefer it.
2. **Tools must be validated against the shape they exist to find.** The reclaim sweep's
   `break`-at-first-`call` reduced a nominal 260-instruction window to a **measured median of 7**,
   producing a zero that was close to tautological. Before trusting a sweep's negative, measure its
   actual coverage on its own inputs.
3. **Rule 5 (asymmetry inside one function) paid twice this wave, both times negative** — the
   `AudioOutputStream` input pair `+0xd8/+0xdc` **is** refreshed from the peer format while the
   output pair `+0xe0/+0xe4` is **not**, and the validated side is the one that reaches the buffer
   arithmetic; and the VP8 NEAREST/NEAR arm that skips `need_to_clamp_mvs` is sound because ±128 is
   strictly inside the ±152/±144 tolerance the predictor needs. A clean negative from Rule 5 is a
   result, not a dead end.
4. **State the distinguishing observation before measuring.** Two findings this wave were flagged
   for skipping it (the ratchet-DoS magnitude; the LFH-vs-16-byte tolerance hypothesis, whose
   alternative was mis-specified at 64/128 when Windows LFH granularity in that range is 32).
5. **Do not defer the check that decides your own verdict.** The `fmtstate` finder rated its result
   `open` with the note *"I did not open `W5-CRUX-f4-2-content-control.md`"*; the two-minute lookup
   it deferred killed the finding twice over (72 B vs 1923 B size class; offset 0 vs the 244 B
   unwritable prefix — and W6 §6 had already culled 72 B a wave earlier).
6. **Address hygiene.** At least one quoted "killing instruction" (`0x1801b36ea`) was **not an
   instruction boundary** and one function was mis-attributed (`0x1801a5880` is the encoder-side
   allocator; the decoder/common `vp8_alloc_frame_buffers` is `0x180186080`, and only there is the
   `mb_cols·16 == aligned_width` identity — on which the entire predictor-bound argument rests —
   visible). Both negatives survived re-derivation, but transcription is not re-reading.

---

## 8. One-line verdict

**CONFIRMED:** a remote, authenticated call peer has a byte-exact content-controlled UAF write and a
process kill in an unsandboxed, CFG-free process, from 405 bytes of VP8.
**NOT ESTABLISHED:** any path from that primitive — or from any of the five other surfaces swept
this wave — to code execution.
**OPEN, in order:** the array-shaped reclaim corpus across the ~212 unswept heap-sharing modules
(settled cheapest by one live `malloc` detour in the F4-2 window); VP8 post-processing (settled by
finding or failing to find the writer of `[r12+0x4ba]`); the fdk-aac leg; the Dispersive tunnel data
path and the pre-verification mbedTLS handshake (settled cheapest by whether anything ever writes
`certificates/ca-cert.pem`); and CVE-2026-1861, which needs one lookup by someone whose ROE permits
it.

*Static analysis and local harnessing only. No network traffic to Wickr or any third party, no
calls, `WickrPro` not launched. All work performed on the operator's own machines under an
authorised assessment.*
