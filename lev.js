"use strict";
/* ===== Levelling module: fly levelling (3-wire) + two peg test. Same maths as the template sheets. ===== */
const LEVP={
  lev:{key:"lev-v1",home:"lev",name:"Fly Levelling",lim:{wire:0.003,chk:"tb",lo:0.6,hi:3.0,warn:2.0,balance:1,k:24,peg:10000}},   // linked to the traverse
  fly:{key:"fly-v1",home:"fly",name:"Unlinked Fly Levelling",lim:{wire:0.003,chk:"mean",lo:0.6,hi:2.0,warn:null,balance:1,k:24,peg:10000}},
  bloop:{key:"bloop-v1",home:"bloop",name:"Bridge Loop Levelling",lim:{wire:0.003,chk:"mean",lo:0.6,hi:3.0,warn:null,balance:1,k:24,peg:10000}}, // closed loop through the bridge stations (e.g. A-C-G-E-A); K = sum of the legs
  bfly:{key:"bfly-v1",home:"bfly",name:"Bridge Fly Levelling",lim:{wire:0.003,chk:"mean",lo:0.6,hi:2.0,warn:null,balance:1,k:24,peg:10000}}, // BM -> bridge axis A, same norms as fly
  mlev:{key:"mlev-v1",home:"mlev",name:"Minor Loop Levelling",mid:true,book:"rf",lim:{wire:0.003,chk:"tb",lo:0.6,hi:3.0,warn:null,balance:1,k:24,peg:10000}}}; // middle hair only, 0.6-3.0 m, loop through the minor stations; camp norms: 0.6-2 m, |mean-mid| <= 3 mm
let LK="lev",LP=LEVP.lev,LIM_LEV=LP.lim,LEV;
// one two peg test for the whole camp, shared by every levelling job (key peg-v1; first filled job test is migrated)
let PEG=null;
function pegBlank(){return{d:"",n:"",pos:"",mid:{a:[],b:[]},near:{a:[],b:[]}}}
function pegLoad(){if(PEG)return PEG;try{PEG=JSON.parse(localStorage.getItem("peg-v1"))}catch(e){PEG=null}
  if(!PEG||!PEG.mid){PEG=null;for(const k of Object.keys(LEVP)){try{const o=JSON.parse(localStorage.getItem(LEVP[k].key));const q=o&&o.peg;
      if(q&&(q.d||["mid","near"].some(g=>q[g]&&["a","b"].some(s=>(q[g][s]||[]).some(v=>v))))){PEG=q;break}}catch(e){}}
    if(!PEG)PEG=pegBlank();try{localStorage.setItem("peg-v1",JSON.stringify(PEG))}catch(e){}}
  return PEG}
function useLev(k){LK=k;LP=LEVP[k];LIM_LEV=LP.lim;try{LEV=JSON.parse(localStorage.getItem(LP.key))}catch(e){LEV=null}
  if(!LEV||!Array.isArray(LEV.lines))LEV={lines:[],peg:{d:"",mid:{a:[],b:[]},near:{a:[],b:[]}}};LEV.peg=pegLoad();pairAuto()}
function allLev(fn){const prev=LK,keep=LEV,out={};for(const k of Object.keys(LEVP)){useLev(k);out[k]=fn(k)}LK=prev;LP=LEVP[prev];LIM_LEV=LP.lim;LEV=keep;return out}
const isMid=L=>LP.mid||L.mode==="mid";
const brLev=()=>LK==="bfly"||LK==="bloop";
function legMap(){const m={};if(LK==="bloop"){try{Object.assign(m,brPairs())}catch(e){}return m}try{allTrav(()=>{for(const l of legs())if(l.avg!=null){m[l.from+"|"+l.to]=l.avg;m[l.to+"|"+l.from]=l.avg}})}catch(e){}return m}
function autoK(L){const seq=[L.start].concat(L.setups.map(u=>u.fs.p)).filter(p=>p&&!/^TP/i.test(p));if(seq.length<2)return null;
  const m=legMap();let d=0;for(let i=1;i<seq.length;i++){if(seq[i]===seq[i-1])continue;const x=m[seq[i-1]+"|"+seq[i]];if(x==null)return{miss:seq[i-1]+"–"+seq[i]};d+=x}return{d}}
const chkLbl=()=>LIM_LEV.chk==="mean"?"Mean − Mid":"(T+B)/2 − M",rngTxt=()=>LIM_LEV.lo+"–"+LIM_LEV.hi.toFixed(1)+" m";
function rngOf(m){return(m<LIM_LEV.lo||m>LIM_LEV.hi)?"bad":(LIM_LEV.warn&&m>LIM_LEV.warn)?"warn":"ok"}
useLev("lev");
function levSave(){try{localStorage.setItem(LP.key,JSON.stringify(LEV));if(PEG)localStorage.setItem("peg-v1",JSON.stringify(PEG));localStorage.setItem(TS_KEY,new Date().toISOString())}catch(e){alert("Could not save on this phone! Make a backup now.")}}
function setMod(m){try{localStorage.setItem("trav-mod",m)}catch(e){}}
function lastMod(){try{return localStorage.getItem("trav-mod")||"trav"}catch(e){return "trav"}}
function modSwitch(m){return `<div class="seg" style="margin-bottom:14px"><button class="${m==="trav"?"on":""}" onclick="setMod('trav');location.hash=''">Traverse</button><button class="${m==="lev"?"on":""}" onclick="setMod('lev');location.hash='lev'">Levelling</button></div>`}

/* --- maths --- */
function rd(v){ // staff reading: "1.951" metres, or "1951" millimetres
  if(v==null||v==="")return null;v=String(v).trim();
  if(/^\d+$/.test(v)&&v.length>=4)return +v/1000;
  if(/^\d*\.?\d+$/.test(v)||/^\d+\.$/.test(v))return +v;return null}
const r3=x=>Math.round(x*1000)/1000;
function w3(a,mid){ // [T,M,B] -> mean (template: ROUND(AVERAGE,3)), stadia, checks; mid = middle hair only (template loop levelling)
  if(mid){const m=rd(a&&a[1]);if(m==null)return null;return{t:null,m,b:null,mean:m,s:0,dist:0,chk:0,rng:rngOf(m),order:true,bad:false,mid:true}}
  const t=rd(a&&a[0]),m=rd(a&&a[1]),b=rd(a&&a[2]);
  if(t==null||m==null||b==null)return null;
  const mean=r3((t+m+b)/3),s=t-b,chk=LIM_LEV.chk==="mean"?(t+m+b)/3-m:(t+b)/2-m;
  return{t,m,b,mean,s,dist:s*100,chk,rng:rngOf(m),order:t>=m&&m>=b,bad:Math.abs(chk)>LIM_LEV.wire+1e-9||!(t>=m&&m>=b)}}
