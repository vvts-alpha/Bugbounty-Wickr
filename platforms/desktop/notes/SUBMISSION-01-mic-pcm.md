# Submission draft — raw microphone audio written to disk unencrypted, by default

**Asset:** Wickr Pro / AWS Wickr desktop client (Windows), version 6.72.20.0
**Class:** CWE-312 Cleartext Storage of Sensitive Information / CWE-532 Insertion of Sensitive
Information into Log File
**Suggested CVSS v3.1:** `AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:L` ≈ **6.1 (Medium)** — noting the
program's guidance that rewards are based on impact rather than CVSS, and that the product context
(§5) is where the real weight sits.

---

## 1. Summary

The Windows client writes the **raw microphone signal of every call to disk, unencrypted, in a
user-readable location, by default, with no user-visible indication, no rotation and no size bound.**

This is a WebRTC audio-processing debug facility left enabled in a shipped, signed release build. It
is not a crash artefact and not opt-in: the two `fopen` sites sit on the straight-line path of the
`WASAPIAudioManager` constructor, and no branch in that function or in its caller can bypass them
(§4).

For a product whose stated proposition is ephemeral, end-to-end-encrypted communication — and which
is FedRAMP-authorised and sold into government and defence — call audio persisting in cleartext on
the endpoint defeats that proposition at rest, with no attacker skill and no exploitation required.

---

## 2. What was observed (measured)

Directory: `%LOCALAPPDATA%\Programs\Amazon Web Services, Wickr\AWS Wickr\`

```
28 files, 456 MB total, 14 sessions x 2 files
  aud_in_before_aec_<pid>_48000_1ch.pcm
  aud_in_after_aec_<pid>_48000_1ch.pcm
```

* **Format:** headerless raw PCM, 48 kHz, 16-bit signed little-endian, mono. Directly playable with
  e.g. `ffplay -f s16le -ar 48000 -ac 1 <file>`.
* **Produced at runtime, not shipped:** file timestamps fall on the days calls were made; the
  binaries in the same directory carry the install date.
* **One file pair per client process** (named by PID). 14 distinct PIDs produced files — i.e. every
  observed session.
* **Largest single session:** `203,624,448` bytes = **35.4 minutes** of continuous audio, per file,
  for one call.

**Content verified by sampling 64 evenly-spaced 8 KiB windows per file:**

| session | size | peak sample | windows containing signal |
|---|---|---|---|
| `*_7564` | 3.6 MiB | **32768** | **64 / 64** |
| `*_13600` | 4.3 MiB | **32768** | 51 / 64 |
| `*_18248` | 13.2 MiB | **28510** / **16793** | ~30 / 64 |
| `*_4248` | 2.5 MiB | **32768** | 10 / 64 |
| remaining 10 sessions | 0.4 – 194 MiB | 0 – 5 | near-silent |

**Four of fourteen sessions contain full-scale recorded audio.** The near-silent sessions are runs
where the microphone was muted or no input device was active — the client recorded them anyway,
including one that wrote **194 MiB of silence per file** over 35 minutes.

*(The recordings are the reporter's own voice from the reporter's own test calls, on the reporter's
own machines. No third party's audio was captured, and the files were not transcribed.)*

---

## 3. Steps to reproduce

1. Install the Windows client and sign in.
2. Place any call with the microphone enabled and speak for ~30 seconds. Hang up.
3. Open `%LOCALAPPDATA%\Programs\Amazon Web Services, Wickr\AWS Wickr\`.
4. Two files named `aud_in_before_aec_<pid>_48000_1ch.pcm` and `aud_in_after_aec_<pid>_48000_1ch.pcm`
   are present, sized in proportion to the call duration.
5. Play either directly:
   `ffplay -f s16le -ar 48000 -ac 1 "aud_in_after_aec_<pid>_48000_1ch.pcm"`

The call audio is audible. No elevation and no special tooling are required at any step.

---

## 4. Root cause (disassembled, `NPL.dll` 6.72.20.0)

The filename template strings occupy a contiguous cluster:

```
0x180446be0  "aud_in_before_aec_"
             "aud_in_after_aec_"
             "ch.pcm"
             "wb"
