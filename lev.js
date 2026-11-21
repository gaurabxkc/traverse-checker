"use strict";
/* ===== Levelling module: fly levelling (3-wire) + two peg test. Same maths as the template sheets. ===== */
const LEV_KEY="lev-v1";
const LIM_LEV={wire:0.003,balance:1,k:24,peg:10000}; // 3-wire |(T+B)/2-M| (app default), BS/FS sight balance ±1 m, 24√K mm, two peg 1:10000
let LEV;
try{LEV=JSON.parse(localStorage.getItem(LEV_KEY))}catch(e){LEV=null}
if(!LEV||!Array.isArray(LEV.lines))LEV={lines:[],peg:{d:"",mid:{a:[],b:[]},near:{a:[],b:[]}}};
if(!LEV.peg)LEV.peg={d:"",mid:{a:[],b:[]},near:{a:[],b:[]}};
function levSave(){try{localStorage.setItem(LEV_KEY,JSON.stringify(LEV));localStorage.setItem(TS_KEY,new Date().toISOString())}catch(e){alert("Could not save on this phone! Make a backup now.")}}
function setMod(m){try{localStorage.setItem("trav-mod",m)}catch(e){}}
function lastMod(){try{return localStorage.getItem("trav-mod")||"trav"}catch(e){return "trav"}}
function modSwitch(m){return `<div class="seg" style="margin-bottom:14px"><button class="${m==="trav"?"on":""}" onclick="setMod('trav');location.hash=''">Traverse</button><button class="${m==="lev"?"on":""}" onclick="setMod('lev');location.hash='lev'">Levelling</button></div>`}

/* --- maths --- */
function rd(v){ // staff reading: "1.951" metres, or "1951" millimetres
  if(v==null||v==="")return null;v=String(v).trim();
  if(/^\d+$/.test(v)&&v.length>=4)return +v/1000;
  if(/^\d*\.?\d+$/.test(v)||/^\d+\.$/.test(v))return +v;return null}
const r3=x=>Math.round(x*1000)/1000;
function w3(a){ // [T,M,B] -> mean (template: ROUND(AVERAGE,3)), stadia, checks
  const t=rd(a&&a[0]),m=rd(a&&a[1]),b=rd(a&&a[2]);
  if(t==null||m==null||b==null)return null;
  const mean=r3((t+m+b)/3),s=t-b,chk=(t+b)/2-m;
  return{t,m,b,mean,s,dist:s*100,chk,order:t>=m&&m>=b,bad:Math.abs(chk)>LIM_LEV.wire+1e-9||!(t>=m&&m>=b)}}
function lineCalc(L){
  const rl0=num(L.rl);let rl=rl0,sBS=0,sFS=0,sR=0,sF=0,dist=0;const rows=[];
  L.setups.forEach((u,i)=>{
    const B=w3(u.bs.r),F=w3(u.fs.r);let rise=null,rlF=null,bal=null;
    if(B&&F){rise=r3(B.mean-F.mean);if(rl!=null){rlF=r3(rl+rise)}sBS+=B.mean;sFS+=F.mean;if(rise>=0)sR+=rise;else sF+=-rise}
    if(B)dist+=B.dist;if(F)dist+=F.dist;
    if(B&&F)bal=Math.abs(B.dist-F.dist);
    rows.push({B,F,rise,rlBS:rl,rlF,bal,balBad:bal!=null&&bal>LIM_LEV.balance+1e-9});
    rl=(B&&F)?rlF:null;
  });
  const done=rows.length&&rows.every(r=>r.rlF!=null);
  const end=done?rows[rows.length-1].rlF:null,last=L.setups.length?L.setups[L.setups.length-1].fs.p:"";
  let known=null;if(last&&last===L.start)known=rl0;else if(num(L.closeRl)!=null&&last===L.closeP)known=num(L.closeRl);
  const K=dist/1000,perm=LIM_LEV.k*Math.sqrt(K),err=(done&&known!=null&&rl0!=null)?Math.round((end-known)*1000):null;
  // TBMs on a there-and-back line: template method RL = RL0 + (Δto - Δback)/2
  const tbm=[];
  if(done&&last===L.start&&rl0!=null)L.setups.forEach((u,i)=>{const p=u.fs.p;if(i<L.setups.length-1&&p&&!/^TP/i.test(p)&&p!==L.start&&!tbm.some(x=>x.p===p)){
    const to=rows[i].rlF-rl0,back=end-rows[i].rlF;tbm.push({p,fwd:rows[i].rlF,mean:r3(rl0+(to-back)/2)})}});
  return{rows,sBS:r3(sBS),sFS:r3(sFS),sR:r3(sR),sF:r3(sF),dist,K,perm,err,end,known,done,rl0,tbm,
    arith:done&&rl0!=null?Math.abs((sBS-sFS)-(sR-sF))<0.0015&&Math.abs((sBS-sFS)-(end-rl0))<0.0015:null};
}
function levIssues(L){const c=lineCalc(L),o=[];
  c.rows.forEach((r,i)=>{const n=i+1;
    if(r.B&&r.B.bad)o.push(`Setup ${n} BS: ${!r.B.order?"T ≥ M ≥ B not satisfied":"(T+B)/2 − M = "+(r.B.chk*1000).toFixed(1)+" mm"}`);
    if(r.F&&r.F.bad)o.push(`Setup ${n} FS: ${!r.F.order?"T ≥ M ≥ B not satisfied":"(T+B)/2 − M = "+(r.F.chk*1000).toFixed(1)+" mm"}`);
    if(r.balBad)o.push(`Setup ${n}: BS ${r.B.dist.toFixed(1)} m vs FS ${r.F.dist.toFixed(1)} m (balance ±1 m)`)});
  if(c.err!=null&&Math.abs(c.err)>c.perm)o.push(`Closing error ${c.err} mm exceeds ±${c.perm.toFixed(1)} mm`);
  if(c.arith===false)o.push("Arithmetic check fails (ΣBS−ΣFS ≠ ΣRise−ΣFall)");
  return o}