function lineCalc(L){
  const mid=isMid(L);let rl0=num(L.rl);let rlFrom=rl0!=null?"typed":null;if(rl0==null&&L.dir==="bw"){const F=pairOf(L);if(F&&F.dir==="fw"){const e=lineCalc(F).end;if(e!=null){rl0=e;rlFrom="FW end"}}}
  if(rl0==null&&L.start){const k=knownRL(L.start,L);if(k){rl0=k.rl;rlFrom=k.line}}
  // Start RL unknown: back-compute it from a named point on the way whose RL another job carried (e.g. A on a C-A-C loop).
  if(rl0==null){let cum=0;for(const u of L.setups){const B=w3(u.bs.r,mid),F=w3(u.fs.r,mid);if(!B||!F)break;cum+=B.mean-F.mean;const p=String(u.fs.p||"").trim();
    if(p&&!/^TP/i.test(p)&&p!==String(L.start||"").trim()){const k=knownRL(p,L);if(k){rl0=r3(k.rl-cum);rlFrom=k.line+", via "+p;break}}}}
  // Still unknown but the line closes on its start: check the closure with the start taken as 0.000 (RLs not shared with other jobs).
  const lastP=L.setups.length?String(L.setups[L.setups.length-1].fs.p||"").trim():"";
  if(rl0==null&&lastP&&lastP===String(L.start||"").trim()){rl0=0;rlFrom="assumed"}
  let rl=rl0,sBS=0,sFS=0,sR=0,sF=0,dist=0;const rows=[];
  L.setups.forEach((u,i)=>{
    const B=w3(u.bs.r,mid),F=w3(u.fs.r,mid);let rise=null,rlF=null,bal=null;
    if(B&&F){rise=r3(B.mean-F.mean);if(rl!=null){rlF=r3(rl+rise)}sBS+=B.mean;sFS+=F.mean;if(rise>=0)sR+=rise;else sF+=-rise}
    if(B)dist+=B.dist;if(F)dist+=F.dist;
    if(B&&F&&!mid)bal=Math.abs(B.dist-F.dist);
    rows.push({B,F,rise,rlBS:rl,rlF,bal,balBad:bal!=null&&bal>LIM_LEV.balance+1e-9});
    rl=(B&&F)?rlF:null;
  });
  const done=rows.length&&rows.every(r=>r.rlF!=null);
  const end=done?rows[rows.length-1].rlF:null,last=L.setups.length?L.setups[L.setups.length-1].fs.p:"";
  let known=null;if(last&&last===L.start)known=rl0;else if(num(L.closeRl)!=null&&last===L.closeP)known=num(L.closeRl);
  const aK=mid&&num(L.kKm)==null?autoK(L):null,K=mid?(num(L.kKm)??(aK&&aK.d!=null?aK.d/1000:0)):dist/1000,perm=K?LIM_LEV.k*Math.sqrt(K):null,err=(done&&known!=null&&rl0!=null)?Math.round((end-known)*1000):null;
  // Named points (not TP): adjust by distance, RL_adj = RL - e x (distance to point / total distance).
  // At the turnaround of a there-and-back line this equals the template's mean of forward and backward.
  const tbm=[];
  if(done&&known!=null&&rl0!=null&&rlFrom!=="assumed"){const eM=end-known;let cum=0;
    L.setups.forEach((u,i)=>{const r=rows[i];cum+=(r.B?r.B.dist:0)+(r.F?r.F.dist:0);const p=u.fs.p;
      if(i===L.setups.length-1||!p||/^TP/i.test(p)||p===L.start)return;
      const share=mid||!dist?(i+1)/L.setups.length:cum/dist,adj=r3(r.rlF-eM*share),x=tbm.find(q=>q.p===p);
      if(x){x.vals.push(adj);x.adj=r3(x.vals.reduce((a,b)=>a+b,0)/x.vals.length)}else tbm.push({p,raw:r.rlF,vals:[adj],adj})})}
  return{rlFrom,aK,rows,sBS:r3(sBS),sFS:r3(sFS),sR:r3(sR),sF:r3(sF),dist,K,perm,err,end,known,done,rl0,tbm,
    arith:done&&rl0!=null?Math.abs((sBS-sFS)-(sR-sF))<0.0015&&Math.abs((sBS-sFS)-(end-rl0))<0.0015:null};
}
/* --- FW / BW pairs: the same route levelled forward, then backward. Template Fly Levelling:
   error = |ΣR−ΣF| fwd − |ΣR−ΣF| bwd (= ΔH fwd + ΔH bwd), K = (fwd + bwd distance) / 1000, RL of the far point = start ± mean of the two --- */
function PAIRED(k){return k==="fly"||k==="lev"||k==="bfly"}
function pairBase(n){return String(n||"").replace(/\b(fw|bw|forward|backward)\b/ig,"").replace(/\s+/g," ").trim()}
function pairOf(L){return L&&L.pair?LEV.lines.find(x=>x!==L&&x.pair===L.pair)||null:null}
function pairAuto(){if(!PAIRED(LK)||!LEV)return;const g={};let ch=false;
  for(const L of LEV.lines){if(L.pair&&pairOf(L))continue;const d=/\b(bw|backward)\b/i.test(L.name)?"bw":/\b(fw|forward)\b/i.test(L.name)?"fw":null;if(!d)continue;const k=pairBase(L.name).toLowerCase();(g[k]=g[k]||[]).push([L,d])}
  for(const k in g){const f=g[k].filter(x=>x[1]==="fw"),b=g[k].filter(x=>x[1]==="bw");if(f.length===1&&b.length===1){const id="p"+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    Object.assign(f[0][0],{pair:id,dir:"fw"});Object.assign(b[0][0],{pair:id,dir:"bw"});ch=true}}
  if(ch)try{localStorage.setItem(LP.key,JSON.stringify(LEV))}catch(e){}}
function pairCalc(F,B){const cF=lineCalc(F),cB=lineCalc(B);const done=cF.done&&cB.done&&cF.rl0!=null;
  const dF=cF.sR-cF.sF,dB=cB.sR-cB.sF,a=Math.abs(dF),b=Math.abs(dB);
  const K=(isMid(F)||isMid(B))?(num(F.kKm)??null):(cF.dist+cB.dist)/1000,perm=K?LIM_LEV.k*Math.sqrt(K):null;
  const e=done?Math.round((dF+dB)*1000):null,endP=F.setups.length?F.setups[F.setups.length-1].fs.p:"";
  const rlEnd=done?r3(cF.rl0+(dF>=0?1:-1)*(a+b)/2):null;
  return{cF,cB,done,a,b,dF,dB,K,perm,e,ok:e!=null&&perm!=null?Math.abs(e)<=perm+1e-9:null,endP,rlEnd,name:pairBase(F.name)||F.name,
    sameDir:done&&dF*dB>0}}
// status of a line for hub counts: paired lines report once (on the FW line)
function levStatus(L){const P=pairOf(L);if(P){if(L.dir==="bw")return undefined;const pc=pairCalc(L,P);return pc.ok}const c=lineCalc(L);return c.err!=null&&c.perm!=null?Math.abs(c.err)<=c.perm:null}
function levIssues(L){const c=lineCalc(L),o=[];
  c.rows.forEach((r,i)=>{const n=i+1;
    if(r.B&&r.B.bad)o.push(`Setup ${n} BS: ${!r.B.order?"T ≥ M ≥ B not satisfied":chkLbl()+" = "+(r.B.chk*1000).toFixed(1)+" mm"}`);
    if(r.F&&r.F.bad)o.push(`Setup ${n} FS: ${!r.F.order?"T ≥ M ≥ B not satisfied":chkLbl()+" = "+(r.F.chk*1000).toFixed(1)+" mm"}`);
    if(r.B&&r.B.rng==="bad")o.push(`Setup ${n} BS: middle reading ${r.B.m.toFixed(3)} m outside ${rngTxt()}`);
    if(r.F&&r.F.rng==="bad")o.push(`Setup ${n} FS: middle reading ${r.F.m.toFixed(3)} m outside ${rngTxt()}`);
    if(r.balBad)o.push(`Setup ${n}: BS ${r.B.dist.toFixed(1)} m vs FS ${r.F.dist.toFixed(1)} m (balance ±1 m)`)});
  if(c.err!=null&&c.perm!=null&&Math.abs(c.err)>c.perm)o.push(`Closing error ${c.err} mm exceeds ±${c.perm.toFixed(1)} mm`);
  if(c.arith===false)o.push("Arithmetic check fails (ΣBS−ΣFS ≠ ΣRise−ΣFall)");
  const P=pairOf(L);if(P){const pc=L.dir==="bw"?pairCalc(P,L):pairCalc(L,P);if(pc.sameDir)o.push("FW and BW both go the same way: the BW line must be levelled back from "+pc.endP);else if(pc.ok===false)o.push(`FW / BW error ${pc.e>0?"+":""}${pc.e} mm exceeds ±${pc.perm.toFixed(1)} mm`)}
  return o}
function pegCalc(){const P=LEV.peg,a1=w3(P.mid.a),b1=w3(P.mid.b),a2=w3(P.near.a),b2=w3(P.near.b),d=num(P.d);
  const h1=a1&&b1?r3(a1.mean-b1.mean):null,h2=a2&&b2?r3(a2.mean-b2.mean):null;
  // near setup: instrument n m from the near peg, inside the pegs (sights n and D−n, difference D−2n) or outside (n and D+n, difference D)
  const n=num(P.n),out=P.pos==="out",Ld=d?(n!=null?(out?d:d-2*n):d):null;
  const e=h1!=null&&h2!=null?Math.abs(h1-h2):null,prec=e!=null&&Ld?(e<0.0005?Infinity:Ld/e):null;
  return{a1,b1,a2,b2,h1,h2,e,d,n,out,Ld,prec,ok:prec==null?null:prec>=LIM_LEV.peg}}

