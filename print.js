"use strict";
/* ===== Print book: every job printed in the field-book formats (A4 landscape), one button → Print / Save as PDF =====
   Formats follow the Survey Instruction Committee booking formats: 2 tape distance, 3 TS distance, 5 major traverse,
   8 minor traverse, 11 two peg test, 12 fly levelling, 13 reciprocal levelling, 15 rise and fall, 19 Gale's table,
   20 bridge base triangles, 21 bridge triangulation. App by Gaurab KC with Claude Code. */
const PR_KEY="print-v1";
let PR;
function prLoad(){try{PR=JSON.parse(localStorage.getItem(PR_KEY))}catch(e){PR=null}
  PR=Object.assign({group:"",obs:"",rec:"",inst:"Total Station",date:"",wx:"",temp:"",pick:{},ctl:{major:{},minor:{}}},PR||{});
  if(!PR.ctl)PR.ctl={major:{},minor:{}};for(const k of["major","minor"])if(!PR.ctl[k])PR.ctl[k]={};if(!PR.pick)PR.pick={}}
function prSave(){try{localStorage.setItem(PR_KEY,JSON.stringify(PR))}catch(e){}}
prLoad();

/* --- small helpers --- */
const prE=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const prF3=x=>x==null||isNaN(x)?"":(+x).toFixed(3);
function prSplit(x){const neg=x<0;let t=Math.round(Math.abs(x)*3600);return{neg,d:Math.floor(t/3600),m:Math.floor(t%3600/60),s:t%60}}
function prDash(x){if(x==null)return "";const p=prSplit(x);return `${p.neg?"-":""}${p.d}-${String(p.m).padStart(2,"0")}-${String(p.s).padStart(2,"0")}`}
function prDms(x){if(x==null)return "";const p=prSplit(x);return `${p.neg?"−":""}${p.d}° ${String(p.m).padStart(2,"0")}′ ${String(p.s).padStart(2,"0")}″`}
function prD3(x,rs){const a=rs?` rowspan="${rs}"`:"";if(x==null)return `<td${a}></td><td${a}></td><td${a}></td>`;const p=prSplit(x);
  return `<td${a}>${p.neg?"−":""}${p.d}</td><td${a}>${String(p.m).padStart(2,"0")}</td><td${a}>${String(p.s).padStart(2,"0")}</td>`}
const prRaw=v=>v==null||v===""?"":prE(v);
const prPad=v=>v==null||v===""?"":String(v).padStart(2,"0");
function prGroup(){return PR.group||loadCfg("major").cfg.group||""}

/* --- page frame: same header and footer as the printed major traverse book --- */
function prPage(fmt,title,sub,body,meta){meta=meta||{};const m=k=>prE(meta[k]??PR[k]??"");
  return `<section class="pg"><div class="ptop"><div class="pgrp">Group No: <b>${prE(meta.group??prGroup())}</b></div>
  <div class="puni">Tribhuvan University<br>Institute of Engineering<br>Pulchowk Campus<br><span class="pdept">Department of Civil Engineering</span><br>Survey Instruction Committee</div>
  <div class="prt"><div class="pfmt">${prE(fmt)}</div></div></div>
  <div class="pmeta"><div>Observer : ${m("obs")}<br>Recorder : ${m("rec")}<br>Instrument : ${m("inst")}</div>
  <div class="pttl">${title}${sub?`<br><span>${sub}</span>`:""}</div>
  <div>Date : ${m("date")}<br>Weather : ${m("wx")}<br>Temperature : ${m("temp")}</div></div>
  <div class="pbody">${body}</div>
  <div class="pfoot"><span>Signature of Teacher at site.......................................</span><span>Page No: <i class="pno"></i></span></div></section>`}

/* ================= Traverse (formats 3, 5/8, 19) ================= */
function prTravAvail(k){const prev=PK;let ok=false;try{useTrav(k,true);ok=(k==="major"||PROF.configured)&&PROF.ready&&ST.some(s=>stCalc(s).final!=null||num(D[s].dFS)!=null)}finally{useTrav(prev||"major",true)}return ok}
function prDistPage(L,lim,label){
  const rows=L.map((l,i)=>`<tr><td>${i+1}</td><td>${prE(l.from)}</td><td>${prE(l.to)}</td><td>${l.fw!=null?l.fw.toFixed(3):""}</td><td>${l.bw!=null?l.bw.toFixed(3):""}</td>
    <td>${l.avg!=null?l.avg.toFixed(4):""}</td><td>${l.disc!=null?l.disc.toFixed(3):""}</td><td>${l.prec==null?"":l.prec===Infinity?"1 : ∞":"1 : "+Math.round(l.prec).toLocaleString("en-US")}</td>
    <td>${l.prec==null?"":l.prec>=lim?"":"Re-measure"}</td></tr>`).join("");
  return `<table class="bk"><tr><th rowspan="2">S.No.</th><th colspan="2">Line</th><th colspan="2">Distance (m)</th><th rowspan="2">Average</th><th rowspan="2">Discrepancy</th><th rowspan="2">Precision</th><th rowspan="2">Remarks</th></tr>
  <tr><th>From</th><th>To</th><th>Forward (FW)</th><th>Backward (BW)</th></tr>${rows}</table>
  <p class="pnote">${label} Permissible precision 1 : ${lim.toLocaleString("en-US")}.</p>`}
function prHcrBlock(s,i,two){const st=D[s],C=stCalc(s),sets=two?[C.a,C.b]:[C.a];let h="";
  const names=[bsOf(i),fsOf(i),bsOf(i),fsOf(i)],dist=[num(st.dBS),num(st.dFS),null,null];
  OBS.forEach(([key],j)=>{h+="<tr>";if(j===0)h+=`<td rowspan="4" class="st">${prE(s)}</td>`;
    h+=`<td>${prE(names[j])}</td><td>${j<2?"L":"R"}</td>`;
    sets.forEach((c,si)=>{const v=st.sets[si][key]||[];h+=`<td>${prRaw(v[0])}</td><td>${prPad(v[1])}</td><td>${prPad(v[2])}</td>`;
      if(j===0||j===2)h+=`<td rowspan="2">${prDash(j===0?c.FL:c.FR)}</td>`;if(j===0)h+=prD3(c.mean,4)});
    if(j===0&&two)h+=prD3(C.final,4).replace(/<td /g,'<td class="b" ');
    h+=`<td>${dist[j]!=null?dist[j].toFixed(3):""}</td>`;if(j===0)h+=`<td rowspan="4"></td>`;h+="</tr>"});
  return h}
function prHcrHead(two){const set=`<th colspan="3">HCR Observation</th><th>Face<br>angle</th><th colspan="3">Horizontal Angle</th>`,sub=`<th>d</th><th>m</th><th>s</th><th>d-m-s</th><th>d</th><th>m</th><th>s</th>`;
  return `<tr><th rowspan="3" class="st">Inst st</th><th rowspan="3">Sighted to</th><th rowspan="3" class="fc">F<br>A<br>C<br>E</th><th colspan="7">Set-I</th>${two?`<th colspan="7">Set-II</th><th colspan="3" rowspan="2">Mean Horizontal<br>Angle {(I+II)/2}</th>`:""}<th rowspan="3">Horizontal<br>Distance<br>(m)</th><th rowspan="3" class="rm">Remarks</th></tr>
  <tr>${set}${two?set:""}</tr><tr>${sub}${two?sub+"<th>d</th><th>m</th><th>s</th>":""}</tr>`}
/* control points for the Gale's table: typed on the print page, else known points (coordinate transfer list) */
function prXY(k,p){const t=PR.ctl[k][p];if(t&&num(t.N)!=null&&num(t.E)!=null)return{N:+t.N,E:+t.E};const c=typeof ctXYZ==="function"?ctXYZ(p):null;if(c&&c.N!=null)return{N:c.N,E:c.E};
  return k==="minor"?prMajorXY()[p]||null:null}
