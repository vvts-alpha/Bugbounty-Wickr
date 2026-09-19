# W4 CRUX — the AV media decrypt IS AES-256-GCM, tag-verified and checked

Opened by `W4-COMPLETENESS-CRITIC.md` §C2 as the cheapest high-value unknown in the engagement:
*"whether `0x140b250f0 -> 0x140b24bc0` is an AEAD. If it is unauthenticated, the success branch at
`0x14013f487` memcpy's roughly `declared` bytes of attacker-influenced plaintext instead of zeros"*
(`verdict_buffer-size-substitution.json`, never answered in Wave 4).

**Disassembled by the lead at every link, per §0 rule 1.** Target
`E:\tmp\wickr\desktop\binaries\WickrPro.exe`, ImageBase `0x140000000`, AWS Wickr 6.72.20.0.

---

## Verdict

**AES-256-GCM. Tag verified by `EVP_DecryptFinal_ex`, and its return value IS checked.**
F4-1's characterisation in `FINAL-REPORT-wave4.md` — *"the decrypt yields nothing and N zero bytes are
written"* — is **CORRECT**, and now it is evidenced rather than assumed.

The brief's stronger phrasing (*"inflating the length makes GCM authentication fail **by
construction**"*) is also correct, and §4 below gives the reason nobody had stated: **the tag sits at a
fixed offset inside the real payload, so inflation cannot damage it — it extends the authenticated
ciphertext instead.**

Two things change as a result:
* F4-1 is **not** understated. My §C2 worry is withdrawn. The *process* point stands — this was being
  propagated as fact with no one having read it — but the fact turned out to be right.
* The engagement gains a **new, exact explanation of `cryptoPadding == 29`**, which retroactively turns
  the "useless" 65/65 benign measurement into decisive evidence for a different question (§5).

---

## 1. CONFIRMED — the callback and what it hands to the crypto layer

`WickrPro!0x14013f390` (decrypt callback; bound via the `"decryptCallback"` property, thunk
`0x140147150`). Full function is 337 bytes; the load-bearing part:

```
0x14013f3df: call [0x140d53928]      ; NPL!NPLAVPacketGetBuffer(pkt, 0, &ptr, &n)
                                     ;   n   -> [rsp+0x30]  = PEER-DECLARED Buffer.size
                                     ;   ptr -> [rsp+0x38]  = the REAL payload
0x14013f3ec: call [0x140d53930]      ; NPL!NPLAVPacketGetDescriptor(pkt, rbp-0x40)
0x14013f3f2: mov  r8d, [rsp+0x30]    ; n
0x14013f3f7: mov  rdx, [rsp+0x38]    ; ptr
0x14013f401: call [0x140d54098]      ; QByteArray(const char*, qsizetype)   <== OOB READ, n bytes
...
0x14013f438: mov  ecx, dword [rbp+0x1c]  ; = descriptor+0x5c -> arg5 (sequence).  See §6
0x14013f44e: call 0x140b250f0            ; decrypt(&out, this, ct, streamId, seq)
0x14013f458: call [0x140d54100]          ; QByteArray::length()
0x14013f461: jle  0x14013f48e            ; empty plaintext -> memset arm
```

IAT identities resolved, not assumed: `0x140d53928` → `NPL!NPLAVPacketGetBuffer`,
`0x140d53930` → `NPL!NPLAVPacketGetDescriptor`, `0x140d54098` → `Qt6Core!QByteArray(const char*,
qsizetype)`, `0x140d54100` → `Qt6Core!QByteArray::length`.

`0x140b250f0` is a thin adaptor (copy-constructs the QString/QByteArray args) that passes **arg6 = 1**
(`mov dword [rsp+0x28], 1` @ `0x140b2512f`) and calls `0x140b24bc0`.

## 2. CONFIRMED — the dispatcher, and that every failure exit yields an EMPTY QByteArray

`0x140b24bc0` resolves a per-stream crypto context through a byte-indexed table
(`movzx ecx, byte [rax+rdx]` @ `0x140b24c2e`; `cmp cl, 0xff / je fail` = not-found sentinel;
`shl rcx,5` → 32-byte stride → `mov rbx,[rax]` @ `0x140b24c59`). Then, because arg6 != 0:

```
0x140b24c7b: cmp dword [rsp+0xa8], 0     ; arg6, = 1 from 0x140b250f0
0x140b24c83: jne 0x140b24cf9             ; <== the arm this path takes
0x140b24d04: call 0x140cb1190            ; parse the wire blob                (§3)
0x140b24d3b: call 0x140cb6800            ; ratchet gate + dispatch to decrypt (§4)
```

**Every** failure exit in this function — bad context, parse failure, decrypt failure — runs the same
three instructions:

