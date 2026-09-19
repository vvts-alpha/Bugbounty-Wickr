# Consolidated state — the renderer-RCE line (W20 → W32)

Written 2026-08-05. The goal driving this line: **peer-originated renderer code execution** on the
shipped AWS Wickr desktop (QtWebEngine, Chromium base **130.0.6723.192**, declared security-patch
level **139.0.7258.67**). Every line is **[M]** measured on shipped binaries / the live product, or
**[I]** inference. **Bottom line up top: code execution is NOT achieved.** Two vulnerabilities are
confirmed firing on this build; both are stuck at the weaponization step for different, measured
reasons.

---

## 0. The delivery chain (established earlier, holds)

`peer .pptx → preview (needs enableFileDownload=false) → one click → a page at the frame-src
allow-listed origin main.d4zeeqgazhley.amplifyapp.com` — **[M] confirmed in-product** by the operator.
That page is the attacker's own origin ⇒ Wickr's CSP does not apply; TLS validation off; JIT on;
WebAssembly on. So a single attacker page runs arbitrary JS inside the Wickr window. What that page
can reach at memory level is the whole question below.

Process posture, all **[M]**: renderer IL=UNTRUSTED/restricted/job/MicrosoftSignedOnly; browser
`WickrPro.exe` IL=MEDIUM, **no GUARD_CF (PE 0x8160)**; network service AND ANGLE run **in-process in
WickrPro.exe** (no GPU process); **site isolation OFF** (one shared v8::Isolate — W17j).

---

## 1. THE VERSION GATE (the spine of all CVE triage) [M]

```
USABLE     = {fix landed AFTER 139.0.7258.67}  ∩  {vulnerable code PRESENT in the 130 base}
NOT usable = fix at/below 139.0.7258.67 (Qt backported it)  OR  vuln code introduced after 130
```

Verified both halves:
* Sub-139 fixes ARE backported — CVE-2025-2783 (@134), 4609 (@136), 6554 (@138) all measured
  present-as-fixed (binary/behavioural). ⇒ **any CVE fixed ≤139.0.7258.67 is patched here.**
* Post-139 fixes are absent ONLY if the vuln code predates 130 — CVE-2026-6307 (fixed 147) is
  **not_affected** because its frame-state machinery was introduced ~2026-03 (post-130); same for
  CVE-2026-0902/15903/3926 (vuln code postdates 130).

**Triage every future CVE with BOTH gates. The productive target is post-139 fix ∩ 130-resident code.**

---

## 2. The two confirmed-firing renderer bugs

### CVE-2026-2441 — Blink CSSFontFeatureValuesMap iterator UAF  → VERIFIED controlled-address WRITE
Fixed Chrome 145, vuln code in 130 base, ITW. **[M] fires** (W20: shipped Qt `--single-process` →
`0xC0000005`; patched Chrome 150 survives). Weaponized in W27/W27c to a **reproducible controlled
write** — the strongest primitive reached this whole session:
* Recipe: seed a `@font-feature-values` styleset to 3 entries (192-byte WTF **buffer**-partition
  backing v1) → `for-of` → in-loop single `.set()` frees v1 → spray **64-element `Vector<uint32_t>`**
  reclaims v1 → the dangling read takes `rdi` from **offset 32 = spray elements [8]:[9]** ⇒ **full
  64-bit control of the pointer `RefCounted::ref()` dereferences** (`Qt6WebEngineCore+0x3673f50`,
  `lock xadd [rdi]`). Reproducible 5/5.
* **★ WRITE DEMONSTRATED [M]:** aim rdi at a harness-mapped `0x133700000000`; `[rdi+8]==0` →
  `lock xadd [rdi],1` executes → target reads back **=1, 4/4**. Not a controlled crash — an executed
  attacker-chosen-address write.
* Field map pinned [M]: `[8:9]`=write ptr, `[10:11]`=downstream `Vector::operator=` memcpy SOURCE ptr,
  `[13]`=memcpy SIZE (small → memcpy completes → the exploit progresses past it).
* **ROOT BLOCKER = ASLR bootstrap [M].** To get an *observable* read (yield the confused value to JS),
  the fake object must survive a downstream `PartitionAlloc` integrity check (`0x471f200`:
  `mov rcx,[page_base]; cmp [rcx+0x1d08],~rcx`), which requires the buffers to sit at REAL PA-managed
  addresses. Spray region = `<per-run ASLR base>|0x417a28` (low 24 bits STABLE, high ASLR); the UAF
  discloses the base only in a FAILED-reclaim run (freelist byteswap) which then crashes —
  chicken-and-egg. All self-contained leak routes (memcpy-read of a secret, freelist byteswap,
  write-oldvalue, PA-metadata faking) measured dead. ⇒ **needs a SEPARATE info-leak.** This is exactly
  why public 2441 PoCs are crash-only.
  Harness: `scratch/w27/{cssfault.c,spray2.py}`. Detail: `W27c-2441-slot-control-ACHIEVED.md`.

### CVE-2026-11645 — V8 TryFastAddDataProperty map type-confusion → OOB read+write  → CONFIRMED FIRING
The operator's lead. Fixed Chrome **149** (>139), vuln code **byte-present at v8 branch-heads/13.0**
(self-verified: `TryFastAddDataProperty` in `src/objects/js-objects.cc` has the `is_dictionary_map()`
guard ONLY inside the `is_deprecated()` branch; after `PrepareForDataProperty`→normalize it goes
straight to `MigrateToMap`/`WriteToField` with no check — the fix `3c869652b039` adds exactly that
line). ITW, $55k.
* **[M] fires** (clean A/B, no flags): trigger = the public regression test structure
  `class C extends Function { [key]=value }` instantiated with a Smi field then re-instantiated after
  changing it to a Double. Shipped Qt: `o2.AA` = **undefined**, **199/200** instances corrupted;
  patched Chrome 150: `1.1`, **0/200**.
