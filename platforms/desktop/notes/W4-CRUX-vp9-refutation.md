# W4 CRUX — the "peer-selectable VP9 decoder" lead is REFUTED

Established by the lead at the opening of Wave 4, before any delegation, per §0 rule 1 of the Wave 3
brief ("disassemble the crux instruction yourself before headlining any reachability claim").

Target: `E:\tmp\wickr\desktop\binaries\NPL.dll`, ImageBase `0x180000000`, AWS Wickr 6.72.20.0.

---

## What the Wave 3 brief claimed

> the codec factory `NPL 0x180122040` accepts both `vp8` and `vp9` (3-char `strncmp`) … so **the VP9
> decoder is peer-selectable code the product itself never exercises** — exactly the kind of
> lightly-tested path that carries bugs.

Ranked lead **#1**. The claim is that a malicious peer can select a second, less-tested decoder.

## Verdict: REFUTED. There is no VP9 decoder in this build.

Announcing `vp9` gets an ordinary VP8 decoder object. Four independent confirmations follow.

---

### 1. CONFIRMED — libvpx is configured with `--disable-vp9`

Configure string, verbatim @ file `0x45fad9`:

```
x86_64-win64-vs15 --enable-runtime_cpu_detect --enable-static --enable-postproc --disable-webm_io
--enable-realtime_only --enable-error_concealment --disable-unit_tests --disable-internal_stats
--enable-multithread --disable-examples --disable-docs --disable-multi_res_encoding
--disable-spatial-resampling --disable-debug --disable-vp9 --disable-libyuv --disable-tools
```

### 2. CONFIRMED — no VP9 code is present

```
$ python -c "re.finditer(rb'WebM Project[^\x00]{0,50}', data)"
0x460800 b'WebM Project VP8 Encoder v1.9.0'
0x460a00 b'WebM Project VP8 Decoder v1.9.0'
$ python -c "re.finditer(rb'vp9_[a-z_]{3,30}', data)"      # -> zero matches
$ python -c "re.finditer(rb'VP9[^\x00]{0,40}', data)"
0x42550c b'VP9'                    # a format-name enum entry
0x4425d1 b'VP9 format'             # "Video should have VP8 or VP9 format"
```

The only `VP9` strings belong to the **product's own format-name enum**, not to libvpx. There is no
`vpx_codec_vp9_dx_algo`, no `WebM Project VP9 Decoder` iface name, and no `vp9_*` symbol.

### 3. CONFIRMED — the factory builds the same class for both names

`0x180122040` keys on a `std::string` codec name (MSVC SSO: `[rcx]`=ptr, `[rcx+0x10]`=size,
`[rcx+0x18]`=capacity). Three branches:

| input | test | result |
|---|---|---|
| `"h264"` (size 4) | `cmp r8, 4` @ `0x180122076`, memcmp vs `0x18043f850` | **rewritten** to `"ffmpeg"` (`0x18043f858`, 6 chars) — which then matches neither size-3 compare, so the factory returns `rbx = 0` (**NULL**) |
| `"vp8"` (size 3) | `cmp rdi, 3` @ `0x1801220ed`, memcmp vs `0x18043f6e8` | `new(0x638)` @ `0x180122110`, then `ctor(rcx=obj, edx=0, r8d=1)` @ `0x18012212a` |
| `"vp9"` (size 3) | `cmp rdi, 3` @ `0x180122141`, memcmp vs `0x18043f6ec` | `new(0x638)` @ `0x180122164`, then `ctor(rcx=obj, edx=1, r8d=1)` @ `0x180122180` |

Same allocation size, **same constructor** `0x1801435a0`. The only difference is `edx`.

### 4. CONFIRMED — the distinguishing argument is discarded

In `0x1801435a0`, the **first touch of `edx` is `xor edx, edx` at `0x18014360e`** — arg2 is never read.
The args are not homed either; the prologue writes `rbx/rsi/rdi` into `[rsp+0x10/0x18/0x20]`, i.e. over
the `rdx/r8/r9` home slots.

