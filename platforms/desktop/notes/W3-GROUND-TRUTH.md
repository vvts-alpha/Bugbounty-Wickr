# Wave 3 — VERIFIED GROUND TRUTH (read before anything else)

Everything below was re-verified against the shipped artifact in this session by the lead.
Prior notes (NATIVE-PARSER-ASSESSMENT.md) contain at least one load-bearing error — see §3.
**Do not cite the prior notes as evidence. Cite the binary.**

Target: `E:\tmp\wickr\desktop\binaries\NPL.dll` (5,692,840 bytes), AWS Wickr 6.72.20.0 Windows.

---

## 1. CONFIRMED — libvpx version pin

```
$ python -c "... re.finditer(rb'WebM Project VP[89] (?:En|De)coder[^\x00]{0,40}', data)"
0x460800 b'WebM Project VP8 Encoder v1.9.0'
0x460a00 b'WebM Project VP8 Decoder v1.9.0'
```

These are libvpx's `VERSION_STRING` constants embedded in `vpx_codec_iface_t.name`.
This is a genuine pin (a constant in the binary), **not** an inference from symbol presence.
**libvpx 1.9.0 = CONFIRMED.** Both encoder and decoder are compiled in.

## 2. CONFIRMED — libvpx configure string, verbatim, @ 0x45fad9

```
x86_64-win64-vs15 --enable-runtime_cpu_detect --enable-static --enable-postproc
--disable-webm_io --enable-realtime_only --enable-error_concealment --disable-unit_tests
--disable-internal_stats --enable-multithread --disable-examples --disable-docs
--disable-multi_res_encoding --disable-spatial-resampling --disable-debug --disable-vp9
--disable-libyuv --disable-tools
```

Decode-side flags that matter, all ON:
- `--enable-error_concealment` → compiles in `vp8/decoder/error_concealment.c`. This is a
  rarely-enabled, rarely-fuzzed decoder path. **Chromium does NOT enable this.** Upstream
  fuzzing coverage of EC is therefore weak. High-interest.
- `--enable-postproc` → `vp8_post_proc_frame` deblock/demacroblock, decode-side.
- `--enable-multithread` → threaded decode (`decode_mb_rows`).
- `--disable-vp9` → VP9 is NOT present. Do not chase VP9 CVEs.

## 3. CORRECTION — the prior note's headline CVE claim is WRONG

Prior note §7.2/§7.3 states CVE-2023-5217 is a *use-after-free in the VP8 **decoder***
(`decode_mb_row`, frame threading), reachable by receiving video.

That is a misdescription. **CVE-2023-5217 is a heap buffer overflow in the VP8 *ENCODER***
(`vp8_encode_frame` / compressor realloc on resolution change). The encoder is on the
**SEND** path. Verify this yourself against the upstream commit before you rely on either
reading — but do not assume the prior note is right.

Consequence if the correction holds: CVE-2023-5217 does **not** give an attacker-controlled
receive-path bitstream bug. Reaching it would require remotely influencing the *victim's own
encoder configuration* (e.g. resolution/bitrate renegotiation, REMB/bandwidth signalling) —
a real but much narrower and more constrained position that must be demonstrated, not assumed.

Also note the prior note dates v1.9.0 to "Mar 2019", which is wrong (v1.9.0 is mid-2020).
That wrong date is what makes its CVE-2019-9232/9433 "PATCHED" reasoning unsound. Redo it.

## 4. CONFIRMED — NPL.dll export surface (230 exports, full C API)

No `vpx_*` exports — libvpx is static/internal. But NPL.dll exposes a clean C API that is
**directly harnessable without patching the binary or attaching a debugger**:

Highest interest, in order:
- `NPLAVFormatCreate` / `NPLAVFormatDestroy` / `NPLAVFormatGetVideoFormatInfo` /
  `NPLAVFormatGetAudioFormatInfo`
- `NPLAVNetSinkGetFormatBlob` — **produces a serialized "format blob"**. Its existence on a
  *NetSink* strongly implies the blob is transmitted and parsed by the peer. If
  `NPLAVFormatCreate` consumes that blob, it is the bespoke `Serializer`/`SerializerFormat`
  parser on a network receive path — the single best W1 target in the app.
- `NPLAVSourcePushPacket`, `NPLAVSourceSetFormat`, `NPLAVSourceCreate`
- `NPLPacketFromData`, `NPLPacketCreate`, `NPLPacketSetSize`, `NPLPacketGetBuffer`
- `NPLAVPacketCreate`, `NPLAVPacketGetDescriptor`, `NPLAVPacketGetBuffer`
- `NPLAVNetSourceCreate` / `NPLAVNetSourceSetChannel`
- `NPLHubVideoSubscribe` / `NPLHubAudioSubscribe` / `NPLHubAudioReadData` — receive side
- `NPLNodeCreate`, `NPLSceneCreate`, `NPLSceneConnectNodes`, `NPLSceneStart` — node graph
- `NPLInitialize` / `NPLShutdown` — required bracketing
- `NPLGetVersionString`, `NPLGetAPIVersion` — call these first to prove the harness loads
  and the DLL initialises before trusting any crash.

Full list is in the session transcript; re-dump with pefile if needed.

---

## 5. METHOD RULES — enforced, non-negotiable

1. **Label every claim `CONFIRMED` or `INFERRED`.** CONFIRMED requires an offset + quoted
   bytes/disassembly, or an executed repro with output pasted.
2. **Any negative claim ("X is absent", "not reachable") MUST include the exact command run
   and its output.** Confident false negatives are the known failure mode of this workflow.
3. **A candidate is not a finding.** Do not report "this looks fuzzable" or "this is a
   classic target". Either you have a crash + triage, or you have a version pin + CVE +
   demonstrated reachability, or you report a NEGATIVE.
4. **Verify against the MATCHING version** of any third-party component (libvpx 1.9.0, not
   HEAD). Build/download the 1.9.0 source to check whether vulnerable code is present.
5. Crashes that require a debugger, a patched binary, or an artificial call sequence no
   network peer could produce **do not count**. Null-deref, assert/abort, and stack
   exhaustion **do not count** — must be OOB r/w, UAF, type confusion, or integer overflow
   leading to a bad allocation.
6. Do not re-report: CFG-OFF on the DLLs, or WinSparkle signature verification disabled.
   Both are already filed. They are not findings for this wave.
7. Scratch/output dir: `E:\tmp\wickr\scratch\w3\<your-agent-id>\`. Keep harness source,
   crash inputs, and command logs there so the lead can re-run them.
