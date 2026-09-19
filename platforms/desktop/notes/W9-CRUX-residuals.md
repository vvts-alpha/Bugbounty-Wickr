# W9 — residuals round: what moved

AWS Wickr Desktop **6.72.20.0** (Windows x64). Authorised assessment, operator's own machines.
Static analysis and local harnessing only. **WickrPro.exe was never launched, no call was placed, no
traffic was generated, nothing in the installed tree was modified** — by every thread in this round
and by this note's own re-verification.

Labels: **CONFIRMED** = disassembled or measured (which one is stated). **INFERRED** = reasoned from
confirmed facts. **REFUTED** = stated plainly. Qualifiers travel with the results they qualify.

---

## 0. Why this round existed, and the one-line answer

The engagement's verdict was *"no path to remote code execution is established"*. The operator asked
whether the search's measured coverage limits meant that verdict was really a statement about the
product or only about the search. Four threads were sent at four limits:

| # | limit | thread | outcome |
|---|---|---|---|
| A | the computed-size / array-like allocation corpus was swept at a **median of 7 instructions** per site | `reclaim2` | **NARROWED — and the thread's own negative was refuted** |
| B | the QtWebEngine/Chromium backport claim was never tested against the shipped bytes | `qtbackport` | **NARROWED — headline downgraded REFUTED → UNDETERMINED** |
| C | renderer settings and image/PDF decoder reachability were assumed, not measured | `websettings` | **CLOSED on both items, with a new positive and a new finding** |
| D | an unverified sweep claim (`mov byte ptr [rsi+0x195],1`) had propagated into a report | `woa` | **CLOSED on the question asked; the severity claim refuted** |

**What moved.** One thread produced a clean, verified positive and a new finding (C). One resolved a
long-standing attacker-model dispute in the strong direction, then over-claimed the mechanism (D).
Two produced negatives that did not survive verification (A, B) — in both cases because a
*measurement offered as a reason not to look* was wrong.

**What did not move.** Nobody in this round demonstrated control of the instruction pointer from a
remotely deliverable input. The honest label on F5-1 is unchanged: **remote, content-controlled heap
corruption with process death**.

**The one structural change to the engagement's own position.** §4 of `STATUS-consolidated.md` says
the failure to reach a target is *"structural"*. **That word must be withdrawn.** Thread A's attempt
to make it structural instead produced (i) a whole-binary clean-slot sweep whose zero result was a
type-mismatch artifact — the corrected join returns **32 untriaged candidates** — and (ii) an
arithmetic exclusion of an entire allocator that missed an eighth, unbounded path inside the same
function. The correct wording is **"no target found by a search whose coverage is stated below, with
32 candidates left untriaged."**

---

## 1. Thread-by-thread: closed, narrowed, or open

### Thread A — `reclaim2`: the reclaim target for F5-1. **NARROWED. Its negative is REFUTED.**

**What survives, and it matters:**

* **CONFIRMED (disassembled).** `Musigy::AV::Frame`, the object the brief nominated, cannot hold a
  reachable pointer in its fixed-size form. Factory `0x180136080` allocates `0xd8` = 216 B
  (`0x1801360ab b9d8000000 mov ecx,0xd8`), and the shared constructor `0x180135a40` puts its highest
  pointer at `0x180135b61 498987c8000000 mov [r15+0xc8],rax` = **+200**, below the 244-byte minimum
  unwritable prefix. *Qualifier the verifier added and I accept:* for a 216-byte object this is a
  **tautology**, not a finding — the whole object is inside the prefix. For the **variable-size**
  variant from factory `0x180136120` (`0xd0 + Σ(stride·h+15) + 8`, unbounded) the evidence covers the
  constructor only, so "holds no reachable pointer under every geometry" is **INFERRED**, not
  CONFIRMED.

* **CONFIRMED (disassembled).** *The genuinely new positive, and it changes the F5-1 write-up.* **The
  reclaim is engineerable.** Two computed-size allocations run per frame on the decode thread at a
  size and with content the peer chooses outright:
  - `0x180145004 e867d7fcff call 0x180112770` → `operator new[](d_w · |d_h|)`, with `d_w`/`d_h` taken
    straight from the decoded `vpx_image_t` and the block then filled by `memcpy` at `0x180145032`
    with decoded (attacker-chosen) pixels. Paired free at `0x180144fdd e802cafcff call 0x1801119e4`.
    Gated by a flag read at `0x180144f45 4180bfbb04000000 cmp byte [r15+0x4bb],0`.
  - `0x180136195 ff1525ea2e00 call qword ptr [rip+0x2eea25]` → `operator new(0xd0 + Σ(stride_i·h_i+15)
    + 8)`, **not** behind that flag.

  W6 §8's row *"the packet itself carries no reachable pointer, so this places a useless object"* is
  **superseded**. The attacker controls the freed block's size class **and** a same-thread,
  chosen-size, chosen-content allocation in the window. The missing property is now exactly one: the
  reclaiming block must carry a **pointer**, at an 8-aligned clean slot, already aimed into sprayed
  memory.

* **CONFIRMED (disassembled).** `vp8_de_alloc_frame_buffers` (`0x180186320`) leaves **two** dangling
  MODE_INFO pointers, not one. Five zero-stores at `0x180186396`/`0x1801863a9`/`0x1801863d2`/
  `0x1801863d9`/`0x1801863e0` (all `rbx=0` from `0x180186394 33db xor ebx,ebx`); `+0xc60` (`mi`) and
  `+0xc70` (`prev_mi`) are never written. Field identity of `prev_mi` from the re-init idiom
  `0x18017ddf1 486bc84c imul rcx,rax,0x4c` / `0x18017ddf5 add rcx,[rbx+0xc68]` /
  `0x18017ddfc 48898b700c0000 mov [rbx+0xc70],rcx`. `prev_mi` is a **read** path (near-MV /
  error concealment), so this is a use-after-free *read* of the same freed block. **It belongs in the
  vendor defect description** — the fix must NULL both.

**What is REFUTED, and this is the deciding item of the whole round:**

* **REFUTED (I reproduced it myself this session).** Claim 3, the headline —
  *"0 of the 52 clean-slot pointer stores are in R_vtable; 0 in R_all"* — **is a `str`/`int` join
  artifact, not a measurement.** `E:\tmp\wickr\scratch\w9\reach.json` stores addresses as hex
  **strings**; `E:\tmp\wickr\scratch\w9\ptrstore.py` lines 62-64 do
  `Rv, Ra = set(R["vtable"]), set(R["all"])` and then test `h[1] in Rv` where `h[1]` is `f.start`, an
  **int** (`csweep.py`, `Func.__init__`: `self.start = base + s`). Every membership test is `False`
  by construction.

  I re-ran the join over the thread's own `ptrstore.json` + `reach.json` with `int(x,16)` keys:

  ```
  total pointer stores 3831   clean-slot stores 52
  BUGGY join (int key vs str set): 0
  FIXED  R_direct   0
  FIXED  R_vtable  13
  FIXED  R_all     32
  base rate: 1230 of 3831 stores are in R_vtable  (32.1%)
  ```

  At a 32.1 % base rate, 0/52 has p ≈ 5·10⁻⁹. **The thread's own companion figure "1,230 of 3,831
  stores ARE in R_vtable" was computed with a correct join and sits in the same paragraph as the
  broken one** — the two numbers are mutually inconsistent and that should have been the author's own
  tripwire. Survivors I disassembled from the shipped bytes, e.g.
  `0x180247f0f 48898fb8020000 mov [rdi+0x2b8],rcx` (+696, R_vtable);
  `0x18015bc3e 4d89be80040000 mov [r14+0x480],r15` (+1152, R_vtable — and **+1152 is a clean slot of
  the live pinned 64×64 geometry**); plus stores inside libvpx itself (`0x1801833d0`, `0x1801ac310`,
  `0x1801ab820`, `0x18017fd90`) and one inside `vp8_de_alloc_frame_buffers` itself
  (`0x1801863a9`, +0x22c8). **None of the 32 has been triaged.**