function pegCalc(){const P=LEV.peg,a1=w3(P.mid.a),b1=w3(P.mid.b),a2=w3(P.near.a),b2=w3(P.near.b),d=num(P.d);
  const h1=a1&&b1?r3(a1.mean-b1.mean):null,h2=a2&&b2?r3(a2.mean-b2.mean):null;
  const e=h1!=null&&h2!=null?Math.abs(h1-h2):null,prec=e!=null&&d?(e<0.0005?Infinity:d/e):null;
  return{a1,b1,a2,b2,h1,h2,e,d,prec,ok:prec==null?null:prec>=LIM_LEV.peg}}

/* --- UI --- */
let levCur=null,levLast=null;
const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function renderLev(h){
  setMod("lev");guideBtn.classList.remove("hidden");
  const part=h.split("/")[1];
  if(part==="guide")return renderLevGuide();
  if(part==="peg")return renderPeg();
  const L=LEV.lines.find(x=>x.id===part);
  if(L)return renderLine(L);
  levCur=null;backTo="";homeBtn.classList.remove("hidden");homeBtn.textContent="◀ Home";
  title.innerHTML="Levelling<small>Fly levelling · two peg test</small>";
  const pc=pegCalc();
  const cards=LEV.lines.map(L=>{const c=lineCalc(L),is=levIssues(L);
    const st=is.length?pill("bad",is.length+" warning"+(is.length>1?"s":"")):c.err!=null?pill("ok","closed "+(c.err>0?"+":"")+c.err+" mm"):pill("wait",L.setups.length+" setups");
    return `<button class="lcard${is.length?" bad":""}" onclick="location.hash='lev/${L.id}'"><div><b>${esc(L.name||"Line")}</b><small>${esc(L.start||"?")} → ${esc(L.setups.length?L.setups[L.setups.length-1].fs.p:"…")} · ${c.dist?c.dist.toFixed(0)+" m":"no readings"}</small></div>${st}</button>`}).join("");
  app.innerHTML=`
  <div class="card"><h2>Two peg test (before levelling)</h2>
    <div class="row"><span>Collimation precision (≥ 1:10000)</span>${pc.prec==null?pill("wait","not done"):pill(pc.ok?"ok":"bad",pc.prec===Infinity?"1/∞":"1/"+Math.round(pc.prec))}</div>
    <div class="btns" style="margin-top:8px"><button class="btn" onclick="location.hash='lev/peg'">Open two peg test</button></div></div>
  <div class="card"><h2>Levelling lines</h2>${cards||'<p class="note">No lines yet. A line starts on a BM of known RL; go to your TBMs and come back (or close on another BM).</p>'}
    <div class="btns" style="margin-top:10px"><button class="btn pri" onclick="addLine()">+ New line</button></div></div>
  <div class="card"><h2>Limits</h2>
    <div class="row"><span>Closing error</span><b>±24√K mm</b></div>
    <div class="row"><span>BS / FS sight distance</span><b>within ±1 m</b></div>
    <div class="row"><span>Two peg collimation</span><b>≥ 1 : 10000</b></div>
    <div class="row"><span>3-wire check |(T+B)/2 − M|</span><b>≤ 3 mm</b></div>
    <p class="note">The first three are from the guidelines. The 3 mm 3-wire limit is this app's default (the guidelines give none).</p></div>
  <div class="card"><h2>Data safety</h2><p class="note">Backup, merge and Excel export on the Traverse screen include levelling too.</p>
    <div class="btns" style="margin-top:8px"><button class="btn pri" onclick="backup()">Save backup</button><button class="btn" onclick="exportCSV()">Excel export</button></div>
    <div class="btns" style="margin-top:10px"><button class="btn" onclick="clearLev()">Clear levelling data…</button></div></div>`;
}
function addLine(){const n=LEV.lines.length+1;const L={id:newId(),name:"Line "+n,start:"BM",rl:"",closeP:"",closeRl:"",setups:[]};
  LEV.lines.push(L);levSave();location.hash="lev/"+L.id}
