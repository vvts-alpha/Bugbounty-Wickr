# W15 CRUX — is there a *stack* overflow? A measured answer

**Question asked:** every memory-safety finding across fourteen waves writes to the heap. Does a
stack-based overflow exist anywhere in the Wickr-authored native code?

**Answer:** the observation is correct and it is not a coincidence — it is an architectural property
of the receive path, which this note measures. The most direct stack class is now **CLOSED by
arithmetic**. A residual population of **131 sites** survives and is characterised below; the largest
part of it is in a module that has never been searched at all.

Tools: `scratch/w15/gsrecon.py`, `stackscan2.py`, `stackclass2.py`. All measurements are against the
shipped binaries in `desktop/binaries/`.

---

## 1. Confirmation: every finding to date is a heap write

Re-read from the findings table, not from memory.

| finding | write destination | heap or stack |
|---|---|---|
| **F1** | libvpx `MODE_INFO` array, freed and re-entered | heap (UAF) |
| **F2** | `Musigy::AV::Parser` `kind==2` payload, `memset` count | heap |
| **F3** | allocator itself (~2 GiB commit per decoder context) | heap |
| **F4f** | `calloc(TNsot, 24)` in `opj_j2k_read_sod` | heap |
| **F6** | 2 KB inline buffer at `+0x1d0` of a `0x1320`-byte connection object | heap |

Zero stack writes. F2c and the F5 series are not memory-corruption findings.

## 2. Why — measured, not asserted

The receive idiom in `NPL.dll` is **"read into a fixed inline buffer inside a heap-allocated
connection object."** F6's own site is the proof, and it is also the trap that produced an error in
the first pass of this analysis:

```
0x180098559  mov  r8d, 0x800              ; the correct bound (sibling UDP path)
0x18009859e  lea  rdx, [rbp + 0x1d0]      ; rbp is the CONNECTION OBJECT, not a frame
0x1800985a3  call qword ptr [rip + ...]   ; recv
```

`rbp` here is an ordinary callee-saved register holding a heap pointer. Because the destination
buffer is an **inline member of a heap object**, every length bug on this path lands on the heap
*by construction*. That is the structural reason the wave record looks the way it does.

> **Method rule (new).** On MSVC x64, `lea rX,[rbp+d]` is a stack address **only** when the
> function's `UNWIND_INFO` sets `FrameRegister == 5` (`UWOP_SET_FPREG`). Treating every `[rbp+…]`
> as a frame slot inflated the first census of this note from 43 to 81 sites in NPL alone, and
> mis-classified F6's own heap buffer as a stack buffer. `stackscan2.py` reads the unwind info;
> `stackscan.py` (superseded) does not.

## 3. The defences that decide whether a stack overflow is worth anything

| module | ASLR / HighEntropyVA | DEP | CFG | `/GS` coverage |
|---|---|---|---|---|
| `NPL.dll` | yes | yes | no | **2047 / 13498 = 15.2 %** |
| `WickrPro.exe` | yes | yes | instrumented, inert (F4b) | — |
| `Sock5.dll` | yes | yes | no | — |
| `WickrMlsSdkCpp.dll` | yes | yes | no | **657 / 45929 = 1.4 %** |
| `crypto.dll` | yes | yes | no | **365 / 4177 = 8.7 %** |

`/GS` is per-function, as A6 recorded. The coverage figures are the share of `.pdata` functions that
call `__security_check_cookie` (`NPL 0x180111e70`, `MLS 0x180f12070`, `crypto 0x1800c1520`).

**Consequence.** With CFG inert (F4b) and CET absent, a `ret` is guarded by nothing but `/GS`. On the
84.8 % of NPL functions and the 98.6 % of MLS functions without a cookie, a return-address overwrite
faces **only ASLR**.

## 4. Census of true stack destinations

`memcpy` / `memmove` / `memset` / `strcpy` / socket reads whose destination register was produced by
`lea rX,[rsp+d]`, `mov rX,rsp`, or `lea rX,[rbp+d]` **in a function with a real frame pointer**.

| module | true stack dests | non-constant length | **and no `/GS`** | socket reads w/ stack dest |
|---|---|---|---|---|
| `NPL.dll` | 82 | 43 | **11** | 1 |
| `Sock5.dll` | 356 | 71 | **24** | 10 |
| `WickrMlsSdkCpp.dll` | 2264 | 90 | **69** | 0 |
| `WickrPro.exe` | 47 | 32 | **11** | 0 |
| `crypto.dll` | 46 | 28 | **16** | 0 |
| **total** | **2795** | **264** | **131** | **11** |

Two further classes a copy census is blind to, also counted (`stackclass2.py`, before the frame-pointer
correction, so these are upper bounds): variable-size stack allocation via `__chkstk` — NPL 131,
Sock5 79, MLS 6134, WickrPro 13 — and variable-**index** stores into a stack frame (F4f's shape, on
the stack) — NPL 1264, Sock5 420, MLS 1307, WickrPro 100. Neither has been triaged.

## 5. CLOSED: the direct class — a socket read onto the stack

This is the exact analogue of F6, and the one that would need no second bug. **It does not exist.**

All 11 stack-destination socket reads in the five Wickr-authored modules, with the frame-pointer
offset resolved from each prologue:

