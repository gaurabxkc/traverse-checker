"use strict";
/* ===== Bridge site survey: base lines, triangle angles (2 sets base / 1 set others), angle correction + sine rule (axis length),
   station coordinates, reciprocal levelling, hydrology. Maths follows the template sheets
   "Bridge Site Base Triangles", "Bridge Site Triangulation", "Bridge Site Angle Correction", "Reciprocal Levelling". ===== */
const BR_KEY="br-v1";
const BR_LIM={wcMin:30,wcMax:120,face:20,set:60,base:30,other:60,axis:2000,tape:2000,edm:5000,k:24,wire:0.003};
let BR;
function brBlank(){return{axis:["A","B"],obs:[],bases:[],tris:[],start:{N:"",E:"",brg:["","",""]},
  rec:{s1:{a:["","",""],b:["","",""]},s2:{a:["","",""],b:["","",""]},rlA:"",L:""},
  hyd:{dist:"",times:[""],k:"0.85",hfl:"",nwl:"",lwl:"",bed:"",note:""}}}
function brLoad(){try{BR=JSON.parse(localStorage.getItem(BR_KEY))}catch(e){BR=null}const b=brBlank();if(!BR||!Array.isArray(BR.obs))BR=b;
  for(const k in b)if(BR[k]==null)BR[k]=b[k];for(const k in b.rec)if(BR.rec[k]==null)BR.rec[k]=b.rec[k];for(const k in b.hyd)if(BR.hyd[k]==null)BR.hyd[k]=b.hyd[k]}
function brSave(){try{localStorage.setItem(BR_KEY,JSON.stringify(BR));localStorage.setItem(TS_KEY,new Date().toISOString())}catch(e){alert("Could not save on this phone! Make a backup now.")}}
brLoad();

/* --- maths --- */
const bNum=v=>v==null||v===""||isNaN(+v)?null:+v;
function bDeg(a){if(!a)return null;const d=bNum(a[0]),m=bNum(a[1]),s=bNum(a[2]);if(d==null&&m==null&&s==null)return null;if(d==null)return null;return d+(m||0)/60+(s||0)/3600}
const n360=x=>((x%360)+360)%360;
function bDms(x,sec){if(x==null)return "–";const neg=x<0;let t=Math.round(Math.abs(x)*3600);const d=Math.floor(t/3600),m=Math.floor(t%3600/60),s=t%60;
  return (neg?"−":"")+`${d}° ${String(m).padStart(2,"0")}′ ${String(s).padStart(2,"0")}″`}
const sTxt=s=>(s>0?"+":s<0?"−":"±")+Math.abs(Math.round(s))+"″";
// one set: FL BS, FL FS, FR BS, FR FS -> face angles + mean (template: FS − BS, +360 if negative)
function brSetCalc(S){if(!S)return null;const a=bDeg(S.lb),b=bDeg(S.lf),c=bDeg(S.rb),d=bDeg(S.rf);
  const L=a!=null&&b!=null?n360(b-a):null,R=c!=null&&d!=null?n360(d-c):null;
  if(L==null&&R==null)return null;const mean=L!=null&&R!=null?(L+R)/2:null;const fd=L!=null&&R!=null?(L-R)*3600:null;
  return{L,R,mean,fd,faceBad:fd!=null&&Math.abs(fd)>BR_LIM.face+1e-6}}
function obsCalc(o){const s=o.sets.map(brSetCalc);const ms=s.filter(x=>x&&x.mean!=null).map(x=>x.mean);
  const need=o.base?2:1,mean=ms.length?ms.reduce((p,q)=>p+q,0)/ms.length:null;
  const sd=ms.length>=2?(ms[0]-ms[1])*3600:null;
  return{s,mean,sd,setBad:sd!=null&&Math.abs(sd)>BR_LIM.set+1e-6,done:ms.length>=need,need,interior:mean==null?null:mean>180?360-mean:mean,refl:mean!=null&&mean>180}}
const pairKey=(a,b)=>[a,b].sort().join("|");
function findObs(v,p,q){return BR.obs.find(o=>o.at===v&&((o.bs===p&&o.fs===q)||(o.bs===q&&o.fs===p)))}
function baseCalc(b){const f=bNum(b.fw),w=bNum(b.bw);if(f==null&&w==null)return null;const mean=f!=null&&w!=null?(f+w)/2:(f??w);
  const lim=b.mode==="edm"?BR_LIM.edm:BR_LIM.tape;const prec=f!=null&&w!=null?(Math.abs(f-w)<1e-9?Infinity:mean/Math.abs(f-w)):null;
  return{mean,prec,lim,bad:prec!=null&&prec<lim}}
// template "Angle Correction": angles to whole seconds, error = sum − 180°, correction spread equally in whole seconds, the odd seconds go to the largest angles
function triCalc(t){const ang=t.p.map((v,i)=>{const o=findObs(v,t.p[(i+1)%3],t.p[(i+2)%3]);return o?{o,c:obsCalc(o)}:null});
  if(ang.some(a=>!a||a.c.interior==null))return{t,ang,ready:false,missing:t.p.filter((v,i)=>!ang[i]||ang[i].c.interior==null)};
  const sec=ang.map(a=>Math.round(a.c.interior*3600)),err=sec[0]+sec[1]+sec[2]-180*3600,C=-err;
  const base=C<0?-Math.floor(-C/3):Math.floor(C/3),rem=C-3*base;
  const order=[0,1,2].sort((i,j)=>sec[j]-sec[i]);const corr=[base,base,base];for(let k=0;k<Math.abs(rem);k++)corr[order[k]]+=Math.sign(rem);
  const lim=(t.base?BR_LIM.base:BR_LIM.other)*Math.sqrt(3);
  const adj=sec.map((s,i)=>(s+corr[i])/3600),ill=adj.map(a=>a<BR_LIM.wcMin||a>BR_LIM.wcMax);
  return{t,ang,ready:true,obs:sec.map(s=>s/3600),err,corr,adj,ill,lim,bad:Math.abs(err)>lim+1e-6}}
// sides by sine rule. Side opposite vertex i = k·sin(A_i). Axis: one value from each base triangle using only measured base lines.
function brSolve(){const tc=BR.tris.map(triCalc),meas={};
  for(const b of BR.bases){const c=baseCalc(b);if(c&&b.a&&b.b)meas[pairKey(b.a,b.b)]=c.mean}
  const ax=pairKey(BR.axis[0],BR.axis[1]),axVals=[];const sides={},src={};
  const sideOf=(T,i)=>pairKey(T.t.p[(i+1)%3],T.t.p[(i+2)%3]);
  const solve=(T,known)=>{for(let i=0;i<3;i++){const k=sideOf(T,i);if(known[k]!=null){const f=known[k]/Math.sin(T.adj[i]*Math.PI/180);return[0,1,2].map(j=>({key:sideOf(T,j),len:f*Math.sin(T.adj[j]*Math.PI/180),from:k}))}}return null};
  tc.forEach(T=>{if(!T.ready||!T.t.base)return;const k3=[0,1,2].map(i=>sideOf(T,i));if(!k3.includes(ax))return;
    const m={};for(const k of k3)if(k!==ax&&meas[k]!=null)m[k]=meas[k];const r=solve(T,m);if(r){const a=r.find(x=>x.key===ax);axVals.push({tri:T.t.p.join(""),len:a.len,from:a.from})}});
  const axMean=axVals.length?axVals.reduce((p,q)=>p+q.len,0)/axVals.length:null;
  const axDiff=axVals.length>=2?Math.abs(axVals[0].len-axVals[1].len):null,axPrec=axDiff==null?null:axDiff<1e-9?Infinity:axMean/axDiff;
  Object.assign(sides,meas);for(const k in meas)src[k]="measured";if(axMean!=null&&sides[ax]==null){sides[ax]=axMean;src[ax]="axis mean"}
  const acc={};let again=true,guard=0;const used=new Set();
  while(again&&guard++<20){again=false;tc.forEach((T,ti)=>{if(!T.ready||used.has(ti))return;const r=solve(T,sides);if(!r)return;used.add(ti);again=true;
    r.forEach(x=>{if(src[x.key]==="measured"||src[x.key]==="axis mean")return;(acc[x.key]=acc[x.key]||[]).push(x.len);sides[x.key]=acc[x.key].reduce((p,q)=>p+q,0)/acc[x.key].length;src[x.key]="computed"})})}
  return{tc,meas,axVals,axMean,axPrec,axBad:axPrec!=null&&axPrec<BR_LIM.axis,sides,src}}
