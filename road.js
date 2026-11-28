"use strict";
/* ===== Road alignment (camp Day 8-9). Maths mirrors the template sheets:
   "Road Alignment" (format 18): Δ, TL = R tan(Δ/2), L = πRΔ/180, E = R(sec(Δ/2) − 1), BC = IP − TL, MC = BC + L/2, EC = BC + L,
     chainage of the next IP = EC + (IP to IP distance) − TL (chainage runs along the curve).
   "Profile Levelling" (format 14): HI method, L-section and cross-section readings in one book, closed on a known RL (e.g. bridge A), ±24√K.
   Norms: guideline road alignment items 4-17. ===== */
const RD_KEY="road-v1";
const RD_LIM={grade:12,rMin:15,dMax:90,dSet:3,xs:10,k:24,lo:0.6,hi:3.0,gap:5,near:3};
let RD;
function rdBlank(){return{start:{p:"IP0",ch:"0",brg:["","",""],N:"",E:""},ips:[],peg:"15",
  lv:{bm:"",rl:"",bs:"",ch0:"",closeRl:"",kKm:"",items:[]}}}
function rdLoad(){try{RD=JSON.parse(localStorage.getItem(RD_KEY))}catch(e){RD=null}const b=rdBlank();if(!RD||!Array.isArray(RD.ips))RD=b;
  for(const k in b)if(RD[k]==null)RD[k]=b[k];for(const k in b.lv)if(RD.lv[k]==null)RD.lv[k]=b.lv[k];for(const k in b.start)if(RD.start[k]==null)RD.start[k]=b.start[k]}
function rdSave(){try{localStorage.setItem(RD_KEY,JSON.stringify(RD));localStorage.setItem(TS_KEY,new Date().toISOString())}catch(e){alert("Could not save on this phone! Make a backup now.")}}
rdLoad();

/* --- alignment maths --- */
const rdF=(x,n)=>x==null||isNaN(x)?"–":(+x).toFixed(n??3);
function rdChTxt(c){if(c==null)return "–";const k=Math.floor(c/1000+1e-9),m=c-k*1000;return k+"+"+m.toFixed(3).padStart(7,"0")}
function rdAxis(){return typeof BR!=="undefined"&&BR&&BR.axis?BR.axis:["A","B"]}
function rdCalc(){const rows=[];let prevEC=bNum(RD.start.ch)??0,prevTL=0,brg=bDeg(RD.start.brg),prev=null,cn=0;
  RD.ips.forEach((ip,i)=>{const last=i===RD.ips.length-1,d=bNum(ip.d),th=last?null:bDeg(ip.a);
    const defl=th==null?null:th-180,D=defl==null?0:Math.abs(defl),dir=!D?"":defl>0?"R":"L",R=bNum(ip.R),curve=D>1e-9&&R>0;
    const t=D*Math.PI/180,TL=curve?R*Math.tan(t/2):0,L=curve?R*t:0,E=curve?R*(1/Math.cos(t/2)-1):0,LC=curve?2*R*Math.sin(t/2):0;
    const ch=d!=null&&prevEC!=null?prevEC+d-prevTL:null,BC=ch!=null?ch-TL:null,MC=BC!=null?BC+L/2:null,EC=BC!=null?BC+L:null;
    const r={ip,i,last,d,th,defl,D,dir,R,curve,n:curve?++cn:null,TL,L,E,LC,ch,BC,MC,EC,brgIn:brg,gap:BC!=null&&prev&&prev.EC!=null?BC-prev.EC:BC!=null&&!prev?d-TL:null,prev,w:[]};
    if(brg!=null&&defl!=null)brg=n360(brg+defl);r.brgOut=brg;
    // R that still fits: tangent available on the way in (after the previous curve) and the whole straight on the way out
    const nx=RD.ips[i+1],dOut=nx?bNum(nx.d):null,avail=Math.min(d!=null?d-prevTL:Infinity,dOut!=null?dOut:Infinity);
    r.rMax=D>1e-9&&isFinite(avail)&&avail>0?Math.floor(avail/Math.tan(t/2)/5)*5:null;
    rows.push(r);prevEC=EC;prevTL=TL;prev=r});
  // warnings
  const [A,B]=rdAxis(),ra=rows.find(r=>r.ip.p===A),rb=rows.find(r=>r.ip.p===B);
  rows.forEach((r,i)=>{const w=r.w,p=r.ip.p||"IP";
    if(r.d==null)w.push(["wait","distance from "+(i?RD.ips[i-1].p||"previous":RD.start.p||"start")+" missing"]);
    if(r.last)return;
    if(r.th==null){if(p!==A&&p!==B)w.push(["wait","angle not read"]);return}
    if(r.D>RD_LIM.dMax)w.push(["bad",`Δ ${bDms(r.D)} > 90°: pick another IP`]);
    if(r.D>1e-9&&!(r.R>0))w.push(["wait","choose the radius"]);
    if(r.R!=null&&r.R<RD_LIM.rMin)w.push(["bad",`R ${r.R} m < ${RD_LIM.rMin} m`]);
    if(r.R!=null&&r.R>=RD_LIM.rMin&&r.R%5)w.push(["warn","use R in multiples of 5 or 10"]);
    if(r.curve&&r.D<RD_LIM.dSet)w.push(["warn","Δ < 3°: no setting out, chainage only"]);
    if(r.gap!=null&&r.gap<-0.0005)w.push(["bad",`overlaps ${r.prev&&r.prev.curve?"curve at "+r.prev.ip.p:"the start"} by ${(-r.gap).toFixed(2)} m: reduce R`]);
    else if(r.curve&&r.prev&&r.prev.curve&&r.gap!=null&&r.gap<RD_LIM.gap)w.push(["warn",r.prev.dir!==r.dir?`reverse curve with ${r.prev.ip.p} (only ${r.gap.toFixed(1)} m straight between)`:`compound / broken-back with ${r.prev.ip.p} (only ${r.gap.toFixed(1)} m straight between)`]);
    if((p===A||p===B)&&r.D>1e-9)w.push(["bad",`bridge end ${p} must be on a straight (no deflection)`])});
  rows.forEach(r=>{if(r.last&&r.gap!=null&&r.gap<-0.0005)r.w.push(["bad",`end is inside the curve at ${r.prev.ip.p} by ${(-r.gap).toFixed(2)} m`])});
  if(ra&&rb&&ra.ch!=null&&rb.ch!=null){const lo=Math.min(ra.ch,rb.ch),hi=Math.max(ra.ch,rb.ch);
    rows.forEach(r=>{if(r.curve&&r.BC!=null&&r.BC<hi-1e-4&&r.EC>lo+1e-4)r.w.push(["bad",`curve runs onto the bridge ${A}–${B} (BC ${rdF(r.BC)} – EC ${rdF(r.EC)}, bridge ${rdF(lo)} – ${rdF(hi)})`])})}
  const endR=rows[rows.length-1],end=endR?(endR.EC??endR.ch):null;
  return{rows,end,start:bNum(RD.start.ch)??0,bridge:ra&&rb?{A,B,a:ra.ch,b:rb.ch}:null}}
// geometry (assumed start 0,0 and bearing 90° when not given) for the sketch and peg coordinates
function rdGeom(C){const real=bNum(RD.start.N)!=null&&bNum(RD.start.E)!=null&&bDeg(RD.start.brg)!=null;
  let P={N:bNum(RD.start.N)??0,E:bNum(RD.start.E)??0},b=bDeg(RD.start.brg)??90,ch=C.start;const segs=[],ips=[{p:RD.start.p,N:P.N,E:P.E}];
  const mv=(Q,br,s)=>({N:Q.N+s*Math.cos(br*Math.PI/180),E:Q.E+s*Math.sin(br*Math.PI/180)});let IPprev=P;
  for(const r of C.rows){if(r.d==null)break;const IP=mv(IPprev,b,r.d);ips.push({p:r.ip.p,N:IP.N,E:IP.E});
    const BCp=mv(IP,b+180,r.TL);if(r.BC!=null&&r.BC>ch)segs.push({t:"l",c0:ch,c1:r.BC,P:mv(BCp,b+180,r.BC-ch),b});
    if(r.curve&&r.BC!=null){segs.push({t:"a",c0:r.BC,c1:r.EC,P:BCp,b,R:r.R,s:r.dir==="R"?1:-1,r});ch=r.EC}else ch=r.BC??ch;
    if(r.defl!=null)b=n360(b+r.defl);IPprev=IP}
  const at=c=>{const g=segs.find(s=>c>=s.c0-1e-6&&c<=s.c1+1e-6);if(!g)return null;const x=c-g.c0;
    if(g.t==="l")return{...mv(g.P,g.b,x),seg:g};const th=x/g.R,u=g.b*Math.PI/180,n=(g.b+90*g.s)*Math.PI/180,a=g.R*Math.sin(th),o=g.R*(1-Math.cos(th));
    return{N:g.P.N+a*Math.cos(u)+o*Math.cos(n),E:g.P.E+a*Math.sin(u)+o*Math.sin(n),seg:g,th,x}};
  return{real,segs,ips,at}}
