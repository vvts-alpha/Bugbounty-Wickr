# W11 CRUX — Qt Chromium backports, forced-crash dump scope, and the Qt6Pdf parser surface

**Target:** AWS Wickr Desktop 6.72.20.0 (Windows x64). Authorised assessment, operator's own machines.
**Method:** static analysis and local file inspection only. `WickrPro.exe` was not launched, no call was
placed, nothing was sent anywhere.
**Date:** 2026-08-01. Three threads (A backport, B dumpscope, C qtpdfjpeg), each with an adversarial
verifier, synthesised here. Every load-bearing claim below carries a label.

> **NOBODY DEMONSTRATED RCE THIS ROUND, AND NOBODY HAS IN ELEVEN WAVES.** No thread in W11 obtained
> control of the instruction pointer from a remotely deliverable input. The word does not appear as a
> finding anywhere in this note. What W11 produced is three vendor-reportable defects that stand on
> their own, one measured parser-surface map, and one headline question that is still open for a reason
> that is now precisely stated.

---

## §0 — BOTTOM LINE, IN ONE PARAGRAPH EACH

* **A (Qt backports).** **STILL OPEN.** One fix (CVE-2025-2783) is **PRESENT in the shipped bytes** —
  I re-disassembled the guard myself. Presence is *not* evidence the backport landed, because the
  check may predate the M130 base, and no reference build in the discriminating window
  `[130.0, 134.0)` exists on this host. The `139.0.7258.67` claim is **neither substantiated nor
  refuted**. Two things the thread said about *why* are wrong and were corrected by its verifier: the
  claimed absence of any pre-134 Chromium on this machine is false (there is a Chromium **106** on
  `E:\`), and running the prescribed experiment against that 106 build **settles nothing**.
* **B (forced-crash dump).** **CLOSED on consent, NARROWED on scope.** Crash reporting is **on by
  default with no consent mechanism of any kind**, and a peer who can force a crash can force an
  **unrate-limited** minidump upload. But the dump is **smaller than the thread claimed**: the
  register-pointed 512-byte windows are **not** captured in the shipped configuration — the delegate
  returns before recording when the gather budget is NULL, and I confirmed that at instruction level.
  The dump is thread stacks + TEBs + CPU contexts + PEB + process parameters + command line + the whole
  environment block, plus one attached application log carrying **call-participant identity and call
  metadata**.
* **C (Qt6Pdf parser surface).** **CLOSED on the question asked, and it opened a bigger one.** Remote
  content reaches `Qt6Pdf.dll`'s libjpeg-turbo through a chain of direct calls whose only gate is the
  PDF's own `/Filter` name; the copy is **pinned to 2.1.5.1**; three CVE families are closed by
  structure. The same `%PDF-` blob also reaches **OpenJPEG, FreeType and PDFium's JBIG2 decoder** in the
  same unsandboxed, CFG-inert process. The thread's own #1 forward recommendation ("FreeType cannot be
  pinned") is **REFUTED** — it is FreeType **2.13.3**, and I read the three immediates myself.

---

## §0b — SYNTHESIZER'S OWN VERIFICATION LOG

Rule 1 of this engagement: disassemble the decisive instruction yourself, quote address and bytes. I did
not accept any of the three refutations that change a headline on the verifiers' word. Everything in
this block was read out of the shipped files by me, this session, with my own pefile+capstone reader
(`scratchpad/vat.py`, `w11fn.py`, `vstr.py`).

| # | What | Result |
|---|---|---|
| V1 | `Qt6WebEngineCore.dll` `0x1804f949c` | `8d410c` `lea eax,[rcx+0xc]` / `0x1804f949f 83f80b cmp eax,0xb` / `0x1804f94a2 7701 ja` / `0x1804f94a4 cc int3`, then `0x1804f94a5 c744243003000000 mov dword [rsp+0x30],3` and `0x1804f94b2 488bd1 mov rdx,rcx`. **The CVE-2025-2783 pseudo-handle guard is in the shipped bytes, on the handle, immediately before the DuplicateHandle setup. CONFIRMED.** |
| V2 | `Qt6WebEngineCore.dll` `0x1804fb1f2` | `41b97d000000 mov r9d,0x7d` = **line 125**, not the 129 thread A predicted. The two `lea`s that follow resolve to `…/mojo/core/channel_win.cc` (`0x188ba9000`) and `"Write"` (`0x188ba9078`), so it is the fourth `channel_win.cc` anchor. **Thread A's "uniform −4 shift" is FALSIFIED, by me, at the one data point it left unread.** |
| V3 | `crashpad_handler.exe` `0x140030c40` | `…0x140030c7d 488b4728 mov rax,[rdi+0x28]` / `0x140030c81 4885c0 test rax,rax` / `0x140030c84 0f84f6000000 je 0x140030d80` (function exit, records nothing). **The delegate that would record register-pointed memory returns immediately when the budget pointer is NULL. CONFIRMED.** |
| V4 | `crashpad_handler.exe` vtable `0x140071020` | slot `+0x18` = `0x140030d90`, slot **`+0x20` = `0x140030c40`**; ctor `0x140030be0` installs this vtable (`lea rax,[rip+0x40439]` → `0x140071020`) and stores its 5th argument at `0x140030bff 48894128 mov [rcx+0x28],rax`. Dispatch site `0x1400307e9 ff5020 call [rax+0x20]`. **The NULL-tested field IS the budget the caller passes. CONFIRMED.** |
| V5 | `crashpad_handler.exe` `0x1400228a3` | `4c0f45ef cmovne r13,rdi` with `rdi=0` (`0x14002289e bf00000000`) after `0x14002289c 3c01 cmp al,1` on the gather byte. **gather≠kEnabled ⇒ budget pointer NULL.** With V3+V4 this closes the loop. |
| V6 | `crashpad_handler.exe` `0x140030850` | **16** `call 0x140030760` sites: `ctx+0x80` (RIP) then `+0x00,08,10,18,20,28,30,40,48,50,58,60,68,70,78`. `+0x38` (RSP) is skipped. **The "17 register slots" figure is wrong; it is 16. Moot given V3.** |
| V7 | `Qt6Pdf.dll` `0x180054833/3a/41` | `c7430802000000` / `c7430c0d000000` / `c7431003000000` = version_major **2**, minor **0xd = 13**, patch **3**, with `mov edx,0x170` (sizeof `FT_LibraryRec_`) at `0x1800547fe`, `mov eax,0x40` (`FT_Err_Out_Of_Memory`) at `0x180054860` and `mov eax,6` (`FT_Err_Invalid_Argument`) at `0x180054875`. **FreeType in Qt6Pdf.dll is 2.13.3. Thread C's "cannot be pinned at all" is REFUTED.** |
| V8 | `E:\old\front-research\np\Front.exe` | UA literal `Chrome/106.0.5249.181`, 154,622,808 B, full Electron tree beside it. **Thread A's "minimum Chromium version anywhere on this host = 144" is measured-false.** |
| V9 | `NPL.dll` `0x18015be5d` / `0x18015c004` | `ff157d8f2c00` → `0x180424de0` and `ff15d68d2c00` → `0x180424de0`; my own import walk names `0x180424de0` = `api-ms-win-crt-stdio-l1-1-0.dll!fopen` and `0x180424d68` = `fwrite`. **Both raw-PCM file opens confirmed, same import slot.** |

Nothing in V1–V9 depended on a tool written by the threads being verified.

---

## §1 — DIRECT ANSWER PER THREAD

### Thread A — did Qt's claimed Chromium security backports land? → **STILL OPEN**

**Deciding instruction (for the only fix that reached a verdict):** `0x1804f949c` in
`Qt6WebEngineCore.dll`, bytes `8d410c 83f80b 7701 cc` — `lea eax,[rcx+0xc]; cmp eax,0xb; ja +1; int3`.
This traps iff `(int32)handle ∈ [−12,−1]`, i.e. it is `base::win::IsPseudoHandle` with
`kMinimumKnownPseudoHandleValue = −12`, and it sits four instructions before
`0x1804f94c8 ff156a784408 call [KERNEL32!DuplicateHandle]` on the argument that is provably the handle.
**CONFIRMED by me (V1) and by both thread and verifier.**

Why the thread is nonetheless still open is in §2.

### Thread B — what does a forced crash put on the wire, and is it opt-in? → **CLOSED on consent, NARROWED on scope**

**Deciding instruction for consent:** `0x140b3e4fc 7409 je 0x140b3e507` — the branch that *skips the
environment check and calls `initBugTrackers`* whenever `enableProxy` and `forceWOA` are both false.
Both are false on this host. Together with `0x14004d3b7 b201 mov dl,1` feeding
`crashpad::Settings::SetUploadsEnabled` at `0x1407bb2a0`, and the complete 17-symbol sentry import list
that contains **none** of the consent API, this is **CONFIRMED**: there is no consent gate to fail open
or closed — there is no consent gate.

**Deciding instruction for scope:** `0x140030c84 0f84f6000000 je 0x140030d80` in
`crashpad_handler.exe` (V3/V4). Because `gather_indirectly_referenced_memory_ = kUnset` in all four
`CPADinfo` sections and is never written at runtime, the budget pointer is NULLed at `0x1400228a3`
(V5), and **every register-pointed 512-byte window is discarded inside the delegate**. The thread
reported the opposite under a CONFIRMED label. **The thread's central Q1 answer is REFUTED and the
corrected answer is in §3.**

### Thread C — Qt6Pdf's libjpeg: pin, reachability, absent fixes → **CLOSED, and it opened a bigger question**

**Deciding instruction:** `0x180172273 e8b8feebff call 0x180032130` (ByteString `operator==`) preceded by
`0x180172268 488d15e19d2000 lea rdx,[rip+0x209de1]` → `0x18037c050 = "DCTDecode"`, with
`0x18017227a 741d je` skipping and the fall-through at `0x180172290` entering `CreateDCTDecoder`.
**That string compare on attacker-supplied stream metadata is the entire gate** between remote content
and `jpeg_CreateDecompress` at `0x180276a40`. The 17-hop chain from `QPdfDocument::render` was
reproduced instruction-by-instruction by the verifier with independently written tooling; both parties
agree on the hop set and on the 16-hop BFS depth. **CONFIRMED.**

---

## §2 — THE QT BACKPORT QUESTION, ANSWERED PROPERLY

### 2a. Per tested fix

| Fix | Verdict | Basis |
|---|---|---|
| **CVE-2025-2783** — Mojo Windows sandbox escape, exploited in the wild (ForumTroll) | **PRESENT** | The pseudo-handle rejection is in the shipped bytes at `0x1804f949c` (V1), guarding `DuplicateHandle` in `mojo/core/platform_handle_in_transit.cc`. The whole function is semantically indistinguishable from Chrome 150.0.7871.187's post-fix `TransferHandle` (`0x1859bd060`), down to the `LOG(FATAL)` source line 71 (`41b847000000 mov r8d,0x47` in both). **CONFIRMED.** *Provenance — backport vs pre-existing — **UNDETERMINED**; see 2b.* |
| **CVE-2025-4609** — the second Mojo-on-Windows handle CVE in the window | **NOT TESTABLE** by this method | Its structural signature cannot be stated without the upstream diff, and everything measurable on that surface (`platform_handle_in_transit.cc`, `channel_win.cc`, the named-pipe peer-PID comparison at `0x1804f1be0`, anchor counts 1/1, 2/2, 4/4) is indistinguishable from Chrome 150. **UNDETERMINED.** |
| **FreeType CVE-2025-27363** — OOB write, exploited in the wild | **NOT TESTABLE** — rejected as non-discriminating *before* measuring | A 2025 CVE ID whose code fix shipped in FreeType 2.13.1 (June 2023). Chromium 130 already carries a later FreeType, so presence of the fix is predicted equally by "every backport landed" and "none did". Zero discriminating power. **UNDETERMINED.** *(A 2025 CVE ID is not a 2025 fix. This is now the second time that trap has been walked into and stepped out of in this engagement — record it.)* |
| **CVE-2025-4664** — Loader / `Link` header referrer-policy, exploited in the wild | **NOT TESTABLE** | The remediation is the *removal of a policy application*, not a bounds check, new function, changed loop guard or new field. The only string-visible artefact (`referrerpolicy`) exists in Blink independently as an HTML attribute name. **UNDETERMINED.** |
| *"Broker host received malformed message"* validation | **REFUTED AS EVIDENCE** | ABSENT from the shipped build and PRESENT in Chrome 150 / Edge 151 / Chromium 148 — which reads as a missing sandbox-escape-class validation. But it is **also ABSENT in Chromium 144 and 146**, so it was introduced in `(146,148]`, seven-plus milestones after the `139.0.7258.67` window. The version ladder is what kills it. **REFUTED.** |
| `mojo/core/channel_win.cc` inter-anchor divergence | **MEASURED, UNDATED** | Anchors 3 and 4 span **92→125 = 33 lines** in the shipped build and **88→125 = 37** in Chrome 150 (V2 confirms the shipped `125`). **Four lines exist in Chrome 150's `channel_win.cc` that are absent from the shipped build**, in a Windows IPC file, established with no reference baseline at all. It could be post-139 churn exactly like the "Broker host" false lead. **UNDETERMINED — and it is a live lead thread A wrote up as its opposite.** |
| `mojo/core/ipcz_driver/invitation.cc` anchor | **MEASURED, UNDATED** | Present in Chrome 150 (`0x18f0b41e8`), **zero counterpart in the shipped build**. Same shape, same dating problem. **UNDETERMINED.** |

### 2b. So is the `139.0.7258.67` claim substantiated?

**NO — and it is not refuted either. It is UNDETERMINED, and this is a partial result that must not be
written up as a general one.**

Read the table above literally: **one** fix out of the five attempted reached a verdict, and that verdict
is "the protection is in the shipped bytes", which is the right answer for a defender and the **wrong
answer for the question the version string is making a claim about**. Two candidates were rejected before
measurement for lack of discriminating power, one is not structurally visible, and one apparent ABSENT
turned out to be a seven-milestone-later addition.

The blocking artefact is now stated correctly, which is the actual deliverable of this thread:

* Thread A said the block was *"any Chromium build with version < 134.0.6998.177 — one is enough"*, and
  that **the minimum Chromium on this host is 144**, so no such build exists.
* **Both halves are false.** `E:\old\front-research\np\Front.exe` is Electron 21.3.0 / **Chromium
  106.0.5249.181** (V8) — 38 milestones below the fix, on this engagement's own working drive. Thread A's
  root set had two structural holes (the user profile outside `%LOCALAPPDATA%`/`%APPDATA%`, and `E:\`
  searched only for Qt DLL *filenames*, never for Chromium) and it also missed three Chromium trees inside
  a root it did search.
* **And the prescribed experiment was run against that 106 build, and it settles nothing.** `TransferHandle`
  @ `0x140aaf400` there takes **three** arguments, has **no conditional branch at all** before
  `0x140aaf462 call [KERNEL32!DuplicateHandle]`, and logs at **line 65**. Check absent, line below 71 —
  thread A's `H_fix` prediction met — but 106 sits **24 milestones below the M130 base**, so all this
  establishes is that the check and the 4th argument both arrived somewhere in `(106,130]`. The full
  ladder now reads: **106 → no check / line 65; shipped Qt → check / line 71; 144 → check / line 71;
  150 → check / line 71.** The window that matters is untouched. **REFUTED BY EXECUTION.**

> **CORRECTED RESIDUAL — carry this forward verbatim.** The unblocking artefact is a Chromium build in
> **`[130.0, 134.0)`**, *not* "anything below 134". As originally written, that handoff would have sent
> the next agent after an artefact that already exists on this host, and then invited them to declare
> the backport landed on evidence that cannot support it. Higher-leverage still: **a stock Qt 6.9.2
> QtWebEngine reference build**, which unblocks every code-only CVE at once.

**One further premise is unverified and it sits under the whole item.** Nobody in this engagement has
confirmed *where the CVE-2025-2783 remediation actually is upstream*. The identification of it as the
pseudo-handle `CHECK` in `TransferHandle` is **recall, not diff**. If the real remediation is in
`node_channel.cc`, `broker_win.cc` or `base/win`, then everything measured about `TransferHandle` is a
true observation about the wrong function and the CVE reverts to unassessed. **INFERRED, load-bearing,
unverified.**

**The one thing not to do** is convert "the check is there" into "Qt's backports landed". That inference
has a named premise nobody could verify, and this engagement has paid eight times for exactly that move.

---

## §3 — THE FORCED-CRASH DUMP: WHAT GOES WHERE, AND UNDER WHAT CONSENT

### 3a. Frame it correctly before anything else

**This is NOT an attacker-controlled exfiltration channel.** The Sentry DSN is built from a hardcoded
template — `https://%1.ingest.sentry.io/api/%2/minidump/?sentry_key=%3` at `0x14328ba08` — and the
handler's only destination is its own `--url=` argument. **Nothing here lets a peer choose where the
bytes go.** Any write-up that implies otherwise is wrong and will be rejected by the vendor on sight.

**What it is** is a privacy and data-governance defect in a product sold on end-to-end encryption:
*a remote call peer can, on demand and without limit, cause the victim's process memory and call
metadata to leave the victim's device and be delivered to a third-party crash service, and the victim
was never asked.* The delivery-on-demand half is F5-1 from the earlier waves; the never-asked half is
what thread B established.

### 3b. What is uploaded

**Minidump memory (CONFIRMED, and NARROWER than thread B reported).** `crashpad_handler.exe` writes its
own minidump — it imports no DbgHelp/DbgCore, so `MiniDumpWriteDump` and its `MINIDUMP_TYPE` are not in
play, and **no command-line option the handler accepts can change what memory is captured** (the complete
option table was enumerated; none is a capture-policy switch). Policy comes from the client's
`CrashpadInfo`, and all four `CPADinfo` sections in the product (`WickrPro.exe` `0x143570000`, `sentry.dll`
`0x180049000`, `crashpad_handler.exe` `0x140099000`, `Qt6WebEngineCore.dll` `0x18bc2e000`) read identically
with `gather_indirectly_referenced_memory_ = kUnset`, and no code in the product ever writes that field.
The dump therefore contains:

* **per thread:** the full stack region and the TEB — each *readability-probed first*
  (`0x140029b31 call 0x140043000 / test al,al / je`, same shape for the TEB), so "captured if fully
  readable", not unconditionally — and the CPU context;
* **the PEB** (0x3f4 bytes), `PEB_LDR_DATA`, `RTL_USER_PROCESS_PARAMETERS` (0x3f4 bytes), eight
  `UNICODE_STRING`s including the **command line**, and **the entire process environment block**
  (`0x140020b16 mov rdx,[rbp+0x140]` → length scan `0x140020b20` → add to memory list `0x140020b36`);
* **not the heap**, and — the correction — **not the register-pointed 512-byte windows.**

> **STRUCK FROM THE RECORD: "512 bytes at (register−128) for every register slot on every thread".**
> Thread B traced the unguarded call to `CaptureMemory::PointedToByContext` (`0x140030850`) and stopped
> one function short of the consumer. The recording happens in `CaptureMemoryDelegateWin`'s vtable slot 4
> (`0x140030c40`, dispatched at `0x1400307e9 ff5020 call [rax+0x20]`), and that function's third test is
> `mov rax,[rdi+0x28]; test rax,rax; je <exit>` on the gather budget — the very pointer
> `ProcessSnapshotWin::Initialize` `cmovne`s to NULL when gather ≠ kEnabled. **With the shipped
> configuration, `pointed_to_memory_` stays empty for every thread and for the exception context alike.**
> I confirmed the vtable slot, the ctor's argument store, the NULL test and the `cmovne` myself (V3–V5).
> The "conservative policy, stacks only" reading that thread B explicitly rejected as *"wrong in a
> specific, load-bearing way"* **is the correct reading**, and the severity framing for this item comes
> down accordingly. Also `17 → 16` register slots (V6), now moot.

**Consequence (INFERRED, not measured):** key material or message plaintext that is **on a thread stack**
at crash time is captured. Heap-resident secrets are not. This is INFERRED and not CONFIRMED because
under the RoE no live minidump was produced and searched for Wickr key material; nothing measures what is
actually on WickrPro's stacks when F5-1 kills it.

**Attachments (CONFIRMED).** Exactly **one** application file: the current session's application log
`<AppData>/logs/<YYYY-MM-DD>_<hh-mm-ss>.txt`, attached **twice** — once as `--attachment=` to WickrPro's
own crashpad handler, once via `sentry_options_add_attachmentw`. The attachment set is provably closed:
the literal `--attachment=` (`0x140e3fe80`) has exactly two materialisation sites, both in
`initBugTrackers`, and both use the same log-path global `0x1434f8b60`, as does the single
`add_attachmentw` call site. Plus sentry-native's own scope files (`__sentry-event`,
`__sentry-breadcrumb1/2`), crashpad annotations `{version, product, appname, platform, session.id}`,
sentry tags `{version, appName, sessionId, client, woaVendorLibVersion, clientState}`, and a sentry user
id — the `auid` UUID from `preferences`.