// stations of the major Gale's table computed in the app, so the minor table can start from them
function prMajorXY(){const prev=PK,o={};try{useTrav("major",true);const G=prGales("major");if(!G.err){o[ST[0]]=G.start;G.rows.forEach(x=>{o[x.c]={N:x.N,E:x.E}})}}catch(e){}finally{useTrav(prev||"major",true)}return o}
const prBrg=(a,b)=>mod360(Math.atan2(b.E-a.E,b.N-a.N)*180/Math.PI);
function prGalesNeed(k){const prev=PK;useTrav(k,true);const need=LINK?[AREF,ST[0],ST[N-1],DREF]:[ST[0],ST[1]];const loop=!LINK;useTrav(prev||"major",true);return{need:[...new Set(need)],loop}}
// Gale's traverse table. Bearing of next leg = bearing + angle ± 180°; angular error spread i/N on the bearings; Bowditch on lat/dep.
function prGales(k){const S=summary();if(S.done.length!==N)return{err:"All station angles are needed."};
  const ang=ST.map(s=>Math.round(stCalc(s).final*3600)/3600),L=legs();const len=(a,b)=>{const l=L.find(x=>(x.from===a&&x.to===b)||(x.from===b&&x.to===a));return l?l.avg:null};
  const nb=(b,a)=>{const x=b+a;return x>540?x-540:x<180?x+180:x-180};
  let start,b0,bEnd,stations,legNames;
  if(LINK){const A=prXY(k,AREF),S0=prXY(k,ST[0]),SE=prXY(k,ST[N-1]),AE=prXY(k,DREF);if(!A||!S0||!SE||!AE)return{err:"Coordinates of "+[...new Set([AREF,ST[0],ST[N-1],DREF])].join(", ")+" are needed."};
    b0=prBrg(A,S0);bEnd=prBrg(SE,AE);start=S0;stations=ST.slice();legNames=ST.slice(0,-1).map((s,i)=>[s,ST[i+1]])}
  else{const P0=prXY(k,ST[0]);const typed=dmsTxt(PR.ctl[k].brg);const P1=prXY(k,ST[1]);if(!P0)return{err:"Coordinates of "+ST[0]+" are needed."};
    b0=typed!=null?typed:P1?prBrg(P0,P1):null;if(b0==null)return{err:"Bearing "+ST[0]+"→"+ST[1]+" (or coordinates of "+ST[1]+") is needed."};
    bEnd=b0;start=P0;stations=ST.slice(1).concat([ST[0]]);legNames=ST.map((s,i)=>[s,ST[(i+1)%N]])}
  const nA=stations.length,obsB=[];let b=b0;
  for(const s of stations){b=nb(b,ang[ST.indexOf(s)]);obsB.push(b)}
  let e=obsB[nA-1]-bEnd;e=((e+180)%360+360)%360-180;const tot=-e;
  const corrB=obsB.map((x,q)=>mod360(x+(q+1)/nA*tot));
  const legB=LINK?corrB.slice(0,-1):[b0].concat(corrB.slice(0,-1));
  const rows=legNames.map(([a,c],q)=>{const d=len(a,c);if(d==null)return null;const r=legB[q]*Math.PI/180;return{a,c,d,la:d*Math.cos(r),de:d*Math.sin(r)}});
  if(rows.some(x=>!x))return{err:"All leg distances are needed."};
  const P=rows.reduce((s,x)=>s+x.d,0),lat=rows.reduce((s,x)=>s+x.la,0),dep=rows.reduce((s,x)=>s+x.de,0);
  const end=LINK?prXY(k,ST[N-1]):start,eL=lat-(end.N-start.N),eD=dep-(end.E-start.E),ce=Math.hypot(eL,eD);
  let n0=start.N,e0=start.E;rows.forEach(x=>{x.cl=-eL*x.d/P;x.cd=-eD*x.d/P;x.tl=x.la+x.cl;x.td=x.de+x.cd;n0+=x.tl;e0+=x.td;x.N=n0;x.E=e0;x.adj=Math.hypot(x.tl,x.td);x.ab=mod360(Math.atan2(x.td,x.tl)*180/Math.PI)});
  return{ref:LINK?prXY(k,DREF):null,ang,stations,obsB,corrB,legB,rows,b0,bEnd,e,tot,perm:LIM.angK*Math.sqrt(nA)/3600,nA,P,lat,dep,eL,eD,ce,start,end,loop:!LINK}}
function prGalesPage(k,G){const f=prF3;let body="";const first=LINK?AREF:ST[0];
  const ang=s=>G.ang[ST.indexOf(s)];
  if(LINK){body+=`<tr><td>${prE(AREF)}</td>${"<td></td>".repeat(26)}</tr>`;
    body+=`<tr><td>${prE(ST[0])}</td><td>${prE(AREF+ST[0])}</td><td></td>${prD3(null)}${prD3(G.b0)}${prD3(null)}${prD3(G.b0)}${"<td></td>".repeat(6)}<td>${f(G.start.N)}</td><td>${f(G.start.E)}</td>${"<td></td>".repeat(4)}</tr>`}
  else body+=`<tr><td>${prE(ST[0])}</td><td></td><td></td>${prD3(null)}${prD3(null)}${prD3(null)}${prD3(null)}${"<td></td>".repeat(6)}<td>${f(G.start.N)}</td><td>${f(G.start.E)}</td>${"<td></td>".repeat(4)}</tr>`;
  if(!LINK){const x=G.rows[0];body+=`<tr><td>${prE(ST[1])}</td><td>${prE(ST[0]+ST[1])}</td><td>${f(x.d)}</td>${prD3(null)}${prD3(G.b0)}${prD3(0)}${prD3(G.b0)}<td>${f(x.la)}</td><td>${f(x.de)}</td><td>${f(x.cl)}</td><td>${f(x.cd)}</td><td>${f(x.tl)}</td><td>${f(x.td)}</td><td>${f(x.N)}</td><td>${f(x.E)}</td><td>${f(x.adj)}</td>${prD3(x.ab)}</tr>`}
  G.stations.forEach((s,q)=>{const nxt=LINK?(q<N-1?ST[q+1]:DREF):(q<G.nA-1?G.stations[q+1]:ST[1]);
    const x=LINK?(q<N-1?G.rows[q]:null):(q<G.nA-1?G.rows[q+1]:null);
    body+=`<tr><td>${prE(nxt)}</td><td>${prE(s+nxt)}</td><td>${x?f(x.d):""}</td>${prD3(ang(s))}${prD3(G.obsB[q])}${prD3((q+1)/G.nA*G.tot)}${prD3(G.corrB[q])}`+
      (x?`<td>${f(x.la)}</td><td>${f(x.de)}</td><td>${f(x.cl)}</td><td>${f(x.cd)}</td><td>${f(x.tl)}</td><td>${f(x.td)}</td><td>${f(x.N)}</td><td>${f(x.E)}</td><td>${f(x.adj)}</td>${prD3(x.ab)}`
        :`${"<td></td>".repeat(6)}<td>${LINK&&G.ref?f(G.ref.N):""}</td><td>${LINK&&G.ref?f(G.ref.E):""}</td>${"<td></td>".repeat(4)}`)+"</tr>"});
  const sm=k=>G.rows.reduce((s,x)=>s+x[k],0);
  const H=`<tr><th rowspan="2">Station</th><th rowspan="2">Line</th><th rowspan="2">Length<br>(m)</th><th colspan="3">Observed<br>Horizontal Angle</th><th colspan="3">Bearing</th><th colspan="3">Correction</th><th colspan="3">Corrected<br>Bearing</th><th colspan="2">Consecutive<br>Co-ordinate</th><th colspan="2">Correction</th><th colspan="2">Corrected<br>Consecutive Co-ordinate</th><th colspan="2">Independent<br>Co-ordinate</th><th rowspan="2">Adjusted<br>Length</th><th colspan="3">Adjusted<br>Bearing</th></tr>
  <tr><th>d</th><th>m</th><th>s</th><th>d</th><th>m</th><th>s</th><th>d</th><th>m</th><th>s</th><th>d</th><th>m</th><th>s</th><th>Latitude</th><th>Departure</th><th>L</th><th>D</th><th>L</th><th>D</th><th>Northing</th><th>Easting</th><th>d</th><th>m</th><th>s</th></tr>`;
  const sum=`<tr class="b"><td colspan="2">Sum</td><td>${f(G.P)}</td>${"<td></td>".repeat(12)}<td>${f(G.lat)}</td><td>${f(G.dep)}</td><td>${f(sm("cl"))}</td><td>${f(sm("cd"))}</td><td>${f(sm("tl"))}</td><td>${f(sm("td"))}</td><td></td><td></td><td>${f(sm("adj"))}</td><td></td><td></td><td></td></tr>`;
  const ok=Math.abs(G.e)<=G.perm+1e-9,prec=G.ce>1e-9?G.P/G.ce:Infinity;
  const lastLine=LINK?ST[N-1]+DREF:ST[0]+ST[1];
  const left=`<table class="bk sm"><tr><td class="l">Bearing of first line (${prE(LINK?AREF+ST[0]:ST[0]+ST[1])})</td><td>${prDms(G.b0)}</td></tr>
  <tr><td class="l">Observed bearing of last line (${prE(lastLine)})</td><td>${prDms(G.obsB[G.nA-1])}</td></tr>
  <tr><td class="l">Actual bearing of last line (${prE(lastLine)})</td><td>${prDms(G.bEnd)}</td></tr>
  <tr><td class="l">Angular error</td><td>${prDms(G.e)}</td></tr>
  <tr><td class="l">Permissible = ${LIM.angK===60?"1′":LIM.angK+"″"}√N (N = ${G.nA})</td><td>±${prDms(G.perm)} ${ok?"OK":"EXCEEDS"}</td></tr>
  <tr><td class="l">Total correction</td><td>${prDms(G.tot)}</td></tr></table>`;
  const right=`<table class="bk sm"><tr><td class="l">Error in latitude</td><td>${f(G.eL)}</td></tr><tr><td class="l">Error in departure</td><td>${f(G.eD)}</td></tr>
  <tr><td class="l">Closing error e</td><td>${f(G.ce)}</td></tr><tr><td class="l">Perimeter P</td><td>${f(G.P)}</td></tr>
  <tr><td class="l">Relative precision 1 : P/e</td><td>1 : ${prec===Infinity?"∞":Math.round(prec).toLocaleString("en-US")} ${prec>=LIM.prec?"OK":"(needs 1 : "+LIM.prec.toLocaleString("en-US")+")"}</td></tr></table>`;
  return `<table class="bk gales">${H}${body}${sum}</table><div class="ptwo">${left}${right}</div>`}