```
0x140b24d16: xor edx, edx
0x140b24d18: mov r8, 0xffffffffffffffff
0x140b24d22: call [rip+0x22f370]         ; QByteArray(nullptr, -1)  = the DEFAULT (empty) QByteArray
```

So a failed decrypt reaches `0x14013f458 QByteArray::length()` as **0**, `jle` is taken, and control
lands on `0x14013f49a memset(realptr, 0, n)`. **The memset arm is the decrypt-failure arm. CONFIRMED.**

## 3. CONFIRMED — the wire framing, and that the algorithm byte is peer-supplied but pinned

`0x140cb1190` parses the encrypted blob:

```
0x140cb11b2: mov   rax, [rcx+8]              ; blob data
0x140cb11b6: movzx ecx, byte ptr [rax]       ; <== ALGORITHM SELECTOR = first plaintext wire byte
0x140cb11b9: test  ecx, ecx / je 0x140cb11cb ;   0 -> params 0x1432e25a0
0x140cb11bd: cmp   ecx, 1  / jne fail        ;   1 -> params 0x1432e25a8 ; anything else -> NULL
0x140cb11d2: movzx r8d, byte [rbx+5]         ; ivlen
0x140cb11d7: movzx eax, byte [rbx+6]         ; taglen
0x140cb11db: lea   r12, [r8+1]
0x140cb11df: add   r12, rax                  ; overhead = 1 + ivlen + taglen
0x140cb11e2: cmp   qword [r14], r12
0x140cb11e5: jb    fail                      ; blob shorter than the overhead -> reject
```

then slices, in this order — `slice(blob, off, len)` = `0x1408d3430`:

| field | offset | length |
|---|---|---|
| algorithm | 0 | 1 |
| IV | 1 | `ivlen` |
| **TAG** | `1+ivlen` | `taglen` (only if `has_tag`) |
| ciphertext | `1+ivlen+taglen` | rest |

The two parameter tables, read out of the image:

```
0x1432e25a0:  00 00 00 00 20 0c 10 01   algo 0  keylen 32  ivlen 12  taglen 16  has_tag 1
0x1432e25a8:  01 00 00 00 20 10 00 00   algo 1  keylen 32  ivlen 16  taglen  0  has_tag 0
```

**algo 0 overhead = 1 + 12 + 16 = 29.  algo 1 overhead = 1 + 16 + 0 = 17.**

The algorithm byte is off the wire and is *not* covered by the tag — but a downgrade is blocked one
level down, at `0x140cb8a2f` (§4): the parsed algorithm must equal the algorithm in the **key object**.
A peer flipping the byte to `1` gets a mismatch → NULL → the memset arm, not a CTR decrypt.

## 4. CONFIRMED — the primitive, and that the tag check is not ignored

`0x140cb6800` (reached because arg6 != 0) requires `[ctx+0xd0] == 1`, gates on the sequence (§6), then:

```
0x140cb84d: mov rax, qword ptr [rbx+0x28]
0x140cb85a: call rax
```

`[ctx+0x28]` is installed by the provider constructor `0x140cb1410`:

```
0x140cb145f: lea rax, [rip+0x754a]      ; = 0x140cb89b0
0x140cb1466: mov qword ptr [rbx+0x28], rax
```

`0x140cb89b0` is the primitive:

```
0x140cb8a06: mov   ecx, dword ptr [rcx]     ; parsed algorithm
0x140cb8a0a: je    0x140cb8a1c              ;   0 ->
0x140cb8a1c: call  0x140cbc5b9              ;        EVP_aes_256_gcm
0x140cb8a15: call  0x140cbc595              ;   1 -> EVP_aes_256_ctr
0x140cb8a2f: cmp   dword ptr [rbp], eax     ; key object's algorithm must MATCH the wire's
0x140cb8a32: jne   fail                     ;   <== no peer downgrade
0x140cb8ac4: mov   edx, 9                   ; EVP_CTRL_AEAD_SET_IVLEN
0x140cb8acc: call  0x140cbc5b3              ; EVP_CIPHER_CTX_ctrl
0x140cb8b0e: mov   edx, 0x11                ; EVP_CTRL_AEAD_SET_TAG
0x140cb8b1f: call  0x140cbc5b3              ; EVP_CIPHER_CTX_ctrl   (tag from parsed blob, [rbx+0x18])
0x140cb8b89: call  0x140ca8c46              ; EVP_DecryptUpdate(ct)
0x140cb8bb6: call  0x140cbc5ad              ; EVP_DecryptFinal_ex   <== GCM TAG VERIFICATION
0x140cb8bbb: cmp   eax, 1
0x140cb8bbe: jne   0x140cb8bdc              ; <== CHECKED. failure frees the output buffer and
0x140cb8bfd: xor   eax, eax                 ;     returns 0 -> §2 -> empty QByteArray -> memset
```

Both `EVP_CTRL_*` calls are gated on `cmp dword [rbx], 0 / jne skip`, i.e. they run **only** for
algo 0 — exactly right for GCM-vs-CTR.