// coordinates: A (N, E) + bearing A→B, then each triangle places its third point from a vertex with two known points
function brCoords(sol){const N0=bNum(BR.start.N),E0=bNum(BR.start.E),b0=bDeg(BR.start.brg);const X={};
  const [A,B]=BR.axis;if(N0==null||E0==null||b0==null||sol.axMean==null)return X;
  X[A]={N:N0,E:E0};X[B]={N:N0+sol.axMean*Math.cos(b0*Math.PI/180),E:E0+sol.axMean*Math.sin(b0*Math.PI/180)};
  const brg=(p,q)=>n360(Math.atan2(X[q].E-X[p].E,X[q].N-X[p].N)*180/Math.PI);
  let again=true,g=0;while(again&&g++<20){again=false;for(const T of sol.tc){if(!T.ready)continue;const p=T.t.p,miss=p.filter(v=>!X[v]);if(miss.length!==1)continue;
    const r=miss[0],i=p.indexOf(r),P=p[(i+1)%3],Q=p[(i+2)%3],d=sol.sides[pairKey(P,r)];if(d==null)continue;
    const iP=p.indexOf(P),o=findObs(P,Q,r);if(!o)continue;const c=obsCalc(o);const ang=c.refl?360-T.adj[iP]:T.adj[iP];
    const az=o.bs===Q?brg(P,Q)+ang:brg(P,Q)-ang;X[r]={N:X[P].N+d*Math.cos(az*Math.PI/180),E:X[P].E+d*Math.sin(az*Math.PI/180)};again=true}}
  return X}
// reciprocal levelling (3-wire): h = mean on A − mean on B in each set (= rise A→B); true = average; error = h1 − h2
function brWire(a){const t=rd(a[0]),m=rd(a[1]),b=rd(a[2]);if(m==null)return null;const full=t!=null&&b!=null;const mean=full?r3((t+m+b)/3):m;
  return{mean,dist:full?Math.abs(t-b)*100:null,chk:full?Math.abs((t+b)/2-m):null,bad:full&&Math.abs((t+b)/2-m)>BR_LIM.wire+1e-9}}
function recCalc(sol){const R=BR.rec,a1=brWire(R.s1.a),b1=brWire(R.s1.b),a2=brWire(R.s2.a),b2=brWire(R.s2.b);
  const h1=a1&&b1?a1.mean-b1.mean:null,h2=a2&&b2?a2.mean-b2.mean:null;
  const L=bNum(R.L)??(sol&&sol.axMean);const K=L?2*L/1000:null,perm=K?BR_LIM.k*Math.sqrt(K):null;
  const err=h1!=null&&h2!=null?(h1-h2)*1000:null,dh=h1!=null&&h2!=null?(h1+h2)/2:null;
  const kr=typeof knownRL==="function"?knownRL(BR.axis[0]):null,rlA=bNum(R.rlA)??(kr?kr.rl:null);
  return{a1,b1,a2,b2,h1,h2,L,K,perm,err,dh,rlA,rlFrom:bNum(R.rlA)!=null?"typed":kr?kr.line:null,rlB:rlA!=null&&dh!=null?rlA+dh:null,bad:err!=null&&perm!=null&&Math.abs(err)>perm+1e-9}}
function hydCalc(){const H=BR.hyd,d=bNum(H.dist),ts=H.times.map(bNum).filter(x=>x!=null&&x>0);const vs=d?ts.map(t=>d/t):[];
  const vs_=vs.length?vs.reduce((p,q)=>p+q,0)/vs.length:null,k=bNum(H.k)??0.85;return{vs,vsurf:vs_,vmean:vs_!=null?vs_*k:null,k}}
function brIssues(sol){sol=sol||brSolve();const o=[];
  BR.bases.forEach(b=>{const c=baseCalc(b);if(c&&c.bad)o.push(`Base ${b.a}${b.b}: 1:${Math.round(c.prec)} (needs 1:${c.lim})`)});
  BR.obs.forEach(x=>{const c=obsCalc(x),n=`∠${x.bs}${x.at}${x.fs}`;c.s.forEach((s,i)=>{if(s&&s.faceBad)o.push(`${n} set ${i+1}: face difference ${sTxt(s.fd)} (limit ${BR_LIM.face}″)`)});
    if(c.setBad)o.push(`${n}: sets differ by ${sTxt(c.sd)} (limit 1′)`)});
  sol.tc.forEach(T=>{if(T.ready&&T.bad)o.push(`△${T.t.p.join("")}: misclosure ${sTxt(T.err)} (limit ±${Math.round(T.lim)}″)`);
    if(T.ready&&T.ill.some(x=>x))o.push(`△${T.t.p.join("")} is not well-conditioned: ${T.t.p.filter((v,j)=>T.ill[j]).map((v,j)=>v).join(", ")} outside ${BR_LIM.wcMin}°–${BR_LIM.wcMax}° (move a station)`)});
  if(sol.axBad)o.push(`Axis ${BR.axis.join("")}: two values agree to 1:${Math.round(sol.axPrec)} only (needs 1:${BR_LIM.axis})`);
  const r=recCalc(sol);if(r.bad)o.push(`Reciprocal levelling: error ${r.err.toFixed(1)} mm > ±${r.perm.toFixed(1)} mm`);
  [["s1","a"],["s1","b"],["s2","a"],["s2","b"]].forEach(([s,k])=>{const w=brWire(BR.rec[s][k]);if(w&&w.bad)o.push(`Reciprocal set ${s[1]}, staff on ${k==="a"?BR.axis[0]:BR.axis[1]}: |(T+B)/2 − M| > 3 mm`)});
  return o}

/* --- UI --- */
let brSub="";
function brBanner(){const el=document.getElementById("bbanner");if(!el)return;const is=brIssues();
  el.innerHTML=is.length?`<div class="alarm"><h4>⚠ ${is.length} warning${is.length>1?"s":""}</h4><ul>${is.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`:""}
