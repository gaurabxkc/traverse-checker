"use strict";
/* ===== Coordinate transfer: total station setups (station + backsight), backsight check, recorded points (Pt No, N, E, Z) ===== */
const CT_KEY="ct-v1";
const CT_PRESET={}; // no built-in control: each group adds its own known points (or merges a backup that has them)
const CT_TOL=0.010; // backsight / known-point check, metres
let CT;
function ctLoad(){try{CT=JSON.parse(localStorage.getItem(CT_KEY))}catch(e){CT=null}if(!CT||!Array.isArray(CT.setups))CT={known:{},setups:[]};if(!CT.known)CT.known={}}
function ctSave(){try{localStorage.setItem(CT_KEY,JSON.stringify(CT));localStorage.setItem(TS_KEY,new Date().toISOString())}catch(e){alert("Could not save on this phone! Make a backup now.")}}
ctLoad();
const ctKnown=()=>Object.assign({},CT_PRESET,CT.known);
function ctXYZ(p){const k=ctKnown()[p];return k?{N:k[0],E:k[1],Z:k[2]}:null}
const n3=v=>v==null||v===""||isNaN(+v)?null:+v;
function azi(a,b){if(!a||!b||a.N==null||b.N==null)return null;const dN=b.N-a.N,dE=b.E-a.E;return{az:(Math.atan2(dE,dN)*180/Math.PI+360)%360,d:Math.hypot(dN,dE)}}
function ctDms(x){if(x==null)return "–";let t=Math.round(x*3600);const d=Math.floor(t/3600),m=Math.floor(t%3600/60),s=t%60;return `${d}° ${String(m).padStart(2,"0")}′ ${String(s).padStart(2,"0")}″`}
function ctDelta(meas,known){if(!meas||!known)return null;const N=n3(meas.N),E=n3(meas.E),Z=n3(meas.Z);if(N==null||E==null)return null;
  const dN=N-known.N,dE=E-known.E,dH=Math.hypot(dN,dE),dZ=Z!=null&&known.Z!=null?Z-known.Z:null;
  return{dN,dE,dH,dZ,bad:dH>CT_TOL+1e-9||(dZ!=null&&Math.abs(dZ)>CT_TOL+1e-9)}}
const mm=x=>(x>=0?"+":"")+(x*1000).toFixed(0)+" mm";
function dPill(d){if(!d)return pill("wait","—");return pill(d.bad?"bad":"ok",`Δ ${(d.dH*1000).toFixed(0)} mm${d.dZ!=null?" · Z "+mm(d.dZ):""}`)}
function ctIssues(S){const o=[];const st=ctXYZ(S.stn),bs=ctXYZ(S.bs);
  if(S.stn&&!st)o.push(`Station ${S.stn} has no coordinates`);if(S.bs&&!bs)o.push(`Backsight ${S.bs} has no coordinates`);
  const d=ctDelta(S.bsM,bs);if(d&&d.bad)o.push(`Backsight check ${S.bs}: off by ${(d.dH*1000).toFixed(0)} mm${d.dZ!=null?", Z "+mm(d.dZ):""} (limit ${CT_TOL*1000} mm)`);
  S.pts.forEach(p=>{const k=ctXYZ(p.p);if(k&&p.p!==S.stn){const x=ctDelta(p,k);if(x&&x.bad)o.push(`Point ${p.p}: differs from known by ${(x.dH*1000).toFixed(0)} mm${x.dZ!=null?", Z "+mm(x.dZ):""}`)}});
  return o}
function nextName(p){const m=/^(.*?)(\d+)$/.exec(p||"");return m?m[1]+(+m[2]+1):""}