// pegs: every peg interval (multiple of 15 m) along the centre line + BC, MC, EC + straight points (bridge ends, end)
function rdPegs(C,G){const step=bNum(RD.peg)||15,out=[];if(C.end==null)return out;
  for(let c=Math.ceil((C.start-1e-6)/step)*step;c<=C.end+1e-6;c+=step)out.push({ch:c,lab:[]});
  const add=(c,l)=>{if(c==null)return;const x=out.find(q=>Math.abs(q.ch-c)<0.0005);if(x)x.lab.push(l);else out.push({ch:c,lab:[l]})};
  add(C.start,RD.start.p||"Start");
  C.rows.forEach(r=>{if(r.curve){add(r.BC,"BC"+r.n);add(r.MC,"MC"+r.n);add(r.EC,"EC"+r.n)}else if(r.th==null&&r.ch!=null)add(r.ch,r.ip.p)});
  out.sort((a,b)=>a.ch-b.ch);
  out.forEach(q=>{const g=G?G.at(q.ch):null;q.pos=g;const cv=C.rows.find(r=>r.curve&&q.ch>r.BC-1e-6&&q.ch<r.EC+1e-6);
    if(cv){const arc=q.ch-cv.BC,th=arc/cv.R;q.cv=cv;q.arc=arc;q.defl=th*90/Math.PI;q.chord=2*cv.R*Math.sin(th/2);q.x=cv.R*Math.sin(th);q.y=cv.R*(1-Math.cos(th))}
    else{let ref=null;for(const r of C.rows){const c=r.curve?r.EC:r.ch;if(c!=null&&c<=q.ch+1e-6)ref={lab:r.curve?"EC"+r.n:r.ip.p,c}}q.from=ref||{lab:RD.start.p||"Start",c:C.start};q.along=q.ch-q.from.c}});
  return out}

/* --- profile and cross-section levelling (HI method, template "Profile Levelling") --- */
function rdLvCalc(){const V=RD.lv;let rl0=num(V.rl),from=rl0!=null?"typed":null;if(rl0==null&&V.bm&&typeof knownRL==="function"){const k=knownRL(V.bm.trim());if(k){rl0=k.rl;from=k.line}}
  const bs0=rd(V.bs);let hi=rl0!=null&&bs0!=null?rl0+bs0:null,setup=1,sBS=bs0||0,sFS=0,end=null,endP=null;const rows=[{t:"bm",p:V.bm,bs:bs0,hi,rl:rl0,k:1}];
  V.items.forEach((it,ii)=>{if(it.k==="x"){const ch=bNum(it.ch);const pt=(side,o,r,j)=>{const v=rd(r);rows.push({t:"is",ii,j,side,o:bNum(o),ch,r:v,rl:hi!=null&&v!=null?r3(hi-v):null,k:setup,hi})};
      pt("C",0,it.cl,-1);it.L.forEach((q,j)=>pt("L",q.o,q.r,j));it.R.forEach((q,j)=>pt("R",q.o,q.r,j))}
    else{const fs=rd(it.fs),bs=rd(it.bs),rl=hi!=null&&fs!=null?r3(hi-fs):null;if(fs!=null)sFS+=fs;
      rows.push({t:"cp",ii,p:it.p,ch:bNum(it.ch),fs,bs,rl,k:setup,hi,hiNext:rl!=null&&bs!=null?rl+bs:null});
      if(bs!=null){sBS+=bs;setup++;hi=rl!=null?rl+bs:null}else{end=rl;endP=it.p}}});
  const nS=rows.filter(r=>r.t==="cp"&&r.fs!=null).length,closed=end!=null&&rows[rows.length-1].t==="cp"&&rows[rows.length-1].bs==null;
  let known=num(V.closeRl),kFrom=known!=null?"typed":null;if(known==null&&closed&&endP&&typeof knownRL==="function"){const k=knownRL(String(endP).trim());if(k){known=k.rl;kFrom=k.line}}
  const chs=rows.filter(r=>r.ch!=null).map(r=>r.ch),span=chs.length>1?Math.max(...chs)-Math.min(...chs):null;
  const loop=closed&&endP&&V.bm&&String(endP).trim().toUpperCase()===V.bm.trim().toUpperCase(),K=num(V.kKm)??(span!=null?span/1000*(loop?2:1):null),perm=K?RD_LIM.k*Math.sqrt(K):null,e=closed&&known!=null?end-known:null;
  // correction (template): change point ending setup k gets −e·k/N; intermediate sights of setup k get −e·(k−1)/N
  rows.forEach(r=>{r.corr=e==null||!nS?null:r.t==="bm"?0:r.t==="cp"?-e*r.k/nS:-e*(r.k-1)/nS;r.crl=r.rl!=null?r3(r.rl+(r.corr||0)):null});
  const errMm=e!=null?Math.round(e*1000):null;
  return{rows,rl0,from,sBS:r3(sBS),sFS:r3(sFS),end,endP,closed,known,kFrom,K,span,perm,errMm,nS,ok:errMm!=null&&perm!=null?Math.abs(errMm)<=perm+1e-9:null,
    arith:end!=null&&rl0!=null?Math.abs((sBS-sFS)-(end-rl0))<0.0015:null}}
function rdLvIssues(L,pegs){const o=[];
  L.rows.forEach(r=>{if(r.t!=="cp")return;for(const [k,v] of[["FS",r.fs],["BS",r.bs]])if(v!=null&&(v<RD_LIM.lo-1e-9||v>RD_LIM.hi+1e-9))o.push(`${r.p||"change point"}: ${k} ${v.toFixed(3)} outside ${RD_LIM.lo}–${RD_LIM.hi} m (turning point rule)`)});
  if(L.ok===false)o.push(`Closing error ${L.errMm} mm exceeds ±${L.perm.toFixed(1)} mm`);
  RD.lv.items.forEach(it=>{if(it.k!=="x"||bNum(it.ch)==null)return;
    // centre line only, away from any peg (culvert start/end, slope break): L-section point, no cross section needed
    const hasX=t=>t.L.concat(t.R).some(q=>rd(q.r)!=null);
    if(rd(it.cl)!=null&&!hasX(it)){const m=pegs&&rdPegAt(pegs,bNum(it.ch));if(!m||rdCovered(m.q,RD.lv.items.filter(t=>t!==it&&t.k==="x"&&hasX(t)).map(t=>bNum(t.ch)).filter(x=>x!=null)))return}const mx=a=>Math.max(0,...a.filter(q=>rd(q.r)!=null).map(q=>bNum(q.o)||0));
    if(mx(it.L)<RD_LIM.xs-1e-9||mx(it.R)<RD_LIM.xs-1e-9)o.push(`Ch ${rdF(bNum(it.ch))}: cross section must reach ${RD_LIM.xs} m each side (L ${mx(it.L)} m, R ${mx(it.R)} m)`)});
  const cl=L.rows.filter(r=>r.t==="is"&&r.side==="C"&&r.ch!=null&&r.crl!=null).sort((a,b)=>a.ch-b.ch);
  for(let i=1;i<cl.length;i++){const dc=cl[i].ch-cl[i-1].ch;if(dc>0.5){const g=(cl[i].crl-cl[i-1].crl)/dc*100;if(Math.abs(g)>RD_LIM.grade)o.push(`Ground grade ${g.toFixed(1)}% between ch ${rdF(cl[i-1].ch,1)} and ${rdF(cl[i].ch,1)} (> ${RD_LIM.grade}%: check the alignment)`)}}
  if(pegs&&pegs.length){const have=rdHave();if(have.length){const lo=Math.min(...have),hi=Math.max(...have);
    const miss=rdLvPegs(pegs).filter(q=>q.ch>=lo-1e-6&&q.ch<=hi+1e-6&&!rdCovered(q,have)).map(q=>rdF(q.ch,q.ch%1?3:0));if(miss.length)o.push(`No section yet at ch ${miss.join(", ")}`)}}
  return o}
