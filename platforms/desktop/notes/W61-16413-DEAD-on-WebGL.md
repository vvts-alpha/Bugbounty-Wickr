# W61 — CVE-2026-16413 is NOT reachable from WebGL: the OOB is in the output binding path, which WebGL does not expose

Written 2026-08-07. Closes the 16413 evaluation from W60. **[M] measured** on Chrome 130.0.6723.0 headless (D3D11 via VMware SVGA 3D) unless otherwise marked.

---

## 0. Bottom line

| question | answer |
|---|---|
| Is CVE-2026-16413 reachable from WebGL? | **NO.** |
| Why not? | The OOB write is in `ProgramAliasedBindings::bindLocation` (the **output** binding path), which requires `glBindFragDataLocationEXT`. WebGL does not expose this API. The attribute binding path (`ProgramBindings::bindLocation`) that IS reachable via `bindAttribLocation` is a simple hashmap store with no array indexing — no OOB. |
| Did any test case crash? | **No.** 44 trials across mat4/mat3/mat2/mat2x4 × indices 0..999999, Chrome 130 headless. Zero crashes, zero context losses, zero error codes. Binding stored, never honoured. [M] |
| Is the VM GPU a factor? | **No.** The OOB is in ANGLE's C++ linker code (CPU-side), not GPU-driver-dependent. A non-crash on the VM is a non-crash everywhere. |

---

## 1. The two binding paths in ANGLE and why only one has an OOB

Fix CL **7952070** modifies two distinct classes:

### Path A — Attribute bindings (`ProgramBindings::bindLocation`, line 343)

```cpp
// PRE-FIX:
void ProgramBindings::bindLocation(GLuint index, const std::string &name)
{
    mBindings[name] = index;  // simple map insert, no bracket parsing
}
```

During `Program::link()`, the linker iterates `mBindings` and matches each key against the list of active attributes by **exact string match**. Active attributes for `in mat4 m;` are listed as `"m"` only (not `"m[0]"`, `"m[1]"`, etc. — column locations are implicit from the matrix type). So `mBindings["m[999999]"] = 5` simply doesn't match any active attribute and is silently skipped. **No array indexing, no OOB.**

Reachable from WebGL via: `gl.bindAttribLocation(program, 5, "m[999999]")` ✓

### Path B — Output bindings (`ProgramAliasedBindings::bindLocation`, line 378)

```cpp
// PRE-FIX:
void ProgramAliasedBindings::bindLocation(GLuint index, const std::string &name)
{
    mBindings[name] = ProgramBinding(index);
    // EXT_blend_func_extended spec alias generation follows —
    // this code PARSES the bracket, extracts the index, and uses it
    // to set locations for array elements → OOB with a huge index
}
```

The alias generation code strips `[N]` to find the base name, then iterates using N as an offset into the output location array. With `"FragData[999999]"` and an actual `out vec4 FragData[2]`, the index 999999 drives an OOB write.

Reachable from WebGL via: **NOTHING.** `glBindFragDataLocationEXT` requires `GL_EXT_blend_func_extended`, which is a desktop GL API. The WebGL extension `WEBGL_blend_func_extended` adds only blend constants (`SRC1_COLOR_WEBGL`, etc.), not `bindFragDataLocation`.

### Summary

| path | class | OOB? | WebGL API? |
|---|---|---|---|
| attribute bind | `ProgramBindings` | NO — hashmap, no aliasing | `bindAttribLocation` ✓ |
| output bind | `ProgramAliasedBindings` | **YES — alias generation uses bracket index** | `bindFragDataLocationEXT` ✗ |
| uniform bind | `ProgramAliasedBindings` | fix uses `AcceptIndexing` (no change) | `uniformBlockBinding` (uses index, not name) |

---

## 2. The matrix probe — confirming the negative [M]

W60's original reach probe tested only `in vec2 a[2]` (array vertex inputs), which ESSL rejects (`"cannot declare arrays of this qualifier"`). W61 extended this to **matrix vertex inputs** (`in mat4 m`), which are legal in ESSL3 and implicitly consume multiple locations.

### Results (Chrome 130.0.6723.0, headless, D3D11 via VMware SVGA 3D)

All four matrix types compiled successfully:

| matrix type | ESSL3 compile | baseline loc(m) |
|---|---|---|
| mat4 | OK | 0 |
| mat3 | OK | 0 |
| mat2 | OK | 0 |
| mat2x4 | OK | 0 |

For every type, `bindAttribLocation(p, 5, "m[N]")` with N ∈ {0, 1, 3, 7, 15, 255, 999, 9999, 99999, 999999}:
- `bindErr = NO_ERROR` (binding accepted)
- `link = true` (link succeeds)
- `loc(m) = 0` (base location unchanged)
- `loc("m[N]") = -1` (bracket name never resolves)
- `draw glErr = NO_ERROR`
- `ctxLost = false`
- No crash, no context loss

WebGL1 with `attribute mat4 m` produced identical results.

This confirms that `ProgramBindings` (the attribute path) does not use the bracket index during link resolution. The stored binding `"m[999999]" → 5` simply doesn't match any active attribute.

---

## 3. Why the VM GPU doesn't matter here

The OOB described in CVE-2026-16413 is in ANGLE's C++ linker (CPU-side Program.cpp), not in GPU driver code. The linker's binding resolution runs identically regardless of the underlying GPU — the VMware SVGA 3D driver is irrelevant for this code path. A no-crash result on the VM is definitive.

(This is distinct from W56's TransformFeedback11 UAF, where the crash is in the D3D11 runtime and IS GPU-driver-dependent.)

---

## 4. Disposition

**CVE-2026-16413 is DEAD for the WebGL attack surface.** Do not pursue further. The OOB requires `bindFragDataLocation`, which is desktop-GL-only.

The remaining ANGLE candidates that DO reach the unsandboxed WickrPro.exe process:
- **CVE-2026-14382** ($250k) — W41: "validation defeated, but NO OOB write." Follow-up needed.
- **CVE-2026-8554** — W60: confirmed live (silent miscompile). OOB weaponisation = follow-up.
- **W56 TransformFeedback11 UAF** — 8/8 crash on shipped DLL, real hardware. Memory corruption only, no control-flow hijack attempted.

Artifacts: `scratch/w61/probe-16413-matrix.html`, `scratch/w61/out_cr130.txt`, `scratch/w61/err_cr130.txt`.