function prTravPages(k){const prev=PK;const pages=[];try{useTrav(k,true);const two=SETS===2,minor=k==="minor";
  const L=legs();pages.push({t:PROF.name+": distances",h:prPage(3,"Distance Measurement Sheet by Total Station",PROF.name,prDistPage(L,LIM.prec,"FW measured at the first station, BW measured back from the second."))});
  const per=two?4:5;
  for(let i=0;i<N;i+=per){const blocks=ST.slice(i,i+per).map((s,j)=>prHcrBlock(s,i+j,two)).join("");
    pages.push({t:PROF.name+": angles",h:prPage(minor?8:5,`${minor?"Minor":"Major"} Traverse by Total Station`,"Horizontal Angle Observation Sheet",`<table class="bk hcr${two?"":" one"}">${prHcrHead(two)}${blocks}</table>`)})}
  const G=prGales(k);
  if(!G.err)pages.push({t:PROF.name+": Gale's table",h:prPage(19,`${minor?"Minor":"Major"} Traverse Computation (Gale's Table)`,"",prGalesPage(k,G),{obs:"",rec:"",inst:""})});
  else pages.push({t:PROF.name+": Gale's table",skip:G.err});
  }finally{useTrav(prev||"major",true)}return pages}

/* ================= Levelling (formats 12, 15, 11) ================= */
function prLevAvail(k){let n=0;allLev(kk=>{if(kk===k)n=LEV.lines.filter(L=>L.setups.length).length+(pegCalc().h1!=null?1:0)});return n>0}
function prFlyRows(L,c,a,b,rl0){const rows=[];let sBS=0,sFS=0,sR=0,sF=0,sD=0;const f3=prF3,cell=x=>`<td>${x??""}</td>`;
  for(let k=a;k<=b+1;k++){const B=k<=b?c.rows[k].B:null,F=k>a?c.rows[k-1].F:null,stn=k<=b?L.setups[k].bs.p:L.setups[b].fs.p;
    const br=k<=b?L.setups[k].bs.r||[]:[],fr=k>a?L.setups[k-1].fs.r||[]:[];
    const rise=k>a?c.rows[k-1].rise:null,rl=k===a?rl0:c.rows[k-1].rlF;
    const S1=B&&!B.mid?B.s:null,S2=F&&!F.mid?F.s:null,O=(S1||0)+(S2||0),dist=B||F?O*100:null;
    if(B)sBS+=B.mean;if(F)sFS+=F.mean;if(rise!=null){if(rise>=0)sR+=rise;else sF-=rise}if(dist)sD+=dist;
    const named=stn&&!/^TP/i.test(stn),fsC=k===a?'<td class="sh"></td><td class="sh"></td><td class="sh"></td><td class="sh"></td><td class="sh"></td>':`${cell(prRaw(fr[0]))}${cell(prRaw(fr[1]))}${cell(prRaw(fr[2]))}${cell(F?f3(F.mean):"")}${cell(S2!=null?f3(S2):"")}`;
    rows.push(`<tr><td>${prE(stn||"")}</td>${cell(prRaw(br[0]))}${cell(prRaw(br[1]))}${cell(prRaw(br[2]))}${cell(B?f3(B.mean):"")}${cell(S1!=null?f3(S1):"")}${fsC}${cell(rise!=null&&rise>=0?f3(rise):"")}${cell(rise!=null&&rise<0?f3(-rise):"")}${cell(f3(rl))}${cell(B||F?f3(O):"")}${cell(dist!=null?dist.toFixed(1):"")}${cell(named?prE(stn):"")}</tr>`)}
  return{rows,sBS,sFS,sR,sF,sD,rl0,last:c.rows[b].rlF}}
