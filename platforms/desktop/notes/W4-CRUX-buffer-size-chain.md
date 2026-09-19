# W4 CRUX — peer-declared `Buffer.size` reaches `vpx_codec_decode` unchecked

Disassembled by the lead, personally, at every link, per §0 rule 1 of the Wave 3 brief. This file
records **only what the bytes say**. Reachability has one unread leg — stated explicitly in §5.

Target: `E:\tmp\wickr\desktop\binaries\NPL.dll`, ImageBase `0x180000000`, AWS Wickr 6.72.20.0.

Two Wave 4 recon dimensions (`fmt-blob`, `recv-wire`) converged on this independently, from opposite
directions (one reading the serializer for the grammar, one mapping wire fields to consumers). That
convergence is what prompted the lead to read it directly rather than take either at face value.

---

## 1. CONFIRMED — the length comes from the peer's protobuf, the pointer comes from the transport

`Musigy::AV::Parser` kind==2 handler, `NPL 0x18011ef70` (extent `0x11ef70-0x11f897` from `.pdata`).

```
0x18011efac: f6421001     test  byte ptr [rdx+0x10], 1   ; has-bits: is PacketHeader.buffer present?
0x18011efb0: 0f84f2000000 je    0x18011f0a8              ;   absent -> the PLANE branch (see §2)
0x18011efb6: 488b4230     mov   rax, qword ptr [rdx+0x30]; the Buffer sub-message
0x18011efba: 4c8d35971b4100 lea r14, [rip+0x411b97]      ; = 0x180530b58, default instance
0x18011efc1: 4885c0       test  rax, rax
0x18011efc4: 4c0f45f0     cmovne r14, rax                ; classic protobuf _internal_buffer()
...
0x18011efe7: 4489642420   mov   dword ptr [rsp+0x20], r12d ; arg5 = 0
0x18011efec: 4533c9       xor   r9d, r9d                   ; arg4 = 0
0x18011efef: 458b4618     mov   r8d, dword ptr [r14+0x18]  ; arg3 = Buffer.size   <== PEER, varint32
0x18011eff3: 488b5610     mov   rdx, qword ptr [rsi+0x10]  ; arg2 = real payload pointer
0x18011eff7: 498bcf       mov   rcx, r15
0x18011effa: e8a16e0100   call  0x180135ea0                ; Frame ctor
```

`r8d` is read out of the **protobuf message**; `rdx` is read out of the **received packet object**.
Between the two loads and the call there is no `cmp`, no clamp, no `min`.

## 2. CONFIRMED — the sibling branch of the SAME function does perform exactly that check

If `PacketHeader.buffer` is absent, control goes to the plane branch at `0x18011f0a8`. It first
precomputes, for each of up to four received buffers, the real end address `base + w*h`:

```
0x18011f0c4: mov   rdx, qword ptr [r8+0x40]   ; buffer base
0x18011f0d2: mov   eax, dword ptr [r8+0x70]
0x18011f0d6: imul  eax, dword ptr [r8+0x60]   ; real w*h of the RECEIVED buffer
0x18011f0de: add   rcx, rdx
0x18011f0e1: mov   qword ptr [rbp-0x78], rcx  ; end[0]   (end[1..3] at -0x70, -0x68, -0x60)
```

then, per peer-declared plane, bounds-checks the declared extent against that end and **NULLs the
plane pointer if it does not fit**:

```
0x18011f196: mov   eax,  dword ptr [rcx+0x18]      ; peer plane field a
0x18011f1a0: mov   r10d, dword ptr [rcx+0x1c]      ; peer plane field b
0x18011f1ac: imul  r10d, eax                       ; declared extent
0x18011f1bd: add   r10, rdx                        ; base + declared extent
0x18011f1c0: cmp   r10, qword ptr [rbp+r14*8-0x78] ; <== vs the REAL buffer end
0x18011f1c5: jbe   0x18011f1cf                     ; fits -> keep the pointer
0x18011f1c7: mov   rdx, r12                        ; does NOT fit -> null it out
0x18011f1ca: mov   rcx, r12
```

