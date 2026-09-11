const fs=require('fs');
const P='C:/Users/JorgeRowies/AppData/Local/Temp/claude/c--Tmp-electricidad/c9f8150b-8138-471f-a984-84614096f361/scratchpad/tablero.html';
const html=fs.readFileSync(P,'utf8');
const blocks=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
console.log('script blocks:',blocks.length);

// ---- minimal DOM stub ----
function El(){this.innerHTML='';this.textContent='';this.hidden=false;}
El.prototype.addEventListener=function(){};
El.prototype.querySelectorAll=function(){return[];};
El.prototype.querySelector=function(){return null;};
El.prototype.focus=function(){};
El.prototype.getAttribute=function(){return null;};
const els={};
global.document={
  getElementById(id){return els[id]||(els[id]=new El());},
  querySelectorAll(){return[];},
  querySelector(){return null;}
};
global.CSS={escape:s=>s};

const code=blocks.join('\n;\n');
let ctx;
try{
  ctx=new Function(code+'\n;return {solve,TABS,scene,C1:TABS[0].variants[0]};')();
}catch(e){ console.log('EVAL FAIL:',e.message); process.exit(1); }
console.log('eval OK; scene rendered chars:',els.scene.innerHTML.length);

const {solve,TABS}=ctx;
let fails=0;
const ok=(c,m)=>{ if(!c){console.log('  FAIL '+m);fails++;} };

function allDefs(){const o=[];TABS.forEach(t=>t.variants.forEach(v=>o.push(v)));return o;}

/* ---- 1. dangling-node check (catches wiring typos) ---- */
console.log('\n== node integrity ==');
allDefs().forEach(d=>{
  const cnt={};
  const bump=n=>cnt[n]=(cnt[n]||0)+1;
  d.cables.forEach(c=>{bump(c.a);bump(c.b);});
  (d.lamps||[]).forEach(l=>{bump(l.a);bump(l.b);});
  (d.switches||[]).forEach(s=>Object.values(s.pos).forEach(ps=>ps.forEach(p=>{bump(p[0]);bump(p[1]);})));
  // legitimate single-ended endpoints: plug pins, outlet terminals, unused earth bar
  const ENDS=['PF','PN','PT','TL','TN','TT','T'];
  const dangle=Object.keys(cnt).filter(n=>cnt[n]<2&&!ENDS.includes(n));
  ok(dangle.length===0, d.title+' dangling nodes: '+dangle.join(','));
  if(!dangle.length) console.log('  ok  '+d.title.slice(0,46));
});

/* ---- 2. geometry inside viewBox ---- */
console.log('\n== geometry bounds ==');
allDefs().forEach(d=>{
  let bad=[];
  d.cables.forEach(c=>c.pts.forEach(p=>{
    if(p[0]<0||p[0]>d.vb[0]||p[1]<0||p[1]>d.vb[1]) bad.push(c.id+'@'+p);
  }));
  ok(bad.length===0,d.title+' out of bounds: '+bad.join(' '));
  if(!bad.length) console.log('  ok  '+d.title.slice(0,46));
});

/* ---- 2b. cables running too close to be told apart ---- */
console.log('\n== separacion de cables ==');
function segs(c){
  const out=[];
  c.cables.forEach(cb=>{
    for(let i=0;i<cb.pts.length-1;i++){
      const [x1,y1]=cb.pts[i],[x2,y2]=cb.pts[i+1];
      if(x1===x2&&Math.abs(y2-y1)>8) out.push({cb,dir:'V',at:x1,lo:Math.min(y1,y2),hi:Math.max(y1,y2)});
      if(y1===y2&&Math.abs(x2-x1)>8) out.push({cb,dir:'H',at:y1,lo:Math.min(x1,x2),hi:Math.max(x1,x2)});
    }
  });
  return out;
}
allDefs().forEach(d=>{
  const S=segs(d),bad=[];
  for(let i=0;i<S.length;i++)for(let j=i+1;j<S.length;j++){
    const a=S[i],b=S[j];
    if(a.cb.id===b.cb.id||a.dir!==b.dir) continue;
    // the ficha's three leads are one cable tripolar: bundling is correct there
    if(a.cb.hidden&&b.cb.hidden) continue;
    const gap=Math.abs(a.at-b.at);
    const ov=Math.min(a.hi,b.hi)-Math.max(a.lo,b.lo);
    if(ov<=45||gap>=22) continue;
    const same=a.cb.color===b.cb.color;
    // short different-coloured convergences at a bornera/terminal fan-out are fine
    const real = gap<12 || (same&&ov>100) || ov>150;
    if(real) bad.push('('+a.cb.id+')/('+b.cb.id+') gap '+gap+' solapan '+ov+'px'+(same?' MISMO COLOR':''));
  }
  ok(bad.length===0,d.title.slice(0,30)+' cables indistinguibles: '+bad.join('; '));
  if(!bad.length) console.log('  ok  '+S.length+' tramos · '+d.title.slice(0,40));
});