function rdIssues(){const C=rdCalc();const o=[];C.rows.forEach(r=>r.w.forEach(([s,t])=>{if(s==="bad")o.push(`${r.ip.p||"IP"}: ${t}`)}));return o}

/* --- UI --- */
function rdBanner(list){const el=document.getElementById("rbanner");if(!el)return;el.innerHTML=list.length?`<div class="alarm"><h4>⚠ ${list.length} warning${list.length>1?"s":""}</h4><ul>${list.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`:""}
function renderRoad(h){setMod("trav");guideBtn.classList.remove("hidden");guideTo="road/guide";homeBtn.classList.remove("hidden");
  const part=h.split("/")[1]||"";
  if(part==="guide")return renderRoadGuide();
  if(part==="ip")return renderRoadIP();
  if(part==="peg")return renderRoadPeg();
  if(part==="lv")return renderRoadLv();
  if(part==="set")return renderRoadSet();
  backTo="";homeBtn.textContent="◀ Home";
  title.innerHTML="Road Alignment<small>Curves · pegging · L-section · X-section</small>";
  const C=rdCalc(),G=rdGeom(C),P=rdPegs(C,G),L=rdLvCalc(),li=rdLvIssues(L,P),bad=rdIssues();
  const nC=C.rows.filter(r=>r.curve).length,nX=RD.lv.items.filter(it=>it.k==="x").length;
  const step=(n,href,name,sub,state)=>`<button class="wcard ${state}" onclick="location.hash='${href}'"><div class="wic" style="font-size:20px">${n}</div><div class="wtx"><b>${name}</b><small>${sub}</small></div><span class="wgo">›</span></button>`;
  const fl=allLev(k=>k==="fly"?LEV.lines.map(levStatus).filter(v=>v!==undefined):null).fly||[];
  app.innerHTML=`<div id="rbanner"></div>
  <div class="hubhead"><h3>Road alignment</h3><p>Corridor about 700 m × 30 m, through the bridge axis ${esc(rdAxis().join("–"))}. Tap a task.</p></div>
  ${step(1,"road/ip","Alignment · IPs and curves",RD.ips.length?`${RD.ips.length} point${RD.ips.length>1?"s":""} · ${nC} curve${nC===1?"":"s"}${C.end!=null?" · length "+rdF(C.end-C.start,1)+" m":""}`:"Deflection angles · radius · TL, L, E · BC, MC, EC",bad.length?"bad":C.rows.length&&C.rows.every(r=>!r.w.some(w=>w[0]!=="warn"))?"ok":"")}
  ${step(2,"road/peg","Pegging and setting out",P.length?`${P.length} pegs every ${esc(RD.peg||"15")} m + BC, MC, EC`:"Needs the alignment first","")}
  ${step(3,"road/lv","L-section and X-section levelling",nX?`${nX} section${nX>1?"s":""}${L.errMm!=null?" · closed "+(L.errMm>0?"+":"")+L.errMm+" mm":""}`:"HI method · every peg · 10 m each side · ±24√K",li.length?"bad":L.ok?"ok":"")}
  ${step(4,"fly","TBM fly levelling",fl.length?`${fl.length} run${fl.length>1?"s":""} in Unlinked Fly Levelling`:"TBM every ~500 m and near cross drainage · FW + BW","")}
  ${step("⚙","road/set","Limits · data","Norms · CSV · clear","")}`;
  rdBanner([...bad,...li])}

/* alignment page */
function rdDmsIn(attr,v,ph){v=v||["","",""];return `<div class="dms">${[0,1,2].map(j=>`<input ${j?"":'class="d"'} inputmode="numeric" ${attr} data-j="${j}" value="${esc(v[j]||"")}" placeholder="${ph?ph[j]:"°′″"[j]}"><i>${"°′″"[j]}</i>`).join("")}</div>`}
function renderRoadIP(){backTo="road";homeBtn.textContent="◀ Road";
  title.innerHTML="Alignment<small>IP table · curve elements · chainage</small>";
  const S=RD.start,[A,B]=rdAxis();
  const card=(ip,i)=>{const last=i===RD.ips.length-1,prevN=i?RD.ips[i-1].p||"previous":S.p||"start",nextN=last?"":RD.ips[i+1].p||"next";
    return `<div class="card" id="ric${i}"><div class="row" style="border:0;padding-top:0"><span><b>Point</b> <input class="pt" style="width:70px" data-ri="${i}" data-k="p" value="${esc(ip.p)}" autocapitalize="characters"></span><span id="ris${i}"></span></div>
    <div class="dist"><label>Distance from ${esc(prevN)} (m)</label><input inputmode="decimal" data-ri="${i}" data-k="d" value="${esc(ip.d)}"></div>
    ${last?`<p class="note">Last point: the end of the road (or add the next IP below).</p>`:`<div class="obs"><label>Angle at ${esc(ip.p||"IP")}: zero on ${esc(prevN)}, clockwise to ${esc(nextN)}</label>${rdDmsIn(`data-ra="${i}"`,ip.a)}</div>
    <div class="dist"><label>Radius R (m) <small class="note" id="rir${i}"></small></label><input inputmode="decimal" data-ri="${i}" data-k="R" value="${esc(ip.R)}" placeholder="e.g. 30"></div>`}
    <div id="rio${i}"></div>
    <div class="btns" style="margin-top:6px">${i?`<button class="btn" onclick="rdMove(${i},-1)">▲</button>`:""}${last?"":`<button class="btn" onclick="rdMove(${i},1)">▼</button>`}<button class="btn" onclick="rdDelIP(${i})">Delete</button></div></div>`};
  app.innerHTML=`<div id="rbanner"></div>
  <div class="card"><h2>Start</h2>
    <div class="row"><span>Start point</span><input class="pt" style="width:70px" data-rs="p" value="${esc(S.p)}" autocapitalize="characters"></div>
    <div class="row"><span>Chainage of start (m)</span><input class="cfgin" inputmode="decimal" data-rs="ch" value="${esc(S.ch)}"></div>
    <div class="obs"><label>Bearing of the first leg (${esc(S.p||"start")} → ${esc((RD.ips[0]&&RD.ips[0].p)||"IP1")})</label>${rdDmsIn('data-rb="1"',S.brg)}</div>
    <div class="row"><span>${esc(S.p||"Start")} N / E (optional)</span><span style="white-space:nowrap"><input class="cfgin" style="width:110px" inputmode="decimal" data-rs="N" value="${esc(S.N)}" placeholder="N"> <input class="cfgin" style="width:110px" inputmode="decimal" data-rs="E" value="${esc(S.E)}" placeholder="E"></span></div>
    <p class="note">Bearing and N/E only give leg bearings and peg coordinates; chainages do not need them.</p></div>
  ${RD.ips.map(card).join("")||`<div class="card"><p class="note">No points yet. Add IP1, IP2, … in order along the road. Enter the bridge ends ${esc(A)} and ${esc(B)} as points too (no angle: the road is straight across the bridge).</p></div>`}
  <div class="btns" style="margin-bottom:10px"><button class="btn pri" onclick="rdAddIP()">+ Next IP</button><button class="btn" onclick="rdAddIP('${esc(A)}')">+ ${esc(A)}</button><button class="btn" onclick="rdAddIP('${esc(B)}')">+ ${esc(B)}</button></div>
  <div class="card"><h2>Sketch</h2><div id="rsk"></div><p class="note" id="rskn"></p></div>`;
  app.querySelectorAll("[data-ri]").forEach(el=>{el.addEventListener("input",()=>{const ip=RD.ips[+el.dataset.ri],k=el.dataset.k;
    if(k==="p"){el.value=el.value.toUpperCase();ip.p=el.value.trim()}else{el.value=el.value.replace(/[^\d.]/g,"");ip[k]=el.value}rdSave();rdIPUpd()});
    if(el.dataset.k==="p")el.addEventListener("change",()=>renderRoadIP())});
  app.querySelectorAll("[data-ra]").forEach(el=>{el.addEventListener("input",()=>{el.value=el.value.replace(/[^\d.]/g,"");const ip=RD.ips[+el.dataset.ra];ip.a=ip.a||["","",""];ip.a[+el.dataset.j]=el.value;rdSave();rdIPUpd();
    const j=+el.dataset.j;if((j===0&&el.value.length>=3)||(j>0&&el.value.length>=2)){const all=[...app.querySelectorAll("input")],n=all[all.indexOf(el)+1];if(n)n.focus()}});el.addEventListener("focus",()=>el.select())});
  app.querySelectorAll("[data-rs]").forEach(el=>el.addEventListener("input",()=>{const k=el.dataset.rs;if(k==="p"){el.value=el.value.toUpperCase();S.p=el.value.trim()}else S[k]=el.value.replace(/[^\d.\-]/g,"");rdSave();rdIPUpd()}));
  app.querySelectorAll("[data-rb]").forEach(el=>el.addEventListener("input",()=>{el.value=el.value.replace(/[^\d.]/g,"");S.brg[+el.dataset.j]=el.value;rdSave();rdIPUpd()}));
  rdIPUpd()}