**Not attached (CONFIRMED):** the `.wic` key files, `wickr_db.sqlite`, `mls/`, `metrics*`, and the raw
microphone `.pcm` files. The two findings in this note **do not compound**.

**What the attached log carries (CONFIRMED by counting, not by reading content).** Across this host's 19
application logs: 0 lines matching an email pattern, 0 Bearer/authorization lines, and all 178
`password` hits are password-*policy* fields, not secrets. What *is* there, per call, is
**participant identity and call metadata**: `VV_POPCORN_CONNECTION_REQUEST` (username, 64-hex userID,
eventId, networkId) and `VV_POPCORN_USER_STATUS` (64-hex userid, display name, role, device count,
mute / screenshare / on-hold / meeting-host flags). No message plaintext, no keys, no credentials found.
**That is precisely the social-graph and call-timing metadata an E2E messenger is supposed to withhold.**

### 3c. To whom, and under what consent

**To:** a fixed `*.ingest.sentry.io` endpoint, via a multipart POST from `crashpad_handler.exe`
(`upload_file_minidump`, `application/octet-stream`). **Two** handler processes run, sharing one database
directory `<AppData>/crashpaddb` — WickrPro launches its own crashpad handler, then one second later
(`QTimer::singleShot(1000)`) sentry-native 0.6.6 launches a second. **Both are started with
`--no-rate-limit`.**