function renderBR(h){
  setMod("trav");guideBtn.classList.remove("hidden");guideTo="br/guide";homeBtn.classList.remove("hidden");
  const part=h.split("/")[1]||"";brSub=part;
  if(part==="guide")return renderBRGuide();
  if(part==="base")return renderBRBase();
  if(part==="ang")return renderBRAng();
  if(part==="tri")return renderBRTri();
  if(part==="rec")return renderBRRec();
  if(part==="hyd")return renderBRHyd();
  if(part==="set")return renderBRSet();
  if(part==="det"||part==="ls"||part==="xs"){guideTo="ct/guide";return renderCTList(part)}
  backTo="";homeBtn.textContent="◀ Home";
  title.innerHTML="Bridge Site Survey<small>Triangulation · levelling · hydrology</small>";
  const sol=brSolve(),rc=recCalc(sol),hy=hydCalc(),is=brIssues(sol);
  const nb=BR.bases.filter(b=>baseCalc(b)).length,na=BR.obs.filter(o=>obsCalc(o).done).length,nt=sol.tc.filter(T=>T.ready).length;
  const fl=(()=>{const x=allLev(k=>k==="bfly"?LEV.lines.map(L=>{const c=lineCalc(L);return c.err!=null&&c.perm!=null?Math.abs(c.err)<=c.perm:null}):null).bfly||[];return x})();
  const step=(n,href,name,sub,state)=>`<button class="wcard ${state}" onclick="location.hash='${href}'"><div class="wic" style="font-size:20px">${n}</div><div class="wtx"><b>${name}</b><small>${sub}</small></div><span class="wgo">›</span></button>`;
  const jobN=j=>CT.setups.filter(S=>S.job===j),jobTxt=j=>{const m=jobN(j),n=m.reduce((a,S)=>a+S.pts.length,0),w=m.reduce((a,S)=>a+ctIssues(S).length,0);return{t:`${m.length} setup${m.length===1?"":"s"} · ${n} point${n===1?"":"s"}${w?" · "+w+" warning"+(w>1?"s":""):""}`,s:w?"bad":n?"ok":""}};
  const D=jobTxt("det"),LS=jobTxt("ls"),XS=jobTxt("xs"),sec=t=>`<p class="note" style="margin:16px 4px 8px;font-weight:800;text-transform:uppercase;letter-spacing:1px">${t}</p>`;
  app.innerHTML=`<div id="bbanner"></div>
  <div class="hubhead"><h3>Bridge site</h3><p>Axis ${esc(BR.axis.join(""))} crosses the river. Tap a task.</p></div>
  ${BR_LAYOUT.obs.every(([at,bs,fs])=>findObs(at,bs,fs))?"":`<div class="card"><h2>Start here</h2><p class="note" style="margin:0">Adds our layout: base lines AC and BD, major triangles ABC and ABD (solid, 2 sets), minor triangles ADE, DEF, EFG (dotted, 1 set) and all 15 angles in reading order.</p><div class="btns" style="margin-top:10px"><button class="btn pri" onclick="brSetup()">Set up our layout</button></div></div>`}
  ${sec("Control")}
  ${step(1,"bfly","Fly levelling BM → "+esc(BR.axis[0]),fl.length?`${fl.length} line${fl.length>1?"s":""} · ${fl.filter(x=>x===true).length} closed OK`:"3-wire · there and back · ±24√K",fl.some(x=>x===false)?"bad":fl.some(x=>x)?"ok":"")}
  ${step(2,"br/base","Base lines",`${nb} measured · tape 1:2000 · EDM 1:5000`,BR.bases.some(b=>{const c=baseCalc(b);return c&&c.bad})?"bad":nb?"ok":"")}
  ${step(3,"br/ang","Angles",`${na} / ${BR.obs.length} done · base 2 sets, others 1 set`,BR.obs.some(o=>{const c=obsCalc(o);return c.setBad||c.s.some(s=>s&&s.faceBad)})?"bad":na&&na===BR.obs.length?"ok":"")}
  ${step(4,"br/tri","Triangles · axis length",sol.axMean!=null?`${esc(BR.axis.join(""))} = ${sol.axMean.toFixed(3)} m${sol.axPrec!=null?" · 1:"+(sol.axPrec===Infinity?"∞":Math.round(sol.axPrec)):""}`:`${nt} / ${BR.tris.length} triangles closed`,sol.tc.some(T=>T.ready&&(T.bad||T.ill.some(x=>x)))||sol.axBad?"bad":sol.axPrec!=null?"ok":"")}
  ${step(5,"br/rec","Reciprocal levelling",rc.err!=null?`error ${rc.err.toFixed(1)} mm · ±${rc.perm!=null?rc.perm.toFixed(1):"?"} mm${rc.rlB!=null?" · RL "+esc(BR.axis[1])+" "+rc.rlB.toFixed(3):""}`:"across the river · 2 sets",rc.bad?"bad":rc.err!=null&&rc.perm!=null?"ok":"")}
  ${sec("Mapping (total station)")}
  ${step(6,"br/det","Detailing",D.t+" · 200 m × 120 m",D.s)}
  ${step(7,"br/ls","L-section",LS.t+" · 150 m up, 50 m down",LS.s)}
  ${step(8,"br/xs","X-sections",XS.t+" · every 25 m",XS.s)}
  ${sec("River")}
  ${step(9,"br/hyd","Hydrology",hy.vmean!=null?`mean velocity ${hy.vmean.toFixed(2)} m/s`:"float velocity · HFL · NWL · LWL",hy.vmean!=null?"ok":"")}
  ${sec("Settings")}
  ${step("⚙","br/set","Axis · limits · data","Station letters · norms · backup · CSV","")}`;
  brBanner();
}
function renderBRSet(){backTo="br";homeBtn.textContent="◀ Bridge";
  title.innerHTML="Axis · limits · data<small>Bridge site settings</small>";
  app.innerHTML=`<div class="card"><h2>Bridge axis</h2>
    <div class="row"><span>Axis ends (this bank → far bank)</span><span style="white-space:nowrap"><input class="pt" style="width:52px" id="ax0" value="${esc(BR.axis[0])}" autocapitalize="characters"> → <input class="pt" style="width:52px" id="ax1" value="${esc(BR.axis[1])}" autocapitalize="characters"></span></div>
    <p class="note">Same letters as the template: A and B on the axis, C and D for the base triangles ABC and ABD, E, F, G… for extra triangles.</p>
    <div class="btns" style="margin-top:8px"><button class="btn" onclick="brSetup()">Set up our layout (ABC, ABD, ADE, DEF, EFG)</button></div></div>
  <div class="card"><h2>Limits</h2>
    <div class="row"><span>Base line</span><b>tape 1:2000 · EDM 1:5000</b></div>
    <div class="row"><span>Face difference</span><b>≤ ${BR_LIM.face}″</b></div>
    <div class="row"><span>Set I vs Set II</span><b>≤ 1′</b></div>
    <div class="row"><span>Major triangles (solid: ABC, ABD)</span><b>2 sets · ±30″√3 = ±52″</b></div>
    <div class="row"><span>Minor triangles (dotted: ADE, DEF, EFG)</span><b>1 set · ±1′√3 = ±104″</b></div>
    <div class="row"><span>Well-conditioned (every angle)</span><b>30° – 120°</b></div>
    <div class="row"><span>Axis from two base triangles</span><b>≥ 1:2000</b></div>
    <div class="row"><span>Fly / reciprocal levelling</span><b>±24√K mm</b></div>
    <div class="row"><span>Detailing backsight check</span><b>≤ ${CT_TOL*1000} mm</b></div>
    <p class="note">From the guidelines (bridge site items 3–7). The 20″ face check is the one used for the traverses.</p></div>
  <div class="card"><h2>Data</h2><p class="note">Backup, merge and Excel export on the home screen include the bridge data.</p>
    <div class="btns" style="margin-top:8px"><button class="btn pri" onclick="backup()">Save backup</button><button class="btn" onclick="brExport()">Bridge CSV</button></div>
    <div class="btns" style="margin-top:10px"><button class="btn" onclick="brClear()">Clear bridge data…</button></div></div>`;
  for(const i of[0,1]){const el=document.getElementById("ax"+i);el.addEventListener("change",()=>{BR.axis[i]=el.value.trim().toUpperCase()||(i?"B":"A");brSave();renderBRSet()})}
}
// Group 07 layout (field sketch 2026-11-25): river flows from G/F side towards C. A, C, E, G on one bank; B, D, F on the other.
// Base lines AC (A's bank) and BD (B's bank). Base triangles ABC, ABD (2 sets). Extra triangles ADE, DEF, EFG (1 set).
// Angles read clockwise from BS to FS, in the order met at each station.
const BR_LAYOUT={bases:[["A","C"],["B","D"]],tris:[[["A","B","C"],1],[["A","B","D"],1],[["A","D","E"],0],[["D","E","F"],0],[["E","F","G"],0]],
  obs:[["A","C","B",1],["A","B","D",1],["A","D","E",0],["B","D","A",1],["B","A","C",1],["C","B","A",1],["D","A","B",1],["D","F","E",0],["D","E","A",0],
       ["E","A","D",0],["E","D","F",0],["E","F","G",0],["F","G","E",0],["F","E","D",0],["G","E","F",0]]};