function rdIPUpd(){const C=rdCalc(),G=rdGeom(C);
  C.rows.forEach((r,i)=>{const o=document.getElementById("rio"+i),s=document.getElementById("ris"+i),rr=document.getElementById("rir"+i);if(!o)return;
    const bad=r.w.some(w=>w[0]==="bad");s.innerHTML=bad?pill("bad","check"):r.curve?pill(r.D<RD_LIM.dSet?"warn":"ok",(r.dir==="R"?"Right ":"Left ")+bDms(r.D)):r.th!=null&&r.D<1e-9?pill("ok","straight"):r.ch!=null?pill("wait","ch "+rdF(r.ch)):"";
    if(rr)rr.textContent=r.rMax!=null?`fits up to R ${r.rMax} m`:"";
    o.innerHTML=`${r.th!=null?`<div class="row"><span>Deflection Δ</span><b>${r.D<1e-9?"0 (straight)":(r.dir==="R"?"+ ":"− ")+bDms(r.D)+(r.dir==="R"?" right":" left")}</b></div>`:""}
      ${r.curve?`<div class="row"><span>TL · L · E</span><b>${rdF(r.TL)} · ${rdF(r.L)} · ${rdF(r.E)}</b></div>
      <div class="row"><span>BC · MC · EC</span><b>${rdF(r.BC)} · ${rdF(r.MC)} · ${rdF(r.EC)}</b></div>`:""}
      <div class="row"><span>Chainage of ${esc(r.ip.p||"point")}</span><b class="big">${rdF(r.ch)}</b></div>
      ${r.brgIn!=null?`<div class="row"><span>Bearing in${r.brgOut!=null&&!r.last?" → out":""}</span><b>${bDms(r.brgIn)}${r.brgOut!=null&&!r.last&&r.th!=null?" → "+bDms(r.brgOut):""}</b></div>`:""}
      ${r.w.map(([st,t])=>`<div class="row"><span></span>${pill(st,esc(t))}</div>`).join("")}`});
  rdBanner(rdIssues());rdSketch(C,G)}