```

They are referenced from **`0x18015bddc`** and **`0x18015bf83`**, both inside the
`WASAPIAudioManager` constructor at **`0x18015bb70`** (extent `0x15bb70`–`0x15c0c3`, 1363 bytes).

**Neither site is gated.** The function contains exactly ten conditional branches:

```
0x15bd3e je  -> 0x15bd4d      0x15be4e jbe -> 0x15be53     0x15be72 jbe -> 0x15bea9
0x15be85 jb  -> 0x15bea3      0x15be9a jbe -> 0x15bea3     0x15bef3 je  -> 0x15bf02
0x15bff5 jbe -> 0x15bffa      0x15c019 jbe -> 0x15c050     0x15c02c jb  -> 0x15c04a
0x15c041 jbe -> 0x15c04a
```

**None of them has a target that skips either `0x15bddc` or `0x15bf83`.** Both are on the
straight-line path from function entry.

The constructor has a single caller, `0x18012a83c` inside `0x18012a750`, which is an audio-backend
factory:

```
0x18012a7ff  test sil, sil
0x18012a802  jne  0x18012a825        ; sil != 0 -> the WASAPI implementation
0x18012a804  mov  ecx, 0x490         ; else: a different manager class (0x180151b80)
...
0x18012a825  mov  ecx, 0x520
0x18012a82a  call operator new
0x18012a834  test rax, rax
0x18012a837  je   0x18012a844        ; <== the ONLY branch that skips the call
0x18012a83c  call 0x18015bb70        ; WASAPIAudioManager ctor
```

The only branch that bypasses the constructor is the **`operator new` NULL check**. `sil` selects
which audio backend to build; it is not a recording flag, and the recording is unconditional within
the WASAPI implementation — which is the one used on Windows in all 14 observed sessions.

**Residual, stated explicitly:** what sets `sil` further up the call chain was not traced. It is a
backend selector rather than a debug toggle, and empirically the WASAPI path was taken in every
observed session, but we did not prove that no configuration selects the other backend.

---

## 5. Impact

**No exploitation is required. The attack is `copy *.pcm`.** The severity comes from what the product
promises and who can read the files.

**5.1 — Any process running as the user, with no microphone permission and no live presence.**
A same-user process could of course record the microphone directly — but only while the call is
happening, and on Windows that raises the in-use indicator and is visible in privacy settings. These
files give **retroactive, silent access to calls that already ended**, with no microphone access at
all. An infostealer that globs `*.pcm` obtains conversations it was never resident for.

**5.2 — The product's own threat model.** AWS Wickr is sold on ephemerality and end-to-end
encryption, is FedRAMP-authorised, and is marketed into government and defence. "The conversation
does not persist" is the product. A device that is imaged, seized, backed up or handed on yields
verbatim call audio that the user has every reason to believe does not exist.

**5.3 — The audio leaves the endpoint without anyone deciding to send it.**
`%LOCALAPPDATA%\Programs\...` is routinely collected by endpoint backup agents, EDR/DLP tooling,
forensic imaging, roaming profiles and VDI persistence layers.

**5.4 — Unbounded disk consumption.** 194 MiB per file, per 35-minute session, **even when the
microphone is silent**. No rotation, no cap, no cleanup on exit. 456 MB accumulated from ordinary
testing over two days.

**5.5 — Possible capture of the remote party (NOT VERIFIED — flagged for your assessment).**
`before_aec` is by definition the microphone signal *prior* to acoustic echo cancellation. When a
user is on loudspeakers rather than a headset, the far end's voice is acoustically present in that
signal — that is precisely why AEC exists. If so, `before_aec` may contain both sides of the
conversation. **We did not verify this** and make no claim about it; we raise it because it would
materially change the impact and is cheap for you to check.

### Anticipated objection: "requires physical access to a user's device"

It does not. No physical access is required: any process already running under the user's account
reads these files, and any backup, sync or endpoint-management agent copies them off the machine.
The finding is not about an attacker reaching the device — it is about the product creating and
retaining plaintext recordings of the user's calls that the user was never told about and cannot
see.

---

## 6. Remediation

1. **Remove the debug recording from release builds** — the correct fix. This is a WebRTC
   `AudioProcessing` debug dump; nothing in the shipped product needs it.
2. If it must remain for field diagnostics: gate it behind an **explicit, per-session, opt-in** user
   action with a visible indicator, write to a temporary location, cap the size, and delete on
   session end.
3. **Delete existing files on upgrade.** Users who have run any affected build are carrying
   recordings now; a fix that only stops new writes leaves the exposure in place.
4. Consider whether other WebRTC debug facilities (`aecdump`, event logs) are similarly enabled.

---

## 7. What is not claimed

* No remote attacker capability is claimed. This is a local data-at-rest exposure.
* No compromise of Wickr infrastructure or of any account other than the reporter's own.
* The far-end capture in §5.5 is explicitly unverified.
* Testing was confined to the reporter's own machines and own accounts.