* **REFUTED (I disassembled it myself this session).** Claim 2 part 1 — *"pool_alloc has exactly 7
  fixed block sizes, therefore the whole NPL media slab allocator is arithmetically excluded"*.
  There is an **eighth, unbounded, caller-sized path inside the same function the author dumped**:

  ```
  0x1801147f5  81faf4ff0700   cmp edx, 0x7fff4
  0x1801147fb  7760           ja  0x18011485d
  ...
  0x18011485d  8bca           mov ecx, edx
  0x18011485f  4883c104       add rcx, 4
  0x180114863  ff1557033100   call qword ptr [rip+0x310357]   ; -> msvcrt malloc
  ```

  For any request above `0x7fff4` the pool mallocs **exactly `size+4`** — arbitrary, caller-chosen,
  no class quantisation. The arithmetic closure holds **only for requests ≤ 0x7fff4**. The smallest
  mip block above that boundary is at `k = 6899` (76·6899+23 = 524,347 → NT 524,352 B), and every mip
  block from there up is matchable by choosing `S = blocksize − 4`. W6 §8 already records that the
  packet pool takes the peer's byte count as its size (`0x1800e04ad`), so this path is peer-drivable.
  The class arithmetic below `0x7fff4` **does** survive and I re-derived it independently: over
  `ceil((76k+23)/16)·16`, only `0x400` (k=13, prime ⇒ mbc=0 or mbr=0) and `0x10000` (k=862=2·431 ⇒
  mbc=1 odd, or mbr=1) are ever attainable; `0x80/0x200/0x1000/0x40000/0x80000` admit no `k` at all.

* **REFUTED, and I can prove it more strongly than the verifier did.** Claim 2 part 2 — *"returns
  block+8 … this CONFIRMS the 688 figure"*. The header is **12 bytes**:

  ```
  0x180114844  4983c608       add  r14, 8          ; class paths only
  0x180114871  488b5c2430     mov  rbx, [rsp+0x30]
  0x180114876  498d4604       lea  rax, [r14+4]    ; <-- the return value
  0x18011487f  418936         mov  dword ptr [r14], esi   ; 4-byte class tag
  ```

  So `[B..B+7]` is the free-list next slot, `[B+8..B+11]` is the class tag, and the object starts at
  **`B+12`**. The oversize path never executes `add r14,8`, so it returns `B+4`.
  **Independent arithmetic confirmation the verifier did not give:** every one of the seven ladder
  thresholds is exactly `class − 0xc` — `0x74 = 0x80−12`, `0x1f4 = 0x200−12`, `0x3f4 = 0x400−12`,
  `0xff4 = 0x1000−12`, `0xfff4 = 0x10000−12`, `0x3fff4 = 0x40000−12`, `0x7fff4 = 0x80000−12`. A
  12-byte header is the only value consistent with all seven. **W6 §9b's open question is now
  settled, and settled against the figure it recorded:** the pool-allocated clean-slot floor is
  `696 − 12 = ` **684**, not 688, and the admissible object-offset residue is **≡ 76 (mod 152)**, not
  ≡ 80. Those two residue classes are **disjoint**, so any future filter keyed on the `+8` assumption
  inspects entirely the wrong offsets.

**Thread A verdict: NARROWED.** The candidate the corpus nominated is genuinely excluded (for its
fixed-size form). The reclaim mechanism is genuinely engineerable — a real advance. But the two
"independent closures" that made the negative structural do not hold, and 32 candidate stores are
untriaged. Link (a) is **not closed**.

---

### Thread B — `qtbackport`: is `qWebEngineChromiumSecurityPatchVersion = "139.0.7258.67"` true? **NARROWED. Headline downgraded REFUTED → UNDETERMINED.**

**What survives (verifier re-read every byte and reproduced all of it):**

* **CONFIRMED (disassembled).** The version string is **inert**. It occurs exactly once in the
  196 MB `Qt6WebEngineCore.dll`, has exactly one rip-relative reference in 143,842,691 bytes of
  `.text`, and that reference *is* the whole exported accessor:
  `0x180303170 488d05b9218508 lea rax,[rip+0x88521b9]` → `0x188b55330 = "139.0.7258.67"`;
  `0x180303177 c3 ret`. The verifier additionally ran absolute-64-bit and RVA32 pointer scans over
  the whole file — **0 hits each**, so it is in no data table or vtable either.
* **CONFIRMED (disassembled).** Exactly one caller: `0x1802adf2a e841520500 call 0x180303170`, inside
  the function that renders QtWebEngine's internal `qt://` version page (it emits `qt_version.css`,
  `images/qtwebengine.png` and the four `qtwebengine_*` keys). **It gates nothing and is derived from
  nothing.**
* **CONFIRMED (disassembled).** **WickrPro.exe republishes it.** It imports the accessor at IAT slot
  `0x140d575e0` and calls it in `main`: `0x140012cd2 ff150849d400 call [rip+0xd44908]`, wraps the
  result in a `QString`, and stages it with `'c9c94459'` and `'4.4.0.0181'` into a call at
  `0x1408d5730`. **The vendor's own surface republishes Qt's unverified self-report as if it were a
  fact about their build.**
* **CONFIRMED (measured + instruction-level).** Ten independently dateable components read the
  Chromium-130 pin: V8 **13.0.245.25** (`0x1802adf69 488d0518c38908`, cross-checked against the
  version tag at offset 0x10 of `resources\v8_context_snapshot.bin`, which V8 refuses to deserialize
  on mismatch), SQLite **3.46.0** + the 2024-05-23 manifest SOURCE_ID (`0x185915306`, `0x185915336`),
  `Skia/130`, libvpx 1.14.1-357, libaom 3.10.0-63, ICU 74, libpng 1.6.43, zlib 1.3.0.1-motley,
  libjpeg-turbo 2.1.5.1, and the **C libavif** with zero Rust artifacts image-wide.
* **CONFIRMED.** `Qt6Pdf.dll` and `Qt6WebEngineCore.dll` are cut from **one** Chromium snapshot —
  two anchored functions byte-identical after normalising rip displacements (102 instructions, 26
  differing bytes, all inside displacement fields), 52-59 % verbatim code-window overlap. So the
  component pins cover the **unsandboxed** PDFium copy as well as the sandboxed renderer.
* **CONFIRMED.** A stale `LASTCHANGE`: `888dc4b1…-refs/branch-heads/6099@{#1876}` — branch 6099 is
  the **Chrome 120** line — and it is what `chrome://gpu`'s `revision_identifier` and the reduced
  User-Agent's `@hash` report. Second instance of Qt-supplied version metadata that does not describe
  the shipped code.