function rdSketch(C,G){const el=document.getElementById("rsk");if(!el)return;const pts=[];
  G.segs.forEach(g=>{const n=g.t==="a"?24:1;for(let i=0;i<=n;i++){const p=G.at(g.c0+(g.c1-g.c0)*i/n);if(p)pts.push(p)}});
  const all=[...pts,...G.ips];if(all.length<2){el.innerHTML='<p class="note">Enter distances and angles to see the road.</p>';return}
  const Es=all.map(p=>p.E),Ns=all.map(p=>p.N),e0=Math.min(...Es),e1=Math.max(...Es),n0=Math.min(...Ns),n1=Math.max(...Ns),W=340,H=240,pad=22;
  const sc=Math.min((W-2*pad)/Math.max(e1-e0,1),(H-2*pad)/Math.max(n1-n0,1)),X=p=>pad+(p.E-e0)*sc,Y=p=>H-pad-(p.N-n0)*sc;
  const [A,B]=rdAxis(),pg=rdPegs(C,G);
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;background:var(--input);border-radius:10px">
    <polyline points="${G.ips.map(p=>X(p).toFixed(1)+","+Y(p).toFixed(1)).join(" ")}" fill="none" stroke="var(--mut)" stroke-width="1" stroke-dasharray="4 3"/>
    <polyline points="${pts.map(p=>X(p).toFixed(1)+","+Y(p).toFixed(1)).join(" ")}" fill="none" stroke="var(--acc)" stroke-width="3" stroke-linejoin="round"/>
    ${pg.filter(q=>q.pos).map(q=>`<circle cx="${X(q.pos).toFixed(1)}" cy="${Y(q.pos).toFixed(1)}" r="${q.lab.length?3:1.8}" fill="${q.lab.length?"var(--ink)":"var(--mut)"}"/>`).join("")}
    ${G.ips.map(p=>`<text x="${(X(p)+4).toFixed(1)}" y="${(Y(p)-5).toFixed(1)}" font-size="11" font-weight="700" fill="${p.p===A||p.p===B?"var(--bad,#c33)":"var(--ink)"}">${esc(p.p||"")}</text>`).join("")}</svg>`;
  document.getElementById("rskn").textContent=G.real?"North up, from the start coordinates and bearing.":"North up if the bearing is typed; otherwise drawn with an assumed bearing of 90°. Dashed: tangents through the IPs. Dots: pegs."}
function rdAddIP(name){const n=RD.ips.filter(x=>/^IP\d+$/.test(x.p)).length+1;RD.ips.push({id:newId(),p:name||"IP"+n,d:"",a:["","",""],R:""});rdSave();renderRoadIP();
  setTimeout(()=>{const el=document.querySelector(`[data-ri="${RD.ips.length-1}"][data-k="d"]`);if(el){el.scrollIntoView({block:"center"});el.focus()}},50)}
function rdDelIP(i){if(confirm(`Delete ${RD.ips[i].p||"this point"} and its readings?`)){RD.ips.splice(i,1);rdSave();renderRoadIP()}}
function rdMove(i,d){const j=i+d;if(j<0||j>=RD.ips.length)return;[RD.ips[i],RD.ips[j]]=[RD.ips[j],RD.ips[i]];rdSave();renderRoadIP()}

/* pegging page */
function renderRoadPeg(){backTo="road";homeBtn.textContent="◀ Road";
  title.innerHTML="Pegging · setting out<small>Every 15 m + BC, MC, EC</small>";
  const C=rdCalc(),G=rdGeom(C),P=rdPegs(C,G),cv=C.rows.filter(r=>r.curve);
  const hcr=r=>{const t=r.th;return n360(r.dir==="L"?t/2:t/2+180)};
  app.innerHTML=`<div id="rbanner"></div>
  <div class="card"><h2>Peg interval</h2><div class="row"><span>Interval (m)</span><input class="cfgin" inputmode="decimal" id="rpi" value="${esc(RD.peg)}"></div>
    <p class="note">Guideline: pegs at 15 m (chainages that are multiples of 15) and at BC, MC, EC.</p></div>
  ${cv.map(r=>`<div class="card"><h2>Curve ${r.n} at ${esc(r.ip.p)} · ${r.dir==="R"?"right":"left"} ${bDms(r.D)} · R ${rdF(r.R,0)} m</h2>
    ${r.D<RD_LIM.dSet?`<p class="note">Δ below 3°: no setting out needed (chainages still count the curve).</p>`:""}
    <div class="row"><span>BC: from ${esc(r.ip.p)} back towards ${esc(r.prev?r.prev.ip.p:RD.start.p)}</span><b>TL ${rdF(r.TL)} m · ch ${rdF(r.BC)}</b></div>
    <div class="row"><span>EC: from ${esc(r.ip.p)} on towards ${esc((RD.ips[r.i+1]||{}).p||"next")}</span><b>TL ${rdF(r.TL)} m · ch ${rdF(r.EC)}</b></div>
    <div class="row"><span>MC: zero on ${esc(r.prev?r.prev.ip.p:RD.start.p)}, turn to</span><b>${bDms(hcr(r))} · E ${rdF(r.E)} m · ch ${rdF(r.MC)}</b></div>
    <div class="row"><span>Long chord BC–EC (check)</span><b>${rdF(r.LC)} m</b></div></div>`).join("")}
  <div class="card"><h2>Peg list</h2>${P.length?`<div style="overflow-x:auto"><table><tr><th>Peg</th><th>Chainage</th><th>Set out</th>${G.real?"<th>N</th><th>E</th>":""}</tr>
    ${P.map(q=>`<tr><td><b>${esc(q.lab.join(" / ")||"")}</b></td><td>${rdF(q.ch)}</td><td style="white-space:nowrap">${q.cv?(q.cv.D<RD_LIM.dSet?"curve, not set out":`BC${q.cv.n} ∠${bDms(q.defl).replace(/ /g,"")} ${q.cv.dir}<br><small class="note">chord ${rdF(q.chord)} · x ${rdF(q.x,2)} y ${rdF(q.y,2)}</small>`):`+${rdF(q.along)} m<br><small class="note">from ${esc(q.from.lab)}</small>`}</td>${G.real?`<td>${q.pos?q.pos.N.toFixed(3):""}</td><td>${q.pos?q.pos.E.toFixed(3):""}</td>`:""}</tr>`).join("")}</table></div>
    <p class="note">On a curve: theodolite at BC sighting the IP, turn the deflection angle (R = to the right, L = to the left), tape the chord from BC. Or use x along the tangent from BC and y square off it.</p>`:'<p class="note">Fill the alignment first.</p>'}</div>`;
  document.getElementById("rpi").addEventListener("change",e=>{RD.peg=e.target.value.replace(/[^\d.]/g,"")||"15";rdSave();renderRoadPeg()});
  rdBanner(rdIssues())}

/* levelling page */
function renderRoadLv(){backTo="road";homeBtn.textContent="◀ Road";
  title.innerHTML="L-section · X-section<small>HI method · ±24√K · 0.6–3.0 m turning points</small>";
  const V=RD.lv;let k=1;
  const rin=(a,v,ph)=>`<input class="cfgin" style="width:86px" inputmode="decimal" ${a} value="${esc(v||"")}" placeholder="${ph||""}">`;
  const rbx=(a,v)=>`<div class="tmb"><input inputmode="decimal" enterkeyhint="next" placeholder="M" ${a} value="${esc(v||"")}"></div>`;
  const side=(it,ii,s)=>`${it[s].map((q,j)=>`<div class="obs"><label><b>${s}</b> <input class="cfgin" style="width:54px" inputmode="decimal" data-xo="${ii}" data-s="${s}" data-j="${j}" value="${esc(q.o||"")}" placeholder="m"> m <small class="note" id="rlv_${ii}_${s}${j}"></small></label>${rbx(`data-xr="${ii}" data-s="${s}" data-j="${j}"`,q.r)}</div>`).join("")}
    <div class="btns" style="margin:2px 0 6px"><button class="btn" onclick="rdXAdd(${ii},'${s}')">+ ${s==="L"?"Left":"Right"} point</button>${it[s].length?`<button class="btn" onclick="rdXDel(${ii},'${s}')">− last</button>`:""}</div>`;
  const card=(it,ii)=>it.k==="x"?`<div class="card" id="rlc${ii}"><div class="row" style="border:0;padding-top:0"><span><b>Section · ch</b> ${rin(`data-xc="${ii}"`,it.ch,"0").replace("width:86px","width:104px")}</span><span class="note">setup ${k}</span></div><div class="note" id="rpk${ii}" style="margin:-4px 0 4px"></div>
      <div class="obs"><label><b>CL</b> centre line <small class="note" id="rlv_${ii}_C"></small></label>${rbx(`data-xl="${ii}"`,it.cl)}</div>
      ${side(it,ii,"L")}${side(it,ii,"R")}
      <div class="btns"><button class="btn" onclick="rdLvDel(${ii})">Delete section</button></div></div>`
    :`<div class="card" id="rlc${ii}"><div class="row" style="border:0;padding-top:0"><span><b>Change point</b> <input class="pt" style="width:70px" data-cp="${ii}" data-k="p" value="${esc(it.p)}" autocapitalize="characters"></span><span id="rlv_${ii}_cp"></span></div>
      <div class="obs"><label><b>FS</b> setup ${k}</label>${rbx(`data-cp="${ii}" data-k="fs"`,it.fs)}</div>
      <div class="obs"><label><b>BS</b> setup ${k+1} · empty = close here</label>${rbx(`data-cp="${ii}" data-k="bs"`,it.bs)}</div>
      <div class="row"><span>On centre line at ch (optional)</span>${rin(`data-cp="${ii}" data-k="ch"`,it.ch,"")}</div>
      <div class="btns"><button class="btn" onclick="rdLvDel(${ii})">Delete</button></div></div>`;
  const cards=V.items.map((it,ii)=>{const h=card(it,ii);if(it.k==="cp"&&rd(it.bs)!=null)k++;return h}).join("");
  app.innerHTML=`<div id="rbanner"></div>
  <div class="card"><h2>Start (setup 1)</h2>
    <div class="row"><span>BM / TBM</span><input class="pt" style="width:80px" id="rbm" value="${esc(V.bm)}" autocapitalize="characters" placeholder="TBM"></div>
    <div class="row"><span>RL of BM (m)</span><input class="cfgin" style="width:120px" inputmode="decimal" id="rrl" value="${esc(V.rl||"")}" placeholder="auto"></div><div id="rrlf"></div>
    <div class="obs"><label><b>BS</b> → BM</label>${rbx('id="rbs"',V.bs)}</div>
    <div class="row"><span>L-section starts at ch</span>${rin('id="rch0"',V.ch0,"auto")}</div><div id="rch0f"></div></div>
  ${cards}
  <div class="btns" style="margin-bottom:10px"><button class="btn pri" onclick="rdLvAdd('x')">+ Section${(()=>{const n=rdNextCh();return n!=null?" (ch "+rdF(n,n%1?3:0)+")":""})()}</button><button class="btn" onclick="rdLvAdd('cp')">+ Change point</button></div>
  <div class="card"><h2>Check and closure</h2>
    <div class="row"><span>RL of closing point (m)</span><input class="cfgin" style="width:120px" inputmode="decimal" id="rcrl" value="${esc(V.closeRl||"")}" placeholder="auto"></div><div id="rcrf"></div>
    <div class="row"><span>K (km)</span>${rin('id="rk"',V.kKm,"auto")}</div>
    <div id="rlres"></div>
    <p class="note">Inside a curve, sections only at BC, MC and EC. Close on a point with a known RL (bridge end ${esc(rdAxis()[0])}, or back on the BM). Readings in metres (1.524) or mm (1524). Offsets: 5 m apart, at least 10 m each side, plus slope breaks.</p></div>`;
  const bind=(sel,fn)=>app.querySelectorAll(sel).forEach(el=>{el.addEventListener("input",()=>{fn(el);rdSave();rdLvUpd()});el.addEventListener("focus",()=>el.select())});
  const clean=el=>el.value=el.value.replace(/[^\d.]/g,"");
  bind("[data-xc]",el=>{clean(el);V.items[+el.dataset.xc].ch=el.value});
  bind("[data-xl]",el=>{clean(el);V.items[+el.dataset.xl].cl=el.value});
  bind("[data-xo]",el=>{clean(el);V.items[+el.dataset.xo][el.dataset.s][+el.dataset.j].o=el.value});
  bind("[data-xr]",el=>{clean(el);V.items[+el.dataset.xr][el.dataset.s][+el.dataset.j].r=el.value});
  bind("[data-cp]",el=>{const it=V.items[+el.dataset.cp],key=el.dataset.k;if(key==="p"){el.value=el.value.toUpperCase();it.p=el.value.trim()}else{clean(el);it[key]=el.value}});
  app.querySelectorAll('[data-cp][data-k="bs"]').forEach(el=>el.addEventListener("change",()=>renderRoadLv()));
  // after a reading with 3 decimals (1.524), jump to the next reading box
  const RDS=Array.from(app.querySelectorAll('#rbs,[data-xl],[data-xr],[data-cp][data-k="fs"],[data-cp][data-k="bs"]'));RDS.forEach((el,i)=>{el.dataset.rdi=i});
  RDS.forEach((el,i)=>{const next=()=>{if(i+1>=RDS.length){el.blur();return}const sel=`[data-rdi="${i+1}"]`;RDS[i+1].focus();
      const t=app.querySelector(sel);if(t){if(document.activeElement!==t)t.focus();t.select();t.scrollIntoView({block:"center"})}};
    el.addEventListener("input",()=>{el.classList.toggle("err",el.value!==""&&rd(el.value)==null);if(/^\d\.\d{3}$/.test(el.value)||/^\d{4}$/.test(el.value))next()});
    el.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();next()}})});
  bind("#rbm",el=>{el.value=el.value.toUpperCase();V.bm=el.value.trim()});
  bind("#rrl",el=>{V.rl=el.value.replace(/[^\d.\-]/g,"")});bind("#rbs",el=>{clean(el);V.bs=el.value});
  bind("#rch0",el=>{clean(el);V.ch0=el.value});app.querySelectorAll("#rch0,#rbm").forEach(el=>el.addEventListener("change",()=>renderRoadLv()));
  bind("#rcrl",el=>{V.closeRl=el.value.replace(/[^\d.\-]/g,"")});bind("#rk",el=>{clean(el);V.kKm=el.value});
  rdLvUpd()}
// a plain 15 m peg is covered by a section within ±3 m of it (field allows 43 or 47 for 45); BC, MC, EC and named points need the exact chainage
// L-section inside a curve only at BC, MC, EC (plain 15 m pegs on the curve are skipped)
function rdLvPegs(P){return P.filter(q=>q.lab.length||!q.cv)}
function rdHave(){return RD.lv.items.filter(it=>it.k==="x").map(it=>bNum(it.ch)).filter(x=>x!=null)}
function rdCovered(q,have){const tol=q.lab.length?0.05:RD_LIM.near+1e-6;return have.some(c=>Math.abs(c-q.ch)<=tol)}
function rdPegAt(P,c){if(c==null)return null;let b=null;for(const q of P){const d=Math.abs(q.ch-c),tol=q.lab.length?0.05:RD_LIM.near+1e-6;if(d<=tol&&(!b||d<b.d))b={q,d}}return b}
// where the L-section starts: typed chainage, else the chainage of the BM if it is an alignment point (e.g. bridge end A)
function rdLvStart(C){const t=bNum(RD.lv.ch0);if(t!=null)return{ch:t,from:"typed"};const bm=(RD.lv.bm||"").trim().toUpperCase();if(!bm)return null;
  if((RD.start.p||"").toUpperCase()===bm)return{ch:C.start,from:bm};const r=C.rows.find(r=>(r.ip.p||"").toUpperCase()===bm&&r.ch!=null);return r?{ch:r.ch,from:bm}:null}
function rdNextCh(){const C=rdCalc(),P=rdPegs(C,null),have=rdHave(),st=rdLvStart(C),step=bNum(RD.peg)||15;
  if(!have.length&&st)return Math.round(st.ch*1000)/1000;
  const last=have.length?have[have.length-1]:null,prev=have.length>1?have[have.length-2]:st?st.ch:null;
  const [bA,bB]=rdAxis(),away=st&&!have.slice(1).length?(()=>{const o=C.rows.find(r=>r.ip.p===(st.from===bA?bB:st.from===bB?bA:null));return o&&o.ch!=null&&o.ch>st.ch+0.01?-1:1})():1;
  const dir=have.length>1?(last<prev-0.01?-1:1):away,base=last??(dir>0?C.start-1:Infinity);
  const cand=rdLvPegs(P).filter(q=>(dir>0?q.ch>base+0.0005:q.ch<base-0.0005)&&!rdCovered(q,have)&&!(last!=null&&!q.lab.length&&Math.abs(q.ch-last)<=RD_LIM.near+1e-6));
  const n=dir>0?cand[0]:cand[cand.length-1];if(n)return Math.round(n.ch*1000)/1000;
  if(P.length)return null;if(last==null)return 0;return dir>0?Math.floor(last/step+1+1e-9)*step:Math.ceil(last/step-1-1e-9)*step}
function rdLvAdd(t){const V=RD.lv;if(t==="x"){const c=rdNextCh();V.items.push({id:newId(),k:"x",ch:c!=null?String(c):"",cl:"",L:[{o:"5",r:""},{o:"10",r:""}],R:[{o:"5",r:""},{o:"10",r:""}]})}
  else{const n=V.items.filter(it=>it.k==="cp").length+1;V.items.push({id:newId(),k:"cp",p:"TP"+n,fs:"",bs:"",ch:""})}
  rdSave();renderRoadLv();setTimeout(()=>{const c=document.getElementById("rlc"+(V.items.length-1));if(c){c.scrollIntoView({block:"center"});const i=c.querySelector(t==="x"?"[data-xl]":'[data-k="fs"]');if(i)i.focus()}},50)}
function rdXAdd(ii,s){const a=RD.lv.items[ii][s],lastO=a.length?bNum(a[a.length-1].o)||0:0;a.push({o:String(lastO+5),r:""});rdSave();renderRoadLv();
  setTimeout(()=>{const el=document.querySelector(`[data-xr="${ii}"][data-s="${s}"][data-j="${a.length-1}"]`);if(el){el.scrollIntoView({block:"center"});el.focus()}},50)}
function rdXDel(ii,s){RD.lv.items[ii][s].pop();rdSave();renderRoadLv()}
function rdLvDel(ii){const it=RD.lv.items[ii];if(confirm(it.k==="x"?`Delete the section at ch ${it.ch||"?"} and its readings?`:`Delete change point ${it.p||""}?`)){RD.lv.items.splice(ii,1);rdSave();renderRoadLv()}}
function rdLvUpd(){const L=rdLvCalc(),C=rdCalc(),P=rdPegs(C,null);
  L.rows.forEach(r=>{if(r.t==="is"){const el=document.getElementById(`rlv_${r.ii}_${r.side}${r.side==="C"?"":r.j}`);if(el)el.textContent=r.rl!=null?"RL "+r.rl.toFixed(3):""}
    else if(r.t==="cp"){const el=document.getElementById(`rlv_${r.ii}_cp`);if(el)el.innerHTML=r.rl!=null?pill(r.bs==null?"warn":"ok","RL "+r.rl.toFixed(3)):""}});
  RD.lv.items.forEach((it,ii)=>{if(it.k!=="x")return;const el=document.getElementById("rpk"+ii);if(!el)return;const c=bNum(it.ch);if(c==null){el.textContent="";return}
    const m=rdPegAt(P,c);el.textContent=m?(m.q.lab.length?m.q.lab.join(" / ")+" · "+rdChTxt(m.q.ch):"peg "+rdF(m.q.ch,0)+(m.d>0.05?` (${(c-m.q.ch>0?"+":"−")+Math.abs(c-m.q.ch).toFixed(1)} m off, OK within ${RD_LIM.near} m)`:""))+(m.q.cv&&!m.q.lab.length?" · on curve "+m.q.cv.n:""):P.length?(it.L.concat(it.R).some(q=>rd(q.r)!=null)?"extra section (culvert, slope break)":"L-section point only (culvert end, slope break)"):rdChTxt(c)});
  {const st=rdLvStart(C),e=document.getElementById("rch0f");if(e)e.innerHTML=bNum(RD.lv.ch0)==null?(st?`<p class="note">Starting at ch ${rdF(st.ch)} (chainage of ${esc(st.from)} on the alignment). Type to override.</p>`:`<p class="note">Type the chainage of the first section, or name an alignment point (e.g. A) as the BM.</p>`):""}
  const f=document.getElementById("rrlf");if(f)f.innerHTML=num(RD.lv.rl)==null?(L.rl0!=null?`<p class="note">Using ${L.rl0.toFixed(3)} from “${esc(L.from)}” (same name). Type to override.</p>`:`<p class="note">No job has an RL for “${esc(RD.lv.bm||"?")}”. Type it.</p>`):"";
  const g=document.getElementById("rcrf");if(g)g.innerHTML=num(RD.lv.closeRl)==null&&L.closed?(L.known!=null?`<p class="note">${esc(L.endP||"")}: ${L.known.toFixed(3)} from “${esc(L.kFrom)}”.</p>`:`<p class="note">No job has an RL for “${esc(L.endP||"?")}”. Type it to get the closing error.</p>`):"";
  const res=document.getElementById("rlres");if(res)res.innerHTML=`
    <div class="row"><span>ΣBS − ΣFS</span><b>${L.sBS.toFixed(3)} − ${L.sFS.toFixed(3)} = ${(L.sBS-L.sFS).toFixed(3)}</b></div>
    ${L.end!=null&&L.rl0!=null?`<div class="row"><span>Last RL − first RL</span>${pill(L.arith?"ok":"bad",(L.end-L.rl0).toFixed(3))}</div>`:""}
    <div class="row"><span>Observed RL of ${esc(L.endP||"closing point")}</span><b>${L.closed?rdF(L.end):"not closed yet"}</b></div>
    <div class="row"><span>Closing error</span>${L.errMm!=null?pill(L.ok===false?"bad":L.ok?"ok":"wait",(L.errMm>0?"+":"")+L.errMm+" mm"):"<b>–</b>"}</div>
    <div class="row"><span>Permissible ±24√K${num(RD.lv.kKm)==null&&L.K?" (K from chainages "+rdF(L.span,1)+" m)":""}</span><b>${L.perm!=null?"±"+L.perm.toFixed(1)+" mm":"–"}</b></div>
    ${L.errMm!=null?`<div class="row"><span>Correction</span><b>−e × setup / ${L.nS} setups</b></div>`:""}`;
  rdBanner(rdLvIssues(L,P))}

/* settings + guide */
function renderRoadSet(){backTo="road";homeBtn.textContent="◀ Road";title.innerHTML="Limits · data<small>Road alignment</small>";
  app.innerHTML=`<div class="card"><h2>Norms (guideline road items 4-17)</h2>
    <div class="row"><span>Ground gradient along the alignment</span><b>≤ ${RD_LIM.grade}%</b></div>
    <div class="row"><span>Radius</span><b>≥ ${RD_LIM.rMin} m, multiple of 5 or 10</b></div>
    <div class="row"><span>Deflection angle</span><b>≤ ${RD_LIM.dMax}°</b></div>
    <div class="row"><span>No curve setting out</span><b>Δ &lt; ${RD_LIM.dSet}° (chainage still computed)</b></div>
    <div class="row"><span>Curves and the bridge</span><b>BC and EC outside ${esc(rdAxis().join("–"))}</b></div>
    <div class="row"><span>Reverse / compound curves</span><b>avoid · curves must not overlap</b></div>
    <div class="row"><span>Pegs</span><b>every 15 m + BC, MC, EC</b></div>
    <div class="row"><span>Cross section</span><b>≥ ${RD_LIM.xs} m each side, 5 m interval</b></div>
    <div class="row"><span>Turning point readings</span><b>${RD_LIM.lo}–${RD_LIM.hi} m</b></div>
    <div class="row"><span>Closing error</span><b>±24√K mm</b></div>
    <p class="note">The ${RD_LIM.gap} m straight used to flag reverse / compound curves is this app's choice; the guideline only says avoid them.</p></div>
  <div class="card"><h2>Data</h2><p class="note">Backup, merge and Excel export on the home screen include the road.</p>
    <div class="btns" style="margin-top:8px"><button class="btn pri" onclick="backup()">Save backup</button><button class="btn" onclick="rdExport()">Road CSV</button></div>
    <div class="btns" style="margin-top:10px"><button class="btn" onclick="rdClear()">Clear road data…</button></div></div>`}
function renderRoadGuide(){backTo="road";homeBtn.textContent="◀ Road";guideBtn.classList.add("hidden");
  title.innerHTML="Road alignment: what to do<small>Day 8–9, with the partner group</small>";
  const s=(n,h,b)=>`<div class="gstep"><div class="gn">${n}</div><div><b>${h}</b><div>${b}</div></div></div>`;
  app.innerHTML=`<div class="card"><h2>Steps</h2>
    ${s(1,"Recce","Walk start → bridge → end (about 700 m). Start, end and the bridge site are given. Place IPs on firm ground with a clear view of the previous and next IP. Ground slope ≤ 12% (clinometer or vertical angle), Δ ≤ 90°, the bridge A–B on a straight.")}
    ${s(2,"Bearing of the first leg","Compass, or from control coordinates if the road starts at a traverse station.")}
    ${s(3,"At every IP","Zero on the previous IP, read clockwise to the next IP, and tape or EDM the IP to IP distance. The app gives Δ (right or left), the largest R that fits, TL, L, E and BC, MC, EC chainages.")}
    ${s(4,"Set out the curve","BC: TL back from the IP. EC: TL forward. MC: E along the bisector (the angle is on the Pegging page). Then pegs every 15 m and on the curve from BC by deflection angle + chord.")}
    ${s(5,"Levelling","From the BM: centre line at every peg, BC, MC, EC and slope breaks; cross section 10 m each side at 5 m intervals. Turning points 0.6–3.0 m. Close on the bridge end A (or a TBM). TBM about every 500 m and near cross drainage, closed by fly levelling.")}
    ${s(6,"Books","Format 18 (curve chainage), format 14 (L-section and X-section), tacheometry book. Print them from the field book.")}
    ${s(7,"Drawings","Plan 1:500 (5 m formation, 20 m right of way, IPs, curves, chainages). L-section H 1:1000 V 1:100 with formation level. X-sections 1:100, side slopes fill 2:1, cut 1.5:1 (H:V).")}</div>
  <div class="nav"><button class="btn pri" onclick="location.hash='road'">Road menu</button></div>`}
function rdClear(){if(prompt("Type DELETE to clear all road data on this phone. A backup file is saved first.")==="DELETE"){backup();RD=rdBlank();rdSave();route()}}
function rdMerge(src){if(!src||!Array.isArray(src.ips))return 0;let n=0;
  for(const x of src.ips){const y=RD.ips.find(z=>z.id===x.id);if(!y){RD.ips.push(x);n++;continue}for(const k of["d","R"])if(bNum(x[k])!=null&&bNum(y[k])==null){y[k]=x[k];n++}if(bDeg(x.a)!=null&&bDeg(y.a)==null){y.a=x.a;n++}}
  if(src.lv)for(const x of src.lv.items||[]){if(!RD.lv.items.some(z=>z.id===x.id)){RD.lv.items.push(x);n++}}
  if(src.lv)for(const k of["bm","rl","bs","ch0","closeRl","kKm"])if(!RD.lv[k]&&src.lv[k])RD.lv[k]=src.lv[k];
  if(src.start&&bDeg(RD.start.brg)==null&&bDeg(src.start.brg)!=null)RD.start=src.start;
  rdSave();return n}
function rdCSV(csv){if(!RD.ips.length&&!RD.lv.items.length)return "";const C=rdCalc(),G=rdGeom(C),P=rdPegs(C,G),L=rdLvCalc();let o="";
  const a=[["From","To","IP to IP distance","Point","Chainage","Defl ±","d","m","s","R","TL","L","E","BC","MC","EC"]];let prev=RD.start.p;
  a.push(["",RD.start.p,"",RD.start.p,rdF(C.start)]);
  C.rows.forEach(r=>{const dm=r.D>1e-9?prSplit(r.D):null;a.push([prev,r.ip.p,r.d??"",r.ip.p,r.ch!=null?r.ch.toFixed(3):"",dm?(r.dir==="R"?"+":"-"):"",dm?dm.d:"",dm?dm.m:"",dm?dm.s:"",r.R??"",r.curve?r.TL.toFixed(3):"",r.curve?r.L.toFixed(3):"",r.curve?r.E.toFixed(3):"",r.curve?r.BC.toFixed(3):"",r.curve?r.MC.toFixed(3):"",r.curve?r.EC.toFixed(3):""]);prev=r.ip.p});
  o+="\n\nROAD ALIGNMENT (template Road Alignment sheet)\n"+a.map(csv).join("\n");
  if(P.length)o+="\n\nROAD PEGS\n"+[["Peg","Chainage","N","E"]].concat(P.map(q=>[q.lab.join("/"),q.ch.toFixed(3),G.real&&q.pos?q.pos.N.toFixed(3):"",G.real&&q.pos?q.pos.E.toFixed(3):""])).map(csv).join("\n");
  const b=[["Point","Left offset","CL chainage","Right offset","BS","IS","FS","HI","RL","Correction","Corrected RL"]];
  L.rows.forEach(r=>{const hi=r.t==="cp"?r.hiNext:r.hi;b.push(r.t==="bm"?[r.p,"","","",r.bs??"","","",hi!=null?hi.toFixed(3):"",prF3(r.rl),"0",prF3(r.crl)]:r.t==="cp"?[r.p,"",r.ch??"","",r.bs??"","",r.fs??"",hi!=null?hi.toFixed(3):"",prF3(r.rl),r.corr!=null?r.corr.toFixed(4):"",prF3(r.crl)]:
    ["",r.side==="L"?r.o:"",r.side==="C"?r.ch??"":"",r.side==="R"?r.o:"","",r.r??"","","",prF3(r.rl),r.corr!=null?r.corr.toFixed(4):"",prF3(r.crl)])});
  if(L.rows.length>1)o+="\n\nPROFILE AND CROSS SECTION LEVELLING (template Profile Levelling)\n"+b.map(csv).join("\n");
  return o+"\n"}
function rdExport(){const csv=r=>r.map(v=>v==null?"":/[",\n]/.test(v)?`"${String(v).replace(/"/g,'""')}"`:v).join(",");download(blobFile(rdCSV(csv).trim()+"\n",`road-${stamp()}.csv`,"text/csv"))}