function tmbHTML(path,v){v=v||[];return `<div class="tmb" data-path="${path}">${["T","M","B"].map((l,p)=>`<input inputmode="decimal" enterkeyhint="next" placeholder="${l}" data-p="${p}" value="${esc(v[p]??"")}">`).join("")}</div>`}
function renderLine(L){
  levCur=L;levLast=null;backTo="lev";homeBtn.classList.remove("hidden");homeBtn.textContent="◀ Lines";
  title.innerHTML=`${esc(L.name)}<small>Fly levelling · 3-wire</small>`;
  const setups=L.setups.map((u,i)=>`<div class="card" id="su${i}"><h2>Setup ${i+1}</h2>
    <div class="obs"><label><b>BS</b> → ${esc(u.bs.p||"?")}</label>${tmbHTML(i+".bs",u.bs.r)}</div>
    <div class="obs"><label><b>FS</b> → <input class="pt" data-pt="${i}" value="${esc(u.fs.p)}" maxlength="10"></label>${tmbHTML(i+".fs",u.fs.r)}</div>
    <div id="sr${i}"></div></div>`).join("");
  app.innerHTML=`<div id="lbanner"></div>
  <div class="card"><h2>Line</h2>
    <div class="row"><span>Name</span><input class="cfgin" data-f="name" value="${esc(L.name)}"></div>
    <div class="row"><span>Start point (BM)</span><input class="cfgin" data-f="start" value="${esc(L.start)}"></div>
    <div class="row"><span>RL of start (m)</span><input class="cfgin" inputmode="decimal" data-f="rl" value="${esc(L.rl)}" placeholder="1312.034"></div>
    <div class="row"><span>Close on other BM</span><input class="cfgin" data-f="closeP" value="${esc(L.closeP)}" placeholder="(blank = start)"></div>
    <div class="row"><span>Its RL (m)</span><input class="cfgin" inputmode="decimal" data-f="closeRl" value="${esc(L.closeRl)}" placeholder="only if other BM"></div>
    <p class="note">Coming back to the start point closes the line automatically: name the last FS point the same as the start.</p></div>
  ${setups}
  <div class="btns" style="margin-bottom:14px"><button class="btn pri" onclick="addSetup()">+ Add setup</button>${L.setups.length?`<button class="btn" onclick="closeToStart()">Last FS = ${esc(L.start)}</button>`:""}</div>
  <div class="card"><h2>Summary</h2><div id="lsum"></div></div>
  <div class="btns" style="margin-bottom:14px">${L.setups.length?'<button class="btn" onclick="delSetup()">Delete last setup…</button>':""}<button class="btn" onclick="delLine()">Delete line…</button></div>`;
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
  app.querySelectorAll("[data-f]").forEach(el=>el.addEventListener("input",()=>{L[el.dataset.f]=el.value.trim();levSave();updateLine();
    if(el.dataset.f==="name")title.innerHTML=`${esc(L.name)}<small>Fly levelling · 3-wire</small>`;
    if(el.dataset.f==="start"&&L.setups[0]){L.setups[0].bs.p=L.start;levSave()}}));
  app.querySelectorAll("[data-pt]").forEach(el=>el.addEventListener("input",()=>{const i=+el.dataset.pt;el.value=el.value.toUpperCase();L.setups[i].fs.p=el.value.trim();
    if(L.setups[i+1])L.setups[i+1].bs.p=L.setups[i].fs.p;levSave();
    const lab=document.querySelector(`#su${i+1} .obs label`);if(lab)lab.innerHTML=`<b>BS</b> → ${esc(L.setups[i].fs.p||"?")}`;updateLine()}));
}
function addSetup(){const L=levCur,prev=L.setups[L.setups.length-1];
  const tp=L.setups.filter(u=>/^TP\d+$/i.test(u.fs.p)).length+1;
  L.setups.push({bs:{p:prev?prev.fs.p:L.start,r:[]},fs:{p:"TP"+tp,r:[]}});levSave();renderLine(L);
  const n=L.setups.length-1,el=document.querySelector(`#su${n}`);if(el){el.scrollIntoView({behavior:"smooth",block:"start"});const f=el.querySelector(".tmb input");if(f)setTimeout(()=>f.focus(),300)}}