const PR_FLYH=`<tr><th rowspan="2">Stations<br>Chainage</th><th colspan="3">BS</th><th rowspan="2">Mean<br>BS</th><th>S<sub>1</sub></th><th colspan="3">FS</th><th rowspan="2">Mean<br>FS</th><th>S<sub>2</sub></th><th rowspan="2">Rise<br>+</th><th rowspan="2">Fall<br>−</th><th rowspan="2">Elevation<br>(m)</th><th rowspan="2">Stadia<br>Interval<br>S=S<sub>1</sub>+S<sub>2</sub></th><th rowspan="2">Hz. Dst<br>(m)<br>S×100</th><th rowspan="2">Remarks</th></tr>
<tr><th>Top</th><th>Mid</th><th>Bot</th><th>(T−B)</th><th>Top</th><th>Mid</th><th>Bot</th><th>(T−B)</th></tr>`;
function prLevPages(k){const out=[];allLev(kk=>{if(kk!==k)return;
  const order=[];for(const L of LEV.lines){const Q=pairOf(L);if(Q&&L.dir==="bw"&&Q.dir==="fw")continue;order.push(L);if(Q&&L.dir==="fw")order.push(Q)}
  for(const L of order){if(!L.setups.length)continue;const c=lineCalc(L),H=L.hdr||{},meta={obs:H.obs,rec:H.rec,inst:H.inst||"Auto level",date:H.date,wx:H.wx,temp:H.temp};
    const n=L.setups.length;
    if(LP.book==="rf"||isMid(L)){ // format 15 rise and fall, split in pages of 22 rows
      const e=c.err!=null?c.err/1000:null,rws=[];
      for(let q=0;q<=n;q++){const B=q<n?c.rows[q].B:null,F=q>0?c.rows[q-1].F:null,stn=q<n?L.setups[q].bs.p:L.setups[n-1].fs.p;
        const rise=q>0?c.rows[q-1].rise:null,rl=q===0?c.rl0:c.rows[q-1].rlF,corr=e!=null?-e*q/n:null;
        rws.push(`<tr><td>${prE(stn||"")}</td><td>${B?prF3(B.m):""}</td><td></td><td>${F?prF3(F.m):""}</td><td>${rise!=null&&rise>=0?prF3(rise):""}</td><td>${rise!=null&&rise<0?prF3(-rise):""}</td><td>${prF3(rl)}</td><td>${corr!=null?(corr>0?"+":"")+prF3(corr):""}</td><td>${corr!=null&&rl!=null?prF3(rl+corr):""}</td><td>${q===0?"Start":q===n&&c.known!=null?"Close":""}</td></tr>`)}
      const head=`<tr><th>Station</th><th>BS</th><th>IS</th><th>FS</th><th>Rise<br>+</th><th>Fall<br>−</th><th>RL (m)</th><th>Correction<br>(m)</th><th>Corrected<br>RL (m)</th><th>Remarks</th></tr>`;
      for(let i=0;i<rws.length;i+=22){const lastP=i+22>=rws.length;
        const tail=lastP?`<tr class="b"><td>Σ</td><td>${prF3(c.sBS)}</td><td></td><td>${prF3(c.sFS)}</td><td>${prF3(c.sR)}</td><td>${prF3(c.sF)}</td><td></td><td></td><td></td><td></td></tr>`:"";
        const chk=lastP?`<div class="ptwo"><table class="bk sm"><tr><th colspan="2">Arithmetic check</th></tr><tr><td class="l">ΣBS − ΣFS</td><td>${prF3(c.sBS-c.sFS)}</td></tr><tr><td class="l">ΣRise − ΣFall</td><td>${prF3(c.sR-c.sF)}</td></tr><tr><td class="l">Last RL − First RL</td><td>${c.end!=null&&c.rl0!=null?prF3(c.end-c.rl0):""}</td></tr></table>
          ${c.err!=null?`<table class="bk sm"><tr><th colspan="2">Error computation</th></tr><tr><td class="l">Closing error e</td><td>${c.err>0?"+":""}${c.err} mm</td></tr><tr><td class="l">K</td><td>${c.K?c.K.toFixed(4)+" km":""}</td></tr><tr><td class="l">Permissible 24√K</td><td>${c.perm!=null?"±"+c.perm.toFixed(2)+" mm "+(Math.abs(c.err)<=c.perm?"OK":"EXCEEDS"):""}</td></tr></table>`:""}</div>`:"";
        out.push({t:LP.name+": "+(L.name||""),h:prPage(15,"Levelling (Rise and Fall Method)",prE(L.name||""),`<table class="bk lev">${head}${rws.slice(i,i+22).join("")}${tail}</table>${chk}`,meta)})}
      continue}
    // format 12: split into forward and backward at the first named turning point
    let turn=-1;for(let i=0;i<n-1;i++){const p=L.setups[i].fs.p;if(p&&!/^TP/i.test(p)&&p!==L.start){turn=i;break}}
    const segs=turn>=0?[[0,turn],[turn+1,n-1]]:[[0,n-1]];
    const res=segs.map(([a,b],si)=>{const rl0=a===0?c.rl0:c.rows[a-1].rlF;const r=prFlyRows(L,c,a,b,rl0);r.cap=`${segs.length>1?(si===0?"Forward":"Backward")+": ":""}${prE(L.setups[a].bs.p||"")} to ${prE(L.setups[b].fs.p||"")}`;return r});
    res.forEach((r,si)=>{for(let i=0;i<r.rows.length;i+=20){const lastP=i+20>=r.rows.length;
      const sum=lastP?`<tr class="b"><td>Sum</td><td></td><td></td><td></td><td>${prF3(r.sBS)}</td><td></td><td></td><td></td><td></td><td>${prF3(r.sFS)}</td><td></td><td>${prF3(r.sR)}</td><td>${prF3(r.sF)}</td><td></td><td></td><td>${r.sD.toFixed(1)}</td><td></td></tr>`:"";
      let below="";
      if(lastP){below=`<table class="bk sm"><tr><th colspan="2">Arithmetic check</th></tr><tr><td class="l">|ΣBS − ΣFS|</td><td>${prF3(Math.abs(r.sBS-r.sFS))}</td></tr><tr><td class="l">|ΣRise − ΣFall|</td><td>${prF3(Math.abs(r.sR-r.sF))}</td></tr><tr><td class="l">|Last RL − First RL|</td><td>${r.last!=null&&r.rl0!=null?prF3(Math.abs(r.last-r.rl0)):""}</td></tr><tr><td class="l">Distance</td><td>${r.sD.toFixed(1)} m</td></tr></table>`;
        if(si===res.length-1){let ec="";const Q=pairOf(L);
          if(Q&&L.dir==="bw"){const pc=pairCalc(Q,L);if(pc.done)ec=`<table class="bk sm"><tr><th colspan="2">Error computation (FW + BW)</th></tr><tr><td class="l">Error of closure = |ΣR−ΣF|fwd − |ΣR−ΣF|bwd</td><td>${prF3(pc.a)} − ${prF3(pc.b)} = ${pc.e>0?"+":""}${pc.e} mm</td></tr><tr><td class="l">K = (${pc.cF.dist.toFixed(1)} + ${pc.cB.dist.toFixed(1)}) / 1000</td><td>${pc.K.toFixed(4)} km</td></tr><tr><td class="l">Permissible 24√K</td><td>±${pc.perm.toFixed(2)} mm ${pc.ok?"OK":"EXCEEDS"}</td></tr><tr><td class="l">RL of ${prE(pc.endP)} = RL of ${prE(Q.start)} ${pc.dF>=0?"+":"−"} mean</td><td>${prF3(pc.cF.rl0)} ${pc.dF>=0?"+":"−"} (${prF3(pc.a)} + ${prF3(pc.b)})/2 = ${prF3(pc.rlEnd)} m</td></tr></table>`}
          else if(Q&&L.dir==="fw"){}
          else if(res.length===2&&c.rl0!=null&&c.rows[n-1].rlF!=null){const f=res[0],g=res[1],da=Math.abs(f.sR-f.sF),db=Math.abs(g.sR-g.sF),e=Math.round(1000*(da-db)),K=(f.sD+g.sD)/1000,perm=24*Math.sqrt(K),nm=L.setups[turn].fs.p,rl=f.sR>f.sF?c.rl0+(da+db)/2:c.rl0-(da+db)/2;
            ec=`<table class="bk sm"><tr><th colspan="2">Error computation</th></tr><tr><td class="l">Error of closure</td><td>${prF3(da)} − ${prF3(db)} = ${e>0?"+":""}${e} mm</td></tr><tr><td class="l">Distance K</td><td>${K.toFixed(4)} km</td></tr><tr><td class="l">Permissible 24√K</td><td>±${perm.toFixed(2)} mm ${Math.abs(e)<=perm?"OK":"EXCEEDS"}</td></tr><tr><td class="l">RL of ${prE(nm)} (mean)</td><td>${prF3(rl)} m</td></tr></table>`}
          else if(c.err!=null)ec=`<table class="bk sm"><tr><th colspan="2">Error computation</th></tr><tr><td class="l">Closing error e</td><td>${c.err>0?"+":""}${c.err} mm</td></tr><tr><td class="l">K</td><td>${c.K.toFixed(4)} km</td></tr><tr><td class="l">Permissible 24√K</td><td>±${c.perm.toFixed(2)} mm ${Math.abs(c.err)<=c.perm?"OK":"EXCEEDS"}</td></tr></table>`;
          below+=ec}
        below=`<div class="ptwo">${below}</div>`}
      out.push({t:LP.name+": "+(L.name||""),h:prPage(12,"Fly Levelling (RL Transfer)",`${prE(L.name||"")}: ${r.cap}`,`<table class="bk lev fly">${PR_FLYH}${r.rows.slice(i,i+20).join("")}${sum}</table>${below}`,meta)})}})}
  const pc=pegCalc();
  if(pc.h1!=null||pc.h2!=null){const w=(x,lbl,first,h)=>`<tr>${first?`<td rowspan="2">${first}</td>`:""}<td>${lbl}</td><td>${x?prF3(x.t):""}</td><td>${x?prF3(x.m):""}</td><td>${x?prF3(x.b):""}</td><td>${x?prF3(x.mean):""}</td>${first?`<td rowspan="2">${h!=null?(h>=0?"+":"")+prF3(h):""}</td>`:""}</tr>`;
    out.push({t:LP.name+": two peg test",h:prPage(11,"Two Peg Test","Collimation check of the level",`<table class="bk"><tr><th>Instrument</th><th>Staff at</th><th>Top</th><th>Middle</th><th>Bottom</th><th>Mean</th><th>Height difference<br>A − B</th></tr>
    ${w(pc.a1,"A","Midway",pc.h1)}${w(pc.b1,"B")}${w(pc.a2,"A","Near A",pc.h2)}${w(pc.b2,"B")}</table>
    <table class="bk sm" style="margin-top:4mm"><tr><td class="l">Distance between pegs</td><td>${pc.d!=null?pc.d+" m":""}</td></tr><tr><td class="l">Error |h1 − h2|</td><td>${pc.e!=null?(pc.e*1000).toFixed(0)+" mm":""}</td></tr><tr><td class="l">Precision</td><td>${pc.prec==null?"":pc.prec===Infinity?"1 : ∞":"1 : "+Math.round(pc.prec).toLocaleString("en-US")} ${pc.ok==null?"":pc.ok?"OK":"Adjust the level"}</td></tr></table>`,{inst:"Auto level"})})}
  });return out}