const obsEmpty=o=>!o.sets.some(s=>s&&Object.values(s).some(v=>bDeg(v)!=null));
function brSetup(){const L=BR_LAYOUT;BR.axis=["A","B"];
  const inB=b=>L.bases.some(([a,c])=>pairKey(a,c)===pairKey(b.a,b.b)),inT=t=>L.tris.some(([p])=>p.slice().sort().join()===t.p.slice().sort().join()),inO=o=>L.obs.some(([at,bs,fs])=>o.at===at&&((o.bs===bs&&o.fs===fs)||(o.bs===fs&&o.fs===bs)));
  const extra=[...BR.bases.filter(b=>!inB(b)&&baseCalc(b)),...BR.obs.filter(o=>!inO(o)&&!obsEmpty(o))];
  if(BR.obs.length&&!confirm("Switch to our layout (base lines AC, BD; triangles ABC, ABD, ADE, DEF, EFG)? Readings already typed are kept; empty entries that are not in this layout are removed."))return;
  BR.bases=BR.bases.filter(b=>inB(b)||baseCalc(b));BR.tris=BR.tris.filter(inT);BR.obs=BR.obs.filter(o=>inO(o)||!obsEmpty(o));
  for(const [a,b] of L.bases)if(!BR.bases.some(x=>pairKey(x.a,x.b)===pairKey(a,b)))BR.bases.push({id:newId(),a,b,fw:"",bw:"",mode:"edm"});
  for(const [p,base] of L.tris)if(!BR.tris.some(t=>t.p.slice().sort().join()===p.slice().sort().join()))BR.tris.push({id:newId(),p,base:!!base});else BR.tris.find(t=>t.p.slice().sort().join()===p.slice().sort().join()).base=!!base;
  for(const [at,bs,fs,base] of L.obs){const o=findObs(at,bs,fs);if(!o)BR.obs.push({id:newId(),at,bs,fs,base:!!base,sets:base?[{},{}]:[{}]});else if(base&&!o.base){o.base=true;if(o.sets.length<2)o.sets.push({})}}
  const ord=L.obs.map(([at,bs,fs])=>at+bs+fs);BR.obs.sort((x,y)=>{const i=ord.indexOf(x.at+x.bs+x.fs),j=ord.indexOf(y.at+y.bs+y.fs),k=ord.indexOf(x.at+x.fs+x.bs),l=ord.indexOf(y.at+y.fs+y.bs);return (i<0?k<0?99:k:i)-(j<0?l<0?99:l:j)});
  brSave();if(extra.length)alert(`Kept because they have readings: ${extra.map(x=>x.at?`∠${x.bs}${x.at}${x.fs}`:`base ${x.a}${x.b}`).join(", ")}. Delete them yourself if not needed.`);route()}

/* base lines */
function renderBRBase(){backTo="br";homeBtn.textContent="◀ Bridge";
  title.innerHTML="Base lines<small>Forward and back · tape 1:2000 · EDM 1:5000</small>";
  const card=(b,i)=>{const c=baseCalc(b);return `<div class="card"><div class="row" style="border:0;padding-top:0"><span><b>Base</b> <input class="pt" style="width:52px" data-bi="${i}" data-k="a" value="${esc(b.a)}"> – <input class="pt" style="width:52px" data-bi="${i}" data-k="b" value="${esc(b.b)}"></span><span id="bbp${i}">${c&&c.prec!=null?pill(c.bad?"bad":"ok","1:"+(c.prec===Infinity?"∞":Math.round(c.prec))):pill("wait","FW + BW")}</span></div>
    <div class="seg" style="margin:4px 0 8px"><button class="${b.mode!=="tape"?"on":""}" onclick="brMode(${i},'edm')">EDM / total station</button><button class="${b.mode==="tape"?"on":""}" onclick="brMode(${i},'tape')">Tape</button></div>
    <div class="dist"><label>Forward (m)</label><input inputmode="decimal" data-bi="${i}" data-k="fw" value="${esc(b.fw)}"></div>
    <div class="dist"><label>Backward (m)</label><input inputmode="decimal" data-bi="${i}" data-k="bw" value="${esc(b.bw)}"></div>
    <div class="row"><span>Mean</span><b id="bbm${i}">${c?c.mean.toFixed(3)+" m":"–"}</b></div>
    <div class="btns" style="margin-top:6px"><button class="btn" onclick="brDel('bases',${i})">Delete</button></div></div>`};
  app.innerHTML=`<div id="bbanner"></div>${BR.bases.map(card).join("")||'<div class="card"><p class="note">No base lines yet. Usually two: A–C and A–D, on your bank, about as long as the axis.</p></div>'}
  <div class="btns" style="margin-bottom:14px"><button class="btn pri" onclick="brAddBase()">+ Base line</button></div>
  <p class="note" style="margin:0 4px 14px">Measure on flat ground, horizontal distance. With a tape keep it taut and level, and count the full tape lengths twice.</p>`;
  app.querySelectorAll("[data-bi]").forEach(el=>el.addEventListener("input",()=>{const b=BR.bases[+el.dataset.bi],k=el.dataset.k;
    if(k==="a"||k==="b"){el.value=el.value.toUpperCase();b[k]=el.value.trim()}else{el.value=el.value.replace(/[^\d.]/g,"");b[k]=el.value}brSave();
    const i=+el.dataset.bi,c=baseCalc(b);document.getElementById("bbm"+i).textContent=c?c.mean.toFixed(3)+" m":"–";
    document.getElementById("bbp"+i).innerHTML=c&&c.prec!=null?pill(c.bad?"bad":"ok","1:"+(c.prec===Infinity?"∞":Math.round(c.prec))):pill("wait","FW + BW");brBanner()}));
  brBanner()}
function brMode(i,m){BR.bases[i].mode=m;brSave();renderBRBase()}
function brAddBase(){BR.bases.push({id:newId(),a:BR.axis[0],b:"",fw:"",bw:"",mode:"edm"});brSave();renderBRBase()}
function brDel(col,i){const x=BR[col][i],nm=col==="obs"?`angle ∠${x.bs}${x.at}${x.fs} and all its readings`:col==="tris"?`triangle △${x.p.join("")}`:`base line ${x.a}${x.b} and its distances`;if(confirm(`Delete ${nm}? This cannot be undone.`)){BR[col].splice(i,1);brSave();route()}}