* Mechanism traced [M]: normalized dictionary map's `instance_descriptors()` is the shared EMPTY
  descriptor array; `GetDetails(descriptor)` reads OOB past it → garbage field-index → Double stored
  at object+garbage = the OOB write.
* **BLOCKER = weaponization technique withheld [M].** In the default layout the OOB Double lands
  WITHIN the object (reconfigured field → undefined, neighbours intact); naive field-count variation
  (8/16/24), heap spray of arrays, and direct type-read/write probes all left the corruption
  contained — **0 adjacent smash, no addrof extracted**. Getting a CONTROLLED OOB → addrof needs
  precise control of the empty-descriptor-array OOB `GetDetails` return (deep V8-internals grooming);
  the ITW exploit is not public. Harnesses `scratch/w31/{tcsrv,addrof2,dissect,oobwrite,oob2,confuse}.py`.

**The two compose in principle:** 11645's OOB read = the leak 2441's verified write needs. Neither
half is weaponized yet.

---

## 3. Ruled out (do not revisit) [M]

* **CVE-2026-6307** (V8 JS-to-Wasm) — 0xsha's own verified exploit reports **NOT_REACHED** here; vuln
  frame-state machinery postdates 130. not_affected.
* **CVE-2025-6554** (V8 optional-chaining/TDZ, arb R/W) — fixed 138 (<139) → backported; behavioural
  A/B: Qt == patched Chrome (both throw ReferenceError). Patched.
* **CVE-2025-6558** (ANGLE transform-feedback, sandbox escape) — fixed 138 (<139) → backported; and
  needs **WebGL2**, which is NULL on this host even with `--ignore-gpu-blocklist`.
* **CVE-2026-13782 / 13775 / 6304 / 5281 / 15903 / 0902 / 3926 / 2025-14766 / 2025-10890** — each
  not_affected (component absent from QtWebEngine, or vuln code postdates 130, or wrong arch, or wrong
  leak type). See `w26-w27...` and the W31/W32 workflow journals.
* The known-CVE **sandbox-escape** route is ~closed (mojo 2783/4609 fixes present; top candidates
  not_affected). SBX, if ever needed, is original research — but note ANGLE/network run **unsandboxed**
  in WickrPro.exe, so a bug there needs no escape.

---

## 4. ★ WebGL correction (W31) — reopens the ANGLE/GPU surface for real deployments [M]

Earlier "WebGL is OFF / a Qt-build property" (W17j/W26/W30) was **WRONG — a host artifact.** Measured
(`scratch/w31/wglprobe.exe`, A/B across GPU flags): default → WebGL NULL, but **`--ignore-gpu-blocklist`
→ WebGL1 OK (ANGLE, VMware SVGA 3D, D3D11)**. So the NULL is the Chromium **GPU blocklist** (this box
is a VM with a blocklisted VMware SVGA GPU), NOT `webGLEnabled=false` and NOT a hard Qt disable.
* Product config [M]: the MAIN app view (`blob_030a2bec.js`, bridge + preview iframe) does NOT set
  `webGLEnabled` → Qt default **true**; only the SSO view sets false.
* ⇒ **On a real user machine (normal non-blocklisted GPU), Wickr's main/preview view has working WebGL
  → the ANGLE/GPU CVE class IS page-reachable**, and lands in the unsandboxed CFG-less WickrPro.exe
  (direct browser-process corruption, no escape). My earlier dismissal of that surface held only for
  this VM host.
* Caveat: **WebGL2 stays NULL here even with the flag** (VMware ANGLE caps) → on THIS box only
  WebGL1-driven ANGLE bugs are testable; real victims with WebGL2 widen it.
* `--ignore-gpu-blocklist` re-enables WebGL for OUR evaluation only — an attacker cannot flip a
  victim's flags. Detail: `w31-webgl-host-blocklist-correction.md`.

---

## 5. Where this stands / next

**Achieved & verified:** the pptx→origin delivery (in-product); CVE-2026-2441 controlled-address WRITE
(executed, 4/4); CVE-2026-11645 firing (A/B) + mechanism. **Not achieved:** any addrof/observable
leak, arbitrary R/W, or code execution.

The single missing piece for code execution is an **info-leak (OOB read) that discloses a heap/module
address** — then 2441's write (or 11645's write) composes into arbitrary R/W → CF-hijack. Options, in
order of promise:
1. **W32 (running):** hunt a post-139 ∩ 130-resident V8 read/write CVE whose weaponization is
   PUBLICLY documented (TypedArray/ArrayBuffer/element-kind classes) — to avoid 11645's withheld-
   technique wall. If one clears both gates with public addrof→R/W detail, that is the fastest path.
2. Crack 11645's controlled-OOB via deep V8-internals grooming of the empty-descriptor-array read.
3. A WebGL1-driven, post-139, 130-resident ANGLE OOB (lands unsandboxed in WickrPro.exe).

**Reporting value already banked (independent of code execution):** the patch-currency gap
(139.0.7258.67 vs multiple post-139 ITW CVEs present); CVE-2026-2441 upgraded from "DoS/crash" to
"demonstrated controlled-address write primitive"; CVE-2026-11645 confirmed present+firing; the WebGL
correction (ANGLE surface reachable on real deployments); CVE-2025-10729 as CWE-416 (W19b).