* **CONFIRMED.** Wickr builds Qt, including the whole Chromium subtree, from **their own** source
  checkout at `D:\WickrDesktopQt\qt6\`. §5.1a's consequence stands: the third-party pinning is
  Wickr's, not stock Qt's.

**What is REFUTED:**

* **REFUTED.** The verdict *"the natural reading of 139.0.7258.67 is REFUTED"*. The pre-registered
  test — *present-via-roll ⇒ post-130 constants; absent ⇒ M130 constants* — **has zero discriminating
  power against the hypothesis that actually matters**. Qt's documented mechanism is source
  cherry-pick onto a 130-based fork; under that mechanism the ten constants read M130 whether every
  fix is applied or none is. Both hypotheses predict the identical observation. **This is method rule
  2 (wrong invariant) wearing method rule 4's clothing.** Worse, the binary itself already excluded
  the "natural reading" before any component work: the same function publishes
  `qtwebengine_chromium_version = "130.0.6723.192"` (lea at `0x1802adefc`) and
  `qtwebengine_chromium_security_patch_version = "139.0.7258.67"` (lea at `0x1802adf42`) **sixteen
  bytes apart in the same literal pool**. The two-constant scheme is in-binary evidence that the
  security-patch constant is *not* a claim about component state. **The correct label for the
  question asked is UNDETERMINED.** The thread conceded exactly this in a residual and then kept
  REFUTED in the verdict.
* **REFUTED.** *"Ten components … no post-130 component roll of any kind occurred"* — the numerator
  is right, the denominator was never reported. At least **31 distinct third_party components** are
  visible in the surviving `__FILE__` path corpus alone (blink 593 paths, **webrtc 385**, boringssl
  123, skia 110, angle 105, quiche 98, opus 59, …). Ten of ≥31 is **≤32 %**, and far less against
  Chromium's real third-party set. **WebRTC is the largest by path count, is remotely reachable, and
  is not dated at all**; neither is BoringSSL, ANGLE or quiche. Defensible wording: *"none of the ten
  datable components shows a post-130 roll"*.
* **REFUTED (this is the coverage failure).** Two numbers offered as **MEASURED** justifications for
  *not looking* are wrong, in the direction of "nothing to find":
  1. *"RTTI sweep yields 980 unique mangled type names, **zero in `mojo::`**"* — same instrument,
     same 980 total, but **10 end in `@mojo@@`** and 72 more are in `@mojom@` namespaces. Worse, the
     `__FILE__` anchor for the exact file the CVE-2025-2783 fix class touches is present in `.rdata`
     (`…/chromium/mojo/core/platform_handle_in_transit.cc`, file off 0x8ba7d30) and resolves to
     **exactly one 383-byte function, `0x1804f9460`** — a `DuplicateHandle` wrapper containing a
     handle-validation branch of exactly the relevant shape
     (`0x1804f949c 8d410c 83f80b 7701 cc` — `lea eax,[rcx+0xc]; cmp eax,0xb; ja +1; int3`, i.e. it
     traps on source-handle values in [−12,−1], the Windows pseudo-handle range). **Whether that IS
     the CVE-2025-2783 remediation is NOT asserted** — that needs the upstream diff, which the RoE
     forbids fetching. But the stated reason for not looking is refuted by measurement, so **the
     rejection of an in-the-wild-exploited Windows sandbox escape does not stand.**
  2. *"CHECK condition text is stripped … the file-path corpus was the only usable anchor set"* —
     **684 C++-CHECK-condition-shaped strings survive**, including, 0x40 bytes from one of the
     thread's own quoted build paths, `ref_count_.Increment() != std::numeric_limits<int>::max()`
     followed by `…\chromium\base/memory/ref_counted.h` and `AddRefImpl` — condition text, file and
     function name all preserved, in `base/` itself.

**Thread B verdict: NARROWED.** The forensic core is strong and reportable. The backport question is
**undetermined**, one marquee CVE is **unassessed** rather than rejected, and the component negative
needs a denominator.

---

### Thread C — `websettings`: renderer settings and decoder reachability. **BOTH ITEMS CLOSED. One new positive, one new finding.**

This is the strongest-evidenced thread of the round; the verifier re-derived every load-bearing claim
with independent tooling and matched it, including reproducing `4,470 files / 1,342,290,808 bytes`
tree-wide and `39,032` .pdata functions.

**ITEM 1 — the settings axis is CLOSED, and repaired rather than merely retracted.**

* **CONFIRMED (measured, complete at name granularity).** All **39** `QQuickWebEngineSettings`
  properties enumerated from the shipped `plugins.qmltypes` and byte-searched in both encodings:
  exactly **4** present — `javascriptCanAccessClipboard: true`, `javascriptCanPaste: true`,
  `focusOnNavigationEnabled = true`, `webGLEnabled = false`. **Zero** hits for
  `localContentCanAccessRemoteUrls`, `localContentCanAccessFileUrls`, `XSSAuditing`,
  `allowRunningInsecureContent`, `allowWindowActivationFromJavaScript`,
  `allowGeolocationOnInsecureOrigins`, `localStorageEnabled`, `pluginsEnabled` and the other 27.
* **CONFIRMED (import table).** WickrPro imports **zero** `QWebEngineSettings` symbols across all 34
  WebEngine/WebChannel imports — nothing is set from C++.
* **REFUTED.** The brief's premise *"`setAttribute` occurs three times"* — it occurs **6** times, 4
  inside a minified JS blob and 2 as MSVC import-name strings for `QNetworkRequest`/`QCoreApplication`.
  None is a WebEngineSettings call.
* **CONFIRMED (verified by me, from the constant, because the thread only deferred to W8).**
  `--disable-web-security` exists at `0x143237f68` and *is* appended to the argv handed to
  `QApplication`. Its gate is `0x1408d533b 833d2e3cbc0203 cmp dword [0x143498f70],3` /
  `0x1408d5342 7563 jne` — emitted when the global is **not** 3. **The global's static `.data` value
  is 4** (I read it: `0x143498f70 = 0x00000004`), i.e. **the gate is fail-OPEN by default** and is
  safe only because `0x140012d70 ba03000000 mov edx,3` runs before the argv is built. The conclusion
  ("not emitted in this build") stands, but a reader of the thread alone could not establish it, and
  **"same-origin policy is ON" rests on that immediate.**

**ITEM 1 — but a different lever IS relaxed, and the audit had not looked at it. NEW FINDING.**

* **CONFIRMED (disassembled).** WickrPro registers a custom URL scheme **`wickrweb`** with flags
  **`0x1e5`**: `0x140022609 488d0df8b64903 lea rcx,[rip+0x349b6f8]` → the `QString` built from
  `0x140E35C48 = "wickrweb"`; `0x140022631 bae5010000 mov edx,0x1e5`;
  `0x14002263b call QWebEngineUrlScheme::setFlags`; `0x140022646 call …registerScheme`.
* **CONFIRMED (enum read out of the shipped DLL's meta-object at
  `Qt6WebEngineCore!0x188b3a490`, not from memory — and independently re-parsed by the verifier).**
  `0x1e5 = SecureScheme | LocalAccessAllowed | ViewSourceAllowed | ContentSecurityPolicyIgnored |
  CorsEnabled | FetchApiAllowed`. **`ContentSecurityPolicyIgnored` and `LocalAccessAllowed` are set.**
* **CONFIRMED.** The handler is `WebViewRouter` (RTTI `.?AVWebViewRouter@@`, vtable `0x140e368f0`,
  slot 11 = `requestStarted` at `0x140022d60`), installed on the default profile at `0x1400205ca`.
  The scheme is a **full native data API** served in the unsandboxed process:
  `wickrweb://message/`, `//convo/`, `//users/self`, `//myaccount/password`, `//chimetoken`,
  `//contacts/directory`, `//image/savedlink/`, `//devices/active`, `//verification/fingerprint`.
* **CONFIRMED.** The QWebChannel exposes **seven** objects, not one — 6 `registerObject` sites at
  `0x14005afb6`/`b127`/`b16b`/`b1bc`/`b211`/`b260`, all with `rcx=[rbx+0x388]`, plus `uiBridge` from
  QML. Surface includes `WebChannelMessageBridge` (197 methods), `WickrClientSettings` (197 methods,
  139 properties), `EnvironmentMgr` (107 methods, 92 properties), with Q_INVOKABLEs
  `loadBootstrapFile(QString fileName, QString passPhrase)`, six overloads of
  `initiateLogin(QString username, QString password, …)`, `webAppLoadUrl`, `saveGeneralFile`,
  `showSaveFileDialog`, `sendFiles`.
  *Correction the verifier established and I accept:* **`networkToken` and `chimeHandoffToken` are
  properties of `EnvironmentMgr`, not `WickrClientSettings`.** The consequence survives — EnvironmentMgr
  is object #4 on the same channel — but the attribution in the thread text is wrong.
* **CONFIRMED (QML recovered verbatim from `.rdata` at `0x1430a2e05`).** That same view
  **unconditionally grants every feature permission to every origin**:
  `onFeaturePermissionRequested: { console.log(…); grantFeaturePermission(securityOrigin, feature, true); }`
  with no condition. Both the signal and the method are live Qt 6.9.2 API (revision 257), and the
  `Feature` enum covers microphone, camera, desktop capture, geolocation, notifications and clipboard
  read/write.
* **REFUTED — and this one reads like a critical finding and is not.** `onCertificateError:
  error.ignoreCertificateError()` in the same view is **dead Qt5 API**. The verifier re-derived this
  from the right instrument (the thread used a `qmltypes` text file — method rule 3):
  `QWebEngineCertificateError::staticMetaObject` in the shipped `Qt6WebEngineCore.dll`
  (`0x188b31440`) exposes exactly `defer`, `rejectCertificate`, `acceptCertificate`. The only
  occurrence of `ignoreCertificateError` in that 196 MB DLL is the C++ export
  `?ignoreCertificateError@CertificateErrorController@…`, which has no QML exposure. **The call
  cannot resolve; Qt's reject-by-default stands. Report as latent, not live** — it is one API-name
  change from fail-open, and it means that view has no working certificate-error handling at all.
  Rule-5 asymmetry: the sibling OIDC view uses the correct Qt6 form with a user dialog.