/* ================= Bridge site (formats 2/3, 20, 21, 13 + angle correction, drawing, summary) ================= */
function prBrAvail(){return BR.obs.length>0||BR.bases.some(b=>b.fw||b.bw)||BR.rec.s1.a.some(v=>v)}
function prBrBlock(o){const c=obsCalc(o),two=o.sets.length>1&&c.s[1]!=null;let h="";
  FACES.forEach(([key,face,side],j)=>{h+="<tr>";if(j===0)h+=`<td rowspan="4" class="st">${prE(o.at)}</td>`;h+=`<td>${prE(side==="BS"?o.bs:o.fs)}</td><td>${face==="FL"?"L":"R"}</td>`;
    for(let si=0;si<(o.base?2:1);si++){const S=o.sets[si]||{},v=S[key]||[],sc=c.s[si];h+=`<td>${prRaw(v[0])}</td><td>${prPad(v[1])}</td><td>${prPad(v[2])}</td>`;
      if(j===0||j===2)h+=`<td rowspan="2">${sc?prDash(j===0?sc.L:sc.R):""}</td>`;if(j===0)h+=prD3(sc?sc.mean:null,4)}
    if(j===0){if(o.base)h+=prD3(two?c.mean:null,4).replace(/<td /g,'<td class="b" ');h+=`<td rowspan="4">∠${prE(o.bs+o.at+o.fs)}</td>`}h+="</tr>"});
  return h}