| site | module | primitive | destination | length | frame body | end of write | fits |
|---|---|---|---|---|---|---|---|
| `0x1800931c7` | NPL | `SSL_read` | `rsp+0x60` | `0x1000` | `0x1098` | `0x1060` | yes |
| `0x180176797` | Sock5 | `recvfrom` | `rsp+0x140` | `0x5dc` | `0x738` | `0x71c` | yes |
| `0x180176861` | Sock5 | `recvfrom` | `rsp+0x140` | `0x5dc` | `0x738` | `0x71c` | yes |
| `0x1801769b2` | Sock5 | `recvfrom` | `rsp+0xc0` | `0x5dc` | `0x6b8` | `0x69c` | yes |
| `0x180176a0f` | Sock5 | `recvfrom` | `rsp+0xc0` | `0x5dc` | `0x6b8` | `0x69c` | yes |
| `0x180182ee1` | Sock5 | `recv` | `rsp+0x20` | `0x400` | `0x438` | `0x420` | yes |
| `0x18023e3d8` | Sock5 | `recvfrom` | `rbp+0x10` = `rsp+0x40` | `0x2328` | `0x2f78` | `0x2368` | yes |
| `0x1803369f7` | Sock5 | `recvfrom` | `rbp+0x30` = `rsp+0x70` | `0x200` | `0x7d0` | `0x270` | yes |
| `0x180337238` | Sock5 | `recvfrom` | `rbp+0x30` = `rsp+0x60` | `0x200` | `0x518` | `0x260` | yes |
| `0x180377ece` | Sock5 | `recv` | `rbp+0x30` = `rsp+0x50` | `0x64` | `0x3f8` | `0xb4` | yes |
| `0x1801a94c5` | Sock5 | `recvfrom` | `rsp+0x30` | see below | `0x160` | `0x31` | yes |

The last is the only one whose length was not a literal immediate: `lea r8d,[r9-1]` after
`mov r9d, 2` — a **one-byte** `MSG_PEEK`, in a function that does carry a cookie
(`0x1801a942f  xor rax, rsp`).

**Every constant fits inside its own prologue allocation, with margin.** The class is closed.

## 6. CLOSED: the one candidate whose length came straight from a struct field

`NPL 0x1800a65a0` looked like the best single result in the raw census: a `memcpy` into a 128-byte
zeroed stack array, **no `/GS`**, with the count loaded directly out of a structure —

```
0x1800a65b2  mov   r8d, dword ptr [rdx + 0x80]   ; count <- a field
0x1800a65c3  lea   rcx, [rsp + 0x20]             ; 128-byte stack array
0x1800a65f8  call  0x180112e1e                   ; -> IAT 0x1804249a8 = memcpy
```

Return address sits `0x98` bytes from the destination and there is no cookie. Resolved by RTTI:

```
vtable 0x18042e138, COL 0x1804d66e8
.?AV?$Command2@VConnectionImpl@Net@NPL@Musigy@@P81234@EAAX_NVSocketAddress@234@@Z_NV5234@@Internal@Musigy@@
```

so the struct is **`Musigy::NPL::Net::SocketAddress`** — `{ u8 storage[0x80]; u32 len; u8 flag; }`,
i.e. a `sockaddr_storage` plus its `socklen`. The `memcpy` is the copy performed by a deferred-command
thunk (slot 5 of a `Command2<ConnectionImpl, void(bool, SocketAddress)>`) that captures the address by
value before invoking a bound member function.

A census of every `SocketAddress`-shaped writer of the length field — a function storing a dword at
`+0x80` *and* a byte at `+0x84` — found **65 stores, 6 immediate (all `0`) and 59 register-sourced**.
Provenance traced for the 12 in the relay band `0x18009b2e0 … 0x18009e9da`, which is where wire
parsing happens: every one is either a copy from another `SocketAddress`
(`mov r8d, dword ptr [rX + 0x80]`, five sites) or a local (`mov ecx, dword ptr [rbp + 0x50]`, three
sites). **No writer takes the length from parsed network bytes.** Not exhaustive — 47 register-sourced
stores outside the relay band are untraced — but the relay band is the peer-facing one.

## 7. What survives, and what it would be worth

**131 sites** have a non-constant length, a genuine stack destination, and no cookie. None has been
shown reachable from peer data; none has been shown unreachable either. Ranked by what the module is
exposed to:

1. **`WickrMlsSdkCpp.dll` — 69 sites, and `/GS` coverage of 1.4 %.** 2,264 true stack destinations,
   8,474 `memcpy` calls, 6,134 variable-size stack allocations. This module has **never been
   searched** in fifteen waves. Unlike F6 it is not call-gated — it is on the message-envelope path,
   so its trigger condition is "receive a message", not "be in a TCP-transport call".
2. `Sock5.dll` — 24 sites. Carries mbedTLS 2.1.5 and SQLite 3.19.2 (F4e) and is loaded
   unconditionally.
3. `crypto.dll` — 16 sites, `/GS` at 8.7 %.
4. `NPL.dll` — 11 sites. Most-searched module; lowest expected yield.
5. `WickrPro.exe` — 11 sites.

**Why a stack overflow would outrank everything found so far.** It removes the link that has blocked
this engagement since W6: no heap grooming, no adjacency lattice, no 52-candidate clean-slot search.
The saved return address sits at a *fixed, known* offset from the buffer, and with CFG inert and no
CET nothing checks the `ret`. On these 131 sites there is no cookie either.

**What it would still not remove:** ASLR. A return-address overwrite needs an address to write, so it
inherits the same information-leak dependency as every other route — see `PROMPT-info-leak-hunt.md`.
F6's §6.11 disclosure is a candidate supply, so the two are not independent.

**No instruction-pointer control is claimed here, and nothing in this note is a finding.** Sections 5
and 6 are negatives; section 7 is an unsearched population with a measured size.