* **INFERRED.** The renderer sandbox is intact. Whole-tree scan of 4,470 files / 1.34 GB: `no-sandbox`,
  `disable-gpu-sandbox`, `QTWEBENGINE_DISABLE_SANDBOX`, `single-process`,
  `allow-file-access-from-files`, `disable-site-isolation-trials` occur **only** inside
  Qt6WebEngineCore's own switch table and the locale `.pak` files. Inference (not measurement) because
  `QtWebEngineProcess.exe` was never disassembled and no process was launched.
  **Hardening item:** `QTWEBENGINE_CHROMIUM_FLAGS` is scrubbed (`0x1408d3ddf call qunsetenv`),
  **`QTWEBENGINE_DISABLE_SANDBOX` is not** — the string is absent from WickrPro.exe in both encodings.

**ITEM 2 — CLOSED, with a positive. Wave 3's negative is REFUTED on static grounds.**

* **CONFIRMED (disassembled; provenance closed by the verifier).** Remote bytes reach a
  content-sniffed (`format = NULL`) decode in the **unsandboxed main process**:

  ```
  0x140c1512a  8d8638ffffff    lea  eax,[rsi-0xc8]
  0x140c15130  83f863          cmp  eax,0x63          ; HTTP 200..299 gate
  0x140c15139  488d9f88010000  lea  rbx,[rdi+0x188]   ; the downloaded QByteArray
  0x140c1516f  4533c0          xor  r8d,r8d           ; format = NULL
  0x140c1517a  ff15f8101400    call [0x140d56278]     ; QImage::loadFromData
  ```

  The thread labelled `[rdi+0x188]`'s remote provenance by association; the verifier **closed it**:
  the field is written at `0x140c140ad lea rcx,[rbx+0x188]` / `0x140c140b7 call QByteArray::append`
  whose `rdx` is the return of `QIODevice::readAll` at `0x140c140a6` on the `QNetworkReply`. That is
  literally `reply->readAll()` appended into the member that is decoded. The fetch is a real
  `QNetworkAccessManager::get` at `0x140c14346` with `setRedirectPolicy` and a URL taken from message
  content. Sibling site `0x140c1533b` is the other arm of a type dispatch at `0x140c15143`; **both
  arms sniff.**
* **CONFIRMED (census is COMPLETE, and the verifier mechanised it).** WickrPro.exe's entire IAT
  contains **exactly one** image-bytes decode entry point (`0x140d56278` `QImage::loadFromData`; no
  `QImageReader`, no `QPixmap::loadFromData`, no `QMovie`). Exactly **9** rip-relative references,
  all direct `call qword ptr`, **zero register-indirect**. Classified by walking back the `r8` write:
  **4 NULL** (`0x1400c2d4d`, `0x1409f754b`, `0x140c1517a`, `0x140c1533b`) and 5 explicit
  (`"PNG"` ×2, `"JPG"` ×3). The four-site set is the complete set for that binary.
  *Scope note the verifier added:* `Qt6Quick.dll` also imports `loadFromData` and lives in the same
  unsandboxed process, so the QML image-provider path is additional sniffing surface outside this
  enumeration.
* **CONFIRMED.** Site `0x1409f754b` (pinned-link images) is also remote — a cloud download whose
  hash gate (`0x1409f740a call 0x140017210` / `0x1409f7414 84c0 test al,al` /
  `0x1409f7416 je → "hash mismatch"`) **stops a malicious CDN but not a malicious sender, who supplies
  both the bytes and the hash.** Rule-5 asymmetry in the same function: the image is sniffed
  (`0x1409f753e 4533c0 xor r8d,r8d`), the favicon gets an explicit format
  (`0x1409f776d lea r8,[0x140e3edf8] = "PNG"`).
* **CONFIRMED (verifier disassembled the deciding instruction the thread had only asserted).**
  `imageformats\qpdf.dll` is a `QImageIOHandlerFactoryInterface` plugin whose `canRead`
  (`0x1800014f0`) peeks 6 bytes (`0x18000150e call QIODevice::peek`, `r8=6`) and `strncmp`s
  `"%PDF-"` (`0x18000152c`) and `"\n%PDF-"` (`0x180001548`). Import-table census of all 4,470 PEs:
  **`Qt6Pdf.dll` is imported by exactly two modules — `Qt6PdfQuick.dll` and `imageformats\qpdf.dll` —
  and by nothing in `QtWebEngineProcess.exe`.** Therefore **the sender, not the app, chooses which
  parser in the unsandboxed process eats those bytes**, and PDFium and libwebp are both on the menu.
* **OPEN, correctly left open.** Site `0x1400c2d4d` decodes field `+0x90` of a `0x130`-byte record in a
  `QList` off `MessageModel+0x5e8`. In the ordinary flow that is the PNG WickrPro itself re-encoded at
  `0x140c15226` — probably benign — but **the writer of that field was not identified. Do not record
  it as closed in either direction.**

**Thread C verdict: CLOSED on both chartered items.** What remains INFERRED is only that the fetch
path is *entered* at runtime — no sweep followed virtual dispatch or signal/slot edges, and
`0x140bd5ae0` (the function that starts the link-preview fetch) has **zero** direct callers, its only
reference being a vtable slot at `.rdata 0x1432b28b0`.

---

### Thread D — `woa`: can a **server** force-enable Wickr Open Access? **CLOSED on the question asked. The severity claim is REFUTED as stated.**

**What is CLOSED (and both the thread and the verifier disassembled it independently, matching to the
byte — 2034 instructions, 100 % decoded, 100 % reachable, exactly 3 gates):**

* **CONFIRMED.** `0x1409caebe c6869501000001 mov byte ptr [rsi+0x195], 1`, then
  `0x1409caed8 c6869601000001 mov byte ptr [rsi+0x196], 1`. An exhaustive intra-procedural dominator
  + per-edge-reachability pass over all 2,034 instructions of `0x1409c9550` finds **exactly three**
  gating branches: `0x1409c9597 0f85d4000000 jne` (JSON object non-empty),
  `0x1409caeb8 7427 je` (the flag itself), `0x1409caebc 7411 je` (idempotence).
  **No user setting, no admin policy, no signature, no capability check.**
* **CONFIRMED.** Key↔register binding: `0x1409cabc8 lea rdx,[rip+0x2b2cd41]` → `0x1434F7910`, whose
  initialiser loads `0x1432557C0` = bytes `666f7263654f70656e416363657373` = **`"forceOpenAccess"`**,
  through `QJsonObject::contains` → `operator[]` → `QJsonValue::toBool` →
  `0x1409cac05 440fb6e0 movzx r12d,al`.
* **CONFIRMED — the sweep was understated.** `"enableOpenAccessOption": true` **alone** also flips the
  byte: `0x1409cac1e 4584ff test r15b,r15b` / `0x1409cac21 jne 0x1409cae1f` →
  `0x1409caee6 4488be95010000 mov byte ptr [rsi+0x195], r15b`.
* **CONFIRMED — and this is the highest-yield thing the thread found (method rule 5).** In the *same
  function*, from the *same* server JSON, `enableMlsProtocol` **is** gated on local state and will
  **override the server's value to 0**:
  `0x1409ca89c 833dd5e6ac0202 cmp dword [0x143498f78],2` / `0x1409ca8a3 je` (ignore server entirely);
  `0x1409ca8c2 38153cd1b202 cmp byte [0x1434f7a04],dl` / `0x1409ca8c8 7447 je` selecting
  `0x1409ca96d mov [rsi+0x4a8],bl` (accept) vs `0x1409ca8ca mov [rsi+0x4a8],dl` (**force 0**).
  **The code knows how to refuse a server-pushed security setting. It does that for the MLS protocol
  switch and not for Open Access.** That is what makes this a defect rather than a design choice.
