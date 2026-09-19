# W17j — site isolation is off (shared V8 isolate), and ANGLE runs unsandboxed in a CFG-off process

**Date:** 2026-08-04 **Target:** AWS Wickr Desktop 6.72.20.0 (Windows x64)
**Method:** 21-agent workflow, five determinations each put through three adversarial lenses, 853 tool
calls. Several of its own agents' claims were withdrawn during the run — those retractions are recorded
in §6 because they matter more than the survivors.

**Headline: the two most consequential facts here are not renderer n-days, and a disclosure that leads
with "77 missing Chromium CVEs" and buries them is mis-prioritised.**

---

## 1. Site isolation is off — and it is not merely "same process", it is **one V8 isolate**

**MEASURED three times, by three independent harnesses, each with a working `--site-per-process`
positive control that produced 3–4 processes and split heaps from the same page graph.**

The decisive form is the heap, not the process count. With lopsided per-document ballast
(20 / 120 / 400 MB):

```
shipped default   : all three cross-origin documents report performance.memory.used = 561   (the SUM)
--site-per-process: they report 31 / 181 / 401                                               (their OWN)
```

**There is no boundary of any kind between the third-party frame's objects and the Wickr application
document's objects.**

**Traced to the product** (not measured in the live app): `WickrPro.exe` contains **zero** occurrences of
`site-per-process`, `isolate-origins`, `process-per-site` or `disable-site-isolation`, in ASCII or
UTF-16 — and it `qunsetenv()`s `QTWEBENGINE_CHROMIUM_FLAGS` at `0x1408d3dd8`, so nothing outside the
binary can switch isolation on either.

### What that overturns

> **"A V8 bug buys in-cage read/write and nothing more; you need a second bug to cross origins."**
> **That framing is wrong here.** The V8 sandbox is a per-process cage; it does not implement the
> same-origin policy and does not separate contexts inside one isolate. Same-origin policy for ordinary
> JS objects rests on the attacker being unable to obtain a reference — which is exactly what in-cage
> arbitrary R/W dissolves. A second bug is needed only to escape the **OS** sandbox, which is the less
> valuable half.

## 2. The best-evidenced memory-corruption target is not in the renderer at all

**CVE-2025-10502 (ANGLE, `TParseContext::addStructure`) was disassembled pre-fix**, and its trigger
shape compiles today on the shipped D3D11 backend. Two of the other three byte-level-confirmed pre-fix
CVEs are also ANGLE.

**And ANGLE runs in-process in `WickrPro.exe`** — measured two independent ways: GPU-service log lines
carrying the **browser** PID (`[18616:16196:] context_group.cc`), and the D3D user-mode driver plus
`d3dcompiler_47.dll` loading only in the host process, never the renderer. **No `--type=gpu-process`
exists anywhere, in the product or the harness.**

That host process has, verified from the PE headers this session:

```
WickrPro.exe            DllCharacteristics=0x8160  [no GUARD_CF]  GuardCFFunctionCount =      0
QtWebEngineProcess.exe  DllCharacteristics=0xc160  [GUARD_CF]     GuardCFFunctionCount =   1624
Qt6WebEngineCore.dll    DllCharacteristics=0x4160  [GUARD_CF]     GuardCFFunctionCount = 401422
NPL.dll                 DllCharacteristics=0x0160  [no GUARD_CF]  GuardCFFunctionCount =      0
```

**CFG is a process-wide property of the main image.** So Qt/Chromium's 401,422 guarded call sites are
**inert** in the very process that hosts the network stack, the ANGLE translator, the `wickrweb://`
handler and `NPL.dll` — a medium-integrity, unrestricted-token process with ACG off and no CET.

**But the gate is unresolved, and it is a real negative:** on the only host available (VMware SVGA 3D)
**WebGL is blocklisted by default**; every positive WebGL result in this engagement required
`--ignore-gpu-blocklist`. What *is* measured is that **Wickr does not gate it** — `webGLEnabled` occurs
exactly once in `WickrPro.exe`, in the SSO view. **"WebGL is reachable in the shipped configuration"
must not be asserted to AWS.** It needs a non-VMware host, or a read of Chromium 130's
`software_rendering_list.json` for the covered adapter set.

## 3. What a renderer compromise would actually yield