/* --- UI --- */
let levCur=null,levLast=null;
const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function renderLev(h){
  setMod("lev");guideBtn.classList.remove("hidden");
  const part=h.split("/")[1];
  if(part==="guide")return renderLevGuide();
  if(part==="peg")return renderPeg();
  if(part==="pair")return renderPair(h.split("/")[2]);
  const L=LEV.lines.find(x=>x.id===part);
  if(L)return renderLine(L);
  levCur=null;backTo=brLev()?"br":"";homeBtn.classList.remove("hidden");homeBtn.textContent=brLev()?"◀ Bridge":"◀ Home";
  title.innerHTML=`${LP.name}<small>${LK==="bloop"?"Closed loop through the bridge stations · ±24√K":LK==="bfly"?"BM → bridge axis · 3-wire · ±24√K":LK==="fly"?"0.6–2.0 m · |mean − mid| ≤ 3 mm":LK==="mlev"?"Middle hair · 0.6–3.0 m · ±24√K":"Fly levelling · two peg test"}</small>`;
  const pc=pegCalc();
  const pcard=F=>{const B=pairOf(F),pc=pairCalc(F,B),is=levIssues(F).concat(levIssues(B));
    const st=is.length?pill("bad",is.length+" warning"+(is.length>1?"s":"")):pc.e!=null&&pc.perm!=null?pill("ok","FW/BW "+(pc.e>0?"+":"")+pc.e+" mm"):pill("wait",F.setups.length+" + "+B.setups.length+" setups");
    return `<button class="lcard${is.length?" bad":""}" onclick="location.hash='${LP.home}/pair/${F.pair}'"><div><b>${esc(pc.name||"Run")}</b><small>FW ${esc(F.start||"?")} → ${esc(pc.endP||"…")} · BW back${pc.rlEnd!=null?" · RL "+esc(pc.endP)+" "+pc.rlEnd.toFixed(3):""}</small></div>${st}</button>`};
  const cards=LEV.lines.map(L=>{const P=pairOf(L);if(P)return L.dir==="fw"?pcard(L):P.dir==="fw"?"":pcard(L);const c=lineCalc(L),is=levIssues(L);
    const st=is.length?pill("bad",is.length+" warning"+(is.length>1?"s":"")):c.err!=null?pill("ok","closed "+(c.err>0?"+":"")+c.err+" mm"):pill("wait",L.setups.length+" setups");
    return `<button class="lcard${is.length?" bad":""}" onclick="location.hash='${LP.home}/${L.id}'"><div><b>${esc(L.name||"Line")}</b><small>${esc(L.start||"?")} → ${esc(L.setups.length?L.setups[L.setups.length-1].fs.p:"…")} · ${c.dist?c.dist.toFixed(0)+" m":"no readings"}</small></div>${st}</button>`}).join("");
  app.innerHTML=`${LP.mid?"":`
  <div class="card"><h2>Two peg test (once, before levelling)</h2>
    <div class="row"><span>Collimation precision (≥ 1:10000)</span>${pc.prec==null?pill("wait","not done"):pill(pc.ok?"ok":"bad",pc.prec===Infinity?"1/∞":"1/"+Math.round(pc.prec))}</div>
    <div class="btns" style="margin-top:8px"><button class="btn" onclick="location.hash='${LP.home}/peg'">Open two peg test</button></div></div>`}
  <div class="card"><h2>Levelling lines</h2>${cards||'<p class="note">No lines yet. A line starts on a BM of known RL; go to your TBMs and come back (or close on another BM).</p>'}
    <div class="btns" style="margin-top:10px"><button class="btn pri" onclick="addLine()">${PAIRED(LK)?"+ New FW / BW run":"+ New line"}</button></div>${PAIRED(LK)?'<p class="note">Fly levelling is always done forward and backward on the same route. A run holds both lines; the closing error, K and the RL of the far point come from the pair.</p>':""}</div>
  <div class="card"><h2>Limits</h2>
    <div class="row"><span>Closing error</span><b>±24√K mm</b></div>
    ${LP.mid?`<div class="row"><span>BS / FS sight distance</span><b>pace them equal</b></div>`:`<div class="row"><span>BS / FS sight distance</span><b>within ±1 m</b></div>`}
    ${LP.mid?"":`<div class="row"><span>Two peg collimation</span><b>≥ 1 : 10000</b></div>
    <div class="row"><span>3-wire check |${chkLbl()}|</span><b>≤ 3 mm</b></div>`}
    <div class="row"><span>Staff reading (middle)</span><b>${rngTxt()}${LIM_LEV.warn?" · prefer ≤ "+LIM_LEV.warn+" m":""}</b></div>
    <p class="note">${LK==="bloop"?"Bridge site loop: start on a station with known RL (e.g. "+esc(BR.axis[0])+"), go round the stations (e.g. A → C → G → E → A) and close on the start. Middle hair by default (switch a line to 3-wire if you read all three). K = total distance levelled = sum of the legs, taken from the bridge triangulation; never ×2 for a closed loop. Book: Rise and Fall (15) for middle hair, format 12 for 3-wire.":LK==="mlev"?"Camp norms for levelling through the minor stations: middle hair only, readings 0.6–3.0 m, closing error ±24√K. K comes from the traverse leg lengths (or type it). Corrections are spread equally over the setups. Book: Rise and Fall format (15).":LK==="bfly"?"Bridge site: carry the RL from the given BM to the axis end on your bank and close the circuit (back to the BM). Same norms as the fly levelling: 0.6–2.0 m, |mean − mid| ≤ 3 mm, ±24√K.":LK==="fly"?"Norms given at camp: readings 0.6–2.0 m, |mean − mid| ≤ 3 mm. BS/FS balance, 24√K and 1:10000 from the guidelines.":"BS/FS balance, 24√K and 1:10000 are from the guidelines. 0.6–3.0 m is the guideline's turning-point rule (road alignment item 14); ≤ 2 m is the classroom habit, shown in yellow only. The 3 mm 3-wire limit is this app's default."}</p></div>
  <div class="card"><h2>Data safety</h2><p class="note">Backup, merge and Excel export on the Traverse screen include levelling too.</p>
    <div class="btns" style="margin-top:8px"><button class="btn pri" onclick="backup()">Save backup</button><button class="btn" onclick="exportCSV()">Excel export</button></div>
    <div class="btns" style="margin-top:10px"><button class="btn" onclick="clearLev()">Clear levelling data…</button></div></div>`;
}
// RL of a named point from any levelling job: FW/BW run far point (mean) > closed line (adjusted) > RL typed as another line's start.
// Names are matched exactly (trimmed), so the same BM name links jobs on its own. Guarded against loops between lines.
const KR_BUSY=new Set();let krMemo={t:0,m:new Map()};
function knownRL(p,self){p=String(p||"").trim();if(!p)return null;const sid=self&&self.id||"";const now=Date.now();
  if(now-krMemo.t>250)krMemo={t:now,m:new Map()};const mk=p+"|"+sid;if(krMemo.m.has(mk))return krMemo.m.get(mk);
  if(KR_BUSY.has(p))return null;KR_BUSY.add(p);let hit=null;
  try{hit=knownRL0(p,self)}finally{KR_BUSY.delete(p)}krMemo.m.set(mk,hit);return hit}
function knownRL0(p,self){let hit=null;allLev(()=>{if(hit)return;
    for(const L of LEV.lines){if(L.dir!=="fw"||L===self)continue;const B=pairOf(L);if(!B||B===self)continue;const pc=pairCalc(L,B);if(pc.done&&pc.endP===p&&pc.rlEnd!=null){hit={rl:pc.rlEnd,line:pc.name+" (FW/BW mean)"};return}}
    for(const L of LEV.lines){if(L===self||L.id===(self&&self.id))continue;const c=lineCalc(L);const x=c.tbm.find(q=>q.p===p);if(x){hit={rl:x.adj,line:L.name};return}}});
  if(!hit)allLev(()=>{if(hit)return;for(const L of LEV.lines){if(L===self||L.id===(self&&self.id))continue;if(String(L.start||"").trim()===p&&num(L.rl)!=null){hit={rl:num(L.rl),line:L.name+" (start RL)"};return}}});
  return hit}
function useKnown(){const k=knownRL(levCur.start,levCur);if(k){levCur.rl=k.rl.toFixed(3);levSave();renderLine(levCur)}}
function setLevMode(m){if(levCur.setups.length&&!confirm("Switch reading mode for this line? Readings already typed stay saved."))return;levCur.mode=m;levSave();renderLine(levCur)}
function minorRoute(){try{const c=loadCfg("minor").cfg;const mN=Array.from({length:c.m},(_,i)=>c.px+(i+1));return c.type==="link"?[c.b].concat(mN,[c.c]).filter(Boolean):c.cps.concat(mN)}catch(e){return[]}}
function addLine(){if(PAIRED(LK)){const n=LEV.lines.filter(x=>x.dir!=="bw").length+1,id="p"+newId(),base="Run "+n;
    const F={id:newId(),name:base+" FW",start:"BM",rl:"",closeP:"",closeRl:"",setups:[],pair:id,dir:"fw"},B={id:newId(),name:base+" BW",start:"",rl:"",closeP:"",closeRl:"",setups:[],pair:id,dir:"bw"};
    LEV.lines.push(F,B);levSave();location.hash=LP.home+"/"+F.id;return}const n=LEV.lines.length+1;const mr=LP.mid?minorRoute():[];const lp=LK==="bloop";const L={id:newId(),name:(LP.mid||lp?"Loop ":"Line ")+n,start:lp?BR.axis[0]:LP.mid?(mr[0]||"BM"):"BM",rl:"",closeP:"",closeRl:"",setups:[]};if(LP.mid||lp)L.mode="mid";
  LEV.lines.push(L);levSave();location.hash=LP.home+"/"+L.id}