* **CONFIRMED — second rule-5 asymmetry, in the caller.** The "not logged in" check
  (`0x140b87b54` / `0x140b87b58 cmp qword [rcx+0x40],0` / `0x140b87b5d je` → *"swbAdminSettingsUpdate
  failed, not logged in"*) runs **after** the settings were already applied at `0x140b87b00`; it gates
  only a later, different call.
* **CONFIRMED.** The whole admin-settings surface is applied the same way — `enabled2FA` (+0x184),
  `active2FA` (+0x185), `canChangePassword` (+0x129), `alwaysReauthenticate` (+0x12e),
  `enableScreenCapture` (+0x210), `messageForwardingEnabled` (+0x212), `verificationMode` (+0x180),
  `checkForUpdates` (+0x3d1), `censorshipProxyConfig`, `woaRegions` — with **no gate beyond
  `contains(key)`**.
* **CONFIRMED.** Enabling WOA makes mbedTLS reachable: `0x140b94341 ff15e93b1c00 call [0x140d57f30]`
  = `Sock5!DispersiveTunnelStart` → five direct-call hops → `mbedtls_ssl_handshake` (`0x1801a7fb0`)
  and the `ssl_cli.c` client state machine. The shipped stack is **pre-2.4.0** — pinned not by the
  version string alone (`"mbed TLS 2.1.5"` at `0x180770d68`, exactly one referencing instruction in
  100 % of `.text`) but by three code-level **absence** markers: no `MBEDTLS_ERR_ECP_IN_PROGRESS`
  (2.4+), no `"PLATFORM - "` error prefix (2.6+), no async-in-progress string (2.11+).

**What is REFUTED — and I verified the deciding instruction myself this session:**

* **REFUTED as stated.** *"The `kNewSettings` payload is transport-level cleartext … no decryption,
  signature or MAC is applied before it is acted on."* The thread measured the **dispatcher→applier**
  span but made a claim about the **socket→applier** span (method rule 2). The missing hop contains a
  branch that selects between a raw handler and a **session-key-decrypting** handler for
  `QWebSocket::binaryMessageReceived`:

  ```
  0x140b802c8  488b0551741d00  mov  rax,[rip+0x1d7451]   ; -> Qt6WebSockets binaryMessageReceived
  0x140b802df  80bef800000000  cmp  byte ptr [rsi+0xf8], 0
  0x140b802e6  740e            je   0x140b802f6
  0x140b802ed  488d0d4c440000  lea  rcx,[rip+0x444c]     ; -> 0x140b84740  NO decrypt
  0x140b802f4  eb0c            jmp  0x140b80302
  0x140b802f6                  (fall target)
  0x140b802fb  488d0d8e440000  lea  rcx,[rip+0x448e]     ; -> 0x140b84790  DECRYPT
  ```

  I disassembled both handlers: `0x140b84740` reaches `0x140b8475c e82f7d0000 call 0x140b8c490`
  directly; `0x140b84790` runs `0x140b847d1 e83afefdff call 0x140b64610` **first**, then
  `0x140b847e1 e8aa7c0000 call 0x140b8c490`. The selector is set in the constructor:

  ```
  0x140b7e586  392deca99102    cmp  dword ptr [rip+0x291a9ec], ebp    ; global 0x143498f78, ebp = 0
  0x140b7e58c  7507            jne  0x140b7e595
  0x140b7e58e  c686f800000001  mov  byte ptr [rsi+0xf8], 1            ; no-decrypt handler
  ```

  I read the global's static `.data` value: **`0x143498f78 = 0x00000001`**. Non-zero ⇒ the branch is
  taken ⇒ `[rsi+0xf8]` stays 0 ⇒ **the decrypting handler is the one connected in the shipped
  default.** The irony that settles it: `0x143498f78` is the *same* global the thread itself quoted in
  the MLS gate at `0x1409ca89c` — it had the address in hand and did not follow it. The tell was in
  the Qt metadata too: the sibling metacall slot is literally named **`slotReceiveAndDecrypt`**.

* **Consequence — the attacker model narrows, in the opposite direction from the residual the thread
  flagged.** The transform at `0x140b64610` keys off two `QByteArray`s (`0x1434f84d0` / `0x1434f84e8`)
  that are **session state**, assigned at login (`0x140a0daa4`) and `clear()`ed at logout
  (`0x140a0ef00`). A party that merely terminates TLS but does **not** hold the post-login session key
  cannot forge the frame. **Correct attacker set: "whoever holds the post-login switchboard session
  key" — in practice the Wickr switchboard server.** The headline still survives and still overturns
  the Wave-4 report: the model is **"the moment the switchboard endpoint says so"**, not **"the moment
  an administrator turns Open Access on"** (critic item D5 resolves in favour of the recon agent's
  original wording). But **"cleartext" and "or relay" must not ship to the vendor.**

* **REFUTED (mechanism, not conclusion).** *"I resolved the parallel name table @0x140B8D1C4"* —
  `0x140B8D1C4` is not a name table, it is the **pre-login** jump table for the same protobuf oneof
  (guarded by `0x140b8c77e 83f812 cmp eax,0x12`). Its slot-5 target happens to `lea` a name literal
  before logging. The conclusion (case 7 = `kNewSettings`) is right; the mechanism as described is not
  reproducible as written.

* **CONFIRMED, and it strengthens the qualifier.** The pre-login table's slot 5 goes to `0x140b8c7f4`
  → `jmp 0x140b8c96a` = the *"service thread not logged in, message ignored"* logger. So
  `kNewSettings` genuinely **is** dropped pre-login: the client must be in switchboard state 4 or 8
  (`0x140b8c765 8b4620` / `83f804 cmp eax,4` / `83f808 cmp eax,8`).

**Two clean, well-evidenced negatives from this thread, both accepted by the verifier:**

* **CONFIRMED.** Sock5's `dvntap` TAP-adapter driver installer (`SetupDiCallClassInstaller` at
  `0x1800ba325`, `newdev!UpdateDriverForPlugAndPlayDevicesW` at `0x1800ba359`, UTF-16 hardware ID
  `"dvntap"` at `0x180775068`) **does not run at DLL load**: TLS callback array empty
  (`0x18069d420`, `cb[0]=0`), user `DllMain 0x18064bb10` is a 76-byte no-op, and a forward closure
  from DllMain + PE entry + all 127 `_initterm` ctors (619-629 functions) touches **no SETUPAPI, no
  newdev, no socket API**. Qualifier: direct calls only; 41 indirect calls inside that closure were
  not followed.
* **CONFIRMED.** The mbedTLS truncated-HMAC config bit is **never set**: `0x1800573fa
  818b58010000485c0000 or dword [rbx+0x158],0x5c48` leaves bit 13 (0x2000) clear, and a decode-based
  scan over **100 %** of Sock5 `.text` for `[reg+0x158]` with imm `0x2000` returns exactly five
  addresses — `0x1801c90b9`, `0x1801dba96`, `0x1801dc693`, `0x1801dc9b3`, `0x1801dd7a0` — **all
  `test`, zero writes.** (Both the thread and the verifier got the identical five.)

---

## 2. COVERAGE — measured, per thread, and whether the verifier accepted it

**This section is the round's actual deliverable.** Rule 7 says a scan without a coverage measure
cannot distinguish "nothing there" from "never looked". Every negative below is worth exactly what its
coverage line says it is worth.

### A — `reclaim2`. Coverage: **EXCELLENT and accepted** (`coverage_honest: YES`). Negative: **INVALID for an unrelated reason.**

| measure | value | verifier |
|---|---|---|
| NPL `.text` / `.pdata` coverage | 4,335,102 B / **89.83 %**, 440,840 B (10.2 %) unseen | reproduced to the byte |
| functions disassembled to completion | 13,498 → 969,377 instructions, 1,155 resync points (0.0297 % of bytes) | reproduced |
| allocator sites resolved | 2,534/2,534 to a root, **0 abandoned, 0 budget-exhausted** | reproduced from `npl_sites.json` |
| vs the sweep that failed | W6: 673 sites, **268 (39.8 %) unresolved**. This: 760 sites, **0 unresolved**; IMUL/LEA_SCALE/SHL roots 42/106/78 vs 6/19/27 | reproduced; caveat 18 of 760 root at ENTRY/LOAD/CALL, so 2.4 %, not 0 % |
| pointer stores | 3,831 at constant offset ≥244 (3,003 `mov` incl. 67 indexed + **828 xmm** — a stated W6 blind spot, now covered), 993 distinct offsets | reproduced |
| reachability models | R_direct 105 (0.8 %) / R_vtable 2,324 (17.2 %) / R_all 6,015 (44.6 %) | reproduced from `reach.json` |
| WickrPro `.text` / `.pdata` | 13,965,056 B / **93.66 %**, 886,068 B unseen | reproduced |

**The verifier's judgement, which I endorse: this is the most honestly measured submission in the
corpus, and publishing `npl_sites.json` / `ptrstore.json` / `reach.json` is exactly why the bug was
findable in ten minutes.** That is the behaviour this round wanted. The negative failed on a **join**,
not on coverage.

