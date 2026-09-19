# RUNBOOK — B1 recon injector (`recon2_loader.exe`)

Passive, log-only. Observes the operator's OWN outgoing media-encrypt path during the operator's OWN
video call. Crafts/substitutes/transmits NOTHING. Resolves R1a-live (buffer size field), R1b
(send-vs-recv instance), R1c (announce/gate), and the one INFERRED link (object identity).

## What it does
Installs a passive inline detour at `NPL+0x3d134b` (the per-video-packet `call rax` into the encrypt
adapter). On each outgoing video packet it copies a handful of register/descriptor values into a ring
buffer; the loader reads them out-of-process and writes `recon2.log`. The live call is unaffected.

## Preconditions
- Two of the operator's OWN Wickr accounts (or one account on two devices). A real peer to call.
- WickrPro running and logged in.

## Steps (safe protocol — arm on the COLD path)
1. Start WickrPro, log in. **Do NOT start a call yet.**
2. Get the PID:
   ```bash
   powershell "Get-Process WickrPro | Select-Object Id,Responding"
   ```
   (If multiple, pick the main one — highest working set / the UI process that has NPL.dll loaded.)
3. Arm the hook while idle (no active call):
   ```bash
   E:\tmp\wickr\scratch\w3\lead\recon2_loader.exe <PID>
   ```
   Expect:
   ```
   [+] NPL.dll base = 0x....
   [+] splice @ 0x.... verified (48 8B 43 68 FF D0)
   [+] ring buffer @ ....
   [+] stub page @ .... (rel32 delta ....)
   [+] HOOK ARMED. Start a video call now. Ctrl+C to unhook.
   ```
   If it prints `splice bytes mismatch` it refuses to patch (wrong build / already hooked / stale
   int3) — stop and investigate; do not force.
4. **Now place a video call to your other account, camera ON.** The sender path runs → records stream
   to the console and to `recon2.log`. Let it run ~10–20 s of video.
5. `Ctrl+C` to unhook (restores the 6 original bytes) and stop.

## Reading the log
Each line:
```
#N tag=T sinkobj=0x.. cb=0x.. udata=0x.. frame=0x.. arg3=0x.. ptxt=0x.. len=L aflag=A gate=0xG pt=<24 plaintext bytes>
```
- **`pt` (plaintext bytes):** for the SEND/encrypt instance these are the freshly serialized outgoing
  AV protobuf → should begin `08 02 12 06 08 ..` (data packet) matching `n2fuzz` captures. This both
  confirms **object identity** (desc+0x18 really is the send-node's serialized buffer) and identifies
  the send instance for **R1b**.
- **`len`:** the `std::string` size at `frame+0x58` (R1a live confirmation). For real VP8 video it is
  the compressed packet size (a few hundred–few thousand bytes).
- **`cb`/`udata`/`sinkobj`:** distinguish instances. If two distinct `sinkobj`/`udata` appear, one is
  send (plaintext = valid outgoing protobuf) and one is receive.
- **`aflag`/`gate`/`tag`:** R1c — whether the announce flag is ever set and what the `arg3+0x90` gate
  byte looks like on real frames (informs whether B2 can rely on the built-in announce or must drive
  a tag=1 descriptor directly).

## Recovery
- Clean `Ctrl+C` or normal exit restores the splice automatically.
- If the loader is killed abruptly, the splice still points at the (still-mapped) stub → the client
  keeps working; just re-run and `Ctrl+C`, or restart WickrPro. The stub page is never freed while
  the splice is live, so an abrupt kill cannot crash the client (unlike the cdb stale-int3 hazard).
- To re-verify the byte is clean after a session:
  ```bash
  powershell "..."   # (or just re-run the loader; it refuses if the splice != 48 8B 43 68 FF D0)
  ```

## Scope / RoE
Operator's own machine, own accounts, own call. Log-only observation of the operator's own outgoing
media. No unwitting parties, no crafting, no production-server traffic beyond a normal call.