/* angles */
const FACES=[["lb","FL","BS"],["lf","FL","FS"],["rb","FR","BS"],["rf","FR","FS"]];
function dmsBox(oi,si,k,v){v=v||["","",""];return `<div class="dms"><input class="d" inputmode="numeric" data-o="${oi}" data-s="${si}" data-k="${k}" data-j="0" value="${esc(v[0])}" placeholder="°"><i>°</i><input inputmode="numeric" data-o="${oi}" data-s="${si}" data-k="${k}" data-j="1" value="${esc(v[1])}" placeholder="′"><i>′</i><input inputmode="numeric" data-o="${oi}" data-s="${si}" data-k="${k}" data-j="2" value="${esc(v[2])}" placeholder="″"><i>″</i></div>`}
function renderBRAng(){backTo="br";homeBtn.textContent="◀ Bridge";
  title.innerHTML="Angles<small>HCR · FL then FR · major 2 sets · minor 1 set</small>";
  const ats=[...new Set(BR.obs.map(o=>o.at))];
  const card=(o,i)=>{const c=obsCalc(o);const sets=o.base?[0,1]:[0];
    return `<div class="card" id="bo${i}"><div class="row" style="border:0;padding-top:0"><span><b>∠</b><input class="pt" style="width:44px" data-oi="${i}" data-k="bs" value="${esc(o.bs)}"><b>${esc(o.at)}</b><input class="pt" style="width:44px" data-oi="${i}" data-k="fs" value="${esc(o.fs)}"><br><small class="note">At ${esc(o.at)}: from ${esc(o.bs||"?")} (BS) clockwise to ${esc(o.fs||"?")} (FS)</small></span><span id="boc${i}"></span></div>
      ${sets.map(si=>`<p class="bookh" style="margin:10px 0 2px">Set ${si===0?"I":"II"} ${si===1?'<small class="note">(start near 90°)</small>':'<small class="note">(start near 0°)</small>'}</p>
      ${FACES.map(([k,f,t])=>`<div class="obs"><label><b>${f}</b> ${t} ${esc(t==="BS"?o.bs:o.fs)}</label>${dmsBox(i,si,k,(o.sets[si]||{})[k])}</div>`).join("")}<div id="bos${i}_${si}"></div>`).join("")}
      <div class="row"><span>Major triangle angle (2 sets)</span><input type="checkbox" ${o.base?"checked":""} onchange="brBase(${i},this.checked)" style="width:22px;height:22px"></div>
      <div class="btns" style="margin-top:6px"><button class="btn" onclick="brDel('obs',${i})">Delete</button></div></div>`};
  app.innerHTML=`<div id="bbanner"></div>
  ${ats.map(a=>`<p class="bookh" style="margin:4px 4px 8px">At ${esc(a)}</p>`+BR.obs.map((o,i)=>o.at===a?card(o,i):"").join("")).join("")||'<div class="card"><p class="note">No angles yet. Go back and tap “Set up the usual layout”, or add one below.</p></div>'}
  <div class="card"><h2>Add an angle</h2>
    <div class="row"><span>At station</span><input class="cfgin" id="nat" autocapitalize="characters" placeholder="E"></div>
    <div class="row"><span>From (BS) → to (FS)</span><span><input class="pt" style="width:50px" id="nbs"> → <input class="pt" style="width:50px" id="nfs"></span></div>
    <div class="row"><span>Major triangle (2 sets)</span><input type="checkbox" id="nbase" style="width:22px;height:22px"></div>
    <div class="btns" style="margin-top:8px"><button class="btn pri" onclick="brAddObs()">+ Add angle</button></div>
    <p class="note">Several angles at one station: the FS of one angle is the BS of the next, type the same reading again. Each angle is read clockwise from BS to FS.</p></div>`;
  app.querySelectorAll("[data-o]").forEach(el=>{el.addEventListener("input",()=>{el.value=el.value.replace(/[^\d.]/g,"");const o=BR.obs[+el.dataset.o],s=+el.dataset.s;
    o.sets[s]=o.sets[s]||{};const v=o.sets[s][el.dataset.k]||["","",""];v[+el.dataset.j]=el.value;o.sets[s][el.dataset.k]=v;brSave();brAngUpd(+el.dataset.o);
    const j=+el.dataset.j;if((j===0&&el.value.length>=3)||(j>0&&el.value.length>=2)){const all=[...app.querySelectorAll("[data-o]")],n=all[all.indexOf(el)+1];if(n)n.focus()}});
    el.addEventListener("focus",()=>el.select())});
  app.querySelectorAll("[data-oi]").forEach(el=>el.addEventListener("change",()=>{BR.obs[+el.dataset.oi][el.dataset.k]=el.value.trim().toUpperCase();brSave();renderBRAng()}));
  BR.obs.forEach((o,i)=>brAngUpd(i));brBanner()}
function brAngUpd(i){const o=BR.obs[i],c=obsCalc(o);
  c.s.forEach((s,si)=>{const el=document.getElementById(`bos${i}_${si}`);if(el)el.innerHTML=s?`<div class="row"><span>FL / FR</span><b>${bDms(s.L)} / ${bDms(s.R)}</b></div><div class="row"><span>Face difference · mean</span>${s.fd!=null?pill(s.faceBad?"bad":"ok",sTxt(s.fd)):pill("wait","–")} <b>${bDms(s.mean)}</b></div>`:""});
  const el=document.getElementById("boc"+i);if(el)el.innerHTML=c.mean==null?pill("wait","no readings"):c.setBad?pill("bad","sets "+sTxt(c.sd)):!c.done?pill("warn",bDms(c.interior)):pill("ok",bDms(c.interior));
  brBanner()}
function brBase(i,v){BR.obs[i].base=v;if(v&&BR.obs[i].sets.length<2)BR.obs[i].sets.push({});brSave();renderBRAng()}
function brAddObs(){const g=id=>document.getElementById(id).value.trim().toUpperCase(),at=g("nat"),bs=g("nbs"),fs=g("nfs");
  if(!at||!bs||!fs){alert("Station, BS and FS are needed.");return}if(findObs(at,bs,fs)){alert("That angle is already there.");return}
  const base=document.getElementById("nbase").checked;BR.obs.push({id:newId(),at,bs,fs,base,sets:base?[{},{}]:[{}]});brSave();renderBRAng()}