/* --- UI --- */
let ctCur=null,ctLast=null;
let ctJob="";
const CT_JOBS={"":{name:"Coordinate Transfer",sub:"Total station · station + backsight · N E Z",back:"",backTxt:"◀ Home"},
  det:{name:"Bridge detailing",sub:"Topographic points · at least 200 m × 120 m",back:"br",backTxt:"◀ Bridge"},
  ls:{name:"Bridge L-section",sub:"River bed centre line · 150 m up, 50 m down",back:"br",backTxt:"◀ Bridge"},
  xs:{name:"Bridge X-sections",sub:"Every 25 m + one on the axis",back:"br",backTxt:"◀ Bridge"}};
function renderCT(h){
  setMod("trav");guideBtn.classList.remove("hidden");guideTo="ct/guide";
  const part=h.split("/")[1];
  if(part==="guide")return renderCTGuide();
  if(part==="known")return renderCTKnown();
  const S=CT.setups.find(x=>x.id===part);if(S)return renderCTSetup(S);
  renderCTList("")}
function renderCTList(job){ctJob=job;const J=CT_JOBS[job];
  ctCur=null;backTo=J.back;homeBtn.classList.remove("hidden");homeBtn.textContent=J.backTxt;
  title.innerHTML=`${J.name}<small>${J.sub}</small>`;
  const mine=CT.setups.filter(S=>(S.job||"")===job);
  const cards=mine.map(S=>{const is=ctIssues(S),d=ctDelta(S.bsM,ctXYZ(S.bs));
    const st=is.length?pill("bad",is.length+" warning"+(is.length>1?"s":"")):d?pill("ok","BS ✓"):pill("wait","BS not checked");
    return `<button class="lcard${is.length?" bad":""}" onclick="location.hash='ct/${S.id}'"><div><b>At ${esc(S.stn||"?")}</b><small>BS ${esc(S.bs||"?")} · ${S.pts.length} point${S.pts.length===1?"":"s"}</small></div>${st}</button>`}).join("");
  const nk=Object.keys(CT.known).length;
  app.innerHTML=`${job?ctJobHelp(job,mine):""}
  <div class="card"><h2>Setups</h2>${cards||'<p class="note">No setups yet. Each setup = one instrument station oriented on a backsight of known coordinates.</p>'}
    <div class="btns" style="margin-top:10px"><button class="btn pri" onclick="ctAdd()">+ New setup</button></div></div>
  ${job?ctJobSummary(job,mine):""}
  ${job?`<div class="card"><h2>Check</h2><div class="row"><span>Backsight / re-shot known point</span><b>≤ ${CT_TOL*1000} mm</b></div><div class="btns" style="margin-top:8px"><button class="btn" onclick="location.hash='ct/known'">Known points</button><button class="btn" onclick="ctExport()">Points CSV</button></div></div>`:`  <div class="card"><h2>Known points</h2>
    <div class="row"><span>Known points on this phone</span><b>${nk}</b></div>
    ${nk?"":'<p class="note">Add your control points (given CP coordinates, Gales results) before setting up.</p>'}
    <div class="btns" style="margin-top:8px"><button class="btn" onclick="location.hash='ct/known'">View / add known points</button></div></div>
  <div class="card"><h2>Limits</h2>
    <div class="row"><span>Backsight check (measured vs known)</span><b>≤ ${CT_TOL*1000} mm</b></div>
    <div class="row"><span>Re-shot known point</span><b>≤ ${CT_TOL*1000} mm</b></div>
    <p class="note">10 mm is this app's default for a total station over these distances; ask the teacher if they give a different value. Warnings never block typing.</p></div>
  <div class="card"><h2>Data</h2><p class="note">Backup, merge and Excel export on the home screen include these points.</p>
    <div class="btns" style="margin-top:8px"><button class="btn pri" onclick="backup()">Save backup</button><button class="btn" onclick="ctExport()">Points CSV</button></div>
    <div class="btns" style="margin-top:10px"><button class="btn" onclick="ctClear()">Clear coordinate data…</button></div></div>`}`;
}
function ctAdd(prevStn,prevBs){const S={id:newId(),job:ctJob||undefined,stn:prevStn||"",hi:"",bs:prevBs||"",ht:"",bsM:{N:"",E:"",Z:""},pts:[]};CT.setups.push(S);ctSave();location.hash="ct/"+S.id}
function ctFwd(i){const S=ctCur,p=S.pts[i];if(!p.p||n3(p.N)==null||n3(p.E)==null){alert("Give the point a name and N, E first.");return}
  if(!ctXYZ(p.p)||confirm(`${p.p} already has coordinates. Replace them with this point's values?`)){CT.known[p.p]=[n3(p.N),n3(p.E),n3(p.Z)];}
  ctSave();ctAdd(p.p,S.stn)}