function tmbHTML(path,v,mid){v=v||[];return `<div class="tmb" data-path="${path}">${(mid?[["M",1]]:[["T",0],["M",1],["B",2]]).map(([l,p])=>`<input inputmode="decimal" enterkeyhint="next" placeholder="${l}" data-p="${p}" value="${esc(v[p]??"")}">`).join("")}</div>`}
function renderPair(id){const F=LEV.lines.find(x=>x.pair===id&&x.dir==="fw"),B=F&&pairOf(F);if(!F||!B){location.hash=LP.home;return}
  levCur=null;backTo=LP.home;homeBtn.classList.remove("hidden");homeBtn.textContent="◀ Lines";const pc=pairCalc(F,B);
  title.innerHTML=`${esc(pc.name)}<small>Forward + backward on the same route</small>`;
  const ln=(L,c,lbl)=>`<button class="lcard" onclick="location.hash='${LP.home}/${L.id}'"><div><b>${lbl}: ${esc(L.name)}</b><small>${esc(L.start||"?")} → ${esc(L.setups.length?L.setups[L.setups.length-1].fs.p:"…")} · ${L.setups.length} setups · ${c.dist.toFixed(0)} m</small></div><span class="wgo">›</span></button>`;
  const is=levIssues(F).concat(levIssues(B));
  app.innerHTML=`${is.length?`<div class="alarm"><h4>⚠ ${is.length} warning${is.length>1?"s":""}</h4><ul>${is.map(x=>`<li>${x}</li>`).join("")}</ul></div>`:pc.ok?`<div class="passbar">✓ FW / BW closed within ±${pc.perm.toFixed(1)} mm</div>`:""}
  <div class="card"><h2>Lines</h2>${ln(F,pc.cF,"FW")}${ln(B,pc.cB,"BW")}</div>
  <div class="card"><h2>Error computation (template)</h2>
    <div class="row"><span>|ΣRise − ΣFall| forward</span><b>${pc.cF.done?pc.a.toFixed(3):"–"}</b></div>
    <div class="row"><span>|ΣRise − ΣFall| backward</span><b>${pc.cB.done?pc.b.toFixed(3):"–"}</b></div>
    <div class="row"><span>Error of closure</span>${pc.e==null?pill("wait",!pc.cF.done?"FW incomplete":!pc.cB.done?"BW incomplete":"enter start RL"):pill(pc.ok===false?"bad":"ok",(pc.e>0?"+":"")+pc.e+" mm")}</div>
    <div class="row"><span>K = (FW + BW distance)</span><b>${pc.K?pc.K.toFixed(4)+" km":"–"}</b></div>
    <div class="row"><span>Permissible ±24√K</span><b>${pc.perm!=null?"±"+pc.perm.toFixed(1)+" mm":"–"}</b></div>
    <div class="row"><span>RL of ${esc(pc.endP||"far point")} (start ± mean)</span><span class="big">${pc.rlEnd!=null?pc.rlEnd.toFixed(3):"–"}</span></div></div>
  <div class="card"><h2>Run name</h2><div class="row"><span>Name</span><input class="cfgin" id="pname" value="${esc(pc.name)}"></div>
    <div class="btns" style="margin-top:10px"><button class="btn" onclick="unpair('${id}')">Unlink FW / BW</button></div></div>`;
  document.getElementById("pname").addEventListener("change",e=>{const v=e.target.value.trim()||"Run";F.name=v+" FW";B.name=v+" BW";levSave();renderPair(id)})}
function unpair(id){if(!confirm("Unlink these two lines? They stay saved as separate lines."))return;LEV.lines.forEach(x=>{if(x.pair===id){delete x.pair;delete x.dir}});
  LEV.lines.forEach(x=>{if(!x.pair&&/\b(fw|bw)\b/i.test(x.name))x.name=x.name.replace(/\b(FW|BW)\b/,m=>m.toLowerCase())});levSave();location.hash=LP.home}
function linkPair(myDir){const L=levCur,o=LEV.lines.find(x=>x.id===document.getElementById("plink").value);if(!o)return;const id="p"+newId();
  L.pair=id;L.dir=myDir;o.pair=id;o.dir=myDir==="fw"?"bw":"fw";levSave();location.hash=LP.home+"/pair/"+id}
function pairCard(L){if(!PAIRED(LK))return "";const P=pairOf(L);
  if(P){const pc=L.dir==="bw"?pairCalc(P,L):pairCalc(L,P);return `<div class="card"><h2>${L.dir==="bw"?"Backward line":"Forward line"} of “${esc(pc.name)}”</h2>
    <div class="row"><span>FW / BW error</span>${pc.e==null?pill("wait","needs both lines"):pill(pc.ok===false?"bad":"ok",(pc.e>0?"+":"")+pc.e+" mm · ±"+(pc.perm||0).toFixed(1))}</div>
    ${L.dir==="bw"?`<p class="note">Level back from ${esc(pc.endP||"the FW end")} to ${esc(P.start)} on the same route. Start RL comes from the FW line.</p>`:""}
    <div class="btns" style="margin-top:8px"><button class="btn" onclick="location.hash='${LP.home}/${P.id}'">Open ${L.dir==="bw"?"FW":"BW"} line</button><button class="btn" onclick="location.hash='${LP.home}/pair/${L.pair}'">Error computation</button></div></div>`}
  const free=LEV.lines.filter(x=>x!==L&&!pairOf(x));
  return `<div class="card"><h2>Not linked</h2><p class="note" style="margin-top:0">Fly levelling needs a forward and a backward line on the same route. Link this line with its partner.</p>
    ${free.length?`<div class="row"><span>Partner line</span><select id="plink" class="cfgin">${free.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></div>
    <div class="btns" style="margin-top:8px"><button class="btn" onclick="linkPair('fw')">This is FW</button><button class="btn" onclick="linkPair('bw')">This is BW</button></div>`:'<p class="note">No other unlinked line yet.</p>'}</div>`}
function renderLine(L){if(L.dir==="bw"&&!L.start){const F=pairOf(L);if(F&&F.setups.length){L.start=F.setups[F.setups.length-1].fs.p;levSave()}}
  levCur=L;levLast=null;backTo=LP.home;homeBtn.classList.remove("hidden");homeBtn.textContent="◀ Lines";
  title.innerHTML=`${esc(L.name)}<small>${isMid(L)?"Levelling · middle hair":"Fly levelling · 3-wire"}</small>`;
  const setups=L.setups.map((u,i)=>`<div class="card" id="su${i}"><h2>Setup ${i+1}</h2>
    <div class="obs"><label><b>BS</b> → ${esc(u.bs.p||"?")}</label>${tmbHTML(i+".bs",u.bs.r,isMid(L))}</div>
    <div class="obs"><label><b>FS</b> → <input class="pt" data-pt="${i}" value="${esc(u.fs.p)}" maxlength="10" autocapitalize="off" autocorrect="off" spellcheck="false" ${LP.mid?`style="text-transform:none"`:""}></label>${tmbHTML(i+".fs",u.fs.r,isMid(L))}</div>${LP.mid&&i===L.setups.length-1?chips(i):""}
    <div id="sr${i}"></div><p class="bookh" style="margin-top:10px">✎ Write in book</p><div class="bookwrap" id="bk${i}"></div></div>`).join("");
  app.innerHTML=`<div id="lbanner"></div>${pairCard(L)}
  <details class="card" ${L.setups.length?"":"open"}><summary><h2 style="display:inline">Line details</h2> <small class="note">${esc(L.start||"?")} · RL ${esc(L.rl||"?")} · ${isMid(L)?"middle only":"3-wire"}</small></summary>
    <div class="row"><span>Name</span><input class="cfgin" data-f="name" value="${esc(L.name||"")}"></div>
    <div class="row"><span>Start point (BM or station)</span><input class="cfgin" data-f="start" value="${esc(L.start||"")}"></div>
    <div class="row"><span>RL of start (m)</span><input class="cfgin" inputmode="decimal" data-f="rl" value="${esc(L.rl||"")}" placeholder="${(()=>{const c=lineCalc(L);return c.rl0!=null&&!num(L.rl)&&num(L.rl)!==0?c.rl0.toFixed(3)+" auto":"type RL"})()}"></div>
    ${(()=>{const c=lineCalc(L);return num(L.rl)==null&&c.rlFrom==="assumed"?`<p class="note">No job has an RL for “${esc(L.start||"?")}” or any named point on this loop yet, so the closure is checked with ${esc(L.start||"start")} = 0.000. Name a point exactly like a BM with a known RL (e.g. the bridge axis end) to get real RLs.</p>`:num(L.rl)==null&&c.rl0!=null&&/, via /.test(c.rlFrom||"")?`<p class="note">Start RL ${c.rl0.toFixed(3)} is back-computed from “${esc(c.rlFrom)}”. Type a value only to override.</p>`:num(L.rl)==null&&c.rl0!=null?`<p class="note">Start RL ${c.rl0.toFixed(3)} is linked automatically from “${esc(c.rlFrom)}” (same name ${esc(L.start)}). Type a value only to override.</p>`:num(L.rl)==null?`<p class="note">No other job has an RL for “${esc(L.start||"?")}” yet. Type it, or name the start exactly like the BM in the job that carried its RL.</p>`:""})()}
    ${LP.mid?"":`<div class="row"><span>Readings</span><div class="seg" style="width:210px"><button class="${L.mode!=="mid"?"on":""}" onclick="setLevMode('3w')">3-wire</button><button class="${L.mode==="mid"?"on":""}" onclick="setLevMode('mid')">Middle only</button></div></div>`}
    ${isMid(L)?`<div class="row"><span>Loop length K (km)</span><input class="cfgin" inputmode="decimal" data-f="kKm" value="${esc(L.kKm||"")}" placeholder="${LK==="bloop"?"auto from bridge":"auto from traverse"}"></div><p class="note">Middle hair only: no stadia, so K comes from the ${LK==="bloop"?"bridge triangulation distances":"traverse leg lengths"} between the named stations (leave blank) or type it. Error is spread equally over the setups.</p>`:""}
    <div class="row"><span>Close on other BM</span><input class="cfgin" data-f="closeP" value="${esc(L.closeP||"")}" placeholder="(blank = start)"></div>
    <div class="row"><span>Its RL (m)</span><input class="cfgin" inputmode="decimal" data-f="closeRl" value="${esc(L.closeRl||"")}" placeholder="only if other BM"></div>
    <p class="note">Coming back to the start point closes the line automatically: name the last FS point the same as the start.</p></details>
  ${setups}
  <div class="btns" style="margin-bottom:14px"><button class="btn pri" onclick="addSetup()">+ Add setup</button>${L.setups.length?(L.dir==="bw"&&pairOf(L)?`<button class="btn" onclick="closeToFW()">Last FS = ${esc(pairOf(L).start)}</button>`:L.dir==="fw"?"":`<button class="btn" onclick="closeToStart()">Last FS = ${esc(L.start)}</button>`):""}</div>
  <div class="card"><h2>Summary</h2><div id="lsum"></div></div>
  <div class="card"><h2>Field book (copy these values)</h2><div id="lbook"></div></div>
  <div class="btns" style="margin-bottom:14px">${L.setups.length?'<button class="btn" onclick="delSetup()">Delete last setup…</button>':""}<button class="btn" onclick="delLine()">Delete line…</button></div>
  <div class="lsticky" id="lsticky"><span></span><button class="btn pri" onclick="addSetup()">+ Next setup</button></div>`;
  wireLine();updateLine();
}
function wireLine(){
  const L=levCur,ins=[...app.querySelectorAll(".tmb input")];
  ins.forEach((el,idx)=>{
    const box=el.parentElement,[i,side]=box.dataset.path.split("."),p=+el.dataset.p;
    const next=()=>{const n=ins[idx+1];if(n){n.focus();n.select()}else el.blur()};
    el.addEventListener("focus",()=>el.select());
    el.addEventListener("input",()=>{el.value=el.value.replace(/[^\d.]/g,"");const u=L.setups[+i][side];u.r=u.r||[];u.r[p]=el.value;
      el.classList.toggle("err",el.value!==""&&rd(el.value)==null);levSave();updateLine();
      if(/^\d\.\d{3}$/.test(el.value)||/^\d{4}$/.test(el.value))next()});
    el.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();next()}});
  });
  app.querySelectorAll("[data-f]").forEach(el=>el.addEventListener("change",()=>{if(el.dataset.f==="start")renderLine(L)}));
  app.querySelectorAll("[data-f]").forEach(el=>el.addEventListener("input",()=>{L[el.dataset.f]=el.value.trim();levSave();updateLine();
    if(el.dataset.f==="name")title.innerHTML=`${esc(L.name)}<small>${isMid(L)?"Levelling · middle hair":"Fly levelling · 3-wire"}</small>`;
    if(el.dataset.f==="start"&&L.setups[0]){L.setups[0].bs.p=L.start;levSave()}}));
  app.querySelectorAll("[data-pt]").forEach(el=>el.addEventListener("input",()=>{const i=+el.dataset.pt;if(!LP.mid)el.value=el.value.toUpperCase();L.setups[i].fs.p=el.value.trim();
    if(L.setups[i+1])L.setups[i+1].bs.p=L.setups[i].fs.p;levSave();
    const lab=document.querySelector(`#su${i+1} .obs label`);if(lab)lab.innerHTML=`<b>BS</b> → ${esc(L.setups[i].fs.p||"?")}`;updateLine()}));
}
function addSetup(){const L=levCur,prev=L.setups[L.setups.length-1];
  const tp=L.setups.filter(u=>/^TP\d+$/i.test(u.fs.p)).length+1;
  L.setups.push({bs:{p:prev?prev.fs.p:L.start,r:[]},fs:{p:"TP"+tp,r:[]}});levSave();renderLine(L);
  const n=L.setups.length-1,el=document.querySelector(`#su${n}`);if(el){el.scrollIntoView({behavior:"smooth",block:"start"});const f=el.querySelector(".tmb input");if(f)setTimeout(()=>f.focus(),300)}}