Blind spots the author named himself, all real: the 10.2 % `.pdata` gap; **pointer stores through a
computed base** (`lea r13,[r15+K]; mov [r13],rax` — literally the shape of the publish-buffer store at
`0x18014500c`, found by hand) are invisible to a constant-displacement scan; `R_vtable` models
`call [reg+disp]` only when `disp` is a known vtable slot, so `std::function`-style edges are only in
the `R_all` over-approximation; the live NPL graph was **not** run; and WickrPro's 55 pointer-array
sites are unclassified for timing. Verifier additions: `csweep.py` sweeps `calloc` on `rdx` (element
size) rather than `rcx` (count), mis-shaping 9 calloc-backed array sites — minor, but it is precisely
the array-like class the thread was chartered to cover; and NPL imports `GlobalAlloc`/`LocalAlloc`,
which are not in the allocator target set.

### B — `qtbackport`. Coverage: **REPORTED IN DETAIL BUT NOT ACCEPTED** (`coverage_honest: NO`).

The reference-scan coverage claim is genuine and the verifier reproduced it, including extending it:
every rip-relative result comes from a numpy scan of **all 143,842,691 `.text` bytes at all four byte
alignments**, which is complete over `.text` and **not** `.pdata`-bounded. That matters concretely and
is the round's most reusable datum: **the four version accessors at `0x180303170`-`0xa0` have NO
`.pdata` entry** (8-byte leaves), so a per-function sweep would have silently dropped the decisive
`lea`. The verifier confirmed the absence in the 619,325-entry table and extended the scan to
instruction-end deltas 5/6/8, finding no additional real reference.

**But three numbers used to justify *not looking* are wrong or missing, all in the "nothing to find"
direction:** the mojo RTTI count (10 `@mojo@@` + 72 `@mojom@` among the same 980); the CHECK-condition
corpus (684 surviving condition strings, not three generic literals); and the component-roll negative
has a **numerator with no denominator** (10 dated of ≥31 visible). Under this round's rules a negative
resting on an inflated coverage number is invalidated by that alone. **Two of the three gated a
rejection: CVE-2025-2783 (in-the-wild-exploited Windows sandbox escape) is unassessed, not rejected.**

Honestly named and still open: `qtwebengine_resources.pak` / `devtools_resources.pak` (grit-packed,
string-scanned only), `icudtl.dat` (not analysed), `QtWebEngineProcess.exe` (743,848 B, build-root
scanned only), UTF-16 strings swept only for targeted needles, and **libxml2/libxslt could not be
dated at all** (`libxslt/attrvt.c` and `preproc.c` paths present, but `xmlParserVersion` and
`xsltEngineVersion` are dead-code-eliminated). **XSLT is remotely reachable from web content — that is
the highest-value hole in the pin table.**

### C — `websettings`. Coverage: **MEASURED AND ACCEPTED** (`coverage_honest: YES`). The negatives are worth what they say.

The author **re-measured** WickrPro's `.pdata` coverage rather than inheriting the brief's figure:
`.text` 13,965,056 B, 39,032 functions, 13,078,988 B covered = **93.66 %**, so 6.34 % (~886 KB) is
invisible to every per-function sweep. The verifier independently got 93.65 %. `riprefs.py`
back-decodes out-of-`.pdata` hits and labels them `NOPDATA`; **1 of the 5 `wickrweb` references landed
there**, so the fallback fired and is not decorative.

Settings audit: complete at **name** granularity (39/39 tested, both encodings), partial at **value**
granularity; conclusive for the 35 absent names because a QML property assignment must carry the name
string in the compiled unit's string table — **but blind to a computed access `settings[expr] = v`**.
QML value coverage is **60 of 198** compiled units (~30 %, 105,254 B recovered); `WickrUIBridge.qml`
is not among them, so one of the seven channel objects has an unenumerated surface. Meta-objects: 341
found, **7 fully dumped**. Tree: 4,470 files / 1.34 GB byte-scanned; all 4,470 import tables parsed.

Named limits, all real: **virtual dispatch and Qt signal/slot connections were followed nowhere**
(`callers_pro.py` matches direct immediates only); the writer of the `+0x90` field is unidentified;
`QWebEngineUrlScheme` **syntax and defaultPort were not measured**, so whether Chromium gives
`wickrweb` tuple origins or opaque ones is unestablished — and that materially changes what
`ContentSecurityPolicyIgnored` + `LocalAccessAllowed` actually buy; `QtWebEngineProcess.exe` never
disassembled; **no runtime observation of anything.**

*Verifier scoping note I accept:* `ContentSecurityPolicyIgnored` governs documents served **by**
`wickrweb`, whereas the top-level document is `qrc:/index.html` by default. The flag doing the
practical work for the qrc app reaching the native data API is **`CorsEnabled`**. The thread's prose
weights these the other way.

### D — `woa`. Coverage: **MEASURED AND ACCEPTED** (`coverage_honest: YES`), with one inherited number.

`0x1409c9550`: **100 %** — all 2,034 instructions decoded, all reachable, exhaustive dominator plus a
per-edge reachability test on every dominating conditional. This is a complete intra-procedural gate
enumeration, not a sample; the verifier rebuilt it from scratch and got the identical three gates at
identical addresses. Cross-references in **both** binaries were done twice — `.pdata`-based **and** a
byte-pattern scan over **100 % of `.text`** — so **the `.pdata` blind spot does not apply to any xref
claim in that thread**, only to its call-graph claims. Sock5 call graph: 38,641 `.pdata` records
collapsed to **35,001** true functions via `UNW_FLAG_CHAININFO` (verifier reproduced the exact
number), 1,508,457 instructions.

Named limit that **bit the thread**: *"14,946 indirect calls were not followed anywhere in the module;
virtual dispatch followed nowhere."* The transform it missed is reached through
`0x140a1f08a call [0x140d58d28]` — the CFG dispatch stub. **The declared blind spot is exactly the one
that produced the false claim**, which is the good version of this failure: the hole was findable from
the thread's own report.

Refused rather than faked, and correctly: **no per-CVE mbedTLS list**, because that would be version
arithmetic. Also correctly labelled INFERRED: the `censorshipProxyConfig` → proxy `ip`/`port` hop.

**One inherited number, and it is the habit this round exists to police:** the thread wrote *"89.8 %
WickrPro"* in its coverage section, carrying the brief's figure over instead of measuring. **The real
WickrPro figure is 93.66 %** (threads B, C and both verifiers agree). 89.8 % is the **NPL** figure. It
errs toward claiming a larger blind spot than exists, so it is harmless to the conclusions — but a
coverage section is the wrong place for an inherited number. **The brief itself should be corrected:
`.pdata` covers 89.8 % of NPL `.text`, 93.7 % of WickrPro `.text`, and 93.8 % of Sock5 `.text`.**

### Round-level coverage summary

| binary | `.text` | `.pdata` coverage | unseen by any per-function sweep |
|---|---|---|---|
| NPL.dll | 4,335,102 B | 89.83 % | 440,840 B |
| WickrPro.exe | 13,965,056 B | 93.66 % | 886,068 B |
| Sock5.dll | 6,922,687 B | 93.82 % | ~429 KB |
| Qt6WebEngineCore.dll | 143,842,691 B | not needed — reference scans were exhaustive over 100 % of `.text` | — |