function knownBox(lbl,name){const k=ctXYZ(name);return k?`<div class="row"><span>${lbl} N / E / Z</span><b>${k.N.toFixed(3)} / ${k.E.toFixed(3)} / ${k.Z==null?"–":k.Z.toFixed(3)}</b></div>`:
  (name?`<div class="row"><span>${lbl}</span>${pill("bad","not a known point")}</div><p class="note">Add ${esc(name)} under Known points (or record it as a point from an earlier setup and tap “Use as next station”).</p>`:"")}
function renderCTSetup(S){
  ctCur=S;ctLast=null;ctJob=S.job||"";backTo=S.job?"br/"+S.job:"ct";homeBtn.classList.remove("hidden");homeBtn.textContent="◀ Setups";
  title.innerHTML=`At ${esc(S.stn||"?")}<small>Backsight ${esc(S.bs||"?")} · coordinate transfer</small>`;
  const opts=Object.keys(ctKnown()).map(k=>`<option value="${esc(k)}">`).join("");
  const pt=(p,i)=>`<div class="card" id="cp${i}"><div class="row" style="border:0;padding-top:0"><span><b>Point</b> <input class="pt" style="width:110px;text-transform:none" data-pi="${i}" data-k="p" value="${esc(p.p)}" autocapitalize="off" autocorrect="off" spellcheck="false"></span><div id="cpd${i}"></div></div>
    <div class="nez">${["N","E","Z"].map(k=>`<label>${k}<input inputmode="decimal" data-pi="${i}" data-k="${k}" value="${esc(p[k]??"")}" placeholder="${k==="N"?"3063…":k==="E"?"627…":"13…"}"></label>`).join("")}</div>
    <div class="row"><span>Target height HT (m)</span><input class="cfgin" inputmode="decimal" data-pi="${i}" data-k="ht" value="${esc(p.ht??"")}" placeholder="${esc(S.ht||"1.500")}"></div>
    <div class="row"><span>Remark / code</span><input class="cfgin" data-pi="${i}" data-k="rem" value="${esc(p.rem||"")}" placeholder="peg, building…"></div>
    <div id="cpx${i}"></div>
    <div class="btns" style="margin-top:8px"><button class="btn" onclick="ctFwd(${i})">Use as next station →</button><button class="btn" onclick="ctDelPt(${i})">Delete</button></div></div>`;
  app.innerHTML=`<div id="cbanner"></div><datalist id="ctk">${opts}</datalist>
  <div class="card"><h2>1 · Station setup</h2>
    <div class="row"><span>Instrument station</span><input class="cfgin" list="ctk" data-f="stn" value="${esc(S.stn)}" placeholder="CP1" autocapitalize="off"></div>
    <div id="cst">${knownBox("Station",S.stn)}</div>
    <div class="row"><span>Instrument height HI (m)</span><input class="cfgin" inputmode="decimal" data-f="hi" value="${esc(S.hi)}" placeholder="1.520"></div>
    <div class="row"><span>Target height HT (m)</span><input class="cfgin" inputmode="decimal" data-f="ht" value="${esc(S.ht)}" placeholder="1.500"></div></div>
  <div class="card"><h2>2 · Backsight (orientation)</h2>
    <div class="row"><span>Backsight station</span><input class="cfgin" list="ctk" data-f="bs" value="${esc(S.bs)}" placeholder="CP2" autocapitalize="off"></div>
    <div id="cbs"></div></div>
  <div class="card"><h2>3 · Backsight check</h2><p class="note">After orienting, measure the backsight in coordinate mode and type what the instrument shows.</p>
    <div class="nez">${["N","E","Z"].map(k=>`<label>${k}<input inputmode="decimal" data-b="${k}" value="${esc(S.bsM[k]??"")}"></label>`).join("")}</div>
    <div id="cbc"></div></div>
  <p class="bookh" style="margin:4px 4px 8px">4 · Points (${S.pts.length})</p>
  ${S.pts.map(pt).join("")}
  <div class="btns" style="margin-bottom:14px"><button class="btn" onclick="ctDelSetup()">Delete setup…</button></div>
  <div class="lsticky"><span>${S.pts.length} point${S.pts.length===1?"":"s"} at ${esc(S.stn||"?")}</span><button class="btn pri" onclick="ctAddPt()">+ Point</button></div>`;
  app.querySelectorAll("[data-f]").forEach(el=>{el.addEventListener("input",()=>{S[el.dataset.f]=el.value.trim();ctSave();ctUpd()});
    el.addEventListener("change",()=>{if(el.dataset.f==="stn"||el.dataset.f==="bs")renderCTSetup(S)})});
  app.querySelectorAll("[data-b]").forEach(el=>el.addEventListener("input",()=>{el.value=el.value.replace(/[^\d.\-]/g,"");S.bsM[el.dataset.b]=el.value;ctSave();ctUpd()}));
  app.querySelectorAll("[data-pi]").forEach(el=>el.addEventListener("input",()=>{const p=S.pts[+el.dataset.pi],k=el.dataset.k;
    if("NEZht".includes(k)&&k!=="p")el.value=el.value.replace(/[^\d.\-]/g,"");p[k]=k==="p"?el.value.trim():el.value;ctSave();ctUpd()}));
  ctUpd();
}
function ctUpd(){const S=ctCur;if(!S)return;const st=ctXYZ(S.stn),bs=ctXYZ(S.bs),a=azi(st,bs);
  title.innerHTML=`At ${esc(S.stn||"?")}<small>Backsight ${esc(S.bs||"?")} · coordinate transfer</small>`;
  const cs=document.getElementById("cst");if(cs)cs.innerHTML=knownBox("Station",S.stn);
  document.getElementById("cbs").innerHTML=knownBox("Backsight",S.bs)+(a?`<div class="row"><span>Backsight azimuth (set this)</span><b style="font-size:18px;white-space:nowrap">${ctDms(a.az)}</b></div><div class="row"><span>Distance to backsight</span><b>${a.d.toFixed(3)} m</b></div>`:"");
  const d=ctDelta(S.bsM,bs);
  document.getElementById("cbc").innerHTML=d?`<div class="row"><span>ΔN / ΔE</span><b>${mm(d.dN)} / ${mm(d.dE)}</b></div><div class="row"><span>Horizontal miss${d.dZ!=null?" · ΔZ":""}</span>${dPill(d)}</div>`:'<div class="row"><span>Check</span>'+pill("wait","type N and E")+"</div>";
  S.pts.forEach((p,i)=>{const r=azi(st,{N:n3(p.N),E:n3(p.E)}),k=ctXYZ(p.p),x=k&&p.p!==S.stn?ctDelta(p,k):null;
    const dd=document.getElementById("cpd"+i);if(dd)dd.innerHTML=x?dPill(x):k&&p.p!==S.stn?pill("wait","known: check"):r?`<small class="note">${r.d.toFixed(2)} m · ${ctDms(r.az)}</small>`:"";
    const xx=document.getElementById("cpx"+i);if(xx)xx.innerHTML=x?`<div class="row"><span>vs known ${esc(p.p)}: ΔN / ΔE</span><b>${mm(x.dN)} / ${mm(x.dE)}</b></div>`:""});
  const is=ctIssues(S);
  document.getElementById("cbanner").innerHTML=is.length?`<div class="alarm"><h4>⚠ ${is.length} warning${is.length>1?"s":""}</h4><ul>${is.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`:(d?`<div class="passbar">✓ Backsight within ${CT_TOL*1000} mm</div>`:"");
  const s=is.length?"bad":d?"ok":"part";if(ctLast!==null&&s!==ctLast){if(s==="bad")toast("⚠ Check failed",true);else if(s==="ok")toast("✓ Backsight OK")}ctLast=s;
}
function ctAddPt(){const S=ctCur,last=S.pts[S.pts.length-1];S.pts.push({p:last?nextName(last.p):"",N:"",E:"",Z:"",ht:"",rem:""});ctSave();renderCTSetup(S);
  const el=document.getElementById("cp"+(S.pts.length-1));if(el){el.scrollIntoView({behavior:"smooth",block:"start"});const f=el.querySelector(S.pts[S.pts.length-1].p?'[data-k="N"]':'[data-k="p"]');if(f)setTimeout(()=>f.focus(),300)}}