function chips(i){const L=levCur,used=new Set([L.start].concat(L.setups.map(u=>u.fs.p))),r=minorRoute();
  const nx=r.filter(p=>!used.has(p)).slice(0,3);if(!r.length)return "";
  return `<div class="chips"><small>FS is</small>${nx.map(p=>`<button onclick="setFS(${i},'${esc(p)}')">${esc(p)}</button>`).join("")}<button onclick="setFS(${i},'TP${L.setups.filter(u=>/^TP\d+$/i.test(u.fs.p)).length+(/^TP/i.test(L.setups[i].fs.p)?0:1)}')">TP</button><button onclick="setFS(${i},'${esc(L.start)}')">${esc(L.start)} (close)</button></div>`}
function setFS(i,p){levCur.setups[i].fs.p=p;levSave();renderLine(levCur)}
function closeToFW(){const L=levCur,F=pairOf(L),u=L.setups[L.setups.length-1];if(F){u.fs.p=F.start;levSave();renderLine(L)}}
function closeToStart(){const L=levCur,u=L.setups[L.setups.length-1];u.fs.p=L.start;levSave();renderLine(L)}
function delSetup(){const L=levCur;if(confirm("Delete setup "+L.setups.length+" and its readings?")){L.setups.pop();levSave();renderLine(L)}}
function delLine(){const L=levCur;if(prompt('Type DELETE to remove "'+L.name+'" and all its readings.')==="DELETE"){LEV.lines=LEV.lines.filter(x=>x!==L);levSave();location.hash=LP.home}}
const fm=x=>x==null?"–":x.toFixed(3);
function wRow(lbl,w,rng){if(!w)return "";if(w.mid)return `<div class="row"><span>${lbl} middle ${w.m.toFixed(3)} m</span>${w.rng==="bad"?pill("bad","outside "+rngTxt()):w.rng==="warn"?pill("warn","prefer 0.6–2 m"):pill("ok","✓")}</div>`;return `<div class="row"><span>${lbl} mean ${fm(w.mean)} · ${w.dist.toFixed(1)} m</span>${w.bad?pill("bad",!w.order?"T≥M≥B?":(w.chk>0?"+":"")+(w.chk*1000).toFixed(1)+" mm"):pill("ok","3-wire ✓")}</div>`+
  (rng&&w.rng!=="ok"?`<div class="row"><span>${lbl} middle ${w.m.toFixed(3)} m</span>${w.rng==="bad"?pill("bad","outside "+rngTxt()):pill("warn","prefer 0.6–2 m")}</div>`:"")}