**Three techniques in this round were NOT `.pdata`-bounded and should be the default going forward:**
numpy rip-relative displacement scans over 100 % of `.text` (thread B, thread D), byte-pattern xref
scans over 100 % of `.text` (thread D), and IAT-slot reference enumeration (thread C's decode census).
Thread B's discovery that the decisive `lea` sat in a function with **no `.pdata` entry at all** is the
concrete proof that this matters.

---

## 3. The scope statement a vendor report should carry

> **What was searched.** Static analysis of the shipped binaries of AWS Wickr Desktop 6.72.20.0
> (Windows x64) and local harnessing of the shipped `NPL.dll` on the operator's own machines. Within
> `NPL.dll`, all 13,498 `.pdata`-described functions were disassembled to completion (969,377
> instructions), covering 89.8 % of `.text`; within `WickrPro.exe`, all 39,032 (93.7 % of `.text`);
> within `Sock5.dll`, 35,001 true functions after resolving chained unwind records (93.8 %). String,
> rip-relative-reference and import-table analyses of `Qt6WebEngineCore.dll` (196 MB),
> `Qt6Pdf.dll`, the ten `imageformats` plugins and all 4,470 PE files in the installed tree
> (1.34 GB) were exhaustive over the relevant sections and were not limited by unwind-data coverage.
>
> **What was NOT searched.** Roughly 10 % of `NPL.dll`'s `.text`, 6.3 % of `WickrPro.exe`'s and 6.2 %
> of `Sock5.dll`'s lie outside the unwind tables and are invisible to every per-function sweep run.
> Virtual dispatch and Qt signal/slot edges were followed only through approximating models, never
> exactly; 14,946 indirect calls in `Sock5.dll` alone were not followed. No process was launched, no
> call was placed, and no traffic was generated, so **every reachability statement about runtime is an
> inference from static structure.** The QtWebEngine renderer helper process was never disassembled.
> No reference build of stock Qt 6.9.2 was available, so no patch inventory of Wickr's Chromium tree
> could be produced.
>
> **What is demonstrated.** A remote, authenticated call participant sends 405 bytes of VP8 and
> obtains a **byte-exact, attacker-chosen use-after-free write** into the victim's unsandboxed
> process, followed by process death (F5-1, CWE-416, demonstrated live over a real call); and a
> 34-byte VP8 keyframe commits +2 GiB, ~4 GiB per peer (F5-2, CWE-400, demonstrated live).
> Mitigations measured **absent**: Control Flow Guard in both `NPL.dll` and `WickrPro.exe`, and CET.
> Default NT heap. Media decode, UI, cryptographic state and the message store share **one
> unsandboxed process**.
>
> **What is NOT demonstrated.** No control of the instruction pointer from a remotely deliverable
> input has been demonstrated, in this round or any prior one. The corruption primitive is real and
> content-controlled; a heap object suitable for corrupting it into control of execution has **not
> been found**. This round narrowed that gap from "several missing properties" to **one** — the
> attacker is now known to control the freed block's size class *and* to be able to drive a
> same-thread allocation of chosen size and chosen content into the same window — and it left **32
> candidate pointer stores untriaged** after correcting a defect in the prior search. The correct
> characterisation is **"no such target was found by a search whose coverage is stated above"**, not
> "no such target exists".

---

## 4. Reportable to the vendor on its own merits, regardless of the above

Ranked by what a defender would act on first.

1. **Server-forced Wickr Open Access, and an ungated admin-settings surface.** **CONFIRMED,
   disassembled.** A `kNewSettings` frame from the switchboard endpoint sets Open Access
   (`0x1409caebe`) behind exactly three structural gates — none of them a user setting, an admin
   policy, a signature or a capability check — and the same handler applies `enabled2FA`, `active2FA`,
   `canChangePassword`, `alwaysReauthenticate`, `enableScreenCapture`, `messageForwardingEnabled`,
   `verificationMode` and `checkForUpdates` the same way. **The sibling `enableMlsProtocol` in the same
   function consults two local globals and will override the server to 0** — the capability to refuse
   exists and is not used here. Attacker set: **a party holding the post-login switchboard session
   key** (i.e. the switchboard server); the client must be in switchboard state 4 or 8. Enabling this
   routes traffic through `Sock5.dll`, which links **mbedTLS 2.1.5** (pinned pre-2.4.0 by three
   code-level absence markers, not by its version string) as a TLS **client** — so ServerHello /
   Certificate / ServerKeyExchange parsing in a 2016-vintage stack happens before the peer is
   authenticated.
2. **The image and PDF preview decoders: remote bytes reach a content-sniffed decode in the
   unsandboxed process, and the sender picks the decoder.** **CONFIRMED, disassembled.**
   `QImage::loadFromData(ba, nullptr)` at `0x140c1517a` / `0x140c1533b`, fed by
   `reply->readAll()` from a `QNetworkAccessManager::get` with redirects enabled and a URL taken from
   message content; and at `0x1409f754b`, gated by a hash the same party supplies. Because
   `imageformats\qpdf.dll` sniffs `%PDF-` and pulls in `Qt6Pdf.dll`/PDFium — imported by **nothing** in
   the renderer helper — a `%PDF-`-prefixed blob selects PDFium inside `WickrPro.exe`. The four
   sniffing sites are a **complete** census for that binary. Rule-5 asymmetry: in the same functions,
   the favicon is decoded with an explicit `"PNG"`.
3. **The `wickrweb` scheme's origin flags, plus unconditional feature grants, plus a seven-object
   native bridge.** **CONFIRMED, disassembled.** Flags `0x1e5` include `ContentSecurityPolicyIgnored`
   and `LocalAccessAllowed`; the handler is a full native data API (`//myaccount/password`,
   `//chimetoken`, `//users/self`, …) served unsandboxed; the hosting view's
   `onFeaturePermissionRequested` grants **every** feature — microphone, camera, desktop capture,
   geolocation, clipboard read/write — to **every** origin with no condition; and the QWebChannel
   exposes seven objects including `loadBootstrapFile(fileName, passPhrase)`, six `initiateLogin`
   overloads and `EnvironmentMgr`'s `networkToken` / `chimeHandoffToken` properties. Independently of
   any XSS, that is the standing shape.
4. **Vendor-republished, unverified version metadata.** **CONFIRMED, disassembled.**
   `qWebEngineChromiumSecurityPatchVersion` = `"139.0.7258.67"` is a build-time literal with one
   reference and one consumer (an internal version page); `WickrPro.exe` imports and calls it in
   `main` (`0x140012cd2`). Separately, `LASTCHANGE` reads a **Chrome 120** branch head
   (`refs/branch-heads/6099`) and is what `chrome://gpu` and the User-Agent report. Two different
   pieces of shipped version metadata do not describe the shipped code. **Ask Wickr for their
   `qtwebengine-chromium` patch inventory** — none of the ten datable third-party components shows a
   post-130 roll, and ≥31 components are present of which 21 could not be dated at all.
5. **The F5-1 defect description is incomplete as currently drafted.** **CONFIRMED, disassembled.**
   `vp8_de_alloc_frame_buffers` (`0x180186320`) leaves **two** dangling pointers, not one: `mi`
   (+0xc60, the write) and `prev_mi` (+0xc70, a use-after-free **read** on the near-MV /
   error-concealment path). The fix must NULL both.
6. **Hardening, low severity, one line each.** `QTWEBENGINE_CHROMIUM_FLAGS` is scrubbed via
   `qunsetenv` (`0x1408d3ddf`) but **`QTWEBENGINE_DISABLE_SANDBOX` is not** (string absent from
   `WickrPro.exe` in both encodings). `--disable-web-security` is emitted whenever a global is **not**
   3 and that global's static `.data` value is **4** — i.e. **fail-open by default**, safe in this
   build only because `0x140012d70 ba03000000 mov edx,3` runs before argv is assembled; it should be
   fail-closed. `onCertificateError: error.ignoreCertificateError()` is **dead Qt5 API** in a Qt 6.9.2
   build — it fails closed today, but that view has **no working certificate-error handling at all**
   and is one API-name change from fail-open. Absolute build paths (`D:\WickrDesktopQt\…`,
   `C:\cdat2`, `X:\vendor`, `c:\cygwin64`) are left in shipped release binaries.

---

## 5. What remains open after this round, ranked, with the cheapest decisive check

1. **The 32 untriaged clean-slot pointer stores (F5-1 link (a)).** *Cheapest decisive check:* the join
   is already fixed and the list is already produced (above). For each of the 13 in `R_vtable` and 19
   more in `R_all`, answer two questions: **(a)** is the stored register a real pointer or a zeroed
   `xmm`? Several `movups [reg+disp], xmm0` hits are inline zero-fills, not pointer stores — check the
   preceding `xorps`. **(b)** is the containing function on the **decode thread**? Start with the five
   in the libvpx region — `0x18017fd90`, `0x1801ac310`, `0x1801ac6f0`, `0x1801ab820`, `0x1801833d0` —
   which are the only survivors plausibly there; then the three at **+1152**
   (`0x18015bb70`, `0x18015c120`, `0x18015e420`), because **+1152 is a clean slot of the live pinned
   64×64 geometry**. Triage may well kill all 32 — three named classes resolve through RTTI to
   `WASAPIAudioManager` and webrtc `EchoRemoverImpl`, i.e. audio-device objects that fail the
   decode-thread timing constraint exactly as W6 §6 predicted for `PortAudioManager`. **But that
   triage has not been done, and until it is, "no target exists" is not available.** Estimated cost:
   hours, no new tooling.
2. **Re-do link (a)'s pool arithmetic with the corrected header and the eighth path.** *Cheapest
   decisive check:* recompute the clean-slot filter at object offset residue **≡76 (mod 152)** with
   floor **684** (not ≡80/688), and re-run the exclusion for pool requests **above `0x7fff4`**, where
   `0x18011485d` mallocs an arbitrary caller-chosen `size+4`. The smallest mip block in that regime is
   `k = 6899` (524,352 B). Both are arithmetic, not disassembly.
3. **Whether the sniffing decode paths are entered at runtime.** *Cheapest decisive check, and it is
   cheaper than the runtime probe the notes currently nominate:* the caller graph above
   `0x140c1517a` is short — `0x140c140d0` has two direct callers, `0x140c14f70` has one, and the chain
   terminates at `0x140c15bd7` / `0x140c15bc0`, two tiny `.pdata` functions with **no code or data
   references at all**, which is the signature of `QtPrivate` functor thunks emitted for a `connect()`.
   **Sweep for 8-byte `movabs` immediates matching those addresses, or scan the pointer-to-member
   constant pairs, to name the `connect()` site.** That converts "the fetch fires when a message
   containing a URL arrives" from INFERRED to CONFIRMED **without launching anything and inside the
   RoE.** Only if that fails should `imgprobe4` (sites W3/W4) be run — and it must carry a liveness
   counter, per the §5.1a lesson.
4. **CVE-2025-2783 (Mojo Windows sandbox escape, exploited in the wild).** Its rejection is void.
   *Cheapest decisive check:* the anchor is already found and is unusually tractable — the `__FILE__`
   string `…/mojo/core/platform_handle_in_transit.cc` resolves to **exactly one 383-byte function,
   `0x1804f9460`**, which contains a pseudo-handle rejection branch at `0x1804f949c`. Deciding whether
   that check is **new** requires the upstream diff, which this RoE forbids fetching — so this item is
   **blocked on a reference build**, not on effort. Say so rather than re-rejecting it.
5. **A stock Qt 6.9.2 QtWebEngine reference build, same toolchain, byte-diffed.** This is the single
   highest-leverage unblocking item for the entire QtWebEngine axis: it converts "no evidence of
   patches" into a **measured patch inventory**, and it unblocks item 4 and every code-only CVE.
   *Cheapest decisive check:* the method is already proven at instruction fidelity on these exact
   binaries — the OpenJPEG anchor comparison ran 102 instructions with 26 differing bytes, **all**
   inside displacement fields (`fncmp.py`). Obtain the build; the tooling exists.
6. **Whether the WOA finding reaches an attacker-chosen TLS endpoint.** Two hops, in this order.
   *(a)* Resolve `WickrPro!0x140a1ef30` — the switchboard transform. It is a virtual call
   (`0x140a1f08a call [0x140d58d28]`, the CFG dispatch stub). **If it is unauthenticated encryption
   rather than AEAD, a tampering relay re-enters the threat model.** *(b)* Resolve the
   `settings+0x1b0` (`censorshipProxyConfig`) → proxy `ip`/`port` hop; the getter `0x1409c6640` has
   exactly one direct caller, `0x140a57898` inside the metacall `0x140a56320`, so it runs through Qt's
   property system. **Closing (b) upgrades the finding from a stale-dependency hygiene item to a
   remote pre-auth parse surface with an attacker-chosen peer.** Also worth 30 minutes: whether the
   two unresolved guards in `slotForceWOAChanged` (`0x14006f11f cmp byte [rax+0x33],0`, and the return
   of `0x1409e5680`) hide a user opt-in — one of them could still mean the proxy does not auto-start.
7. **libxml2 / libxslt in the Chromium tree could not be dated at all.** XSLT is compiled into Blink
   (`libxslt/attrvt.c`, `libxslt/preproc.c` paths present) and is remotely reachable from web content,
   but both version strings are dead-code-eliminated. *Cheapest decisive check:* fingerprint a
   structural constant instead of a version string — e.g. an XSLT function-table layout or a
   distinctive error-message set — or wait for item 5.
8. **The `.pdata` gaps themselves.** 440,840 B of `NPL.dll`, 886,068 B of `WickrPro.exe`, ~429 KB of
   `Sock5.dll` are invisible to every per-function sweep, and **every count in this round excludes
   them.** *Cheapest decisive check:* a recursive-descent disassembler seeded from call targets rather
   than a `.pdata` walk — cheap to build, and it is the only remaining whole-binary blind spot. Note
   that thread B's decisive `lea` sat in exactly such a function, which is the existence proof that
   this gap is not theoretical.
9. **Pointer stores through a computed base.** `lea r13,[r15+K]; mov [r13],rax` is invisible to a
   constant-displacement scan, and the publish-buffer store at `0x18014500c` has exactly that shape
   (found by hand). *Cheapest decisive check:* a forward-taint variant of `ptrstore.py` that resolves
   the base register. Residual is probably small — 67 indexed stores were caught and MSVC emits the
   constant-displacement form for ordinary field writes — but it is not zero.
10. **Two unexamined adjacent items worth naming rather than leaving silent.**
    `WickrPro.exe` imports `?ignoreSslErrors@QWebSocket@@QEAAXXZ` at IAT slot `0x140d57708`; it has
    **zero** `call qword ptr` sites and its only two references are unreferenced tail-jmp thunks
    (`0x140907161`, `0x140b8d87e`) with no callers — **not a finding, but a live TLS-bypass API in the
    import table of the process that holds the message store.** And: Sock5's `dvntap` driver installer
    is reachable neither from DLL load nor from any of the 8 exports by direct call, yet its four
    callers exist — either dead code carried from Dispersive's standalone client, or entered
    indirectly through one of the 14,946 unfollowed indirect calls. Also unmeasured: whether a
    per-user `%LOCALAPPDATA%` install even has the privilege for `SetupDiCallClassInstaller`.

---

## 6. Method notes this round earned

Three of four threads had a headline claim refuted, and **all three failures are the same two method
rules**, not new ones:

* **Rule 2 — check you are testing the right invariant.** Thread B measured *component rolls* and
  reported an answer about *cherry-picks*; the pre-registered test predicted the identical observation
  under both hypotheses, which is a rule-4 ritual without rule-4 content. Thread D measured the
  *dispatcher→applier* span and made a claim about the *socket→applier* span; one hop away sat
  `0x140b802df`, and a Qt metacall slot literally named `slotReceiveAndDecrypt`.
* **Rule 7 — a scan without a coverage measure cannot distinguish "nothing there" from "never
  looked" — with a corollary this round adds: nor can a scan whose coverage number is itself wrong.**
  Thread A's 0/52 was a `str`/`int` join; thread B's "zero in `mojo::`" was 10 non-zero on its own
  instrument's output; thread B's CHECK-corpus claim was 684 non-zero.

**The concrete, cheap fix, and it should be mandatory for every future sweep in this engagement:**
*whenever a filtered hit rate is zero, assert it against the unfiltered base rate and fail loudly.*
Thread A's own paragraph contained both `0/52` and `1230/3831` (32.1 %); at that base rate, 0/52 has
p ≈ 5·10⁻⁹. One assertion would have caught it before submission. The same check would have caught
"zero in `mojo::`" against 980 names.

**And the counter-lesson, which matters just as much:** every one of these was caught **in minutes**,
by a second party, **because the authors published their JSON artifacts, their scripts and their
measured coverage.** Thread A's negative was wrong, and thread A produced the best coverage instrument
in the corpus — those are not in tension. **Publish the artifacts. Measure your own coverage. State
what you could not see.** That discipline is why this round has a corrected position instead of a
confident wrong one.

---

## 7. One-paragraph answer to the operator's question

The operator asked whether the search's measured limits meant the engagement's negative was a
statement about the product or only about the search. **This round says: partly about the search.**
Of the four limits attacked, one closed cleanly and produced a new positive (thread C: remote bytes do
reach a content-sniffed decoder in the unsandboxed process, and the sender picks the decoder). One
resolved an attacker-model dispute in the strong direction (thread D: a server, not an administrator,
turns Open Access on). Two produced negatives that did not survive verification — and in the case of
the reclaim-target corpus, the negative that the engagement's own §4 leaned on to call the failure
*structural* turns out to rest on a type-mismatch join that, corrected, returns **32 untriaged
candidates**. Nothing in this round demonstrated control of the instruction pointer from a remotely
deliverable input, and nothing here licenses saying it will be. What changed is that the engagement
can no longer say the gap is structural. It can say, accurately and with a coverage table attached,
that **no target has been found, that the search which last claimed one could not exist was defective,
and that 32 candidates and one 512-KB-and-above allocator path remain unexamined.**