function ctDelPt(i){if(confirm("Delete point "+(ctCur.pts[i].p||i+1)+"?")){ctCur.pts.splice(i,1);ctSave();renderCTSetup(ctCur)}}
function ctDelSetup(){const S=ctCur;if(prompt('Type DELETE to remove the setup at '+(S.stn||"?")+' and its points.')==="DELETE"){CT.setups=CT.setups.filter(x=>x!==S);ctSave();location.hash=S.job?"br/"+S.job:"ct"}}
function ctClear(){if(prompt("Type DELETE to clear all coordinate transfer setups and added known points on this phone. A backup file is saved first.")==="DELETE"){backup();CT={known:{},setups:[]};ctSave();route()}}
function renderCTKnown(){
  ctCur=null;backTo="ct";homeBtn.classList.remove("hidden");homeBtn.textContent="◀ Setups";
  title.innerHTML="Known points<small>Control + transferred stations</small>";
  const K=ctKnown(),row=(k,v,own)=>`<div class="row"><span><b>${esc(k)}</b>${own?' <small class="note">(added)</small>':""}<br><small class="note">${v[0].toFixed(3)} · ${v[1].toFixed(3)} · ${v[2]==null?"–":(+v[2]).toFixed(3)}</small></span>${own?`<button class="btn" style="flex:none;padding:8px 12px" onclick="ctDelKnown('${esc(k)}')">Remove</button>`:""}</div>`;
  app.innerHTML=`<div class="card"><h2>Add a known point</h2>
    <div class="row"><span>Name</span><input class="cfgin" id="kn" autocapitalize="off" placeholder="m1"></div>
    <div class="nez"><label>N<input inputmode="decimal" id="kN"></label><label>E<input inputmode="decimal" id="kE"></label><label>Z<input inputmode="decimal" id="kZ"></label></div>
    <div class="btns" style="margin-top:8px"><button class="btn pri" onclick="ctAddKnown()">Save point</button></div>
    <p class="note">Use this for minor stations from the minor Gales table, or RLs once levelling is done. Adding a name that already exists replaces it on this phone.</p></div>
  <div class="card"><h2>All known points</h2>${Object.keys(K).map(k=>row(k,K[k],!!CT.known[k])).join("")}</div>`;
}
function ctAddKnown(){const g=id=>document.getElementById(id).value.trim(),n=g("kn"),N=n3(g("kN")),E=n3(g("kE")),Z=n3(g("kZ"));
  if(!n||N==null||E==null){alert("Name, N and E are needed.");return}CT.known[n]=[N,E,Z];ctSave();renderCTKnown()}