function closeToStart(){const L=levCur,u=L.setups[L.setups.length-1];u.fs.p=L.start;levSave();renderLine(L)}
function delSetup(){const L=levCur;if(confirm("Delete setup "+L.setups.length+" and its readings?")){L.setups.pop();levSave();renderLine(L)}}
function delLine(){const L=levCur;if(prompt('Type DELETE to remove "'+L.name+'" and all its readings.')==="DELETE"){LEV.lines=LEV.lines.filter(x=>x!==L);levSave();location.hash="lev"}}
const fm=x=>x==null?"–":x.toFixed(3);
function wRow(lbl,w){if(!w)return "";return `<div class="row"><span>${lbl} mean ${fm(w.mean)} · ${w.dist.toFixed(1)} m</span>${w.bad?pill("bad",!w.order?"T≥M≥B?":(w.chk>0?"+":"")+(w.chk*1000).toFixed(1)+" mm"):pill("ok","3-wire ✓")}</div>`}
function updateLine(){
  const L=levCur,c=lineCalc(L),is=levIssues(L);
  c.rows.forEach((r,i)=>{const el=document.getElementById("sr"+i);if(!el)return;
    el.innerHTML=wRow("BS",r.B)+wRow("FS",r.F)+
    (r.bal!=null?`<div class="row"><span>Sight balance (±1 m)</span>${pill(r.balBad?"bad":"ok","Δ "+r.bal.toFixed(1)+" m")}</div>`:"")+
    (r.rise!=null?`<div class="row"><span>${r.rise>=0?"Rise":"Fall"}</span><b>${Math.abs(r.rise).toFixed(3)}</b></div>`:"")+
    `<div class="row"><span>RL of ${esc(L.setups[i].fs.p||"FS")}</span><span class="big">${fm(r.rlF)}</span></div>`});
  const closeTxt=c.err==null?pill("wait",c.done?(c.known==null?"close on a known BM":"enter start RL"):"incomplete"):pill(Math.abs(c.err)<=c.perm?"ok":"bad",(c.err>0?"+":"")+c.err+" mm");
  document.getElementById("lsum").innerHTML=
   `<div class="row"><span>ΣBS / ΣFS</span><b>${fm(c.sBS)} / ${fm(c.sFS)}</b></div>
    <div class="row"><span>ΣRise / ΣFall</span><b>${fm(c.sR)} / ${fm(c.sF)}</b></div>
    <div class="row"><span>Arithmetic check</span>${c.arith==null?pill("wait","—"):pill(c.arith?"ok":"bad",c.arith?"ΣBS−ΣFS = ΣR−ΣF = ΔRL":"mismatch")}</div>
    <div class="row"><span>Distance K</span><b>${c.dist.toFixed(1)} m = ${c.K.toFixed(4)} km</b></div>
    <div class="row"><span>Permissible ±24√K</span><b>±${c.perm.toFixed(1)} mm</b></div>
    <div class="row"><span>Closing error</span>${closeTxt}</div>
    ${c.tbm.map(t=>`<div class="row"><span>RL ${esc(t.p)} (mean of there &amp; back)</span><span class="big">${t.mean.toFixed(3)}</span></div>`).join("")}`;
  document.getElementById("lbanner").innerHTML=is.length?`<div class="alarm"><h4>⚠ ${is.length} warning${is.length>1?"s":""}</h4><ul>${is.map(x=>`<li>${x}</li>`).join("")}</ul></div>`:
    (c.err!=null?`<div class="passbar">✓ Line closed within ±${c.perm.toFixed(1)} mm</div>`:"");
  const st=is.length?"bad":c.err!=null?"ok":"part";
  if(levLast!==null&&st!==levLast){if(st==="bad")toast("⚠ Levelling check failed",true);else if(st==="ok")toast("✓ Line closed")}
  levLast=st;
}
function renderPeg(){
  levCur=null;backTo="lev";homeBtn.classList.remove("hidden");homeBtn.textContent="◀ Levelling";
  title.innerHTML="Two peg test<small>Collimation check · ≥ 1:10000</small>";
  const P=LEV.peg;
  app.innerHTML=`<div id="pbanner"></div>
  <div class="card"><h2>Pegs</h2><div class="row"><span>Distance A–B (m)</span><input class="cfgin" inputmode="decimal" id="pegD" value="${esc(P.d)}" placeholder="40"></div></div>
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
  levLast=null;updatePeg();
}
function updatePeg(){const c=pegCalc();
  document.getElementById("pm").innerHTML=wRow("A",c.a1)+wRow("B",c.b1)+(c.h1!=null?`<div class="row"><span>True difference h1</span><b>${c.h1.toFixed(3)}</b></div>`:"");
  document.getElementById("pn").innerHTML=wRow("A",c.a2)+wRow("B",c.b2)+(c.h2!=null?`<div class="row"><span>Apparent difference h2</span><b>${c.h2.toFixed(3)}</b></div>`:"");
  document.getElementById("pr").innerHTML=`<div class="row"><span>Collimation error e = |h1 − h2|</span><b>${c.e==null?"–":(c.e*1000).toFixed(0)+" mm"}</b></div>
    <div class="row"><span>Precision d / e (≥ 1:10000)</span>${c.prec==null?pill("wait",c.e!=null&&!c.d?"enter distance":"—"):pill(c.ok?"ok":"bad",c.prec===Infinity?"1/∞":"1/"+Math.round(c.prec))}</div>`;
  const bad=[c.a1,c.b1,c.a2,c.b2].some(w=>w&&w.bad)||c.ok===false;
  document.getElementById("pbanner").innerHTML=c.ok===false?`<div class="alarm"><h4>⚠ Collimation worse than 1:10000</h4><ul><li>Ask for the instrument to be adjusted or changed before fly levelling.</li></ul></div>`:c.ok?`<div class="passbar">✓ Instrument OK for levelling</div>`:"";
  const st=bad?"bad":c.ok?"ok":"part";if(levLast!==null&&st!==levLast){if(st==="bad")toast("⚠ Two peg test failed",true);else if(st==="ok")toast("✓ Two peg test passed")}levLast=st}

function clearLev(){if(prompt("Type DELETE to clear all levelling lines and the two peg test on this phone. A backup file is saved first.")==="DELETE"){backup();LEV={lines:[],peg:{d:"",mid:{a:[],b:[]},near:{a:[],b:[]}}};levSave();route()}}
function renderLevGuide(){
  backTo="lev";homeBtn.classList.remove("hidden");homeBtn.textContent="◀ Levelling";guideBtn.classList.add("hidden");
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
    ${step(3,"FS","Sight the new point, read <b>T, M, B</b>. Check T − M ≈ M − B (app flags > 3 mm).")}
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
    <div class="row"><span>3-wire |(T+B)/2 − M|</span><b>≤ 3 mm (app)</b></div>
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
  <div class="nav"><button class="btn pri" onclick="location.hash='lev'">Levelling lines</button></div>`;
}