/* triangles, axis, coordinates */
function renderBRTri(){backTo="br";homeBtn.textContent="◀ Bridge";
  title.innerHTML="Triangles · axis<small>Angle correction · sine rule · coordinates</small>";
  const sol=brSolve(),X=brCoords(sol);
  const tcard=(T,i)=>{const p=T.t.p;let body;
    if(!T.ready)body=`<p class="note">Waiting for the angle${T.missing.length>1?"s":""} at ${T.missing.map(esc).join(", ")}. ${T.ang.some(a=>!a)?"Add it on the Angles page (the two other corners as BS and FS).":""}</p>`;
    else body=`<table><tr><th>Angle</th><th>Observed</th><th>Corr.</th><th>Corrected</th></tr>${p.map((v,j)=>`<tr><td>${esc(v)}</td><td>${bDms(T.obs[j])}</td><td>${sTxt(T.corr[j])}</td><td><b>${bDms(T.adj[j])}</b>${T.ill[j]?" "+pill("bad","<"+BR_LIM.wcMin+"° or >"+BR_LIM.wcMax+"°"):""}</td></tr>`).join("")}
      <tr><td>Sum</td><td>${bDms(T.obs.reduce((a,b)=>a+b,0))}</td><td></td><td>180° 00′ 00″</td></tr></table>
      <div class="row"><span>Misclosure (limit ±${Math.round(T.lim)}″)</span>${pill(T.bad?"bad":"ok",sTxt(T.err))}</div>
      ${p.map((v,j)=>{const k=pairKey(p[(j+1)%3],p[(j+2)%3]),L=sol.sides[k];return `<div class="row"><span>${esc(p[(j+1)%3]+p[(j+2)%3])} <small class="note">(${sol.src[k]||"unknown"})</small></span><b>${L!=null?L.toFixed(3)+" m":"–"}</b></div>`}).join("")}`;
    return `<div class="card"><div class="row" style="border:0;padding-top:0"><span><b>△${esc(p.join(""))}</b> <small class="note">${T.t.base?"major (solid) · 2 sets · ±30″√3":"minor (dotted) · 1 set · ±1′√3"}</small></span><button class="btn" style="flex:none;padding:8px 12px" onclick="brDel('tris',${i})">Delete</button></div>${body}</div>`};
  const st=Object.keys(X);
  app.innerHTML=`<div id="bbanner"></div>
  <div class="card"><h2>Bridge axis ${esc(BR.axis.join(""))}</h2>
    ${sol.axVals.map(v=>`<div class="row"><span>From △${esc(v.tri)} (base ${esc(v.from.replace("|",""))})</span><b>${v.len.toFixed(3)} m</b></div>`).join("")||'<p class="note">Needs a closed base triangle with a measured base line.</p>'}
    ${sol.axMean!=null?`<div class="row"><span>Mean axis length</span><b class="big">${sol.axMean.toFixed(3)} m</b></div>`:""}
    ${sol.axPrec!=null?`<div class="row"><span>Agreement (≥ 1:2000)</span>${pill(sol.axBad?"bad":"ok","1:"+(sol.axPrec===Infinity?"∞":Math.round(sol.axPrec)))}</div>`:sol.axVals.length===1?'<p class="note">Second base triangle needed for the 1:2000 check.</p>':""}</div>
  ${sol.tc.map(tcard).join("")}
  <div class="card"><h2>Add a triangle</h2>
    <div class="row"><span>Corners</span><span><input class="pt" style="width:44px" id="t0"> <input class="pt" style="width:44px" id="t1"> <input class="pt" style="width:44px" id="t2"></span></div>
    <div class="row"><span>Major triangle (2 sets, ±30″√N)</span><input type="checkbox" id="tbase" style="width:22px;height:22px"></div>
    <div class="btns" style="margin-top:8px"><button class="btn pri" onclick="brAddTri()">+ Add triangle</button></div></div>
  <div class="card"><h2>Station coordinates</h2>
    <div class="row"><span>${esc(BR.axis[0])} Northing</span><input class="cfgin" inputmode="decimal" data-st="N" value="${esc(BR.start.N)}" placeholder="1000.000"></div>
    <div class="row"><span>${esc(BR.axis[0])} Easting</span><input class="cfgin" inputmode="decimal" data-st="E" value="${esc(BR.start.E)}" placeholder="1000.000"></div>
    <div class="obs"><label>Bearing ${esc(BR.axis.join("→"))}</label><div class="dms">${[0,1,2].map(j=>`<input ${j?"":'class="d"'} inputmode="numeric" data-sb="${j}" value="${esc(BR.start.brg[j]||"")}" placeholder="${"°′″"[j]}"><i>${"°′″"[j]}</i>`).join("")}</div></div>
    <p class="note">Use assumed values (e.g. 1000, 1000 and a compass bearing) unless the teacher gives coordinates for the bridge stations.</p>
    ${st.length?`<table style="margin-top:8px"><tr><th>Station</th><th>Northing</th><th>Easting</th></tr>${st.map(k=>`<tr><td>${esc(k)}</td><td>${X[k].N.toFixed(3)}</td><td>${X[k].E.toFixed(3)}</td></tr>`).join("")}</table>
    <div class="btns" style="margin-top:10px"><button class="btn pri" onclick="brToCT()">Use for detailing (Coordinate Transfer)</button></div>`:""}</div>`;
  app.querySelectorAll("[data-st]").forEach(el=>el.addEventListener("change",()=>{BR.start[el.dataset.st]=el.value.replace(/[^\d.\-]/g,"");brSave();renderBRTri()}));
  app.querySelectorAll("[data-sb]").forEach(el=>el.addEventListener("change",()=>{BR.start.brg[+el.dataset.sb]=el.value.replace(/[^\d.]/g,"");brSave();renderBRTri()}));
  brBanner()}
function brAddTri(){const p=[0,1,2].map(i=>document.getElementById("t"+i).value.trim().toUpperCase());if(p.some(x=>!x)||new Set(p).size<3){alert("Three different corners are needed.");return}
  BR.tris.push({id:newId(),p,base:document.getElementById("tbase").checked});
  // make sure each corner has an angle entry
  p.forEach((v,i)=>{const a=p[(i+1)%3],b=p[(i+2)%3];if(!findObs(v,a,b))BR.obs.push({id:newId(),at:v,bs:a,fs:b,base:document.getElementById("tbase").checked,sets:document.getElementById("tbase").checked?[{},{}]:[{}]})});
  brSave();renderBRTri()}
function brToCT(){const sol=brSolve(),X=brCoords(sol),rc=recCalc(sol);const Z={};if(rc.rlA!=null)Z[BR.axis[0]]=rc.rlA;if(rc.rlB!=null)Z[BR.axis[1]]=rc.rlB;
  const names=Object.keys(X);const clash=names.filter(k=>ctXYZ(k)&&!CT.known[k]);
  if(clash.length){alert(`${clash.join(", ")} already name traverse control points. Rename the bridge stations first (e.g. BA, BB).`);return}
  names.forEach(k=>{CT.known[k]=[X[k].N,X[k].E,Z[k]??(CT.known[k]?CT.known[k][2]:null)]});ctSave();
  alert(`Added ${names.join(", ")} to Known points. Set up the total station on one of them and backsight another.`);location.hash="br/det"}

/* reciprocal levelling */
function renderBRRec(){backTo="br";homeBtn.textContent="◀ Bridge";const [A,B]=BR.axis;
  title.innerHTML="Reciprocal levelling<small>Across the river · 3-wire · ±24√K</small>";
  const tmb=(s,k)=>`<div class="tmb">${[0,1,2].map(j=>`<input inputmode="decimal" data-rs="${s}" data-rk="${k}" data-j="${j}" value="${esc(BR.rec[s][k][j]||"")}" placeholder="${"TMB"[j]}">`).join("")}</div>`;
  const setc=(s,near,far,n)=>`<div class="card"><h2>Set ${n} · level close to ${esc(near)}</h2>
    <div class="obs"><label>Staff on <b>${esc(A)}</b>${near===A?" (near)":" (far)"}</label>${tmb(s,"a")}</div><div id="rw${s}a"></div>
    <div class="obs"><label>Staff on <b>${esc(B)}</b>${near===B?" (near)":" (far)"}</label>${tmb(s,"b")}</div><div id="rw${s}b"></div>
    <div class="row"><span>h${n} = ${esc(A)} − ${esc(B)} reading (rise ${esc(A)}→${esc(B)})</span><b id="rh${s}">–</b></div></div>`;
  app.innerHTML=`<div id="bbanner"></div>
  <div class="card"><p class="note" style="margin:0">Set the level about 5–10 m from ${esc(A)}, read the staff on ${esc(A)} then on ${esc(B)} across the river. Carry the level to the ${esc(B)} side (same distance from ${esc(B)}) and read ${esc(B)} then ${esc(A)}. Readings in metres (1.524) or mm (1524).</p></div>
  ${setc("s1",A,B,1)}${setc("s2",B,A,2)}
  <div class="card"><h2>Result</h2>
    <div class="row"><span>RL of ${esc(A)} (m)</span><input class="cfgin" inputmode="decimal" id="rrl" value="${esc(BR.rec.rlA)}"></div><div id="rrlf"></div>
    <div class="row"><span>Distance ${esc(A)}–${esc(B)} (m)</span><input class="cfgin" inputmode="decimal" id="rL" value="${esc(BR.rec.L)}"></div><div id="rLf"></div>
    <div id="rres"></div></div>`;
  app.querySelectorAll("[data-rs]").forEach(el=>{el.addEventListener("input",()=>{el.value=el.value.replace(/[^\d.]/g,"");BR.rec[el.dataset.rs][el.dataset.rk][+el.dataset.j]=el.value;brSave();brRecUpd()});el.addEventListener("focus",()=>el.select())});
  document.getElementById("rrl").addEventListener("input",e=>{BR.rec.rlA=e.target.value.replace(/[^\d.\-]/g,"");brSave();brRecUpd()});
  document.getElementById("rL").addEventListener("input",e=>{BR.rec.L=e.target.value.replace(/[^\d.]/g,"");brSave();brRecUpd()});
  brRecUpd()}