function ctDelKnown(k){if(confirm("Remove "+k+" from the added points?")){delete CT.known[k];ctSave();renderCTKnown()}}
function ctCSV(csv){if(!CT.setups.length)return "";const r=[["Point","N","E","Z","HT","Remark","From station","Backsight","Job"]];
  CT.setups.forEach(S=>S.pts.forEach(p=>r.push([p.p,p.N,p.E,p.Z,p.ht||S.ht,p.rem,S.stn,S.bs,S.job?CT_JOBS[S.job].name:"Coordinate transfer"])));
  const s=[["Station","HI","HT","Backsight","BS meas N","BS meas E","BS meas Z"]];CT.setups.forEach(S=>s.push([S.stn,S.hi,S.ht,S.bs,S.bsM.N,S.bsM.E,S.bsM.Z]));
  return "\n\nCOORDINATE TRANSFER: POINTS\n"+r.map(csv).join("\n")+"\n\nCOORDINATE TRANSFER: SETUPS\n"+s.map(csv).join("\n")+"\n"}
function ctExport(){const csv=r=>r.map(v=>v==null?"":/[",\n]/.test(v)?`"${String(v).replace(/"/g,'""')}"`:v).join(",");download(blobFile(ctCSV(csv).trim()+"\n",`coordinate-transfer-${stamp()}.csv`,"text/csv"))}
function ctMerge(src){if(!src||!Array.isArray(src.setups))return 0;let n=0;for(const S of src.setups)if(!CT.setups.some(x=>x.id===S.id)){CT.setups.push(S);n++}
  for(const k in src.known||{})if(!CT.known[k]){CT.known[k]=src.known[k];n++}ctSave();return n}
function renderCTGuide(){
  backTo="ct";homeBtn.classList.remove("hidden");homeBtn.textContent="◀ Setups";guideBtn.classList.add("hidden");
  title.innerHTML="How to transfer coordinates<small>Total station · coordinate mode</small>";
  const step=(n,h,b)=>`<div class="gstep"><div class="gn">${n}</div><div><b>${h}</b><div>${b}</div></div></div>`;
  app.innerHTML=`<div class="card"><h2>At every setup</h2>
    ${step(1,"Centre and level","Over the station mark, as for the traverse.")}
    ${step(2,"Measure HI","Tape from the mark to the instrument's height mark. Enter it in the instrument and here.")}
    ${step(3,"Station setup","In the instrument: Occupied point = station name with its N, E, Z. Use the values on this page.")}
    ${step(4,"Backsight","Enter the backsight point's N, E (or the azimuth shown here), sight the prism on it, set.")}
    ${step(5,"Check the backsight","Measure the backsight in coordinate mode. The app compares it with the known values: must agree within 10 mm. If not, redo steps 3–4 (wrong point, typo, or HT).")}
    ${step(6,"Shoot points","For each point: point number, target height HT, then measure. Book N, E, Z exactly as shown.")}
    ${step(7,"Close","Re-shoot a known point (or the backsight) at the end; the app shows the difference.")}</div>
  <div class="card"><h2>What to write in the book</h2><ul class="note" style="padding-left:18px;margin:0">
    <li>Station, HI, backsight, its azimuth, date, observer.</li><li>Backsight check N, E, Z.</li>
    <li>For each point: Pt No, HT, N, E, Z, remark.</li><li>Change of HT: write it on that line.</li></ul></div>
  <div class="card"><h2>Common mistakes</h2><ul class="note" style="padding-left:18px;margin:0">
    <li>N and E swapped (instrument may show E first).</li><li>HT changed on the pole but not in the instrument.</li>
    <li>Old job or old station still loaded in the instrument.</li><li>Prism constant different from the one set (usually −30 mm or 0).</li></ul></div>
  <div class="nav"><button class="btn pri" onclick="location.hash='ct'">Setups</button></div>`;
}

/* --- bridge jobs: help + summaries (L-section chainage, X-section offsets) --- */
function ctJobHelp(job,mine){const st=["A","B","C","D"].filter(k=>ctXYZ(k));
  const tip={det:"Shoot banks (top and toe), water edge, bed, HFL marks, structures, trees, and spot heights every 5–10 m. Cover at least 200 m along the river and 120 m across.",
    ls:"Follow the deepest line of the bed from 150 m upstream to 50 m downstream, a point every 10–25 m and at every change in slope. Shoot them in order, upstream first. Name them LS1, LS2…",
    xs:"For each section, go square to the flow from beyond the HFL on one bank to beyond it on the other, a point at every break in slope. Name points XS-050/1, XS-050/2… (section chainage / point). Sections every 25 m plus XS0 on the axis."}[job];
  return `<div class="card"><h2>What to do</h2><p class="note" style="margin:0">${tip}</p>
    <div class="row" style="margin-top:8px"><span>Bridge stations ready</span>${st.length?pill("ok",st.join(", ")):pill("bad","none yet")}</div>
    ${st.length?"":`<p class="note">Finish Triangles · axis and tap “Use for detailing” so A, B, C, D have coordinates.</p>`}</div>`}
function ctJobPts(mine){const o=[];mine.forEach(S=>S.pts.forEach(p=>{const N=n3(p.N),E=n3(p.E);if(p.p&&N!=null&&E!=null)o.push({p:p.p,N,E,Z:n3(p.Z),rem:p.rem})}));return o}
function ctJobSummary(job,mine){const P=ctJobPts(mine);if(!P.length)return "";
  if(job==="det"){const ns=P.map(x=>x.N),es=P.map(x=>x.E);
    return `<div class="card"><h2>Summary</h2><div class="row"><span>Points</span><b>${P.length}</b></div>
      <div class="row"><span>Extent N × E</span><b>${(Math.max(...ns)-Math.min(...ns)).toFixed(0)} m × ${(Math.max(...es)-Math.min(...es)).toFixed(0)} m</b></div>
      <p class="note">Needs at least 200 m along the river × 120 m across.</p></div>`}
  if(job==="ls"){let c=0;const rows=P.map((x,i)=>{if(i)c+=Math.hypot(x.N-P[i-1].N,x.E-P[i-1].E);return{...x,c}});
    const z=BR.lsZero||"",zi=rows.find(r=>r.p===z),off=zi?zi.c:0;
    return `<div class="card"><h2>L-section</h2>
      <div class="row"><span>Chainage 0 at point (on the axis)</span><input class="cfgin" style="width:110px" value="${esc(z)}" onchange="BR.lsZero=this.value.trim();brSave();renderCTList('ls')" placeholder="LS7"></div>
      ${z&&!zi?`<p class="note">No point named ${esc(z)}.</p>`:""}
      <table style="margin-top:6px"><tr><th>Point</th><th>Chainage (m)</th><th>RL (m)</th></tr>${rows.map(r=>`<tr><td>${esc(r.p)}</td><td>${(r.c-off).toFixed(2)}</td><td>${r.Z!=null?r.Z.toFixed(3):"–"}</td></tr>`).join("")}</table>
      <p class="note">Chainage = distance along the points in the order shot (upstream first), so upstream is negative. Range needed: −150 to +50 m.</p></div>`}
  if(job==="xs"){const g={};P.forEach(x=>{const k=x.p.includes("/")?x.p.split("/")[0]:"(no section)";(g[k]=g[k]||[]).push(x)});
    return Object.keys(g).map(k=>{const L=g[k],o=L[0];return `<div class="card"><h2>${esc(k)}</h2><table><tr><th>Point</th><th>Offset (m)</th><th>RL (m)</th></tr>${L.map(x=>`<tr><td>${esc(x.p)}</td><td>${Math.hypot(x.N-o.N,x.E-o.E).toFixed(2)}</td><td>${x.Z!=null?x.Z.toFixed(3):"–"}</td></tr>`).join("")}</table><p class="note">Offset from the first point of the section (one bank).</p></div>`}).join("")}
  return ""}