function prBrDraw(sol,X){const ks=Object.keys(X);if(ks.length<3)return "";const NAVY="#0b1f4d",RED="#9b1c1c";
  const Es=ks.map(k=>X[k].E),Ns=ks.map(k=>X[k].N),m=60,sc=1000/Math.max(1e-6,Math.max(...Es)-Math.min(...Es),(Math.max(...Ns)-Math.min(...Ns))*1.8);
  const W=(Math.max(...Es)-Math.min(...Es))*sc+2*m,H=(Math.max(...Ns)-Math.min(...Ns))*sc+2*m;
  const px=k=>[(X[k].E-Math.min(...Es))*sc+m,(Math.max(...Ns)-X[k].N)*sc+m];
  const lines=[];const seen=new Set();for(const T of sol.tc){const p=T.t.p;for(let i=0;i<3;i++){const a=p[i],b=p[(i+1)%3],key=pairKey(a,b);if(seen.has(key)||!X[a]||!X[b])continue;seen.add(key);lines.push([a,b,!!T.t.base])}}
  const segs=lines.map(([a,b])=>[px(a),px(b)]),boxes=ks.map(k=>{const[x,y]=px(k);return[x-9,y-9,x+9,y+9]});
  const segHit=r=>segs.some(([[ax,ay],[bx,by]])=>{for(let q=0;q<=160;q++){const t=q/160,x=ax+(bx-ax)*t,y=ay+(by-ay)*t;if(x>=r[0]&&x<=r[2]&&y>=r[1]&&y<=r[3])return true}return false});
  const boxHit=r=>boxes.some(b=>!(r[2]<b[0]||r[0]>b[2]||r[3]<b[1]||r[1]>b[3]));
  const svg=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" font-family="Times New Roman,Times,Noto Serif,serif">`];
  for(const[a,b,s]of lines){const[x1,y1]=px(a),[x2,y2]=px(b);svg.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${NAVY}" stroke-width="${s?1.8:1.2}"${s?"":' stroke-dasharray="7 5"'}/>`)}
  const pd=x=>{let t=Math.round(x*3600);return `${Math.floor(t/3600)}°${String(Math.floor(t%3600/60)).padStart(2,"0")}′${String(t%60).padStart(2,"0")}″`};
  for(const T of sol.tc){if(!T.ready)continue;const p=T.t.p;if(p.some(v=>!X[v]))continue;
    p.forEach((v,i)=>{const[x,y]=px(v);const u=[p[(i+1)%3],p[(i+2)%3]].map(w=>{const[wx,wy]=px(w),d=Math.hypot(wx-x,wy-y);return[(wx-x)/d,(wy-y)/d]});
      const a0=Math.atan2(u[0][1],u[0][0]),a1=Math.atan2(u[1][1],u[1][0]);let da=((a1-a0+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;const ra=20;
      svg.push(`<path d="M${(x+ra*Math.cos(a0)).toFixed(1)},${(y+ra*Math.sin(a0)).toFixed(1)} A${ra},${ra} 0 0 ${da>0?1:0} ${(x+ra*Math.cos(a0+da)).toFixed(1)},${(y+ra*Math.sin(a0+da)).toFixed(1)}" fill="none" stroke="${RED}" stroke-width="1"/>`);
      let bx=u[0][0]+u[1][0],by=u[0][1]+u[1][1];const bn=Math.hypot(bx,by)||1;bx/=bn;by/=bn;let r=34,cx,cy,rect;
      while(r<260){cx=x+bx*r;cy=y+by*r;rect=[cx-40,cy-10.5,cx+40,cy+10.5];if(!segHit(rect)&&!boxHit(rect))break;r+=3}
      boxes.push(rect);svg.push(`<text x="${cx.toFixed(1)}" y="${(cy+5).toFixed(1)}" text-anchor="middle" fill="${RED}" font-size="15">${pd(T.adj[i])}</text>`)})}
  for(const[a,b]of lines){const[x1,y1]=px(a),[x2,y2]=px(b),k=pairKey(a,b),Ln=sol.sides[k];if(Ln==null)continue;const mx=(x1+x2)/2,my=(y1+y2)/2;let an=Math.atan2(y2-y1,x2-x1)*180/Math.PI;if(an>90)an-=180;if(an<-90)an+=180;
    const nx=Math.sin(an*Math.PI/180),ny=-Math.cos(an*Math.PI/180);const tag=sol.src[k]==="measured"?" (base)":k===pairKey(BR.axis[0],BR.axis[1])?" (axis)":"";const txt=`${Ln.toFixed(3)} m${tag}`,tw=7.6*txt.length;
    let best=null;for(const off of[13,-13,24,-24]){const cx=mx+nx*off,cy=my+ny*off;const pts=[-tw/2,-tw/4,0,tw/4,tw/2].map(d=>[cx+Math.cos(an*Math.PI/180)*d,cy+Math.sin(an*Math.PI/180)*d]);
      if(!pts.some(([X_,Y_])=>boxes.some(b=>X_>=b[0]&&X_<=b[2]&&Y_>=b[1]&&Y_<=b[3]))){best=[cx,cy];break}}
    if(!best)best=[mx+nx*13,my+ny*13];svg.push(`<text x="${best[0].toFixed(1)}" y="${best[1].toFixed(1)}" transform="rotate(${an.toFixed(1)} ${best[0].toFixed(1)} ${best[1].toFixed(1)})" text-anchor="middle" dominant-baseline="middle" fill="${NAVY}" font-size="15" font-style="italic">${txt}</text>`)}
  const gx=ks.reduce((s,k)=>s+px(k)[0],0)/ks.length,gy=ks.reduce((s,k)=>s+px(k)[1],0)/ks.length;
  for(const k of ks){const[x,y]=px(k),dx=x-gx,dy=y-gy,dn=Math.hypot(dx,dy)||1;svg.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="#fff" stroke="${NAVY}" stroke-width="1.8"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.6" fill="${NAVY}"/><text x="${(x+dx/dn*20).toFixed(1)}" y="${(y+dy/dn*20+7).toFixed(1)}" text-anchor="middle" fill="${NAVY}" font-size="21" font-weight="bold">${prE(k)}</text>`)}
  svg.push("</svg>");return svg.join("")}
function prBrPages(){const out=[],sol=brSolve(),[A,B]=BR.axis;const meta={inst:"Total Station"};
  // base lines
  const bl=BR.bases.map(b=>({b,c:baseCalc(b)})).filter(x=>x.c);
  if(bl.length){const tape=bl.every(x=>x.b.mode!=="edm"),edm=bl.every(x=>x.b.mode==="edm");
    const rows=bl.map(({b,c},i)=>{const f=bNum(b.fw),w=bNum(b.bw);return `<tr><td>${i+1}</td><td>${prE(b.a)}</td><td>${prE(b.b)}</td><td>${f!=null?f.toFixed(3):""}</td><td>${w!=null?w.toFixed(3):""}</td><td>${c.mean.toFixed(4)}</td><td>${f!=null&&w!=null?Math.abs(f-w).toFixed(3):""}</td><td>${c.prec==null?"":c.prec===Infinity?"1 : ∞":"1 : "+Math.round(c.prec).toLocaleString("en-US")}</td><td>1 : ${c.lim.toLocaleString("en-US")}</td><td>${c.prec==null?"":c.bad?"Re-measure":"OK"}${tape||edm?"":" ("+(b.mode==="edm"?"EDM":"tape")+")"}</td></tr>`}).join("");
    out.push({t:"Bridge: base lines",h:prPage(tape?2:3,tape?"Distance Measurement by Tape":edm?"Distance Measurement Sheet by Total Station":"Distance Measurement","Bridge Site Base Lines",
      `<table class="bk"><tr><th rowspan="2">S.No.</th><th colspan="2">Line</th><th colspan="2">Distance (m)</th><th rowspan="2">Average</th><th rowspan="2">Discrepancy</th><th rowspan="2">Precision</th><th rowspan="2">Permissible</th><th rowspan="2">Remarks</th></tr><tr><th>From</th><th>To</th><th>Forward (FW)</th><th>Backward (BW)</th></tr>${rows}</table>
      <p class="pnote">Norm: base line by tape 1 : ${BR_LIM.tape.toLocaleString("en-US")}, by EDM 1 : ${BR_LIM.edm.toLocaleString("en-US")}.</p>`,{inst:tape?"Tape":edm?"Total Station":"Tape, Total Station"})})}
  // angle sheets
  const set=`<th colspan="3">HCR Observation</th><th>Face<br>angle</th><th colspan="3">Horizontal Angle</th>`,sub=`<th>d</th><th>m</th><th>s</th><th>d-m-s</th><th>d</th><th>m</th><th>s</th>`;
  const H2=`<tr><th rowspan="3" class="st">Inst st</th><th rowspan="3">Sighted to</th><th rowspan="3" class="fc">F<br>A<br>C<br>E</th><th colspan="7">Set-I</th><th colspan="7">Set-II</th><th colspan="3" rowspan="2">Mean Horizontal<br>Angle {(I+II)/2}</th><th rowspan="3" class="rm">Remarks</th></tr><tr>${set}${set}</tr><tr>${sub}${sub}<th>d</th><th>m</th><th>s</th></tr>`;
  const H1=`<tr><th rowspan="3" class="st">Inst st</th><th rowspan="3">Sighted to</th><th rowspan="3" class="fc">F<br>A<br>C<br>E</th><th colspan="7">Set-I</th><th rowspan="3" class="rm">Remarks</th></tr><tr>${set}</tr><tr>${sub}</tr>`;
  const maj=BR.obs.filter(o=>o.base&&!obsEmpty(o)),mnr=BR.obs.filter(o=>!o.base&&!obsEmpty(o));
  for(let i=0;i<maj.length;i+=4)out.push({t:"Bridge: base triangle angles",h:prPage(20,"Bridge Site Triangulation by Total Station","Base Triangles: Horizontal Angle Observation Sheet",`<table class="bk hcr">${H2}${maj.slice(i,i+4).map(prBrBlock).join("")}</table>`,meta)});
  for(let i=0;i<mnr.length;i+=5)out.push({t:"Bridge: triangulation angles",h:prPage(21,"Bridge Site Triangulation by Total Station","Extra Triangles: Horizontal Angle Observation Sheet",`<table class="bk hcr one">${H1}${mnr.slice(i,i+5).map(prBrBlock).join("")}</table>`,meta)});
  // angle correction
  const ready=sol.tc.filter(T=>T.ready);
  if(ready.length){let tr="";
    for(const T of ready){const p=T.t.p,sd=i=>pairKey(p[i],p[(i+1)%3]);
      p.forEach((v,i)=>{const k=sd(i),Ln=sol.sides[k];tr+="<tr>";if(i===0)tr+=`<td rowspan="4" class="st">△${prE(p.join(""))}</td>`;
        tr+=`<td>${prE(v)}</td>${prD3(T.obs[i])}<td>${T.corr[i]>0?"+":""}${T.corr[i]}</td>${prD3(T.adj[i])}<td>${prE(p[i]+p[(i+1)%3])}</td><td>${Ln!=null?Ln.toFixed(3):""}</td>`;
        if(i===0)tr+=`<td rowspan="4">${T.t.base?"Major":"Minor"}</td><td rowspan="4">${T.err>0?"+":""}${T.err}″</td><td rowspan="4">±${Math.round(T.lim)}″</td><td rowspan="4">${T.bad?"EXCEEDS":"OK"}${T.ill.some(x=>x)?"<br>ill-conditioned":""}</td>`;tr+="</tr>"});
      tr+=`<tr class="b"><td>Total</td>${prD3(T.obs.reduce((a,b)=>a+b,0))}<td>${T.corr.reduce((a,b)=>a+b,0)>0?"+":""}${T.corr.reduce((a,b)=>a+b,0)}</td>${prD3(T.adj.reduce((a,b)=>a+b,0))}<td colspan="2"></td></tr>`}
    const ax=sol.axVals.length?`<p class="pnote">Bridge axis ${prE(A+B)}: ${sol.axVals.map(v=>`from △${prE(v.tri)} = ${v.len.toFixed(3)} m`).join(", ")}${sol.axMean!=null?`, mean = <b>${sol.axMean.toFixed(3)} m</b>`:""}${sol.axPrec!=null?`, precision 1 : ${sol.axPrec===Infinity?"∞":Math.round(sol.axPrec).toLocaleString("en-US")} (required 1 : ${BR_LIM.axis.toLocaleString("en-US")})`:""}.</p>`:"";
    out.push({t:"Bridge: angle correction",h:prPage("AC","Bridge Site Angle Correction","",`<table class="bk ac"><tr><th rowspan="2">Triangle</th><th rowspan="2">Angle</th><th colspan="3">Observed Angle</th><th rowspan="2">Correction<br>(s)</th><th colspan="3">Corrected Angle</th><th rowspan="2">Leg</th><th rowspan="2">Distance<br>(m)</th><th rowspan="2">Type</th><th rowspan="2">Error</th><th rowspan="2">Permissible</th><th rowspan="2">Remarks</th></tr><tr><th>d</th><th>m</th><th>s</th><th>d</th><th>m</th><th>s</th></tr>${tr}</table>${ax}`,meta)})}
  // reciprocal levelling
  const rc=recCalc(sol);
  if(rc.a1||rc.a2){const R=BR.rec,w=(r,x,at,lbl,h,first)=>`<tr>${first?`<td rowspan="2">${at}</td>`:""}<td>${lbl}</td><td>${prRaw(r[0])}</td><td>${prRaw(r[1])}</td><td>${prRaw(r[2])}</td><td>${x?prF3(x.mean):""}</td><td>${x&&x.dist!=null?x.dist.toFixed(1):""}</td>${first?`<td rowspan="2"><b>${h!=null?(h>=0?"+":"")+prF3(h):""}</b></td>`:""}</tr>`;
    const hd=h=>`<tr><th rowspan="2">Instrument at</th><th rowspan="2">Sighted to</th><th colspan="3">Staff Reading</th><th rowspan="2">Mean = (T+M+B)/3</th><th rowspan="2">Stadia dist (m)</th><th rowspan="2">True height difference<br>${h} = Mean ${prE(A)} − Mean ${prE(B)}</th></tr><tr><th>Top</th><th>Middle</th><th>Bottom</th></tr>`;
    const body=`<p class="psub">First set (instrument nearer to ${prE(A)})</p><table class="bk">${hd("h1")}${w(R.s1.a,rc.a1,"Near "+prE(A),prE(A),rc.h1,true)}${w(R.s1.b,rc.b1,"",prE(B))}</table>
    <p class="psub">Second set (instrument nearer to ${prE(B)})</p><table class="bk">${hd("h2")}${w(R.s2.b,rc.b2,"Near "+prE(B),prE(B),rc.h2,true)}${w(R.s2.a,rc.a2,"",prE(A))}</table>
    <div class="ptwo"><table class="bk sm"><tr><th colspan="2">Error computation</th></tr><tr><td class="l">Error of closure = h1 − h2</td><td>${rc.err!=null?(rc.err>0?"+":"")+rc.err.toFixed(0)+" mm":""}</td></tr><tr><td class="l">Bridge axis length</td><td>${rc.L!=null?rc.L.toFixed(3)+" m":""}</td></tr><tr><td class="l">K = 2 × axis</td><td>${rc.K!=null?rc.K.toFixed(4)+" km":""}</td></tr><tr><td class="l">Permissible 24√K</td><td>${rc.perm!=null?"±"+rc.perm.toFixed(2)+" mm "+(rc.bad?"EXCEEDS":rc.err!=null?"OK":""):""}</td></tr></table>
    <table class="bk sm"><tr><th colspan="2">RL computation</th></tr><tr><td class="l">RL of ${prE(A)}</td><td>${rc.rlA!=null?prF3(rc.rlA)+" m":"(from fly levelling)"}</td></tr><tr><td class="l">Mean height difference</td><td>${rc.dh!=null?(rc.dh>=0?"+":"")+prF3(rc.dh)+" m":""}</td></tr><tr><td class="l">RL of ${prE(B)}</td><td>${rc.rlB!=null?prF3(rc.rlB)+" m":rc.dh!=null?`RL ${prE(A)} ${rc.dh>=0?"+":"−"} ${prF3(Math.abs(rc.dh))}`:""}</td></tr></table></div>`;
    out.push({t:"Bridge: reciprocal levelling",h:prPage(13,"Reciprocal Levelling",`Across the river on the bridge axis ${prE(A)}–${prE(B)}`,body,{inst:"Auto level"})})}
  // drawing + coordinates
  if(ready.length&&sol.axMean!=null){const keep=BR.start,hasStart=bNum(BR.start.N)!=null&&bNum(BR.start.E)!=null&&bDeg(BR.start.brg)!=null;
    if(!hasStart)BR.start={N:"1000",E:"1000",brg:["0","0","0"]};let X;try{X=brCoords(sol)}finally{BR.start=keep}
    const svg=prBrDraw(sol,X);
    if(svg)out.push({t:"Bridge: drawing",h:prPage("Plot","Bridge Site Triangulation","Layout with corrected angles and computed sides",`<div class="pdraw">${svg}</div><p class="pnote">Corrected angles (red) and computed side lengths. Solid lines: base triangles (major). Dashed lines: extra triangles (minor).</p>`,{inst:"Total Station, Tape"})});
    const sides=Object.keys(sol.sides).sort().map(k=>`<tr><td>${prE(k.replace("|",""))}</td><td>${sol.sides[k].toFixed(3)}</td><td>${prE(sol.src[k])}</td></tr>`).join("");
    const xy=Object.keys(X).sort().map(k=>`<tr><td>${prE(k)}</td><td>${prF3(X[k].N)}</td><td>${prF3(X[k].E)}</td></tr>`).join("");
    const hyd=hydCalc();const H=BR.hyd;
    const hy=(H.dist||H.hfl||H.nwl)?`<table class="bk sm"><tr><th colspan="2">Hydrology</th></tr>${H.dist?`<tr><td class="l">Float distance</td><td>${prE(H.dist)} m</td></tr>`:""}${hyd&&hyd.vmean!=null?`<tr><td class="l">Surface velocity</td><td>${hyd.vsurf.toFixed(2)} m/s</td></tr><tr><td class="l">Mean velocity (× ${hyd.k})</td><td>${hyd.vmean.toFixed(2)} m/s</td></tr>`:""}${["hfl","nwl","lwl","bed"].filter(k=>H[k]).map(k=>`<tr><td class="l">${k.toUpperCase()}</td><td>${prE(H[k])}</td></tr>`).join("")}</table>`:"";
    out.push({t:"Bridge: summary",h:prPage("Sum","Bridge Site Summary","Sides and station coordinates",`<div class="ptwo"><table class="bk"><tr><th>Side</th><th>Length (m)</th><th>Source</th></tr>${sides}</table><table class="bk"><tr><th>Station</th><th>Northing</th><th>Easting</th></tr>${xy}</table>${hy}</div>
      <p class="pnote">${hasStart?"Coordinates from the start point and bearing set in the bridge settings.":`Local coordinates: ${prE(A)} = 1000.000 N, 1000.000 E, bearing ${prE(A)}→${prE(B)} = 0°00′00″.`}</p>`,{inst:"Total Station, Tape"})})}
  return out}

/* ================= Coordinate transfer points (format 10 style list) ================= */
function prCTAvail(){return typeof CT!=="undefined"&&CT.setups.some(S=>S.pts.length)}
function prCTPages(){const out=[];for(const S of CT.setups){if(!S.pts.length)continue;
  const rows=S.pts.map((p,i)=>`<tr><td>${i+1}</td><td>${prE(p.p)}</td><td>${prF3(n3(p.N))}</td><td>${prF3(n3(p.E))}</td><td>${prF3(n3(p.Z))}</td><td class="l">${prE(p.rem||"")}</td></tr>`);
  for(let i=0;i<rows.length;i+=22)out.push({t:"Detailing: at "+(S.stn||""),h:prPage(10,"Detailing by Total Station",`Station ${prE(S.stn||"")} · Backsight ${prE(S.bs||"")} · HI ${prE(S.hi||"")} · HT ${prE(S.ht||"")}`,`<table class="bk"><tr><th>S.No.</th><th>Point</th><th>Northing</th><th>Easting</th><th>RL</th><th>Remarks</th></tr>${rows.slice(i,i+22).join("")}</table>`)})}
  return out}

/* ================= Books, cover, preview, print ================= */
const PR_BOOKS=[["major","Major traverse",()=>prTravAvail("major"),()=>prTravPages("major")],
  ["minor","Minor traverse",()=>prTravAvail("minor"),()=>prTravPages("minor")],
  ["fly","Unlinked fly levelling",()=>prLevAvail("fly"),()=>prLevPages("fly")],
  ["lev","Fly levelling (traverse)",()=>prLevAvail("lev"),()=>prLevPages("lev")],
  ["mlev","Minor loop levelling",()=>prLevAvail("mlev"),()=>prLevPages("mlev")],
  ["br","Bridge site",prBrAvail,prBrPages],
  ["bfly","Bridge fly levelling",()=>prLevAvail("bfly"),()=>prLevPages("bfly")],
  ["bloop","Bridge loop levelling",()=>prLevAvail("bloop"),()=>prLevPages("bloop")],
  ["ct","Detailing points",prCTAvail,prCTPages]];
function prCover(list){const rows=list.map(x=>`<tr><td>${x.from===x.to?x.from:x.from+"–"+x.to}</td><td class="l">${prE(x.t)}</td></tr>`).join("");
  return `<section class="pg cover"><div class="pbody"><div class="puni">Tribhuvan University<br>Institute of Engineering<br>Pulchowk Campus<br><span class="pdept">Department of Civil Engineering</span><br>Survey Instruction Committee</div>
  <h1>Survey Camp Field Book</h1><p class="csub">Group ${prE(prGroup()||"…")}</p>
  <table class="bk ctoc"><tr><th>Pages</th><th>Sheet</th></tr>${rows}</table>
  <p class="credit">Printed from the Survey Camp field checker · made by Gaurab KC with Claude Code</p></div><div class="pfoot"><span></span><span>Page No: <i class="pno"></i></span></div></section>`}
function prBuild(keys){const pages=[],skipped=[];
  for(const[k,name,avail,make]of PR_BOOKS){if(!keys.includes(k)||!avail())continue;
    for(const p of make()){if(p.skip){skipped.push(name+" Gale's table: "+p.skip);continue}pages.push(p)}}
  const list=[];pages.forEach((p,i)=>{const n=i+2,last=list[list.length-1];if(last&&last.t===p.t)last.to=n;else list.push({t:p.t,from:n,to:n})});
  const html=prCover(list)+pages.map(p=>p.h).join("");
  return{html,n:pages.length+1,skipped}}
function prNumber(root){root.querySelectorAll(".pg").forEach((s,i)=>{const e=s.querySelector(".pno");if(e)e.textContent=i+1})}
function prRoot(){let r=document.getElementById("printroot");if(!r){r=document.createElement("div");r.id="printroot";r.className="pb";document.body.appendChild(r)}return r}
function prFit(){const w=document.getElementById("prv");if(!w)return;const z=Math.min(1,(w.clientWidth-2)/1123);w.style.setProperty("--z",z)}
window.addEventListener("resize",prFit);
function renderPrint(h){backTo="";homeBtn.textContent="◀ Home";homeBtn.classList.remove("hidden");guideBtn.classList.add("hidden");
  title.innerHTML=`Print field book<small>A4 landscape · Save as PDF</small>`;
  const want=h.split("/")[1];
  const av=PR_BOOKS.filter(([k,,a])=>{try{return a()}catch(e){return false}});
  if(want&&av.some(b=>b[0]===want)){PR.pick={};PR.pick[want]=true}
  else if(!Object.values(PR.pick).some(Boolean))av.forEach(([k])=>PR.pick[k]=true);
  const keys=av.map(b=>b[0]).filter(k=>PR.pick[k]);
  const f=(k,l,ph)=>`<label class="pf"><span>${l}</span><input value="${prE(PR[k])}" placeholder="${ph||""}" oninput="PR['${k}']=this.value;prSave();prRefresh()"></label>`;
  let ctl="";for(const k of["major","minor"]){if(!keys.includes(k))continue;const g=prGalesNeed(k),prev=PK;useTrav(k,true);const G=prGales(k);useTrav(prev||"major",true);
    ctl+=`<div class="card"><h2>${k==="major"?"Major":"Minor"} Gale's table control</h2>${g.need.map(p=>{const v=PR.ctl[k][p]||{},c=(typeof ctXYZ==="function"?ctXYZ(p):null)||(k==="minor"?prMajorXY()[p]:null);
      return `<div class="nez"><label>${prE(p)} N<input inputmode="decimal" value="${prE(v.N||"")}" placeholder="${c&&c.N!=null?c.N:""}" oninput="prCtl('${k}','${prE(p)}','N',this.value)"></label><label>${prE(p)} E<input inputmode="decimal" value="${prE(v.E||"")}" placeholder="${c&&c.E!=null?c.E:""}" oninput="prCtl('${k}','${prE(p)}','E',this.value)"></label><label>&nbsp;<small>${c?"known":"needed"}</small></label></div>`}).join("")}
    ${g.loop?`<div class="nez"><label>Bearing ${prE(g.need[0])}→${prE(g.need[1]||"")} (optional)<input value="${prE(PR.ctl[k].brg||"")}" placeholder="d m s, else from coordinates" oninput="PR.ctl['${k}'].brg=this.value;prSave();prRefresh()"></label></div>`:""}
    <p class="note">${G.err?"⚠ "+prE(G.err):"✓ Gale's table is included."} Grey values come from the known points list${k==="minor"?" or the major Gale's table":""}; type to override.</p></div>`}
  app.innerHTML=`<div class="card"><h2>What to print</h2>${av.length?av.map(([k,n])=>`<label class="pchk"><input type="checkbox" ${PR.pick[k]?"checked":""} onchange="PR.pick['${k}']=this.checked;prSave();renderPrint('print')"> ${n}</label>`).join(""):'<p class="note">Nothing recorded yet.</p>'}</div>
  <div class="card"><h2>Sheet header</h2><div class="pfs">${f("group","Group No",loadCfg("major").cfg.group)}${f("obs","Observer")}${f("rec","Recorder")}${f("inst","Instrument")}${f("date","Date","2083/08/..")}${f("wx","Weather")}${f("temp","Temperature")}</div>
    <p class="note">Levelling lines use the observer, date and weather typed in each line's book.</p></div>
  ${ctl}
  <div class="btns" style="margin-bottom:14px"><button class="btn pri" onclick="prPrint()">🖨 Print / Save as PDF</button></div>
  <p class="note" id="prInfo"></p><div id="prv" class="pb prv"></div>
  <p class="note" style="margin-top:18px;text-align:center">Made by Gaurab KC with Claude Code</p>`;
  prRefresh()}
function prCtl(k,p,f,v){const o=PR.ctl[k][p]=PR.ctl[k][p]||{};o[f]=v;prSave();clearTimeout(prCtl.t);prCtl.t=setTimeout(()=>renderPrint("print"),600)}
function prRefresh(){const w=document.getElementById("prv");if(!w)return;const keys=PR_BOOKS.filter(([k,,a])=>PR.pick[k]&&(()=>{try{return a()}catch(e){return false}})()).map(b=>b[0]);
  let r;try{r=prBuild(keys)}catch(e){w.innerHTML=`<p class="note">Could not build the book: ${prE(e.message)}</p>`;return}
  w.innerHTML=r.html;prNumber(w);const pr=prRoot();pr.innerHTML=r.html;prNumber(pr);
  const info=document.getElementById("prInfo");if(info)info.innerHTML=`${r.n} page${r.n>1?"s":""}.${r.skipped.length?" Not included: "+r.skipped.map(prE).join("; "):""} On a phone: Print → Save as PDF, A4, landscape.`;
  prFit();prAutofit()}
// shrink a page's body when its rows do not fit on one A4 sheet (row counts differ between groups)
function prAutofit(){const w=document.getElementById("prv"),r=document.getElementById("printroot");if(!w)return;
  const z=parseFloat(getComputedStyle(w).getPropertyValue("--z"))||1,mm=96/25.4,lim=210*mm+1,P=w.querySelectorAll(".pg"),Q=r?r.querySelectorAll(".pg"):[];
  P.forEach((pg,i)=>{const b=pg.querySelector(".pbody");if(!b)return;let f=1;
    for(let it=0;it<4;it++){const h=pg.getBoundingClientRect().height/z;if(h<=lim)break;const bh=b.getBoundingClientRect().height/z;f=Math.max(.45,f*(bh-(h-lim)-4)/bh);b.style.zoom=f.toFixed(3)}
    const qb=Q[i]&&Q[i].querySelector(".pbody");if(qb)qb.style.zoom=f<1?f.toFixed(3):""})}
function prPrint(){prRefresh();setTimeout(()=>window.print(),50)}