function brRecUpd(){const sol=brSolve(),r=recCalc(sol),[A,B]=BR.axis;const f=x=>x==null?"–":(x>=0?"+":"")+x.toFixed(3)+" m";
  [["s1","a",r.a1],["s1","b",r.b1],["s2","a",r.a2],["s2","b",r.b2]].forEach(([s,k,w])=>{const el=document.getElementById(`rw${s}${k}`);if(el)el.innerHTML=w?`<div class="row"><span>Mean${w.dist!=null?" · distance "+w.dist.toFixed(1)+" m":""}</span>${w.chk!=null?pill(w.bad?"bad":"ok",w.mean.toFixed(3)):`<b>${w.mean.toFixed(3)}</b>`}</div>`:""});
  document.getElementById("rhs1").textContent=f(r.h1);document.getElementById("rhs2").textContent=f(r.h2);
  document.getElementById("rrlf").innerHTML=bNum(BR.rec.rlA)==null?(r.rlA!=null?`<p class="note">Using ${r.rlA.toFixed(3)} from fly levelling “${esc(r.rlFrom)}”. Type a value to override.</p>`:`<p class="note">Type the RL of ${esc(A)}, or finish fly levelling BM → ${esc(A)} first.</p>`):"";
  document.getElementById("rLf").innerHTML=bNum(BR.rec.L)==null?(sol.axMean!=null?`<p class="note">Using the axis length ${sol.axMean.toFixed(3)} m from the triangles.</p>`:'<p class="note">Type it, or finish the triangles first.</p>'):"";
  document.getElementById("rres").innerHTML=`
    <div class="row"><span>Error h1 − h2</span>${r.err!=null&&r.perm!=null?pill(r.bad?"bad":"ok",(r.err>0?"+":"")+r.err.toFixed(1)+" mm"):`<b>${r.err!=null?r.err.toFixed(1)+" mm":"–"}</b>`}</div>
    <div class="row"><span>Permissible 24√K (K = 2L)</span><b>${r.perm!=null?"±"+r.perm.toFixed(1)+" mm":"–"}</b></div>
    <div class="row"><span>True difference (h1 + h2) / 2</span><b>${f(r.dh)}</b></div>
    <div class="row"><span>RL of ${esc(B)}</span><b class="big">${r.rlB!=null?r.rlB.toFixed(3):"–"}</b></div>`;
  brBanner()}

/* hydrology */
function renderBRHyd(){backTo="br";homeBtn.textContent="◀ Bridge";const H=BR.hyd;
  title.innerHTML="Hydrology<small>Float method · flood levels</small>";
  app.innerHTML=`<div class="card"><h2>Float velocity</h2>
    <div class="dist"><label>Distance between the two lines (m)</label><input inputmode="decimal" data-h="dist" value="${esc(H.dist)}" placeholder="20"></div>
    ${H.times.map((t,i)=>`<div class="dist"><label>Run ${i+1} time (s) <small class="note" id="hv${i}"></small></label><input inputmode="decimal" data-ht="${i}" value="${esc(t)}"></div>`).join("")}
    <div class="btns" style="margin:6px 0 8px"><button class="btn" onclick="BR.hyd.times.push('');brSave();renderBRHyd()">+ Run</button>${H.times.length>1?`<button class="btn" onclick="BR.hyd.times.pop();brSave();renderBRHyd()">− Last run</button>`:""}</div>
    <div class="row"><span>Mean surface velocity</span><b id="hvs">–</b></div>
    <div class="row"><span>Factor (mean ÷ surface)</span><input class="cfgin" inputmode="decimal" data-h="k" value="${esc(H.k)}"></div>
    <div class="row"><span>Mean velocity</span><b class="big" id="hvm">–</b></div>
    <p class="note">Mark two lines across a straight reach, drop the float well upstream of the first line, time it between the lines. 3–5 runs in the middle of the stream. 0.85 is the usual factor for a surface float.</p></div>
  <div class="card"><h2>Water levels (RL, m)</h2>
    <div class="row"><span>HFL (flood marks / locals)</span><input class="cfgin" inputmode="decimal" data-h="hfl" value="${esc(H.hfl)}"></div>
    <div class="row"><span>NWL (today)</span><input class="cfgin" inputmode="decimal" data-h="nwl" value="${esc(H.nwl)}"></div>
    <div class="row"><span>LWL (dry season)</span><input class="cfgin" inputmode="decimal" data-h="lwl" value="${esc(H.lwl)}"></div>
    <div class="row"><span>Free board needed</span><b>≥ 4 m above HFL</b></div>
    <div class="row"><span>Bed material</span><input class="cfgin" data-h="bed" value="${esc(H.bed)}" placeholder="sand, gravel…"></div>
    <textarea data-h="note" placeholder="Notes: flood mark location, what locals said…">${esc(H.note)}</textarea>
    <p class="note">Shoot the HFL marks and the water edges with the total station too, so they appear on the map and sections.</p></div>`;
  app.querySelectorAll("[data-h]").forEach(el=>el.addEventListener("input",()=>{BR.hyd[el.dataset.h]=el.value;brSave();brHydUpd()}));
  app.querySelectorAll("[data-ht]").forEach(el=>el.addEventListener("input",()=>{el.value=el.value.replace(/[^\d.]/g,"");BR.hyd.times[+el.dataset.ht]=el.value;brSave();brHydUpd()}));
  brHydUpd()}
function brHydUpd(){const c=hydCalc(),d=bNum(BR.hyd.dist);BR.hyd.times.forEach((t,i)=>{const el=document.getElementById("hv"+i),x=bNum(t);if(el)el.textContent=d&&x?(d/x).toFixed(2)+" m/s":""});
  document.getElementById("hvs").textContent=c.vsurf!=null?c.vsurf.toFixed(3)+" m/s":"–";document.getElementById("hvm").textContent=c.vmean!=null?c.vmean.toFixed(3)+" m/s":"–"}

/* data */
function brClear(){if(prompt("Type DELETE to clear all bridge site data on this phone (not the bridge fly levelling lines). A backup file is saved first.")==="DELETE"){backup();BR=brBlank();brSave();route()}}
function brMerge(src){if(!src||!Array.isArray(src.obs))return 0;let n=0;
  for(const c of["obs","bases","tris"])for(const x of src[c]||[]){const y=BR[c].find(z=>z.id===x.id);if(!y){BR[c].push(x);n++;continue}
    if(c==="obs")x.sets.forEach((s,i)=>{y.sets[i]=y.sets[i]||{};for(const k in s)if(bDeg(s[k])!=null&&bDeg(y.sets[i][k])==null){y.sets[i][k]=s[k];n++}});
    if(c==="bases")for(const k of["fw","bw"])if(bNum(x[k])!=null&&bNum(y[k])==null){y[k]=x[k];n++}}
  for(const s of["s1","s2"])for(const k of["a","b"])if(src.rec&&!BR.rec[s][k].some(v=>v)&&(src.rec[s][k]||[]).some(v=>v)){BR.rec[s][k]=src.rec[s][k];n++}
  if(src.rec){for(const k of["rlA","L"])if(!BR.rec[k]&&src.rec[k])BR.rec[k]=src.rec[k]}
  if(src.start&&!BR.start.N&&src.start.N)BR.start=src.start;
  if(src.hyd)for(const k of["dist","hfl","nwl","lwl","bed","note"])if(!BR.hyd[k]&&src.hyd[k]){BR.hyd[k]=src.hyd[k];n++}
  if(src.hyd&&!BR.hyd.times.some(t=>t)&&(src.hyd.times||[]).some(t=>t))BR.hyd.times=src.hyd.times;
  brSave();return n}
