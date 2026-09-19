# W67 CHECKPOINT — 2026-08-08 (handoff to the Xe/Arc host)

Session state for the AWS Wickr Desktop BBP engagement.  Written on the
**legacy-UMD device** (Intel UHD 0x9B41, `igd10iumd64.dll` 31.0.101.2127, 16 GB,
Win11, project moved to `C:\project\wickr`).  The ANGLE line resumes on the
**Arc Pro host** (device 0x7D55, `igd10umt64xe.DLL` 32.0.101.8724).

---

## 0. Headline results of this session

| Line | Status |
|---|---|
| **Renderer RCE (this device)** | **DEMONSTRATED [M]** — EXEC-OK ×5 runs (ports 12741, 12783, 12809, 12811, 12827), full verdicts below |
| ANGLE TF11 write-1 (this device) | **DEAD HERE [M]** — the Draw-time chase does not exist in `igd10iumd64.dll` (4/4 landed runs, 0 writes, 0 faults). Verdict: `scratch/w67/W67-STEP0-LEGACY-UMD-VERDICT.md` |
| ANGLE TF11 write-1 (Arc host) | stands [M] 8/8 (W56/W57/W64/W64b) — resume there |

**Renderer RCE proof shape** (all [M], harness cross-checked):
page bootstrap (CVE-2026-11645, W35) → cage/pool/dll_base byte-exact →
421403261 gate fired → **memory-path out-of-cage R/W (full 64-bit)** →
34-byte shellcode written over the page's own TurboFan code at a marker site →
`payfn()` call executes it → shellcode reads `[rbp+8]` (return address) and
`rbp` (frame pointer) into the wasm memory + nonce `0x13371339`, `leave;ret`
clean → **renderer alive**.  Harness independently: watched the bytes land
(G5 `shellcode_seen=1`), confirmed retaddr ∈ code range and frameptr ∈ a live
thread stack, 0 faults.

---

## 1. The two harness-provided addresses (PoC model, cf. W67 doc)