`r8d` is *not* the codec selector — it is the MSVC virtual-inheritance `__$MostDerived` flag, and it is
`1` in both branches. It gates the virtual-base construction:

```
0x1801435d1: 4585c0     test  r8d, r8d
0x1801435d4: 7438       je    0x18014360e          ; skip vbase setup
0x1801435d6: 488d05...  lea   rax, [rip+0x300583]  ; vbase vtables at +8, +0x78, +0xe0
0x1801435fa: 4881c188050000  add rcx, 0x588
0x180143601: e84a55fdff call  0x180118b50          ; construct virtual base
```

The class the ctor installs, resolved through MSVC RTTI (`vtable-8` → COL → TypeDescriptor):

```
vtable 0x180443a30 -> COL 0x1804dcfd0  sig 1 offset 0   .?AVVpxDecoder@AV@Musigy@@
vtable 0x180443ab8 -> COL 0x1804dd0d0  sig 1 offset 112 .?AVVpxDecoder@AV@Musigy@@
vtable 0x180442bb8 -> COL 0x1804dcc60  sig 1 offset 0   .?AVVpxEncoder@AV@Musigy@@
```

So `0x1801435a0` is `Musigy::AV::VpxDecoder::VpxDecoder`, and it has **exactly two callers, both inside
the factory**:

```
$ python callers.py 0x180122040 0x1801435a0
=== callers of 0x180122040 ===
  0x1800f03a0 (call) in func 0x1800ef820
  0x180122243 (call) in func 0x1801221f0
=== callers of 0x1801435a0 ===
  0x18012212a (call) in func 0x180122040
  0x180122180 (call) in func 0x180122040
```

There is no other construction site that could apply a VP9 flag.

### 5. CONFIRMED — `h264` is unimplemented, not a hidden surface

The `h264` → `ffmpeg` rename looked like it might expose an FFmpeg decoder. It does not:

```
$ python -c "re.finditer(rb'(avcodec|libavcodec|FFmpeg|openh264|x264)...', NPL)"   # -> zero matches
$ ls "…/AWS Wickr/"*.dll | grep -viE '^Qt'
D3Dcompiler_47 NPL QZXing3 Sock5 WickrMlsSdkCpp WinSparkle aws_lc_fips_0_13_14_crypto concrt140
crypto msvcp140{,_1,_2,_atomic_wait,_codecvt_ids} sentry ssl vccorlib140 vcruntime140{,_1,_threads}
```

No `avcodec*.dll` anywhere in the install. The literal `"ffmpeg"` @ `0x18043f858` is a name that
resolves to nothing. `h264` therefore returns a NULL decoder, matching the already-observed live log
`[E VideoHub(dec)] Unsupported codec (<null>)` → `Video subscribe failed. err: 1`.

---

## What this does and does not change

**Does not change the ranking.** Core VP8 decode is still the top surface, and for the reason the brief
gave that *was* sound: an unmodified peer feeds fully attacker-controlled bytes into a large C parser in
the unsandboxed main process, with CFG absent and no CET. Wave 3's other conclusion still stands — error
concealment, postproc, input fragments and frame-parallel decode are all compiled in but **off at
runtime** (init `flags = 0`, `xor r9d, r9d` @ `0x180144720`), so **core decode is the only live libvpx
surface**.

**Does change what to spend effort on.** There is no second, weakly-tested codec to fuzz. The genuinely
open item is the one the brief identified correctly and no earlier wave ever justified closing:
**libvpx 1.9.0 (mid-2020) has never been diffed against upstream for VP8 core-decode memory-safety
fixes.** That is Wave 4's headline task.

**Methodological note for the next analyst.** The brief's own §0 rule caught this in under ten minutes.
The failed inference was reading a *string comparison* as evidence of a *code path*: `strncmp(name,
"vp9", 3)` succeeding tells you the product accepts the token, not that anything behind it is different.
Follow the accepted token to the object it constructs, and check whether the distinguishing argument is
ever read.