**This is the load-bearing observation.** The validation is not "elsewhere by design" — it is in the
same function, twenty instructions away, on the branch that happens not to be taken for encoded media.

## 3. CONFIRMED — the Frame constructor neither copies nor clamps

`0x180135ea0`, args `(rcx=this, rdx=data, r8d=size, r9=?, [rsp+0x80]=?)`:

```
0x180135eb4: mov    r14d, r8d
0x180135ebe: test   r8d, r8d
0x180135ec1: cmovne rbp, rdx          ; rbp = data pointer iff size != 0
0x180135ed6: mov    eax, 0xd0         ; base object size
0x180135edb: test   rbp, rbp
0x180135ede: jne    0x180135eec       ; pointer supplied -> DO NOT add size to the allocation
0x180135ee0: test   r8d, r8d
0x180135ee3: je     0x180135eec
0x180135ee5: lea    eax, [r14+0xdf]   ; only the no-pointer case allocates size bytes inline
```

With a pointer supplied — which is our case — the allocation stays `0xd0` and the Frame merely stores
the `(pointer, length)` pair. No copy happens here, so nothing bounds it here either.

## 4. CONFIRMED — both fields go straight into `vpx_codec_decode`

`Musigy::AV::VpxDecoder::process`, `NPL 0x180144520`:

```
0x180144ba2: 488b5c2440   mov  rbx, qword ptr [rsp+0x40]   ; the Frame
0x180144ba7: 448b4318     mov  r8d, dword ptr [rbx+0x18]   ; arg3 data_sz  <== the peer's Buffer.size
0x180144bab: 488b5310     mov  rdx, qword ptr [rbx+0x10]   ; arg2 data     <== the real payload ptr
0x180144baf: 488d4f10     lea  rcx, [rdi+0x10]             ; arg1 ctx
0x180144bb3: e8088a0300   call 0x18017d5c0                 ; vpx_codec_decode
```

with `r9d = 0` (deadline) and `[rsp+0x20] = 0` (user_priv). Frame`+0x10`/`+0x18` are precisely the
pointer/length pair written by the ctor in §3. The callee `0x18017d5c0` sits inside the identified
libvpx public-API cluster (`vpx_codec_dec_init_ver` `0x18017d4a0`, vp8_dx iface entries
`0x18017d660`..`0x18017dff0`).

## 5. What is NOT yet established — read this before quoting the finding

The **defect** above is CONFIRMED by disassembly at every link. **Peer-reachability is not yet
CONFIRMED**, because one leg is unread:

- ~~Where the *actual* received payload length is carried on the packet object (`rsi`), and whether any
  node between `Parser` and `VpxDecoder` compares it.~~ **CLOSED in Wave 4.** Nothing between
  `CryptProxy` and the codec re-checks or rewrites the length — `PacketMonitor::onPacket` reads it for
  statistics only. And the `CryptProxy::onPacket 0x18011b637` `memcpy` that this section flagged as the
  suspected consumer **is NOT one**: it sits behind `cmp dword ptr [rsi+0x118], 0 / jle`, which is false
  on both receive scenes. The real consumer is the WickrPro decrypt callback — see §5b.
- Whether a failed decrypt drops the packet before `VpxDecoder`. For a legitimate call peer this is
  not a barrier, but it changes which consumer is the practical primitive.
- The backing allocation of the received payload (exactly-sized vs fixed MTU-class pool slab), which
  determines how far an over-read runs before it leaves mapped memory.

Until the `CryptProxy` leg is read, the honest label is: **defect CONFIRMED, reachability STRONGLY
SUPPORTED but one link INFERRED.** Do not upgrade it in any artifact before that instruction is
disassembled — this engagement has already gotten the reachability question wrong twice by reasoning
forward along a plausible chain instead of reading the one instruction that decides it.

