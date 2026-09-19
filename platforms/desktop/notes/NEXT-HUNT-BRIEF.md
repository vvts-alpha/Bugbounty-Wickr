# NEXT HUNT BRIEF — start here when re-searching AWS Wickr Desktop

> ## ██ 2026-08-03 (W15) — A1: F1's GATE IS PRICED, AND A SINGLE CALL PEER CANNOT OPEN IT. READ THIS BEFORE THE W15 CHAIN BELOW. ██
> The foundation question nobody asked in four waves. **`vp8_yv12_realloc_frame_buffer` has no internal
> cap and no integer-overflow gate:** the size math is 32-bit (`lea eax,[r9+r10*2]` / `movsxd rbp,eax`)
> but VP8 dims are 14-bit, so at the **max legal 16383×16383** `frame_size` is only **387 MiB** — 2^31
> is 2048 MiB, no wrap. **The gate opens only on a genuine `vpx_memalign` failure; no geometry forces
> it.**
> **One peer's ceiling:** 4 yv12 buffers × 387 MiB = **1548 MiB** (reproducing F3's measured
> "+2017 MiB from a 34-byte frame"), ×2 contexts = **~3.0 GiB from one peer**.
> **Operator host measured:** 24.3 GiB RAM, commit limit 27.9 GiB, **13.4 GiB free**, and
> **`AutomaticManagedPagefile = True` — the limit GROWS under pressure.**
> ⇒ **≈4.4 concurrent malicious publishers are needed just to reach the current limit, more as the
> pagefile grows. A single call peer cannot do it on a normally-configured host.**
> **Consequence: the whole W15 §3.9–§3.15 chain is VOID for the two-party call — the "malicious
> contact" scenario the goal names.** It survives only under a narrower model: a **group call with
> several colluding publishers**, a **constrained host** (small RAM / fixed small pagefile — which is
> how the live F1 demo was staged, with a Job Object cap), or **E6**'s 1.07 GiB-per-frame BGR32
> conversion stacking on top (still unmeasured, and now the highest-value open item on this line).
> The design work below is correct and reusable, but it was built on an unpriced foundation.
> *(F3's memory-exhaustion DoS is unaffected and stands on its own.)*
> **E6 does not rescue it either (§10a).** Two facts found while tracing it both cut against the
> attacker: the I420 plane buffers are **recycled, not accumulated** (`cmp [rsp+0x20],eax / jae` @
> `0x1406e9790` reuses a big-enough buffer), and the reconstructed frames are **refcounted and freed**
> (`lock xadd [rbx]` / `cmp eax,1` @ `0x1406e8e99`, then `operator delete` @ `0x1406e8ec0`). Granting
> E6 its full claim as a one-shot high-water allocation gives `3.0 + 1.07 = ~4.1 GiB` from one peer
> against 13.4 GiB free and rising. **RESIDUAL: I did not locate the BGR32 conversion itself** (it may
> be in `Qt6Gui.dll`/`Qt6Quick.dll`, now available) — so this is "very unlikely to rescue it, on two
> pieces of contrary evidence", **not** "refuted".
> **⇒ WHERE THIS LINE ENDS: F1-based peer-originated RCE is not available against a two-party call on
> a normally-configured host.** What remains open on this theme, in order: **(i)** the group-call
> scene graph — one log answers whether `NetworkSink` appears, which also decides W14's receive→send
> negative; **(ii)** the `Qt6Gui.dll` image codecs (`qtiff`/`qgif`/`qico`/`qtga`/`qwbmp`/libpng/
> libwebp) — W16 notes they are on the ordinary CRT heap at the **message-peer** position, **a surface
> that needs no F1 gate at all**; **(iii)** `Qt6Network.dll` egress for the leak question.


> ## ██ 2026-08-04 (W16d) — █ THE WEB LAYER IS OPERATOR-OWNED AND ALREADY REPORTED. DO NOT RE-DERIVE IT. ██
> **Operator-supplied, not re-verified here.** The full web-layer chain is already found and reported by
> the operator: **docx HTML-injection → CSP bypass → XSS in the preview iframe → the QWebChannel bridge.**
> The CSP bypass uses the **third-party origin allow-listed in `frame-src`**
> (`https://main.d4zeeqgazhley.amplifyapp.com/`, alongside `https://fast.com/`). Anything found in the
> preview/React/CSP surface is **inside that chain and will triage as a duplicate.**
> **Consequences for future waves:**
> * **A8's verdict is OBSOLETE.** A8 concluded the renderer→native chain "is broken at attacker JS
>   execution" because of CSP + escaping. Script execution is achieved. Anything resting on A8's negative
>   must be re-derived — including any triage that filters Chromium CVEs by "needs script" (see §3b.1 of
>   the W16 addendum, where exactly that mistake was made and corrected).
> * **The bridge is therefore reachable.** `WebChannelMessageBridge`'s callable surface was enumerated
>   from the moc table this wave and includes **`getAwsCredentials`**, `verifyUser`/`verifyUserMls`
>   (identity-verification state), `sendTextMessage`/`sendFiles`/`createRoom` (impersonation),
>   `saveGeneralFile`, `getDesktopLogsForDate`/`saveLogs`, `startCall`, `shredderAction`. Recorded for
>   impact analysis — **the access itself is the operator's finding, not ours.**
> * **The one variant worth adding to the EXISTING docx report** (not a new finding):
>   **`renderAltChunk`** in `blob_01ad4d87.js` — `docx-preview` renders `<w:altChunk>` by putting the raw
>   part content into **`iframe.srcdoc`**, i.e. a WHOLE attacker HTML document, vs `renderSymbol`'s
>   `&#x{char};` fragment. `loadAltChunk` reads the part as a raw **string** with no parsing or
>   sanitising. **The option defaults to ON** (`renderAltChunks:!0` in the library's defaults) and
>   **Wickr does not override it** — `renderAltChunks` occurs nowhere else in the 3,881 carved resources.
>   ⇒ **if the vendor fixes only `renderSymbol`, this stays open.** One-line mitigation:
>   `renderAltChunks: false`.
> **✗ Non-duplicate web-layer leads that were checked and are NEGATIVE:** PPTX (`DOMPurify.sanitize` with
> `USE_PROFILES:{html,svg}` — a bypass would be a **DOMPurify 0-day**, out of scope); PPTX/docx
> unsanitised CSS → `<style>` (**CSP neuters it**: `img-src`/`connect-src`/`font-src` allow no arbitrary
> remote origin, so no CSS exfiltration); PDF preview (pdfjs 4.10.38 — **zero** `innerHTML`/
> `dangerouslySetInnerHTML` sinks, builds DOM via `createElement`); main-app message rendering
> (`MarkdownIt({html:!1})` + ProseMirror node construction, no `DOMPurify.sanitize` call sites).
> A sink sweep over all 3,881 carved resources found sinks in **only two** chunks: the main bundle
> (A8-audited; sole app use is an app-shipped SVG icon) and the docx chunk. **No HTML-injection path
> outside docx was found.**
> **Only unexplored non-duplicate web lead left:** the **link-preview** path (bridge signals
> `linkFavIconAdded` / `linkImageAdded` — remote-derived content rendered in the main app, outside A8's
> scope).
>
> ## ██ 2026-08-03 (W16c) — ★★★★★ TWO UNPATCHED Qt CVEs, PEER-REACHABLE, BOTH CRASH THE SHIPPED BUILD (EXECUTED) ██
> **`https://download.qt.io/archive/qt/6.9/` needs NO authentication and hosts Qt's own published CVE
> patches for the 6.9 series. Nobody in this engagement had looked.** Read §4m / §4m.1.
> ```
> CVE-2025-10728-qtsvg-6.9.diff  01-Oct-2025     CVE-2025-12385-qtdeclarative-6.9-0001/2.diff  24-Nov-2025
> CVE-2025-10729-qtsvg-6.9.diff  01-Oct-2025     CVE-2025-14575-qtbase-6.9.diff               19-May-2026
> ```
> **The timeline is the finding:** shipped Qt DLLs are dated **2025-09-17** (Qt 6.9.2), the qtsvg patches
> were published **2025-10-01**, and **`WickrPro.exe` is dated 2026-07-13** — ~9 months after the patches
> were public, without them.
> **F8 — CVE-2025-10728 (stack overflow, recursive `url()`), CONFIRMED + EXECUTED.** The fix's warning
> string (`"The pattern is trying to render itself recursively…"`) occurs **0 times** in the shipped
> `Qt6Svg.dll` while `qt.svg.draw` and 24 other diagnostics survive ⇒ missing fix, not stripped strings.
> A **94-byte SVG** (OSS-Fuzz id 390467765, the case Qt's patch calls "another, still unfixed stack
> overflow") crashes `QImage::loadFromData(bytes, format=NULL)` with **`0xC00000FD`
> EXCEPTION_STACK_OVERFLOW, 3/3 runs**; the **gzip `.svgz` variant (100 B) too**.
> **F9 — CVE-2025-10729 (dangling pointer / UAF class), CONFIRMED + EXECUTED.** Upstream's own test
> comment: a `QSvgPattern` is created with a `QSvgPatternStyle` referencing it, then deleted as misplaced,
> leaving the style pointing at freed memory (found by ASAN/UBSAN). A **90-byte SVG** hard-aborts the
> shipped build with **`0xC0000409` (`__fastfail`)**. The three inputs separate cleanly —
> `0xC0000409` / `0xC00000FD` / `0x0` — which is itself evidence of three distinct paths.
> *(Honest limit: `0xC0000409` is `__fastfail`'s generic status; the mitigation category was NOT
> determined. Say "mitigation-detected corruption + hard abort", not a specific primitive. **Both are
> remote DoS; no exploitability claimed.**)*
> **Attacker position for both: anyone who can send content** — `qsvg.dll` declares `image/svg+xml` AND
> `image/svg+xml-compressed`, decode is `format = NULL`, so the **sender picks the parser by sniffing**.
> PoCs: `scratch/w16/svgpoc/`. **Still open: CVE-2025-12385 (qtdeclarative ×2) — gating question is
> whether any QML `Text` renders peer content as RichText, NOT the patch state. CVE-2025-14575 (qtbase,
> `QSslCertificate::fromPath`) takes an app-supplied argument ⇒ not peer-reachable, deprioritised.**
> **★ METHOD THAT TRAVELS: for Qt-level CVEs the backport question IS decidable** (unlike Chromium's,
> §4l.1) — fetch the patch, find a string the fix adds, test the shipped DLL, then execute the
> regression input the patch itself provides.
>
> ## ██ 2026-08-03 (W16b) — ★★★★★ THE RENDERER IS THE LIVE SURFACE, AND THE REACHABLE NATIVE SUBSYSTEM IS NAMED ██
> **Read `W16-CRUX-f4f-refuted-partitionalloc.md` §4k / §4k.1.** W8/W11 tried to settle the renderer by
> *version archaeology* and failed for want of a baseline. The right first question — **does peer content
> reach Chromium, and in what confinement?** — is answerable from shipped bytes, and now is.
> **(1) Peer content reaches Blink.** Received files are auto-previewed in a same-origin `qrc:` iframe
> (`{pdf, docx, xls/xlsx/csv, pptx, xml/rss, txt/log/md, rtf}`); the peer controls the bytes AND the
> extension that picks the renderer. A8 proved CSP blocks attacker *JS* — **but CSP does not constrain
> memory safety**, and no wave has assessed the renderer's.
> **(2) Confinement measured (the good posture, so the bar is high):** separate `QtWebEngineProcess.exe`;
> **no `--no-sandbox`** in `WickrPro.exe` (ASCII *and* UTF-16); app never sets `QTWEBENGINE_DISABLE_SANDBOX`;
> **DevTools remote debugging OFF** — `0x1408d3ba0` drives `QTWEBENGINE_REMOTE_DEBUGGING` from the global
> `0x143498F70` (`==3`→unset, `0/1/2`→ports 3001/3002/3003, override at `0x1434F7A08`), and the shipped
> static initialiser is **4**, matching no branch ⇒ never set. *(Minor: only the `==3` path unsets, so a
> pre-existing env value would survive on other channels.)*
> **(3) ★ THE REACHABLE NATIVE SUBSYSTEM, NAMED.** Re-carved the qrc resources (`scratch/w16/qrccarve.py`;
> 4,001 zlib streams → 3,881 resources, carve identities match A8). `blob_00e4886f.txt` is the
> **licence manifest = a full SBOM: 209 JS deps with versions** — attacker-facing: `@e965/xlsx` **0.20.3**,
> `docx-preview` **0.3.5**, `jszip` **3.10.1**, `pdfjs-dist` **4.10.38**, `dompurify` **3.2.5**,
> `highlight.js` **11.8.0**, `markdown-it` **14.1.0**. *(Architectural correction: previewed PDFs use
> **PDF.js**, NOT native Qt6Pdf/PDFium — F4f's `QImage::loadFromData`/`qpdf.dll` path is a different
> surface.)* And in the PDF.js chunk `blob_01970d15.js`: `createNativeFontFace(){ ... new FontFace(
> this.loadedName, this.data, {}) }` — **`this.data` is the font program PDF.js rebuilds from the
> attacker's PDF, handed to the NATIVE FontFace API** (OTS → Skia/FreeType/DirectWrite); a
> `createFontFaceRule()` variant reaches the same place via CSS `@font-face`.
> **⇒ peer PDF → auto-preview → PDF.js → `new FontFace(attacker-derived bytes)` → Chromium 130's font
> stack. No script execution needed, so A8's CSP result does not touch it.** The CVE class that matters
> is therefore **Chromium font-stack (OTS/Skia/FreeType) in the `130 → present` window**; second tier is
> embedded docx/pptx/xlsx images reaching the image decoders. *Constraint: PDF.js rebuilds fonts, so what
> reaches `FontFace` is its reconstruction, not raw bytes — narrows control, does not remove it.*
> **Nothing exploited; no CVE matched to this build.** **Blocking artefact is unchanged and NOT on this
> host** (scanned: Chrome 150, Island 144, Edge/EdgeCore/EdgeWebView 150–151, Playwright 145 — none in
> `[130.0,134.0)`): a **stock Qt 6.9.2 QtWebEngine** reference build, or a Chromium in that window.
>
> ## ██ 2026-08-03 (W16) — ✗✗ F4f IS NOT AN OUT-OF-BOUNDS WRITE. RETRACT IT BEFORE THE REPORT GOES OUT. ██
> **Read `W16-CRUX-f4f-refuted-partitionalloc.md`.** Measured on the shipped `Qt6Pdf.dll` through
> WickrPro's own decode call (`scratch/w16/jpxwatch.c`): of the 512 stores the PoC drives,
> **0 leave the `tp_index` allocation.** The old harness counted *failures of the upstream guard*
> (`current_tpsno < nb_tps`) and reported them as out-of-bounds writes. They are not the same thing.
> `nb_tps` stays 0 on the TNsot=0 path **while the array is grown by `opj_realloc` to `(TPsot+1)*24`
> before every write** (`0x1802575cb`–`0x180257600` in `opj_j2k_read_sot` = **`0x1802570b0`**, found
> via the marker table `0x1803fb490`; the first allocation is `calloc(10,24)` = **240 B**, not 24 B).
> The other branch is closed too: `TPsot >= TNsot` is rejected at `0x1802572ed` and `read_sot` returns
> FALSE, so the premise "TPsot and TNsot are independent" is **refuted**. Measured
> `cur_nb_tps == TPsot+1` at 494/512 stores, greater at the rest; destroyed values
> `zero=423 scalar=89 module-ptr=0 heap-ptr=0`. **⇒ five write primitives in this engagement, not six.**
> *(Residual: `tp_index == NULL` at SOD is the one unguarded case not constructed; it would be a
> near-NULL write = crash.)* Also measured: the four `scratch/w13/jpx/*.pdf` files reach
> `opj_j2k_read_sod` **zero** times — only `jpx3/` exercises the path.
>
> **★ AND THE POSITIVE RESULT, WHICH INVALIDATES EVERY GROOMING PLAN FOR THIS SURFACE:**
> **`Qt6Pdf.dll` does not use the process heap at all — it links PDFium's PartitionAlloc.**
> `tp_index` is page-aligned in a **256-byte-bucket slot span**, no process heap claims it
> (`HeapValidate` over all 6), the preceding page is uncommitted, and the rest of the page is a
> freelist of `{next, ~next}` pairs (`0xFFFFF097FF943DFF == ~0x00000F68006BC200`, exact). The image
> carries the partition names **`GeneralPartition`/`StringPartition`**. ⇒ bucket segregation, guard
> pages, and a shadowed freelist; **and freelist poisoning is unreachable for any zero-extended-32-bit
> primitive**, since the shadow needs `0xFFFF…` in its high half. **The other selectable decoders —
> `qtiff.dll` (libtiff 4.5.1), `qgif`/`qico`/`qicns`/`qtga`/`qwbmp`, libpng/libwebp in `Qt6Gui.dll` —
> are NOT PDFium and DO use the ordinary CRT heap** (they show up in the ledger). At the identical
> attacker position they are the materially better substrate. Reusable instrumentation:
> `scratch/w16/jpxsurvey.c` (UCRT-IAT allocation ledger + module/section classifier over all loaded
> modules), `jpxwatch.c` (per-store watcher), `d16.py` (`.pdata`-bounded disassembler for any shipped
> binary), `iatx.py` / `ref16.py` (byte-exact IAT- and VA-xrefs, immune to the W15 linear-sweep defect).
>
> **✗ AND THREE PEER-LEAK ROUTES CLOSED THE SAME WAVE (§4a–§4c of the W16 note).**
> **(1) The uninitialised-slack class is closed, on the right site set.** W15's "the `Frame` allocator
> `0x180135ea0` does not zero the inline payload — 32 sites, 4 checked, 28 unexamined" used the wrong
> set: it has **20** direct sites, **17 pass a real payload pointer**, and the inline (uninitialised)
> case has exactly **one wrapper — `0x180135e80` — with 12 callers**. All 12 read: `CryptProxy`
> memsets; two audio assemblers `memcpy` **exactly** the allocation; `FdkAacEncoder` ×2, `0x180148fa8`
> and `0x18014baf1` all **trim `[frame+0x60]`** to the codec's real return; `0x1803dcad5` allocates no
> inline payload; the rest are capture-side. **No inline-payload Frame reaches the wire with untrimmed
> slack.** *(Residual, and it is not an address leak: capture-side slack would be Opus/AAC-encoded.)*
> **(2) The one that looks exactly like the classic fdk-aac overflow is bounded by the library.**
> `0x180147c30` is **`FdkAacDecoder::process`** (ctor `0x180147020` carries the literal; the recursion
> at `0x180147ce5` is PLC). It allocates a **fixed 8192 B** frame and calls
> `aacDecoder_DecodeFrame(self, [frame+0x10], timeDataSize = [frame+0x18]>>1 = 4096 samples, flags)`
> at `0x1801d87d0` — **no channel term** — and `canAccept 0x180148cc0` validates **only the codec id**
> (`cmp [rax+0x10],0xa`) while the peer supplies the `AudioFormat`. It still does not overflow:
> fdk-aac checks `timeDataSize >= numChannels*frameSize` itself (`imul r8d,[rbx+0x49c]` @ `0x1801d9fa8`,
> `cmp edx,r8d` / `jge`, else `r13d = 0x200c` = `AAC_DEC_OUTPUT_BUFFER_TOO_SMALL`). **NEGATIVE.**
> **★ (3) W14's LAST QUALIFIER IS GONE — `NetworkSink` cannot exist in any WickrPro scene.** The only
> creator, **`NPLAVNetSinkCreate 0x1803d0730`, has 0 internal direct callers and 0 qword occurrences
> anywhere in NPL's image** (so no vtable/table dispatch either), and `WickrPro.exe` — which imports 96
> NPL exports — **does not import it**; the strings `NPLAVNetSinkCreate` / `NPLAVNetSink` /
> `NPLAVNetSource` / `NetworkSink` occur **0 times** in the 55 MB binary, so there is no
> `GetProcAddress` path. ⇒ the upstream feedback bus carries a NULL payload in **every** reachable
> configuration, group calls included. **The "a group-call scene containing `NetworkSink` would re-open
> it" hedge in W14 and W15 §5 can be deleted, and no third account is needed to settle it.**
>
> **★★★ AND F1's ALLOC-FAILURE GATE IS NOW MEASURED, NOT ASSUMED — §4e, `scratch/w16/f1gate.c`.**
> The harness drives the **shipped** `vp8_alloc_frame_buffers 0x180186080` and can force any single
> allocator request to return NULL (VEH at the allocator entry: `rax=0`, `rsp+=8`, `rip=[rsp]`).
> **(a) The dangling pointer reproduces deterministically on shipped code** — prime, then fail request
> #5: `mip == NULL, mi != NULL`, `mi` still pointing **inside the freed block**. **(b) It is nine
> chances, not "six failure exits": there are 9 allocator requests per call and EVERY ONE tested
> (#0,#4,#5,#6,#7,#8) yields the dangling pointer.** **(c) The demand is peer-tunable over three orders
> of magnitude** — measured totals per call: **640×480 → 2.9 MiB**, 1920×1080 → 17.2 MiB,
> 4096×4096 → 129.1 MiB, **16383×16383 → 2013.1 MiB** (largest single request 0.5 MiB → 387.0 MiB).
> ⇒ the attacker picks the geometry, therefore picks the demand, and can **sweep geometry upward until a
> call fails** with no advance knowledge of the victim's memory. The honest precondition is *"at some
> moment the process cannot satisfy an allocation the attacker sizes"*, **not** *"the commit limit cannot
> grow"*. **The gate is not removed — but it is much weaker than recorded, and nothing was sent.**
> **(d) ★ §3.15's band arithmetic is validated on shipped code:** measured `mi − mip` =
> **228 / 304 / 380 / 3192** at 16×16 / 32×32 / 48×48 / 640×480 = exactly `(mb_cols+2)·76` from the user
> pointer ⇒ `P = 16 + (mb_cols+2)·76` = **244 at `mb_cols=1`**, so `K = 0xd8` (216) really does land in
> the first band (`216 < 244 ≤ 248`), and `mb_cols=1` just needs a **16-pixel-wide frame**.
> **(e) The F1-producible block sequence is measured:** request = `76·(mb_rows+1)(mb_cols+1)`
> (304/456/608/760 at width 16 — steps of 152), raw block = **that +23**. §3.15's open check (4) is now a
> one-line test per class.
>
> **✗✗✗ AND THEN §3.15 ITSELF WAS CLOSED — ALL 42 CANDIDATES FAIL CHECK (2). Read §4f/§4f.1/§4f.2.**
> The route needs `interface+0x28` — the field `Command2::execute` loads into `rax` and jumps to — to
> hold a code pointer. **`K=0xd8`, the modal 26 of 42 (every AV graph node): `PacketSender+0x10` is a
> `RTL_CRITICAL_SECTION` (`InitializeCriticalSectionAndSpinCount(&cs,0xfa0)` @ `0x180132032`), so
> `+0x28` is its `LockSemaphore` — a kernel HANDLE, not a pointer** (`+0x20` = `OwningThread`,
> `+0x38`/`+0x40` ctor-zeroed ⇒ the argument slots are inert too). **`K=0x138` (5): `FdkAacDecoder`'s
> ctor plants `0x180443ff0` at `+0x160` — `.rdata`, non-executable, window `0x44`.** Then
> `scratch/w16/slot28.py` ran the screen over **all 13,498 `.pdata`-bounded functions** for every
> candidate `K`: the planted pointers sit in windows **0x44/0x49/0x4c/0x4d — not one in window `0x42`**,
> and the rest have no static plant at all. ★ The screen is one line because measured NPL layout is
> `.text 0x001000-0x4235fe` (exec) / `.rdata 0x424000-0x52d7c2` (IAT `0x424000-0x4250f8`): **window
> `0x42` is the ONLY 64 KB window holding both executable code and the IAT**, and a 2-byte
> ASLR-invariant overwrite cannot leave its own window. Robust against "maybe it is runtime-filled": the
> `K=0xd8` field is a CS member whose runtime value is a HANDLE, and a runtime **heap** pointer fails the
> same screen since no heap window contains NPL code. **⇒ the leak-free route is dead; §3.15 works only
> WITH an information leak — the very thing §3.14 claimed to have removed.**
>
> **Messaging surface, started not finished (§4g).** `WickrMlsSdkCpp.dll` egress is 11 call sites
> (`WSASend` ×1, `send` ×7, `sendto` ×3) but that is the **transport to the server**, not the peer-visible
> payload; the MLS core is **Rust (`mls_rs`)**, so the C++ wrapper is where to look. **`QByteArray::resize`
> (uninitialised in Qt 6) is called exactly 5 times in the whole 55 MB `WickrPro.exe`** — four are Qt's
> bundled QZip, and Wickr's own (`0x14095658a` in `0x1409562e0`, `"mask_hash"`/`"sync_mask"`) resizes to
> **1**, i.e. one uninitialised heap byte at an uncontrolled offset. **Not an address leak.**
> *(Dead end: `"+recv_data; auto-releasing padded length of "` is the Rust `h2` crate's HTTP/2 flow
> control, not Wickr message padding.)*
>
> **★ TOOLING DEFECT THAT TRAVELS — `NPL.dll`'s LOG LITERALS ARE UTF-16LE (§4j).** An ASCII search of
> the shipped `NPL.dll` for `"Sending feedback packet"`, `"feedback packet"`, `"event id is"`,
> `"Sending EVENT"`, `"Sending FORMAT"` returns **0 hits for all five — and all five are present**, as
> wide strings (`0x18043f2a0` = `"Sending feedback packet, event id is "`, byte-verified). Counts over the
> image: `"Sending"` ASCII 0 / UTF-16 3; `"feedback"` ASCII 0 / UTF-16 4. The binary is **mixed** —
> third-party code (libopus, fdk-aac, WebRTC) logs in ASCII, Musigy's own `LOG()` is wide — so an ASCII
> census returns plausible hits and silently misses every Wickr string. **W14's `0x18043f2a0` and W15 §5's
> send-site literals are CORRECT; what is wrong is any ASCII-only census** (including my own §4g claim that
> NPL has 0 padding strings — withdrawn). `scratch/w16/ref16.py` is ASCII-only: **fix it or work around it
> before using it on NPL, and re-run any earlier string-driven census over this DLL.** Re-run under the
> fix, every §4a/§4b identification survives and is now confirmed by name (`CryptProxy` via
> `"Padding/packet size mismatch"`, `FdkAacDecoder` via `"aacDecoder_DecodeFrame"`, `OpusDecoder` via
> `"opus_decode failed"`, `OpusEncoder`, WebRTC `AudioProcessing`, screen capture).
>
> **★★★★ NEW — F7: A PEER-DECLARED LENGTH BECOMES A FRAME'S PAYLOAD SIZE OVER THE RECEIVED BUFFER,
> WITH NO CHECK. The first peer-triggerable OOB READ in this engagement (§4i).**
> `Parser`'s handler `0x18011fce0` parses the peer's bytes (`ParseFromArray` @ `0x18011fd61` →
> `[Parser+0xe8]`) and switches on the peer-chosen kind `[msg+0x64]` to three handlers, all called with
> `(Parser, parsed peer message, received Packet)`. **The kind-3 sibling `0x18011ea60` builds its Frame
> from ONE object** — `mov r8d,[r15+0x18]` / `mov rdx,[r15+0x10]` @ `0x18011ec70` — proving
> `Packet+0x10`/`+0x18` is the (ptr,len) pair. **The kind-2 handler `0x18011ef70` does not:**
> `mov r8d,[r14+0x18]` @ `0x18011efef` where `r14 = [peer_msg+0x30]` (a sub-message, has-bit tested at
> `0x18011efac`, protobuf default `0x180530b58` whose `[+0x18]=0`), while `mov rdx,[rsi+0x10]` @
> `0x18011eff3` takes the pointer from the Packet. **`[rsi+0x18]` — the Packet's own length — is never
> read anywhere in the 2,343-byte function. No bound check.** The Frame is then pushed to BOTH sinks via
> `PacketSender` (`lea rdi,[r13+0xd8]`, `EnterCriticalSection` on `+0x10`, `call [rax]` on `[+0x38]` and
> `call [rax+8]` on `[+0x40]`) — which independently re-confirms the §4f layout.
> **CONFIRMED: a remotely triggerable OOB read of attacker-chosen length (remote DoS at minimum).**
> **BOTH open items are now ANSWERED (§4i.1). (1) POSITIVE:** the sub-message's vtable `0x180442358`
> resolves via its COL to **`Musigy::AV::Proto::PacketHeader_Buffer`**, and `+0x18` is the **first
> declared field** of a protobuf message (vptr / metadata / has-bits / cached-size occupy `+0x00..+0x17`)
> — peer-provided, and **nothing between `ParseFromArray` and the Frame clamps it**, so the declared
> length is an arbitrary 32-bit value. *(No allocation cost: with a payload pointer supplied the Frame
> allocator only stores `[frame+0x40]=ptr` / `[frame+0x60]=size`.)* **(2) NEGATIVE:** the two sinks are
> downstream AV receivers, and W15 §3.6's BFS to the complete egress set returned **0 at depth 3, 5 and
> 7**, while §4c makes W14's receive→send disjointness unconditional. **⇒ F7 is a remotely triggerable
> OOB READ with an attacker-chosen 32-bit length — a clean remote DoS, reportable on its own — but NOT
> an information leak, and it does not supply the address the RCE chain needs.**
>
> **★★★★ THE LIVE HEAP REGIME AND GROOMING ARE MEASURED, AND BOTH ARE FAVOURABLE — §4h.**
> W15 §4 listed these as NOT ESTABLISHED ("adjacency is not demonstrated ... the Segment Heap may back
> these sizes — not observed on the live target"). Settled with `scratch/w16/groom.c` / `groom2.c`,
> allocating through the **same `ucrtbase`** the shipped DLLs use.
> **(1) Regime:** `WickrPro.exe`'s manifest has **no `<heapType>SegmentHeap</heapType>`** (read in full),
> so it is the classic NT heap — and measured, **one heap `0x80004A0000` serves every peer-relevant class
> with `HeapCompatibilityInformation = 2` (LFH)**. The Segment Heap question is closed.
> **(2) Adjacency, 512 allocs/class:** `SerializerFormat` 0xe8 stride 240 → **93.5%**; `AudioFormat` 0x100
> stride 272 → **94.7%**; `VideoFormat` 0x140 stride 336 → **94.1%**; F1 327 B stride 336 → **95.7%**;
> F1 479 B stride 496 → **94.3%** exactly-adjacent pairs.
> **(3) ★ Reclaim is COUNTED, not probabilistic — the link-(a) question.** Immediate reuse is ~0 (the
> W15 FORMAT cycle alloc-new-then-free-old hit the freed block **0/200**), but freeing then allocating
> repeatedly reclaims the block in **200/200 trials** for every class, at a fixed index:
> **F1 327 B → exactly 43, in 200 of 200 trials**; F1 479 B → [8,15] in 199/200; `VideoFormat` → [32,63]
> in 199/200. ⇒ placing a reclaiming object on the freed mode-info block is *free the array, then drive
> the target class exactly N times* — and the peer has an unbounded on-demand driver for those classes.
> **(4) It survives contention:** with a second thread churning the same bucket, still **200/200**, with
> **192/200 inside an 8-slot window**.
> *Qualifiers: harness process, so the constant 43 will differ live — what transfers is the mechanism and
> the reliability. Nothing sent; this supplies no call target and no address, so §4f.2 and the missing
> leak stand.*
>
> **Decoder fuzzing: ~85M iterations across 12 campaigns on the non-PDFium handlers — 0 crashes.**
> Coverage is real (49% of mutations decode; 75-88% for wbmp/bmp/ico/icns), and PixarLog/Deflate needed a
> hand-built zlib stream (`zlib_stored()` in `imgmut.c`) to be reachable at all. Seeds cover TGA/WBMP/BMP/
> ICO/ICNS/GIF and 12 TIFF compressions.

> ## ██ 2026-08-03 (W15) — THE BINARIES WERE NEVER GONE. `desktop/binaries/` IS A 7-FILE WORKING COPY; THE MACHINE HAS 287. ██
> **Every "cannot be confirmed, the DLLs were deleted" statement in this engagement rests on a false
> premise.** The install is at `%LOCALAPPDATA%\Programs\Amazon Web Services, Wickr` and contains
> **287 binaries**, including **`Qt6Pdf.dll` (5.5 MB)**, `Qt6WebEngineCore.dll` (196 MB),
> `Qt6Network.dll`, `Qt6Core.dll`, `Qt6Gui.dll`, `qjpeg.dll`, `qpdf.dll`. Nobody ever looked outside
> the working copy. **Re-open every negative whose stated reason was "the DLLs are gone."**
>
> **First thing measured with them — and it closes ASLR-ASSESSMENT's "largest open question", in the
> unfavourable direction.** Over all 287 (`DllCharacteristics` + `RELOCS_STRIPPED`):
> **NO-ASLR modules: 0. Non-high-entropy: 0. Missing NX: 0. `GUARD_CF` set: 276 of 287** (reproducing
> F4b's count exactly against the real install). ⇒ **Route B — a fixed-address third-party module — is
> CLOSED. There is no free ASLR bypass in the shipped file set.** Consequence: the partial-pointer
> overwrite is **the only** address-layer route, so §3.14/§3.15's F1 lattice work is now the main line,
> not an alternative.
>
> **What this unblocks (all previously "unresolvable"):** `Qt6Pdf.dll` version-diff for **F4f /
> CVE-2026-2648** (W13's ranked #2, "exploitation already solved, only bug existence unknown");
> the **messaging egress** in `Qt6Network.dll`; the **renderer surface** in `Qt6WebEngineCore.dll`;
> and Route A's return-channel question, which was closed as "lives in the deleted DLLs".


> **★★★★★ 2026-08-03 (WAVE 15) — THE CALL PEER HAS ITS OWN PLACEMENT PRIMITIVE, AND THE
> PEER-ORIGINATED ROUTE NO LONGER NEEDS AN INFO LEAK. Read `W15-CRUX-peer-placement-primitive.md`.**
> E3 — unasked since Wave 4 — is **POSITIVE**. `Parser`'s FORMAT handler `0x18011ed00` dedups the
> peer's format blob by a **byte-compare against the immediately-previous format only**
> (`cmp r8,[rsi+0x10] / jne`, then `memcmp` @ `0x18011ed85`); anything different runs
> `Format::parse 0x18013da20` → **`operator new` of one of three peer-selected classes —
> `SerializerFormat` 0xe8, `AudioFormat` 0x100, `VideoFormat` 0x140 — each with a vtable pointer at
> offset 0** — then `0x180132d80` clones it again and `0x180132970` **frees the previous one through
> its own deleting destructor** (`mov edx,1 / call [rax]` @ `0x1801329df`). No rate limit anywhere.
> ⇒ **an unbounded, on-demand, mid-call alloc→free cycle of polymorphic objects in three
> attacker-chosen size classes. This is the reclaiming object link (a) hunted for three waves and
> declared not worth more candidates — because the constraint set has changed: the peer now chooses
> the placement.** It composes with W1 (chroma OOB, contiguous from `victim+0`, every byte
> attacker-controlled, `overflow=strideU/2`, `alloc=(h>>1)*strideU` as a *decoupled* second knob):
> **`strideU=16,h=33` → a 256-byte alloc with an exactly-8-byte overwrite of the neighbour's vtable
> pointer; `strideU=4,h=129` → the same bucket with a 2-byte overwrite.** The 2-byte row needs **no
> leak and no ASLR defeat** — Win64's 64 KB image granularity makes bits 0..15 invariant — and **CFG
> is inert (F4b)**. **CONFIRMED and load-bearing: NPL and WickrPro share one heap** — neither
> statically links the CRT, both import `malloc`/`free` from `api-ms-win-crt-heap-l1-1-0.dll`.
> The partial-overwrite menu is **enumerated**: the fake vtable `A` may be any byte offset in the
> window, so the callable set is `{[A+0x18]}` = **277 distinct NPL entry points** (Video/Serializer
> window) / **239** (Audio window), called with `rcx` = the `Format` object **whose fields the peer
> sets through the FORMAT protobuf**. Neither window contains any IAT entry, so no direct import call.
> **★★★ THE STRIDE QUESTION IS SETTLED, FAVOURABLY (§4a legs 5-7).** Nothing validates the stride
> anywhere — sink `0x1406e95d0`, forwarder `0x14011b6b0`, and `NPLAVPacketGetDescriptor 0x1803d0e50`
> are all check-free (the last is a pure struct copy, and the "truncating 32-bit `imul`" that
> ASLR-ASSESSMENT Route A attributed to it is **NOT in it**). `Packet::Packet 0x180135a40` copies the
> stride array verbatim (`[rsi+4] -> [r15+0x64]` = strideU), and **`VpxDecoder::process 0x180144520`
> computes it itself: `strideU = align4(d_w/2)` from the PEER'S FRAME WIDTH** (`mov eax,[r12+0x18] /
> shr eax,1 / add eax,3 / and eax,~3` @ `0x180145143`), not from libvpx's padded stride.
> **The live measurement proves this is the mode that runs: W1 was demonstrated at `strideU=320`, and
> `align4(640/2)=320` while libvpx's uv_stride for 640 is 352.** ⇒ `d_w=8, d_h=129` → `strideU=4`,
> `alloc=256` (the `AudioFormat` bucket), **overflow = 2 bytes — the partial vtable overwrite. The
> info-leak requirement does NOT come back.** *(Residual: the mode flag `[+0xc1]`'s writers were not
> identified; the mode is established from the measurement, not the flag.)*
> **The gadget search was run and it defines the boundary (§3.5):** of 499 callees across both
> windows, **3 reach a file import** (`fopen` ×2 at depth 2, `WriteFile` at depth 5) and **none reach
> `LoadLibrary`/`GetProcAddress`/`VirtualProtect` at depth ≤ 5**; there are **0** `call [rcx+X]`
> gadgets and 35 load-then-`call [reg+Y]`. A second stage does not help by itself — the peer can put
> *any* qword at `[rcx+X]`, but a *useful* one needs an address. **⇒ the leak-free route terminates at
> "call one of 499 NPL functions with a peer-controlled `this`".**
> **✗ §3.6 — THE DIRECTION I EXPECTED TO CLOSE IT WAS TESTED AND REFUTED.** The obvious finish was to
> drive one of the callable send-path methods (`PacketSender::onEvent 0x180132cc0` and siblings) with
> a controlled `this` to emit memory to the wire — a peer-positioned leak from the placement primitive
> itself. **BFS from all 499 callees to `sendto`/`send`/`SSL_write`/`BIO_write` (the complete egress
> set) returns 0 at depth 3, 5 AND 7.** Six functions reference those imports; none is reachable.
> **NEGATIVE — do not re-chase.**
> **✗ AND THE FRAME-SLACK CENSUS — the last identified candidate — IS ALSO NEGATIVE (§5).** Slack is
> only peer-reachable if the Frame reaches the wire, so the subset that matters is the send path
> (`Serializer` → `PacketPacer::SendPacket 0x1800b2160`). **All seven send-path allocations are now
> hand-read and every one takes the payload size from the object that supplies the payload pointer:**
> `Serializer` slot 3 `0x18011d05b`; **"Sending FORMAT packet"** `0x18011ddb4` (`rbp` resolved from
> the payload string @ `0x18011dd71`, `r8d=[r15+0x10]` = that string's size); **"Sending EVENT
> packet"** `0x18011e11e` (`mov rsi,[r15+0x10] / mov eax,[r15+0x18]`); the `Parser` feedback
> `0x18011fc76`; `OpusEncoder` and `FdkAacEncoder` (both fix `[rsi+0x18]` to the codec's real return);
> and `VpxEncoder` `0x18014177c` (`vpx_codec_cx_pkt_t.data.frame.{buf,sz}`). **11 of 32 sites
> hand-read, all negative; the 21 unread are all off the send path.** *(Qualifier: rests on W14's
> receive→send disjointness, which is MEASURED over two-party audio+video only — a group-call scene
> containing `NetworkSink` would re-open it.)*
> **★★★★ AND THEN THE PREMISE ITSELF TURNED OUT TO BE WRONG — §3.7. THE LEAK IS NOT REQUIRED.**
> §3.4 recorded "no IAT in either window" and §3.5 concluded the leak-free route caps out at "call one
> of 499 NPL functions". **That inference was wrong**: the 64 KB window is a property of *the object
> you corrupt*, not of the technique. Measured on the shipped `NPL.dll`: **all 524 imports live in RVA
> `0x424000`–`0x4250f8`, entirely inside the `0x420000` window — and 65 of NPL's 553 vtables are in
> that same window** (distribution `0x42`:65, `0x43`:147, `0x44`:120, `0x4a`:67, `0x4b`:28, `0x4c`:77,
> `0x4d`:49). ⇒ **a 2-byte ASLR-invariant write onto a window-`0x42` vtable pointer calls any import
> directly** — `VirtualProtect` (write low16 `0x4068`), `LoadLibraryW` (`0x4290`), `GetProcAddress`
> (`0x4288`), `WriteFile` (`0x4140`), `fopen`/`_wfopen` (`0x4dc8`/`0x4d78`). A is byte-granular and IAT
> entries are 8-aligned, so **all 524 are reachable**. Candidate objects: `Musigy::Internal::Command1/2/3<…ConnectionImpl…>`
> (`0x18042e0c0`…) — the Reactor's inter-thread queue objects, **one heap allocation per queued network
> event, i.e. peer-rate-driven** — plus `ConnectionImpl`, `Socket`, `PacketPacer`,
> `PacketPacerPacketPool`, `SecureConnection`, the `CongestionStrategy` family, and `RefCountedBase<1>`.
> **⇒ THREE SWEEPS HUNTED A LEAK THE TECHNIQUE DOES NOT NEED.** What actually remains is smaller and
> different: **(1)** adjacency/grooming re-solved for these classes' size classes; **(2) ★ argument
> setup — the real last mile**: the callee gets `rcx` = the corrupted object, and `LoadLibraryW(rcx)`
> wants a UTF-16 path while `rcx`'s first bytes *are* the vtable pointer; widening the overflow to
> control them destroys the partial-overwrite property. Unsolved. Read the `Command*` layouts first —
> their post-vtable fields are function-pointer/argument slots.
> **§3.8 — THE GAP IS NOW EXACT, AND THE IDEAL GADGET IS ALREADY IN THE BINARY.**
> `Command2<ConnectionImpl,…>::execute` (`0x1800a6580`, last slot of the vtable at `0x18042e0c8`;
> object size **0x48** per `mov edx,0x48` in the dtor `0x1800a4f30`) is a pure tail-call dispatcher:
> `rcx = [this+0x20]+(int32)[this+0x30]`, `rax = [this+0x28]`, `edx = [this+0x38]`, `r8 = [this+0x40]`,
> `jmp rax` — **arbitrary call with three chosen arguments**, no CFG check. `0x1800a6620` is the
> `Command1` sibling. Why it is not yet reachable, as a falsifiable claim: **(1)** a prefix-contiguous
> overflow cannot both preserve a pointer and control fields past it — <8 bytes keeps the vtable's high
> 6 bytes but never reaches `+0x20`; ≥8 bytes needs the absolute address the technique avoids. Strictly
> either/or. **(2)** Two objects does not fix it: `execute` on B reads **B's** fields, untouched.
> **(3)** Re-running the gadget scan **including `jmp` tail calls** — the §3.5 scan looked only at
> `call`, a real gap — over all 499 callees across dispatch slots `+0x00`…`+0x38`: **0 dispatchers that
> load from `[rcx+X]` and jump/call it.** `Command2::execute`'s own vtable is in window `0x42`, not the
> `Format` windows.
> **⇒ THE NEW QUESTION, AND IT IS A READING TASK NOT A SEARCH:** find an object that is (a) virtually
> dispatched, (b) has its vtable in window `0x42`, and (c) has `+0x20…+0x40` filled with
> peer-influenced values **legitimately**, so no overflow is needed to control them. The `Command*`
> objects are the Reactor's bound-call records and their bound arguments are exactly what network
> events carry (`PacketType`, `SocketAddress`, `ConnectionState`). **Nobody has read what a peer can
> put in those fields.** Small, concrete, next.
> **★★★ §3.9 — CONFLICT (1) IS BROKEN.** It assumed the pointer to preserve sits at offset 0; that is
> only true under single inheritance. **163 of NPL's 553 vtables are SECONDARY (this-offset != 0)** —
> by window `0x42`:8, `0x43`:53, `0x44`:51, `0x4c`:41, `0x4d`:10 — and **`Net::NPL::ConnectionImpl`
> carries secondary vtables at object offsets `+0x10` (`0x18042d780`) and `+0x18` (`0x18042d7b8`),
> both in the IAT window.** ⇒ an overflow of exactly **`0x1A` bytes** into a `ConnectionImpl` writes
> `0x00`–`0x17` with chosen content **and** lands its last 2 bytes on the `+0x18` vtable pointer,
> whose high 6 bytes survive ⇒ **re-aims to any of the 524 IAT entries.** The `+0x00` and `+0x10`
> vtables are destroyed but unused by that dispatch. Geometry: `overflow=strideU/2=0x1A` ⇒
> `strideU=52` ⇒ **`d_w=104`**, with `d_h` still free to select the size class
> (`alloc=(d_h>>1)x52`). Others with the same shape: `IOLoop` (+0x10), `TimerDispatcherImpl` (+0x10).
> **⇒ ONE QUESTION LEFT, THE SMALLEST YET: the argument registers still come from the dispatch site.**
> `rcx` will be `object+0x18`; `rdx`/`r8`/`r9` are whatever the caller of that interface method loaded.
> **Read the dispatch site for `ConnectionImpl`'s `+0x18` interface and see what `rdx`/`r8`/`r9` hold.**
> It is a network-connection interface, so a length / buffer pointer / `SocketAddress*` is exactly what
> it would receive — if any is peer-influenced, `VirtualProtect(rcx=heap, rdx=size, r8=0x40, …)` or a
> file write is directly reachable. **NOT READ.** (§3.8's "0 forwarding dispatchers" still stands but
> is no longer load-bearing.)
> **✗✗ §3.10–§3.12 — THE ENDGAME IS NOT YET CLOSED, AND THE REASON IS STRUCTURAL.**
> **(§3.10)** Being able to call any import is *not* an endgame: **at a C++ virtual dispatch `rcx` is
> always the object pointer**, and every dangerous import wants something else as arg 1 (`LoadLibrary`
> a path, `GetProcAddress` an HMODULE, `WriteFile` a HANDLE). Only `VirtualProtect` accepts a heap
> pointer — so it got a full scan: **of all 3,035 indirect virtual dispatch sites in NPL, 8 have the
> `VirtualProtect` shape (r8 = small imm, r9 = lea), and every one passes `r8d = 1` or `2`** =
> `PAGE_NOACCESS`/`PAGE_READONLY`. **No site supplies an executable protection constant. NEGATIVE.**
> **(§3.11/§3.12)** The fix would be an argument-shifting thunk — `Command2::execute 0x1800a6580`
> (`rcx=[this+0x20]+adj`, `rax=[this+0x28]`, `edx=[this+0x38]`, `r8=[this+0x40]`, `jmp rax`).
> Reachability is **confirmed at every slot**: it lives at `0x18042e0f0`, so write low16 = `0xe0f0 − S`.
> But the attempt to combine it with a high-offset secondary vtable **fails on test**: the thunk reads
> fields relative to the pointer it was dispatched through, so at an interface at offset `K` it reads
> `object+K+0x20…+0x40` — **past** the vtable pointer the overflow must stop short of.
> **⇒ THE CONFLICT IS SCALE-INVARIANT. Three attempts hit the same wall (offset-0 vtable; two objects;
> high-offset secondary vtable). It is a property of a prefix-contiguous overflow against C++
> dispatch, not of the objects chosen.**
> **(§3.13)** That last escape — a dispatcher reading at **negative** offsets from `rcx` — was searched
> across **all 605 virtually-dispatchable functions** (collected by walking all 553 vtables):
> **0 hits. NEGATIVE.**
> **★★★ ⇒ THE REAL CONSTRAINT IS W1's CONTIGUITY, NOT ASLR AND NOT THE MISSING LEAK.** Every wall in
> §3.8–§3.13 traces to the overflow being prefix-contiguous from the neighbour's offset 0.
> **F1 does not have that property** — the libvpx UAF writes `MODE_INFO` records at scattered
> macroblock-derived offsets, **a lattice, not a prefix**. Three waves priced link (a) as "find a
> reclaiming object with *a pointer* at a lattice-hittable offset" and killed 38/38 against 3.32 %
> density. **That was the wrong target spec.** The right one is now exact: **a reclaiming object whose
> lattice-hittable offsets include `Command2::execute`'s field set — `+0x20` (arg1 base), `+0x28`
> (call target), `+0x38` (arg2), `+0x40` (arg3) — while SPARING the vtable pointer**, which does not
> need touching because the vtable redirect is already free (`write low16 = 0xe0f0 − S`, valid at every
> slot). A lattice that must *avoid* one qword and *hit* four specific ones is a different search over
> a different object set (the window-`0x42` classes, not the 38 tried). **Never run. Single concrete
> next step, and it reuses F1 — already demonstrated live over a real call.**
> **★★★★ (§3.14) READING F1's OWN WRITE-UP AGAINST THAT SPEC CHANGES THREE THINGS.**
> **(1) F1's partial pointer overwrite is CONFIRMED AND MEASURED, not a proposal** — *"a planted
> `0x00007ffabcde1234` became `0x00007ffa02460468` — the low 32 bits set to the requested value, the
> ASLR-bearing high 32 bits bit-for-bit intact. No information leak is required."* **32 bits** of
> control, strictly stronger than the 2-byte trick designed for W1.
> **(2) The >=244-byte unwritable prefix FLIPS SIGN.** Block `= (mb_rows+1)(mb_cols+1)*76 + 23`, `mi`
> at `16 + (mb_cols+2)*76`, so the first 244 bytes are never written. F1's write-up used this as a
> *disqualifier* ("a plain polymorphic object can never be the target") because it puts a small
> object's vtable out of reach. **The new spec does not want to overwrite the vtable — the redirect is
> already free — it wants one that SURVIVES while later fields are written.** Exactly what that prefix
> gives.
> **(3) The old search died from a constraint the new spec lacks:** *"a partial overwrite cannot move a
> pointer out of its own 4 GiB window"* — fatal for redirecting a pointer into sprayed data, but the
> new spec redirects **a code pointer inside NPL's own window**, where **NPL's import thunks
> (`jmp qword [rip+IAT]`) already live** ⇒ reaches `LoadLibraryW`/`VirtualProtect` without leaving the
> window and without a leak.
> **⇒ RE-SPECIFIED TARGET, NEVER SCORED: a reclaiming object in an F1-producible size class (~15% of
> sizes — 76-step lattice vs 16-step NT buckets) where (1) the dispatched vtable pointer sits inside
> the >=244-byte prefix so it survives; (2) `interface+0x28` holds a CODE pointer, partial-overwritable
> to an import thunk; (3) `interface+0x20/+0x38/+0x40` are writable lattice positions (68 of every 76
> residues are reachable); (4) reachable via `Command2::execute 0x1800a6580`, confirmed reachable at
> every slot.** The old census scored **pointer stores for redirection into sprayed memory** over 38
> candidates and names three unclosed holes of its own (LFH-vs-backend never tested with ~20 exclusions
> assuming LFH; a **26-function load-side residue never taken to a verdict**; the `.pdata` blind spot).
> **None of the 38 was scored against conditions 1-4.**
> **★★★★★ (§3.15) THE SCORING RAN, AND FOR THE FIRST TIME LINK (a) HAS A NON-EMPTY CANDIDATE SET.**
> Conditions (1)+(3) are a pure arithmetic filter: `P = 16+(mb_cols+2)*76` ⇒ `P ∈ {244,320,396,…}`, and
> preserving a vtable at object offset `K` while writing `K+0x20…K+0x40` needs `K < P <= K+0x20`, i.e.
> **`K ∈ [212,243] ∪ [288,319] ∪ [364,395] ∪ …`** (32 wide, 76 apart). Of NPL's 553 vtables, 163 are
> secondary and **42 land in a valid band** — dominated by one offset: **`K = 0xd8` (216) = the
> `Net::NPL::PacketSender` interface, held by 26 classes = essentially every AV graph node**
> (`Parser`, `Serializer`, `CryptProxy`, `VpxDecoder`, `VpxEncoder`, `OpusDecoder`, `JitterBuffer`,
> `PacketQueue`, `Puller`, `Crop`, `Rotate`, …). Others: `K=0x138` (5), `0x180` (3), and one each for
> `Splitter` (0xe0), **`NetworkSink` (0x120)**, `PacketQueue` (0x130/0x340), `JitterBuffer` (0x170),
> `AudioSource` (0x258), `ColorspaceConverter` (0x560).
> At F1's **minimum** geometry (`mb_cols=1`, `P=244`) the `K=0xd8` family lands exactly right:
> vtable at 216 < 244 ⇒ **survives**; fields at 248/256/272/280 >= 244 ⇒ **writable** = arg1 base /
> **call target** / arg2 / arg3.
> **⇒ TWO NARROW CHECKS LEFT, both single lookups rather than searches:**
> **(2)** a code pointer at `K+0x28` = object **`+0x100`** for the `K=0xd8` family. A census of
> constructor-planted code pointers (`lea rXX,[rip+fn]` then `mov [obj+N],rXX`) finds them at
> `+0x10..0xa8, 0x120, 0x140, …` — **`+0x100` is NOT among them**, so no *constructor-planted* one.
> **NOT REFUTED**: the field may be runtime-filled, and a *heap* pointer there is also usable if it
> points where the attacker can spray — exactly the **LFH-vs-backend question F1's write-up lists as
> never tested** ("~20 exclusions assume LFH"). **Read what occupies `PacketSender+0x28` live.**
> **(4)** size-class match: object size must be an F1-producible block
> (`(mb_rows+1)(mb_cols+1)*76+23`, 16-byte NT buckets, ~15% of sizes). `CryptProxy` = 0x248 = 584 B has
> **no match** (nearest blocks 479/631 at mb_cols=1, 479/707 at mb_cols=2). Solve **per class** across
> the 26 — small closed-form search.
> **Still not RCE, and none of it was executed.** The old "(a) group-call `NetworkSink` / (b) messaging
> surface" leak leads remain open but are **no longer on the critical path.**
> **NOT established (do not overstate):** adjacency/grooming is not demonstrated, no dispatch was
> shown end-to-end, no gadget was chosen, and nothing was executed or sent. **This is not RCE.**
> Also newly recorded: the sink **reuses** an existing plane buffer whenever it is already big enough
> (`cmp [rsp+0x20],eax / jae` @ `0x1406e9790`) — **an attack that just sends the target geometry
> silently does nothing on any later frame**; a fresh allocation must be forced. Nothing executed,
> nothing sent.
>
> **Two corrections that travel out of W15.** (i) **F6 is NOT peer-drivable** — the relay's *outbound*
> arm is correctly bounded (`mov r8d,0x800 / sub r8d,r14d` @ `0x18009e334`) and the client writes the
> u16 prefix itself @ `0x18009e73d`, so the client can never emit a frame > 0x7fe; F6's attacker stays
> the hub or a TLS MITM. (ii) **A linear disassembly sweep of `.text` desyncs on data-in-code and
> silently loses xrefs** — my first pass reported *zero* references to `"VideoHub(dec)"` when one
> exists at `0x1800f03de`. `scratch/w15/xref.py` / `callers.py` disassemble per `.pdata` record;
> **re-run any earlier census that used a linear sweep.** Also closed this wave, each with its
> instruction: `CryptProxy`/`cryptoPadding` (`memset` of the reserved region @ `0x18011b61f`), the
> feedback packet's Frame slack (`metaSize` **is** the string's size field), `XorFecEncoder`,
> `PacketPacer`'s SOCKS insert, and the one constant wire length in NPL. **Kept as an enabling fact:
> the Frame allocator `0x180135ea0` does NOT zero the inline payload — 32 call sites, 4 checked,
> 28 unexamined.**

> **★★★★★ 2026-08-03 — ONE FRAME → INSTRUCTION-POINTER CONTROL, EXECUTED END-TO-END IN A HARNESS ON
> SHIPPED CODE. Read `W14-CRUX-info-leak-sweep.md` §7a.8–§7a.16.** The connection object is
> non-polymorphic (no in-object call sink — my earlier `0x180156f90` "sink" was a `PortAudioManager`
> singleton, RETRACTED). The real sink is the sibling's `SSL*` at `+0x88`, which F6 controls: AWS-LC
> `SSL_read`→`crypto.dll!BIO_read 0x1800408d0` does `mov rax,[bio]; call [rax+0x18]` = `bio->method->bread`.
> Executed in stages — `bioproof.c` (sink), `sslconnect.c` (real SSL + corrupted rbio → PC),
> `relaydrive.c` (the SHIPPED relay `0x18009d570` → PC), and `oneframe.c` (**one crafted frame → recv
> overflow → obj1 `SSL*` set → relay → `SSL_read`→`BIO_read` → `rip=0x464646464640`**, CS preserved via
> leak-and-reuse). CFG inert (F4b). **STILL NOT called "RCE":** all harness-local addresses; nothing
> sent to a live client. Remaining = live MITM delivery (operator-approved build) + live-heap
> spray/grooming at leak-known addresses (leak executed §7a.3, contiguity measured §6.2c-quater). The
> gap is delivery, not capability.

> **★★★ 2026-08-03 — THE LEAK EXISTS AND IT IS EXECUTED. IT DOES NOT COME FROM AN ECHO CHANNEL; IT
> COMES OUT OF F6'S OWN WRITE.** F6's overflow reaches the *next* connection object's `sendto`
> destination (`+0x1d0`, write offset 0x9f8), its tolen (0xa78), its UDP socket (0xb14) and its
> length counters (0x1b20/0x1b22). The resumed-frame path then reaches `sendto` with **no recv and no
> re-validation** — the flags at `0x18009dd1c` are still those from `0x18009d980`. **Measured:
> one 6,948-byte frame → 16,384 bytes delivered to an attacker-chosen address, 14,336 of them
> adjacent heap, pointer-shaped values recovered** (`scratch/w14/leakproof.c`). In the live layout a
> 16 KB leak spans three further slots whose `SSL*` fields hold real heap pointers. **⇒ the "blind
> against 0.07 % pointer density" blocker that killed link (a), Route A and the mip-calloc escape is
> GONE.** Read `W14-CRUX-info-leak-sweep.md` **§7a** first. **IP control is still NOT established and
> is not claimed** — the same write reaches obj1's `SSL*` at offset 0x8b0 with full content control,
> but nothing was aimed there.

> **★★ 2026-08-02 (WAVE 14) — THE INFO-LEAK SWEEP HAS NOW BEEN RUN. Read the WAVE 14 block below
> before anything else.** Four channels closed with instructions (the `Parser` feedback packet's
> header and payload, the `Frame::copyMetadata` send-path census, the decoder statistics block), and
> **`PacketHeader` field 7 is closed — the field map is 9/9.** The sweep also found **F6**, a peer u16
> length prefix driving an unclamped read into a 2 KB inline buffer in the TLS-UDP proxy relay
> (`NPL 0x18009d570`): an OOB write with **full content control and no precondition**, better than all
> six earlier primitives. The `sendto` destination question is **RESOLVED — it is the victim's own
> media socket, so F6 is a write, not a direct leak** — but the write lands on **8 contiguous 0x1320-byte
> connection objects**, reaching each sibling's `SSL*`, socket handles and `sendto` destination at fixed
> offsets. **That is the pointer-bearing adjacency link (a) never found**, and the correct bound already
> exists in the sibling UDP read path (`mov r8d, 0x800` @ `0x18009e334`). Two warnings that travel with W14: `fn.py`
> **under-reports function extents** across chained `.pdata` chunks (it called a 281-byte function
> "8 bytes"); and `SSL_write`/`BIO_write` have **zero** rip-relative refs, so the egress census is
> complete for `sendto`/`send` only.

> **★ 2026-08-02 — `W13-ENGAGEMENT-MAP.md` is the complete inventory: every finding, every
> evidence-backed negative, and every unsearched area, with the "never asked since Wave 4" items
> re-checked by grep (E3/E4/E6/E7/E8 have ZERO mentions anywhere and are still open). Read it if you
> want the whole picture; read the retraction block below first if you are about to rely on a
> specific negative. Headline of the re-analysis: the binding constraint on link (a) is the
> geometry lattice (3.32 % density), not the absence of pointers — an information leak is worth
> 33–74× and the search for one has never been run.**

## ██ 2026-08-01 — RETRACTION. THE UPDATE CHANNEL IS **NOT** FAIL-CLOSED. IT WAS NEVER CHECKED. ██

**Every earlier statement in this brief and in `STATUS-consolidated.md` that the WinSparkle update
channel is fail-closed is WRONG. Delete it from your model.** The claim was that signature
verification is invoked *unconditionally* at `WinSparkle 0x180028eec` in straight-line code. Nobody
read the dominator. Re-read by the lead, from the shipped bytes:

```
0x180028e01  e85af8ffff      call 0x180028660      ; is a DSA public key configured?
0x180028e06  84c0            test al, al
0x180028e08  0f8428010000    je   0x180028f36      ; <== NOT configured -> jump PAST the verify
      ...
0x180028eec  e87b130000      call 0x18002a26c      ; VerifyDSASignature -- NOT REACHED
      ...
0x180028f36  488d0df34c1a00  lea  rcx, [rip+0x1a4cf3]
0x180028f3d  e86eebfeff      call 0x180017ab0      ; log, then fall through to the SAME
0x180028f42  0f57c0          xorps xmm0, xmm0      ; continuation the verified path reaches
```

No DSA key is configured in this build (`win_sparkle_set_dsa_pub_pem` is not imported; there is no
`DSAPub`/`DSAPEM` resource). So **the branch is taken, verification never runs, and the client
installs an installer it never authenticated.** Whoever controls the appcast or installer bytes gets
code execution as the signed-in user, with no memory corruption anywhere in the chain.

> **★ CORRECTION 2026-08-02 (W13) — "this outranks F1/F2/F3 in practical severity" is WITHDRAWN, and
> the residual below is RESOLVED in the other direction.** The appcast URL is **hard-coded HTTPS**,
> built at `WickrPro 0x140aec040`:
> `"https://s3.amazonaws.com/wickr-desktop-clients/"` (literal @ `0x14328b9d8`, referenced once,
> `lea rcx,[rip+0x279f742]` @ `0x140aec28f`) `+ <channel> + "/Latest/Latest.xml"` (@ `0x140aec2d0`),
> where `<channel>` is one of **eleven compile-time literals** (`Windows/WickrPro`, `…Beta`, `…Gamma`,
> `…Alpha`, `Windows/WickrEnterprise{,Beta}`, `Windows/AWSWickrGov{,Beta,AdcBeta,AdcAlpha}`) chosen by
> a switch, with the only runtime input a **local** `preferences` key (`nightlyBetaRing`) selecting
> between two beta rings. **Nothing server-supplied enters the URL.** It reaches
> `win_sparkle_set_appcast_url` as `[WickrWinSparkleWorker+0x18]` → `QString::toUtf8` →
> `QByteArray::constData` (`0x1400a12a6`–`0x1400a12c2`).
> ⇒ **the attacker position is "controls AWS's own S3 bucket" or "holds a rogue/compromised CA for
> `s3.amazonaws.com`", not "any network attacker".** Both are excluded from a client-side assessment.
> The finding is real and worth reporting — **signature verification exists precisely so that
> compromise of the distribution channel is not game over, and its absence makes the S3 bucket ACL a
> single point of failure for every Wickr Desktop user** — but it is **defence-in-depth, not a
> directly exploitable defect**, and it does not outrank F1/F2/F3. *(Residual: nothing else was shown
> to write `[WickrWinSparkleWorker+0x18]`; that this is the only writer is INFERRED, not proved.)*

It survived four waves because one `call` was
read as unconditional without checking what dominates it — §0 rule 1, exactly. Two consequences for
how you work here:

* **A "closed with evidence" entry is only as good as the instruction someone actually read.** When a
  negative is load-bearing, re-read its decisive instruction before you rely on it, even when the
  brief says it is settled. This one was restated confidently by the lead multiple times.
* Residual, stated honestly: the appcast URL is a runtime-configured `QString` at
  `[WickrWinSparkleWorker+0x18]`, so whether it is HTTPS and whether certificate validation holds is
  **UNDETERMINED from static analysis**. That decides whether the attacker position is "controls the
  update server / a CA" or "any network attacker". Settle it before writing the severity.

Full write-up: `DISCLOSURE-2026-08.md` §4.1 (Finding 4a).

---


## ██ WAVE 14 (2026-08-02) — THE INFO-LEAK SWEEP WAS RUN. FOUR CHANNELS CLOSED, FIELD 7 CLOSED (9/9), AND ONE NEW UNCONDITIONAL CONTENT-CONTROLLED OOB WRITE ██

Read `W14-CRUX-info-leak-sweep.md`. Tools in `scratch/w14/`
(`vtslot.py` resolves a function VA → the vtable and slot and class that holds it; `hier.py` dumps the
RTTI class-hierarchy with `mdisp` so an interface at a known this-offset can be **named**; `vtdump.py`
dumps every vtable of a class; `argsrc.py`/`iatarg.py` back-scan each call site for a given argument
register; `lin.py` linear-disassembles **and prints the overlapping `.pdata` records with their
CHAININFO flag** — see the tool warning below).

* **★ TOOL DEFECT, THREE WAVES OLD, FIX OR WORK AROUND IT.** `fn.py` folds a chained secondary chunk
  *back* to its primary but **does not extend the primary forward over its own chained chunks**. It
  reported `PacketHeader::Clear` as **8 bytes** (it is 281, in 7 chunks) and `0x180144410` as **18
  bytes** (it is 125, in 3). Both would have produced confident wrong answers — the first is the
  instruction the whole EVENT-channel negative rests on. **If `fn.py` returns an implausibly short
  function, re-read it with `scratch/w14/lin.py`.**
* **★ CORRECTION TO W13: `Parser+0x88` is the serialisation DESTINATION, not a source.**
  `0x180109560` is `MessageLite::SerializeToString` (35 bytes: `mov [rdx+0x10],0` / SSO check
  `cmp [rdx+0x18],0xf` / `mov byte [rax],0` / `jmp AppendToString`). W13's "sub-message sourced from
  `Parser+0x88`" is REFUTED. The real questions were the message at `[rsi+0x80]` and the payload.
* **★ THE RECEIVE→SEND EDGE IS REAL AND IT RUNS.** RTTI: `Musigy::AV::Parser` inherits **both**
  `PacketReceiver` (mdisp 112) **and `PacketSender` (mdisp 216)**. `0x18011f970` is `PacketSender`
  slot 3. Its log literals are `"Sending feedback packet, event id is "` (`0x18043f2a0`) — and the
  client's own logs carry **`AV.Parser … Sending feedback packet, event id is 140` ×9 across three
  sessions**. *(Grepping for "EVENT" alone finds nothing here and yields a false negative — all 100
  `Sending EVENT packet` lines are `AV.Serializer`, a different function.)*
* **…AND IT CARRIES NOTHING. Two independent closes.** (i) `PacketHeader::Clear 0x18013b350` is
  complete — `movups [rdi+0x40],xmm0` / `mov [rdi+0x50]` / `[rdi+0x58]` / `[rdi+0x60]` /
  `[rdi+0x64],1` / `[rdi+0x10],0` zero all ten int32s, both sub-messages and the has-bits; only
  kind/f4/f5/f6/f7 are then set. (ii) The AV graph runs an **upstream feedback bus** —
  `PacketSender::onEvent 0x180132cc0` is a pure forwarder shared by **24 node classes** and
  `Parser::onEvent` is its terminal. Census of **all 24 emit sites: 18 pass `xor r8d, r8d` (NULL
  payload)**, 4 forward, 1 is the terminal, and the only payload-bearing originator is
  `NetworkSink::ChannelListener 0x180133a20` — **`NetworkSink` is in none of the 7 scene graphs.**
* **★ FIELD 7 IS CLOSED. THE `PacketHeader` MAP IS NOW 9/9.** `[Parser+0x118]` is `PacketSender+0x40`
  (zeroed by the `PacketSender` ctor `0x180131fc0` @`0x18013203d` — that is why W13's sweep of
  `0x180118000`–`0x180140000` found no store: it is a **base-class** member wired by the graph
  builder). The call's own argument shape at `0x18011ecc3` — `(this, PacketSender* replyTo, int
  eventId, Frame*)`, `this` at this-off 112 — identifies it as `PacketReceiver::onEvent`. Every
  implementation (`0x180119cd0` generic, `0x180121710` VideoEncoder, `0x180144490` VpxDecoder,
  `0x18012e790` SplitterOutputNode) **compares the id against compile-time constants and forwards.**
  Never an index, key, size or length. **NEGATIVE — the benign one of W13's two predicted outcomes.**
* **The `0x180135d20` census (deliverable 2): 15 sites, uniform `dst = new output Frame, src = this
  node's input Frame`.** It matters because `Serializer::onPacket 0x18011d240` writes the outgoing
  header straight out of its input Frame (`mov ecx,[r14+0x8c]` @`0x18011d5b2`). But the client prints
  its scene graph at every call start and there are exactly **7 shapes with disjoint node sets** —
  `Parser` only under `NetworkSource`, `Serializer` only under `AudioSource`/`DShowCamCapture`/
  `NPLSource`. **NEGATIVE: no receive-scene Frame can reach a Serializer.** *(MEASURED over two-party
  audio+video on the operator's machines — group calls, screen share, `Splitter`/`Puller`/
  `JitterBuffer`/`PacketQueue`/`NetworkSink` never exercised. Proving it needs the builder
  `0x1800ef820`.)*
* **`0x180144410` identified: `VpxDecoder` primary vtable slot 15 (+0x78), the last slot.** It copies
  `+0x498…+0x4d3` (0x3c B, incl. both poisonable counters) into a caller-supplied `rdx`. **Its
  consumer is not the event bus:** `VpxDecoder::onEvent 0x180144490` dispatches ids 34/35/36/37 only
  and never calls slot 15. The two id-gated `call [rax+0x78]` sites are **`VideoEncoder`/`VpxEncoder`**
  (`0x180121710`/`0x180121770`), whose slot 15 is `0x18013fbf0` — slot-number collision, different
  hierarchy. UNDETERMINED: a host-side consumer.

### ██ F6 — A PEER u16 LENGTH PREFIX DRIVES AN UNCLAMPED READ INTO A 2 KB INLINE BUFFER ██

Found by abandoning the AV graph and **enumerating the actual egress points**: NPL's only network-write
imports are `sendto`/`send`/`SSL_write`/`BIO_write`; `sendto`+`send` have **exactly 8 call sites**.

`NPL 0x18009d570` is the **TCP/TLS→UDP relay** (`Net.TcpProxyConnection`; own literals `'TCP_TLS socket
is closed'`, `"RecvDataSize doesn't match FullDataSize"`, `'Cannot write to UDP socket'`). It is live —
`TLS-UDP proxy connection to tls://… established` in the logs.

```
0x18009d95a  movzx r15d, word ptr [rdi+0xaf8]   ; FullDataSize := the peer's u16, out of buffer[0..1]
0x18009d962  mov   word ptr [rdi+0x12f8], r15w  ; stored -- NO COMPARISON ANYWHERE IN 2,422 BYTES
0x18009d99b  sub   r8d, r12d                    ; want = FullDataSize - accumulated   (plain TCP)
0x18009d9ae  call  [rip+0x387124]               ; recv(sock, buffer+accumulated, want)
0x18009db13  sub   r8d, eax                     ; same, TLS arm
0x18009db27  call  0x18010e70f                  ; SSL_read wrapper
```

**Buffer capacity is 0x800 = 2048, bounded from BOTH sides** — the reset routine `0x18009b2e0` writes
`[rdi+0xaf4]` (below) and `[rdi+0x12f8]` (above), and no field is accessed anywhere in (0xaf8, 0x12f8).
⇒ **an OOB write of up to ~63.5 KB, fully attacker-chosen content, attacker-chosen length, NO
precondition** — better than all six earlier primitives (no alloc failure like F1, not zeros like F2,
not zero-extended-32 like F4f).

**★★ EXECUTED against the shipped NPL.dll — `scratch/w14/relayprobe.c`** (builds the object from the
shipped code's own displacements, loopback TCP pair, calls `base+0x9d570` by address; no Wickr
infrastructure touched, WickrPro never started):
```
declared 0x7ff  -> next object UNTOUCHED, fill 0x07ff      <-- CONTROL
declared 0x800  -> next object UNTOUCHED, fill 0x0800      <-- CONTROL (exactly the capacity)
declared 0x1000 -> next object modified +0x0..+0x7d7 (2,008 B), fill 0x4241 (= payload!)
declared 0xffff -> obj+0x1320 .. obj+0x10af6 = 63,447 BYTES PAST THE OBJECT, no crash
sibling +0x88 SSL* = 4847464544434241   +0x1d0 sendto dest = 504f4e4d4c4b4a49
sibling +0x2e4/+0x2ec sockets = 504f4e4d / 48474645
```
**The controls are the load-bearing half** — at 0x7ff and 0x800 the next object is untouched *and* the
counters hold legitimate values, so the boundary sits exactly where the disassembly puts it.
**Qualifier: the object is harness-constructed** (displacements from the shipped code, not observed
live). No IP control claimed or attempted.

**And it is also the leak shape:** the overflow's first casualties are the counters themselves
(`+0x12f8` = buffer+0x800, `+0x12fa` = buffer+0x802), which are re-read to drive `sendto`
(`movzx r8d, word [rdi+0x12f8]` @`0x18009ddce`). Declare `0x804`, set `[+0x12f8]=L` and
`[+0x12fa]=L-0x804`, take the `je` @`0x18009dd1c`, and `sendto` transmits **L bytes from a 2 KB
buffer**. *(Without the overflow there is no over-read: the `jb` @`0x18009dd12` forces
`accumulated >= FullDataSize`.)*

> **★ RESOLVED, in the honest direction. `sendto` goes to the VICTIM'S OWN MEDIA SOCKET.** The writer
> is in the other relay direction: `0x18009e5e4 lea rdx,[rsi+0x1a0]` → `0x18009e6ab call memcpy` into
> `obj+0x1d0`, i.e. a **configured** address, not one learned from `recvfrom`. Direction is fixed by
> the syscalls: `0x18009def0` = `recvfrom(UDP +0x2ec)` → `send(TCP +0x2e4)` (media→hub);
> `0x18009d570` = `recv/SSL_read(TCP)` → `sendto(UDP, to = obj+0x1d0)` (hub→media). **⇒ the over-read
> is delivered locally. F6 is a WRITE primitive, not a direct leak.**

**★★ BUT THE WRITE IS FAR BETTER THAN "lands in live heap" — AND THIS IS THE REAL RESULT.** The relay
handler has **8 call sites in one function**, each on a sub-object of one parent at constant stride
**0x1320** (`lea rcx,[rbx+0x60]`, `+0x1380`, `+0x26a0`, `+0x39c0`, `+0x4ce0`, `+0x6000`, `+0x7320`,
`+0x8640`). ⇒ the object is exactly **0x1320 bytes and EIGHT ARE CONTIGUOUS.** The overflow runs
through 7 sibling connections at **fixed known offsets** (sibling base = `0x1320-0xaf8` = **0x828**
into the write):

| sibling field | what | write offset |
|---|---|---|
| `+0x58` | `CRITICAL_SECTION` | 0x880 |
| `+0x88` | the **`SSL*`** | 0x8b0 |
| `+0x1d0` / `+0x250` | that connection's **`sendto` destination + len** | 0x9f8 / 0xa78 |
| `+0x2e4` / `+0x2ec` | TCP and UDP **socket handles** | 0xb0c / 0xb14 |
| `+0x12f8` / `+0x12fa` | its own length counters | 0x1b20 / 0x1b22 |

**One ~0xb20-byte frame overwrites the next connection's SSL pointer, both socket handles, and its
`sendto` destination — MEASURED, see the run above** — so the leak returns by another route: redirect a *sibling's* relay output to
an attacker-chosen address. **This is the fixed, pointer-bearing, known-offset adjacency link (a)
spent three waves failing to find** (0.07 % pointer density there; here it is 100 % and deterministic).
**Slot occupancy — partial:** each slot is gated on its own TCP socket (`mov edi,[rbx+0x344]`,
`[rbx+0x1664]`, … / `test edi,edi / jle`), so it is a pool. The logs show proxy connections coming up
**in pairs seconds apart with no teardown between** (08:08:10.478 and 08:08:12.467 in one PID, each
with its own `SSL … established`) ⇒ **INFERRED, not measured, that ≥2 slots are concurrently occupied.**

**★ AND THE CORRECT BOUND ALREADY EXISTS IN THE SAME CLASS — §0 rule 5, textbook.** The object has TWO
0x800 buffers. The UDP one is capped by a literal: `0x18009e334 mov r8d, 0x800` / `sub r8d, r14d` /
`add rdx, 0x2f4` → `recvfrom`, and `0x2f4+0x800 = 0xaf4` = exactly the field written below the second
buffer. **The TCP/TLS path 0x1000 bytes away takes its length off the wire with no cap.** This also
confirms the 0x800 capacity independently of the field-adjacency argument.

* **Attacker position:** whoever terminates the TLS-UDP proxy TCP connection — the **hub**, same as
  Appendix 2A. The plain-TCP arm (`byte [obj+0x80]==0` @`0x18009d991`) carries the identical defect;
  whether it is reachable without TLS was **not** established, so do **not** say "any network attacker".
* **★ THE BIGGEST REMAINING BLIND SPOT IN THIS SWEEP: `SSL_write` and `BIO_write` have ZERO
  rip-relative references in NPL.dll** — they go through OpenSSL BIO method tables. The egress census
  is complete for `sendto`/`send` and **incomplete for TLS writes**, which is exactly where a
  media-layer echo would most plausibly live. That is the next place to look for a leak.

---

## ██ WAVE 13 (2026-08-02) — THE `PacketHeader` MAP IS FINISHED (8/9 closed), AND THE EPHEMERALITY SWEEP IS DONE ██

Read `W13-CRUX-consumer-map-and-ephemerality.md`. Tools in `scratch/w13/`
(`fn.py` resolves a function START from an address inside it **and folds chained secondary chunks**;
`offscan.py`, `sigscan.py`, `xref.py`, `strs.py`, `rd.py`).

* **★ THE TARGET LIST EVERYONE HAS BEEN USING IS IN TWO COORDINATE SYSTEMS AND IS OFF BY ONE.**
  `+0x40…+0x64` are **`Proto::PacketHeader` message-object** offsets; `+0x98` is a **`Frame`** offset.
  The recon list omitted `+0x50` and substituted a Frame offset for it. **F2c's field is
  `PacketHeader+0x58` = protobuf field 10**, not `+0x98`. The eight that remained were protobuf
  fields **3, 4, 5, 6, 7, 8, 11, 13**. Also CONFIRMED: **`Packet` (the NPL C API) IS
  `Musigy::AV::Frame`** — the descriptor's stride/height loop reads exactly the offsets the kind==2
  handler writes.
* **Parse sites, all nine, with the clamp or its absence quoted.** `_InternalParse 0x18013b930`,
  jump table `0x18013bf70`, `r12 = 0x180000000`. **`kind` is the only validated field**
  (`sub ecx,1/je ×2, cmp ecx,1/je` @ `0x18013ba4f`–`0x18013ba5e`); its nine siblings get **no `cmp`
  at all** between varint decode and store. Cross-checked 9/9 against `_InternalSerialize
  0x18013bfb0`. §0 rule 5, textbook.
* **The consumer set is CLOSED and it is three functions.** `AV::Parser::onPacket 0x18011fce0` loads
  the message from **`Parser+0x158`** (`mov rdx,[rdi+0xe8]` @`0x18011fdca`, rdi = complete+0x70) and
  dispatches on `kind` to `0x18011ed00` (1/FORMAT — **reads no header int32 at all**),
  `0x18011ef70` (2/MEDIA), `0x18011ea60` (3/**EVENT**).
* **8 of 8 taken to a verdict; 7 are NEGATIVES with the instruction that closes them.**
  f3 → `Frame+0x8c` stored/copied/logged, `VpxDecoder` never reads it. f4 = a flags word; **bit 14 is
  the decoder-context selector already in the report**, the rest are branch booleans. **f5 and f6 are
  write-only wire fields** — the sender writes them, the receiver zeroes `Frame+0x94` and never reads
  them. **f8 is a dead wire field** — no reader *and* no application serializer writes it. f11 drives
  a loss accountant; **not monotonic** (`0x180144178` resets on a smaller value ⇒ no F2c-style wedge)
  and its decode-failure sink is **masked**: `0x180144323 4183e003 and r8d, 3`. f13 is an OpusDecoder
  monotonic max that is **logged every 64 packets and then reset** (`0x180148f6a`).
* **★ THE COMPLETE BOUND ON WickrPro's VIEW OF A PACKET.** 230 NPL exports enumerated: exactly **two**
  packet accessors. The decrypt callback `0x14013f390` is 337 bytes, **read in full**, and the
  **only** descriptor read in it is `0x14013f438 8b4d1c mov ecx,[rbp+0x1c]` = `desc+0x5c`.
  ⇒ `desc+0x48/0x50/0x54/0x58/0x60` are populated and **never read by anything**. That kills the
  "follow it into WickrPro" branch for fields 3, 4 and 13 in one instruction.
* **THE ONE OPEN ITEM IS FIELD 7 AND IT IS CHEAP.** kind==3 EVENT id, unclamped, passed as **arg 3 to
  a virtual call**: `0x18011ec8d mov r14d,[r14+0x50]` → `0x18011eca7 mov rcx,[rsi+0x118]` →
  `0x18011ecb9 mov r8d,r14d` → **`0x18011ecc3 ff5018 call qword [rax+0x18]`**. I did **not** identify
  the class at `Parser+0x118`; a sweep for `mov qword [reg+0x118], reg` over `0x180118000`–
  `0x180140000` found **zero** stores, so it is installed from outside that range. **It is the only
  one of the nine where a raw peer int32 reaches an indirect call as an argument. One function
  identification decides it.**
* **New reportable sub-item (minor):** `0x180144130` does `add dword [rdi+0x4c8], eax` @`0x180144197`
  and `add dword [rdi+0x4bc], eax` @`0x180144239` with `eax = field11 − last_seq − 1` — **one packet
  sets the victim's own decoder loss statistics to an arbitrary 32-bit value**, exported by the stats
  getter `0x180144410`. Whether that reaches rate control or the metrics upload is UNDETERMINED.
* **Two corrections to this brief:** `0x180144320` is **43 bytes** (`0x180144320`–`0x180144362`), not
  25 — and it is in the `.pdata` **blind spot**, so `disfunc.py` silently falls back to a linear
  guess there. `fn.py` prints a warning when that happens; use it.

### ██ F4f — AN OUT-OF-BOUNDS WRITE, EXECUTED AGAINST THE SHIPPED PDFium (added later in W13) ██

**One 6.4 KB PDF with a single `/JPXDecode` image produced 256 out-of-bounds heap stores in the shipped
`Qt6Pdf.dll`, up to 6,104 bytes past a 24-byte allocation, through WickrPro's exact call.** No crash — it
corrupts and returns success. This is **CVE-2026-2648** (`Bug: 477033835`), missing bounds/NULL checks in
`opj_j2k_read_sod` (`Qt6Pdf 0x18025c540`; the stores are `0x18025c6d6` and `0x18025c6f5`).

* **The trigger recipe:** a **valid TLM marker** puts `opj_j2k_read_sot` on the
  `if (!m_tlm.m_is_invalid) { /* do nothing */ }` branch, where `current_tpsno = TPsot` is assigned but
  `tp_index` is never grown. `TNsot = 0` keeps the TLM valid and `m_nb_tile_parts` at 0 so the guard is
  skipped; TPsot walks 0,1,2,… to satisfy ISO 15444-1 A.4.2. PoC: `scratch/w13/jpx3/tlm1_parts256.pdf`.
* **Severity limit, do not overstate it:** both stores write **zero-extended 32-bit** values, so a pointer
  cannot be placed. Vtable/function-pointer routes are closed. What is left is a length/capacity
  overwrite, and **what lies at those offsets was never surveyed.**
* **3 of the 4 heap-overflow CVEs are NOT reachable in this build, and that is the useful part.**
  libtiff is absent from `Qt6Pdf.dll` (present in `Qt6WebEngineCore.dll` — the control proves the probe);
  lcms is linked but there is **no `/ICCBased` handler** (0 hits vs 1 in the control), and independently
  255⁴ < 2³² so its `CubeSize` overflow needs ≥5 CLUT channels which `/ICCBased` cannot express;
  CVE-2026-6361 is the **PostScript print path**, matching NVD's "specific UI gestures" / `AC:H`.
  **Qt6Pdf is a *stripped* PDFium — no V8, XFA, form-fill, colour management or TIFF. That is a
  structural ceiling on the whole n-day strategy for this surface: most PDFium CVEs cannot land here.**
* **CVE-2026-4455** (FreeType glyph copy) has the best content control of anything found — the written
  bytes are 0x00/0xFF chosen per bit by the glyph bitmap — and its code IS present
  (`0x1801a686f cmove r13d, eax`). Two of three preconditions hold (`k8bppMask` destination;
  `anti_alias == kLcd` **measured 18,513/18,521**). The third, `FT_PIXEL_MODE_MONO`, was **never observed
  in 18,521 glyph renders** and `FT_LOAD_NO_BITMAP` closes the obvious route. **Best remaining lead of
  the four.**
* **★ Reusable method (gitiles blocks anonymous *history*, but not this):** per-commit JSON
  `+/<sha>?format=JSON` carries message, parents AND `tree_diff`; raw file content at any SHA works too.
  Combined with `chromium/src +/refs/tags/<version>/DEPS` (which pins `pdfium_revision`) you can walk any
  release branch by hand. **The `chromium/pdfium` GitHub mirror stopped syncing 2025-11-19** and is
  useless for 2026 fixes — an earlier claim here about "commits since 2025-09-17" was bounded by that
  mirror, not by today.
* **★ THE WALL, RESTATED AFTER ALL OF THIS: it is not the write primitive, it is the LEAK.** Six write
  primitives now exist across the engagement (F1 content-controlled, F2 zeros, F4f demonstrated,
  CVE-2026-4455 byte-granular but unreached, plus two dead). **Not one has produced IP control, and the
  reason is the same every time: high-entropy ASLR with no observation channel** — the attacker sends a
  file and sees nothing back. W4 proposed sweeping the send paths for anything echoing received-derived
  bytes; **fourteen waves later it has still never been run.** Started in W13 and NOT finished: NPL's 16
  statistics exports are **host-facing only** (they do not go to the network); `0x180144410` (the decoder
  stats block getter) has **no direct callers** — it is vtable slot `0x180443aa8`, consumer unidentified;
  and **`AV::Parser` itself emits kind==3 EVENT packets** (`0x18011f970`), a genuine receive-side→network
  path whose payload is a sub-message from `Parser+0x88` — **what fills `+0x88` is the open question.**

### Ephemerality (scope 2) — mostly CLEAN, two new findings, one real gap

* **CLEAN, measured:** `temp\attachments\` (15 files, 5.76 MB) are **encrypted** — entropy 7.716–8.000,
  **no format magic on any file**, all start `00`. `temp\preview\` and `temp\crl\` **empty**. `cache\`
  empty. **`metrics\metrics.sqlite` is encrypted** (7.992, no magic). **No message content, attachment
  name or user handle in any log** (0 occurrences over 33 files / 22.2 MB).
* **★ F5c (new): the burn does not reach the logs.** 33 files, **22,213,342 B**, three days, largest
  16 MB, and **no rotation mechanism exists in the binary at all** (`maxLogFile|logRotat|rotateLog|
  maxLogSize|logRetention|removeOldLog|pruneLog|LOG_MAX`: zero hits). They carry **1,613 `msgID`,
  134 `vGroupID`, 2,273 UUIDs** in cleartext. The reaper only deletes DB rows.
* **★ F5d (new): `metricsEventQueue` is plaintext** — header line `metricsEventQueue|MetricsEvents|
  4.0.31` then base64 protobuf; the payload field NUMBER is the event id (110/111 seen) and it nests a
  **20-char ASCII identifier in the clear**, between two encrypted databases.
* **The expiry model, CONFIRMED:** `queryDeleteExpiredMessages 0x1408f3e40`, SQL `0x14323bff0`
  (`destructTime > 0 AND … AND skipCleanup = 0`), **two callers only** — `0x140917120` (periodic
  "CACHE MAINTENANCE") and `0x1409de790` (DB load at session start). Real DELETE, both on a timer and
  at launch. Three escapes visible in the query itself: `destructTime = 0`, `skipCleanup = 1`,
  `state ∉ {1,4,5}`.
* **The TTL ceiling is SERVER-supplied.** `maxTTL`/`maxBOR`/`availableEnvelopeTTL`/`destructOnRead`/
  `maxMessageTTL` live in the **same network-settings key block** as `forceOpenAccess` and
  `censorshipProxyConfig` (`0x143255688`, `0x14326a889`). The embedded default doc (`0x142dc0a2a`)
  offers `availableEnvelopeTTL: [0, 600, …]` — **`0` is a first-class option and the reaper only
  deletes `> 0`**. The only client-side check found is the **sender's**:
  `verifyTTLAndBOR 0x140112030`, `cmp ecx,ebp / jg` @`0x140112078`, clamps **upward** to maxTTL at
  `0x1401120e4`.
* **★ THE GAP, STATED HONESTLY:** I could **not** find where the **receiver** computes
  `Wickr_Message.destructTime`, so I cannot say whether it re-validates an inbound/room-changed TTL.
  The INSERT/UPDATE are `%1…%37` runtime-bound templates (`0x143246c70`, builder `0x14093e1d0`); the
  `destructTime` literal `0x143238798` has 2 refs, both static QString init. **The sharp question is
  `WickrSecureRoomMgr::changeTTL` (`0x143260610`) — who may change a room's TTL and does the receiver
  verify it?** That is a room/MLS authorization question. Start there.
* **F5a re-audited by a NEW method and it is stronger.** The 1,363-byte ctor `0x18015bb70`'s
  **complete resolved import set** is `InitializeCriticalSectionAndSpinCount`, `fopen`, `fclose`,
  `_invalid_parameter_noinfo_noreturn` and six `std::` ostream/ios/streambuf entries. **No env, no
  registry, no config API, no `remove`.** There is no gate to miss. **Measured again 2 days on: 28
  files / 477,219,328 B — byte-identical ⇒ never rotated, never deleted.** And a bounding negative:
  **`aud_in` occurs ZERO times in WickrPro.exe** (the two `.pcm` hits are `:/etc/test-48k-16-mono.pcm`,
  a Qt resource), so crashpad cannot attach them *by name*; whether the runtime `--attachment=` path
  could be a containing directory is UNDETERMINED.
* **Residual worth one line:** the SQLite WALs are not being checkpointed — `wickr_db.sqlite` 179,200 B
  with a **790,224 B** `-wal`; `metrics.sqlite` 20,480 B with a **4,120,032 B** `-wal`. Both encrypted,
  so defence-in-depth only, but a deleted row's ciphertext stays on the volume until checkpoint.

---


## ██ WAVE 10 (2026-08-01) — link (a): 37/37 KILLED, but ~20 kills rest on a premise I MEASURED FALSE ██

Read `W10-CRUX-linkA-triage.md`. Tools in `scratch/w10/`.

* **37/37 candidates taken to a definite verdict, all KILLED, 0 SURVIVES, 0 UNDETERMINED, and
  neither adversarial verifier overturned a single kill.** The synthesizer found a SECOND join bug
  itself — 33.5 % of NPL's `.pdata` entries are chained secondary chunks whose `BeginAddress` is
  never a key in `reach.json`, excluding 5 stores by construction — re-derived the join
  (`w10/W10-LEAD-join.py`) and took the rescued rows to verdicts. 32 → 37.
* **The systematic reason the search fails is constraint 5, and that is worth more than the count:**
  17/37 die on the stored value (zero or non-pointer); **15 are real pointer stores and NOT ONE
  points into a decoder frame buffer** — they point into module `.text`/`.rdata`, interior
  self-pointers, or generic small-block heap, i.e. the wrong 4 GiB window. 13 had a base register
  that was not an allocation base at all (interior `lea`, inline array element, embedded sub-struct,
  two *stack frames*).
* **The one candidate that fit the geometry AND sat on the decode thread AND was a real pointer is
  unreachable in this product.** `MB_ROW_DEC`/`MACROBLOCKD+0xf20` (`0x18018878c mov [rbx+0xf20],
  rcx`) is behind multithreaded row decode, and `0x180144709 mov dword [rbp+0x140], 1` sets
  `vpx_codec_dec_cfg_t.threads = 1` at the single `vpx_codec_dec_init_ver` call site; both writers
  of `pbi->max_threads` trace to it and `0x18018983b jle` returns before the
  `vpx_memalign(32, n*0x1420)`. **The whole libvpx MT decode path is dead code.**
* **★ BUT: constraint 3 was applied as an NT-heap bucket EQUALITY, and that is FALSE. MEASURED by
  the lead** (`scratch/w10/split_real.py`, against the real NPL.dll, the real `vpx_memalign→malloc`
  block and the real post-failure state):
  ```
  reclaim req   took the freed base (raw = mip-16)
         1923   3/3   <- same-size CONTROL, reproduced
         1907   1/3   *** smaller request took the freed base ***
         1859   0/3
         1795   3/3   *** smaller request took the freed base ***
         1600   0/3
  ```
  Block sizes are `round_up(req+8,16)`, so 1923→1936, 1907→1920, 1795→1808: **different block
  sizes, same base.** Non-monotonic because it depends on whether the *smaller* size's own bucket
  has an active LFH subsegment. ⇒ **constraint 3 must be relaxed from `==` to `<=`. Carry that into
  any future search** — it is a correction to the MODEL, and under it a target no longer has to
  match the freed block's size class at all, only fit inside it.
  **QUALIFIER:** measured in `python.exe` with the real DLL and the real freed block, not inside
  WickrPro; the mechanism is CONFIRMED, the specific sizes that land there would differ.
* **…AND IT REOPENS NOTHING. Checked by reading, not by screening.** Of the 37 kills, **zero rest on
  constraint 3 alone.** The two whose write-up *leads* with constraint 3 each carry two further
  independent kills:
  * **#13** (18512 B, the only real pointer store in its batch, pointer at +18480):
    `pointer_target = 0x180460f10`, an NPL.dll **.rdata** address — module image, wrong 4 GiB
    window, not sprayable (**constraint 5**); and it lives on the **audio thread**, gated on
    `cmp edi,0xbb80` (48 kHz) / `cmp esi,1` (mono), with format-change lifetime (**constraint 6**).
  * **#18** `PaWasapiStream` (1208 B, pointer at +1152): the value is a **PortAudio host-processor
    callback**, a module-image code pointer (**constraint 5**), allocated in `Pa_OpenStream` on
    audio-device setup — the same category as the `PortAudioManager` rejection in W6 §6
    (**constraint 6**).
  A keyword screen of the triage prose said "0 reopen" but produced a **false negative on #13**, the
  single most important candidate; only reading the full records settled it. Do not screen where the
  answer matters.
* **⇒ The link (a) negative no longer rests on the size-class premise at all, which makes it
  STRONGER than W10 stated. THE WALL IS CONSTRAINT 5.** Every real pointer in the reachable set
  points into a module image, is an interior self-pointer, or targets the generic small-block heap.
  **Not one points into sprayable decoder memory.** A future search should test constraint 5 FIRST:
  it is the cheapest discriminator and it is where every single candidate dies.
* **`.pdata` coverage — both numbers were right, for different binaries.** NPL.dll **89.83 %**
  (10.17 % blind); WickrPro.exe **93.66 %** (6.34 % blind); Sock5 93.82 %. My Wave-9 note calling
  89.8 % simply wrong was itself wrong — it is NPL's figure.
* **★ CFG is inert process-wide for a one-link-flag reason.** `WickrPro.exe` has `GUARD_CF` CLEAR
  (`DllCharacteristics 0x8160`) while `Qt6Pdf.dll` is already CFG-instrumented (`0x4160`). The
  guard checks in the DLLs are dead because the EXE never opts in. Cheapest hardening ask in the
  whole engagement.
* **NPL vendors its own libjpeg-turbo — and peer bytes provably cannot reach it.** Version 2.x,
  `>= 2.0 < 3.0`, older than 2.1.5.1 (exact point release UNDETERMINED, 2.1.0–2.1.2 INFERRED). It is
  fed by the **local camera**, gated at `0x180125964`/`0x180125967`. Good negative. But there are
  **four libjpeg-turbo copies in the product, three of them in the unsandboxed main process**, and
  **Qt6Pdf's copy is unpinned AND peer-reachable**.
* **PDFium: Chromium-130 snapshot** (ICU 74 / libpng 1.6.43 / zlib 1.3.0.1-motley). Five security
  guards are PRESENT but **all pre-M130, so they have zero discriminating power** — whether Qt's
  claimed `139.0.7258.67` backports reached PDFium **could not be established from the bytes:
  UNDETERMINED**. FreeType unpinned.

---


## ██ WAVE 9 (2026-07-31) — CORRECTIONS THAT CHANGE WHAT YOU SHOULD BELIEVE. `W9-CRUX-residuals.md`. ██

* **★ Wave 3's image negative is OVERTURNED. Remote bytes DO reach a `format = NULL` decode in the
  unsandboxed main process.** CONFIRMED at instruction level: the buffer at `[rdi+0x188]` handed to
  `QImage::loadFromData` at `0x140c1517a` is provably `reply->readAll()` (`0x140c140a6` /
  `0x140c140b7`). The four-site census is provably COMPLETE for WickrPro.exe — exactly one
  image-bytes IAT entry, exactly 9 direct references, no register-indirect use. **PDFium is in the
  sniffing set**: `QPdfIOHandler::canRead` peeks 6 bytes and strncmps `%PDF-` / `\n%PDF-` at
  `0x18000152c` / `0x180001548`. Independently, `func 0x140045870` checks a 4-item mime allowlist
  (`image/png|jpeg|bmp|gif`) and then passes `format = NULL` anyway at `0x140045bfd`, so the
  allowlist protects nothing — 9 of the 10 `QImage(const QString&, const char*)` call sites do this.
  **Also outside that census: `Qt6Quick.dll` imports `QImage::loadFromData` and lives in the same
  process**, so the QML image-provider path is further sniffing surface.
  ⇒ an attacker picks the decoder among ten resident plugins plus PDFium, in a CFG-free unsandboxed
  process. libwebp is patched (CVE-2023-4863 verified absent-of-bug in BOTH copies); **PDFium is
  UNPINNED**, and **NPL.dll vendors its own libjpeg-turbo** that nobody has examined.
* **★ "Link (a) is structurally excluded" is RETRACTED — a type bug manufactured it.** `ptrstore.py`
  compared int function addresses against a set of hex strings from `reach.json`, so all 52
  clean-slot pointer stores were marked unreachable BY CONSTRUCTION. Corrected join, reproduced by
  the lead: **13 in R_vtable, 32 in R_all** (not 0/0). First-pass triage of the 13: **4 real pointer
  stores, 1 zero-store false positive, 8 undetermined.** Write link (a) up as *"no target found by a
  search with 32 candidates left untriaged"*, NOT as *"no target exists"*.
  **The remaining work is the real triage: the join is displacement-based and BASE-AGNOSTIC**, so it
  shows "some object gets a pointer at offset X in a reachable function", not "an object in a
  reachable size class does". Bind each store's base register to an allocation and its size.
  Two further errors in that thread: `pool_alloc` has an **eighth, unbounded, caller-sized** path at
  `0x18011485d` above `0x7fff4`, so "exactly 7 fixed block sizes" is false above 512 KB; and the
  object sits at **block+12, not block+8** (`lea rax,[r14+4]` @ `0x180114876`), so the "688" figure
  is wrong.
* **`.pdata` covers 93.66 % of `.text` in WickrPro.exe, NOT 89.8 %** — a 6.34 % blind spot. The
  89.8 % figure was carried around this engagement without re-measurement. (Sock5 is 93.82 %.)
* **Qt's Chromium backport claim is UNDETERMINED, and the `139.0.7258.67` string is decorative** — a
  bare literal with one reference, consumed only by the internal version page. It is load-bearing on
  nothing. The thread that tried to settle this answered an adjacent question, and two of its
  "measured" coverage numbers used to justify not looking are false; one of them gated
  **CVE-2025-2783** (an in-the-wild-exploited Chrome sandbox escape) whose file anchor IS present and
  resolves to a single 383-byte function with a pseudo-handle rejection check. **That rejection is
  retracted.**
* **WOA: server-flippable, but NOT relay-forgeable — severity DOWN.** The store is real
  (`0x1409caebe mov byte ptr [rsi+0x195], 1`, bound to `forceOpenAccess`, three dominating gates,
  independently reproduced). But the payload is **not** transport cleartext on the default path: it
  is transformed under a key at `0x1434f84d0`/`0x1434f84e8` established at login (`0x140a0daa4`) and
  destroyed at logout (`0x140a0ef00`). A party that merely terminates TLS cannot forge it. The
  attacker is the **Wickr service**, not "whoever compromises the relay".
* **`--disable-web-security` does NOT reach the renderer** (W8), but note the gate's global has a
  `.data` default of **4**, i.e. **fail-open**; it is safe only because of main's immediate
  `0x140012d70 mov edx, 3`. Worth reporting as fragility.
* **New, and not memory-safety:** crash reporting is **ENABLED** (`crashpaddb/settings.dat` options
  bit 0 = `kUploadsEnabled`, with a non-zero `last_upload_attempt_time`), and F5-1 kills the victim
  process on demand — so a peer can force a minidump of an E2E client to be produced and uploaded.
  Capture flags, DSN provenance and the consent gate are NOT yet established. Separately,
  `WASAPIAudioManager` writes **raw microphone PCM to disk unencrypted** by default
  (`aud_in_{before,after}_aec_<pid>_<rate>_<ch>ch.pcm`, 28 files / 456 MB observed); the install
  directory is **user-writable**; and `wickr_db.sqlite` IS encrypted at rest (good — measured).

---


Rewritten at the close of **Wave 4** (2026-07-31) for a fresh session. Read this before touching
anything. Its job is to put you at the frontier instead of the starting line, and to stop you
re-walking ground that has already been closed with evidence.

---

## ██ WAVE 7 (2026-07-31) — THE AUDIO LEG IS CLEAN. LAST RCE-RELEVANT SURFACE CLOSED. `W7-CRUX-audio-leg.md`. ██

**The Opus wrapper has no memory-safety defect. H1 and H2 are REFUTED by disassembly AND by
measurement against the installed DLL.** Read `W7-CRUX-audio-leg.md` before touching audio again.
Tools/evidence in `scratch/w7/` (`harness_opus.py`, `W7-opus-harness.log`, `fmap.py`, `disr.py`,
`storescan.py`).

* **H1 (frame-size mismatch) REFUTED.** `opus_decode` is called at `0x180148fd6` with
  `frame_size = [this+0x144]`, which is the compile-time immediate **`0xb40 = 2880`** written
  **exactly once in the whole DLL** (ctor `0x180148956`; `storescan.py` over all 13,498 `.pdata`
  functions). The PCM buffer is a `Frame` allocated with the constant **`0x5a00 = 23040`**
  (`mov edx,0x5a00` @ `0x180148fa0`). Max write = `2880 × channels × 2` ⇒ **11520 B into 23040 B**.
  **Measured** with a `PAGE_NOACCESS` guard page flush against byte 23040, every legal Opus
  duration, both channel counts: worst case **11520/23040 = 50.0 %**; every packet > 60 ms returns
  **OPUS_BUFFER_TOO_SMALL (−2)** and writes nothing. Arguments identical to the live call site, so
  the harness qualifier does not apply.
* **H2 (peer channels/rate) REFUTED.** `AudioFormat::deserialize 0x180164100` stores fields 1–5
  with **no comparison at all** (peer control CONFIRMED at instruction level) — and then
  `opus_decoder_create 0x1802c6c50` whitelists `Fs ∈ {8000,12000,16000,24000,48000}` and
  `channels ∈ {1,2}` (`cmp ecx,0xbb80…`, `lea eax,[rdx-1]/cmp eax,1/jbe`), the wrapper **checks
  the error out-param** (`jns` @ `0x1801492c0`), and the packet path is **gated on `st != NULL`**
  (`cmp qword [rcx+0xe0],0 / je` @ `0x1801494f3`). A rejected format yields silence, not a crash.
* **H3 resolved.** `0x1801651bc call [rax+8]` → adjustor thunk **`0x1801494d0`
  (`add rcx,-0x138 / jmp 0x180148dd0`)** → `OpusDecoder::decodeSubPacket`. Proved through the
  thunk, not through an RTTI name. `PacketBundleDecoder` is **not a node** — it is embedded in
  `OpusDecoder` at `+0x168` (`add rcx,0xf8` @ `0x1801494fd`). **There are TWO virtual sinks**, the
  loop body and a tail call at `0x180165206` that passes the whole remaining budget. `len` is
  never compared against anything — but it is a **read** length only.
* **H4 clean.** `AudioResampler::init 0x180150100` independently clamps channels to `[1,8]` and
  both rates to `[8000,191999]`; the resampler's allocation size and its write length come from the
  **same** expression and the capacity is passed to the kernel. No divide-by-zero is reachable.
  Residual (defence-in-depth only): `CircularBufferAudio::write` does **not** clamp its sample
  count against capacity — safe today by a ~7.6× caller-side margin.
* **H5 dead.** `NPLHubAudioReadData 0x1803e7510` takes a **host**-supplied length, passes it as an
  in/out capacity, and **`WickrPro.exe` does not import it** (96 NPL imports; audio ones are
  `NPLAVAudio*` / `NPLHubAudio{Publish,Subscribe,Unpublish,Unsubscribe}` only). Same category as
  `NPLPacketSetSize`.
* **What the leg DOES give:** (i) the W4 §5b over-read's consumer is now identified — heap bytes
  become `(ptr,len)` for `opus_decode` → the victim's **speakers**; the speaker→mic→AEC→Opus
  round trip is **not** an info-leak channel, so Wave 4's "no information disclosure" blocker
  survives; (ii) a peer-driven **PLC amplifier** (`0x180148e3e`: `min(missing,10)` recursive
  `data=NULL` decodes, sequence from `Frame+0x98`) ⇒ ~11× decode work and ~230 KB of `Frame` churn
  per packet — resource exhaustion, INFERRED, not measured; (iii) `opus_decoder_destroy` runs
  **before** validation (`0x180149288`), so a rejected format permanently mutes that stream.
* **Correction:** `W4-CRUX-rce-path-assessment.md`'s closing pricing (*"not a bounded step — it is
  find a 0-day in one of the most continuously fuzzed codecs in existence"*) is **wrong**. The
  wrapper audit is bounded and took one session; libopus was never entered as a search target,
  only used as an oracle for two bounds read out of the shipped image.

**⇒ The remaining open item is unchanged and is W6 §9 line 1:** enumerate the **computed-size /
array-like** allocation corpus that W6 §6's constant-size sweep structurally cannot see.

---

## ██ WAVE 6 (2026-07-31) — LINK (a) NARROWED HARD; ONE ESCAPE ROUTE CLOSED. `W6-CRUX-link-a.md`. ██

**Answer to "is there an RCE path?": NOT on this evidence.** Read `W6-CRUX-link-a.md` before doing
anything else on F5-1/F4-2. Tools in `scratch/w6/`.

* **Link (b) is NOT open** — W5 §15/§18 closed live delivery. Only (a) is.
* **The mip-calloc regime does NOT rescue the chain — and this was the best remaining idea.** Choosing
  the victim's headroom so the failure lands on the `mip` calloc leaves the attacker's 1024×1024
  geometry committed with `mi` still in the old freed block, so the write sweeps **~290 KB through
  live heap with NO reclaimer needed** (reproduced: fault at mi+293,673). **But content control is
  lost there: 0/128.** `vp8_find_near_mvs` reads the above row at `mi − stride·76 = mi − 77,900`,
  78 KB of unknown heap, of which **515/1025 records read as inter** — the arithmetic decoder desyncs
  at macroblock 0. **Reach OR content control, never both.**
* **§13b's candidate is structurally dead.** All 17 node types share ONE 1702-byte `Node` base block
  (not three classes). Block 1712 ⇒ k=22=2×11 ⇒ no geometry has `mbc` even with `mbr ≥ 2`, and an
  8-aligned clean slot requires exactly that. Impossible under **every** geometry, not just the two
  checked.
* **Only 15.1 % of NT block sizes are reachable** as a freed `mip` block (76k+23 steps by 76, buckets
  by 16). Of reachable ones 98.1 % are clean-capable — the sparse lattice is the binding constraint,
  not slot alignment.
* **CORRECTION (W7, re-derived): the clean-slot floor is 696, not 244.** They are different
  quantities and `W6-CRUX-link-a.md` §§4/6/8 conflated them. **244** = the minimum *unwritable
  prefix* (`16+(mbc+2)·76`, at `mbc=1`) — below it the write touches nothing. **696** = the minimum
  *8-aligned clean slot* (`88+76·[2mbc+1+r(mbc+1)]`, `mbc` EVEN and `r` ODD, at `mbc=2,mbr=2,r=1`).
  ⇒ a target for the **leak-free partial overwrite** must be **≥ 704 B**, not ≥ 244 B. This shrinks
  the candidate set further and strengthens the negative. `slotstore_scan.py` was already right (its
  list starts at +696); only the prose was wrong. See `W6-CRUX-link-a.md` §9b.
* **Whole-DLL sweep of fixed-size classes: negative.** 1640 constant-size `operator new` sites → 19
  reachable → 5 clean-capable → the only one with a vtable is `Musigy::AV::PortAudioManager`, a
  startup singleton. **Residual: computed-size (array-like) allocations are invisible to that sweep —
  that is the last unexplored corpus.**
* **`NPLNodeCreate`'s convention was wrong in W5 §13a.** It tail-jumps `factory(a2, a3)`;
  `VideoDecoder`/`VideoEncoder` take a **codec string** as arg1 and the scene as arg2, the other 15
  take the scene as arg1. `NPLNodeCreate("VideoDecoder","vp8",scene)` constructs the real
  `VpxDecoder` node. 13/16 node types now build, vs 6. The local running-graph enumeration is
  therefore unblocked and is the cheapest way to close the residual.
* **W5 §18a's "the block was still FREE" evidence is misattributed.** The `−8` value is
  `vpx_memalign`'s stored raw pointer (`mov [rbx-8], rax` @ `0x18017f48a`), written at allocation
  time. Also CONFIRMED there: `mip = raw + 16` **always** (align=16 + 16-aligned NT heap), and the
  malloc request is `mip_size + 23`.
* The wrapper's decode-failure handler `0x180144320` is a 25-byte flag reset and **allocates
  nothing** — which is why nothing reclaimed the block in the live run.

---

## ██ WAVE 5 (2026-07-31) — F4-2 DEMONSTRATED END TO END, LIVE. READ `FINAL-REPORT-wave5.md`. ██

**Report: `FINAL-REPORT-wave5.md`. Working notes: `W5-CRUX-f4-2-content-control.md` (§15 delivery,
§17 gate, §18 end-to-end).** Tools `scratch/w3/lead/{victim_probe,sender_inject}.c/.exe`,
`scratch/w4/fuzz-vp8/{findtables,vp8modes,steer*,uaf_*,gate2ctx,nplgraph,gen_e2e_payload}.py`.

**One authenticated call peer sent 405 bytes of VP8 (3 frames) and obtained a byte-exact
content-controlled use-after-free write in the victim's unsandboxed process, followed by process
death.** Gate open live (`pc->mip=0`, `pc->mi` dangling 456 B into a freed 1923 B block); frame C's
64 bytes of `bmi[16]` matched the request byte for byte at all four steered macroblocks.

**NOT RCE — and the dump says why: the block was still FREE** (free-list pointer at `block-8`). The
write corrupted unowned memory; there was no vtable to redirect. **A real reclaiming object is the ONLY
remaining link.** It must be array-like (the first 244 B of the block are unreachable under every
geometry, so a vtable at offset 0 can never be hit), in an attacker-reproducible size class, and hold a
pointer that ALREADY points into sprayable memory (a partial overwrite cannot leave its own 4 GiB
window). Candidates: `PacketQueue` / `PacketMonitor` / `Puller` each hold a 1702 B block with pointers
at reachable offsets (`nplgraph.py`) — none reclaimed the block in the live run.

**Overturned by measurement, do not repeat:**
* "F4-2 content steerability is unproven" — W4 fed the arithmetic-coded mode section RANDOM BYTES, which
  can only decode to the zero corner. Both hypotheses predict "9 zero bytes". (§0 rule 4, again.)
* "~5 malicious publishers needed" — one peer suffices.
* **"free commit below ~4034 MiB"** — OUR OWN figure, and it is WRONG: `commit free` is a snapshot, not
  a bound. Windows GROWS THE PAGEFILE and satisfies the 2 GiB request. The precondition is a commit
  LIMIT that cannot grow (fixed/disabled pagefile, full volume, already exhausted). The live gate was
  opened with a Job Object per-process cap — that qualifier travels with the result.

**F5-2 (=F4-3) confirmed live and is NOT limited to small hosts:** a 34-byte frame takes **+2017.0 MiB**
of commit on a 19.5 GiB-free host (measured) and crashed/hung WickrPro on a 4 GiB host. Two decoder
contexts per publisher ⇒ ~4 GiB from one peer. Reportable on its own.

**Delivery mechanics that took three attempts (all our bugs, all fixed):** fire on the call's FIRST
packets and they are dropped before the peer subscribes; the two simulcast layers (bit 14 of
`[Packet+0x90]`) alternate nearly every packet so one counter scatters A/B/C across two decoder
contexts; and **every real packet reserves EXACTLY 29 zero bytes at `ptr` for the AEAD header with
`[Packet+0x18]` counting them** (477/477, audio and video) — stage as `[29 zero][frame]`,
`len = 29+frame_len`. Also: C must be REPEATED, because the real stream's next keyframe re-runs
`vp8_alloc_frame_buffers` and REPAIRS `pc->mi`.

**Engagement so far:** `FINAL-REPORT-wave4.md` (findings, negatives, remediation), `FINAL-REPORT-wave3.md`
for the prior wave, and two lead-verified crux files: `W4-CRUX-vp9-refutation.md`,
`W4-CRUX-buffer-size-chain.md`.
**Verdict of Wave 4:** Wave 3's "no attacker-reachable memory corruption" is **overturned**. There is a
peer-reachable heap OOB write on the receive path (F4-1), and a live-reproduced UAF write in the shipped
libvpx (F4-2) whose only gate is an allocation failure.

---

## 0. Read this warning first

Four reachability errors have now been paid for. The rules that came out of them:

1. **Disassemble the crux instruction yourself before headlining any reachability claim.** A subagent
   once read a `call [rax]` (edx=1) as "activate the descriptor"; it was a scalar deleting destructor.
2. **Check that you are testing the right invariant.** "Nothing rewrites the pointer at `parser+0x158`"
   was *true* and *useless*: the pointed-to object is a protobuf message re-parsed in place from the wire
   on every packet. Scanning for pointer stores could never have revealed that.
3. **NEW — a string comparison is not a code path.** The Wave 3 brief ranked "peer-selectable VP9
   decoder" as lead #1 purely because the factory `strncmp`s `"vp9"`. It does — and then builds the
   identical VP8 object and throws the flag away. **Follow the accepted token to the object it
   constructs, and check whether the distinguishing argument is ever read.** Cost: the #1 lead of a whole
   wave, refuted in ten minutes once someone read the constructor.
4. **NEW — a benign capture cannot refute a peer-controlled-field claim.** Someone built a live probe to
   test F4-1 and concluded "premise not supported — measured, 65/65". The measurement was real; the
   inference was invalid, because a benign sender declares the truthful length, so the observation is
   identical under both hypotheses. **Before you measure, ask what observation would distinguish the
   hypotheses.** If only a malicious sender can produce it, a normal call is not the experiment. Full
   worked example in §2.
5. **NEW — asymmetry within one function is the highest-yield pattern on this target.** F4-1 was found
   because the *sibling branch twenty instructions away* performs exactly the bounds check the vulnerable
   branch omits. When you find a validated path, read the unvalidated one next to it.

Also: **linear `.text` sweeps DESYNC.** Always disassemble per function using `.pdata` extents.

And: **the app prints its own scene graphs.** `Start, NetworkSource->Muter->Parser->CryptProxy->...` is in
the NPL log at every call start. The printed order is **source→sink** — proved by the send scenes, which
end with `...->CryptProxy->Serializer`. Two separate analyses have gotten the receive-path dataflow
direction wrong; check the log before you reason about ordering.

---

## 1. Where to look next, ranked

### #0 — IS THERE A PATH TO RCE?  Assessed 2026-07-31 → `W4-CRUX-rce-path-assessment.md`. **Not yet.**
Read that file before claiming anything about impact. Summary of what is now settled:

* **What the zero-fill lands on is identified and reproducible.** 2 of 3 live crashes are the identical
  fault at `NPL 0xe2074` (`mov rcx,[r9]` then `cmp r11d,[rdx+rcx+0x26]`, rcx zeroed → reads `0xa6`).
  RTTI: **`Musigy::NPL::Net::XorFecDecoder`** — the FEC decoder's queue of retained packets, and the
  nulled field is the packet **data pointer at offset 0**.
* **Why it is reproducible:** the packet pool `0x1800e0490` allocates `[0x120 hdr][0x40 headroom][payload]`
  as ONE block with the data pointer at +0 pointing into itself (`base+0x160`). Every media packet has
  this shape, so the overrun's neighbour class is structurally fixed, not luck.
* **The best RCE candidate found was REFUTED by two instructions.** FEC recovery XORs/memcpys peer
  packets — an attacker-content write, exactly what F4-1 lacks — but its length is clamped:
  `cmp r14d,r10d / cmovb r10d,r14d` @ `0x1800e38ce` ⇒ `len = min(source_len, alloc_size)`, and `r14d` is
  the value handed to the allocator and is never rewritten. The `memcpy` @ `0x1800e3850` likewise uses
  the allocation size as its length.
* **Partial pointer overwrite buys a READ, not a WRITE.** Every consumer of the corruptible pointer
  *reads* through it; all writes go to freshly allocated, correctly clamped buffers. And offset 0 is the
  data pointer — the object is POD, there is **no vtable to hijack**.
* **Route B (F4-2, content-controlled) is closed for one peer** on this host class — see #3.

**Language discipline:** what is demonstrated is *remote, repeatable, attacker-length-controlled
zero-fill into live adjacent objects, causing delayed crashes in unrelated subsystems*. **Not RCE.**

**ROUTE A IS NOW MEASURED AND CLOSED TOO (2026-07-31).** The grooming survey was run — three calls,
`oobprobe2.c`, offsets swept across the whole reachable adjacency:

* **C=640 → 43 pairs, victim SURVIVED. C=768 → 11 pairs, DIED (`0xc0000005`).** The bisection puts the
  lethal structure in **+640..+768**.
* Mapping +304..+752, **1392 samples**: **402 (28.9 %) were live bytes the `memset` zeroed** — the OOB
  write reconfirmed at scale — but only **1 pointer-valued qword (0.07 %)**, at +688.
* **⇒ the zero-fill lands almost entirely in non-pointer data and free space.** The lethal adjacency is
  rare (~1.5 % of packets), not systematic.

Grooming needs (i) a target bearing a code pointer or write-destination pointer at a known offset, and
(ii) a way to place it. Measured density is 0.07 %, and **the only allocation a peer can drive here is
more media packets — a fixed size class, so it cannot place a chosen object at a chosen distance.**
**Route A does not reach RCE with this primitive. Measured, not assumed.**

**CORRECTION + the real blocker.** "Fixed size class" was wrong: the pool takes the size as an argument
(`lea esi,[rbx+rdx]` @ `0x1800e04ad`, rdx = caller's size), and on receive that is the bytes the peer
actually sent — which FEC then *retains*. **So a placement primitive partly exists**, and a mid-call
`kind==1` FORMAT with changed geometry re-enters the change path at will (equality gate
`call [rax+0x20] / jne` @ `0x180132ec4`), which allocates polymorphic objects.

**None of that matters, because the actual blocker is different: there is NO information-disclosure path
back to the attacker.** Every over-read found is consumed locally — the failed-decrypt `QByteArray` is
discarded, the bundle over-read goes to Opus → speakers, FEC recovery is decoded locally; the send graph
encodes the *microphone*. Zeroing a vtable outright is just a NULL deref (the crash we already have);
turning this into control needs a **byte-precise partial** overwrite, and without a leak that is **blind**
against a measured **0.07 %** pointer density.

**⇒ What would reopen route A is an INFO LEAK, not a placement primitive.** The search is: sweep the send
paths for anything that echoes bytes derived from received packets. (Audited consumers show none; not an
exhaustive sweep.)

**Other live directions:** (a) the **`PacketBundleDecoder` over-read → Opus** surface found during this
pass (§5b of the crux) — peer-controlled heap bytes become `(ptr,len)` for the codec; `OpusDecoder` is
unaudited; (b) a **4 GiB VM** for F4-2 — but note this only ever supports a *low-RAM-victim* claim, not a
general one; (c) DTLS termination (#1) re-prices reachability but is not itself RCE.

### #1 — ~~Where does DTLS terminate?~~ **ANSWERED 2026-07-31: AT THE HUB. F4-1 IS SERVER-REACHABLE.**

This was the highest-value open question in the engagement and it is now settled from the client side,
with no server interaction. Four independent legs, all CONFIRMED:

1. **The client opens ONE media port to ONE hub.** From the client's own NPL log, once per call:
   ```
   [D Hub::Port::BindToUDP] Opening IPv4 port 0, GetAddress(): 0.0.0.0:0
   [I PortImpl] Starting signaling connection to <hidden> / <hidden>
   [D PortImpl] Connection option (1/2) udp://<hidden>
   [D PortImpl] Connection option (2/2) tls://<hidden>
   ```
   Two *transport options to the same hub* (UDP, TLS fallback) — **not** one connection per participant.
   The class is literally `Hub::Port`.
2. **The NPL API has no peer-connect entry point at all.** Every export is hub publish/subscribe:
   `NPLHubInitialize`, `NPLHubGetPort`, `NPLHubGetStreamCount`, `NPLHubAudioPublish/Subscribe`,
   `NPLHubVideoPublish/Subscribe`, `NPLHubUnpublish`, `NPLHubPinStream`, `NPLHubMuteStreamLocal`…
   You publish *to* the hub and subscribe *from* the hub. There is no "connect to peer".
3. **The media transport authenticates a SERVER, not a peer.** `NPLSetServerCertificates`
   (`NPL 0x1803cdcc0`) parses PEM (`-----BEGIN CERTIFICATE-----` @ `0x1804cd9a0`) into a trust set;
   NPL carries `SSL_CTX_set_verify` and `X509_STORE_add_cert`. Peer-to-peer DTLS would validate a
   per-participant fingerprint exchanged via signalling, not a static server certificate list.
4. **No SRTP anywhere** (`SRTP`/`srtp_*`: zero matches), so nothing protects media below the app layer
   except this single hub transport.

**And the header is outside the E2E envelope — already CONFIRMED separately:** the send scene is
`…->VpxEncoder->CryptProxy->Serializer`, i.e. `CryptProxy` encrypts the payload and *then* the
`Serializer` writes `PacketHeader` (site `0x18011d592`, disassembled). On receive, `Parser` runs
*before* `CryptProxy`. The header is therefore never covered by the E2E layer and is not carried as AAD.

> **⇒ The hub terminates the only transport, so it sees and can rewrite the plaintext `PacketHeader` of
> every participant — with no key material. F4-1 is reachable from the server.**

**What this changes:**

| | before | now |
|---|---|---|
| attacker | a malicious call participant | **the hub / whoever controls or compromises it / a malicious insider** |
| victims | the one peer they are in a call with | **every participant of every call** |
| key material needed | the call's media key | **none** |
| property broken | memory safety | **the core promise of an E2E product** |

It re-prices F4-3 (111-byte keyframe → 2 GiB commit) and F4-5's reachability the same way, and it
promotes the remediation "authenticate `PacketHeader` as AAD" from hardening to **critical** — that one
change is what removes the server from the trust boundary for call integrity.

**Residual, stated honestly:** hub-side traffic was never captured (out of scope under the RoE), so
"the hub sees the header" is a logical consequence of legs 1–4 plus the confirmed scene ordering, not a
direct observation of a server-side packet. Nothing in the client contradicts it and no alternative
topology is consistent with a single `Hub::Port` and server-certificate validation.

### ~~#1 — Where does DTLS terminate?~~ (original text retained below for context)
F4-1 is a CONFIRMED heap OOB write driven by a peer-declared length, confirmed reachable from **a call
participant**. The open question is whether it is also reachable from **the SFU/relay**: NPL.dll carries
DTLS (`DTLSv1_2_client_method`/`_server_method` @ `0x5284c2`/`0x5284dc`) and **no SRTP at all**, so media
rides inside DTLS and off-path attackers are excluded — but in an SFU topology DTLS terminates at the
server, which would then see and be able to rewrite the plaintext `PacketHeader` that the E2E
`CryptProxy` layer never authenticates.

If that holds, the server can heap-corrupt every participant, which breaks the property the product is
sold on. **Nobody has established it.** Settle it client-side: read the DTLS handshake set-up in NPL.dll,
determine what peer identity/fingerprint it validates against, and check whether there is one DTLS
session per remote participant or exactly one to the hub.

### #2 — ~~Live end-to-end demonstration of F4-1~~ **DONE 2026-07-31 — peer control of `n` MEASURED**
Full write-up in `FINAL-REPORT-wave4.md` §F4-1; raw data in `scratch/w3/lead/lenprobe-baseline.log`,
`lenprobe-patched-C300.log`, `E2E-F4-1-RESULT.txt`; sender tool `scratch/w3/lead/sizepatch_inject.c`.

Sender patched at `NPL 0x18011d592` (11-byte window) so `Buffer.size` becomes a **constant C = 300**
instead of the real length. Victim unmodified, instrumented with `lenprobe.exe`.

| | baseline | patched (C=300) |
|---|---|---|
| `Buffer`-branch packets | 69 | 44 |
| distinct `n` | **21** | **2** |
| `n == 300` | **0** | **43** |
| `n == 301` (baseline dominant) | 43 | **0** |
| plane-branch packets | 174 (165 distinct) | 1486 (836 distinct) — untouched |

**`n == C` exactly, 43/43, with no offset.** The peer-declared field reaches the victim's decrypt
callback verbatim. F4-1's length operand is demonstrated remote-controlled, not inferred.

**Three things this changed, all of which supersede what this brief said before:**

1. **The live carrier is AUDIO, not video.** The serializer site is gated on `[Packet+0x90]>>1 & 1`
   (`0x18011d557`..`0x18011d562`) — only packets with a `Buffer` submessage reach it. Encoded video is
   emitted as a single plane (`stride=len, height=1`) and takes the **plane** branch, i.e. the
   bounds-checked sibling. So the victim needs **no video at all** — being in a call is enough. (This is
   `W4-COMPLETENESS-CRITIC.md` §E1, now measured.) The old claim "the stock serializer sets `buffer` for
   every encoded-media frame" is **REFUTED**.
2. **There is no `+29`.** `NPLAVPacketGetBuffer 0x1803d0de0` returns `n = [Packet+0x18]` verbatim
   (`mov eax,[rcx+0x18]` @ `0x1803d0e10`; plane index != 0 → 0). No arithmetic. Measured end-to-end:
   `n == C`. **Delete the `n = real + K + 29` prediction from any future plan.** The historical
   "65/65, `n == payload_len + 29`" did **not** reproduce — 1773 records, transport length paired
   **zero** times. §C3 of the critique is closed: `Frame+0x18` is the peer field, carried verbatim.
3. **Do not read lenprobe's `pkt dwords:` dump as a field comparison.** It looks like it shows
   `+0x18 = 272` against `n = 301`. It is a race: the loader reads those dwords asynchronously after the
   hook fired, and the `Packet` object is recycled between frames (visible as consecutive records sharing
   one `packet=` address with different `ptr=`). This nearly produced a fifth reachability error.

**What remains (the escalation).** The fault itself has not been produced — C = 300 sat inside the benign
range 181–319, so the over-declaration was ≤ ~119 bytes and nothing crashed. Raise C in stages. Keep the
sink's order in mind: the `QByteArray(ptr,n)` over-read at `0x14013f401` runs **before** the `memset` at
`0x14013f49a`, so a large C faults on the read and blurs which primitive fired. Both properties that make
this easy still hold: the `memset` is the decrypt-**failure** arm (`0x14013f461 jle`), and inflation makes
GCM authentication fail by construction (`W4-CRUX-aead-settled.md` §4 — the tag sits *inside* the payload
the attacker really sent, so it cannot be damaged, only the authenticated ciphertext is extended).

**Escalation design — read this before picking a C.** The over-read and the `memset` cover the *same*
byte range, and the read runs first. That is not merely "blurring": it means

> **an access violation inside the `memset` is unobservable by range extension.** Any C large enough to
> leave mapped memory faults on the read at `0x14013f401` first, every time.

Corollaries:
* **Full Page Heap / gflags does not help** — the guard page is hit by the read. Don't spend time on it.
* **(c) `C = 0x100000` proves only the over-READ.** Worth one datapoint, but record it as a separate
  primitive; it says nothing about the write.
* **To evidence the over-WRITE, keep the whole range mapped** (small block, C in the low thousands) so the
  read survives and the `memset` lands on live adjacent heap. The expected crash signature is then
  **`STATUS_HEAP_CORRUPTION` or an AV inside a later allocator call — not an AV in `memset`.** A crash
  somewhere else is the *success* signature, not a failure. (Note the Wave-4 fuzzing agent's triage rule
  discarded exactly this class; see the critique.)

**DONE 2026-07-31 — the OOB WRITE is measured byte-for-byte, and the delayed crash landed inside it.**
Full write-up in `FINAL-REPORT-wave4.md` §F4-1. Tool `scratch/w3/lead/oobprobe.c`; data
`oobprobe-C4096.log`, `crash_analyze.txt`, `crash_detail2.txt`.

Two 5-byte detours bracketing the memset (`0x14013f495` before / `0x14013f49f` after — branch-scanned,
no target lands strictly inside either window), each snapshotting 64 bytes at `ptr+1024`, with C = 4096:

```
ptr=0x801128afcc n=4096  before: 5a e5 b1 ac d1 18 cc f2 ... (0/64 zero)   after: all 64 zero   CONFIRMED
ptr=0x801128976c n=4096  before: 21/64 zero                                after: all 64 zero   CONFIRMED
ptr=0x801128cc3c n=4096  before: 0/64 zero                                 after: all 64 zero   CONFIRMED
```
3/3 conclusive; 3 further samples were already-zero windows and are **not** scored (one is the same ptr
re-seen after its own earlier memset — a nice consistency check).

The app's own log corroborates the failure arm, and this string had never been captured before:
`[W AV.CryptProxy] All bytes set to zero, decryption failed most likely` ×3, plus
`[E PacketBundleDecoder] Illegal size (4067 bytes), skipping` ×3.
**`4067 = 4096 − 29` — that is where the disputed `29` actually lives**: a *downstream subtraction* of
`cryptoPadding`, not an addition to `n`. Consistent with `NPLAVPacketGetBuffer` returning `[Packet+0x18]`
verbatim. This finally closes the `+29` question in the other direction from the old note.

**The delayed crash is attributable by arithmetic.** No WER record — WickrPro ships Crashpad/Sentry, so
look in `%LOCALAPPDATA%\Wickr, LLC\Wickr Pro\crashpaddb\reports\*.dmp`. cdb:

```
c0000005 reading 0x473 at d3d11!CResource::Map+0x50, on the Qt6Quick RENDER thread
  0x7ff823b73491  mov rax,[rdx+0A0h]      ; rdx = 0x801128bb70
  0x7ff823b73498  mov dl,[rax+473h]       ; rax = 0  <== zeroed pointer field
field = 0x801128bb70+0xA0 = 0x801128bc10 = ptr(0x801128afcc) + 0xc44 = 3140 bytes  -> INSIDE [ptr,ptr+4096)
```
CONFIRMED: the range was zeroed, and the faulting field sits 3140 B past that same `ptr` (~2821 B beyond
the ≤319-byte real allocation). INFERRED (strongly, not measured): that this specific NULL came from this
specific memset — the minidump has no heap pages, so that qword was not observed before/after.

**Crash NOT in `memset` and not on the media path is the SUCCESS signature**, not a failure — an AV in the
memset is impossible by construction (the read precedes it).

**Remaining, in order:**
* **(c) `C = 0x100000`** as its own item — proves the over-READ primitive only; record separately.
* **Content control.** The `memset` arm writes zeros by construction. The `memcpy` arm at `0x14013f487`
  writes *plaintext* but only `out.length()` bytes, which GCM bounds to the real ciphertext — so content
  control needs a different idea, not a bigger C.
* **Heap grooming** — what gets zeroed is a function of layout; here it happened to be a D3D11 resource
  pointer. Nothing has been done on steering that.

### #3 — ~~Can a peer drive `malloc` to NULL on an unconstrained victim?~~ **ANSWERED 2026-07-31: NO, for
one peer on a 24 GiB host.** Detail in `FINAL-REPORT-wave4.md` §F4-2.

* **Measured, no call needed:** `mi_state.py` unconstrained → a 16383×16383 keyframe (the maximum the
  14-bit header field permits) returns `VPX_CODEC_OK`, +1999.8 MB, `mip` and `mi` both non-NULL. The
  allocation **succeeds**. No failure ⇒ no dangling `mi` ⇒ no UAF.
* **Arithmetic:** headroom 19.03 GiB ÷ 1.95 GiB per context ⇒ ~10 contexts; **2 contexts per publisher
  (now CONFIRMED)** ⇒ **~5 malicious publishers**. Two accounts exist.
* **CONFIRMED by disassembly — closes critique §E5.** Exactly two decoder contexts
  (`mov r14d,0x518` @`0x180144685` → `cmp r14,0x528` @`0x180144777`, step 8), and the selector is
  **bit 14 of `Frame+0x90`** (`shr eax,0xe / and al,1` @`0x1801447b2`) used as
  `ctx = [r12 + idx*8 + 0x4a8]` @`0x180144b53`. `Frame+0x90` is peer metadata off the wire, so **one
  publisher can fill both contexts** (~3.9 GiB). Still 2.5× short.
* **Tooling:** `scratch/w3/lead/allocgate.c` hooks the entry `0x186080` **and** the failure tail
  `0x186298` — all six failure branches converge there, so one hook catches every one. The entry hook is
  a **liveness counter**: without it, "0 failures" is ambiguous. On the 03:08 call it read
  0 invocations / 0 failures, i.e. **no data** (the victim died before the first keyframe decode), not a
  negative.

**Still open, and where to look if this is revived:** (a) a real N-party group call with ~5 malicious
publishers; (b) **small-RAM hosts — a 4 GiB machine inverts the arithmetic and may need only one peer.**
That is the single cheapest way to turn this back into a live finding, and it needs no new tooling, just
a smaller VM.

### #4 — ~~Is Wickr's own messaging transport pinned?~~ **INVESTIGATED 2026-07-31 — NOT a bypass. FAIL-CLOSED.**
`certPinningEnabled=false` is real (`HKCU\...\TopSecretMessenger`, endpoint
`https://gw-pro-prod.wickr.com/117/src`), but it does **not** weaken TLS validation. Chain, disassembled:

* `QNetworkReply::ignoreSslErrors` @ `0x140a68ad2` is **guarded**:
  `call 0x1408fc710 / test al,al / je skip` — only called if that returns true.
* `0x1408fc710` walks the `QSslError` list and counts **unacceptable** errors in `esi`, via a 22-entry
  jump table (index table `0x1408fc9ac`, targets `0x1408fc9a4`). Decoded:
  * **allowlist-eligible** (routed to `0x1408fc7a7`): `UnableToGetIssuerCertificate`,
    `SelfSignedCertificate`, `SelfSignedCertificateInChain`, `UnableToGetLocalIssuerCertificate`,
    `InvalidPurpose`, `CertificateUntrusted`, `HostNameMismatch` — i.e. exactly the chain-of-trust errors
    a private-CA/pinned deployment legitimately produces.
  * **always rejected** (`0x1408fc808`, also the `ja` default): signature failures, not-yet-valid,
    expired, revoked, invalid CA, path length, rejected, issuer mismatch, `NoPeerCertificate`, …
  * even an allowlist-eligible error only avoids the counter if `0x1409c7020` returns true
    (`cmovne eax, esi` @ `0x1408fc801`); the function returns "ignore" only when `esi == 0`.
* **`0x1409c7020` FAILS CLOSED** — 45 bytes, no "pinning disabled ⇒ accept" path:
  ```
  0x1409c7024  cmp qword [rcx+0x358], 0
  0x1409c702c  je  -> xor al,al (FALSE)      ; no pin set  => reject
  0x1409c7036  call 0x140a273d0              ; the real check
  0x1409c703b  test al,al / je -> FALSE
  0x1409c703f  mov al,1                      ; TRUE only when both pass
  ```
  (The public-key comparison itself — `publicKey` ×2 + `QSslKey::operator==` — sits alongside at
  `0x1409c7526`/`0x1409c7537`/`0x1409c7544`.)

**Conclusion:** with pinning off, the client simply relies on ordinary system-trust-store validation and
never reaches the allowlist path (a valid public cert raises no `QSslError`). No downgrade, no bypass.
Residual risk is the ordinary one (rogue CA in the user's store / public-CA compromise), not a defect.

**All four call sites audited — none is unconditional.**

* `QNetworkReply::ignoreSslErrors` @ `0x140a68ad2` — guarded by `0x1408fc710` (above).
* `QWebSocket::ignoreSslErrors` @ `0x140907161` (func `0x140907140`, 46 B) and `0x140b8d87e`
  (func `0x140b8d860`, 43 B) — **both call the same validator**:
  `call 0x1408fc710 / test al,al / je -> plain ret`, and only tail-`jmp` to `ignoreSslErrors` on true.
  This matters because `QWebSocket::ignoreSslErrors()` takes **no argument** and suppresses *all* errors,
  so an unguarded call there would have been a full bypass. It is guarded.
* `QNetworkReply::ignoreSslErrors` @ `0x140c2e893` (func `0x140c2e670`) — does **not** call
  `0x1408fc710`; it **inlines the same policy** with its own jump table over the error list:
  ```
  0x140c2e707  cmp byte ptr [r12+0x4a], 0
  0x140c2e70d  jne skip
  0x140c2e70f  inc esi                 ; count unacceptable errors
  0x140c2e731  test esi, esi
  0x140c2e733  je -> 0x140c2e88d       ; only when ZERO -> ignoreSslErrors
  ```
  Same counter shape, so also not unconditional. **Residual, honestly flagged:** its acceptance
  criterion is a per-error flag at `[r12+0x4a]` rather than the pin validator, and **what sets that flag
  was not determined**. That is the one loose end left in this sub-question.

### #5 — `Sock5.dll`'s driver-install and SQL-concatenation surfaces
Settled: it *is* mapped by default (static import), but its network code is gated behind Open Access,
off by default. Two things noticed and not chased: it statically imports 11 `SETUPAPI` functions plus
`newdev.dll` — the signature of installing a virtual network adapter driver, and nobody determined whether
that runs at load. And it builds SQL by string concatenation
(`"SELECT VALUE FROM VtcData WHERE KEY = '"` @ `0x1807724b0`); if any KEY is remotely influenced that is
an injection question nobody asked.

### #6 — ~~The audio side~~ **DONE 2026-07-31 → `W7-CRUX-audio-leg.md`. Wrapper clean, H1/H2 REFUTED.**
The trace below IS now finished: `Buffer.size` becomes `[Frame+0x18]`, which is the bundle walk's
**budget** (`mov edi,[rdx+0x18]` @ `0x1801650ba`) — the confirmed over-read — and it reaches
`opus_decode` only as a **read** length. Do not re-walk; see the WAVE 7 section at the top. F4-5's
reachability question below is untouched by that.

**`OpusDecoder` uses the same `AV::Parser`**, so `Buffer.size` lands in the audio Frame the same way and
nobody finished the trace. Separately, the plane bound check at `0x18011f1c0` is defeatable by 32-bit
truncation of the `imul r10d, eax` at `0x18011f1ac` (arithmetic confirmed by an executed stub). Its
impact was refuted for the shipped build; its reachability rides on the same relay question as #1.

### #7 — MLS / `WickrMlsSdkCpp.dll`, attachments, deep links
Examined in earlier waves with negative results; re-open only if #1–#6 dry up.

---

## 2. Do NOT re-walk these (closed with evidence)

### Closed in Waves 1–3
| Closed | Why |
|---|---|
| `WickrPro 0x1406e95d0` reachability from a call peer | Sealed by `mov qword [rbp+0x5b8], 8` (`destColorSpace=8`) at `0x1401514d9`, the only xref. Measured live: 43/43 frames single-plane BGR32, chroma strides **0** |
| "the chroma path is dead code" | FALSE — it runs on every local preview frame. (Both wrong conclusions have been drawn here; draw neither) |
| A peer announcing a raw/codec-less format to bypass the decoder | Subscribe requires a `vp8`/`vp9` codec name; live: `[E VideoHub(dec)] Unsupported codec (<null>)` → `err: 1` |
| The other two `storeFrame` call sites (`0x1406e99df`, `0x1406e9b83`) | Qt moc boilerplate, zero callers |
| Screen share / SFU steering the encoder resolution | Screen share disables the ladder (`0x180140419`); capture-property setter `0x180142990` has no geometry key |
| Attacker images decoded by content-sniffing in the unsandboxed process | Three live probes, zero hits (format=NULL call sites; WickrPro's IAT; inside Qt6Gui on `QImageReader::read`/`imageFormat`) |
| App-side `w·h·bpp` image sizing in WickrPro | Imports no `bits()/scanLine()/bytesPerLine()/depth()` from Qt6Gui |
| The floor-alloc/ceil-copy defect class | Two independent detectors over every `.pdata` function in both binaries: exactly one true positive (F1) |
| CVE-2023-5217 | VP8 *encoder*, send path; the sole `vpx_codec_enc_config_set` call never changes `g_threads` |

### Closed in Wave 4 — full detail in `FINAL-REPORT-wave4.md`
| Closed | Why |
|---|---|
| **"Peer-selectable VP9 decoder"** (was lead #1) | `--disable-vp9`; zero `vp9_*` symbols; factory `0x180122040` builds the same `Musigy::AV::VpxDecoder` for both names and the flag is discarded (first touch of `edx` in ctor `0x1801435a0` is `xor edx,edx` @ `0x18014360e`; two callers, both in that factory). See `W4-CRUX-vp9-refutation.md` |
| `h264` as a hidden FFmpeg surface | Rewritten to `"ffmpeg"` (6 chars), matches neither 3-char compare → returns NULL. No ffmpeg/avcodec/openh264 anywhere in the install |
| **"libvpx 1.9.0 is dangerously stale"** | Core VP8 bitstream-to-pixel path: **zero** memory-safety fixes v1.9.0 → HEAD. `detokenize.c`/`dboolhuff.c` byte-identical. Only the alloc-failure family survives = F4-2 |
| Threaded row decode | `cfg.threads = 1` (`0x180144709`) and `cmp ecx,1 / jle` @ `0x180189838` — `mt_decode_mb_rows` and the MB-row sync buffers are dead at runtime |
| Postproc / EC / input-fragment CVEs | All compiled in, all off (init `flags = 0`, `xor r9d,r9d` @ `0x180144720`) |
| CVE-2026-2447 | VP9 **encoder** `write_superframe_index`; VP9 disabled and encoder is the send path |
| **F1 odd-height** (was lead #2) | REFUTED for every reachable config: preview height is one of two compile-time immediates 710/360, both even; 40/40 camera modes even; runtime crop-rect setter never invoked; screen share has no self-preview tap. **No even-alignment op exists anywhere** — the safety is accidental. Residual: a device advertising an odd height below the request. Local boundary regardless |
| **"The format blob is a bespoke serializer"** (a wave-1 lead) | It is protobuf-lite (`Musigy.AV.Proto.Format`). All three deserializers clean. `NPLAVNetSinkGetFormatBlob` is a red herring — WickrPro never calls it; the blob travels in band as `kind==1` |
| `NPLPacketSetSize` | Unvalidated **and dead**: no callers in NPL.dll, absent from WickrPro's 96 NPL imports |
| `CryptProxy::onPacket 0x18011b637` as the F4-1 consumer | Not a receive-path consumer — behind `cmp dword [rsi+0x118], 0 / jle`, false on both receive scenes |
| The prior `STATUS_HEAP_CORRUPTION` fuzz crashes | Harness artifact: `vp8fence.c`'s 65536-entry quarantine table saturates (measured 65541 allocations at the crashing iteration) |
| Peer `Format` w/h reaching the converter's allocation arithmetic | `VpxDecoder::process` re-publishes the format with the real decoded `d_w/d_h` (`0x1801453db`..`0x180145402`) first |
| The VP8 core parse itself | Full static audit with compare-and-branch quoted for each: header parse, `setup_token_decoder`, `vp8_yv12_realloc_frame_buffer`, border arithmetic, entropy contexts, every table index. Plus ~370,000 fuzz iterations with guard pages after the input **and** after every libvpx heap block: zero OOB |
| WinSparkle appcast reachable by a network attacker | HTTPS to a hard-coded S3 URL, WinINet defaults validate the cert, **no** ignore-cert flags, no override path. expat 2.2.9 is old and reachable **only** for whoever controls the response |
| "`Sock5.dll` may not even be loaded" | It **is** — static, non-delay import; confirmed live in two processes. But its network code runs only with Open Access on, which is off by default |

### A worked example: an attempted refutation of F4-1 that was itself wrong
Retained in full because the failure mode is the one this engagement keeps repeating. A live-instrumented
counter-analysis (`scratch/w3/lead/lenprobe.c`) concluded F4-1's "premise not supported — measured".
**All three of its legs fail:**

1. **Ordering premise backwards.** It asserts `network → CryptProxy(decrypt) → Parser` and concludes the
   kind-2 handler runs *after* the decrypt callback. The app's own log says
   `NetworkSource->Muter->Parser->CryptProxy->...`, and the send scenes
   (`...->VpxEncoder->CryptProxy->Serializer`) prove the printed order is source→sink. Parser is first.
2. **Field identity contradicted by the constructor's stores.** Frame ctor `0x180135ea0`:
   `mov r14d, r8d` @ `0x180135eb4`, then `mov [rsi+0x40], rbp` @ `0x180135ff9`,
   `mov [rsi+0x10], rbp` @ `0x18013603e`, `mov dword [rsi+0x18], r14d` @ `0x180136049`. So `Frame+0x18`
   **is** the value the kind-2 handler read from the peer's protobuf at `0x18011efef`, and it is exactly
   the `n` that `NPLAVPacketGetBuffer` hands the decrypt callback alongside `ptr = [Packet+0x40]`.
3. **The measurement cannot discriminate.** `n == real + 29` in 65/65 samples was taken **on a normal
   call**. A benign sender declares the truth, so that result appears under both hypotheses. Its stated
   criterion ("pointers pair up and `n == len` every time → `n` is the real received length") is an
   invalid inference.

It did contribute one correct negative: it independently re-confirmed the code shape at instruction level
and IAT-resolved the same two thunks. **Lesson: state, before you build the probe, which observation
would falsify the claim. Here only a malicious sender produces one — so the experiment is §1 #2.**

---

## 3. Capabilities already built (reuse, don't rebuild)

`E:\tmp\wickr\scratch\w3\lead\` — external `WriteProcessMemory` loaders that verify target bytes before
patching, refuse on mismatch, and restore on Ctrl+C / `--unhook`. Each `.c` has a header explaining its
hook, register safety and displaced bytes.

| Tool | Capability |
|---|---|
| `disfunc.py`, `disfunc_pro.py` | per-function disassembly with `.pdata` extents (NPL / WickrPro) — **use these, never a linear sweep** |
| `callers.py`, `callers_pro.py` | direct call/jmp xref finder, takes hex VAs as argv |
| `class_vtable.py` | MSVC RTTI: class name → COL → vtable → virtual methods; also works backwards from a vtable VA |
| `leaxref.py`, `dataref.py`, `iatxref.py`, `fstr.py` | data and IAT xref helpers |
| `harness_vp8.py` | ctypes harness against the **installed** NPL.dll, calls libvpx by address |
| `probe_sites_loader.c`, `probe_sites2_loader.c`, `probe_raw_loader.c` | passive per-site hit counters, register/flag-safe detours |
| `recon3..6_loader.c`, `victim_recon.c` | argument/struct capture on the send path / at the receive sink |
| `imgprobe{,2,3}.c` | templates for hooking call sites / the IAT / inside a third-party DLL |
| `lenprobe.c` | two-site live argument capture across NPL **and** WickrPro (decrypt callback + `NPLPacketFromData`). Its *conclusion* was wrong; the *instrument* is sound and reusable |
| `rawpub2_inject.c`, `rawpub2_portable.exe` (/MT) | **sender-side media crafting** — drops the VpxEncoder and forges wire plane geometry. The delivery vehicle for §1 #2 |
| `repro.c`, `pcdemo.c`, `pcdemo_partial.c` | harness crash + PC control + ASLR-surviving partial overwrite (F1) |

`E:\tmp\wickr\scratch\w4\` — Wave 4 output per dimension. Notably `fuzz-vp8/` (the VP8 boolean encoder
`vp8build.py`, the guard-page allocator `vp8fence.c`, and `uaf_reclaim.py` which reproduces F4-2 3/3), and
**`_journal_dump/` — all 16 structured agent results as JSON. Read these before re-deriving anything.**

Build: `build*.bat` next to each source (VS2022 BuildTools, `/MD`; `/MT` for portability). pefile +
capstone installed.

> **If you raise `TBLN` in `vp8fence.c`** (currently `65536`, which caps campaigns at ~9,700 iterations
> per process and produced three false heap-corruption crashes), add eviction rather than just enlarging it.

---

## 4. Environment facts worth knowing

* **Client logs are gold**: `%LOCALAPPDATA%\Wickr, LLC\Wickr Pro\logs\*.txt` (client, `[VV CnM]` tags) and
  `*_npl.txt` (NPL — component tags, error reasons, **and the full scene graph at every call start**).
  **Check the logs before building a probe.** Two analyses have gotten dataflow direction wrong that the
  log answers in one grep.
* **PIDs change constantly** — re-read `Get-Process WickrPro` every time.
* **Video on/off inside a call does NOT re-publish.** The send graph is built once per call, so
  sender-side patches must be applied with **no call active**, then place a fresh call.
* **cdb is not usable on the media path** — invasive attach drops the real-time call before anything can
  be observed (measured: zero media threads under cdb). Use the passive native probe pattern.
* **Protobuf field *names* are not recoverable.** The AV protos are compiled against protobuf-lite: only
  message full-names are embedded, no `FileDescriptorProto`. Recover field numbers and types from the
  generated parsers.
* **Wave 3 correction:** `RECV-ROUTING-GROUND-TRUTH.md` records `PacketHeader` field 9 as a string. It is
  a nested `Buffer` **message**.
* Two operator accounts exist and a 2-machine call setup has been exercised. RoE: own accounts and own
  machines only; no calls to unwitting parties; no fuzzing against Wickr production servers — harness the
  local parsers; benign PoCs; do not fabricate positives.
* Mitigations measured: **CFG absent** in both `NPL.dll` and `WickrPro.exe`; no CET; default NT heap;
  high-entropy ASLR; media and UI unsandboxed in the main process.
* **The Wave 4 workflow died mid-run twice** (process exit, no completion record). If you orchestrate,
  read `journal.jsonl` in the workflow transcript dir for partial results before re-running anything —
  7/7 recon dimensions and 9 verdicts survived the second death and were recovered from it.

---

## 5. How to frame anything you find

Distinguish, every time and in the artifact itself:
* **CONFIRMED** — you disassembled it or measured it live (say which).
* **INFERRED** — reasoned from confirmed facts.
* **REFUTED** — state it plainly; do not let a dead hypothesis linger in the narrative.

And if you demonstrate something in a harness, the qualifier travels with the result: **a harness that
supplies arguments the live path does not supply proves exploitability-if-reachable, not a reachable
vulnerability.** (Wave 4's F4-2 repro is the counter-example worth imitating: it used the *public* wrapper
with argument-identical values to the live call site, so the qualifier does **not** apply.)

**~~Outstanding process gap:~~ CLOSED 2026-07-31 — `W4-COMPLETENESS-CRITIC.md`.** The independent
"what's missing?" review of `FINAL-REPORT-wave4.md` has now been run against the primary evidence (all 16
`_journal_dump/` results, not the report's own narrative). **Read it before quoting Wave 4 anywhere.**
Headlines, each with a journal citation in the file:

* ~~**F4-1 may be UNDER-stated.**~~ **SETTLED 2026-07-31 → `W4-CRUX-aead-settled.md`.** The AV media
  decrypt **is AES-256-GCM** and `EVP_DecryptFinal_ex` (`0x140cb8bb6`) has its result **checked**
  (`0x140cb8bbb cmp eax,1 / jne`) → failure returns NULL → empty `QByteArray` → the `memset` arm.
  **F4-1 is a zero-fill, as reported.** Framing is `algo(1) || IV(12) || TAG(16) || ciphertext`
  (param table `0x1432e25a0` = `00 00 00 00 20 0c 10 01`), so `1+12+16 = 29` **is** `cryptoPadding` —
  the 65/65 benign capture independently pins the suite. "Fails by construction" is now demonstrated:
  the tag lies *inside* the payload the attacker really sent, so inflation cannot damage it, only
  extend the authenticated ciphertext with heap bytes the attacker does not control. **⇒ the OOB write
  is guaranteed, and the `memcpy` arm is unreachable under inflation.**
  **NEW LEAD out of that pass** (§6 of the crux, *not* a finding yet): a **32-bit sequence** at
  descriptor+`0x5c` drives a key-ratchet **loop** (`0x140cb64f0`..`0x140cb65c4`, one iteration per
  epoch, `epoch = dword [keyobj+0x18]`) **before any authentication**, and the gate at `0x140cb682c` is
  `jbe` — so one large value both burns CPU and **permanently wedges the stream**. CONFIRMED loop;
  INFERRED that descriptor+`0x5c` is peer-settable (not traced to a field number). Two cheap desk
  checks settle it.
* **F4-2's blast radius is under-stated by orders of magnitude.** The report's "144 bytes" is the
  first-yv12-failure regime. In the **mip-calloc** regime — which the attacker selects by choosing the
  resolution against the victim's headroom — the verifier measured **33 KB and 330 KB past a 1,900-byte
  block**, with **~76 MB** computed. None of it reached the report.
* **The libvpx baseline is not stock v1.9.0** (`restart_threads` backport, `0x18017d93f`/`0x18017deb0`),
  so "zero upstream memory-safety fixes v1.9.0→HEAD" is mis-scoped. F4-2's own commits survive (checked
  byte-wise); the *negative* does not. Also: only **3 of the 5** "each checked individually" commits have
  byte-level evidence — `a5e2e6528` and `263ddc9e3` were never checked.
* **The VP8 static audit is not complete** and the report does not say so: `decode_macroblock`,
  `vp8_decode_mb_tokens`, `decode_coefs`, `read_mb_modes`, both inter-predictor builders and the MV clamp
  bounds were never disassembled — and F4-2's own live fault lands inside `read_mb_modes 0x1801beea0`.
* **7 of 17 candidates never had an independent verifier**, including F4-6, F4-7, and **both headline
  refutations** (F1 odd-height; the fence-table harness-artifact call, which is the fuzzing agent
  clearing its own harness of three `STATUS_HEAP_CORRUPTION` crashes with no second opinion).
* **Two defects were dropped between journal and report**: `CryptProxy` forwards the packet when
  decryption fails (fail-open — also missing from F4-1's remediation), and the
  decoder-reset-on-format-change is **dead code** (`0x18014406a` sets `this+0x4b9`, then `0x180145b60 ->
  0x180122610` overwrites the compared cached format) — the shared precondition of F4-2 **and** F4-4.
* **Never asked:** the audio leg (`OpusDecoder` may reach the same `decryptCallback`, which would drop
  F4-1's victim precondition to "is in a call"); `AudioFormat` fields 1..6 unclamped; whether a mid-call
  `kind==1` FORMAT rebuilds the decode graph (58 live events); the `VideoFormat` crop rect; and whether
  `Musigy::AV` ships on Wickr mobile/macOS (the largest unpriced impact multiplier here).