Import thunks resolved through the IAT rather than assumed: `0x140cbc5b9` → `crypto.dll!EVP_aes_256_gcm`,
`0x140cbc595` → `EVP_aes_256_ctr`, `0x140cbc5b3` → `EVP_CIPHER_CTX_ctrl`,
`0x140cbc5ad` → `EVP_DecryptFinal_ex`, `0x140ca8c46` → `EVP_DecryptUpdate`.

### Why an inflated length necessarily fails authentication

This is the part nobody had stated, and it is what makes "by construction" literally true:

**The tag is at bytes `[13, 29)` of the blob — inside the payload the attacker genuinely sent.**
Inflating `Buffer.size` does not touch the algorithm byte, the IV, or the tag; it appends adjacent heap
bytes to the **ciphertext**, which GCM authenticates. So the attacker cannot avoid the mismatch even in
principle, and cannot repair it, because the appended bytes are heap contents they do not control.

⇒ **The OOB write is the guaranteed outcome of the attack, not a probabilistic one.** And it is a
zero-fill: the `memcpy` arm at `0x14013f487` is unreachable under inflation.

## 5. The `cryptoPadding == 29` measurement was decisive after all — for a different question

`NEXT-HUNT-BRIEF.md` §0.4 correctly ruled the 65/65 benign capture invalid *for the question it was
asked* (peer-controlled vs. real length — a benign sender produces the same observation either way).

But `29` is **uniquely** algo 0's overhead: `1 + 12 + 16`. Algo 1 would have shown `17`. So the same
measurement is a clean discriminator for *which cipher suite the AV media path is provisioned with* —
a question nobody had posed to it. The live path runs **AES-256-GCM**, confirmed two independent ways
(the parameter table plus the measured framing overhead).

Worth keeping as a method note: a measurement that cannot discriminate between the hypotheses you had
may still be decisive for a hypothesis you had not formed. Do not discard the data with the inference.

## 6. NEW LEAD (not a finding) — a peer-supplied 32-bit sequence drives a ratchet **loop**, before decryption

Noticed while reading `0x140cb6800`; recorded because it is on the same pre-decrypt, unauthenticated
boundary as F4-1 and nobody has looked at the sequence field.

```
0x140cb6825: cmp  r9, qword ptr [rcx+0xc8]   ; seq must be strictly greater than the last seen
0x140cb682c: jbe  fail                       ;   (replay protection)
0x140cb683a: call 0x140cb6480                ; advance the key ratchet
```

`0x140cb6480` computes `cur = ctx->0xc8 / epoch`, `new = seq / epoch` where
`epoch = dword [ctx->0xb8 + 0x18]` (`div r8` @ `0x140cb64b5`/`0x140cb64c0`), and then advances
**one epoch per loop iteration**:

```
0x140cb64f0: <loop head — two 0x20-byte derivations (0x140cb0e60, 0x140cb61b0) plus allocations>
0x140cb65b7: inc rsi
0x140cb65c1: cmp rsi, r14
0x140cb65c4: jne 0x140cb64f0
```

The sequence is 32-bit and comes from the packet descriptor:
`0x14013f438 mov ecx, dword ptr [rbp+0x1c]` = **descriptor + 0x5c**, filled by
`NPLAVPacketGetDescriptor`.

* **CONFIRMED:** the loop count is `(seq/epoch) - (last_seq/epoch)`, unbounded above by anything in
  this function, and it runs **before** any authentication of anything.
* **INFERRED:** that descriptor+0x5c is directly peer-settable. `recon_NPL_dll_bespoke_Serializer…json`
  records `PacketHeader` metadata int32s at `+0x40/+0x44/+0x48/+0x4c/+0x54/+0x58/+0x5c/+0x60/+0x98`
  as unclamped with most consumers unfollowed, and `verdict_wire-grammar…json` mentions "the `+0x58`
  field that lands in `Packet+0x98`". **I did not trace descriptor+0x5c to a protobuf field number.**

If the inference holds, one packet declaring a large sequence forces up to `2^32 / epoch` derivations
in the media thread, and — because the gate is `jbe` — **permanently wedges that stream**, since every
subsequent legitimate packet now carries a lower sequence and is dropped. Both effects survive the
fact that the packet's own decrypt then fails.

**To settle, cheaply:** (a) trace descriptor+0x5c back through `NPLAVPacketGetDescriptor` to the
`PacketHeader` field number; (b) read `epoch` = `dword [keyobj+0x18]` at runtime or find its
initialiser. Neither needs a live call.

---

## Provenance

Every address above was disassembled from the shipped `WickrPro.exe` by the lead in this pass; the two
parameter tables were read out of the mapped image; every import identity was resolved through the IAT
rather than inferred from context. No subagent contributed to this file.