## 5b. UPDATE — the unread leg is now read, and the primitive is worse than a read

The Wave 4 verifier escalated this from OOB read to OOB **write**, and the lead re-read the escalation
directly. It holds. The write is not in NPL.dll at all — it is in **WickrPro's decrypt callback**:

```
0x14013f3f2: 448b442430   mov  r8d, dword ptr [rsp+0x30]   ; n   = PEER-DECLARED size
0x14013f3f7: 488b542438   mov  rdx, qword ptr [rsp+0x38]   ; src = the REAL (shorter) payload
0x14013f401: ff15914cc100 call [rip+0xc14c91]              ; QByteArray(const char*, qsizetype)
                                                            ;   <== OOB READ (deep-copies n bytes)
0x14013f44e: e89d5c9e00   call 0x140b250f0                 ; decrypt
0x14013f458: ff15a24cc100 call [rip+0xc14ca2]              ; QByteArray::length()
0x14013f45e: 4885c0       test rax, rax
0x14013f461: 7e2b         jle  0x14013f48e                 ; empty plaintext -> memset path
0x14013f482: 488b4c2438   mov  rcx, qword ptr [rsp+0x38]   ; dst = the REAL payload
0x14013f487: e8d1995d00   call 0x140718e5d                 ; memcpy(real, plaintext, plaintext_len)
0x14013f48e: 448b442430   mov  r8d, dword ptr [rsp+0x30]   ; n   = PEER-DECLARED size
0x14013f493: 33d2         xor  edx, edx                    ; c   = 0
0x14013f495: 488b4c2438   mov  rcx, qword ptr [rsp+0x38]   ; dst = the REAL payload
0x14013f49a: e8e8995d00   call 0x140718e87                 ; memset  <== OOB WRITE
```

Thunk identity resolved through WickrPro's IAT by the lead, not taken on trust:

```
0x140718e5d -> jmp [0x140d57fe8] -> ('VCRUNTIME140.dll', 'memcpy')
0x140718e87 -> jmp [0x140d58030] -> ('VCRUNTIME140.dll', 'memset')
```

So a peer-chosen length drives a zero-fill past the end of the received payload allocation. CONFIRMED.

## 5c. Attacker position — narrower than "any network attacker"

An earlier lead message speculated that "header parsed before decrypt, not AAD-authenticated" widens the
attacker position to anyone who can inject a packet. **That speculation is wrong and is retracted.**
NPL.dll carries DTLS:

```
0x429bb8 'DTLS handshake failed'   0x5284c2 'DTLSv1_2_server_method'   0x5284dc 'DTLSv1_2_client_method'
0x42c288 'dtls-in-tls'
```
and **no SRTP at all** (`SRTP` and `srtp_*` regexes return zero matches). With the media riding inside
DTLS, an off-path attacker cannot inject.

That leaves two positions, and the second is the one that matters for an E2E product:
- **a legitimate call participant** — CONFIRMED reachable; they author the protobuf directly;
- **the SFU / relay** — INFERRED. In an SFU topology DTLS terminates at the server, so the server sees
  and can rewrite `PacketHeader` while the E2E `CryptProxy` layer never authenticates it. If that holds,
  the server can drive a heap OOB write in every participant, which breaks the property an E2E messenger
  is sold on. **NOT yet confirmed** — nobody has established where DTLS terminates. That is the single
  highest-value remaining question on this finding.

## 6. Provenance

`fmt-blob` labelled this CONFIRMED / peer=YES; `recv-wire` labelled it INFERRED / peer=YES and added
that `PacketHeader` field 9 is one of the fields with **no clamp at all** (only field 1 `kind` is
range-checked to 1/2/3, and plane count is capped at 4). Both agents' verifiers were still in flight
when the Wave 4 workflow process exited; the resumed run is what settles §5.