function updateLine(){
  const L=levCur,c=lineCalc(L),is=levIssues(L);
  c.rows.forEach((r,i)=>{const el=document.getElementById("sr"+i);if(!el)return;
    el.innerHTML=wRow("BS",r.B,1)+wRow("FS",r.F,1)+
    (r.bal!=null?`<div class="row"><span>Sight balance (±1 m)</span>${pill(r.balBad?"bad":"ok","Δ "+r.bal.toFixed(1)+" m")}</div>`:"")+
    (r.rise!=null?`<div class="row"><span>${r.rise>=0?"Rise":"Fall"}</span><b>${Math.abs(r.rise).toFixed(3)}</b></div>`:"")+
    `<div class="row"><span>RL of ${esc(L.setups[i].fs.p||"FS")}</span><span class="big">${fm(r.rlF)}</span></div>`});
  const PP=pairOf(L),ppc=PP?(L.dir==="bw"?pairCalc(PP,L):pairCalc(L,PP)):null;
  const closeTxt=ppc?(ppc.e==null?pill("wait",ppc.cF.done&&ppc.cB.done?"enter start RL":"FW / BW not complete"):pill(ppc.ok===false?"bad":"ok","FW/BW "+(ppc.e>0?"+":"")+ppc.e+" mm")):c.err!=null&&c.perm==null?pill("wait",(c.err>0?"+":"")+c.err+" mm · enter K"):c.err==null?pill("wait",c.done?(c.known==null?"close on a known BM":"enter start RL"):"incomplete"):pill(Math.abs(c.err)<=c.perm?"ok":"bad",(c.err>0?"+":"")+c.err+" mm");
  const bk=document.getElementById("lbook"),fo=document.activeElement&&document.activeElement.dataset?document.activeElement.dataset.h:null,bh=bookHTML(L,c),byK=bookHTML.byK||{};
  L.setups.forEach((u,i)=>{const el=document.getElementById("bk"+i);if(!el)return;const rs=(byK[i]||[]).concat(i===L.setups.length-1?(byK[i+1]||[]):[]);el.innerHTML=rs.length?`<table class="book">${LP.book==="rf"?RF_HEAD:BOOK_HEAD}${rs.join("")}</table>`:""});
  const sb=document.getElementById("lsticky");if(sb){const last=c.rows.length?c.rows[c.rows.length-1]:null;sb.querySelector("span").innerHTML=`Setup ${L.setups.length}${last&&last.rlF!=null?` · RL ${esc(L.setups[L.setups.length-1].fs.p)} <b>${last.rlF.toFixed(3)}</b>`:""}`}
  if(!fo){bk.innerHTML=bh;bk.querySelectorAll("[data-h]").forEach(el=>el.addEventListener("input",()=>{L.hdr=L.hdr||{};L.hdr[el.dataset.h]=el.value;levSave()}))}
  document.getElementById("lsum").innerHTML=
   `<div class="row"><span>ΣBS / ΣFS</span><b>${fm(c.sBS)} / ${fm(c.sFS)}</b></div>
    <div class="row"><span>ΣRise / ΣFall</span><b>${fm(c.sR)} / ${fm(c.sF)}</b></div>
    <div class="row"><span>Arithmetic check</span>${c.arith==null?pill("wait","—"):pill(c.arith?"ok":"bad",c.arith?"ΣBS−ΣFS = ΣR−ΣF = ΔRL":"mismatch")}</div>
    <div class="row"><span>Distance K</span><b>${isMid(L)?(num(L.kKm)!=null?c.K.toFixed(3)+" km (entered)":c.aK&&c.aK.d!=null?c.K.toFixed(4)+(LK==="bloop"?" km (bridge distances)":" km (traverse legs)"):c.aK&&c.aK.miss?"no leg "+esc(c.aK.miss)+": type K":"enter loop length"):c.dist.toFixed(1)+" m = "+c.K.toFixed(4)+" km"}</b></div>
    <div class="row"><span>Permissible ±24√K${ppc?" (FW + BW)":""}</span><b>${ppc?(ppc.perm==null?"—":"±"+ppc.perm.toFixed(1)+" mm"):c.perm==null?"—":"±"+c.perm.toFixed(1)+" mm"}</b></div>
    <div class="row"><span>Closing error</span>${closeTxt}</div>
    ${c.tbm.length?`<div class="row"><span><b>Adjusted RLs</b> (error spread ${isMid(L)?"equally per setup":"by distance"})</span><span></span></div>`:""}${c.tbm.map(t=>`<div class="row"><span>${esc(t.p)}${t.vals.length>1?" · visited "+t.vals.length+"×, averaged":""}</span><span class="big">${t.adj.toFixed(3)}</span></div>`).join("")}`;
  document.getElementById("lbanner").innerHTML=is.length?`<div class="alarm"><h4>⚠ ${is.length} warning${is.length>1?"s":""}</h4><ul>${is.map(x=>`<li>${x}</li>`).join("")}</ul></div>`:
    (ppc?(ppc.ok?`<div class="passbar">✓ FW / BW closed within ±${ppc.perm.toFixed(1)} mm</div>`:""):c.err!=null&&c.perm!=null?`<div class="passbar">✓ Line closed within ±${c.perm.toFixed(1)} mm</div>`:"");
  const st=is.length?"bad":(ppc?ppc.ok:c.err!=null&&c.perm!=null)?"ok":"part";
  if(levLast!==null&&st!==levLast){if(st==="bad")toast("⚠ Levelling check failed",true);else if(st==="ok")toast("✓ Line closed")}
  levLast=st;
}
function renderPeg(){
  levCur=null;backTo=LP.home;homeBtn.classList.remove("hidden");homeBtn.textContent="◀ Levelling";
  title.innerHTML="Two peg test<small>Collimation check · ≥ 1:10000</small>";
  const P=LEV.peg;
  app.innerHTML=`<div id="pbanner"></div>
  <div class="card"><h2>Pegs</h2><div class="row"><span>Distance A–B (m)</span><input class="cfgin" inputmode="decimal" id="pegD" value="${esc(P.d)}" placeholder="40"></div>
    <div class="row"><span>Instrument from near peg (m)</span><input class="cfgin" inputmode="decimal" id="pegN" value="${esc(P.n||"")}" placeholder="4"></div>
    <div class="row"><span>Near setup</span><div class="seg" style="width:210px"><button class="${P.pos!=="out"?"on":""}" onclick="pegPos('in')">Inside</button><button class="${P.pos==="out"?"on":""}" onclick="pegPos('out')">Outside</button></div></div>
    <p class="note">Inside: sights n and D − n, so the error builds up over D − 2n (40 − 2×4 = 32 m). Outside: sights n and D + n, difference D.</p></div>
  <div class="card"><h2>1 · Instrument midway</h2>
    <div class="obs"><label><b>Staff A</b></label>${tmbHTML("mid.a",P.mid.a)}</div>
    <div class="obs"><label><b>Staff B</b></label>${tmbHTML("mid.b",P.mid.b)}</div><div id="pm"></div></div>
  <div class="card"><h2>2 · Instrument near one peg</h2>
    <div class="obs"><label><b>Staff A</b></label>${tmbHTML("near.a",P.near.a)}</div>
    <div class="obs"><label><b>Staff B</b></label>${tmbHTML("near.b",P.near.b)}</div><div id="pn"></div></div>
  <div class="card"><h2>Result</h2><div id="pr"></div></div>`;
  const ins=[...app.querySelectorAll(".tmb input")];
  ins.forEach((el,idx)=>{const [g,s]=el.parentElement.dataset.path.split("."),p=+el.dataset.p;
    const next=()=>{const n=ins[idx+1];if(n){n.focus();n.select()}else el.blur()};
    el.addEventListener("focus",()=>el.select());
    el.addEventListener("input",()=>{el.value=el.value.replace(/[^\d.]/g,"");P[g][s][p]=el.value;el.classList.toggle("err",el.value!==""&&rd(el.value)==null);levSave();updatePeg();
      if(/^\d\.\d{3}$/.test(el.value)||/^\d{4}$/.test(el.value))next()});
    el.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();next()}})});
  document.getElementById("pegD").addEventListener("input",e=>{P.d=e.target.value;levSave();updatePeg()});
  document.getElementById("pegN").addEventListener("input",e=>{P.n=e.target.value;levSave();updatePeg()});
  levLast=null;updatePeg();
}
function pegPos(p){LEV.peg.pos=p;levSave();renderPeg()}
function updatePeg(){const c=pegCalc();
  document.getElementById("pm").innerHTML=wRow("A",c.a1)+wRow("B",c.b1)+(c.h1!=null?`<div class="row"><span>True difference h1</span><b>${c.h1.toFixed(3)}</b></div>`:"");
  document.getElementById("pn").innerHTML=wRow("A",c.a2)+wRow("B",c.b2)+(c.h2!=null?`<div class="row"><span>Apparent difference h2</span><b>${c.h2.toFixed(3)}</b></div>`:"");
  document.getElementById("pr").innerHTML=`<div class="row"><span>Collimation error e = |h1 − h2|</span><b>${c.e==null?"–":(c.e*1000).toFixed(0)+" mm"}</b></div>
    <div class="row"><span>Length for precision ${c.n!=null&&c.d?(c.out?"= D":"= D − 2n = "+c.d+" − 2×"+c.n):"= D"}</span><b>${c.Ld!=null?(+c.Ld.toFixed(3))+" m":"–"}</b></div>
    <div class="row"><span>Precision L / e (≥ 1:10000)</span>${c.prec==null?pill("wait",c.e!=null&&!c.d?"enter distance":"—"):pill(c.ok?"ok":"bad",c.prec===Infinity?"1/∞":"1/"+Math.round(c.prec))}</div>`;
  const bad=[c.a1,c.b1,c.a2,c.b2].some(w=>w&&w.bad)||c.ok===false;
  document.getElementById("pbanner").innerHTML=c.ok===false?`<div class="alarm"><h4>⚠ Collimation worse than 1:10000</h4><ul><li>Ask for the instrument to be adjusted or changed before fly levelling.</li></ul></div>`:c.ok?`<div class="passbar">✓ Instrument OK for levelling</div>`:"";
  const st=bad?"bad":c.ok?"ok":"part";if(levLast!==null&&st!==levLast){if(st==="bad")toast("⚠ Two peg test failed",true);else if(st==="ok")toast("✓ Two peg test passed")}levLast=st}