function brCSV(csv){if(!BR.obs.length&&!BR.bases.length&&!BR.rec.s1.a.some(v=>v))return "";const sol=brSolve(),X=brCoords(sol),r=recCalc(sol);let o="";
  const a=[["Inst St","Sighted To","Face","SetI D","SetI M","SetI S","SetII D","SetII M","SetII S"]];
  BR.obs.forEach(x=>{const s1=x.sets[0]||{},s2=x.sets[1]||{};FACES.forEach(([k,f,t],j)=>{const p=s1[k]||["","",""],q=s2[k]||["","",""];a.push([j===0?x.at:"",t==="BS"?x.bs:x.fs,f==="FL"?"L":"R",p[0],p[1],p[2],q[0],q[1],q[2]])})});
  o+="\n\nBRIDGE SITE: ANGLES (template Base Triangles E:G and J:L; Triangulation E:G)\n"+a.map(csv).join("\n");
  const b=[["Base","Forward","Backward","Mean","Precision"]];BR.bases.forEach(x=>{const c=baseCalc(x);b.push([x.a+x.b,x.fw,x.bw,c?c.mean.toFixed(3):"",c&&c.prec!=null?"1:"+Math.round(c.prec):""])});
  o+="\n\nBRIDGE SITE: BASE LINES\n"+b.map(csv).join("\n");
  const t=[["Triangle","Angle","Observed","Correction (s)","Corrected"]];sol.tc.forEach(T=>{if(T.ready)T.t.p.forEach((v,j)=>t.push([j?"":T.t.p.join(""),v,bDms(T.obs[j]),T.corr[j],bDms(T.adj[j])]))});
  o+="\n\nBRIDGE SITE: ANGLE CORRECTION\n"+t.map(csv).join("\n");
  o+="\n\nBRIDGE SITE: SIDES\n"+[["Side","Length (m)","Source"]].concat(Object.keys(sol.sides).map(k=>[k.replace("|",""),sol.sides[k].toFixed(3),sol.src[k]])).map(csv).join("\n");
  if(Object.keys(X).length)o+="\n\nBRIDGE SITE: STATION COORDINATES\n"+[["Station","N","E"]].concat(Object.keys(X).map(k=>[k,X[k].N.toFixed(3),X[k].E.toFixed(3)])).map(csv).join("\n");
  const R=BR.rec;o+="\n\nRECIPROCAL LEVELLING (template rows 11-12 and 22-23, Top Middle Bottom)\n"+[["Set","Staff on","Top","Middle","Bottom"],["1 (near "+BR.axis[0]+")",BR.axis[0]].concat(R.s1.a),["",BR.axis[1]].concat(R.s1.b),["2 (near "+BR.axis[1]+")",BR.axis[1]].concat(R.s2.b),["",BR.axis[0]].concat(R.s2.a),
    ["h1",r.h1!=null?r.h1.toFixed(3):""],["h2",r.h2!=null?r.h2.toFixed(3):""],["Error mm",r.err!=null?r.err.toFixed(1):""],["RL B",r.rlB!=null?r.rlB.toFixed(3):""]].map(csv).join("\n");
  const h=hydCalc(),H=BR.hyd;o+="\n\nHYDROLOGY\n"+[["Distance",H.dist],["Times"].concat(H.times),["Surface velocity",h.vsurf!=null?h.vsurf.toFixed(3):""],["Mean velocity",h.vmean!=null?h.vmean.toFixed(3):""],["HFL",H.hfl],["NWL",H.nwl],["LWL",H.lwl],["Bed",H.bed],["Notes",H.note]].map(csv).join("\n");
  return o+"\n"}
function brExport(){const csv=r=>r.map(v=>v==null?"":/[",\n]/.test(v)?`"${String(v).replace(/"/g,'""')}"`:v).join(",");download(blobFile(brCSV(csv).trim()+"\n",`bridge-site-${stamp()}.csv`,"text/csv"))}

function renderBRGuide(){backTo="br";homeBtn.textContent="◀ Bridge";guideBtn.classList.add("hidden");
  title.innerHTML="Bridge site: what to do<small>In this order</small>";
  const s=(n,h,b)=>`<div class="gstep"><div class="gn">${n}</div><div><b>${h}</b><div>${b}</div></div></div>`;
  app.innerHTML=`<div class="card"><h2>Layout</h2><pre style="font-size:13px;line-height:1.25;margin:0;overflow-x:auto">      B--------D--------F
     /|       /\\       / \\
 d/s / |  ←  /  \\ u/s /   \\
    /  |    /    \\   /     \\
   C---A---/------E---------G</pre>
    <p class="note">River flows right to left. A–B is the bridge axis. Base lines: AC (A's bank) and BD (B's bank). Triangles ABC and ABD each give AB by the sine rule; the two must agree to 1:2000. ADE, DEF, EFG carry control upstream for the L-section.</p></div>
  <div class="card"><h2>Steps</h2>
    ${s(1,"Recce","Straight, narrow reach, firm banks, axis square to the flow, 4 m free board above HFL. Peg A to G as in our sketch; angles in the triangles between 30° and 120°.")}
    ${s(2,"Two peg test + fly levelling","BM → A and back (3-wire). Step 1 on the bridge menu.")}
    ${s(3,"Base lines","AC and BD forward and back. EDM 1:5000, tape 1:2000.")}
    ${s(4,"Angles","Angles of ABC and ABD (at A, B, C, D): 2 sets, Set I from 0°, Set II from 90°, FL then FR; sets within 1′, faces within 20″. Angles of ADE, DEF, EFG: 1 set. At each station read clockwise in the order listed in the app.")}
    ${s(5,"Triangles","The app spreads the misclosure (base ±30″√3, others ±1′√3) and gives AB from each triangle.")}
    ${s(6,"Reciprocal levelling","Level near A: read A then B. Level near B: read B then A. True difference = mean of the two. Error within 24√K, K = 2 × AB.")}
    ${s(7,"Coordinates","Assume A (or use given values) and a bearing for AB; the app computes B, C, D. Tap “Use for detailing”, then use Detailing, L-section and X-sections on the bridge menu.")}
    ${s(8,"Detailing","At least 200 m along the river × 120 m across. Total station on A/B/C/D, backsight another. Shoot banks, water edge, bed, HFL marks, structures, trees, spot heights every 5–10 m.")}
    ${s(9,"L-section and X-sections","Bed centre line 150 m upstream to 50 m downstream, chainage 0 at the axis. X-sections every 25 m plus one on the axis, across the whole valley beyond the HFL. Name points LS+025, XS-050/3 so they are easy to sort later.")}
    ${s(10,"Hydrology","Float velocity (3–5 runs), HFL, NWL, LWL, bed material.")}</div>
  <div class="card"><h2>Drawing scales</h2>
    <div class="row"><span>Topographic map</span><b>1:500</b></div><div class="row"><span>L-section</span><b>H 1:500 · V 1:50</b></div><div class="row"><span>X-section</span><b>H 1:200 · V 1:200</b></div></div>
  <div class="nav"><button class="btn pri" onclick="location.hash='br'">Bridge menu</button></div>`}