**Branch A — the measured delivery shape (an `<iframe>` inside the bridge-bearing document).** The
compromised renderer *is* the process hosting `qrc:/index.html` — the document carrying
`webChannel: channel` and `preloads.js`. In one address space and one V8 heap it reaches the app origin's
DOM and JS heap (**measured**), the app frame's already-bound WebChannel transport (**inference, marked
as such — nobody demonstrated it**), and the `wickrweb://` local API surface: `message/`, `convo/`,
`users/self`, `search`, `contacts/directory`, `filemanager/…`, `devices/active`,
`verification/fingerprints/…`, `myaccount/password`, `admin/controls`, `admin/inviteuser`,
`awscredentials`, `chimetoken`. **Not** code execution as the user — that still needs a sandbox escape,
which was not assessed.

**Branch B — the separate `configureWebApp` view** is a different BrowsingInstance and *does* get its own
renderer, holding no app DOM and no bound bridge. Payoff collapses to owning the weakest process in the
system. **Branch B is not the delivery shape.**

## 4. ★ The finding that outranks the n-day

**If the `wickrweb://` handler does not check the request initiator, ordinary script at the allow-listed
origin already reads the local data API cross-origin — with no memory corruption at all, no Chromium
bug, and no sandbox concern.** What is established: the platform *delivers* the request and the response
body without CORS, and the handler *cannot* be checking the initiator through any mechanism found.
**What the handler actually serves to a cross-origin initiator is UNDETERMINED** — and it is the single
highest-value thing left to trace (`WickrPro.exe`, anchored on the four imported
`QWebEngineUrlRequestJob` symbols; ~1 day).

## 5. Gates on the whole ladder

| | gate | status |
|---|---|---|
| G1 | attacker has script at the allow-listed origin | established (operator-demonstrated) |
| **G2** | **is `main.d4zeeqgazhley.amplifyapp.com` still AWS-owned, or dangling/re-registrable?** | **UNDETERMINED — cannot be checked from here.** An abandoned Amplify default-branch hostname hard-coded into shipped UI *and* CSP would be a config bug fixable in minutes, and it is the top rung of the entire ladder. **Hand to AWS as a direct question.** |
| G3 | the product loads that origin | measured (static): only `CheckSpeedModal`, **three user clicks**, torn down on close, attacker cannot self-trigger. An **injected** iframe needs no screen |
| G5 | isolation off ⇒ co-residency | measured in harness ×3; traced to the product |
| G6 | shared `v8::Isolate` | measured with an A/B control |
| G9–G11 | JIT on (all tiers, natural tier-up), wasm executes | measured. Wasm is refused under the app CSP (`script-src 'self' qrc://*`) and **free in the cross-origin child** |
| G13 | WebGL reachable in the shipped config | **UNDETERMINED — real negative** (see §2) |
| G17 | what `wickrweb://` serves a cross-origin initiator | **UNDETERMINED — highest value** |
| G18 | sandbox escape | **entirely unassessed** |

## 6. Explicitly not established, and self-retractions

**Not established:** no exploit exists and no exploitation work was done; **no renderer-process
memory-corruption bug is confirmed pre-fix at instruction level** — the single renderer candidate
(CVE-2025-10892, Maglev) rests on an *absent prerequisite string*, and 9+ V8 CVEs are structurally
undeterminable here because this is an `OFFICIAL_BUILD` V8 that discards `CHECK` text (`Check failed: %s.`
= 0 hits); Branch A's final hop is inference; live in-product co-residency was never measured; sandbox
escape unassessed; the CVE→component mapping was inherited, not re-derived.

**Withdrawn during the run** — recorded because the discipline matters: a SwiftShader run that "never
happened" (an argv-slot bug dropped the flag); "no GPU-related switch in `WickrPro.exe`" (**false** —
`useOpenGLES` ×3 drives `Qt::AA_UseOpenGLES` behind a `--angle` option); a renderer-command-line argument
(**void** — the switch is measurably not propagated to child processes, so its absence proves nothing);
a `base::Feature` default-table argument (orthogonal — there is no standalone `SitePerProcess` Feature);
and two isolation runs whose artifacts did not survive a server restart (the conclusion stands only
because two other agents replicated it independently on different ports with their own controls).

## 7. Priority for the disclosure

1. **Site isolation off + shared isolate** — architectural, measured, and it changes how every renderer
   bug in this product should be scored.
2. **The `wickrweb://` initiator question** — cheapest possible attack if it resolves badly, no
   memory corruption required.
3. **ANGLE unsandboxed in a CFG-off medium-IL process** — conditional on the WebGL gate.
4. **The dangling-hostname question** — free for AWS to answer, top rung of the ladder.
5. Only then the 77-CVE currency gap.