/* ---- 2c. cables crossing a device body or its bulb ---- */
console.log('\n== cables sobre aparatos ==');
allDefs().forEach(d=>{
  const boxes=[];
  d.parts.forEach(p=>{
    if(p.kind==='sw1')   boxes.push([p.x,p.y,140,100,'llave '+(p.name||'')]);
    if(p.kind==='swc')   boxes.push([p.x,p.y,150,120,p.name]);
    if(p.kind==='swx')   boxes.push([p.x,p.y,170,140,'cruce']);
    if(p.kind==='outlet')boxes.push([p.x,p.y,210,180,'toma']);
    if(p.kind==='bornera')boxes.push([p.x,p.y,150,76,'bornera '+p.k]);
    if(p.kind==='plug')  boxes.push([p.x,p.y,92,104,'ficha']);
    if(p.kind==='holder'){
      boxes.push([p.x+10,p.y,76,64,p.name+' cuerpo']);      // inset: terminals sit on the edges
      boxes.push([p.x+16,p.y-80,64,64,p.name+' bulbo']);    // glass envelope
    }
  });
  const bad=[];
  segs(d).forEach(s=>{
    boxes.forEach(b=>{
      const [bx,by,bw,bh,nm]=b;
      const hit = s.dir==='V'
        ? (s.at>bx&&s.at<bx+bw && s.hi>by+4 && s.lo<by+bh-4)
        : (s.at>by&&s.at<by+bh && s.hi>bx+4 && s.lo<bx+bw-4);
      if(hit) bad.push('('+s.cb.id+') atraviesa '+nm);
    });
  });
  ok(bad.length===0,d.title.slice(0,30)+' -> '+[...new Set(bad)].join('; '));
  if(!bad.length) console.log('  ok  '+boxes.length+' aparatos · '+d.title.slice(0,40));
});

/* ---- 3. truth tables from the source .md files ---- */
console.log('\n== truth tables ==');
allDefs().forEach(d=>{
  if(!d.truth)return;
  const T=d.truth;
  T.rows.forEach(r=>{
    const st={};
    T.keys.forEach((k,i)=>st[k]=r[i]);
    const res=solve(d,st);
    const litN=(d.lamps||[]).filter(l=>(res.bright[l.id]||0)>0).length;
    const expLit=/ENCENDID/.test(r[r.length-1]);
    ok((litN>0)===expLit,
      d.title.slice(0,26)+' ['+T.keys.map((k,i)=>k+'='+r[i]).join(' ')+'] esperado '+
      r[r.length-1]+', obtuve '+litN+' encendida(s)');
  });
  console.log('  ok  '+T.rows.length+' filas · '+d.title.slice(0,42));
});

/* ---- 4. per-circuit expectations ---- */
console.log('\n== circuit behaviour ==');
const D=allDefs();
const C1=D[0],C2A=D[1],C2B=D[2],C3=D[3],C4=D[4];

let r=solve(C1,{K:'on'});
ok(Math.abs(r.bright.L1-0.5)<1e-9 && Math.abs(r.bright.L2-0.5)<1e-9,'C1 on: serie -> 0.5 c/u (got '+r.bright.L1+','+r.bright.L2+')');
ok(['1','2','3','4'].every(i=>r.cables[i]==='flow'),'C1 on: 1-4 con corriente');
ok(r.cables['5']==='hot'&&r.cables['6']==='neutral'&&r.cables['7']==='earth','C1 on: toma 5/6/7');
ok(r.tomaLive,'C1 on: toma con tension');
ok(r.warnLamps.length===0,'C1 on: sin advertencia');
console.log('  ok  C1 llave cerrada');