/* --- print book: format 18 (curve chainage) and format 14 (L-section and X-section) --- */
function prRoadAvail(){return RD.ips.some(ip=>bNum(ip.d)!=null)||RD.lv.items.length>0}
function prRoadPages(){const out=[],C=rdCalc(),G=rdGeom(C),P=rdPegs(C,G),L=rdLvCalc();
  if(C.rows.length){let prev=RD.start.p;
    const rows=`<tr><td>${prE(RD.start.p)}</td><td></td><td></td><td>${prE(RD.start.p)}</td><td>${prF3(C.start)}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`+
      C.rows.map(r=>{const dm=r.D>1e-9?prSplit(r.D):null,cv=r.curve,f=x=>cv?prF3(x):"";const t=`<tr><td>${prE(prev)}</td><td>${prE(r.ip.p)}</td><td>${r.d!=null?r.d.toFixed(3):""}</td><td>${prE(r.ip.p)}</td><td>${prF3(r.ch)}</td>
        <td>${dm?(r.dir==="R"?"+":"−"):""}</td><td>${dm?dm.d:""}</td><td>${dm?String(dm.m).padStart(2,"0"):""}</td><td>${dm?String(dm.s).padStart(2,"0"):""}</td><td>${cv?r.R:""}</td><td>${f(r.TL)}</td><td>${f(r.L)}</td><td>${f(r.E)}</td><td>${f(r.BC)}</td><td>${f(r.MC)}</td><td>${f(r.EC)}</td><td>${cv&&r.D<RD_LIM.dSet?"Δ&lt;3°: not set out":r.ip.p===rdAxis()[0]||r.ip.p===rdAxis()[1]?"Bridge axis":""}</td></tr>`;prev=r.ip.p;return t}).join("");
    out.push({t:"Road: curve chainage",h:prPage(18,"Chainage Computation of Curve in Road Alignment","Road Alignment",`<table class="bk"><tr><th colspan="2">Line / Leg</th><th rowspan="2">IP to IP<br>Distance (m)</th><th rowspan="2">IP<br>Station</th><th rowspan="2">Chainage<br>of IP (m)</th><th colspan="4">Deflection Angle ±Δ</th><th rowspan="2">Radius<br>R (m)</th><th rowspan="2">Tangent<br>Length TL</th><th rowspan="2">Length of<br>Curve L</th><th rowspan="2">Apex<br>Distance E</th><th rowspan="2">Chainage<br>of BC</th><th rowspan="2">Chainage<br>of MC</th><th rowspan="2">Chainage<br>of EC</th><th rowspan="2">Remarks</th></tr>
      <tr><th>From</th><th>To</th><th>±</th><th>d</th><th>m</th><th>s</th></tr>${rows}</table>
      <p class="pnote">TL = R tan(Δ/2), L = πRΔ/180, E = R(sec Δ/2 − 1), BC = IP − TL, MC = BC + L/2, EC = BC + L; next IP chainage = EC + IP to IP distance − TL. R ≥ 15 m, Δ ≤ 90°, gradient ≤ 12%.</p>`,{inst:"Theodolite / Total Station"})});
    const cvp=P.filter(q=>q.cv&&q.cv.D>=RD_LIM.dSet);
    for(let i=0;i<cvp.length;i+=16)out.push({t:"Road: curve setting out",h:prPage(18,"Horizontal Curve Setting Out","Deflection angles from BC (Rankine) · tangent offsets",`<table class="bk"><tr><th>Curve</th><th>Peg</th><th>Chainage</th><th>Arc from BC (m)</th><th>Deflection from tangent at BC</th><th>Chord from BC (m)</th><th>x along tangent (m)</th><th>y offset (m)</th></tr>
      ${cvp.slice(i,i+16).map(q=>`<tr><td>${q.cv.n} (${prE(q.cv.ip.p)}, R ${q.cv.R})</td><td>${prE(q.lab.join(" / "))}</td><td>${prF3(q.ch)}</td><td>${prF3(q.arc)}</td><td>${prDms(q.defl)} ${q.cv.dir==="R"?"R":"L"}</td><td>${prF3(q.chord)}</td><td>${q.x.toFixed(3)}</td><td>${q.y.toFixed(3)}</td></tr>`).join("")}</table>`,{inst:"Theodolite"})})}
  if(L.rows.length>1){const R=L.rows,per=20;
    const row=r=>{const hi=r.t==="cp"?r.hiNext:r.hi,c=r.corr!=null?(r.corr*1000).toFixed(1):"";
      return r.t==="bm"?`<tr><td>${prE(r.p)}</td><td></td><td></td><td></td><td>${prF3(r.bs)}</td><td></td><td></td><td>${prF3(hi)}</td><td>${prF3(r.rl)}</td><td>${r.corr!=null?"0.0":""}</td><td>${prF3(r.crl)}</td><td>BM</td></tr>`
      :r.t==="cp"?`<tr><td>${prE(r.p)}</td><td></td><td>${r.ch!=null?prF3(r.ch):""}</td><td></td><td>${prF3(r.bs)}</td><td></td><td>${prF3(r.fs)}</td><td>${r.bs!=null?prF3(hi):""}</td><td>${prF3(r.rl)}</td><td>${c}</td><td>${prF3(r.crl)}</td><td>${r.bs==null?"Closing":""}</td></tr>`
      :`<tr><td>${r.side==="C"?rdPegName(r.ch):""}</td><td>${r.side==="L"?r.o:""}</td><td>${r.side==="C"&&r.ch!=null?prF3(r.ch):""}</td><td>${r.side==="R"?r.o:""}</td><td></td><td>${prF3(r.r)}</td><td></td><td></td><td>${prF3(r.rl)}</td><td>${c}</td><td>${prF3(r.crl)}</td><td></td></tr>`};
    const head=`<tr><th rowspan="2">Points</th><th rowspan="2">Left<br>Offset (m)</th><th rowspan="2">Centre Line<br>Chainage (m)</th><th rowspan="2">Right<br>Offset (m)</th><th colspan="3">Staff Reading (m)</th><th rowspan="2">HI (m)</th><th rowspan="2">Reduced<br>Level (m)</th><th rowspan="2">Correction<br>(mm)</th><th rowspan="2">Corrected<br>RL (m)</th><th rowspan="2">Remarks</th></tr><tr><th>BS</th><th>IS</th><th>FS</th></tr>`;
    const foot=`<p class="pnote">Arithmetic check: ΣBS − ΣFS = ${L.sBS.toFixed(3)} − ${L.sFS.toFixed(3)} = ${(L.sBS-L.sFS).toFixed(3)}${L.end!=null&&L.rl0!=null?`; last RL − first RL = ${(L.end-L.rl0).toFixed(3)}`:""}.
      ${L.errMm!=null?` Error = observed − true RL of ${prE(L.endP)} = ${L.errMm} mm; K = ${L.K.toFixed(3)} km; permissible ±24√K = ±${L.perm.toFixed(1)} mm (${L.ok?"OK":"exceeds"}). Correction −e × setup / ${L.nS}.`:""}</p>`;
    for(let i=0;i<R.length;i+=per)out.push({t:"Road: L-section and X-section levelling",h:prPage(14,"Levelling (L-Section and X-Section)","Profile and Cross Section Levelling of Road",`<table class="bk">${head}${R.slice(i,i+per).map(row).join("")}</table>${i+per>=R.length?foot:""}`,{inst:"Auto Level"})})}
  return out}
function rdPegName(ch){if(ch==null)return "";const C=rdCalc();for(const r of C.rows)if(r.curve)for(const[k,v]of[["BC",r.BC],["MC",r.MC],["EC",r.EC]])if(v!=null&&Math.abs(v-ch)<0.01)return k+r.n;const [A,B]=rdAxis();for(const r of C.rows)if(r.th==null&&r.ch!=null&&Math.abs(r.ch-ch)<0.01)return prE(r.ip.p);return ""}
if(typeof PR_BOOKS!=="undefined")PR_BOOKS.splice(PR_BOOKS.findIndex(b=>b[0]==="ct"),0,["road","Road alignment",prRoadAvail,prRoadPages]);
if(typeof inBookHTML==="function"){const _rdInb=inBookHTML;inBookHTML=function(){const h=decodeURIComponent(location.hash.slice(1)),sp=h.split("/");
  if(sp[0]==="road"&&["ip","peg","lv"].includes(sp[1])){const tags=sp[1]==="lv"?["Road: L-section and X-section levelling"]:["Road: curve chainage","Road: curve setting out"];return prInl(()=>prInlPages(prRoadPages(),t=>tags.includes(t)))}
  return _rdInb()}}
