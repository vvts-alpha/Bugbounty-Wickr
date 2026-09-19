# RUNBOOK — `relaywatch`: observe the live TLS-UDP proxy connection objects

**Purpose.** Finish the two things W14's Route A could not: (1) how many of the eight
0x1320-byte connection slots are live at once, and (2) the real object layout, which removes
the harness qualifier from the F6 proof of concept.

**Who does what.** *You* start WickrPro and place the call. *The probe* only attaches to an
already-running process, installs one passive detour, and reads memory from outside. It never
starts WickrPro and never places a call.

**Scope.** Your own two accounts, your own machines. Nothing is sent anywhere; the probe writes
only to local files.

---

## 0. What it does to the target

One 5-byte detour at `NPL.dll + 0x9d570` (`48 89 5c 24 10`, `mov [rsp+0x10], rbx` — the relay
read handler's first instruction). The stub:

* clobbers only `rax`, `r10`, `r11` — volatile at a function entry, and none of them carries an
  argument;
* **pushes nothing**, so `rsp` and the shadow space are exactly what the displaced instruction
  expects;
* does **two stores** into a ring buffer in the target's own memory — no I/O, no locks, no
  allocation — then runs the displaced `mov [rsp+0x10], rbx` unchanged and jumps back.

This matters because the site is on the real-time media path and the poller calls it eight times
per iteration. Wave 3 established that anything which stalls that path drops the call before it
can be observed. The loader polls the ring **from outside the process**, which costs the target
nothing.

The probe **refuses to patch** if the five site bytes do not match, and restores them on Ctrl+C
or `--unhook`.

---

## 1. Steps

```bash
cd E:\tmp\wickr\scratch\w14
```

**1.** Start WickrPro normally and sign in. Do not call yet.

**2.** Check the site bytes without touching anything:

```bash
relaywatch.exe --verify
```

Expect `site bytes: 48 89 5c 24 10 (expect 48 89 5c 24 10)` and a clean exit. If it reports
MISMATCH, stop — either the build differs from the one analysed or something is already hooked.

**3.** Arm the probe and leave it running:

```bash
relaywatch.exe --dump
```

It prints `hooked. PLACE THE CALL NOW.`

**4.** Place a call between your two accounts. Let it run ~30 seconds with audio, then turn video
on for ~30 seconds (the logs show a second proxy connection coming up a couple of seconds after
the first, so give it time), then hang up.

**5.** Press Ctrl+C. It restores the original bytes and exits.

---

## 2. What to look for

Each distinct `rcx` at the relay entry is one live connection slot:

```
[*] NEW SLOT #0  base 0x...   (total entries N)
    dumped relaywatch-slot0.bin   +0x88 SSL*=...  +0x1d0 dest fam=...
    +0x2e4 tcp=...  +0x2ec udp=...  +0x12f8 fill=...  +0x12fa acc=...
```

* **`slots so far`** is the answer to question (1). W14 could only *infer* ≥2 from log pairing.
  If it reads 2 or more, the sibling-corruption path in F6 §6.4a has live neighbours to corrupt.
  **If it reads 1, say so** — that materially narrows F6's consequence and is a first-class result.
* **`+0x1d0 dest fam`** should be 2 (AF_INET) or 23 (AF_INET6). Together with the dump this
  confirms §6.2a's conclusion that the `sendto` destination is a real sockaddr.
* **`+0x12f8 fill` / `+0x12fa acc`** are the two counters the F6 overflow lands on first.

## 3. Offline, on the analysis machine

The `.bin` dumps are 0x1320 bytes each — one real connection object. Compare against the
harness-built layout in `W14-CRUX-info-leak-sweep.md` §6.1/§6.2b:

| offset | expected |
|---|---|
| `+0x58` | a `CRITICAL_SECTION` |
| `+0x80` | 0 = plain-TCP arm, non-zero = TLS arm  ← **this settles §8b** |
| `+0x88` | the `SSL*` |
| `+0x1d0` / `+0x250` | `sockaddr_storage` + its length |
| `+0x2e4` / `+0x2ec` | the TCP and UDP socket handles |
| `+0x2f4 … +0xaf4` | the UDP receive buffer (0x800, correctly bounded) |
| `+0xaf8 … +0x12f8` | **the TCP/TLS receive buffer (0x800, unbounded — the defect)** |
| `+0x12f8` / `+0x12fa` | the length counters |

**`+0x80` is worth as much as the slot count.** §8b established that the reset routine leaves it
at 0 (the plain-TCP arm) and the constructor takes it as an argument, but *no shipped configuration
was shown to run the plain arm*. A live dump answers it directly — and it decides whether F6's
attacker position stays "the hub" or widens to any on-path attacker.

## 4. If something goes wrong

* `relaywatch.exe --unhook` restores the bytes without doing anything else.
* If WickrPro exits while hooked, nothing persists — the patch is in-memory only.
* The probe writes `relaywatch.log` (appended) and `relaywatch-slot*.bin` in the working directory.

## 5. What this does NOT do

It does not send a crafted frame and does not trigger the overflow. It is read-only with respect
to the target's logic. Triggering F6 against a live client is a separate decision and would need a
separate agreement.