The page does everything except TWO values served at `/params` by the harness
(found by content, never by the page's own leak):

1. **`cr` / `sites`** — code-range candidate + the page's own marker-function
   code addresses (content-located).
2. **`mem`** — the wasm memory backing base (content-located via a planted
   16-byte marker at backing+0x40).

Report framing: "attacker knows two runtime addresses in the target process"
— the same strength as the ANGLE line's model.  Measured negative [M] that
justifies it: **no stable page-side path from cage/pool/DLL to any executable
address exists** — cage discloses nothing (W52), pool only the DLL anchor
(W53, only `+0x1000` invariant), DLL `.data` has no code-range global (0 hits),
and 2-hop/3-hop C++-heap paths are per-run unstable (0 stable (rva,off[/off2])
across 4+4 runs).  The code range itself is per-run placed here (not per-boot),
so even a hardcoded delta is impossible.

## 2. NEW technical findings this session (all [M])

1. **Legacy UMD lacks the write-1.**  On `igd10iumd64.dll` the stale
   `SOSetTargets`+`Draw` does no pointer chase; only the fixed-offset
   bookkeeping write into the reclaimed block (+0x240/+0x248/+0x258).
   The Arc-host primitive is Xe-UMD-specific.  (`W67-STEP0-LEGACY-UMD-VERDICT.md`)
2. **Memory-path primitive = full 64-bit out-of-cage R/W.**  Feeding the
   421403261 confused return into `i32.load8_u`/`i32.store8` (wasm memory)
   instead of `array.get_u/set`: address = `memory_base + RAX`, whole address
   space, byte granular.  Fired: pool anchor byte-exact; DLL `MZ` header
   byte-exact at RAX ≈ 135 TiB.  (`probe_mget`/`probe_mset` in the module.)
3. **W49 §3's granularity claim was wrong.**  The ARRAY path's explicit
   `cmpl` bounds check confines it to a `[r0, r0+len)` residue window per
   4 GiB frame; the code range is unreachable from cage-resident arrays
   (would need ~3 GB in-cage allocation).  Use the memory path.
4. **Far-OOB memory reads trap RECOVERABLY** (V8 trap handler → catchable
   `RuntimeError`), not fatal — BUT only until tier-up.
5. **Tier-up kills the probes**: after ~65k calls a probe is TurboFan-compiled
   and the confused return is correctly zero-extended there → primitive dies
   mid-use.  Keep probe call counts low (site path = ~100 calls).  A full
   512 KiB byte-scan crosses the budget (~4 pages then all traps).
6. **memory_base = cage_base + 4 GiB in 4/5 runs** (wasm memory backing is the
   first sandbox sub-allocation after the cage).  Not relied on (harness
   provides `mem`), but a candidate for removing that address.
7. **This device needs groom re-tuning** (vs Arc host): `NELEM=384` (not 320),
   `<script type="module">` + `await`-based settle ticks (10×25 ms) after each
   groom stage + after ALLOC, 500 ms settle after the payfn warmup.  Without
   these: 0/15 phase-A passes.  With: ~60-80% (streaky; NO-SMASH batches occur
   — just retry).
8. **`arr8` must stay small** (4 MiB): the pool-read aim needs `addrof(arr8)`
   within the first super pages; big in-cage allocations kill the burst
   (W54 defect 13).

## 3. Renderer-chain runbook (this device, working config)

```
cd C:\project\wickr\scratch\w67
build: cmd //c "..\w55\build.bat w67.c w67.exe"        (VS18 Community here)
run:   C:\Users\user\AppData\Local\Python\bin\python.exe w67rcerun.py PORT 150
# defaults baked in: WL=5 MODE=1 NELEM=384 SPRAYN=12000 AGEN=60000 TICK=10x25
# success = page DONE "EXEC-OK" + runner ">>> RCE DEMONSTRATED"
# ~60-80% per load; NO-SMASH streaks are the flaky mode -- retry.
```

Artifacts: `w67-rce.tmpl.html` (the exploit page), `w67.c/w67.exe` (harness:
params + ground truth + shellcode watch + thread stacks), `w67rcerun.py`
(server + verdict comparison), `rce-<port>.txt` run logs, `w67-<port>.log/.json`.

## 4. Resume on the Arc/Xe host (ANGLE line, W67 Steps 0-5)

The write-1 is proven there, so the original W67 objectives apply unchanged.
Deltas to apply when copying this workspace there:

1. **Paths**: `_build.bat`/`build.bat` vcvars (VS2022 BuildTools there vs VS18
   here); `WICKR_DIR` in harnesses (`C:\Users\mwgn-\...` there vs `...\user\...`
   here); `W55DIR`/`W67DIR`.
2. **Python venv is broken everywhere** (points at `C:\Users\ENOKIDA\...`):
   recreate with the local python (`python -m venv .venv` + PySide6 6.9.2) or
   use a system python for the stdlib-only runners.
3. **w57probe.c** builds as-is; Step 0 sanity: `W57_NOFLUSH=1 w57probe.exe
   mallocwrite:self` must HIT (it will there).
4. **Gating map (W64b) holds there**: 2 vtable qwords (d3d11+0x1D8108 outer,
   +0x1DDA60 iface — per THAT host's d3d11 build) + steering; rest FREE.
   `ifoff ∈ {0xE0,0xF0,0x100,0x110}` → cover all 4 slots in the page template.
5. Then Steps 2-5 per `W67-RCE-PROOF-OBJECTIVES.md`: page template →
   gl::Context discovery harness → mSkipValidation write + A/B
   (INVALID_OPERATION → NO_ERROR) → OOB bufferSubData → arb R/W → vtable
   overwrite (no CFG there) → calc.exe.
6. **Reuse from this session if useful**: the memory-path full-R/W trick
   (finding #2) and the tier-up caveat (#5) apply to any wasm-side PoC there too;
   the settle-tick groom tuning (#7) may need re-calibration for that machine's
   speed (it needed none).

## 5. Open items / honest gaps (both lines)

- Renderer line: page-side recovery of `code_range` (and trusted-space base)
  remains the documented open gap — candidates exhausted (§1).  Sandbox escape
  (renderer → WickrPro.exe) is out of scope (blocked, W27/W18).
- Renderer line reliability: end-to-end ~60-80% per load here, gated by W35
  phase A.  Never a wrong value in any pass; failures are pre-fire and safe.
- ANGLE line (Arc): Steps 2-5 unexecuted yet; mSkipValidation address via
  harness (gl::Context walk) is the next measurement.
- No code execution is claimed for anything beyond this session's EXEC-OK
  renderer demonstration; the ANGLE RCE is not yet demonstrated anywhere.