**Under what consent: none. CONFIRMED, and this is the reportable core of thread B.**

* `initBugTrackers` runs unless `(enableProxy || forceWOA) && environment == production`. Both settings
  default false and are false on this host, so the `je` at `0x140b3e4fc` is taken and it always runs.
* `crashpad::Settings::SetUploadsEnabled(true)` is a **hardcoded immediate**: `0x14004d3b7 b201 mov dl,1`.
  Corroborated on disk — `crashpaddb/settings.dat` `options = 0x00000001` = `kUploadsEnabled`.
* `WickrPro.exe` imports exactly 17 symbols from `sentry.dll` and **none of the consent API**. The
  absence is a real negative, not a missing export: `sentry_options_set_require_user_consent`
  (`0x180008710`), `_give`, `_revoke`, `_reset`, `_get` are all exported and none is imported.
  `require_user_consent` is left at its `memset` default of 0 (`sentry_options_new` `0x180007cd0`
  allocates 0xe8 bytes, memsets, and never writes `+0x7a`).
* **No scrubbing anywhere:** `before_send`, `on_crash`, `set_transport`, `set_logger` are exported by
  `sentry.dll` and imported by nothing; crashpad has no sanitization compiled in (zero `sanitiz*` strings
  in the 634,792-byte handler).