function clearLev(){if(prompt("Type DELETE to clear all levelling lines and the two peg test on this phone. A backup file is saved first.")==="DELETE"){backup();LEV={lines:[],peg:pegLoad()};levSave();route()}}
function renderLevGuide(){
  backTo=LP.home;homeBtn.classList.remove("hidden");homeBtn.textContent="◀ Levelling";guideBtn.classList.add("hidden");
  title.innerHTML="How to level<small>Auto level · fly levelling · 3-wire</small>";
  const step=(n,h,b)=>`<div class="gstep"><div class="gn">${n}</div><div><b>${h}</b><div>${b}</div></div></div>`;
  app.innerHTML=`
  <div class="card"><h2>Today's job (guideline 10)</h2>
    ${step(1,"Two peg test first","Check the level's collimation before any fly levelling. Must be better than <b>1 : 10000</b>.")}
    ${step(2,"Fly level","Carry the RL from the given <b>BM</b> to your allocated <b>minor traverse</b>, establishing <b>TBMs</b> where needed.")}
    ${step(3,"Three-wire readings","Read top, middle and bottom wire at every staff. The mean of the three is the reading (template method).")}
    ${step(4,"Close the circuit","Come back to the BM (or close on another BM). Closing error within <b>±24√K mm</b>, K = total distance in km.")}
  </div>
  <div class="card"><h2>1 · Two peg test</h2>
    ${step(1,"Pegs","Drive two pegs A and B about <b>40 m</b> apart on fairly level, firm ground. Tape the distance.")}
    ${step(2,"Midway","Set the level exactly halfway (tape or pace). Read staff on A then B, three wires each. h1 = A − B is the <b>true</b> difference (errors cancel).")}
    ${step(3,"Near one peg","Move the level close to one peg, a few metres outside the line. Read A and B again. h2 = A − B is the <b>apparent</b> difference.")}
    ${step(4,"Result","e = |h1 − h2|. Precision = distance ÷ e must be ≥ 10000 (for 40 m: e ≤ 4 mm). If it fails, tell the teacher before levelling.")}
  </div>
  <div class="card"><h2>2 · Set up the auto level</h2>
    ${step(1,"Tripod","Firm ground, legs pressed in, head roughly level. It does <b>not</b> need to be over a point.")}
    ${step(2,"Level","Centre the circular bubble with the three foot screws.")}
    ${step(3,"Focus","Point at the sky: turn the eyepiece until the cross-hairs are sharp. Then focus on the staff.")}
    ${step(4,"Parallax","Move your eye slightly. If the hairs move on the staff, refocus. Parallax gives wrong readings.")}
  </div>
  <div class="card"><h2>3 · One setup (app order)</h2>
    ${step(1,"BS","Sight the staff on the point you came from (BM, TBM or last change point). Read <b>T, M, B</b> aloud; booker repeats.")}
    ${step(2,"Balance","Pace the same distance forward and plant the FS staff. App shows distances = 100 × (T − B); keep BS and FS within <b>±1 m</b>.")}
    ${step(3,"FS",`Sight the new point, read <b>T, M, B</b>. Check T − M ≈ M − B (app flags |${chkLbl()}| > 3 mm).`)}
    ${step(4,"Move","FS staff stays exactly on its point. Level moves ahead; that staff becomes the next BS. Old BS staff walks ahead to the next FS.")}
  </div>
  <div class="card"><h2>4 · Change points and TBMs</h2>
    ${step("•","Change points","Hard, well-defined: rock, peg top, kerb, change plate. Never soft soil or grass.")}
    ${step("•","TBMs","Permanent and findable: paint mark on rock or concrete, peg near your minor stations. Rename the point in the app (TP3 → TBM1) and describe it in the field book.")}
    ${step("•","Sight length","Keep sights short (about 30–50 m) and avoid readings very near the ground (heat shimmer).")}
  </div>
  <div class="card"><h2>5 · Staff handling</h2>
    ${step("•","Extend fully","Every section pulled out until it clicks; check the joints. A half-locked joint shifts every reading.")}
    ${step("•","Plumb","Keep the staff bubble centred. A leaning staff always reads too high.")}
    ${step("•","Base","Staff base clean, standing on the exact point, not beside it.")}
  </div>
  <div class="card"><h2>6 · Limits</h2>
    <div class="row"><span>Two peg collimation</span><b>≥ 1 : 10000</b></div>
    <div class="row"><span>BS vs FS distance</span><b>within ±1 m</b></div>
    <div class="row"><span>Closing error</span><b>±24√K mm</b></div>
    <div class="row"><span>e.g. 1 km there and back</span><b>±24 mm</b></div>
    <div class="row"><span>3-wire |${chkLbl()}|</span><b>≤ 3 mm</b></div>
    <div class="row"><span>Middle reading</span><b>${rngTxt()}${LIM_LEV.warn?" (prefer ≤ "+LIM_LEV.warn+" m)":""}</b></div>
    <div class="row"><span>Arithmetic check</span><b>ΣBS−ΣFS = ΣR−ΣF = ΔRL</b></div>
    <p class="note">Booking formats: 11 (two peg test), 12 (fly levelling).</p>
  </div>
  <div class="card"><h2>7 · Closing the line</h2>
    ${step("✓","Back to BM","On the last setup tap <b>Last FS = BM</b> (or set the other BM and its RL). The app shows the closing error at once.")}
    ${step("✗","Too big?","Look for a red 3-wire or balance warning, or a wrong point name. Re-level the doubtful section before leaving the field.")}
    ${step("⇩","Backup","Save backup after closing each line.")}
  </div>
  <div class="card"><h2>Team roles</h2>
    <div class="row"><span>Level</span><b>reads T, M, B aloud</b></div>
    <div class="row"><span>Booker</span><b>field book, ball pen, reads back</b></div>
    <div class="row"><span>App</span><b>types, calls warnings</b></div>
    <div class="row"><span>2 × staff</span><b>BS and FS, bubble centred</b></div>
  </div>
  <div class="card"><h2>Common mistakes</h2>
    <ul class="glist">
      <li>Reading a stadia hair as the middle hair.</li>
      <li>Parallax not removed: readings change as you move your eye.</li>
      <li>Moving the change-point staff before the next BS is read.</li>
      <li>Touching the tripod between BS and FS.</li>
      <li>Staff sections not locked, staff leaning.</li>
      <li>Very unequal BS and FS distances.</li>
      <li>Forgetting to name and describe TBMs.</li>
    </ul>
  </div>
  <div class="nav"><button class="btn pri" onclick="location.hash='${LP.home}'">Levelling lines</button></div>`;
}