r=solve(C1,{K:'off'});
ok(!r.bright.L1&&!r.bright.L2,'C1 off: apagadas');
ok(r.cables['1']==='hot','C1 off: (1) con fase');
// with the switch open the chain sits at NEUTRAL potential through the filaments
ok(r.cables['2']==='neutral'&&r.cables['3']==='neutral','C1 off: (2)(3) al neutro via filamentos (got '+r.cables['2']+','+r.cables['3']+')');
ok(r.cables['4']==='neutral','C1 off: (4) al neutro');
ok(r.warnLamps.length===0,'C1 off: portalamparas SIN fase (llave corta la fase)');
ok(r.tomaLive,'C1 off: toma sigue con 220 V');
console.log('  ok  C1 llave abierta');

r=solve(C2A,{K:'off'});
ok(r.bright.LA===1,'C2A off: lampara A encendida sola');
ok(!r.bright.LB,'C2A off: lampara B apagada');
ok(r.cables['3']==='hot'&&r.cables['4']==='hot','C2A off: (3)(4) con fase sin corriente');
ok(r.warnLamps.length===1&&r.warnLamps[0].id==='LB','C2A off: advertencia en lampara B');
console.log('  ok  C2A llave sobre el neutro -> portalamparas con fase');

r=solve(C2A,{K:'on'});
ok(r.bright.LA===1&&r.bright.LB===1,'C2A on: paralelo, 220 V cada una');
ok(r.warnLamps.length===0,'C2A on: sin advertencia');
console.log('  ok  C2A llave cerrada');

r=solve(C2B,{K:'off'});
ok(r.bright.LA===1&&!r.bright.LB,'C2B off: A encendida, B apagada');
ok(r.cables['3']==='hot','C2B off: (3) con fase hasta la llave');
ok(r.cables['4']==='neutral','C2B off: (4) al neutro via filamento (got '+r.cables['4']+')');
ok(r.warnLamps.length===0,'C2B off: portalamparas B SIN fase -> corregido');
console.log('  ok  C2B llave sobre la fase -> portalamparas seguro');

r=solve(C2B,{K:'on'});
ok(r.bright.LA===1&&r.bright.LB===1,'C2B on: las dos a 220 V');
console.log('  ok  C2B llave cerrada');

r=solve(C3,{K1:'v1',K2:'v1'});
ok(r.bright.L1===1&&r.bright.L2===1,'C3 v1/v1: paralelo a 220 V cada una (got '+r.bright.L1+','+r.bright.L2+')');
ok(r.tomaLive,'C3: toma con tension');
r=solve(C3,{K1:'v1',K2:'v2'});
ok(!r.bright.L1&&!r.bright.L2,'C3 v1/v2: apagadas');
ok(r.warnLamps.length===0,'C3 apagado: portalamparas sin fase');
console.log('  ok  C3 escalera');

// each of the three points must invert the lamp on its own
let base={K1:'v1',X:'derecho',K4:'v1'};
ok((solve(C4,base).bright.LP||0)>0,'C4 estado del plano: encendida');
['K1','X','K4'].forEach(k=>{
  const s=Object.assign({},base);
  s[k]=C4.switches.find(x=>x.id===k).order.filter(o=>o!==base[k])[0];
  ok(!(solve(C4,s).bright.LP>0),'C4: mover '+k+' sola debe apagar');
});
console.log('  ok  C4 tres puntos, cada llave invierte');

// no circuit should ever report a short
console.log('\n== cortocircuitos ==');
allDefs().forEach(d=>{
  const sws=d.switches||[];
  const combos=sws.reduce((acc,s)=>acc.flatMap(a=>s.order.map(o=>Object.assign({},a,{[s.id]:o}))),[{}]);
  const bad=combos.filter(c=>solve(d,c).shorted);
  ok(bad.length===0,d.title+' cortocircuito en '+JSON.stringify(bad));
  console.log('  ok  '+combos.length+' combinaciones · '+d.title.slice(0,42));
});

console.log('\n'+(fails?('*** '+fails+' FALLAS ***'):'TODO OK'));
process.exit(fails?1:0);