* There is **no first-run prompt, no policy hook, and no server-pushed setting that can turn it on** —
  it is already on. The only settings that suppress it point the wrong way (a hub that can drive
  `forceWOA`/`enableProxy` could silently switch a target's crash telemetry *off*; direction of that lever
  is untraced, **UNDETERMINED**, and it is not an escalation).
* **An upload attempt really ran on this host:** `settings.dat` `last_upload_attempt_time = 0x6a6bdaa7`
  = 2026-07-30T23:13:43Z, two seconds after `last_crash` at 23:13:41.354Z. `SetLastUploadAttemptTime`
  (`0x14005e800`) has exactly one caller, on the straight-line path of `RecordUploadAttempt` with no
  rate-limit test. (That proves an *attempt*, not a successful POST.)

**Corrections to thread B's evidence for this item (conclusion unaffected, but two facts labelled MEASURED
did not survive re-measurement):** the registry key is `HKCU\Software\Wickr Pro\TopSecretMessenger`
(organisation/application swapped in the thread's write-up), and `forceWOA` is **not absent** — it exists
at `HKCU\Software\Wickr Pro\servers\forceWOA = false`, under a different QSettings scope. Both settings
are false either way, so the gate result stands.

**One more scope note (CONFIRMED):** the Qt WebEngine renderer processes produce **no separate crash
dumps** — none of `crashpad-handler`, `enable-crashpad`, `crash-dumps-dir`, `crashpad_handler`,
`CrashpadHandlerMain`, `crash-reporter` occurs in `Qt6WebEngineCore.dll` or `QtWebEngineProcess.exe`. But
`Qt6WebEngineCore.dll` is loaded **into** `WickrPro.exe`, so the main process's dump does cover the
WebEngine browser-process side.

---

## §4 — COVERAGE, PER THREAD

Rule 7: publish the coverage the author measured, say whether the verifier accepted it, and do not launder
a weak negative.

### Thread A — coverage claim **REJECTED by the verifier. `coverage_honest: NO`.**

* **Reference-build enumeration — the load-bearing number — is FALSE.** Claimed: 23 Chromium-bearing
  directories, minimum version 144.1.84.26, "no pre-134 Chromium on this machine". Two independent
  full-filesystem sweeps by the verifier with disjoint marker sets (A: 9 binary names → 69 files;
  B: `icudtl.dat` / `v8_context_snapshot.bin` / `snapshot_blob.bin` → 84 files, 36 dirs) found the
  minimum to be **106.0.5249.181** — wrong by 38 milestones (V8 confirms). Also: "Island 144.1.84.26" is
  Island's *product* version; the Chromium base in that `chrome.dll` is 144.0.7559.133.
* **Verifier's own coverage, stated so the next person can find its bug:** roots were `C:\Users\mwgn-`,
  `C:\Program Files`, `C:\Program Files (x86)`, `C:\ProgramData`, all of `E:\`, `C:\Windows\SystemApps`
  and SystemTemp; 132–133 directories unreadable on ACL; `D:\` empty; **not** searched:
  `C:\Windows` outside those two subtrees (including the `C:\Windows\Installer` MSI cache), other user
  profiles, or the interior of any archive/installer. So 106 is a **measured minimum over unpacked
  on-disk trees**, not a proof nothing older exists.
* **Accepted:** the string search (whole file, ASCII-complete; blind to UTF-16 and runtime-built strings),
  the `.pdata`-aware disassembly, and the xref scan — the verifier re-ran the anchor uniqueness under a
  *stricter* test (tails 0..8 plus abs64 and rva32 passes) and still got exactly one reference. Both
  parties disassembled every xref hit before use because the scanner produces ~0.2 false positives per
  full-`.text` scan.
* **Not examined at all in this thread — every one of these is a plausible home for a post-M130 fix:**
  V8, ANGLE, Skia, Blink image/font decoders, BoringSSL, WebRTC, libxml2/libxslt, the PDFium library
  proper, `Qt6Pdf.dll`, `QtWebEngineProcess.exe`, and all `.pak`/`.dat` resources.
* **⇒ Any negative from this thread is weak.** The one positive (the guard at `0x1804f949c`) is not,
  because it is a presence claim re-derived from the bytes by three parties.

### Thread B — coverage **ACCEPTED, and undersold. `coverage_honest: YES`.**

* `.pdata`-bounded per-function coverage of `.text`, reproduced **to the byte** by the verifier with an
  independently written parser: WickrPro.exe **93.66 %**, sentry.dll **92.18 %**,
  crashpad_handler.exe **92.43 %**, NPL.dll **89.83 %**.
* **The negatives that carry weight do not rest on that sweep at all.** They rest on a linear superset
  scan over 100 % of `.text`, cross-checked by the verifier with a second mechanism the thread never used
  — complete enumeration of the DIR64 base-relocation table (53,031 / 174 / 1,167 entries) — finding zero
  absolute pointers to any `CPADinfo`.
* **The thread found and published a false negative in its own join** (rule 7 exemplar): its
  `.pdata`-bounded xref reported **0** references to `CPADinfo` in two binaries. Wrong both times —
  `CrashpadInfo::GetCrashpadInfo()` is an 8-byte `lea rax,[rip+disp]; ret` leaf with **no `.pdata` entry
  at all**, so no `.pdata`-bounded sweep can ever see it, and the VA never appears as 8 raw bytes because
  it is only ever formed rip-relatively. Same failure mode as the W9 version-accessor `lea` and the W10
  NPL chained-chunk join. **Publishing it was correct and it is the reusable lesson of the wave.**
* **Declared blind spots that are real and remain open:** the vtable-slot-`0x160` annotation sweep uses a
  14-instruction lookback and *demonstrably misses* the known-good site in `initBugTrackers` (~17
  instructions), so the crashpad simple-annotation inventory is a **lower bound** — only `client.state`
  was established by reading, and the dictionary holds up to 64 key/value pairs of 255 chars. No live
  minidump was produced (RoE), so everything about a *real* dump's contents is derived from capture logic.
* **The failure here was not a coverage failure.** It was a trace that stopped one function short of the
  answer, and it inverted the headline (§3b).

### Thread C — coverage **ACCEPTED, and the best-audited in the wave. `coverage_honest: YES`.**

* `Qt6Pdf.dll`: `.pdata` covers **2,777,836 / 3,000,983 B = 92.56 %** of `.text` — reproduced by the
  verifier to four decimal places (92.5642 %), along with 11,681 chunks, **5,755 (49.3 %) chained
  secondary chunks**, 5,926 primaries. `imageformats\qpdf.dll`: **88.07 %**.
* **The 7.44 % blind spot is live, not decorative:** 223,147 bytes across 5,582 gaps, into which
  **1,010 direct call/jmp targets land, 422 of them inside the render forward set**. A function reachable
  only from inside that region is invisible to every graph result in the thread — and the thread's own
  Bug 2 was exactly this class and hid the load-bearing edge until it was fixed.
* **Three self-reported tool bugs, all real, all correctly characterised, all verified:** (1) raw
  `BeginAddress` used as a function key across 49.3 % chained chunks; (2) the orphan resolver stopping at
  the first `ret`, which hid `0x1802bf792 e909fbffff jmp 0x1802bf2a0` — the tail call that *is* the
  render→image link, and **before the fix the BFS reported MISS on the central question**; (3) clang-cl
  jump tables inside `.pdata` extents fabricating a version difference in 15/155 functions.
* **Indirect dispatch is not followed.** Every POSITIVE reachability result is evidence; **the libpng
  negative is weak and is labelled UNDETERMINED**, not "not reachable". The verifier strengthened it
  (zero 8-byte pointers anywhere in `.rdata`/`.data`/`_RDATA`/`.didat` point into the libpng band) but
  also found the counter-structure (§5, item 4 residual).
* **Band membership counts are soft** (FreeType 651 vs verifier 577; libpng 143 vs 96) — the thread
  pre-labelled band edges as approximate and the entry-edge results are robust to it; the totals are not.
* `Qt6WebEngineCore.dll` was swept only in the window `0x184c00000-0x184d80000`.

---

## §5 — REPORTABLE TO THE VENDOR ON ITS OWN MERITS, REGARDLESS OF RCE

Ranked by how cleanly each stands up without any memory-safety chain attached.

### 1. Raw microphone PCM written to disk, unencrypted, unconditionally, and never deleted — **CONFIRMED. File it first.**

This is the cleanest finding in the engagement. `WASAPIAudioManager`'s constructor was disassembled
end-to-end — the full `.pdata` extent `0x18015bb70-0x18015c0c3`, 1,363 bytes, with a chained-chunk scan
over all 13,498 NPL `.pdata` entries confirming **zero** chunks chain into it, so that is the whole
function body — by both thread and verifier. **There is no gate.** The body has exactly 10 conditional
branches and zero unconditional jumps, and every branch is either a null check around an `fclose` or an
MSVC short-string/heap-block sanity check. **Both `fopen(..., "wb")` calls are on the straight-line
path**, and I resolved both to the same import slot myself (V9).

* Files: `aud_in_before_aec_<pid>_<rate>_<ch>ch.pcm` and `aud_in_after_aec_…`, written on **every**
  capture callback via `fwrite` at `0x18016118e` (before the WebRTC `AudioProcessing::ProcessStream`
  vcall at `0x18016122f`) and `0x18016130f` (after it). The only guard is the `FILE*` being non-NULL,
  which the constructor guarantees.
* **Never rotated, never deleted:** NPL.dll imports no file-deletion API of any kind (its `Delete*`
  imports are `DeleteCriticalSection`, `DeleteDC`, `DeleteObject`); the destructor only `fclose`s.
* The path is relative, so the files land in the process CWD = **the install directory, which is
  user-writable**. Observed on this host: **28 files / 477,219,328 B = 455 MiB**, largest pair
  ≈ 35 minutes each of 48 kHz mono 16-bit audio.
* **The `before_aec` file also captures the far end of an E2E-encrypted call whenever the local user is
  on speakers** — the whole purpose of the echo canceller is to remove the far end's speaker output from
  the microphone signal, and this file is written *before* it runs. **INFERRED** from code position;
  the operator's captured audio was not listened to or analysed.
* **They cannot become a crash attachment** (the attachment set is closed — §3b). The two findings do
  not compound.

**Report as:** unencrypted, unbounded, indefinite local retention of the user's microphone — and of the
remote party's audio — by a product whose premise is that call audio is ephemeral and end-to-end
encrypted. Existing draft: `SUBMISSION-01-mic-pcm.md`.

### 2. Crash reporting with no consent mechanism, remotely triggerable, unrate-limited — **CONFIRMED**

Everything in §3. The report should lead with the **consent** defect (there is no off switch in the
client, not "there is one we could not find"), state the corrected dump scope honestly (stacks + TEBs +
contexts + PEB/params/command line/environment — **not** the heap, **not** register-pointed windows),
state that the attached log carries call-participant identity and metadata, and **explicitly say the
destination is fixed and not attacker-choosable**. Pair it with F5-1 for the "on demand" half and with
`--no-rate-limit` for the "repeatedly" half.

### 3. CFG is inert process-wide, for a one-link-flag reason — **CONFIRMED**

`WickrPro.exe` `DllCharacteristics = 0x8160` (GUARD_CF **clear**) while `Qt6Pdf.dll`, `qpdf.dll` and
`Qt6WebEngineCore.dll` all ship `0x4160` (GUARD_CF **set**). The DLLs' guard checks are dead because the
EXE never opts in. **Cheapest hardening ask in the whole engagement**, and W11 sharpens why it matters:
see item 4.

### 4. Four memory-unsafe parsers behind one content sniff, in an unsandboxed CFG-free process — **CONFIRMED (reachability), see caveat**

From `QPdfDocument::render`, by direct calls, in `WickrPro.exe`'s main process:

| Parser | Pin | Status |
|---|---|---|
| libjpeg-turbo (DCTDecode) | **2.1.5.1** — CONFIRMED by 155/155 instruction-level identity with `Qt6WebEngineCore.dll`'s version-bearing copy, plus an in-product 3.0.3 control (`qjpeg.dll`, struct size 656 vs 600) ruling out the 3.x layout | reachable; 4 external entry points only |
| OpenJPEG (JPXDecode) | only `>= 2.5.0` (W9 HTJ2K guards) — **UNDETERMINED** | reachable (`0x180219b52 call 0x180255c10`) |
| FreeType | **2.13.3** — CONFIRMED (V7) | reachable (`0x1801a5301 call 0x180053570`) |
| PDFium JBIG2 | in-tree | reachable (`CJBig2_Image` ctor `0x180210120`) |
| zlib (FlateDecode) | **1.3.0.1-motley** (Chromium fork) — literal `0x180313750`, loaded at `0x1802025a4` in the same render-reachable function that calls `inflate` | reachable from **both** render and load |
| libpng | 1.6.43 (literal `0x1803238e0`) | **UNDETERMINED** — no path found, and the negative is weak |

**Caveat on wording, and it matters for the report.** What is established at instruction level is that
bytes accumulated in a `QNetworkReply` handler's member buffer (`[rdi+0x188]`) are handed to
`QImage::loadFromData` with **`format = nullptr`** (`0x140c1516f 4533c0 xor r8d,r8d` →
`0x140c1517a call [Qt6Gui!QImage::loadFromData]`), i.e. full plugin sniff on network-reply content,
with `%PDF-` in the sniffing set (`qpdf.dll` `0x18000152c` / `0x180001548`). Whether a **peer** controls
that content (attachment fetch vs link preview vs server-side asset) rests on W9's sender-side chain,
which neither W11 thread re-verified. **Say "network-reply-supplied" (CONFIRMED) rather than
"peer-supplied" (INFERRED) until that trace is redone.**

Also CONFIRMED and worth a line: **XFA is disabled** in this PDFium build (`v8::` and `fxjs` both absent;
no V8 in the import table), which removes its XML and JavaScript surface.

### 5. One post-2.x libjpeg validation is measurably absent — **CONFIRMED, no CVE claimed**

`qjpeg.dll` (3.0.3) carries message-table entry 128, *"Invalid restart interval …; must be an integer
multiple of the number of MCUs in an MCU row"*. That message has **no counterpart anywhere in the
127-entry 2.x table** used by both `Qt6Pdf.dll` and `Qt6WebEngineCore.dll`, so the check cannot be present
in the shipped copy. **No CVE number is claimed** — the RoE forbids fetching the diffs or CVE data that
would justify one, and none was reconstructed from memory. Report it as a version-currency observation.

### 6. Self-reported Chromium security-patch level that cannot be verified

`Qt6WebEngineCore.dll` 6.9.2 self-reports security-patch level **139.0.7258.67** on a Chromium
**130.0.6723.192** base. W11 could neither substantiate nor refute it (§2). **Report it as a question to
the vendor** — "which backports are in this build, and how is that verifiable?" — not as a vulnerability.
It is also worth noting the `139.0.7258.67` literal is decorative in the binary: one reference, consumed
only by the internal version page (W9).

### 7. Already reportable from earlier waves, unchanged by W11

F5-2 / F4-3 memory exhaustion (a 34-byte frame costs +2,017 MiB of commit; ~4 GiB from one peer), and
the F4-1 / F4-2 memory-safety findings with their existing, carefully limited language. Nothing in W11
changes their status.

---

## §6 — CORRECTIONS A FUTURE READER MUST NOT REASON PAST

1. **`Qt6Pdf.dll`'s libjpeg-turbo is NOT unpinned** (W10 said "unpinned AND peer-reachable"). It is
   **2.1.5.1**, by 155/155 instruction-level identity. The *reason* no literal is present is also settled:
   PDFium installs its own `jpeg_error_mgr`, so `jerror.c`'s message table is dead-stripped.
2. **FreeType is NOT unpinnable** (W9, W10 and thread C all said so). `Qt6Pdf.dll`'s copy is **2.13.3**,
   written as three immediates in `FT_New_Library` (V7). Thread C searched for a version *string*, found
   none, and concluded no version *constant* existed — the engagement's own rule 3 committed in reverse.
   *(Unchecked: FreeType in `Qt6WebEngineCore.dll`.)*
3. **"There is no pre-134 Chromium on this host" is false.** Chromium **106.0.5249.181** at
   `E:\old\front-research\np\Front.exe` (V8). And **the artefact that would unblock the backport question
   is a build in `[130.0, 134.0)`**, not "anything below 134" — the sub-130 experiment was run and settles
   nothing (§2b).
4. **The forced-crash dump does NOT capture register-pointed memory.** §3b. Stacks, TEBs, contexts, PEB,
   process parameters, command line, environment — that is the whole memory answer.
5. **`channel_win.cc` does NOT show a uniform −4 line shift.** The fourth anchor is **125**, not the
   predicted 129 (V2), so the deltas are +4/+4/+4/0 and the inter-anchor-delta instrument reports a
   **real 4-line divergence** between the shipped build and Chrome 150 in a Windows IPC file. Undated.
6. **The mojo/core `__FILE__` anchor sets are NOT identical** between the shipped build and Chrome 150:
   Chrome 150 has a `mojo\core\ipcz_driver\invitation.cc` anchor (`0x18f0b41e8`) with no counterpart in
   the shipped build. Thread A's own record contradicted itself on this (§D said ipcz_driver has no
   anchors; §E said its anchors are present).
7. **The named-pipe peer-PID validation is real code but its file attribution is not established.** The
   comparison in `0x1804f1be0` is confirmed instruction by instruction; the substring
   `ipcz_driver/invitation` has **zero** occurrences in `Qt6WebEngineCore.dll` — the only `invitation.cc`
   anchor there is `mojo/public/cpp/system/invitation.cc`, a different file.
8. **Smaller factual corrections that will otherwise be re-used:** 17 → **16** register slots;
   5 → **4** genuine MSVC `IsPseudoHandle` idiom sites in `Qt6WebEngineCore.dll` (`0x18652839c` is a
   register-mismatched false positive); NPL's `Delete*` imports are three, not one (the operative negative
   — no *file*-deletion API — survives); the crash-gate registry path is
   `HKCU\Software\Wickr Pro\TopSecretMessenger` and `forceWOA` exists under `…\Wickr Pro\servers`.
9. **"No virtual dispatch anywhere on the chain" is overstated.** The entry into `qpdf.dll` is vtable
   slot [2] of `0x1800047a8`, the sniff is slot [1], and `ProcessImage` does
   `0x1802c671f call qword [rax+0x68]`. Correct wording: *no virtual dispatch after the plugin handler
   entry*.
10. **Absence of a string is not absence of a feature — twice this wave.** Beyond item 2: thread C argued
    FreeType's colour-bitmap glyph support was absent because `sbix`/`CBDT`/`pngshim` do not appear as
    strings. FreeType encodes table tags with `FT_MAKE_TAG` **immediates**: `CBDT` (`54444243`) ×3,
    `CBLC` ×3, `sbix` ×3, `EBDT` ×1, `EBLC` ×2 are all present in `.text`, in functions that are entries
    in the sfnt service table at `.rdata 0x180323f40`/`0x180324000`.

---

## §7 — WHAT REMAINS OPEN, RANKED, WITH THE CHEAPEST DECISIVE CHECK

**1. Backport provenance for CVE-2025-2783 — the headline. UNDETERMINED.**
*Cheapest decisive check:* obtain **one** Chromium build in `[130.0, 134.0)` (or, far better, a stock Qt
6.9.2 QtWebEngine, which unblocks every code-only CVE at once), find `platform_handle_in_transit.cc` by
its `__FILE__` anchor, read the `LOG(FATAL)` line number and look for a `[-12,-1]` test before
`DuplicateHandle`. *Check absent + line below 71* ⇒ the check IS the fix and the backport landed.
*Check present* ⇒ it predates M130 and the real remediation is elsewhere. Tooling takes a path as
`argv[1]`: `scratch/w12/`. **RoE forbids fetching one; this is a vendor/operator ask.**

**2. Where the CVE-2025-2783 remediation actually is upstream. UNDETERMINED, and it is the premise under
item 1.** *Cheapest decisive check:* the upstream diff for the M134 patch, read offline. If the fix is not
the pseudo-handle `CHECK`, every measurement on `TransferHandle` is a true observation about the wrong
function.

**3. Date the `channel_win.cc` 4-line divergence. UNDETERMINED — and it is cheap.**
*Cheapest decisive check, runnable today with no new artefact:* measure the anchor-3→anchor-4 delta in the
Chromium **144** and **146** builds already on this host. Shipped Qt = 33, Chrome 150 = 37. **If 144 also
reads 33, the four lines arrived in `(144,150]` and the lead is dead** — same shape as the "Broker host"
false lead, killed by the same ladder. If 144 reads 37, the divergence is in `(130,144]` and stays live.
Roughly an hour's work. Do this before item 1.

**4. Date the missing `ipcz_driver/invitation.cc` anchor.** Same instrument, same ladder, same hour.
**UNDETERMINED.**

**5. Complete the crash-report annotation inventory. UNDETERMINED, bounded ceiling.** The slot-`0x160`
dispatch sweep has a 14-instruction lookback and misses the known site in `initBugTrackers`. *Cheapest
decisive check:* redo with register tracking and a wider window; two untriaged candidates are
`0x1409a7c78` (func `0x1409a7c60`) and `0x140a38bd0` (func `0x140a37e80`). Ceiling on unknown attached
data: 64 key/value pairs × 255 chars.

**6. Does a real Wickr minidump contain key material? INFERRED, and now narrower.** *Cheapest decisive
check, and it needs operator authorisation on a scratch account:* trigger a crash, keep the `.dmp`
**before** upload, and search the `MEMORY_LIST` for known key material. Because §3b narrows the scope to
stacks/TEBs/contexts/PEB/environment, the question is now specifically *"is Wickr key material on a
thread stack at crash time?"* — a much smaller question than the thread posed.

**7. libpng reachability in `Qt6Pdf.dll`. UNDETERMINED — the only reachability answer in thread C that
should not be defended hard.** *Cheapest decisive check:* the sfnt module `module_interface` table at
`.rdata ~0x180323f00` holds `0x180323fc8 → 0x18007a030`, which is inside the transitive direct-caller
closure of the libpng entry points. Determine whether that table is invoked on the render path. That
single question decides it; the string-based argument against it is void (§6 item 10).

**8. OpenJPEG pin. UNDETERMINED** — only a `>= 2.5.0` lower bound from W9's HTJ2K guards. Same vendor ask
as item 1 (a DEPS manifest or a stock QtWebEngine closes libjpeg, OpenJPEG, FreeType and PDFium at once).

**9. Crash-reporting gate under a command-line override. UNDETERMINED.** Ordering between `main`'s
`environment = production` store (`0x140012d70 mov edx,3`) and the `--environment` parser (`0x1409d6500`)
was never established. If the parser runs later, `--environment alpha` forces crash reporting on even when
`enableProxy`/`forceWOA` are set. *Cheapest decisive check:* read `main`'s call order — minutes.
Related and also open: who calls the `forceWOA` / `enableProxy` **setters** (`0x140a2b8e0`, `0x140a2b690`,
`0x140b9a460`), i.e. whether the hub can silently disable a target's crash telemetry.

**10. Re-verify the W9 sender-side chain** so "peer-supplied" can replace "network-reply-supplied" in the
parser-surface finding (§5 item 4). *Cheapest decisive check:* re-derive the producer of the buffer at
`[rdi+0x188]` in `func 0x140c14f70` end to end.

**11. Re-run the DSN "no writer" result with the linear superset scan.** Thread B did **not** re-test the
lead's earlier claim that the three DSN globals have no runtime writer, and its own `.pdata`-bounded xref
produced a false negative this very session. *Cheapest decisive check:* `scratch/w11b/linscan.py` over
those three globals — minutes. Until then the "destination is not attacker-redirectable" statement in §3a
is **INFERRED**, resting on the lead's earlier result, not on W11's measurement.

**12. Never examined, and each is a plausible home for a post-M130 fix or a parser bug:** V8 13.0.245.25,
ANGLE (105 file paths), Skia, Blink image and font decoders, BoringSSL, WebRTC (385 paths, remotely
reachable, undated), libxml2/libxslt (undated, XSLT remotely reachable), the PDFium library proper as
distinct from the `//pdf` plugin, `Qt6Pdf.dll` as the **unsandboxed** copy of that snapshot, and all
`.pak`/`.dat` resources.

---

## §8 — METHOD NOTES WORTH CARRYING FORWARD

* **The inter-anchor line delta is the reusable instrument of this wave.** Two `__FILE__` anchors in the
  same source file give a delta invariant under everything except an insertion or deletion *between* them,
  so it detects change in a code region **with no pristine baseline at all**. It worked (`channel.cc`
  delta 23 == 23 despite a +192 whole-file shift) and it is what produced open item 3. Its reach is
  limited to regions bracketed by two anchors.
* **The version ladder is what kills string-absence leads.** "Absent here, present in Chrome 150" looks
  like a missing backport and was one of the most promising-looking observations of the wave; running
  144 and 146 through it showed the feature arrived in `(146,148]`. Build the ladder before you believe
  the delta.
* **`.pdata`-bounded sweeps cannot see leaf accessors.** Three separate agents in this engagement have now
  published a confident "no references" negative that a linear superset scan overturned in seconds
  (W9 version accessor, W10 NPL chained chunks, W11B `CrashpadInfo`). Run the superset scan before
  publishing any zero-reference result. `scratch/w11b/linscan.py`.
* **When a call is unguarded, the next question is what the callee does with the argument the guard would
  have set.** Thread B lost its headline to a trace that stopped one function short (§3b). Nothing about
  its coverage would have caught that.
* **Absence of a string is not absence of a feature** (§6 item 10) — the mirror image of the engagement's
  existing rule 3, and it cost thread C its #1 forward recommendation.
* **Do not screen where the answer matters.** Unchanged from W10, and it held again: every refutation in
  this note came from reading a full record or disassembling a byte, not from a keyword pass.

---

## §9 — ARTEFACTS

* Thread A tools + raw evidence: `E:\tmp\wickr\scratch\w12\` (`paths.py`, `xref.py`, `wdis.py`,
  `rdis.py`, `pseudoscan.py`, `chromever.py`, `W12-raw-evidence.txt`); verifier's full evidence trail with
  every address and byte string in the session scratchpad `…\scratchpad\v\VERIFIER-evidence.txt`.
* Thread B tools + intermediate data: `E:\tmp\wickr\scratch\w11b\` — `W11B-evidence.json`,
  `linscan.py` (the scan that caught its own false negative), `chain.py` (the W10 join-bug guard), plus
  per-function disassembly dumps (`initBugTrackers.txt`, `cph_*.txt`, `wasapi_ctor.txt`, …).
* Thread C tools + intermediate data: `E:\tmp\wickr\scratch\w11c\` — `qt6pdf_oedges.json` (the graph the
  reachability claims rest on), `pdf_err.json` / `web_err.json` / `qjpeg_err.json` (ERREXIT censuses),
  `match.json`, `libanchors.json`, and `fgraph.py` / `ograph.py` / `lean3.py` (the three fixed tools).
* Synthesizer's own verification scripts (§0b): session scratchpad `vat.py`, `w11fn.py`, `vstr.py`.
* Prior context that this note does not repeat: `NEXT-HUNT-BRIEF.md` (WAVE 10 and WAVE 9 blocks first),
  `W10-CRUX-linkA-triage.md`, `W9-CRUX-residuals.md`, `SUBMISSION-01-mic-pcm.md`.