/* --- backup / merge / export helpers used by the main script --- */
function levMerge(src){let n=0;if(!src||!Array.isArray(src.lines))return 0;
  for(const L of src.lines)if(!LEV.lines.some(x=>x.id===L.id)){LEV.lines.push(L);n++}
  const P=LEV.peg,Q=src.peg;if(Q)for(const g of["mid","near"])for(const s of["a","b"])if(!(P[g][s]||[]).some(v=>v)&&(Q[g]&&Q[g][s]||[]).some(v=>v)){P[g][s]=Q[g][s];n++}
  if(Q&&!P.d&&Q.d)P.d=Q.d;levSave();return n}
function levCSV(csv){if(!LEV.lines.length)return "";let out="";
  for(const L of LEV.lines){const c=lineCalc(L);
    const rows=[["Station","BS Top","BS Mid","BS Bot","FS Top","FS Mid","FS Bot","RL"]];
    L.setups.forEach((u,i)=>{const prevFS=i>0?L.setups[i-1].fs:null;const b=u.bs.r||[],f=prevFS?prevFS.r||[]:[];
      rows.push([u.bs.p,b[0]??"",b[1]??"",b[2]??"",f[0]??"",f[1]??"",f[2]??"",i===0?(L.rl||""):fm(c.rows[i-1].rlF)])});
    if(L.setups.length){const u=L.setups[L.setups.length-1],f=u.fs.r||[];rows.push([u.fs.p,"","","",f[0]??"",f[1]??"",f[2]??"",fm(c.end)])}
    out+=`\n\nFLY LEVELLING: ${L.name} (template Fly Levelling rows: BS in B:D, FS in G:I)\n`+rows.map(csv).join("\n")}
  return out+"\n"}