/* --- Field book view: template "Fly Levelling" layout, forward and backward tables --- */
const BOOK_HEAD=`<tr><th rowspan="2">Stations<br>Chainage</th><th colspan="3">BS</th><th rowspan="2">Mean BS</th><th rowspan="2">S1 (T−B)</th><th colspan="3">FS</th><th rowspan="2">Mean FS</th><th rowspan="2">S2 (T−B)</th><th rowspan="2">Rise<br>+</th><th rowspan="2">Fall<br>−</th><th rowspan="2">Elevation<br>(m)</th><th rowspan="2">Stadia Interval<br>S=S1+S2</th><th rowspan="2">Hz. Dst (m)<br>S×100</th><th rowspan="2">Remarks</th></tr><tr><th>Top</th><th>Mid</th><th>Bot</th><th>Top</th><th>Mid</th><th>Bot</th></tr>`;
function bookHTML(L,c){if(LP.book==="rf")return rfBookHTML(L,c);
  const n=L.setups.length;const H=L.hdr||{};
  const head=`<div class="bookhd">${[["obs","Observer"],["rec","Recorder"],["inst","Instrument"],["date","Date"],["wx","Weather"],["temp","Temperature"]].map(([k,l])=>`<label>${l}<input data-h="${k}" value="${esc(H[k]||(k==="date"?new Date().toISOString().slice(0,10):""))}"></label>`).join("")}</div>`;
  if(!n)return head+'<p class="note">Add a setup to see the book table.</p>';
  let turn=-1;for(let i=0;i<n-1;i++){const p=L.setups[i].fs.p;if(p&&!/^TP/i.test(p)&&p!==L.start){turn=i;break}}
  const segs=turn>=0?[[0,turn],[turn+1,n-1]]:[[0,n-1]];
  const f3=x=>x==null?"":x.toFixed(3),cell=x=>`<td>${x??""}</td>`;
  const byK={};bookHTML.byK=byK;
  const res=segs.map(([a,b],si)=>{
    const rows=[];let sBS=0,sFS=0,sR=0,sF=0,sD=0;
    const rl0=a===0?c.rl0:c.rows[a-1].rlF;
    for(let k=a;k<=b+1;k++){
      const B=k<=b?c.rows[k].B:null,F=k>a?c.rows[k-1].F:null,stn=k<=b?L.setups[k].bs.p:L.setups[b].fs.p;
      const br=k<=b?L.setups[k].bs.r||[]:[],fr=k>a?L.setups[k-1].fs.r||[]:[];
      const rise=k>a?c.rows[k-1].rise:null,rl=k===a?rl0:c.rows[k-1].rlF;
      const S1=B&&!B.mid?B.s:null,S2=F&&!F.mid?F.s:null,O=(S1||0)+(S2||0),dist=B||F?O*100:null;
      if(B)sBS+=B.mean;if(F)sFS+=F.mean;if(rise!=null){if(rise>=0)sR+=rise;else sF-=rise}if(dist)sD+=dist;
      const named=stn&&!/^TP/i.test(stn);
      rows.push(`<tr class="${named?"named":""}"><td>${esc(stn||"")}</td>${cell(br[0])}${cell(br[1])}${cell(br[2])}${cell(B?f3(B.mean):"")}${cell(S1!=null?f3(S1):"")}${cell(fr[0])}${cell(fr[1])}${cell(fr[2])}${cell(F?f3(F.mean):"")}${cell(S2!=null?f3(S2):"")}${cell(rise!=null&&rise>=0?f3(rise):"")}${cell(rise!=null&&rise<0?f3(-rise):"")}${cell(f3(rl))}${cell(B||F?f3(O):"")}${cell(dist!=null?dist.toFixed(1):"")}${cell(named?esc(stn):"")}</tr>`);(byK[k]=byK[k]||[]).push(rows[rows.length-1])}
    const d=Math.abs(sR-sF);
    return{a,b,html:`<p class="bookh">${segs.length>1?(si===0?"Forward":"Backward")+": ":""}${esc(L.setups[a].bs.p||"")} → ${esc(L.setups[b].fs.p||"")}</p>
    <div class="bookwrap"><table class="book">${BOOK_HEAD}${rows.join("")}
    <tr class="sum"><td>Sum</td><td></td><td></td><td></td><td>${f3(sBS)}</td><td></td><td></td><td></td><td></td><td>${f3(sFS)}</td><td></td><td>${f3(sR)}</td><td>${f3(sF)}</td><td></td><td></td><td>${sD.toFixed(1)}</td><td></td></tr></table></div>
    <div class="row"><span>|ΣBS − ΣFS|</span><b>${f3(Math.abs(sBS-sFS))}</b></div>
    <div class="row"><span>|ΣRise − ΣFall|</span><b>${f3(d)}</b></div>
    <div class="row"><span>|Last RL − First RL|</span><b>${c.rows[b].rlF!=null&&rl0!=null?f3(Math.abs(c.rows[b].rlF-rl0)):""}</b></div>
    <div class="row"><span>Distance</span><b>${sD.toFixed(1)} m</b></div>`,d,sD,up:sR>sF}});
  let tail="";
  if(res.length===2&&c.rl0!=null&&c.rows[n-1].rlF!=null){const f=res[0],g=res[1],e=Math.round(1000*(f.d-g.d)),k=(f.sD+g.sD)/1000,perm=24*Math.sqrt(k);
    const name=L.setups[turn].fs.p,rl=f.up?c.rl0+(f.d+g.d)/2:c.rl0-(f.d+g.d)/2;
    tail=`<p class="bookh">Error computation</p>
    <div class="row"><span>Error of closure (mm)</span>${pill(Math.abs(e)<=perm?"ok":"bad",(e>0?"+":"")+e+" mm")}</div>
    <div class="row"><span>Loop distance k (km)</span><b>${k.toFixed(4)}</b></div>
    <div class="row"><span>Permissible 24√k</span><b>±${perm.toFixed(3)} mm</b></div>
    <div class="row"><span>RL of ${esc(name)} (mean of fwd and back)</span><span class="big">${rl.toFixed(3)}</span></div>`}
  return head+res.map(r=>r.html).join("")+tail;
}

/* --- Rise and Fall book (format 15), middle hair, corrections spread equally per setup --- */
const RF_HEAD=`<tr><th>Station</th><th>BS</th><th>IS</th><th>FS</th><th>Rise<br>+</th><th>Fall<br>−</th><th>RL (m)</th><th>Correction<br>(m)</th><th>Corrected<br>RL (m)</th><th>Remarks</th></tr>`;
function rfBookHTML(L,c){
  const n=L.setups.length,H=L.hdr||{};
  const head=`<div class="bookhd">${[["obs","Observer"],["rec","Recorder"],["inst","Instrument"],["date","Date"],["wx","Weather"],["temp","Temperature"]].map(([k,l])=>`<label>${l}<input data-h="${k}" value="${esc(H[k]||(k==="date"?new Date().toISOString().slice(0,10):""))}"></label>`).join("")}</div>`;
  if(!n)return head+'<p class="note">Add a setup to see the book table.</p>';
  const f3=x=>x==null?"":x.toFixed(3),cell=x=>`<td>${x??""}</td>`,byK={};bookHTML.byK=byK;
  const e=c.err!=null?c.err/1000:null,rows=[];
  for(let k=0;k<=n;k++){
    const B=k<n?c.rows[k].B:null,F=k>0?c.rows[k-1].F:null,stn=k<n?L.setups[k].bs.p:L.setups[n-1].fs.p;
    const rise=k>0?c.rows[k-1].rise:null,rl=k===0?c.rl0:c.rows[k-1].rlF,corr=e!=null?-e*k/n:null;
    const named=stn&&!/^TP/i.test(stn);
    const tr=`<tr class="${named?"named":""}"><td>${esc(stn||"")}</td>${cell(B?f3(B.m):"")}<td></td>${cell(F?f3(F.m):"")}${cell(rise!=null&&rise>=0?f3(rise):"")}${cell(rise!=null&&rise<0?f3(-rise):"")}${cell(f3(rl))}${cell(corr!=null?(corr>0?"+":"")+f3(corr):"")}${cell(corr!=null&&rl!=null?f3(r3(rl+corr)):"")}${cell(k===0?"Start, RL known":k===n&&c.known!=null?"Close":named?"":"CP")}</tr>`;
    rows.push(tr);(byK[k]=byK[k]||[]).push(tr)}
  const dRL=c.end!=null&&c.rl0!=null?c.end-c.rl0:null;
  return head+`<div class="bookwrap"><table class="book">${RF_HEAD}${rows.join("")}
    <tr class="sum"><td>Σ</td><td>${f3(c.sBS)}</td><td></td><td>${f3(c.sFS)}</td><td>${f3(c.sR)}</td><td>${f3(c.sF)}</td><td></td><td></td><td></td><td></td></tr></table></div>
    <p class="bookh">Arithmetic check</p>
    <div class="row"><span>ΣBS − ΣFS</span><b>${f3(c.sBS-c.sFS)}</b></div>
    <div class="row"><span>ΣRise − ΣFall</span><b>${f3(c.sR-c.sF)}</b></div>
    <div class="row"><span>Last RL − First RL</span><b>${dRL!=null?f3(dRL):""}</b></div>
    ${c.err!=null?`<p class="bookh">Error computation</p>
    <div class="row"><span>Closing error e</span>${c.perm!=null?pill(Math.abs(c.err)<=c.perm?"ok":"bad",(c.err>0?"+":"")+c.err+" mm"):pill("wait",c.err+" mm")}</div>
    <div class="row"><span>K</span><b>${c.K?c.K.toFixed(4)+" km":"–"}</b></div>
    <div class="row"><span>Permissible 24√K</span><b>${c.perm!=null?"±"+c.perm.toFixed(3)+" mm":"–"}</b></div>
    <div class="row"><span>Correction per setup</span><b>${(-c.err/n).toFixed(2)} mm</b></div>`:""}`;
}

/* --- backup / merge / export helpers used by the main script --- */
function levMerge(src){if(src&&!Array.isArray(src.lines))return 0;let n=0;if(!src||!Array.isArray(src.lines))return 0;
  for(const L of src.lines)if(!LEV.lines.some(x=>x.id===L.id)){LEV.lines.push(L);n++}
  const P=LEV.peg,Q=src.peg;if(Q)for(const g of["mid","near"])for(const s of["a","b"])if(!(P[g][s]||[]).some(v=>v)&&(Q[g]&&Q[g][s]||[]).some(v=>v)){P[g][s]=Q[g][s];n++}
  if(Q&&!P.d&&Q.d)P.d=Q.d;if(Q&&!P.n&&Q.n)P.n=Q.n;if(Q&&!P.pos&&Q.pos)P.pos=Q.pos;levSave();return n}
function levCSV(csv){if(!LEV.lines.length)return "";let out="";
  for(const L of LEV.lines){const c=lineCalc(L);
    const rows=[["Station","BS Top","BS Mid","BS Bot","FS Top","FS Mid","FS Bot","RL"]];
    L.setups.forEach((u,i)=>{const prevFS=i>0?L.setups[i-1].fs:null;const b=u.bs.r||[],f=prevFS?prevFS.r||[]:[];
      rows.push([u.bs.p,b[0]??"",b[1]??"",b[2]??"",f[0]??"",f[1]??"",f[2]??"",i===0?(L.rl||""):fm(c.rows[i-1].rlF)])});
    if(L.setups.length){const u=L.setups[L.setups.length-1],f=u.fs.r||[];rows.push([u.fs.p,"","","",f[0]??"",f[1]??"",f[2]??"",fm(c.end)])}
    out+=`\n\nFLY LEVELLING: ${L.name} (template Fly Levelling rows: BS in B:D, FS in G:I)\n`+rows.map(csv).join("\n")}
  return out+"\n"}
